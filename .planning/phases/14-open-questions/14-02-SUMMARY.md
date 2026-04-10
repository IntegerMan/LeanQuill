---
phase: 14-open-questions
plan: 02
subsystem: persistence
tags: [markdown, yaml, safefilesystem, chapter-status]
requires: [{ phase: 14-01, provides: "tests + stub" }]
provides:
  - Full open question CRUD under .leanquill/open-questions
  - Chapter status openIssueCount preservation fix
affects: [14-03, 14-04, 14-06]
tech-stack:
  added: []
  patterns: [author-note frontmatter + lq_* association keys]
key-files:
  created: []
  modified: [src/types.ts, src/openQuestionStore.ts, src/chapterStatus.ts, test/chapterStatus.test.ts, test/openQuestionStore.test.ts, test/openQuestionChapterCounts.test.ts]
key-decisions:
  - "OpenQuestionRecord uses discriminated association union; serialize maps to lq_assoc_kind and lq_*_file"
patterns-established:
  - "countOpenQuestionsByChapter only increments manuscript chapter-linked open rows"
requirements-completed: [ISSUE-01, ISSUE-02]
duration: 45min
completed: 2026-04-10
---

# Phase 14 Plan 02 Summary

**Local-first `openQuestionStore` with issue-schema-aligned YAML and D-03 counting; `writeChapterStatusEntry` no longer resets `openIssueCount`.**

## Task commits

- `e6ab84a` — types, store, chapter status fix, green tests

## Deviations

None.
