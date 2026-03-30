import test from "node:test";
import assert from "node:assert/strict";
import { buildChapterRows } from "../src/chapterTree";
import { ChapterStatusIndex } from "../src/types";

function makeStatusIndex(): ChapterStatusIndex {
  return {
    schemaVersion: "1",
    chapters: {
      "manuscript/ch1.md": {
        chapterId: "ch1",
        title: "Chapter One",
        status: "planning",
        openIssueCount: 0,
        updatedAt: "2026-03-29T00:00:00.000Z",
      },
      "manuscript/ch2.md": {
        chapterId: "ch2",
        title: "Chapter Two",
        status: "drafting",
        openIssueCount: 0,
        updatedAt: "2026-03-29T00:00:00.000Z",
      },
      "manuscript/orphan.md": {
        chapterId: "orphan",
        title: "Orphan",
        status: "not-started",
        openIssueCount: 0,
        updatedAt: "2026-03-29T00:00:00.000Z",
      },
    },
  };
}

test("buildChapterRows preserves order and marks missing paths", () => {
  const rows = buildChapterRows(
    ["manuscript/ch2.md", "manuscript/ch1.md", "manuscript/missing.md"],
    ["manuscript/ch1.md", "manuscript/ch2.md", "manuscript/orphan.md"],
    makeStatusIndex(),
  );

  assert.equal(rows.length, 4);
  assert.equal(rows[0]?.kind, "chapter");
  assert.equal(rows[1]?.kind, "chapter");
  assert.equal(rows[2]?.kind, "chapter");

  const first = rows[0] as { kind: "chapter"; chapterPath: string; missing: boolean };
  const second = rows[1] as { kind: "chapter"; chapterPath: string; missing: boolean };
  const third = rows[2] as { kind: "chapter"; chapterPath: string; missing: boolean };

  assert.equal(first.chapterPath, "manuscript/ch2.md");
  assert.equal(second.chapterPath, "manuscript/ch1.md");
  assert.equal(third.chapterPath, "manuscript/missing.md");
  assert.equal(third.missing, true);
});

test("buildChapterRows adds Not Included group for orphan manuscript files", () => {
  const rows = buildChapterRows(
    ["manuscript/ch1.md"],
    ["manuscript/ch1.md", "manuscript/ch3.md", "manuscript/ch2.md"],
    makeStatusIndex(),
  );

  const group = rows[1] as { kind: "group"; title: string; children: Array<{ chapterPath: string }> };
  assert.equal(group.kind, "group");
  assert.equal(group.title, "Not Included");
  assert.deepEqual(group.children.map((child) => child.chapterPath), [
    "manuscript/ch2.md",
    "manuscript/ch3.md",
  ]);
});
