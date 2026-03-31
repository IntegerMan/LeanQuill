import { OutlineBeat, OutlineChapter, OutlineIndex, OutlinePart } from "./types";

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

function renderBeatCard(beat: OutlineBeat): string {
  const inactiveClass = beat.active ? "" : " card--inactive";
  const firstLine = truncate(beat.description.split("\n")[0] || "", 80);
  const badge = beat.active
    ? '<span class="badge badge--active">Active</span>'
    : '<span class="badge badge--inactive">Inactive</span>';

  const customFieldsHtml = Object.entries(beat.customFields)
    .map(
      ([key, val]) => `
      <div class="field-row">
        <label class="field-label">${escapeHtml(key)}</label>
        <input type="text" class="field-input" data-beat-id="${escapeHtml(beat.id)}" data-field="custom:${escapeHtml(key)}" value="${escapeHtml(val)}" />
      </div>`,
    )
    .join("");

  return `
    <div class="card${inactiveClass}" data-beat-id="${escapeHtml(beat.id)}">
      <div class="card-header" data-action="toggle-expand" data-beat-id="${escapeHtml(beat.id)}">
        <span class="card-title">${escapeHtml(beat.title || "(untitled beat)")}</span>
        ${badge}
      </div>
      <p class="card-excerpt">${escapeHtml(firstLine)}</p>
      <div class="card-details" data-details-for="${escapeHtml(beat.id)}" style="display:none;">
        <div class="field-row">
          <label class="field-label">Title</label>
          <input type="text" class="field-input" data-beat-id="${escapeHtml(beat.id)}" data-field="title" value="${escapeHtml(beat.title)}" />
        </div>
        <div class="field-row">
          <label class="field-label">What</label>
          <textarea class="field-textarea" data-beat-id="${escapeHtml(beat.id)}" data-field="what" rows="2">${escapeHtml(beat.what)}</textarea>
        </div>
        <div class="field-row">
          <label class="field-label">Who</label>
          <input type="text" class="field-input" data-beat-id="${escapeHtml(beat.id)}" data-field="who" value="${escapeHtml(beat.who)}" />
        </div>
        <div class="field-row">
          <label class="field-label">Where</label>
          <input type="text" class="field-input" data-beat-id="${escapeHtml(beat.id)}" data-field="where" value="${escapeHtml(beat.where)}" />
        </div>
        <div class="field-row">
          <label class="field-label">Why</label>
          <textarea class="field-textarea" data-beat-id="${escapeHtml(beat.id)}" data-field="why" rows="2">${escapeHtml(beat.why)}</textarea>
        </div>
        ${customFieldsHtml}
        <div class="card-actions">
          <button class="btn btn--secondary" data-action="add-field" data-beat-id="${escapeHtml(beat.id)}">Add Field</button>
          <button class="btn btn--secondary" data-action="toggle-active" data-beat-id="${escapeHtml(beat.id)}">${beat.active ? "Deactivate" : "Activate"}</button>
          <button class="btn btn--primary" data-action="open-in-editor" data-beat-id="${escapeHtml(beat.id)}">Open in Editor</button>
        </div>
      </div>
    </div>`;
}

function renderGroupHeader(partName: string, chapterName: string): string {
  return `<div class="group-header"><span class="group-part">${escapeHtml(partName)}</span> › <span class="group-chapter">${escapeHtml(chapterName)}</span></div>`;
}

