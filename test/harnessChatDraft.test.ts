import test from "node:test";
import assert from "node:assert/strict";
import { buildHarnessDraftQuery, buildHarnessFallbackHint, buildStoryChatDraftQuery } from "../src/harnessChatDraft";
import { buildStoryChatContextBundle } from "../src/storyChatContext";

test("buildHarnessDraftQuery — research, import, storyChat × Cursor/plain", () => {
  assert.equal(buildHarnessDraftQuery({ isCursorOrCopilot: true, kind: "research" }), "@leanquill-researcher ");
  assert.equal(buildHarnessDraftQuery({ isCursorOrCopilot: true, kind: "import" }), "@leanquill-import-research ");
  assert.equal(buildHarnessDraftQuery({ isCursorOrCopilot: true, kind: "storyChat" }), "@leanquill-story-chat ");
  assert.equal(buildHarnessDraftQuery({ isCursorOrCopilot: false, kind: "research" }), "Research: ");
  assert.equal(buildHarnessDraftQuery({ isCursorOrCopilot: false, kind: "import" }), "Import research: ");
  assert.equal(buildHarnessDraftQuery({ isCursorOrCopilot: false, kind: "storyChat" }), "Story chat: ");
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

test("buildHarnessFallbackHint — storyChat references LeanQuill-Story-Chat and agent slug", () => {
  const hint = buildHarnessFallbackHint("storyChat");
  assert.match(hint, /Open your AI chat and invoke LeanQuill-Story-Chat/);
  assert.match(hint, /\/agent:leanquill-story-chat <your story question>/);
});

test("buildStoryChatDraftQuery includes context block and story question", () => {
  const bundle = buildStoryChatContextBundle({ launchedFrom: "general" });
  const q = buildStoryChatDraftQuery({
    isCursorOrCopilot: true,
    contextSummary: bundle.summary,
    storyQuestion: "Who is the antagonist?",
  });
  assert.match(q, /^@leanquill-story-chat /m);
  assert.match(q, /LeanQuill story chat context:/);
  assert.match(q, /Manuscript scope: none/);
  assert.match(q, /Story question: Who is the antagonist\?/);
});
