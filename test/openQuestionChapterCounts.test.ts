import test from "node:test";
import assert from "node:assert/strict";
import { countOpenQuestionsByChapter } from "../src/openQuestionStore";
import type { OpenQuestionRecord } from "../src/types";

/**
 * D-03: per-chapter open counts use normalized `manuscript/...` keys.
 * Book-wide and entity-only (character / place / thread) open questions must not increment a chapter path.
 */

const NOW = "2026-04-10T12:00:00.000Z";

function q(partial: Partial<OpenQuestionRecord> & Pick<OpenQuestionRecord, "id" | "association">): OpenQuestionRecord {
  return {
    fileName: `${partial.id}.md`,
    id: partial.id,
    title: partial.title ?? "t",
    body: partial.body ?? "",
    status: partial.status ?? "open",
    createdAt: partial.createdAt ?? NOW,
    updatedAt: partial.updatedAt ?? NOW,
    association: partial.association,
  };
}

test("countOpenQuestionsByChapter aggregates multiple open on same manuscript path", () => {
  const questions = [
    q({ id: "a", association: { kind: "chapter", chapterRef: "manuscript/ch01.md" } }),
    q({ id: "b", association: { kind: "selection", chapterRef: "manuscript/ch01.md", spanHint: "x" } }),
  ];
  const counts = countOpenQuestionsByChapter(questions);
  assert.equal(counts["manuscript/ch01.md"], 2);
});

test("resolved and deferred are excluded from open count", () => {
  const questions = [
    q({ id: "o", status: "open", association: { kind: "chapter", chapterRef: "manuscript/a.md" } }),
    q({ id: "r", status: "resolved", association: { kind: "chapter", chapterRef: "manuscript/a.md" } }),
    q({ id: "d", status: "deferred", association: { kind: "chapter", chapterRef: "manuscript/a.md" } }),
  ];
  const counts = countOpenQuestionsByChapter(questions);
  assert.equal(counts["manuscript/a.md"], 1);
});

test("Windows-style chapter_ref normalizes to manuscript/ forward slashes", () => {
  const questions = [q({ id: "w", association: { kind: "chapter", chapterRef: "manuscript\\ch01.md" } })];
  const counts = countOpenQuestionsByChapter(questions);
  assert.equal(counts["manuscript/ch01.md"], 1);
});

test("book entity thread place open questions do not increment manuscript chapter keys", () => {
  const questions = [
    q({ id: "book", association: { kind: "book" } }),
    q({ id: "char", association: { kind: "character", fileName: "c.md" } }),
    q({ id: "pl", association: { kind: "place", fileName: "p.md" } }),
    q({ id: "th", association: { kind: "thread", fileName: "t.md" } }),
  ];
  const counts = countOpenQuestionsByChapter(questions);
  assert.deepEqual(counts, {});
});
