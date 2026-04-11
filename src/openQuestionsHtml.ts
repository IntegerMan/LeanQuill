/**
 * Shared Issues webview markup + client script (Planning tab + panel host, D-02).
 *
 * postMessage protocol (always include `host: 'planning' | 'panel'`):
 * - openQuestion:openEditor — `{ type, host, id }` (opens issue markdown under `.leanquill/issues/`)
 * - openQuestion:refresh — `{ type, host }`
 * - openQuestion:new-question — `{ type, host }` (host runs type → title prompt)
 * - openQuestion:setFilter — `{ type, host, filter }` (`active` | `open` | `deferred` | `dismissed` | `all`)
 * - openQuestion:openTarget — `{ type, host, id }` (navigate to association: chapter, character file, planning for book, etc.)
 * - openQuestion:delete — `{ type, host, id }` (host confirms, deletes issue markdown)
 * - openQuestion:editStatus — `{ type, host, id }` (host QuickPick + optional dismiss note, saves)
 *
 * Row click opens the issue markdown. Source column opens the association target; Status opens the same edit flow as “Edit status…”.
 */

import { escapeHtml } from "./htmlUtils";
import type { IssueListFilter } from "./issueFilters";

export interface SerializableOpenQuestionRow {
  id: string;
  title: string;
  preview: string;
  /** Full body — not shown in table; kept for API compatibility with hosts */
  body: string;
  status: string;
  /** YAML / folder type slug */
  issueType: string;
  issueTypeLabel: string;
  /** Column: Book, Chapter, Character, … */
  associationTypeLabel: string;
  /** Source column only (path, filename, or book title) */
  associationChip: string;
  /** Legacy / detail: mirrors associationChip */
  associationChips: string[];
  dismissedReason?: string;
  /** Repo-relative path under `.leanquill/issues/`, e.g. `question/foo.md` */
  relativeIssuePath: string;
  stale?: boolean;
}

export interface OpenQuestionsRenderMeta {
  currentFilter: IssueListFilter;
  /** Total issues in project (unfiltered), for empty-state copy */
  totalIssueCount: number;
}

function statusLabel(status: string): string {
  switch (status) {
    case "deferred":
      return "Deferred";
    case "resolved":
      return "Resolved";
    case "dismissed":
      return "Dismissed";
    default:
      return "Open";
  }
}

function filterOptionLabel(value: IssueListFilter): string {
  switch (value) {
    case "active":
      return "Active issues";
    case "open":
      return "Open";
    case "deferred":
      return "Deferred";
    case "dismissed":
      return "Dismissed";
    case "all":
      return "All issues";
  }
}

