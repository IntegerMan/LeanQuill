import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import {
  slugify,
  generateNodeFileName,
  collectExistingSlugs,
  writeNodeFile,
  readNodeFile,
  deleteNodeFile,
  renameNodeFile,
} from "../src/manuscriptSync";
import { OutlineNode } from "../src/types";

async function withTempDir(fn: (dir: string) => Promise<void>): Promise<void> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "manuscript-sync-"));
  try {
    await fn(dir);
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

describe("slugify", () => {
  it("converts title to kebab-case", () => {
    assert.equal(slugify("Opening Scene"), "opening-scene");
  });

  it("strips non-alphanumeric characters", () => {
    assert.equal(slugify("Hello, World! #1"), "hello-world-1");
  });

  it("collapses multiple hyphens", () => {
    assert.equal(slugify("a - - b"), "a-b");
  });

  it("trims leading/trailing hyphens", () => {
    assert.equal(slugify("---foo---"), "foo");
  });

  it("returns 'untitled' for empty input", () => {
    assert.equal(slugify(""), "untitled");
    assert.equal(slugify("   "), "untitled");
    assert.equal(slugify("!!!"), "untitled");
  });
});

describe("generateNodeFileName", () => {
  it("generates {slug}.md", () => {
    assert.equal(generateNodeFileName("Opening Scene", new Set()), "opening-scene.md");
  });

  it("appends -2 for duplicate slug", () => {
    const existing = new Set(["opening-scene.md"]);
    assert.equal(generateNodeFileName("Opening Scene", existing), "opening-scene-2.md");
  });

  it("increments suffix for multiple duplicates", () => {
    const existing = new Set(["opening-scene.md", "opening-scene-2.md"]);
    assert.equal(generateNodeFileName("Opening Scene", existing), "opening-scene-3.md");
  });
});

describe("collectExistingSlugs", () => {
  it("collects fileNames recursively from all nodes and strips manuscript/ prefix", () => {
    const nodes: OutlineNode[] = [
      makeNode({
        id: "p1", traits: ["part"],
        children: [
          makeNode({
            // fileName includes manuscript/ prefix as stored in outline
            id: "c1", fileName: "manuscript/ch1.md",
            children: [
              makeNode({ id: "b1", fileName: "manuscript/scene-a.md" }),
            ],
          }),
        ],
      }),
      makeNode({
        id: "p2", traits: ["part"],
        children: [
          makeNode({
            id: "c2", fileName: "manuscript/ch2.md",
            children: [
              makeNode({ id: "b2", fileName: "manuscript/scene-b.md" }),
              makeNode({ id: "b3", fileName: "" }),
            ],
          }),
        ],
      }),
    ];
    const slugs = collectExistingSlugs(nodes);
    // Returns slugs without the manuscript/ prefix for comparison with generateNodeFileName
    assert.equal(slugs.size, 4);
    assert.ok(slugs.has("ch1.md"));
    assert.ok(slugs.has("ch2.md"));
    assert.ok(slugs.has("scene-a.md"));
    assert.ok(slugs.has("scene-b.md"));
  });
});

describe("node file operations", () => {
  it("writeNodeFile creates file and directories", async () => {
    await withTempDir(async (dir) => {
      // fileName now includes the manuscript/ prefix
      await writeNodeFile(dir, "manuscript/test-file.md", "Hello world");
      const content = await fs.readFile(path.join(dir, "manuscript", "test-file.md"), "utf8");
      assert.equal(content, "Hello world");
    });
  });

  it("readNodeFile reads existing file", async () => {
    await withTempDir(async (dir) => {
      // fileName now includes the manuscript/ prefix
      await writeNodeFile(dir, "manuscript/test.md", "Some content");
      const content = await readNodeFile(dir, "manuscript/test.md");
      assert.equal(content, "Some content");
    });
  });

  it("readNodeFile returns empty string for missing file", async () => {
    await withTempDir(async (dir) => {
      const content = await readNodeFile(dir, "manuscript/nope.md");
      assert.equal(content, "");
    });
  });

  it("deleteNodeFile removes file", async () => {
    await withTempDir(async (dir) => {
      // fileName now includes the manuscript/ prefix
      await writeNodeFile(dir, "manuscript/del.md", "bye");
      await deleteNodeFile(dir, "manuscript/del.md");
      const exists = await fs.stat(path.join(dir, "manuscript", "del.md")).then(() => true).catch(() => false);
      assert.equal(exists, false);
    });
  });

  it("deleteNodeFile ignores missing file", async () => {
    await withTempDir(async (dir) => {
      await deleteNodeFile(dir, "manuscript/nope.md"); // should not throw
    });
  });

  it("renameNodeFile moves content to new file", async () => {
    await withTempDir(async (dir) => {
      // fileName now includes the manuscript/ prefix
      await writeNodeFile(dir, "manuscript/old.md", "original");
      await renameNodeFile(dir, "manuscript/old.md", "manuscript/new.md", "original");
      const newContent = await readNodeFile(dir, "manuscript/new.md");
      assert.equal(newContent, "original");
      const oldExists = await fs.stat(path.join(dir, "manuscript", "old.md")).then(() => true).catch(() => false);
      assert.equal(oldExists, false);
    });
  });
});
