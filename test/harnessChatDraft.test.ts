import test from "node:test";
import assert from "node:assert/strict";
import { buildHarnessDraftQuery, buildHarnessFallbackHint } from "../src/harnessChatDraft";

test("buildHarnessDraftQuery — all four combinations", () => {
  assert.equal(buildHarnessDraftQuery({ isCursorOrCopilot: true, kind: "research" }), "@leanquill-researcher ");
  assert.equal(buildHarnessDraftQuery({ isCursorOrCopilot: true, kind: "import" }), "@leanquill-import-research ");
  assert.equal(buildHarnessDraftQuery({ isCursorOrCopilot: false, kind: "research" }), "Research: ");
  assert.equal(buildHarnessDraftQuery({ isCursorOrCopilot: false, kind: "import" }), "Import research: ");
});

test("buildHarnessFallbackHint — research references leanquill-researcher", () => {
  const hint = buildHarnessFallbackHint("research");
  assert.match(hint, /\/agent:leanquill-researcher/);
  assert.match(hint, /LeanQuill-Researcher/);
});

test("buildHarnessFallbackHint — import references leanquill-import-research", () => {
  const hint = buildHarnessFallbackHint("import");
  assert.match(hint, /\/agent:leanquill-import-research/);
  assert.match(hint, /LeanQuill-Import-Research/);
});
