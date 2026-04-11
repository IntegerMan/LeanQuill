# Phase 8: Issue Capture, Triage, and Editor Signals — Research

**Researched:** 2026-04-10  
**Domain:** VS Code extension (webview + `TextEditorDecorationType`), local markdown issue store under `.leanquill/`, schema migration  
**Confidence:** HIGH (codebase + official VS Code API docs); MEDIUM (migration marker location, gutter click UX details)

## User Constraints (from CONTEXT.md)

### Locked decisions — on-disk layout and migration

- **D-01:** Author issues are stored under **`.leanquill/issues/<issueType>/`**, where `<issueType>` is a **filesystem-safe slug matching the issue’s YAML `type` field** (kebab-case, same family as `Imported/data-contracts/issue-schema.md`). No long-term `.leanquill/open-questions/` directory after migration.
- **D-02:** Legacy Phase 14 content in **`.leanquill/open-questions/`** migrates into the folder for the unified author question type using the slug **`question`** (not the old folder name). **Extend or align the contract** so `question` is a first-class `type` (and map legacy `author-note` / open-question files to `question` on migration) — exact YAML field parity with `issue-schema.md` is for the planner to specify in the migration spec.
- **D-03:** **Schema versioning:** If persisted schema is **`<= 2`**, run a **one-time migration to schema `3`**: rewrite/move files into the correct **`.leanquill/issues/{type}/`** tree, normalize frontmatter, and record that migration completed so it does **not** run again.
- **D-04 (clarifies prior “1c”):** **Out of scope in Phase 8:** AI-generated session files under `.leanquill/issues/sessions/` and the **`master-issues.md`** consolidation rollup described in the issue contract. Those support **Phase 10** AI review workflows. Phase 8 only establishes the **author** capture path, triage UI, and gutter behavior; leave hooks/fields so future phases can populate the same type system.

### Locked decisions — triage, filters, and sidebar counts

- **D-05:** Status set: **`open` | `deferred` | `dismissed` | `resolved`**, with **`dismissed`** distinct from **`resolved`** (dismissed = not pursuing / not applicable). Optional **`dismissed_reason`** on dismiss.
- **D-06:** Default list filter: **`open` + `deferred`**; **dismissed hidden** until user selects a view that includes dismissed (e.g. **All** or **Dismissed**). Apply consistently across **planning** and **bottom-panel** hosts (same semantics as Phase 14 dual surface).
- **D-07:** **Dismiss** from list row and/or commands with **optional rationale** stored in **`dismissed_reason`**; same behavior in both hosts.
- **D-08:** **Chapter Context Pane:** No commitment to keep or extend it in Phase 8 — **treat as discretionary** during planning (may remain minimal, evolve, or later retire). **Do not** rely on the pane as the primary issues surface.
- **D-09:** Show **open issue counts** in the **sidebar trees** (e.g. outline, characters, places, threads — wherever issues associate to those entities). **Label format:** **`X Issues`** (user-facing copy). Phase 8 delivers **counts only** for those trees.
- **D-10:** **Backlog** **999.1** — richer representation than counts (drill-down, rows, actions) in those sidebar trees; see ROADMAP Backlog.

### Locked decisions — editor gutter (`span_hint`)

- **D-11:** Use VS Code **`TextEditorDecorationType`** gutter decorations with a **theme-friendly** codicon and **tooltips** (titles + count as needed).
- **D-12:** **Multiple issues** at/near the same anchor: **one** gutter glyph with **stacked/count affordance** in tooltip; **click** opens **QuickPick** to choose an issue **unless there is exactly one match — then navigate directly** to that issue’s file (no QuickPick).
- **D-13:** **Stale `span_hint`:** Keep **warning/muted** treatment when a fragment cannot be matched, but **prioritize keeping spans accurate** as the manuscript changes: implement **best-effort re-resolution** (e.g. re-search after edits, fuzzy/nearby match within defined bounds — **algorithm is planner/implementation detail**) so stale state is **exceptional**, not the norm.

