import test from "node:test";
import assert from "node:assert/strict";
import { validateMetadataAction } from "../src/metadataActionContract";

const roots = ["notes/characters/", "notes/settings/", "notes/threads/", "research/leanquill/"];

function baseAction(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: "1",
    actionId: "a1",
    sourceChatId: "s1",
    operation: "createMemory",
    targetPath: ".leanquill/memory/x.md",
    fieldPath: [],
    rationale: "r",
    risk: "low",
    newValue: { topic: "t", body: "b" },
    ...overrides,
  };
}

test("validateMetadataAction accepts low-risk leanquill memory and chats", () => {
  const m = validateMetadataAction(baseAction({ targetPath: ".leanquill/memory/x.md" }), { configuredWritableRoots: roots });
  assert.equal(m.ok, true);
  const c = validateMetadataAction(baseAction({ targetPath: ".leanquill/chats/sess.md" }), { configuredWritableRoots: roots });
  assert.equal(c.ok, true);
});

test("requiresApproval paths need authorApproval", () => {
  const v = validateMetadataAction(
    baseAction({
      operation: "set",
      targetPath: "notes/characters/hero.md",
      fieldPath: ["customFields", "notes"],
      risk: "requiresApproval",
      authorApproval: { approvedAt: "2026-01-01", method: "chat-text-confirmation" },
    }),
    { configuredWritableRoots: roots },
  );
  assert.equal(v.ok, true);
});

test("validateMetadataAction rejects createMemory targeting manuscript/Book.txt", () => {
  const v = validateMetadataAction(
    baseAction({ targetPath: "manuscript/Book.txt", operation: "createMemory" }),
    { configuredWritableRoots: roots },
  );
  assert.equal(v.ok, false);
  assert.ok((v.blockedReasons?.length ?? 0) > 0 || (v.errors?.length ?? 0) > 0);
});

test("blocks manuscript, traversal, unknown operation, low on entity path", () => {
  assert.ok(!validateMetadataAction(baseAction({ targetPath: "manuscript/ch01.md" }), { configuredWritableRoots: roots }).ok);
  assert.ok(!validateMetadataAction(baseAction({ targetPath: "../escape.md" }), { configuredWritableRoots: roots }).ok);
  assert.ok(!validateMetadataAction(baseAction({ targetPath: "C:/temp/x.md" }), { configuredWritableRoots: roots }).ok);
  assert.ok(!validateMetadataAction(baseAction({ operation: "bogus" as never }), { configuredWritableRoots: roots }).ok);
  const lowEntity = validateMetadataAction(
    baseAction({
      operation: "set",
      targetPath: "notes/characters/hero.md",
      fieldPath: ["customFields", "x"],
      risk: "low",
    }),
    { configuredWritableRoots: roots },
  );
  assert.equal(lowEntity.ok, false);
  assert.ok(lowEntity.blockedReasons.includes("approval bypass"));
});

test("unconfigured path blocked", () => {
  const v = validateMetadataAction(baseAction({ targetPath: "notes/private/x.md" }), { configuredWritableRoots: roots });
  assert.equal(v.ok, false);
});

test("updateThemeMetadata and research require approval in happy path", () => {
  const theme = validateMetadataAction(
    baseAction({
      operation: "updateThemeMetadata",
      targetPath: ".leanquill/themes.yaml",
      fieldPath: [],
      risk: "requiresApproval",
      authorApproval: { approvedAt: "2026-01-01", method: "extension-command" },
      newValue: { centralQuestion: "Q?" },
    }),
    { configuredWritableRoots: roots },
  );
  assert.equal(theme.ok, true);
  const res = validateMetadataAction(
    baseAction({
      operation: "updateResearchAssociation",
      targetPath: "research/leanquill/r.md",
      fieldPath: [],
      risk: "requiresApproval",
      authorApproval: { approvedAt: "2026-01-01", method: "native-tool-confirmation" },
      newValue: { lq_character_file: "hero.md" },
    }),
    { configuredWritableRoots: roots },
  );
  assert.equal(res.ok, true);
});

/*
 * Manual audit (09-VALIDATION): from repo root, periodically run:
 *   rg "fs\\.writeFile\\(" src
 *   rg "appendFile\\(" src
 * Manuscript writes should be limited to intentional modules (e.g. initialize,
 * leanpubScaffold, bookTxtSync). Adjust this comment if the grep list changes.
 */
