import test from "node:test";
import assert from "node:assert/strict";
import { countOpenQuestionsByChapter, type OpenQuestionFileRecord } from "../src/openQuestionStore";

/**
 * D-03: per-chapter open counts use normalized `manuscript/...` keys.
 * Book-wide and entity-only (character / place / thread) open questions must not increment a chapter path.
 */

function q(partial: Partial<OpenQuestionFileRecord> & Pick<OpenQuestionFileRecord, "id">): OpenQuestionFileRecord {
  return {
    fileName: `${partial.id}.md`,
    id: partial.id,
    type: "author-note",
    status: partial.status ?? "open",
    title: partial.title ?? "t",
    body: partial.body ?? "",
    createdAt: partial.createdAt ?? "2026-04-10T12:00:00.000Z",
    chapter_ref: partial.chapter_ref ?? "manuscript/ch01.md",
    span_hint: partial.span_hint,
    lq_assoc_kind: partial.lq_assoc_kind ?? "chapter",
    lq_book_wide: partial.lq_book_wide,
    lq_character_file: partial.lq_character_file,
    lq_place_file: partial.lq_place_file,
    lq_thread_file: partial.lq_thread_file,
  };
}

test("countOpenQuestionsByChapter aggregates multiple open on same manuscript path", () => {
  const questions = [
    q({ id: "a", chapter_ref: "manuscript/ch01.md", lq_assoc_kind: "chapter" }),
    q({ id: "b", chapter_ref: "manuscript/ch01.md", lq_assoc_kind: "selection", span_hint: "x" }),
  ];
  const counts = countOpenQuestionsByChapter(questions);
  assert.equal(counts["manuscript/ch01.md"], 2);
});

test("resolved and deferred are excluded from open count", () => {
  const questions = [
    q({ id: "o", status: "open", chapter_ref: "manuscript/a.md", lq_assoc_kind: "chapter" }),
    q({ id: "r", status: "resolved", chapter_ref: "manuscript/a.md", lq_assoc_kind: "chapter" }),
    q({ id: "d", status: "deferred", chapter_ref: "manuscript/a.md", lq_assoc_kind: "chapter" }),
  ];
  const counts = countOpenQuestionsByChapter(questions);
  assert.equal(counts["manuscript/a.md"], 1);
});

test("Windows-style chapter_ref normalizes to manuscript/ forward slashes", () => {
  const questions = [q({ id: "w", chapter_ref: "manuscript\\ch01.md", lq_assoc_kind: "chapter" })];
  const counts = countOpenQuestionsByChapter(questions);
  assert.equal(counts["manuscript/ch01.md"], 1);
});

test("book entity thread place open questions do not increment manuscript chapter keys", () => {
  const questions = [
    q({
      id: "book",
      chapter_ref: "project-wide",
      lq_assoc_kind: "book",
      lq_book_wide: true,
    }),
    q({ id: "char", chapter_ref: "project-wide", lq_assoc_kind: "character", lq_character_file: "c.md" }),
    q({ id: "pl", chapter_ref: "project-wide", lq_assoc_kind: "place", lq_place_file: "p.md" }),
    q({ id: "th", chapter_ref: "project-wide", lq_assoc_kind: "thread", lq_thread_file: "t.md" }),
  ];
  const counts = countOpenQuestionsByChapter(questions);
  assert.deepEqual(counts, {});
});
