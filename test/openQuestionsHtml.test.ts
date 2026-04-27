import test from "node:test";
import assert from "node:assert/strict";
import { renderOpenQuestionsHtml } from "../src/openQuestionsHtml";

const sampleQuestion = {
  id: "q1",
  title: "T",
  preview: "pv",
  body: "",
  status: "open",
  issueType: "question",
  issueTypeLabel: "Question",
  associationTypeLabel: "Chapter",
  associationChip: "manuscript/ch01.md",
  associationChips: [],
  relativeIssuePath: "question/q1.md",
};

test("issues HTML exposes Chat about this action and protocol", () => {
  const html = renderOpenQuestionsHtml(
    [sampleQuestion],
    "planning",
    "nonce-test",
    "vscode-resource:",
    false,
    { currentFilter: "active", totalIssueCount: 1 },
  );
  assert.match(html, /Chat about this/);
  assert.match(html, /data-action="chat-about-this"/);
  assert.match(html, /openQuestion:chatAboutThis/);
  assert.match(html, /data-ctx="chat-about-this"/);
});

test("planning fragment uses shared __lqVsApi global instead of bare acquireVsCodeApi", () => {
  const html = renderOpenQuestionsHtml(
    [sampleQuestion],
    "planning",
    "nonce-test",
    "vscode-resource:",
    false,
    { currentFilter: "active", totalIssueCount: 1 },
  );
  // Must use the cached-global pattern so it does not throw when the
  // planning panel's own script has already called acquireVsCodeApi().
  assert.match(html, /__lqVsApi/);
  // Must NOT call acquireVsCodeApi() unconditionally (the bare call without caching).
  assert.doesNotMatch(html, /const vscode = acquireVsCodeApi\(\)/);
});

test("planning fragment script registers visibilitychange and blur cleanup listeners", () => {
  const html = renderOpenQuestionsHtml(
    [sampleQuestion],
    "planning",
    "nonce-test",
    "vscode-resource:",
    false,
    { currentFilter: "active", totalIssueCount: 1 },
  );
  assert.match(html, /visibilitychange/);
  assert.match(html, /window\.addEventListener\('blur'/);
});

test("standalone document still calls acquireVsCodeApi via shared cache", () => {
  const html = renderOpenQuestionsHtml(
    [sampleQuestion],
    "panel",
    "nonce-test",
    "vscode-resource:",
    true,
    { currentFilter: "active", totalIssueCount: 0 },
  );
  assert.match(html, /__lqVsApi/);
  assert.match(html, /<!DOCTYPE html>/);
});
