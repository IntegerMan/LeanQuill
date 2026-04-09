# Requirements: LeanQuill

**Defined:** 2026-03-29
**Core Value:** An author working in a LeanPub markdown repo can see the status of every chapter, track and triage issues (both manually created and AI-detected), and consult living story notes — all without leaving VS Code and without AI touching a single manuscript file.

---

## v1 Requirements

### Project Setup

- [x] **INIT-01**: Author can initialize a LeanPub repo with a single "LeanQuill: Initialize" command that scaffolds the `.leanquill/` folder structure and creates a `project.yaml` from a sensible template
- [x] **INIT-02**: On initialization, LeanQuill auto-detects `Book.txt` for chapter ordering; falls back to alphabetical sort of manuscript files if not present

### Chapter Management

- [ ] **CHAP-01**: Author can view all chapters in project-defined order in a sidebar tree view, with per-chapter status badge and open issue count
- [ ] **CHAP-02**: Author can click a chapter in the tree view to open its manuscript file in the editor
- [ ] **CHAP-03**: Author can update a chapter's status inline from the tree view or Chapter Context Pane (statuses: planning / not-started / drafting / draft-complete / editing / review-pending / final)
- [ ] **CHAP-04**: When the active editor file matches a known chapter, the Chapter Context Pane auto-populates with that chapter's current status, open issues, and last session notes

### Knowledge / Notes

- [ ] **KNOW-01**: Author can view a Global Knowledge Pane — a sidebar panel rendering project notes (characters, settings, timeline, research) parsed from configured notes folders as formatted markdown
- [ ] **KNOW-02**: Known entity names (characters, locations) are hyperlinked in the knowledge pane for quick navigation to their source files
- [ ] **KNOW-03**: Notes files are editable — the knowledge pane or editing flow does not lock notes to read-only when the chapter is in the planning lifecycle stage

### Planning / Outline

- [ ] **PLAN-01**: Author can access a full Scrivener-style outline view — a hierarchical Parts → Chapters → Beats structure with drag-and-drop rearranging, dual outline and notecard views, and the ability to deactivate beats or chapters during outlining
- [ ] **PLAN-02**: Each story beat supports per-beat fields: description of what occurs, who is present, where it takes place, why it happens — plus a candidate/committed status to track options the author hasn't yet decided on
- [ ] **PLAN-03**: Author can log open questions and research discoveries as issue records using a "research-question" issue type, surfaced in triage alongside other issue types

### Character Reference

- [ ] **CHAR-01**: Author can manage character profiles within the planning workspace Characters tab — creating, editing, and organizing character entries with author-defined fields, with visibility into which chapters and beats reference each character

### Place and Setting Reference

- [ ] **PLACE-01**: Author can manage place and setting profiles within the planning workspace Places tab — creating, editing, and organizing location entries with author-defined fields, linking places to the beats and chapters where scenes occur

### Threads and Themes

- [ ] **THREAD-01**: Author can manage narrative threads and themes within the planning workspace Threads tab — tracking subplots, thematic arcs, and recurring concepts across the story structure, with visibility into which beats and chapters each thread touches

### Issue Tracking

- [ ] **ISSUE-01**: Author can manually create an issue attached to a specific chapter or project-wide, using the full issue schema (type, title, description, optional span_hint)
- [ ] **ISSUE-02**: Author can triage any issue: mark open, dismiss with an optional rationale (dismissed issues hidden from default view), or defer to a later session
- [ ] **ISSUE-03**: Author can filter the issue list by status: open / deferred / dismissed / all
- [ ] **ISSUE-04**: Issues with a `span_hint` referencing a manuscript text fragment display as gutter indicator icons in the editor margin, providing spatially precise issue awareness without leaving the writing surface
- [ ] **ISSUE-05**: Author can right-click any issue and choose "Chat about this" to open a focused AI conversation scoped to that issue — the agent receives the issue record and relevant chapter context but cannot write to manuscript files

### AI Review

