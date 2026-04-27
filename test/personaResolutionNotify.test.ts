import test from "node:test";
import assert from "node:assert/strict";
import { shouldNotifyPersonaResolutionIssues } from "../src/personaResolutionNotify";

test("shouldNotifyPersonaResolutionIssues is false when both empty", () => {
  assert.strictEqual(shouldNotifyPersonaResolutionIssues([], []), false);
});

test("shouldNotifyPersonaResolutionIssues is true when warnings non-empty", () => {
  assert.strictEqual(shouldNotifyPersonaResolutionIssues(["x"], []), true);
});

test("shouldNotifyPersonaResolutionIssues is true when errors non-empty", () => {
  assert.strictEqual(shouldNotifyPersonaResolutionIssues([], ["e"]), true);
});
