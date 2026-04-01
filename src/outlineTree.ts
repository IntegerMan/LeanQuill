import * as crypto from "node:crypto";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import type * as VSCode from "vscode";
import { readOutlineIndex, writeOutlineIndex } from "./outlineStore";
import { SafeFileSystem } from "./safeFileSystem";
import { OutlineBeat, OutlineChapter, OutlineIndex, OutlinePart, ChapterStatus } from "./types";

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

export type OutlineTreeNode = OutlinePartNode | OutlineChapterNode | OutlineBeatNode | OutlineOrphanGroupNode | OutlineOrphanNode;

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

export function buildOutlineTree(index: OutlineIndex): OutlineTreeNode[] {
  return index.parts.map((part) => ({
    kind: "part" as const,
    data: part,
  }));
}

// --- Orphan file discovery ---

function collectReferencedFiles(index: OutlineIndex): Set<string> {
  const referenced = new Set<string>();
  for (const part of index.parts) {
    for (const ch of part.chapters) {
      if (ch.fileName) {
        referenced.add(ch.fileName.split("\\").join("/"));
      }
      for (const beat of ch.beats) {
        if (beat.fileName) {
          referenced.add(beat.fileName.split("\\").join("/"));
        }
      }
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

  const referenced = collectReferencedFiles(index);
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
    // Drop chapter next to the chapter that contains the target beat
    for (const part of index.parts) {
      for (const ch of part.chapters) {
        if (ch.beats.some((b) => b.id === targetId)) {
          const chIdx = part.chapters.indexOf(ch);
          part.chapters.splice(chIdx, 0, srcChapter);
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
    // Move beat into target chapter (append to its beats)
    for (const part of index.parts) {
      const targetCh = part.chapters.find((c) => c.id === targetId);
      if (targetCh) {
        targetCh.beats.push(srcBeat);
        return index;
      }
    }
  } else if (targetKind === "part") {
    // Move beat into first chapter of target part
    const targetPart = index.parts.find((p) => p.id === targetId);
    if (targetPart && targetPart.chapters.length > 0) {
      targetPart.chapters[0].beats.push(srcBeat);
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
      const status = element.data.status;
      const statusIcon = STATUS_ICONS[status] || "dash";
      const collapsible = element.data.beats.length > 0 ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None;
      const item = new vscode.TreeItem(label, collapsible);
      const statusLabel = `(${status})`;
      const filePart = element.data.fileName || "";
      item.description = isActive
        ? `${statusLabel} ${filePart}`.trim()
        : `(inactive) ${statusLabel} ${filePart}`.trim();
      item.contextValue = isActive ? "outlineChapter" : "outlineChapter:inactive";
      item.iconPath = isActive
        ? new vscode.ThemeIcon(statusIcon)
        : new vscode.ThemeIcon(statusIcon, new vscode.ThemeColor("disabledForeground"));
      item.id = `chapter-${element.data.id}`;
      return item;
    }

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

    // beat
    const isActive = element.data.active;
    const label = element.data.title || "(untitled beat)";
    const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);
    item.description = isActive ? element.data.fileName || undefined : "(inactive)";
    item.contextValue = isActive ? "outlineBeat" : "outlineBeat:inactive";
    item.iconPath = isActive
      ? new vscode.ThemeIcon("note")
      : new vscode.ThemeIcon("note", new vscode.ThemeColor("disabledForeground"));
    item.id = `beat-${element.data.id}`;
    item.command = {
      command: "leanquill.openBeatInEditor",
      title: "Open Beat",
      arguments: [element.data.id],
    };
    return item;
  }

  async getChildren(element?: OutlineTreeNode): Promise<OutlineTreeNode[]> {
    if (!this._index) {
      this._index = await readOutlineIndex(this.rootPath);
    }

    if (!element) {
      const parts = buildOutlineTree(this._index);
      // Only show orphans when outline has content — otherwise the
      // "Create Outline" welcome content must remain visible.
      if (parts.length > 0) {
        const orphans = await discoverOrphanFiles(this.rootPath, this._index);
        return [...parts, { kind: "orphanGroup" as const, data: { fileNames: orphans } }];
      }
      return parts;
    }

    if (element.kind === "part") {
      return getPartChildren(element.data);
    }

    if (element.kind === "chapter") {
      return getChapterChildren(element.data, element.parentPartId);
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

    // Drop onto "Not Included" → exclude from outline
    if (target?.kind === "orphanGroup") {
      await this.handleExcludeDrop(sourceIds);
      return;
    }

    const index = await readOutlineIndex(this.rootPath);
    const targetId = target?.data.id;
    const targetKind = target?.kind;

    const updated = reorderOutline(index, sourceIds, targetId, targetKind);
    await writeOutlineIndex(this.rootPath, updated, this.safeFs);
    this.onReorder();
  }

  private async handleExcludeDrop(sourceIds: { id: string; kind: string }[]): Promise<void> {
    const chapterIds = sourceIds.filter((s) => s.kind === "chapter");
    if (chapterIds.length === 0) {
      return;
    }

    const label = chapterIds.length === 1 ? "this chapter" : `these ${chapterIds.length} chapters`;
    const confirm = await this.vscodeApi.window.showWarningMessage(
      `Remove ${label} from the outline? The manuscript file will be kept on disk.`,
      { modal: true },
      "Remove from Outline",
    );
    if (confirm !== "Remove from Outline") {
      return;
    }

    const idsToRemove = new Set(chapterIds.map((s) => s.id));
    const index = await readOutlineIndex(this.rootPath);
    for (const part of index.parts) {
      part.chapters = part.chapters.filter((c) => !idsToRemove.has(c.id));
    }
    await writeOutlineIndex(this.rootPath, index, this.safeFs);
    this.onReorder();
  }
}
