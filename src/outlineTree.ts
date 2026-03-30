import * as crypto from "node:crypto";
import type * as VSCode from "vscode";
import { readOutlineIndex, writeOutlineIndex } from "./outlineStore";
import { SafeFileSystem } from "./safeFileSystem";
import { OutlineBeat, OutlineChapter, OutlineIndex, OutlinePart } from "./types";

// --- Node types ---

export interface OutlinePartNode {
  kind: "part";
  data: OutlinePart;
}

export interface OutlineChapterNode {
  kind: "chapter";
  data: OutlineChapter;
  parentPartId: string;
}

export interface OutlineBeatNode {
  kind: "beat";
  data: OutlineBeat;
  parentChapterId: string;
  parentPartId: string;
}

export type OutlineTreeNode = OutlinePartNode | OutlineChapterNode | OutlineBeatNode;

// --- Pure tree builder ---

export function buildOutlineTree(index: OutlineIndex): OutlineTreeNode[] {
  return index.parts.map((part) => ({
    kind: "part" as const,
    data: part,
  }));
}

function getPartChildren(part: OutlinePart): OutlineChapterNode[] {
  return part.chapters.map((ch) => ({
    kind: "chapter" as const,
    data: ch,
    parentPartId: part.id,
  }));
}

function getChapterChildren(chapter: OutlineChapter, partId: string): OutlineBeatNode[] {
  return chapter.beats.map((beat) => ({
    kind: "beat" as const,
    data: beat,
    parentChapterId: chapter.id,
    parentPartId: partId,
  }));
}

// --- Reorder logic (pure) ---

export function reorderOutline(
  index: OutlineIndex,
  sourceIds: { id: string; kind: string }[],
  targetId: string | undefined,
  targetKind: string | undefined,
): OutlineIndex {
  if (sourceIds.length === 0) {
    return index;
  }

  const src = sourceIds[0];

  // Self-drop: no-op
  if (src.id === targetId) {
    return index;
  }

  const result: OutlineIndex = JSON.parse(JSON.stringify(index));

  if (src.kind === "part") {
    return reorderPart(result, src.id, targetId, targetKind);
  }

  if (src.kind === "chapter") {
    return reorderChapter(result, src.id, targetId, targetKind);
  }

  if (src.kind === "beat") {
    return reorderBeat(result, src.id, targetId, targetKind);
  }

  return index;
}

function reorderPart(
  index: OutlineIndex,
  sourceId: string,
  targetId: string | undefined,
  targetKind: string | undefined,
): OutlineIndex {
  const srcIdx = index.parts.findIndex((p) => p.id === sourceId);
  if (srcIdx === -1) {
    return index;
  }

  const [part] = index.parts.splice(srcIdx, 1);

  if (!targetId || targetKind === "part") {
    // Same-level reorder
    const targetIdx = targetId ? index.parts.findIndex((p) => p.id === targetId) : index.parts.length;
    index.parts.splice(targetIdx === -1 ? index.parts.length : targetIdx, 0, part);
  } else {
    // Drop on root
    index.parts.push(part);
  }

  return index;
}

function reorderChapter(
  index: OutlineIndex,
  sourceId: string,
  targetId: string | undefined,
  targetKind: string | undefined,
): OutlineIndex {
  // Remove source chapter from its current part
  let srcChapter: OutlineChapter | undefined;
  for (const part of index.parts) {
    const idx = part.chapters.findIndex((c) => c.id === sourceId);
    if (idx !== -1) {
      srcChapter = part.chapters.splice(idx, 1)[0];
      break;
    }
  }
  if (!srcChapter) {
    return index;
  }

  if (targetKind === "chapter") {
    // Same-level reorder: insert at target position in target's parent
    for (const part of index.parts) {
      const targetIdx = part.chapters.findIndex((c) => c.id === targetId);
      if (targetIdx !== -1) {
        part.chapters.splice(targetIdx, 0, srcChapter);
        return index;
      }
    }
    // Target not found, append to first part
    if (index.parts.length > 0) {
      index.parts[0].chapters.push(srcChapter);
    }
  } else if (targetKind === "part") {
    // Drop chapter into a part
    const targetPart = index.parts.find((p) => p.id === targetId);
    if (targetPart) {
      targetPart.chapters.push(srcChapter);
    }
  } else if (targetKind === "beat") {
    // Demote chapter to beat
    const beat: OutlineBeat = {
      id: crypto.randomUUID(),
      title: srcChapter.name,
      active: srcChapter.active,
      description: "",
      what: "",
      who: "",
      where: "",
      why: "",
      customFields: {},
    };
    // Find the chapter containing the target beat and insert there
    for (const part of index.parts) {
      for (const ch of part.chapters) {
        const beatIdx = ch.beats.findIndex((b) => b.id === targetId);
        if (beatIdx !== -1) {
          ch.beats.splice(beatIdx, 0, beat);
          return index;
        }
      }
    }
  } else {
    // Drop on root: append to first part
    if (index.parts.length > 0) {
      index.parts[0].chapters.push(srcChapter);
    }
  }

  return index;
}

