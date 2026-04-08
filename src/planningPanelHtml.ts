import { escapeHtml } from "./htmlUtils";
import { OutlineNode, OutlineIndex, CharacterProfile } from "./types";

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) {
    return text;
  }
  return text.slice(0, maxLen) + "…";
}

function renderCorkboardCard(node: OutlineNode): string {
  const inactiveClass = node.active ? "" : " card--inactive";
  const synopsis = node.description.split("\n")[0] || "";
  const displaySynopsis = truncate(synopsis, 120);
  const statusText = escapeHtml(STATUS_LABELS[node.status] || node.status);

  return `<div class="cork-card${inactiveClass}" data-node-id="${escapeHtml(node.id)}">
  <div class="cork-card-header">
    <span class="cork-card-title">${escapeHtml(node.title || "(untitled)")}</span>
    ${renderStatusSelect(node.id, node.status, "status-select status-select--card")}
  </div>
  <div class="cork-card-body cork-card-synopsis" data-node-id="${escapeHtml(node.id)}" data-value="${escapeHtml(node.description)}">${escapeHtml(displaySynopsis) || '<span class="cork-card-placeholder">Click to add synopsis…</span>'}</div>
</div>`;
}

function isContainer(node: OutlineNode): boolean {
  return node.children.length > 0 || node.traits.includes("part");
}

function renderChildrenBatched(children: OutlineNode[], depth: number): string {
  const chunks: string[] = [];
  let leafBatch: string[] = [];

  function flushLeaves() {
    if (leafBatch.length > 0) {
      chunks.push(`<div class="card-grid">${leafBatch.join("")}</div>`);
      leafBatch = [];
    }
  }

  for (const child of children) {
    if (isContainer(child)) {
      flushLeaves();
      chunks.push(renderCardNode(child, depth));
    } else {
      leafBatch.push(renderCorkboardCard(child));
    }
  }
  flushLeaves();

  return chunks.join("");
}

function renderCardNode(node: OutlineNode, depth: number): string {
  if (!isContainer(node)) {
    return renderCorkboardCard(node);
  }

  const childContent = renderChildrenBatched(node.children, depth + 1);
  const inactiveClass = node.active ? "" : " card-group--inactive";
  const icon = node.traits.includes("part") ? "symbol-namespace" : "symbol-class";
  const depthClass = depth === 0 ? " card-group--root" : "";

  return `<div class="card-group${inactiveClass}${depthClass}" data-group-id="${escapeHtml(node.id)}" data-depth="${depth}">
  <div class="card-group-header" data-group-id="${escapeHtml(node.id)}">
    <span class="card-group-toggle"><span class="codicon codicon-chevron-down"></span></span>
    <span class="codicon codicon-${escapeHtml(icon)} card-group-icon"></span>
    <span class="card-group-title">${escapeHtml(node.title || "(untitled)")}</span>
  </div>
  <div class="card-group-body" data-group-children="${escapeHtml(node.id)}">${childContent}</div>
</div>`;
}

