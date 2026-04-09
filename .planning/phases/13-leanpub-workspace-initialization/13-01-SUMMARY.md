---
phase: 13-leanpub-workspace-initialization
plan: "01"
subsystem: extension
tags: [typescript, leanpub, manuscript, project-yaml, safe-filesystem]

requires:
  - phase: 01-foundation-and-safe-init
    provides: SafeFileSystem boundaries, init patterns
provides:
  - validateProjectYamlForSetup for Setup eligibility (D-02)
  - applyLeanpubManuscriptScaffold and related helpers (D-07, D-09–D-12, D-18)
affects:
  - 13-02 orchestration wiring
  - 13-04 tests

tech-stack:
  added: []
  patterns:
    - "Create-only scaffold with discriminated result (noop | success | blocked)"
    - "Optional SafeFileSystem for Book.txt only; path.relative guard for chapter writes"

key-files:
  created:
    - src/leanpubScaffold.ts
  modified:
    - src/projectConfig.ts

key-decisions:
  - "No new YAML dependency; validation uses regex + existing parseProjectConfig for schema_version"
  - "D-18 blocked path returns before any mkdir/write so filesystem stays unchanged"

patterns-established:
  - "Book.txt active-line semantics shared with resolveChapterOrder (trim, skip # and part:)"
  - "Default chapter detection: basename ch1 case-insensitively, emit actual on-disk name in new Book.txt line"

requirements-completed: [INIT-02]

duration: 12min
completed: 2026-04-08
---

# Phase 13 Plan 01: LeanPub scaffold helpers Summary

**Setup-oriented `project.yaml` validation plus create-only manuscript scaffold (`Book.txt` + default chapter) with a hard D-18 blocked path when an existing Book.txt omits the on-disk default chapter.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-04-08T00:00:00Z (approximate)
- **Completed:** 2026-04-08T00:15:00Z (approximate)
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Exported `validateProjectYamlForSetup` with empty-file, `schema_version` 1|2, required `project_id` / `working_title` lines, and `folders.manuscript` when a `folders:` block is present.
- Added `leanpubScaffold.ts` with `findDefaultChapterBasename`, `readBookTxtLinesIfExists`, `chapterListedInBookTxt`, and `applyLeanpubManuscriptScaffold` (optional `safeFs` for `Book.txt` only; raw `fs` for chapter after manuscript path guard).
- Preserved D-05: no broad `manuscript/**/*.md` allowlist in `SafeFileSystem`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Export project.yaml validation for Setup (D-02)** - `c04b432` (feat)
2. **Task 2: leanpubScaffold module — plan, apply, D-09–D-12, D-18 blocked path** - `daf9bba` (feat)

**Plan metadata:** `docs(13-01): complete leanpub scaffold helpers plan` (SUMMARY, STATE, ROADMAP, REQUIREMENTS)

## Files Created/Modified

- `src/projectConfig.ts` — `ProjectYamlSetupValidation`, `validateProjectYamlForSetup`.
- `src/leanpubScaffold.ts` — scaffold plan/apply API, exported result/options types.

## Decisions Made

- Reused `parseProjectConfig` for `schema_version` extraction; added line-based checks for identity fields and conditional `folders.manuscript` without a YAML parser.
- Documented that callers omitting `safeFs` must still respect the same write boundary as `SafeFileSystem` for `manuscript/Book.txt`.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- `npx tsc --noEmit` fails on pre-existing `rootDir` vs `test/` layout in `tsconfig.json`; verification used `npm run build` as specified in the plan.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 13-02 can import `validateProjectYamlForSetup` and `applyLeanpubManuscriptScaffold` from dedicated modules.
- Integration tests in 13-04 can target temp directories per the plan.

---

_Phase: 13-leanpub-workspace-initialization_

_Completed: 2026-04-08_

## Self-Check: PASSED

- `FOUND: src/leanpubScaffold.ts`
- Task commits `c04b432`, `daf9bba` and docs commit with message `docs(13-01): complete leanpub scaffold helpers plan` present (`git log --oneline`).
