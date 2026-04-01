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
  findNodeById,
  removeNodeById,
  isAncestorOf,
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
    assert.equal(index.schemaVersion, 2);
    assert.deepEqual(index.nodes, []);
  });
});

test("readOutlineIndex parses valid v2 JSON and returns normalized index", async () => {
  await withTempDir(async (dir) => {
    const lqDir = path.join(dir, ".leanquill");
    await fs.mkdir(lqDir, { recursive: true });
    const data = {
      schemaVersion: 2,
      nodes: [
        {
          id: "n1",
          title: "Act One",
          fileName: "",
          active: true,
          status: "not-started",
          description: "",
          customFields: {},
          traits: ["part"],
          children: [
            {
              id: "n2",
              title: "Chapter 1",
              fileName: "manuscript/ch1.md",
              active: true,
              status: "drafting",
              description: "",
              customFields: {},
              traits: [],
              children: [],
            },
          ],
        },
      ],
    };
    await fs.writeFile(path.join(lqDir, "outline-index.json"), JSON.stringify(data), "utf8");

    const index = await readOutlineIndex(dir);
    assert.equal(index.schemaVersion, 2);
    assert.equal(index.nodes.length, 1);
    assert.equal(index.nodes[0].title, "Act One");
    assert.deepEqual(index.nodes[0].traits, ["part"]);
    assert.equal(index.nodes[0].children.length, 1);
    assert.equal(index.nodes[0].children[0].title, "Chapter 1");
  });
});

test("readOutlineIndex auto-migrates v1 schema to v2", async () => {
  await withTempDir(async (dir) => {
    const lqDir = path.join(dir, ".leanquill");
    await fs.mkdir(lqDir, { recursive: true });
    const v1Data = {
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
              status: "drafting",
              beats: [
                {
                  id: "b1",
                  title: "Opening",
                  fileName: "beats/opening.md",
                  active: true,
                  description: "The beginning",
                  customFields: {},
                },
              ],
            },
          ],
        },
      ],
    };
    await fs.writeFile(path.join(lqDir, "outline-index.json"), JSON.stringify(v1Data), "utf8");

    const index = await readOutlineIndex(dir);
    assert.equal(index.schemaVersion, 2);
    assert.equal(index.nodes.length, 1);

    const part = index.nodes[0];
    assert.equal(part.title, "Act One");
    assert.ok(part.traits.includes("part"));

    assert.equal(part.children.length, 1);
    const chapter = part.children[0];
    assert.equal(chapter.title, "Chapter 1");
    assert.equal(chapter.fileName, "manuscript/ch1.md");
    assert.equal(chapter.status, "drafting");

    assert.equal(chapter.children.length, 1);
    const beat = chapter.children[0];
    assert.equal(beat.title, "Opening");
    assert.equal(beat.fileName, "beats/opening.md");
    assert.equal(beat.description, "The beginning");
  });
});

test("readOutlineIndex handles malformed JSON gracefully", async () => {
  await withTempDir(async (dir) => {
    const lqDir = path.join(dir, ".leanquill");
    await fs.mkdir(lqDir, { recursive: true });
    await fs.writeFile(path.join(lqDir, "outline-index.json"), "{broken json", "utf8");

    const index = await readOutlineIndex(dir);
    assert.equal(index.schemaVersion, 2);
    assert.deepEqual(index.nodes, []);
  });
});

test("writeOutlineIndex serializes index to JSON with schemaVersion 2", async () => {
  await withTempDir(async (dir) => {
    const safeFs = new SafeFileSystem(dir);
    const lqDir = path.join(dir, ".leanquill");
    await fs.mkdir(lqDir, { recursive: true });

    const index = {
      schemaVersion: 2,
      nodes: [
        {
          id: "n1",
          title: "Book",
          fileName: "",
          active: true,
          status: "not-started" as const,
          description: "",
          customFields: {},
          traits: ["part"],
          children: [],
        },
      ],
    };

    await writeOutlineIndex(dir, index, safeFs);

    const raw = await fs.readFile(path.join(lqDir, "outline-index.json"), "utf8");
    const parsed = JSON.parse(raw);
    assert.equal(parsed.schemaVersion, 2);
    assert.equal(parsed.nodes.length, 1);
    assert.equal(parsed.nodes[0].title, "Book");
  });
});

test("bootstrapOutline creates one part node with child nodes per path", () => {
  const index = bootstrapOutline(["manuscript/ch1.md", "manuscript/ch2.md"]);
  assert.equal(index.schemaVersion, 2);
  assert.equal(index.nodes.length, 1);
  assert.equal(index.nodes[0].title, "Book");
  assert.ok(index.nodes[0].traits.includes("part"));
  assert.equal(index.nodes[0].children.length, 2);
  assert.equal(index.nodes[0].children[0].fileName, "manuscript/ch1.md");
  assert.equal(index.nodes[0].children[1].fileName, "manuscript/ch2.md");
  assert.deepEqual(index.nodes[0].children[0].children, []);
});

test("bootstrapOutline with empty paths creates empty outline", () => {
  const index = bootstrapOutline([]);
  assert.equal(index.schemaVersion, 2);
  assert.deepEqual(index.nodes, []);
});

