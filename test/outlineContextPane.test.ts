import test from "node:test";
import assert from "node:assert/strict";
import {
  renderOutlineContextHtml,
  buildBookContext,
  buildPartContext,
  buildChapterContext,
  buildBeatContext,
} from "../src/outlineContextPane";
import { OutlineIndex } from "../src/types";

test("renders empty state when no model provided", () => {
  const html = renderOutlineContextHtml();
  assert.match(html, /No selection/);
  assert.match(html, /Content-Security-Policy/);
  assert.match(html, /default-src 'none'/);
});

test("renders book overview with status summary", () => {
  const index: OutlineIndex = {
    schemaVersion: 1,
    parts: [
      {
        id: "p1",
        name: "Part",
        active: true,
        chapters: [
          { id: "c1", name: "Ch1", fileName: "manuscript/ch1.md", active: true, status: "drafting", beats: [] },
          { id: "c2", name: "Ch2", fileName: "manuscript/ch2.md", active: true, status: "drafting", beats: [{ id: "b1", title: "B1", fileName: "", active: true, description: "", customFields: {} }] },
          { id: "c3", name: "Ch3", fileName: "manuscript/ch3.md", active: true, status: "final", beats: [] },
        ],
      },
    ],
  };
  const model = buildBookContext(index);
  const html = renderOutlineContextHtml(model);

  assert.match(html, /Book Overview/);
  assert.match(html, /Chapters.*3/s);
  assert.match(html, /Beats.*1/s);
  assert.equal(model.statusSummary.drafting, 2);
  assert.equal(model.statusSummary.final, 1);
});

test("renders part context with chapter and beat counts", () => {
  const model = buildPartContext({
    id: "p1",
    name: "Act Two",
    active: false,
    chapters: [
      { id: "c1", name: "Ch", fileName: "", active: true, status: "not-started", beats: [{ id: "b1", title: "B", fileName: "", active: true, description: "", customFields: {} }] },
    ],
  });
  const html = renderOutlineContextHtml(model);

  assert.match(html, /Act Two/);
  assert.match(html, /Inactive/i);
  assert.equal(model.chapterCount, 1);
  assert.equal(model.beatCount, 1);
});

test("renders chapter context with status and update button", () => {
  const model = buildChapterContext({
    id: "c1",
    name: "Chapter One",
    fileName: "manuscript/ch1.md",
    active: true,
    status: "editing",
    beats: [],
  });
  const html = renderOutlineContextHtml(model);

  assert.match(html, /Chapter One/);
  assert.match(html, /editing/);
  assert.match(html, /Update Status/);
  assert.match(html, /command:leanquill.updateOutlineChapterStatus/);
  assert.match(html, /manuscript\/ch1\.md/);
});

test("renders beat context with description and custom fields", () => {
  const model = buildBeatContext({
    id: "b1",
    title: "Opening Scene",
    fileName: "manuscript/beats/opening.md",
    active: true,
    description: "The hero enters the arena.",
    customFields: { mood: "tense", pov: "third" },
  });
  const html = renderOutlineContextHtml(model);

  assert.match(html, /Opening Scene/);
  assert.match(html, /The hero enters the arena/);
  assert.match(html, /mood/);
  assert.match(html, /tense/);
  assert.match(html, /pov/);
  assert.match(html, /third/);
  assert.match(html, /manuscript\/beats\/opening\.md/);
});

test("renders inactive beat with badge", () => {
  const model = buildBeatContext({
    id: "b1",
    title: "Cut Scene",
    fileName: "",
    active: false,
    description: "",
    customFields: {},
  });
  const html = renderOutlineContextHtml(model);

  assert.match(html, /Cut Scene/);
  assert.match(html, /Inactive/i);
});
