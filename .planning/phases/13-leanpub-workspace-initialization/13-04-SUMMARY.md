---
phase: 13-leanpub-workspace-initialization
plan: "04"
subsystem: testing
tags: [node-test, leanpub, project-yaml]

requires:
  - phase: 13-03
provides:
  - Regression tests for scaffold + setup validation
affects: []

tech-stack:
  added: []
  patterns:
    - "Temp-dir tests for filesystem scaffold invariants"

key-files:
  created:
    - test/leanpubScaffold.test.ts
  modified:
    - test/projectConfig.test.ts
    - package.json
    - src/extension.ts
    - src/initialize.ts

key-decisions:
  - "Blocked-path test asserts Book.txt byte stability"

patterns-established: []

requirements-completed: [INIT-01, INIT-02]

duration: 30min
completed: 2026-04-08
---

# Phase 13 Plan 04: Tests and D-03 copy audit

**Added `leanpubScaffold` temp-dir tests (create-only, case-insensitive ch1, blocked D-18, paths under `manuscript/`) and `validateProjectYamlForSetup` cases; tightened onboarding strings in scoped files for any-folder workflow.**

## Copy audit (D-03) — strings touched

- `package.json` — `viewsWelcome` Setup / outline welcome text (folder + `manuscript/` framing).
- `src/extension.ts` — proactive init prompt (workspace/folder wording).
- `src/initialize.ts` — user-facing messages aligned with manuscript path expectations where shown.

## Performance

- **Tasks:** 2
- **Tests:** `npm run build:test && npm test` — 139 pass.

## Self-Check: PASSED

- `rg -ni "leanquill directory" package.json src/initialize.ts src/extension.ts` — no matches.
- `rg -n "Open a workspace containing your manuscript folder or Book\\.txt" package.json` — no matches.

---

_Phase: 13-leanpub-workspace-initialization_
