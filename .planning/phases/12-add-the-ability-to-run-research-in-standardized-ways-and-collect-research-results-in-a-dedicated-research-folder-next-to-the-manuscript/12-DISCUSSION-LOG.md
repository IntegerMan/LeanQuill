# Phase 12: Standardized Research Workflow and Results Repository - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-05
**Phase:** 12-standardized-research-workflow-and-results-repository
**Areas discussed:** Research folder location, Research invocation flow, Result file format & organization, AI-assisted research skill, Research-to-story linkage

---

## Research Folder Location

| Option | Description | Selected |
|--------|-------------|----------|
| `.leanquill/research/` | Inside safety boundary, no SafeFileSystem changes | |
| `notes/research/` | Alongside author notes, outside safety boundary | |
| Author-configurable via `project.yaml` | Use `folders.research` key | |
| `research/leanquill/` at repo root | Dedicated tool subfolder, author research alongside | ✓ |

**User's choice:** Top-level `research/` folder with tool output scoped to `research/leanquill/`. Default `folders.research` = `research/leanquill/`. SafeFileSystem updated to allow `.md` files in that path.
**Notes:** User wants author-collected and tool-collected research in the same area. Changed the existing `folders.research` default from `notes/research/` to `research/leanquill/`. Schema version bump with migration logic for older configs.

---

## Research Invocation Flow

| Option | Description | Selected |
|--------|-------------|----------|
| Command palette only | "LeanQuill: New Research" quick-pick | |
| Command palette + context menu | Right-click outline nodes → "Research This" | |
| AI skill/agent invocation | Triggered from AI chat (Copilot, Cursor, Claude) | ✓ |

**User's choice:** Research is an AI skill, not a LeanQuill command. Canonical workflow stored in `.leanquill/`, with entry points for Copilot, Cursor, and Claude. Sidebar "Research" section with "+" button opens pre-populated chat.
**Notes:** User emphasized all three harnesses (Copilot, Cursor, Claude) must be first-class. Extension detects active harness and formats chat command accordingly. Button no longer near outline view — replaced by "+" on sidebar Research section header.

---

## Result File Format & Organization

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal frontmatter | Just name + query + date | |
| Full frontmatter with status | name, query, created, status, tags, sources, linked_chapters | |
| Frontmatter without status | name, query, created, tags, sources | ✓ |

**User's choice:** Frontmatter: `name`, `query`, `created`, `tags`, `sources`. No status field. Standardized body structure with sub-topic headings. Flat folder, `{topic-slug}-{date}.md` naming.
**Notes:** User specified the `name` field for sidebar display. Body structure: Summary → Sub-topic headings (1-5, each a major heading from independent mini-research) → Sources → Open Questions → Project Relevancy. No "Notes" section — user removed it.

---

## AI-Assisted Research Skill

| Option | Description | Selected |
|--------|-------------|----------|
| AI optional, manual baseline | Template + manual documentation, AI as enhancement | |
| AI-driven with clarifying questions | Skill reads context, asks questions, researches sub-topics | ✓ |

**User's choice:** AI skill reads project context first, asks clarifying questions when ambiguous, breaks query into 1-5 sub-topics, researches each independently with web search, synthesizes into one document. Web search required — warn if unavailable.
**Notes:** User wants the skill to review project context/outline before asking clarifying questions. This informs whether clarification is needed and helps the skill understand query context. Project Relevancy section requires loading outline + manuscript content.

---

## Research-to-Story Linkage

| Option | Description | Selected |
|--------|-------------|----------|
| No explicit linkage | Research docs exist, AI tools can read them naturally | |
| Frontmatter links | `linked_chapters`, `linked_beats` arrays | |
| Tags only | Freeform tags for topical grouping | ✓ |

**User's choice:** Tags only. No structural links to chapters, beats, or issues. Project Relevancy section provides narrative connection.
**Notes:** User noted research is done heavily at start and then as-needed during drafting. Structural linking would be over-engineering for the actual usage pattern.

---

## Claude's Discretion

- Exact structure of canonical workflow definition in `.leanquill/`
- How extension detects active AI harness
- Sidebar implementation (TreeView vs webview)
- File-watching strategy for new research documents
- Whether research index JSON is needed vs filesystem scanning
- Prompt construction for sub-topic research

## Deferred Ideas

- Research results in Knowledge Pane (Phase 7 enhancement)
- Subfolder organization within research folder
- Auto-linking research to beats/chapters
- Research templates per genre
- Research-question issue integration (Phase 8 dependency)
