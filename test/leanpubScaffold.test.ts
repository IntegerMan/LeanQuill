import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import { applyLeanpubManuscriptScaffold } from "../src/leanpubScaffold";

async function withTempDir(run: (dir: string) => Promise<void>): Promise<void> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "leanquill-scaffold-"));
  try {
    await run(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

test("applyLeanpubManuscriptScaffold: empty dir creates ch1.md, Book.txt, chapter body", async () => {
  await withTempDir(async (dir) => {
    const result = await applyLeanpubManuscriptScaffold(dir, {});
    assert.equal(result.status, "success");
    assert.ok(result.created.includes("manuscript/Book.txt"));
    assert.ok(result.created.some((p) => /manuscript\/ch1\.md$/i.test(p)));
    const chapter = await fs.readFile(path.join(dir, "manuscript", "ch1.md"), "utf8");
    assert.match(chapter, /# Chapter 1/);
    const book = await fs.readFile(path.join(dir, "manuscript", "Book.txt"), "utf8");
    assert.equal(book.trim(), "ch1.md");
    for (const rel of result.created) {
      assert.ok(!path.isAbsolute(rel));
      assert.ok(!rel.includes(".."), `created path stays relative: ${rel}`);
      const abs = path.join(dir, ...rel.split("/"));
      assert.ok(abs.startsWith(path.join(dir, "manuscript")), `under manuscript: ${rel}`);
    }
  });
});

test("applyLeanpubManuscriptScaffold: existing Book.txt unchanged when layout already satisfied", async () => {
  await withTempDir(async (dir) => {
    await fs.mkdir(path.join(dir, "manuscript"), { recursive: true });
    await fs.writeFile(path.join(dir, "manuscript", "ch1.md"), "# Chapter 1\n", "utf8");
    const bookPath = path.join(dir, "manuscript", "Book.txt");
    const original = "ch1.md\n";
    await fs.writeFile(bookPath, original, "utf8");
    const before = await fs.readFile(bookPath, "utf8");
    const result = await applyLeanpubManuscriptScaffold(dir, {});
    const after = await fs.readFile(bookPath, "utf8");
    assert.equal(before, after);
    assert.equal(result.status, "noop");
  });
});

test("applyLeanpubManuscriptScaffold: existing Ch1.md (case) + no Book.txt creates Book.txt with Ch1.md line", async () => {
  await withTempDir(async (dir) => {
    await fs.mkdir(path.join(dir, "manuscript"), { recursive: true });
    await fs.writeFile(path.join(dir, "manuscript", "Ch1.md"), "# hi\n", "utf8");
    const result = await applyLeanpubManuscriptScaffold(dir, {});
    assert.equal(result.status, "success");
    const book = await fs.readFile(path.join(dir, "manuscript", "Book.txt"), "utf8");
    assert.equal(book.trim(), "Ch1.md");
    const entries = await fs.readdir(path.join(dir, "manuscript"));
    assert.equal(entries.filter((e) => e.toLowerCase() === "ch1.md").length, 1);
  });
});

test("applyLeanpubManuscriptScaffold: Book.txt lists other file only while ch1.md exists — blocked", async () => {
  await withTempDir(async (dir) => {
    await fs.mkdir(path.join(dir, "manuscript"), { recursive: true });
    await fs.writeFile(path.join(dir, "manuscript", "ch1.md"), "# x\n", "utf8");
    await fs.writeFile(path.join(dir, "manuscript", "Book.txt"), "other.md\n", "utf8");
    const before = await fs.readFile(path.join(dir, "manuscript", "Book.txt"), "utf8");
    const result = await applyLeanpubManuscriptScaffold(dir, {});
    assert.equal(result.status, "blocked");
    const after = await fs.readFile(path.join(dir, "manuscript", "Book.txt"), "utf8");
    assert.equal(before, after);
  });
});
