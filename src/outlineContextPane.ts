import type * as VSCode from "vscode";
import { ChapterStatus, OutlineBeat, OutlineChapter, OutlineIndex, OutlinePart } from "./types";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

// --- Context models for each outline level ---

export interface BookContextModel {
  kind: "book";
  totalParts: number;
  totalChapters: number;
  totalBeats: number;
  statusSummary: Record<ChapterStatus, number>;
}

export interface PartContextModel {
  kind: "part";
  name: string;
  active: boolean;
  chapterCount: number;
  beatCount: number;
}

export interface ChapterContextModel {
  kind: "chapter";
  name: string;
  fileName: string;
  active: boolean;
  status: ChapterStatus;
  beatCount: number;
}

export interface BeatContextModel {
  kind: "beat";
  title: string;
  fileName: string;
  active: boolean;
  description: string;
  customFields: Record<string, string>;
}

export type OutlineContextModel = BookContextModel | PartContextModel | ChapterContextModel | BeatContextModel;

// --- Model builders ---

export function buildBookContext(index: OutlineIndex): BookContextModel {
  const statusSummary: Record<ChapterStatus, number> = {
    "planning": 0,
    "not-started": 0,
    "drafting": 0,
    "draft-complete": 0,
    "editing": 0,
    "review-pending": 0,
    "final": 0,
  };
  let totalChapters = 0;
  let totalBeats = 0;
  for (const part of index.parts) {
    for (const ch of part.chapters) {
      totalChapters++;
      statusSummary[ch.status] = (statusSummary[ch.status] || 0) + 1;
      totalBeats += ch.beats.length;
    }
  }
  return {
    kind: "book",
    totalParts: index.parts.length,
    totalChapters,
    totalBeats,
    statusSummary,
  };
}

export function buildPartContext(part: OutlinePart): PartContextModel {
  let beatCount = 0;
  for (const ch of part.chapters) {
    beatCount += ch.beats.length;
  }
  return {
    kind: "part",
    name: part.name,
    active: part.active,
    chapterCount: part.chapters.length,
    beatCount,
  };
}

export function buildChapterContext(chapter: OutlineChapter): ChapterContextModel {
  return {
    kind: "chapter",
    name: chapter.name,
    fileName: chapter.fileName,
    active: chapter.active,
    status: chapter.status,
    beatCount: chapter.beats.length,
  };
}

export function buildBeatContext(beat: OutlineBeat): BeatContextModel {
  return {
    kind: "beat",
    title: beat.title,
    fileName: beat.fileName,
    active: beat.active,
    description: beat.description,
    customFields: beat.customFields,
  };
}

// --- HTML renderers ---

const SHARED_STYLES = `
    body { background: var(--vscode-sideBar-background); color: var(--vscode-editor-foreground); font-family: var(--vscode-font-family); margin: 0; padding: 16px; }
    .stack { display: flex; flex-direction: column; gap: 16px; }
    .card { background: var(--vscode-editorWidget-background); border-radius: 8px; padding: 16px; display: flex; flex-direction: column; gap: 8px; }
    .title { font-size: 18px; line-height: 1.2; font-weight: 600; margin: 0; }
    .meta { display: flex; justify-content: space-between; gap: 8px; font-size: 13px; line-height: 1.5; }
    .label { font-size: 12px; line-height: 1.3; font-weight: 600; opacity: 0.9; }
    .value { font-size: 13px; line-height: 1.5; }
    .action { display: inline-flex; align-self: flex-start; padding: 6px 10px; border-radius: 6px; background: var(--vscode-button-background); color: var(--vscode-button-foreground); text-decoration: none; font-size: 13px; cursor: pointer; }
    .path { margin: 0; font-size: 12px; line-height: 1.3; opacity: 0.7; }
    .badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 11px; background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); }
    .inactive { opacity: 0.6; }
    .desc { font-size: 13px; line-height: 1.5; white-space: pre-wrap; }
    .fields-table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .fields-table td { padding: 4px 0; vertical-align: top; }
    .fields-table td:first-child { font-weight: 600; width: 35%; opacity: 0.9; }
`;

const CSP = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline';" />`;

