---
phase: 08-issue-capture-triage-and-editor-signals
plan: 04
subsystem: ui
tags: [vscode, sidebar, open-questions, d-09, triage]

requires:
  - phase: 08-issue-capture-triage-and-editor-signals
    provides: issue store, issueFilters, chapter merge counts from prior 08-01/02 plans
provides:
  - D-09 **X Issues** copy on chapter tree, outline webview, character/place/research sidebar trees
  - countActiveIssuesByChapter alias and countActiveQuestionsLinkedToEntity (open+deferred entity links)
affects:
  - planning workspace Threads tab (08-03 owner; untouched here per plan)

tech-stack:
  added: []
  patterns:
    - "Sidebar trees: await listOpenQuestions(root) in getChildren; compute per-row counts; omit description when zero"
    - "Place tree: cache issue list from root getChildren for nested _toItem / reveal / getParent"

key-files:
  created: []
  modified:
    - src/openQuestionStore.ts
    - src/chapterTree.ts
    - src/outlineWebviewPanel.ts
    - src/characterTree.ts
    - src/placeTree.ts
    - src/researchTree.ts
    - src/extension.ts
    - test/openQuestionStore.test.ts

key-decisions:
  - "ResearchTreeProvider now receives workspaceRoot plus researchDir so listOpenQuestions uses `.leanquill/issues` while files still come from the configured research folder."
  - "Entity link counting consolidated in countActiveQuestionsLinkedToEntity; countOpenQuestionsLinkedToEntity remains an export alias for existing imports (planning panel)."

patterns-established:
  - "Active sidebar totals match D-06: isActiveForSidebarCount (open + deferred) for chapter and entity/research links."

requirements-completed: [ISSUE-01, ISSUE-03]

duration: 20min
completed: 2026-04-10
---

# Phase 8 Plan 4: Sidebar and outline **X Issues** counts Summary

**Unified D-09 copy (`N Issues`, outline ` · N Issues`) and open+deferred counts on chapter tree, outline webview, and Characters / Places / Research native trees — counts only, no drill-down.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-04-10T00:00:00Z (executor session)
- **Completed:** 2026-04-10T00:00:00Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments

- Chapter tree and outline webview show the same active (open + deferred) per-chapter totals with **Issues** capitalization per 08-UI-SPEC.
- Characters, Places, and Research trees set `TreeItem.description` to `N Issues` when linked active issues exist; research rows keep the created date and append ` · N Issues`.
- Store exports `countActiveIssuesByChapter` and `countActiveQuestionsLinkedToEntity`; `countOpenQuestionsLinkedToEntity` aliases the latter for compatibility.

## Task Commits

Each task was committed atomically:

1. **Task 1: Shared active issue count helper + chapterTree copy** - `0d07fb7` (feat)
2. **Task 2: outlineWebviewPanel.ts — Issues suffix on rows** - `4c8ade6` (feat)
3. **Task 3: characterTree, placeTree, researchTree descriptions (D-09)** - `db1e2fb` (feat)

**Plan metadata:** `b9f9064` (docs: complete plan — SUMMARY, STATE, ROADMAP, REQUIREMENTS)

## Files Created/Modified

- `src/openQuestionStore.ts` — `countActiveIssuesByChapter` alias; `countActiveQuestionsLinkedToEntity` + `countOpenQuestionsLinkedToEntity` alias.
- `src/chapterTree.ts` — `issueCountText` → `${n} Issues`.
- `src/outlineWebviewPanel.ts` — `countActiveIssuesByChapter` import/usage; HTML suffix ` · N Issues`.
- `src/characterTree.ts` — `listOpenQuestions` + per-character `activeIssueCount` → description.
- `src/placeTree.ts` — Cached issue list for root refresh; `_toItem` counts places; reveal/getParent pass issue list.
- `src/researchTree.ts` — `workspaceRoot`; `getChildren` merges research basename counts into items.
- `src/extension.ts` — `ResearchTreeProvider(vscode, rootPath, researchDir)`.
- `test/openQuestionStore.test.ts` — Active entity count test (D-06).

## Decisions Made

- Extended `ResearchTreeProvider` with `workspaceRoot` (required for issue paths) while leaving research file discovery in `researchDir` — see key-decisions in frontmatter.

## Deviations from Plan

- **`src/extension.ts`:** Not listed in plan `files_modified` frontmatter, but required to pass `rootPath` into `ResearchTreeProvider` for `listOpenQuestions`. No behavioral change outside research tree wiring.

None - plan executed exactly as written otherwise.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Sidebar and outline surfaces align with default triage (open + deferred) for display counts.
- Planning Threads **X Issues** remains for 08-03 as specified.

## Self-Check: PASSED

- `08-04-SUMMARY.md` present at `.planning/phases/08-issue-capture-triage-and-editor-signals/08-04-SUMMARY.md`.
- Task commits present: `0d07fb7`, `4c8ade6`, `db1e2fb` on branch.

---
*Phase: 08-issue-capture-triage-and-editor-signals*
*Completed: 2026-04-10*
