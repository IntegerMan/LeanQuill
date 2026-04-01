import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import {
  readOutlineIndex,
  writeOutlineIndex,
  bootstrapOutline,
  normalizeOutlineIndex,
} from "../src/outlineStore";
import { SafeFileSystem } from "../src/safeFileSystem";

async function withTempDir(run: (dir: string) => Promise<void>): Promise<void> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "leanquill-outline-"));
  try {
    await run(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

test("readOutlineIndex returns empty index when file does not exist", async () => {
  await withTempDir(async (dir) => {
    const index = await readOutlineIndex(dir);
    assert.equal(index.schemaVersion, 1);
    assert.deepEqual(index.parts, []);
  });
});

test("readOutlineIndex parses valid JSON and returns normalized index", async () => {
  await withTempDir(async (dir) => {
    const lqDir = path.join(dir, ".leanquill");
    await fs.mkdir(lqDir, { recursive: true });
    const data = {
      schemaVersion: 1,
      parts: [
        {
          id: "p1",
          name: "Act One",
          active: true,
          chapters: [
            {
              id: "c1",
              name: "Chapter 1",
              fileName: "manuscript/ch1.md",
              active: true,
              beats: [],
            },
          ],
        },
      ],
    };
    await fs.writeFile(path.join(lqDir, "outline-index.json"), JSON.stringify(data), "utf8");

    const index = await readOutlineIndex(dir);
    assert.equal(index.schemaVersion, 1);
    assert.equal(index.parts.length, 1);
    assert.equal(index.parts[0].name, "Act One");
    assert.equal(index.parts[0].chapters.length, 1);
    assert.equal(index.parts[0].chapters[0].name, "Chapter 1");
  });
});

test("readOutlineIndex handles malformed JSON gracefully", async () => {
  await withTempDir(async (dir) => {
    const lqDir = path.join(dir, ".leanquill");
    await fs.mkdir(lqDir, { recursive: true });
    await fs.writeFile(path.join(lqDir, "outline-index.json"), "{broken json", "utf8");

    const index = await readOutlineIndex(dir);
    assert.equal(index.schemaVersion, 1);
    assert.deepEqual(index.parts, []);
  });
});

test("writeOutlineIndex serializes index to JSON with schemaVersion", async () => {
  await withTempDir(async (dir) => {
    const safeFs = new SafeFileSystem(dir);
    const lqDir = path.join(dir, ".leanquill");
    await fs.mkdir(lqDir, { recursive: true });

    const index = {
      schemaVersion: 1,
      parts: [
        {
          id: "p1",
          name: "Book",
          active: true,
          chapters: [],
        },
      ],
    };

    await writeOutlineIndex(dir, index, safeFs);

    const raw = await fs.readFile(path.join(lqDir, "outline-index.json"), "utf8");
    const parsed = JSON.parse(raw);
    assert.equal(parsed.schemaVersion, 1);
    assert.equal(parsed.parts.length, 1);
    assert.equal(parsed.parts[0].name, "Book");
  });
});

test("bootstrapOutline creates one Part with one Chapter per path, no beats", () => {
  const index = bootstrapOutline(["manuscript/ch1.md", "manuscript/ch2.md"]);
  assert.equal(index.schemaVersion, 1);
  assert.equal(index.parts.length, 1);
  assert.equal(index.parts[0].name, "Book");
  assert.equal(index.parts[0].active, true);
  assert.equal(index.parts[0].chapters.length, 2);
  assert.equal(index.parts[0].chapters[0].fileName, "manuscript/ch1.md");
  assert.equal(index.parts[0].chapters[1].fileName, "manuscript/ch2.md");
  assert.deepEqual(index.parts[0].chapters[0].beats, []);
  assert.deepEqual(index.parts[0].chapters[1].beats, []);
});

test("bootstrapOutline with empty chapters creates empty outline", () => {
  const index = bootstrapOutline([]);
  assert.equal(index.schemaVersion, 1);
  assert.deepEqual(index.parts, []);
});

test("normalizeOutlineIndex coerces missing fields to defaults", () => {
  // Pass a partial object with missing fields
  const raw = {
    parts: [
      {
        id: "p1",
        chapters: [
          {
            id: "c1",
            beats: [
              {
                id: "b1",
              },
            ],
          },
        ],
      },
    ],
  };

  const index = normalizeOutlineIndex(raw);
  assert.equal(index.schemaVersion, 1);
  assert.equal(index.parts[0].name, "");
  assert.equal(index.parts[0].active, true);
  assert.equal(index.parts[0].chapters[0].name, "");
  assert.equal(index.parts[0].chapters[0].fileName, "");
  assert.equal(index.parts[0].chapters[0].active, true);
  assert.equal(index.parts[0].chapters[0].beats[0].title, "");
  assert.equal(index.parts[0].chapters[0].beats[0].active, true);
  assert.equal(index.parts[0].chapters[0].beats[0].description, "");
  assert.deepEqual(index.parts[0].chapters[0].beats[0].customFields, {});
});

test("normalizeOutlineIndex returns empty index for null input", () => {
  const index = normalizeOutlineIndex(null);
  assert.equal(index.schemaVersion, 1);
  assert.deepEqual(index.parts, []);
});

test("normalizeOutlineIndex defaults chapter status to not-started", () => {
  const raw = {
    parts: [
      {
        id: "p1",
        name: "Part",
        active: true,
        chapters: [
          { id: "c1", name: "Ch", fileName: "", active: true, beats: [] },
        ],
      },
    ],
  };
  const index = normalizeOutlineIndex(raw);
  assert.equal(index.parts[0].chapters[0].status, "not-started");
});

test("normalizeOutlineIndex preserves valid chapter status", () => {
  const raw = {
    parts: [
      {
        id: "p1",
        name: "Part",
        active: true,
        chapters: [
          { id: "c1", name: "Ch", fileName: "", active: true, status: "drafting", beats: [] },
        ],
      },
    ],
  };
  const index = normalizeOutlineIndex(raw);
  assert.equal(index.parts[0].chapters[0].status, "drafting");
});

test("normalizeOutlineIndex coerces invalid chapter status to not-started", () => {
  const raw = {
    parts: [
      {
        id: "p1",
        name: "Part",
        active: true,
        chapters: [
          { id: "c1", name: "Ch", fileName: "", active: true, status: "bogus", beats: [] },
        ],
      },
    ],
  };
  const index = normalizeOutlineIndex(raw);
  assert.equal(index.parts[0].chapters[0].status, "not-started");
});
