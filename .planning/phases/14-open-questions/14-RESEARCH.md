# Phase 14: Open Questions - Research

**Researched:** 2026-04-10  
**Domain:** VS Code extension (webview + panel views), local-first markdown/YAML persistence, issue-shaped author notes  
**Confidence:** HIGH (stack anchored in repo + official VS Code API docs via Context7)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

From **Implementation Decisions** (`14-CONTEXT.md`):

- **D-01:** The consolidated open-questions experience lives in the **Planning workspace** (dedicated tab or equivalent) as the main place for list + create/edit.
- **D-02:** A **second surface** in the **bottom panel** (same VS Code region as Problems / Output / Terminal — not a new custom window). Reuse the **same list/detail visuals and interaction patterns** as the planning view where practical (shared markup, styles, and/or webview message protocol so the two hosts do not diverge).
- **D-03:** In Phase 14, **chapter tree `openIssueCount`** must reflect **open** questions **linked to that chapter** (chapter file and/or selection within that file). Keep semantics aligned with whatever status values mean “open” for this phase.
- **D-04:** **Context-first authoring:** The primary way to create a question with an association is **from context** — commands and/or **right-click** on the chapter tree, manuscript editor selection, and planning rows for characters / places / threads (and book-level entry point as needed). The flow **pre-fills** the association; the author completes title/body/status in the question UI. (Adjusting association after the fact may use inline pickers — planner’s discretion as long as context-first creation stays first-class.)
- **D-05:** **Claude’s discretion:** Choose the **minimal** representation for linking a question to a **text selection** that stays **compatible with the Phase 8 issue model** and the existing contract in `Imported/data-contracts/issue-schema.md` (e.g. `chapter_ref` + `span_hint` pattern vs. other anchors). Document the chosen approach in the phase plan. If the fragment cannot be found or is ambiguous, navigation must **degrade gracefully** (e.g. open the chapter and surface a stale-link state) — exact UX is discretion.

### Claude's Discretion

- Panel view registration details (view id, when to reveal, default visibility).
- Whether association can be changed from the question form only vs. also from entity rows.
- Exact status enum for Phase 14 vs. full issue schema (must satisfy roadmap: open / resolved / deferred at minimum; map to or subset of contract statuses).
- File layout under `.leanquill/` (single folder vs. index file) as long as it git-diffs cleanly and matches Phase 8 direction.
- Loading, empty states, and error copy.

### Deferred Ideas (OUT OF SCOPE)

- Full issue capture, triage filters, dismissed state, gutter `span_hint` decorations, AI session issues — Phase 8 and later per roadmap.
- “Research-question” issue type — explicitly out of scope for Phase 14 per roadmap notes.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ISSUE-01 (partial) | Author can manually create an issue attached to a chapter or project-wide, using the full issue schema (type, title, description, optional `span_hint`) | Phase 14 scopes to **author-created** records only: use contract fields from `issue-schema.md` as baseline (`type: author-note`, `chapter_ref`, optional `span_hint`, `title`, `body`, statuses). Extend persistence with **explicit association fields** for character / place / thread / book-wide (not in v1 issue-schema text — plan must document extension keys and Phase-8 merge path). |
| ISSUE-02 (partial) | Author can triage any issue: open, dismiss (hidden), defer | Phase 14 success criteria: **open / resolved / deferred** only — **no dismissed** workflow, no “default view” filtering (ISSUE-03) in this phase. Map statuses to contract values: `open`, `deferred`, `resolved` (`dismissed` unused in Phase 14). |
</phase_requirements>

## Summary

Phase 14 adds **local-first open-question records** with rich associations (book, character, thread, place, chapter file, text selection) and surfaces them in **two hosts**: the existing **Planning Workspace** webview (`PlanningPanelProvider` + `renderPlanningHtml`) and a **Panel-area webview view** (Problems/Output region). The codebase already proves webview messaging, debounced saves, and markdown+YAML CRUD (`characterStore`, `placeStore`, `threadStore`). **Chapter `openIssueCount`** today is read from `.leanquill/chapter-status-index.json` but is not fed by real issues; Phase 14 must **compute or sync** counts for chapter-linked **open** questions and refresh the chapter tree + Chapter Context pane.

