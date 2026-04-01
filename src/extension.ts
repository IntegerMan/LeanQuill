import * as crypto from "node:crypto";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as vscode from "vscode";
import { LeanQuillActionsProvider } from "./actionsView";
import { openBeatInEditor, syncBeatFromFile } from "./beatEditor";
import { generateBeatFileName, collectExistingBeatSlugs, writeBeatFile, deleteBeatFile, renameBeatFile, readBeatFile } from "./beatManuscriptSync";
import { generateBookTxt, writeBookTxt, detectExternalBookTxtEdit } from "./bookTxtSync";
import { resolveChapterOrder } from "./chapterOrder";
import { OutlineContextPaneProvider, buildBookContext, buildPartContext, buildChapterContext, buildBeatContext } from "./outlineContextPane";
import { runInitializeFlow, shouldPromptInitialize } from "./initialize";
import { readOutlineIndex, writeOutlineIndex, bootstrapOutline } from "./outlineStore";
import { OutlineTreeProvider, OutlineTreeNode, OutlineOrphanNode } from "./outlineTree";
import { PlanningPanelProvider } from "./planningPanel";
import { SafeFileSystem } from "./safeFileSystem";
import { ChapterOrderResult, ChapterStatus, OutlineChapter, OutlineIndex, OutlinePart, OutlineBeat } from "./types";

