# Phase 14: Open Questions - Context

**Gathered:** 2026-04-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Author-created open-question notes that can be associated with the book as a whole, a character, a thread, a place, a manuscript file, or a specific manuscript text selection — with a consolidated list, navigation to the linked target, and status management. Stepping stone toward Phase 8 (full issue capture, triage, gutter signals); no AI-generated issues, no gutter decorations, no `research-question` type in this phase.

</domain>

<decisions>
## Implementation Decisions

### Surfaces and presentation
- **D-01:** The consolidated open-questions experience lives in the **Planning workspace** (dedicated tab or equivalent) as the main place for list + create/edit.
- **D-02:** A **second surface** in the **bottom panel** (same VS Code region as Problems / Output / Terminal — not a new custom window). Reuse the **same list/detail visuals and interaction patterns** as the planning view where practical (shared markup, styles, and/or webview message protocol so the two hosts do not diverge).
- **D-03:** In Phase 14, **chapter tree `openIssueCount`** must reflect **open** questions **linked to that chapter** (chapter file and/or selection within that file). Keep semantics aligned with whatever status values mean “open” for this phase.

### Association authoring (UX)
- **D-04:** **Context-first authoring:** The primary way to create a question with an association is **from context** — commands and/or **right-click** on the chapter tree, manuscript editor selection, and planning rows for characters / places / threads (and book-level entry point as needed). The flow **pre-fills** the association; the author completes title/body/status in the question UI. (Adjusting association after the fact may use inline pickers — planner’s discretion as long as context-first creation stays first-class.)

### Manuscript selection storage
- **D-05:** **Claude’s discretion:** Choose the **minimal** representation for linking a question to a **text selection** that stays **compatible with the Phase 8 issue model** and the existing contract in `Imported/data-contracts/issue-schema.md` (e.g. `chapter_ref` + `span_hint` pattern vs. other anchors). Document the chosen approach in the phase plan. If the fragment cannot be found or is ambiguous, navigation must **degrade gracefully** (e.g. open the chapter and surface a stale-link state) — exact UX is discretion.

### Claude’s Discretion
- Panel view registration details (view id, when to reveal, default visibility).
- Whether association can be changed from the question form only vs. also from entity rows.
- Exact status enum for Phase 14 vs. full issue schema (must satisfy roadmap: open / resolved / deferred at minimum; map to or subset of contract statuses).
- File layout under `.leanquill/` (single folder vs. index file) as long as it git-diffs cleanly and matches Phase 8 direction.
- Loading, empty states, and error copy.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope and requirements
- `.planning/ROADMAP.md` — Phase 14 goal, success criteria, dependencies (Phases 2, 4, 5, 6), explicit exclusions (no gutter, no AI issues).
- `.planning/REQUIREMENTS.md` — Partial coverage: ISSUE-01, ISSUE-02 (full lifecycle deferred to Phase 8).

### Data contracts
- `Imported/data-contracts/issue-schema.md` — Issue entry shape, `author-note` type, statuses, `chapter_ref` / `span_hint` precedent for manuscript anchoring.

### Product constraints
- `.planning/PROJECT.md` — Manuscript immutability, local-first `.leanquill/` storage, organizer-first UX.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable assets
- `src/planningPanel.ts` / `src/planningPanelHtml.ts` — Planning webview tabs, message handlers, debounced saves; pattern for adding a new tab.
- `src/characterStore.ts`, `src/placeStore.ts`, `src/threadStore.ts` — Markdown + YAML frontmatter CRUD via `SafeFileSystem`.
- `src/chapterTree.ts` — Chapter list; displays `openIssueCount` from status index today.
- `src/chapterStatus.ts` — `ChapterStatusEntry.openIssueCount`; today populated without real issue backing — Phase 14 should drive real counts for chapter-linked questions.

### Established patterns
- Entity features use configurable `ProjectConfig.folders.*` paths and slugify helpers; new persisted type may need `project.yaml` / parser updates if a new folder is introduced.
- Webviews use shared HTML/CSS string building in `planningPanelHtml.ts`.

### Integration points
- `src/extension.ts` — Commands, views, `package.json` contributions for a panel view and any context-menu / editor commands.
- `src/types.ts` — New types for open-question records as needed.

</code_context>

<specifics>
## Specific Ideas

- User wants the bottom-panel surface to **feel like the same feature** as the planning workspace list (reuse visuals, not a one-off panel design).

</specifics>

<deferred>
## Deferred Ideas

- Full issue capture, triage filters, dismissed state, gutter `span_hint` decorations, AI session issues — Phase 8 and later per roadmap.
- “Research-question” issue type — explicitly out of scope for Phase 14 per roadmap notes.

</deferred>

---

*Phase: 14-open-questions*
*Context gathered: 2026-04-09*
