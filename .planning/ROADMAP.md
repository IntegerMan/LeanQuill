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
| 4 | Global Knowledge Reference | Author can continuously consult and edit project knowledge notes during planning and drafting | KNOW-01, KNOW-02, KNOW-03 | 3 criteria |
| 5 | Issue Capture, Triage, and Editor Signals | Author can capture, triage, and spatially resolve editorial/research issues from one workflow | ISSUE-01, ISSUE-02, ISSUE-03, ISSUE-04, PLAN-03 | 5 criteria |
| 6 | AI Safety Rails and Persona Baseline | Project is AI-ready with explicit persona configuration and manuscript write-block protections established | PER-01 | 3 criteria |
| 7 | AI Review and Advisory Workflows | Author can run persona reviews, issue-focused AI discussions, and story intelligence updates with auditability | AIR-01, AIR-02, AIR-03, ISSUE-05 | 5 criteria |

## Phases

- [x] **Phase 1: Foundation and Safe Init** - Scaffold LeanQuill files, chapter ordering detection, and safe IO boundaries.
- [x] **Phase 2: Core Chapter Workflow** - Deliver chapter tree navigation and chapter context basics.
- [ ] **Phase 3: Outline and Beat Planning** - Deliver standalone Scrivener-style planning webview.
- [ ] **Phase 4: Global Knowledge Reference** - Deliver notes parsing and hyperlink-aware knowledge pane.
- [ ] **Phase 5: Issue Capture, Triage, and Editor Signals** - Deliver full issue lifecycle plus gutter issue indicators.
- [ ] **Phase 6: AI Safety Rails and Persona Baseline** - Establish write-block enforcement and persona library configuration.
- [ ] **Phase 7: AI Review and Advisory Workflows** - Layer AI review/chat/intelligence flows on top of Track 1.

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

**Success criteria:**
1. Author can open a Scrivener-style outline webview with hierarchical Parts -> Chapters -> Beats.
2. Author can drag and drop outline nodes and switch between outline and notecard views while preserving order/state.
3. For each beat, author can set what/who/where/why fields and toggle candidate vs committed status.

**Notes:** PLAN-01 complexity isolated in its own phase by design decision.

---

### Phase 4: Global Knowledge Reference

**Goal:** Author can use project notes as a living reference system while writing and planning.
**UI hint:** yes
**Depends on:** Phase 2
**Requirements:** KNOW-01, KNOW-02, KNOW-03

**Success criteria:**
1. Author can open a Global Knowledge Pane that renders parsed markdown from configured notes folders.
2. Known entities (characters/locations) are clickable and navigate quickly to their source notes.
3. Notes remain editable through the normal editing flow; planning-stage chapters do not force notes into read-only mode.

**Notes:** Intentionally scheduled after chapter workflow to reduce early dependency complexity.

---

### Phase 5: Issue Capture, Triage, and Editor Signals

**Goal:** Author can capture editorial and research concerns, triage them over time, and resolve them in-context inside the editor.
**UI hint:** yes
**Depends on:** Phase 2, Phase 4
**Requirements:** ISSUE-01, ISSUE-02, ISSUE-03, ISSUE-04, PLAN-03

**Success criteria:**
1. Author can create issue records manually as chapter-attached or project-wide using the full issue schema.
2. Author can triage issues as open, deferred, or dismissed (with optional rationale) and see status reflected immediately.
3. Issue views can be filtered by open, deferred, dismissed, or all.
4. Issues with valid `span_hint` fragments appear as gutter indicators in the manuscript editor at relevant text locations.
5. Author can create and triage `research-question` issue type entries alongside other issue types.

**Notes:** Issue tracking and gutter decorations are intentionally grouped per research sequencing guidance.

---

### Phase 6: AI Safety Rails and Persona Baseline

**Goal:** LeanQuill is prepared for AI workflows with explicit per-project persona management and hard manuscript immutability guarantees.
**UI hint:** no
**Depends on:** Phase 1, Phase 5
**Requirements:** PER-01

**Success criteria:**
1. Project contains a persona library in `.leanquill/personas/` with three packaged defaults (casual-reader, avid-genre-fan, copy-editor).
2. Author can enable/disable personas per project through project configuration and include custom personas matching schema.
3. AI tool execution surface is constrained so writes are allowed only in approved `.leanquill/` targets, never manuscript paths.

**Notes:** Mandatory safety gate before any AI feature phase, satisfying write-block-first architecture policy.

---

### Phase 7: AI Review and Advisory Workflows

**Goal:** Author can invoke AI as an auditable advisory layer for review, issue discussion, and story intelligence without any manuscript-authoring behavior.
**UI hint:** yes
**Depends on:** Phase 6
**Requirements:** AIR-01, AIR-02, AIR-03, ISSUE-05

**Success criteria:**
1. Author can trigger chapter review from chapter tree or chat command and receive timestamped issue-session output plus chat log.
2. Author can run post-write story intelligence update that adds note backlinks for entities/events without modifying manuscript files.
3. Author can right-click an issue and open a focused "Chat about this" conversation scoped to that issue and relevant chapter context.
4. AI issue conversations remain advisory-only and do not perform manuscript writes.
5. AI workflow artifacts are persisted under LeanQuill project state so review history is reproducible.

**Notes:** Final phase by design because it depends on foundation, issue model, chapter context fidelity, and enforced write-block contracts.

## Progress Table

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation and Safe Init | 0/0 | Completed | 2026-03-29 |
| 2. Core Chapter Workflow | 4/4 | Completed | 2026-03-30 |
| 3. Outline and Beat Planning | 0/0 | Not started | - |
| 4. Global Knowledge Reference | 0/0 | Not started | - |
| 5. Issue Capture, Triage, and Editor Signals | 0/0 | Not started | - |
| 6. AI Safety Rails and Persona Baseline | 0/0 | Not started | - |
| 7. AI Review and Advisory Workflows | 0/0 | Not started | - |
