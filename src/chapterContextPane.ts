import type * as VSCode from "vscode";
import { ChapterStatusEntry } from "./types";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export interface ChapterContextModel {
  chapterPath: string;
  title: string;
  status: string;
  openIssueCount: number;
}

export function renderChapterContextHtml(model?: ChapterContextModel, showRetainedHint = false): string {
  if (!model) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline';" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    body { background: var(--vscode-sideBar-background); color: var(--vscode-editor-foreground); font-family: var(--vscode-font-family); margin: 0; padding: 16px; }
    .card { background: var(--vscode-editorWidget-background); border-radius: 8px; padding: 16px; }
    h1 { font-size: 16px; margin: 0 0 8px 0; }
    p { margin: 0; line-height: 1.5; font-size: 13px; }
  </style>
</head>
<body>
  <section class="card">
    <h1>No chapter selected</h1>
    <p>Open a chapter from the Chapters view to inspect its status and issue context. LeanQuill keeps the last known chapter visible when you switch to non-chapter files.</p>
  </section>
</body>
</html>`;
  }

  const retainedHint = showRetainedHint
    ? '<p class="helper">Showing last active chapter context.</p>'
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline';" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    body { background: var(--vscode-sideBar-background); color: var(--vscode-editor-foreground); font-family: var(--vscode-font-family); margin: 0; padding: 16px; }
    .stack { display: flex; flex-direction: column; gap: 24px; }
    .card { background: var(--vscode-editorWidget-background); border-radius: 8px; padding: 16px; display: flex; flex-direction: column; gap: 8px; }
    .title { font-size: 20px; line-height: 1.2; font-weight: 600; margin: 0; }
    .meta { display: flex; justify-content: space-between; gap: 8px; font-size: 13px; line-height: 1.5; }
    .label { font-size: 12px; line-height: 1.3; font-weight: 600; opacity: 0.9; }
    .action { display: inline-flex; align-self: flex-start; padding: 8px 12px; border-radius: 6px; background: var(--vscode-button-background); color: var(--vscode-button-foreground); text-decoration: none; font-size: 13px; }
    .helper { margin: 0; font-size: 12px; line-height: 1.3; opacity: 0.8; }
    .path { margin: 0; font-size: 12px; line-height: 1.3; opacity: 0.7; }
  </style>
</head>
<body>
  <main class="stack">
    <section class="card">
      <h1 class="title">${escapeHtml(model.title)}</h1>
      <div class="meta"><span class="label">Status</span><span>${escapeHtml(model.status)}</span></div>
      <a class="action" href="command:leanquill.updateChapterStatus">Update Chapter Status</a>
      ${retainedHint}
    </section>
    <section class="card">
      <div class="meta"><span class="label">Open issues</span><span>${model.openIssueCount} issue${model.openIssueCount === 1 ? "" : "s"}</span></div>
      <p class="path">${escapeHtml(model.chapterPath)}</p>
    </section>
  </main>
</body>
</html>`;
}

export class ChapterContextPaneProvider implements VSCode.WebviewViewProvider {
  private view?: VSCode.WebviewView;
  private currentModel?: ChapterContextModel;
  private showRetainedHint = false;

  constructor(private readonly vscodeApi: typeof VSCode) {}

  public getCurrentChapterPath(): string | undefined {
    return this.currentModel?.chapterPath;
  }

  public setActiveChapter(chapterPath: string, entry: ChapterStatusEntry): void {
    this.currentModel = {
      chapterPath,
      title: entry.title,
      status: entry.status,
      openIssueCount: entry.openIssueCount,
    };
    this.showRetainedHint = false;
    this.render();
  }

  public retainLastKnownContext(): void {
    if (!this.currentModel) {
      return;
    }
    this.showRetainedHint = true;
    this.render();
  }

  public refreshAfterStatusUpdate(entry: ChapterStatusEntry): void {
    if (!this.currentModel) {
      return;
    }

    this.currentModel = {
      ...this.currentModel,
      title: entry.title,
      status: entry.status,
      openIssueCount: entry.openIssueCount,
    };
    this.showRetainedHint = false;
    this.render();
  }

  public resolveWebviewView(webviewView: VSCode.WebviewView): void {
    this.view = webviewView;
    this.view.webview.options = {
      enableScripts: false,
      enableCommandUris: true,
    };

    this.view.onDidDispose(() => {
      this.view = undefined;
    });

    this.render();
  }

  private render(): void {
    if (!this.view) {
      return;
    }

    this.view.webview.html = renderChapterContextHtml(this.currentModel, this.showRetainedHint);
  }
}
