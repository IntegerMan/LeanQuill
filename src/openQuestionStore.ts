import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { ChapterStatusIndex, OpenQuestionAssociation, OpenQuestionRecord, OpenQuestionStatus } from "./types";
import type { SafeFileSystem } from "./safeFileSystem";
import { escapeYamlString, stripYamlQuotes } from "./yamlUtils";

export const OPEN_QUESTIONS_DIR = ".leanquill/open-questions";

const VALID_STATUSES: OpenQuestionStatus[] = ["open", "deferred", "resolved", "dismissed"];

/** Human-readable label for issue-schema `type` (list UI). */
export function displayIssueTypeLabel(issueSchemaType: string): string {
  const t = (issueSchemaType || "").trim() || "question";
  if (t === "author-note" || t === "question") {
    return "Question";
  }
  return t
    .split(/[-_]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

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
    case "research":
      return { kind: "research", fileName: fields.lq_research_file || "" };
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
    case "research":
      return {
        chapter_ref: "project-wide",
        lq_assoc_kind: "research",
        lq_research_file: association.fileName,
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
    throw new Error(
      `Open question ${fileName}: invalid status "${statusRaw}" (expected open | deferred | resolved | dismissed)`,
    );
  }

  const id = scalars.id || path.basename(fileName, path.extname(fileName));
  const title = scalars.title || "";
  const createdAt = scalars.created_at || new Date().toISOString();
  const updatedAt = scalars.updated_at || createdAt;
  const association = associationFromFrontmatter(scalars);
  const issueSchemaType = (scalars.type || "author-note").trim() || "author-note";
  const dismissedReasonRaw = scalars.dismissed_reason?.trim();
  const dismissedReason =
    dismissedReasonRaw && dismissedReasonRaw.length > 0 ? dismissedReasonRaw : undefined;

  return {
    fileName,
    id,
    issueSchemaType,
    title,
    body,
    status: statusRaw,
    createdAt,
    updatedAt,
    association,
    dismissedReason,
  };
}

/**
 * Serialize record to markdown with issue-schema-aligned frontmatter plus `lq_*` association keys.
 */
export function serializeOpenQuestionFile(record: OpenQuestionRecord): string {
  const assocFm = frontmatterFieldsForAssociation(record.association);
  const lines: string[] = ["---"];

  lines.push(`id: ${escapeYamlString(record.id)}`);
  lines.push(`type: ${escapeYamlString(record.issueSchemaType)}`);
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
  if (record.dismissedReason && record.dismissedReason.trim().length > 0) {
    lines.push(`dismissed_reason: ${escapeYamlString(record.dismissedReason.trim())}`);
  } else {
    lines.push('dismissed_reason: ""');
  }
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
  if (assocFm.lq_research_file) {
    lines.push(`lq_research_file: ${escapeYamlString(assocFm.lq_research_file)}`);
  }

  lines.push("---");
  lines.push(record.body);

  return lines.join("\n");
}

/**
 * Count chapter-linked issues that count toward sidebar / openIssueIndex (D-03, D-06): `open` + `deferred`.
 * Book-wide and entity-only associations do not increment chapter keys.
 */
export function countOpenQuestionsByChapter(questions: OpenQuestionRecord[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const q of questions) {
    if (q.status !== "open" && q.status !== "deferred") {
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
    issueSchemaType: "author-note",
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

export function countOpenQuestionsLinkedToEntity(
  questions: OpenQuestionRecord[],
  kind: "character" | "place" | "thread" | "research",
  fileName: string,
): number {
  const base = path.basename(fileName);
  return questions.filter((q) => q.association.kind === kind && q.association.fileName === base).length;
}

export function countOpenQuestionsLinkedToChapterRef(questions: OpenQuestionRecord[], chapterRef: string): number {
  const norm = normalizePathSeparators(chapterRef);
  return questions.filter((q) => {
    if (q.association.kind === "chapter") {
      return normalizePathSeparators(q.association.chapterRef) === norm;
    }
    if (q.association.kind === "selection") {
      return normalizePathSeparators(q.association.chapterRef) === norm;
    }
    return false;
  }).length;
}

export async function deleteOpenQuestionsForEntity(
  rootPath: string,
  safeFs: SafeFileSystem,
  kind: "character" | "place" | "thread" | "research",
  fileName: string,
): Promise<number> {
  const base = path.basename(fileName);
  const list = await listOpenQuestions(rootPath);
  const targets = list.filter((q) => q.association.kind === kind && q.association.fileName === base).map((q) => q.fileName);
  for (const fn of targets) {
    await deleteOpenQuestion(fn, rootPath, safeFs);
  }
  return targets.length;
}

export async function deleteOpenQuestionsForChapterRef(
  rootPath: string,
  safeFs: SafeFileSystem,
  chapterRef: string,
): Promise<number> {
  const norm = normalizePathSeparators(chapterRef);
  const list = await listOpenQuestions(rootPath);
  const targets = list
    .filter((q) => {
      if (q.association.kind === "chapter") {
        return normalizePathSeparators(q.association.chapterRef) === norm;
      }
      if (q.association.kind === "selection") {
        return normalizePathSeparators(q.association.chapterRef) === norm;
      }
      return false;
    })
    .map((q) => q.fileName);
  for (const fn of targets) {
    await deleteOpenQuestion(fn, rootPath, safeFs);
  }
  return targets.length;
}

export async function patchEntityFileNameInOpenQuestions(
  rootPath: string,
  safeFs: SafeFileSystem,
  kind: "character" | "place" | "thread" | "research",
  oldFileName: string,
  newFileName: string,
): Promise<number> {
  const oldB = path.basename(oldFileName);
  const newB = path.basename(newFileName);
  if (oldB === newB) {
    return 0;
  }
  const list = await listOpenQuestions(rootPath);
  let n = 0;
  for (const q of list) {
    if (q.association.kind === kind && q.association.fileName === oldB) {
      await saveOpenQuestion({ ...q, association: { kind, fileName: newB } }, rootPath, safeFs);
      n++;
    }
  }
  return n;
}

export async function patchChapterRefInOpenQuestions(
  rootPath: string,
  safeFs: SafeFileSystem,
  oldRef: string,
  newRef: string,
): Promise<number> {
  const o = normalizePathSeparators(oldRef);
  const ne = normalizePathSeparators(newRef);
  if (o === ne) {
    return 0;
  }
  const list = await listOpenQuestions(rootPath);
  let n = 0;
  for (const q of list) {
    if (q.association.kind === "chapter" && normalizePathSeparators(q.association.chapterRef) === o) {
      await saveOpenQuestion({ ...q, association: { kind: "chapter", chapterRef: ne } }, rootPath, safeFs);
      n++;
    } else if (q.association.kind === "selection" && normalizePathSeparators(q.association.chapterRef) === o) {
      await saveOpenQuestion(
        { ...q, association: { kind: "selection", chapterRef: ne, spanHint: q.association.spanHint } },
        rootPath,
        safeFs,
      );
      n++;
    }
  }
  return n;
}
