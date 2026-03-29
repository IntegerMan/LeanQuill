export interface InitInput {
  projectId: string;
  workingTitle: string;
  genre: string[];
  targetAudience: string;
}

export interface ChapterOrderResult {
  chapterPaths: string[];
  warnings: string[];
  source: "book-txt" | "alpha";
}
