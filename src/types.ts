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
