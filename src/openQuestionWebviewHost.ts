import type * as vscode from "vscode";
import type { SafeFileSystem } from "./safeFileSystem";
import { deleteOpenQuestion, listOpenQuestions, saveOpenQuestion } from "./openQuestionStore";
import type { OpenQuestionRecord } from "./types";

export async function executeOpenIssueTargetCommand(vscodeApi: typeof vscode, id: string): Promise<void> {
  if (!id.trim()) {
    return;
  }
  await vscodeApi.commands.executeCommand("leanquill.openQuestionTarget", id);
}

/**
 * @returns true if the issue was deleted
 */
export async function confirmAndDeleteIssueById(
  vscodeApi: typeof vscode,
  rootPath: string,
  safeFs: SafeFileSystem,
  id: string,
): Promise<boolean> {
  if (!id.trim()) {
    return false;
  }
  const list = await listOpenQuestions(rootPath);
  const q = list.find((x) => x.id === id);
  if (!q) {
    return false;
  }
  const label = (q.title || id).replace(/"/g, "'");
  const choice = await vscodeApi.window.showWarningMessage(
    `Delete issue "${label}"? This cannot be undone.`,
    { modal: true },
    "Delete",
  );
  if (choice !== "Delete") {
    return false;
  }
  await deleteOpenQuestion(q.fileName, rootPath, safeFs);
  return true;
}

export async function pickIssueStatusAndSave(
  vscodeApi: typeof vscode,
  rootPath: string,
  safeFs: SafeFileSystem,
  id: string,
): Promise<void> {
  if (!id.trim()) {
    return;
  }
  const list = await listOpenQuestions(rootPath);
  const q = list.find((x) => x.id === id);
  if (!q) {
    return;
  }
  type St = OpenQuestionRecord["status"];
  const items: { label: string; description?: string; status: St }[] = [
    { label: "Open", description: "In active triage", status: "open" },
    { label: "Deferred", status: "deferred" },
    { label: "Dismissed", status: "dismissed" },
    { label: "Resolved", status: "resolved" },
  ];
  const picked = await vscodeApi.window.showQuickPick(items, {
    title: "Issue status",
    placeHolder: q.title || q.id,
  });
  if (!picked) {
    return;
  }
  let next: OpenQuestionRecord = { ...q, status: picked.status };
  if (picked.status === "dismissed") {
    const reason = await vscodeApi.window.showInputBox({
      prompt: "Dismissal note (optional)",
      value: q.dismissedReason ?? "",
    });
    if (reason === undefined) {
      return;
    }
    next = {
      ...next,
      dismissedReason: reason.trim().length > 0 ? reason.trim() : undefined,
    };
  } else {
    next = { ...next, dismissedReason: undefined };
  }
  await saveOpenQuestion(next, rootPath, safeFs);
}
