# Phase 12: Standardized Research Workflow and Results Repository - Context

**Gathered:** 2026-04-05
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers a standardized way for authors to run research workflows and store the results in a dedicated, organized research folder. The author can initiate research from the VS Code command palette or from a research-question issue, execute the research (either manually documenting findings or via AI-assisted research), and have results persisted as structured markdown files in a git-versioned research folder. This phase covers the research execution surface and results repository — not the issue triage or research-question creation (that's Phase 8 PLAN-03).

</domain>

<decisions>
## Implementation Decisions

### Research Folder Location & Safety Boundary
- **D-01:** Research results are stored under `.leanquill/research/` — inside the existing SafeFileSystem write boundary. This avoids modifying the SafeFileSystem allowlist and keeps all tool-generated output within `.leanquill/`.
- **D-02:** The existing `project.yaml` `folders.research: notes/research/` path is for author-managed reference notes (read by the knowledge pane in Phase 7). `.leanquill/research/` is for tool-generated research results — a distinct concern. Both can coexist.
- **D-03:** Research results are organized in subdirectories by topic slug: `.leanquill/research/{topic-slug}/`. Each topic can hold multiple result files from different research sessions.

### Research Workflow Triggers & Invocation
- **D-04:** Primary trigger is a VS Code command palette command: "LeanQuill: Run Research". This opens a quick-pick flow where the author specifies a research topic/question.
- **D-05:** Secondary trigger: right-click on a `research-question` issue (from Phase 8) and choose "Research This" — pre-populates the research topic from the issue title/description. This is a stretch goal that depends on Phase 8 being complete; if Phase 8 isn't done yet, only the command palette trigger ships.
- **D-06:** Research can be either manual (author documents findings in a generated template file) or AI-assisted (VS Code LM API generates a research brief that the author reviews and edits). Both paths produce the same output format.
- **D-07:** AI-assisted research uses the VS Code Language Model API (consistent with the project's "VS Code LM API only — no external keys in v1" decision). The AI researches within the project context (notes, manuscript excerpts the author selects) and produces a draft research document.

### Research Result Format & Structure
- **D-08:** Each research result is a single markdown file with YAML frontmatter: `{ schema_version: "1", topic: string, question: string, created: ISO date, updated: ISO date, status: "draft" | "reviewed" | "archived", linked_chapters: string[], linked_issues: string[], tags: string[] }`.
- **D-09:** The body of the file is freeform markdown with suggested sections: Summary, Key Findings, Sources, Open Questions, and Notes. The author can modify/extend freely.
- **D-10:** File naming convention follows the existing slugification pattern: `{topic-slug}-{ISO-date-short}.md` (e.g., `submarine-navigation-2026-04-05.md`).
- **D-11:** A research index file is maintained at `.leanquill/research/research-index.json` — listing all research results with metadata for quick lookup without scanning the filesystem. Follows the same single-index-file pattern as `outline-index.json` and `chapter-status-index.json`.

### Research-to-Story Linkage
- **D-12:** Research results link to chapters and issues via the frontmatter `linked_chapters` and `linked_issues` arrays. These are manually managed by the author (typed as chapter file names and issue IDs).
- **D-13:** No automatic backlink injection into other views in this phase. Cross-referencing research from the knowledge pane, chapter context pane, or issue views is deferred to a future enhancement.
- **D-14:** Tags in frontmatter (`tags: string[]`) allow topical grouping. Tags are freeform strings defined by the author.

### Claude's Discretion
- Implementation details for the research index JSON schema (exact fields beyond what's in D-11)
- Debounce/auto-save strategy for research files (can follow the pattern established in Phase 3 D-28)
- Exact quick-pick flow UX for the "Run Research" command
- How AI-assisted research prompts are constructed (as long as they use VS Code LM API and respect manuscript write-block)
- Whether to show a tree view for research results in the sidebar or keep it file-explorer based initially

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Safety Boundary
- `src/safeFileSystem.ts` — Defines the write boundary; research writes to `.leanquill/research/` must pass `canWrite()`
- `Imported/v1-scope.md` — 5 non-negotiable design principles (especially #1: AI never writes manuscript, #3: all state repo-native)

### Data Contracts & Patterns
- `Imported/data-contracts/project-config-schema.md` — `project.yaml` schema; `folders.research` convention for author notes
- `Imported/data-contracts/issue-schema.md` — Issue schema including `research-question` type (Phase 8 dependency)
- `src/types.ts` — Existing type patterns (ChapterStatusIndex, OutlineIndex) to follow for research index

### Existing Modules
- `src/outlineStore.ts` — Pattern for JSON index file CRUD (read/write/bootstrap)
- `src/initialize.ts` — Project scaffolding patterns; `project.yaml` template includes `research: notes/research/`
- `src/extension.ts` — Command registration and activation patterns

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `SafeFileSystem`: Already allows writes under `.leanquill/` — no changes needed for `.leanquill/research/`
- `outlineStore.ts` read/write pattern: Can be adapted for `research-index.json` CRUD
- Slugification logic: Exists in `manuscriptSync.ts` for title-to-filename conversion
- `types.ts` pattern: Well-established interface/index pattern to follow

### Established Patterns
- Single JSON index files per domain (outline-index.json, chapter-status-index.json) — research-index.json follows this
- VS Code command palette registration in `extension.ts`
- YAML frontmatter in markdown files (used in beat editor documents)
- Auto-save with debounce (Phase 3 D-28)

### Integration Points
- `extension.ts` activate function — register new "Run Research" command
- `.leanquill/` directory — new `research/` subdirectory
- Future: Phase 8 issue context menu for "Research This" trigger

</code_context>

<specifics>
## Specific Ideas

- Research results should feel like first-class project artifacts — versioned, organized, and discoverable alongside manuscript and notes
- The workflow should be lightweight: an author with a quick question should be able to create a research stub in under 30 seconds
- AI-assisted research is a convenience layer, not a requirement — manual research documentation is the baseline capability
- The research index should be fast to query so future phases can surface research in context panes without performance concerns

</specifics>

<deferred>
## Deferred Ideas

- **Research results in Knowledge Pane** — Surfacing research results in the Global Knowledge Pane (Phase 7) as a browsable section. Belongs in a future knowledge enhancement phase.
- **Auto-linking research to beats** — Automatically detecting when research topics match beat who/where/what fields. Too complex for initial implementation.
- **Research templates per genre** — Pre-built research templates (e.g., "Location Research", "Historical Period", "Technical Domain"). Nice-to-have but not essential for v1.
- **Web search integration** — Direct web search from within the research workflow. Out of scope per "VS Code LM API only" policy and local-first principles.

</deferred>

---

*Phase: 12-standardized-research-workflow-and-results-repository*
*Context gathered: 2026-04-05*
