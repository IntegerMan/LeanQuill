import test from "node:test";
import assert from "node:assert/strict";
import {
  buildStoryChatContextBundle,
  buildStoryChatContextSummary,
  createStoryChatSessionId,
  pathsForIssueChat,
  type StoryChatMemoryContext,
} from "../src/storyChatContext";
import type { OpenQuestionRecord } from "../src/types";
import type { ProjectConfig } from "../src/projectConfig";

test("createStoryChatSessionId uses local padded date/time", () => {
  const id = createStoryChatSessionId(new Date(2026, 3, 25, 9, 7, 5));
  assert.equal(id, "2026-04-25-090705-story-chat");
});

const baseCfg: ProjectConfig = {
  schemaVersion: "1",
  folders: {
    research: "research/leanquill/",
    characters: "notes/characters/",
    threads: "notes/threads/",
    settings: "notes/settings/",
  },
};

function minimalIssue(partial: Partial<OpenQuestionRecord> & Pick<OpenQuestionRecord, "association">): OpenQuestionRecord {
  return {
    fileName: partial.fileName ?? "question/q1.md",
    id: partial.id ?? "q1",
    issueSchemaType: "question",
    title: partial.title ?? "T",
    body: "",
    status: "open",
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
    association: partial.association,
  };
}

test("pathsForIssueChat chapter issue", () => {
  const issue = minimalIssue({
    fileName: "question/q1.md",
    association: { kind: "chapter", chapterRef: "manuscript/ch01.md" },
  });
  assert.deepEqual(pathsForIssueChat(issue, baseCfg), [".leanquill/issues/question/q1.md", "manuscript/ch01.md"]);
});

test("pathsForIssueChat selection preserves chapter path", () => {
  const issue = minimalIssue({
    association: {
      kind: "selection",
      chapterRef: "manuscript/ch01.md",
      spanHint: "selected phrase",
    },
  });
  const p = pathsForIssueChat(issue, baseCfg);
  assert.deepEqual(p, [".leanquill/issues/question/q1.md", "manuscript/ch01.md"]);
});

test("pathsForIssueChat character place thread research", () => {
  assert.deepEqual(
    pathsForIssueChat(
      minimalIssue({ association: { kind: "character", fileName: "hero.md" } }),
      baseCfg,
    ),
    [".leanquill/issues/question/q1.md", "notes/characters/hero.md"],
  );
  assert.deepEqual(
    pathsForIssueChat(minimalIssue({ association: { kind: "place", fileName: "dock.md" } }), baseCfg),
    [".leanquill/issues/question/q1.md", "notes/settings/dock.md"],
  );
  assert.deepEqual(
    pathsForIssueChat(minimalIssue({ association: { kind: "thread", fileName: "main.md" } }), baseCfg),
    [".leanquill/issues/question/q1.md", "notes/threads/main.md"],
  );
  assert.deepEqual(
    pathsForIssueChat(minimalIssue({ association: { kind: "research", fileName: "r.md" } }), baseCfg),
    [".leanquill/issues/question/q1.md", "research/leanquill/r.md"],
  );
});

test("pathsForIssueChat book adds only issue path", () => {
  const issue = minimalIssue({ association: { kind: "book" } });
  assert.deepEqual(pathsForIssueChat(issue, baseCfg), [".leanquill/issues/question/q1.md"]);
});

test("issue chat summary lists selection span when target carries spanHint", () => {
  const bundle = buildStoryChatContextBundle({
    launchedFrom: "issue",
    manuscriptScope: "chapter",
    includedPaths: [".leanquill/issues/question/q1.md", "manuscript/ch01.md"],
    target: {
      kind: "issue",
      label: "Sel issue",
      chapterRef: "manuscript/ch01.md",
      spanHint: "selected phrase",
    },
  });
  assert.match(bundle.summary, /Selection span: selected phrase/);
});

