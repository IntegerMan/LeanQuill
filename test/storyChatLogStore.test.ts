import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { SafeFileSystem } from "../src/safeFileSystem";
import {
  readStoryChatLogSummaryFromDisk,
  saveStoryChatLogSummary,
  saveStoryChatSessionSummary,
  serializeStoryChatLogSummary,
  type StoryChatLogSummary,
} from "../src/storyChatLogStore";

test("serializeStoryChatLogSummary includes required keys and story_updates_made", () => {
  const s: StoryChatLogSummary = {
    sessionId: "2026-04-25-120000-story-chat",
    startedAt: "2026-04-25T10:00:00.000Z",
    endedAt: "2026-04-25T10:30:00.000Z",
    launchedFrom: "general",
    chapterRef: "",
    chaptersInContext: ["manuscript/ch1.md"],
    summary: "Discussed plot.",
    memoryEntryIds: [],
    metadataActionIds: ["a1"],
  };
  const yaml = serializeStoryChatLogSummary(s);
  assert.match(yaml, /session_id:/);
  assert.match(yaml, /session_type: story-chat/);
  assert.match(yaml, /memory_entry_ids:/);
  assert.match(yaml, /metadata_action_ids:/);
  assert.match(yaml, /story_updates_made: true/);
  const s2: StoryChatLogSummary = { ...s, metadataActionIds: [], memoryEntryIds: [] };
  const yaml2 = serializeStoryChatLogSummary(s2);
  assert.match(yaml2, /story_updates_made: false/);
});

test("saveStoryChatLogSummary writes under .leanquill/chats", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "lq-chat-"));
  const safe = new SafeFileSystem(root);
  const summary: StoryChatLogSummary = {
    sessionId: "sess-a",
    startedAt: "2026-01-01T00:00:00.000Z",
    endedAt: "2026-01-01T01:00:00.000Z",
    launchedFrom: "general",
    chapterRef: "",
    chaptersInContext: [],
    summary: "Hi",
    memoryEntryIds: [],
    metadataActionIds: [],
  };
  const rel = await saveStoryChatLogSummary(root, safe, summary);
  assert.equal(rel, ".leanquill/chats/sess-a.md");
  const disk = await fs.readFile(path.join(root, ".leanquill", "chats", "sess-a.md"), "utf8");
  assert.match(disk, /story-chat/);
});

test("serializeStoryChatLogSummary writes chapter-review audit fields", () => {
  const s: StoryChatLogSummary = {
    sessionId: "2026-04-25-120000-chapter-review",
    startedAt: "2026-04-25T10:00:00.000Z",
    endedAt: "2026-04-25T10:30:00.000Z",
    launchedFrom: "chapter-review",
    chapterRef: "manuscript/ch01.md",
    chaptersInContext: ["manuscript/ch01.md"],
    summary: "R",
    memoryEntryIds: [],
    metadataActionIds: [],
    sessionType: "chapter-review",
    personaIds: ["a", "b"],
    issuesGenerated: 1,
    issuesResolved: 0,
    sessionIssueFile: ".leanquill/issues/sessions/x.md",
    storyUpdatesMade: false,
    storyUpdateNotes: "",
  };
  const yaml = serializeStoryChatLogSummary(s);
  assert.match(yaml, /session_type: chapter-review/);
  assert.match(yaml, /persona_ids:/);
  assert.match(yaml, /issues_generated: 1/);
  assert.match(yaml, /session_issue_file:/);
});

test("readStoryChatLogSummaryFromDisk parses legacy story-chat logs", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "lq-chat-legacy-"));
  const safe = new SafeFileSystem(root);
  const legacy = `---
session_id: legacy-1
session_type: story-chat
launched_from: general
started_at: "2026-01-01T00:00:00.000Z"
ended_at: "2026-01-01T01:00:00.000Z"
chapter_ref: ""
chapters_in_context: "[]"
agent_mode: story-chat
summary: "old"
memory_entry_ids: "[]"
metadata_action_ids: "[]"
story_updates_made: false
story_update_notes: ""
---
`;
  await safe.writeFile(path.join(root, ".leanquill", "chats", "legacy-1.md"), legacy);
  const read = await readStoryChatLogSummaryFromDisk(root, ".leanquill/chats/legacy-1.md");
  assert.equal(read?.sessionType, "story-chat");
  assert.deepEqual(read?.memoryEntryIds, []);
});

test("saveStoryChatSessionSummary writes chat log and memory", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "lq-sess-"));
  const safe = new SafeFileSystem(root);
  const chatLog: StoryChatLogSummary = {
    sessionId: "2026-04-25-120000-story-chat",
    startedAt: "2026-01-01T00:00:00.000Z",
    endedAt: "2026-01-01T01:00:00.000Z",
    launchedFrom: "general",
    chapterRef: "",
    chaptersInContext: [],
    summary: "Session summary text",
    memoryEntryIds: [],
    metadataActionIds: [],
  };
  const { chatLogPath, memoryRecord } = await saveStoryChatSessionSummary(root, safe, {
    chatLog,
    memoryTopic: "Plot beat",
    memoryBody: "Remember the twist.",
    memoryAssociation: { kind: "book" },
  });
  assert.match(chatLogPath, /\.leanquill\/chats\//);
  assert.match(memoryRecord.id, /^mem-/);
  const memPath = path.join(root, ".leanquill", "memory", memoryRecord.fileName);
  await fs.access(memPath);
  const finalLog = await fs.readFile(path.join(root, ".leanquill", "chats", `${chatLog.sessionId}.md`), "utf8");
  assert.match(finalLog, new RegExp(memoryRecord.id));
});
