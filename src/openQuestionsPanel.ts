import * as crypto from "node:crypto";
import * as path from "node:path";
import type * as vscode from "vscode";
import type { IssueListFilter, IssueStatus } from "./issueFilters";
import { matchesIssueFilter } from "./issueFilters";
import { AUTHOR_ISSUE_TYPES } from "./issueTypes";
import {
  createOpenQuestion,
  displayIssueTypeLabel,
  leanQuillIssueFileAbsolutePath,
  listOpenQuestions,
  saveOpenQuestion,
} from "./openQuestionStore";
import { renderOpenQuestionsHtml, type SerializableOpenQuestionRow } from "./openQuestionsHtml";
import type { OpenQuestionRecord } from "./types";
import type { SafeFileSystem } from "./safeFileSystem";

/**
 * Bottom-panel host for Issues (D-02). Same HTML builder and `openQuestion:*` protocol as Planning.
 * Webview: retainContextWhenHidden — enabled in `extension.ts` when registering this provider.
 * Issue files are under `.leanquill/issues/` via `listOpenQuestions` / `leanQuillIssueFileAbsolutePath` (no legacy `open-questions` paths).
 */
export class OpenQuestionsPanelViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewId = "leanquill.openQuestionsPanel";

  private _view: vscode.WebviewView | undefined;

  private _issueListFilter: IssueListFilter = "active";

  constructor(
    private readonly vscodeApi: typeof vscode,
    private readonly extensionUri: vscode.Uri,
    private readonly rootPath: string,
    private readonly _workspaceState: vscode.Memento | undefined,
    private readonly safeFs: SafeFileSystem,
  ) {
    const saved = this._workspaceState?.get<string>("leanquill.issueListFilter");
    if (
      saved === "active" ||
      saved === "open" ||
      saved === "deferred" ||
      saved === "dismissed" ||
      saved === "all"
    ) {
      this._issueListFilter = saved;
    }
  }

  public resolveWebviewView(webviewView: vscode.WebviewView): void {
    this._view = webviewView;
    webviewView.title = "LeanQuill Issues";
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
    const filtered = list.filter((q) => matchesIssueFilter(q.status as IssueStatus, this._issueListFilter));
    const rows = this._rows(filtered);
    const nonce = crypto.randomBytes(16).toString("hex");
    const html = renderOpenQuestionsHtml(rows, "panel", nonce, this._view.webview.cspSource, true, {
      currentFilter: this._issueListFilter,
      totalIssueCount: list.length,
    });
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
      case "research":
        return path.basename(association.fileName) || association.fileName;
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
    const chip = this._associationChip(r.association);
    return {
      id: r.id,
      title: r.title,
      preview: preview || " ",
      body: r.body ?? "",
      status: r.status,
      issueType: r.issueSchemaType,
      associationChip: chip,
      associationChips: [chip],
      issueTypeLabel: displayIssueTypeLabel(r.issueSchemaType),
      dismissedReason: r.dismissedReason,
      relativeIssuePath: r.fileName,
      stale: Boolean(r.staleHint),
    };
  }

  private _rows(list: OpenQuestionRecord[]): SerializableOpenQuestionRow[] {
    return list.map((r) => this._toRow(r));
  }

  private async _openInEditor(id: string): Promise<void> {
    if (!id) {
      return;
    }
    const list = await listOpenQuestions(this.rootPath);
    const q = list.find((x) => x.id === id);
    if (!q) {
      return;
    }
    const abs = leanQuillIssueFileAbsolutePath(this.rootPath, q.fileName);
    const uri = this.vscodeApi.Uri.file(abs);
    const doc = await this.vscodeApi.workspace.openTextDocument(uri);
    await this.vscodeApi.window.showTextDocument(doc, { preview: false });
  }

  private async _saveOpenQuestionDetail(msg: Record<string, unknown>): Promise<void> {
    const id = String(msg.id ?? "");
    if (!id) {
      return;
    }
    const list = await listOpenQuestions(this.rootPath);
    const q = list.find((x) => x.id === id);
    if (!q) {
      return;
    }
    const status = String(msg.status ?? "open");
    if (!["open", "deferred", "dismissed", "resolved"].includes(status)) {
      return;
    }
    const title = String(msg.title ?? "");
    const body = String(msg.body ?? "");
    const drRaw = String(msg.dismissedReason ?? "").trim();
    const next: OpenQuestionRecord = {
      ...q,
      title,
      body,
      status: status as OpenQuestionRecord["status"],
      dismissedReason:
        status === "dismissed" ? (drRaw.length > 0 ? drRaw : undefined) : undefined,
    };
    await saveOpenQuestion(next, this.rootPath, this.safeFs);
    await this.refresh();
  }

  private async _dismissOpenQuestion(id: string, dismissedReason: string): Promise<void> {
    if (!id) {
      return;
    }
    const list = await listOpenQuestions(this.rootPath);
    const q = list.find((x) => x.id === id);
    if (!q) {
      return;
    }
    const dr = dismissedReason.trim();
    await saveOpenQuestion(
      {
        ...q,
        status: "dismissed",
        dismissedReason: dr.length > 0 ? dr : undefined,
      },
      this.rootPath,
      this.safeFs,
    );
    await this.refresh();
  }

  private async _createNewIssueFromPanel(): Promise<void> {
    const title = await this.vscodeApi.window.showInputBox({
      prompt: "Issue title",
      placeHolder: "Short name for this issue",
    });
    if (!title?.trim()) {
      return;
    }
    const items = AUTHOR_ISSUE_TYPES.map((slug) => ({
      label: displayIssueTypeLabel(slug),
      description: slug,
    }));
    const picked = await this.vscodeApi.window.showQuickPick(items, {
      placeHolder: "Issue type",
    });
    const typeSlug = picked?.description?.trim();
    if (!typeSlug) {
      return;
    }
    await createOpenQuestion(this.safeFs, this.rootPath, {
      title: title.trim(),
      association: { kind: "book" },
      issueType: typeSlug,
    });
    await this.refresh();
  }

  private async _handleMessage(msg: Record<string, unknown>): Promise<void> {
    const type = msg.type as string;
    const host = msg.host as string;
    if (host !== "panel") {
      return;
    }

    switch (type) {
      case "openQuestion:openEditor":
        await this._openInEditor(String(msg.id ?? ""));
        break;

      case "openQuestion:refresh":
        await this.refresh();
        break;

      case "openQuestion:setFilter": {
        const f = String(msg.filter ?? "");
        const allowed: IssueListFilter[] = ["active", "open", "deferred", "dismissed", "all"];
        if (allowed.includes(f as IssueListFilter)) {
          this._issueListFilter = f as IssueListFilter;
          void this._workspaceState?.update("leanquill.issueListFilter", this._issueListFilter);
          await this.refresh();
        }
        break;
      }

      case "openQuestion:saveDetail":
        await this._saveOpenQuestionDetail(msg);
        break;

      case "openQuestion:dismiss":
        await this._dismissOpenQuestion(String(msg.id ?? ""), String(msg.dismissedReason ?? ""));
        break;

      case "openQuestion:new-question":
        await this._createNewIssueFromPanel();
        break;

      default:
        break;
    }
  }
}
