import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import { slugify, generateBeatFileName, collectExistingBeatSlugs, writeBeatFile, readBeatFile, deleteBeatFile, renameBeatFile } from "../src/beatManuscriptSync";
import { OutlinePart } from "../src/types";

async function withTempDir(fn: (dir: string) => Promise<void>): Promise<void> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "beat-sync-"));
  try {
    await fn(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
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

describe("generateBeatFileName", () => {
  it("generates beats/{slug}.md", () => {
    assert.equal(generateBeatFileName("Opening Scene", new Set()), "beats/opening-scene.md");
  });

  it("appends -2 for duplicate slug", () => {
    const existing = new Set(["beats/opening-scene.md"]);
    assert.equal(generateBeatFileName("Opening Scene", existing), "beats/opening-scene-2.md");
  });

  it("increments suffix for multiple duplicates", () => {
    const existing = new Set(["beats/opening-scene.md", "beats/opening-scene-2.md"]);
    assert.equal(generateBeatFileName("Opening Scene", existing), "beats/opening-scene-3.md");
  });
});

describe("collectExistingBeatSlugs", () => {
  it("collects fileNames from all beats across parts", () => {
    const parts: OutlinePart[] = [
      {
        id: "p1", name: "Part 1", active: true,
        chapters: [
          {
            id: "c1", name: "Ch1", fileName: "ch1.md", active: true,
            beats: [
              { id: "b1", title: "B1", fileName: "beats/b1.md", active: true, description: "", what: "", who: "", where: "", why: "", customFields: {} },
            ],
          },
        ],
      },
      {
        id: "p2", name: "Part 2", active: true,
        chapters: [
          {
            id: "c2", name: "Ch2", fileName: "ch2.md", active: true,
            beats: [
              { id: "b2", title: "B2", fileName: "beats/b2.md", active: true, description: "", what: "", who: "", where: "", why: "", customFields: {} },
              { id: "b3", title: "B3", fileName: "", active: true, description: "", what: "", who: "", where: "", why: "", customFields: {} },
            ],
          },
        ],
      },
    ];
    const slugs = collectExistingBeatSlugs(parts);
    assert.equal(slugs.size, 2);
    assert.ok(slugs.has("beats/b1.md"));
    assert.ok(slugs.has("beats/b2.md"));
  });
});

describe("beat file operations", () => {
  it("writeBeatFile creates file and directories", async () => {
    await withTempDir(async (dir) => {
      await writeBeatFile(dir, "beats/test-beat.md", "Hello world");
      const content = await fs.readFile(path.join(dir, "manuscript", "beats", "test-beat.md"), "utf8");
      assert.equal(content, "Hello world");
    });
  });

  it("readBeatFile reads existing file", async () => {
    await withTempDir(async (dir) => {
      await writeBeatFile(dir, "beats/test.md", "Some content");
      const content = await readBeatFile(dir, "beats/test.md");
      assert.equal(content, "Some content");
    });
  });

  it("readBeatFile returns empty string for missing file", async () => {
    await withTempDir(async (dir) => {
      const content = await readBeatFile(dir, "beats/nope.md");
      assert.equal(content, "");
    });
  });

  it("deleteBeatFile removes file", async () => {
    await withTempDir(async (dir) => {
      await writeBeatFile(dir, "beats/del.md", "bye");
      await deleteBeatFile(dir, "beats/del.md");
      const exists = await fs.stat(path.join(dir, "manuscript", "beats", "del.md")).then(() => true).catch(() => false);
      assert.equal(exists, false);
    });
  });

  it("deleteBeatFile ignores missing file", async () => {
    await withTempDir(async (dir) => {
      await deleteBeatFile(dir, "beats/nope.md"); // should not throw
    });
  });

  it("renameBeatFile moves content to new file", async () => {
    await withTempDir(async (dir) => {
      await writeBeatFile(dir, "beats/old.md", "original");
      await renameBeatFile(dir, "beats/old.md", "beats/new.md", "original");
      const newContent = await readBeatFile(dir, "beats/new.md");
      assert.equal(newContent, "original");
      const oldExists = await fs.stat(path.join(dir, "manuscript", "beats", "old.md")).then(() => true).catch(() => false);
      assert.equal(oldExists, false);
    });
  });
});
