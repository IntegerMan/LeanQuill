# Phase 4: Character Reference - Context

**Gathered:** 2026-04-07
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase populates the Characters stub tab in the planning workspace webview with full character profile management. Authors can create, edit, organize, and delete character entries stored as individual markdown files. The extension auto-detects character name mentions in manuscript files and updates each character's frontmatter with file associations, giving the author visibility into where each character appears.

</domain>

<decisions>
## Implementation Decisions

### Data Model & Storage
- **D-01:** Character profiles are stored as individual `.md` files in the configured `folders.characters` path (default: `notes/characters/`). Each file has YAML frontmatter for structured fields and a freeform markdown body for description/notes.
- **D-02:** No separate JSON index file. The extension parses character files from the filesystem each time the Characters tab renders. Source of truth is always the `.md` files themselves.
- **D-03:** Character files use a template-defaults-plus-freeform field model. Default frontmatter fields: `name`, `aliases` (array), `role`, `description`, plus author-defined custom fields as additional key-value pairs.
- **D-04:** `SafeFileSystem` must be updated to allow writing `.md` files within the configured `folders.characters` path (resolved from `project.yaml`), following the same pattern used for `folders.research` in Phase 12.

### Character-to-Story Linking
- **D-05:** Character-to-chapter associations are stored in each character's frontmatter in a `referencedByNameIn` field — an array of manuscript file paths that mention this character or one of their aliases.
- **D-06:** Detection is triggered on manuscript file save and open events. When a manuscript file is saved or opened, the extension scans all character profiles for name/alias matches against the file's text content and updates each character's `referencedByNameIn` array accordingly (adding or removing the file).
- **D-07:** Only files inside the configured manuscript folder are scanned for character mentions.
- **D-08:** Name matching uses exact case-insensitive word-boundary matching against the character's `name` and each entry in `aliases`.

### Characters Tab Layout & Editing
- **D-09:** Characters tab uses a list/detail split layout: left sidebar shows a scrollable list of character names grouped by role, clicking a character shows the full profile in a detail pane on the right.
- **D-10:** Editing is inline in the webview detail pane with live save back to the `.md` file. No separate "Open in Editor" required — all fields are editable directly in the detail view.
- **D-11:** Authors can add custom fields via an "Add Field" button in the detail pane, which adds a new key-value row — consistent with the beat `customFields` pattern from Phase 3.
- **D-12:** New characters are created via a "+ New Character" button in the Characters tab header AND a command palette command (`LeanQuill: New Character`). Both create a new `.md` file with template frontmatter and display it in the detail pane for editing.

### Character Organization
- **D-13:** Characters are grouped in the list by `role` field. Default roles provided: `protagonist`, `antagonist`, `supporting`, `minor`. Authors can extend with custom role values by typing any role name.
- **D-14:** No search/filter box — authors browse the grouped list directly.
- **D-15:** Characters can be deleted from the Characters tab via a delete button with a confirmation prompt. Deletion removes the `.md` file from `notes/characters/`.

### Agent's Discretion
- Exact debounce timing for manuscript scan events
- Frontmatter field ordering and template cosmetics
- Detail pane styling (spacing, label formatting, section dividers)
- How `referencedByNameIn` entries are displayed in the detail view (list, badges, clickable links)
- Whether character file naming uses slugification of name (consistent with existing patterns)
- How the "Add Field" interaction works in detail (inline text input, modal, etc.)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Scope and Requirements
- `.planning/ROADMAP.md` — Phase 4 goal, dependencies, success criteria (CHAR-01)
- `.planning/REQUIREMENTS.md` — CHAR-01 requirement definition
- `.planning/PROJECT.md` — product constraints (local-first, manuscript immutability, extension-first workflow)

### Existing Phase Context
- `.planning/phases/01-foundation-and-safe-init/01-CONTEXT.md` — carry-forward: safe file boundary model (D-09 through D-12)
- `.planning/phases/02-core-chapter-workflow/02-CONTEXT.md` — carry-forward: chapter status model, TreeView pattern, context pane webview approach
- `.planning/phases/03-outline-and-beat-planning/03-CONTEXT.md` — carry-forward: planning webview architecture (D-05 through D-10), tabbed layout with stub tabs (D-06/D-07), customFields pattern (D-15), inline editing + Open in Editor (D-17), auto-save pattern (D-28), postMessage API (D-09)
- `.planning/phases/12-add-the-ability-to-run-research-in-standardized-ways-and-collect-research-results-in-a-dedicated-research-folder-next-to-the-manuscript/12-CONTEXT.md` — carry-forward: SafeFileSystem allowlist update pattern for folder-based write access (D-04)

