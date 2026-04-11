---
phase: 08-issue-capture-triage-and-editor-signals
plan: 02
subsystem: api
tags: [issues, migration, span-hint, markdown, node-test]

requires:
  - phase: 08-issue-capture-triage-and-editor-signals
    provides: 08-01 stubs, filters, and test harness for issues layer
provides:
  - v3 `.leanquill/issues/{type-slug}/*.md` store with recursive listing (skips `sessions/`)
  - Idempotent migration from `.leanquill/open-questions/` to `issues/question/` with marker `.migration-v3-complete.json`
  - `resolveSpanHintInDocument` (matched | stale | ambiguous) and `resolveOpenQuestionSelectionSpan` bridge from `openQuestionStore`
affects:
  - 08-03 through 08-05 (wiring, UI, gutter) may assume new paths and resolver behavior

tech-stack:
  added: []
  patterns:
    - "Repo-relative issue paths: `{type}/{file}.md` under `.leanquill/issues`"
    - "Sidebar counts delegate to `isActiveForSidebarCount` from `issueFilters`"

key-files:
  created: []
  modified:
    - src/openQuestionStore.ts
    - src/issueMigration.ts
    - src/spanHintResolve.ts
    - src/extension.ts
    - src/openQuestionsPanel.ts
    - src/planningPanel.ts
    - Imported/data-contracts/issue-schema.md

key-decisions:
  - "Marker filename `.leanquill/issues/.migration-v3-complete.json` for v3 idempotency (matches plan must_haves)."
  - "On migration conflict, rename legacy file with numeric suffix and `console.warn` rather than overwrite."

patterns-established:
  - "Use `leanQuillIssueFileAbsolutePath` for editor and IO joins instead of hardcoding `open-questions`."

requirements-completed: [ISSUE-01, ISSUE-02, PLAN-03]

duration: 40min
completed: 2026-04-11
---

# Phase 08 Plan 02: Issue layout v3, migration, and span-hint resolution Summary

**Per-type `.leanquill/issues/` storage with v3 migration, `question` type contract, bounded `span_hint` resolution, and extension watcher paths aligned to the new layout.**

## Performance

- **Duration:** ~40 min
- **Tasks:** 3
- **Files modified:** 12+

## Accomplishments

- Documented unified `question` issue type and legacy `author-note` mapping in `issue-schema.md`; UI labels treat both as “Question”.
- Implemented `migrateIssuesLayoutV3IfNeeded` with conflict rename, `author-note` → `question` rewrite, empty legacy cleanup, and JSON marker.
- Refactored `openQuestionStore` for typed folders, optional `issueType` on create, chapter counts via `isActiveForSidebarCount`, and `resolveOpenQuestionSelectionSpan` calling `resolveSpanHintInDocument`.
- Replaced stub resolver with exact, ambiguous, and ±1200-char window fuzzy partial matching; enabled D-13 tests.

## Task Commits

1. **Task 1: Contract + types + displayIssueTypeLabel** — `38f1231` (feat)
2. **Task 2: issueMigration v3** — `2cedab1` (feat)
3. **Task 3: Store + spanHintResolve + watcher/editor paths** — `160f008` (feat)

**Plan metadata:** same commit as this SUMMARY (docs: complete plan; bundles STATE/ROADMAP/REQUIREMENTS).

## Files Created/Modified

- `Imported/data-contracts/issue-schema.md` — `question` type + legacy `author-note` note
- `src/types.ts` — comment alignment for `issueSchemaType`
- `src/openQuestionStore.ts` — `LEANQUILL_ISSUES_DIR`, listing, CRUD paths, span bridge
- `src/issueMigration.ts` — full v3 migration + exported `MIGRATION_V3_MARKER_FILENAME`
- `src/spanHintResolve.ts` — `resolveSpanHintInDocument` implementation
- `src/openQuestionWorkspaceSync.ts` — docstring for v3 issue paths
- `src/extension.ts` — watcher glob on `.leanquill/issues/**/*.md`
- `src/openQuestionsPanel.ts` / `src/planningPanel.ts` — open file via `leanQuillIssueFileAbsolutePath`
- `src/openQuestionsHtml.ts` — protocol comment
- `test/issueMigration.test.ts` — filesystem assertions + conflict case
- `test/spanHintResolve.test.ts` — D-13 cases enabled
- `test/openQuestionStore.test.ts` — default type `question`

## Decisions Made

- Chose marker basename `.migration-v3-complete.json` under `.leanquill/issues/` (matches plan artifacts).
- Fuzzy fallback scans substrings of the hint from full length down to 3 characters inside the ±1200 window around `preferredStartIndex`.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- `npx tsc --noEmit` fails on this repo’s `tsconfig` (`rootDir` vs `test/`); verification used `npm run build` + `npm run build:test` + `npm test` instead.

## User Setup Required

None.

## Next Phase Readiness

- Data layer and resolver are ready for gutter/list consumers; extension still needs explicit `migrateIssuesLayoutV3IfNeeded` before first list (planned in 08-05).

## Known Stubs

None identified for this plan’s goals.

## Self-Check: PASSED

- `08-02-SUMMARY.md` exists under the phase directory.
- Task commits present on branch: `38f1231`, `2cedab1`, `160f008`; planning artifacts committed with `docs(08-02): complete issues v3 plan`.

---
*Phase: 08-issue-capture-triage-and-editor-signals*
*Completed: 2026-04-11*
