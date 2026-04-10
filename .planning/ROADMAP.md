# Roadmap: LeanQuill

**Milestone:** v1.0
**Defined:** 2026-03-29
**Granularity:** Standard

## Summary Table

| # | Phase | Goal | Requirements | Success Criteria |
|---|-------|------|--------------|------------------|
| 1 | Foundation and Safe Init | Author can bootstrap a LeanQuill project on a reliable local-first foundation with enforced file safety boundaries | INIT-01, INIT-02 | 3 criteria |
| 2 | Core Chapter Workflow | Author can navigate chapters, open files, and manage chapter state from VS Code sidebars | CHAP-01, CHAP-02, CHAP-03, CHAP-04 | 4 criteria |
| 3 | Outline and Beat Planning | Author can plan long-form structure in a dedicated Scrivener-style planning workspace | PLAN-01, PLAN-02 | 3 criteria |
| 4 | Character Reference | Author can manage character profiles in the planning workspace Characters tab | CHAR-01 | 2 criteria |
| 5 | Place and Setting Reference | Author can manage place and setting profiles in the planning workspace Places tab | PLACE-01 | 2 criteria |
| 6 | Threads and Themes | Author can manage narrative threads and thematic arcs in the planning workspace Threads tab | THREAD-01 | 2 criteria |
| 7 | Global Knowledge Reference | Author can continuously consult and edit project knowledge notes during planning and drafting | KNOW-01, KNOW-02, KNOW-03 | 3 criteria |
| 8 | Issue Capture, Triage, and Editor Signals | Author can capture, triage, and spatially resolve editorial/research issues from one workflow | ISSUE-01, ISSUE-02, ISSUE-03, ISSUE-04, PLAN-03 | 5 criteria |
| 9 | AI Safety Rails and Persona Baseline | Project is AI-ready with explicit persona configuration and manuscript write-block protections established | PER-01 | 3 criteria |
| 10 | AI Review and Advisory Workflows | Author can run persona reviews, issue-focused AI discussions, and story intelligence updates with auditability | AIR-01, AIR-02, AIR-03, ISSUE-05 | 5 criteria |
| 11 | Outline and Card Usability Improvements | Author can insert, remove, reorder cards and update outline hierarchy from planning views | PLAN-02 | 3 criteria |
| 12 | Standardized Research Workflow and Results Repository | Author can capture standardized research findings and store them in a consistent project repository for later planning and drafting use | RES-01, RES-02 | 2 criteria |
| 13 | LeanPub Workspace Initialization | Author can initialize a LeanPub workspace with manuscript scaffold from the sidebar | INIT-01, INIT-02 | 3 criteria |

## Phases

- [x] **Phase 1: Foundation and Safe Init** - Scaffold LeanQuill files, chapter ordering detection, and safe IO boundaries.
- [x] **Phase 2: Core Chapter Workflow** - Deliver chapter tree navigation and chapter context basics.
- [x] **Phase 3: Outline and Beat Planning** - Deliver standalone Scrivener-style planning webview.
- [x] **Phase 4: Character Reference** - Populate Characters tab with character profile management. (completed 2026-04-09)
- [ ] **Phase 5: Place and Setting Reference** - Populate Places tab with location/setting management.
- [x] **Phase 6: Threads and Themes** - Populate planning workspace with Themes + Threads tabs, `themes.yaml`, and thread markdown under `folders.threads`. (completed 2026-04-09)
- [ ] **Phase 7: Global Knowledge Reference** - Deliver notes parsing and hyperlink-aware knowledge pane.
- [ ] **Phase 8: Issue Capture, Triage, and Editor Signals** - Deliver full issue lifecycle plus gutter issue indicators.
- [ ] **Phase 9: AI Safety Rails and Persona Baseline** - Establish write-block enforcement and persona library configuration.
- [ ] **Phase 10: AI Review and Advisory Workflows** - Layer AI review/chat/intelligence flows on top of Track 1.
- [ ] **Phase 11: Outline and Card Usability Improvements** - Improve outline/card insertion, removal, reordering, and hierarchy editing.
- [x] **Phase 12: Standardized Research Workflow and Results Repository** - Add standardized research execution and dedicated research-results storage next to manuscript. (completed 2026-04-06)
- [x] **Phase 13: LeanPub Workspace Initialization** - Sidebar control to create `manuscript/`, `Book.txt`, and a placeholder chapter when missing. (completed 2026-04-09)

## Phase Details

### Phase 1: Foundation and Safe Init

**Goal:** Author can initialize a LeanPub repository into a LeanQuill-ready workspace with safe file boundaries and deterministic chapter ordering.
**UI hint:** no
**Depends on:** Nothing
**Requirements:** INIT-01, INIT-02

