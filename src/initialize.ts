import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as vscode from "vscode";
import { resolveChapterOrder } from "./chapterOrder";
import { SafeFileSystem } from "./safeFileSystem";
import { InitInput } from "./types";

function toKebabCase(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-+|-+$/g, "");
}

function quote(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function renderProjectYaml(input: InitInput): string {
  const genres = input.genre.map((item) => `  - ${quote(item)}`).join("\n");

  return [
    'schema_version: "1"',
    `project_id: ${quote(input.projectId)}`,
    `working_title: ${quote(input.workingTitle)}`,
    "genre:",
    genres || "  - \"fiction\"",
    `target_audience: ${quote(input.targetAudience)}`,
    "folders:",
    "  manuscript: manuscript/",
    "  characters: notes/characters/",
    "  settings: notes/settings/",
    "  timeline: notes/timeline/",
    "  research: notes/research/",
    "  tool_state: .leanquill/",
    "manuscript:",
    "  file_pattern: ch*.md",
    "  chapter_order_source: Book.txt",
    "  front_matter_field_for_title: title",
    "active_personas: []",
    "ai_policy:",
    "  manuscript_write_blocked: true",
    "  git_operations_blocked: true",
    "  default_context_scope: chapter",
    "  sequential_reader_boundary: strict",
    "issue_tracking:",
    "  consolidation_auto: false",
    "  default_view_filter: open",
    "",
  ].join("\n");
}

async function gatherInitInput(log: vscode.LogOutputChannel): Promise<InitInput | undefined> {
  log.info("Showing working title input box...");
  const workingTitle = await vscode.window.showInputBox({
    title: "LeanQuill Initialize",
    prompt: "Working title",
    ignoreFocusOut: true,
    validateInput: (value) => (value.trim() ? null : "Working title is required."),
  });
  if (!workingTitle) {
    return undefined;
  }

  const defaultProjectId = toKebabCase(workingTitle);
  const projectId = await vscode.window.showInputBox({
    title: "LeanQuill Initialize",
    prompt: "Project ID (kebab-case)",
    value: defaultProjectId,
    ignoreFocusOut: true,
    validateInput: (value) => (toKebabCase(value) ? null : "Project ID is required."),
  });
  if (!projectId) {
    return undefined;
  }

  const genreInput = await vscode.window.showInputBox({
    title: "LeanQuill Initialize",
    prompt: "Genres (comma separated)",
    value: "fiction",
    ignoreFocusOut: true,
    validateInput: (value) => (value.trim() ? null : "At least one genre is required."),
  });
  if (!genreInput) {
    return undefined;
  }

  const targetAudience = await vscode.window.showInputBox({
    title: "LeanQuill Initialize",
    prompt: "Target audience",
    ignoreFocusOut: true,
    validateInput: (value) => (value.trim() ? null : "Target audience is required."),
  });
  if (!targetAudience) {
    return undefined;
  }

  return {
    projectId: toKebabCase(projectId),
    workingTitle: workingTitle.trim(),
    genre: genreInput.split(",").map((value) => value.trim()).filter(Boolean),
    targetAudience: targetAudience.trim(),
  };
}

async function ensureOverwriteIfNeeded(rootPath: string): Promise<boolean> {
  const projectYamlPath = path.join(rootPath, "project.yaml");
  const leanquillPath = path.join(rootPath, ".leanquill");

  const hasProjectYaml = await fs.stat(projectYamlPath).then(() => true).catch(() => false);
  const hasLeanquill = await fs.stat(leanquillPath).then(() => true).catch(() => false);

  if (!hasProjectYaml && !hasLeanquill) {
    return true;
  }

  const choice = await vscode.window.showWarningMessage(
    "LeanQuill project state already exists. Overwrite .leanquill and project.yaml?",
    { modal: true },
    "Overwrite",
    "Cancel",
  );

  return choice === "Overwrite";
}

async function initializeProject(rootPath: string, input: InitInput): Promise<{ warnings: string[] }> {
  const safeFs = new SafeFileSystem(rootPath);

  await fs.mkdir(path.join(rootPath, "manuscript"), { recursive: true });
  await safeFs.mkdir(path.join(rootPath, ".leanquill"));
  await safeFs.mkdir(path.join(rootPath, ".leanquill", "chats"));
  await safeFs.mkdir(path.join(rootPath, ".leanquill", "personas"));

  const projectYaml = renderProjectYaml(input);
  await safeFs.writeFile(path.join(rootPath, "project.yaml"), projectYaml);

  const chapterOrder = await resolveChapterOrder(rootPath);
  await safeFs.writeFile(
    path.join(rootPath, ".leanquill", "chapter-order.json"),
    JSON.stringify(chapterOrder, null, 2),
  );

  return { warnings: chapterOrder.warnings };
}

export async function runInitializeFlow(context: vscode.ExtensionContext, log?: vscode.LogOutputChannel): Promise<void> {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) {
    await vscode.window.showErrorMessage("Open a workspace folder before running LeanQuill initialize.");
    return;
  }

  const rootPath = folder.uri.fsPath;
  log?.info(`Root path: ${rootPath}`);

  const shouldContinue = await ensureOverwriteIfNeeded(rootPath);
  if (!shouldContinue) {
    log?.info("User cancelled overwrite prompt");
    return;
  }
  log?.info("Overwrite check passed, gathering input...");

  const input = await gatherInitInput(log ?? vscode.window.createOutputChannel("LeanQuill", { log: true }));
  if (!input) {
    log?.info("User cancelled input gathering");
    return;
  }

  try {
    const result = await initializeProject(rootPath, input);

    await context.workspaceState.update("leanquill.initPromptDismissed", false);

    if (result.warnings.length > 0) {
      await vscode.window.showWarningMessage(`LeanQuill initialized with ${result.warnings.length} warning(s).`);
      const output = vscode.window.createOutputChannel("LeanQuill");
      output.appendLine("Chapter-order warnings:");
      for (const warning of result.warnings) {
        output.appendLine(`- ${warning}`);
      }
      output.show(true);
    } else {
      await vscode.window.showInformationMessage("LeanQuill initialized successfully.");
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await vscode.window.showErrorMessage(`LeanQuill initialization failed: ${message}`);
  }
}

export function shouldPromptInitialize(folderPath: string): Promise<boolean> {
  const hasBookTxt = fs.stat(path.join(folderPath, "Book.txt")).then(() => true).catch(() => false);
  const hasManuscript = fs.stat(path.join(folderPath, "manuscript")).then(() => true).catch(() => false);
  const hasLeanquill = fs.stat(path.join(folderPath, ".leanquill")).then(() => true).catch(() => false);

  return Promise.all([hasBookTxt, hasManuscript, hasLeanquill]).then(([book, manuscript, initialized]) => {
    return !initialized && (book || manuscript);
  });
}
