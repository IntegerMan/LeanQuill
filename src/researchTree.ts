import * as fs from "node:fs/promises";
import * as path from "node:path";
import type * as VSCode from "vscode";

export interface ResearchItem {
  kind: "research";
  filePath: string;
  name: string;
  created: string;
}

export function parseFrontmatter(content: string): { name?: string; created?: string } {
  const match = /^---\n([\s\S]*?)\n---/.exec(content);
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
  const date = new Date(created);
  if (Number.isNaN(date.getTime())) {
    return created;
  }
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export async function buildResearchItems(researchDir: string): Promise<ResearchItem[]> {
  let entries: string[];
  try {
    entries = await fs.readdir(researchDir);
  } catch {
    return [];
  }

  const mdFiles = entries.filter((e) => e.endsWith(".md"));

  const items: ResearchItem[] = [];
  for (const file of mdFiles) {
    const filePath = path.join(researchDir, file);
    let content: string;
    try {
      content = await fs.readFile(filePath, "utf8");
    } catch {
      continue;
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

    items.push({
      kind: "research",
      filePath,
      name: fmName ?? deriveNameFromFilename(file),
      created,
    });
  }

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
    treeItem.description = formatCreatedDate(item.created);
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
    return buildResearchItems(this.researchDir);
  }
}
