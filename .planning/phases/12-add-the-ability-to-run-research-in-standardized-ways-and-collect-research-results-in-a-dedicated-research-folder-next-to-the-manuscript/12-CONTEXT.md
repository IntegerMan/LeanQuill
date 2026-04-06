# Phase 12: Standardized Research Workflow and Results Repository - Context

**Gathered:** 2026-04-05
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers a standardized research workflow for authors, invokable from AI agent harnesses (Copilot, Cursor, Claude), with results stored as structured markdown files in a dedicated research folder. The extension provides a sidebar section for browsing research results and a quick-start button that opens a pre-populated chat invocation. The research process itself runs as an AI skill that finds online sources, synthesizes findings, and produces a project-contextualized research document.

</domain>

<decisions>
## Implementation Decisions

### Research Folder Location & Safety Boundary
- **D-01:** Research results are stored in a `research/leanquill/` folder at the repository root by default. This is the tool-managed research space; authors can keep their own research at `research/` level outside the tool's subfolder.
- **D-02:** The folder path is configurable via `project.yaml` using the existing `folders.research` key. The default value changes from `notes/research/` to `research/leanquill/`.
- **D-03:** `project.yaml` schema version is bumped (from `"1"` to `"2"`). The extension detects older versions on activation and migrates — including updating `folders.research` to the new default.
- **D-04:** `SafeFileSystem` is updated to allow writing `.md` files within `{folders.research}` (resolved from `project.yaml`). Only markdown files are permitted — not arbitrary file types.

### Research Invocation & Sidebar
- **D-05:** Research is invoked as an AI skill/agent — not a dedicated LeanQuill command. The author triggers research from the AI chat panel (Copilot, Cursor, Claude) using the appropriate skill invocation syntax.
- **D-06:** The canonical research workflow definition is stored centrally in `.leanquill/` (e.g., `.leanquill/workflows/research.md`). Harness-specific entry points (`.github/agents/`, `.cursor/`, `.claude/`) all reference this canonical definition.
- **D-07:** Entry points are provided for Copilot, Cursor, and Claude — all three are first-class.
- **D-08:** The sidebar has a collapsible "Research" section listing detected research documents from `{folders.research}`. Each entry shows the research name (short summary) and date. Clicking opens the markdown file in the editor.
- **D-09:** The Research section header has a "+" button. Clicking it opens a new chat window pre-populated with the skill invocation command and placeholder text ("Replace with your research question") but does NOT send — the author edits and sends when ready.
- **D-10:** The extension detects the active AI harness and formats the pre-populated chat command accordingly (Copilot `@leanquill /research ...`, Cursor agent format, Claude slash command format, etc.).

### Research Skill Process
- **D-11:** Before doing anything, the skill reads project context — `project.yaml`, the outline (`outline-index.json`), and relevant manuscript content — to understand the book and the query in context.
- **D-12:** The skill asks clarifying questions when the query is ambiguous. Project context informs whether clarification is needed.
- **D-13:** The skill breaks the query into 1-5 core sub-topics, each researched independently as a mini-research job.
- **D-14:** Web search is required. If web search tools are unavailable in the harness, the skill warns the user that research quality will be degraded without it.
- **D-15:** Each sub-topic is researched using online sources (via subagents or web search tools), with notes collected and synthesized.
- **D-16:** The skill produces one markdown file per invocation, saved to `{folders.research}`.

### Research Result Format
- **D-17:** Each research file has YAML frontmatter: `name` (short summary for sidebar display), `query` (original user question), `created` (ISO timestamp), `tags` (freeform array, author-managed), `sources` (URLs found during research).
- **D-18:** No status field in frontmatter.
- **D-19:** Body structure is standardized:
  1. **Summary** — Quick overview of findings across all sub-topics
  2. **Sub-topic headings** (1-5) — Each core topic as its own major heading with findings
  3. **Sources** — All cited URLs with descriptions
  4. **Open Questions** — Things the research couldn't resolve or need verification
  5. **Project Relevancy** — 1-2 paragraphs connecting findings to the author's book project, informed by project context
