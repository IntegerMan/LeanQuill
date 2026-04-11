import * as path from "node:path";
import type * as VSCode from "vscode";
import { listCharacters } from "./characterStore";
import { countActiveQuestionsLinkedToEntity, listOpenQuestions } from "./openQuestionStore";
import { readProjectConfig } from "./projectConfig";

export interface CharacterItem {
  kind: "character";
  fileName: string;
  name: string;
  filePath: string;
  /** Open + deferred issues linked to this profile (D-06 / D-09). */
  activeIssueCount: number;
}

export class CharacterTreeProvider implements VSCode.TreeDataProvider<CharacterItem> {
  private readonly _onDidChangeTreeData: VSCode.EventEmitter<void>;
  readonly onDidChangeTreeData: VSCode.Event<void>;

  constructor(
    private readonly vscode: typeof import("vscode"),
    private readonly rootPath: string,
  ) {
    this._onDidChangeTreeData = new vscode.EventEmitter<void>();
    this.onDidChangeTreeData = this._onDidChangeTreeData.event;
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(item: CharacterItem): VSCode.TreeItem {
    const treeItem = new this.vscode.TreeItem(
      item.name || item.fileName,
      this.vscode.TreeItemCollapsibleState.None,
    );
    if (item.activeIssueCount > 0) {
      treeItem.description = `${item.activeIssueCount} Issues`;
    }
    treeItem.iconPath = new this.vscode.ThemeIcon("person");
    treeItem.contextValue = "character";
    treeItem.command = {
      command: "leanquill.selectCharacterInPanel",
      title: "Open Character",
      arguments: [item.fileName],
    };
    return treeItem;
  }

  async getChildren(element?: CharacterItem): Promise<CharacterItem[]> {
    if (element) {
      return [];
    }

    const config = await readProjectConfig(this.rootPath);
    if (!config) {
      return [];
    }

    const profiles = await listCharacters(this.rootPath, config);
    const charsDir = path.join(
      this.rootPath,
      ...config.folders.characters.replace(/\/+$/, "").split("/"),
    );

    const oq = await listOpenQuestions(this.rootPath);
    return profiles.map((p) => ({
      kind: "character" as const,
      fileName: p.fileName,
      name: p.name || p.fileName.replace(/\.md$/, ""),
      filePath: path.join(charsDir, p.fileName),
      activeIssueCount: countActiveQuestionsLinkedToEntity(oq, "character", p.fileName),
    }));
  }
}
