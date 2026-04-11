import * as crypto from "node:crypto";
import * as path from "node:path";
import type * as vscode from "vscode";
import { displayIssueTypeLabel, leanQuillIssueFileAbsolutePath, listOpenQuestions } from "./openQuestionStore";
import { renderOpenQuestionsHtml, type SerializableOpenQuestionRow } from "./openQuestionsHtml";
import type { OpenQuestionRecord } from "./types";

/**
 * Bottom-panel host for Open Questions (D-02). Uses the same HTML builder and
 * `openQuestion:*` protocol as the Planning workspace tab.
 * Webview: retainContextWhenHidden — enabled in `extension.ts` when registering this provider.
 */
export class OpenQuestionsPanelViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewId = "leanquill.openQuestionsPanel";

  private _view: vscode.WebviewView | undefined;

  constructor(
    private readonly vscodeApi: typeof vscode,
    private readonly extensionUri: vscode.Uri,
    private readonly rootPath: string,
  ) {}

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
    const rows = this._rows(list);
    const nonce = crypto.randomBytes(16).toString("hex");
    const html = renderOpenQuestionsHtml(rows, "panel", nonce, this._view.webview.cspSource, true, {
      currentFilter: "active",
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
