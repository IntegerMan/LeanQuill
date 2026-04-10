/**
 * Shared Open Questions webview markup + client script (Planning tab + panel host, D-02).
 *
 * postMessage protocol (always include `host: 'planning' | 'panel'`):
 * - openQuestion:select — `{ type, host, id }`
 * - openQuestion:fieldChange — `{ type, host, id, field, value }` (debounced client-side)
 * - openQuestion:save — `{ type, host, id }`
 * - openQuestion:delete — `{ type, host, id }`
 * - openQuestion:navigate — `{ type, host, id }` (“Go to target”)
 * - openQuestion:refresh — `{ type, host }`
 * - openQuestion:new-question — `{ type, host }`
 */

import { escapeHtml } from "./htmlUtils";

export interface SerializableOpenQuestionRow {
  id: string;
  title: string;
  body: string;
  preview: string;
  status: string;
  associationChip: string;
  stale?: boolean;
}

function statusLabel(status: string): string {
  if (status === "deferred") {
    return "Deferred";
  }
  if (status === "resolved") {
    return "Resolved";
  }
  return "Open";
}

function buildOpenQuestionsMarkup(
  questions: SerializableOpenQuestionRow[],
  selectedId: string | undefined,
  host: "planning" | "panel",
): string {
  const toolbar = `<div class="oq-toolbar">
  <button type="button" class="oq-btn" data-action="new-question">New question</button>
  <button type="button" class="oq-btn oq-btn--ghost" data-action="refresh">Refresh</button>
</div>`;

  const empty =
    questions.length === 0
      ? `<div class="oq-empty">
  <div class="oq-empty-title">No open questions yet</div>
  <p class="oq-empty-body">Create a question from the chapter tree, a selection in the manuscript, or a character, place, or thread row.</p>
</div>`
      : "";

  const listRows = questions
    .map((q) => {
      const sel = q.id === selectedId ? " oq-list-item--selected" : "";
      const stale = q.stale ? ' data-stale="1"' : "";
      return `<button type="button" class="oq-list-item${sel}" data-question-id="${escapeHtml(q.id)}" tabindex="0"${stale}>
  <span class="oq-list-title">${escapeHtml(q.title || "(untitled)")}</span>
  <span class="oq-list-meta">
    <span class="oq-chip">${escapeHtml(q.associationChip)}</span>
    <span class="oq-status">${escapeHtml(statusLabel(q.status))}</span>
  </span>
  <span class="oq-preview">${escapeHtml(q.preview)}</span>
</button>`;
    })
    .join("");

  const selected = questions.find((q) => q.id === selectedId);
  const staleBlock = selected?.stale
    ? `<div class="oq-stale" data-stale="1">This link may be out of date after edits. Opened the chapter — update the link from the question if needed.</div>`
    : "";

  const detail = selected
    ? `<div class="oq-detail" data-question-id="${escapeHtml(selected.id)}">
  ${staleBlock}
  <div class="oq-field">
    <label class="oq-label">Title</label>
    <input class="oq-input" name="title" value="${escapeHtml(selected.title)}" />
  </div>
  <div class="oq-field">
    <label class="oq-label">Body</label>
    <textarea class="oq-textarea" name="body" rows="8">${escapeHtml(selected.body)}</textarea>
  </div>
  <div class="oq-field">
    <label class="oq-label">Status</label>
    <select class="oq-select" name="status">
      <option value="open"${selected.status === "open" ? " selected" : ""}>open</option>
      <option value="deferred"${selected.status === "deferred" ? " selected" : ""}>deferred</option>
      <option value="resolved"${selected.status === "resolved" ? " selected" : ""}>resolved</option>
    </select>
  </div>
  <div class="oq-field oq-readonly">
    <label class="oq-label">Association</label>
    <div class="oq-assoc">${escapeHtml(selected.associationChip)}</div>
  </div>
  <div class="oq-actions">
    <button type="button" class="oq-btn oq-btn--primary" data-action="save">Save</button>
    <button type="button" class="oq-btn" data-action="navigate">Go to target</button>
    <button type="button" class="oq-btn oq-btn--danger" data-action="delete">Delete</button>
  </div>
</div>`
    : `<div class="oq-detail oq-detail--empty">Select a question to view details.</div>`;

  /* Master–detail: default 40% list / 60% detail on wide; stack below 520px viewport. */
  return `<div class="oq-root" data-host="${host}">
${toolbar}
<div class="oq-split">
  <div class="oq-pane oq-pane--list">
    <div class="oq-list" role="list">${empty}${listRows}</div>
  </div>
  <div class="oq-pane oq-pane--detail">${detail}</div>
</div>
</div>`;
}

