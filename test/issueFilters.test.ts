import test from "node:test";
import assert from "node:assert/strict";
import { isActiveForSidebarCount, matchesIssueFilter, type IssueStatus } from "../src/issueFilters";

/** D-06: active = open + deferred; dismissed excluded from default triage. */

test("matchesIssueFilter active includes open and deferred", () => {
  assert.equal(matchesIssueFilter("open", "active"), true);
  assert.equal(matchesIssueFilter("deferred", "active"), true);
});

test("matchesIssueFilter active excludes dismissed and resolved", () => {
  assert.equal(matchesIssueFilter("dismissed", "active"), false);
  assert.equal(matchesIssueFilter("resolved", "active"), false);
});

test("matchesIssueFilter open only matches open", () => {
  assert.equal(matchesIssueFilter("open", "open"), true);
  assert.equal(matchesIssueFilter("deferred", "open"), false);
});

test("matchesIssueFilter deferred only matches deferred (ISSUE-03 boundary)", () => {
  assert.equal(matchesIssueFilter("deferred", "deferred"), true);
  assert.equal(matchesIssueFilter("open", "deferred"), false);
});

test("matchesIssueFilter dismissed only matches dismissed (ISSUE-03)", () => {
  assert.equal(matchesIssueFilter("dismissed", "dismissed"), true);
  assert.equal(matchesIssueFilter("open", "dismissed"), false);
  assert.equal(matchesIssueFilter("deferred", "dismissed"), false);
  assert.equal(matchesIssueFilter("resolved", "dismissed"), false);
});

test("matchesIssueFilter all includes every status including resolved", () => {
  const all: IssueStatus[] = ["open", "deferred", "dismissed", "resolved"];
  for (const s of all) {
    assert.equal(matchesIssueFilter(s, "all"), true);
  }
});

test("isActiveForSidebarCount true for deferred, false for dismissed (D-06)", () => {
  assert.equal(isActiveForSidebarCount("deferred"), true);
  assert.equal(isActiveForSidebarCount("dismissed"), false);
});
