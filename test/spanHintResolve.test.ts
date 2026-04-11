import test from "node:test";
import assert from "node:assert/strict";
import { resolveSpanHintInDocument } from "../src/spanHintResolve";

/**
 * ISSUE-04 / D-13: span_hint resolution against live manuscript text.
 * Phase 08-01 only guards the stub; 08-02 implements matching, stale detection,
 * and bounded fuzzy re-search from preferredStartIndex.
 */

test("resolveSpanHintInDocument throws STUB until 08-02", () => {
  assert.throws(
    () => resolveSpanHintInDocument("body text", "fragment"),
    /STUB: Phase 08-02 implements/,
  );
});

// D-13 (08-02): planned cases — exact fragment match; empty hint → stale; fuzzy window
// (max N chars from preferredStartIndex) for best-effort re-resolution after edits.
test.skip("D-13 exact match returns range when fragment unique in document", () => {
  // 08-02 enables
});

test.skip("D-13 empty span_hint treated as stale / unmatched", () => {
  // 08-02 enables
});

test.skip("D-13 fuzzy nearby match within bounds from preferredStartIndex", () => {
  // 08-02 enables
});

test.skip("D-13 ambiguous duplicate fragments returns discriminated ambiguous result", () => {
  // 08-02 enables — multiple occurrences without preferredStartIndex disambiguation
});

test.skip("D-13 preferredStartIndex steers search window for nearby edits", () => {
  // 08-02 enables — bounded scan around cursor / last-known offset
});
