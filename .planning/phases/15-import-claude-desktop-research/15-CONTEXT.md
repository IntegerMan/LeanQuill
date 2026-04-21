# Phase 15: Import Claude Desktop research - Context

**Gathered:** 2026-04-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Authors bring **external research** (including work done in **Claude Desktop** or other tools) into the project’s **standardized Research notes** — the same on-disk format and folder as Phase 12 (`folders.research`, frontmatter + body contract). The extension provides a **Research sidebar** path that **starts an AI chat** with the right **import** skill/agent (message **drafted, not sent**). The **AI agent** performs **best-effort normalization** into the Phase 12 research document shape and **writes** the result under `folders.research`. Supported **input media** (paste, `.txt`, `.md`, PDF, Word, etc.) are **whatever the active chat harness and model support** — not fixed by the extension.

</domain>

<decisions>
## Implementation Decisions

### Import via AI chat (sidebar + parity with “+” research)
- **D-01:** **Import** is **chat-first**, not an extension-only file transform. Clicking **Import** in the Research sidebar **opens AI chat** with a **pre-filled, unsent** message that invokes the **LeanQuill import** skill/agent (same overall pattern as `leanquill.startResearch` / **`+`** for research).
- **D-02:** The extension **does not send** the message; the author **edits, attaches, and sends** when ready.
- **D-03:** The author supplies source material through **harness-native** means: pasted text, file attachments, or uploads — **including** raw text, `.txt`, `.md`, **PDF**, **Word**, etc., **as supported by that chat product**. The extension does not enumerate or enforce a single MIME list beyond what the chat UI allows.

### Harness pattern and LeanQuill-prefixed agent naming
- **D-04:** Follow the **same three-harness pattern** as Phase 12: canonical workflow under **`.leanquill/workflows/`**, with **thin** entry points for **Copilot**, **Cursor**, and **Claude** (equivalent to `writeHarnessEntryPoints` in `initialize.ts`).
- **D-05:** **User-facing and agent naming** uses a **LeanQuill-** prefix for discoverability and consistency, e.g. **`LeanQuill-Researcher`** (existing research flow) and **`LeanQuill-Import-Research`** (import flow). Planning/implementation should align **display names**, skill/agent titles, and chat **draft** strings with these names (exact harness invocation syntax may differ per product — mirror how `@researcher` / `/agent:researcher` are handled today, but updated to the new names).
- **D-06:** Add a **new canonical workflow** file for import (e.g. `.leanquill/workflows/import-external-research.md` — filename is implementation detail; content defines normalization + save rules). **LeanQuill-Import-Research** reads and executes that contract.

### Normalization to Phase 12 research format
- **D-07:** **Best-effort** mapping into Phase 12 **frontmatter** (`name`, `query`, `created`, `tags`, `sources`) and **body** sections (Summary, sub-topics, Sources, Open Questions, Project Relevancy). **Do not drop** unmapped content — park it under **Summary** and/or a clearly labeled **Imported content** subsection.
- **D-08:** **`created`:** default to **import-time ISO** unless the source has a **reliable** explicit date (do not infer from vague prose).
- **D-09:** **`sources`:** populate from obvious URLs in the source when possible; otherwise `[]`.
- **D-10:** **`query`:** from author clarification in chat and/or inferred from headings/first lines; use a clear placeholder if still unknown after import.
- **D-11:** **Preview / save:** Prefer **agent writes** the final `.md` directly into `folders.research` per workflow (author sees result in repo). If the harness cannot write files, fall back to **showing** markdown for manual save — **Claude’s discretion** in planning which path is primary per harness.

### Filename collisions
- **D-12:** On **collision** with `{topic-slug}-{YYYY-MM-DD}.md`, the **AI agent** must **choose a new filename** that still follows the **slug + date** convention (e.g. adjust slug for disambiguation while staying readable). The agent should **inspect existing files** in `folders.research` and **avoid overwriting**. The extension **must not** silently overwrite; **numeric suffix** on the extension side is **not** the primary resolution — **the agent** resolves conflicts per D-12.

### Claude's Discretion
- Exact per-harness **draft query** strings and attachment UX differences
- Whether **LeanQuill-Researcher** rename ships in the same phase as import or as a tightly coupled prerequisite (same PR vs ordered tasks)
- PDF/Word handling when the model cannot read binary (fallback instructions to user)
- Minor wording in canonical import workflow markdown

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope and prior research contract
- `.planning/ROADMAP.md` — Phase 15 goal and dependency on Phase 12
- `.planning/phases/12-add-the-ability-to-run-research-in-standardized-ways-and-collect-research-results-in-a-dedicated-research-folder-next-to-the-manuscript/12-CONTEXT.md` — Research folder, frontmatter/body format, harness pattern, sidebar behavior

### Implementation anchors
- `src/extension.ts` — `leanquill.startResearch` pattern (`workbench.action.chat.open` with `isPartialQuery`, harness detection for Cursor/Copilot)
- `src/initialize.ts` — `writeHarnessEntryPoints`, `.leanquill/workflows/research.md` creation, Copilot/Cursor/Claude paths
- `src/researchTree.ts` — `ResearchTreeProvider`, research file discovery
- `Imported/data-contracts/project-config-schema.md` — `folders.research` (if present in repo)

### Runtime canonical workflow (book repos)
- `.leanquill/workflows/research.md` — Phase 12 research output contract (import target shape); created/updated by extension init per `initialize.ts`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`leanquill.startResearch`** (`extension.ts`): Template for **Import** — new chat, partial query, harness-specific prefix, fallback info message
- **`writeHarnessEntryPoints`** (`initialize.ts`): Pattern for adding **third** agent alongside researcher; **update** researcher naming to **LeanQuill-Researcher** and add **LeanQuill-Import-Research** entry points
- **`ResearchTreeProvider`**: Add **Import** control next to **`+`** in the Research view title menu (same `package.json` view pattern as `leanquill.startResearch`)

### Established Patterns
- Research path from `project.yaml` `folders.research`; `SafeFileSystem` allows `.md` under that folder only
- File watcher refreshes research tree on `.md` changes under research folder

### Integration Points
- `package.json`: new command e.g. `leanquill.startImportResearch` + Research view title button
- `.leanquill/workflows/`: new import workflow file; harness files under `.github/agents/`, `.cursor/skills/`, `.claude/agents/` (paths mirror existing researcher layout)

</code_context>

<specifics>
## Specific Ideas

- Primary narrative: bring **Claude Desktop** (and similar) research into the **same** LeanQuill research corpus as in-IDE research
- Import is **not** a separate file format forever — **converge** on Phase 12 markdown on disk
- **LeanQuill-** prefix on agent names for branding and search in chat UIs

</specifics>

<deferred>
## Deferred Ideas

- Extension-local import **without** AI (pure VS Code transform) — out of scope unless replanned
- Batch import of **folders** of exports — future phase/backlog
- Automatic **rename/migration** of existing user projects’ harness files from legacy `researcher` ids — decide during implementation (may offer one-time rewrite or dual aliases)

</deferred>

---

*Phase: 15-import-claude-desktop-research*
*Context gathered: 2026-04-11*
