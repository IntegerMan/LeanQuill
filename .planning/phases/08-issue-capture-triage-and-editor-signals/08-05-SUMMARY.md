---
phase: 08-issue-capture-triage-and-editor-signals
plan: 05
subsystem: extension
tags: [vscode, gutter, migration, issues, span-hint]

requires:
  - phase: 08-issue-capture-triage-and-editor-signals
    provides: openQuestionStore v3 paths, span hint resolution, D-06 filters
provides:
  - v3 issue migration before first listOpenQuestions
  - `.leanquill/issues/**/*.md` watcher with planning/panel/outline + entity tree refresh
  - IssueGutterController with manuscript gutter decorations and Issues at cursor command
affects:
  - Phase 8 verification / UAT
  - Future AI session issues (watcher excludes sessions registration per D-04)

tech-stack:
  added: []
  patterns:
    - "Debounce manuscript `onDidChangeTextDocument` (~150ms) to re-resolve span_hint for gutter"
    - "D-12 stacking via command + QuickPick; hover Markdown command links as secondary affordance"

key-files:
  created:
    - src/issueGutterController.ts
    - media/issue-gutter.svg
    - media/issue-gutter-stale.svg
  modified:
    - src/extension.ts
    - package.json

key-decisions:
  - "D-12: No gutter glyph onClick — primary UX is LeanQuill: Issues at cursor plus trusted Markdown hover links (Pitfall 3 / engines ^1.90)."

patterns-established:
  - "Single refreshOpenQuestionSurfaces fan-out includes character/place/research trees for live D-09 counts."

requirements-completed: [ISSUE-01, ISSUE-04, PLAN-03]

duration: 22min
completed: 2026-04-11
---

# Phase 08 Plan 05: Editor signals and gutter integration Summary

**One-liner:** v3 issue migration gate, unified issues file watcher with sidebar refresh fan-out, and manuscript gutter decorations with a cursor command for stacked span_hint anchors (ISSUE-04 / D-12).

## Performance

- **Duration:** ~22 min
- **Tasks:** 3
- **Files touched:** 6 (extension, package, controller, 2 SVGs, SUMMARY)

## Accomplishments

- Activation awaits `migrateIssuesLayoutV3IfNeeded` before any issue-host loads legacy paths into the new store layout (D-03).
- Issues watcher uses `RelativePattern` on `.leanquill/issues/**/*.md`; create/change/delete refreshes planning webview, bottom panel, outline webview, and character/place/research trees.
- `IssueGutterController` drives gutter icons for active selection-anchored issues on the active manuscript chapter, with matched vs stale decoration types and debounced re-resolution on document edits.

## D-12 interaction outcome

**Gutter glyph click is not implemented.** The public VS Code decoration API for `engines.vscode ^1.90` does not provide a supported per-glyph click handler for gutter decorations (see `08-RESEARCH.md` Pitfall 3). **Primary UX:** command **LeanQuill: Issues at cursor** (`leanquill.issuesAtCursor`) — 0 hits shows an info message, 1 hit opens the issue file, multiple hits open `showQuickPick` by title. **Secondary UX:** trusted `MarkdownString` hovers append a `[Choose issue…](command:leanquill.issuesAtCursor)` link on single-issue lines and point stacked lines at the same command.

## Task Commits

1. **Task 1: extension.ts — migration gate, watcher, refresh fan-out** — `077e449` (feat)
2. **Task 2: issueGutterController — decorations, debounce, D-12 command, spike notes** — `13b3e7f` (feat)
3. **Task 3: package.json + extension registration + PLAN-03 verify hook** — `26d612e` (feat)

**Plan metadata:** Same commit as `.planning/STATE.md` / `ROADMAP.md` docs update for this plan (`docs(08-05): complete editor signals and gutter plan`).

## Files Created/Modified

- `src/extension.ts` — migration await; issues watcher; `refreshOpenQuestionSurfaces` tree fan-out; `IssueGutterController` registration; exported `deactivate` with disposal note.
- `package.json` — `leanquill.issuesAtCursor` command and menus; D-14-aligned **New issue** command titles; activation event for the new command.
- `src/issueGutterController.ts` — gutter index, decorations, debounce, Issues at cursor, D-12 spike documentation.
- `media/issue-gutter.svg` / `media/issue-gutter-stale.svg` — theme-friendly `currentColor` gutter icons.

## Deviations from Plan

None — plan executed as written. Added `issue-gutter-stale.svg` as a muted icon variant for unresolved `span_hint` (stale) rows instead of a non-API `opacity` field on decoration types.

## Known Stubs

None identified for this plan’s goals.

## Self-Check: PASSED

- `08-05-SUMMARY.md` present at `.planning/phases/08-issue-capture-triage-and-editor-signals/08-05-SUMMARY.md`
- Task commits `077e449`, `13b3e7f`, `26d612e` present in `git log`