function buildOpenQuestionsStyles(): string {
  return `
    .oq-root { display: flex; flex-direction: column; height: 100%; min-height: 0;
      background: var(--vscode-sideBar-background, var(--vscode-editor-background));
      color: var(--vscode-editor-foreground);
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size, 13px);
    }
    .oq-toolbar { display: flex; gap: 8px; padding: 8px 16px; border-bottom: 1px solid var(--vscode-widget-border); flex-shrink: 0; }
    .oq-btn { padding: 6px 12px; border: 1px solid var(--vscode-button-border, var(--vscode-widget-border));
      background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); cursor: pointer; font-size: 13px; border-radius: 2px; }
    .oq-btn--primary { background: var(--vscode-button-background); color: var(--vscode-button-foreground); }
    .oq-btn--ghost { background: transparent; }
    .oq-btn--danger { border-color: var(--vscode-errorForeground); color: var(--vscode-errorForeground); }
    .oq-split { display: flex; flex: 1; min-height: 0; }
    /* 40% list / 60% detail split on wide layouts */
    .oq-pane--list { flex: 0 0 40%; max-width: 40%; min-width: 0; border-right: 1px solid var(--vscode-widget-border); display: flex; flex-direction: column; }
    .oq-pane--detail { flex: 1; min-width: 0; overflow: auto; padding: 16px; }
    .oq-list { overflow: auto; flex: 1; padding: 8px 0; }
    .oq-list-item { display: flex; flex-direction: column; align-items: flex-start; width: 100%; text-align: left;
      padding: 8px 16px; border: none; background: transparent; color: inherit; cursor: pointer;
      border-bottom: 1px solid var(--vscode-widget-border); font: inherit; }
    .oq-list-item:hover { background: var(--vscode-list-hoverBackground); }
    .oq-list-item--selected { background: var(--vscode-editorWidget-background); }
    .oq-list-title { font-size: 13px; font-weight: 600; line-height: 1.3; }
    .oq-list-meta { display: flex; gap: 8px; margin-top: 4px; font-size: 12px; color: var(--vscode-descriptionForeground); }
    .oq-chip { opacity: 0.9; }
    .oq-preview { font-size: 12px; color: var(--vscode-descriptionForeground); margin-top: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
    .oq-empty { padding: 32px 16px; text-align: center; color: var(--vscode-descriptionForeground); }
    .oq-empty-title { font-size: 15px; font-weight: 600; color: var(--vscode-foreground); margin-bottom: 8px; }
    .oq-empty-body { font-size: var(--vscode-font-size); line-height: 1.5; max-width: 520px; margin: 0 auto; }
    .oq-label { display: block; font-size: 12px; font-weight: 600; line-height: 1.3; margin-bottom: 8px; }
    .oq-field { margin-bottom: 16px; }
    .oq-input, .oq-textarea, .oq-select { width: 100%; box-sizing: border-box; padding: 6px 8px;
      background: var(--vscode-input-background); color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border, var(--vscode-widget-border)); font: inherit; }
    .oq-assoc { color: var(--vscode-descriptionForeground); font-size: 13px; }
    .oq-stale { padding: 8px 12px; margin-bottom: 16px; border: 1px solid var(--vscode-widget-border);
      color: var(--vscode-list-warningForeground); font-size: 13px; }
    .oq-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 24px; }
    @media (max-width: 520px) {
      .oq-split { flex-direction: column; }
      .oq-pane--list { flex: 0 0 auto; max-width: none; border-right: none; border-bottom: 1px solid var(--vscode-widget-border); max-height: 40vh; }
    }
  `;
}

function buildClientScript(nonce: string, host: "planning" | "panel"): string {
  const hostJson = JSON.stringify(host);
  return `
<script nonce="${nonce}">
(function () {
  const vscode = acquireVsCodeApi();
  const host = ${hostJson};
  const state = vscode.getState() || {};
  function post(type, payload) {
    vscode.postMessage(Object.assign({ type: type, host: host }, payload || {}));
  }
  document.querySelector('.oq-root')?.addEventListener('click', function (e) {
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;
    const btn = t.closest('[data-action]');
    if (!btn) return;
    const action = btn.getAttribute('data-action');
    if (action === 'new-question') post('openQuestion:new-question');
    if (action === 'refresh') post('openQuestion:refresh');
    if (action === 'save') {
      const root = document.querySelector('.oq-detail[data-question-id]');
      const id = root && root.getAttribute('data-question-id');
      if (id) post('openQuestion:save', { id: id });
    }
    if (action === 'delete') {
      const root = document.querySelector('.oq-detail[data-question-id]');
      const id = root && root.getAttribute('data-question-id');
      if (id) post('openQuestion:delete', { id: id });
    }
    if (action === 'navigate') {
      const root = document.querySelector('.oq-detail[data-question-id]');
      const id = root && root.getAttribute('data-question-id');
      if (id) post('openQuestion:navigate', { id: id });
    }
  });
  document.querySelector('.oq-list')?.addEventListener('click', function (e) {
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;
    const row = t.closest('[data-question-id]');
    if (!row || row.getAttribute('data-action')) return;
    const id = row.getAttribute('data-question-id');
    if (id) post('openQuestion:select', { id: id });
  });
  let debounceTimer = null;
  function scheduleFieldChange(id, field, value) {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(function () {
      post('openQuestion:fieldChange', { id: id, field: field, value: value });
    }, 300);
  }
  document.querySelector('.oq-root')?.addEventListener('input', function (e) {
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;
    const root = t.closest('.oq-detail[data-question-id]');
    if (!root) return;
    const id = root.getAttribute('data-question-id');
    if (!id) return;
    const name = t.getAttribute('name');
    if (name === 'title' || name === 'body' || name === 'status') {
      const value = t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement ? t.value : '';
      scheduleFieldChange(id, name, value);
    }
  });
})();
</script>`;
}

/**
 * @param wrapDocument When true, returns a full HTML document (panel webview). When false, returns fragment for Planning tab.
 */
export function renderOpenQuestionsHtml(
  questions: SerializableOpenQuestionRow[],
  selectedId: string | undefined,
  host: "planning" | "panel",
  nonce: string,
  cspSource: string,
  wrapDocument = false,
): string {
  const styles = `<style>${buildOpenQuestionsStyles()}</style>`;
  const markup = buildOpenQuestionsMarkup(questions, selectedId, host);
  const script = buildClientScript(nonce, host);
  const inner = `${styles}${markup}${script}`;

  if (!wrapDocument) {
    return inner;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;height:100vh;">
  ${inner}
</body>
</html>`;
}