**Success criteria:**
1. Author runs a single initialize command and sees `.leanquill/` and `project.yaml` created with valid defaults.
2. Chapter order is resolved from `Book.txt` when present, otherwise falls back automatically to alphabetical manuscript ordering.
3. Unsafe write attempts targeting manuscript paths are blocked by the extension boundary and do not alter manuscript files.

**Notes:** Foundation-first phase from research: establish extension scaffold, data model roots, and SafeFileSystem boundary before feature layering.

---

### Phase 2: Core Chapter Workflow

**Goal:** Author can run a complete chapter-centric workflow in VS Code: view ordered chapters, open one instantly, and update chapter lifecycle state.
**UI hint:** yes
**Depends on:** Phase 1
**Requirements:** CHAP-01, CHAP-02, CHAP-03, CHAP-04
**Plans:** 4 plans

Plans:
- [x] 02-01-PLAN.md - Define chapter status contracts and persistence foundation.
- [x] 02-02-PLAN.md - Build chapter tree provider with ordering, grouping, and open behavior.
- [x] 02-03-PLAN.md - Build Chapter Context webview provider aligned to approved UI contract.
- [x] 02-04-PLAN.md - Wire manifest and extension integration for end-to-end chapter workflow.

**Success criteria:**
1. Sidebar shows all chapters in project order with current status and open issue count per chapter.
2. Clicking a chapter in the tree opens the linked manuscript file in the editor.
3. Author can update chapter status inline from the tree or Chapter Context Pane and see the new status immediately.
4. Switching to a chapter file auto-refreshes the Chapter Context Pane with status, open issues, and last session notes.

**Notes:** Scheduled before knowledge pane per dependency guidance; this validates the core chapter data flow first.

---

### Phase 3: Outline and Beat Planning

**Goal:** Author can plan story structure with a dedicated, high-capability planning surface independent of drafting.
**UI hint:** yes
**Depends on:** Phase 2
**Requirements:** PLAN-01, PLAN-02
**Plans:** 3 plans (1 descoped)

Plans:
- [x] 03-01-PLAN.md — Types, data store, and Book.txt sync foundation.
- [x] 03-02-PLAN.md — Sidebar outline tree with drag-and-drop reordering.
- [x] 03-03-PLAN.md — Planning webview panel with tabs and beat card grid.
- [~] 03-04-PLAN.md — ~~Beat editor~~ (descoped — beats removed from scope). Extension wiring absorbed into plans 01-03.

**Success criteria:**
1. Author can open a Scrivener-style outline webview with hierarchical Parts -> Chapters.
2. Author can drag and drop outline nodes and switch between outline and notecard views while preserving order/state.
3. ~~For each beat, author can set what/who/where/why fields and toggle candidate vs committed status.~~ (descoped)

**Notes:** PLAN-01 complexity isolated in its own phase by design decision. Beat editor (03-04) descoped — beats removed from v1.0 scope.

---

### Phase 4: Character Reference

**Goal:** Author can manage character profiles within the planning workspace, tracking who appears in which parts of the story.
**UI hint:** yes
**Depends on:** Phase 3
**Requirements:** CHAR-01
**Plans:** 3/3 plans complete

Plans:
- [x] 04-01-PLAN.md — CharacterProfile types, ProjectConfig.folders.characters, and characterStore CRUD + manuscript scanning.
- [x] 04-02-PLAN.md — Characters tab HTML with list/detail layout and PlanningPanel message handlers.
- [x] 04-03-PLAN.md — Extension wiring: SafeFileSystem allowance, manuscript watchers, and leanquill.newCharacter command.

**Success criteria:**
1. Author can open the Characters tab in the planning webview and create, edit, and organize character entries with author-defined fields.
2. Character entries show which chapters and beats reference each character, giving the author visibility into character presence across the story.

**Notes:** Populates the Characters stub tab created in Phase 3. Part synopsis/notes fields may also be added in this phase per Phase 3 deferred items.

---

### Phase 5: Place and Setting Reference

**Goal:** Author can manage place and setting profiles within the planning workspace, linking locations to the scenes where they appear.
**UI hint:** yes
**Depends on:** Phase 3
**Requirements:** PLACE-01
**Plans:** 4 plans (2/4 summaries complete)

Plans:
- [x] 05-01-PLAN.md — PlaceProfile, `folders.settings`, `placeStore` CRUD + tests (no scans).
- [x] 05-02-PLAN.md — Hybrid linking: `scanManuscriptFileForPlaces` + `scanOutlineIndexForPlaces` + fixture tests (05-RESEARCH Option C).
- [x] 05-03-PLAN.md — Places tab webview + `PlanningPanel` `place:*` handlers + `showPlace` (Characters-tab parity + beat id list).
- [ ] 05-04-PLAN.md — Extension wiring: SafeFs allowPath, watcher, outline/manuscript hooks, `leanquill.newPlace`.

