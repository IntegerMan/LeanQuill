# Phase 8: Issue Capture, Triage, and Editor Signals - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-10
**Phase:** 8-Issue Capture, Triage, and Editor Signals
**Areas discussed:** Data model & on-disk layout, Triage & filters & sidebar, Editor gutter, Issue creation & research parity

---

## Data model & on-disk layout

| Option | Description | Selected |
|--------|-------------|----------|
| A | Keep `.leanquill/open-questions/` in place | |
| B | `.leanquill/issues/{issueType}/` + migrate open-questions into type folder `question` | ✓ |
| C | Split types across unrelated roots | |

**User's choice:** **B** — `.leanquill/issues/{issueType}/`; legacy open questions move under **`question`** (not `open-questions` folder name).

**Notes:** One-time migration when schema `<= 2` → `3`, move files to correct folders. User asked for clarification on “1c”: explained as **session files + master rollup** vs Phase 8 author-only scope — **defer rollup to Phase 10+**.

---

## Triage, filters, Chapter Context Pane, sidebar trees

| Topic | Options | Selected |
|-------|---------|----------|
| Status model | Contract-aligned four states | open / deferred / dismissed / resolved |
| Default filter | open only / open+deferred / all | **open + deferred** (dismissed hidden until explicit filter) |
| Dismiss | required vs optional rationale | **optional** `dismissed_reason` |
| Context pane | expand / defer | **Uncertain on pane longevity** — Phase 8 does **not** expand pane; counts elsewhere are primary |
| Sidebar trees | — | **“X Issues”** under outline, characters, places, etc.; **counts only** in Phase 8 |

**User's choice:** Filters **2b=A**, dismiss **2c=A**. Pane **no commitment**. Trees: **counts with “X Issues”**; **backlog 999.1** for richer tree representation.

---

## Editor gutter (`span_hint`)

| Topic | Selected |
|-------|----------|
| Decoration API | VS Code gutter decorations (single recommended approach) |
| Multi-issue | **One** glyph + count/stack in tooltip |
| Click | **QuickPick** if multiple; **direct open** if exactly one |
| Stale | Warning treatment **if unavoidable**, but **prefer re-resolution** as manuscript changes to **avoid** stale state |

---

## Issue creation & PLAN-03 / research

| Option | Description | Selected |
|--------|-------------|----------|
| A | Context-first from research rows (primary) | |
| B | **New issue → name → then type** | ✓ |
| Separate `research-question` type | Yes / No | **No** — same issue families; differ by **association** and location |

**User's choice:** Generic **name then type** flow. **No** distinct research-question type; research-linked items are **questions/issues like others** with appropriate associations.

---

## Claude's Discretion

- Migration mechanics, pane fate, codicon specifics, span re-resolution algorithm.

## Deferred Ideas

- Backlog **999.1** — sidebar tree drill-down beyond counts.
- `master-issues.md` / AI session path — Phase 10+.