function renderCardGrid(index: OutlineIndex): string {
  if (index.nodes.length === 0) {
    return '<div class="empty-state"><p>No outline yet. Use the sidebar tree or command palette to create one.</p></div>';
  }

  return `<div class="card-board">${renderChildrenBatched(index.nodes, 0)}</div>`;
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

const STATUS_KEYS = Object.keys(STATUS_LABELS);

function renderStatusSelect(nodeId: string, currentStatus: string, cssClass: string): string {
  const options = STATUS_KEYS.map((key) => {
    const selected = key === currentStatus ? " selected" : "";
    return `<option value="${escapeHtml(key)}"${selected}>${escapeHtml(STATUS_LABELS[key])}</option>`;
  }).join("");
  return `<select class="${cssClass}" data-node-id="${escapeHtml(nodeId)}" data-action="update-status">${options}</select>`;
}

function renderOutlinerRow(node: OutlineNode, depth: number): string {
  const hasChildren = node.children.length > 0;
  const inactiveClass = node.active ? "" : " outliner-row--inactive";
  const hasPart = node.traits.includes("part");
  const icon = hasPart ? "symbol-namespace" : hasChildren ? "symbol-class" : "file";
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
    <span class="outliner-status">${hasPart ? "" : renderStatusSelect(node.id, node.status, "status-select status-select--outline")}</span>
    <span class="outliner-synopsis" data-node-id="${escapeHtml(node.id)}" data-value="${escapeHtml(node.description)}">${escapeHtml(synopsis)}</span>
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

function renderCardsTab(index: OutlineIndex): string {
  if (index.nodes.length === 0) {
    return '<div class="empty-state"><p>No outline yet. Use the sidebar tree or command palette to create one.</p></div>';
  }

  return renderCardGrid(index);
}

function renderStubTab(name: string): string {
  return `<div class="stub-tab"><p>The <strong>${escapeHtml(name)}</strong> feature is coming in a future update.</p></div>`;
}

const TAB_IDS = ["outline", "cards", "characters", "places", "threads"] as const;
const TAB_LABELS: Record<string, string> = {
  outline: "Outline",
  cards: "Cards",
  characters: "Characters",
  places: "Places",
  threads: "Threads",
};


// ---------------------------------------------------------------------------
// Characters tab rendering
// ---------------------------------------------------------------------------

function renderCharacterDetail(profile: CharacterProfile): string {
  const standardFields = `
    <div class="char-field-row">
      <label class="char-field-label">Name</label>
      <input class="char-field-input" data-action="character:updateField"
        data-file="${escapeHtml(profile.fileName)}" data-field="name"
        value="${escapeHtml(profile.name)}" />
    </div>
    <div class="char-field-row">
      <label class="char-field-label">Role</label>
      <input class="char-field-input" list="char-roles-datalist"
        data-action="character:updateField"
        data-file="${escapeHtml(profile.fileName)}" data-field="role"
        value="${escapeHtml(profile.role)}" />
      <datalist id="char-roles-datalist">
        <option value="protagonist"/>
        <option value="antagonist"/>
        <option value="supporting"/>
        <option value="minor"/>
      </datalist>
    </div>
    <div class="char-field-row">
      <label class="char-field-label">Aliases</label>
      <input class="char-field-input" data-action="character:updateField"
        data-file="${escapeHtml(profile.fileName)}" data-field="aliases"
        value="${escapeHtml(profile.aliases.join(", "))}"
        placeholder="Comma-separated aliases" />
    </div>
    <div class="char-field-row">
      <label class="char-field-label">Description</label>
      <textarea class="char-field-textarea" data-action="character:updateField"
        data-file="${escapeHtml(profile.fileName)}" data-field="description">${escapeHtml(profile.description)}</textarea>
    </div>`;

  const customFieldRows = Object.entries(profile.customFields).map(([key, val]) =>
    `<div class="char-field-row char-field-custom">
      <label class="char-field-label char-field-label--custom">${escapeHtml(key)}</label>
      <input class="char-field-input" data-action="character:updateField"
        data-file="${escapeHtml(profile.fileName)}" data-field="custom:${escapeHtml(key)}"
        value="${escapeHtml(val)}" />
    </div>`
  ).join("");

  const refs = profile.referencedByNameIn.length > 0
    ? profile.referencedByNameIn.map((r) => `<li class="char-ref-item">${escapeHtml(r)}</li>`).join("")
    : '<li class="char-ref-empty">No manuscript references detected yet.</li>';

  return `
    <div class="char-detail-inner" data-file="${escapeHtml(profile.fileName)}">
      ${standardFields}
      ${customFieldRows}
      <div class="char-field-row">
        <button class="char-btn-add-field" data-action="character:addCustomField"
          data-file="${escapeHtml(profile.fileName)}">+ Add Field</button>
      </div>
      <div class="char-refs-section">
        <div class="char-refs-label">Appears in manuscript</div>
        <ul class="char-refs-list">${refs}</ul>
      </div>
      <div class="char-detail-actions">
        <button class="char-btn-editor" data-action="character:openInEditor"
          data-file="${escapeHtml(profile.fileName)}">Open in Editor</button>
        <button class="char-btn-delete" data-action="character:delete"
          data-file="${escapeHtml(profile.fileName)}">Delete Character</button>
      </div>
    </div>`;
}

function renderCharactersTab(
  profiles: CharacterProfile[],
  selectedFileName: string | undefined,
): string {
  const effectiveSelected = selectedFileName ?? profiles[0]?.fileName;

  const roleOrder = ["protagonist", "antagonist", "supporting", "minor"];
  const roleGroups = new Map<string, CharacterProfile[]>();
  for (const p of profiles) {
    const role = p.role.trim() || "uncategorized";
    if (!roleGroups.has(role)) { roleGroups.set(role, []); }
    roleGroups.get(role)!.push(p);
  }

  const sortedRoles = [...roleGroups.keys()].sort((a, b) => {
    const ai = roleOrder.indexOf(a);
    const bi = roleOrder.indexOf(b);
    if (ai !== -1 && bi !== -1) { return ai - bi; }
    if (ai !== -1) { return -1; }
    if (bi !== -1) { return 1; }
    if (a === "uncategorized") { return 1; }
    if (b === "uncategorized") { return -1; }
    return a.localeCompare(b);
  });

  let listItems = "";
  for (const role of sortedRoles) {
    const roleProfiles = roleGroups.get(role)!;
    const groupItems = roleProfiles.map((p) =>
      `<div class="char-list-item${p.fileName === effectiveSelected ? " char-list-item--selected" : ""}"
           data-action="character:select"
           data-file="${escapeHtml(p.fileName)}">
        ${escapeHtml(p.name || "(untitled)")}
      </div>`
    ).join("");
    listItems += `<div class="char-role-group">
      <div class="char-role-label">${escapeHtml(role)}</div>
      ${groupItems}
    </div>`;
  }

  const listPane = `<div class="char-list">
    <div class="char-list-header">
      <button class="char-btn-new" data-action="character:create">+ New Character</button>
    </div>
    <div class="char-list-body">
      ${profiles.length === 0
        ? '<div class="char-empty-list">No characters yet. Click + New Character to start.</div>'
        : listItems}
    </div>
  </div>`;

  const selected = profiles.find((p) => p.fileName === effectiveSelected);
  const detailPane = `<div class="char-detail">
    ${selected
      ? renderCharacterDetail(selected)
      : '<div class="char-empty-detail">Select a character to view its profile.</div>'}
  </div>`;

  return `<div class="char-container">${listPane}${detailPane}</div>`;
}

export function renderPlanningHtml(
  index: OutlineIndex,
  characters: CharacterProfile[],
  selectedCharacterFileName: string | undefined,
  nonce: string,
  cspSource: string,
  activeTab: string,
): string {
  const tabBar = TAB_IDS.map(
    (id) =>
      `<button class="tab${id === activeTab ? " tab--active" : ""}" data-tab-id="${id}">${TAB_LABELS[id]}</button>`,
  ).join("");

  const tabPanels = TAB_IDS.map((id) => {
    let content: string;
    if (id === "outline") {
      content = renderOutlineTab(index);
    } else if (id === "cards") {
      content = renderCardsTab(index);
    } else if (id === "characters") {
      content = renderCharactersTab(characters, selectedCharacterFileName);
    } else {
      content = renderStubTab(TAB_LABELS[id]);
    }
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

    /* --- Status select dropdown --- */
    .status-select {
      background: transparent;
      color: var(--vscode-editor-foreground);
      border: 1px solid transparent;
      border-radius: 3px;
      font-family: var(--vscode-font-family);
      cursor: pointer;
      outline: none;
      -webkit-appearance: none;
      appearance: none;
      padding-right: 14px;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='5'%3E%3Cpath d='M0 0l4 5 4-5z' fill='%23888'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 3px center;
    }
    .status-select:hover, .status-select:focus {
      border-color: var(--vscode-focusBorder);
      background-color: var(--vscode-input-background);
    }
    .status-select--outline {
      font-size: 11px;
      padding: 1px 16px 1px 4px;
      opacity: 0.7;
    }
    .status-select--outline:hover, .status-select--outline:focus { opacity: 1; }
    .status-select--card {
      font-size: 10px;
      padding: 0 14px 0 3px;
      flex-shrink: 0;
      opacity: 0.6;
    }
    .status-select--card:hover, .status-select--card:focus { opacity: 1; }

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

    /* --- Corkboard card grid --- */
    .card-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      gap: 12px;
      padding: 12px;
    }
    .cork-card {
      background: var(--vscode-editorWidget-background);
      border: 1px solid var(--vscode-editorWidget-border, var(--vscode-panel-border));
      border-radius: 6px;
      display: flex; flex-direction: column;
      min-height: 140px;
      cursor: pointer;
      transition: border-color 0.12s;
    }
    .cork-card:hover { border-color: var(--vscode-focusBorder); }
    .cork-card--inactive { opacity: 0.55; }
    .cork-card--inactive .cork-card-title { text-decoration: line-through; }
    .cork-card-header {
      display: flex; justify-content: space-between; align-items: center;
      padding: 8px 10px 6px;
      border-bottom: 1px solid var(--vscode-panel-border, transparent);
      gap: 6px;
    }
    .cork-card-title {
      font-weight: 600; font-size: 13px;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      min-width: 0; flex: 1;
    }
    .cork-card-body {
      flex: 1; padding: 8px 10px;
      font-size: 12px; line-height: 1.4;
      color: var(--vscode-editor-foreground);
      opacity: 0.8;
      cursor: text;
      border-radius: 0 0 6px 6px;
    }
    .cork-card-body:hover { opacity: 1; background: var(--vscode-list-hoverBackground); }
    .cork-card-placeholder { opacity: 0.4; font-style: italic; }
    .cork-synopsis-input {
      width: 100%; height: 100%; min-height: 60px;
      padding: 0; margin: 0;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-focusBorder);
      border-radius: 4px;
      font-family: var(--vscode-font-family);
      font-size: 12px; line-height: 1.4;
      outline: none; resize: none;
      box-sizing: border-box;
      padding: 4px 6px;
    }

    /* --- Card groups (container nodes) --- */
    .card-board { padding: 4px 0; }
    .card-group {
      margin: 0 0 0 12px;
      border-left: 2px solid var(--vscode-panel-border, #444);
    }
    .card-group--root {
      margin-left: 0;
      border-left: none;
      border-bottom: 2px solid var(--vscode-panel-border, #444);
      margin-bottom: 8px;
      padding-bottom: 4px;
    }
    .card-group--root:last-child { border-bottom: none; margin-bottom: 0; }
    .card-group--inactive { opacity: 0.55; }
    .card-group.collapsed > .card-group-body { display: none; }
    .card-group.collapsed > .card-group-header .card-group-toggle .codicon { transform: rotate(-90deg); }
    .card-group-header {
      display: flex; align-items: center; gap: 6px;
      padding: 10px 12px;
      font-weight: 600; font-size: 13px;
      cursor: pointer;
      background: var(--vscode-editorGroupHeader-tabsBackground);
    }
    .card-group--root > .card-group-header {
      font-size: 14px;
      padding: 10px 12px;
      border-bottom: 1px solid var(--vscode-panel-border, transparent);
    }
    .card-group-header:hover { background: var(--vscode-list-hoverBackground); }
    .card-group-toggle { width: 18px; text-align: center; flex-shrink: 0; }
    .card-group-toggle .codicon { font-size: 12px; transition: transform 0.12s; }
    .card-group-icon { font-size: 14px; opacity: 0.7; flex-shrink: 0; }
    .card-group-title { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .card-group-body { }

    /* --- Character reference tab --- */
    .char-container {
      display: flex;
      height: 100%;
      min-height: 400px;
    }
    .char-list {
      width: 220px;
      flex-shrink: 0;
      border-right: 1px solid var(--vscode-panel-border);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .char-list-header {
      padding: 8px;
      border-bottom: 1px solid var(--vscode-panel-border);
      flex-shrink: 0;
    }
    .char-btn-new {
      width: 100%;
      padding: 4px 8px;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      border-radius: 3px;
      cursor: pointer;
      font-size: 12px;
      text-align: left;
    }
    .char-btn-new:hover { background: var(--vscode-button-hoverBackground); }
    .char-list-body {
      flex: 1;
      overflow-y: auto;
      padding: 4px 0;
    }
    .char-role-group { margin-bottom: 4px; }
    .char-role-label {
      padding: 4px 10px 2px;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      opacity: 0.5;
    }
    .char-list-item {
      padding: 5px 12px;
      cursor: pointer;
      font-size: 13px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      border-radius: 0;
    }
    .char-list-item:hover { background: var(--vscode-list-hoverBackground); }
    .char-list-item--selected {
      background: var(--vscode-list-activeSelectionBackground);
      color: var(--vscode-list-activeSelectionForeground);
    }
    .char-empty-list {
      padding: 16px 12px;
      font-size: 12px;
      opacity: 0.6;
      font-style: italic;
    }
    .char-detail {
      flex: 1;
      overflow-y: auto;
      padding: 0;
      min-width: 0;
    }
    .char-detail-inner {
      padding: 12px 16px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .char-empty-detail {
      padding: 32px 16px;
      font-size: 13px;
      opacity: 0.6;
      font-style: italic;
      text-align: center;
    }
    .char-field-row {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .char-field-label {
      font-size: 11px;
      font-weight: 600;
      opacity: 0.7;
      text-transform: uppercase;
      letter-spacing: 0.4px;
    }
    .char-field-label--custom { color: var(--vscode-descriptionForeground); }
    .char-field-input, .char-field-textarea {
      padding: 4px 8px;
      border-radius: 3px;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border, var(--vscode-panel-border));
      font-family: var(--vscode-font-family);
      font-size: 13px;
      outline: none;
    }
    .char-field-input:focus, .char-field-textarea:focus {
      border-color: var(--vscode-focusBorder);
    }
    .char-field-textarea {
      resize: vertical;
      min-height: 56px;
    }
    .char-btn-add-field {
      padding: 3px 8px;
      background: none;
      border: 1px dashed var(--vscode-panel-border);
      border-radius: 3px;
      color: var(--vscode-descriptionForeground);
      cursor: pointer;
      font-size: 12px;
      align-self: flex-start;
    }
    .char-btn-add-field:hover {
      border-color: var(--vscode-focusBorder);
      color: var(--vscode-foreground);
    }
    .char-refs-section {
      margin-top: 8px;
      padding-top: 8px;
      border-top: 1px solid var(--vscode-panel-border);
    }
    .char-refs-label {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      opacity: 0.5;
      margin-bottom: 4px;
    }
    .char-refs-list {
      list-style: none;
      margin: 0;
      padding: 0;
    }
    .char-ref-item {
      font-size: 12px;
      padding: 2px 0;
      opacity: 0.8;
      font-family: var(--vscode-editor-font-family, monospace);
    }
    .char-ref-empty {
      font-size: 12px;
      opacity: 0.5;
      font-style: italic;
    }
    .char-detail-actions {
      margin-top: 12px;
      padding-top: 8px;
      border-top: 1px solid var(--vscode-panel-border);
    }
    .char-detail-actions {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
      margin-top: 4px;
    }
    .char-btn-editor {
      padding: 4px 10px;
      background: none;
      border: 1px solid var(--vscode-panel-border);
      border-radius: 3px;
      color: var(--vscode-foreground);
      cursor: pointer;
      font-size: 12px;
    }
    .char-btn-editor:hover {
      background: var(--vscode-list-hoverBackground);
    }
    .char-btn-delete {
      padding: 4px 10px;
      background: none;
      border: 1px solid var(--vscode-inputValidation-errorBorder, #f44);
      border-radius: 3px;
      color: var(--vscode-inputValidation-errorForeground, #f44);
      cursor: pointer;
      font-size: 12px;
    }
    .char-btn-delete:hover {
      background: var(--vscode-inputValidation-errorBackground, rgba(244,68,68,0.1));
    }
  </style>
</head>
<body>
  <div class="tab-bar">${tabBar}</div>
  ${tabPanels}
  <script nonce="${nonce}">
    (function() {
      const vscode = acquireVsCodeApi();
      const state = vscode.getState() || { collapsedIds: [], activeTab: null, viewMode: null, collapsedGroups: [] };
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

      // Status select dropdown
      document.querySelectorAll('[data-action="update-status"]').forEach(el => {
        el.addEventListener('change', (e) => {
          e.stopPropagation();
          const nodeId = el.getAttribute('data-node-id');
          const value = el.value;
          if (nodeId) vscode.postMessage({ type: 'node:updateStatus', nodeId: nodeId, status: value });
        });
        el.addEventListener('click', (e) => { e.stopPropagation(); });
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


      // --- Card group collapse/expand ---
      (state.collapsedGroups || []).forEach(id => {
        const group = document.querySelector('.card-group[data-group-id="' + id + '"]');
        if (group) group.classList.add('collapsed');
      });

      function saveCollapsedGroups() {
        state.collapsedGroups = Array.from(document.querySelectorAll('.card-group.collapsed'))
          .map(g => g.getAttribute('data-group-id'));
        vscode.setState(state);
      }

      document.querySelectorAll('.card-group-header').forEach(header => {
        header.addEventListener('click', () => {
          const group = header.closest('.card-group');
          if (group) {
            group.classList.toggle('collapsed');
            saveCollapsedGroups();
          }
        });
      });

      // --- Card synopsis inline editing ---
      document.querySelectorAll('.cork-card-synopsis').forEach(cell => {
        cell.addEventListener('click', (e) => {
          e.stopPropagation();
          if (cell.querySelector('textarea')) return;
          const nodeId = cell.getAttribute('data-node-id');
          const currentValue = cell.getAttribute('data-value') || '';
          const textarea = document.createElement('textarea');
          textarea.value = currentValue;
          textarea.className = 'cork-synopsis-input';
          cell.textContent = '';
          cell.appendChild(textarea);
          textarea.focus();
          textarea.select();
          let saved = false;
          function save() {
            if (saved) return;
            saved = true;
            const newValue = textarea.value;
            cell.setAttribute('data-value', newValue);
            const display = newValue.length > 120 ? newValue.slice(0, 120) + '\u2026' : newValue;
            cell.textContent = display || '';
            if (!display) cell.innerHTML = '<span class="cork-card-placeholder">Click to add synopsis\u2026</span>';
            vscode.postMessage({ type: 'node:updateField', nodeId, field: 'description', value: newValue });
          }
          textarea.addEventListener('blur', save);
          textarea.addEventListener('keydown', (ke) => {
            if (ke.key === 'Escape') {
              saved = true;
              const display = currentValue.length > 120 ? currentValue.slice(0, 120) + '\u2026' : currentValue;
              cell.textContent = display || '';
              if (!display) cell.innerHTML = '<span class="cork-card-placeholder">Click to add synopsis\u2026</span>';
            }
          });
        });
      });

      // --- Card double-click to open in editor ---
      document.querySelectorAll('.cork-card').forEach(card => {
        card.addEventListener('dblclick', (e) => {
          if (e.target && (e.target.tagName === 'TEXTAREA' || e.target.closest('.cork-card-synopsis'))) return;
          const nodeId = card.getAttribute('data-node-id');
          if (nodeId) vscode.postMessage({ type: 'node:openInEditor', nodeId: nodeId });
        });
      });


      // --- Character event delegation ---
      const charContainer = document.querySelector('.char-container');
      if (charContainer) {
        const charDebounceTimers = {};
        charContainer.addEventListener('click', (e) => {
          const target = e.target;
          if (!target) return;
          const el = target.closest('[data-action]');
          if (!el) return;
          const action = el.getAttribute('data-action');
          const fileName = el.getAttribute('data-file');
          if (action === 'character:select' && fileName) {
            vscode.postMessage({ type: 'character:select', fileName: fileName });
          } else if (action === 'character:create') {
            vscode.postMessage({ type: 'character:create' });
          } else if (action === 'character:addCustomField' && fileName) {
            const fieldName = prompt('Field name:');
            if (fieldName && fieldName.trim()) {
              vscode.postMessage({ type: 'character:addCustomField', fileName: fileName, fieldName: fieldName.trim() });
            }
          } else if (action === 'character:delete' && fileName) {
            vscode.postMessage({ type: 'character:delete', fileName: fileName });
          } else if (action === 'character:openInEditor' && fileName) {
            vscode.postMessage({ type: 'character:openInEditor', fileName: fileName });
          }
        });
        charContainer.addEventListener('input', (e) => {
          const target = e.target;
          if (!target || target.getAttribute('data-action') !== 'character:updateField') return;
          const fileName = target.getAttribute('data-file');
          const field = target.getAttribute('data-field');
          if (!fileName || !field) return;
          const value = target.value;
          const key = fileName + ':' + field;
          if (charDebounceTimers[key]) clearTimeout(charDebounceTimers[key]);
          charDebounceTimers[key] = setTimeout(() => {
            vscode.postMessage({ type: 'character:updateField', fileName: fileName, field: field, value: value });
          }, 300);
        });
      }

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
