import { OutlineNode, OutlineIndex } from "./types";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) {
    return text;
  }
  return text.slice(0, maxLen) + "…";
}

function renderNodeCard(node: OutlineNode): string {
  const inactiveClass = node.active ? "" : " card--inactive";
  const firstLine = truncate(node.description.split("\n")[0] || "", 80);
  const badge = node.active
    ? '<span class="badge badge--active">Active</span>'
    : '<span class="badge badge--inactive">Inactive</span>';

  const customFieldsHtml = Object.entries(node.customFields)
    .map(
      ([key, val]) => `
      <div class="field-row">
        <label class="field-label">${escapeHtml(key)}</label>
        <input type="text" class="field-input" data-node-id="${escapeHtml(node.id)}" data-field="custom:${escapeHtml(key)}" value="${escapeHtml(val)}" />
      </div>`,
    )
    .join("");

  return `
    <div class="card${inactiveClass}" data-node-id="${escapeHtml(node.id)}">
      <div class="card-header" data-action="toggle-expand" data-node-id="${escapeHtml(node.id)}">
        <span class="card-title">${escapeHtml(node.title || "(untitled)")}</span>
        ${badge}
      </div>
      <p class="card-excerpt">${escapeHtml(firstLine)}</p>
      <div class="card-details" data-details-for="${escapeHtml(node.id)}" style="display:none;">
        <div class="field-row">
          <label class="field-label">Title</label>
          <input type="text" class="field-input" data-node-id="${escapeHtml(node.id)}" data-field="title" value="${escapeHtml(node.title)}" />
        </div>
        ${customFieldsHtml}
        <div class="card-actions">
          <button class="btn btn--secondary" data-action="add-field" data-node-id="${escapeHtml(node.id)}">Add Field</button>
          <button class="btn btn--secondary" data-action="toggle-active" data-node-id="${escapeHtml(node.id)}">${node.active ? "Deactivate" : "Activate"}</button>
          <button class="btn btn--primary" data-action="open-in-editor" data-node-id="${escapeHtml(node.id)}">Open in Editor</button>
        </div>
      </div>
    </div>`;
}

// --- Scrivener-style outliner rendering ---

const STATUS_LABELS: Record<string, string> = {
  planning: "Planning",
  "not-started": "Not Started",
  drafting: "Drafting",
  "draft-complete": "Draft Complete",
  editing: "Editing",
  "review-pending": "Review Pending",
  final: "Final",
};

function renderOutlinerRow(node: OutlineNode, depth: number): string {
  const hasChildren = node.children.length > 0;
  const inactiveClass = node.active ? "" : " outliner-row--inactive";
  const hasPart = node.traits.includes("part");
  const icon = hasPart ? "symbol-namespace" : hasChildren ? "symbol-class" : "file";
  const statusText = hasPart ? "" : escapeHtml(STATUS_LABELS[node.status] || node.status);
  const synopsis = truncate(node.description.split("\n")[0] || "", 60);
  const toggleIcon = hasChildren ? "chevron-down" : "";
  const activeBadge = node.active
    ? ""
    : '<span class="outliner-badge outliner-badge--inactive">Inactive</span>';

  const childRows = hasChildren
    ? node.children.map((c) => renderOutlinerRow(c, depth + 1)).join("")
    : "";

  return `<div class="outliner-node" data-id="${escapeHtml(node.id)}" data-depth="${depth}">
  <div class="outliner-row${inactiveClass}" data-id="${escapeHtml(node.id)}">
    <span class="outliner-title-cell" style="padding-left: ${depth * 24 + 8}px">
      <span class="outliner-toggle${hasChildren ? " has-children" : ""}" data-id="${escapeHtml(node.id)}">${toggleIcon ? `<span class="codicon codicon-${toggleIcon}"></span>` : ""}</span>
      <span class="outliner-icon codicon codicon-${escapeHtml(icon)}"></span>
      <span class="outliner-title">${escapeHtml(node.title || "(untitled)")}</span>
      ${activeBadge}
    </span>
    <span class="outliner-status">${statusText}</span>
    <span class="outliner-synopsis" data-node-id="${escapeHtml(node.id)}" data-value="${escapeHtml(node.description.split("\n")[0] || "")}">${escapeHtml(synopsis)}</span>
    <span class="outliner-actions">
      <button class="outliner-btn" data-action="open-in-editor" data-node-id="${escapeHtml(node.id)}" title="Open in Editor"><span class="codicon codicon-edit"></span></button>
    </span>
  </div>
  <div class="outliner-children" data-parent="${escapeHtml(node.id)}">${childRows}</div>
</div>`;
}

