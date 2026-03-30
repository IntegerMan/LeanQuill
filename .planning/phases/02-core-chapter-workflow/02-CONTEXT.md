# Phase 2: Core Chapter Workflow - Context

**Gathered:** 2026-03-29
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers a chapter-centric author workflow in VS Code: show chapters in project order, open chapters from the tree, update chapter lifecycle state, and auto-populate chapter context for the active chapter.

</domain>

<decisions>
## Implementation Decisions

### Chapter Status Model
- **D-01:** Use the CHAP lifecycle status set from requirements for Phase 2 UI and stored chapter state: `planning`, `not-started`, `drafting`, `draft-complete`, `editing`, `review-pending`, `final`.
- **D-02:** Persist chapter statuses in a single chapter-status index file under `.leanquill/`.
- **D-03:** Default status for chapters without saved state is `not-started`.
- **D-04:** If a stored status is invalid/unrecognized, show a warning and fall back to `not-started`.

### Chapter Tree Workflow
- **D-05:** Tree rows show chapter title, status, and open issue count.
- **D-06:** Chapter open behavior is single-click preview and double-click to pin in the editor.
- **D-07:** Status changes from tree are triggered via context menu action plus quick pick.
- **D-08:** Tree ordering remains strict project order from chapter-order source (Phase 1 carry-forward: `Book.txt` authoritative, natural-sort fallback).

### Chapter Context Pane Behavior
- **D-09:** Context pane content for active chapter includes status, open issues, and last session notes.
- **D-10:** Context pane auto-refresh triggers on active chapter file change and after status update command completion.
- **D-11:** When active file is not a known chapter, keep showing last chapter context.
- **D-12:** Status editing in context pane uses the same quick-pick status command flow as tree updates.

### Missing Data and Edge Cases
- **D-13:** If chapter-order references a missing manuscript file, show a placeholder row flagged as missing.
- **D-14:** Until full issue integration phase, display issue count as `0` with pending-integration semantics.
- **D-15:** For last session notes (v2 feature), hide the notes section in Phase 2.
- **D-16:** If a manuscript file exists but is not in chapter-order source, append it under a `Not Included` group.

### the agent's Discretion
- Exact warning surface implementation details (notification text and logging granularity).
- Exact visual styling of tree badges and placeholder rows.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Scope and Requirements
- `.planning/ROADMAP.md` - Phase 2 goal, dependencies, and success criteria.
- `.planning/REQUIREMENTS.md` - CHAP-01 through CHAP-04 requirement definitions.
- `.planning/PROJECT.md` - product constraints (local-first, manuscript immutability, extension-first workflow).

### Data Contracts
- `Imported/contracts/chapter-status.schema.json` - chapter status record shape and constraints for persisted chapter metadata.

### Existing Phase Context
- `.planning/phases/01-foundation-and-safe-init/01-CONTEXT.md` - carry-forward decisions for chapter ordering and safety boundaries.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/chapterOrder.ts`: existing chapter order resolver with strict `Book.txt` handling and natural-sort fallback.
- `src/initialize.ts`: current initialize flow writes `.leanquill/chapter-order.json` and establishes state directories.
- `src/extension.ts`: activation/context-key pattern for LeanQuill views and command wiring.

### Established Patterns
- Tree container currently uses a simple `TreeDataProvider` with welcome-state behavior in `src/actionsView.ts`.
- Extension command flows use command registration plus post-action context refresh in `src/extension.ts`.
- Safe filesystem boundary is currently enforced through `.leanquill/**` writes in `src/safeFileSystem.ts`.

### Integration Points
- Add chapter tree provider and commands in extension activation path (`src/extension.ts`).
- Reuse chapter order output from `.leanquill/chapter-order.json` as authoritative ordering input.
- Extend LeanQuill view stack (currently `leanquill.actions`) for chapter tree/context surface wiring.

</code_context>

<specifics>
## Specific Ideas

- Tree opening should feel editor-native: single click previews, double click pins.
- Out-of-order manuscript files should remain visible under a dedicated `Not Included` group to match LeanPub publishing semantics.

</specifics>

<deferred>
## Deferred Ideas

- None - discussion stayed within Phase 2 scope.

</deferred>

---

*Phase: 02-core-chapter-workflow*
*Context gathered: 2026-03-29*
