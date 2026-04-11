import * as fs from "node:fs/promises";
import * as path from "node:path";
import type * as VSCode from "vscode";
import { countActiveQuestionsLinkedToEntity, listOpenQuestions } from "./openQuestionStore";

export interface ResearchItem {
  kind: "research";
  filePath: string;
  name: string;
  created: string;
  /** Open + deferred issues linked to this file (`lq_research_file` basename). */
  activeIssueCount: number;
}

export function parseFrontmatter(content: string): { name?: string; created?: string } {
  // Normalize CRLF so the regex works on Windows-authored files
  const normalized = content.replace(/\r\n/g, "\n");
  const match = /^---\n([\s\S]*?)\n---/.exec(normalized);
  if (!match) {
    return {};
  }
  const block = match[1];

  const nameMatch = /^name:\s*["']?(.+?)["']?\s*$/m.exec(block);
  const createdMatch = /^created:\s*["']?(.+?)["']?\s*$/m.exec(block);

  return {
    name: nameMatch ? nameMatch[1].trim() : undefined,
    created: createdMatch ? createdMatch[1].trim() : undefined,
  };
}

function deriveNameFromFilename(fileName: string): string {
  const baseName = path.basename(fileName, ".md");
  // Strip trailing date pattern like -2026-04-05
  const withoutDate = baseName.replace(/-\d{4}-\d{2}-\d{2}$/, "");
  const withSpaces = withoutDate.replaceAll(/[-_]+/g, " ").trim();
  return withSpaces.replaceAll(/\b\w/g, (c) => c.toUpperCase()) || baseName;
}

function formatCreatedDate(created: string): string {
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" };
  // For date-only values (YYYY-MM-DD), JS parses as UTC midnight which can display as the
  // previous day in negative-offset timezones. Format explicitly in UTC to avoid off-by-one.
  if (/^\d{4}-\d{2}-\d{2}$/.test(created)) {
    const date = new Date(`${created}T00:00:00Z`);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleDateString("en-US", { ...opts, timeZone: "UTC" });
    }
  }
  const date = new Date(created);
  if (Number.isNaN(date.getTime())) {
    return created;
  }
  return date.toLocaleDateString("en-US", opts);
}

export async function buildResearchItems(researchDir: string): Promise<ResearchItem[]> {
  let entries: string[];
  try {
    entries = await fs.readdir(researchDir);
  } catch {
    return [];
  }

  const mdFiles = entries.filter((e) => e.endsWith(".md"));

  const settled = await Promise.all(
    mdFiles.map(async (file): Promise<ResearchItem | null> => {
      const filePath = path.join(researchDir, file);
      let content: string;
      try {
        content = await fs.readFile(filePath, "utf8");
      } catch {
        return null;
      }

      const { name: fmName, created: fmCreated } = parseFrontmatter(content);

      let created = fmCreated;
      if (!created) {
        try {
          const stat = await fs.stat(filePath);
          created = stat.mtime.toISOString();
        } catch {
          created = new Date().toISOString();
        }
      }

      return {
        kind: "research",
        filePath,
        name: fmName ?? deriveNameFromFilename(file),
        created,
        activeIssueCount: 0,
      };
    }),
  );
  const items = settled.filter((item): item is ResearchItem => item !== null);

  // Sort newest first
  items.sort((a, b) => {
    const aTime = new Date(a.created).getTime();
    const bTime = new Date(b.created).getTime();
    return bTime - aTime;
  });

  return items;
}

export class ResearchTreeProvider implements VSCode.TreeDataProvider<ResearchItem> {
  private readonly _onDidChangeTreeData: VSCode.EventEmitter<void>;
  readonly onDidChangeTreeData: VSCode.Event<void>;

  constructor(
    private readonly vscode: typeof import("vscode"),
    /** Workspace root for `.leanquill/issues` (issue counts). */
    private readonly workspaceRoot: string,
    private readonly researchDir: string,
  ) {
    this._onDidChangeTreeData = new vscode.EventEmitter<void>();
    this.onDidChangeTreeData = this._onDidChangeTreeData.event;
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(item: ResearchItem): VSCode.TreeItem {
    const treeItem = new this.vscode.TreeItem(
      item.name,
      this.vscode.TreeItemCollapsibleState.None,
    );
    const datePart = formatCreatedDate(item.created);
    treeItem.description =
      item.activeIssueCount > 0 ? `${datePart} · ${item.activeIssueCount} Issues` : datePart;
    treeItem.iconPath = new this.vscode.ThemeIcon("book");
    treeItem.contextValue = "research";
    treeItem.command = {
      command: "vscode.open",
      title: "Open Research",
      arguments: [this.vscode.Uri.file(item.filePath)],
    };
    return treeItem;
  }

  async getChildren(element?: ResearchItem): Promise<ResearchItem[]> {
    if (element) {
      return [];
    }
    const items = await buildResearchItems(this.researchDir);
    const oq = await listOpenQuestions(this.workspaceRoot);
    return items.map((item) => ({
      ...item,
      activeIssueCount: countActiveQuestionsLinkedToEntity(oq, "research", path.basename(item.filePath)),
    }));
  }
}
