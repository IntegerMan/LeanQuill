import * as crypto from "node:crypto";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import type * as VSCode from "vscode";
import { readOutlineIndex, writeOutlineIndex, findNodeById, removeNodeById, isAncestorOf } from "./outlineStore";
import { SafeFileSystem } from "./safeFileSystem";
import { OutlineNode, OutlineIndex, ChapterStatus } from "./types";

// --- Status icon mapping ---

const STATUS_ICONS: Record<ChapterStatus, string> = {
  "planning": "circle-outline",
  "not-started": "dash",
  "drafting": "edit",
  "draft-complete": "pass",
  "editing": "pencil",
  "review-pending": "clock",
  "final": "verified",
};

// --- Node types ---

export interface OutlineDataNode {
  kind: "node";
  data: OutlineNode;
  parentId: string | null;
  depth: number;
}

export type OutlineTreeNode = OutlineDataNode | OutlineOrphanGroupNode | OutlineOrphanNode;

// --- Orphan (Not Included) node types ---

export interface OutlineOrphanGroupNode {
  kind: "orphanGroup";
  data: { fileNames: string[] };
}

export interface OutlineOrphanNode {
  kind: "orphan";
  data: { fileName: string };
}

// --- Pure tree builder ---

export function buildOutlineTree(index: OutlineIndex): OutlineDataNode[] {
  return index.nodes.map((node) => ({
    kind: "node" as const,
    data: node,
    parentId: null,
    depth: 0,
  }));
}

// --- Orphan file discovery ---

function collectReferencedFiles(nodes: OutlineNode[]): Set<string> {
  const referenced = new Set<string>();
  for (const node of nodes) {
    if (node.fileName) {
      referenced.add(node.fileName.split("\\").join("/"));
    }
    for (const ref of collectReferencedFiles(node.children)) {
      referenced.add(ref);
    }
  }
  return referenced;
}

async function discoverOrphanFiles(rootPath: string, index: OutlineIndex): Promise<string[]> {
  const manuscriptDir = path.join(rootPath, "manuscript");
  let entries: string[];
  try {
    entries = await fs.readdir(manuscriptDir);
  } catch {
    return [];
  }

  const referenced = collectReferencedFiles(index.nodes);
  const orphans: string[] = [];

  for (const entry of entries) {
    if (!entry.endsWith(".md")) {
      continue;
    }
    const relativePath = `manuscript/${entry}`;
    if (!referenced.has(relativePath)) {
      orphans.push(relativePath);
    }
  }

  return orphans.sort();
}

// --- Reorder logic (pure, recursive) ---

export function reorderOutline(
  index: OutlineIndex,
  sourceIds: { id: string; kind: string }[],
  targetId: string | undefined,
  targetKind: string | undefined,
): OutlineIndex {
  if (sourceIds.length === 0) {
    return index;
  }

  const result: OutlineIndex = JSON.parse(JSON.stringify(index));
  const movedNodes: OutlineNode[] = [];

  for (const src of sourceIds) {
    // Self-drop: skip this node
    if (src.id === targetId) {
      continue;
    }

    // Cycle detection: if target is a descendant of source, skip
    if (targetId && isAncestorOf(result.nodes, src.id, targetId)) {
      continue;
    }

    const [, removed] = removeNodeById(result.nodes, src.id);
    if (removed) {
      movedNodes.push(removed);
    }
  }

  if (movedNodes.length === 0) {
    return index;
  }

  if (!targetId) {
    // No target — append all to top level
    result.nodes.push(...movedNodes);
    return result;
  }

  if (targetKind === "node") {
    // Find target node
    const targetResult = findNodeById(result.nodes, targetId);
    if (!targetResult) {
      result.nodes.push(...movedNodes);
      return result;
    }

    // Drop on a node = nest as children of that node
    targetResult.node.children.push(...movedNodes);
  } else {
    // Drop on non-node (orphan group etc.) — append to top level
    result.nodes.push(...movedNodes);
  }

  return result;
}

// --- Tree Provider ---

const DRAG_MIME_TYPE = "application/vnd.code.tree.leanquill.outlineTree";

export class OutlineTreeProvider implements VSCode.TreeDataProvider<OutlineTreeNode> {
  private readonly _onDidChangeTreeData: VSCode.EventEmitter<OutlineTreeNode | undefined>;
  readonly onDidChangeTreeData: VSCode.Event<OutlineTreeNode | undefined>;