**Primary recommendation:** Implement a dedicated **`openQuestionStore`** (or `issueStore` limited to `author-note`) under `.leanquill/`, reuse **issue-schema-shaped frontmatter** plus **small extension fields** for entity links; add **one shared HTML/CSS/message-protocol module** consumed by both the Planning tab renderer and a **`WebviewViewProvider`** registered for a **panel** `viewsContainer`; wire **context menus + commands** for context-first creation; on navigation, use **`window.showTextDocument`** with **`selection`** when the span resolves, else open chapter and show stale state in UI.

## Project Constraints (from .cursor/rules/)

**None —** `.cursor/rules/` is empty for this workspace; comply with `.planning/PROJECT.md` (manuscript immutability, local-first `.leanquill/`, VS Code API only, no external AI HTTP).

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| VS Code Extension API | engine `^1.90.0` (see `@types/vscode` below) | Webviews, views, commands, editor APIs | Product target; official extension model |
| TypeScript | `^5.8.3` in repo (npm latest **6.0.2** as of 2026-04-10) | Type-safe extension code | Already project standard |
| esbuild | `^0.25.3` in repo (npm latest **0.28.0**) | Bundle `src/extension.ts` | Existing build pipeline |
| `@types/vscode` | `^1.90.0` in repo (npm latest **1.115.0**) | API typings | Matches extension development practice |
| Node `node:test` | (Node runtime shipping with dev environment) | Unit tests | Already used in `test/*.test.ts` |

### Supporting

| Library | Purpose | When to Use |
|---------|---------|-------------|
| `@vscode/codicons` | Icons in HTML webviews | Match existing planning webview |
| `SafeFileSystem` | Writes under `.leanquill/` | All persisted question files (already allows full `.leanquill/` tree) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Panel `WebviewView` | Second `createWebviewPanel` in bottom area | VS Code does not support docking arbitrary panels in the bottom region — **panel `viewsContainers` is the supported pattern** (Context7: extension guides / contribution points). |
| SQLite / JSON index | Markdown files only | Conflicts with git-diffable project philosophy (`PROJECT.md`); thread/character/place already use markdown. |

**Installation:** No new runtime dependencies required for MVP; optional YAML library only if team abandons hand-parsed frontmatter (not recommended — match existing stores).

**Version verification:** Registry check 2026-04-10: `typescript@6.0.2`, `esbuild@0.28.0`, `@types/vscode@1.115.0`. **Pin** versions in plans to what `package.json` uses unless a deliberate upgrade task is included.

## Architecture Patterns

### Recommended module layout

```
src/
├── openQuestionStore.ts      # list/create/save/delete, parse/serialize markdown+YAML
├── openQuestionsHtml.ts      # shared list/detail markup + embedded styles (or shared partials)
├── openQuestionsPanel.ts     # WebviewViewProvider for panel bottom
├── planningPanel.ts          # + tab + message handlers (delegate to store)
├── planningPanelHtml.ts      # + tab button + panel body (or import from openQuestionsHtml)
├── extension.ts              # register provider, commands, menus, refresh hooks
└── types.ts                  # OpenQuestionRecord, association discriminated union
```

### Pattern 1: Panel bottom webview (WebviewView)

**What:** Contribute `viewsContainers.panel` and attach a webview view with `registerWebviewViewProvider`; use `webviewOptions.retainContextWhenHidden` like the main planning panel.

**When to use:** D-02 requires the **same region as Problems/Output/Terminal** — this is the documented approach.

**Example:**

```typescript
// Source: https://code.visualstudio.com/api/references/vscode-api (Context7 /websites/code_visualstudio_api)
context.subscriptions.push(
  vscode.window.registerWebviewViewProvider(
    OpenQuestionsPanelViewProvider.viewId,
    provider,
    { webviewOptions: { retainContextWhenHidden: true } },
  ),
);
```

