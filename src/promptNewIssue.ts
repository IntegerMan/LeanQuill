import type * as vscode from "vscode";
import { AUTHOR_ISSUE_TYPES } from "./issueTypes";
import { displayIssueTypeLabel } from "./openQuestionStore";

export type NewIssuePromptFields = { title: string; issueType: string };

/**
 * Prompts for title (InputBox) then issue type (QuickPick).
 * Used by extension commands and Issues webviews so creation is consistent.
 */
export async function promptNewIssueTitleAndType(
  vscodeApi: typeof vscode,
): Promise<NewIssuePromptFields | undefined> {
  const title = await vscodeApi.window.showInputBox({
    title: "New issue",
    prompt: "Issue title",
    placeHolder: "Short label for this issue",
    value: "",
  });
  if (!title?.trim()) {
    return undefined;
  }
  const items = AUTHOR_ISSUE_TYPES.map((slug) => ({
    label: displayIssueTypeLabel(slug),
    description: slug,
  }));
  const picked = await vscodeApi.window.showQuickPick(items, {
    placeHolder: "Select issue type",
    title: "New issue",
  });
  const issueType = picked?.description?.trim();
  if (!issueType) {
    return undefined;
  }
  return { title: title.trim(), issueType };
}
