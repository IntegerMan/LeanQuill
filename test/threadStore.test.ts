import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import { SafeFileSystem } from "../src/safeFileSystem";
import { DEFAULT_PROJECT_CONFIG, type ProjectConfig } from "../src/projectConfig";
import {
  createThread,
  deleteThread,
  listThreads,
  parseThreadFile,
  saveThread,
  serializeThreadFile,
  slugifyThreadTitle,
} from "../src/threadStore";

test("slugifyThreadTitle matches character-style slug", () => {
  assert.equal(slugifyThreadTitle("Plot A"), "plot-a.md");
});

test("parseThreadFile touchesChapters default empty", () => {
  const p = parseThreadFile("t.md", "no frontmatter");
  assert.deepEqual(p.touchesChapters, []);
});

test("parseThreadFile reads touchesChapters list", () => {
  const raw = ["---", "title: Arc", "touchesChapters:", "  - manuscript/ch1.md", "  - manuscript/ch2.md", "---", "body"].join("\n");
  const p = parseThreadFile("t.md", raw);
  assert.equal(p.title, "Arc");
  assert.deepEqual(p.touchesChapters, ["manuscript/ch1.md", "manuscript/ch2.md"]);
  assert.equal(p.body, "body");
});

test("parseThreadFile touchesChapters empty array", () => {
  const raw = ["---", "title: X", "touchesChapters: []", "---", ""].join("\n");
  const p = parseThreadFile("t.md", raw);
  assert.deepEqual(p.touchesChapters, []);
});

test("serializeThreadFile emits forward slashes for touchesChapters", () => {
  const p = {
    fileName: "t.md",
    title: "T",
    touchesChapters: ["manuscript\\ch1.md"],
    customFields: {},
    body: "",
  };
  const s = serializeThreadFile(p);
  assert.match(s, /manuscript\/ch1\.md/);
});

test("round-trip parse serialize", () => {
  const orig = {
    fileName: "x.md",
    title: "Hello",
    touchesChapters: ["manuscript/a.md"],
    customFields: { mood: "tense" },
    body: "notes here",
  };
  const back = parseThreadFile("x.md", serializeThreadFile(orig));
  assert.deepEqual(back, orig);
});

async function withTempProject(run: (dir: string, config: ProjectConfig, safeFs: SafeFileSystem) => Promise<void>): Promise<void> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "leanquill-thread-"));
  try {
    const leanquill = path.join(dir, ".leanquill");
    await fs.mkdir(leanquill, { recursive: true });
    const config: ProjectConfig = {
      ...DEFAULT_PROJECT_CONFIG,
      folders: { ...DEFAULT_PROJECT_CONFIG.folders, threads: "notes/threads/" },
    };
    const safeFs = new SafeFileSystem(dir);
    safeFs.allowPath("notes/threads", ".md");
    await run(dir, config, safeFs);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

test("listThreads createThread saveThread deleteThread", async () => {
  await withTempProject(async (dir, config, safeFs) => {
    let list = await listThreads(dir, config);
    assert.equal(list.length, 0);

    const t = await createThread("My Thread", dir, config, safeFs);
    assert.ok(t.fileName.endsWith(".md"));

    list = await listThreads(dir, config);
    assert.equal(list.length, 1);
    assert.equal(list[0]!.title, "My Thread");

    t.customFields.region = "North";
    await saveThread(t, dir, config, safeFs);
    list = await listThreads(dir, config);
    assert.equal(list[0]!.customFields.region, "North");

    await deleteThread(t.fileName, dir, config, safeFs);
    list = await listThreads(dir, config);
    assert.equal(list.length, 0);
  });
});

test("createThread avoids filename collision", async () => {
  await withTempProject(async (dir, config, safeFs) => {
    await createThread("Same", dir, config, safeFs);
    const second = await createThread("Same", dir, config, safeFs);
    assert.notEqual(second.fileName, "same.md");
    const list = await listThreads(dir, config);
    assert.equal(list.length, 2);
  });
});
