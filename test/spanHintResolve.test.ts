import test from "node:test";
import assert from "node:assert/strict";
import { resolveSpanHintInDocument } from "../src/spanHintResolve";

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