**package.json:** Mirror the `viewsContainers.panel` + `views.<containerId>` pattern from [Tree View extension guide](https://code.visualstudio.com/api/extension-guides/tree-view#view-container-in-panel).

### Pattern 2: Shared UI + protocol

**What:** One module builds HTML/CSS for list + detail; both hosts call it with `(questions, selectedId, nonce, cspSource, host: 'planning' | 'panel')`. Message types prefixed `openQuestion:*` handled by a **single** handler class or shared functions called from `PlanningPanelProvider` and the panel provider.

**When to use:** D-02 explicitly forbids divergent visuals.

**Anti-patterns to avoid:** Copy-pasting the Characters tab script block — leads to drift; **extract** shared JS for open-questions or inject a small shared `<script>` string from one builder.

### Pattern 3: Context-first commands

**What:** Commands receive pre-filled association from `when` clauses + `editor.selection` / tree `TreeItem` handle / webview message context.

**When to use:** D-04.

**Editor selection capture:** Subscribe to `window.activeTextEditor` / `onDidChangeTextEditorSelection` only as needed; at command execution read `editor.document.uri`, `editor.selection`, and verify document is under configured manuscript roots (reuse chapter path normalization from `chapterTree` / `chapterOrder`).

### Pattern 4: Navigation to manuscript anchor

**What:** Resolve `chapter_ref` (relative path) + optional `span_hint` per `issue-schema.md`. Search fragment in file; on success open with selection; on failure open file and flag stale link in webview.

**Example:**

```typescript
// Source: https://code.visualstudio.com/api/references/vscode-api (Context7 /websites/code_visualstudio_api)
const editor = await vscode.window.showTextDocument(document, {
  selection: new vscode.Range(start, end),
});
// Optional: editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
```

### Anti-patterns to avoid

- **Writing `openIssueCount` only in JSON without a source-of-truth scan:** Drifts from question files; either **derive counts when building chapter rows** or **recompute on every question mutation** (see pitfall below).
- **Using `writeChapterStatusEntry` without preserving counts:** Current implementation resets `openIssueCount` to `0` on status writes — see Pitfalls.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Bottom auxiliary window | Custom Electron window | Panel `WebviewView` | VS Code UX consistency; API support |
| Ad-hoc issue format | New JSON schema unrelated to `issue-schema.md` | `author-note` + contract fields + documented extension keys | Phase 8 merge and AI/session issues expect one model |
| Character position anchors only | Brittle offsets | `chapter_ref` + `span_hint` (quoted fragment) per contract | Matches existing contract; survives simple edits better than raw offsets (still fragile — plan graceful degradation) |
| Custom CSP/security | Inline without nonce | Same CSP pattern as `planningPanelHtml` (`nonce-`, `cspSource`) | Security baseline for webviews |

**Key insight:** The extension already owns the **authoring workflow patterns** (debounced field saves, list/detail split); extend them rather than inventing a second UI stack.

## Common Pitfalls

### Pitfall 1: `openIssueCount` reset on chapter status update

**What goes wrong:** `writeChapterStatusEntry` always writes `openIssueCount: 0` when persisting status changes (`src/chapterStatus.ts`), clobbering real counts.

**Why it happens:** Phase 2 placeholder semantics.

**How to avoid:** Planner should specify either **(A)** preserve existing `openIssueCount` in `writeChapterStatusEntry` and update counts via dedicated helpers, or **(B)** stop persisting counts and **derive** counts dynamically from question files when building `ChapterStatusIndex` / tree rows.

**Warning signs:** Chapter tree shows `0 issues` immediately after author changes chapter status.

### Pitfall 2: Duplicate webview logic diverging

**What goes wrong:** Planning tab and panel implement separate copy-pasted HTML/JS.

**Why it happens:** Fast implementation without extraction.

**How to avoid:** Shared render + message router module (D-02).

**Warning signs:** Bug fixed in one surface but not the other.

### Pitfall 3: `span_hint` false positives

**What goes wrong:** Substring search matches wrong occurrence after edits.

**Why it happens:** Contract uses fragment, not unique IDs.

**How to avoid:** Search first exact match; if multiple, pick first + mark **ambiguous** in UI; if none, **stale**. Document in PLAN.

**Warning signs:** Selection jumps to wrong paragraph.

### Pitfall 4: Manuscript path normalization

**What goes wrong:** `chapter_ref` stored with backslashes or wrong relativity; chapter tree uses forward slashes (`chapterTree.normalizeChapterPath`).

**Why it happens:** Windows paths vs git-style paths.

**How to avoid:** Normalize to repo-relative forward slashes on write and read (same as `threadStore` / `chapterStatus`).

### Pitfall 5: Context menu scope

**What goes wrong:** “New open question” appears on non-manuscript editors or wrong tree items.

**Why it happens:** Over-broad `when` clauses.

**How to avoid:** Tie manuscript commands to `resourceExtname` / workspace relative path checks consistent with SafeFileSystem manuscript read rules; use `viewItem` context for chapter tree contributions.

## Code Examples

### Register panel container (contribution outline)

```json
// Source: https://code.visualstudio.com/api/extension-guides/tree-view (Context7)
"viewsContainers": {
  "panel": [{ "id": "leanquillOpenQuestions", "title": "LeanQuill", "icon": "media/leanquill.svg" }]
},
"views": {
  "leanquillOpenQuestions": [
    { "id": "leanquill.openQuestionsPanel", "name": "Open Questions", "type": "webview" }
  ]
}
```

### Show document with selection

```typescript
// Source: https://code.visualstudio.com/api/references/vscode-api (Context7)
await vscode.window.showTextDocument(doc, { selection: range });
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single webview host | Planning editor tab + panel webview views | VS Code 1.x+ view APIs | Phase 14 bottom panel must use **WebviewView**, not ad-hoc window |
| Issue count placeholder | Derived/synced from real question records | Phase 14 | Chapter UX becomes truthful |

**Deprecated/outdated:** N/A for this phase.

## Open Questions

1. **Exact storage path and file naming**
   - What we know: Must live under `.leanquill/`, git-clean, SafeFileSystem-compatible.
   - What's unclear: Single file vs one-file-per-question vs subfolder per chapter.
   - Recommendation: Default **one markdown file per question** under e.g. `.leanquill/open-questions/` for merge-friendly diffs (aligns with session issue files pattern in `issue-schema.md` storage narrative).

2. **Book-level vs `Book.txt` row**
   - What we know: Tree has a synthetic `Book.txt` book node.
   - What's unclear: Whether book-wide questions increment that row’s `openIssueCount`.
   - Recommendation: Treat **book-wide** as separate from per-chapter counts unless product wants aggregate on book node — document in PLAN (D-03 speaks to **chapter** linkage only).

## Environment Availability

**Step 2.6:** SKIPPED — phase is implementable with existing Node + VS Code extension toolchain; no new external services or databases.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | `npm run build`, `npm test` | ✓ (assumed) | — | — |
| VS Code / Cursor | Manual UAT, webview debugging | ✓ (assumed) | ≥ 1.90 | — |

## Validation Architecture

> `workflow.nyquist_validation` is **true** in `.planning/config.json` — section included.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node.js built-in `node:test` + `node:assert/strict` |
| Config file | none — conventions in `test/*.test.ts` |
| Quick run command | `npm run build:test && node --test dist-test/<file>.test.js` |
| Full suite command | `npm run build:test && npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| ISSUE-01 (partial) | Parse/serialize open-question markdown; `chapter_ref` + optional `span_hint`; entity association fields round-trip | unit | `npm run build:test && node --test dist-test/openQuestionStore.test.js -x` | ❌ Wave 0 |
| ISSUE-01 (partial) | Normalize chapter paths; classify manuscript vs project-wide | unit | same file / `chapterOrder` integration tests | Partial — reuse patterns from `threadStore.test.ts` |
| ISSUE-02 (partial) | Status transitions only use `open` / `deferred` / `resolved` | unit | `openQuestionStore` or pure function tests | ❌ Wave 0 |
| D-03 | Count open questions per chapter matches list/filter rules | unit | `openQuestionCount.test.ts` | ❌ Wave 0 |
| Integration | `writeChapterStatusEntry` does not clobber counts **or** tree uses derived counts | unit | extend `test/chapterStatus.test.ts` or new test | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npm run build:test && node --test dist-test/<touched>.test.js`
- **Per wave merge:** `npm run build:test && npm test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `test/openQuestionStore.test.ts` — covers ISSUE-01 partial (parse/serialize, associations, statuses)
- [ ] `test/openQuestionChapterCounts.test.ts` (or merged) — covers D-03 counting rules + normalization
- [ ] Adjust `test/chapterStatus.test.ts` if `writeChapterStatusEntry` behavior changes
- [ ] `npm run build` after TS changes — existing CI expectation

## Sources

### Primary (HIGH confidence)

- Context7 `/websites/code_visualstudio_api` — `registerWebviewViewProvider`, `retainContextWhenHidden`, panel `viewsContainers`, `showTextDocument` + `TextDocumentShowOptions.selection`, `Range`/`Selection`
- [VS Code Extension Guides — Webview](https://code.visualstudio.com/api/extension-guides/webview)
- [VS Code Extension Guides — Tree View (panel container)](https://code.visualstudio.com/api/extension-guides/tree-view)
- `Imported/data-contracts/issue-schema.md` — `author-note`, statuses, `chapter_ref`, `span_hint`
- Repo sources: `src/planningPanel.ts`, `src/planningPanelHtml.ts`, `src/chapterStatus.ts`, `src/chapterTree.ts`, `src/characterStore.ts`, `src/threadStore.ts`, `src/safeFileSystem.ts`, `package.json`

### Secondary (MEDIUM confidence)

- npm registry versions (2026-04-10): `typescript@6.0.2`, `esbuild@0.28.0`, `@types/vscode@1.115.0` (project pins older — upgrade is optional)

### Tertiary (LOW confidence)

- None required for core recommendations.

## Metadata

**Confidence breakdown:**

- Standard stack: **HIGH** — matches repository and marketplace extension conventions.
- Architecture: **HIGH** — aligns with CONTEXT D-01–D-02 and official panel webview contributions.
- Pitfalls: **HIGH** — `writeChapterStatusEntry` / `openIssueCount` behavior verified in `src/chapterStatus.ts`.

**Research date:** 2026-04-10  
**Valid until:** ~2026-05-10 (stable APIs); recheck if engine bumps past `^1.90.0`.

---

## RESEARCH COMPLETE

**Phase:** 14 — Open Questions  
**Confidence:** HIGH

### Key Findings

- Bottom-panel surface should be a **panel `WebviewViewProvider`**, not a second editor `WebviewPanel`, to land in the Problems/Output/Terminal region per VS Code contribution model.
- **Reuse** one HTML/CSS/message-protocol builder for Planning tab + panel to satisfy D-02 and avoid drift.
- Persist questions with **`author-note`-shaped frontmatter** plus explicit extension fields for character/place/thread; use **`chapter_ref` + optional `span_hint`** for manuscript selections per `issue-schema.md`, with graceful stale/ambiguous handling.
- **`writeChapterStatusEntry` currently forces `openIssueCount: 0`** — Phase 14 must address this or **derive** counts so D-03 does not regress on status edits.
- **ISSUE-02 partial** in Phase 14 means **open / resolved / deferred** only; **dismissed** and filter views remain Phase 8.

### File Created

`.planning/phases/14-open-questions/14-RESEARCH.md`

### Confidence Assessment

| Area | Level | Reason |
|------|-------|--------|
| Standard stack | HIGH | Matches `package.json` + Context7 VS Code API docs |
| Architecture | HIGH | Panel webview + shared renderer fits CONTEXT and API guides |
| Pitfalls | HIGH | Verified against `chapterStatus.ts` and existing webview patterns |

### Open Questions

- Storage filename/folder convention (recommend one file per question).
- Whether book-wide questions affect the synthetic **Book.txt** tree row count.

### Ready for Planning

Research complete. Planner can now create PLAN.md files.
