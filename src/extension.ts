import * as vscode from "vscode";
import { LeanQuillActionsProvider } from "./actionsView";
import { runInitializeFlow, shouldPromptInitialize } from "./initialize";

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const initializeCommand = vscode.commands.registerCommand("leanquill.initialize", async () => {
    await runInitializeFlow(context);
  });

  context.subscriptions.push(initializeCommand);

  const viewProvider = new LeanQuillActionsProvider();
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider("leanquill.actions", viewProvider),
  );

  const rootPath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!rootPath) {
    return;
  }

  const dismissed = context.workspaceState.get<boolean>("leanquill.initPromptDismissed", false);
  if (dismissed) {
    return;
  }

  const shouldPrompt = await shouldPromptInitialize(rootPath);
  if (!shouldPrompt) {
    return;
  }

  const choice = await vscode.window.showInformationMessage(
    "LeanQuill detected a LeanPub-style workspace. Initialize this repository for LeanQuill?",
    "Initialize",
    "Dismiss",
  );

  if (choice === "Initialize") {
    await vscode.commands.executeCommand("leanquill.initialize");
    return;
  }

  if (choice === "Dismiss") {
    await context.workspaceState.update("leanquill.initPromptDismissed", true);
  }
}

export function deactivate(): void {
  // No-op
}
