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
import { OutlineIndex, OutlineNode } from "../src/types";

async function withTempDir(run: (dir: string) => Promise<void>): Promise<void> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "leanquill-booktxt-"));
  try {
    await run(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

function makeNode(overrides: Partial<OutlineNode> = {}): OutlineNode {
  return {
    id: overrides.id ?? "n1",
    title: overrides.title ?? "Node",
    fileName: overrides.fileName ?? "",
    active: overrides.active ?? true,
    status: overrides.status ?? "not-started",
    description: overrides.description ?? "",
    customFields: overrides.customFields ?? {},
    traits: overrides.traits ?? [],
    children: overrides.children ?? [],
  };
}

function makeIndex(nodes: OutlineNode[]): OutlineIndex {
  return { schemaVersion: 2, nodes };
}

test("generateBookTxt produces part: lines for multiple active part nodes", () => {
  const index = makeIndex([
    makeNode({
      id: "p1", title: "Act One", traits: ["part"],
      children: [makeNode({ id: "c1", fileName: "manuscript/ch1.md" })],
    }),
    makeNode({
      id: "p2", title: "Act Two", traits: ["part"],
      children: [makeNode({ id: "c2", fileName: "manuscript/ch2.md" })],
    }),
  ]);

  const result = generateBookTxt(index);
  assert.ok(result.includes("part: Act One"));
  assert.ok(result.includes("part: Act Two"));
  assert.ok(result.includes("ch1.md"));
  assert.ok(result.includes("ch2.md"));
});

test("generateBookTxt omits part: line for single part node", () => {
  const index = makeIndex([
    makeNode({
      id: "p1", title: "Book", traits: ["part"],
      children: [
        makeNode({ id: "c1", fileName: "manuscript/ch1.md" }),
        makeNode({ id: "c2", fileName: "manuscript/ch2.md" }),
      ],
    }),
  ]);

  const result = generateBookTxt(index);
  const lines = result.split("\n").filter((l) => l.trim().length > 0);
  assert.ok(!result.includes("part:"));
  assert.ok(lines.includes("ch1.md"));
  assert.ok(lines.includes("ch2.md"));
});

test("generateBookTxt excludes inactive nodes and their descendants", () => {
  const index = makeIndex([
    makeNode({
      id: "p1", title: "Active Part", traits: ["part"],
      children: [
        makeNode({ id: "c1", fileName: "manuscript/active.md" }),
        makeNode({ id: "c2", fileName: "manuscript/inactive.md", active: false }),
      ],
    }),
    makeNode({
      id: "p2", title: "Skipped Part", traits: ["part"], active: false,
      children: [
        makeNode({ id: "c3", fileName: "manuscript/skipped.md" }),
      ],
    }),
  ]);

  const result = generateBookTxt(index);
  assert.ok(result.includes("active.md"));
  assert.ok(!result.includes("inactive.md"));
  assert.ok(!result.includes("skipped.md"));
  assert.ok(!result.includes("Skipped Part"));
});

test("generateBookTxt with empty outline produces empty string", () => {
  const index = makeIndex([]);
  const result = generateBookTxt(index);
  assert.equal(result, "");
});

test("generateBookTxt handles deeply nested nodes via depth-first traversal", () => {
  const index = makeIndex([
    makeNode({
      id: "p1", title: "Book", traits: ["part"],
      children: [
        makeNode({
          id: "c1", title: "Chapter", fileName: "manuscript/chapter.md",
          children: [
            makeNode({ id: "s1", fileName: "manuscript/scene-a.md" }),
            makeNode({ id: "s2", fileName: "manuscript/scene-b.md" }),
          ],
        }),
        makeNode({ id: "c2", fileName: "manuscript/epilogue.md" }),
      ],
    }),
  ]);

  const result = generateBookTxt(index);
  const lines = result.split("\n").filter((l) => l.trim().length > 0);
  assert.deepEqual(lines, [
    "chapter.md",
    "scene-a.md",
    "scene-b.md",
    "epilogue.md",
  ]);
});

test("generateBookTxt excludes inactive children but keeps siblings", () => {
  const index = makeIndex([
    makeNode({
      id: "p1", title: "Book", traits: ["part"],
      children: [
        makeNode({
          id: "c1", title: "Ch1", fileName: "manuscript/ch1.md",
          children: [
            makeNode({ id: "b1", fileName: "manuscript/active-beat.md" }),
            makeNode({ id: "b2", fileName: "manuscript/inactive-beat.md", active: false }),
          ],
        }),
      ],
    }),
  ]);

  const result = generateBookTxt(index);
  assert.ok(result.includes("active-beat.md"));
  assert.ok(!result.includes("inactive-beat.md"));
});

test("generateBookTxt skips nodes without fileName", () => {
  const index = makeIndex([
    makeNode({
      id: "p1", title: "Book", traits: ["part"],
      children: [
        makeNode({ id: "c1", title: "No File" }),
        makeNode({ id: "c2", fileName: "manuscript/has-file.md" }),
      ],
    }),
  ]);

  const result = generateBookTxt(index);
  const lines = result.split("\n").filter((l) => l.trim().length > 0);
  assert.deepEqual(lines, ["has-file.md"]);
});

test("detectExternalBookTxtEdit returns false when content matches", async () => {
  await withTempDir(async (dir) => {
    const content = "ch1.md\nch2.md\n";
    await fs.mkdir(path.join(dir, "manuscript"), { recursive: true });
    await fs.writeFile(path.join(dir, "manuscript", "Book.txt"), content, "utf8");

    const edited = await detectExternalBookTxtEdit(dir, content);
    assert.equal(edited, false);
  });
});

test("detectExternalBookTxtEdit returns true when content differs", async () => {
  await withTempDir(async (dir) => {
    await fs.mkdir(path.join(dir, "manuscript"), { recursive: true });
    await fs.writeFile(path.join(dir, "manuscript", "Book.txt"), "ch1.md\n", "utf8");

    const edited = await detectExternalBookTxtEdit(dir, "other.md\n");
    assert.equal(edited, true);
  });
});

test("detectExternalBookTxtEdit returns false when Book.txt does not exist", async () => {
  await withTempDir(async (dir) => {
    const edited = await detectExternalBookTxtEdit(dir, "ch1.md\n");
    assert.equal(edited, false);
  });
});

test("readBookTxt returns file content when exists", async () => {
  await withTempDir(async (dir) => {
    const content = "ch1.md\nch2.md\n";
    await fs.mkdir(path.join(dir, "manuscript"), { recursive: true });
    await fs.writeFile(path.join(dir, "manuscript", "Book.txt"), content, "utf8");

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
