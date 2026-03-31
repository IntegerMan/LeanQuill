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

// --- Outline & Beat Planning types (Phase 3) ---

export interface OutlineBeat {
  id: string;
  title: string;
  fileName: string;
  active: boolean;
  description: string;
  what: string;
  who: string;
  where: string;
  why: string;
  customFields: Record<string, string>;
}

export interface OutlineChapter {
  id: string;
  name: string;
  fileName: string;
  active: boolean;
  beats: OutlineBeat[];
}

export interface OutlinePart {
  id: string;
  name: string;
  active: boolean;
  chapters: OutlineChapter[];
}

export interface OutlineIndex {
  schemaVersion: number;
  parts: OutlinePart[];
}
