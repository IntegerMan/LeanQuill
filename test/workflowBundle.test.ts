import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { ensureLeanquillWorkflows } from "../src/leanquillWorkflows";
import { SafeFileSystem } from "../src/safeFileSystem";
import {
  isLeanquillWorkflowPinned,
  LEANQUILL_WORKFLOW_BUNDLE_VERSION,
  readWorkflowBundleFromContent,
} from "../src/workflowBundle";

const sample = (bundle: number, extra = ""): string =>
  `---\nname: Test\nversion: 1\nleanquill_workflow_bundle: ${bundle}\n${extra}---\n\n# Body\n`;

test("readWorkflowBundleFromContent returns 0 when key missing", () => {
  assert.equal(readWorkflowBundleFromContent("---\nname: A\nversion: 1\n---\n\nx"), 0);
});

test("readWorkflowBundleFromContent reads bundle id", () => {
  assert.equal(readWorkflowBundleFromContent(sample(3)), 3);
  assert.equal(readWorkflowBundleFromContent(sample(42, "leanquill_workflow_pinned: true\n")), 42);
});

test("isLeanquillWorkflowPinned detects true/yes/1", () => {
  assert.equal(isLeanquillWorkflowPinned(sample(1, "leanquill_workflow_pinned: true\n")), true);
  assert.equal(isLeanquillWorkflowPinned(sample(1, "leanquill_workflow_pinned: yes\n")), true);
  assert.equal(isLeanquillWorkflowPinned(sample(1, "leanquill_workflow_pinned: 1\n")), true);
  assert.equal(isLeanquillWorkflowPinned(sample(1)), false);
  assert.equal(isLeanquillWorkflowPinned("no front"), false);
});

test("ensureLeanquillWorkflows refreshes stale story-chat when bundle is older on disk", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "lq-wf-"));
  try {
    const wfDir = path.join(root, ".leanquill", "workflows");
    await fs.mkdir(wfDir, { recursive: true });
    const story = path.join(wfDir, "story-chat.md");
    await fs.writeFile(story, "---\nname: Old\nversion: 1\n---\n\nOld body", "utf8");
    await ensureLeanquillWorkflows(root, new SafeFileSystem(root));
    const s = await fs.readFile(story, "utf8");
    assert.equal(readWorkflowBundleFromContent(s), LEANQUILL_WORKFLOW_BUNDLE_VERSION);
    assert.match(s, /Author experience \(required\)/);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("ensureLeanquillWorkflows does not replace pinned story-chat", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "lq-wf-"));
  try {
    const wfDir = path.join(root, ".leanquill", "workflows");
    await fs.mkdir(wfDir, { recursive: true });
    const story = path.join(wfDir, "story-chat.md");
    const custom = "---\nname: Custom\nversion: 1\nleanquill_workflow_pinned: true\n---\n\nPinned only\n";
    await fs.writeFile(story, custom, "utf8");
    await ensureLeanquillWorkflows(root, new SafeFileSystem(root));
    const s = await fs.readFile(story, "utf8");
    assert.equal(s, custom);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
