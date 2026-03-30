import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as vscode from "vscode";
import { LeanQuillActionsProvider } from "./actionsView";
import { getChapterStatusEntry, readChapterStatusIndex, writeChapterStatusEntry } from "./chapterStatus";
import { ChapterContextPaneProvider } from "./chapterContextPane";
import { resolveChapterOrder } from "./chapterOrder";
import { ChapterTreeProvider, isStatusTrackableTreeNode } from "./chapterTree";
import { runInitializeFlow, shouldPromptInitialize } from "./initialize";
import { SafeFileSystem } from "./safeFileSystem";
import { ChapterOrderResult, ChapterStatus } from "./types";

async function setWorkspaceContext(rootPath: string): Promise<void> {
  const hasBookTxt = await fs.stat(path.join(rootPath, "Book.txt")).then(() => true).catch(() => false);
  const hasManuscript = await fs.stat(path.join(rootPath, "manuscript")).then(() => true).catch(() => false);
  const hasLeanquill = await fs.stat(path.join(rootPath, ".leanquill", "project.yaml")).then(() => true).catch(() => false);

  await vscode.commands.executeCommand("setContext", "leanquill.hasManuscriptMarkers", hasBookTxt || hasManuscript);
  await vscode.commands.executeCommand("setContext", "leanquill.isInitialized", hasLeanquill);
}

const log = vscode.window.createOutputChannel("LeanQuill", { log: true });

const STATUS_CHOICES: Array<{ status: ChapterStatus; icon: string }> = [
  { status: "planning", icon: "circle-outline" },
  { status: "not-started", icon: "dash" },
  { status: "drafting", icon: "edit" },
  { status: "draft-complete", icon: "pass" },
  { status: "editing", icon: "pencil" },
  { status: "review-pending", icon: "clock" },
  { status: "final", icon: "verified" },
];

const DOUBLE_CLICK_WINDOW_MS = 450;

function normalizePath(value: string): string {
  return value.split("\\").join("/");
}

async function readChapterOrderState(rootPath: string): Promise<ChapterOrderResult> {
  const chapterOrderPath = path.join(rootPath, ".leanquill", "chapter-order.json");
  try {
    const raw = await fs.readFile(chapterOrderPath, "utf8");
    const parsed = JSON.parse(raw) as ChapterOrderResult;
    if (Array.isArray(parsed.chapterPaths) && Array.isArray(parsed.warnings) && parsed.source) {
      return {
        chapterPaths: parsed.chapterPaths.map(normalizePath),
        warnings: parsed.warnings,
        source: parsed.source,
      };
    }
  } catch {
    // Fall through to fresh resolution when project state is missing or malformed.
  }

  return resolveChapterOrder(rootPath);
}

async function listManuscriptPaths(rootPath: string): Promise<string[]> {
  const files = await vscode.workspace.findFiles("manuscript/**/*.md");
  const rootWithSlash = normalizePath(rootPath).replace(/\/+$/, "") + "/";

  return files
    .map((file) => normalizePath(file.fsPath))
    .filter((absolutePath) => absolutePath.startsWith(rootWithSlash))
    .map((absolutePath) => absolutePath.slice(rootWithSlash.length));
}

