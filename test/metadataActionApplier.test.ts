import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { SafeFileSystem } from "../src/safeFileSystem";
import { applyMetadataAction, configuredMetadataWritableRoots } from "../src/metadataActionApplier";
import { readProjectConfigWithDefaults } from "../src/projectConfig";
import { serializeCharacterFile, type CharacterProfile } from "../src/characterStore";
import { createStoryMemory } from "../src/storyMemoryStore";
import { saveStoryChatLogSummary, type StoryChatLogSummary } from "../src/storyChatLogStore";
import { readMetadataActionLog } from "../src/metadataActionLog";

async function setupWorkspace(): Promise<{ root: string; safe: SafeFileSystem }> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "lq-apply-"));
  const safe = new SafeFileSystem(root);
  await fs.mkdir(path.join(root, ".leanquill", "memory"), { recursive: true });
  await fs.mkdir(path.join(root, ".leanquill", "chats"), { recursive: true });
  await fs.mkdir(path.join(root, ".leanquill", "issues", "question"), { recursive: true });
  await fs.mkdir(path.join(root, "notes", "characters"), { recursive: true });
  await fs.mkdir(path.join(root, "research", "leanquill"), { recursive: true });
  safe.allowPath("notes/characters", ".md");
  safe.allowPath("research/leanquill", ".md");
  const hero: CharacterProfile = {
    fileName: "hero.md",
    name: "Hero",
    aliases: [],
    role: "",
    description: "d",
    referencedByNameIn: [],
    customFields: { notes: "alpha" },
    body: "",
  };
  await safe.writeFile(path.join(root, "notes", "characters", "hero.md"), serializeCharacterFile(hero));
  await fs.writeFile(
    path.join(root, ".leanquill", "project.yaml"),
    [
      'schema_version: "2"',
      "project_id: test",
      "working_title: T",
      "genre:",
      "  - fiction",
      "folders:",
      "  manuscript: manuscript/",
      "  characters: notes/characters/",
      "  threads: notes/threads/",
      "  settings: notes/settings/",
      "  research: research/leanquill/",
      "  tool_state: .leanquill/",
    ].join("\n"),
    "utf8",
  );
  const issueBody = `---
id: issue-one
type: question
status: open
priority: 3
title: Issue
created_at: "2026-01-01T00:00:00.000Z"
updated_at: "2026-01-01T00:00:00.000Z"
source: author
chapter_ref: ""
span_hint: ""
agent_profile: author
evidence_links: []
confidence: unrated
verify_manually: false
intentional: false
intentional_note: ""
dismissed_reason: ""
lq_assoc_kind: book
---
`;
  await safe.writeFile(path.join(root, ".leanquill", "issues", "question", "issue-one.md"), issueBody);
  const researchFm = `---
name: R
query: q
created: "2026-01-01"
tags: []
sources: []
lq_character_file: ""
---
Body
`;
  await safe.writeFile(path.join(root, "research", "leanquill", "r.md"), researchFm);
  return { root, safe };
}

test("configuredMetadataWritableRoots includes leanquill", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "lq-roots-"));
  await fs.mkdir(path.join(root, ".leanquill"), { recursive: true });
  await fs.writeFile(
    path.join(root, ".leanquill", "project.yaml"),
    'schema_version: "2"\nproject_id: x\nworking_title: T\ngenre:\n  - fiction\nfolders:\n  manuscript: manuscript/\n  characters: notes/characters/\n  threads: notes/threads/\n  settings: notes/settings/\n  research: research/leanquill/\n  tool_state: .leanquill/\n',
    "utf8",
  );
  const cfg = await readProjectConfigWithDefaults(root);
  const roots = configuredMetadataWritableRoots(cfg);
  assert.ok(roots.some((r) => r.startsWith(".leanquill")));
});

test("applyMetadataAction createMemory", async () => {
  const { root, safe } = await setupWorkspace();
  const r = await applyMetadataAction(root, safe, {
    schemaVersion: "1",
    actionId: "m1",
    sourceChatId: "chat1",
    operation: "createMemory",
    targetPath: ".leanquill/memory/manual-test.md",
    fieldPath: [],
    rationale: "test",
    risk: "low",
    newValue: { topic: "T", body: "B", association: { kind: "book" } },
  });
  assert.equal(r.status, "applied");
});

