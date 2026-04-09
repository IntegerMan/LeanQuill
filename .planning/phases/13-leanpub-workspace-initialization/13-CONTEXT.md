# Phase 13: LeanPub Workspace Initialization - Context

**Gathered:** 2026-04-08
**Status:** Ready for planning

<domain>
## Phase Boundary

The author can create LeanPub manuscript scaffolding from the sidebar when it is missing: `manuscript/`, `manuscript/Book.txt`, and at least one placeholder chapter file, with ordering consistent with existing `Book.txt` resolution. Writes stay within explicit SafeFileSystem rules and user-initiated scaffold paths only.

</domain>

<decisions>
## Implementation Decisions

### Sidebar visibility and eligibility
- **D-01:** Show the scaffold affordance only when the workspace is a **initialized LeanQuill project** (`leanquill.isInitialized` / `.leanquill/project.yaml` present). Uninitialized repos keep using the existing Setup welcome + **LeanQuill: Initialize** flow (Phase 1); this phase does not replace that path.
- **D-02:** Treat “LeanPub manuscript scaffolding incomplete” when **any** of: `manuscript/` is missing, `manuscript/Book.txt` is missing, or there is **no** `*.md` file under `manuscript/`. Hide the scaffold affordance only when **all three** are satisfied (folder exists, `Book.txt` exists, at least one markdown chapter file exists). Broken `Book.txt` references or outline sync issues are out of scope for this gate — authors use existing chapter-order and outline tools.
- **D-03:** Drive visibility with a **new workspace context key** (e.g. `leanquill.needsLeanPubManuscriptScaffold`) computed alongside existing `setWorkspaceContext` in `src/extension.ts`, so `viewsWelcome` or a command link can use `when` clauses without ad-hoc checks in the tree provider alone.

### SafeFileSystem and manuscript writes
- **D-04:** Do **not** add a permanent global allowlist for arbitrary `manuscript/**/*.md` writes on `SafeFileSystem` — that would widen the surface for any future caller using the same instance.
- **D-05:** Implement scaffold writes through a **dedicated, user-command-scoped path**: e.g. a single orchestration function used only by the new command, using either (a) a short-lived scoped allow mode on `SafeFileSystem` (push/pop or `runWithManuscriptScaffoldWrites(callback)`), or (b) explicit `SafeFileSystem` methods that only accept **known-safe relative paths** (`manuscript/`, `manuscript/Book.txt`, `manuscript/ch*.md` matching the files this command creates). The planner should pick one approach; both satisfy “no unsafe writes outside approved targets.”
- **D-06:** Scaffold may create **`manuscript/`** via `mkdir` and the **placeholder `.md`** file plus **`manuscript/Book.txt`**; these are the only manuscript paths this feature writes. AI/tooling paths that must not touch manuscript remain unchanged outside this command.

### Generated files (Book.txt and placeholder chapter)
- **D-07:** Default placeholder filename **`ch1.md`**, aligned with bundled `project.yaml` convention `file_pattern: ch*.md` from Phase 1 template.
- **D-08:** **`Book.txt`** paths are **relative to `manuscript/`** (consistent with `src/chapterOrder.ts`). New file lists exactly the placeholder line when created from scratch: `ch1.md` (no `manuscript/` prefix in the file body).
- **D-09:** **If `Book.txt` is missing:** create it containing the placeholder chapter line (and standard trailing newline).
- **D-10:** **If `Book.txt` already exists:** do not replace the whole file. **Append** a line for the new chapter if that basename is not already listed in non-comment lines; preserve existing comments and ordering. If appending would be ambiguous (e.g. user must resolve duplicates), prefer a **confirmation prompt** before mutating.
- **D-11:** **If `ch1.md` already exists:** use the next free name `ch2.md`, `ch3.md`, … and write **`Book.txt`** accordingly (append new line). Same if starting from partial scaffold.
- **D-12:** Placeholder chapter **content:** leading `#` title (e.g. `# Chapter 1`) plus a single short stub line inviting the author to replace it — no heavy template; no requirement for YAML front matter in v1 of this feature.

