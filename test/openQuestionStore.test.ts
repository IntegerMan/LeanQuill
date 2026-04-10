import test from "node:test";
import assert from "node:assert/strict";
import {
  parseOpenQuestionFile,
  serializeOpenQuestionFile,
  type OpenQuestionFileRecord,
} from "../src/openQuestionStore";

/**
 * Phase 14 scopes to `type: author-note` (issue-schema) with `chapter_ref` + optional `span_hint`.
 * Stale / ambiguous `span_hint` resolution is host/UI responsibility (plan 14-06).
 *
 * Association keys `lq_character_file`, `lq_place_file`, `lq_thread_file`, and `lq_book_wide`
 * mirror 14-RESEARCH / Phase 8 merge path (`lq_assoc_*` extension namespace).
 */

function baseRecord(partial: Partial<OpenQuestionFileRecord> & Pick<OpenQuestionFileRecord, "id" | "title">): OpenQuestionFileRecord {
  return {
    fileName: `${partial.id}.md`,
    id: partial.id,
    type: "author-note",
    status: partial.status ?? "open",
    title: partial.title,
    body: partial.body ?? "",
    createdAt: partial.createdAt ?? "2026-04-10T12:00:00.000Z",
    chapter_ref: partial.chapter_ref ?? "project-wide",
    span_hint: partial.span_hint,
    lq_assoc_kind: partial.lq_assoc_kind ?? "book",
    lq_book_wide: partial.lq_book_wide,
    lq_character_file: partial.lq_character_file,
    lq_place_file: partial.lq_place_file,
    lq_thread_file: partial.lq_thread_file,
  };
}

test("round-trip book-wide author-note (lq_book_wide + book association)", () => {
  const orig = baseRecord({
    id: "oq-book",
    title: "Book question",
    chapter_ref: "project-wide",
    lq_assoc_kind: "book",
    lq_book_wide: true,
  });
  const raw = serializeOpenQuestionFile(orig);
  const back = parseOpenQuestionFile(orig.fileName, raw);
  assert.equal(back.type, "author-note");
  assert.equal(back.chapter_ref, "project-wide");
  assert.equal(back.lq_assoc_kind, "book");
  assert.equal(back.lq_book_wide, true);
});

test("round-trip character-linked question uses lq_character_file", () => {
  const orig = baseRecord({
    id: "oq-char",
    title: "Character beat",
    chapter_ref: "project-wide",
    lq_assoc_kind: "character",
    lq_character_file: "hero.md",
  });
  const back = parseOpenQuestionFile(orig.fileName, serializeOpenQuestionFile(orig));
  assert.equal(back.lq_assoc_kind, "character");
  assert.equal(back.lq_character_file, "hero.md");
});

test("round-trip place-linked question uses lq_place_file", () => {
  const orig = baseRecord({
    id: "oq-place",
    title: "Place question",
    chapter_ref: "project-wide",
    lq_assoc_kind: "place",
    lq_place_file: "inn.md",
  });
  const back = parseOpenQuestionFile(orig.fileName, serializeOpenQuestionFile(orig));
  assert.equal(back.lq_assoc_kind, "place");
  assert.equal(back.lq_place_file, "inn.md");
});

test("round-trip thread-linked question uses lq_thread_file", () => {
  const orig = baseRecord({
    id: "oq-thread",
    title: "Thread question",
    chapter_ref: "project-wide",
    lq_assoc_kind: "thread",
    lq_thread_file: "arc-a.md",
  });
  const back = parseOpenQuestionFile(orig.fileName, serializeOpenQuestionFile(orig));
  assert.equal(back.lq_assoc_kind, "thread");
  assert.equal(back.lq_thread_file, "arc-a.md");
});

test("round-trip chapter-only association uses manuscript chapter_ref", () => {
  const orig = baseRecord({
    id: "oq-ch",
    title: "Chapter scope",
    chapter_ref: "manuscript/ch01.md",
    lq_assoc_kind: "chapter",
  });
  const back = parseOpenQuestionFile(orig.fileName, serializeOpenQuestionFile(orig));
  assert.equal(back.chapter_ref, "manuscript/ch01.md");
  assert.equal(back.lq_assoc_kind, "chapter");
});

test("round-trip selection association keeps span_hint for D-05 anchoring", () => {
  const orig = baseRecord({
    id: "oq-sel",
    title: "Selection",
    chapter_ref: "manuscript/ch02.md",
    lq_assoc_kind: "selection",
    span_hint: '"…the door was ajar."',
  });
  const back = parseOpenQuestionFile(orig.fileName, serializeOpenQuestionFile(orig));
  assert.equal(back.span_hint, '"…the door was ajar."');
  assert.equal(back.lq_assoc_kind, "selection");
});

test("Phase 14 statuses: open deferred resolved only (no dismissed in Phase 14)", () => {
  for (const status of ["open", "deferred", "resolved"] as const) {
    const orig = baseRecord({ id: `oq-${status}`, title: "T", status });
    const back = parseOpenQuestionFile(orig.fileName, serializeOpenQuestionFile(orig));
    assert.equal(back.status, status);
  }
});