function buildOpenQuestionsMarkup(
  questions: SerializableOpenQuestionRow[],
  host: "planning" | "panel",
  meta: OpenQuestionsRenderMeta,
): string {
  const filterOptions: IssueListFilter[] = ["active", "open", "deferred", "dismissed", "all"];
  const filterSelect = `<label class="oq-filter-label"><span class="oq-sr-only">Filter</span>
  <select class="oq-filter-select" data-oq-filter aria-label="Issue list filter">
    ${filterOptions
      .map(
        (v) =>
          `<option value="${escapeHtml(v)}"${v === meta.currentFilter ? " selected" : ""}>${escapeHtml(filterOptionLabel(v))}</option>`,
      )
      .join("")}
  </select>
</label>`;

  const toolbar = `<div class="oq-toolbar">
  <button type="button" class="oq-btn oq-btn--primary" data-action="new-issue">New issue</button>
  ${filterSelect}
  <button type="button" class="oq-btn oq-btn--ghost" data-action="refresh">Refresh</button>
</div>`;

  const filteredEmpty = questions.length === 0 && meta.totalIssueCount > 0;

  const emptyBody = filteredEmpty
    ? `<div class="oq-empty-title">No issues match this filter.</div>
    <p class="oq-empty-body">Try another filter or create an issue from the command palette, a chapter, a selection, or a planning row.</p>`
    : `<div class="oq-empty-title">No issues yet</div>
    <p class="oq-empty-body">Create an issue from the command palette, a chapter, a selection, or a planning row. Click a row in the table to open it in the editor.</p>`;

  const emptyFullState = `<div class="oq-empty-state-full" role="status">
  <div class="oq-empty-inner">${emptyBody}</div>
</div>`;

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
  <td class="oq-col-status">
    <button type="button" class="oq-status-btn" data-action="edit-status" data-question-id="${escapeHtml(q.id)}"
      title="Change issue status">${escapeHtml(statusLabel(q.status))}</button>
  </td>
  <td class="oq-col-desc">
    <div class="oq-title">${escapeHtml(q.title || "(untitled)")}</div>
    <div class="oq-preview-line">${prev}</div>
  </td>
  <td class="oq-col-assoc"><span class="oq-assoc-kind">${escapeHtml(q.associationTypeLabel)}</span></td>
  <td class="oq-col-source">
    <button type="button" class="oq-source-link" data-action="open-target" data-question-id="${escapeHtml(q.id)}"
      title="Open linked manuscript, note, book themes, or planning context">${escapeHtml(q.associationChip)}</button>
  </td>
</tr>`;
    })
    .join("");

  const table = `<div class="oq-table-wrap">
  <table class="oq-table" role="grid">
    <thead>
      <tr>
        <th class="oq-col-type" scope="col">Type</th>
        <th class="oq-col-status" scope="col">Status</th>
        <th class="oq-col-desc" scope="col">Description</th>
        <th class="oq-col-assoc" scope="col">Associated With</th>
        <th class="oq-col-source" scope="col">Source</th>
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
    .oq-toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 8px 16px;
      border-bottom: 1px solid var(--vscode-widget-border); flex-shrink: 0; }
    .oq-filter-label { margin: 0; display: flex; align-items: center; }
    .oq-filter-select {
      padding: 4px 8px; border-radius: 2px;
      background: var(--vscode-dropdown-background);
      color: var(--vscode-dropdown-foreground);
      border: 1px solid var(--vscode-dropdown-border, var(--vscode-widget-border));
      font-family: var(--vscode-font-family);
      font-size: 13px;
      min-width: 140px;
    }
    .oq-sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); border: 0; }
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
    .oq-table tbody tr[data-stale="1"] td.oq-col-source .oq-source-link {
      color: var(--vscode-list-warningForeground);
    }
    .oq-source-link {
      display: inline;
      padding: 0;
      margin: 0;
      font: inherit;
      text-align: left;
      cursor: pointer;
      color: var(--vscode-textLink-foreground);
      text-decoration: underline;
      background: none;
      border: none;
      max-width: 100%;
      word-break: break-word;
    }
    .oq-source-link:hover {
      color: var(--vscode-textLink-activeForeground);
    }
    .oq-status-btn {
      display: inline-block;
      max-width: 100%;
      padding: 2px 8px;
      margin: 0;
      font: inherit;
      font-size: 12px;
      line-height: 1.35;
      text-align: left;
      cursor: pointer;
      color: var(--vscode-foreground);
      background: var(--vscode-button-secondaryBackground);
      border: 1px solid var(--vscode-button-border, var(--vscode-widget-border));
      border-radius: 2px;
    }
    .oq-status-btn:hover {
      background: var(--vscode-list-hoverBackground);
    }
    .oq-status-btn:focus {
      outline: 1px solid var(--vscode-focusBorder);
      outline-offset: 1px;
    }
    .oq-ctx-menu {
      position: fixed;
      z-index: 100000;
      min-width: 200px;
      padding: 4px 0;
      margin: 0;
      list-style: none;
      background: var(--vscode-menu-background);
      color: var(--vscode-menu-foreground);
      border: 1px solid var(--vscode-menu-border, var(--vscode-widget-border));
      border-radius: 3px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.36);
    }
    .oq-ctx-item {
      display: block;
      width: 100%;
      padding: 6px 14px;
      margin: 0;
      border: none;
      background: transparent;
      color: inherit;
      font: inherit;
      text-align: left;
      cursor: pointer;
    }
    .oq-ctx-item:hover, .oq-ctx-item:focus {
      background: var(--vscode-menu-selectionBackground);
      color: var(--vscode-menu-selectionForeground);
      outline: none;
    }
    .oq-ctx-item--danger {
      color: var(--vscode-errorForeground);
    }
    .oq-col-type { width: 88px; }
    .oq-col-assoc { width: 112px; }
    .oq-col-status { width: 104px; }
    .oq-col-source { width: 26%; }
    .oq-assoc-kind {
      font-size: 12px;
      font-weight: 600;
      color: var(--vscode-descriptionForeground);
    }
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
    .oq-empty-title { font-size: 15px; font-weight: 600; color: var(--vscode-foreground); margin: 0 0 8px; line-height: 1.25; }
    .oq-empty-body { font-size: var(--vscode-font-size); line-height: 1.5; margin: 0; }
  `;
}

function buildClientScript(nonce: string, host: "planning" | "panel"): string {
  const hostJson = JSON.stringify(host);
  return `
