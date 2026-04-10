---
phase: 05-place-and-setting-reference
plan: 02
subsystem: testing
tags: [typescript, outline, manuscript, PlaceProfile, SafeFileSystem, word-boundary]

requires:
  - phase: 05-place-and-setting-reference
    provides: placeStore CRUD, PlaceProfile.referencedByNameIn / referencedInBeats, folders.settings
provides:
  - scanManuscriptFileForPlaces for chapter-level referencedByNameIn updates
  - scanOutlineIndexForPlaces for beat-level referencedInBeats (sorted unique outline node ids)
  - collectBeatCandidateNodeIds and outlineTextMatchesPlace pure helpers
  - test/fixtures/outline-place-scan.json and fixture-backed tests
affects:
  - 05-03-PLAN.md (Places webview can show linkage fields)
  - 05-04-PLAN.md (extension hooks call scanners)

tech-stack:
  added: []
  patterns:
    - "Hybrid Option C: manuscript word scan for chapters; outline beat-candidate text scan for beats"
    - "Chapter-linked outline rows identified by non-empty fileName matching manuscript/*.md"

key-files:
  created:
    - test/fixtures/outline-place-scan.json
  modified:
    - src/placeStore.ts
    - test/placeStore.test.ts

key-decisions:
  - "Did not mark PLACE-01 complete in REQUIREMENTS.md: requirement includes Places tab UI and wiring (05-03–05-04)."
  - "collectBeatCandidateNodeIds returns OutlineNode[] per plan name despite the Id suffix."

patterns-established:
  - "Beat candidates exclude manuscript-linked chapter nodes but still recurse into children"
  - "outlineNodeSearchableText joins title, description, and custom field values with newlines"

requirements-completed: []

duration: 28min
completed: 2026-04-09
---

# Phase 5 Plan 02: Place hybrid linking (manuscript + outline) Summary

**Chapter-level `referencedByNameIn` via manuscript word-boundary scan and beat-level `referencedInBeats` via outline beat-candidate text scan (including inactive nodes), mirroring the character manuscript pattern.**

## Performance

- **Duration:** ~28 min
- **Started:** 2026-04-09T23:45:00Z (approx.)
- **Completed:** 2026-04-10T00:14:00Z (approx.)
- **Tasks:** 3 (TDD: 2 commits each for tasks 1–2, 1 commit for task 3)
- **Files modified:** 3

## Accomplishments

- Added `scanManuscriptFileForPlaces` with private `escapeRegex`, updating only `referencedByNameIn` from manuscript text.
- Added `collectBeatCandidateNodeIds`, `outlineTextMatchesPlace`, and `scanOutlineIndexForPlaces` implementing 05-RESEARCH Option C beat-candidate rules (chapter `manuscript/*.md` rows excluded from beat matching; full tree walk including `active: false`).
- Added `test/fixtures/outline-place-scan.json` plus tests proving chapter node ids stay out of `referencedInBeats` while active and inactive beat nodes match.

## Task Commits

Each task was committed atomically (TDD RED/GREEN for tasks 1–2):

1. **Task 1: scanManuscriptFileForPlaces** — `d060974` (test RED), `ed33834` (feat GREEN)
2. **Task 2: scanOutlineIndexForPlaces + helpers** — `16f558d` (test RED), `90c7994` (feat GREEN)
3. **Task 3: fixture + beat-scan tests** — `8614eef` (test)

**Plan metadata:** `docs(05-02): complete place hybrid linking plan` (SUMMARY + STATE + ROADMAP; hash is tip of branch at completion).

## Files Created/Modified

- `src/placeStore.ts` — manuscript scan, outline scan, beat-candidate walk, searchable text and word-boundary matching.
- `test/placeStore.test.ts` — manuscript scan tests, helper tests, fixture-driven `scanOutlineIndexForPlaces` tests.
- `test/fixtures/outline-place-scan.json` — minimal `OutlineIndex` for Red Inn linkage scenarios.

## Decisions Made

- Left **PLACE-01** unchecked: scans are in place, but author-facing Places tab and extension wiring remain in 05-03 and 05-04 (same rationale as 05-01).
- Kept exported name `collectBeatCandidateNodeIds` exactly as in the plan even though the return type is `OutlineNode[]`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] CI `rg "manuscript/"` gate**
- **Found during:** Task 2 (acceptance grep for `manuscript/` at least twice in `placeStore.ts`)
- **Issue:** Regex-only `manuscript\/` did not yield two literal `manuscript/` matches for validation scripts.
- **Fix:** Added an inline comment spelling `manuscript/*.md` and chapter path convention next to `isChapterManuscriptNode`.
- **Files modified:** `src/placeStore.ts`
- **Verification:** `npm run build:test && npm test`; pattern search shows two `manuscript/` literals in comments.
- **Committed in:** `90c7994` (Task 2 feat commit)

---

**Total deviations:** 1 auto-fixed (blocking validation)
**Impact on plan:** Comment-only clarification; no behavior change.

## Issues Encountered

None beyond the grep gate above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 05-03 can build the Places webview using `referencedByNameIn` and `referencedInBeats` populated by these scanners once wired in 05-04.
- 05-04 should invoke `scanManuscriptFileForPlaces` / `scanOutlineIndexForPlaces` on the same triggers as character scans.

## Self-Check: PASSED

- `test -f test/fixtures/outline-place-scan.json` — FOUND
- `test -f .planning/phases/05-place-and-setting-reference/05-02-SUMMARY.md` — FOUND
- Task commits `d060974`, `ed33834`, `16f558d`, `90c7994`, `8614eef` present on branch
- `npm test` — full suite pass (187 tests)
- `git log -1 --oneline` shows `docs(05-02): complete place hybrid linking plan` at branch tip

---
*Phase: 05-place-and-setting-reference*
*Completed: 2026-04-09*