function renderOutlineTab(index: OutlineIndex): string {
  if (index.nodes.length === 0) {
    return '<div class="empty-state"><p>No outline yet. Use the sidebar tree or command palette to create one.</p></div>';
  }

  const rows = index.nodes.map((n) => renderOutlinerRow(n, 0)).join("");

  return `<div class="outliner">
  <div class="outliner-header">
    <span class="outliner-col-title">Title</span>
    <span class="outliner-col-status">Status</span>
    <span class="outliner-col-synopsis">Synopsis</span>
    <span class="outliner-col-actions"></span>
  </div>
  <div class="outliner-body">${rows}</div>
</div>`;
}

function renderStubTab(name: string): string {
  return `<div class="stub-tab"><p>The <strong>${escapeHtml(name)}</strong> feature is coming in a future update.</p></div>`;
}

const TAB_IDS = ["outline", "characters", "places", "threads"] as const;
const TAB_LABELS: Record<string, string> = {
  outline: "Outline",
  characters: "Characters",
  places: "Places",
  threads: "Threads",
};

export function renderPlanningHtml(
  index: OutlineIndex,
  nonce: string,
  cspSource: string,
  activeTab: string,
): string {
  const tabBar = TAB_IDS.map(
    (id) =>
      `<button class="tab${id === activeTab ? " tab--active" : ""}" data-tab-id="${id}">${TAB_LABELS[id]}</button>`,
  ).join("");

  const tabPanels = TAB_IDS.map((id) => {
    const content =
      id === "outline"
        ? renderOutlineTab(index)
        : renderStubTab(TAB_LABELS[id]);
    return `<div class="tab-panel${id === activeTab ? " tab-panel--active" : ""}" data-panel-id="${id}">${content}</div>`;
  }).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    * { box-sizing: border-box; }
    body {
      background: var(--vscode-editor-background);
      color: var(--vscode-editor-foreground);
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size, 13px);
      margin: 0; padding: 0;
    }

    /* Tab bar */
    .tab-bar {
      display: flex; gap: 0;
      border-bottom: 1px solid var(--vscode-panel-border, var(--vscode-editorGroup-border));
      background: var(--vscode-editorGroupHeader-tabsBackground);
      padding: 0 8px;
    }
    .tab {
      padding: 8px 16px; border: none; background: none; cursor: pointer;
      color: var(--vscode-tab-inactiveForeground, var(--vscode-foreground));
      font-size: 13px; border-bottom: 2px solid transparent;
    }
    .tab:hover { color: var(--vscode-foreground); }
    .tab--active {
      color: var(--vscode-tab-activeForeground, var(--vscode-foreground));
      border-bottom-color: var(--vscode-focusBorder);
    }

    /* Tab panels */
    .tab-panel { display: none; padding: 0; }
    .tab-panel--active { display: block; }

    /* --- Outliner (Scrivener-style) --- */
    .outliner { width: 100%; }
    .outliner-header {
      display: grid;
      grid-template-columns: minmax(0, 3fr) 140px minmax(0, 2fr) 36px;
      align-items: center;
      padding: 6px 8px 6px 0;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      opacity: 0.6;
      border-bottom: 1px solid var(--vscode-panel-border);
      background: var(--vscode-editorGroupHeader-tabsBackground);
      position: sticky;
      top: 0;
      z-index: 1;
    }
    .outliner-col-title { padding-left: 8px; }
    .outliner-col-status { text-align: center; }
    .outliner-col-synopsis { }
    .outliner-col-actions { width: 36px; }

    .outliner-body { overflow-y: auto; }

    .outliner-node {}
    .outliner-node.collapsed > .outliner-children { display: none; }
    .outliner-node.collapsed > .outliner-row .outliner-toggle .codicon { transform: rotate(-90deg); }

    .outliner-row {
      display: grid;
      grid-template-columns: minmax(0, 3fr) 140px minmax(0, 2fr) 36px;
      align-items: center;
      min-height: 30px;
      padding-right: 8px;
      cursor: pointer;
      border-bottom: 1px solid var(--vscode-panel-border, transparent);
    }
    .outliner-row:hover { background: var(--vscode-list-hoverBackground); }
    .outliner-row.selected { background: var(--vscode-list-activeSelectionBackground); color: var(--vscode-list-activeSelectionForeground); }
    .outliner-row--inactive { opacity: 0.5; }

    .outliner-title-cell {
      display: flex;
      align-items: center;
      gap: 4px;
      min-width: 0;
      overflow: hidden;
    }
    .outliner-toggle {
      width: 18px;
      text-align: center;
      flex-shrink: 0;
      cursor: pointer;
    }
    .outliner-toggle .codicon { font-size: 12px; transition: transform 0.12s; }
    .outliner-icon { font-size: 14px; flex-shrink: 0; opacity: 0.7; }
    .outliner-title { flex: 1; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
    .outliner-status {
      text-align: center;
      font-size: 11px;
      opacity: 0.7;
      white-space: nowrap;
      padding: 0 4px;
    }
    .outliner-synopsis {
      font-size: 12px;
      opacity: 0.6;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      min-width: 0;
      cursor: text;
      border-radius: 2px;
      padding: 1px 3px;
    }
    .outliner-synopsis:hover {
      opacity: 1;
      outline: 1px solid var(--vscode-input-border, var(--vscode-panel-border));
    }
    .synopsis-input {
      width: 100%;
      padding: 1px 3px;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-focusBorder);
      border-radius: 2px;
      font-family: var(--vscode-font-family);
      font-size: 12px;
      outline: none;
      box-sizing: border-box;
    }
    .outliner-actions { width: 36px; flex-shrink: 0; text-align: center; }
    .outliner-btn {
      background: none;
      border: none;
      color: var(--vscode-editor-foreground);
      cursor: pointer;
      padding: 2px 4px;
      opacity: 0;
      transition: opacity 0.15s;
    }
    .outliner-row:hover .outliner-btn { opacity: 0.6; }
    .outliner-btn:hover { opacity: 1 !important; }

    .outliner-badge { font-size: 10px; padding: 1px 5px; border-radius: 3px; flex-shrink: 0; }
    .outliner-badge--inactive { background: var(--vscode-editorWidget-border, #555); color: #fff; }

    .outliner-children { }

    /* --- Detail panel (shown when a row is selected) --- */
    .detail-panel {
      display: none;
      border-top: 2px solid var(--vscode-focusBorder);
      padding: 16px;
      background: var(--vscode-editorWidget-background);
    }
    .detail-panel.visible { display: block; }
    .detail-panel .detail-title { font-size: 16px; font-weight: 600; margin: 0 0 12px; }

    /* Inline editing fields */
    .field-row { display: flex; flex-direction: column; gap: 2px; margin-bottom: 8px; }
    .field-label { font-size: 11px; font-weight: 600; opacity: 0.8; }
    .field-input, .field-textarea {
      padding: 4px 8px; border-radius: 4px;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border, var(--vscode-panel-border));
      font-family: var(--vscode-font-family); font-size: 13px;
    }
    .field-textarea { resize: vertical; min-height: 60px; }

    /* Buttons */
    .card-actions { display: flex; gap: 8px; margin-top: 8px; flex-wrap: wrap; }
    .btn {
      padding: 4px 12px; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;
    }
    .btn--primary {
      background: var(--vscode-button-background); color: var(--vscode-button-foreground);
    }
    .btn--primary:hover { background: var(--vscode-button-hoverBackground); }
    .btn--secondary {
      background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground);
    }
    .btn--secondary:hover { background: var(--vscode-button-secondaryHoverBackground); }

    /* Badge */
    .badge { font-size: 11px; padding: 2px 6px; border-radius: 4px; }
    .badge--active { background: var(--vscode-testing-iconPassed, #28a745); color: #fff; }
    .badge--inactive { background: var(--vscode-editorWidget-border, #555); color: #fff; }

    /* Empty & stub states */
    .empty-state, .stub-tab {
      padding: 32px; text-align: center; opacity: 0.7;
    }

    /* Cards (used in detail view) */
    .card {
      background: var(--vscode-editorWidget-background);
      border: 1px solid var(--vscode-editorWidget-border, var(--vscode-panel-border));
      border-radius: 6px; padding: 12px; cursor: pointer;
    }
    .card:hover { border-color: var(--vscode-focusBorder); }
    .card--inactive { opacity: 0.55; }
    .card--inactive .card-title { text-decoration: line-through; }
    .card-header { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
    .card-title { font-weight: 600; font-size: 14px; }
    .card-excerpt { margin: 4px 0 0; font-size: 12px; opacity: 0.75; }
    .card-details { margin-top: 12px; display: flex; flex-direction: column; gap: 8px; }
  </style>
</head>
<body>
  <div class="tab-bar">${tabBar}</div>
  ${tabPanels}
  <script nonce="${nonce}">
    (function() {
      const vscode = acquireVsCodeApi();
      const state = vscode.getState() || { collapsedIds: [], activeTab: null };
      const debounceTimers = {};

      // Restore collapsed state
      (state.collapsedIds || []).forEach(id => {
        const node = document.querySelector('.outliner-node[data-id="' + id + '"]');
        if (node) node.classList.add('collapsed');
      });

      function saveCollapsed() {
        state.collapsedIds = Array.from(document.querySelectorAll('.outliner-node.collapsed'))
          .map(n => n.getAttribute('data-id'));
        vscode.setState(state);
      }

      // Tab switching
      document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
          document.querySelectorAll('.tab').forEach(t => t.classList.remove('tab--active'));
          document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('tab-panel--active'));
          tab.classList.add('tab--active');
          const panelId = tab.getAttribute('data-tab-id');
          const panel = document.querySelector('[data-panel-id="' + panelId + '"]');
          if (panel) panel.classList.add('tab-panel--active');
          vscode.postMessage({ type: 'tab:switch', tabId: panelId });
          state.activeTab = panelId;
          vscode.setState(state);
        });
      });

      // Outliner expand/collapse
      document.querySelectorAll('.outliner-toggle.has-children').forEach(toggle => {
        toggle.addEventListener('click', (e) => {
          e.stopPropagation();
          const id = toggle.getAttribute('data-id');
          const node = toggle.closest('.outliner-node');
          if (node) {
            node.classList.toggle('collapsed');
            saveCollapsed();
          }
        });
      });

      // Row selection / double-click to open
      document.querySelectorAll('.outliner-row').forEach(row => {
        row.addEventListener('click', () => {
          document.querySelectorAll('.outliner-row.selected').forEach(r => r.classList.remove('selected'));
          row.classList.add('selected');
        });
        row.addEventListener('dblclick', () => {
          const nodeId = row.getAttribute('data-id');
          if (nodeId) vscode.postMessage({ type: 'node:openInEditor', nodeId: nodeId });
        });
      });

      // Synopsis inline editing
      document.querySelectorAll('.outliner-synopsis').forEach(cell => {
        cell.addEventListener('click', (e) => {
          e.stopPropagation();
          if (cell.querySelector('input')) return;
          const nodeId = cell.getAttribute('data-node-id');
          const currentValue = cell.getAttribute('data-value') || '';
          const input = document.createElement('input');
          input.type = 'text';
          input.value = currentValue;
          input.className = 'synopsis-input';
          cell.textContent = '';
          cell.appendChild(input);
          input.focus();
          input.select();
          let saved = false;
          function save() {
            if (saved) return;
            saved = true;
            const newValue = input.value;
            cell.setAttribute('data-value', newValue);
            cell.textContent = newValue.length > 60 ? newValue.slice(0, 60) + '\u2026' : newValue;
            vscode.postMessage({ type: 'node:updateField', nodeId, field: 'description', value: newValue });
          }
          input.addEventListener('blur', save);
          input.addEventListener('keydown', (ke) => {
            if (ke.key === 'Enter') { input.blur(); }
            if (ke.key === 'Escape') {
              saved = true;
              cell.textContent = currentValue.length > 60 ? currentValue.slice(0, 60) + '\u2026' : currentValue;
            }
          });
        });
      });

      // Open in Editor button
      document.querySelectorAll('[data-action="open-in-editor"]').forEach(el => {
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          const nodeId = el.getAttribute('data-node-id');
          if (nodeId) vscode.postMessage({ type: 'node:openInEditor', nodeId: nodeId });
        });
      });

      // Field edits with debounce (300ms)
      function onFieldChange(e) {
        const el = e.target;
        const nodeId = el.getAttribute('data-node-id');
        const field = el.getAttribute('data-field');
        if (!nodeId || !field) return;
        const value = el.value;
        const key = nodeId + ':' + field;
        if (debounceTimers[key]) clearTimeout(debounceTimers[key]);
        debounceTimers[key] = setTimeout(() => {
          vscode.postMessage({ type: 'node:updateField', nodeId: nodeId, field: field, value: value });
        }, 300);
      }
      document.querySelectorAll('.field-input, .field-textarea').forEach(el => {
        el.addEventListener('input', onFieldChange);
      });

      // Toggle active
      document.querySelectorAll('[data-action="toggle-active"]').forEach(el => {
        el.addEventListener('click', () => {
          const nodeId = el.getAttribute('data-node-id');
          vscode.postMessage({ type: 'node:toggleActive', nodeId: nodeId });
        });
      });

      // Add custom field
      document.querySelectorAll('[data-action="add-field"]').forEach(el => {
        el.addEventListener('click', () => {
          const nodeId = el.getAttribute('data-node-id');
          const name = prompt('Enter field name:');
          if (name && name.trim()) {
            vscode.postMessage({ type: 'node:addCustomField', nodeId: nodeId, fieldName: name.trim() });
          }
        });
      });

      // Incoming messages from extension host
      window.addEventListener('message', event => {
        const msg = event.data;
        if (msg.type === 'outline:update') {
          // Full re-render handled by extension setting html
        }
      });
    })();
  </script>
</body>
</html>`;
}