  private _index: OutlineIndex | null = null;
  private readonly dragDropController: OutlineDragDropController;
  private readonly _parentMap = new Map<string, OutlineDataNode>();

  constructor(
    private readonly vscodeApi: typeof VSCode,
    private readonly rootPath: string,
    private readonly safeFs: SafeFileSystem,
  ) {
    this._onDidChangeTreeData = new this.vscodeApi.EventEmitter<OutlineTreeNode | undefined>();
    this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    this.dragDropController = new OutlineDragDropController(
      this.vscodeApi,
      this.rootPath,
      this.safeFs,
      () => this.reloadIndex(),
    );
  }

  public refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  public async reloadIndex(): Promise<void> {
    this._index = await readOutlineIndex(this.rootPath);
    this._parentMap.clear();
    this.refresh();
  }

  public getIndex(): OutlineIndex | null {
    return this._index;
  }

  public getDragDropController(): OutlineDragDropController {
    return this.dragDropController;
  }

  getParent(element: OutlineTreeNode): OutlineTreeNode | undefined {
    if (element.kind !== "node") {
      return undefined;
    }
    if (element.parentId === null) {
      return undefined;
    }
    return this._parentMap.get(element.data.id) || undefined;
  }

  getTreeItem(element: OutlineTreeNode): VSCode.TreeItem {
    const vscode = this.vscodeApi;

    if (element.kind === "orphanGroup") {
      const count = element.data.fileNames.length;
      const label = count > 0
        ? `Not Included (${count} file${count === 1 ? "" : "s"})`
        : "Not Included";
      const collapsible = count > 0
        ? vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.None;
      const item = new vscode.TreeItem(label, collapsible);
      item.contextValue = "outlineOrphanGroup";
      item.iconPath = new vscode.ThemeIcon("question", new vscode.ThemeColor("disabledForeground"));
      item.tooltip = "Manuscript files not referenced by the outline. Drag chapters here to exclude them.";
      item.id = "orphan-group";
      return item;
    }

    if (element.kind === "orphan") {
      const label = path.basename(element.data.fileName);
      const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);
      item.description = element.data.fileName;
      item.contextValue = "outlineOrphan";
      item.iconPath = new vscode.ThemeIcon("file", new vscode.ThemeColor("disabledForeground"));
      item.id = `orphan-${element.data.fileName}`;
      item.command = {
        command: "vscode.open",
        title: "Open File",
        arguments: [vscode.Uri.file(path.join(this.rootPath, element.data.fileName))],
      };
      return item;
    }

    // --- OutlineDataNode ---
    const node = element.data;
    const isActive = node.active;
    const hasPart = node.traits.includes("part");
    const hasChildren = node.children.length > 0;
    const label = node.title || "(untitled)";

    if (hasPart) {
      // Part-like node: always expanded, namespace icon
      const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.Expanded);
      item.description = isActive ? undefined : "(inactive)";
      item.contextValue = isActive ? "outlineNode:part" : "outlineNode:part:inactive";
      item.iconPath = isActive
        ? new vscode.ThemeIcon("symbol-namespace")
        : new vscode.ThemeIcon("symbol-namespace", new vscode.ThemeColor("disabledForeground"));
      item.id = `node-${node.id}`;
      return item;
    }

    if (hasChildren) {
      // Branch node: collapsible
      const status = node.status;
      const statusIcon = STATUS_ICONS[status] || "dash";
      const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.Collapsed);
      const statusLabel = `(${status})`;
      const filePart = node.fileName || "";
      item.description = isActive
        ? `${statusLabel} ${filePart}`.trim()
        : `(inactive) ${statusLabel} ${filePart}`.trim();
      item.contextValue = isActive ? "outlineNode:branch" : "outlineNode:branch:inactive";
      item.iconPath = isActive
        ? new vscode.ThemeIcon(statusIcon)
        : new vscode.ThemeIcon(statusIcon, new vscode.ThemeColor("disabledForeground"));
      item.id = `node-${node.id}`;
      return item;
    }

    // Leaf node: not collapsible, status icon
    const status = node.status;
    const statusIcon = STATUS_ICONS[status] || "dash";
    const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);
    const statusLabel = `(${status})`;
    const filePart = node.fileName || "";
    item.description = isActive
      ? `${statusLabel} ${filePart}`.trim()
      : `(inactive) ${statusLabel} ${filePart}`.trim();
    item.contextValue = isActive ? "outlineNode:leaf" : "outlineNode:leaf:inactive";
    item.iconPath = isActive
      ? new vscode.ThemeIcon(statusIcon)
      : new vscode.ThemeIcon(statusIcon, new vscode.ThemeColor("disabledForeground"));
    item.id = `node-${node.id}`;
    if (node.fileName) {
      item.command = {
        command: "leanquill.openNodeInEditor",
        title: "Open",
        arguments: [node.id],
      };
    }
    return item;
  }

  async getChildren(element?: OutlineTreeNode): Promise<OutlineTreeNode[]> {
    if (!this._index) {
      this._index = await readOutlineIndex(this.rootPath);
    }

    if (!element) {
      this._parentMap.clear();
      const topNodes = buildOutlineTree(this._index);
      // Only show orphans when outline has content
      if (topNodes.length > 0) {
        const orphans = await discoverOrphanFiles(this.rootPath, this._index);
        return [...topNodes, { kind: "orphanGroup" as const, data: { fileNames: orphans } }];
      }
      return topNodes;
    }

    if (element.kind === "node") {
      return element.data.children.map((child): OutlineDataNode => {
        const childNode: OutlineDataNode = {
          kind: "node",
          data: child,
          parentId: element.data.id,
          depth: element.depth + 1,
        };
        // Populate parent map for getParent()
        this._parentMap.set(child.id, element);
        return childNode;
      });
    }

    if (element.kind === "orphanGroup") {
      return element.data.fileNames.map((fileName) => ({
        kind: "orphan" as const,
        data: { fileName },
      }));
    }

    return [];
  }
}

