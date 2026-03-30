# Phase 3: Outline and Beat Planning - Context

**Gathered:** 2026-03-30
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers a standalone Scrivener-style planning workspace where authors can structure long-form narratives using a hierarchical Parts → Chapters → Beats model. The workspace includes a sidebar outline tree (VS Code native TreeView), a full editor panel webview with tabbed views (outline/cards active, stub tabs for future phases), drag-and-drop with promote/demote, per-beat metadata, and tight coupling to Book.txt for publishing order.

</domain>

<decisions>
## Implementation Decisions

### Outline Data Model & Persistence
- **D-01:** Outline structure stored in a single `outline-index.json` file under `.leanquill/`.
- **D-02:** Storage format is JSON, consistent with `chapter-status-index.json`.
- **D-03:** One outline per project.
- **D-04:** Outline drives Book.txt — changes to the outline rewrite Book.txt with the new chapter/part ordering (tight coupling).

### Webview Architecture & Interaction
- **D-05:** Dual surface: sidebar (native VS Code TreeView for outline navigation) + editor panel (full interactive webview).
- **D-06:** Editor panel uses a tabbed layout with horizontal top tabs. Phase 3 delivers a functional Outline/Beats card view tab, plus placeholder/stub tabs for Characters, Places, and Threads/Themes.
- **D-07:** Stub tabs display a placeholder message explaining the feature is coming in a future update.
- **D-08:** Drag-and-drop supports cross-level movement plus promote/demote (e.g., drag a beat to become a chapter, or a chapter to become a beat).
- **D-09:** Webview ↔ extension host communication uses standard VS Code postMessage API.
- **D-10:** Tab switching is click-only — no keyboard shortcuts to avoid VS Code shortcut conflicts.

### Sidebar Outline Tree
- **D-11:** Sidebar outline tree uses the native VS Code TreeView API (consistent with Phase 2 chapter tree).
- **D-12:** Tree depth is configurable — author can choose how deep the tree renders (Parts → Chapters → Beats or shallower).
- **D-13:** Standard context menu set for all node types: add/remove child, rename, activate/deactivate, move up/down, open in editor.
- **D-14:** Sidebar supports drag-and-drop for reordering.

### Beat Fields & Editing Workflow
- **D-15:** Beats support custom/freeform fields — author defines their own key-value pair fields beyond the default what/who/where/why template. Fields are added via the webview UI ("Add Field" interaction).
- **D-16:** Each beat has a binary active/inactive toggle (not candidate/committed — since chapters contain multiple beats, binary toggle is the right granularity).
- **D-17:** Hybrid editing: inline editing in the webview for quick field changes, plus an "Open in Editor" button that opens a full VS Code editor tab for detailed editing.
- **D-18:** The VS Code editor tab opens a virtual markdown document with YAML frontmatter (minimal identifiers: beat ID, title) and a freeform body section for description/notes.
- **D-19:** Custom key-value fields are managed exclusively in the webview UI, NOT in the markdown document — the markdown doc is for narrative content, the webview is for structured metadata.
- **D-20:** JSON (`outline-index.json`) is the single source of truth. The virtual markdown document is a view/editor that syncs its description body back to the JSON on save.
- **D-21:** Standard VS Code dirty/save flow — saving the beat document writes the description back to outline JSON through the debounced auto-save pipeline.

### Part Grouping & Chapter Deactivation
- **D-22:** Parts are author-created containers that influence generated document markup (Part headings appear in output).
- **D-23:** Deactivation = visual toggle (greyed/strikethrough). Deactivated items stay visible in their position but are excluded from Book.txt sync.
- **D-24:** Parts carry name only in Phase 3. Synopsis/notes fields deferred to a future knowledge/notes phase.

### Book.txt Sync
- **D-25:** Live sync — every outline change immediately updates Book.txt (with debounce for rapid edits, consistent with D-28).
- **D-26:** Parts appear in Book.txt using LeanPub-native `part:` line format.
- **D-27:** External edit detection — if Book.txt was changed outside the outline, warn the author and offer merge/overwrite choice.

### Save Behavior
- **D-28:** Auto-save with debounce for outline-index.json persistence. Every change is auto-persisted.
- **D-29:** No undo/redo in the webview — git is the safety net.

### Card View Visual Design
- **D-30:** Fixed-size cards in a uniform grid.
- **D-31:** Each card shows: beat title, first line of description (truncated), active/inactive badge.
- **D-32:** Inactive beats shown as greyed + strikethrough cards, visible in grid position.
- **D-33:** Cards grouped by Part → Chapter, with filtering to narrow by specific Part or Chapter, and ability to choose grouping level.

### Outline Bootstrapping
- **D-34:** Existing projects: auto-scaffold from Book.txt/chapter order — one Part ("Book"), one Chapter per existing file, no beats.
- **D-35:** New projects: start with an empty outline for planning-first workflow.
- **D-36:** Bootstrapping triggers both on first open of the outline view (auto) and via an explicit "LeanQuill: Create Outline" command.