async function setWorkspaceContext(rootPath: string): Promise<void> {
  const hasBookTxt = await fs.stat(path.join(rootPath, "manuscript", "Book.txt")).then(() => true).catch(() => false);
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
  const outlineContextProvider = new OutlineContextPaneProvider(vscode);

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
    outlineTreeView,
    vscode.window.registerWebviewViewProvider("leanquill.chapterContext", outlineContextProvider, {
      webviewOptions: { retainContextWhenHidden: true },
    }),
  );

  const updateOutlineChapterStatus = async (chapterId: string): Promise<void> => {
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

    const newStatus = selected.description as ChapterStatus;
    const index = await readOutlineIndex(rootPath);
    for (const part of index.parts) {
      const chapter = part.chapters.find((c: OutlineChapter) => c.id === chapterId);
      if (chapter) {
        chapter.status = newStatus;
        break;
      }
    }
    await writeOutlineIndex(rootPath, index, safeFileSystem);
    await outlineTreeProvider.reloadIndex();
  };

  let lastOpened: { chapterPath: string; openedAt: number } | undefined;
  const openChapter = async (chapterPath: string): Promise<void> => {
    if (chapterPath === "manuscript/Book.txt") {
      const bookPath = path.join(rootPath, "manuscript", "Book.txt");
      const exists = await fs.stat(bookPath).then(() => true).catch(() => false);
      if (!exists) {
        const chapterOrder = await readChapterOrderState(rootPath);
        const content = chapterOrder.chapterPaths.map(p => p.replace(/^manuscript\//, "")).join("\n");
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

  // --- Outline Status Command ---
  const updateOutlineChapterStatusCommand = vscode.commands.registerCommand("leanquill.updateOutlineChapterStatus", async (node?: OutlineTreeNode) => {
    let chapterId: string | undefined;
    if (node && node.kind === "chapter") {
      chapterId = node.data.id;
    } else {
      // Try to get from current outline tree selection
      const selection = outlineTreeView.selection;
      const chapterNode = selection.find((n) => n.kind === "chapter");
      if (chapterNode && chapterNode.kind === "chapter") {
        chapterId = chapterNode.data.id;
      }
    }

    if (!chapterId) {
      await vscode.window.showInformationMessage("Select a chapter in the Outline first.");
      return;
    }

    await updateOutlineChapterStatus(chapterId);
  });

  const addOrphanToOutlineCommand = vscode.commands.registerCommand("leanquill.addOrphanToOutline", async (node?: OutlineTreeNode) => {
    if (!node || node.kind !== "orphan") {
      return;
    }
    const fileName = (node as OutlineOrphanNode).data.fileName;
    const baseName = path.basename(fileName, path.extname(fileName));
    const name = baseName.replaceAll(/[-_]+/g, " ").trim().replaceAll(/\b\w/g, (c) => c.toUpperCase()) || baseName;

    const index = await readOutlineIndex(rootPath);
    const targetPart = index.parts[0];
    if (!targetPart) {
      await vscode.window.showWarningMessage("Create a Part first before adding chapters.");
      return;
    }

    targetPart.chapters.push({
      id: crypto.randomUUID(),
      name,
      fileName,
      active: true,
      status: "not-started",
      beats: [],
    });

    await writeOutlineIndex(rootPath, index, safeFileSystem);
    await outlineTreeProvider.reloadIndex();
    await syncBookTxt();
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

  const openBeatInEditorCommand = vscode.commands.registerCommand("leanquill.openBeatInEditor", async (arg?: OutlineTreeNode | string) => {
    const beatId = typeof arg === "string" ? arg : (arg && arg.kind === "beat" ? arg.data.id : undefined);
    if (!beatId) {
      return;
    }
    await openBeatInEditor(vscode, rootPath, beatId, safeFileSystem);
  });

  const openBookTxtCommand = vscode.commands.registerCommand("leanquill.openBookTxt", async () => {
    await openChapter("manuscript/Book.txt");
  });

  const openChapterFromOutlineCommand = vscode.commands.registerCommand("leanquill.openChapterFromOutline", async (node?: OutlineTreeNode) => {
    if (!node || node.kind !== "chapter" || !node.data.fileName) {
      return;
    }
    const absolutePath = path.join(rootPath, node.data.fileName);
    await vscode.window.showTextDocument(vscode.Uri.file(absolutePath), {
      preview: false,
      preserveFocus: false,
    });
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
    part.chapters.push({ id: crypto.randomUUID(), name, fileName: "", active: true, status: "not-started", beats: [] });
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
      fileName: "",
      active: true,
      description: "",
      customFields: {},
    });
    // Assign slug-based fileName and create manuscript beat file
    const newBeat = chapter.beats[chapter.beats.length - 1];
    const existingSlugs = collectExistingBeatSlugs(index.parts);
    newBeat.fileName = generateBeatFileName(title, existingSlugs);
    await writeBeatFile(rootPath, newBeat.fileName, newBeat.description);
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
      `Permanently remove "${label}"? This cannot be undone (use git to recover).`,
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
      // Delete beat file from manuscript/beats/
      const beat = (node.data as OutlineBeat);
      if (beat.fileName) {
        await deleteBeatFile(rootPath, beat.fileName);
      }
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
            // Rename the manuscript beat file to match new slug
            if (beat.fileName) {
              const existingSlugs = collectExistingBeatSlugs(index.parts);
              existingSlugs.delete(beat.fileName);
              const newFileName = generateBeatFileName(newName, existingSlugs);
              const content = await readBeatFile(rootPath, beat.fileName);
              await renameBeatFile(rootPath, beat.fileName, newFileName, content);
              beat.fileName = newFileName;
            }
            break;
          }
        }
      }
    }
    await writeOutlineIndex(rootPath, index, safeFileSystem);
    await outlineTreeProvider.reloadIndex();
    await syncBookTxt();
  });

  // --- Outline tree → Context pane wiring ---
  const outlineSelectionSubscription = outlineTreeView.onDidChangeSelection(async (event) => {
    const selected = event.selection[0];
    if (!selected) {
      outlineContextProvider.clearContext();
      return;
    }

    const index = outlineTreeProvider.getIndex();

    switch (selected.kind) {
      case "part":
        outlineContextProvider.setContext(buildPartContext(selected.data));
        break;
      case "chapter":
        outlineContextProvider.setContext(buildChapterContext(selected.data));
        break;
      case "beat":
        outlineContextProvider.setContext(buildBeatContext(selected.data));
        break;
      case "orphanGroup":
        if (index) {
          outlineContextProvider.setContext(buildBookContext(index));
        }
        break;
      case "orphan":
        outlineContextProvider.clearContext();
        break;
    }
  });

  // --- File Watchers ---
  const outlineWatcher = vscode.workspace.createFileSystemWatcher("**/.leanquill/outline-index.json");
  const beatFileWatcher = vscode.workspace.createFileSystemWatcher("**/manuscript/beats/*.md");
  const bookTxtWatcher = vscode.workspace.createFileSystemWatcher("**/manuscript/Book.txt");
  const manuscriptWatcher = vscode.workspace.createFileSystemWatcher("**/manuscript/**/*.md");

  // Manuscript file changes trigger outline tree refresh (for Not Included group)
  const triggerOutlineRefresh = () => {
    void outlineTreeProvider.reloadIndex();
  };
  manuscriptWatcher.onDidCreate(triggerOutlineRefresh);
  manuscriptWatcher.onDidDelete(triggerOutlineRefresh);

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
    updateOutlineChapterStatusCommand,
    addOrphanToOutlineCommand,
    openPlanningWorkspaceCommand,
    createOutlineCommand,
    openBeatInEditorCommand,
    openBookTxtCommand,
    openChapterFromOutlineCommand,
    addOutlinePartCommand,
    addOutlineChapterCommand,
    addOutlineBeatCommand,
    removeOutlineNodeCommand,
    toggleOutlineActiveCommand,
    renameOutlineNodeCommand,
    outlineSelectionSubscription,
    outlineWatcher,
    beatFileWatcher,
    bookTxtWatcher,
    manuscriptWatcher,
  );

  await setWorkspaceContext(rootPath);

  // Auto-bootstrap outline from Book.txt when project is initialized but outline is empty
  try {
    const hasProject = await fs.stat(path.join(rootPath, ".leanquill", "project.yaml")).then(() => true).catch(() => false);
    if (hasProject) {
      const existingIndex = await readOutlineIndex(rootPath);
      if (existingIndex.parts.length === 0) {
        const chapterOrder = await readChapterOrderState(rootPath);
        if (chapterOrder.chapterPaths.length > 0) {
          const index = bootstrapOutline(chapterOrder.chapterPaths);
          await writeOutlineIndex(rootPath, index, safeFileSystem);
          await outlineTreeProvider.reloadIndex();
          await syncBookTxt();
          log.info("Auto-bootstrapped outline from Book.txt");
        }
      }
    }
  } catch {
    // Non-critical — user can still manually Create Outline
  }

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