### After success (UX and refresh)
- **D-13:** Show an **information notification** that scaffold completed (brief, actionable).
- **D-14:** **Open the new placeholder chapter** in the editor after success (primary author-facing win).
- **D-15:** Re-run the same **workspace context refresh** used today (`setWorkspaceContext`) so `leanquill.hasManuscriptMarkers` and the new scaffold key update immediately.
- **D-16:** Trigger the same **chapter-order / downstream refresh** pattern the extension uses after structural manuscript changes (e.g. refresh tree/outline consumers) so the new chapter appears without requiring a reload; align with existing `bookTxtWatcher` / chapter scan behavior where applicable.
- **D-17:** **No modal confirmation** before write unless `Book.txt` exists and needs destructive or ambiguous edit (per D-10); default for greenfield scaffold is proceed with info message only.

### Claude's Discretion
- Exact notification strings and whether to also reveal `Book.txt` in a secondary action.
- Implementation detail of scoped SafeFileSystem (callback vs dedicated methods) as long as D-04–D-06 are satisfied.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase and product scope
- `.planning/ROADMAP.md` — Phase 13 goal, success criteria, dependency on Phase 1.
- `.planning/REQUIREMENTS.md` — INIT-01, INIT-02 (chapter order / `Book.txt` behavior).
- `.planning/PROJECT.md` — Manuscript immutability for AI, local-first, LeanPub layout expectations.

### Prior locked decisions
- `.planning/phases/01-foundation-and-safe-init/01-CONTEXT.md` — Init UX, `Book.txt` strict ordering, manuscript creation on full init when missing, SafeFileSystem baseline.
- `.planning/phases/02-core-chapter-workflow/02-CONTEXT.md` — Chapter order carry-forward, tree integration.

### Implementation contracts in repo
- `src/chapterOrder.ts` — `Book.txt` location (`manuscript/Book.txt`), line semantics, path rules.
- `src/safeFileSystem.ts` — Current write allowlist; extension point for scoped scaffold writes.
- `src/extension.ts` — `setWorkspaceContext`, activation, watchers.
- `package.json` — `leanquill.actions` Setup view, `viewsWelcome`, context keys (`leanquill.isInitialized`, `leanquill.hasManuscriptMarkers`).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable assets
- `SafeFileSystem` (`src/safeFileSystem.ts`) — Already allows `manuscript/Book.txt`; scaffold logic must extend in a scoped way for `ch*.md` + `manuscript/` mkdir.
- `resolveChapterOrder` (`src/chapterOrder.ts`) — Defines canonical `Book.txt` path and parsing; generated files must match.
- `setWorkspaceContext` (`src/extension.ts`) — Central place to add `leanquill.needsLeanPubManuscriptScaffold`.
- Setup view (`leanquill.actions`) — `viewsWelcome` entries in `package.json`; third welcome targets initialized projects and is the natural place for a “Create manuscript folder” link when the new context key is true.

### Established patterns
- Command-driven workflows with `vscode.window` notifications; tree welcome content via markdown links to commands.
- Post-init refresh patterns (chapter order, outline bootstrap) already exist on activation paths in `extension.ts`.

### Integration points
- New command (e.g. `leanquill.initLeanPubManuscript`) registered in `package.json`, referenced from `viewsWelcome` with a narrow `when` clause.
- `LeanQuillActionsProvider` (`src/actionsView.ts`) currently returns no children so welcome content shows; welcome-driven command is sufficient unless a tree item is preferred later.

</code_context>

<specifics>
## Specific Ideas

- User chose to discuss all four gray areas and replied **Continue** to lock decisions using the assistant’s recommended defaults.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 13-leanpub-workspace-initialization*
*Context gathered: 2026-04-08*
