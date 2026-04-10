import * as crypto from "node:crypto";
import type * as vscode from "vscode";
import { deleteOpenQuestion, listOpenQuestions, saveOpenQuestion } from "./openQuestionStore";
import { renderOpenQuestionsHtml, type SerializableOpenQuestionRow } from "./openQuestionsHtml";
import { SafeFileSystem } from "./safeFileSystem";
import type { OpenQuestionRecord, OpenQuestionStatus } from "./types";

/**
 * Bottom-panel host for Open Questions (D-02). Uses the same HTML builder and
 * `openQuestion:*` protocol as the Planning workspace tab.
 * Webview: retainContextWhenHidden — enabled in `extension.ts` when registering this provider.
 */
export class OpenQuestionsPanelViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewId = "leanquill.openQuestionsPanel";

  private _view: vscode.WebviewView | undefined;
  private _selectedOpenQuestionId: string | undefined;
  private _pendingOpenQuestion: OpenQuestionRecord | undefined;
  private _oqDebounceTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private readonly vscodeApi: typeof vscode,
    private readonly extensionUri: vscode.Uri,
    private readonly rootPath: string,
    private readonly safeFs: SafeFileSystem,
  ) {}

  public resolveWebviewView(webviewView: vscode.WebviewView): void {
    this._view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };
    webviewView.webview.onDidReceiveMessage((msg) => {
      void this._handleMessage(msg as Record<string, unknown>);
    });
    void this.refresh();
  }

  public async refresh(): Promise<void> {
    if (!this._view) {
      return;
    }
    const list = await listOpenQuestions(this.rootPath);
    if (
      this._selectedOpenQuestionId &&
      !list.find((q) => q.id === this._selectedOpenQuestionId)
    ) {
      this._selectedOpenQuestionId = undefined;
    }
    const rows = this._rows(list);
    const nonce = crypto.randomBytes(16).toString("hex");
    const html = renderOpenQuestionsHtml(
      rows,
      this._selectedOpenQuestionId,
      "panel",
      nonce,
      this._view.webview.cspSource,
      true,
    );
    this._view.webview.html = html;
  }

  private _associationChip(association: OpenQuestionRecord["association"]): string {
    switch (association.kind) {
      case "book":
        return "Book";
      case "character":
        return `Character · ${association.fileName}`;
      case "place":
        return `Place · ${association.fileName}`;
      case "thread":
        return `Thread · ${association.fileName}`;
      case "chapter":
        return `Chapter · ${association.chapterRef}`;
      case "selection":
        return `Selection · ${association.chapterRef}`;
      default:
        return "Book";
    }
  }

  private _toRow(r: OpenQuestionRecord): SerializableOpenQuestionRow {
    const line = (r.body || "").split("\n")[0]?.trim() ?? "";
    const preview = line.length > 120 ? `${line.slice(0, 120)}…` : line;
    return {
      id: r.id,
      title: r.title,
      body: r.body,
      preview: preview || " ",
      status: r.status,
      associationChip: this._associationChip(r.association),
      stale: Boolean(r.staleHint),
    };
  }

  private _rows(list: OpenQuestionRecord[]): SerializableOpenQuestionRow[] {
    return list.map((r) => {
      const effective =
        this._pendingOpenQuestion && this._pendingOpenQuestion.id === r.id ? this._pendingOpenQuestion : r;
      return this._toRow(effective);
    });
  }

  private async _flushPending(): Promise<void> {
    if (this._oqDebounceTimer) {
      clearTimeout(this._oqDebounceTimer);
      this._oqDebounceTimer = undefined;
    }
    if (this._pendingOpenQuestion) {
      const rec = this._pendingOpenQuestion;
      try {
        await saveOpenQuestion(rec, this.rootPath, this.safeFs);
      } catch (err: unknown) {
        console.error("[LeanQuill] Open questions panel: save failed", err);
        await this.vscodeApi.window.showErrorMessage(
          "Could not save this question. Check the file is writable and retry.",
        );
        return;
      }
      this._pendingOpenQuestion = undefined;
    }
  }

  private async _updateField(id: string, field: string, value: string): Promise<void> {
    if (!id) {
      return;
    }
    if (this._pendingOpenQuestion && this._pendingOpenQuestion.id !== id) {
      await this._flushPending();
    }
    if (!this._pendingOpenQuestion || this._pendingOpenQuestion.id !== id) {
      const list = await listOpenQuestions(this.rootPath);
      const found = list.find((q) => q.id === id);
      if (!found) {
        return;
      }
      this._pendingOpenQuestion = { ...found };
    }
    const pending = this._pendingOpenQuestion;
    if (!pending || pending.id !== id) {
      return;
    }
    if (field === "title") {
      pending.title = value;
    } else if (field === "body") {
      pending.body = value;
    } else if (field === "status") {
      const s = value as OpenQuestionStatus;
      if (s === "open" || s === "deferred" || s === "resolved") {
        pending.status = s;
      }
    }

    if (this._oqDebounceTimer) {
      clearTimeout(this._oqDebounceTimer);
    }
    const toWrite = pending;
    this._oqDebounceTimer = setTimeout(() => {
      void saveOpenQuestion(toWrite, this.rootPath, this.safeFs)
        .then(() => {
          if (this._pendingOpenQuestion?.id === toWrite.id) {
            this._pendingOpenQuestion = undefined;
          }
        })
        .catch((err: unknown) => {
          console.error("[LeanQuill] Open questions panel: debounced save failed", err);
        });
    }, 300);
  }

  private async _handleDelete(id: string): Promise<void> {
    if (!id) {
      return;
    }
    const choice = await this.vscodeApi.window.showWarningMessage(
      "Delete this open question? This cannot be undone.",
      { modal: true },
      "Delete",
    );
    if (choice !== "Delete") {
      return;
    }
    await this._flushPending();
    const list = await listOpenQuestions(this.rootPath);
    const found = list.find((q) => q.id === id);
    if (found) {
      await deleteOpenQuestion(found.fileName, this.rootPath, this.safeFs);
    }
    if (this._selectedOpenQuestionId === id) {
      this._selectedOpenQuestionId = undefined;
    }
    await this.refresh();
  }

  private async _handleMessage(msg: Record<string, unknown>): Promise<void> {
    const type = msg.type as string;
    const host = msg.host as string;
    if (host !== "panel") {
      return;
    }

    switch (type) {
      case "openQuestion:select":
        await this._flushPending();
        this._selectedOpenQuestionId = String(msg.id ?? "");
        this._pendingOpenQuestion = undefined;
        await this.refresh();
        break;

      case "openQuestion:fieldChange":
        await this._updateField(String(msg.id ?? ""), String(msg.field ?? ""), String(msg.value ?? ""));
        break;

      case "openQuestion:save":
        await this._flushPending();
        await this.refresh();
        break;

      case "openQuestion:delete":
        await this._handleDelete(String(msg.id ?? ""));
        break;

      case "openQuestion:navigate":
        try {
          await this.vscodeApi.commands.executeCommand("leanquill.openQuestionTarget", String(msg.id ?? ""));
        } catch {
          /* optional until command registered */
        }
        break;

      case "openQuestion:refresh":
        await this.refresh();
        break;

      case "openQuestion:new-question":
        try {
          await this.vscodeApi.commands.executeCommand("leanquill.newOpenQuestion");
        } catch {
          /* optional */
        }
        break;

      default:
        break;
    }
  }
}
