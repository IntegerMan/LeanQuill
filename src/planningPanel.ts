import * as crypto from "node:crypto";
import * as path from "node:path";
import type * as VSCode from "vscode";
import { resolveChapterOrder } from "./chapterOrder";
import { listCharacters, createCharacter, saveCharacter, deleteCharacter } from "./characterStore";
import { buildChapterPickerOptions } from "./chapterPickerOptions";
import { readOutlineIndex, writeOutlineIndex, findNodeById } from "./outlineStore";
import { renderPlanningHtml } from "./planningPanelHtml";
import {
  readProjectConfigWithDefaults,
  readProjectIdentity,
  readProjectYamlRaw,
  patchProjectIdentityInYaml,
} from "./projectConfig";
import { SafeFileSystem } from "./safeFileSystem";
import {
  listThreads,
  createThread,
  saveThread,
  deleteThread,
} from "./threadStore";
import {
  readThemesDocument,
  writeThemesDocument,
  addCentralThemeEntry,
} from "./themesStore";
import { OutlineNode, OutlineIndex, ChapterStatus, CharacterProfile, ThemesDocument, ThreadProfile } from "./types";

export class PlanningPanelProvider {
  private _panel: VSCode.WebviewPanel | undefined;
  private _activeTab = "themes";
  private _debounceTimer: ReturnType<typeof setTimeout> | undefined;
  private _pendingIndex: OutlineIndex | undefined;
  private _selectedCharacterFileName: string | undefined;
  private _pendingCharacter: CharacterProfile | undefined;
  private _charDebounceTimer: ReturnType<typeof setTimeout> | undefined;
  private _charUpdateLock: Promise<void> = Promise.resolve();

  private _pendingThemes: ThemesDocument | undefined;
  private _themeDebounceTimer: ReturnType<typeof setTimeout> | undefined;

  private _projectIdentityDebounceTimer: ReturnType<typeof setTimeout> | undefined;

  private _selectedThreadFileName: string | undefined;
  private _pendingThread: ThreadProfile | undefined;
  private _threadDebounceTimer: ReturnType<typeof setTimeout> | undefined;
  private _threadUpdateLock: Promise<void> = Promise.resolve();

  constructor(
    private readonly vscodeApi: typeof VSCode,
    private readonly extensionUri: VSCode.Uri,
    private readonly rootPath: string,
    private readonly safeFs: SafeFileSystem,
  ) {}

  public async show(): Promise<void> {
    const vscode = this.vscodeApi;

    if (this._panel) {
      this._panel.reveal(vscode.ViewColumn.One);
      return;
    }

    this._panel = vscode.window.createWebviewPanel(
      "leanquill.planningWorkspace",
      "Planning Workspace",
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [this.extensionUri],
      },
    );

    this._panel.onDidDispose(() => {
      this._panel = undefined;
      (async () => {
        if (this._debounceTimer) {
          clearTimeout(this._debounceTimer);
          this._debounceTimer = undefined;
        }
        if (this._pendingIndex) {
          await writeOutlineIndex(this.rootPath, this._pendingIndex, this.safeFs);
          this._pendingIndex = undefined;
        }
        await this._flushPendingTheme();
        await this._flushPendingProjectIdentity();
        await this._flushPendingCharacter();
        await this._flushPendingThread();
      })().catch((err: unknown) => {
        console.error('[LeanQuill] Failed to flush pending state on dispose', err);
      });
    });

    this._panel.webview.onDidReceiveMessage((msg) => this._handleMessage(msg));

