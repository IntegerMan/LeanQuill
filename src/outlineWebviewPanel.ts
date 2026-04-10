import * as crypto from "node:crypto";
import type * as VSCode from "vscode";
import { escapeHtml } from "./htmlUtils";
import {
  readOutlineIndex,
  writeOutlineIndex,
  findNodeById,
  removeNodeById,
  isAncestorOf,
} from "./outlineStore";
import { SafeFileSystem } from "./safeFileSystem";
import { countOpenQuestionsByChapter, listOpenQuestions } from "./openQuestionStore";
import { OutlineNode, OutlineIndex, ChapterStatus } from "./types";

const STATUS_ICONS: Record<ChapterStatus, string> = {
  planning: "circle-outline",
  "not-started": "dash",
  drafting: "edit",
  "draft-complete": "pass",
  editing: "pencil",
  "review-pending": "clock",
  final: "verified",
};

// --- HTML generation ---

function normalizeOutlinePath(p: string): string {
  return p.split("\\").join("/");
}

function openQuestionCountSuffix(fileName: string, counts: Record<string, number>): string {
  if (!fileName) {
    return "";
  }
  const key = normalizeOutlinePath(fileName);
  const n = counts[key];
  if (n && n > 0) {
    return ` · ${n} issue${n === 1 ? "" : "s"}`;
  }
  return "";
}

function renderNodeTree(nodes: OutlineNode[], depth: number, chapterOpenIssueCounts: Record<string, number>): string {
  return nodes
    .map((node) => {
      const hasChildren = node.children.length > 0;
      const hasPart = node.traits.includes("part");
      const icon = hasPart
        ? "symbol-namespace"
        : STATUS_ICONS[node.status] || "dash";
      const inactiveClass = node.active ? "" : " inactive";
      const statusLabel = hasPart ? "" : ` (${escapeHtml(node.status)})`;
      const issueSuffix = !hasPart && node.fileName ? escapeHtml(openQuestionCountSuffix(node.fileName, chapterOpenIssueCounts)) : "";
      const childrenHtml = hasChildren
        ? `<div class="children" data-parent-id="${escapeHtml(node.id)}">${renderNodeTree(node.children, depth + 1, chapterOpenIssueCounts)}</div>`
        : "";
      const expandClass = hasChildren ? " expanded" : "";

      return `<div class="node-item${expandClass}${inactiveClass}" data-id="${escapeHtml(node.id)}" data-depth="${depth}" draggable="true">
  <div class="node-row" data-id="${escapeHtml(node.id)}">
    ${hasChildren ? '<span class="toggle codicon codicon-chevron-right"></span>' : '<span class="toggle-spacer"></span>'}
    <span class="icon codicon codicon-${escapeHtml(icon)}"></span>
    <span class="label">${escapeHtml(node.title || "(untitled)")}</span>
    <span class="status-text">${statusLabel}${issueSuffix}</span>
  </div>
  <div class="drop-zone sibling-zone" data-target-id="${escapeHtml(node.id)}" data-action="after"></div>
  ${childrenHtml}
</div>`;
    })
    .join("\n");
}

function renderOrphans(orphanFiles: string[], chapterOpenIssueCounts: Record<string, number>): string {
  if (orphanFiles.length === 0) {
    return "";
  }
  const items = orphanFiles
    .map((f) => {
      const suf = escapeHtml(openQuestionCountSuffix(f, chapterOpenIssueCounts));
      return `<div class="orphan-item" data-file="${escapeHtml(f)}"><span class="icon codicon codicon-file"></span><span class="label">${escapeHtml(f.replace(/^manuscript\//, ""))}${suf}</span></div>`;
    })
    .join("\n");
  return `<div class="orphan-group">
  <div class="orphan-header">Not Included (${orphanFiles.length})</div>
  ${items}
</div>`;
}

