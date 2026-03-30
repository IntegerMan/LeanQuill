import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import {
  generateBookTxt,
  readBookTxt,
  detectExternalBookTxtEdit,
} from "../src/bookTxtSync";
import { OutlineIndex } from "../src/types";

async function withTempDir(run: (dir: string) => Promise<void>): Promise<void> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "leanquill-booktxt-"));
  try {
    await run(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

function makeIndex(parts: OutlineIndex["parts"]): OutlineIndex {
  return { schemaVersion: 1, parts };
}

test("generateBookTxt produces part: lines for active parts (LeanPub format)", () => {
  const index = makeIndex([
    {
      id: "p1",
      name: "Act One",
      active: true,
      chapters: [
        { id: "c1", name: "Ch1", fileName: "manuscript/ch1.md", active: true, beats: [] },
      ],
    },
    {
      id: "p2",
      name: "Act Two",
      active: true,
      chapters: [
        { id: "c2", name: "Ch2", fileName: "manuscript/ch2.md", active: true, beats: [] },
      ],
    },
  ]);

  const result = generateBookTxt(index);
  assert.ok(result.includes("part: Act One"));
  assert.ok(result.includes("part: Act Two"));
  assert.ok(result.includes("manuscript/ch1.md"));
  assert.ok(result.includes("manuscript/ch2.md"));
});

test("generateBookTxt lists active chapter filenames under their parts", () => {
  const index = makeIndex([
    {
      id: "p1",
      name: "Book",
      active: true,
      chapters: [
        { id: "c1", name: "Ch1", fileName: "manuscript/ch1.md", active: true, beats: [] },
        { id: "c2", name: "Ch2", fileName: "manuscript/ch2.md", active: true, beats: [] },
      ],
    },
  ]);

  const result = generateBookTxt(index);
  const lines = result.split("\n").filter((l) => l.trim().length > 0);
  // Single part — no part: line needed
  assert.ok(lines.includes("manuscript/ch1.md"));
  assert.ok(lines.includes("manuscript/ch2.md"));
});

test("generateBookTxt excludes deactivated parts and chapters", () => {
  const index = makeIndex([
    {
      id: "p1",
      name: "Active Part",
      active: true,
      chapters: [
        { id: "c1", name: "Active", fileName: "manuscript/active.md", active: true, beats: [] },
        { id: "c2", name: "Inactive", fileName: "manuscript/inactive.md", active: false, beats: [] },
      ],
    },
    {
      id: "p2",
      name: "Skipped Part",
      active: false,
      chapters: [
        { id: "c3", name: "Also Skipped", fileName: "manuscript/skipped.md", active: true, beats: [] },
      ],
    },
  ]);

  const result = generateBookTxt(index);
  assert.ok(result.includes("manuscript/active.md"));
  assert.ok(!result.includes("manuscript/inactive.md"));
  assert.ok(!result.includes("manuscript/skipped.md"));
  assert.ok(!result.includes("Skipped Part"));
});

test("generateBookTxt with empty outline produces empty string", () => {
  const index = makeIndex([]);
  const result = generateBookTxt(index);
  assert.equal(result, "");
});

test("detectExternalBookTxtEdit returns false when content matches", async () => {
  await withTempDir(async (dir) => {
    const content = "manuscript/ch1.md\nmanuscript/ch2.md\n";
    await fs.writeFile(path.join(dir, "Book.txt"), content, "utf8");

    const edited = await detectExternalBookTxtEdit(dir, content);
    assert.equal(edited, false);
  });
});

test("detectExternalBookTxtEdit returns true when content differs", async () => {
  await withTempDir(async (dir) => {
    await fs.writeFile(path.join(dir, "Book.txt"), "manuscript/ch1.md\n", "utf8");

    const edited = await detectExternalBookTxtEdit(dir, "manuscript/other.md\n");
    assert.equal(edited, true);
  });
});

test("detectExternalBookTxtEdit returns false when Book.txt does not exist", async () => {
  await withTempDir(async (dir) => {
    const edited = await detectExternalBookTxtEdit(dir, "manuscript/ch1.md\n");
    assert.equal(edited, false);
  });
});

test("readBookTxt returns file content when exists", async () => {
  await withTempDir(async (dir) => {
    const content = "manuscript/ch1.md\nmanuscript/ch2.md\n";
    await fs.writeFile(path.join(dir, "Book.txt"), content, "utf8");

    const result = await readBookTxt(dir);
    assert.equal(result, content);
  });
});

test("readBookTxt returns null when file does not exist", async () => {
  await withTempDir(async (dir) => {
    const result = await readBookTxt(dir);
    assert.equal(result, null);
  });
});
