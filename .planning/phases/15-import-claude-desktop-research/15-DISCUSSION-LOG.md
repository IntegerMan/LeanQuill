# Phase 15: Import Claude Desktop research - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `15-CONTEXT.md` — this log preserves the alternatives considered.

**Date:** 2026-04-11
**Phase:** 15-import-claude-desktop-research
**Areas discussed:** Import trigger & payload, Canonical workflow & harness naming, Normalization to Phase 12 format, Filename collisions

---

## Import trigger & payload

| Option | Description | Selected |
|--------|-------------|----------|
| Sidebar + extension-only transform | Import button runs file picker / paste inside extension | |
| Sidebar drafts chat for import skill | Same family as `+` / `startResearch`: open chat, partial query, user attaches content | ✓ |
| Command-only entry | Palette without sidebar button | |

**User's choice:** Import works **via AI chat**. Sidebar **Import** **drafts** a message referencing the **import** skill/agent (**not sent**). User sends after attaching content in whatever form the harness supports (text, txt, md, PDF, Word, etc., model-dependent).

**Notes:** Extension does not own MIME enumeration; harness capabilities define attachment types.

---

## Canonical workflow & harness naming

| Option | Description | Selected |
|--------|-------------|----------|
| Keep legacy short names (`researcher` only) | Minimal change | |
| LeanQuill-prefixed names + same 3-harness pattern | `LeanQuill-Researcher`, `LeanQuill-Import-Research`; canonical `.leanquill/workflows/` + thin Copilot/Cursor/Claude hooks | ✓ |

**User's choice:** Follow existing **Claude / Cursor / Copilot** harness pattern; rename so agents start with **LeanQuill** (examples: **LeanQuill-Researcher**, **LeanQuill-Import-Research**).

**Notes:** Exact file paths and invocation strings remain implementation detail per product.

---

## Normalization to Phase 12 research format

| Option | Description | Selected |
|--------|-------------|----------|
| Strict schema validation | Reject messy imports | |
| Best-effort + defaults + preserve orphan content | Align with prior discuss-phase recommendation | ✓ |

**User's choice:** Confirmed — best-effort normalization, sensible defaults, do not drop unmapped content.

---

## Filename collisions

| Option | Description | Selected |
|--------|-------------|----------|
| Extension auto numeric suffix | `foo-2026-04-11-2.md` | |
| AI agent picks alternate slug | Still `{slug}-{YYYY-MM-DD}.md`; agent lists dir and avoids overwrite | ✓ |
| Modal prompt author | | |

**User's choice:** On collision, **AI agent** picks a **different filename** obeying **slug + date** rules.

---

## Claude's Discretion

- Per-harness draft strings and attachment UX
- Co-shipping **LeanQuill-Researcher** rename with import vs ordering of tasks
- Binary file fallbacks when model cannot read PDF/Word

## Deferred Ideas

- Extension-only import pipeline
- Batch folder import
- Migration strategy for existing `researcher` harness files