export function renderOutlineWebviewHtml(
  index: OutlineIndex,
  orphanFiles: string[],
  chapterOpenIssueCounts: Record<string, number>,
  nonce: string,
  codiconCssUri: string,
  cspSource: string,
): string {
  const tree =
    index.nodes.length > 0
      ? `<div class="tree-root" data-parent-id="root">${renderNodeTree(index.nodes, 0, chapterOpenIssueCounts)}</div>`
      : '<div class="empty-state"><p>No outline yet.</p></div>';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'nonce-${nonce}'; font-src ${cspSource}; script-src 'nonce-${nonce}';" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link href="${codiconCssUri}" rel="stylesheet" />
  <style nonce="${nonce}">
    body {
      background: var(--vscode-sideBar-background);
      color: var(--vscode-editor-foreground);
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      margin: 0;
      padding: 0;
      overflow-x: hidden;
      user-select: none;
    }
    .tree-root { padding: 4px 0; }
    .node-item { position: relative; }
    .node-item.collapsed > .children { display: none; }
    .node-item.expanded > .node-row > .toggle { transform: rotate(90deg); }
    .node-row {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 2px 8px 2px calc(var(--depth, 0) * 16px + 8px);
      cursor: pointer;
      border-radius: 3px;
      min-height: 22px;
      position: relative;
    }
    .node-row:hover { background: var(--vscode-list-hoverBackground); }
    .node-row.selected { background: var(--vscode-list-activeSelectionBackground); color: var(--vscode-list-activeSelectionForeground); }
    .node-row.drag-over-nest {
      outline: 2px solid var(--vscode-focusBorder);
      outline-offset: -2px;
      background: var(--vscode-list-hoverBackground);
    }
    .toggle { font-size: 12px; width: 16px; text-align: center; transition: transform 0.12s; flex-shrink: 0; cursor: pointer; }
    .toggle-spacer { width: 16px; flex-shrink: 0; }
    .icon { font-size: 14px; flex-shrink: 0; }
    .label { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .status-text { font-size: 11px; opacity: 0.7; flex-shrink: 0; }
    .inactive { opacity: 0.5; }
    .children { padding-left: 0; }

    /* Drop indicator line (between siblings) */
    .drop-zone {
      height: 0;
      position: relative;
      transition: height 0.1s;
    }
    .drop-zone.active {
      height: 4px;
    }
    .drop-zone.active::after {
      content: '';
      position: absolute;
      left: calc(var(--depth, 0) * 16px + 24px);
      right: 8px;
      top: 1px;
      height: 2px;
      background: var(--vscode-focusBorder);
      border-radius: 1px;
    }
    .drop-zone.active::before {
      content: '';
      position: absolute;
      left: calc(var(--depth, 0) * 16px + 20px);
      top: -2px;
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--vscode-focusBorder);
    }

    .empty-state { padding: 16px; text-align: center; opacity: 0.7; }
    .orphan-group { border-top: 1px solid var(--vscode-panel-border); margin-top: 8px; padding-top: 4px; }
    .orphan-header { padding: 4px 8px; font-size: 11px; font-weight: 600; opacity: 0.7; text-transform: uppercase; }
    .orphan-item {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 2px 8px 2px 24px;
      cursor: pointer;
      opacity: 0.6;
    }
    .orphan-item:hover { background: var(--vscode-list-hoverBackground); opacity: 0.8; }

    /* Context menu */
    .context-menu {
      position: fixed;
      z-index: 1000;
      background: var(--vscode-menu-background);
      color: var(--vscode-menu-foreground);
      border: 1px solid var(--vscode-menu-border);
      border-radius: 4px;
      padding: 4px 0;
      min-width: 160px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      display: none;
    }
    .context-menu.visible { display: block; }
    .context-menu-item {
      padding: 4px 16px;
      cursor: pointer;
      font-size: 13px;
    }
    .context-menu-item:hover { background: var(--vscode-menu-selectionBackground); color: var(--vscode-menu-selectionForeground); }
    .context-menu-separator { height: 1px; background: var(--vscode-menu-separatorBackground); margin: 4px 0; }
  </style>
</head>
<body>
  ${tree}
  ${renderOrphans(orphanFiles, chapterOpenIssueCounts)}

  <div class="context-menu" id="contextMenu">
    <div class="context-menu-item" data-action="addChild">Add Child</div>
    <div class="context-menu-item" data-action="addSibling">Add Sibling</div>
    <div class="context-menu-separator"></div>
    <div class="context-menu-item" data-action="openInEditor">Open in Editor</div>
    <div class="context-menu-item" data-action="openFile">Open File</div>
    <div class="context-menu-item" data-action="newOpenQuestion">New open question</div>
    <div class="context-menu-item" data-action="updateStatus">Update Status</div>
    <div class="context-menu-separator"></div>
    <div class="context-menu-item" data-action="rename">Rename</div>
    <div class="context-menu-item" data-action="toggleActive">Toggle Active</div>
    <div class="context-menu-separator"></div>
    <div class="context-menu-item" data-action="moveUp">Move Up</div>
    <div class="context-menu-item" data-action="moveDown">Move Down</div>
    <div class="context-menu-separator"></div>
    <div class="context-menu-item" data-action="remove">Remove</div>
  </div>

  <script nonce="${nonce}">
  (function() {
    const vscode = acquireVsCodeApi();
    let selectedId = null;
    let dragSourceId = null;

    // --- Collapse state persistence ---
    const savedState = vscode.getState() || { collapsed: [] };

    function applyCollapsedState() {
      const collapsed = savedState.collapsed || [];
      collapsed.forEach(id => {
        const item = document.querySelector('.node-item[data-id="' + id + '"]');
        if (item && item.classList.contains('expanded')) {
          item.classList.remove('expanded');
          item.classList.add('collapsed');
        }
      });
    }

    function saveCollapsedState() {
      const collapsed = [];
      document.querySelectorAll('.node-item.collapsed').forEach(el => {
        collapsed.push(el.dataset.id);
      });
      savedState.collapsed = collapsed;
      vscode.setState(savedState);
    }

    applyCollapsedState();

    // --- Selection ---
    function selectNode(id) {
      document.querySelectorAll('.node-row.selected').forEach(el => el.classList.remove('selected'));
      const row = document.querySelector('.node-row[data-id="' + id + '"]');
      if (row) {
        row.classList.add('selected');
        selectedId = id;
        vscode.postMessage({ type: 'select', id });
      }
    }

    // --- Toggle expand/collapse ---
    document.addEventListener('click', (e) => {
      hideContextMenu();
      const toggle = e.target.closest('.toggle');
      if (toggle) {
        const item = toggle.closest('.node-item');
        if (item) {
          item.classList.toggle('collapsed');
          item.classList.toggle('expanded');
          saveCollapsedState();
          e.stopPropagation();
          return;
        }
      }
      const row = e.target.closest('.node-row');
      if (row) {
        selectNode(row.dataset.id);
        return;
      }
      const orphan = e.target.closest('.orphan-item');
      if (orphan) {
        vscode.postMessage({ type: 'openFile', fileName: orphan.dataset.file });
        return;
      }
    });

    // --- Double-click to open ---
    document.addEventListener('dblclick', (e) => {
      const row = e.target.closest('.node-row');
      if (row) {
        vscode.postMessage({ type: 'openNode', id: row.dataset.id });
      }
    });

    // --- Context Menu ---
    const cmenu = document.getElementById('contextMenu');
    let contextNodeId = null;

    function hideContextMenu() {
      cmenu.classList.remove('visible');
      contextNodeId = null;
    }

    document.addEventListener('contextmenu', (e) => {
      const row = e.target.closest('.node-row');
      if (!row) {
        hideContextMenu();
        return;
      }
      e.preventDefault();
      contextNodeId = row.dataset.id;
      selectNode(contextNodeId);
      cmenu.style.left = e.clientX + 'px';
      cmenu.style.top = e.clientY + 'px';
      cmenu.classList.add('visible');
      // Keep menu in viewport
      const rect = cmenu.getBoundingClientRect();
      if (rect.right > window.innerWidth) cmenu.style.left = (window.innerWidth - rect.width - 4) + 'px';
      if (rect.bottom > window.innerHeight) cmenu.style.top = (window.innerHeight - rect.height - 4) + 'px';
    });

    cmenu.addEventListener('click', (e) => {
      const item = e.target.closest('.context-menu-item');
      if (!item || !contextNodeId) return;
      vscode.postMessage({ type: 'contextAction', action: item.dataset.action, id: contextNodeId });
      hideContextMenu();
    });

    // --- Drag and Drop ---
    // Set depth CSS variables for indent-aware drop indicators
    document.querySelectorAll('.node-item').forEach(item => {
      const depth = parseInt(item.dataset.depth || '0', 10);
      item.querySelector('.node-row').style.setProperty('--depth', depth);
      const dropZone = item.querySelector(':scope > .drop-zone');
      if (dropZone) dropZone.style.setProperty('--depth', depth);
    });

    let currentDropTarget = null; // { element, action: 'nest' | 'after' }

    function clearAllDropIndicators() {
      document.querySelectorAll('.drag-over-nest').forEach(el => el.classList.remove('drag-over-nest'));
      document.querySelectorAll('.drop-zone.active').forEach(el => el.classList.remove('active'));
      currentDropTarget = null;
    }

    document.addEventListener('dragstart', (e) => {
      const row = e.target.closest('.node-item[draggable]');
      if (!row) return;
      dragSourceId = row.dataset.id;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', dragSourceId);
      row.style.opacity = '0.4';
      selectNode(dragSourceId);
    });

    document.addEventListener('dragend', (e) => {
      const row = e.target.closest('.node-item[draggable]');
      if (row) row.style.opacity = '';
      clearAllDropIndicators();
      dragSourceId = null;
    });

    document.addEventListener('dragover', (e) => {
      if (!dragSourceId) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';

      clearAllDropIndicators();

      // Check if over a drop zone (sibling insert)
      const dropZone = e.target.closest('.drop-zone');
      if (dropZone) {
        const targetId = dropZone.dataset.targetId;
        if (targetId !== dragSourceId) {
          dropZone.classList.add('active');
          currentDropTarget = { element: dropZone, action: 'after', targetId };
        }
        return;
      }

      // Check if over a node row (nest as child)
      const row = e.target.closest('.node-row');
      if (row) {
        const targetId = row.dataset.id;
        if (targetId !== dragSourceId) {
          // Determine zone: top 25% = before, middle 50% = nest, bottom 25% = after
          const rect = row.getBoundingClientRect();
          const y = e.clientY - rect.top;
          const h = rect.height;

          if (y < h * 0.25) {
            // Before — find the drop zone above this node
            const nodeItem = row.closest('.node-item');
            const prevSibling = nodeItem?.previousElementSibling;
            const prevDropZone = prevSibling?.querySelector(':scope > .drop-zone')
              || nodeItem?.parentElement?.querySelector(':scope > .drop-zone[data-action="after"][data-target-id="' + targetId + '"]');
            // Use "before" action for this target
            if (nodeItem) {
              // Create a virtual before indicator by activating a special state
              row.classList.add('drag-over-nest'); // Fallback: show nest indicator for top zone
              // Actually, let's use the sibling zone of the *previous* node
              if (prevSibling && prevSibling.classList.contains('node-item')) {
                row.classList.remove('drag-over-nest');
                const pz = prevSibling.querySelector(':scope > .drop-zone');
                if (pz) {
                  pz.classList.add('active');
                  currentDropTarget = { element: pz, action: 'after', targetId: pz.dataset.targetId };
                  return;
                }
              }
              // First child — use "before" semantic
              currentDropTarget = { element: row, action: 'before', targetId };
            }
          } else if (y > h * 0.75) {
            // After — use this node's drop zone
            const nodeItem = row.closest('.node-item');
            const dz = nodeItem?.querySelector(':scope > .drop-zone');
            if (dz) {
              row.classList.remove('drag-over-nest');
              dz.classList.add('active');
              currentDropTarget = { element: dz, action: 'after', targetId: dz.dataset.targetId };
              return;
            }
            currentDropTarget = { element: row, action: 'after', targetId };
          } else {
            // Middle — nest as child
            row.classList.add('drag-over-nest');
            currentDropTarget = { element: row, action: 'nest', targetId };
          }
        }
      }
    });

    document.addEventListener('dragleave', (e) => {
      // Only clear if leaving the tree entirely
      const related = e.relatedTarget;
      if (!related || !document.body.contains(related)) {
        clearAllDropIndicators();
      }
    });

    document.addEventListener('drop', (e) => {
      e.preventDefault();
      if (!dragSourceId || !currentDropTarget) {
        clearAllDropIndicators();
        return;
      }

      const { action, targetId } = currentDropTarget;

      // Ensure target expands to show the dropped item
      if (action === 'nest') {
        savedState.collapsed = (savedState.collapsed || []).filter(id => id !== targetId);
        vscode.setState(savedState);
      }

      vscode.postMessage({
        type: 'drop',
        sourceId: dragSourceId,
        targetId,
        action, // 'nest', 'before', or 'after'
      });

      clearAllDropIndicators();
      dragSourceId = null;
    });

    // --- Keyboard support ---
    document.addEventListener('keydown', (e) => {
      if (!selectedId) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        vscode.postMessage({ type: 'contextAction', action: 'remove', id: selectedId });
      }
      if (e.key === 'F2') {
        vscode.postMessage({ type: 'contextAction', action: 'rename', id: selectedId });
      }
      if (e.key === 'Enter') {
        vscode.postMessage({ type: 'openNode', id: selectedId });
      }
    });
  })();
  </script>
