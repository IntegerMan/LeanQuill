---
phase: 08-issue-capture-triage-and-editor-signals
verified: 2026-04-11T02:06:53Z
status: passed
score: 5/5 must-haves verified
re_verification: false
---

# Phase 8: Issue Capture, Triage, and Editor Signals Verification Report

**Phase goal:** Author can capture editorial and research concerns, triage them over time, and resolve them in-context inside the editor.

**Verified:** 2026-04-11T02:06:53Z

**Status:** passed

**Re-verification:** No — initial verification (no prior `*-VERIFICATION.md` in this phase directory).

## Goal achievement

### Observable truths (from ROADMAP success criteria)

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Author can create issue records manually (chapter-attached or project-wide) using the full issue schema | ✓ VERIFIED | `createOpenQuestion` / store paths under `.leanquill/issues/<type>/`; D-14 flow in `planningPanel.ts` (`openQuestion:new-question`, `_createNewIssueFromPanel`); round-trip tests in `test/openQuestionStore.test.ts` (chapter, book-wide, entity, selection + `span_hint`). Bottom panel parity in `openQuestionsPanel.ts`. |
| 2 | Author can triage as open, deferred, or dismissed (optional rationale); status reflects immediately | ✓ VERIFIED | `openQuestion:saveDetail`, `openQuestion:dismiss`, `_dismissOpenQuestion`; dismissed + `dismissed_reason` in store tests (`ISSUE-02` case); host re-renders via `_renderPanel` / `refresh` after handlers. |
| 3 | Issue views filterable by open, deferred, dismissed, or all (plus **Active** = open + deferred per D-06) | ✓ VERIFIED | `matchesIssueFilter` in `src/issueFilters.ts` + tests; `openQuestion:setFilter` with allowed `active\|open\|deferred\|dismissed\|all` in `planningPanel.ts`; `openQuestionsHtml.ts` posts `openQuestion:setFilter`; filter persisted `leanquill.issueListFilter`. |
| 4 | Issues with valid `span_hint` show gutter indicators in the manuscript editor | ✓ VERIFIED | `IssueGutterController`: `createTextEditorDecorationType`, `resolveSpanHintInDocument`, `listOpenQuestions`; registered command `leanquill.issuesAtCursor` in `package.json` + `issueGutterController.ts`. D-13 behavior covered in `test/spanHintResolve.test.ts`. **Note:** Gutter glyph click is intentionally not implemented (D-12: command + hover links per `08-05-SUMMARY.md`) — matches documented spike outcome, not a silent stub. |
| 5 | PLAN-03: research-linked issues appear in the same triage lists (associations, not a separate type) | ✓ VERIFIED | `lq_research_file` round-trip in `openQuestionStore.ts` / tests; `extension.ts` resolves research paths for open-in-editor; thread label `· N Issues` in `planningPanelHtml.ts`; research tree counts in `researchTree.ts`. |

**Score:** 5/5 truths verified at code + test level.

### Required artifacts (representative)

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `src/issueFilters.ts` | Shared filter predicates | ✓ | Used by planning host + tests. |
| `src/issueMigration.ts` | v3 migration + marker constant | ✓ | `MIGRATION_V3_MARKER_FILENAME`; migration tests in `test/issueMigration.test.ts`. |
| `src/spanHintResolve.ts` | Bounded span resolution | ✓ | Implemented; D-13 tests enabled. |
| `src/openQuestionStore.ts` | Multi-folder issues + CRUD | ✓ | `LEANQUILL_ISSUES_DIR`, associations including research. |
| `src/openQuestionsHtml.ts` | Master–detail + filter UI | ✓ | `Active issues`, `No issues match this filter.`, `openQuestion:setFilter`. |
| `src/planningPanel.ts` | Message routing + create/dismiss/save | ✓ | `listOpenQuestions`, `matchesIssueFilter`, cases listed above. |
| `src/openQuestionsPanel.ts` | Dual-host parity | ✓ | Same `openQuestion:*` branches. |
| `src/chapterTree.ts` | D-09 copy | ✓ | `` `${count} Issues` ``. |
| `src/issueGutterController.ts` | Gutter + cursor command | ✓ | Decorations, debounce, QuickPick path. |
| `src/extension.ts` | Migrate → then providers; issues watcher | ✓ | `await migrateIssuesLayoutV3IfNeeded` before tree/webview construction; `.leanquill/issues/**/*.md` watcher → `refreshOpenQuestionSurfaces` + native trees. |
| `.leanquill/issues/.migration-v3-complete.json` | Runtime idempotency marker | ✓ (runtime) | Not committed to repo; created by migration — **expected**. |

### Key link verification

`gsd-tools verify key-links` on `08-01` … `08-05` **plans:** all link checks **verified** (tests → `issueFilters` / `spanHintResolve`; `extension` → `issueMigration`; `openQuestionStore` → `spanHintResolve`; planning/panel → store; `characterTree` → store; gutter → store + `spanHintResolve`).

### Data-flow trace (level 4)

| Artifact | Data variable / flow | Source | Real data | Status |
| -------- | --------------------- | ------ | --------- | ------ |
| Issues webviews | Serialized rows | `listOpenQuestions` + `matchesIssueFilter` | FS-backed `.leanquill/issues/**/*.md` | ✓ FLOWING |
| Gutter decorations | Active selection-anchored issues + `resolveSpanHintInDocument` | `listOpenQuestions` + open document text | Same store + live editor text | ✓ FLOWING |
| Sidebar / outline counts | Per-chapter / entity counts | `countActiveIssuesByChapter`, `countActiveQuestionsLinkedToEntity` | Derived from `listOpenQuestions` | ✓ FLOWING |

