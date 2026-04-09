# Phase 6: Threads and Themes - Context

**Gathered:** 2026-04-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver **two planning surfaces** in the planning workspace webview:

1. **Themes** — Book-level literary framing and metadata (central question, synopsis, central themes 0…N, book-wide custom key/values). Compact structured data lives in **`.leanquill/themes.yaml`**; longer narrative content lives under **`notes/`** with paths referenced from that file. **Optional links from themes to chapters only** in v1 (no theme→character links in this phase).

2. **Threads** — Per-thread **plot/subplot** records as **individual markdown files** (like characters): dynamic frontmatter key/values, body for notes. Authors maintain **which manuscript chapters** each thread touches; **chapter-level only** — no beat-level concept, and linking targets **outline nodes that map to manuscript chapter files** (non-chapter outline containers are not thread link targets).

**Roadmap note:** Phase 6 / THREAD-01 copy still describes a single “Threads” tab; implementation adds an explicit **Themes** tab and splits responsibilities as below. Update roadmap/traceability when convenient.

</domain>

<decisions>
## Implementation Decisions

### Area 3 — Taxonomy and storage split

- **D-01:** **Themes** and **threads** are **different artifacts**: themes are **book-level** (metadata file + optional linked notes); threads are **per-plot markdown profiles** in the repo.
- **D-02:** **`.leanquill/`** holds **metadata only** for this feature’s structured book data — specifically **`.leanquill/themes.yaml`** as a **dedicated file** (not embedded in `project.yaml`). That file is the **single source** for book-level theme framing: central question, book synopsis, **central themes (0…N)** with per-theme metadata, **book-level custom key/values**, and **optional chapter-only links** for themes (see D-20).
- **D-03:** **Hybrid content** for themes: compact fields and references in `themes.yaml`; **full markdown** for a theme lives under **`notes/`** (implementation may default to e.g. `notes/themes/` for new links) with **paths stored** in `themes.yaml`.
- **D-04:** **Threads** mirror the **flexible/dynamic** model used for **characters**: author-defined key/value pairs (Add Field pattern), no rigid schema beyond minimal defaults (e.g. title/name). **Optional** conventional fields (e.g. plot lane A/B/C) are Claude’s discretion for grouping UX.

### Area 4 — UX

- **D-05:** **Tab order** in the planning webview: **`Outline` → `Cards` → `Themes` → `Characters` → `Places` → `Threads`** (insert **`themes`** between `cards` and `characters`).
- **D-06:** **Themes tab:** **single scrollable form** — central question, **book synopsis**, **book-level custom fields**, **central themes (0…N)** with per-theme metadata, integrated in one view (not master/detail for v1).
- **D-07:** **Threads tab:** **Match Characters** — list/detail split, inline editing, live save to backing files, delete with confirmation, no search/filter box in v1 (Characters parity).
- **D-08:** **Create flows:** **header actions + command palette** for both — e.g. **`LeanQuill: New Theme`** (adds a central theme entry or opens theme note flow per planner) and **`LeanQuill: New Thread`** (new thread `.md`). Exact command IDs/names for planner to align with `package.json`.

### Area 2 — Paths and config

- **D-09:** **Thread files:** one **`.md` per thread** under **`folders.threads`** (default **`notes/threads/`**), parsed from disk on load — **no** separate JSON index for threads. Extend **`project.yaml`** with **`folders.threads`**, **`projectConfig.ts`**, **`initialize.ts`** template, and **`SafeFileSystem`** allowlist (same manuscript-boundary rules as `folders.characters`).
- **D-10:** **Theme longform** paths are **under `notes/`**; default subdirectory for new theme notes (e.g. `notes/themes/`) is implementation choice — paths **recorded in `themes.yaml`**.

### Area 1 — Linking threads and themes to chapters