test("applyMetadataAction blocks manuscript", async () => {
  const { root, safe } = await setupWorkspace();
  const r = await applyMetadataAction(root, safe, {
    schemaVersion: "1",
    actionId: "bad",
    sourceChatId: "c",
    operation: "set",
    targetPath: "manuscript/ch01.md",
    fieldPath: ["customFields", "x"],
    rationale: "x",
    risk: "requiresApproval",
    authorApproval: { approvedAt: "2026-01-01", method: "extension-command" },
    newValue: "y",
  });
  assert.equal(r.status, "blocked");
});

test("applyMetadataAction stale oldValue on character custom field", async () => {
  const { root, safe } = await setupWorkspace();
  const r = await applyMetadataAction(root, safe, {
    schemaVersion: "1",
    actionId: "st",
    sourceChatId: "c",
    operation: "set",
    targetPath: "notes/characters/hero.md",
    fieldPath: ["customFields", "notes"],
    oldValue: "wrong",
    newValue: "next",
    rationale: "r",
    risk: "requiresApproval",
    authorApproval: { approvedAt: "2026-01-01", method: "chat-text-confirmation" },
  });
  assert.equal(r.status, "rejected");
  assert.match(r.message, /out of date/);
});

test("applyMetadataAction supersedeMemory and updateIssueStatus", async () => {
  const { root, safe } = await setupWorkspace();
  const mem = await createStoryMemory({ topic: "old", body: "b", sourceChatId: "s", association: { kind: "book" } }, root, safe);
  const sup = await applyMetadataAction(root, safe, {
    schemaVersion: "1",
    actionId: "sup",
    sourceChatId: "s",
    operation: "supersedeMemory",
    targetPath: `.leanquill/memory/${mem.fileName}`,
    fieldPath: ["memory", mem.id],
    rationale: "r",
    risk: "low",
    newValue: { topic: "new", body: "nb" },
  });
  assert.equal(sup.status, "applied");

  const st = await applyMetadataAction(root, safe, {
    schemaVersion: "1",
    actionId: "iss",
    sourceChatId: "s",
    operation: "updateIssueStatus",
    targetPath: ".leanquill/issues/question/issue-one.md",
    fieldPath: ["status"],
    oldValue: "open",
    newValue: "deferred",
    rationale: "r",
    risk: "requiresApproval",
    authorApproval: { approvedAt: "2026-01-01", method: "extension-command" },
  });
  assert.equal(st.status, "applied");
});

test("applyMetadataAction theme and research and chat provenance", async () => {
  const { root, safe } = await setupWorkspace();
  const theme = await applyMetadataAction(root, safe, {
    schemaVersion: "1",
    actionId: "th",
    sourceChatId: "s",
    operation: "updateThemeMetadata",
    targetPath: ".leanquill/themes.yaml",
    fieldPath: [],
    rationale: "r",
    risk: "requiresApproval",
    authorApproval: { approvedAt: "2026-01-01", method: "extension-command" },
    newValue: { centralQuestion: "Who?" },
  });
  assert.equal(theme.status, "applied");

  const res = await applyMetadataAction(root, safe, {
    schemaVersion: "1",
    actionId: "rs",
    sourceChatId: "s",
    operation: "updateResearchAssociation",
    targetPath: "research/leanquill/r.md",
    fieldPath: [],
    rationale: "r",
    risk: "requiresApproval",
    authorApproval: { approvedAt: "2026-01-01", method: "native-tool-confirmation" },
    newValue: { lq_character_file: "hero.md" },
  });
  assert.equal(res.status, "applied");

  const log: StoryChatLogSummary = {
    sessionId: "chatlog1",
    startedAt: "2026-01-01",
    endedAt: "2026-01-01",
    launchedFrom: "general",
    chapterRef: "",
    chaptersInContext: [],
    summary: "s",
    memoryEntryIds: [],
    metadataActionIds: [],
  };
  await saveStoryChatLogSummary(root, safe, log);
  const prov = await applyMetadataAction(root, safe, {
    schemaVersion: "1",
    actionId: "pr",
    sourceChatId: "s",
    operation: "updateChatLogProvenance",
    targetPath: ".leanquill/chats/chatlog1.md",
    fieldPath: [],
    rationale: "r",
    risk: "low",
    oldValue: { memoryEntryIds: [], metadataActionIds: [] },
    newValue: { memoryEntryIds: ["m1"], metadataActionIds: ["a1"] },
  });
  assert.equal(prov.status, "applied");
});

