import test from "node:test";
import assert from "node:assert/strict";
import {
  renderOutlineContextHtml,
  buildBookContext,
  buildNodeContext,
} from "../src/outlineContextPane";
import { OutlineIndex, OutlineNode } from "../src/types";

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

test("renders empty state when no model provided", () => {
  const html = renderOutlineContextHtml();
  assert.match(html, /No selection/);
  assert.match(html, /Content-Security-Policy/);
  assert.match(html, /default-src 'none'/);
});

test("renders book overview with status summary", () => {
  const index: OutlineIndex = {
    schemaVersion: 2,
    nodes: [
      makeNode({
        id: "p1", title: "Part", traits: ["part"],
        children: [
          makeNode({ id: "c1", status: "drafting" }),
          makeNode({
            id: "c2", status: "drafting",
            children: [makeNode({ id: "b1", status: "not-started" })],
          }),
          makeNode({ id: "c3", status: "final" }),
        ],
      }),
    ],
  };
  const model = buildBookContext(index);
  const html = renderOutlineContextHtml(model);

  assert.match(html, /Book Overview/);
  assert.match(html, /Total Nodes/);
  assert.equal(model.totalNodes, 5); // p1, c1, c2, b1, c3
  assert.equal(model.statusSummary.drafting, 2);
  assert.equal(model.statusSummary.final, 1);
  assert.equal(model.statusSummary["not-started"], 2); // p1 + b1
});

test("renders node context with status and update button", () => {
  const node = makeNode({
    title: "Chapter One",
    fileName: "manuscript/ch1.md",
    status: "editing",
  });
  const model = buildNodeContext(node, 1);
  const html = renderOutlineContextHtml(model);

  assert.match(html, /Chapter One/);
  assert.match(html, /editing/);
  assert.match(html, /Update Status/);
  assert.match(html, /command:leanquill.updateNodeStatus/);
  assert.match(html, /manuscript\/ch1\.md/);
});

test("renders node context with description and custom fields", () => {
  const node = makeNode({
    title: "Opening Scene",
    fileName: "manuscript/opening.md",
    description: "The hero enters the arena.",
    customFields: { mood: "tense", pov: "third" },
  });
  const model = buildNodeContext(node, 2);
  const html = renderOutlineContextHtml(model);

  assert.match(html, /Opening Scene/);
  assert.match(html, /The hero enters the arena/);
  assert.match(html, /mood/);
  assert.match(html, /tense/);
  assert.match(html, /pov/);
  assert.match(html, /third/);
  assert.match(html, /manuscript\/opening\.md/);
});

test("renders inactive node with badge", () => {
  const node = makeNode({
    title: "Cut Scene",
    active: false,
  });
  const model = buildNodeContext(node, 1);
  const html = renderOutlineContextHtml(model);

  assert.match(html, /Cut Scene/);
  assert.match(html, /Inactive/i);
});

test("renders node with traits badges", () => {
  const node = makeNode({
    title: "Front Matter",
    traits: ["front-matter"],
  });
  const model = buildNodeContext(node, 0);
  const html = renderOutlineContextHtml(model);

  assert.match(html, /front-matter/);
});

test("renders node with child count", () => {
  const node = makeNode({
    title: "Act One",
    children: [makeNode({ id: "c1" }), makeNode({ id: "c2" })],
  });
  const model = buildNodeContext(node, 0);
  assert.equal(model.childCount, 2);
  const html = renderOutlineContextHtml(model);
  assert.match(html, /Children/);
  assert.match(html, /2/);
});
