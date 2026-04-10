import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { ChapterStatusIndex, OpenQuestionAssociation, OpenQuestionRecord, OpenQuestionStatus } from "./types";
import type { SafeFileSystem } from "./safeFileSystem";
import { escapeYamlString, stripYamlQuotes } from "./yamlUtils";

export const OPEN_QUESTIONS_DIR = ".leanquill/open-questions";

const VALID_STATUSES: OpenQuestionStatus[] = ["open", "deferred", "resolved"];

function openQuestionsAbs(rootPath: string): string {
  return path.join(rootPath, ...OPEN_QUESTIONS_DIR.split("/"));
}

function normalizePathSeparators(p: string): string {
  return p.split("\\").join("/");
}

function isOpenQuestionStatus(value: unknown): value is OpenQuestionStatus {
  return typeof value === "string" && VALID_STATUSES.includes(value as OpenQuestionStatus);
}

export function slugifyOpenQuestionBase(title: string): string {
  const slug = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "question";
}

function associationFromFrontmatter(fields: Record<string, string>): OpenQuestionAssociation {
  const kind = fields.lq_assoc_kind || "book";
  switch (kind) {
    case "character":
      return { kind: "character", fileName: fields.lq_character_file || "" };
    case "place":
      return { kind: "place", fileName: fields.lq_place_file || "" };
    case "thread":
      return { kind: "thread", fileName: fields.lq_thread_file || "" };
    case "chapter":
      return { kind: "chapter", chapterRef: normalizePathSeparators(fields.chapter_ref || "") };
    case "selection":
      return {
        kind: "selection",
        chapterRef: normalizePathSeparators(fields.chapter_ref || ""),
        spanHint: fields.span_hint || "",
      };
    case "book":
    default:
      return { kind: "book" };
  }
}

function frontmatterFieldsForAssociation(association: OpenQuestionAssociation): Record<string, string> {
  switch (association.kind) {
    case "book":
      return {
        chapter_ref: "project-wide",
        lq_assoc_kind: "book",
        lq_book_wide: "true",
        span_hint: "",
      };
    case "character":
      return {
        chapter_ref: "project-wide",
        lq_assoc_kind: "character",
        lq_character_file: association.fileName,
        span_hint: "",
      };
    case "place":
      return {
        chapter_ref: "project-wide",
        lq_assoc_kind: "place",
        lq_place_file: association.fileName,
        span_hint: "",
      };
    case "thread":
      return {
        chapter_ref: "project-wide",
        lq_assoc_kind: "thread",
        lq_thread_file: association.fileName,
        span_hint: "",
      };
    case "chapter":
      return {
        chapter_ref: association.chapterRef,
        lq_assoc_kind: "chapter",
        span_hint: "",
      };
    case "selection":
      return {
        chapter_ref: association.chapterRef,
        lq_assoc_kind: "selection",
        span_hint: association.spanHint,
      };
    default:
      return { chapter_ref: "project-wide", lq_assoc_kind: "book", span_hint: "" };
  }
}

/**
 * Parse a single open-question markdown file (`type: author-note`).
 */
export function parseOpenQuestionFile(fileName: string, content: string): OpenQuestionRecord {
  const normalized = content.replace(/\r\n/g, "\n");
  const fmMatch = /^---\n([\s\S]*?)\n---/.exec(normalized);
  if (!fmMatch) {
    throw new Error(`Open question ${fileName}: missing YAML frontmatter`);
  }

  const frontmatter = fmMatch[1];
  const body = normalized.slice(fmMatch[0].length).replace(/^\n/, "").replace(/\n$/, "");

  const scalars: Record<string, string> = {};

  const lines = frontmatter.split("\n");
  for (const line of lines) {
    const keyValMatch = /^([a-zA-Z0-9_]+):\s*(.*)$/.exec(line);
    if (!keyValMatch) {
      continue;
    }
    const key = keyValMatch[1];
    const rawVal = keyValMatch[2].trim();
    scalars[key] = stripYamlQuotes(rawVal);
  }

  const statusRaw = scalars.status || "open";
  if (!isOpenQuestionStatus(statusRaw)) {
    throw new Error(`Open question ${fileName}: invalid status "${statusRaw}" (Phase 14 allows open | deferred | resolved only)`);
  }

  const id = scalars.id || path.basename(fileName, path.extname(fileName));
  const title = scalars.title || "";
  const createdAt = scalars.created_at || new Date().toISOString();
  const updatedAt = scalars.updated_at || createdAt;
  const association = associationFromFrontmatter(scalars);

  return {
    fileName,
    id,
    title,
    body,
    status: statusRaw,
    createdAt,
    updatedAt,
    association,
  };
}

/**
 * Serialize record to markdown with issue-schema-aligned frontmatter plus `lq_*` association keys.
 */
