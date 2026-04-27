# Phase 9: AI Safety Rails and Persona Baseline - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-25
**Phase:** 09-ai-safety-rails-and-persona-baseline
**Areas discussed:** Packaged persona defaults, persona enable/disable config, AI write-block enforcement depth, custom persona authoring guardrails

---

## Packaged Persona Defaults

| Option | Description | Selected |
|--------|-------------|----------|
| Base schema strictness A | Full persona schema for packaged defaults | ✓ |
| Base schema strictness B | Reduced minimal schema now, expand later | |
| Base schema strictness C | Hybrid file/runtime subset model | |

| Option | Description | Selected |
|--------|-------------|----------|
| Persona IDs A | `casual-reader`, `avid-genre-fan`, `copy-editor` | ✓ |
| Persona IDs B | Sample-style ids from docs | |
| Persona IDs C | Namespaced default ids | |

| Option | Description | Selected |
|--------|-------------|----------|
| Differentiation A | Light differences only | |
| Differentiation B | Distinct `context_access` + `feedback` priorities | ✓ |
| Differentiation C | Maximum differentiation across all fields | |

| Option | Description | Selected |
|--------|-------------|----------|
| Storage A | Generate real persona files in `.leanquill/personas/` during initialize | ✓ |
| Storage B | Keep in code; write on first edit | |
| Storage C | Template-only until first AI run | |

**User's choice:** `1A, 2A, 3B, 4A`  
**Notes:** Locked to roadmap naming and full-schema packaged defaults.

---

## Persona Enable/Disable Model

| Option | Description | Selected |
|--------|-------------|----------|
| Config shape A | `active_personas` as `{ id, enabled }[]` | ✓ |
| Config shape B | `active_persona_ids: string[]` only | |
| Config shape C | Dual-format compatibility model | |

| Option | Description | Selected |
|--------|-------------|----------|
| Initialize defaults A | Seed all three defaults enabled | ✓ |
| Initialize defaults B | Seed all defaults disabled | |
| Initialize defaults C | Seed one enabled, two disabled | |

| Option | Description | Selected |
|--------|-------------|----------|
| Missing refs A | Hard-fail AI action | |
| Missing refs B | Warn and skip missing persona | ✓ |
| Missing refs C | Auto-create placeholder persona | |

| Option | Description | Selected |
|--------|-------------|----------|
| Disabled behavior A | Ignore disabled personas at runtime | ✓ |
| Disabled behavior B | Show in UI outputs but do not run | |
| Disabled behavior C | Preview-only run mode | |

**User's choice:** `1A, 2A, 3B, 4A`
**Notes:** Strong compatibility with current project schema contract.

---

## AI Write-Block Enforcement Depth

| Option | Description | Selected |
|--------|-------------|----------|
| Enforcement A | Filesystem boundary only | |
| Enforcement B | Contract validation only | |
| Enforcement C | Defense in depth: contract + filesystem | ✓ |

| Option | Description | Selected |
|--------|-------------|----------|
| Book.txt exception A | Keep exception for AI operations | |
| Book.txt exception B | Block AI writes to Book.txt; keep exception for non-AI scaffold flows | ✓ |
| Book.txt exception C | Allow with explicit approval each time | |

| Option | Description | Selected |
|--------|-------------|----------|
| Unsafe action A | Reject + audit log + user error | ✓ |
| Unsafe action B | Auto-rewrite to safe path | |
| Unsafe action C | Queue for manual review | |

| Option | Description | Selected |
|--------|-------------|----------|
| Approval baseline A | Low-risk memory/chat auto; entity/theme/research/issue updates require approval | ✓ |
| Approval baseline B | Approval required for all metadata actions | |
| Approval baseline C | No approvals in Phase 9 | |

**User's choice:** `1C, 2B, 3A, 4A` (interpreted from `21C` typo as `1C`)
**Notes:** Chosen model emphasizes auditable hard-fail behavior over auto-correction.

---

## Custom Persona Authoring Guardrails

| Option | Description | Selected |
|--------|-------------|----------|
| Validation A | Strict hard-fail on any schema violation | |
| Validation B | Hybrid validation: core hard-fail, non-critical warn/default | ✓ |
| Validation C | Warnings only, never block | |

| Option | Description | Selected |
|--------|-------------|----------|
| Unknown fields A | Reject unknown fields | |
| Unknown fields B | Preserve unknown fields, ignore at runtime | ✓ |
| Unknown fields C | Move unknown fields into `custom` | |

| Option | Description | Selected |
|--------|-------------|----------|
| Bad persona A | Skip invalid persona, continue run, summarize warning | ✓ |
| Bad persona B | Abort run if any enabled persona invalid | |
| Bad persona C | Auto-disable silently | |

| Option | Description | Selected |
|--------|-------------|----------|
| Feedback surface A | LeanQuill output channel + concise toast | ✓ |
| Feedback surface B | Toast only | |
| Feedback surface C | Inline diagnostics only | |

**User's choice:** `1B, 2B, 3A, 4A`
**Notes:** Balances reliability and ergonomics for custom persona authoring.

---

## Claude's Discretion

- Exact persona defaults for numeric expertise dimensions.
- Validator internals and warning string phrasing.

## Deferred Ideas

None.
