import * as crypto from "node:crypto";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as vscode from "vscode";
import { LeanQuillActionsProvider } from "./actionsView";
import { openNodeInEditor } from "./nodeEditor";
import { generateBookTxt, writeBookTxt, detectExternalBookTxtEdit } from "./bookTxtSync";
import { resolveChapterOrder } from "./chapterOrder";
import { OutlineContextPaneProvider, buildNodeContext } from "./outlineContextPane";
import { runInitializeFlow, shouldPromptInitialize } from "./initialize";
import { readOutlineIndex, writeOutlineIndex, bootstrapOutline, findNodeById, removeNodeById } from "./outlineStore";
import { OutlineTreeNode, OutlineOrphanNode, OutlineDataNode } from "./outlineTree";
import { OutlineWebviewProvider } from "./outlineWebviewPanel";
import { PlanningPanelProvider } from "./planningPanel";
import { SafeFileSystem } from "./safeFileSystem";
import { readProjectConfig } from "./projectConfig";
import { migrateProjectYaml, writeHarnessEntryPoints } from "./initialize";
import { ResearchTreeProvider } from "./researchTree";
import { CharacterTreeProvider } from "./characterTree";
import { ChapterOrderResult, ChapterStatus, OutlineNode, OutlineIndex } from "./types";
import { createCharacter, scanManuscriptFileForCharacters } from "./characterStore";

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

  // Load project config and configure research folder access
  let config = await readProjectConfig(rootPath);
  if (config) {
    if (config.schemaVersion === "1") {
      const migrated = await migrateProjectYaml(rootPath, safeFileSystem);
      if (migrated) {
        log.info("Migrated project.yaml from schema v1 to v2");
        // Re-read config after migration to get updated v2 values
        config = await readProjectConfig(rootPath) ?? config;
      }
    }
    const researchFolderClean = config.folders.research.replace(/\/+$/, "");
    const DEFAULT_RESEARCH_FOLDER = "research/leanquill";
    // Reject any research folder that points into manuscript/ to preserve the safety boundary
    const isMsPath = researchFolderClean === "manuscript" ||
      researchFolderClean.startsWith("manuscript/");
    if (isMsPath) {
      log.warn(`Research folder "${researchFolderClean}" points into manuscript/; falling back to "${DEFAULT_RESEARCH_FOLDER}"`);
    }
    const safeResearchFolder = isMsPath ? DEFAULT_RESEARCH_FOLDER : researchFolderClean;
    safeFileSystem.allowPath(safeResearchFolder, ".md");

    // Characters folder SafeFileSystem allowance (D-04: allow writes to configured characters folder)
    const DEFAULT_CHARACTERS_FOLDER = "notes/characters";
    const charactersFolderRaw = config.folders.characters ?? DEFAULT_CHARACTERS_FOLDER;
    const charactersFolderClean = charactersFolderRaw.replace(/\/+$/g, "");
    // Reject characters folder pointing into manuscript/ to preserve the safety boundary
    const isCharsMsPath =
      charactersFolderClean === "manuscript" ||
      charactersFolderClean.startsWith("manuscript/");
    const safeCharactersFolder = isCharsMsPath ? DEFAULT_CHARACTERS_FOLDER : charactersFolderClean;
    safeFileSystem.allowPath(safeCharactersFolder, ".md");
    // Ensure harness entry points exist for projects initialized before phase 12
    // (writeHarnessEntryPoints is idempotent — skips existing files)
    void writeHarnessEntryPoints(rootPath).catch(() => { /* non-critical */ });
  }

  const researchFolder = (config?.folders.research ?? "research/leanquill").replace(/\/+$/, "");
  const researchDir = path.join(rootPath, ...researchFolder.split("/"));
  const researchTreeProvider = new ResearchTreeProvider(vscode, researchDir);
  const characterTreeProvider = new CharacterTreeProvider(vscode, rootPath);

  const setupViewProvider = new LeanQuillActionsProvider();
  const outlineContextProvider = new OutlineContextPaneProvider(vscode);

  // Webview-based sidebar outline
  const outlineWebviewProvider = new OutlineWebviewProvider(
    vscode,
    context.extensionUri,
    rootPath,
    safeFileSystem,
    () => {
      // No-op: the outline file watcher handles refresh and Book.txt sync
    },
  );

  const planningPanel = new PlanningPanelProvider(vscode, context.extensionUri, rootPath, safeFileSystem);

  // Flag to prevent Book.txt write-loop (reset after delay to allow watcher to fire)
  let _selfEditingBookTxt = false;
  let _selfEditResetTimer: ReturnType<typeof setTimeout> | undefined;
  const SELF_EDIT_RESET_DELAY_MS = 1500;
  const syncBookTxt = async (): Promise<void> => {
    try {
      const index = await readOutlineIndex(rootPath);
      const content = generateBookTxt(index);
      if (_selfEditResetTimer) {
        clearTimeout(_selfEditResetTimer);
      }
      _selfEditingBookTxt = true;
      await writeBookTxt(rootPath, content, safeFileSystem);
      _selfEditResetTimer = setTimeout(() => {
        _selfEditingBookTxt = false;
      }, SELF_EDIT_RESET_DELAY_MS);
    } catch {
      _selfEditingBookTxt = false;
    }
  };

  const researchWatcher = vscode.workspace.createFileSystemWatcher(
    new vscode.RelativePattern(rootPath, `${researchFolder}/**/*.md`),
  );
  researchWatcher.onDidCreate(() => researchTreeProvider.refresh());
  researchWatcher.onDidChange(() => researchTreeProvider.refresh());
  researchWatcher.onDidDelete(() => researchTreeProvider.refresh());

  // Characters folder watcher � refresh tree when character files change
  const charsFolder = (config?.folders.characters ?? "notes/characters").replace(/\/+$/g, "");
  const charsDir = path.join(rootPath, ...charsFolder.split("/"));
  const charactersWatcher = vscode.workspace.createFileSystemWatcher(
    new vscode.RelativePattern(charsDir, "*.md"),
  );
  charactersWatcher.onDidCreate(() => characterTreeProvider.refresh());
  charactersWatcher.onDidChange(() => characterTreeProvider.refresh());
  charactersWatcher.onDidDelete(() => characterTreeProvider.refresh());

  const startResearchCommand = vscode.commands.registerCommand("leanquill.startResearch", async () => {
    const appName = vscode.env.appName ?? "";
    const isCursor = appName.toLowerCase().includes("cursor");
    const hasCopilot = vscode.extensions.getExtension("github.copilot-chat") !== undefined;

    try {
      await vscode.commands.executeCommand("workbench.action.chat.newChat");
    } catch {
      // newChat not available on this version — fall through to open
    }

    let query: string;
    if (isCursor || hasCopilot) {
      query = "@researcher ";
    } else {
      query = "Research: ";
    }

    try {
      await vscode.commands.executeCommand("workbench.action.chat.open", { query, isPartialQuery: true });
    } catch {
      await vscode.window.showInformationMessage(
        "Open your AI chat and invoke the LeanQuill research workflow with your question. " +
        "For Claude, use: /agent:researcher <your question>",
      );
    }
  });

  const newCharacterCommand = vscode.commands.registerCommand("leanquill.newCharacter", async () => {
    const name = await vscode.window.showInputBox({ prompt: "Character name", placeHolder: "e.g. Jane Doe" });
    if (!name?.trim()) {
      return;
    }
    const latestConfig = await readProjectConfig(rootPath) ?? {
      schemaVersion: "1",
      folders: { research: "research/leanquill/", characters: "notes/characters/" },
    };
    try {
      await createCharacter(name.trim(), rootPath, latestConfig, safeFileSystem);
      await planningPanel.refresh();
      characterTreeProvider.refresh();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`LeanQuill: Failed to create character: ${message}`);
    }
  });

  context.subscriptions.push(
    vscode.window.registerTreeDataProvider("leanquill.actions", setupViewProvider),
    vscode.window.registerWebviewViewProvider("leanquill.outlineTree", outlineWebviewProvider, {
      webviewOptions: { retainContextWhenHidden: true },
    }),
    vscode.window.registerWebviewViewProvider("leanquill.chapterContext", outlineContextProvider, {
      webviewOptions: { retainContextWhenHidden: true },
    }),
    vscode.window.registerTreeDataProvider("leanquill.research", researchTreeProvider),
    vscode.window.registerTreeDataProvider("leanquill.characters", characterTreeProvider),
    researchWatcher,
    charactersWatcher,
    startResearchCommand,
    newCharacterCommand,
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
  };

  let lastOpened: { chapterPath: string; openedAt: number } | undefined;
  const openChapter = async (chapterPath: string): Promise<void> => {
    if (chapterPath === "manuscript/Book.txt") {
      const bookPath = path.join(rootPath, "manuscript", "Book.txt");
      const exists = await fs.stat(bookPath).then(() => true).catch(() => false);
      if (!exists) {
        const chapterOrder = await readChapterOrderState(rootPath);
        const content = chapterOrder.chapterPaths.map(p => p.replace(/^manuscript\//, "")).join("\n");
        await safeFileSystem.writeFile(bookPath, content.length > 0 ? `${content}\n` : "");
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
  });

  // --- Outline Commands ---
  const openPlanningWorkspaceCommand = vscode.commands.registerCommand("leanquill.openPlanningWorkspace", async () => {
    await planningPanel.show();
  });

  const createOutlineCommand = vscode.commands.registerCommand("leanquill.createOutline", async () => {
    const chapterOrder = await readChapterOrderState(rootPath);
    const index = bootstrapOutline(chapterOrder.chapterPaths);
    await writeOutlineIndex(rootPath, index, safeFileSystem);
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
      `Remove "${label}" from outline? The manuscript file will not be deleted.`,
      { modal: true },
      "Remove",
    );
    if (confirm !== "Remove") {
      return;
    }
    const index = await readOutlineIndex(rootPath);

    const found = findNodeById(index.nodes, nodeId);
    if (found) {
      removeNodeById(index.nodes, nodeId);
    }

    await writeOutlineIndex(rootPath, index, safeFileSystem);
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
    // The manuscript file is not renamed — only the outline title changes.
    // Users can rename the physical file manually if desired.
    await writeOutlineIndex(rootPath, index, safeFileSystem);
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

  // Manuscript file changes trigger outline webview refresh (for Not Included group)
  const triggerOutlineRefresh = () => {
    void outlineWebviewProvider.refresh();
  };
  manuscriptFileWatcher.onDidCreate(triggerOutlineRefresh);
  manuscriptFileWatcher.onDidDelete(triggerOutlineRefresh);
  // Outline index watcher — reload webview + panel + sync Book.txt
  const onOutlineChanged = () => {
    void outlineWebviewProvider.refresh();
    void planningPanel.refresh();
    void syncBookTxt();
  };
  outlineWatcher.onDidCreate(onOutlineChanged);
  outlineWatcher.onDidChange(onOutlineChanged);
  outlineWatcher.onDidDelete(() => {
    void outlineWebviewProvider.refresh();
    void planningPanel.refresh();
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

  // Manuscript scan listeners � update character references when manuscript files are saved/opened
  const scanManuscriptFile = async (filePath: string): Promise<void> => {
    try {
      const rel = filePath.replace(/\\/g, "/").replace(rootPath.replace(/\\/g, "/") + "/", "");
      if (!rel.startsWith("manuscript/") || !rel.endsWith(".md")) {
        return;
      }
      const latestConfig = await readProjectConfig(rootPath) ?? {
        schemaVersion: "1",
        folders: { research: "research/leanquill/", characters: "notes/characters/" },
      };
      await scanManuscriptFileForCharacters(filePath, rootPath, latestConfig, safeFileSystem);
      await planningPanel.refresh();
      characterTreeProvider.refresh();
    } catch {
      // Never surface errors from background scanning
    }
  };
  const onManuscriptSave = vscode.workspace.onDidSaveTextDocument((doc) =>
    void scanManuscriptFile(doc.uri.fsPath),
  );
  const onManuscriptOpen = vscode.workspace.onDidOpenTextDocument((doc) =>
    void scanManuscriptFile(doc.uri.fsPath),
  );

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
    onManuscriptSave,
    onManuscriptOpen,
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
          log.info("Auto-bootstrapped outline from Book.txt");
        }
      }
      // Ensure research folder exists on activation
      try {
        await safeFileSystem.mkdir(researchDir);
      } catch {
        // Non-critical — folder may already exist or safeFs may block it if not configured
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
