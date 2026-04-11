---
phase: 08-issue-capture-triage-and-editor-signals
plan: 03
subsystem: ui
tags: [vscode-webview, issues, triage, master-detail, postMessage]

requires:
  - phase: 08-issue-capture-triage-and-editor-signals
    provides: 08-01 filters/types, 08-02 issues store paths, 08-04 sidebar counts patterns
provides:
  - Master–detail Issues UI in Planning tab and bottom panel with D-06 filter semantics
  - Shared `openQuestion:setFilter`, `saveDetail`, `dismiss`, `new-question` (D-14) handling on both hosts
  - Thread list `· N Issues` suffix (D-09) and research basename chips (D-15)
  - `AUTHOR_ISSUE_TYPES` + workspace-persisted issue list filter
affects:
  - 08-05 gutter and any further issue UX should reuse protocols and filters

tech-stack:
  added: []
  patterns:
    - "Host applies `matchesIssueFilter` before serializing rows; filter persisted in `workspaceState` key `leanquill.issueListFilter`"
    - "D-14 create: `showInputBox` title → `showQuickPick` on `AUTHOR_ISSUE_TYPES` → `createOpenQuestion` with book association"

key-files:
  created:
    - src/issueTypes.ts
  modified:
    - src/openQuestionsHtml.ts
    - src/planningPanelHtml.ts
    - src/planningPanel.ts
    - src/openQuestionsPanel.ts
    - src/extension.ts

key-decisions:
  - "Planning and panel share one workspace filter key so changing the dropdown in either surface stays aligned."
  - "Research-linked rows show `path.basename` in the list chip to avoid a separate ‘research question’ type feel (D-15)."

patterns-established:
  - "Issue webview rows carry `relativeIssuePath` and full `body` for detail save without reconstructing paths client-side."

requirements-completed: [ISSUE-01, ISSUE-02, ISSUE-03, PLAN-03]

duration: 45min
completed: 2026-04-11
---

# Phase 08 Plan 03: Master–detail triage UI Summary

**Dual-host Issues webviews with master–detail layout, D-06 filters, dismiss/save/detail protocol, D-14 title→type creation, and thread rows showing active issue counts.**

## Performance

- **Duration:** ~45 min
- **Tasks:** 3
- **Files modified:** 6 (+1 created)

## Accomplishments

- Replaced flat table with master–detail (`oq-master-detail`), toolbar (**New issue**, filter, **Refresh**), empty copy per 08-UI-SPEC (`Active issues`, `No issues match this filter.`).
- Planning host filters with `matchesIssueFilter`, persists filter, implements save/dismiss/create, passes thread `· N Issues` counts into `renderThreadsTab`.
- Bottom panel mirrors the same message branches and uses `SafeFileSystem` + store APIs for writes and absolute paths for editor open.

## Task Commits

1. **Task 1: openQuestionsHtml — master–detail, toolbar, copy** — `5d1a7a6`
2. **Task 2: planningPanel — handlers, D-14, filter, thread counts** — `501257d`
3. **Task 3: openQuestionsPanel — protocol parity** — `a84dd51`

**Plan metadata:** `docs(08-03): complete master-detail triage plan` (SUMMARY + STATE + ROADMAP)

## Files Created/Modified

- `src/issueTypes.ts` — `AUTHOR_ISSUE_TYPES` for QuickPick
- `src/openQuestionsHtml.ts` — master–detail markup, styles, client script, extended row DTO
- `src/planningPanelHtml.ts` — Issues tab label, `renderOpenQuestionsHtml` meta + thread issue suffix
- `src/planningPanel.ts` — filter state, handlers, `createOpenQuestion` flow, thread count map
- `src/openQuestionsPanel.ts` — parity handlers, filter, save/dismiss/create
- `src/extension.ts` — `workspaceState` + `safeFileSystem` wiring for panel; planning `workspaceState`

## Decisions Made

- Filter preference stored in workspace state under `leanquill.issueListFilter` so Planning and panel stay consistent.
- New **New issue** from webviews uses inline D-14 flow instead of delegating to `leanquill.newOpenQuestion` so title-then-type is guaranteed in both hosts.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] TypeScript row DTO and call sites in Task 1**
- **Found during:** Task 1 (HTML builder only listed `openQuestionsHtml` / `planningPanelHtml`)
- **Issue:** `SerializableOpenQuestionRow` gained required fields; build failed until serializers and `renderOpenQuestionsHtml` call sites in `planningPanel.ts` / `openQuestionsPanel.ts` were updated.
- **Fix:** Extended `_toOpenQuestionRow` / `_toRow` and temporary `renderOpenQuestionsHtml` meta defaults in the same task as the HTML change.
- **Files modified:** `src/planningPanel.ts`, `src/openQuestionsPanel.ts` (alongside Task 1 HTML files)
- **Verification:** `npm run build`
- **Commit:** `5d1a7a6`

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary for a green build; no behavior change beyond carrying new row fields.

## Issues Encountered

None.

## User Setup Required

None.

## Next Phase Readiness

- Manual smoke: Issues tab + panel — filter, dismiss with reason, save detail, new issue creates under `.leanquill/issues/<type>/`.
- 08-05 can assume dual-host protocol and filter semantics are aligned.

## Self-Check: PASSED

- `src/issueTypes.ts` — FOUND
- `08-03-SUMMARY.md` — FOUND
- Task commits `5d1a7a6`, `501257d`, `a84dd51` and docs commit matching `docs(08-03): complete master-detail triage plan` — FOUND in `git log`

---
*Phase: 08-issue-capture-triage-and-editor-signals*
*Completed: 2026-04-11*
