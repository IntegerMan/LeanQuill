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
import { OpenQuestionsPanelViewProvider } from "./openQuestionsPanel";
import { IssueGutterController } from "./issueGutterController";
import { migrateIssuesLayoutV3IfNeeded } from "./issueMigration";
import { createOpenQuestion, getOpenQuestion, listOpenQuestions } from "./openQuestionStore";
import { promptNewIssueTitleAndType } from "./promptNewIssue";
import { handleOpenQuestionWorkspaceDelete, handleOpenQuestionWorkspaceRename } from "./openQuestionWorkspaceSync";
import { SafeFileSystem } from "./safeFileSystem";
import { readProjectConfig, readProjectConfigWithDefaults, validateProjectYamlForSetup } from "./projectConfig";
import { buildHarnessDraftQuery, buildHarnessFallbackHint, buildStoryChatDraftQuery } from "./harnessChatDraft";
import {
  buildStoryChatContextBundle,
  type StoryChatLaunchSource,
  type StoryChatManuscriptScope,
  type StoryChatTarget,
} from "./storyChatContext";
import { listStoryMemory, storyMemoryToContext, type StoryMemoryAssociation } from "./storyMemoryStore";
import { saveStoryChatSessionSummary, type StoryChatLogSummary } from "./storyChatLogStore";
import { applyMetadataAction } from "./metadataActionApplier";
import {
  ensureLeanquillDefaultPersonas,
  ensureLeanquillWorkflows,
  migrateProjectYaml,
  writeHarnessEntryPoints,
} from "./initialize";
import { ResearchTreeProvider, type ResearchItem } from "./researchTree";
import { CharacterTreeProvider } from "./characterTree";
import { PlaceTreeProvider } from "./placeTree";
import {
  ChapterOrderResult,
  ChapterStatus,
  OutlineNode,
  OutlineIndex,
  type OpenQuestionRecord,
} from "./types";
import { createCharacter, scanManuscriptFileForCharacters } from "./characterStore";
import { createPlace, scanManuscriptFileForPlaces } from "./placeStore";
import { createThread } from "./threadStore";
import { addCentralThemeEntry, readThemesDocument, writeThemesDocument } from "./themesStore";

async function setWorkspaceContext(rootPath: string): Promise<void> {
  const hasBookTxt = await fs.stat(path.join(rootPath, "manuscript", "Book.txt")).then(() => true).catch(() => false);
  const hasManuscript = await fs.stat(path.join(rootPath, "manuscript")).then(() => true).catch(() => false);
  const projectYamlPath = path.join(rootPath, ".leanquill", "project.yaml");
  const hasLeanquill = await fs.stat(projectYamlPath).then(() => true).catch(() => false);

  let projectYamlValid = false;
  if (hasLeanquill) {
    try {
      const yamlText = await fs.readFile(projectYamlPath, "utf8");
      projectYamlValid = validateProjectYamlForSetup(yamlText).ok;
    } catch {
      projectYamlValid = false;
    }
  }

  const manuscriptScaffoldComplete = hasManuscript && hasBookTxt;
  const workspaceLeanQuillReady = projectYamlValid && manuscriptScaffoldComplete;
  const setupNeedsAttention = !workspaceLeanQuillReady;

  await vscode.commands.executeCommand("setContext", "leanquill.hasManuscriptMarkers", hasBookTxt || hasManuscript);
  await vscode.commands.executeCommand("setContext", "leanquill.isInitialized", hasLeanquill);
  await vscode.commands.executeCommand("setContext", "leanquill.projectYamlValid", projectYamlValid);
  await vscode.commands.executeCommand("setContext", "leanquill.manuscriptScaffoldComplete", manuscriptScaffoldComplete);
  await vscode.commands.executeCommand("setContext", "leanquill.workspaceLeanQuillReady", workspaceLeanQuillReady);
  await vscode.commands.executeCommand("setContext", "leanquill.setupNeedsAttention", setupNeedsAttention);
}