function reorderBeat(
  index: OutlineIndex,
  sourceId: string,
  targetId: string | undefined,
  targetKind: string | undefined,
): OutlineIndex {
  // Remove source beat from its current chapter
  let srcBeat: OutlineBeat | undefined;
  for (const part of index.parts) {
    for (const ch of part.chapters) {
      const idx = ch.beats.findIndex((b) => b.id === sourceId);
      if (idx !== -1) {
        srcBeat = ch.beats.splice(idx, 1)[0];
        break;
      }
    }
    if (srcBeat) {
      break;
    }
  }
  if (!srcBeat) {
    return index;
  }

  if (targetKind === "beat") {
    // Same-level reorder: insert at target position
    for (const part of index.parts) {
      for (const ch of part.chapters) {
        const targetIdx = ch.beats.findIndex((b) => b.id === targetId);
        if (targetIdx !== -1) {
          ch.beats.splice(targetIdx, 0, srcBeat);
          return index;
        }
      }
    }
  } else if (targetKind === "chapter") {
    // Promote beat to chapter
    const chapter: OutlineChapter = {
      id: crypto.randomUUID(),
      name: srcBeat.title,
      fileName: "",
      active: srcBeat.active,
      beats: [],
    };
    for (const part of index.parts) {
      const targetIdx = part.chapters.findIndex((c) => c.id === targetId);
      if (targetIdx !== -1) {
        part.chapters.splice(targetIdx, 0, chapter);
        return index;
      }
    }
  } else if (targetKind === "part") {
    // Drop beat into a part as a new chapter
    const chapter: OutlineChapter = {
      id: crypto.randomUUID(),
      name: srcBeat.title,
      fileName: "",
      active: srcBeat.active,
      beats: [],
    };
    const targetPart = index.parts.find((p) => p.id === targetId);
    if (targetPart) {
      targetPart.chapters.push(chapter);
    }
  } else {
    // No target: append to first chapter of first part
    if (index.parts.length > 0 && index.parts[0].chapters.length > 0) {
      index.parts[0].chapters[0].beats.push(srcBeat);
    }
  }

  return index;
}

// --- Tree Provider ---

const DRAG_MIME_TYPE = "application/vnd.code.tree.leanquill.outlineTree";

export class OutlineTreeProvider implements VSCode.TreeDataProvider<OutlineTreeNode> {
  private readonly _onDidChangeTreeData: VSCode.EventEmitter<OutlineTreeNode | undefined>;
  readonly onDidChangeTreeData: VSCode.Event<OutlineTreeNode | undefined>;

  private _index: OutlineIndex | null = null;
  private readonly dragDropController: OutlineDragDropController;

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
    this.refresh();
  }

  public getIndex(): OutlineIndex | null {
    return this._index;
  }

  public getDragDropController(): OutlineDragDropController {
    return this.dragDropController;
  }

  getTreeItem(element: OutlineTreeNode): VSCode.TreeItem {
    const vscode = this.vscodeApi;

    if (element.kind === "part") {
      const isActive = element.data.active;
      const label = element.data.name;
      const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.Expanded);
      item.description = isActive ? undefined : "(inactive)";
      item.contextValue = isActive ? "outlinePart" : "outlinePart:inactive";
      item.iconPath = isActive
        ? new vscode.ThemeIcon("symbol-namespace")
        : new vscode.ThemeIcon("symbol-namespace", new vscode.ThemeColor("disabledForeground"));
      item.id = `part-${element.data.id}`;
      return item;
    }

    if (element.kind === "chapter") {
      const isActive = element.data.active;
      const label = element.data.name;
      const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.Collapsed);
      item.description = isActive ? element.data.fileName : `(inactive) ${element.data.fileName}`;
      item.contextValue = isActive ? "outlineChapter" : "outlineChapter:inactive";
      item.iconPath = isActive
        ? new vscode.ThemeIcon("file-text")
        : new vscode.ThemeIcon("file-text", new vscode.ThemeColor("disabledForeground"));
      item.id = `chapter-${element.data.id}`;
      return item;
    }

    // beat
    const isActive = element.data.active;
    const label = element.data.title || "(untitled beat)";
    const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);
    item.description = isActive ? undefined : "(inactive)";
    item.contextValue = isActive ? "outlineBeat" : "outlineBeat:inactive";
    item.iconPath = isActive
      ? new vscode.ThemeIcon("note")
      : new vscode.ThemeIcon("note", new vscode.ThemeColor("disabledForeground"));
    item.id = `beat-${element.data.id}`;
    return item;
  }

  async getChildren(element?: OutlineTreeNode): Promise<OutlineTreeNode[]> {
    if (!this._index) {
      this._index = await readOutlineIndex(this.rootPath);
    }

    if (!element) {
      return buildOutlineTree(this._index);
    }

    if (element.kind === "part") {
      return getPartChildren(element.data);
    }

    if (element.kind === "chapter") {
      return getChapterChildren(element.data, element.parentPartId);
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
    const items = source.map((node) => ({
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

    const index = await readOutlineIndex(this.rootPath);
    const targetId = target?.data.id;
    const targetKind = target?.kind;

    const updated = reorderOutline(index, sourceIds, targetId, targetKind);
    await writeOutlineIndex(this.rootPath, updated, this.safeFs);
    this.onReorder();
  }
}
