# Phase 2: Core Chapter Workflow - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md - this log preserves the alternatives considered.

**Date:** 2026-03-29
**Phase:** 2-core-chapter-workflow
**Areas discussed:** Chapter status model, Tree workflow behavior, Context pane behavior, Missing-data and edge cases

---

## Chapter status model

| Option | Description | Selected |
|--------|-------------|----------|
| Use CHAP requirement statuses | planning/not-started/drafting/draft-complete/editing/review-pending/final | ✓ |
| Use imported schema statuses | planned/drafting/self-edit/ai-review/ready/published | |
| Use a hybrid mapped set | Store one set, render another with mapping layer | |

**User's choice:** Use CHAP requirement statuses
**Notes:** Preferred alignment with roadmap and requirements.

| Option | Description | Selected |
|--------|-------------|----------|
| Single chapter-status index file | Store all chapter states in one `.leanquill` JSON file | ✓ |
| One file per chapter | More granular diffs, more IO complexity | |
| In-memory only for now | Faster to build, no persistence | |

**User's choice:** Single chapter-status index file

| Option | Description | Selected |
|--------|-------------|----------|
| Default to not-started | Lifecycle-consistent default | ✓ |
| Default to planning | Treat untouched chapters as planning | |
| Show Unknown until explicitly set | Explicit, but noisier UI | |

**User's choice:** Default to not-started

| Option | Description | Selected |
|--------|-------------|----------|
| Show warning and fallback to not-started | Continue workflow while surfacing data issue | ✓ |
| Block UI until fixed | Strict, but disruptive | |
| Silently coerce to nearest status | Smooth UX, lower transparency | |

**User's choice:** Show warning and fallback to not-started

---

## Tree workflow behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Title + status + open issue count | Matches CHAP-01 | ✓ |
| Title + status only | Less clutter, less signal | |
| Title + status + issue count + word count | Richer, heavier MVP | |

**User's choice:** Title + status + open issue count

| Option | Description | Selected |
|--------|-------------|----------|
| Single click opens in active editor | Direct open behavior | |
| Double click opens | Reduced accidental opens | |
| Single click preview, double click pin | Native editor-style interaction | ✓ |

**User's choice:** Single click preview, double click pin

| Option | Description | Selected |
|--------|-------------|----------|
| Context menu action + quick pick | Predictable status update flow | ✓ |
| Inline dropdown on each row | Faster but heavier tree UI | |
| Command palette only | Simple, low discoverability | |

**User's choice:** Context menu action + quick pick

| Option | Description | Selected |
|--------|-------------|----------|
| Always strict project order from chapter-order source | Preserves authoritative order | ✓ |
| Allow temporary sort by status | Adds triage view | |
| User-toggle between project order and status order | Flexible, more complexity | |

**User's choice:** Always strict project order from chapter-order source

---

## Context pane behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Status + open issues + last session notes | Direct CHAP-04 scope | ✓ |
| Status only | Minimal pane | |
| Status + open issues + notes + extra analytics | Beyond phase scope | |

**User's choice:** Status + open issues + last session notes

| Option | Description | Selected |
|--------|-------------|----------|
| On active chapter file change + on status update completion | Core trigger set | ✓ |
| On every editor/cursor/text change | Very reactive, high noise | |
| Manual refresh only | Lowest implementation complexity | |

**User's choice:** On active chapter file change + on status update command completion

| Option | Description | Selected |
|--------|-------------|----------|
| Show neutral "No chapter selected" state | Explicit inactive state | |
| Keep showing last chapter context | Continuity-first behavior | ✓ |
| Hide the pane content entirely | Minimal inactive UI | |

**User's choice:** Keep showing last chapter context

| Option | Description | Selected |
|--------|-------------|----------|
| Use same quick-pick status command as tree | Shared behavior path | ✓ |
| Inline dropdown in pane | More direct, more custom UI | |
| Read-only in pane for now | Lower complexity, reduced parity | |

**User's choice:** Use same quick-pick status command as tree

---

## Missing-data and edge cases

| Option | Description | Selected |
|--------|-------------|----------|
| Show placeholder row flagged as missing | Keeps ordering visible and surfaces mismatch | ✓ |
| Silently skip missing entries | Cleaner tree, lower visibility | |
| Fail and block tree rendering | Strict consistency, poor resilience | |

**User's choice:** Show placeholder row flagged as missing

| Option | Description | Selected |
|--------|-------------|----------|
| Show 0 with pending integration semantics | Keeps CHAP-01 shape now | ✓ |
| Hide issue count column until Phase 5 | Simpler, requirement drift risk | |
| Show unknown marker (?) for all chapters | Explicit uncertainty | |

**User's choice:** Show 0 with pending integration semantics

| Option | Description | Selected |
|--------|-------------|----------|
| Show empty-state message placeholder | Transparent upcoming feature section | |
| Hide notes section entirely | Keep pane tighter in Phase 2 | ✓ |
| Show stub demo text | Useful preview, potential confusion | |

**User's choice:** Hide notes section entirely

| Option | Description | Selected |
|--------|-------------|----------|
| Append at end under "Unordered" group | Visibility with authority preserved | |
| Exclude until chapter-order refresh updates source | Strict source-of-truth view | |
| Auto-insert by natural sort into main list | Convenience-first | |
| Append at end under "Not Included" group | LeanPub publish semantics reflected | ✓ |

**User's choice:** Append at the end under a "Not Included" group. LeanPub will ignore these chapters on publish.

---

## the agent's Discretion

- Warning wording and notification design.
- Exact badge and placeholder visual treatment.

## Deferred Ideas

- None.
