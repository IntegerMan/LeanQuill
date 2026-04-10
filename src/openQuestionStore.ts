// STUB: replaced by plan 14-02

/**
 * Phase 14 open-question persistence (compile surface for Wave 0 tests).
 * Plan 14-02 replaces this stub with SafeFileSystem-backed CRUD.
 */

export type OpenQuestionStatus = "open" | "deferred" | "resolved";

/** Minimal shape Wave 0 tests round-trip; 14-02 aligns with `OpenQuestionRecord` in types. */
export interface OpenQuestionFileRecord {
  fileName: string;
  id: string;
  type: "author-note";
  status: OpenQuestionStatus;
  title: string;
  body: string;
  createdAt: string;
  /** issue-schema `chapter_ref` — manuscript path or `project-wide`. */
  chapter_ref: string;
  /** Optional quoted fragment near the anchor (D-05). */
  span_hint?: string;
  /** Extension discriminator for Phase 8 merge: book | character | place | thread | chapter | selection */
  lq_assoc_kind: "book" | "character" | "place" | "thread" | "chapter" | "selection";
  lq_book_wide?: boolean;
  lq_character_file?: string;
  lq_place_file?: string;
  lq_thread_file?: string;
}

export function parseOpenQuestionFile(_fileName: string, _content: string): OpenQuestionFileRecord {
  throw new Error("not implemented");
}

export function serializeOpenQuestionFile(_record: OpenQuestionFileRecord): string {
  throw new Error("not implemented");
}

/**
 * Count `open` questions per normalized manuscript `chapter_ref`.
 * Book-wide and entity-only associations must not increment chapter keys (D-03).
 */
export function countOpenQuestionsByChapter(questions: OpenQuestionFileRecord[]): Record<string, number> {
  void questions;
  return {};
}