- **D-11:** **Threads → chapters:** **Author-maintained** list in each thread file’s frontmatter (e.g. **`touchesChapters`**: array of manuscript-relative paths). **UI** to select chapters from **current chapter order / outline-derived list of chapter file nodes** — **not** derived from manuscript grep in Phase 6.
- **D-12:** **Outline rule:** Link targets are **chapters only** — nodes that correspond to **manuscript chapter files** (`fileName` in manuscript). **Do not** attach threads to arbitrary nested outline containers for v1.
- **D-13:** **Beats** are **not** a user-facing unit; no beat IDs in thread linking.
- **D-14:** **Themes → chapters (v1):** **Optional** chapter links **only** — stored in **`themes.yaml`** (or per-theme metadata within it). **No** theme→character links in v1.
- **D-15:** **Threads detail pane** surfaces **`touchesChapters`** prominently (paths and/or titles).

### Claude's Discretion

- Exact YAML shape for `themes.yaml` and per-theme entries (ids, display titles, linked file paths).
- Whether thread list uses **grouping** (e.g. by optional plot-lane field) vs **flat** sorted list.
- Concrete webview controls (checkbox list vs multi-select) for chapter pickers.
- Debounce, styling, frontmatter key ordering, slug/filename rules for new thread files.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope and requirements
- `.planning/ROADMAP.md` — Phase 6 (interpret expanded scope: Themes + Threads tabs)
- `.planning/REQUIREMENTS.md` — THREAD-01 (chapter-level visibility; beats wording is stale)
- `.planning/PROJECT.md` — local-first, manuscript immutability

### Prior phase context
- `.planning/phases/03-outline-and-beat-planning/03-CONTEXT.md` — planning webview, tabs, postMessage (tab list evolves)
- `.planning/phases/04-character-reference/04-CONTEXT.md` — list/detail, character `.md` model, SafeFileSystem, commands (mirror for threads)

### Data contracts
- `Imported/data-contracts/project-config-schema.md` — extend when documenting `folders.threads`

### Code touchpoints
- `src/planningPanelHtml.ts` — `TAB_IDS` / tab panels; add **Themes**; replace **Threads** stub
- `src/planningPanel.ts` — message handlers, refresh for `themes.yaml` + thread files
- `src/projectConfig.ts`, `src/initialize.ts` — `folders.threads`
- `src/safeFileSystem.ts`, `src/extension.ts` — allowlist for threads folder; writes to `.leanquill/themes.yaml` per existing tool-state rules
- `src/outlineStore.ts` (or chapter order helpers) — enumerate chapter file paths for pickers

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable assets
- **Characters tab** implementation — primary UX and CRUD pattern for **Threads** tab.
- **Stub tabs** — Places and Threads still stubs; **Themes** is net-new in the tab strip.
- **`referencedByNameIn`** path conventions — reuse path semantics for **`touchesChapters`**.

### Established patterns
- Debounced webview saves, CSP + nonce, VS Code theme variables.

### Integration points
- New **`themes.yaml`** read/write alongside existing `.leanquill` file access patterns.
- `package.json` commands: **New Theme**, **New Thread**.

</code_context>

<specifics>
## Specific Ideas

- **Themes:** book-wide “underpinnings” and central questions; **threads:** isolated plot lines (A/B/C style) tracked across chapters.
- User requested **conversational discuss-phase** after an initial mistaken context commit; this file supersedes that inference.
- **Dedicated metadata file:** `.leanquill/themes.yaml` (not `project.yaml`).

</specifics>

<deferred>
## Deferred Ideas

- **Theme → character links** — deferred past v1 of this phase.
- **Automatic manuscript detection** for threads (tags/aliases) — not Phase 6 default.
- **Thread linking to non-chapter outline nodes** — deferred.
- **Roadmap / REQUIREMENTS.md** wording refresh (single Threads tab; “beats” language).

</deferred>

---

*Phase: 06-threads-and-themes*
*Context gathered: 2026-04-09*