### Data Contracts & Configuration
- `Imported/data-contracts/project-config-schema.md` — `project.yaml` structure; `folders.characters` key
- `src/initialize.ts` — `project.yaml` template with `folders.characters: notes/characters/`

### Existing Modules (implementation patterns)
- `src/planningPanel.ts` — Planning webview panel provider with message handling, tab switching, debounced writes
- `src/planningPanelHtml.ts` — Tab rendering, stub tab template (line 163: `renderStubTab`), TAB_IDS constant (line 167)
- `src/outlineStore.ts` — JSON index CRUD pattern, node normalization
- `src/types.ts` — Existing type definitions (OutlineNode with customFields, traits)
- `src/safeFileSystem.ts` — Write boundary enforcement, allowlist model
- `src/manuscriptSync.ts` — Slugification logic for title-to-filename conversion
- `src/extension.ts` — Command registration, view registration, activation path

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `planningPanelHtml.ts`: Tab rendering infrastructure — Characters tab is already registered as a stub (`TAB_IDS` includes "characters", `TAB_LABELS` maps to "Characters"). Replace `renderStubTab` call with real content.
- `planningPanel.ts`: Message handler pattern (`_handleMessage`) for webview ↔ extension communication. Add character-specific message types.
- `safeFileSystem.ts`: Allowlist model for write permissions. Phase 12 added research folder writes as precedent for adding character folder writes.
- `manuscriptSync.ts`: Slugification for filename generation — reuse for `name → filename.md` conversion.
- `outlineStore.ts`: YAML/JSON file I/O patterns, field normalization — pattern reference for character file parsing.
- `project.yaml` `folders.characters` config: Already configured path resolution for the characters directory.

### Established Patterns
- Webview uses VS Code CSS variables for theming
- postMessage API for webview ↔ extension host communication
- Debounced auto-save for persistence (300ms in outline store)
- Content-Security-Policy with nonce-based script loading
- `escapeHtml()` utility for safe HTML rendering in webviews

### Integration Points
- `planningPanelHtml.ts` — Replace `renderStubTab("Characters")` with character list/detail rendering
- `planningPanel.ts` — Add message handlers for character CRUD operations and field updates
- `extension.ts` — Register file watchers for manuscript save/open events to trigger character scan
- `safeFileSystem.ts` — Add `folders.characters` path to write allowlist
- `package.json` — Register `LeanQuill: New Character` command

</code_context>

<specifics>
## Specific Ideas

- Character-to-story linking should feel automatic — the author doesn't manually maintain lists of which chapters mention a character. The extension keeps this up to date as a background concern.
- The detail pane should show the `referencedByNameIn` associations prominently so the author can see at a glance where each character appears in the manuscript.
- Custom fields follow the same pattern as beat custom fields — the "Add Field" button creates a new frontmatter key with an empty value, editable inline.
- Role-based grouping provides lightweight organization without forcing a rigid hierarchy — authors who don't care about roles get a flat "uncategorized" group by default.
- Part synopsis/notes fields (deferred from Phase 3) may be addressed in this phase if appropriate per the Phase 3 deferred items note.

</specifics>

<deferred>
## Deferred Ideas

- **Character relationship mapping** — Visual graph or matrix showing character relationships (v1.5 per requirements)
- **Character timeline** — When characters appear chronologically across the story (depends on timeline inference, v1.5)
- **Auto-suggesting character names** — Autocomplete for character names while writing in manuscript files
- **Character conflict/goal tracking** — Structured fields for character motivations and arcs
- **Cross-reference from Knowledge Pane** — Phase 7 will add character entries to the global knowledge view
- **Part synopsis/notes fields** — Deferred from Phase 3; may fit here or in a future phase

</deferred>

---

*Phase: 04-character-reference*
*Context gathered: 2026-04-07*