### Locked decisions — creating issues and PLAN-03

- **D-14:** **Primary create flow:** **New issue → enter name/title → then choose issue type** (generic command / entry point), not type-first context menus on research rows as the default story.
- **D-15:** **No separate `research-question` issue type.** Research-related concerns use the **same issue types** as other author issues; they differ by **association** (e.g. linked research file / entity) and **location**, not by a unique type enum value. Satisfy **PLAN-03** by **surfacing** those issues in triage **alongside** others and supporting **research associations**, not a distinct `research-question` label in the schema.
- **D-16:** List UI continues **type-based labeling** (`displayIssueTypeLabel` pattern); types come from the **unified** schema set, not a special research-only type.

### Claude's discretion (from CONTEXT.md)

- Exact migration code path (command vs activation), idempotency markers, and conflict handling if files already exist under `issues/`.
- Chapter Context Pane fate vs CHAP-04 wording (minimize vs remove) once counts and triage surfaces are authoritative.
- Specific codicon and decoration theme keys.
- Re-resolution algorithm details for `span_hint` after manuscript edits.

### Deferred ideas (OUT OF SCOPE)

- **Backlog 999.1** — Sidebar tree drill-down for issues (outline, characters, places, threads): more than **counts** (expand rows, open issue from tree, etc.).
- AI session issues, `master-issues.md` rollup — Phase 10+ (see D-04).
- Explicit **Chapter Context Pane** redesign or removal — decision deferred (D-08); may become a future phase or cleanup task.

---

<phase_requirements>

## Phase Requirements

| ID | Description | Research support |
|----|-------------|------------------|
| **ISSUE-01** | Manually create issues chapter-attached or project-wide with full issue schema (incl. optional `span_hint`) | Extend `openQuestionStore` → issues tree; `OpenQuestionRecord` / serialize path already mirrors many issue-schema fields; add `dismissed`, type-first create flow (D-14), multi-folder `listIssues` |
| **ISSUE-02** | Triage including dismiss + optional rationale; dismissed hidden by default | New statuses in types + parser; `dismissed_reason`; UI actions in `openQuestionsHtml` / hosts; persist via `SafeFileSystem` |
| **ISSUE-03** | Filter list: open / deferred / dismissed / all | Shared filter semantics (D-06) in Planning tab + `OpenQuestionsPanelViewProvider`; default = open+deferred |
| **ISSUE-04** | `span_hint` → gutter indicators in manuscript editor | `vscode.window.createTextEditorDecorationType` + `setDecorations` with `DecorationOptions.hoverMessage`; refresh on active editor + document changes; click → command / QuickPick (D-12) |
| **PLAN-03** | Research questions as issue records in triage | **No** `research-question` type: use existing `research` association (`lq_research_file`) + unified types (D-15/D-16); same lists/filters |

</phase_requirements>

## Summary

Phase 8 evolves Phase 14’s single-folder “open questions” model into a **per-type directory layout** under `.leanquill/issues/<type>/`, a **one-time v3 migration** (D-03), and a **richer lifecycle** (`dismissed`, `resolved`, `dismissed_reason`) with **consistent filtering** across the Planning webview tab and the bottom-panel webview (`OpenQuestionsPanelViewProvider`). The data layer today (`openQuestionStore.ts`) already serializes a large subset of `issue-schema.md` frontmatter and uses `SafeFileSystem` for writes; the main work is **recursive listing**, **path-aware CRUD**, **migration**, **UI** (master–detail, filters, dismiss), and a new **gutter decoration controller** wired to manuscript editors.