<script nonce="${nonce}">
(function () {
  const vscode = acquireVsCodeApi();
  const host = ${hostJson};
  let ctxMenuEl = null;

  function post(type, payload) {
    vscode.postMessage(Object.assign({ type: type, host: host }, payload || {}));
  }
  function postFilter(value) {
    post('openQuestion:setFilter', { filter: value });
  }
  function openRowEditor(tr) {
    const id = tr && tr.getAttribute('data-question-id');
    if (id) post('openQuestion:openEditor', { id: id });
  }
  function closeCtxMenu() {
    if (ctxMenuEl) {
      ctxMenuEl.remove();
      ctxMenuEl = null;
    }
  }
  function placeCtxMenu(menu, clientX, clientY) {
    document.body.appendChild(menu);
    const rect = menu.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    var left = clientX;
    var top = clientY;
    if (left + rect.width > vw - 8) left = Math.max(8, vw - rect.width - 8);
    if (top + rect.height > vh - 8) top = Math.max(8, vh - rect.height - 8);
    menu.style.left = left + 'px';
    menu.style.top = top + 'px';
  }
  function openCtxMenu(clientX, clientY, id) {
    closeCtxMenu();
    var menu = document.createElement('div');
    menu.className = 'oq-ctx-menu';
    menu.setAttribute('role', 'menu');
    menu.innerHTML =
      '<button type="button" class="oq-ctx-item" data-ctx="open-issue" role="menuitem">Open issue</button>' +
      '<button type="button" class="oq-ctx-item" data-ctx="open-source" role="menuitem">Open source</button>' +
      '<button type="button" class="oq-ctx-item" data-ctx="edit-status" role="menuitem">Edit status…</button>' +
      '<button type="button" class="oq-ctx-item oq-ctx-item--danger" data-ctx="delete" role="menuitem">Delete…</button>';
    menu.style.position = 'fixed';
    menu.style.left = '0';
    menu.style.top = '0';
    menu.addEventListener('click', function (ev) {
      var t = ev.target;
      if (!(t instanceof HTMLElement)) return;
      var item = t.closest('[data-ctx]');
      if (!item) return;
      ev.stopPropagation();
      var act = item.getAttribute('data-ctx');
      closeCtxMenu();
      if (act === 'open-issue') post('openQuestion:openEditor', { id: id });
      else if (act === 'open-source') post('openQuestion:openTarget', { id: id });
      else if (act === 'edit-status') post('openQuestion:editStatus', { id: id });
      else if (act === 'delete') post('openQuestion:delete', { id: id });
    });
    ctxMenuEl = menu;
    placeCtxMenu(menu, clientX, clientY);
  }

  document.addEventListener('click', function () { closeCtxMenu(); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeCtxMenu();
  });

  var tbody = document.querySelector('.oq-table tbody');
  tbody?.addEventListener('contextmenu', function (e) {
    var t = e.target;
    if (!(t instanceof HTMLElement)) return;
    var tr = t.closest('tr[data-question-id]');
    if (!tr) return;
    e.preventDefault();
    var id = tr.getAttribute('data-question-id');
    if (!id) return;
    openCtxMenu(e.clientX, e.clientY, id);
  });

  document.querySelector('.oq-root')?.addEventListener('click', function (e) {
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;
    if (t.closest('.oq-ctx-menu')) return;
    const btn = t.closest('[data-action]');
    if (btn) {
      const action = btn.getAttribute('data-action');
      if (action === 'new-issue') post('openQuestion:new-question');
      if (action === 'refresh') post('openQuestion:refresh');
      if (action === 'open-target') {
        const qid = btn.getAttribute('data-question-id');
        if (qid) {
          e.stopPropagation();
          post('openQuestion:openTarget', { id: qid });
        }
      }
      if (action === 'edit-status') {
        const qid = btn.getAttribute('data-question-id');
        if (qid) {
          e.stopPropagation();
          post('openQuestion:editStatus', { id: qid });
        }
      }
      return;
    }
    if (t.closest('.oq-source-link')) return;
    if (t.closest('.oq-status-btn')) return;
    const tr = t.closest('tr[data-question-id]');
    if (tr) openRowEditor(tr);
  });
  document.querySelector('.oq-root')?.addEventListener('change', function (e) {
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;
    if (t.classList.contains('oq-filter-select')) {
      postFilter(t.value);
    }
  });
  tbody?.addEventListener('keydown', function (e) {
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
  wrapDocument: boolean,
  meta: OpenQuestionsRenderMeta,
): string {
  const styles = `<style>${buildOpenQuestionsStyles()}</style>`;
  const markup = buildOpenQuestionsMarkup(questions, host, meta);
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