// --- Drag and Drop Controller ---

export class OutlineDragDropController implements VSCode.TreeDragAndDropController<OutlineTreeNode> {
  readonly dragMimeTypes: readonly string[] = [DRAG_MIME_TYPE];
  readonly dropMimeTypes: readonly string[] = [DRAG_MIME_TYPE];

  constructor(
    private readonly vscodeApi: typeof VSCode,
    private readonly rootPath: string,
    private readonly safeFs: SafeFileSystem,
    private readonly onReorder: () => void,
  ) {}

  handleDrag(
    source: readonly OutlineTreeNode[],
    dataTransfer: VSCode.DataTransfer,
    _token: VSCode.CancellationToken,
  ): void {
    const items = source
      .filter((n): n is OutlineDataNode => n.kind === "node")
      .map((node) => ({
        id: node.data.id,
        kind: node.kind,
      }));
    dataTransfer.set(DRAG_MIME_TYPE, new this.vscodeApi.DataTransferItem(JSON.stringify(items)));
  }

  async handleDrop(
    target: OutlineTreeNode | undefined,
    dataTransfer: VSCode.DataTransfer,
    _token: VSCode.CancellationToken,
  ): Promise<void> {
    const raw = dataTransfer.get(DRAG_MIME_TYPE);
    if (!raw) {
      return;
    }

    const sourceIds: { id: string; kind: string }[] = JSON.parse(raw.value);
    if (sourceIds.length === 0) {
      return;
    }

    // Drop onto "Not Included" → exclude from outline
    if (target?.kind === "orphanGroup") {
      await this.handleExcludeDrop(sourceIds);
      return;
    }

    const index = await readOutlineIndex(this.rootPath);
    const targetId = target?.kind === "node" ? target.data.id : undefined;
    const targetKind = target?.kind;

    const updated = reorderOutline(index, sourceIds, targetId, targetKind);
    await writeOutlineIndex(this.rootPath, updated, this.safeFs);
    this.onReorder();
  }

  private async handleExcludeDrop(sourceIds: { id: string; kind: string }[]): Promise<void> {
    const nodeIds = sourceIds.filter((s) => s.kind === "node");
    if (nodeIds.length === 0) {
      return;
    }

    const label = nodeIds.length === 1 ? "this item" : `these ${nodeIds.length} items`;
    const confirm = await this.vscodeApi.window.showWarningMessage(
      `Remove ${label} from the outline? The manuscript file will be kept on disk.`,
      { modal: true },
      "Remove from Outline",
    );
    if (confirm !== "Remove from Outline") {
      return;
    }

    const idsToRemove = new Set(nodeIds.map((s) => s.id));
    const index = await readOutlineIndex(this.rootPath);
    for (const id of idsToRemove) {
      removeNodeById(index.nodes, id);
    }
    await writeOutlineIndex(this.rootPath, index, this.safeFs);
    this.onReorder();
  }
}
