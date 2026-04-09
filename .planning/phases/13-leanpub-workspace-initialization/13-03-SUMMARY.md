---
phase: 13-leanpub-workspace-initialization
plan: "03"
subsystem: extension
tags: [initialize, leanpub, planning-webview, chapter-order]

requires:
  - phase: 13-01
  - phase: 13-02
provides:
  - Unified initialize flow with scaffold-only branch
  - Planning Cards success UX via showCards
affects:
  - 13-04 tests

tech-stack:
  added: []
  patterns:
    - "Valid project.yaml skips destructive overwrite prompt; scaffold extends layout"

key-files:
  created: []
  modified:
    - src/initialize.ts
    - src/planningPanel.ts
    - src/extension.ts

key-decisions:
  - "After success, open Planning Workspace on Cards tab instead of project.yaml"
  - "Blocked Book.txt scaffold surfaces Open Book.txt action and mentions LeanQuill: Open Book.txt command"

patterns-established:
  - "persistChapterOrder after scaffold so sidebar/outline pick up Book.txt without reload"

requirements-completed: [INIT-01, INIT-02]

duration: 45min
completed: 2026-04-08
---

# Phase 13 Plan 03: Initialize + manuscript scaffold + Cards UX

**`runInitializeFlow` now branches full init vs scaffold-only when `project.yaml` is already valid, skips overwrite prompts in that case, applies `applyLeanpubManuscriptScaffold`, refreshes chapter order, and opens Planning Workspace on the Cards tab.**

## Performance

- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- `PlanningPanelProvider.showCards()` mirrors `showCharacter` for tab selection.
- `ensureOverwriteIfNeeded` allows non-destructive extension when YAML validates.
- `shouldPromptInitialize` uses `manuscript/Book.txt`.

## Files Created/Modified

- `src/initialize.ts` — flow branches, scaffold UX, chapter-order rewrite.
- `src/planningPanel.ts` — `showCards`.
- `src/extension.ts` — pass `planningPanel` into initialize; optional `openPlanningWorkspace` tab arg; comment on `generateBookTxt` empty output.

## Self-Check: PASSED

- `npm run build` succeeds.

---

_Phase: 13-leanpub-workspace-initialization_
