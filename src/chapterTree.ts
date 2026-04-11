import * as path from "node:path";
import type * as VSCode from "vscode";
import { getChapterStatusEntry } from "./chapterStatus";
import { formatIssueCountLabel } from "./formatIssueCountLabel";
import { ChapterStatus, ChapterStatusIndex } from "./types";

function naturalSort(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

function normalizeChapterPath(chapterPath: string): string {
  return chapterPath.split("\\").join("/");
}

function deriveTitle(chapterPath: string): string {
  const baseName = path.basename(chapterPath, path.extname(chapterPath));
  const withSpaces = baseName.replaceAll(/[-_]+/g, " ").trim();
  if (!withSpaces) {
    return chapterPath;
  }

  return withSpaces.replaceAll(/\b\w/g, (char) => char.toUpperCase());
}

function issueCountText(count: number): string {
  return formatIssueCountLabel(count);
}

export interface ChapterTreeRow {
  kind: "chapter";
  chapterPath: string;
  title: string;
  status: ChapterStatus;
  openIssueCount: number;
  missing: boolean;
}

export interface ChapterTreeGroup {
  kind: "group";
  id: "not-included";
  title: string;
  children: ChapterTreeRow[];
}

export interface BookTreeNode {
  kind: "book";
  chapterPath: string;
  title: string;
  status: ChapterStatus;
  openIssueCount: number;
  children: ChapterTreeRow[];
}

export type ChapterTreeNode = ChapterTreeRow | ChapterTreeGroup | BookTreeNode;
export type StatusTrackableTreeNode = ChapterTreeRow | BookTreeNode;

export interface ResolvedStatusTarget {
  chapterPath: string;
  kind: "chapter" | "book";
  missing: boolean;
}

export function isChapterTreeRow(value: unknown): value is ChapterTreeRow {
  return Boolean(value) && typeof value === "object" && (value as { kind?: string }).kind === "chapter";
}

export function isStatusTrackableTreeNode(value: unknown): value is StatusTrackableTreeNode {
  if (!value || typeof value !== "object") {
    return false;
  }

  const kind = (value as { kind?: string }).kind;
  return kind === "chapter" || kind === "book";
}

function hasRecordShape(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

export function resolveStatusTarget(value: unknown): ResolvedStatusTarget | undefined {
  if (isStatusTrackableTreeNode(value)) {
    return {
      chapterPath: value.chapterPath,
      kind: value.kind,
      missing: value.kind === "chapter" ? value.missing : false,
    };
  }

  if (!hasRecordShape(value)) {
    return undefined;
  }

  const chapterPath = value.leanquillChapterPath;
  const kind = value.leanquillKind;
  const missing = value.leanquillMissing;
  if (typeof chapterPath !== "string" || (kind !== "chapter" && kind !== "book")) {
    return undefined;
  }

  return {
    chapterPath,
    kind,
    missing: kind === "chapter" ? Boolean(missing) : false,
  };
}

export function buildChapterRows(
  orderedChapterPaths: string[],
  discoveredManuscriptPaths: string[],
  statusIndex: ChapterStatusIndex,
): ChapterTreeNode[] {
  const normalizedOrdered = orderedChapterPaths.map(normalizeChapterPath);
  const discoveredSet = new Set(discoveredManuscriptPaths.map(normalizeChapterPath));

  const orderedRows: ChapterTreeRow[] = normalizedOrdered.map((chapterPath) => {
    const status = getChapterStatusEntry(statusIndex, chapterPath);
    return {
      kind: "chapter",
      chapterPath,
      title: status.title || deriveTitle(chapterPath),
      status: status.status,
      openIssueCount: status.openIssueCount,
      missing: !discoveredSet.has(chapterPath),
    };
  });

  const notIncludedPaths = discoveredManuscriptPaths
    .map(normalizeChapterPath)
    .filter((chapterPath) => !normalizedOrdered.includes(chapterPath))
    .sort(naturalSort);

  const notIncludedRows = notIncludedPaths.map((chapterPath) => {
    const status = getChapterStatusEntry(statusIndex, chapterPath);
    return {
      kind: "chapter" as const,
      chapterPath,
      title: status.title || deriveTitle(chapterPath),
      status: status.status,
      openIssueCount: status.openIssueCount,
      missing: false,
    };
  });

  const bookStatus = getChapterStatusEntry(statusIndex, "Book.txt");
  const root: ChapterTreeNode[] = [
    {
      kind: "book",
      chapterPath: "Book.txt",
      title: bookStatus.title || "Book",
      status: bookStatus.status,
      openIssueCount: bookStatus.openIssueCount,
      children: orderedRows,
    },
  ];

  if (notIncludedRows.length > 0) {
    root.push({
      kind: "group",
      id: "not-included",
      title: "Not Included",
      children: notIncludedRows,
    });
  }

  return root;
}

const STATUS_ICONS: Record<ChapterStatus, string> = {
  planning: "circle-outline",
  "not-started": "dash",
  drafting: "edit",
  "draft-complete": "pass",
  editing: "pencil",
  "review-pending": "clock",
  final: "verified",
};

export class ChapterTreeProvider implements VSCode.TreeDataProvider<ChapterTreeNode> {
  private readonly onDidChangeTreeDataEmitter: VSCode.EventEmitter<ChapterTreeNode | undefined>;
  readonly onDidChangeTreeData: VSCode.Event<ChapterTreeNode | undefined>;

  private rows: ChapterTreeNode[] = [];

  constructor(
    private readonly vscodeApi: typeof VSCode,
    private readonly rootPath: string,
  ) {
    this.onDidChangeTreeDataEmitter = new this.vscodeApi.EventEmitter<ChapterTreeNode | undefined>();
    this.onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;
  }

  public setData(
    orderedChapterPaths: string[],
    discoveredManuscriptPaths: string[],
    statusIndex: ChapterStatusIndex,
  ): void {
    this.rows = buildChapterRows(orderedChapterPaths, discoveredManuscriptPaths, statusIndex);
    this.refresh();
  }

  public refresh(): void {
    this.onDidChangeTreeDataEmitter.fire(undefined);
  }

  public getKnownChapterPaths(): Set<string> {
    const paths = new Set<string>();
    for (const row of this.rows) {
      if (row.kind === "chapter" || row.kind === "book") {
        paths.add(row.chapterPath);
        if (row.kind === "book") {
          for (const child of row.children) {
            paths.add(child.chapterPath);
          }
        }
      } else {
        for (const child of row.children) {
          paths.add(child.chapterPath);
        }
      }
    }
    return paths;
  }

  getTreeItem(element: ChapterTreeNode): VSCode.TreeItem {
    const vscode = this.vscodeApi;

    if (element.kind === "group") {
      const group = new vscode.TreeItem(element.title, vscode.TreeItemCollapsibleState.Collapsed);
      group.contextValue = "chapter-group";
      return group;
    }

    if (element.kind === "book") {
      const item = new vscode.TreeItem(element.title, vscode.TreeItemCollapsibleState.Expanded);
      item.description = `${element.status} | ${issueCountText(element.openIssueCount)}`;
      item.tooltip = `${element.title}\n${element.chapterPath}\nStatus: ${element.status}`;
      item.contextValue = "book";
      item.iconPath = new vscode.ThemeIcon("book");
      item.command = {
        command: "leanquill.openChapter",
        title: "Open Book",
        arguments: [element.chapterPath],
      };
      (item as unknown as Record<string, unknown>).leanquillChapterPath = element.chapterPath;
      (item as unknown as Record<string, unknown>).leanquillKind = "book";
      (item as unknown as Record<string, unknown>).leanquillMissing = false;

      return item;
    }

    const label = element.missing ? `${element.title} (Missing)` : element.title;
    const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);
    item.description = `${element.status} | ${issueCountText(element.openIssueCount)}`;
    item.tooltip = `${element.title}\n${element.chapterPath}\nStatus: ${element.status}`;
    item.contextValue = element.missing ? "chapter-missing" : "chapter";
    item.iconPath = element.missing
      ? new vscode.ThemeIcon("warning")
      : new vscode.ThemeIcon(STATUS_ICONS[element.status]);

    if (!element.missing) {
      item.command = {
        command: "leanquill.openChapter",
        title: "Open Chapter",
        arguments: [element.chapterPath],
      };
    }
    (item as unknown as Record<string, unknown>).leanquillChapterPath = element.chapterPath;
    (item as unknown as Record<string, unknown>).leanquillKind = "chapter";
    (item as unknown as Record<string, unknown>).leanquillMissing = element.missing;

    return item;
  }

  getChildren(element?: ChapterTreeNode): ChapterTreeNode[] {
    if (!element) {
      return this.rows;
    }

    if (element.kind === "group" || element.kind === "book") {
      return element.children;
    }

    return [];
  }
}
