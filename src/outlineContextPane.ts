import type * as VSCode from "vscode";
import { escapeHtml } from "./htmlUtils";
import { ChapterStatus, OutlineNode, OutlineIndex } from "./types";

// --- Context models ---

export interface BookContextModel {
  kind: "book";
  totalNodes: number;
  statusSummary: Record<ChapterStatus, number>;
}

export interface NodeContextModel {
  kind: "node";
  id: string;
  title: string;
  fileName: string;
  active: boolean;
  status: ChapterStatus;
  description: string;
  customFields: Record<string, string>;
  traits: string[];
  childCount: number;
  depth: number;
}

export type OutlineContextModel = BookContextModel | NodeContextModel;

// --- Model builders ---

function countNodes(nodes: OutlineNode[]): number {
  let count = 0;
  for (const node of nodes) {
    count++;
    count += countNodes(node.children);
  }
  return count;
}

function collectStatusSummary(nodes: OutlineNode[], summary: Record<ChapterStatus, number>): void {
  for (const node of nodes) {
    if (node.status) {
      summary[node.status] = (summary[node.status] || 0) + 1;
    }
    collectStatusSummary(node.children, summary);
  }
}

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
  collectStatusSummary(index.nodes, statusSummary);
  return {
    kind: "book",
    totalNodes: countNodes(index.nodes),
    statusSummary,
  };
}

export function buildNodeContext(node: OutlineNode, depth: number): NodeContextModel {
  return {
    kind: "node",
    id: node.id,
    title: node.title,
    fileName: node.fileName,
    active: node.active,
    status: node.status,
    description: node.description,
    customFields: node.customFields,
    traits: node.traits,
    childCount: node.children.length,
    depth,
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
      <div class="meta"><span class="label">Total Nodes</span><span class="value">${model.totalNodes}</span></div>
    </section>
    <section class="card">
      <span class="label">Status Summary</span>
      ${statusRows || '<span class="value">No nodes yet</span>'}
    </section>
  </main>`);
}

function renderNodeHtml(model: NodeContextModel): string {
  const activeLabel = model.active ? "" : ' <span class="badge inactive">Inactive</span>';
  const traitsHtml = model.traits.length > 0
    ? model.traits.map((t) => `<span class="badge">${escapeHtml(t)}</span>`).join(" ")
    : "";

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

  const updateStatusUri = `command:leanquill.updateNodeStatus?${encodeURIComponent(JSON.stringify([model.id]))}`;

  return wrapHtml(`
  <main class="stack">
    <section class="card">
      <h1 class="title">${escapeHtml(model.title || "(untitled)")}${activeLabel}</h1>
      <div class="meta"><span class="label">Status</span><span class="badge">${escapeHtml(model.status)}</span></div>
      ${traitsHtml ? `<div class="meta"><span class="label">Traits</span><span>${traitsHtml}</span></div>` : ""}
      ${model.childCount > 0 ? `<div class="meta"><span class="label">Children</span><span class="value">${model.childCount}</span></div>` : ""}
      ${descSection}
      <a class="action" href="${updateStatusUri}">Update Status</a>
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
    case "node": return renderNodeHtml(model);
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