/** Paths whose presence or removal affect Setup / viewsWelcome context keys. */
function pathAffectsLeanQuillSetupContext(rootPath: string, fsPath: string): boolean {
  const rel = path.relative(rootPath, fsPath).split(path.sep).join("/");
  if (rel === "" || rel.startsWith("..")) {
    return false;
  }
  if (rel === ".leanquill/project.yaml") {
    return true;
  }
  if (rel === "manuscript/Book.txt" || rel === "manuscript") {
    return true;
  }
  return false;
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

  let planningPanel: PlanningPanelProvider | undefined;
  const outlineWebviewRef: { current?: OutlineWebviewProvider } = {};

  const initializeCommand = vscode.commands.registerCommand("leanquill.initialize", async () => {
    console.log("[LeanQuill] Initialize command fired");
    log.info("Initialize command fired");
    try {
      await runInitializeFlow(context, log, {
        planningPanel,
        refreshOutline: () => outlineWebviewRef.current?.refresh(),
      });
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

  let workspaceContextRefreshTimer: ReturnType<typeof setTimeout> | undefined;
  const WORKSPACE_CONTEXT_REFRESH_DEBOUNCE_MS = 150;
  const scheduleWorkspaceContextRefresh = (): void => {
    if (workspaceContextRefreshTimer) {
      clearTimeout(workspaceContextRefreshTimer);
    }
    workspaceContextRefreshTimer = setTimeout(() => {
      workspaceContextRefreshTimer = undefined;
      void setWorkspaceContext(rootPath);
    }, WORKSPACE_CONTEXT_REFRESH_DEBOUNCE_MS);
  };

  context.subscriptions.push(
    vscode.workspace.onDidCreateFiles((e) => {
      if (e.files.some((u) => pathAffectsLeanQuillSetupContext(rootPath, u.fsPath))) {
        scheduleWorkspaceContextRefresh();
      }
    }),
    vscode.workspace.onDidDeleteFiles((e) => {
      if (e.files.some((u) => pathAffectsLeanQuillSetupContext(rootPath, u.fsPath))) {
        scheduleWorkspaceContextRefresh();
      }
    }),
    vscode.workspace.onDidRenameFiles((e) => {
      for (const { oldUri, newUri } of e.files) {
        if (
          pathAffectsLeanQuillSetupContext(rootPath, oldUri.fsPath)
          || pathAffectsLeanQuillSetupContext(rootPath, newUri.fsPath)
        ) {
          scheduleWorkspaceContextRefresh();
          break;
        }
      }
    }),
  );

  // Load project config and configure research folder access
  let config = await readProjectConfig(rootPath);
  const DEFAULT_THREADS_FOLDER = "notes/threads";
  const DEFAULT_SETTINGS_FOLDER = "notes/settings";
  let safeThreadsFolder = DEFAULT_THREADS_FOLDER;
  let safeSettingsFolder = DEFAULT_SETTINGS_FOLDER;
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

    const threadsFolderRaw = config.folders.threads ?? DEFAULT_THREADS_FOLDER;
    const threadsFolderClean = threadsFolderRaw.replace(/\/+$/g, "");
    const isThreadsMsPath =
      threadsFolderClean === "manuscript" ||
      threadsFolderClean.startsWith("manuscript/");
    safeThreadsFolder = isThreadsMsPath ? DEFAULT_THREADS_FOLDER : threadsFolderClean;
    safeFileSystem.allowPath(safeThreadsFolder, ".md");

    const settingsFolderRaw = config.folders.settings ?? DEFAULT_SETTINGS_FOLDER;
    const settingsFolderClean = settingsFolderRaw.replace(/\/+$/g, "");
    const isSettingsMsPath =
      settingsFolderClean === "manuscript" ||
      settingsFolderClean.startsWith("manuscript/");
    safeSettingsFolder = isSettingsMsPath ? DEFAULT_SETTINGS_FOLDER : settingsFolderClean;
    safeFileSystem.allowPath(safeSettingsFolder, ".md");

    // Ensure harness entry points exist for projects initialized before phase 12
    // (writeHarnessEntryPoints is idempotent — skips existing files)
    void writeHarnessEntryPoints(rootPath).catch(() => { /* non-critical */ });
    // Backfill any bundled workflows missing from pre-upgrade workspaces (never overwrites)
    void ensureLeanquillWorkflows(rootPath, safeFileSystem).catch(() => { /* non-critical */ });
    void ensureLeanquillDefaultPersonas(rootPath, safeFileSystem).catch(() => { /* non-critical */ });
  } else {
    safeFileSystem.allowPath(DEFAULT_THREADS_FOLDER, ".md");
    safeFileSystem.allowPath(DEFAULT_SETTINGS_FOLDER, ".md");
  }

  await migrateIssuesLayoutV3IfNeeded(rootPath, safeFileSystem);

  const researchFolder = (config?.folders.research ?? "research/leanquill").replace(/\/+$/, "");
  const researchDir = path.join(rootPath, ...researchFolder.split("/"));
  const researchTreeProvider = new ResearchTreeProvider(vscode, rootPath, researchDir);
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
  outlineWebviewRef.current = outlineWebviewProvider;

  planningPanel = new PlanningPanelProvider(
    vscode,
    context.extensionUri,
    rootPath,
    safeFileSystem,
    context.workspaceState,
  );

  const openQuestionsPanelProvider = new OpenQuestionsPanelViewProvider(
    vscode,
    context.extensionUri,
    rootPath,
    context.workspaceState,
    safeFileSystem,
  );

  const placeTreeProvider = new PlaceTreeProvider(vscode, rootPath, safeFileSystem, () => {
    void planningPanel.refresh();
  });

  const refreshOpenQuestionSurfaces = async (): Promise<void> => {
    await planningPanel.refresh();
    await openQuestionsPanelProvider.refresh();
    await outlineWebviewRef.current?.refresh();
    characterTreeProvider.refresh();
    placeTreeProvider.refresh();
    researchTreeProvider.refresh();
  };

  context.subscriptions.push(
    vscode.workspace.onDidRenameFiles(async (e) => {
      for (const { oldUri, newUri } of e.files) {
        await handleOpenQuestionWorkspaceRename(rootPath, safeFileSystem, oldUri.fsPath, newUri.fsPath);
      }
      await refreshOpenQuestionSurfaces();
    }),
    vscode.workspace.onDidDeleteFiles(async (e) => {
      for (const uri of e.files) {
        await handleOpenQuestionWorkspaceDelete(rootPath, safeFileSystem, uri.fsPath);
      }
      await refreshOpenQuestionSurfaces();
    }),
  );

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

  // Characters folder watcher — refresh tree when character files change
  const charsFolder = (config?.folders.characters ?? "notes/characters").replace(/\/+$/g, "");
  const charsDir = path.join(rootPath, ...charsFolder.split("/"));
  const charactersWatcher = vscode.workspace.createFileSystemWatcher(
    new vscode.RelativePattern(charsDir, "*.md"),
  );
  charactersWatcher.onDidCreate(() => characterTreeProvider.refresh());
  charactersWatcher.onDidChange(() => characterTreeProvider.refresh());
  charactersWatcher.onDidDelete(() => characterTreeProvider.refresh());

  const threadsWatcher = vscode.workspace.createFileSystemWatcher(
    new vscode.RelativePattern(rootPath, `${safeThreadsFolder}/**/*.md`),
  );
  threadsWatcher.onDidCreate(() => void planningPanel.refresh());
  threadsWatcher.onDidChange(() => void planningPanel.refresh());
  threadsWatcher.onDidDelete(() => void planningPanel.refresh());

  const settingsWatcher = vscode.workspace.createFileSystemWatcher(
    new vscode.RelativePattern(rootPath, `${safeSettingsFolder}/**/*.md`),
  );
  settingsWatcher.onDidCreate(() => { void planningPanel.refresh(); placeTreeProvider.refresh(); });
  settingsWatcher.onDidChange(() => { void planningPanel.refresh(); placeTreeProvider.refresh(); });
  settingsWatcher.onDidDelete(() => { void planningPanel.refresh(); placeTreeProvider.refresh(); });

  const issueGutterController = new IssueGutterController(vscode, rootPath, context.extensionUri);
  issueGutterController.register(context);

  const issuesMarkdownWatcher = vscode.workspace.createFileSystemWatcher(
    new vscode.RelativePattern(rootPath, ".leanquill/issues/**/*.md"),
  );
  const refreshIssuesAndGutter = (): void => {
    void refreshOpenQuestionSurfaces();
    void issueGutterController.refresh();
  };
  issuesMarkdownWatcher.onDidCreate(refreshIssuesAndGutter);
  issuesMarkdownWatcher.onDidChange(refreshIssuesAndGutter);
  issuesMarkdownWatcher.onDidDelete(refreshIssuesAndGutter);

  const openHarnessChat = async (kind: "research" | "import"): Promise<void> => {
    const appName = vscode.env.appName ?? "";
    const isCursorOrCopilot =
      appName.toLowerCase().includes("cursor") || vscode.extensions.getExtension("github.copilot-chat") !== undefined;

    try {
      await vscode.commands.executeCommand("workbench.action.chat.newChat");
    } catch {
      // newChat not available on this version — fall through to open
    }

    const query = buildHarnessDraftQuery({ isCursorOrCopilot, kind });

    try {
      await vscode.commands.executeCommand("workbench.action.chat.open", { query, isPartialQuery: true });
    } catch {
      await vscode.window.showInformationMessage(buildHarnessFallbackHint(kind));
    }
  };

  const startResearchCommand = vscode.commands.registerCommand("leanquill.startResearch", async () => {
    await openHarnessChat("research");
  });

  const startImportResearchCommand = vscode.commands.registerCommand("leanquill.startImportResearch", async () => {
    await openHarnessChat("import");
  });

  const STORY_CHAT_BASE_CTX = [".leanquill/project.yaml", ".leanquill/outline-index.json", ".leanquill/chapter-status-index.json"];

  function manuscriptScopeForIssueAssociation(association: OpenQuestionRecord["association"]): StoryChatManuscriptScope {
    if (association.kind === "chapter" || association.kind === "selection") {
      return "chapter";
    }
    return "none";
  }

  interface OpenStoryChatBundleInput {
    launchedFrom: StoryChatLaunchSource;
    target?: StoryChatTarget;
    includedPaths?: string[];
    excludedPaths?: string[];
    manuscriptScope?: StoryChatManuscriptScope;
    excludeBaseContext?: boolean;
  }

  const openStoryChatWithContext = async (input: OpenStoryChatBundleInput): Promise<void> => {
    const appName = vscode.env.appName ?? "";
    const isCursorOrCopilot =
      appName.toLowerCase().includes("cursor") || vscode.extensions.getExtension("github.copilot-chat") !== undefined;

    const mergedIncluded = [...(input.excludeBaseContext ? [] : STORY_CHAT_BASE_CTX), ...(input.includedPaths ?? [])];
    const memoryRecords = await listStoryMemory(rootPath);
    const activeMemory = memoryRecords.map(storyMemoryToContext);
    const bundle = buildStoryChatContextBundle({
      launchedFrom: input.launchedFrom,
      target: input.target,
      includedPaths: mergedIncluded,
      excludedPaths: input.excludedPaths,
      activeMemory,
      manuscriptScope: input.manuscriptScope,
    });
    const query = buildStoryChatDraftQuery({ isCursorOrCopilot, contextSummary: bundle.summary });
    try {
      await vscode.commands.executeCommand("workbench.action.chat.newChat");
    } catch {
      // ignore
    }
    try {
      await vscode.commands.executeCommand("workbench.action.chat.open", { query, isPartialQuery: true });
    } catch {
      await vscode.window.showInformationMessage(buildHarnessFallbackHint("storyChat"));
    }
  };

  const startStoryChatCommand = vscode.commands.registerCommand("leanquill.startStoryChat", async () => {
    await openStoryChatWithContext({
      launchedFrom: "general",
      manuscriptScope: "none",
      includedPaths: [...STORY_CHAT_BASE_CTX],
      excludedPaths: ["manuscript/**"],
    });
  });

  const chatAboutIssueCommand = vscode.commands.registerCommand(
    "leanquill.chatAboutIssue",
    async (arg?: string | { id?: string }) => {
      let issueId = typeof arg === "string" ? arg : arg?.id;
      if (!issueId) {
        const issues = await listOpenQuestions(rootPath);
        const pick = await vscode.window.showQuickPick(
          issues.map((q) => ({ label: q.title, description: q.id, q })),
          { placeHolder: "Select an issue to discuss" },
        );
        if (!pick || !("q" in pick)) {
          return;
        }
        issueId = (pick as { q: OpenQuestionRecord }).q.id;
      }
      const issue = await getOpenQuestion(rootPath, issueId);
      if (!issue) {
        await vscode.window.showWarningMessage("LeanQuill: Issue not found.");
        return;
      }
      const included = [`.leanquill/issues/${issue.fileName}`];
      const scope = manuscriptScopeForIssueAssociation(issue.association);
      const target: StoryChatTarget = {
        kind: "issue",
        id: issue.id,
        label: issue.title,
        path: issue.fileName,
      };
      await openStoryChatWithContext({
        launchedFrom: "issue",
        target,
        includedPaths: included,
        manuscriptScope: scope,
      });
    },
  );

  const chatAboutChapterCommand = vscode.commands.registerCommand(
    "leanquill.chatAboutChapter",
    async (arg?: { chapterPath?: string }) => {
      let chapterPath = arg?.chapterPath;
      if (!chapterPath) {
        const ed = vscode.window.activeTextEditor;
        if (ed?.document.uri.fsPath.startsWith(rootPath)) {
          const rel = path.relative(rootPath, ed.document.uri.fsPath).split(path.sep).join("/");
          if (rel.startsWith("manuscript/")) {
            chapterPath = normalizePath(rel);
          }
        }
      }
      if (!chapterPath?.trim()) {
        chapterPath = await vscode.window.showInputBox({
          prompt: "Chapter path (e.g. manuscript/ch01.md)",
        });
      }
      if (!chapterPath?.trim()) {
        return;
      }
      const norm = normalizePath(chapterPath.trim());
      const target: StoryChatTarget = {
        kind: "chapter",
        label: norm,
        path: norm,
      };
      await openStoryChatWithContext({
        launchedFrom: "chapter",
        target,
        includedPaths: [norm],
        manuscriptScope: "chapter",
      });
    },
  );

  const chatAboutSelectionCommand = vscode.commands.registerCommand("leanquill.chatAboutSelection", async () => {
    const ed = vscode.window.activeTextEditor;
    if (!ed || ed.selection.isEmpty) {
      await vscode.window.showWarningMessage("LeanQuill: Select text in a manuscript chapter first.");
      return;
    }
    const rel = path.relative(rootPath, ed.document.uri.fsPath).split(path.sep).join("/");
    if (!rel.startsWith("manuscript/")) {
      await vscode.window.showWarningMessage("LeanQuill: Selection chat is only available for manuscript files.");
      return;
    }
    const chapterRef = normalizePath(rel);
    const start = ed.selection.start;
    const end = ed.selection.end;
    const spanHint = `L${Math.min(start.line, end.line) + 1}–L${Math.max(start.line, end.line) + 1}`;
    const selectedTextExcerpt = ed.document.getText(ed.selection);
    const target: StoryChatTarget = {
      kind: "selection",
      label: `Selection in ${chapterRef}`,
      chapterRef,
      spanHint,
      selectedTextExcerpt,
      path: chapterRef,
    };
    await openStoryChatWithContext({
      launchedFrom: "selection",
      target,
      includedPaths: [chapterRef],
      manuscriptScope: "selection",
    });
  });

  const chatAboutCharacterCommand = vscode.commands.registerCommand(
    "leanquill.chatAboutCharacter",
    async (arg?: { fileName?: string; label?: string }) => {
      let fileName = arg?.fileName;
      let label = arg?.label;
      if (!fileName?.trim()) {
        const typed = await vscode.window.showInputBox({ prompt: "Character file name (e.g. hero.md)" });
        if (!typed?.trim()) {
          return;
        }
        fileName = typed.trim();
      }
      label = label?.trim() || fileName;
      const cfg = await readProjectConfigWithDefaults(rootPath);
      const charFolder = cfg.folders.characters.replace(/\/+$/, "");
      const rel = `${charFolder}/${fileName}`.split(path.sep).join("/");
      const target: StoryChatTarget = { kind: "character", label: label!, fileName: fileName!, path: rel };
      await openStoryChatWithContext({
        launchedFrom: "character",
        target,
        includedPaths: [normalizePath(rel)],
        manuscriptScope: "none",
      });
    },
  );

  const chatAboutPlaceCommand = vscode.commands.registerCommand(
    "leanquill.chatAboutPlace",
    async (arg?: { fileName?: string; label?: string }) => {
      let fileName = arg?.fileName;
      let label = arg?.label;
      if (!fileName?.trim()) {
        const typed = await vscode.window.showInputBox({ prompt: "Place file name (e.g. old-mill.md)" });
        if (!typed?.trim()) {
          return;
        }
        fileName = typed.trim();
      }
      label = label?.trim() || fileName;
      const cfg = await readProjectConfigWithDefaults(rootPath);
      const folder = cfg.folders.settings.replace(/\/+$/, "");
      const rel = `${folder}/${fileName}`.split(path.sep).join("/");
      const target: StoryChatTarget = { kind: "place", label: label!, fileName: fileName!, path: rel };
      await openStoryChatWithContext({
        launchedFrom: "place",
        target,
        includedPaths: [normalizePath(rel)],
        manuscriptScope: "none",
      });
    },
  );

  const chatAboutThreadCommand = vscode.commands.registerCommand(
    "leanquill.chatAboutThread",
    async (arg?: { fileName?: string; label?: string }) => {
      let fileName = arg?.fileName;
      let label = arg?.label;
      if (!fileName?.trim()) {
        const typed = await vscode.window.showInputBox({ prompt: "Thread file name (e.g. main-arc.md)" });
        if (!typed?.trim()) {
          return;
        }
        fileName = typed.trim();
      }
      label = label?.trim() || fileName;
      const cfg = await readProjectConfigWithDefaults(rootPath);
      const folder = cfg.folders.threads.replace(/\/+$/, "");
      const rel = `${folder}/${fileName}`.split(path.sep).join("/");
      const target: StoryChatTarget = { kind: "thread", label: label!, fileName: fileName!, path: rel };
      await openStoryChatWithContext({
        launchedFrom: "thread",
        target,
        includedPaths: [normalizePath(rel)],
        manuscriptScope: "none",
      });
    },
  );

  const chatAboutThemeCommand = vscode.commands.registerCommand(
    "leanquill.chatAboutTheme",
    async (arg?: { id?: string; label?: string }) => {
      let id = arg?.id;
      let label = arg?.label;
      if (!id?.trim()) {
        const typed = await vscode.window.showInputBox({ prompt: "Theme id (from themes.yaml)" });
        if (!typed?.trim()) {
          return;
        }
        id = typed.trim();
      }
      label = label?.trim() || id;
      const target: StoryChatTarget = { kind: "theme", label: label!, id: id! };
      await openStoryChatWithContext({
        launchedFrom: "theme",
        target,
        includedPaths: [".leanquill/themes.yaml"],
        manuscriptScope: "none",
      });
    },
  );

  const chatAboutResearchCommand = vscode.commands.registerCommand(
    "leanquill.chatAboutResearch",
    async (arg?: { fileName?: string; label?: string }) => {
      let fileName = arg?.fileName;
      let label = arg?.label;
      if (!fileName?.trim()) {
        const typed = await vscode.window.showInputBox({ prompt: "Research note file name" });
        if (!typed?.trim()) {
          return;
        }
        fileName = typed.trim();
      }
      label = label?.trim() || fileName;
      const cfg = await readProjectConfigWithDefaults(rootPath);
      const folder = cfg.folders.research.replace(/\/+$/, "");
      const rel = `${folder}/${fileName}`.split(path.sep).join("/");
      const target: StoryChatTarget = { kind: "research", label: label!, fileName: fileName!, path: rel };
      await openStoryChatWithContext({
        launchedFrom: "research",
        target,
        includedPaths: [normalizePath(rel)],
        manuscriptScope: "none",
      });
    },
  );

  const applyMetadataActionCommand = vscode.commands.registerCommand("leanquill.applyMetadataAction", async () => {
    const ed = vscode.window.activeTextEditor;
    let rawText = ed && !ed.selection.isEmpty ? ed.document.getText(ed.selection) : undefined;
    if (!rawText?.trim()) {
      rawText = await vscode.window.showInputBox({ prompt: "Paste accepted LeanQuill MetadataAction JSON" });
    }
    if (!rawText?.trim()) {
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawText.trim());
    } catch {
      await vscode.window.showErrorMessage("Metadata action was not applied. Invalid JSON.");
      return;
    }
    const result = await applyMetadataAction(rootPath, safeFileSystem, parsed);
    if (result.status === "applied") {
      await vscode.window.showInformationMessage("Applied LeanQuill metadata action.");
    } else if (result.status === "blocked") {
      await vscode.window.showErrorMessage(
        "LeanQuill blocked this metadata action because it would write outside approved project state.",
      );
    } else {
      await vscode.window.showWarningMessage("Metadata action was not applied.");
    }
  });

  const saveStoryChatSummaryCommand = vscode.commands.registerCommand("leanquill.saveStoryChatSummary", async () => {
    const ed = vscode.window.activeTextEditor;
    let rawText = ed && !ed.selection.isEmpty ? ed.document.getText(ed.selection) : undefined;
    if (!rawText?.trim()) {
      rawText = await vscode.window.showInputBox({ prompt: "Paste LeanQuill story chat summary JSON" });
    }
    if (!rawText?.trim()) {
      return;
    }
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(rawText.trim()) as Record<string, unknown>;
    } catch {
      await vscode.window.showWarningMessage("Story chat summary was not saved.");
      return;
    }
    const sessionId = typeof parsed.sessionId === "string" ? parsed.sessionId : "";
    const startedAt = typeof parsed.startedAt === "string" ? parsed.startedAt : "";
    const endedAt = typeof parsed.endedAt === "string" ? parsed.endedAt : "";
    const launchedFrom = typeof parsed.launchedFrom === "string" ? parsed.launchedFrom : "general";
    const chapterRef = typeof parsed.chapterRef === "string" ? parsed.chapterRef : "";
    const chaptersInContext = Array.isArray(parsed.chaptersInContext)
      ? (parsed.chaptersInContext as unknown[]).filter((x): x is string => typeof x === "string")
      : [];
    const summary = typeof parsed.summary === "string" ? parsed.summary : "";
    const memoryTopic = typeof parsed.memoryTopic === "string" ? parsed.memoryTopic : "Story chat session";
    const memoryBody = typeof parsed.memoryBody === "string" ? parsed.memoryBody : summary;
    const memoryAssociation = (parsed.memoryAssociation ?? { kind: "book" }) as StoryMemoryAssociation;
    const metadataActionIds = Array.isArray(parsed.metadataActionIds)
      ? (parsed.metadataActionIds as unknown[]).filter((x): x is string => typeof x === "string")
      : [];
    if (!sessionId || !startedAt || !endedAt) {
      await vscode.window.showWarningMessage("Story chat summary was not saved.");
      return;
    }
    const chatLog: StoryChatLogSummary = {
      sessionId,
      startedAt,
      endedAt,
      launchedFrom,
      chapterRef,
      chaptersInContext,
      summary,
      memoryEntryIds: [],
      metadataActionIds,
    };
    try {
      const { chatLogPath } = await saveStoryChatSessionSummary(rootPath, safeFileSystem, {
        chatLog,
        memoryTopic,
        memoryBody,
        memoryAssociation,
      });
      await vscode.window.showInformationMessage(`Saved to story memory. (${chatLogPath})`);
    } catch {
      await vscode.window.showWarningMessage("Story chat summary was not saved.");
    }
  });

  const openStoryMemoryCommand = vscode.commands.registerCommand("leanquill.openStoryMemory", async () => {
    const records = await listStoryMemory(rootPath);
    if (records.length === 0) {
      await vscode.window.showInformationMessage(
        "No story memory yet. Start a story chat to preserve session summaries and decisions as LeanQuill memory.",
      );
      return;
    }
    const pick = await vscode.window.showQuickPick(
      records.map((r) => ({
        label: r.topic,
        description: `${storyMemoryToContext(r).associationLabel} — ${r.status === "active" ? "Current" : r.status}`,
        detail: `${r.sourceChatId} — ${r.updatedAt}`,
        r,
      })),
      { placeHolder: "Open a story memory record" },
    );
    if (!pick || !("r" in pick)) {
      return;
    }
    const abs = path.join(rootPath, ".leanquill", "memory", (pick as { r: (typeof records)[0] }).r.fileName);
    const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(abs));
    await vscode.window.showTextDocument(doc);
  });

  const selectCharacterInPanelCommand = vscode.commands.registerCommand(
    "leanquill.selectCharacterInPanel",
    async (fileName: string) => {
      await planningPanel.showCharacter(fileName);
    },
  );

  const newCharacterCommand = vscode.commands.registerCommand("leanquill.newCharacter", async () => {
    const name = await vscode.window.showInputBox({ prompt: "Character name", placeHolder: "e.g. Jane Doe" });
    if (!name?.trim()) {
      return;
    }
    const latestConfig = await readProjectConfigWithDefaults(rootPath);
    try {
      await createCharacter(name.trim(), rootPath, latestConfig, safeFileSystem);
      await planningPanel.refresh();
      characterTreeProvider.refresh();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`LeanQuill: Failed to create character: ${message}`);
    }
  });

  const selectPlaceInPanelCommand = vscode.commands.registerCommand(
    "leanquill.selectPlaceInPanel",
    async (fileName: string) => {
      await planningPanel.showPlace(fileName);
    },
  );

  const newPlaceCommand = vscode.commands.registerCommand("leanquill.newPlace", async () => {
    const name = await vscode.window.showInputBox({ prompt: "Place name", placeHolder: "e.g. The Old Mill" });
    if (!name?.trim()) {
      return;
    }
    const latestConfig = await readProjectConfigWithDefaults(rootPath);
    try {
      const profile = await createPlace(name.trim(), rootPath, latestConfig, safeFileSystem);
      placeTreeProvider.refresh();
      await planningPanel.show();
      await planningPanel.showPlace(profile.fileName);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`LeanQuill: Failed to create place: ${message}`);
    }
  });

  const newThreadCommand = vscode.commands.registerCommand("leanquill.newThread", async () => {
    const title = await vscode.window.showInputBox({
      prompt: "Thread title",
      placeHolder: "e.g. Main mystery arc",
    });
    if (!title?.trim()) {
      return;
    }
    const latestConfig = await readProjectConfigWithDefaults(rootPath);
    try {
      await createThread(title.trim(), rootPath, latestConfig, safeFileSystem);
      await planningPanel.showThreads();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`LeanQuill: Failed to create thread: ${message}`);
    }
  });

  const newThemeCommand = vscode.commands.registerCommand("leanquill.newTheme", async () => {
    try {
      let doc = await readThemesDocument(rootPath);
      const { doc: updated } = addCentralThemeEntry(doc);
      await writeThemesDocument(rootPath, updated, safeFileSystem);
      await planningPanel.showThemes();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`LeanQuill: Failed to add theme: ${message}`);
    }
  });

  const newOpenQuestionCommand = vscode.commands.registerCommand("leanquill.newOpenQuestion", async () => {
    try {
      const fields = await promptNewIssueTitleAndType(vscode);
      if (!fields) {
        return;
      }
      const rec = await createOpenQuestion(safeFileSystem, rootPath, {
        title: fields.title,
        association: { kind: "book" },
        issueType: fields.issueType,
      });
      await planningPanel.showOpenQuestion(rec.id);
      await refreshOpenQuestionSurfaces();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      await vscode.window.showErrorMessage(`LeanQuill: ${message}`);
    }
  });

  const newOpenQuestionFromOutlineCommand = vscode.commands.registerCommand(
    "leanquill.newOpenQuestionFromOutline",
    async () => {
      await outlineWebviewProvider.newOpenQuestionFromOutlineRow();
    },
  );

  const newOpenQuestionFromChapterCommand = vscode.commands.registerCommand(
    "leanquill.newOpenQuestionFromChapter",
    async (args: { chapterPath?: string } | undefined) => {
      const chapterPath = normalizePath(String(args?.chapterPath ?? ""));
      if (!chapterPath.startsWith("manuscript/")) {
        await vscode.window.showErrorMessage(
          "New issues from the outline must target a manuscript chapter file.",
        );
        return;
      }
      const fields = await promptNewIssueTitleAndType(vscode);
      if (!fields) {
        return;
      }
      try {
        const rec = await createOpenQuestion(safeFileSystem, rootPath, {
          title: fields.title,
          association: { kind: "chapter", chapterRef: chapterPath },
          issueType: fields.issueType,
        });
        await planningPanel.showOpenQuestion(rec.id);
        await refreshOpenQuestionSurfaces();
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        await vscode.window.showErrorMessage(`LeanQuill: ${message}`);
      }
    },
  );

  const newOpenQuestionFromSelectionCommand = vscode.commands.registerCommand(
    "leanquill.newOpenQuestionFromSelection",
    async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        await vscode.window.showErrorMessage("Open a manuscript chapter in the editor first.");
        return;
      }
      const rel = vscode.workspace.asRelativePath(editor.document.uri, false);
      const chapter_ref = normalizePath(rel);
      if (!chapter_ref.startsWith("manuscript/")) {
        await vscode.window.showErrorMessage("Select a file under manuscript/ for this command.");
        return;
      }
      const span_hint = editor.document.getText(editor.selection);
      if (!span_hint.trim()) {
        await vscode.window.showErrorMessage("Select text in the manuscript to anchor this issue.");
        return;
      }
      const fields = await promptNewIssueTitleAndType(vscode);
      if (!fields) {
        return;
      }
      try {
        const rec = await createOpenQuestion(safeFileSystem, rootPath, {
          title: fields.title,
          association: { kind: "selection", chapterRef: chapter_ref, spanHint: span_hint },
          issueType: fields.issueType,
        });
        await planningPanel.showOpenQuestion(rec.id);
        await refreshOpenQuestionSurfaces();
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        await vscode.window.showErrorMessage(`LeanQuill: ${message}`);
      }
    },
  );

  const newOpenQuestionFromEntity = async (
    kind: "character" | "place" | "thread" | "research",
    fileName: string | undefined,
  ): Promise<void> => {
    if (!fileName?.trim()) {
      return;
    }
    const fields = await promptNewIssueTitleAndType(vscode);
    if (!fields) {
      return;
    }
    const association =
      kind === "character"
        ? ({ kind: "character" as const, fileName: fileName.trim() })
        : kind === "place"
          ? ({ kind: "place" as const, fileName: fileName.trim() })
          : kind === "research"
            ? ({ kind: "research" as const, fileName: fileName.trim() })
            : ({ kind: "thread" as const, fileName: fileName.trim() });
    try {
      const rec = await createOpenQuestion(safeFileSystem, rootPath, {
        title: fields.title,
        association,
        issueType: fields.issueType,
      });
      await planningPanel.showOpenQuestion(rec.id);
      await refreshOpenQuestionSurfaces();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      await vscode.window.showErrorMessage(`LeanQuill: ${message}`);
    }
  };

  const newOpenQuestionFromCharacterCommand = vscode.commands.registerCommand(
    "leanquill.newOpenQuestionFromCharacter",
    async (args: { fileName?: string } | undefined) => newOpenQuestionFromEntity("character", args?.fileName),
  );

  const newOpenQuestionFromPlaceCommand = vscode.commands.registerCommand(
    "leanquill.newOpenQuestionFromPlace",
    async (args: { fileName?: string } | undefined) => newOpenQuestionFromEntity("place", args?.fileName),
  );

  const newOpenQuestionFromThreadCommand = vscode.commands.registerCommand(
    "leanquill.newOpenQuestionFromThread",
    async (args: { fileName?: string } | undefined) => newOpenQuestionFromEntity("thread", args?.fileName),
  );

  const newOpenQuestionFromResearchCommand = vscode.commands.registerCommand(
    "leanquill.newOpenQuestionFromResearch",
    async (item?: ResearchItem) => {
      const base = item?.filePath ? path.basename(item.filePath) : undefined;
      await newOpenQuestionFromEntity("research", base);
    },
  );

  const openQuestionTargetCommand = vscode.commands.registerCommand(
    "leanquill.openQuestionTarget",
    async (questionIdArg: string | undefined) => {
      const questionId = String(questionIdArg ?? "");
      if (!questionId) {
        return;
      }
      const question = await getOpenQuestion(rootPath, questionId);
      if (!question) {
        await vscode.window.showWarningMessage("That open question was not found.");
        return;
      }
      const pc = await readProjectConfigWithDefaults(rootPath);
      // Navigation reads lq_assoc_kind plus lq_character_file / lq_place_file / lq_thread_file / chapter_ref / span_hint from disk via getOpenQuestion.
      const lq_assoc_kind = question.association.kind;
      if (lq_assoc_kind === "book") {
        await vscode.commands.executeCommand("leanquill.openPlanningWorkspace");
        await planningPanel.revealOpenQuestionRow(question.id);
        return;
      }
      if (lq_assoc_kind === "character") {
        const lq_character_file = question.association.fileName;
        const relBase = pc.folders.characters.replace(/\/+$/g, "");
        const absPath = path.join(rootPath, ...relBase.split("/"), lq_character_file);
        const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(absPath));
        await vscode.window.showTextDocument(doc);
        return;
      }
      if (lq_assoc_kind === "place") {
        const lq_place_file = question.association.fileName;
        const relBase = pc.folders.settings.replace(/\/+$/g, "");
        const absPath = path.join(rootPath, ...relBase.split("/"), lq_place_file);
        const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(absPath));
        await vscode.window.showTextDocument(doc);
        return;
      }
      if (lq_assoc_kind === "thread") {
        const lq_thread_file = question.association.fileName;
        const relBase = pc.folders.threads.replace(/\/+$/g, "");
        const absPath = path.join(rootPath, ...relBase.split("/"), lq_thread_file);
        const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(absPath));
        await vscode.window.showTextDocument(doc);
        return;
      }
      if (lq_assoc_kind === "research") {
        const lq_research_file = question.association.fileName;
        const relBase = pc.folders.research.replace(/\/+$/g, "");
        const absPath = path.join(rootPath, ...relBase.split("/"), lq_research_file);
        const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(absPath));
        await vscode.window.showTextDocument(doc);
        return;
      }
      const assoc = question.association;
      if (assoc.kind === "chapter" || assoc.kind === "selection") {
        const chapter_ref = normalizePath(assoc.chapterRef);
        const span_hint = assoc.kind === "selection" ? assoc.spanHint : "";
        const absMs = path.join(rootPath, ...chapter_ref.split("/"));
        const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(absMs));
        const editor = await vscode.window.showTextDocument(doc);
        if (span_hint) {
          const needle = span_hint.replace(/^["']|["']$/g, "").trim();
          if (needle.length > 0) {
            const full = doc.getText();
            const idx = full.indexOf(needle);
            if (idx >= 0) {
              const start = doc.positionAt(idx);
              const end = doc.positionAt(idx + needle.length);
              editor.selection = new vscode.Selection(start, end);
              editor.revealRange(new vscode.Range(start, end), vscode.TextEditorRevealType.InCenter);
            }
          }
        }
      }
    },
  );

  const placesTreeView = vscode.window.createTreeView("leanquill.places", {
    treeDataProvider: placeTreeProvider,
    dragAndDropController: placeTreeProvider,
    showCollapseAll: true,
  });
  placeTreeProvider.attachTreeView(placesTreeView);

  context.subscriptions.push(
    vscode.window.registerTreeDataProvider("leanquill.actions", setupViewProvider),
    vscode.window.registerWebviewViewProvider("leanquill.outlineTree", outlineWebviewProvider, {
      webviewOptions: { retainContextWhenHidden: true },
    }),
    vscode.window.registerWebviewViewProvider("leanquill.chapterContext", outlineContextProvider, {
      webviewOptions: { retainContextWhenHidden: true },
    }),
    vscode.window.registerWebviewViewProvider(OpenQuestionsPanelViewProvider.viewId, openQuestionsPanelProvider, {
      webviewOptions: { retainContextWhenHidden: true },
    }),
    vscode.window.registerTreeDataProvider("leanquill.research", researchTreeProvider),
    vscode.window.registerTreeDataProvider("leanquill.characters", characterTreeProvider),
    placesTreeView,
    researchWatcher,
    charactersWatcher,
    threadsWatcher,
    settingsWatcher,
    issuesMarkdownWatcher,
    startResearchCommand,
    startImportResearchCommand,
    startStoryChatCommand,
    chatAboutIssueCommand,
    chatAboutChapterCommand,
    chatAboutSelectionCommand,
    chatAboutCharacterCommand,
    chatAboutPlaceCommand,
    chatAboutThreadCommand,
    chatAboutThemeCommand,
    chatAboutResearchCommand,
    applyMetadataActionCommand,
    saveStoryChatSummaryCommand,
    openStoryMemoryCommand,
    newCharacterCommand,
    newPlaceCommand,
    newThreadCommand,
    newThemeCommand,
    selectCharacterInPanelCommand,
    selectPlaceInPanelCommand,
    newOpenQuestionCommand,
    newOpenQuestionFromOutlineCommand,
    newOpenQuestionFromChapterCommand,
    newOpenQuestionFromSelectionCommand,
    newOpenQuestionFromCharacterCommand,
    newOpenQuestionFromPlaceCommand,
    newOpenQuestionFromThreadCommand,
    newOpenQuestionFromResearchCommand,
    openQuestionTargetCommand,
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
    return outlineWebviewProvider.getOutlineInteractionNodeId();
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
  const openPlanningWorkspaceCommand = vscode.commands.registerCommand(
    "leanquill.openPlanningWorkspace",
    async (opts?: { tab?: "cards" }) => {
      if (!planningPanel) {
        return;
      }
      if (opts?.tab === "cards") {
        await planningPanel.showCards();
      } else {
        await planningPanel.show();
      }
    },
  );

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
  const projectYamlSetupWatcher = vscode.workspace.createFileSystemWatcher(
    new vscode.RelativePattern(rootPath, ".leanquill/project.yaml"),
  );

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

  // Book.txt watcher — refresh Setup context when scaffold appears/disappears; detect external edits
  bookTxtWatcher.onDidCreate(() => scheduleWorkspaceContextRefresh());
  bookTxtWatcher.onDidDelete(() => scheduleWorkspaceContextRefresh());
  bookTxtWatcher.onDidChange(async () => {
    scheduleWorkspaceContextRefresh();
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

  projectYamlSetupWatcher.onDidCreate(() => scheduleWorkspaceContextRefresh());
  projectYamlSetupWatcher.onDidChange(() => scheduleWorkspaceContextRefresh());
  projectYamlSetupWatcher.onDidDelete(() => scheduleWorkspaceContextRefresh());

  // Manuscript scan listeners — update character references when manuscript files are saved/opened
  const scanManuscriptFile = async (filePath: string): Promise<void> => {
    try {
      const rel = path.relative(rootPath, filePath).replace(/\\/g, "/");
      if (!rel.startsWith("manuscript/") || !rel.endsWith(".md")) {
        return;
      }
      const latestConfig = await readProjectConfigWithDefaults(rootPath);
      await scanManuscriptFileForCharacters(filePath, rootPath, latestConfig, safeFileSystem);
      await scanManuscriptFileForPlaces(filePath, rootPath, latestConfig, safeFileSystem);
      await planningPanel.refresh();
      characterTreeProvider.refresh();
      placeTreeProvider.refresh();
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
    projectYamlSetupWatcher,
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

/**
 * VS Code disposes `ExtensionContext.subscriptions` on shutdown, which runs
 * `IssueGutterController.dispose()` (decoration types + command registration).
 */
export function deactivate(): void {}

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
    "LeanQuill detected manuscript files in this folder. Initialize the workspace for LeanQuill?",
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
