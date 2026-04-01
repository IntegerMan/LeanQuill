import * as crypto from "node:crypto";
import type * as VSCode from "vscode";
import { readOutlineIndex, writeOutlineIndex } from "./outlineStore";
import { renderPlanningHtml } from "./planningPanelHtml";
import { SafeFileSystem } from "./safeFileSystem";
import { OutlineBeat, OutlineIndex } from "./types";

function findBeatInIndex(
  index: OutlineIndex,
  beatId: string,
): { beat: OutlineBeat; partIdx: number; chapterIdx: number; beatIdx: number } | undefined {
  for (let pi = 0; pi < index.parts.length; pi++) {
    const part = index.parts[pi];
    for (let ci = 0; ci < part.chapters.length; ci++) {
      const chapter = part.chapters[ci];
      for (let bi = 0; bi < chapter.beats.length; bi++) {
        if (chapter.beats[bi].id === beatId) {
          return { beat: chapter.beats[bi], partIdx: pi, chapterIdx: ci, beatIdx: bi };
        }
      }
    }
  }
  return undefined;
}

export class PlanningPanelProvider {
  private _panel: VSCode.WebviewPanel | undefined;
  private _activeTab = "outline";
  private _debounceTimer: ReturnType<typeof setTimeout> | undefined;

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
      if (this._debounceTimer) {
        clearTimeout(this._debounceTimer);
        this._debounceTimer = undefined;
      }
    });

    this._panel.webview.onDidReceiveMessage((msg) => this._handleMessage(msg));

    await this._renderPanel();
  }

  public async refresh(): Promise<void> {
    await this._renderPanel();
  }

  public dispose(): void {
    if (this._debounceTimer) {
      clearTimeout(this._debounceTimer);
      this._debounceTimer = undefined;
    }
    if (this._panel) {
      this._panel.dispose();
      this._panel = undefined;
    }
  }

  private async _renderPanel(): Promise<void> {
    if (!this._panel) {
      return;
    }

    const index = await readOutlineIndex(this.rootPath);
    const nonce = crypto.randomBytes(16).toString("hex");
    const cspSource = this._panel.webview.cspSource;
    this._panel.webview.html = renderPlanningHtml(index, nonce, cspSource, this._activeTab);
  }

  private async _handleMessage(msg: Record<string, unknown>): Promise<void> {
    const type = msg.type as string;

    switch (type) {
      case "tab:switch":
        this._activeTab = msg.tabId as string;
        break;

      case "beat:updateField":
        await this._updateBeatField(msg.beatId as string, msg.field as string, msg.value as string);
        break;

      case "beat:openInEditor":
        await this.vscodeApi.commands.executeCommand("leanquill.openBeatInEditor", msg.beatId as string);
        break;

      case "beat:toggleActive":
        await this._toggleBeatActive(msg.beatId as string);
        break;

      case "beat:addCustomField":
        await this._addCustomField(msg.beatId as string, msg.fieldName as string);
        break;
    }
  }

  private async _updateBeatField(beatId: string, field: string, value: string): Promise<void> {
    const index = await readOutlineIndex(this.rootPath);
    const found = findBeatInIndex(index, beatId);
    if (!found) {
      return;
    }

    if (field.startsWith("custom:")) {
      const customKey = field.slice(7);
      found.beat.customFields[customKey] = value;
    } else if (field === "title" || field === "description") {
      (found.beat as Record<string, unknown>)[field] = value;
    }

    // Debounced write (D-28: 300ms)
    if (this._debounceTimer) {
      clearTimeout(this._debounceTimer);
    }
    this._debounceTimer = setTimeout(async () => {
      await writeOutlineIndex(this.rootPath, index, this.safeFs);
    }, 300);
  }

  private async _toggleBeatActive(beatId: string): Promise<void> {
    const index = await readOutlineIndex(this.rootPath);
    const found = findBeatInIndex(index, beatId);
    if (!found) {
      return;
    }

    found.beat.active = !found.beat.active;
    await writeOutlineIndex(this.rootPath, index, this.safeFs);
    await this._renderPanel();
  }

  private async _addCustomField(beatId: string, fieldName: string): Promise<void> {
    const index = await readOutlineIndex(this.rootPath);
    const found = findBeatInIndex(index, beatId);
    if (!found) {
      return;
    }

    found.beat.customFields[fieldName] = "";
    await writeOutlineIndex(this.rootPath, index, this.safeFs);
    await this._renderPanel();
  }
}
