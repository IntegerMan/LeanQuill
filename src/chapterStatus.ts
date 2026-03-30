import * as fs from "node:fs/promises";
import * as path from "node:path";
import { SafeFileSystem } from "./safeFileSystem";
import { ChapterStatus, ChapterStatusEntry, ChapterStatusIndex } from "./types";

const STATUS_FILE = ".leanquill/chapter-status-index.json";

const VALID_STATUSES: ChapterStatus[] = [
  "planning",
  "not-started",
  "drafting",
  "draft-complete",
  "editing",
  "review-pending",
  "final",
];

function isChapterStatus(value: unknown): value is ChapterStatus {
  return typeof value === "string" && VALID_STATUSES.includes(value as ChapterStatus);
}

function normalizeChapterPath(chapterPath: string): string {
  return chapterPath.split("\\").join("/");
}

function deriveChapterId(chapterPath: string): string {
  const baseName = path.basename(chapterPath, path.extname(chapterPath));
  return baseName.trim().toLowerCase().replaceAll(/[^a-z0-9]+/g, "-").replaceAll(/^-+|-+$/g, "") || "chapter";
}

function deriveTitle(chapterPath: string): string {
  const baseName = path.basename(chapterPath, path.extname(chapterPath));
  const withSpaces = baseName.replaceAll(/[-_]+/g, " ").trim();
  if (!withSpaces) {
    return chapterPath;
  }

  return withSpaces.replaceAll(/\b\w/g, (char) => char.toUpperCase());
}

function emptyIndex(): ChapterStatusIndex {
  return {
    schemaVersion: "1",
    chapters: {},
  };
}

function normalizeEntry(chapterPath: string, raw: unknown, onWarning?: (message: string) => void): ChapterStatusEntry {
  const chapterId = deriveChapterId(chapterPath);
  const title = deriveTitle(chapterPath);
  const now = new Date().toISOString();

  if (!raw || typeof raw !== "object") {
    return {
      chapterId,
      title,
      status: "not-started",
      openIssueCount: 0,
      updatedAt: now,
    };
  }

  const candidate = raw as Record<string, unknown>;
  const candidateStatus = candidate.status;

  const status = isChapterStatus(candidateStatus) ? candidateStatus : "not-started";
  if (!isChapterStatus(candidateStatus) && typeof candidateStatus === "string") {
    onWarning?.(`Unknown chapter status "${candidateStatus}". LeanQuill is showing not-started instead.`);
  }

  const openIssueCount = typeof candidate.openIssueCount === "number" && candidate.openIssueCount >= 0
    ? Math.floor(candidate.openIssueCount)
    : 0;

  const candidateTitle = typeof candidate.title === "string" && candidate.title.trim().length > 0
    ? candidate.title.trim()
    : title;

  const candidateId = typeof candidate.chapterId === "string" && candidate.chapterId.trim().length > 0
    ? candidate.chapterId.trim()
    : chapterId;

  const updatedAt = typeof candidate.updatedAt === "string" && candidate.updatedAt.trim().length > 0
    ? candidate.updatedAt
    : now;

  return {
    chapterId: candidateId,
    title: candidateTitle,
    status,
    openIssueCount,
    updatedAt,
  };
}

function normalizeIndex(raw: unknown, onWarning?: (message: string) => void): ChapterStatusIndex {
  if (!raw || typeof raw !== "object") {
    return emptyIndex();
  }

  const objectValue = raw as Record<string, unknown>;
  const chaptersRaw = objectValue.chapters;
  if (!chaptersRaw || typeof chaptersRaw !== "object") {
    return emptyIndex();
  }

  const chapters: Record<string, ChapterStatusEntry> = {};
  for (const [chapterPath, entry] of Object.entries(chaptersRaw as Record<string, unknown>)) {
    const normalizedPath = normalizeChapterPath(chapterPath);
    chapters[normalizedPath] = normalizeEntry(normalizedPath, entry, onWarning);
  }

  return {
    schemaVersion: "1",
    chapters,
  };
}

export function statusIndexPath(rootPath: string): string {
  return path.join(rootPath, STATUS_FILE);
}

export async function readChapterStatusIndex(rootPath: string, onWarning?: (message: string) => void): Promise<ChapterStatusIndex> {
  const filePath = statusIndexPath(rootPath);
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return normalizeIndex(JSON.parse(raw), onWarning);
  } catch {
    return emptyIndex();
  }
}

export function getChapterStatusEntry(index: ChapterStatusIndex, chapterPath: string): ChapterStatusEntry {
  const normalizedPath = normalizeChapterPath(chapterPath);
  const existing = index.chapters[normalizedPath];
  if (existing) {
    return existing;
  }

  return {
    chapterId: deriveChapterId(normalizedPath),
    title: deriveTitle(normalizedPath),
    status: "not-started",
    openIssueCount: 0,
    updatedAt: new Date().toISOString(),
  };
}

export async function writeChapterStatusEntry(
  safeFileSystem: SafeFileSystem,
  rootPath: string,
  chapterPath: string,
  status: ChapterStatus,
  title?: string,
): Promise<ChapterStatusIndex> {
  const index = await readChapterStatusIndex(rootPath);
  const normalizedPath = normalizeChapterPath(chapterPath);
  const current = getChapterStatusEntry(index, normalizedPath);

  const nextEntry: ChapterStatusEntry = {
    chapterId: current.chapterId,
    title: title && title.trim().length > 0 ? title.trim() : current.title,
    status,
    openIssueCount: 0,
    updatedAt: new Date().toISOString(),
  };

  const nextIndex: ChapterStatusIndex = {
    schemaVersion: "1",
    chapters: {
      ...index.chapters,
      [normalizedPath]: nextEntry,
    },
  };

  await safeFileSystem.writeFile(statusIndexPath(rootPath), JSON.stringify(nextIndex, null, 2));
  return nextIndex;
}
