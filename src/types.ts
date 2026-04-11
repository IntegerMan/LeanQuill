export interface InitInput {
  projectId: string;
  workingTitle: string;
  genre: string[];
}

export interface ChapterOrderResult {
  chapterPaths: string[];
  warnings: string[];
  source: "book-txt" | "alpha";
}

export type ChapterStatus =
  | "planning"
  | "not-started"
  | "drafting"
  | "draft-complete"
  | "editing"
  | "review-pending"
  | "final";

export interface ChapterStatusEntry {
  chapterId: string;
  title: string;
  status: ChapterStatus;
  openIssueCount: number;
  updatedAt: string;
}

export interface ChapterStatusIndex {
  schemaVersion: "1";
  chapters: Record<string, ChapterStatusEntry>;
}

// --- Outline types (recursive node model) ---

export interface OutlineNode {
  id: string;
  title: string;
  fileName: string;
  active: boolean;
  status: ChapterStatus;
  description: string;
  customFields: Record<string, string>;
  traits: string[];
  children: OutlineNode[];
}

export interface OutlineIndex {
  schemaVersion: number;
  nodes: OutlineNode[];
}

// --- Character reference types ---

export interface CharacterProfile {
  fileName: string;            // e.g. "jane-doe.md" — relative filename, not full path
  name: string;
  aliases: string[];
  role: string;                // "protagonist" | "antagonist" | "supporting" | "minor" | (custom)
  description: string;         // short one-liner — extended notes go in body
  referencedByNameIn: string[]; // manuscript file paths (relative to rootPath)
  customFields: Record<string, string>;
  body: string;                // freeform markdown body after frontmatter
}

export interface PlaceProfile {
  fileName: string;
  name: string;
  aliases: string[];
  parentFileName: string; // fileName of parent place ("" = root-level)
  description: string;
  referencedByNameIn: string[]; // manuscript paths relative to workspace root, forward slashes
  customFields: Record<string, string>;
  body: string;
}

// --- Threads & themes (Phase 6) ---

export interface CentralThemeEntry {
  id: string;
  title: string;
  summary: string;
  notePath: string;
  linkedChapters: string[];
}

export interface ThemesDocument {
  schemaVersion: string;
  centralQuestion: string;
  bookSynopsis: string;
  bookCustomFields: Record<string, string>;
  centralThemes: CentralThemeEntry[];
}

export interface ThreadProfile {
  fileName: string;
  title: string;
  touchesChapters: string[];
  customFields: Record<string, string>;
  body: string;
}

// --- Open questions (Phase 14, ISSUE-01/02 partial) ---

export type OpenQuestionStatus = "open" | "deferred" | "resolved" | "dismissed";

export type OpenQuestionAssociation =
  | { kind: "book" }
  | { kind: "character"; fileName: string }
  | { kind: "place"; fileName: string }
  | { kind: "thread"; fileName: string }
  | { kind: "research"; fileName: string }
  | { kind: "chapter"; chapterRef: string }
  | { kind: "selection"; chapterRef: string; spanHint: string };

export interface OpenQuestionRecord {
  fileName: string;
  id: string;
  /** issue-schema `type` (e.g. `question`, or legacy `author-note`); drives list label such as "Question". */
  issueSchemaType: string;
  title: string;
  body: string;
  status: OpenQuestionStatus;
  createdAt: string;
  updatedAt: string;
  association: OpenQuestionAssociation;
  /** Persisted when status is dismissed (issue-schema `dismissed_reason`). */
  dismissedReason?: string;
  /** Computed for webview navigation UX; not persisted. */
  staleHint?: string;
}
