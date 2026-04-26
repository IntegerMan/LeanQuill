import test from "node:test";
import assert from "node:assert/strict";
import { renderOpenQuestionsHtml } from "../src/openQuestionsHtml";

test("issues HTML exposes Chat about this action and protocol", () => {
  const html = renderOpenQuestionsHtml(
    [
      {
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
      },
    ],
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
