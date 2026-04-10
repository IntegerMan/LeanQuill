import * as path from "node:path";
import type * as VSCode from "vscode";
import { listPlaces, buildPlaceTree, PlaceTreeNode } from "./placeStore";
import { readProjectConfig } from "./projectConfig";

export interface PlaceItem {
  kind: "place";
  fileName: string;
  name: string;
  filePath: string;
  hasChildren: boolean;
  parentFileName: string;
}

export class PlaceTreeProvider implements VSCode.TreeDataProvider<PlaceItem> {
  private readonly _onDidChangeTreeData: VSCode.EventEmitter<void>;
  readonly onDidChangeTreeData: VSCode.Event<void>;
  private _tree: PlaceTreeNode[] = [];
  private _nodeMap = new Map<string, PlaceTreeNode>();
  private _settingsDir = "";

  constructor(
    private readonly vscode: typeof import("vscode"),
    private readonly rootPath: string,
  ) {
    this._onDidChangeTreeData = new vscode.EventEmitter<void>();
    this.onDidChangeTreeData = this._onDidChangeTreeData.event;
  }

  refresh(): void {
    this._tree = [];
    this._nodeMap.clear();
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(item: PlaceItem): VSCode.TreeItem {
    const collapsible = item.hasChildren
      ? this.vscode.TreeItemCollapsibleState.Expanded
      : this.vscode.TreeItemCollapsibleState.None;
    const treeItem = new this.vscode.TreeItem(item.name || item.fileName, collapsible);
    treeItem.iconPath = new this.vscode.ThemeIcon("globe");
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
