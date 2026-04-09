---
status: complete
phase: 13-leanpub-workspace-initialization
source:
  - 13-01-SUMMARY.md
  - 13-02-SUMMARY.md
  - 13-03-SUMMARY.md
  - 13-04-SUMMARY.md
started: "2026-04-09T00:00:00.000Z"
updated: "2026-04-09T12:00:00.000Z"
---

## Current Test

[testing complete]

## Tests

### 1. Sidebar initialize when manuscript scaffold is missing
expected: Setup/sidebar shows clear initialize affordance when manuscript scaffold is incomplete; you can start init from there.
result: pass

### 2. Scaffold creates manuscript, Book.txt, and placeholder chapter
expected: After initialization completes, manuscript/ exists, manuscript/Book.txt exists and lists at least one chapter line, and the referenced chapter file exists under manuscript/ with content consistent with a new placeholder chapter; order in Book.txt matches the file you see.
result: pass

### 3. Valid project.yaml without scaffold — non-destructive extension
expected: In a folder that already has a valid project.yaml but still lacks manuscript scaffold, running initialize adds manuscript/Book.txt and chapters without prompting to overwrite or wipe your existing project.yaml (scaffold-only / extend layout behavior).
result: pass

### 4. After successful init, Planning opens on Cards
expected: When initialization succeeds, the Planning workspace opens with the Cards tab (or notecard/planning cards view) active rather than leaving you on project.yaml or a generic default unrelated to cards.
result: pass

### 5. Writes stay within expected manuscript boundaries
expected: After init, new or modified manuscript-related files appear only under the configured manuscript path (e.g. manuscript/ and Book.txt there); you do not see unexpected new files at repo root or other disallowed locations from this flow alone.
result: pass

## Summary

total: 5
passed: 5
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[none]
