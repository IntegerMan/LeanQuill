---
phase: 13-leanpub-workspace-initialization
plan: "02"
subsystem: extension
tags: [vscode, context-keys, viewsWelcome, onboarding]

requires:
  - phase: 13-01
    provides: validateProjectYamlForSetup
provides:
  - Declarative readiness keys for Setup and feature views
affects:
  - 13-03 initialize wiring

tech-stack:
  added: []
  patterns:
    - "workspaceLeanQuillReady = valid yaml ∧ manuscript ∧ Book.txt"

key-files:
  created: []
  modified:
    - src/extension.ts
    - package.json

key-decisions:
  - "setupNeedsAttention is the single negated-ready flag for welcome copy"
  - "Feature views and title-bar actions gate on workspaceLeanQuillReady, not yaml file existence alone"

patterns-established:
  - "One read of project.yaml per context refresh for validation"

requirements-completed: [INIT-01, INIT-02]

duration: 25min
completed: 2026-04-08
---

# Phase 13 Plan 02: Setup context keys and viewsWelcome

**Declarative `setContext` keys (`projectYamlValid`, `manuscriptScaffoldComplete`, `workspaceLeanQuillReady`, `setupNeedsAttention`) drive Setup and sidebar welcome text so incomplete LeanPub layout still shows an Initialize path.**

## Performance

- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Extended `setWorkspaceContext` with YAML validation via `validateProjectYamlForSetup` and manuscript scaffold completeness.
- Reworked `viewsWelcome` and view/menu `when` clauses to use readiness keys instead of `leanquill.isInitialized` alone.

## Files Created/Modified

- `src/extension.ts` — context computation from disk + validation.
- `package.json` — Setup copy (any-folder framing), outline/research/characters gates.

## Self-Check: PASSED

- `npm run build` succeeds; `package.json` parses as JSON.

---

_Phase: 13-leanpub-workspace-initialization_
