---
phase: 03-outline-and-beat-planning
plan: 01
subsystem: data-model
tags: [outline, beats, json-persistence, book-txt, tdd]

requires:
  - phase: 02-core-chapter-workflow
    provides: SafeFileSystem, ChapterOrderResult types, chapter-status read/write pattern

provides:
  - OutlineIndex, OutlinePart, OutlineChapter, OutlineBeat type definitions
  - Outline read/write/normalize/bootstrap via outlineStore.ts
  - Book.txt generation from outline and external edit detection via bookTxtSync.ts

affects: [03-02 outline tree, 03-03 planning panel, 03-04 integration wiring]

tech-stack:
  added: []
  patterns: [outline-index.json read/normalize/write pattern mirroring chapter-status-index.json]

key-files:
  created: [src/outlineStore.ts, src/bookTxtSync.ts, test/outlineStore.test.ts, test/bookTxtSync.test.ts]
  modified: [src/types.ts]

key-decisions:
  - "crypto.randomUUID() for ID generation (Node.js built-in, no external deps)"
  - "Book.txt writes use raw fs.writeFile (not SafeFileSystem) since Book.txt is a root-level project config file"
  - "Single part omits 'part:' line in Book.txt (LeanPub only needs it for multi-part books)"
  - "normalizeOutlineIndex defaults active to true for all node types"

patterns-established:
  - "Outline persistence: readOutlineIndex/writeOutlineIndex following same pattern as chapterStatus"
  - "Bootstrap pattern: bootstrapOutline creates default structure from chapter paths"
  - "Book.txt sync: generateBookTxt is pure, writeBookTxt/detectExternalBookTxtEdit handle I/O"

requirements-completed: [PLAN-01, PLAN-02]

duration: 8min
completed: 2026-03-30
---

# Plan 03-01: Outline Data Model & Persistence Summary

**Established outline type system and JSON persistence layer with bootstrapping and Book.txt sync**

## Performance

- **Duration:** ~8 min
- **Tasks:** 2 completed
- **Files modified:** 5

## Accomplishments
- Defined OutlineBeat, OutlineChapter, OutlinePart, OutlineIndex types in types.ts
- Created outlineStore.ts with read/write/normalize/bootstrap functions following established patterns
- Created bookTxtSync.ts with LeanPub-format Book.txt generation and external edit detection
- Full TDD coverage: 17 tests across both modules, all passing

## Task Commits

1. **Task 1: Define outline types and create outline persistence module** - `5db0e83` (feat)
2. **Task 2: Create Book.txt sync module** - `449f41c` (feat)

## Files Created/Modified
- `src/types.ts` - Extended with OutlineBeat, OutlineChapter, OutlinePart, OutlineIndex interfaces
- `src/outlineStore.ts` - Outline read/write/normalize/bootstrap with SafeFileSystem integration
- `src/bookTxtSync.ts` - Book.txt generation (LeanPub part: format), read, write, external edit detection
- `test/outlineStore.test.ts` - 8 tests covering read/write/normalize/bootstrap
- `test/bookTxtSync.test.ts` - 9 tests covering generation, filtering, external edit detection

## Decisions Made
- Used crypto.randomUUID() for ID generation (built-in, no deps needed)
- Book.txt uses raw fs.writeFile since it's a root-level file outside SafeFileSystem boundary
- Single-part books omit the `part:` line (LeanPub convention)
- Normalize defaults `active: true` for all node types (per D-16, D-23)

## Deviations from Plan
None - plan executed exactly as written

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Type contracts established: OutlineIndex, OutlinePart, OutlineChapter, OutlineBeat
- Persistence API ready: readOutlineIndex, writeOutlineIndex, bootstrapOutline, normalizeOutlineIndex
- Book.txt sync API ready: generateBookTxt, writeBookTxt, readBookTxt, detectExternalBookTxtEdit
- Plans 03-02 (tree), 03-03 (webview), and 03-04 (wiring) can proceed

---
*Phase: 03-outline-and-beat-planning*
*Completed: 2026-03-30*
