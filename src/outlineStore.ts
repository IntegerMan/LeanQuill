import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as crypto from "node:crypto";
import { SafeFileSystem } from "./safeFileSystem";
import { ChapterStatus, OutlineBeat, OutlineChapter, OutlineIndex, OutlinePart } from "./types";

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

const OUTLINE_FILE = ".leanquill/outline-index.json";

function emptyIndex(): OutlineIndex {
  return {
    schemaVersion: 1,
    parts: [],
  };
}

function normalizeBeat(raw: unknown): OutlineBeat {
  if (!raw || typeof raw !== "object") {
    return {
      id: crypto.randomUUID(),
      title: "",
      fileName: "",
      active: true,
      description: "",
      customFields: {},
    };
  }

  const candidate = raw as Record<string, unknown>;

  return {
    id: typeof candidate.id === "string" && candidate.id.length > 0 ? candidate.id : crypto.randomUUID(),
    title: typeof candidate.title === "string" ? candidate.title : "",
    fileName: typeof candidate.fileName === "string" ? candidate.fileName : "",
    active: typeof candidate.active === "boolean" ? candidate.active : true,
    description: typeof candidate.description === "string" ? candidate.description : "",
    customFields:
      candidate.customFields && typeof candidate.customFields === "object" && !Array.isArray(candidate.customFields)
        ? Object.fromEntries(
            Object.entries(candidate.customFields as Record<string, unknown>)
              .filter(([, v]) => typeof v === "string")
              .map(([k, v]) => [k, v as string]),
          )
        : {},
  };
}

function normalizeChapter(raw: unknown): OutlineChapter {
  if (!raw || typeof raw !== "object") {
    return {
      id: crypto.randomUUID(),
      name: "",
      fileName: "",
      active: true,
      beats: [],
    };
  }

  const candidate = raw as Record<string, unknown>;

  return {
    id: typeof candidate.id === "string" && candidate.id.length > 0 ? candidate.id : crypto.randomUUID(),
    name: typeof candidate.name === "string" ? candidate.name : "",
    fileName: typeof candidate.fileName === "string" ? candidate.fileName : "",
    active: typeof candidate.active === "boolean" ? candidate.active : true,
    status: isChapterStatus(candidate.status) ? candidate.status : "not-started",
    beats: Array.isArray(candidate.beats) ? candidate.beats.map(normalizeBeat) : [],
  };
}

function normalizePart(raw: unknown): OutlinePart {
  if (!raw || typeof raw !== "object") {
    return {
      id: crypto.randomUUID(),
      name: "",
      active: true,
      chapters: [],
    };
  }

  const candidate = raw as Record<string, unknown>;

  return {
    id: typeof candidate.id === "string" && candidate.id.length > 0 ? candidate.id : crypto.randomUUID(),
    name: typeof candidate.name === "string" ? candidate.name : "",
    active: typeof candidate.active === "boolean" ? candidate.active : true,
    chapters: Array.isArray(candidate.chapters) ? candidate.chapters.map(normalizeChapter) : [],
  };
}

export function normalizeOutlineIndex(raw: unknown): OutlineIndex {
  if (!raw || typeof raw !== "object") {
    return emptyIndex();
  }

  const candidate = raw as Record<string, unknown>;

  return {
    schemaVersion: typeof candidate.schemaVersion === "number" ? candidate.schemaVersion : 1,
    parts: Array.isArray(candidate.parts) ? candidate.parts.map(normalizePart) : [],
  };
}

export async function readOutlineIndex(rootPath: string): Promise<OutlineIndex> {
  const filePath = path.join(rootPath, OUTLINE_FILE);
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return normalizeOutlineIndex(JSON.parse(raw));
  } catch {
    return emptyIndex();
  }
}

export async function writeOutlineIndex(
  rootPath: string,
  index: OutlineIndex,
  safeFs: SafeFileSystem,
): Promise<void> {
  const filePath = path.join(rootPath, OUTLINE_FILE);
  await safeFs.writeFile(filePath, JSON.stringify(index, null, 2));
}

function deriveChapterName(filePath: string): string {
  const baseName = path.basename(filePath, path.extname(filePath));
  const withSpaces = baseName.replaceAll(/[-_]+/g, " ").trim();
  if (!withSpaces) {
    return filePath;
  }
  return withSpaces.replaceAll(/\b\w/g, (char) => char.toUpperCase());
}

export function bootstrapOutline(chapterPaths: string[]): OutlineIndex {
  if (chapterPaths.length === 0) {
    return emptyIndex();
  }

  return {
    schemaVersion: 1,
    parts: [
      {
        id: crypto.randomUUID(),
        name: "Book",
        active: true,
        chapters: chapterPaths.map((filePath) => ({
          id: crypto.randomUUID(),
          name: deriveChapterName(filePath),
          fileName: filePath,
          active: true,
          status: "not-started" as const,
          beats: [],
        })),
      },
    ],
  };
}