**Gutter implementation** should use the official decoration pipeline: create a small number of `TextEditorDecorationType` instances (e.g. resolved vs stale vs default), then pass `DecorationOptions` per anchor with `range`, `hoverMessage`, and optional `renderOptions` for gutter icons ([VS Code API — `DecorationOptions`, `setDecorations`](https://code.visualstudio.com/api/references/vscode-api)). VS Code documents `gutterIconPath` / `gutterIconSize` on decoration types; for **theme-friendly codicons** (D-11), practical approach in extensions is **`gutterIconPath` pointing at SVGs** from the bundled `@vscode/codicons` package (already a dependency) or extension `media/`, possibly with `light`/`dark` overrides — exact asset choice is discretion (CONTEXT).

**Primary recommendation:** Treat `issueStore` (rename in plan) as the single source of truth: scan `.leanquill/issues/**/*.md`, normalize records in memory, drive webviews + chapter status merge + sidebar counts + gutter index; run migration once before first read, keyed by an explicit on-disk marker (planner picks: e.g. `.leanquill/issues/.migration-v3.json` vs field in `project.yaml` — note `project.yaml` already has `schema_version` for **project** config, not necessarily issues layout; avoid overloading without a clear spec).

## Project Constraints (from .cursor/rules/)

**None found** — `.cursor/rules/` exists but contained no rule files at research time. Continue to follow repo conventions: TypeScript, esbuild bundle, `SafeFileSystem` for `.leanquill/**` writes, manuscript write-block outside allowed paths.

## Standard Stack

### Core

| Library / surface | Version | Purpose | Why standard |
|-------------------|---------|---------|--------------|
| **VS Code Extension API** | Engine `^1.90.0` (`package.json`) | Webviews, commands, tree views, decorations, QuickPick | Native platform for all UX in scope |
| **TypeScript** | `^5.8.3` | Implementation language | Matches existing extension |
| **esbuild** | `^0.25.3` | Bundle `src/extension.ts` → `dist/extension.js` | Existing build |
| **@vscode/codicons** | `^0.0.45` | SVG/icon assets for gutter paths | Already depended on; supports D-11 theme pairing via light/dark decoration options |
| **Node `fs/promises`** | Runtime | Read/write issue markdown | Already used by store |

### Supporting

| Library | Version | Purpose | When to use |
|---------|---------|---------|-------------|
| **@types/vscode** | `^1.90.0` in repo; **npm `latest` @types/vscode = 1.115.0** (verified 2026-04-10) | API typings | Keep `engines.vscode` and `@types/vscode` aligned to minimum supported VS Code; bump types when using newer APIs |
| **node:test** | Built-in | Unit tests | Existing `npm test` pipeline |

### Alternatives considered

| Instead of | Could use | Tradeoff |
|------------|-----------|----------|
| `TextEditorDecorationType` gutter | CodeLens | CodeLens sits in content area, not margin; poorer match to “gutter indicator” (ISSUE-04 / UI-SPEC) |
| Codicon SVG files | Single PNG `gutterIconPath` | PNG does not always follow theme foreground; two-theme assets or SVG preferred |
| Per-issue decoration type | One type + many `DecorationOptions` | Fewer disposables; VS Code doc: prefer shared type, vary per-range options where possible |

**Installation:** No new packages required for baseline; add **`js-yaml`** (or similar) only if planner mandates full YAML array/object parity for `evidence_links` and other issue-schema fields beyond today’s scalar line parser (see Pitfalls).

**Version verification (registry):** `@types/vscode` → **1.115.0** (`npm view @types/vscode version`, 2026-04-10).

## Architecture Patterns

### Recommended module layout (incremental on current tree)

```
src/
├── openQuestionStore.ts   → issuesStore.ts (or refactor in place): paths, list/parse/serialize/migrate
├── openQuestionsHtml.ts  → extend: filters, dismiss, detail host messages
├── openQuestionsPanel.ts   → same protocol as planning host
├── planningPanel.ts / planningPanelHtml.ts → Issues tab + thread row counts (D-09)
├── issueGutterController.ts (new) → decoration types, document index, editor subscriptions, click command
├── extension.ts            → register migration, watcher glob `.leanquill/issues/**`, commands
├── chapterTree.ts          → description: align “X Issues” copy with D-09
├── characterTree.ts / placeTree.ts / researchTree.ts / outlineWebviewPanel.ts → issue counts
└── openQuestionWorkspaceSync.ts → update paths/globs for `issues/` + entity rename/delete
```

### Pattern 1: Dual webview host, one HTML builder (Phase 14 parity)

**What:** `renderOpenQuestionsHtml` + shared `openQuestion:*` postMessage protocol; `host: 'planning' | 'panel'`.  
**When to use:** Preserve for Phase 8; extend message types for filter, dismiss, open-detail (UI-SPEC master–detail).  
**Evidence:** `openQuestionsHtml.ts`, `openQuestionsPanel.ts`, `planningPanel.ts` message switch.

### Pattern 2: Decoration update loop

**What:** On `window.onDidChangeActiveTextEditor`, `workspace.onDidChangeTextDocument` (debounced), and issue file watcher — recompute `span_hint` → `Range` map for the visible document URI, then `editor.setDecorations(type, options[])`.  
**When to use:** Any manuscript chapter open in editor.  
**Example (API shape — from VS Code API reference):

```typescript
// Source: https://code.visualstudio.com/api/references/vscode-api
const decoType = vscode.window.createTextEditorDecorationType({
  gutterIconPath: gutterIconUri,
  gutterIconSize: "contain",
});

const options: vscode.DecorationOptions[] = [
  {
    range,
    hoverMessage: new vscode.MarkdownString("**Title** — …"),
  },
];
editor.setDecorations(decoType, options);
```

### Pattern 3: Safe writes for all issue paths

**What:** Continue `SafeFileSystem.writeFile` / `mkdir` for anything under `.leanquill/**` (`canWrite` already allows this).  
**When to use:** Create/migrate/save/delete issues.

### Anti-patterns to avoid

- **Duplicating list/filter logic** between Planning and panel — single serializer + shared filter function on `IssueRecord[]`.
- **Decorations without disposal** — `createTextEditorDecorationType` returns a disposable; dispose on extension deactivate.
- **Matching `span_hint` once at load only** — contradicts D-13; re-resolve on document change (debounced).

## Don’t hand-roll

| Problem | Don’t build | Use instead | Why |
|---------|-------------|-------------|-----|
| Workspace write safety | Raw `fs` to arbitrary paths | `SafeFileSystem` | Manuscript immutability invariant |
| Issue type → folder slug | Ad hoc string rules | Same kebab-case slug as YAML `type` (D-01) | Predictable paths for tools and git |
| Multi-issue gutter choice | Custom modal webview | `vscode.window.showQuickPick` | Native UX, accessibility (UI-SPEC) |
| Full YAML feature set (arrays, nested) | Regex line parser only | Real YAML parser (if required) | `evidence_links: []` and future fields break scalar-only parsers |

**Key insight:** Phase 14’s `parseOpenQuestionFile` is **scalar-oriented** (`key: value` lines). The imported `issue-schema.md` shows **array** fields. Today’s serializer emits `evidence_links: []` as a literal line; that works until multi-line YAML appears. For Phase 8 “full schema,” either **constrain authoring** to the current subset or **upgrade parsing**.

## Runtime State Inventory

| Category | Items found | Action required |
|----------|-------------|-----------------|
| **Stored data** | Author issue markdown under **`.leanquill/open-questions/*.md`** (Phase 14). No separate DB. Chapter status JSON (`.leanquill/...`) stores **`openIssueCount`** merged from `countOpenQuestionsByChapter` — today counts only `status === "open"` (**excludes deferred**). | **Migration:** move/transform files to `.leanquill/issues/{type}/`; map `author-note` → type slug `question` (D-02). **Reconcile counts:** D-09 / D-06 imply “active” issues may include **deferred**; align `countOpenQuestionsByChapter` (and sidebar/outline counts) with planner-defined semantics for “open issue count” vs CHAP-01 wording. |
| **Live service config** | None for author issues (local files only). | — |
| **OS-registered state** | None. | — |
| **Secrets / env vars** | None for issues. | — |
| **Build / artifacts** | `OPEN_QUESTIONS_DIR` constant and `FileSystemWatcher` glob in `extension.ts` target **open-questions**. | Update watcher + all path joins (`openQuestionsPanel`, planning panel open-in-editor, workspace sync). |
| **User muscle memory / docs** | Commands still named `leanquill.newOpenQuestion*`. | Optional rename in plan (cosmetic); not blocking if strings updated in UI only. |

**Nothing else in category:** **Git hooks / CI** — none issue-specific found.

## Common Pitfalls

### Pitfall 1: `project.yaml schema_version` vs issues layout version

**What goes wrong:** D-03 references “persisted schema <= 2” while `project.yaml` already uses `schema_version` for **project** validation (`projectConfig.ts` allows `"1"` \| `"2"`).  
**Why:** Two different “schema” concepts collide.  
**How to avoid:** Store **issues migration version** in a dedicated marker under `.leanquill/issues/` or a small `issues-index` file; document the distinction in PLAN.  
**Warning signs:** Migration runs every activation or mutates `project.yaml` in ways `validateProjectYamlForSetup` rejects.

### Pitfall 2: Chapter / sidebar counts diverge from list filters

**What goes wrong:** List defaults to **open + deferred** (D-06) but `countOpenQuestionsByChapter` only increments **`open`** (see `openQuestionStore.ts` and `openQuestionChapterCounts.test.ts`).  
**Why:** Phase 14 semantics vs Phase 8 “active issues.”  
**How to avoid:** Single helper `isActiveForSidebarCount(status)` shared by merge into `ChapterStatusIndex` and outline suffixes.  
**Warning signs:** Author sees “0 Issues” in tree but deferred items exist in triage.

### Pitfall 3: Gutter click handling

**What goes wrong:** Decorations are not buttons — there is no native `onClick` on a gutter decoration.  
**Why:** API limitation.  
**How to avoid:** Use `registerTextEditorCommand` with **gutter context** (if using editor gutter context menu) **and/or** a **global click listener** pattern is **not** available — typical pattern is **Command** “LeanQuill: Go to issue at cursor” bound to a keyboard shortcut, **or** use **CodeLens** (different UX). **Planner must specify:** implement gutter **via** `before`/`after` attachment click is also not standard. **Practical approach:** use **editor line decoration** + **`vscode.window.createTextEditorDecorationType` with `isWholeLine`** and document that user uses **QuickPick** from command palette, **or** investigate **Test Coverage Gutter**-style patterns — actually VS Code **does not** expose decoration click events publicly in stable API for arbitrary extensions in all versions.  
**Correction / grounding:** Research must not claim decoration click works without verification. **Verified:** Official API snippets show `hoverMessage` on `DecorationOptions` ([VS Code API](https://code.visualstudio.com/api/references/vscode-api)) — **not** click handlers. **Recommendation for planner:** Use **CodeLens** on lines with issues **or** a **status bar item / command** “Resolve issues on this line” **or** rely on **list navigation** for v1 of ISSUE-04 unless team accepts a **proposed API** / alternative. **Re-check:** In practice many extensions use **overview ruler** + **command**. **Flag as OPEN:** D-12 requires click → QuickPick — confirm feasibility with **TextEditorDecorationType**; if unsupported, escalate to **editor.commands** registration with **when** clause or **mouse gesture** via custom editor (out of scope). **Update:** VS Code has experimental/custom APIs in some builds — for **1.90+**, safest plan: **stacked issues** resolved via **command** `leanquill.showIssuesAtCursor` using `TextEditor.selection.active` to find decorations’ ranges. **Medium confidence:** verify in target VS Code version whether **GlyphMarginWidget** or similar exists — not confirmed in fetched API excerpt. **Planner action:** spike gutter click in 1.90 engine; fallback = command palette + peek.

### Pitfall 4: Watcher scope after migration

**What goes wrong:** Watcher still `**/.leanquill/open-questions/**` — panel never refreshes.  
**How to avoid:** Watch `.leanquill/issues/**/*.md` (exclude `sessions/` if created later per D-04).

### Pitfall 5: Type folder slug vs Windows case sensitivity

**What goes wrong:** `type: Continuity` vs `continuity` — folder mismatch on Linux CI.  
**How to avoid:** Normalize to lowercase kebab-case when mapping `type` → directory name (D-01).

## Code Examples

### Filter pipeline (conceptual)

```typescript
// Planner: shared between planning + panel
function matchesIssueFilter(
  status: IssueStatus,
  filter: "active" | "open" | "deferred" | "dismissed" | "all",
): boolean {
  switch (filter) {
    case "active":
      return status === "open" || status === "deferred";
    case "open":
      return status === "open";
    case "deferred":
      return status === "deferred";
    case "dismissed":
      return status === "dismissed";
    case "all":
      return true;
  }
}
```

### Debounced document refresh (pattern)

```typescript
// Source: VS Code extension guides — onDidChangeTextDocument + debounce (implementation detail)
const debounced = debounce((uri: vscode.Uri) => void refreshGutterForUri(uri), 150);
vscode.workspace.onDidChangeTextDocument((e) => debounced(e.document.uri));
```

## State of the Art

| Old approach | Current approach | When | Impact |
|--------------|------------------|------|--------|
| Single flat `open-questions/` | Typed subfolders `.leanquill/issues/{type}/` | Phase 8 (D-01) | Scales to AI session files later without mixing author rows |
| Phase 14 statuses (no dismissed) | Full lifecycle + `dismissed_reason` | Phase 8 (D-05–D-07) | Matches `issue-schema.md` statuses |
| List-only `span_hint` hints | Gutter + list stale treatment | Phase 8 (ISSUE-04, D-13) | In-editor awareness |

**Deprecated / outdated for this phase:** Long-term retention of `.leanquill/open-questions/` (D-01).

## Open Questions

1. **Gutter click → QuickPick (D-12) vs VS Code API**  
   - **What we know:** Decorations support `hoverMessage`; `setDecorations` is well documented.  
   - **What’s unclear:** Stable **click** event on gutter decoration for arbitrary extensions.  
   - **Recommendation:** Time-boxed spike; fallback **command** bound to key / context menu on editor.

2. **Where to persist “migration to schema 3 completed”**  
   - **What we know:** D-03 requires idempotent one-time migration.  
   - **What’s unclear:** Whether to reuse `project.yaml` or a dotfile under `issues/`.  
   - **Recommendation:** Prefer **local marker file** under `.leanquill/issues/` to avoid coupling to `validateProjectYamlForSetup`.

3. **Should sidebar “X Issues” include deferred?**  
   - **What we know:** D-06 treats deferred as part of default **list** filter.  
   - **What’s unclear:** CHAP-01 says “open issue count” vs D-09 label “X Issues”.  
   - **Recommendation:** Define `activeCount = open + deferred` for trees to match triage mental model; document in PLAN.

## Environment Availability

| Dependency | Required by | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | `npm test`, esbuild | ✓ | v24.11.1 (verified on researcher machine) | CI image must pin Node ≥18 |
| npm | scripts | ✓ | (bundled) | — |
| VS Code | Extension host | ✓ (assumed) | ≥ 1.90 per `engines` | Cannot implement Phase 8 without VS Code |

**Step 2.6 note:** No PostgreSQL/Redis/Docker required.

**Missing dependencies with no fallback:** VS Code for manual gutter/spike validation.

## Validation Architecture

> `workflow.nyquist_validation` is **true** in `.planning/config.json` — section required.

### Test framework

| Property | Value |
|----------|-------|
| Framework | **Node.js built-in test runner** (`node:test`) |
| Config file | none — conventions in `test/*.test.ts` |
| Quick run command | `npm run build:test && npm test` |
| Full suite command | same (`npm test` runs `node --test dist-test/**/*.test.js`) |

### Phase requirements → test map

| Req ID | Behavior | Test type | Automated command | File exists? |
|--------|----------|-----------|-------------------|--------------|
| ISSUE-01 | Create chapter / project-wide issue; full frontmatter round-trip | unit | `npm run build:test && node --test dist-test/openQuestionStore.test.js` | ✅ partial — extend for `issues/` paths + types |
| ISSUE-02 | Dismiss + `dismissed_reason`; parse validates new status | unit | `node --test dist-test/openQuestionStore.test.js` | ❌ extend tests (today asserts no `dismissed`) |
| ISSUE-03 | Filter predicates open/deferred/dismissed/all | unit | new `issueFilters.test.ts` | ❌ Wave 0 |
| ISSUE-04 | `span_hint` → range resolution (pure function) | unit | new `spanHintResolve.test.ts` | ❌ Wave 0 — **gutter integration** may need `vscode` mocks or manual UAT |
| PLAN-03 | Research-associated issues listed like others | unit | extend store tests for `lq_research_file` + unified list | ✅ research round-trip exists; extend for merged list ordering |

### Sampling rate

- **Per task commit:** `npm run build:test && node --test dist-test/<changed>.test.js -x` (or full `npm test` if quick).  
- **Per wave merge:** `npm run build:test && npm test`.  
- **Phase gate:** Full suite green before `/gsd-verify-work`.

### Wave 0 gaps

- [ ] `test/issueMigration.test.ts` — v3 migration idempotency, `open-questions` → `issues/question/`, conflict cases  
- [ ] `test/issueFilters.test.ts` — D-06 filter matrix  
- [ ] `test/spanHintResolve.test.ts` — fragment search, stale detection, fuzzy bounds (planner-specified)  
- [ ] Update `test/openQuestionChapterCounts.test.ts` once sidebar count semantics include/exclude deferred per PLAN  
- [ ] Optional: `vscode` test harness (`@vscode/test-electron`) for gutter — **only if** spike commits to decoration integration tests (otherwise **manual UAT** for ISSUE-04)

## Sources

### Primary (HIGH confidence)

- **Context7** `/websites/code_visualstudio_api` — `createTextEditorDecorationType`, `DecorationOptions.hoverMessage`, `setDecorations`, `DecorationRenderOptions.gutterIconPath`  
- **Official VS Code API** — https://code.visualstudio.com/api/references/vscode-api (DecorationOptions, TextEditor.setDecorations)  
- **Repository** — `src/openQuestionStore.ts`, `src/openQuestionsPanel.ts`, `src/planningPanelHtml.ts`, `src/extension.ts`, `src/chapterTree.ts`, `src/types.ts`, `test/openQuestionStore.test.ts`, `test/openQuestionChapterCounts.test.ts`

### Secondary (MEDIUM confidence)

- **npm registry** — `npm view @types/vscode version` → 1.115.0 (2026-04-10)  
- **08-UI-SPEC.md** — layout, filters, copy (`X Issues`)

### Tertiary (LOW confidence — validate in spike)

- **Gutter click / QuickPick (D-12)** — exact stable API surface for “click decoration” not confirmed from excerpts; treat as implementation risk.

## Metadata

**Confidence breakdown**

- **Standard stack:** HIGH — matches `package.json` + VS Code docs  
- **Architecture:** HIGH — aligns with existing Phase 14 dual-host and store patterns  
- **Pitfalls:** MEDIUM — migration versioning + gutter click + count semantics need planner decisions / spike  

**Research date:** 2026-04-10  
**Valid until:** ~2026-05-10 (VS Code API moves; re-check if `engines.vscode` bumped)
