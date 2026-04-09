# Phase 13: LeanPub Workspace Initialization - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-08
**Phase:** 13-leanpub-workspace-initialization
**Areas discussed:** (1) Setup visibility & copy, (2) SafeFileSystem, (3) Generated files, (4) Post-success UX

---

## Area 1 — Setup visibility, eligibility, copy

**Q:** When should the affordance appear, and how does it relate to Initialize?

**User's choice:** Show when **any** of: no `.leanquill`, no `project.yaml` in `.leanquill`, **`project.yaml` invalid**, or **scaffolding incomplete** defined as **missing `manuscript/` OR missing `manuscript/Book.txt`** (not gated on “at least one `.md`” alone). Keep the **existing Setup / Initialize** surface; **change what the action does** rather than adding a separate scaffold UI. **Audit copy** that implies the user must already have opened a LeanQuill-specific folder.

**Notes:** An early mistaken “Continue” was **not** consent; context was rewritten after this walkthrough.

---

## Area 2 — SafeFileSystem and safety

| Topic | Selected |
|-------|----------|
| Allowlist strategy | **Claude decides** scoped mode vs dedicated APIs; **no** blanket `manuscript/*.md` for all callers |
| SafeFileSystem vs raw `fs` | **Impartial**; must **not overwrite** existing files |
| Audit | **Yes** — log what was created/skipped (output channel) |

---

## Area 3 — Generated files

| Topic | Selected |
|-------|----------|
| Existing `ch1.md` (case-insensitive) | **Do not** create/overwrite; **use** file; when **creating** missing `Book.txt`, **reference** actual basename |
| Existing `Book.txt` | **Never modify**; **create only** when missing |
| New file body | `# Chapter 1` + short stub |
| Default name | `ch1.md` |

**Notes:** **Conflict:** If `Book.txt` **exists** and omits `ch1.md`, auto-wiring would require editing `Book.txt` — **forbidden** by user choice → handled in Area 4 / CONTEXT D-18.

---

## Area 4 — Post-success UX

| Topic | Selected |
|-------|----------|
| Primary navigation after success | **Not** chapter editor as primary — **open Planning Workspace webview on Cards tab** (extend `PlanningPanelProvider` like `showCharacter`) |
| Notification | **Toast + output channel** |
| Refresh | **Claude decides** minimal refresh; **no window reload** |
| Blocked flow (existing `Book.txt`) | **Claude decides** error vs modal; must be **actionable** |

---

## Claude's Discretion

- SafeFileSystem mechanism, refresh sequence, D-18 presentation, invalid `project.yaml` rules.

## Deferred Ideas

None.
