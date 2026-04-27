import * as fs from "node:fs/promises";
import * as path from "node:path";
import { randomBytes } from "node:crypto";
import { stripYamlQuotes, escapeYamlString } from "./yamlUtils";
import type { SafeFileSystem } from "./safeFileSystem";
import type { StoryChatMemoryContext } from "./storyChatContext";

export const LEANQUILL_MEMORY_DIR = ".leanquill/memory";

export type StoryMemoryStatus = "active" | "superseded" | "archived";
export type StoryMemoryRecency = "current" | "stale";
export type StoryMemoryAssociation =
  | { kind: "book" }
  | { kind: "chapter"; chapterRef: string }
  | { kind: "selection"; chapterRef: string; spanHint: string }
  | { kind: "issue"; issueId: string }
  | { kind: "character"; fileName: string }
  | { kind: "place"; fileName: string }
  | { kind: "thread"; fileName: string }
  | { kind: "theme"; id: string }
  | { kind: "research"; fileName: string };

export interface StoryMemoryRecord {
  fileName: string;
  schemaVersion: "1";
  id: string;
  topic: string;
  status: StoryMemoryStatus;
  createdAt: string;
  updatedAt: string;
  recency: StoryMemoryRecency;
  supersedes: string[];
  sourceChatId: string;
  association: StoryMemoryAssociation;
  body: string;
}

function normSep(p: string): string {
  return p.split("\\").join("/");
}

function parseScalarLines(frontmatter: string): Record<string, string> {
  const scalars: Record<string, string> = {};
  for (const line of frontmatter.split("\n")) {
    const m = /^([a-zA-Z0-9_]+):\s*(.*)$/.exec(line);
    if (!m) {
      continue;
    }
    scalars[m[1]] = stripYamlQuotes(m[2].trim());
  }
  return scalars;
}

function parseSupersedes(raw: string | undefined): string[] {
  if (!raw?.trim()) {
    return [];
  }
  const t = raw.trim();
  if (t.startsWith("[")) {
    try {
      const arr = JSON.parse(t) as unknown;
      return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string") : [];
    } catch {
      return [];
    }
  }
  return t.split(",").map((s) => s.trim()).filter(Boolean);
}

function associationFromScalars(s: Record<string, string>): StoryMemoryAssociation {
  const kind = (s.lq_assoc_kind || "book").trim() || "book";
  switch (kind) {
    case "chapter":
      return { kind: "chapter", chapterRef: normSep(s.chapter_ref || "") };
    case "selection":
      return {
        kind: "selection",
        chapterRef: normSep(s.chapter_ref || ""),
        spanHint: s.span_hint || "",
      };
    case "issue":
      return { kind: "issue", issueId: s.lq_issue_id || "" };
    case "character":
      return { kind: "character", fileName: s.lq_character_file || "" };
    case "place":
      return { kind: "place", fileName: s.lq_place_file || "" };
    case "thread":
      return { kind: "thread", fileName: s.lq_thread_file || "" };
    case "theme":
      return { kind: "theme", id: s.lq_theme_id || "" };
    case "research":
      return { kind: "research", fileName: s.lq_research_file || "" };
    default:
      return { kind: "book" };
  }
}

function scalarsForAssociation(a: StoryMemoryAssociation): Record<string, string> {
  switch (a.kind) {
    case "book":
      return { lq_assoc_kind: "book", chapter_ref: "", span_hint: "" };
    case "chapter":
      return { lq_assoc_kind: "chapter", chapter_ref: a.chapterRef, span_hint: "" };
    case "selection":
      return {
        lq_assoc_kind: "selection",
        chapter_ref: a.chapterRef,
        span_hint: a.spanHint,
      };
    case "issue":
      return { lq_assoc_kind: "issue", lq_issue_id: a.issueId, chapter_ref: "", span_hint: "" };
    case "character":
      return { lq_assoc_kind: "character", lq_character_file: a.fileName, chapter_ref: "", span_hint: "" };
    case "place":
      return { lq_assoc_kind: "place", lq_place_file: a.fileName, chapter_ref: "", span_hint: "" };
    case "thread":
      return { lq_assoc_kind: "thread", lq_thread_file: a.fileName, chapter_ref: "", span_hint: "" };
    case "theme":
      return { lq_assoc_kind: "theme", lq_theme_id: a.id, chapter_ref: "", span_hint: "" };
    case "research":
      return { lq_assoc_kind: "research", lq_research_file: a.fileName, chapter_ref: "", span_hint: "" };
    default:
      return { lq_assoc_kind: "book", chapter_ref: "", span_hint: "" };
  }
}

const VALID_STATUS: StoryMemoryStatus[] = ["active", "superseded", "archived"];
const VALID_RECENCY: StoryMemoryRecency[] = ["current", "stale"];

