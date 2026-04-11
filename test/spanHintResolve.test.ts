import test from "node:test";
import assert from "node:assert/strict";
import { resolveSpanHintInDocument } from "../src/spanHintResolve";

/**
 * ISSUE-04 / D-13: span_hint resolution against live manuscript text.
 */

test("D-13 exact match returns range when fragment unique in document", () => {
  const doc = "prefix the quick brown fox suffix";
  const r = resolveSpanHintInDocument(doc, "the quick brown fox");
  assert.deepEqual(r, { kind: "matched", start: 7, end: 26 });
});

test("D-13 empty span_hint treated as stale / unmatched", () => {
  assert.deepEqual(resolveSpanHintInDocument("abc", "   "), { kind: "stale" });
  assert.deepEqual(resolveSpanHintInDocument("abc", "..."), { kind: "stale" });
});

test("D-13 strips ellipses and surrounding quotes from hint", () => {
  const doc = "He said hello there once.";
  const r = resolveSpanHintInDocument(doc, '..."hello there"...');
  assert.equal(r.kind, "matched");
  if (r.kind === "matched") {
    assert.equal(doc.slice(r.start, r.end), "hello there");
  }
});

test("D-13 fuzzy nearby match within bounds from preferredStartIndex", () => {
  const doc = "AAAA" + "x".repeat(300) + "quick brown" + "y".repeat(300) + "ZZZZ";
  const pref = "AAAA".length + 300 + 4;
  const r = resolveSpanHintInDocument(doc, "quick brown fox jumped over", pref);
  assert.equal(r.kind, "matched");
  if (r.kind === "matched") {
    assert.equal(doc.slice(r.start, r.end), "quick brown");
  }
});

test("D-13 ambiguous duplicate fragments returns discriminated ambiguous result", () => {
  const doc = "foo bar foo baz foo";
  const r = resolveSpanHintInDocument(doc, "foo");
  assert.equal(r.kind, "ambiguous");
  if (r.kind === "ambiguous") {
    assert.equal(r.candidates.length, 3);
  }
});

test("D-13 preferredStartIndex steers search window for nearby edits", () => {
  const doc = "aaa foo bbb foo ccc";
  const secondFoo = doc.indexOf("foo", 4);
  const r = resolveSpanHintInDocument(doc, "foo", secondFoo);
  assert.equal(r.kind, "matched");
  if (r.kind === "matched") {
    assert.equal(r.start, secondFoo);
  }
});