test("story intelligence append adds chapter_backlinks on character", async () => {
  const { root, safe } = await setupWorkspace();
  const r = await applyMetadataAction(root, safe, {
    schemaVersion: "1",
    actionId: "siu-char-backlink-1",
    sourceChatId: "2026-04-25-120000-story-intelligence-update",
    operation: "append",
    targetPath: "notes/characters/hero.md",
    fieldPath: ["customFields", "chapter_backlinks"],
    oldValue: "",
    newValue: "- manuscript/ch03.md: appeared in the dock scene",
    rationale: "Adds a source chapter backlink from story intelligence.",
    risk: "requiresApproval",
    authorApproval: { approvedAt: "2026-04-25T12:10:00.000Z", method: "extension-command" },
  });
  assert.equal(r.status, "applied");
  const raw = await fs.readFile(path.join(root, "notes", "characters", "hero.md"), "utf8");
  assert.match(raw, /manuscript\/ch03\.md/);
});

test("story intelligence createMemory from story-intelligence-update session", async () => {
  const { root, safe } = await setupWorkspace();
  const r = await applyMetadataAction(root, safe, {
    schemaVersion: "1",
    actionId: "siu-mem-1",
    sourceChatId: "2026-04-25-120000-story-intelligence-update",
    operation: "createMemory",
    targetPath: ".leanquill/memory/siu-mem.md",
    fieldPath: [],
    rationale: "m",
    risk: "requiresApproval",
    authorApproval: { approvedAt: "2026-04-25T12:10:00.000Z", method: "extension-command" },
    newValue: {
      topic: "Chapter 3 entity updates",
      body: "- manuscript/ch03.md: dock scene introduced the witness.",
      association: { kind: "chapter", chapterRef: "manuscript/ch03.md" },
    },
  });
  assert.equal(r.status, "applied");
  const rows = await readMetadataActionLog(root);
  assert.ok(rows.some((x) => x.sourceChatId.includes("story-intelligence-update") && x.status === "applied"));
});

test("approved action targeting manuscript chapter is blocked", async () => {
  const { root, safe } = await setupWorkspace();
  await fs.mkdir(path.join(root, "manuscript"), { recursive: true });
  await fs.writeFile(path.join(root, "manuscript", "ch03.md"), "# x\n", "utf8");
  const r = await applyMetadataAction(root, safe, {
    schemaVersion: "1",
    actionId: "siu-ms",
    sourceChatId: "2026-04-25-120000-story-intelligence-update",
    operation: "set",
    targetPath: "manuscript/ch03.md",
    fieldPath: ["customFields", "x"],
    rationale: "bad",
    risk: "requiresApproval",
    authorApproval: { approvedAt: "2026-04-25T12:10:00.000Z", method: "extension-command" },
    newValue: "y",
  });
  assert.equal(r.status, "blocked");
});

test("low risk append to character without approval is rejected", async () => {
  const { root, safe } = await setupWorkspace();
  const r = await applyMetadataAction(root, safe, {
    schemaVersion: "1",
    actionId: "low-bad",
    sourceChatId: "c",
    operation: "append",
    targetPath: "notes/characters/hero.md",
    fieldPath: ["customFields", "chapter_backlinks"],
    oldValue: "",
    newValue: "- manuscript/ch03.md",
    rationale: "r",
    risk: "low",
  });
  assert.equal(r.status, "blocked");
});

test("applyMetadataAction logs applied and blocked", async () => {
  const { root, safe } = await setupWorkspace();
  await applyMetadataAction(root, safe, {
    schemaVersion: "1",
    actionId: "ok",
    sourceChatId: "s",
    operation: "createMemory",
    targetPath: ".leanquill/memory/z2.md",
    fieldPath: [],
    rationale: "r",
    risk: "low",
    newValue: { topic: "t", body: "b" },
  });
  await applyMetadataAction(root, safe, {
    schemaVersion: "1",
    actionId: "blk",
    sourceChatId: "s",
    operation: "set",
    targetPath: "manuscript/ch01.md",
    fieldPath: ["customFields", "x"],
    rationale: "r",
    risk: "requiresApproval",
    authorApproval: { approvedAt: "2026-01-01", method: "extension-command" },
    newValue: "x",
  });
  const rows = await readMetadataActionLog(root);
  assert.ok(rows.some((x) => x.status === "applied"));
  assert.ok(rows.some((x) => x.status === "blocked"));
});