function getRelativeChapterPath(rootPath: string, absoluteFilePath: string): string | undefined {
  const relativePath = normalizePath(path.relative(rootPath, absoluteFilePath));
  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    return undefined;
  }

  return relativePath;
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  log.info("Extension activating...");
  log.show(true);

  const initializeCommand = vscode.commands.registerCommand("leanquill.initialize", async () => {
    console.log("[LeanQuill] Initialize command fired");
    log.info("Initialize command fired");
    try {
      await runInitializeFlow(context, log);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log.error(`Initialize command error: ${message}`);
      await vscode.window.showErrorMessage(`LeanQuill initialization failed: ${message}`);
    }
    // Refresh context after init attempt
    const rootPath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (rootPath) {
      await setWorkspaceContext(rootPath);
    }
  });

  context.subscriptions.push(initializeCommand);

  const rootPath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!rootPath) {
    log.info("No workspace folder — activation complete");
    return;
  }

  const safeFileSystem = new SafeFileSystem(rootPath);
  const setupViewProvider = new LeanQuillActionsProvider();
  const chapterTreeProvider = new ChapterTreeProvider(vscode, rootPath);
  const chapterContextProvider = new ChapterContextPaneProvider(vscode);
  let knownChapterPaths = new Set<string>();
  let statusIndex = await readChapterStatusIndex(rootPath, (warning) => log.warn(warning));

  const chaptersView = vscode.window.createTreeView("leanquill.chapters", {
    treeDataProvider: chapterTreeProvider,
  });

  context.subscriptions.push(
    vscode.window.registerTreeDataProvider("leanquill.actions", setupViewProvider),
    chaptersView,
    vscode.window.registerWebviewViewProvider("leanquill.chapterContext", chapterContextProvider, {
      webviewOptions: { retainContextWhenHidden: true },
    }),
  );

  const refreshChapterViews = async (): Promise<void> => {
    const chapterOrder = await readChapterOrderState(rootPath);
    statusIndex = await readChapterStatusIndex(rootPath, (warning) => log.warn(warning));
    const manuscriptPaths = await listManuscriptPaths(rootPath);
    const hasBookTxt = await fs.stat(path.join(rootPath, "Book.txt")).then(() => true).catch(() => false);

    chapterTreeProvider.setData(chapterOrder.chapterPaths, manuscriptPaths, statusIndex, hasBookTxt);
    knownChapterPaths = chapterTreeProvider.getKnownChapterPaths();

    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor) {
      return;
    }

    const chapterPath = getRelativeChapterPath(rootPath, activeEditor.document.uri.fsPath);
    if (chapterPath && knownChapterPaths.has(chapterPath)) {
      chapterContextProvider.setActiveChapter(chapterPath, getChapterStatusEntry(statusIndex, chapterPath));
      return;
    }

    chapterContextProvider.retainLastKnownContext();
  };

  const updateChapterStatus = async (chapterPath: string): Promise<void> => {
    const selected = await vscode.window.showQuickPick(
      STATUS_CHOICES.map(({ status, icon }) => ({
        label: `$(${icon}) ${status}`,
        description: status,
      })),
      {
        placeHolder: "Select chapter status",
      },
    );

    if (!selected?.description) {
      return;
    }

    statusIndex = await writeChapterStatusEntry(safeFileSystem, rootPath, chapterPath, selected.description as ChapterStatus);
    await refreshChapterViews();
    chapterContextProvider.refreshAfterStatusUpdate(getChapterStatusEntry(statusIndex, chapterPath));
  };

  let lastOpened: { chapterPath: string; openedAt: number } | undefined;
  const openChapter = async (chapterPath: string): Promise<void> => {
    const absolutePath = path.join(rootPath, ...chapterPath.split("/"));
    const now = Date.now();
    const isDoubleClick = Boolean(
      lastOpened
      && lastOpened.chapterPath === chapterPath
      && now - lastOpened.openedAt <= DOUBLE_CLICK_WINDOW_MS,
    );

    lastOpened = { chapterPath, openedAt: now };
    await vscode.window.showTextDocument(vscode.Uri.file(absolutePath), {
      preview: !isDoubleClick,
      preserveFocus: false,
    });
  };

  const updateChapterStatusCommand = vscode.commands.registerCommand("leanquill.updateChapterStatus", async (item?: unknown) => {
    const chapterPath = isStatusTrackableTreeNode(item) && !item.missing
      ? item.chapterPath
      : chapterContextProvider.getCurrentChapterPath();

    if (!chapterPath) {
      await vscode.window.showInformationMessage("Open a chapter first, then run Update Chapter Status.");
      return;
    }

    await updateChapterStatus(chapterPath);
  });

  const openChapterCommand = vscode.commands.registerCommand("leanquill.openChapter", async (chapterPath: string) => {
    await openChapter(chapterPath);
  });

  const chapterSelectionSubscription = chaptersView.onDidChangeSelection(async (event) => {
    const selected = event.selection[0];
    if (!isStatusTrackableTreeNode(selected) || selected.missing) {
      return;
    }

    chapterContextProvider.setActiveChapter(selected.chapterPath, getChapterStatusEntry(statusIndex, selected.chapterPath));
    if (selected.kind === "book") {
      await openChapter(selected.chapterPath);
    }
  });

  const activeEditorSubscription = vscode.window.onDidChangeActiveTextEditor((editor) => {
    if (!editor) {
      return;
    }

    const chapterPath = getRelativeChapterPath(rootPath, editor.document.uri.fsPath);
    if (chapterPath && knownChapterPaths.has(chapterPath)) {
      chapterContextProvider.setActiveChapter(chapterPath, getChapterStatusEntry(statusIndex, chapterPath));
      return;
    }

    chapterContextProvider.retainLastKnownContext();
  });

  const chapterOrderWatcher = vscode.workspace.createFileSystemWatcher("**/.leanquill/chapter-order.json");
  const chapterStatusWatcher = vscode.workspace.createFileSystemWatcher("**/.leanquill/chapter-status-index.json");
  const manuscriptWatcher = vscode.workspace.createFileSystemWatcher("**/manuscript/**/*.md");
  const triggerRefresh = () => {
    void refreshChapterViews();
  };

  chapterOrderWatcher.onDidCreate(triggerRefresh);
  chapterOrderWatcher.onDidChange(triggerRefresh);
  chapterOrderWatcher.onDidDelete(triggerRefresh);
  chapterStatusWatcher.onDidCreate(triggerRefresh);
  chapterStatusWatcher.onDidChange(triggerRefresh);
  chapterStatusWatcher.onDidDelete(triggerRefresh);
  manuscriptWatcher.onDidCreate(triggerRefresh);
  manuscriptWatcher.onDidChange(triggerRefresh);
  manuscriptWatcher.onDidDelete(triggerRefresh);

  context.subscriptions.push(
    openChapterCommand,
    updateChapterStatusCommand,
    chapterSelectionSubscription,
    activeEditorSubscription,
    chapterOrderWatcher,
    chapterStatusWatcher,
    manuscriptWatcher,
  );

  await setWorkspaceContext(rootPath);
  await refreshChapterViews();
  log.info("Activation complete — command ready");

  // Proactive init prompt (non-blocking — don't hold up activation)
  scheduleInitPrompt(context, rootPath);
}

async function scheduleInitPrompt(context: vscode.ExtensionContext, rootPath: string): Promise<void> {
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
