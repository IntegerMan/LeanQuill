import * as path from "node:path";
import type { OpenQuestionAssociation } from "./types";

/** Column: Associated with (Chapter, Character, Book, …). */
export function associationKindLabel(kind: OpenQuestionAssociation["kind"]): string {
  switch (kind) {
    case "book":
      return "Book";
    case "chapter":
      return "Chapter";
    case "selection":
      return "Selection";
    case "character":
      return "Character";
    case "place":
      return "Place";
    case "thread":
      return "Thread";
    case "research":
      return "Research";
    default:
      return "Book";
  }
}

/**
 * Source column only: path, filename, or book working title — no "Chapter ·" prefix.
 */
export function associationSourceDisplayText(
  association: OpenQuestionAssociation,
  bookWorkingTitle: string,
): string {
  const title = bookWorkingTitle.trim();
  switch (association.kind) {
    case "book":
      return title.length > 0 ? title : "(Untitled book)";
    case "chapter":
      return association.chapterRef;
    case "selection":
      return association.chapterRef;
    case "character":
      return association.fileName;
    case "place":
      return association.fileName;
    case "thread":
      return association.fileName;
    case "research":
      return path.basename(association.fileName) || association.fileName;
    default:
      return "";
  }
}
