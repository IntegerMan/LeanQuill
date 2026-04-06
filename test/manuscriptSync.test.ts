import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import {
  slugify,
  generateNodeFileName,
  collectExistingSlugs,
} from "../src/manuscriptSync";
import { OutlineNode } from "../src/types";

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

