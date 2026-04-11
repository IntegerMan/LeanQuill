import * as crypto from "node:crypto";
import type * as vscode from "vscode";
import type { IssueListFilter, IssueStatus } from "./issueFilters";
import { matchesIssueFilter } from "./issueFilters";
import { associationKindLabel, associationSourceDisplayText } from "./issueAssociationDisplay";
import {
  createOpenQuestion,
  displayIssueTypeLabel,
  leanQuillIssueFileAbsolutePath,
  listOpenQuestions,
  saveOpenQuestion,
} from "./openQuestionStore";
import { readProjectIdentity } from "./projectConfig";
import {
  confirmAndDeleteIssueById,
  executeOpenIssueTargetCommand,
  pickIssueStatusAndSave,
} from "./openQuestionWebviewHost";
import { promptNewIssueTitleAndType } from "./promptNewIssue";
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
    const identity = await readProjectIdentity(this.rootPath);
    const rows = this._rows(filtered, identity.workingTitle);
    const nonce = crypto.randomBytes(16).toString("hex");
    const html = renderOpenQuestionsHtml(rows, "panel", nonce, this._view.webview.cspSource, true, {
      currentFilter: this._issueListFilter,
      totalIssueCount: list.length,
    });
    this._view.webview.html = html;
  }

  private _toRow(r: OpenQuestionRecord, bookWorkingTitle: string): SerializableOpenQuestionRow {
    const line = (r.body || "").split("\n")[0]?.trim() ?? "";
    const preview = line.length > 120 ? `${line.slice(0, 120)}…` : line;
    const sourceText = associationSourceDisplayText(r.association, bookWorkingTitle);
    return {
      id: r.id,
      title: r.title,
      preview: preview || " ",
      body: r.body ?? "",
      status: r.status,
      issueType: r.issueSchemaType,
      associationTypeLabel: associationKindLabel(r.association.kind),
      associationChip: sourceText,
      associationChips: [sourceText],
      issueTypeLabel: displayIssueTypeLabel(r.issueSchemaType),
      dismissedReason: r.dismissedReason,
      relativeIssuePath: r.fileName,
      stale: Boolean(r.staleHint),
    };
  }

  private _rows(list: OpenQuestionRecord[], bookWorkingTitle: string): SerializableOpenQuestionRow[] {
    return list.map((r) => this._toRow(r, bookWorkingTitle));
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
    const fields = await promptNewIssueTitleAndType(this.vscodeApi);
    if (!fields) {
      return;
    }
    await createOpenQuestion(this.safeFs, this.rootPath, {
      title: fields.title,
      association: { kind: "book" },
      issueType: fields.issueType,
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

      case "openQuestion:openTarget":
        await executeOpenIssueTargetCommand(this.vscodeApi, String(msg.id ?? ""));
        break;

      case "openQuestion:delete": {
        const deleted = await confirmAndDeleteIssueById(
          this.vscodeApi,
          this.rootPath,
          this.safeFs,
          String(msg.id ?? ""),
        );
        if (deleted) {
          await this.refresh();
        }
        break;
      }

      case "openQuestion:editStatus":
        await pickIssueStatusAndSave(this.vscodeApi, this.rootPath, this.safeFs, String(msg.id ?? ""));
        await this.refresh();
        break;

      default:
        break;
    }
  }
}
