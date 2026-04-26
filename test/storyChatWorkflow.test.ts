import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import * as path from "node:path";

test("leanquillWorkflows.ts ships story-chat and metadata-actions workflow contracts", async () => {
  const lqw = path.join(__dirname, "..", "src", "leanquillWorkflows.ts");
  const initPath = path.join(__dirname, "..", "src", "initialize.ts");
  const src = await fs.readFile(lqw, "utf8");
  const init = await fs.readFile(initPath, "utf8");
  assert.match(src, /STORY_CHAT_WORKFLOW_CONTENT/);
  assert.match(src, /METADATA_ACTION_WORKFLOW_CONTENT/);
  assert.match(src, /story-chat\.md/);
  assert.match(src, /metadata-actions\.md/);
  assert.match(
    src,
    /AI proposes metadata actions; LeanQuill extension code validates and applies accepted actions/,
  );
  assert.match(src, /Full manuscript context is never automatic/);
  assert.match(src, /LeanQuill advises but never authors manuscript prose/);
  assert.match(
    src,
    /Read active story memory from \.leanquill\/memory\/ before answering, using only records supplied by the LeanQuill chat context or active memory index/,
  );
  assert.match(src, /leanquill_workflow_bundle: \$\{LEANQUILL_WORKFLOW_BUNDLE_VERSION\}/s);
  assert.match(
    src,
    /After the chat, produce a session summary suitable for LeanQuill to save under \.leanquill\/chats\/ and \.leanquill\/memory\//,
  );
  assert.match(init, /LEANQUILL_WORKFLOW_SPECS/);
});

test("initialize.ts generates leanquill-story-chat harness trio", async () => {
  const initPath = path.join(__dirname, "..", "src", "initialize.ts");
  const lqw = path.join(__dirname, "..", "src", "leanquillWorkflows.ts");
  const src = await fs.readFile(initPath, "utf8");
  const wf = await fs.readFile(lqw, "utf8");
  assert.match(src, /leanquill-story-chat\.agent\.md/);
  assert.match(src, /"leanquill-story-chat"/);
  assert.match(src, /\.cursor.*skills.*leanquill-story-chat/s);
  assert.match(src, /leanquill-story-chat\.md/);
  assert.match(src, /name: leanquill-story-chat/g);
  assert.match(src, /LeanQuill-Story-Chat/g);
  assert.match(src, /\.leanquill\/workflows\/story-chat\.md/);
  assert.match(src, /\.leanquill\/workflows\/metadata-actions\.md/);
  assert.match(src, /\.leanquill\/memory\//);
  assert.match(wf, /\.leanquill\/chats\//);
  assert.match(src, /LeanQuill: Save Story Chat Summary/);
  assert.match(src, /leanquill-story-metadata-commit/);
  assert.match(src, /pending-metadata-action\.json/);
});