    await this._renderPanel();
  }

  public async refresh(): Promise<void> {
    await this._renderPanel();
  }

  public async showCharacter(fileName: string): Promise<void> {
    this._activeTab = "characters";
    this._selectedCharacterFileName = fileName;
    if (this._panel) {
      this._panel.reveal(this.vscodeApi.ViewColumn.One);
      await this._renderPanel();
    } else {
      await this.show();
    }
  }

  public async showCards(): Promise<void> {
    this._activeTab = "cards";
    this._selectedCharacterFileName = undefined;
    if (this._panel) {
      this._panel.reveal(this.vscodeApi.ViewColumn.One);
      await this._renderPanel();
    } else {
      await this.show();
    }
  }

  public async showThemes(): Promise<void> {
    this._activeTab = "themes";
    this._selectedThreadFileName = undefined;
    if (this._panel) {
      this._panel.reveal(this.vscodeApi.ViewColumn.One);
      await this._renderPanel();
    } else {
      await this.show();
    }
  }

  public async showThreads(): Promise<void> {
    this._activeTab = "threads";
    if (this._panel) {
      this._panel.reveal(this.vscodeApi.ViewColumn.One);
      await this._renderPanel();
    } else {
      await this.show();
    }
  }

  public async dispose(): Promise<void> {
    if (this._debounceTimer) {
      clearTimeout(this._debounceTimer);
      this._debounceTimer = undefined;
    }
    if (this._pendingIndex) {
      await writeOutlineIndex(this.rootPath, this._pendingIndex, this.safeFs);
      this._pendingIndex = undefined;
    }
    await this._flushPendingTheme();
    await this._flushPendingProjectIdentity();
    await this._flushPendingCharacter();
    await this._flushPendingThread();
    if (this._panel) {
      this._panel.dispose();
      this._panel = undefined;
    }
  }

  private async _flushPendingTheme(): Promise<void> {
    if (this._themeDebounceTimer) {
      clearTimeout(this._themeDebounceTimer);
      this._themeDebounceTimer = undefined;
    }
    if (this._pendingThemes) {
      try {
        await writeThemesDocument(this.rootPath, this._pendingThemes, this.safeFs);
      } catch (err: unknown) {
        console.error("[LeanQuill] Failed to flush themes document", err);
      }
      this._pendingThemes = undefined;
    }
  }

  private _scheduleThemeWrite(): void {
    if (this._themeDebounceTimer) {
      clearTimeout(this._themeDebounceTimer);
    }
    if (!this._pendingThemes) {
      return;
    }
    this._themeDebounceTimer = setTimeout(() => {
      this._themeDebounceTimer = undefined;
      const latest = this._pendingThemes;
      if (!latest) {
        return;
      }
      writeThemesDocument(this.rootPath, latest, this.safeFs).catch((err: unknown) => {
        console.error("[LeanQuill] Failed to save themes", err);
      });
    }, 300);
  }

  private _projIdentityAcc: { workingTitle?: string; genresCsv?: string } = {};

  private async _flushPendingProjectIdentity(): Promise<void> {
    if (this._projectIdentityDebounceTimer) {
      clearTimeout(this._projectIdentityDebounceTimer);
      this._projectIdentityDebounceTimer = undefined;
    }
    await this._doWriteProjectIdentity();
  }

  private _scheduleProjectIdentityWrite(partial: { workingTitle?: string; genresCsv?: string }): void {
    if (partial.workingTitle !== undefined) {
      this._projIdentityAcc.workingTitle = partial.workingTitle;
    }
    if (partial.genresCsv !== undefined) {
      this._projIdentityAcc.genresCsv = partial.genresCsv;
    }
    if (this._projectIdentityDebounceTimer) {
      clearTimeout(this._projectIdentityDebounceTimer);
    }
    this._projectIdentityDebounceTimer = setTimeout(() => {
      this._projectIdentityDebounceTimer = undefined;
      void this._doWriteProjectIdentity();
    }, 300);
  }

  private async _doWriteProjectIdentity(): Promise<void> {
    const acc = { ...this._projIdentityAcc };
    if (acc.workingTitle === undefined && acc.genresCsv === undefined) {
      return;
    }
    this._projIdentityAcc = {};
    const raw = await readProjectYamlRaw(this.rootPath);
    if (!raw) {
      return;
    }
    const patch: { workingTitle?: string; genres?: string[] } = {};
    if (acc.workingTitle !== undefined) {
      patch.workingTitle = acc.workingTitle;
    }
    if (acc.genresCsv !== undefined) {
      const parts = acc.genresCsv.split(",").map((s) => s.trim()).filter(Boolean);
      patch.genres = parts.length > 0 ? parts : ["fiction"];
    }
    try {
      const next = patchProjectIdentityInYaml(raw, patch);
      await this.safeFs.writeFile(path.join(this.rootPath, ".leanquill", "project.yaml"), next);
    } catch (err: unknown) {
      console.error("[LeanQuill] Failed to save project.yaml identity fields", err);
    }
  }

  private async _flushPendingCharacter(): Promise<void> {
    if (this._charDebounceTimer) {
      clearTimeout(this._charDebounceTimer);
      this._charDebounceTimer = undefined;
    }
    if (this._pendingCharacter) {
      const config = await readProjectConfigWithDefaults(this.rootPath);
      await saveCharacter(this._pendingCharacter, this.rootPath, config, this.safeFs);
      this._pendingCharacter = undefined;
    }
  }

  private async _flushPendingThread(): Promise<void> {
    if (this._threadDebounceTimer) {
      clearTimeout(this._threadDebounceTimer);
      this._threadDebounceTimer = undefined;
    }
    if (this._pendingThread) {
      const config = await readProjectConfigWithDefaults(this.rootPath);
      await saveThread(this._pendingThread, this.rootPath, config, this.safeFs);
      this._pendingThread = undefined;
    }
  }

  private async _renderPanel(): Promise<void> {
    if (!this._panel) {
      return;
    }

    const index = await readOutlineIndex(this.rootPath);
    const config = await readProjectConfigWithDefaults(this.rootPath);
    const characters = await listCharacters(this.rootPath, config);
    const chapterOrder = await resolveChapterOrder(this.rootPath);
    const chapterPickerOptions = buildChapterPickerOptions(index, chapterOrder);
    const themes = this._pendingThemes ?? await readThemesDocument(this.rootPath);
    const projectIdentity = await readProjectIdentity(this.rootPath);
    const threads = await listThreads(this.rootPath, config);
    // Reset selection if selected character was deleted
    if (
      this._selectedCharacterFileName &&
      !characters.find((c) => c.fileName === this._selectedCharacterFileName)
    ) {
      this._selectedCharacterFileName = undefined;
    }
    if (
      this._selectedThreadFileName &&
      !threads.find((t) => t.fileName === this._selectedThreadFileName)
    ) {
      this._selectedThreadFileName = undefined;
    }
    const nonce = crypto.randomBytes(16).toString("hex");
    const cspSource = this._panel.webview.cspSource;
    this._panel.webview.html = renderPlanningHtml(
      index,
      characters,
      this._selectedCharacterFileName,
      themes,
      threads,
      this._selectedThreadFileName,
      chapterPickerOptions,
      projectIdentity.workingTitle,
      projectIdentity.genres.join(", "),
      nonce,
      cspSource,
      this._activeTab,
    );
  }

  private async _handleMessage(msg: Record<string, unknown>): Promise<void> {
    const type = msg.type as string;

    switch (type) {
      case "tab:switch":
        this._activeTab = msg.tabId as string;
        break;

      case "node:updateField":
        await this._updateNodeField(msg.nodeId as string, msg.field as string, msg.value as string);
        break;

      case "node:openInEditor":
        await this.vscodeApi.commands.executeCommand("leanquill.openNodeInEditor", msg.nodeId as string);
        break;

      case "node:toggleActive":
        await this._toggleNodeActive(msg.nodeId as string);
        break;

      case "node:addCustomField":
        await this._addCustomField(msg.nodeId as string, msg.fieldName as string);
        break;

      case "node:updateStatus":
        await this._updateNodeStatus(msg.nodeId as string, msg.status as string);
        break;

      case "character:select":
        this._selectedCharacterFileName = msg.fileName as string;
        await this._renderPanel();
        break;

      case "character:create":
        await this._createCharacter();
        break;

      case "character:updateField":
        this._charUpdateLock = this._charUpdateLock.catch(() => {}).then(() =>
          this._updateCharacterField(
            msg.fileName as string,
            msg.field as string,
            msg.value as string,
          ),
        );
        await this._charUpdateLock;
        break;

      case "character:addCustomField":
        await this._addCharacterCustomField(msg.fileName as string, msg.fieldName as string);
        break;

      case "character:delete":
        await this._deleteCharacter(msg.fileName as string);
        break;

      case "character:openInEditor":
        await this._openCharacterInEditor(msg.fileName as string);
        break;

      case "theme:updateBook":
        await this._themeUpdateBook(msg as Record<string, unknown>);
        break;

      case "theme:updateBookCustom":
        await this._themeUpdateBookCustom(msg.key as string, String(msg.value ?? ""));
        break;

      case "theme:updateTheme":
        await this._themeUpdateTheme(msg as Record<string, unknown>);
        break;

      case "theme:toggleThemeChapter":
        await this._themeToggleThemeChapter(msg.themeId as string, msg.path as string);
        break;

      case "theme:addTheme":
        await this._themeAddTheme();
        break;

      case "theme:updateBookTitle":
        this._scheduleProjectIdentityWrite({ workingTitle: String(msg.value ?? "") });
        break;

      case "theme:updateGenres":
        this._scheduleProjectIdentityWrite({ genresCsv: String(msg.value ?? "") });
        break;

      case "theme:promptAddBookField": {
        const name = await this.vscodeApi.window.showInputBox({
          prompt: "Book-level custom field name",
          placeHolder: "e.g. tone, era",
        });
        if (name?.trim()) {
          await this._themeUpdateBookCustom(name.trim(), "");
        }
        break;
      }

      case "theme:promptRemoveTheme": {
        const themeId = msg.themeId as string;
        if (!themeId) {
          break;
        }
        const choice = await this.vscodeApi.window.showWarningMessage(
          "Remove this central theme?",
          { modal: true },
          "Remove",
        );
        if (choice === "Remove") {
          await this._themeRemoveTheme(themeId);
        }
        break;
      }

      case "thread:select":
        this._selectedThreadFileName = msg.fileName as string;
        await this._renderPanel();
        break;

      case "thread:create":
        await this._createThread();
        break;

      case "thread:updateField":
        this._threadUpdateLock = this._threadUpdateLock.catch(() => {}).then(() =>
          this._updateThreadField(
            msg.fileName as string,
            msg.field as string,
            msg.value as string,
          ),
        );
        await this._threadUpdateLock;
        break;

      case "thread:addCustomField":
        await this._addThreadCustomField(msg.fileName as string, msg.fieldName as string);
        break;

      case "thread:delete":
        await this._deleteThread(msg.fileName as string);
        break;

      case "thread:setTouchesChapters":
        await this._setThreadTouchesChapters(msg.fileName as string, msg.paths as string[]);
        break;
    }
  }

  private async _themeUpdateBook(raw: Record<string, unknown>): Promise<void> {
    let doc = this._pendingThemes ?? await readThemesDocument(this.rootPath);
    if (typeof raw.centralQuestion === "string") {
      doc = { ...doc, centralQuestion: raw.centralQuestion };
    }
    if (typeof raw.bookSynopsis === "string") {
      doc = { ...doc, bookSynopsis: raw.bookSynopsis };
    }
    this._pendingThemes = doc;
    this._scheduleThemeWrite();
  }

  private async _themeUpdateBookCustom(key: string, value: string | undefined): Promise<void> {
    let doc = this._pendingThemes ?? await readThemesDocument(this.rootPath);
    doc = {
      ...doc,
      bookCustomFields: { ...doc.bookCustomFields, [key]: value ?? "" },
    };
    this._pendingThemes = doc;
    this._scheduleThemeWrite();
    await this._renderPanel();
  }

  private async _themeUpdateTheme(raw: Record<string, unknown>): Promise<void> {
    const themeId = raw.themeId as string;
    if (!themeId) {
      return;
    }
    let doc = this._pendingThemes ?? await readThemesDocument(this.rootPath);
    const nextThemes = doc.centralThemes.map((t) => {
      if (t.id !== themeId) {
        return t;
      }
      let u = { ...t };
      if (typeof raw.title === "string") {
        u = { ...u, title: raw.title };
      }
      if (typeof raw.summary === "string") {
        u = { ...u, summary: raw.summary };
      }
      if (typeof raw.notePath === "string") {
        u = { ...u, notePath: raw.notePath };
      }
      return u;
    });
    doc = { ...doc, centralThemes: nextThemes };
    this._pendingThemes = doc;
    this._scheduleThemeWrite();
  }

  private async _themeToggleThemeChapter(themeId: string, path: string): Promise<void> {
    let doc = this._pendingThemes ?? await readThemesDocument(this.rootPath);
    const nextThemes = doc.centralThemes.map((t) => {
      if (t.id !== themeId) {
        return t;
      }
      const set = new Set(t.linkedChapters);
      if (set.has(path)) {
        set.delete(path);
      } else {
        set.add(path);
      }
      return { ...t, linkedChapters: [...set] };
    });
    doc = { ...doc, centralThemes: nextThemes };
    this._pendingThemes = doc;
    this._scheduleThemeWrite();
    await this._renderPanel();
  }

  private async _themeAddTheme(): Promise<void> {
    if (this._themeDebounceTimer) {
      clearTimeout(this._themeDebounceTimer);
      this._themeDebounceTimer = undefined;
    }
    let doc = this._pendingThemes ?? await readThemesDocument(this.rootPath);
    const { doc: updated } = addCentralThemeEntry(doc);
    this._pendingThemes = updated;
    try {
      await writeThemesDocument(this.rootPath, updated, this.safeFs);
    } catch (err: unknown) {
      console.error("[LeanQuill] Failed to add theme", err);
      await this.vscodeApi.window.showErrorMessage("Could not save themes document.");
      return;
    }
    await this._renderPanel();
  }

  private async _themeRemoveTheme(themeId: string): Promise<void> {
    if (this._themeDebounceTimer) {
      clearTimeout(this._themeDebounceTimer);
      this._themeDebounceTimer = undefined;
    }
    let doc = this._pendingThemes ?? await readThemesDocument(this.rootPath);
    doc = { ...doc, centralThemes: doc.centralThemes.filter((t) => t.id !== themeId) };
    this._pendingThemes = doc;
    try {
      await writeThemesDocument(this.rootPath, doc, this.safeFs);
    } catch (err: unknown) {
      console.error("[LeanQuill] Failed to remove theme", err);
      await this.vscodeApi.window.showErrorMessage("Could not save themes document.");
      return;
    }
    await this._renderPanel();
  }

  private async _createThread(): Promise<void> {
    const title = await this.vscodeApi.window.showInputBox({
      prompt: "Thread title",
      placeHolder: "e.g. Main mystery arc",
    });
    if (!title?.trim()) {
      return;
    }
    const config = await readProjectConfigWithDefaults(this.rootPath);
    const profile = await createThread(title.trim(), this.rootPath, config, this.safeFs);
    this._selectedThreadFileName = profile.fileName;
    await this._renderPanel();
  }

  private async _updateThreadField(
    fileName: string,
    field: string,
    value: string,
  ): Promise<void> {
    if (this._pendingThread && this._pendingThread.fileName !== fileName) {
      await this._flushPendingThread();
    }
    if (!this._pendingThread || this._pendingThread.fileName !== fileName) {
      const config = await readProjectConfigWithDefaults(this.rootPath);
      const profiles = await listThreads(this.rootPath, config);
      const found = profiles.find((p) => p.fileName === fileName);
      if (!found) {
        return;
      }
      this._pendingThread = { ...found };
    }
    if (field.startsWith("custom:")) {
      const customKey = field.slice(7);
      this._pendingThread.customFields[customKey] = value;
    } else if (field === "title" || field === "body") {
      (this._pendingThread as Record<string, unknown>)[field] = value;
    }

    if (this._threadDebounceTimer) {
      clearTimeout(this._threadDebounceTimer);
    }
    const profileToWrite = this._pendingThread;
    this._threadDebounceTimer = setTimeout(() => {
      const doSave = async () => {
        const config = await readProjectConfigWithDefaults(this.rootPath);
        await saveThread(profileToWrite, this.rootPath, config, this.safeFs);
        if (this._pendingThread?.fileName === profileToWrite.fileName) {
          this._pendingThread = undefined;
        }
      };
      doSave().catch((err: unknown) => {
        console.error("[LeanQuill] Failed to save thread", err);
      });
    }, 300);
  }

  private async _addThreadCustomField(fileName: string, fieldName: string): Promise<void> {
    if (this._pendingThread && this._pendingThread.fileName !== fileName) {
      await this._flushPendingThread();
    } else if (this._threadDebounceTimer) {
      clearTimeout(this._threadDebounceTimer);
      this._threadDebounceTimer = undefined;
    }
    const RESERVED = new Set(["title", "touchesChapters", "body"]);
    const safeName = fieldName.trim().replace(/[^a-zA-Z0-9_]/g, "_");
    if (!safeName || RESERVED.has(safeName)) {
      const reason = !safeName
        ? "Field names must contain at least one alphanumeric character or underscore."
        : `"${fieldName}" is a reserved field name and cannot be used as a custom field.`;
      await this.vscodeApi.window.showErrorMessage(reason);
      return;
    }
    const config = await readProjectConfigWithDefaults(this.rootPath);
    let profile: ThreadProfile;
    if (this._pendingThread && this._pendingThread.fileName === fileName) {
      profile = this._pendingThread;
      this._pendingThread = undefined;
    } else {
      const profiles = await listThreads(this.rootPath, config);
      const found = profiles.find((p) => p.fileName === fileName);
      if (!found) {
        return;
      }
      profile = found;
    }
    profile.customFields[safeName] = "";
    await saveThread(profile, this.rootPath, config, this.safeFs);
    await this._renderPanel();
  }

  private async _deleteThread(fileName: string): Promise<void> {
    const config = await readProjectConfigWithDefaults(this.rootPath);
    if (this._pendingThread && this._pendingThread.fileName !== fileName) {
      await this._flushPendingThread();
    } else if (this._threadDebounceTimer) {
      clearTimeout(this._threadDebounceTimer);
      this._threadDebounceTimer = undefined;
    }
    if (this._pendingThread && this._pendingThread.fileName === fileName) {
      this._pendingThread = undefined;
    }
    await deleteThread(fileName, this.rootPath, config, this.safeFs);
    if (this._selectedThreadFileName === fileName) {
      this._selectedThreadFileName = undefined;
    }
    await this._renderPanel();
  }

  private async _setThreadTouchesChapters(fileName: string, paths: string[]): Promise<void> {
    if (this._pendingThread && this._pendingThread.fileName !== fileName) {
      await this._flushPendingThread();
    }
    const config = await readProjectConfigWithDefaults(this.rootPath);
    const profiles = await listThreads(this.rootPath, config);
    const found = profiles.find((p) => p.fileName === fileName);
    if (!found) {
      return;
    }
    if (this._threadDebounceTimer) {
      clearTimeout(this._threadDebounceTimer);
      this._threadDebounceTimer = undefined;
    }
    const base =
      this._pendingThread?.fileName === fileName ? this._pendingThread : found;
    if (this._pendingThread?.fileName === fileName) {
      this._pendingThread = undefined;
    }
    const normalized = paths.map((p) => p.replace(/\\/g, "/"));
    const next = { ...base, touchesChapters: normalized };
    await saveThread(next, this.rootPath, config, this.safeFs);
    await this._renderPanel();
  }

  private async _updateNodeField(nodeId: string, field: string, value: string): Promise<void> {
    if (!this._pendingIndex) {
      this._pendingIndex = await readOutlineIndex(this.rootPath);
    }
    const found = findNodeById(this._pendingIndex.nodes, nodeId);
    if (!found) {
      return;
    }

    if (field.startsWith("custom:")) {
      const customKey = field.slice(7);
      found.node.customFields[customKey] = value;
    } else if (field === "title" || field === "description") {
      (found.node as Record<string, unknown>)[field] = value;
    }

    // Debounced write (D-28: 300ms)
    if (this._debounceTimer) {
      clearTimeout(this._debounceTimer);
    }
    const indexToWrite = this._pendingIndex;
    this._debounceTimer = setTimeout(() => {
      writeOutlineIndex(this.rootPath, indexToWrite, this.safeFs)
        .then(() => { this._pendingIndex = undefined; })
        .catch((error: unknown) => { console.error("Failed to write outline index", error); });
    }, 300);
  }

  private async _toggleNodeActive(nodeId: string): Promise<void> {
    const index = await readOutlineIndex(this.rootPath);
    const found = findNodeById(index.nodes, nodeId);
    if (!found) {
      return;
    }

    found.node.active = !found.node.active;
    await writeOutlineIndex(this.rootPath, index, this.safeFs);
    await this._renderPanel();
  }

  private async _addCustomField(nodeId: string, fieldName: string): Promise<void> {
    const index = await readOutlineIndex(this.rootPath);
    const found = findNodeById(index.nodes, nodeId);
    if (!found) {
      return;
    }

    found.node.customFields[fieldName] = "";
    await writeOutlineIndex(this.rootPath, index, this.safeFs);
    await this._renderPanel();
  }

  private async _updateNodeStatus(nodeId: string, status: string): Promise<void> {
    const validStatuses: ChapterStatus[] = [
      "planning", "not-started", "drafting", "draft-complete", "editing", "review-pending", "final",
    ];
    if (!validStatuses.includes(status as ChapterStatus)) {
      return;
    }

    const index = await readOutlineIndex(this.rootPath);
    const found = findNodeById(index.nodes, nodeId);
    if (!found) {
      return;
    }

    found.node.status = status as ChapterStatus;
    await writeOutlineIndex(this.rootPath, index, this.safeFs);
  }

  private async _createCharacter(): Promise<void> {
    const name = await this.vscodeApi.window.showInputBox({
      prompt: "Character name",
      placeHolder: "e.g. Jane Doe",
    });
    if (!name?.trim()) { return; }
    const config = await readProjectConfigWithDefaults(this.rootPath);
    const profile = await createCharacter(name.trim(), this.rootPath, config, this.safeFs);
    this._selectedCharacterFileName = profile.fileName;
    await this._renderPanel();
  }

  private async _updateCharacterField(
    fileName: string,
    field: string,
    value: string,
  ): Promise<void> {
    if (this._pendingCharacter && this._pendingCharacter.fileName !== fileName) {
      await this._flushPendingCharacter();
    }
    if (!this._pendingCharacter || this._pendingCharacter.fileName !== fileName) {
      const config = await readProjectConfigWithDefaults(this.rootPath);
      const profiles = await listCharacters(this.rootPath, config);
      const found = profiles.find((p) => p.fileName === fileName);
      if (!found) { return; }
      this._pendingCharacter = { ...found };
    }
    if (field === "aliases") {
      this._pendingCharacter.aliases = value.split(",").map((s) => s.trim()).filter(Boolean);
    } else if (field.startsWith("custom:")) {
      const customKey = field.slice(7);
      this._pendingCharacter.customFields[customKey] = value;
    } else if (
      field === "name" || field === "role" || field === "description" || field === "body"
    ) {
      (this._pendingCharacter as Record<string, unknown>)[field] = value;
    }

    if (this._charDebounceTimer) { clearTimeout(this._charDebounceTimer); }
    const profileToWrite = this._pendingCharacter;
    this._charDebounceTimer = setTimeout(() => {
      const doSave = async () => {
        const config = await readProjectConfigWithDefaults(this.rootPath);
        await saveCharacter(profileToWrite, this.rootPath, config, this.safeFs);
        if (this._pendingCharacter?.fileName === profileToWrite.fileName) {
          this._pendingCharacter = undefined;
        }
      };
      doSave().catch((err: unknown) => {
        console.error("[LeanQuill] Failed to save character", err);
      });
    }, 300);
  }

  private async _addCharacterCustomField(fileName: string, fieldName: string): Promise<void> {
    if (this._pendingCharacter && this._pendingCharacter.fileName !== fileName) {
      await this._flushPendingCharacter();
    } else if (this._charDebounceTimer) {
      clearTimeout(this._charDebounceTimer);
      this._charDebounceTimer = undefined;
    }
    const RESERVED_KEYS = new Set(["name", "aliases", "role", "description", "referencedByNameIn", "body"]);
    const safeName = fieldName.trim().replace(/[^a-zA-Z0-9_]/g, "_");
    if (!safeName || RESERVED_KEYS.has(safeName)) {
      const reason = !safeName
        ? "Field names must contain at least one alphanumeric character or underscore."
        : `"${fieldName}" is a reserved field name and cannot be used as a custom field.`;
      await this.vscodeApi.window.showErrorMessage(reason);
      return;
    }
    const config = await readProjectConfigWithDefaults(this.rootPath);
    let profile: CharacterProfile;
    if (this._pendingCharacter && this._pendingCharacter.fileName === fileName) {
      profile = this._pendingCharacter;
      this._pendingCharacter = undefined;
    } else {
      const profiles = await listCharacters(this.rootPath, config);
      const found = profiles.find((p) => p.fileName === fileName);
      if (!found) { return; }
      profile = found;
    }
    profile.customFields[safeName] = "";
    await saveCharacter(profile, this.rootPath, config, this.safeFs);
    await this._renderPanel();
  }

  private async _deleteCharacter(fileName: string): Promise<void> {
    const config = await readProjectConfigWithDefaults(this.rootPath);
    const profiles = await listCharacters(this.rootPath, config);
    const profile = profiles.find((p) => p.fileName === fileName);
    const label = profile?.name || fileName.replace(/\.md$/, "");
    const choice = await this.vscodeApi.window.showWarningMessage(
      `Delete character "${label}"? This cannot be undone.`,
      { modal: true },
      "Delete",
    );
    if (choice !== "Delete") { return; }
    if (this._pendingCharacter && this._pendingCharacter.fileName !== fileName) {
      await this._flushPendingCharacter();
    } else if (this._charDebounceTimer) {
      clearTimeout(this._charDebounceTimer);
      this._charDebounceTimer = undefined;
    }
    if (this._pendingCharacter && this._pendingCharacter.fileName === fileName) {
      this._pendingCharacter = undefined;
    }
    await deleteCharacter(fileName, this.rootPath, config, this.safeFs);
    if (this._selectedCharacterFileName === fileName) {
      this._selectedCharacterFileName = undefined;
    }
    await this._renderPanel();
  }

  private async _openCharacterInEditor(fileName: string): Promise<void> {
    const config = await readProjectConfigWithDefaults(this.rootPath);
    const charsDir = config.folders.characters.replace(/\/+$/, "");
    const filePath = path.join(this.rootPath, ...charsDir.split("/"), fileName);
    await this.vscodeApi.commands.executeCommand("vscode.open", this.vscodeApi.Uri.file(filePath));
  }

}