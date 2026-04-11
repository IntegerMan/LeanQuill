# Phase 8: Issue Capture, Triage, and Editor Signals - Context

**Gathered:** 2026-04-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Author-captured issues using the full issue lifecycle: create and edit issue records (chapter-attached, project-wide, entity-associated, and manuscript `span_hint` where applicable), triage **open / deferred / dismissed / resolved**, filter views, **gutter indicators** in the manuscript editor for anchored issues, and a **schema-on-disk migration** from Phase 14 `.leanquill/open-questions/` into a unified **`.leanquill/issues/{type}/`** layout. AI session issue files, `master-issues.md` rollup, and “Chat about this” remain later phases per roadmap.

</domain>

<decisions>
## Implementation Decisions

### On-disk layout & migration (replaces `open-questions/`)

- **D-01:** Author issues are stored under **`.leanquill/issues/<issueType>/`**, where `<issueType>` is a **filesystem-safe slug matching the issue’s YAML `type` field** (kebab-case, same family as `Imported/data-contracts/issue-schema.md`). No long-term `.leanquill/open-questions/` directory after migration.
- **D-02:** Legacy Phase 14 content in **`.leanquill/open-questions/`** migrates into the folder for the unified author question type using the slug **`question`** (not the old folder name). **Extend or align the contract** so `question` is a first-class `type` (and map legacy `author-note` / open-question files to `question` on migration) — exact YAML field parity with `issue-schema.md` is for the planner to specify in the migration spec.
- **D-03:** **Schema versioning:** If persisted schema is **`<= 2`**, run a **one-time migration to schema `3`**: rewrite/move files into the correct **`.leanquill/issues/{type}/`** tree, normalize frontmatter, and record that migration completed so it does **not** run again.
- **D-04 (clarifies prior “1c”):** **Out of scope in Phase 8:** AI-generated session files under `.leanquill/issues/sessions/` and the **`master-issues.md`** consolidation rollup described in the issue contract. Those support **Phase 10** AI review workflows. Phase 8 only establishes the **author** capture path, triage UI, and gutter behavior; leave hooks/fields so future phases can populate the same type system.

### Triage, filters, and sidebar counts

- **D-05:** Status set: **`open` | `deferred` | `dismissed` | `resolved`**, with **`dismissed`** distinct from **`resolved`** (dismissed = not pursuing / not applicable). Optional **`dismissed_reason`** on dismiss.
- **D-06:** Default list filter: **`open` + `deferred`**; **dismissed hidden** until user selects a view that includes dismissed (e.g. **All** or **Dismissed**). Apply consistently across **planning** and **bottom-panel** hosts (same semantics as Phase 14 dual surface).
- **D-07:** **Dismiss** from list row and/or commands with **optional rationale** stored in **`dismissed_reason`**; same behavior in both hosts.
- **D-08:** **Chapter Context Pane:** No commitment to keep or extend it in Phase 8 — **treat as discretionary** during planning (may remain minimal, evolve, or later retire). **Do not** rely on the pane as the primary issues surface.
- **D-09:** Show **open issue counts** in the **sidebar trees** (e.g. outline, characters, places, threads — wherever issues associate to those entities). **Label format:** **`X Issues`** (user-facing copy). Phase 8 delivers **counts only** for those trees.
- **D-10:** **Backlog** **999.1** — richer representation than counts (drill-down, rows, actions) in those sidebar trees; see ROADMAP Backlog.

### Editor gutter (`span_hint`)

- **D-11:** Use VS Code **`TextEditorDecorationType`** gutter decorations with a **theme-friendly** codicon and **tooltips** (titles + count as needed).
- **D-12:** **Multiple issues** at/near the same anchor: **one** gutter glyph with **stacked/count affordance** in tooltip; **click** opens **QuickPick** to choose an issue **unless there is exactly one match — then navigate directly** to that issue’s file (no QuickPick).
- **D-13:** **Stale `span_hint`:** Keep **warning/muted** treatment when a fragment cannot be matched, but **prioritize keeping spans accurate** as the manuscript changes: implement **best-effort re-resolution** (e.g. re-search after edits, fuzzy/nearby match within defined bounds — **algorithm is planner/implementation detail**) so stale state is **exceptional**, not the norm.

