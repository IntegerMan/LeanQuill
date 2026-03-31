import * as crypto from "node:crypto";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as vscode from "vscode";
import { LeanQuillActionsProvider } from "./actionsView";
import { openBeatInEditor, syncBeatFromFile } from "./beatEditor";
import { generateBookTxt, writeBookTxt, detectExternalBookTxtEdit } from "./bookTxtSync";
import { getChapterStatusEntry, readChapterStatusIndex, writeChapterStatusEntry } from "./chapterStatus";
import { ChapterContextPaneProvider } from "./chapterContextPane";
import { resolveChapterOrder } from "./chapterOrder";
import { ChapterTreeProvider, resolveStatusTarget } from "./chapterTree";
import { runInitializeFlow, shouldPromptInitialize } from "./initialize";
import { readOutlineIndex, writeOutlineIndex, bootstrapOutline } from "./outlineStore";
import { OutlineTreeProvider, OutlineTreeNode } from "./outlineTree";
import { PlanningPanelProvider } from "./planningPanel";
import { SafeFileSystem } from "./safeFileSystem";
import { ChapterOrderResult, ChapterStatus, OutlineChapter, OutlinePart, OutlineBeat } from "./types";

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

  // --- Outline Tree & Planning Panel ---
  const outlineTreeProvider = new OutlineTreeProvider(vscode, rootPath, safeFileSystem);
  const outlineTreeView = vscode.window.createTreeView("leanquill.outlineTree", {
    treeDataProvider: outlineTreeProvider,
    dragAndDropController: outlineTreeProvider.getDragDropController(),
    showCollapseAll: true,
    canSelectMany: true,
  });

  const planningPanel = new PlanningPanelProvider(vscode, context.extensionUri, rootPath, safeFileSystem);

  // Flag to prevent Book.txt write-loop
  let _selfEditingBookTxt = false;

  const syncBookTxt = async (): Promise<void> => {
    try {
      const index = await readOutlineIndex(rootPath);
      const content = generateBookTxt(index);
      _selfEditingBookTxt = true;
      await writeBookTxt(rootPath, content);
      _selfEditingBookTxt = false;
    } catch {
      _selfEditingBookTxt = false;
    }
  };

  context.subscriptions.push(
    vscode.window.registerTreeDataProvider("leanquill.actions", setupViewProvider),
    chaptersView,
    outlineTreeView,
    vscode.window.registerWebviewViewProvider("leanquill.chapterContext", chapterContextProvider, {
      webviewOptions: { retainContextWhenHidden: true },
    }),
  );

  const refreshChapterViews = async (): Promise<void> => {
    const chapterOrder = await readChapterOrderState(rootPath);
    statusIndex = await readChapterStatusIndex(rootPath, (warning) => log.warn(warning));
    const manuscriptPaths = await listManuscriptPaths(rootPath);

    chapterTreeProvider.setData(chapterOrder.chapterPaths, manuscriptPaths, statusIndex);
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
    if (chapterPath === "Book.txt") {
      const bookPath = path.join(rootPath, "Book.txt");
      const exists = await fs.stat(bookPath).then(() => true).catch(() => false);
      if (!exists) {
        const chapterOrder = await readChapterOrderState(rootPath);
        const content = chapterOrder.chapterPaths.join("\n");
        await fs.writeFile(bookPath, content.length > 0 ? `${content}\n` : "", "utf8");
      }
    }

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

  // --- Chapter Commands ---
  const updateChapterStatusCommand = vscode.commands.registerCommand("leanquill.updateChapterStatus", async (item?: unknown) => {
    const target = resolveStatusTarget(item);
    const chapterPath = target && !target.missing
      ? target.chapterPath
      : chapterContextProvider.getCurrentChapterPath();

    if (!chapterPath) {
      await vscode.window.showInformationMessage("Open an item first, then run Update Status.");
      return;
    }

    await updateChapterStatus(chapterPath);
  });

  const openChapterCommand = vscode.commands.registerCommand("leanquill.openChapter", async (chapterPath: string) => {
    await openChapter(chapterPath);
  });

  // --- Outline Commands ---
  const openPlanningWorkspaceCommand = vscode.commands.registerCommand("leanquill.openPlanningWorkspace", async () => {
    await planningPanel.show();
  });

  const createOutlineCommand = vscode.commands.registerCommand("leanquill.createOutline", async () => {
    const chapterOrder = await readChapterOrderState(rootPath);
    const index = bootstrapOutline(chapterOrder.chapterPaths);
    await writeOutlineIndex(rootPath, index, safeFileSystem);
    await outlineTreeProvider.reloadIndex();
    await syncBookTxt();
    log.info("Outline created from chapter order");
  });

  const openBeatInEditorCommand = vscode.commands.registerCommand("leanquill.openBeatInEditor", async (beatId: string) => {
    if (!beatId) {
      return;
    }
    await openBeatInEditor(vscode, rootPath, beatId, safeFileSystem);
  });

  const addOutlinePartCommand = vscode.commands.registerCommand("leanquill.addOutlinePart", async () => {
    const name = await vscode.window.showInputBox({ prompt: "Part name", placeHolder: "Part I" });
    if (!name) {
      return;
    }
    const index = await readOutlineIndex(rootPath);
    index.parts.push({ id: crypto.randomUUID(), name, active: true, chapters: [] });
    await writeOutlineIndex(rootPath, index, safeFileSystem);
    await outlineTreeProvider.reloadIndex();
    await syncBookTxt();
  });

  const addOutlineChapterCommand = vscode.commands.registerCommand("leanquill.addOutlineChapter", async (node?: OutlineTreeNode) => {
    const name = await vscode.window.showInputBox({ prompt: "Chapter name", placeHolder: "Chapter 1" });
    if (!name) {
      return;
    }
    const index = await readOutlineIndex(rootPath);
    const parentPartId = node && node.kind === "part" ? node.data.id : index.parts[0]?.id;
    const part = index.parts.find((p: OutlinePart) => p.id === parentPartId);
    if (!part) {
      await vscode.window.showWarningMessage("No part found to add chapter to.");
      return;
    }
    part.chapters.push({ id: crypto.randomUUID(), name, fileName: "", active: true, beats: [] });
    await writeOutlineIndex(rootPath, index, safeFileSystem);
    await outlineTreeProvider.reloadIndex();
    await syncBookTxt();
  });

  const addOutlineBeatCommand = vscode.commands.registerCommand("leanquill.addOutlineBeat", async (node?: OutlineTreeNode) => {
    const title = await vscode.window.showInputBox({ prompt: "Beat title", placeHolder: "Opening scene" });
    if (!title) {
      return;
    }
    const index = await readOutlineIndex(rootPath);
    let chapter: OutlineChapter | undefined;
    if (node && node.kind === "chapter") {
      for (const part of index.parts) {
        chapter = part.chapters.find((c: OutlineChapter) => c.id === node.data.id);
        if (chapter) {
          break;
        }
      }
    }
    if (!chapter) {
      await vscode.window.showWarningMessage("Select a chapter first.");
      return;
    }
    chapter.beats.push({
      id: crypto.randomUUID(),
      title,
      active: true,
      description: "",
      what: "",
      who: "",
      where: "",
      why: "",
      customFields: {},
    });
    await writeOutlineIndex(rootPath, index, safeFileSystem);
    await outlineTreeProvider.reloadIndex();
    await syncBookTxt();
  });

  const removeOutlineNodeCommand = vscode.commands.registerCommand("leanquill.removeOutlineNode", async (node?: OutlineTreeNode) => {
    if (!node) {
      return;
    }
    const label = node.kind === "beat" ? node.data.title : (node.data as OutlinePart | OutlineChapter).name;
    const confirm = await vscode.window.showWarningMessage(
      `Remove "${label}" from the outline?`,
      { modal: true },
      "Remove",
    );
    if (confirm !== "Remove") {
      return;
    }
    const index = await readOutlineIndex(rootPath);
    if (node.kind === "part") {
      index.parts = index.parts.filter((p: OutlinePart) => p.id !== node.data.id);
    } else if (node.kind === "chapter") {
      for (const part of index.parts) {
        part.chapters = part.chapters.filter((c: OutlineChapter) => c.id !== node.data.id);
      }
    } else {
      for (const part of index.parts) {
        for (const chapter of part.chapters) {
          chapter.beats = chapter.beats.filter((b: OutlineBeat) => b.id !== node.data.id);
        }
      }
    }
    await writeOutlineIndex(rootPath, index, safeFileSystem);
    await outlineTreeProvider.reloadIndex();
    await syncBookTxt();
  });

  const toggleOutlineActiveCommand = vscode.commands.registerCommand("leanquill.toggleOutlineActive", async (node?: OutlineTreeNode) => {
    if (!node) {
      return;
    }
    const index = await readOutlineIndex(rootPath);
    if (node.kind === "part") {
      const part = index.parts.find((p: OutlinePart) => p.id === node.data.id);
      if (part) {
        part.active = !part.active;
      }
    } else if (node.kind === "chapter") {
      for (const part of index.parts) {
        const chapter = part.chapters.find((c: OutlineChapter) => c.id === node.data.id);
        if (chapter) {
          chapter.active = !chapter.active;
          break;
        }
      }
    } else {
      for (const part of index.parts) {
        for (const chapter of part.chapters) {
          const beat = chapter.beats.find((b: OutlineBeat) => b.id === node.data.id);
          if (beat) {
            beat.active = !beat.active;
            break;
          }
        }
      }
    }
    await writeOutlineIndex(rootPath, index, safeFileSystem);
    await outlineTreeProvider.reloadIndex();
    await syncBookTxt();
  });

  const renameOutlineNodeCommand = vscode.commands.registerCommand("leanquill.renameOutlineNode", async (node?: OutlineTreeNode) => {
    if (!node) {
      return;
    }
    const currentName = node.kind === "beat" ? node.data.title : (node.data as OutlinePart | OutlineChapter).name;
    const newName = await vscode.window.showInputBox({ prompt: "New name", value: currentName });
    if (!newName) {
      return;
    }
    const index = await readOutlineIndex(rootPath);
    if (node.kind === "part") {
      const part = index.parts.find((p: OutlinePart) => p.id === node.data.id);
      if (part) {
        part.name = newName;
      }
    } else if (node.kind === "chapter") {
      for (const part of index.parts) {
        const chapter = part.chapters.find((c: OutlineChapter) => c.id === node.data.id);
        if (chapter) {
          chapter.name = newName;
          break;
        }
      }
    } else {
      for (const part of index.parts) {
        for (const chapter of part.chapters) {
          const beat = chapter.beats.find((b: OutlineBeat) => b.id === node.data.id);
          if (beat) {
            beat.title = newName;
            break;
          }
        }
      }
    }
    await writeOutlineIndex(rootPath, index, safeFileSystem);
    await outlineTreeProvider.reloadIndex();
    await syncBookTxt();
  });

  // --- Chapter tree interaction ---
  const chapterSelectionSubscription = chaptersView.onDidChangeSelection(async (event) => {
    const selected = resolveStatusTarget(event.selection[0]);
    if (!selected || selected.missing) {
      return;
    }

    chapterContextProvider.setActiveChapter(selected.chapterPath, getChapterStatusEntry(statusIndex, selected.chapterPath));
    if (selected.kind === "book") {
      await openChapter(selected.chapterPath);
    }
  });

  const bookElementInteraction = async (element: unknown): Promise<void> => {
    const target = resolveStatusTarget(element);
    if (!target || target.kind !== "book" || target.missing) {
      return;
    }

    chapterContextProvider.setActiveChapter(target.chapterPath, getChapterStatusEntry(statusIndex, target.chapterPath));
    await openChapter(target.chapterPath);
  };

  const chapterExpandSubscription = chaptersView.onDidExpandElement(async (event) => {
    await bookElementInteraction(event.element);
  });

  const chapterCollapseSubscription = chaptersView.onDidCollapseElement(async (event) => {
    await bookElementInteraction(event.element);
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

  // --- File Watchers ---
  const chapterOrderWatcher = vscode.workspace.createFileSystemWatcher("**/.leanquill/chapter-order.json");
  const chapterStatusWatcher = vscode.workspace.createFileSystemWatcher("**/.leanquill/chapter-status-index.json");
  const manuscriptWatcher = vscode.workspace.createFileSystemWatcher("**/manuscript/**/*.md");
  const outlineWatcher = vscode.workspace.createFileSystemWatcher("**/.leanquill/outline-index.json");
  const beatFileWatcher = vscode.workspace.createFileSystemWatcher("**/.leanquill/beats/*.md");
  const bookTxtWatcher = vscode.workspace.createFileSystemWatcher("**/Book.txt");

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

  // Outline index watcher — reload tree + panel + sync Book.txt
  const onOutlineChanged = () => {
    void outlineTreeProvider.reloadIndex();
    planningPanel.refresh();
    void syncBookTxt();
  };
  outlineWatcher.onDidCreate(onOutlineChanged);
  outlineWatcher.onDidChange(onOutlineChanged);
  outlineWatcher.onDidDelete(() => {
    void outlineTreeProvider.reloadIndex();
    planningPanel.refresh();
  });

  // Beat file watcher — sync description back to outline-index.json
  beatFileWatcher.onDidChange((uri) => {
    void syncBeatFromFile(rootPath, uri.fsPath, safeFileSystem);
  });

  // Book.txt watcher — detect external edits
  bookTxtWatcher.onDidChange(async () => {
    if (_selfEditingBookTxt) {
      return;
    }
    try {
      const index = await readOutlineIndex(rootPath);
      const expected = generateBookTxt(index);
      const isExternal = await detectExternalBookTxtEdit(rootPath, expected);
      if (isExternal) {
        const choice = await vscode.window.showWarningMessage(
          "Book.txt was modified outside LeanQuill. The outline may be out of sync.",
          "Use Outline Order",
          "Dismiss",
        );
        if (choice === "Use Outline Order") {
          await syncBookTxt();
        }
      }
    } catch {
      // Ignore if outline doesn't exist yet
    }
  });

  context.subscriptions.push(
    openChapterCommand,
    updateChapterStatusCommand,
    openPlanningWorkspaceCommand,
    createOutlineCommand,
    openBeatInEditorCommand,
    addOutlinePartCommand,
    addOutlineChapterCommand,
    addOutlineBeatCommand,
    removeOutlineNodeCommand,
    toggleOutlineActiveCommand,
    renameOutlineNodeCommand,
    chapterSelectionSubscription,
    chapterExpandSubscription,
    chapterCollapseSubscription,
    activeEditorSubscription,
    chapterOrderWatcher,
    chapterStatusWatcher,
    manuscriptWatcher,
    outlineWatcher,
    beatFileWatcher,
    bookTxtWatcher,
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
