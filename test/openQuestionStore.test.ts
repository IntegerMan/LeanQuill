import test from "node:test";
import assert from "node:assert/strict";
import {
  countActiveQuestionsLinkedToEntity,
  countOpenQuestionsLinkedToChapterRef,
  countOpenQuestionsLinkedToEntity,
  parseOpenQuestionFile,
  serializeOpenQuestionFile,
} from "../src/openQuestionStore";
import type { OpenQuestionRecord } from "../src/types";

/**
 * Phase 14 scopes to `type: author-note` (issue-schema) with `chapter_ref` + optional `span_hint`.
 * Stale / ambiguous `span_hint` resolution is host/UI responsibility (plan 14-06).
 *
 * Association keys `lq_character_file`, `lq_place_file`, `lq_thread_file`, and `lq_book_wide`
 * mirror 14-RESEARCH / Phase 8 merge path (`lq_assoc_*` extension namespace).
 */

function baseRecord(partial: Partial<OpenQuestionRecord> & Pick<OpenQuestionRecord, "id" | "title">): OpenQuestionRecord {
  const now = "2026-04-10T12:00:00.000Z";
  return {
    fileName: `${partial.id}.md`,
    id: partial.id,
    issueSchemaType: partial.issueSchemaType ?? "question",
    title: partial.title,
    body: partial.body ?? "",
    status: partial.status ?? "open",
    createdAt: partial.createdAt ?? now,
    updatedAt: partial.updatedAt ?? now,
    association: partial.association ?? { kind: "book" },
    dismissedReason: partial.dismissedReason,
    staleHint: partial.staleHint,
  };
}

test("round-trip book-wide author-note (lq_book_wide + book association)", () => {
  const orig = baseRecord({
    id: "oq-book",
    title: "Book question",
    association: { kind: "book" },
  });
  const raw = serializeOpenQuestionFile(orig);
  const back = parseOpenQuestionFile(orig.fileName, raw);
  assert.match(raw, /type:\s*question/);
  assert.equal(back.association.kind, "book");
});

test("round-trip character-linked question uses lq_character_file", () => {
  const orig = baseRecord({
    id: "oq-char",
    title: "Character beat",
    association: { kind: "character", fileName: "hero.md" },
  });
  const back = parseOpenQuestionFile(orig.fileName, serializeOpenQuestionFile(orig));
  assert.equal(back.association.kind, "character");
  if (back.association.kind === "character") {
    assert.equal(back.association.fileName, "hero.md");
  }
});

test("round-trip place-linked question uses lq_place_file", () => {
  const orig = baseRecord({
    id: "oq-place",
    title: "Place question",
    association: { kind: "place", fileName: "inn.md" },
  });
  const back = parseOpenQuestionFile(orig.fileName, serializeOpenQuestionFile(orig));
  assert.equal(back.association.kind, "place");
  if (back.association.kind === "place") {
    assert.equal(back.association.fileName, "inn.md");
  }
});

test("round-trip thread-linked question uses lq_thread_file", () => {
  const orig = baseRecord({
    id: "oq-thread",
    title: "Thread question",
    association: { kind: "thread", fileName: "arc-a.md" },
  });
  const back = parseOpenQuestionFile(orig.fileName, serializeOpenQuestionFile(orig));
  assert.equal(back.association.kind, "thread");
  if (back.association.kind === "thread") {
    assert.equal(back.association.fileName, "arc-a.md");
  }
});

test("round-trip research-linked question uses lq_research_file", () => {
  const orig = baseRecord({
    id: "oq-res",
    title: "Research question",
    association: { kind: "research", fileName: "nodules.md" },
  });
  const back = parseOpenQuestionFile(orig.fileName, serializeOpenQuestionFile(orig));
  assert.equal(back.association.kind, "research");
  if (back.association.kind === "research") {
    assert.equal(back.association.fileName, "nodules.md");
  }
});

