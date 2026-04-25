import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { SafeFileSystem } from "../src/safeFileSystem";
import {
  createStoryMemory,
  listStoryMemory,
  parseStoryMemoryFile,
  serializeStoryMemoryFile,
  storyMemoryToContext,
  supersedeStoryMemory,
  type StoryMemoryAssociation,
  type StoryMemoryRecord,
} from "../src/storyMemoryStore";

function sampleRecord(overrides: Partial<StoryMemoryRecord> & { fileName: string }): StoryMemoryRecord {
  const base: StoryMemoryRecord = {
    fileName: overrides.fileName,
    schemaVersion: "1",
    id: overrides.id ?? "mem-x-story-chat",
    topic: overrides.topic ?? "Topic",
    status: overrides.status ?? "active",
    createdAt: overrides.createdAt ?? "2026-01-01T00:00:00.000Z",
    updatedAt: overrides.updatedAt ?? "2026-01-01T00:00:00.000Z",
    recency: overrides.recency ?? "current",
    supersedes: overrides.supersedes ?? [],
    sourceChatId: overrides.sourceChatId ?? "sess-1",
    association: overrides.association ?? { kind: "book" },
    body: overrides.body ?? "Body text",
  };
  return { ...base, ...overrides, association: overrides.association ?? base.association };
}

test("parse/serialize round-trip book association", () => {
  const r = sampleRecord({ fileName: "a.md", association: { kind: "book" } });
  const back = parseStoryMemoryFile(r.fileName, serializeStoryMemoryFile(r));
  assert.equal(back.association.kind, "book");
  assert.equal(back.topic, "Topic");
});

test("parse/serialize chapter selection issue entity associations", () => {
  const cases: StoryMemoryAssociation[] = [
    { kind: "chapter", chapterRef: "manuscript/ch1.md" },
    { kind: "selection", chapterRef: "manuscript/ch1.md", spanHint: "L1-2" },
    { kind: "issue", issueId: "q-1" },
    { kind: "character", fileName: "hero.md" },
    { kind: "place", fileName: "mill.md" },
    { kind: "thread", fileName: "arc.md" },
    { kind: "theme", id: "t-uuid" },
    { kind: "research", fileName: "notes.md" },
  ];
  let i = 0;
  for (const association of cases) {
    const r = sampleRecord({ fileName: `f${i++}.md`, association });
    const back = parseStoryMemoryFile(r.fileName, serializeStoryMemoryFile(r));
    assert.deepEqual(back.association, association);
  }
});

test("listStoryMemory excludes superseded by default", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "lq-mem-"));
  const safe = new SafeFileSystem(root);
  const old = sampleRecord({
    fileName: "mem-old-story-chat.md",
    id: "mem-old-story-chat",
    status: "superseded",
    recency: "stale",
  });
  const active = sampleRecord({
    fileName: "mem-new-story-chat.md",
    id: "mem-new-story-chat",
    status: "active",
  });
  await fs.mkdir(path.join(root, ".leanquill", "memory"), { recursive: true });
  await safe.writeFile(path.join(root, ".leanquill", "memory", old.fileName), serializeStoryMemoryFile(old));
  await safe.writeFile(path.join(root, ".leanquill", "memory", active.fileName), serializeStoryMemoryFile(active));
  const listed = await listStoryMemory(root);
  assert.equal(listed.length, 1);
  assert.equal(listed[0]!.id, "mem-new-story-chat");
});

test("supersedeStoryMemory keeps both files", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "lq-mem2-"));
  const safe = new SafeFileSystem(root);
  const created = await createStoryMemory(
    { topic: "Old", body: "b1", sourceChatId: "s1", association: { kind: "book" } },
    root,
    safe,
  );
  const { newRecord } = await supersedeStoryMemory(root, safe, created.id, {
    topic: "New",
    body: "b2",
    sourceChatId: "s1",
    association: { kind: "book" },
  });
  const all = await fs.readdir(path.join(root, ".leanquill", "memory"));
  assert.ok(all.includes(created.fileName));
  assert.ok(all.includes(newRecord.fileName));
  const listed = await listStoryMemory(root);
  assert.ok(listed.some((r) => r.id === newRecord.id));
  assert.ok(!listed.some((r) => r.id === created.id));
});

test("storyMemoryToContext path and label", () => {
  const r = sampleRecord({
    fileName: "mem-abc-story-chat.md",
    id: "mem-abc-story-chat",
    association: { kind: "chapter", chapterRef: "manuscript/x.md" },
  });
  const ctx = storyMemoryToContext(r);
  assert.equal(ctx.path, ".leanquill/memory/mem-abc-story-chat.md");
  assert.match(ctx.associationLabel, /Chapter/);
});
