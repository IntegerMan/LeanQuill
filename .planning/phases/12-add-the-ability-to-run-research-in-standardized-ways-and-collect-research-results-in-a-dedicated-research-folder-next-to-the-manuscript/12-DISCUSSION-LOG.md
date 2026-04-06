# Phase 12: Standardized Research Workflow and Results Repository - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-05
**Phase:** 12-standardized-research-workflow-and-results-repository
**Areas discussed:** Research folder location & safety boundary, Research workflow triggers & invocation, Research result format & structure, Research-to-story linkage

---

## Research Folder Location & Safety Boundary

| Option | Description | Selected |
|--------|-------------|----------|
| `.leanquill/research/` | Inside existing SafeFileSystem boundary, no changes needed | ✓ |
| `research/` (adjacent to manuscript) | New top-level folder, requires SafeFileSystem allowlist update | |
| `notes/research/` | Existing project.yaml convention, but conflicts with author-managed notes | |

**Decision:** `.leanquill/research/` — stays within the existing write boundary. `notes/research/` remains the author's manually-managed reference folder.
**Notes:** Auto-selected based on Safety Boundary design principle and existing SafeFileSystem constraints. Avoids modifying the core safety boundary for a feature addition.

---

## Research Workflow Triggers & Invocation

| Option | Description | Selected |
|--------|-------------|----------|
| Command palette only | Simple, consistent with existing LeanQuill commands | ✓ (primary) |
| Issue context menu "Research This" | Pre-populates from research-question issues (Phase 8 dependency) | ✓ (secondary/stretch) |
| Dedicated sidebar panel | Heavier UI surface, may not be needed initially | |

**Decision:** Command palette as primary trigger; issue context menu as stretch goal dependent on Phase 8.
**Notes:** Both manual and AI-assisted paths available from the same entry point.

---

## Research Result Format & Structure

| Option | Description | Selected |
|--------|-------------|----------|
| Markdown + YAML frontmatter | Consistent with beat editor docs, git-friendly, human-readable | ✓ |
| Pure JSON | Machine-friendly but poor authoring experience | |
| Structured YAML files | Less familiar for prose-heavy content | |

**Decision:** Markdown with YAML frontmatter following the beat editor document pattern.
**Notes:** Research index JSON file (`research-index.json`) provides machine-queryable metadata alongside the human-readable markdown files.

---

## Research-to-Story Linkage

| Option | Description | Selected |
|--------|-------------|----------|
| Manual frontmatter links | Author adds chapter/issue references in YAML frontmatter | ✓ |
| Automatic backlink injection | Tool scans and injects links into other views | |
| Tag-based discovery | Freeform tags for topical grouping | ✓ (complementary) |

**Decision:** Manual frontmatter links (`linked_chapters`, `linked_issues`) plus freeform tags. No automatic cross-view injection in this phase.
**Notes:** Auto-linking and knowledge pane integration deferred to future phases.

---

## Claude's Discretion

- Research index JSON exact schema (beyond metadata listed in D-11)
- Debounce/auto-save strategy
- Quick-pick UX flow details
- AI prompt construction for assisted research
- Sidebar tree view vs file explorer for browsing results

## Deferred Ideas

- Research results in Knowledge Pane (future knowledge enhancement)
- Auto-linking research to beats
- Research templates per genre
- Web search integration
