# Phase 5: Place and Setting Reference - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `05-CONTEXT.md` — this log preserves the alternatives considered.

**Date:** 2026-04-09
**Phase:** 5-place-and-setting-reference
**Areas discussed:** Profile shape & list organization

---

## Profile shape & list organization

| Option | Description | Selected |
|--------|-------------|----------|
| Q1:A | Same shape as characters: `name`, `aliases`, `category` (replaces role), `description`, custom fields + body | ✓ |
| Q1:B | Place-forward: `name`, `aliases`, `region`, `placeType`, `description`, custom | |
| Q1:C | Minimal: `name` only + Add field / body | |

| Option | Description | Selected |
|--------|-------------|----------|
| Q2:A | Aliases like characters (for future manuscript match) | |
| Q2:B | Aliases optional — may be empty/omitted | ✓ |
| Q2:C | Name only for v1 | |

| Option | Description | Selected |
|--------|-------------|----------|
| Q3:A | Group by `category` | |
| Q3:B | Group by `region` | ✓ |
| Q3:C | Flat list, alphabetical | |

| Option | Description | Selected |
|--------|-------------|----------|
| Q4:A | Sort A→Z by `name` within group | ✓ |
| Q4:B | Manual/pinned order (`sortKey`) | |
| Q4:C | Claude's discretion | |

**User's choice:** Q1:A, Q2:B, Q3:B, Q4:A

**Notes:** `region` was added as an explicit default frontmatter field so Q3:B (group by region) is well-defined alongside Q1:A's `category`. Empty/missing `region` → **Uncategorized** group (see CONTEXT). User selected **ready for context** after these answers; gray areas 1 (linking), 2 (config/path), and 4 (full UX parity) were not discussed — captured as planner inputs in CONTEXT.

---

## Claude's Discretion

- (None explicitly chosen via "you decide" in Q4; Q4:A locked sort order.)

## Deferred Ideas

- None recorded as future-phase backlog from this session.