### Agent's Discretion
- Debounce timing for auto-save and Book.txt sync (reasonable default, e.g., 300-500ms).
- Exact postMessage protocol structure between webview and extension host.
- Card grid dimensions (columns, gap, minimum card width).
- Implementation of configurable tree depth setting (setting location, default value).
- Virtual markdown document filesystem provider implementation details.
- Exact styling/theming of cards and tabs (use VS Code CSS variables for consistency).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Scope and Requirements
- `.planning/ROADMAP.md` — Phase 3 goal, dependencies, and success criteria (PLAN-01, PLAN-02).
- `.planning/REQUIREMENTS.md` — PLAN-01 (Scrivener-style outline) and PLAN-02 (beat fields and candidate/committed) requirement definitions.
- `.planning/PROJECT.md` — product constraints (local-first, manuscript immutability, extension-first workflow).

### Existing Phase Context
- `.planning/phases/01-foundation-and-safe-init/01-CONTEXT.md` — carry-forward: chapter ordering from Book.txt (D-13 through D-16), safe file boundary model (D-09 through D-12), guided init UX (D-01 through D-08).
- `.planning/phases/02-core-chapter-workflow/02-CONTEXT.md` — carry-forward: chapter status model (D-01 through D-04), tree view patterns (D-05 through D-08), context pane webview approach (D-09 through D-12).

### Data Contracts
- `Imported/data-contracts/project-config-schema.md` — project.yaml structure including manuscript conventions and folder layout.
- `Imported/contracts/chapter-status.schema.json` — chapter status schema used by existing chapter-status-index.json.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/chapterTree.ts`: TreeView provider with hierarchical nodes (book → chapters → not-included). Pattern for building the outline sidebar tree.
- `src/chapterContextPane.ts`: WebviewViewProvider with HTML rendering, VS Code CSS variables, Content-Security-Policy, and command URIs. Pattern for webview development, though Phase 3 needs `enableScripts: true` for interactive content.
- `src/chapterStatus.ts`: JSON persistence pattern (read/normalize/write cycle) reusable for outline-index.json.
- `src/chapterOrder.ts`: Chapter order resolution from Book.txt with natural-sort fallback. Will need bidirectional updates when outline drives Book.txt.
- `src/safeFileSystem.ts`: Write boundary enforcement. Outline files write to `.leanquill/` which is already in the allowlist.
- `src/types.ts`: Shared type definitions. Outline types (Part, Chapter, Beat, OutlineIndex) should be added here.

### Established Patterns
- TreeView uses VS Code `TreeDataProvider` with welcome-state behavior (`src/actionsView.ts`).
- Extension commands use command registration + post-action context refresh (`src/extension.ts`).
- Webview providers use `retainContextWhenHidden: true` for sidebar panels.
- JSON state files use `schemaVersion` field for forward compatibility.

### Integration Points
- Register outline tree provider and editor panel webview in `src/extension.ts` activation path.
- Extend the `contributes` section in `package.json` with new views, commands, and webview panel registration.
- Reuse chapter order from `.leanquill/chapter-order.json` as input for bootstrapping.
- File watchers on `outline-index.json` and `Book.txt` for cross-component refresh (existing pattern from chapter order/status watchers).

</code_context>

<specifics>
## Specific Ideas

- The editor panel webview should feel like a dedicated planning workspace — a significant step up from the sidebar context pane. Horizontal tabs at the top, rich card grid below.
- Card view should support filtering by Part or Chapter to let authors focus on specific sections of their book.
- The virtual markdown beat document should be intentionally lightweight — minimal YAML frontmatter (beat ID, title only) with a freeform body. All structured metadata lives in the webview UI. This prevents confusion about where the "real" data is.
- Part headings in Book.txt should use LeanPub's native `part:` format so they render correctly in published output without manual intervention.
- The sidebar outline tree and the editor panel card view should show the same data but optimized for different workflows — sidebar for quick navigation and reordering, editor panel for content review and beat editing.

</specifics>

<deferred>
## Deferred Ideas

- **Dedicated phases for Characters, Places, and Threads/Themes** — the author envisions these as separate tabs in the editor panel webview, each deserving its own phase. These should be inserted after Phase 3 in the roadmap before the current Phase 4 (Global Knowledge Reference). Consider whether Phase 4's existing requirements (KNOW-01, KNOW-02, KNOW-03) need to be redistributed across these new phases.
- **Part synopsis/notes fields** — Parts carry name only in Phase 3. Synopsis and descriptive notes for Parts should be added when the knowledge/notes phases populate the Characters/Places/Threads tabs.
- **Symlink/realpath hardening** for safe file boundary (deferred from Phase 1, still pending).

</deferred>

---

*Phase: 03-outline-and-beat-planning*
*Context gathered: 2026-03-30*
