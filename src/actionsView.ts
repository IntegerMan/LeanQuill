import * as vscode from "vscode";

class ActionItem extends vscode.TreeItem {
  constructor(label: string, command?: vscode.Command) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.command = command;
  }
}

export class LeanQuillActionsProvider implements vscode.TreeDataProvider<ActionItem> {
  private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<ActionItem | undefined>();
  readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;

  getTreeItem(element: ActionItem): vscode.TreeItem {
    return element;
  }

  getChildren(): ActionItem[] {
    return [
      new ActionItem("Initialize Repository", {
        command: "leanquill.initialize",
        title: "LeanQuill: Initialize",
      }),
    ];
  }
}
