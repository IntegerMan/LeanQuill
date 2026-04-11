/**
 * Manuscript gutter decorations for selection-anchored issues (ISSUE-04, D-11–D-13).
 *
 * ISSUE-04 D-12 spike: VS Code `TextEditorDecorationType` gutter icons do not expose a stable
 * per-decoration `onClick` in the public API for `engines.vscode ^1.90`. D-12 navigation for
 * stacked anchors is therefore implemented via **`LeanQuill: Issues at Cursor`**
 * (`leanquill.issuesAtCursor`) and optional **command links** in hover `MarkdownString`; literal
 * gutter glyph click is **not** wired here — hover + command/hover link are the primary UX (see
 * 08-RESEARCH Pitfall 3).
 */

import type * as vscode from "vscode";
import { isActiveForSidebarCount, type IssueStatus } from "./issueFilters";
import { leanQuillIssueFileAbsolutePath, listOpenQuestions } from "./openQuestionStore";
import { resolveSpanHintInDocument, type SpanHintResolution } from "./spanHintResolve";
import type { OpenQuestionRecord } from "./types";

const DEBOUNCE_MS = 150;

function normalizeFsPath(value: string): string {
  return value.split("\\").join("/");
}

function manuscriptRelativePath(vscodeApi: typeof vscode, doc: vscode.TextDocument): string | undefined {
  const rel = normalizeFsPath(vscodeApi.workspace.asRelativePath(doc.uri, false));
  if (!rel || rel.startsWith("..")) {
    return undefined;
  }
  if (!rel.startsWith("manuscript/") || !rel.endsWith(".md")) {
    return undefined;
  }
  return rel;
}

function selectionSpanHint(q: OpenQuestionRecord): string | undefined {
  if (q.association.kind !== "selection") {
    return undefined;
  }
  const h = q.association.spanHint?.trim();
  return h || undefined;
}

function issueChapterRef(q: OpenQuestionRecord): string | undefined {
  const a = q.association;
  if (a.kind === "chapter") {
    return normalizeFsPath(a.chapterRef);
  }
  if (a.kind === "selection") {
    return normalizeFsPath(a.chapterRef);
  }
  return undefined;
}

function resolutionToRange(
  doc: vscode.TextDocument,
  res: SpanHintResolution,
): { start: vscode.Position; end: vscode.Position; line: number } | undefined {
  if (res.kind === "matched") {
    const start = doc.positionAt(res.start);
    const end = doc.positionAt(res.end);
    return { start, end, line: start.line };
  }
  if (res.kind === "ambiguous" && res.candidates.length > 0) {
    const c = res.candidates[0];
    const start = doc.positionAt(c.start);
    const end = doc.positionAt(c.end);
    return { start, end, line: start.line };
  }
  return undefined;
}

function issueCoversCursorLine(
  doc: vscode.TextDocument,
  q: OpenQuestionRecord,
  cursorLine: number,
): boolean {
  const hint = selectionSpanHint(q);
  if (!hint) {
    return false;
  }
  const text = doc.getText();
  const res = resolveSpanHintInDocument(text, hint);
  if (res.kind === "matched") {
    const start = doc.positionAt(res.start).line;
    const end = doc.positionAt(res.end).line;
    return cursorLine >= start && cursorLine <= end;
  }
  if (res.kind === "ambiguous") {
    return res.candidates.some((c) => {
      const a = doc.positionAt(c.start).line;
      const b = doc.positionAt(c.end).line;
      return cursorLine >= a && cursorLine <= b;
    });
  }
  if (res.kind === "stale") {
    return cursorLine === 0;
  }
  return false;
}

export class IssueGutterController implements vscode.Disposable {
  private readonly decMatched: vscode.TextEditorDecorationType;

  private readonly decStale: vscode.TextEditorDecorationType;

  private readonly subs: vscode.Disposable[] = [];