function wrapHtml(bodyContent: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  ${CSP}
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>${SHARED_STYLES}</style>
</head>
<body>
  ${bodyContent}
</body>
</html>`;
}

function renderEmptyHtml(): string {
  return wrapHtml(`
  <section class="card">
    <h1 class="title">No selection</h1>
    <p class="value">Select an item in the Outline to see its details.</p>
  </section>`);
}

function renderBookHtml(model: BookContextModel): string {
  const statusRows = Object.entries(model.statusSummary)
    .filter(([, count]) => count > 0)
    .map(([status, count]) => `<div class="meta"><span class="label">${escapeHtml(status)}</span><span class="badge">${count}</span></div>`)
    .join("\n      ");

  return wrapHtml(`
  <main class="stack">
    <section class="card">
      <h1 class="title">Book Overview</h1>
      <div class="meta"><span class="label">Parts</span><span class="value">${model.totalParts}</span></div>
      <div class="meta"><span class="label">Chapters</span><span class="value">${model.totalChapters}</span></div>
      <div class="meta"><span class="label">Beats</span><span class="value">${model.totalBeats}</span></div>
    </section>
    <section class="card">
      <span class="label">Chapter Status</span>
      ${statusRows || '<span class="value">No chapters yet</span>'}
    </section>
  </main>`);
}

function renderPartHtml(model: PartContextModel): string {
  const activeLabel = model.active ? "" : ' <span class="badge inactive">Inactive</span>';
  return wrapHtml(`
  <main class="stack">
    <section class="card">
      <h1 class="title">${escapeHtml(model.name)}${activeLabel}</h1>
      <div class="meta"><span class="label">Chapters</span><span class="value">${model.chapterCount}</span></div>
      <div class="meta"><span class="label">Beats</span><span class="value">${model.beatCount}</span></div>
    </section>
  </main>`);
}

function renderChapterHtml(model: ChapterContextModel): string {
  const activeLabel = model.active ? "" : ' <span class="badge inactive">Inactive</span>';
  return wrapHtml(`
  <main class="stack">
    <section class="card">
      <h1 class="title">${escapeHtml(model.name)}${activeLabel}</h1>
      <div class="meta"><span class="label">Status</span><span class="badge">${escapeHtml(model.status)}</span></div>
      <div class="meta"><span class="label">Beats</span><span class="value">${model.beatCount}</span></div>
      <a class="action" href="command:leanquill.updateOutlineChapterStatus">Update Status</a>
    </section>
    <section class="card">
      <p class="path">${escapeHtml(model.fileName || "(no file assigned)")}</p>
    </section>
  </main>`);
}

function renderBeatHtml(model: BeatContextModel): string {
  const activeLabel = model.active ? "" : ' <span class="badge inactive">Inactive</span>';
  const descSection = model.description
    ? `<div class="desc">${escapeHtml(model.description)}</div>`
    : "";

  const fieldEntries = Object.entries(model.customFields);
  const fieldsSection = fieldEntries.length > 0
    ? `<section class="card">
      <span class="label">Custom Fields</span>
      <table class="fields-table">
        ${fieldEntries.map(([k, v]) => `<tr><td>${escapeHtml(k)}</td><td>${escapeHtml(v)}</td></tr>`).join("\n        ")}
      </table>
    </section>`
    : "";

  return wrapHtml(`
  <main class="stack">
    <section class="card">
      <h1 class="title">${escapeHtml(model.title || "(untitled)")}${activeLabel}</h1>
      ${descSection}
    </section>
    ${fieldsSection}
    <section class="card">
      <p class="path">${escapeHtml(model.fileName || "(no file assigned)")}</p>
    </section>
  </main>`);
}

export function renderOutlineContextHtml(model?: OutlineContextModel): string {
  if (!model) {
    return renderEmptyHtml();
  }
  switch (model.kind) {
    case "book": return renderBookHtml(model);
    case "part": return renderPartHtml(model);
    case "chapter": return renderChapterHtml(model);
    case "beat": return renderBeatHtml(model);
  }
}

// --- Webview Provider ---

export class OutlineContextPaneProvider implements VSCode.WebviewViewProvider {
  private view?: VSCode.WebviewView;
  private currentModel?: OutlineContextModel;

  constructor(private readonly vscodeApi: typeof VSCode) {}

  public setContext(model: OutlineContextModel): void {
    this.currentModel = model;
    this.render();
  }

  public clearContext(): void {
    this.currentModel = undefined;
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

    this.view.webview.html = renderOutlineContextHtml(this.currentModel);
  }
}
