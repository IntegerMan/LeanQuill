# Phase 6: Threads and Themes - Context

**Gathered:** 2026-04-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Populate the **Threads** tab in the planning workspace webview with full thread/theme profile management. Authors create, edit, organize, and delete entries for **abstract narrative elements** (subplots, thematic arcs, recurring motifs). Each entry exposes **which manuscript chapters** that thread touches — **chapter-level visibility only**. The product no longer treats **beats** as a user-facing unit; THREAD-01 and roadmap success criteria are interpreted as **chapters** (and outline chapter nodes tied to manuscript files), not beat-level linking.

</domain>

<decisions>
## Implementation Decisions

### Thread vs theme taxonomy (Area 3)
- **D-01:** A **single profile type** covers threads, themes, subplots, and similar abstractions. Distinction is via a frontmatter **`kind`** field (string), not separate file types or tabs.
- **D-02:** Default `kind` suggestions in the UI match the character **role** pattern: datalist presets (e.g. `subplot`, `theme`, `motif`, `arc`) with **freeform** values allowed — authors may type any kind label.
- **D-03:** Standard default fields alongside `kind`: `name`, `description` (or equivalent narrative summary), plus author-defined **custom fields** via the same “Add Field” pattern as characters and beats-era outline metadata.

### Threads tab UX and organization (Area 4)
- **D-04:** **List/detail split** matches the Characters tab: scrollable list on the left, full profile on the right, inline editing with live save to the backing `.md` file.
- **D-05:** List grouping is **by `kind`**, using the same grouping/sort ergonomics as character list-by-role (known kinds first, then alphabetical, `uncategorized` for empty kind).
- **D-06:** Tab label remains **“Threads”** (single tab covers themes and threads per D-01). No separate Themes tab.
- **D-07:** Create flows mirror Characters: **“+ New Thread”** in the tab header and a **command palette** command (e.g. `LeanQuill: New Thread`) creating a new file with template frontmatter and focusing the detail pane.
- **D-08:** Delete from the Threads tab with **confirmation**, removing the profile `.md` file — same pattern as Characters.
- **D-09:** No search/filter box in v1 of this tab (consistent with Characters D-14).

### Data model and storage (Area 2)
- **D-10:** Thread/theme profiles are **individual `.md` files** under a configured folder (default **`notes/threads/`**), YAML frontmatter + markdown body — parallel to characters and planned places layout.
- **D-11:** **No separate JSON index** for thread profiles; the extension discovers files by scanning the configured folder on tab render. Source of truth is always the markdown files.
- **D-12:** Extend **`project.yaml`** with **`folders.threads`** (default `notes/threads/`), parsed in `projectConfig.ts` and scaffolded in init templates alongside other `folders.*` keys.
- **D-13:** **`SafeFileSystem`** allowlist is updated so writes are permitted under the resolved `folders.threads` path, using the same safety pattern as `folders.characters` (reject paths under manuscript).

### Linking threads to the story (Area 1)
- **D-14:** **No beat-level associations** in schema, UI, or copy. Do not add outline-node IDs for legacy “beat” rows as a first-class thread link target.
- **D-15:** **Chapter-level linking only:** each profile stores an explicit list of **manuscript chapter file paths** (relative to repo root, same convention as character `referencedByNameIn`) representing where the author considers the thread active — e.g. frontmatter key **`touchesChapters`** (array of strings).
- **D-16:** Association is **author-maintained** through the Threads detail UI (e.g. multi-select or checklist populated from the current outline/chapter order), **not** automatic full-text manuscript scanning. Abstract concepts do not get the character-style name/alias grep pipeline in this phase.
- **D-17:** The detail pane surfaces **`touchesChapters`** prominently (clickable paths or chapter titles) so authors see coverage at a glance.

### Claude's Discretion
- Slug/filename convention for new thread files (align with existing `manuscriptSync` / character naming patterns).
- Exact control UX for editing `touchesChapters` (checkbox list vs picker vs inline tags).
- Frontmatter key ordering, template wording, debounce timings, and visual styling for the list/detail panes.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope and requirements
- `.planning/ROADMAP.md` — Phase 6 goal, success criteria (interpret **chapters** only for “where a thread touches”; beats deprecated as a user concept)
- `.planning/REQUIREMENTS.md` — THREAD-01 (wording may still say “beats and chapters”; implementation scope is **chapters** per this context)
- `.planning/PROJECT.md` — local-first storage, manuscript immutability, VS Code extension constraints

### Prior phase context (patterns to mirror)
- `.planning/phases/03-outline-and-beat-planning/03-CONTEXT.md` — planning webview tabs, stub replacement, postMessage, auto-save philosophy (outline model has since moved to recursive nodes; do not reintroduce beat-centric UX)
- `.planning/phases/04-character-reference/04-CONTEXT.md` — list/detail layout, per-file markdown profiles, SafeFileSystem folder writes, command registration, manuscript path conventions for `referencedByNameIn` (parallel for `touchesChapters`)

### Data contracts and config
- `Imported/data-contracts/project-config-schema.md` — extend documented `folders` shape with `threads` when schema doc is updated in implementation

### Implementation touchpoints (current code)
- `src/planningPanelHtml.ts` — replace `renderStubTab` for `threads` tab; mirror `renderCharactersTab` structure
- `src/planningPanel.ts` — message handlers, refresh pipeline for thread profiles
- `src/projectConfig.ts` — parse `folders.threads`
- `src/initialize.ts` — default `project.yaml` template includes `folders.threads`
- `src/safeFileSystem.ts` / `src/extension.ts` — allowlist registration for thread folder writes (pattern from characters)
- `src/outlineStore.ts` / `src/types.ts` — chapter discovery from outline for populating `touchesChapters` editor

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable assets
- **Characters tab** (`planningPanelHtml.ts`, `planningPanel.ts`, `characterStore.ts`): list/detail HTML, field editors, custom fields, CRUD messages, file persistence — primary template for Threads.
- **`TAB_IDS` / `TAB_LABELS`:** `threads` tab already registered; stub content only.
- **Character `referencedByNameIn`:** array of manuscript-relative paths — reuse path semantics for `touchesChapters`.

### Established patterns
- Webview theming via VS Code CSS variables; CSP + nonce scripts; debounced persistence.
- `SafeFileSystem` gated writes per configured notes folders.

### Integration points
- Extend `project.yaml` and parsing; register `LeanQuill: New Thread` in `package.json` / `extension.ts`.
- Read outline / chapter order to build the chapter picker for `touchesChapters`.

</code_context>

<specifics>
## Specific Ideas

- Discussion order was taxonomy → UX → storage → linking; explicit note: **beats are no longer a user-facing concept** — thread linking must not depend on beat rows or beat IDs.
- Thread/theme entries stay **abstract**; avoid implying automatic detection from manuscript text in this phase.

</specifics>

<deferred>
## Deferred Ideas

- **Automatic keyword/alias scanning** for threads (if authors later want grep-like coverage for named motifs) — optional enhancement; not Phase 6 default per D-16.
- **Finer-than-chapter anchors** (scenes, outline child nodes) — if the outline gains a new user-facing primitive, revisit linking in a later phase.
- **REQ/roadmap wording refresh** — THREAD-01 and Phase 6 success bullets still mention “beats”; update documentation when convenient so traceability matches chapter-only behavior.

</deferred>

---

*Phase: 06-threads-and-themes*
*Context gathered: 2026-04-09*
