import * as crypto from "node:crypto";
import * as path from "node:path";
import type * as VSCode from "vscode";
import { readOutlineIndex, writeOutlineIndex, findNodeById } from "./outlineStore";
import { renderPlanningHtml } from "./planningPanelHtml";
import { SafeFileSystem } from "./safeFileSystem";
import { OutlineNode, OutlineIndex, ChapterStatus, CharacterProfile } from "./types";
import { readProjectConfig } from "./projectConfig";
import { listCharacters, createCharacter, saveCharacter, deleteCharacter } from "./characterStore";

export class PlanningPanelProvider {
  private _panel: VSCode.WebviewPanel | undefined;
  private _activeTab = "outline";
  private _debounceTimer: ReturnType<typeof setTimeout> | undefined;
  private _pendingIndex: OutlineIndex | undefined;
  private _selectedCharacterFileName: string | undefined;
  private _pendingCharacter: CharacterProfile | undefined;
  private _charDebounceTimer: ReturnType<typeof setTimeout> | undefined;

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
        await this._flushPendingCharacter();
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

  public async dispose(): Promise<void> {
    if (this._debounceTimer) {
      clearTimeout(this._debounceTimer);
      this._debounceTimer = undefined;
    }
    if (this._pendingIndex) {
      await writeOutlineIndex(this.rootPath, this._pendingIndex, this.safeFs);
      this._pendingIndex = undefined;
    }
    await this._flushPendingCharacter();
    if (this._panel) {
      this._panel.dispose();
      this._panel = undefined;
    }
  }

  private async _flushPendingCharacter(): Promise<void> {
    if (this._charDebounceTimer) {
      clearTimeout(this._charDebounceTimer);
      this._charDebounceTimer = undefined;
    }
    if (this._pendingCharacter) {
      const config = await readProjectConfig(this.rootPath) ?? {
        schemaVersion: "1",
        folders: { research: "research/leanquill/", characters: "notes/characters/" },
      };
      await saveCharacter(this._pendingCharacter, this.rootPath, config, this.safeFs);
      this._pendingCharacter = undefined;
    }
  }

  private async _renderPanel(): Promise<void> {
    if (!this._panel) {
      return;
    }

    const index = await readOutlineIndex(this.rootPath);
    const config = await readProjectConfig(this.rootPath) ?? {
      schemaVersion: "1",
      folders: { research: "research/leanquill/", characters: "notes/characters/" },
    };
    const characters = await listCharacters(this.rootPath, config);
    // Reset selection if selected character was deleted
    if (
      this._selectedCharacterFileName &&
      !characters.find((c) => c.fileName === this._selectedCharacterFileName)
    ) {
      this._selectedCharacterFileName = undefined;
    }
    const nonce = crypto.randomBytes(16).toString("hex");
    const cspSource = this._panel.webview.cspSource;
    this._panel.webview.html = renderPlanningHtml(
      index, characters, this._selectedCharacterFileName, nonce, cspSource, this._activeTab,
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
        await this._updateCharacterField(
          msg.fileName as string,
          msg.field as string,
          msg.value as string,
        );
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
    }
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
    const config = await readProjectConfig(this.rootPath) ?? {
      schemaVersion: "1",
      folders: { research: "research/leanquill/", characters: "notes/characters/" },
    };
    const profile = await createCharacter(name.trim(), this.rootPath, config, this.safeFs);
    this._selectedCharacterFileName = profile.fileName;
    await this._renderPanel();
  }

  private async _updateCharacterField(
    fileName: string,
    field: string,
    value: string,
  ): Promise<void> {
    if (!this._pendingCharacter || this._pendingCharacter.fileName !== fileName) {
      const config = await readProjectConfig(this.rootPath) ?? {
        schemaVersion: "1",
        folders: { research: "research/leanquill/", characters: "notes/characters/" },
      };
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
        const config = await readProjectConfig(this.rootPath) ?? {
          schemaVersion: "1",
          folders: { research: "research/leanquill/", characters: "notes/characters/" },
        };
        await saveCharacter(profileToWrite, this.rootPath, config, this.safeFs);
        this._pendingCharacter = undefined;
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
    const config = await readProjectConfig(this.rootPath) ?? {
      schemaVersion: "1",
      folders: { research: "research/leanquill/", characters: "notes/characters/" },
    };
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
    const config = await readProjectConfig(this.rootPath) ?? {
      schemaVersion: "1",
      folders: { research: "research/leanquill/", characters: "notes/characters/" },
    };
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
    const config = await readProjectConfig(this.rootPath) ?? {
      schemaVersion: "1",
      folders: { research: "research/leanquill/", characters: "notes/characters/" },
    };
    const charsDir = config.folders.characters.replace(/\/+$/, "");
    const filePath = path.join(this.rootPath, ...charsDir.split("/"), fileName);
    await this.vscodeApi.commands.executeCommand("vscode.open", this.vscodeApi.Uri.file(filePath));
  }

}