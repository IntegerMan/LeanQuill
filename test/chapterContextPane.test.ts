import test from "node:test";
import assert from "node:assert/strict";
import { renderChapterContextHtml } from "../src/chapterContextPane";

test("renders empty state before chapter activation", () => {
  const html = renderChapterContextHtml();

  assert.match(html, /No chapter selected/);
  assert.match(html, /Content-Security-Policy/);
  assert.match(html, /default-src 'none'/);
});

test("renders active chapter status and action link", () => {
  const html = renderChapterContextHtml({
    chapterPath: "manuscript/ch1.md",
    title: "Chapter One",
    status: "drafting",
    openIssueCount: 0,
  });

  assert.match(html, /Chapter One/);
  assert.match(html, /drafting/);
  assert.match(html, /Update Chapter Status/);
  assert.match(html, /command:leanquill.updateChapterStatus/);
});

test("renders retained context helper text", () => {
  const html = renderChapterContextHtml({
    chapterPath: "manuscript/ch2.md",
    title: "Chapter Two",
    status: "editing",
    openIssueCount: 1,
  }, true);

  assert.match(html, /Showing last active chapter context/);
  assert.match(html, /1 issue/);
});