test("normalizeOutlineIndex coerces missing fields to defaults", () => {
  const raw = {
    nodes: [
      {
        id: "n1",
        children: [
          {
            id: "n2",
            children: [
              { id: "n3" },
            ],
          },
        ],
      },
    ],
  };

  const index = normalizeOutlineIndex(raw);
  assert.equal(index.schemaVersion, 2);
  assert.equal(index.nodes[0].title, "");
  assert.equal(index.nodes[0].active, true);
  assert.deepEqual(index.nodes[0].traits, []);
  assert.equal(index.nodes[0].children[0].title, "");
  assert.equal(index.nodes[0].children[0].fileName, "");
  assert.equal(index.nodes[0].children[0].active, true);
  assert.equal(index.nodes[0].children[0].children[0].title, "");
  assert.equal(index.nodes[0].children[0].children[0].active, true);
  assert.equal(index.nodes[0].children[0].children[0].description, "");
  assert.deepEqual(index.nodes[0].children[0].children[0].customFields, {});
});

test("normalizeOutlineIndex returns empty index for null input", () => {
  const index = normalizeOutlineIndex(null);
  assert.equal(index.schemaVersion, 2);
  assert.deepEqual(index.nodes, []);
});

test("normalizeOutlineIndex defaults status to not-started", () => {
  const raw = {
    nodes: [{ id: "n1", title: "Node", children: [] }],
  };
  const index = normalizeOutlineIndex(raw);
  assert.equal(index.nodes[0].status, "not-started");
});

test("normalizeOutlineIndex preserves valid status", () => {
  const raw = {
    nodes: [{ id: "n1", title: "Node", status: "drafting", children: [] }],
  };
  const index = normalizeOutlineIndex(raw);
  assert.equal(index.nodes[0].status, "drafting");
});

test("normalizeOutlineIndex coerces invalid status to not-started", () => {
  const raw = {
    nodes: [{ id: "n1", title: "Node", status: "banana", children: [] }],
  };
  const index = normalizeOutlineIndex(raw);
  assert.equal(index.nodes[0].status, "not-started");
});

test("normalizeOutlineIndex accepts legacy name field as title", () => {
  const raw = {
    nodes: [{ id: "n1", name: "Legacy Name", children: [] }],
  };
  const index = normalizeOutlineIndex(raw);
  assert.equal(index.nodes[0].title, "Legacy Name");
});

test("findNodeById finds top-level node", () => {
  const nodes = [
    { id: "a", title: "A", fileName: "", active: true, status: "not-started" as const, description: "", customFields: {}, traits: [] as string[], children: [] },
    { id: "b", title: "B", fileName: "", active: true, status: "not-started" as const, description: "", customFields: {}, traits: [] as string[], children: [] },
  ];
  const result = findNodeById(nodes, "b");
  assert.ok(result);
  assert.equal(result.node.id, "b");
  assert.equal(result.parent, null);
  assert.equal(result.index, 1);
});

test("findNodeById finds nested node", () => {
  const parent = {
    id: "a", title: "A", fileName: "", active: true, status: "not-started" as const, description: "", customFields: {}, traits: [] as string[],
    children: [
      { id: "a1", title: "A1", fileName: "", active: true, status: "not-started" as const, description: "", customFields: {}, traits: [] as string[], children: [] },
    ],
  };
  const result = findNodeById([parent], "a1");
  assert.ok(result);
  assert.equal(result.node.id, "a1");
  assert.equal(result.parent?.id, "a");
  assert.equal(result.index, 0);
});

test("findNodeById returns undefined for missing id", () => {
  const nodes = [
    { id: "a", title: "A", fileName: "", active: true, status: "not-started" as const, description: "", customFields: {}, traits: [] as string[], children: [] },
  ];
  assert.equal(findNodeById(nodes, "missing"), undefined);
});

test("removeNodeById removes and returns node", () => {
  const nodes = [
    { id: "a", title: "A", fileName: "", active: true, status: "not-started" as const, description: "", customFields: {}, traits: [] as string[], children: [] },
    { id: "b", title: "B", fileName: "", active: true, status: "not-started" as const, description: "", customFields: {}, traits: [] as string[], children: [] },
  ];
  const [remaining, removed] = removeNodeById(nodes, "a");
  assert.equal(remaining.length, 1);
  assert.equal(remaining[0].id, "b");
  assert.ok(removed);
  assert.equal(removed.id, "a");
});

test("removeNodeById removes nested node", () => {
  const nodes = [
    {
      id: "a", title: "A", fileName: "", active: true, status: "not-started" as const, description: "", customFields: {}, traits: [] as string[],
      children: [
        { id: "a1", title: "A1", fileName: "", active: true, status: "not-started" as const, description: "", customFields: {}, traits: [] as string[], children: [] },
        { id: "a2", title: "A2", fileName: "", active: true, status: "not-started" as const, description: "", customFields: {}, traits: [] as string[], children: [] },
      ],
    },
  ];
  const [, removed] = removeNodeById(nodes, "a1");
  assert.ok(removed);
  assert.equal(removed.id, "a1");
  assert.equal(nodes[0].children.length, 1);
  assert.equal(nodes[0].children[0].id, "a2");
});

test("isAncestorOf detects parent-child relationship", () => {
  const nodes = [
    {
      id: "a", title: "A", fileName: "", active: true, status: "not-started" as const, description: "", customFields: {}, traits: [] as string[],
      children: [
        { id: "a1", title: "A1", fileName: "", active: true, status: "not-started" as const, description: "", customFields: {}, traits: [] as string[], children: [] },
      ],
    },
  ];
  assert.equal(isAncestorOf(nodes, "a", "a1"), true);
  assert.equal(isAncestorOf(nodes, "a1", "a"), false);
});