### Creating issues & “research-question” / PLAN-03

- **D-14:** **Primary create flow:** **New issue → enter name/title → then choose issue type** (generic command / entry point), not type-first context menus on research rows as the default story.
- **D-15:** **No separate `research-question` issue type.** Research-related concerns use the **same issue types** as other author issues; they differ by **association** (e.g. linked research file / entity) and **location**, not by a unique type enum value. Satisfy **PLAN-03** by **surfacing** those issues in triage **alongside** others and supporting **research associations**, not a distinct `research-question` label in the schema.
- **D-16:** List UI continues **type-based labeling** (`displayIssueTypeLabel` pattern); types come from the **unified** schema set, not a special research-only type.

### Claude's Discretion

- Exact migration code path (command vs activation), idempotency markers, and conflict handling if files already exist under `issues/`.
- Chapter Context Pane fate vs CHAP-04 wording (minimize vs remove) once counts and triage surfaces are authoritative.
- Specific codicon and decoration theme keys.
- Re-resolution algorithm details for `span_hint` after manuscript edits.

### Folded Todos

- None.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope

- `.planning/ROADMAP.md` — Phase 8 goal, success criteria (interpret **#5** with D-15: PLAN-03 via associations, not `research-question` type), dependencies (Phases 2, 7).
- `.planning/REQUIREMENTS.md` — ISSUE-01–04, PLAN-03 (as interpreted above).

### Prior phase handoff

- `.planning/phases/14-open-questions/14-CONTEXT.md` — Dual hosts, context-first creation for Phase 14; Phase 8 supersedes on-disk path and expands lifecycle (dismissed, full schema, gutter).
- `.planning/phases/02-core-chapter-workflow/02-CONTEXT.md` — Chapter tree / context patterns; D-08 revisits pane role.

### Data contracts

- `Imported/data-contracts/issue-schema.md` — Issue entry shape, statuses, `chapter_ref` / `span_hint`, types list (extend for `question` / migration mapping as needed).

### Product constraints

- `.planning/PROJECT.md` — Manuscript immutability, local-first `.leanquill/`, organizer-first UX.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `src/openQuestionStore.ts`, `OPEN_QUESTIONS_DIR` — replace with `issues/` root + per-type paths; migration logic lands here or adjacent module.
- `src/openQuestionsHtml.ts`, `src/openQuestionsPanel.ts`, `src/planningPanelHtml.ts` — list/detail hosts; extend for filters, dismiss, type folder sourcing.
- `src/types.ts` — `OpenQuestionRecord` / associations; evolve toward full issue model naming in plan.
- `src/chapterTree.ts`, `src/outlineWebviewPanel.ts` — patterns for counts; extend for **X Issues** on entity/outline nodes (D-09).
- `src/chapterContextPane.ts` — optional shrink or leave static per D-08.

### Established Patterns

- Webviews + shared HTML/CSS; `SafeFileSystem` for `.leanquill/**` writes.
- Phase 14 stale-hint and association chips — reuse for gutter/list consistency.

### Integration Points

- `src/extension.ts` — commands, views, context menus; new migration command or activation hook.
- Gutter: new decoration provider wired to active editor + issue index by `chapter_ref` / `span_hint`.

</code_context>

<specifics>
## Specific Ideas

- User wants **type-separated folders** under `.leanquill/issues/` and legacy **`open-questions` → `issues/question/`** as part of v3 migration.
- User wants **sidebar trees** to carry **“X Issues”** counts; richer tree UX is **backlog 999.1**.

</specifics>

<deferred>
## Deferred Ideas

- **Backlog 999.1** — Sidebar tree drill-down for issues (outline, characters, places, threads): more than **counts** (expand rows, open issue from tree, etc.).
- AI session issues, `master-issues.md` rollup — Phase 10+ (see D-04).
- Explicit **Chapter Context Pane** redesign or removal — decision deferred (D-08); may become a future phase or cleanup task.

### Reviewed Todos (not folded)

- None.

</deferred>

---

*Phase: 08-issue-capture-triage-and-editor-signals*
*Context gathered: 2026-04-10*