function renderOutlineTab(index: OutlineIndex): string {
  if (index.parts.length === 0) {
    return '<div class="empty-state"><p>No outline yet. Use the sidebar tree or command palette to create one.</p></div>';
  }

  const filterOptions: string[] = ['<option value="all">Show All</option>'];
  const sections: string[] = [];

  for (const part of index.parts) {
    filterOptions.push(`<option value="part:${escapeHtml(part.id)}">${escapeHtml(part.name)}</option>`);
    for (const chapter of part.chapters) {
      filterOptions.push(
        `<option value="chapter:${escapeHtml(chapter.id)}">&nbsp;&nbsp;${escapeHtml(chapter.name)}</option>`,
      );

      const beatCards = chapter.beats.map((beat) => renderBeatCard(beat)).join("");
      if (chapter.beats.length > 0 || true) {
        sections.push(`
          <section class="card-group" data-part-id="${escapeHtml(part.id)}" data-chapter-id="${escapeHtml(chapter.id)}">
            ${renderGroupHeader(part.name, chapter.name)}
            <div class="card-grid">${beatCards}</div>
          </section>`);
      }
    }
  }

  return `
    <div class="filter-bar">
      <label for="filter-select">Filter:</label>
      <select id="filter-select">${filterOptions.join("")}</select>
    </div>
    ${sections.join("")}`;
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
    .tab-panel { display: none; padding: 16px; }
    .tab-panel--active { display: block; }

    /* Filter bar */
    .filter-bar {
      display: flex; align-items: center; gap: 8px; margin-bottom: 16px;
    }
    .filter-bar select {
      padding: 4px 8px;
      background: var(--vscode-dropdown-background);
      color: var(--vscode-dropdown-foreground);
      border: 1px solid var(--vscode-dropdown-border);
      border-radius: 4px;
    }

    /* Group headers */
    .group-header {
      font-size: 14px; font-weight: 600; padding: 8px 0 4px;
      border-bottom: 1px solid var(--vscode-panel-border, var(--vscode-editorGroup-border));
      margin-bottom: 8px;
    }
    .group-part { opacity: 0.7; }

    /* Card grid */
    .card-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      gap: 12px; margin-bottom: 24px;
    }

    /* Cards */
    .card {
      background: var(--vscode-editorWidget-background);
      border: 1px solid var(--vscode-editorWidget-border, var(--vscode-panel-border));
      border-radius: 6px; padding: 12px; cursor: pointer;
    }
    .card:hover { border-color: var(--vscode-focusBorder); }
    .card--inactive {
      opacity: 0.55;
    }
    .card--inactive .card-title { text-decoration: line-through; }

    .card-header { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
    .card-title { font-weight: 600; font-size: 14px; }
    .card-excerpt { margin: 4px 0 0; font-size: 12px; opacity: 0.75; }

    /* Badge */
    .badge { font-size: 11px; padding: 2px 6px; border-radius: 4px; }
    .badge--active { background: var(--vscode-testing-iconPassed, #28a745); color: #fff; }
    .badge--inactive { background: var(--vscode-editorWidget-border, #555); color: #fff; }

    /* Inline editing fields */
    .card-details { margin-top: 12px; display: flex; flex-direction: column; gap: 8px; }
    .field-row { display: flex; flex-direction: column; gap: 2px; }
    .field-label { font-size: 11px; font-weight: 600; opacity: 0.8; }
    .field-input, .field-textarea {
      padding: 4px 8px; border-radius: 4px;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border, var(--vscode-panel-border));
      font-family: var(--vscode-font-family); font-size: 13px;
    }
    .field-textarea { resize: vertical; }

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

    /* Empty & stub states */
    .empty-state, .stub-tab {
      padding: 32px; text-align: center; opacity: 0.7;
    }

    .card-group { /* filterable group */ }
    .card-group--hidden { display: none; }
  </style>
</head>
<body>
  <div class="tab-bar">${tabBar}</div>
  ${tabPanels}
  <script nonce="${nonce}">
    (function() {
      const vscode = acquireVsCodeApi();
      const state = vscode.getState() || {};
      const debounceTimers = {};

      // Tab switching (D-10: click-only)
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

      // Card expand/collapse
      document.querySelectorAll('[data-action="toggle-expand"]').forEach(el => {
        el.addEventListener('click', () => {
          const beatId = el.getAttribute('data-beat-id');
          const details = document.querySelector('[data-details-for="' + beatId + '"]');
          if (details) {
            details.style.display = details.style.display === 'none' ? 'flex' : 'none';
          }
        });
      });

      // Field edits with debounce (D-28: 300ms)
      function onFieldChange(e) {
        const el = e.target;
        const beatId = el.getAttribute('data-beat-id');
        const field = el.getAttribute('data-field');
        if (!beatId || !field) return;
        const value = el.value;
        const key = beatId + ':' + field;
        if (debounceTimers[key]) clearTimeout(debounceTimers[key]);
        debounceTimers[key] = setTimeout(() => {
          vscode.postMessage({ type: 'beat:updateField', beatId: beatId, field: field, value: value });
        }, 300);
      }
      document.querySelectorAll('.field-input, .field-textarea').forEach(el => {
        el.addEventListener('input', onFieldChange);
      });

      // Toggle active (D-16)
      document.querySelectorAll('[data-action="toggle-active"]').forEach(el => {
        el.addEventListener('click', () => {
          const beatId = el.getAttribute('data-beat-id');
          vscode.postMessage({ type: 'beat:toggleActive', beatId: beatId });
        });
      });

      // Open in Editor (D-17)
      document.querySelectorAll('[data-action="open-in-editor"]').forEach(el => {
        el.addEventListener('click', () => {
          const beatId = el.getAttribute('data-beat-id');
          vscode.postMessage({ type: 'beat:openInEditor', beatId: beatId });
        });
      });

      // Add custom field (D-15)
      document.querySelectorAll('[data-action="add-field"]').forEach(el => {
        el.addEventListener('click', () => {
          const beatId = el.getAttribute('data-beat-id');
          const name = prompt('Enter field name:');
          if (name && name.trim()) {
            vscode.postMessage({ type: 'beat:addCustomField', beatId: beatId, fieldName: name.trim() });
          }
        });
      });

      // Filter (D-33)
      const filterSelect = document.getElementById('filter-select');
      if (filterSelect) {
        filterSelect.addEventListener('change', () => {
          const val = filterSelect.value;
          document.querySelectorAll('.card-group').forEach(group => {
            if (val === 'all') {
              group.classList.remove('card-group--hidden');
              return;
            }
            const [type, id] = val.split(':');
            if (type === 'part') {
              group.classList.toggle('card-group--hidden', group.getAttribute('data-part-id') !== id);
            } else if (type === 'chapter') {
              group.classList.toggle('card-group--hidden', group.getAttribute('data-chapter-id') !== id);
            }
          });
        });
      }

      // Incoming messages from extension host
      window.addEventListener('message', event => {
        const msg = event.data;
        if (msg.type === 'outline:update') {
          // Full re-render is handled by extension setting html
          // This message can be used for incremental updates in future
        }
      });
    })();
  </script>
</body>
</html>`;
}
