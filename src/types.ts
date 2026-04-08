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
