# Phase 17: AI Story Chat, Memory, and Metadata Actions - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-25
**Phase:** 17-ai-story-chat-memory-and-metadata-actions
**Areas discussed:** Chat entry points and scope, durable memory and notes, metadata action contracts, safety/review approval

---

## Chat Entry Points and Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Both general and contextual story chat | General Story Chat command plus contextual entry points from issues/entities/research; covers broad questions while reusing context-first patterns. | ✓ |
| General only | General Story Chat command/panel only; simpler but less connected. | |
| Contextual only | Contextual entry points only; tighter but no open-ended story companion. | |
| You decide | Planner chooses most coherent pattern. | |

**User's choice:** Both a general Story Chat command and contextual entry points.
**Notes:** Context should be selected entry context plus lightweight project indexes. Manuscript prose is included only when the entry point implies it and must be bounded to relevant chapter/selection or explicit author-approved chapter set. Each session should save a chat-log summary and may produce optional structured artifacts.

---

## Durable Memory and Notes

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated LeanQuill memory files | `.leanquill/memory/` records separate from author notes. | ✓ |
| Existing notes | Write directly into character/place/thread/theme/research notes. | |
| Chat logs only | Use chat logs as the only durable memory. | |
| You decide | Planner chooses storage model. | |

**User's choice:** Dedicated `.leanquill/memory/` records.
**Notes:** Memory should be organized as topic-linked records associated with existing LeanQuill contexts. Session summaries should be saved automatically as memory. Memory should support status/recency metadata and superseding older records rather than destructive overwrite.

---

## Metadata Action Contracts

| Option | Description | Selected |
|--------|-------------|----------|
| LeanQuill and notes metadata | Issues, memory, chat logs, character/place/thread/theme frontmatter, and research associations; excludes manuscript prose. | ✓ |
| LeanQuill only | Only `.leanquill/` tool state. | |
| Broad notes body | Also allow approved edits to freeform story note bodies. | |
| You decide | Planner chooses allowed contract surface. | |

**User's choice:** LeanQuill state plus story-note metadata.
**Notes:** Actions should be structured records with operation, target path, field path, old value if known, new value, rationale, and source chat id. The extension validates and applies accepted actions via `SafeFileSystem`. Contract docs should live in canonical `.leanquill/workflows/` files with thin Cursor/Copilot/Claude entry points.

---

## Safety and Review Approval

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-apply low-risk changes | Auto-apply low-risk chat logs/session memory; review story-note/entity changes. | ✓ |
| Staged review/apply for all changes | No silent metadata writes from chat. | |
| Direct after consent | Ask once at session start, then apply accepted categories directly. | |
| You decide | Planner chooses approval model. | |

**User's choice:** Auto-apply low-risk artifacts, require review for riskier metadata.
**Notes:** Review should happen inline in the AI chat for v1, not a new Planning workspace review queue. Applied and rejected actions should be captured in the chat log and compact action log. Hard blocks: manuscript prose writes, unconfigured paths, destructive deletes without explicit author action, and schema-invalid metadata.

---

## Claude's Discretion

- Exact command names, labels, memory schema, action-log path, validation layering, and harness-specific copy.

## Deferred Ideas

None.