export function serializeOpenQuestionFile(record: OpenQuestionRecord): string {
  const assocFm = frontmatterFieldsForAssociation(record.association);
  const lines: string[] = ["---"];

  lines.push(`id: ${escapeYamlString(record.id)}`);
  lines.push("type: author-note");
  lines.push(`status: ${record.status}`);
  lines.push("priority: 3");
  lines.push(`title: ${escapeYamlString(record.title)}`);
  lines.push(`created_at: ${escapeYamlString(record.createdAt)}`);
  lines.push(`updated_at: ${escapeYamlString(record.updatedAt)}`);
  lines.push("source: author");
  lines.push(`chapter_ref: ${escapeYamlString(normalizePathSeparators(assocFm.chapter_ref || ""))}`);
  if (assocFm.span_hint && assocFm.span_hint.length > 0) {
    lines.push(`span_hint: ${escapeYamlString(assocFm.span_hint)}`);
  } else {
    lines.push('span_hint: ""');
  }
  lines.push("agent_profile: author");
  lines.push("evidence_links: []");
  lines.push("confidence: unrated");
  lines.push("verify_manually: false");
  lines.push("intentional: false");
  lines.push('intentional_note: ""');
  lines.push('dismissed_reason: ""');
  lines.push(`lq_assoc_kind: ${assocFm.lq_assoc_kind}`);

  if (assocFm.lq_book_wide === "true") {
    lines.push("lq_book_wide: true");
  }
  if (assocFm.lq_character_file) {
    lines.push(`lq_character_file: ${escapeYamlString(assocFm.lq_character_file)}`);
  }
  if (assocFm.lq_place_file) {
    lines.push(`lq_place_file: ${escapeYamlString(assocFm.lq_place_file)}`);
  }
  if (assocFm.lq_thread_file) {
    lines.push(`lq_thread_file: ${escapeYamlString(assocFm.lq_thread_file)}`);
  }

  lines.push("---");
  lines.push(record.body);

  return lines.join("\n");
}

/**
 * Count `open` questions per normalized manuscript `chapter_ref` (D-03).
 * Book-wide and entity-only associations do not increment chapter keys.
 */
export function countOpenQuestionsByChapter(questions: OpenQuestionRecord[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const q of questions) {
    if (q.status !== "open") {
      continue;
    }
    let chapterRef: string | undefined;
    if (q.association.kind === "chapter") {
      chapterRef = q.association.chapterRef;
    } else if (q.association.kind === "selection") {
      chapterRef = q.association.chapterRef;
    }
    if (!chapterRef) {
      continue;
    }
    const normalized = normalizePathSeparators(chapterRef);
    if (!normalized.startsWith("manuscript/")) {
      continue;
    }
    counts[normalized] = (counts[normalized] ?? 0) + 1;
  }
  return counts;
}

/**
 * Apply computed open-question counts to every chapter entry in the status index.
 */
export function mergeOpenQuestionCountsIntoChapterStatusIndex(
  index: ChapterStatusIndex,
  questions: OpenQuestionRecord[],
): ChapterStatusIndex {
  const counts = countOpenQuestionsByChapter(questions);
  const chapters: ChapterStatusIndex["chapters"] = {};
  for (const [chapterPath, entry] of Object.entries(index.chapters)) {
    const normalized = normalizePathSeparators(chapterPath);
    chapters[chapterPath] = {
      ...entry,
      openIssueCount: counts[normalized] ?? 0,
    };
  }
  return {
    schemaVersion: "1",
    chapters,
  };
}

export async function listOpenQuestions(rootPath: string): Promise<OpenQuestionRecord[]> {
  const dir = openQuestionsAbs(rootPath);
  let entries: string[];
  try {
    entries = await fs.readdir(dir);
  } catch {
    return [];
  }

  const records: OpenQuestionRecord[] = [];
  for (const entry of entries.filter((e) => e.endsWith(".md"))) {
    const filePath = path.join(dir, entry);
    const content = await fs.readFile(filePath, "utf8");
    records.push(parseOpenQuestionFile(entry, content));
  }

  records.sort((a, b) => {
    const ta = Date.parse(a.updatedAt) || 0;
    const tb = Date.parse(b.updatedAt) || 0;
    return tb - ta;
  });
  return records;
}

export async function getOpenQuestion(rootPath: string, id: string): Promise<OpenQuestionRecord | undefined> {
  const list = await listOpenQuestions(rootPath);
  return list.find((q) => q.id === id);
}

export async function createOpenQuestion(
  safeFs: SafeFileSystem,
  rootPath: string,
  input: { title: string; association: OpenQuestionAssociation },
): Promise<OpenQuestionRecord> {
  const dir = openQuestionsAbs(rootPath);
  await safeFs.mkdir(dir);

  const base = slugifyOpenQuestionBase(input.title);
  let slug = `${base}.md`;
  let attempt = 2;
  while (true) {
    try {
      await fs.access(path.join(dir, slug));
      slug = `${base}-${attempt}.md`;
      attempt++;
    } catch {
      break;
    }
  }

  const now = new Date().toISOString();
  const id = path.basename(slug, ".md");
  const record: OpenQuestionRecord = {
    fileName: slug,
    id,
    title: input.title.trim(),
    body: "",
    status: "open",
    createdAt: now,
    updatedAt: now,
    association: input.association,
  };

  await safeFs.writeFile(path.join(dir, slug), serializeOpenQuestionFile(record));
  return record;
}

export async function saveOpenQuestion(record: OpenQuestionRecord, rootPath: string, safeFs: SafeFileSystem): Promise<void> {
  const dir = openQuestionsAbs(rootPath);
  const next: OpenQuestionRecord = {
    ...record,
    updatedAt: new Date().toISOString(),
  };
  await safeFs.writeFile(path.join(dir, next.fileName), serializeOpenQuestionFile(next));
}

export async function deleteOpenQuestion(fileName: string, rootPath: string, safeFs: SafeFileSystem): Promise<void> {
  const filePath = path.join(openQuestionsAbs(rootPath), fileName);
  if (!safeFs.canWrite(filePath, true)) {
    throw new Error(`Blocked delete outside LeanQuill boundary: ${filePath}`);
  }
  try {
    await fs.unlink(filePath);
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      throw err;
    }
  }
}
