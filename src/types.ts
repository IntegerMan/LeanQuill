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
