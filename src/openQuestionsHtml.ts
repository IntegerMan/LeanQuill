/**
 * Shared Open Questions webview markup + client script (Planning tab + panel host, D-02).
 *
 * postMessage protocol (always include `host: 'planning' | 'panel'`):
 * - openQuestion:openEditor — `{ type, host, id }` (open `.leanquill/issues/{type}/*.md` in editor)
 * - openQuestion:refresh — `{ type, host }`
 * - openQuestion:new-question — `{ type, host }`
 */

import { escapeHtml } from "./htmlUtils";

export interface SerializableOpenQuestionRow {
  id: string;
  title: string;
  preview: string;
  status: string;
  associationChip: string;
  issueTypeLabel: string;
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

function buildOpenQuestionsMarkup(questions: SerializableOpenQuestionRow[], host: "planning" | "panel"): string {
  const toolbar = `<div class="oq-toolbar">
  <button type="button" class="oq-btn" data-action="new-question">New question</button>
  <button type="button" class="oq-btn oq-btn--ghost" data-action="refresh">Refresh</button>
</div>`;

  const emptyFullState =
    questions.length === 0
      ? `<div class="oq-empty-state-full" role="status">
  <div class="oq-empty-inner">
    <div class="oq-empty-title">No open questions yet</div>
    <p class="oq-empty-body">Create a question from the outline, a manuscript chapter, a selection, or a research, character, or place row. Click a row below to open it in the editor.</p>
  </div>
</div>`
      : "";

  if (questions.length === 0) {
    return `<div class="oq-root" data-host="${host}">
${toolbar}
${emptyFullState}
</div>`;
  }

  const bodyRows = questions
    .map((q) => {
      const stale = q.stale ? ' data-stale="1"' : "";
      const prev = escapeHtml(q.preview);
      return `<tr class="oq-row" tabindex="0" data-question-id="${escapeHtml(q.id)}"${stale}>
  <td class="oq-col-type"><span class="oq-type-pill">${escapeHtml(q.issueTypeLabel)}</span></td>
  <td class="oq-col-desc">
    <div class="oq-title">${escapeHtml(q.title || "(untitled)")}</div>
    <div class="oq-preview-line">${prev}</div>
  </td>
  <td class="oq-col-source">${escapeHtml(q.associationChip)}</td>
  <td class="oq-col-status">${escapeHtml(statusLabel(q.status))}</td>
</tr>`;
    })
    .join("");

  const table = `<div class="oq-table-wrap">
  <table class="oq-table" role="grid">
    <thead>
      <tr>
        <th class="oq-col-type" scope="col">Type</th>
        <th class="oq-col-desc" scope="col">Description</th>
        <th class="oq-col-source" scope="col">Source</th>
        <th class="oq-col-status" scope="col">Status</th>
      </tr>
    </thead>
    <tbody>${bodyRows}</tbody>
  </table>
</div>`;

  return `<div class="oq-root" data-host="${host}">
${toolbar}
${table}
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
    .oq-table-wrap {
      flex: 1;
      min-height: 0;
      overflow: auto;
      margin: 0 12px 12px;
      border: 1px solid var(--vscode-widget-border);
      border-radius: 2px;
      background: var(--vscode-editor-background);
    }
    .oq-table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      font-size: 13px;
      line-height: 1.35;
    }
    .oq-table thead th {
      text-align: left;
      font-weight: 600;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--vscode-descriptionForeground);
      padding: 6px 10px;
      border-bottom: 1px solid var(--vscode-widget-border);
      background: var(--vscode-editorWidget-background, var(--vscode-sideBar-background));
      position: sticky;
      top: 0;
      z-index: 1;
    }
    .oq-table tbody td {
      padding: 6px 10px;
      border-bottom: 1px solid var(--vscode-panel-border, var(--vscode-widget-border));
      vertical-align: top;
      word-break: break-word;
    }
    .oq-table tbody tr.oq-row {
      cursor: pointer;
    }
    .oq-table tbody tr.oq-row:hover {
      background: var(--vscode-list-hoverBackground);
    }
    .oq-table tbody tr.oq-row:focus {
      outline: 1px solid var(--vscode-focusBorder);
      outline-offset: -1px;
    }
    .oq-table tbody tr[data-stale="1"] td.oq-col-source {
      color: var(--vscode-list-warningForeground);
    }
    .oq-col-type { width: 88px; }
    .oq-col-status { width: 88px; }
    .oq-col-source { width: 28%; }
    .oq-type-pill {
      display: inline-block;
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      padding: 2px 6px;
      border-radius: 2px;
      border: 1px solid var(--vscode-widget-border);
      color: var(--vscode-descriptionForeground);
    }
    .oq-title { font-weight: 600; color: var(--vscode-foreground); }
    .oq-preview-line {
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
      margin-top: 2px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .oq-empty-state-full {
      flex: 1;
      min-height: 120px;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 32px 24px 40px;
      box-sizing: border-box;
    }
    .oq-empty-inner {
      text-align: center;
      max-width: 420px;
      color: var(--vscode-descriptionForeground);
    }
    .oq-empty-title { font-size: 15px; font-weight: 600; color: var(--vscode-foreground); margin: 0 0 12px; line-height: 1.3; }
    .oq-empty-body { font-size: var(--vscode-font-size); line-height: 1.55; margin: 0; }
  `;
}

function buildClientScript(nonce: string, host: "planning" | "panel"): string {
  const hostJson = JSON.stringify(host);
  return `
<script nonce="${nonce}">
(function () {
  const vscode = acquireVsCodeApi();
  const host = ${hostJson};
  function post(type, payload) {
    vscode.postMessage(Object.assign({ type: type, host: host }, payload || {}));
  }
  function openRowEditor(tr) {
    const id = tr && tr.getAttribute('data-question-id');
    if (id) post('openQuestion:openEditor', { id: id });
  }
  document.querySelector('.oq-root')?.addEventListener('click', function (e) {
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;
    const btn = t.closest('[data-action]');
    if (!btn) return;
    const action = btn.getAttribute('data-action');
    if (action === 'new-question') post('openQuestion:new-question');
    if (action === 'refresh') post('openQuestion:refresh');
  });
  document.querySelector('.oq-table tbody')?.addEventListener('click', function (e) {
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;
    const tr = t.closest('tr[data-question-id]');
    if (!tr) return;
    openRowEditor(tr);
  });
  document.querySelector('.oq-table tbody')?.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;
    const tr = t.closest('tr[data-question-id]');
    if (!tr) return;
    e.preventDefault();
    openRowEditor(tr);
  });
})();
</script>`;
}

/**
 * @param wrapDocument When true, returns a full HTML document (panel webview). When false, returns fragment for Planning tab.
 */
export function renderOpenQuestionsHtml(
  questions: SerializableOpenQuestionRow[],
  host: "planning" | "panel",
  nonce: string,
  cspSource: string,
  wrapDocument = false,
): string {
  const styles = `<style>${buildOpenQuestionsStyles()}</style>`;
  const markup = buildOpenQuestionsMarkup(questions, host);
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