test("buildStoryChatContextSummary lists active personas when provided", () => {
  const bundle = buildStoryChatContextBundle({
    launchedFrom: "general",
    activePersonas: [
      { id: "casual-reader", name: "Jordan", type: "beta-reader" },
      { id: "copy-editor", name: "Sam", type: "copy-editor" },
    ],
  });
  const s = buildStoryChatContextSummary(bundle);
  assert.match(s, /Active personas \(read-only advisory\):/);
  assert.match(s, /casual-reader — Jordan \(beta-reader\)/);
  assert.match(s, /copy-editor — Sam \(copy-editor\)/);
});

test("general chat defaults manuscriptScope none and strips manuscript paths", () => {
  const bundle = buildStoryChatContextBundle({
    launchedFrom: "general",
    includedPaths: ["manuscript/ch01.md", ".leanquill/project.yaml", "manuscript/ch01.md"],
  });
  assert.equal(bundle.manuscriptScope, "none");
  assert.deepEqual(bundle.includedPaths, [".leanquill/project.yaml"]);
  const s = bundle.summary;
  assert.match(s, /Manuscript scope: none/);
  assert.match(s, /Full manuscript context is never automatic/);
});

test("chapter scope keeps manuscript path", () => {
  const bundle = buildStoryChatContextBundle({
    launchedFrom: "chapter",
    manuscriptScope: "chapter",
    includedPaths: ["manuscript/ch03.md", "notes/foo.md"],
  });
  assert.equal(bundle.manuscriptScope, "chapter");
  assert.ok(bundle.includedPaths.includes("manuscript/ch03.md"));
});

test("selection chat summary includes span, excerpt, chapter identity, safety", () => {
  const excerpt = "Selected only this.";
  const bundle = buildStoryChatContextBundle({
    launchedFrom: "selection",
    manuscriptScope: "selection",
    includedPaths: ["manuscript/chapter-2.md"],
    target: {
      kind: "selection",
      label: "Selection in chapter-2",
      chapterRef: "chapter-2",
      spanHint: "L10–L12",
      selectedTextExcerpt: excerpt,
    },
  });
  const s = buildStoryChatContextSummary(bundle);
  assert.match(s, /Launch source: selection/);
  assert.match(s, /Manuscript scope: selection/);
  assert.match(s, /Selection span: L10–L12/);
  assert.match(s, /Selected excerpt: Selected only this\./);
  assert.match(s, /chapter-2/);
  assert.match(s, /LeanQuill advises but never authors manuscript prose\. Full manuscript context is never automatic\./);
  assert.equal(bundle.target?.selectedTextExcerpt, excerpt);
  assert.ok(!s.includes("UNRELATED_CHAPTER_TEXT"));
});

test("selection excerpt is truncated at 2000 chars", () => {
  const long = "x".repeat(2500);
  const bundle = buildStoryChatContextBundle({
    launchedFrom: "selection",
    manuscriptScope: "selection",
    target: {
      kind: "selection",
      label: "Sel",
      chapterRef: "c1",
      spanHint: "L1",
      selectedTextExcerpt: long,
    },
  });
  assert.equal(bundle.target?.selectedTextExcerpt?.length, 2000);
});

test("active memory deduped and paths normalized", () => {
  const m1: StoryChatMemoryContext = {
    id: "a",
    topic: "T1",
    associationLabel: "Book",
    updatedAt: "2026-01-01",
    path: ".leanquill/memory/a.md",
  };
  const m2: StoryChatMemoryContext = {
    id: "a",
    topic: "T1 dup",
    associationLabel: "Book",
    updatedAt: "2026-02-01",
    path: ".leanquill/memory\\a.md",
  };
  const bundle = buildStoryChatContextBundle({
    launchedFrom: "general",
    activeMemory: [m1, m2],
    includedPaths: ["a\\b.md", "a/b.md"],
  });
  assert.equal(bundle.activeMemory.length, 1);
  assert.deepEqual(bundle.includedPaths, ["a/b.md"]);
  assert.match(bundle.summary, /T1 dup|T1/);
  assert.match(bundle.summary, /\.leanquill\/memory\/a\.md/);
});

test("buildStoryChatContextSummary contains required safety sentence", () => {
  const bundle = buildStoryChatContextBundle({ launchedFrom: "general" });
  assert.match(
    bundle.summary,
    /Safety:.*Full manuscript context is never automatic/,
  );
});