- **D-20:** File naming follows existing slugification: `{topic-slug}-{date}.md` (e.g., `rigor-mortis-2026-04-05.md`).
- **D-21:** Flat folder organization — all files in `{folders.research}`, no subfolders. Subfolder organization is a future enhancement.

### Research-to-Story Linkage
- **D-22:** Tags in frontmatter allow topical grouping. No structural links to chapters, beats, or issues.
- **D-23:** The Project Relevancy section provides narrative connection to the story. No automatic backlink injection into other views.

### Claude's Discretion
- Exact structure of the canonical workflow definition file in `.leanquill/`
- How the extension detects which AI harness is active
- Implementation of the sidebar Research section (TreeView vs webview panel)
- Debounce/file-watching strategy for detecting new research documents
- How the research skill constructs prompts for sub-topic research
- Whether a research index JSON file is needed or filesystem scanning is sufficient for the sidebar

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Safety Boundary
- `src/safeFileSystem.ts` — Current write boundary implementation; needs allowlist update for `{folders.research}` `.md` files
- `Imported/v1-scope.md` — 5 non-negotiable design principles (AI never writes manuscript, all state repo-native)

### Data Contracts & Patterns
- `Imported/data-contracts/project-config-schema.md` — `project.yaml` schema; `folders.research` key and schema version migration
- `src/types.ts` — Existing type patterns (ChapterStatusIndex, OutlineIndex) for any index types needed

### Existing Modules
- `src/outlineStore.ts` — Pattern for JSON index CRUD if a research index is used
- `src/initialize.ts` — `project.yaml` template (lines 20-50); `folders.research` default, schema version
- `src/extension.ts` — Command registration, sidebar view registration, activation patterns
- `src/manuscriptSync.ts` — Slugification logic for title-to-filename conversion
- `src/chapterTree.ts` — TreeView pattern for sidebar sections (model for research tree)

### Skill/Agent Patterns
- `.github/copilot-instructions.md` — Project-level Copilot instructions for reference
- `.github/skills/` — Existing GSD skill file patterns for agent invocation structure

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `SafeFileSystem`: Path-based allowlist model — needs extension for `{folders.research}` `.md` files
- Slugification logic in `manuscriptSync.ts`: Reusable for research file naming
- `chapterTree.ts` TreeView: Pattern for the Research sidebar section
- `outlineStore.ts` index CRUD: Pattern if a research index file is needed

### Established Patterns
- Single JSON index files per domain (`outline-index.json`, `chapter-status-index.json`)
- VS Code TreeView API for sidebar sections
- Command registration in `extension.ts` activate function
- `project.yaml` with `schema_version` field (currently `"1"`)

### Integration Points
- `extension.ts` — Register Research sidebar view, "+" button command
- `project.yaml` — `folders.research` path resolution, schema version migration
- `safeFileSystem.ts` — Allowlist update for research folder
- `.leanquill/` — Canonical workflow definition storage
- `.github/agents/`, `.cursor/`, `.claude/` — Harness-specific entry points

</code_context>

<specifics>
## Specific Ideas

- Research should feel lightweight — the author has a question, clicks "+", types it in the chat, and gets a structured document back
- The canonical workflow in `.leanquill/` is the single source of truth — harness entry points are thin wrappers pointing to it
- The Project Relevancy section is what makes this more than generic AI research — it ties findings back to the author's specific book
- The sidebar Research section is browse-only in the extension — all research execution happens in the AI chat

</specifics>

<deferred>
## Deferred Ideas

- **Research results in Knowledge Pane** — Surfacing research in the Global Knowledge Pane (Phase 7) as a browsable section
- **Subfolder organization** — Topic-based subfolders within the research folder
- **Auto-linking research to beats/chapters** — Structural backlinks from research docs to story elements
- **Research templates per genre** — Pre-built templates (Location Research, Historical Period, etc.)
- **Research-question issue integration** — Right-click a `research-question` issue to trigger research (depends on Phase 8)

</deferred>

---

*Phase: 12-standardized-research-workflow-and-results-repository*
*Context gathered: 2026-04-05*
