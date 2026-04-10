# Phase 14: Open Questions - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-09
**Phase:** 14-open-questions
**Areas discussed:** Issues list surface, Association UX, Text selection linking

---

## Issues list surface

| Option | Description | Selected |
|--------|-------------|----------|
| Sidebar only | New tree like Chapters / Research | |
| Planning tab only | New tab in Planning Workspace | Partial (half of hybrid) |
| Planning + bottom panel | Planning workspace plus panel in Output/Problems region, reuse visuals | ✓ |
| Wire `openIssueCount` in Phase 14 | Count chapter-linked open questions | ✓ |
| Defer counts to Phase 8 | Keep placeholder zeros | |

**User's choice:** Open questions appear in the **Planning workspace** and **also** in a **bottom panel** (same region as build output / Problems), reusing the same visuals where possible. **Yes** to wiring **`openIssueCount`** for chapter-linked open questions in Phase 14.

**Notes:** Treat panel and planning as two hosts for the same conceptual UI (shared components / protocol), not independent designs.

---

## Association UX

| Option | Description | Selected |
|--------|-------------|----------|
| Question form pickers only | Type + target chosen only in create/edit form | |
| Context-first | Right-click / commands on tree, editor selection, entity rows; pre-fill association | ✓ |
| Both | Context actions + full form pickers | |

**User's choice:** **2** — Context-first (commands / right-click) with pre-filled association.

**Notes:** User did not select “both”; form-only pickers are not the primary path. Editing association after create left to planner discretion.

---

## Text selection linking

| Option | Description | Selected |
|--------|-------------|----------|
| span_hint-style fragment | Quoted fragment + chapter path; stale if text moves | |
| Stable anchors | Line/offset or editor range emphasis | |
| Planner discretion | Minimal approach aligned with Phase 8 | ✓ |

**User's choice:** **3** — **Claude’s discretion:** minimal storage compatible with Phase 8 and `issue-schema.md`; graceful degradation when anchor is missing or ambiguous.

**Notes:** No mandatory fragment-only vs. offset-only lock.

---

## Claude's Discretion

- Panel contribution details, status vocabulary subset vs. full schema, `.leanquill/` file layout, stale-link UX specifics, empty/loading states.

## Deferred Ideas

- Full Phase 8 issue lifecycle, gutter signals, AI-generated issues — captured in CONTEXT.md deferred section.