test("round-trip chapter-only association uses manuscript chapter_ref", () => {
  const orig = baseRecord({
    id: "oq-ch",
    title: "Chapter scope",
    association: { kind: "chapter", chapterRef: "manuscript/ch01.md" },
  });
  const back = parseOpenQuestionFile(orig.fileName, serializeOpenQuestionFile(orig));
  assert.equal(back.association.kind, "chapter");
  if (back.association.kind === "chapter") {
    assert.equal(back.association.chapterRef, "manuscript/ch01.md");
  }
});

test("round-trip selection association keeps span_hint for D-05 anchoring", () => {
  const orig = baseRecord({
    id: "oq-sel",
    title: "Selection",
    association: { kind: "selection", chapterRef: "manuscript/ch02.md", spanHint: '"…the door was ajar."' },
  });
  const back = parseOpenQuestionFile(orig.fileName, serializeOpenQuestionFile(orig));
  assert.equal(back.association.kind, "selection");
  if (back.association.kind === "selection") {
    assert.equal(back.association.spanHint, '"…the door was ajar."');
  }
});

test("countOpenQuestionsLinkedToEntity uses basename match", () => {
  const qs = [
    baseRecord({ id: "a", title: "t", association: { kind: "character", fileName: "hero.md" } }),
    baseRecord({ id: "b", title: "t2", association: { kind: "place", fileName: "inn.md" } }),
  ];
  assert.equal(countOpenQuestionsLinkedToEntity(qs, "character", "notes/characters/hero.md"), 1);
  assert.equal(countOpenQuestionsLinkedToEntity(qs, "character", "hero.md"), 1);
  assert.equal(countOpenQuestionsLinkedToEntity(qs, "place", "inn.md"), 1);
});

test("countActiveQuestionsLinkedToEntity includes open+deferred only (D-06)", () => {
  const qs = [
    baseRecord({ id: "o", title: "t", association: { kind: "character", fileName: "hero.md" }, status: "open" }),
    baseRecord({ id: "def", title: "t2", association: { kind: "character", fileName: "hero.md" }, status: "deferred" }),
    baseRecord({ id: "r", title: "t3", association: { kind: "character", fileName: "hero.md" }, status: "resolved" }),
    baseRecord({ id: "x", title: "t4", association: { kind: "character", fileName: "hero.md" }, status: "dismissed" }),
  ];
  assert.equal(countActiveQuestionsLinkedToEntity(qs, "character", "hero.md"), 2);
});

test("countOpenQuestionsLinkedToChapterRef matches chapter and selection", () => {
  const qs = [
    baseRecord({
      id: "c",
      title: "t",
      association: { kind: "chapter", chapterRef: "manuscript/ch1.md" },
    }),
    baseRecord({
      id: "s",
      title: "t2",
      association: { kind: "selection", chapterRef: "manuscript/ch1.md", spanHint: "x" },
    }),
  ];
  assert.equal(countOpenQuestionsLinkedToChapterRef(qs, "manuscript/ch1.md"), 2);
  assert.equal(countOpenQuestionsLinkedToChapterRef(qs, "manuscript/other.md"), 0);
});

test("Phase 14 statuses: open deferred resolved round-trip", () => {
  for (const status of ["open", "deferred", "resolved"] as const) {
    const orig = baseRecord({ id: `oq-${status}`, title: "T", status });
    const back = parseOpenQuestionFile(orig.fileName, serializeOpenQuestionFile(orig));
    assert.equal(back.status, status);
  }
});

test("ISSUE-02: dismissed status and dismissed_reason round-trip (issue-schema)", () => {
  const orig = baseRecord({
    id: "oq-dismissed",
    title: "Won't fix",
    status: "dismissed",
    dismissedReason: "Out of scope for this draft.",
  });
  const raw = serializeOpenQuestionFile(orig);
  assert.match(raw, /status:\s*dismissed/);
  assert.match(raw, /dismissed_reason:\s*.+Out of scope/);
  const back = parseOpenQuestionFile(orig.fileName, raw);
  assert.equal(back.status, "dismissed");
  assert.equal(back.dismissedReason, "Out of scope for this draft.");
});
