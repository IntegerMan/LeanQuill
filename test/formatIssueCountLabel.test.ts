import test from "node:test";
import assert from "node:assert/strict";
import { formatIssueCountLabel } from "../src/formatIssueCountLabel";

test("formatIssueCountLabel singular and plural", () => {
  assert.equal(formatIssueCountLabel(0), "0 Issues");
  assert.equal(formatIssueCountLabel(1), "1 Issue");
  assert.equal(formatIssueCountLabel(2), "2 Issues");
  assert.equal(formatIssueCountLabel(10), "10 Issues");
});

test("formatIssueCountLabel floors and clamps negatives", () => {
  assert.equal(formatIssueCountLabel(1.9), "1 Issue");
  assert.equal(formatIssueCountLabel(-3), "0 Issues");
});