### Behavioral spot-checks (automated)

| Step | Command | Result | Status |
| ---- | ------- | ------ | ------ |
| Extension bundle | `npm run build` | Success (esbuild `dist/extension.js`) | ✓ PASS |
| Test bundle | `npm run build:test` | Success (`dist-test/*.js`) | ✓ PASS |
| Full suite | `npm test` (`node --test dist-test/**/*.test.js`) | **218 pass, 0 fail** | ✓ PASS |

### `gsd-tools verify artifacts` (plan frontmatter vs repo)

| Plan | Result | Notes |
| ---- | ------ | ----- |
| 08-01 | `all_passed: false` | Still expects `STUB: Phase 08-02 implements` in `spanHintResolve.ts` / `issueMigration.ts` — **obsolete** after 08-02; files are fully implemented. |
| 08-02 | `all_passed: false` | Expects committed `.leanquill/issues/.migration-v3-complete.json` — **runtime artifact**, not source. |
| 08-03 … 08-05 | `all_passed: true` | — |

These are **plan-document / tooling expectations**, not regressions against the phase goal.

### Requirements coverage

| ID | Description (abbrev.) | Plans claiming | Status | Evidence |
| -- | ---------------------- | -------------- | ------ | -------- |
| **PLAN-03** | Research discoveries as issue records in triage | 08-01–03, 08-05 | ✓ SATISFIED | `lq_research_file` serialization + tests; UI/editor paths. REQUIREMENTS checklist: Complete. |
| **ISSUE-01** | Manual create, chapter or project-wide | 08-01–05 | ✓ SATISFIED (Phase 8 scope) | Store + dual-host UI + gutter/list consumers. REQUIREMENTS table still says **Partial** (footnote vs Phase 14); **implementation matches Phase 8 goal and success criterion 1.** |
| **ISSUE-02** | Triage + dismiss + rationale | 08-01–03 | ✓ SATISFIED (Phase 8 scope) | Dismiss handler, frontmatter round-trip tests. REQUIREMENTS table **Partial** — same documentation nuance as ISSUE-01. |
| **ISSUE-03** | Filter by status | 08-01, 03, 04 | ✓ SATISFIED | Filters + sidebar/outline alignment. |
| **ISSUE-04** | Gutter indicators for `span_hint` | 08-01, 05 | ✓ SATISFIED | Controller + command + resolver tests. |

**Orphaned requirements:** None found for Phase 8 — every `ISSUE-*` / `PLAN-03` row referenced in phase artifacts appears in at least one plan `requirements` block.

### Anti-patterns scan

Targeted grep on `issueGutterController.ts`, `openQuestionsHtml.ts`, `planningPanel.ts` (Phase 8–heavy paths): no `TODO`/`FIXME`/`STUB` issue markers; `placeHolder` in QuickPick is API usage, not a stub.

### Human verification (VS Code extension UX)

Automated checks do not replace editor UX validation. Recommended manual passes:

1. **Issues tab + bottom panel parity**  
   **Test:** Open Planning **Issues** and the Open Questions panel; change filter (Active / Open / Deferred / Dismissed / All), refresh, select rows.  
   **Expected:** Same filter behavior and row sets on both surfaces; empty state copy matches spec.  
   **Why human:** Webview layout, spacing, and theme contrast are visual.

2. **Create → triage → dismiss**  
   **Test:** **New issue** (title then type), attach to chapter or book-wide; change status; dismiss with optional reason; confirm file under `.leanquill/issues/<type>/`.  
   **Expected:** Immediate list update; frontmatter matches selections.  
   **Why human:** End-to-end confirmation of message protocol + `SafeFileSystem` in real workspace.

3. **Gutter + Issues at cursor**  
   **Test:** Open a manuscript chapter with an active issue that has a resolvable `span_hint`; observe gutter icon; move cursor to line; run **LeanQuill: Issues at cursor** (single vs multiple matches).  
   **Expected:** Decoration on correct lines; command opens issue file or QuickPick; stale hints use muted decoration if present.  
   **Why human:** VS Code decoration rendering and theme interaction.

4. **Sidebar / outline counts**  
   **Test:** Chapters, Characters, Places, Research trees and outline webview with linked active issues.  
   **Expected:** `N Issues` / ` · N Issues` matches triage **Active** semantics (open + deferred).  
   **Why human:** Tree description rendering and refresh timing.

5. **Research-associated row**  
   **Test:** Issue with `lq_research_file` appears in list with basename chip; open file command works.  
   **Expected:** No separate “research question” type; row behaves like other issues.  
   **Why human:** Copy and chip presentation.

### Gaps summary

**No implementation gaps** blocking the Phase 8 goal. Residual items are **recommended human UAT** (above) and **optional cleanup**: refresh 08-01 plan `must_haves` (remove STUB pattern requirement) and 08-02 artifact entry for the migration marker (document as runtime-only) so `gsd-tools verify artifacts` matches post–Phase 8 reality.

---

_Verified: 2026-04-11T02:06:53Z_

_Verifier: Claude (gsd-verifier)_