**Success criteria:**
1. Author can open the Places tab in the planning webview and create, edit, and organize location/setting entries with author-defined fields.
2. Place entries show which chapters and beats reference each location, giving the author visibility into setting usage across the story.

**Notes:** Populates the Places stub tab created in Phase 3. Follows the same data model and UI patterns established by Phase 4 (Character Reference).

---

### Phase 6: Threads and Themes

**Goal:** Author can track narrative threads, subplots, and thematic arcs that weave through the story structure.
**UI hint:** yes
**Depends on:** Phase 3
**Requirements:** THREAD-01
**Plans:** 3/3 plans complete

Plans:
- [x] 06-01-PLAN.md — ThreadProfile/ThemesDocument types, `folders.threads`, `themes.yaml` + `threadStore` + chapter picker helper + tests.
- [x] 06-02-PLAN.md — Planning webview: Themes + Threads tabs (tab order D-05), HTML + `PlanningPanel` message handlers.
- [x] 06-03-PLAN.md — Extension wiring: SafeFs threads path, watcher, `leanquill.newThread` / `leanquill.newTheme` commands.

**Success criteria:**
1. Author can open the **Themes** and **Threads** tabs in the planning webview and create, edit, and organize book-level theme framing and per-thread profiles with author-defined fields (per `06-CONTEXT.md`).
2. Thread entries show which **chapter files** each thread touches (author-maintained `touchesChapters`); theme entries may optionally link to chapters only — visibility into how concepts and subplots weave through the narrative at **chapter** granularity (beats are not a linking unit in v1).

**Notes:** Populates the planning workspace with an explicit **Themes** tab (`.leanquill/themes.yaml` + optional notes paths) and a **Threads** tab (markdown under `folders.threads`, default `notes/threads/`). Tab order: Outline → Cards → Themes → Characters → Places → Threads. Deferred: theme→character links, thread→non-chapter outline nodes, automatic manuscript detection — see `06-CONTEXT.md`.

---

### Phase 7: Global Knowledge Reference

**Goal:** Author can use project notes as a living reference system while writing and planning.
**UI hint:** yes
**Depends on:** Phase 2
**Requirements:** KNOW-01, KNOW-02, KNOW-03

**Success criteria:**
1. Author can open a Global Knowledge Pane that renders parsed markdown from configured notes folders.
2. Known entities (characters/locations) are clickable and navigate quickly to their source notes.
3. Notes remain editable through the normal editing flow; planning-stage chapters do not force notes into read-only mode.

**Notes:** Intentionally scheduled after chapter workflow to reduce early dependency complexity. Now also scheduled after character/place/thread phases so the knowledge pane can cross-reference structured planning data.

---

### Phase 8: Issue Capture, Triage, and Editor Signals

**Goal:** Author can capture editorial and research concerns, triage them over time, and resolve them in-context inside the editor.
**UI hint:** yes
**Depends on:** Phase 2, Phase 7
**Requirements:** ISSUE-01, ISSUE-02, ISSUE-03, ISSUE-04, PLAN-03

**Success criteria:**
1. Author can create issue records manually as chapter-attached or project-wide using the full issue schema.
2. Author can triage issues as open, deferred, or dismissed (with optional rationale) and see status reflected immediately.
3. Issue views can be filtered by open, deferred, dismissed, or all.
4. Issues with valid `span_hint` fragments appear as gutter indicators in the manuscript editor at relevant text locations.
5. Author can create and triage `research-question` issue type entries alongside other issue types.

**Notes:** Issue tracking and gutter decorations are intentionally grouped per research sequencing guidance.

---

### Phase 9: AI Safety Rails and Persona Baseline

**Goal:** LeanQuill is prepared for AI workflows with explicit per-project persona management and hard manuscript immutability guarantees.
**UI hint:** no
**Depends on:** Phase 1, Phase 8
**Requirements:** PER-01

**Success criteria:**
1. Project contains a persona library in `.leanquill/personas/` with three packaged defaults (casual-reader, avid-genre-fan, copy-editor).
2. Author can enable/disable personas per project through project configuration and include custom personas matching schema.
3. AI tool execution surface is constrained so writes are allowed only in approved `.leanquill/` targets, never manuscript paths.

**Notes:** Mandatory safety gate before any AI feature phase, satisfying write-block-first architecture policy.

### Phase 10: AI Review and Advisory Workflows