function coerceStatus(raw: string | undefined): StoryMemoryStatus {
  const v = (raw || "active").trim();
  return VALID_STATUS.includes(v as StoryMemoryStatus) ? (v as StoryMemoryStatus) : "active";
}

function coerceRecency(raw: string | undefined): StoryMemoryRecency {
  const v = (raw || "current").trim();
  return VALID_RECENCY.includes(v as StoryMemoryRecency) ? (v as StoryMemoryRecency) : "current";
}

export function parseStoryMemoryFile(fileName: string, content: string): StoryMemoryRecord {
  const normalized = content.replace(/\r\n/g, "\n");
  const fmMatch = /^---\n([\s\S]*?)\n---/.exec(normalized);
  if (!fmMatch) {
    throw new Error(`Story memory ${fileName}: missing YAML frontmatter`);
  }
  const scalars = parseScalarLines(fmMatch[1]);
  const body = normalized.slice(fmMatch[0].length).replace(/^\n/, "").replace(/\n$/, "");
  const id = scalars.id || path.basename(fileName, path.extname(fileName));
  const status = coerceStatus(scalars.status);
  const recency = coerceRecency(scalars.recency);
  return {
    fileName: normSep(fileName),
    schemaVersion: "1",
    id,
    topic: scalars.topic || "",
    status,
    createdAt: scalars.created_at || new Date().toISOString(),
    updatedAt: scalars.updated_at || scalars.created_at || new Date().toISOString(),
    recency,
    supersedes: parseSupersedes(scalars.supersedes),
    sourceChatId: scalars.source_chat_id || "",
    association: associationFromScalars(scalars),
    body,
  };
}

export function serializeStoryMemoryFile(record: StoryMemoryRecord): string {
  const assoc = scalarsForAssociation(record.association);
  const lines: string[] = ["---"];
  lines.push(`schema_version: "1"`);
  lines.push(`id: ${escapeYamlString(record.id)}`);
  lines.push(`topic: ${escapeYamlString(record.topic)}`);
  lines.push(`status: ${record.status}`);
  lines.push(`created_at: ${escapeYamlString(record.createdAt)}`);
  lines.push(`updated_at: ${escapeYamlString(record.updatedAt)}`);
  lines.push(`recency: ${record.recency}`);
  lines.push(`supersedes: ${escapeYamlString(JSON.stringify(record.supersedes))}`);
  lines.push(`source_chat_id: ${escapeYamlString(record.sourceChatId)}`);
  lines.push(`lq_assoc_kind: ${assoc.lq_assoc_kind}`);
  lines.push(`chapter_ref: ${escapeYamlString(normSep(assoc.chapter_ref || ""))}`);
  lines.push(`span_hint: ${escapeYamlString(assoc.span_hint || "")}`);
  if (assoc.lq_issue_id) {
    lines.push(`lq_issue_id: ${escapeYamlString(assoc.lq_issue_id)}`);
  }
  if (assoc.lq_character_file) {
    lines.push(`lq_character_file: ${escapeYamlString(assoc.lq_character_file)}`);
  }
  if (assoc.lq_place_file) {
    lines.push(`lq_place_file: ${escapeYamlString(assoc.lq_place_file)}`);
  }
  if (assoc.lq_thread_file) {
    lines.push(`lq_thread_file: ${escapeYamlString(assoc.lq_thread_file)}`);
  }
  if (assoc.lq_theme_id) {
    lines.push(`lq_theme_id: ${escapeYamlString(assoc.lq_theme_id)}`);
  }
  if (assoc.lq_research_file) {
    lines.push(`lq_research_file: ${escapeYamlString(assoc.lq_research_file)}`);
  }
  lines.push("---");
  lines.push(record.body);
  return lines.join("\n");
}

function memoryDirAbs(rootPath: string): string {
  return path.join(rootPath, ...LEANQUILL_MEMORY_DIR.split("/"));
}

export async function listStoryMemory(
  rootPath: string,
  options?: { includeSuperseded?: boolean; includeArchived?: boolean },
): Promise<StoryMemoryRecord[]> {
  const dir = memoryDirAbs(rootPath);
  let names: string[];
  try {
    names = await fs.readdir(dir);
  } catch {
    return [];
  }
  const out: StoryMemoryRecord[] = [];
  for (const name of names) {
    if (!name.endsWith(".md")) {
      continue;
    }
    const filePath = path.join(dir, name);
    const content = await fs.readFile(filePath, "utf8");
    const rec = parseStoryMemoryFile(name, content);
    if (rec.status === "active") {
      out.push(rec);
    } else if (rec.status === "superseded" && options?.includeSuperseded) {
      out.push(rec);
    } else if (rec.status === "archived" && options?.includeArchived) {
      out.push(rec);
    }
  }
  out.sort((a, b) => (Date.parse(b.updatedAt) || 0) - (Date.parse(a.updatedAt) || 0));
  return out;
}