</body>
</html>`;
}

// --- Webview View Provider ---

export class OutlineWebviewProvider implements VSCode.WebviewViewProvider {
  private view?: VSCode.WebviewView;
  private _onDidSelect: VSCode.EventEmitter<string>;
  readonly onDidSelect: VSCode.Event<string>;

  constructor(
    private readonly vscodeApi: typeof VSCode,
    private readonly extensionUri: VSCode.Uri,
    private readonly rootPath: string,
    private readonly safeFs: SafeFileSystem,
    private readonly onMutate: () => void,
  ) {
    this._onDidSelect = new this.vscodeApi.EventEmitter<string>();
    this.onDidSelect = this._onDidSelect.event;
  }

  public resolveWebviewView(webviewView: VSCode.WebviewView): void {
    this.view = webviewView;
    this.view.webview.options = {
      enableScripts: true,
      enableCommandUris: true,
      localResourceRoots: [this.extensionUri],
    };

    this.view.onDidDispose(() => {
      this.view = undefined;
    });

    this.view.webview.onDidReceiveMessage((msg) => this.handleMessage(msg));

    this.refresh();
  }

  public async refresh(): Promise<void> {
    if (!this.view) {
      return;
    }

    const index = await readOutlineIndex(this.rootPath);
    const orphanFiles = await this.discoverOrphans(index);
    const oqList = await listOpenQuestions(this.rootPath);
    const chapterOpenIssueCounts = countOpenQuestionsByChapter(oqList);
    const nonce = crypto.randomUUID().replace(/-/g, "");

    const cspSource = this.view.webview.cspSource;

    // Resolve codicon CSS from installed @vscode/codicons package
    const codiconCssUri = this.view.webview
      .asWebviewUri(
        this.vscodeApi.Uri.joinPath(
          this.extensionUri,
          "node_modules",
          "@vscode",
          "codicons",
          "dist",
          "codicon.css",
        ),
      )
      .toString();

    this.view.webview.html = renderOutlineWebviewHtml(
      index,
      orphanFiles,
      chapterOpenIssueCounts,
      nonce,
      codiconCssUri,
      cspSource,
    );
  }

  private async handleMessage(msg: {
    type: string;
    [key: string]: unknown;
  }): Promise<void> {
    switch (msg.type) {
      case "select":
        this._onDidSelect.fire(msg.id as string);
        break;

      case "openNode":
        await this.vscodeApi.commands.executeCommand(
          "leanquill.openNodeInEditor",
          msg.id as string,
        );
        break;

      case "openFile":
        await this.vscodeApi.commands.executeCommand(
          "vscode.open",
          this.vscodeApi.Uri.file(
            `${this.rootPath}/${msg.fileName as string}`,
          ),
        );
        break;

      case "drop":
        await this.handleDrop(
          msg.sourceId as string,
          msg.targetId as string,
          msg.action as "nest" | "before" | "after",
        );
        break;

      case "contextAction":
        await this.handleContextAction(
          msg.action as string,
          msg.id as string,
        );
        break;
    }
  }

  private async handleDrop(
    sourceId: string,
    targetId: string,
    action: "nest" | "before" | "after",
  ): Promise<void> {
    if (sourceId === targetId) {
      return;
    }

    const index = await readOutlineIndex(this.rootPath);

    // Cycle detection
    if (isAncestorOf(index.nodes, sourceId, targetId)) {
      return;
    }

    // Remove source
    const [, removed] = removeNodeById(index.nodes, sourceId);
    if (!removed) {
      return;
    }

    if (action === "nest") {
      // Add as child of target
      const target = findNodeById(index.nodes, targetId);
      if (target) {
        target.node.children.push(removed);
      } else {
        index.nodes.push(removed);
      }
    } else {
      // before or after — insert as sibling relative to target
      const target = findNodeById(index.nodes, targetId);
      if (target) {
        const insertIndex =
          action === "before" ? target.index : target.index + 1;
        target.siblings.splice(insertIndex, 0, removed);
      } else {
        index.nodes.push(removed);
      }
    }

    await writeOutlineIndex(this.rootPath, index, this.safeFs);
    this.onMutate();
    await this.refresh();
  }

  private async handleContextAction(
    action: string,
    nodeId: string,
  ): Promise<void> {
    // Delegate to existing extension commands
    switch (action) {
      case "addChild":
        await this.vscodeApi.commands.executeCommand(
          "leanquill.addChildNode",
          nodeId,
        );
        break;
      case "addSibling":
        await this.vscodeApi.commands.executeCommand(
          "leanquill.addSiblingNode",
          nodeId,
        );
        break;
      case "openInEditor":
        await this.vscodeApi.commands.executeCommand(
          "leanquill.openNodeInEditor",
          nodeId,
        );
        break;
      case "openFile":
        await this.vscodeApi.commands.executeCommand(
          "leanquill.openChapterFromOutline",
          nodeId,
        );
        break;
      case "newOpenQuestion": {
        const index = await readOutlineIndex(this.rootPath);
        const node = findNodeById(index.nodes, nodeId);
        const chapterPath = node?.fileName ? normalizeOutlinePath(node.fileName) : "";
        if (chapterPath.startsWith("manuscript/")) {
          await this.vscodeApi.commands.executeCommand("leanquill.newOpenQuestionFromChapter", {
            chapterPath,
          });
        }
        break;
      }
      case "updateStatus":
        await this.vscodeApi.commands.executeCommand(
          "leanquill.updateNodeStatus",
          nodeId,
        );
        break;
      case "rename":
        await this.vscodeApi.commands.executeCommand(
          "leanquill.renameOutlineNode",
          nodeId,
        );
        break;
      case "toggleActive":
        await this.vscodeApi.commands.executeCommand(
          "leanquill.toggleOutlineActive",
          nodeId,
        );
        break;
      case "moveUp":
        await this.vscodeApi.commands.executeCommand(
          "leanquill.moveNodeUp",
          nodeId,
        );
        break;
      case "moveDown":
        await this.vscodeApi.commands.executeCommand(
          "leanquill.moveNodeDown",
          nodeId,
        );
        break;
      case "remove":
        await this.vscodeApi.commands.executeCommand(
          "leanquill.removeOutlineNode",
          nodeId,
        );
        break;
    }
  }

  private async discoverOrphans(index: OutlineIndex): Promise<string[]> {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const manuscriptDir = path.join(this.rootPath, "manuscript");
    let entries: string[];
    try {
      entries = await fs.readdir(manuscriptDir);
    } catch {
      return [];
    }

    const referenced = new Set<string>();
    const collectRefs = (nodes: OutlineNode[]): void => {
      for (const node of nodes) {
        if (node.fileName) {
          referenced.add(node.fileName.split("\\").join("/"));
        }
        collectRefs(node.children);
      }
    };
    collectRefs(index.nodes);

    return entries
      .filter((e) => e.endsWith(".md") && !referenced.has(`manuscript/${e}`))
      .map((e) => `manuscript/${e}`)
      .sort();
  }
}
