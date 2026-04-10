import * as path from "node:path";
import type * as VSCode from "vscode";
import { listPlaces, buildPlaceTree, placeReparentWouldCycle, savePlace, PlaceTreeNode } from "./placeStore";
import { readProjectConfig, readProjectConfigWithDefaults } from "./projectConfig";
import { SafeFileSystem } from "./safeFileSystem";

/** Lowercase tree id per VS Code `application/vnd.code.tree.<id>` convention. */
export const PLACES_TREE_DRAG_MIME = "application/vnd.code.tree.leanquill.places";

function localDragRoots(items: readonly PlaceItem[]): PlaceItem[] {
  const names = new Set(items.map((i) => i.fileName));
  return items.filter((item) => {
    const p = item.parentFileName;
    return !p || !names.has(p);
  });
}

export interface PlaceItem {
  kind: "place";
  fileName: string;
  name: string;
  filePath: string;
  hasChildren: boolean;
  parentFileName: string;
}

export class PlaceTreeProvider
  implements VSCode.TreeDataProvider<PlaceItem>, VSCode.TreeDragAndDropController<PlaceItem>
{
  readonly dropMimeTypes = [PLACES_TREE_DRAG_MIME] as const;
  readonly dragMimeTypes = [PLACES_TREE_DRAG_MIME] as const;

  private readonly _onDidChangeTreeData: VSCode.EventEmitter<void>;
  readonly onDidChangeTreeData: VSCode.Event<void>;
  private _tree: PlaceTreeNode[] = [];
  private _nodeMap = new Map<string, PlaceTreeNode>();
  private _settingsDir = "";
  private _treeView: VSCode.TreeView<PlaceItem> | undefined;

  constructor(
    private readonly vscode: typeof import("vscode"),
    private readonly rootPath: string,
    private readonly safeFs: SafeFileSystem,
    private readonly onPlacesStructureChanged?: () => void,
  ) {
    this._onDidChangeTreeData = new vscode.EventEmitter<void>();
    this.onDidChangeTreeData = this._onDidChangeTreeData.event;
  }

  refresh(): void {
    this._tree = [];
    this._nodeMap.clear();
    this._onDidChangeTreeData.fire();
  }

  /** Call from extension after `createTreeView` so reparent drops can expand the new parent. */
  attachTreeView(view: VSCode.TreeView<PlaceItem>): void {
    this._treeView = view;
  }

  private async _expandPlaceFileNames(fileNames: string[]): Promise<void> {
    if (!this._treeView || fileNames.length === 0) {
      return;
    }
    await this.getChildren();
    for (const fn of fileNames) {
      const node = this._nodeMap.get(fn);
      if (!node) {
        continue;
      }
      try {
        await this._treeView.reveal(this._toItem(node), { expand: true, select: false });
      } catch {
        // Hidden view or element not yet visible
      }
    }
  }

  getTreeItem(item: PlaceItem): VSCode.TreeItem {
    const collapsible = item.hasChildren
      ? this.vscode.TreeItemCollapsibleState.Expanded
      : this.vscode.TreeItemCollapsibleState.None;
    const treeItem = new this.vscode.TreeItem(item.name || item.fileName, collapsible);
    treeItem.id = item.fileName;
    treeItem.iconPath = new this.vscode.ThemeIcon("globe");
    treeItem.resourceUri = this.vscode.Uri.file(item.filePath);
    treeItem.contextValue = "place";
    treeItem.command = {
      command: "leanquill.selectPlaceInPanel",
      title: "Open Place",
      arguments: [item.fileName],
    };
    return treeItem;
  }

  async getChildren(element?: PlaceItem): Promise<PlaceItem[]> {
    if (!element) {
      const config = await readProjectConfig(this.rootPath);
      if (!config) {
        return [];
      }
      const profiles = await listPlaces(this.rootPath, config);
      this._tree = buildPlaceTree(profiles);
      this._nodeMap.clear();
      const walkMap = (nodes: PlaceTreeNode[]) => {
        for (const n of nodes) {
          this._nodeMap.set(n.profile.fileName, n);
          walkMap(n.children);
        }
      };
      walkMap(this._tree);

      this._settingsDir = path.join(
        this.rootPath,
        ...config.folders.settings.replace(/\/+$/, "").split("/"),
      );

      return this._tree.map((n) => this._toItem(n));
    }

    const node = this._nodeMap.get(element.fileName);
    if (!node) {
      return [];
    }
    return node.children.map((n) => this._toItem(n));
  }

  async getParent(element: PlaceItem): Promise<PlaceItem | undefined> {
    if (!element.parentFileName) {
      return undefined;
    }
    if (!this._nodeMap.get(element.parentFileName)) {
      await this.getChildren();
    }
    const parentNode = this._nodeMap.get(element.parentFileName);
    return parentNode ? this._toItem(parentNode) : undefined;
  }

  handleDrag(
    source: readonly PlaceItem[],
    dataTransfer: VSCode.DataTransfer,
    _token: VSCode.CancellationToken,
  ): void {
    dataTransfer.set(PLACES_TREE_DRAG_MIME, new this.vscode.DataTransferItem([...source]));
  }

  async handleDrop(
    target: PlaceItem | undefined,
    dataTransfer: VSCode.DataTransfer,
    _token: VSCode.CancellationToken,
  ): Promise<void> {
    const raw = dataTransfer.get(PLACES_TREE_DRAG_MIME);
    if (!raw) {
      return;
    }
    const dragged = raw.value as PlaceItem[] | undefined;
    if (!Array.isArray(dragged) || dragged.length === 0) {
      return;
    }

    const roots = localDragRoots(dragged);
    const newParent = target?.fileName ?? "";

    const config = await readProjectConfigWithDefaults(this.rootPath);
    const profiles = await listPlaces(this.rootPath, config);
    const parentOf = new Map<string, string>();
    for (const p of profiles) {
      parentOf.set(p.fileName, p.parentFileName || "");
    }

    let changed = false;
    const parentsToExpand: string[] = [];
    for (const item of roots) {
      if (item.fileName === newParent) {
        continue;
      }
      const currentParent = parentOf.get(item.fileName) ?? "";
      if (currentParent === newParent) {
        continue;
      }
      if (placeReparentWouldCycle(item.fileName, newParent, parentOf)) {
        void this.vscode.window.showWarningMessage(
          "LeanQuill: Cannot move a place under itself or one of its descendants.",
        );
        continue;
      }
      const profile = profiles.find((p) => p.fileName === item.fileName);
      if (!profile) {
        continue;
      }
      profile.parentFileName = newParent;
      parentOf.set(item.fileName, newParent);
      await savePlace(profile, this.rootPath, config, this.safeFs);
      changed = true;
      if (newParent) {
        parentsToExpand.push(newParent);
      }
    }

    if (changed) {
      this.refresh();
      this.onPlacesStructureChanged?.();
      const uniqueParents = [...new Set(parentsToExpand)];
      if (uniqueParents.length > 0) {
        setTimeout(() => void this._expandPlaceFileNames(uniqueParents), 0);
      }
    }
  }

  private _toItem(node: PlaceTreeNode): PlaceItem {
    return {
      kind: "place",
      fileName: node.profile.fileName,
      name: node.profile.name || node.profile.fileName.replace(/\.md$/, ""),
      filePath: path.join(this._settingsDir, node.profile.fileName),
      hasChildren: node.children.length > 0,
      parentFileName: node.profile.parentFileName,
    };
  }
}
