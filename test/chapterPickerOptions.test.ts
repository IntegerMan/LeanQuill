import test from "node:test";
import assert from "node:assert/strict";
import { buildChapterPickerOptions } from "../src/chapterPickerOptions";
import type { OutlineIndex } from "../src/types";

test("buildChapterPickerOptions empty outline returns empty", () => {
  const index: OutlineIndex = { schemaVersion: 2, nodes: [] };
  const order = { chapterPaths: [] as string[], warnings: [] as string[], source: "alpha" as const };
  assert.deepEqual(buildChapterPickerOptions(index, order), []);
});

test("buildChapterPickerOptions skips non-manuscript fileName", () => {
  const index: OutlineIndex = {
    schemaVersion: 2,
    nodes: [
      {
        id: "a",
        title: "Doc",
        fileName: "notes/x.md",
        active: true,
        status: "drafting",
        description: "",
        customFields: {},
        traits: [],
        children: [],
      },
    ],
  };
  const order = { chapterPaths: ["manuscript/x.md"], warnings: [], source: "book-txt" as const };
  assert.deepEqual(buildChapterPickerOptions(index, order), []);
});

test("buildChapterPickerOptions orders by chapterOrder then remaining by title", () => {
  const index: OutlineIndex = {
    schemaVersion: 2,
    nodes: [
      {
        id: "p",
        title: "Part",
        fileName: "",
        active: true,
        status: "planning",
        description: "",
        customFields: {},
        traits: ["part"],
        children: [
          {
            id: "c2",
            title: "Zebra",
            fileName: "manuscript/b.md",
            active: true,
            status: "drafting",
            description: "",
            customFields: {},
            traits: [],
            children: [],
          },
          {
            id: "c1",
            title: "Alpha",
            fileName: "manuscript/a.md",
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
  const order = {
    chapterPaths: ["manuscript/b.md", "manuscript/a.md"],
    warnings: [],
    source: "book-txt" as const,
  };
  const opts = buildChapterPickerOptions(index, order);
  assert.equal(opts.length, 2);
  assert.equal(opts[0]!.path, "manuscript/b.md");
  assert.equal(opts[1]!.path, "manuscript/a.md");
});
