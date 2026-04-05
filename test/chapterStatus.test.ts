import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import { SafeFileSystem } from "../src/safeFileSystem";
import { getChapterStatusEntry, readChapterStatusIndex, writeChapterStatusEntry } from "../src/chapterStatus";

async function withTempDir(run: (dir: string) => Promise<void>): Promise<void> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "leanquill-status-"));
  try {
    await run(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

test("defaults to empty index and not-started status for missing entries", async () => {
  await withTempDir(async (dir) => {
    const index = await readChapterStatusIndex(dir);
    const entry = getChapterStatusEntry(index, "manuscript/ch1.md");

    assert.equal(index.schemaVersion, "1");
    assert.deepEqual(index.chapters, {});
    assert.equal(entry.status, "not-started");
    assert.equal(entry.openIssueCount, 0);
  });
});

test("coerces invalid stored status to not-started", async () => {
  await withTempDir(async (dir) => {
    const statusPath = path.join(dir, ".leanquill", "chapter-status-index.json");
    await fs.mkdir(path.dirname(statusPath), { recursive: true });
    await fs.writeFile(statusPath, JSON.stringify({
      schemaVersion: "1",
      chapters: {
        "manuscript/ch1.md": {
          chapterId: "ch1",
          title: "Ch1",
          status: "stalled",
          openIssueCount: 3,
          updatedAt: "2026-03-29T00:00:00.000Z",
        },
      },
    }, null, 2));

    const warnings: string[] = [];
    const index = await readChapterStatusIndex(dir, (warning) => warnings.push(warning));

    assert.equal(index.chapters["manuscript/ch1.md"]?.status, "not-started");
    assert.equal(index.chapters["manuscript/ch1.md"]?.openIssueCount, 3);
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /Unknown chapter status/);
  });
});

test("writes and reloads chapter status through SafeFileSystem", async () => {
  await withTempDir(async (dir) => {
    const safeFs = new SafeFileSystem(dir);

    await writeChapterStatusEntry(safeFs, dir, "manuscript/ch2.md", "drafting", "Chapter Two");
    const index = await readChapterStatusIndex(dir);
    const entry = index.chapters["manuscript/ch2.md"];

    assert.ok(entry);
    assert.equal(entry.status, "drafting");
    assert.equal(entry.title, "Chapter Two");
    assert.equal(entry.openIssueCount, 0);
    assert.match(entry.updatedAt, /^\d{4}-\d{2}-\d{2}T/);
  });
});