**Goal:** Author can invoke AI as an auditable advisory layer for review, issue discussion, and story intelligence without any manuscript-authoring behavior.
**UI hint:** yes
**Depends on:** Phase 9
**Requirements:** AIR-01, AIR-02, AIR-03, ISSUE-05

**Success criteria:**
1. Author can trigger chapter review from chapter tree or chat command and receive timestamped issue-session output plus chat log.
2. Author can run post-write story intelligence update that adds note backlinks for entities/events without modifying manuscript files.
3. Author can right-click an issue and open a focused "Chat about this" conversation scoped to that issue and relevant chapter context.
4. AI issue conversations remain advisory-only and do not perform manuscript writes.
5. AI workflow artifacts are persisted under LeanQuill project state so review history is reproducible.

**Notes:** Final phase by design because it depends on foundation, issue model, chapter context fidelity, and enforced write-block contracts.

### Phase 11: Make the outline and card views more usable with the ability to insert, remove, and reorder cards. The outline should also support changing hierarchy structures like we can in the sidebar.

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 10
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd-plan-phase 11 to break down)

---

### Phase 12: Standardized Research Workflow and Results Repository

**Goal:** Author can run standardized research workflows via AI chat and store structured research outcomes in a dedicated folder, browsable from the VS Code sidebar.
**UI hint:** yes
**Depends on:** Phase 1
**Requirements:** RES-01, RES-02, RES-03, RES-04
**Plans:** 2/2 plans complete

Plans:
- [x] 12-01-PLAN.md — Config foundation, schema v2 migration, SafeFileSystem extension for research folder.
- [x] 12-02-PLAN.md — Research sidebar TreeView, quick-start button, extension wiring.

**Success criteria:**
1. Extension manages a research folder at configurable path (default research/leanquill/) with automatic schema migration from v1 to v2.
2. Sidebar Research section lists detected research markdown files with name and creation date; clicking opens them in the editor.
3. Plus button on Research section opens AI chat pre-populated with the appropriate research invocation command for the active harness.

**Notes:** Research execution happens in AI chat via harness-specific agent files, not as extension commands. The extension provides storage, browsing, and quick-start. Canonical workflow definition generated in .leanquill/workflows/ during init.

---

### Phase 13: LeanPub Workspace Initialization

**Goal:** Author can initialize a workspace for LeanPub publishing if it is not yet initialized — create the `manuscript/` directory, `Book.txt`, and a placeholder chapter — using a button on the sidebar.
**UI hint:** yes
**Depends on:** Phase 1
**Requirements:** INIT-01, INIT-02
**Plans:** 4/4 plans complete

Plans:
- [x] 13-01-PLAN.md — Project.yaml Setup validation + `leanpubScaffold` module (Book.txt/ch1 rules, D-05/D-07/D-11/D-18).
- [x] 13-02-PLAN.md — `setWorkspaceContext` keys + `package.json` viewsWelcome readiness gating (D-02/D-04, copy partial D-03).
- [x] 13-03-PLAN.md — `showCards`, unified `runInitializeFlow` (scaffold-only vs full init), extension wiring, chapter-order refresh (D-08–D-17, INIT-01/02).
- [x] 13-04-PLAN.md — Unit tests (`leanpubScaffold`, `validateProjectYamlForSetup`) + D-03 copy audit.

**Success criteria:**
1. When the workspace lacks LeanPub manuscript scaffolding, the author can trigger initialization from the sidebar.
2. Initialization creates `manuscript/`, a valid `Book.txt`, and at least one placeholder chapter file consistent with `Book.txt` ordering.
3. Operation respects existing SafeFileSystem boundaries (no unsafe writes outside approved targets).

**Notes:** Promoted from backlog (999.1). Complements command-based init from Phase 1 with a discoverable sidebar path.

## Progress Table

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation and Safe Init | 0/0 | Completed | 2026-03-29 |
| 3. Outline and Beat Planning | 3/3 | Completed | 2026-04-05 |
| 4. Character Reference | 3/3 | Completed | 2026-04-09 |
| 5. Place and Setting Reference | 0/4 | Not started | - |
| 6. Threads and Themes | 3/3 | Completed | 2026-04-09 |
| 7. Global Knowledge Reference | 0/0 | Not started | - |
| 8. Issue Capture, Triage, and Editor Signals | 0/0 | Not started | - |
| 9. AI Safety Rails and Persona Baseline | 0/0 | Not started | - |
| 10. AI Review and Advisory Workflows | 0/0 | Not started | - |
| 11. Outline and Card Usability Improvements | 0/0 | Not started | - |
| 12. Standardized Research Workflow and Results Repository | 2/2 | Completed | 2026-04-05 |
| 13. LeanPub Workspace Initialization | 4/4 | Completed | 2026-04-09 |

## Backlog