export async function saveStoryMemory(record: StoryMemoryRecord, rootPath: string, safeFs: SafeFileSystem): Promise<void> {
  const abs = path.join(rootPath, ".leanquill", "memory", record.fileName);
  await safeFs.writeFile(abs, serializeStoryMemoryFile(record));
}

export interface CreateStoryMemoryInput {
  topic: string;
  body: string;
  association?: StoryMemoryAssociation;
  sourceChatId: string;
}

function newMemoryId(): string {
  const hex = randomBytes(4).toString("hex");
  return `mem-${hex}-story-chat`;
}

export async function createStoryMemory(
  input: CreateStoryMemoryInput,
  rootPath: string,
  safeFs: SafeFileSystem,
): Promise<StoryMemoryRecord> {
  const now = new Date().toISOString();
  const id = newMemoryId();
  const fileName = `${id}.md`;
  const record: StoryMemoryRecord = {
    fileName,
    schemaVersion: "1",
    id,
    topic: input.topic,
    status: "active",
    createdAt: now,
    updatedAt: now,
    recency: "current",
    supersedes: [],
    sourceChatId: input.sourceChatId,
    association: input.association ?? { kind: "book" },
    body: input.body,
  };
  await saveStoryMemory(record, rootPath, safeFs);
  return record;
}

async function listAllStoryMemoryRecords(rootPath: string): Promise<StoryMemoryRecord[]> {
  const dir = memoryDirAbs(rootPath);
  let names: string[];
  try {
    names = await fs.readdir(dir);
  } catch {
    return [];
  }
  const out: StoryMemoryRecord[] = [];
  for (const name of names) {
    if (!name.endsWith(".md")) {
      continue;
    }
    const content = await fs.readFile(path.join(dir, name), "utf8");
    out.push(parseStoryMemoryFile(name, content));
  }
  return out;
}

async function findMemoryFileById(rootPath: string, memoryId: string): Promise<string | undefined> {
  const list = await listAllStoryMemoryRecords(rootPath);
  const hit = list.find((r) => r.id === memoryId);
  return hit?.fileName;
}

export interface SupersedeStoryMemoryReplacement {
  topic: string;
  body: string;
  association?: StoryMemoryAssociation;
  sourceChatId: string;
}

export async function supersedeStoryMemory(
  rootPath: string,
  safeFs: SafeFileSystem,
  oldId: string,
  replacementInput: SupersedeStoryMemoryReplacement,
): Promise<{ oldRecord: StoryMemoryRecord; newRecord: StoryMemoryRecord }> {
  const oldFile = await findMemoryFileById(rootPath, oldId);
  if (!oldFile) {
    throw new Error(`Story memory not found: ${oldId}`);
  }
  const oldAbs = path.join(rootPath, ".leanquill", "memory", oldFile);
  const oldContent = await fs.readFile(oldAbs, "utf8");
  const oldRecord = parseStoryMemoryFile(oldFile, oldContent);
  const now = new Date().toISOString();
  const updatedOld: StoryMemoryRecord = {
    ...oldRecord,
    status: "superseded",
    recency: "stale",
    updatedAt: now,
  };
  await saveStoryMemory(updatedOld, rootPath, safeFs);

  const newId = newMemoryId();
  const newFileName = `${newId}.md`;
  const newRecord: StoryMemoryRecord = {
    fileName: newFileName,
    schemaVersion: "1",
    id: newId,
    topic: replacementInput.topic,
    status: "active",
    createdAt: now,
    updatedAt: now,
    recency: "current",
    supersedes: [oldId],
    sourceChatId: replacementInput.sourceChatId,
    association: replacementInput.association ?? oldRecord.association,
    body: replacementInput.body,
  };
  await saveStoryMemory(newRecord, rootPath, safeFs);
  return { oldRecord: updatedOld, newRecord };
}

export function storyMemoryToContext(record: StoryMemoryRecord): StoryChatMemoryContext {
  return {
    id: record.id,
    topic: record.topic,
    associationLabel: associationLabel(record.association),
    updatedAt: record.updatedAt,
    path: `.leanquill/memory/${record.fileName}`,
  };
}

function associationLabel(a: StoryMemoryAssociation): string {
  switch (a.kind) {
    case "book":
      return "Book-wide";
    case "chapter":
      return `Chapter: ${a.chapterRef}`;
    case "selection":
      return `Selection: ${a.chapterRef} (${a.spanHint})`;
    case "issue":
      return `Issue: ${a.issueId}`;
    case "character":
      return `Character: ${a.fileName}`;
    case "place":
      return `Place: ${a.fileName}`;
    case "thread":
      return `Thread: ${a.fileName}`;
    case "theme":
      return `Theme: ${a.id}`;
    case "research":
      return `Research: ${a.fileName}`;
    default:
      return "Book-wide";
  }
}
