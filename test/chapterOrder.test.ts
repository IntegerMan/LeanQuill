import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import { resolveChapterOrder } from "../src/chapterOrder";

async function withTempDir(run: (dir: string) => Promise<void>): Promise<void> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "leanquill-order-"));
  try {
    await run(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

test("uses Book.txt strictly and warns for missing/duplicates", async () => {
  await withTempDir(async (dir) => {
    await fs.mkdir(path.join(dir, "manuscript"), { recursive: true });
    await fs.writeFile(path.join(dir, "manuscript", "ch1.md"), "one");
    await fs.writeFile(path.join(dir, "manuscript", "ch2.md"), "two");
    // Book.txt now lives inside manuscript/ with paths relative to manuscript/
    await fs.writeFile(
      path.join(dir, "manuscript", "Book.txt"),
      [
        "ch2.md",
        "ch2.md",
        "ch1.md",
        "missing.md",
      ].join("\n"),
    );

    const result = await resolveChapterOrder(dir);

    assert.equal(result.source, "book-txt");
    // Internal paths still have manuscript/ prefix
    assert.deepEqual(result.chapterPaths, ["manuscript/ch2.md", "manuscript/ch1.md"]);
    assert.equal(result.warnings.length, 2);
  });
});

test("falls back to natural filename order without Book.txt", async () => {
  await withTempDir(async (dir) => {
    await fs.mkdir(path.join(dir, "manuscript"), { recursive: true });
    await fs.writeFile(path.join(dir, "manuscript", "ch10.md"), "ten");
    await fs.writeFile(path.join(dir, "manuscript", "ch2.md"), "two");
    await fs.writeFile(path.join(dir, "manuscript", "ch1.md"), "one");

    const result = await resolveChapterOrder(dir);

    assert.equal(result.source, "alpha");
    assert.deepEqual(result.chapterPaths, [
      "manuscript/ch1.md",
      "manuscript/ch2.md",
      "manuscript/ch10.md",
    ]);
  });
});
