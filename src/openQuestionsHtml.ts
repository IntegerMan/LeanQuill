/**
 * Shared Issues webview markup + client script (Planning tab + panel host, D-02).
 *
 * postMessage protocol (always include `host: 'planning' | 'panel'`):
 * - openQuestion:openEditor — `{ type, host, id }`
 * - openQuestion:refresh — `{ type, host }`
 * - openQuestion:new-question — `{ type, host }` (host runs D-14 title → type)
 * - openQuestion:setFilter — `{ type, host, filter }` (`active` | `open` | `deferred` | `dismissed` | `all`)
 * - openQuestion:saveDetail — `{ type, host, id, title, body, status, dismissedReason? }`
 * - openQuestion:dismiss — `{ type, host, id, dismissedReason? }`
 */

import { escapeHtml } from "./htmlUtils";
import type { IssueListFilter } from "./issueFilters";

export interface SerializableOpenQuestionRow {
  id: string;
  title: string;
  preview: string;
  /** Full body for detail editor */
  body: string;
  status: string;
  /** YAML / folder type slug */
  issueType: string;
  issueTypeLabel: string;
  /** Primary list chip (same family as detail) */
  associationChip: string;
  /** Extra chips for detail row (e.g. research basename) */
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
    <p class="oq-empty-body">Create an issue from the command palette or a chapter, selection, or planning row.</p>`
    : `<div class="oq-empty-title">No issues yet</div>
    <p class="oq-empty-body">Create an issue from the command palette or a chapter, selection, or planning row.</p>`;

  const emptyListPane = `<div class="oq-list-empty" role="status">
  <div class="oq-empty-inner">${emptyBody}</div>
</div>`;

  const listRows =
    questions.length === 0
      ? emptyListPane
      : `<div class="oq-list-scroll" role="list">
  ${questions
    .map((q) => {
      const stale = q.stale ? ' data-stale="1"' : "";
      const prev = escapeHtml(q.preview);
      const sel = q.id === questions[0]?.id ? " oq-list-row--selected" : "";
      return `<div class="oq-list-row${sel}" role="listitem" tabindex="0" data-question-id="${escapeHtml(q.id)}"${stale}>
    <div class="oq-list-row-main">
      <div class="oq-list-title">${escapeHtml(q.title || "(untitled)")}</div>
      <div class="oq-list-meta">
        <span class="oq-type-pill">${escapeHtml(q.issueTypeLabel)}</span>
        <span class="oq-list-chip">${escapeHtml(q.associationChip)}</span>
      </div>
      <div class="oq-preview-line">${prev}</div>
    </div>
    <div class="oq-list-status">${escapeHtml(statusLabel(q.status))}</div>
  </div>`;
    })
    .join("")}
</div>`;

  const detailPlaceholder = `<div class="oq-detail-inner oq-detail-placeholder" id="oq-detail-root">
  <p class="oq-detail-hint">Select an issue to view details.</p>
</div>`;

  const masterDetail = `<div class="oq-master-detail">
  <div class="oq-master oq-pane">${listRows}</div>
  <div class="oq-detail oq-pane" id="oq-detail-pane">${detailPlaceholder}</div>
</div>`;

  return `<div class="oq-root" data-host="${host}">
${toolbar}
${masterDetail}
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
    .oq-master-detail {
      display: flex;
      flex: 1;
      min-height: 0;
      flex-direction: row;
      align-items: stretch;
    }
    @media (max-width: 520px) {
      .oq-master-detail { flex-direction: column; }
      .oq-master { flex: 0 0 auto; max-height: 45vh; border-right: none !important; border-bottom: 1px solid var(--vscode-widget-border); }
    }
    .oq-pane { min-width: 0; }
    .oq-master {
      flex: 0 0 40%;
      border-right: 1px solid var(--vscode-widget-border);
      display: flex;
      flex-direction: column;
      min-height: 0;
    }
    .oq-list-scroll { flex: 1; overflow: auto; padding: 8px 0; }
    .oq-list-row {
      display: flex;
      gap: 8px;
      padding: 8px 16px;
      cursor: pointer;
      border-bottom: 1px solid var(--vscode-panel-border, var(--vscode-widget-border));
      align-items: flex-start;
    }
    .oq-list-row:hover { background: var(--vscode-list-hoverBackground); }
    .oq-list-row--selected { background: var(--vscode-editorWidget-background); }
    .oq-list-row:focus { outline: 1px solid var(--vscode-focusBorder); outline-offset: -1px; }
    .oq-list-row[data-stale="1"] .oq-list-chip { color: var(--vscode-list-warningForeground); }
    .oq-list-row-main { flex: 1; min-width: 0; }
    .oq-list-title { font-weight: 600; font-size: 13px; line-height: 1.3; color: var(--vscode-foreground); }
    .oq-list-meta { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; align-items: center; }
    .oq-list-chip { font-size: 11px; color: var(--vscode-descriptionForeground); }
    .oq-list-status { flex-shrink: 0; font-size: 12px; color: var(--vscode-descriptionForeground); padding-top: 2px; }
    .oq-preview-line {
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
      margin-top: 6px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
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
    .oq-list-empty { flex: 1; display: flex; align-items: center; justify-content: center; padding: 32px 16px; min-height: 120px; }
    .oq-empty-inner { text-align: center; max-width: 420px; color: var(--vscode-descriptionForeground); }
    .oq-empty-title { font-size: 15px; font-weight: 600; color: var(--vscode-foreground); margin: 0 0 8px; line-height: 1.25; }
    .oq-empty-body { font-size: var(--vscode-font-size); line-height: 1.5; margin: 0; }
    .oq-detail {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-height: 0;
      background: var(--vscode-editor-background);
    }
    .oq-detail-inner { padding: 16px; display: flex; flex-direction: column; gap: 8px; overflow-y: auto; flex: 1; }
    .oq-detail-placeholder .oq-detail-hint { margin: 0; opacity: 0.7; font-size: 13px; }
    .oq-field-label { font-size: 12px; font-weight: 600; line-height: 1.3; color: var(--vscode-foreground); }
    .oq-field-input, .oq-field-textarea, .oq-field-select {
      padding: 6px 8px; border-radius: 2px;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border, var(--vscode-widget-border));
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size, 13px);
      width: 100%;
      box-sizing: border-box;
    }
    .oq-field-textarea { resize: vertical; min-height: 120px; line-height: 1.5; }
    .oq-chips { display: flex; flex-wrap: wrap; gap: 4px; }
    .oq-chip {
      font-size: 11px;
      padding: 2px 8px;
      border-radius: 2px;
      border: 1px solid var(--vscode-widget-border);
      color: var(--vscode-descriptionForeground);
    }
    .oq-detail-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--vscode-widget-border); }
    .oq-btn-danger { border-color: var(--vscode-inputValidation-errorBorder, #f44); color: var(--vscode-inputValidation-errorForeground, #f44); background: transparent; }
  `;
}

function buildClientScript(
  nonce: string,
  host: "planning" | "panel",
  questions: SerializableOpenQuestionRow[],
  meta: OpenQuestionsRenderMeta,
): string {
  const hostJson = JSON.stringify(host);
  const rowsJson = JSON.stringify(questions);
  const metaJson = JSON.stringify(meta);
  return `
<script nonce="${nonce}">
(function () {
  const vscode = acquireVsCodeApi();
  const host = ${hostJson};
  const ROWS = ${rowsJson};
  const META = ${metaJson};
  const byId = Object.fromEntries(ROWS.map(function (r) { return [r.id, r]; }));

  function post(type, payload) {
    vscode.postMessage(Object.assign({ type: type, host: host }, payload || {}));
  }

  function postFilter(value) {
    post('openQuestion:setFilter', { filter: value });
  }

  function esc(s) {
    if (!s) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function renderDetail(r) {
    var pane = document.getElementById('oq-detail-pane');
    if (!pane) return;
    if (!r) {
      pane.innerHTML = '<div class="oq-detail-inner oq-detail-placeholder" id="oq-detail-root"><p class="oq-detail-hint">Select an issue to view details.</p></div>';
      return;
    }
    var dr = r.dismissedReason || '';
    var disBlock = (r.status === 'dismissed') ?
      ('<div class="oq-field"><label class="oq-field-label" for="oq-dismiss-reason">Dismissal note</label>' +
        '<textarea id="oq-dismiss-reason" class="oq-field-textarea" rows="2" data-oq-field="dismissedReason">' + esc(dr) + '</textarea></div>') : '';
    var chips = (r.associationChips && r.associationChips.length) ? r.associationChips.map(function (c) {
      return '<span class="oq-chip">' + esc(c) + '</span>';
    }).join('') : '<span class="oq-chip">' + esc(r.associationChip) + '</span>';
    pane.innerHTML =
      '<div class="oq-detail-inner" id="oq-detail-root" data-question-id="' + esc(r.id) + '">' +
      '<div class="oq-field"><label class="oq-field-label" for="oq-detail-title">Title</label>' +
      '<input id="oq-detail-title" class="oq-field-input" type="text" data-oq-field="title" value="' + esc(r.title) + '" /></div>' +
      '<div class="oq-field"><span class="oq-field-label">Type</span><div><span class="oq-type-pill">' + esc(r.issueTypeLabel) + '</span></div></div>' +
      '<div class="oq-field"><span class="oq-field-label">Associations</span><div class="oq-chips">' + chips + '</div></div>' +
      '<div class="oq-field"><label class="oq-field-label" for="oq-detail-body">Body</label>' +
      '<textarea id="oq-detail-body" class="oq-field-textarea" data-oq-field="body" rows="8">' + esc(r.body || '') + '</textarea></div>' +
      '<div class="oq-field"><label class="oq-field-label" for="oq-detail-status">Status</label>' +
      '<select id="oq-detail-status" class="oq-field-select" data-oq-field="status">' +
      ['open','deferred','dismissed','resolved'].map(function (st) {
        return '<option value="' + st + '"' + (r.status === st ? ' selected' : '') + '>' + st + '</option>';
      }).join('') +
      '</select></div>' +
      disBlock +
      '<div class="oq-detail-actions">' +
      '<button type="button" class="oq-btn oq-btn--primary" data-action="save-detail">Save</button>' +
      '<button type="button" class="oq-btn oq-btn--ghost" data-action="open-editor">Open in editor</button>' +
      '<button type="button" class="oq-btn oq-btn--danger" data-action="dismiss-issue">Dismiss…</button>' +
      '</div></div>';

    var stEl = document.getElementById('oq-detail-status');
    if (stEl) {
      stEl.addEventListener('change', function () {
        syncDismissField();
      });
    }
    syncDismissField();
  }

  function syncDismissField() {
    var root = document.getElementById('oq-detail-root');
    if (!root || !root.getAttribute('data-question-id')) return;
    var st = document.getElementById('oq-detail-status');
    if (!st) return;
    var isDis = st.value === 'dismissed';
    var existing = document.getElementById('oq-dismiss-reason');
    if (isDis && !existing) {
      var wrap = document.createElement('div');
      wrap.className = 'oq-field';
      wrap.innerHTML = '<label class="oq-field-label" for="oq-dismiss-reason">Dismissal note</label>' +
        '<textarea id="oq-dismiss-reason" class="oq-field-textarea" rows="2" data-oq-field="dismissedReason"></textarea>';
      var actions = root.querySelector('.oq-detail-actions');
      if (actions && actions.parentNode) {
        actions.parentNode.insertBefore(wrap, actions);
      }
    } else if (!isDis && existing) {
      existing.closest('.oq-field').remove();
    }
  }

  function selectedRowId() {
    var row = document.querySelector('.oq-list-row--selected');
    return row ? row.getAttribute('data-question-id') : null;
  }

  function selectRow(id) {
    document.querySelectorAll('.oq-list-row').forEach(function (el) {
      el.classList.toggle('oq-list-row--selected', el.getAttribute('data-question-id') === id);
    });
    renderDetail(id ? byId[id] : null);
  }

  document.querySelector('.oq-root').addEventListener('click', function (e) {
    var t = e.target;
    if (!(t instanceof HTMLElement)) return;
    var btn = t.closest('[data-action]');
    if (btn) {
      var action = btn.getAttribute('data-action');
      if (action === 'new-issue') post('openQuestion:new-question');
      if (action === 'refresh') post('openQuestion:refresh');
      if (action === 'save-detail') {
        var id = selectedRowId();
        if (!id || !byId[id]) return;
        var titleEl = document.getElementById('oq-detail-title');
        var bodyEl = document.getElementById('oq-detail-body');
        var stEl = document.getElementById('oq-detail-status');
        var drEl = document.getElementById('oq-dismiss-reason');
        post('openQuestion:saveDetail', {
          id: id,
          title: titleEl ? titleEl.value : '',
          body: bodyEl ? bodyEl.value : '',
          status: stEl ? stEl.value : 'open',
          dismissedReason: drEl ? drEl.value : ''
        });
      }
      if (action === 'open-editor') {
        var oid = selectedRowId();
        if (oid) post('openQuestion:openEditor', { id: oid });
      }
      if (action === 'dismiss-issue') {
        var did = selectedRowId();
        if (!did || !byId[did]) return;
        var ok = confirm('Dismiss this issue?');
        if (!ok) return;
        var reason = prompt('Optional rationale (saved to the issue file):', '') || '';
        post('openQuestion:dismiss', { id: did, dismissedReason: reason });
      }
      return;
    }
    var row = t.closest('.oq-list-row');
    if (row) {
      var qid = row.getAttribute('data-question-id');
      if (qid) selectRow(qid);
    }
  });

  document.querySelector('.oq-root').addEventListener('change', function (e) {
    var t = e.target;
    if (!(t instanceof HTMLElement)) return;
    if (t.classList.contains('oq-filter-select')) {
      postFilter(t.value);
    }
  });

  document.querySelector('.oq-master')?.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    var t = e.target;
    if (!(t instanceof HTMLElement)) return;
    var row = t.closest('.oq-list-row');
    if (!row) return;
    e.preventDefault();
    var qid = row.getAttribute('data-question-id');
    if (qid) selectRow(qid);
  });

  if (ROWS.length > 0) {
    selectRow(ROWS[0].id);
  }
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
  const script = buildClientScript(nonce, host, questions, meta);
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