- [ ] **AIR-01**: Author can trigger a chapter review from the chapter tree view (right-click) or via chat command; the workflow runs configured active personas against the chapter and produces a timestamped session issue file and chat log entry
- [ ] **AIR-02**: Author can invoke a Post-Write Story Intelligence Update after a writing session; the agent analyzes newly written content in the active chapter and updates notes (character appearances, events, location mentions) with backlinks to the source chapter — the agent never modifies manuscript files
- [ ] **AIR-03**: When an author opens "Chat about this" on an issue, the AI conversation is scoped to that issue's record and the relevant chapter text around the span hint; the agent operates in advisory mode only and never writes to manuscript paths

### Personas

- [ ] **PER-01**: Each project supports a persona library — per-project persona files stored in `.leanquill/personas/`, configurable via `project.yaml` (enable/disable per project); three packaged default personas are bundled: casual-reader, avid-genre-fan, copy-editor; authors can create custom personas using the persona schema

---

## v2 Requirements

Deferred to a future release. Tracked but not in current roadmap.

### Session Management

- **SESS-01**: Author can formally close a work session — recording an updated chapter status and optional notes for the next session handoff
- **SESS-02**: Last session closure notes are surfaced prominently in the Chapter Context Pane for the chapter

### AI Audit Trail

- **AUDIT-01**: All AI sessions are auto-saved as timestamped chat log files in `.leanquill/chats/{timestamp}-{type}.md` including session summary, context used, and issues generated

### Story Intelligence (Advanced)

- **SIQ-01**: Timeline visualization — inferred from manuscript and notes, rendered as a navigable timeline view
- **SIQ-02**: Character/relationship graph — inferred entity relationships rendered as a force-directed graph
- **SIQ-03**: Engagement heatmap — paragraph-level engagement intensity scoring surfaced alongside manuscript

### Continuity & Cross-Chapter

- **CONT-01**: On-demand continuity checker — assembles full manuscript context and flags factual/narrative contradictions across chapters
- **CONT-02**: Issue consolidation agent — aggregates session issue files into the master-issues.md rollup automatically

### Expert Realism

- **EXP-01**: Expert realism review mode — domain-expert personas flag implausible technical/factual details with source-linked evidence
- **EXP-02**: Pre-write plan validation — expert realism check on outlines and notes before drafting begins

---

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| AI writing manuscript content | Non-negotiable design principle — AI advises only |
| Automated git operations | Explicitly forbidden by design policy |
| External API keys (non-VS Code LM providers) | VS Code LM API only in v1; no external HTTP calls |
| Cloud sync / cloud state | Local-first only; permanently out of scope |
| Multi-author collaboration | Out of scope for v1 |
| LeanPub publishing workflow integration | LeanPub handles via git push |
| Mobile / browser companion | Out of scope permanently |
| Inline always-on grammar checking | Interrupts writing flow; anti-feature for this audience |
| WYSIWYG markdown editor replacement | Authors use VS Code's native editor |
| Desktop companion app | Escalation path only if extension UX proves insufficient |
| Config validation on workspace open | Deferred; may surface in v2 settings/init work |

---

## Traceability

Which phases cover which requirements. To be populated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| INIT-01 | 1 | Complete |
| INIT-02 | 1 | Complete |
| CHAP-01 | 2 | Pending |
| CHAP-02 | 2 | Pending |
| CHAP-03 | 2 | Pending |
| CHAP-04 | 2 | Pending |
| PLAN-01 | 3 | Pending |
| PLAN-02 | 3 | Pending |
| PLAN-03 | 8 | Pending |
| CHAR-01 | 4 | Pending |
| PLACE-01 | 5 | Pending |
| THREAD-01 | 6 | Pending |
| KNOW-01 | 7 | Pending |
| KNOW-02 | 7 | Pending |
| KNOW-03 | 7 | Pending |
| ISSUE-01 | 8 | Pending |
| ISSUE-02 | 8 | Pending |
| ISSUE-03 | 8 | Pending |
| ISSUE-04 | 8 | Pending |
| ISSUE-05 | 10 | Pending |
| AIR-01 | 10 | Pending |
| AIR-02 | 10 | Pending |
| AIR-03 | 10 | Pending |
| PER-01 | 9 | Pending |

**Coverage:**
- v1 requirements: 24 total
- Mapped to phases: 24
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-29*
*Last updated: 2026-03-29 after initialization*
