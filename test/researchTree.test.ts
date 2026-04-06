import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import { parseFrontmatter, buildResearchItems } from "../src/researchTree";

async function withTempDir(run: (dir: string) => Promise<void>): Promise<void> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "leanquill-research-"));
  try {
    await run(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

// --- parseFrontmatter tests ---

test("parseFrontmatter extracts name and created from valid frontmatter", () => {
  const content = "---\nname: The Roman Empire\ncreated: 2026-04-05\n---\n\n# Body";
  const result = parseFrontmatter(content);
  assert.equal(result.name, "The Roman Empire");
  assert.equal(result.created, "2026-04-05");
});

test("parseFrontmatter returns empty object when no frontmatter", () => {
  const content = "# Just a heading\n\nSome body text.";
  const result = parseFrontmatter(content);
  assert.equal(result.name, undefined);
  assert.equal(result.created, undefined);
});

test("parseFrontmatter handles quoted values", () => {
  const content = "---\nname: \"Medieval Warfare\"\ncreated: '2026-03-01'\n---";
  const result = parseFrontmatter(content);
  assert.equal(result.name, "Medieval Warfare");
  assert.equal(result.created, "2026-03-01");
});

test("parseFrontmatter handles partial frontmatter (only name)", () => {
  const content = "---\nname: Silk Road Trade\ntags: [history]\n---";
  const result = parseFrontmatter(content);
  assert.equal(result.name, "Silk Road Trade");
  assert.equal(result.created, undefined);
});

test("parseFrontmatter handles partial frontmatter (only created)", () => {
  const content = "---\ncreated: 2026-01-15\nquery: something\n---";
  const result = parseFrontmatter(content);
  assert.equal(result.name, undefined);
  assert.equal(result.created, "2026-01-15");
});

// --- buildResearchItems tests ---

test("buildResearchItems returns empty array for empty directory", async () => {
  await withTempDir(async (dir) => {
    const items = await buildResearchItems(dir);
    assert.deepEqual(items, []);
  });
});

test("buildResearchItems returns empty array for non-existent directory", async () => {
  const items = await buildResearchItems("/nonexistent/research/dir");
  assert.deepEqual(items, []);
});

test("buildResearchItems skips non-.md files", async () => {
  await withTempDir(async (dir) => {
    await fs.writeFile(path.join(dir, "notes.txt"), "some text");
    await fs.writeFile(path.join(dir, "data.json"), "{}");
    const items = await buildResearchItems(dir);
    assert.equal(items.length, 0);
  });
});

test("buildResearchItems reads frontmatter name and created from .md files", async () => {
  await withTempDir(async (dir) => {
    await fs.writeFile(
      path.join(dir, "roman-empire-2026-04-01.md"),
      "---\nname: The Roman Empire\ncreated: 2026-04-01\n---\n\n# Content",
    );
    const items = await buildResearchItems(dir);
    assert.equal(items.length, 1);
    assert.equal(items[0].name, "The Roman Empire");
    assert.equal(items[0].created, "2026-04-01");
    assert.equal(items[0].kind, "research");
  });
});

test("buildResearchItems derives name from filename when frontmatter name is missing", async () => {
  await withTempDir(async (dir) => {
    await fs.writeFile(
      path.join(dir, "silk-road-trade-2026-03-15.md"),
      "---\ncreated: 2026-03-15\n---\n\n# Content",
    );
    const items = await buildResearchItems(dir);
    assert.equal(items.length, 1);
    assert.equal(items[0].name, "Silk Road Trade");
  });
});

test("buildResearchItems derives name from filename without date suffix", async () => {
  await withTempDir(async (dir) => {
    await fs.writeFile(path.join(dir, "medieval-warfare.md"), "# No frontmatter");
    const items = await buildResearchItems(dir);
    assert.equal(items.length, 1);
    assert.equal(items[0].name, "Medieval Warfare");
  });
});

test("buildResearchItems sorts by created date newest first", async () => {
  await withTempDir(async (dir) => {
    await fs.writeFile(
      path.join(dir, "old-topic-2026-01-01.md"),
      "---\nname: Old Topic\ncreated: 2026-01-01\n---",
    );
    await fs.writeFile(
      path.join(dir, "new-topic-2026-04-01.md"),
      "---\nname: New Topic\ncreated: 2026-04-01\n---",
    );
    await fs.writeFile(
      path.join(dir, "mid-topic-2026-02-15.md"),
      "---\nname: Mid Topic\ncreated: 2026-02-15\n---",
    );
    const items = await buildResearchItems(dir);
    assert.equal(items.length, 3);
    assert.equal(items[0].name, "New Topic");
    assert.equal(items[1].name, "Mid Topic");
    assert.equal(items[2].name, "Old Topic");
  });
});

test("buildResearchItems handles mixed md and non-md files", async () => {
  await withTempDir(async (dir) => {
    await fs.writeFile(
      path.join(dir, "research.md"),
      "---\nname: My Research\ncreated: 2026-04-05\n---",
    );
    await fs.writeFile(path.join(dir, "ignore.txt"), "ignored");
    await fs.writeFile(path.join(dir, "data.json"), "{}");
    const items = await buildResearchItems(dir);
    assert.equal(items.length, 1);
    assert.equal(items[0].name, "My Research");
  });
});
