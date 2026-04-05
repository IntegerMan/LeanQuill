import * as crypto from "node:crypto";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as vscode from "vscode";
import { LeanQuillActionsProvider } from "./actionsView";
import { openNodeInEditor, syncNodeFromFile } from "./nodeEditor";
import { generateNodeFileName, collectExistingSlugs, writeNodeFile, deleteNodeFile, renameNodeFile, readNodeFile } from "./manuscriptSync";
import { generateBookTxt, writeBookTxt, detectExternalBookTxtEdit } from "./bookTxtSync";
import { resolveChapterOrder } from "./chapterOrder";
import { OutlineContextPaneProvider, buildBookContext, buildNodeContext } from "./outlineContextPane";
import { runInitializeFlow, shouldPromptInitialize } from "./initialize";
import { readOutlineIndex, writeOutlineIndex, bootstrapOutline, findNodeById, removeNodeById } from "./outlineStore";
import { OutlineTreeProvider, OutlineTreeNode, OutlineOrphanNode, OutlineDataNode } from "./outlineTree";
import { OutlineWebviewProvider } from "./outlineWebviewPanel";
import { PlanningPanelProvider } from "./planningPanel";
import { SafeFileSystem } from "./safeFileSystem";
import { ChapterOrderResult, ChapterStatus, OutlineNode, OutlineIndex } from "./types";

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

  // Webview-based sidebar outline (replaces tree for DnD)
  const outlineWebviewProvider = new OutlineWebviewProvider(
    vscode,
    context.extensionUri,
    rootPath,
    safeFileSystem,
    () => {
      void outlineTreeProvider.reloadIndex();
      planningPanel.refresh();
      void syncBookTxt();
    },
  );

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
    vscode.window.registerWebviewViewProvider("leanquill.outlineTree", outlineWebviewProvider, {
      webviewOptions: { retainContextWhenHidden: true },
    }),
    vscode.window.registerWebviewViewProvider("leanquill.chapterContext", outlineContextProvider, {
      webviewOptions: { retainContextWhenHidden: true },
    }),
  );

  const updateNodeStatus = async (nodeId: string): Promise<void> => {
    const selected = await vscode.window.showQuickPick(
      STATUS_CHOICES.map(({ status, icon }) => ({
        label: `$(${icon}) ${status}`,
        description: status,
      })),
      {
        placeHolder: "Select status",
      },
    );

    if (!selected?.description) {
      return;
    }

    const newStatus = selected.description as ChapterStatus;
    const index = await readOutlineIndex(rootPath);
    const found = findNodeById(index.nodes, nodeId);
    if (found) {
      found.node.status = newStatus;
    }
    await writeOutlineIndex(rootPath, index, safeFileSystem);
    await outlineTreeProvider.reloadIndex();
    await outlineWebviewProvider.refresh();
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

  // Helper: resolve node ID from command argument (tree node, string, or selection)
  const resolveNodeId = (arg?: OutlineTreeNode | string): string | undefined => {
    if (typeof arg === "string") {
      return arg;
    }
    if (arg && typeof arg === "object" && "kind" in arg && arg.kind === "node") {
      return arg.data.id;
    }
    return undefined;
  };

  // --- Outline Status Command ---
  const updateNodeStatusCommand = vscode.commands.registerCommand("leanquill.updateNodeStatus", async (arg?: OutlineTreeNode | string) => {
    const nodeId = resolveNodeId(arg);
    if (!nodeId) {
      await vscode.window.showInformationMessage("Select a node in the Outline first.");
      return;
    }

    await updateNodeStatus(nodeId);
  });

  const addOrphanToOutlineCommand = vscode.commands.registerCommand("leanquill.addOrphanToOutline", async (node?: OutlineTreeNode) => {
    if (!node || node.kind !== "orphan") {
      return;
    }
    const fileName = (node as OutlineOrphanNode).data.fileName;
    const baseName = path.basename(fileName, path.extname(fileName));
    const title = baseName.replaceAll(/[-_]+/g, " ").trim().replaceAll(/\b\w/g, (c) => c.toUpperCase()) || baseName;

    const index = await readOutlineIndex(rootPath);
    const targetNode = index.nodes[0];
    if (!targetNode) {
      await vscode.window.showWarningMessage("Create an outline first before adding items.");
      return;
    }

    targetNode.children.push({
      id: crypto.randomUUID(),
      title,
      fileName,
      active: true,
      status: "not-started",
      description: "",
      customFields: {},
      traits: [],
      children: [],
    });

    await writeOutlineIndex(rootPath, index, safeFileSystem);
    await outlineTreeProvider.reloadIndex();
    await outlineWebviewProvider.refresh();
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
    await outlineWebviewProvider.refresh();
    await syncBookTxt();
    log.info("Outline created from chapter order");
  });

  const openNodeInEditorCommand = vscode.commands.registerCommand("leanquill.openNodeInEditor", async (arg?: OutlineTreeNode | string) => {
    const nodeId = typeof arg === "string" ? arg : (arg && arg.kind === "node" ? arg.data.id : undefined);
    if (!nodeId) {
      return;
    }
    await openNodeInEditor(vscode, rootPath, nodeId, safeFileSystem);
  });

  const openBookTxtCommand = vscode.commands.registerCommand("leanquill.openBookTxt", async () => {
    await openChapter("manuscript/Book.txt");
  });

  const openChapterFromOutlineCommand = vscode.commands.registerCommand("leanquill.openChapterFromOutline", async (arg?: OutlineTreeNode | string) => {
    let fileName: string | undefined;
    if (typeof arg === "string") {
      const index = await readOutlineIndex(rootPath);
      const found = findNodeById(index.nodes, arg);
      fileName = found?.node.fileName;
    } else if (arg && arg.kind === "node" && arg.data.fileName) {
      fileName = arg.data.fileName;
    }
    if (!fileName) {
      return;
    }
    const absolutePath = path.join(rootPath, fileName);
    await vscode.window.showTextDocument(vscode.Uri.file(absolutePath), {
      preview: false,
      preserveFocus: false,
    });
  });

  const addChildNodeCommand = vscode.commands.registerCommand("leanquill.addChildNode", async (arg?: OutlineTreeNode | string) => {
    const title = await vscode.window.showInputBox({ prompt: "Title", placeHolder: "New item" });
    if (!title) {
      return;
    }
    const index = await readOutlineIndex(rootPath);
    const parentId = resolveNodeId(arg);

    const newNode: OutlineNode = {
      id: crypto.randomUUID(),
      title,
      fileName: "",
      active: true,
      status: "not-started",
      description: "",
      customFields: {},
      traits: [],
      children: [],
    };

    if (parentId) {
      const found = findNodeById(index.nodes, parentId);
      if (found) {
        found.node.children.push(newNode);
      }
    } else {
      // No selection — add as top-level node with "part" trait
      newNode.traits = ["part"];
      index.nodes.push(newNode);
    }

    await writeOutlineIndex(rootPath, index, safeFileSystem);
    await outlineTreeProvider.reloadIndex();
    await outlineWebviewProvider.refresh();
    await syncBookTxt();
  });

  const addSiblingNodeCommand = vscode.commands.registerCommand("leanquill.addSiblingNode", async (arg?: OutlineTreeNode | string) => {
    const nodeId = resolveNodeId(arg);
    if (!nodeId) {
      return;
    }
    const title = await vscode.window.showInputBox({ prompt: "Title", placeHolder: "New item" });
    if (!title) {
      return;
    }
    const index = await readOutlineIndex(rootPath);

    const newNode: OutlineNode = {
      id: crypto.randomUUID(),
      title,
      fileName: "",
      active: true,
      status: "not-started",
      description: "",
      customFields: {},
      traits: [],
      children: [],
    };

    const found = findNodeById(index.nodes, nodeId);
    if (found) {
      // Copy traits from sibling's level (if sibling is a part, new one is too)
      if (found.node.traits.includes("part")) {
        newNode.traits = ["part"];
      }
      found.siblings.splice(found.index + 1, 0, newNode);
    } else {
      index.nodes.push(newNode);
    }

    await writeOutlineIndex(rootPath, index, safeFileSystem);
    await outlineTreeProvider.reloadIndex();
    await outlineWebviewProvider.refresh();
    await syncBookTxt();
  });

  const removeOutlineNodeCommand = vscode.commands.registerCommand("leanquill.removeOutlineNode", async (arg?: OutlineTreeNode | string) => {
    const nodeId = resolveNodeId(arg);
    if (!nodeId) {
      return;
    }
    const preIndex = await readOutlineIndex(rootPath);
    const preFound = findNodeById(preIndex.nodes, nodeId);
    const label = preFound?.node.title || "(untitled)";
    const confirm = await vscode.window.showWarningMessage(
      `Permanently remove "${label}"? This cannot be undone (use git to recover).`,
      { modal: true },
      "Remove",
    );
    if (confirm !== "Remove") {
      return;
    }
    const index = await readOutlineIndex(rootPath);

    // Collect all fileNames from the node and its descendants for deletion
    function collectFiles(n: OutlineNode, files: string[]): void {
      if (n.fileName) {
        files.push(n.fileName);
      }
      for (const child of n.children) {
        collectFiles(child, files);
      }
    }

    const found = findNodeById(index.nodes, nodeId);
    if (found) {
      const filesToDelete: string[] = [];
      collectFiles(found.node, filesToDelete);
      removeNodeById(index.nodes, nodeId);
      for (const f of filesToDelete) {
        await deleteNodeFile(rootPath, f);
      }
    }

    await writeOutlineIndex(rootPath, index, safeFileSystem);
    await outlineTreeProvider.reloadIndex();
    await outlineWebviewProvider.refresh();
    await syncBookTxt();
  });

  const toggleOutlineActiveCommand = vscode.commands.registerCommand("leanquill.toggleOutlineActive", async (arg?: OutlineTreeNode | string) => {
    const nodeId = resolveNodeId(arg);
    if (!nodeId) {
      return;
    }
    const index = await readOutlineIndex(rootPath);
    const found = findNodeById(index.nodes, nodeId);
    if (found) {
      found.node.active = !found.node.active;
    }
    await writeOutlineIndex(rootPath, index, safeFileSystem);
    await outlineTreeProvider.reloadIndex();
    await outlineWebviewProvider.refresh();
    await syncBookTxt();
  });

  const renameOutlineNodeCommand = vscode.commands.registerCommand("leanquill.renameOutlineNode", async (arg?: OutlineTreeNode | string) => {
    const nodeId = resolveNodeId(arg);
    if (!nodeId) {
      return;
    }
    const index = await readOutlineIndex(rootPath);
    const found = findNodeById(index.nodes, nodeId);
    if (!found) {
      return;
    }
    const currentName = found.node.title;
    const newName = await vscode.window.showInputBox({ prompt: "New name", value: currentName });
    if (!newName) {
      return;
    }
    found.node.title = newName;
    // Rename the manuscript file to match new slug if it has one
    if (found.node.fileName) {
      const existingSlugs = collectExistingSlugs(index.nodes);
      existingSlugs.delete(found.node.fileName);
      const newFileName = generateNodeFileName(newName, existingSlugs);
      const content = await readNodeFile(rootPath, found.node.fileName);
      await renameNodeFile(rootPath, found.node.fileName, newFileName, content);
      found.node.fileName = newFileName;
    }
    await writeOutlineIndex(rootPath, index, safeFileSystem);
    await outlineTreeProvider.reloadIndex();
    await outlineWebviewProvider.refresh();
    await syncBookTxt();
  });

  const moveNodeUpCommand = vscode.commands.registerCommand("leanquill.moveNodeUp", async (arg?: OutlineTreeNode | string) => {
    const nodeId = resolveNodeId(arg);
    if (!nodeId) {
      return;
    }
    const index = await readOutlineIndex(rootPath);
    const found = findNodeById(index.nodes, nodeId);
    if (!found || found.index === 0) {
      return;
    }
    const siblings = found.siblings;
    [siblings[found.index - 1], siblings[found.index]] = [siblings[found.index], siblings[found.index - 1]];
    await writeOutlineIndex(rootPath, index, safeFileSystem);
    await outlineTreeProvider.reloadIndex();
    await outlineWebviewProvider.refresh();
    await syncBookTxt();
  });

  const moveNodeDownCommand = vscode.commands.registerCommand("leanquill.moveNodeDown", async (arg?: OutlineTreeNode | string) => {
    const nodeId = resolveNodeId(arg);
    if (!nodeId) {
      return;
    }
    const index = await readOutlineIndex(rootPath);
    const found = findNodeById(index.nodes, nodeId);
    if (!found || found.index >= found.siblings.length - 1) {
      return;
    }
    const siblings = found.siblings;
    [siblings[found.index], siblings[found.index + 1]] = [siblings[found.index + 1], siblings[found.index]];
    await writeOutlineIndex(rootPath, index, safeFileSystem);
    await outlineTreeProvider.reloadIndex();
    await outlineWebviewProvider.refresh();
    await syncBookTxt();
  });

  // --- Outline webview → Context pane wiring ---
  const outlineWebviewSelectionSub = outlineWebviewProvider.onDidSelect(async (nodeId) => {
    const index = await readOutlineIndex(rootPath);
    const found = findNodeById(index.nodes, nodeId);
    if (found) {
      // Calculate depth
      let depth = 0;
      const calcDepth = (nodes: OutlineNode[], target: string, d: number): number | undefined => {
        for (const n of nodes) {
          if (n.id === target) return d;
          const found = calcDepth(n.children, target, d + 1);
          if (found !== undefined) return found;
        }
        return undefined;
      };
      depth = calcDepth(index.nodes, nodeId, 0) ?? 0;
      outlineContextProvider.setContext(buildNodeContext(found.node, depth));
    } else {
      outlineContextProvider.clearContext();
    }
  });

  // --- File Watchers ---
  const outlineWatcher = vscode.workspace.createFileSystemWatcher("**/.leanquill/outline-index.json");
  const manuscriptFileWatcher = vscode.workspace.createFileSystemWatcher("**/manuscript/**/*.md");
  const bookTxtWatcher = vscode.workspace.createFileSystemWatcher("**/manuscript/Book.txt");

  // Manuscript file changes trigger outline tree refresh (for Not Included group)
  // and description sync for nodes with matching fileName
  const triggerOutlineRefresh = () => {
    void outlineTreeProvider.reloadIndex();
    void outlineWebviewProvider.refresh();
  };
  manuscriptFileWatcher.onDidCreate(triggerOutlineRefresh);
  manuscriptFileWatcher.onDidDelete(triggerOutlineRefresh);
  manuscriptFileWatcher.onDidChange((uri) => {
    void syncNodeFromFile(rootPath, uri.fsPath, safeFileSystem);
  });
  // Outline index watcher — reload tree + panel + sync Book.txt
  const onOutlineChanged = () => {
    void outlineTreeProvider.reloadIndex();
    void outlineWebviewProvider.refresh();
    planningPanel.refresh();
    void syncBookTxt();
  };
  outlineWatcher.onDidCreate(onOutlineChanged);
  outlineWatcher.onDidChange(onOutlineChanged);
  outlineWatcher.onDidDelete(() => {
    void outlineTreeProvider.reloadIndex();
    void outlineWebviewProvider.refresh();
    planningPanel.refresh();
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
    updateNodeStatusCommand,
    addOrphanToOutlineCommand,
    openPlanningWorkspaceCommand,
    createOutlineCommand,
    openNodeInEditorCommand,
    openBookTxtCommand,
    openChapterFromOutlineCommand,
    addChildNodeCommand,
    addSiblingNodeCommand,
    removeOutlineNodeCommand,
    toggleOutlineActiveCommand,
    renameOutlineNodeCommand,
    moveNodeUpCommand,
    moveNodeDownCommand,
    outlineWebviewSelectionSub,
    outlineWatcher,
    manuscriptFileWatcher,
    bookTxtWatcher,
  );

  await setWorkspaceContext(rootPath);

  // Auto-bootstrap outline from Book.txt when project is initialized but outline is empty
  try {
    const hasProject = await fs.stat(path.join(rootPath, ".leanquill", "project.yaml")).then(() => true).catch(() => false);
    if (hasProject) {
      const existingIndex = await readOutlineIndex(rootPath);
      if (existingIndex.nodes.length === 0) {
        const chapterOrder = await readChapterOrderState(rootPath);
        if (chapterOrder.chapterPaths.length > 0) {
          const index = bootstrapOutline(chapterOrder.chapterPaths);
          await writeOutlineIndex(rootPath, index, safeFileSystem);
          await outlineTreeProvider.reloadIndex();
          await outlineWebviewProvider.refresh();
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