  private debounceTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private readonly vscodeApi: typeof vscode,
    private readonly rootPath: string,
    extensionUri: vscode.Uri,
  ) {
    const iconUri = vscodeApi.Uri.joinPath(extensionUri, "media", "issue-gutter.svg");
    const staleIconUri = vscodeApi.Uri.joinPath(extensionUri, "media", "issue-gutter-stale.svg");
    this.decMatched = vscodeApi.window.createTextEditorDecorationType({
      gutterIconPath: iconUri,
      gutterIconSize: "contain",
    });
    this.decStale = vscodeApi.window.createTextEditorDecorationType({
      gutterIconPath: staleIconUri,
      gutterIconSize: "contain",
    });
  }

  public register(context: vscode.ExtensionContext): void {
    const { vscodeApi } = this;
    this.subs.push(
      vscodeApi.window.onDidChangeActiveTextEditor(() => {
        void this.refresh();
      }),
      vscodeApi.workspace.onDidChangeTextDocument((e) => {
        const ed = vscodeApi.window.activeTextEditor;
        if (!ed || e.document !== ed.document) {
          return;
        }
        if (!manuscriptRelativePath(vscodeApi, e.document)) {
          return;
        }
        if (this.debounceTimer) {
          clearTimeout(this.debounceTimer);
        }
        this.debounceTimer = setTimeout(() => {
          this.debounceTimer = undefined;
          void this.refresh();
        }, DEBOUNCE_MS);
      }),
      vscodeApi.commands.registerCommand("leanquill.issuesAtCursor", () => void this.runIssuesAtCursor()),
    );
    context.subscriptions.push(this);
    void this.refresh();
  }

  public dispose(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = undefined;
    }
    for (const s of this.subs) {
      s.dispose();
    }
    this.subs.length = 0;
    this.decMatched.dispose();
    this.decStale.dispose();
  }

  private async runIssuesAtCursor(): Promise<void> {
    const { vscodeApi } = this;
    const editor = vscodeApi.window.activeTextEditor;
    if (!editor) {
      return;
    }
    const docRel = manuscriptRelativePath(vscodeApi, editor.document);
    if (!docRel) {
      await vscodeApi.window.showInformationMessage("Open a manuscript chapter (.md under manuscript/).");
      return;
    }
    const line = editor.selection.active.line;
    const all = await listOpenQuestions(this.rootPath);
    const hits = all.filter(
      (q) =>
        isActiveForSidebarCount(q.status as IssueStatus)
        && issueChapterRef(q) === docRel
        && issueCoversCursorLine(editor.document, q, line),
    );
    if (hits.length === 0) {
      await vscodeApi.window.showInformationMessage("No active issues at this line.");
      return;
    }
    if (hits.length === 1) {
      await this.openIssueFile(hits[0]);
      return;
    }
    const picked = await vscodeApi.window.showQuickPick(
      hits.map((q) => ({
        label: q.title,
        description: q.id,
        issue: q,
      })),
      { placeHolder: "Choose an issue to open" },
    );
    if (picked?.issue) {
      await this.openIssueFile(picked.issue);
    }
  }

  private async openIssueFile(rec: OpenQuestionRecord): Promise<void> {
    const abs = leanQuillIssueFileAbsolutePath(this.rootPath, rec.fileName);
    const doc = await this.vscodeApi.workspace.openTextDocument(this.vscodeApi.Uri.file(abs));
    await this.vscodeApi.window.showTextDocument(doc, { preview: true, preserveFocus: false });
  }

  private hoverForSingle(title: string): vscode.MarkdownString {
    const md = new this.vscodeApi.MarkdownString(undefined, true);
    md.isTrusted = true;
    md.appendText(title);
    md.appendMarkdown("\n\n");
    md.appendMarkdown("[Choose issue…](command:leanquill.issuesAtCursor)");
    return md;
  }

  private hoverForStacked(count: number): vscode.MarkdownString {
    const md = new this.vscodeApi.MarkdownString(undefined, true);
    md.isTrusted = true;
    md.appendMarkdown(`${count} issues — use **LeanQuill: Issues at Cursor** or `);
    md.appendMarkdown("[choose…](command:leanquill.issuesAtCursor)");
    return md;
  }

  private async refresh(): Promise<void> {
    const { vscodeApi } = this;
    const editor = vscodeApi.window.activeTextEditor;
    if (!editor) {
      return;
    }
    const doc = editor.document;
    const docRel = manuscriptRelativePath(vscodeApi, doc);
    if (!docRel) {
      editor.setDecorations(this.decMatched, []);
      editor.setDecorations(this.decStale, []);
      return;
    }

    const text = doc.getText();
    const all = await listOpenQuestions(this.rootPath);
    const candidates = all.filter((q) => {
      if (!isActiveForSidebarCount(q.status as IssueStatus)) {
        return false;
      }
      if (issueChapterRef(q) !== docRel) {
        return false;
      }
      const hint = selectionSpanHint(q);
      return Boolean(hint);
    });

    type Entry = { record: OpenQuestionRecord; res: SpanHintResolution; line: number };
    const entries: Entry[] = [];
    for (const record of candidates) {
      const hint = selectionSpanHint(record)!;
      const res = resolveSpanHintInDocument(text, hint);
      if (res.kind === "stale") {
        entries.push({ record, res, line: 0 });
        continue;
      }
      const r = resolutionToRange(doc, res);
      if (r) {
        entries.push({ record, res, line: r.line });
      }
    }

    const byLine = new Map<number, Entry[]>();
    for (const e of entries) {
      const list = byLine.get(e.line) ?? [];
      list.push(e);
      byLine.set(e.line, list);
    }

    const matchedOpts: vscode.DecorationOptions[] = [];
    const staleOpts: vscode.DecorationOptions[] = [];

    for (const [, group] of byLine) {
      const line = group[0].line;
      const lineLen = doc.lineAt(Math.min(line, doc.lineCount - 1)).text.length;
      const range = new vscodeApi.Range(line, 0, line, Math.max(0, lineLen));

      const anyMatched = group.some((g) => g.res.kind === "matched" || g.res.kind === "ambiguous");
      const useStale = !anyMatched;

      if (group.length === 1) {
        const opt: vscode.DecorationOptions = {
          range,
          hoverMessage: this.hoverForSingle(group[0].record.title),
        };
        if (useStale) {
          staleOpts.push(opt);
        } else {
          matchedOpts.push(opt);
        }
      } else {
        const opt: vscode.DecorationOptions = {
          range,
          hoverMessage: this.hoverForStacked(group.length),
        };
        if (useStale) {
          staleOpts.push(opt);
        } else {
          matchedOpts.push(opt);
        }
      }
    }

    editor.setDecorations(this.decMatched, matchedOpts);
    editor.setDecorations(this.decStale, staleOpts);
  }
}
