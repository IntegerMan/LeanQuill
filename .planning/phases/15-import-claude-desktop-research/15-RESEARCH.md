# Phase 15: Import Claude Desktop research — Research

**Researched:** 2026-04-11  
**Domain:** VS Code extension UX + multi-harness AI agent/workflow contracts + Phase 12 research markdown normalization  
**Confidence:** HIGH for codebase anchors and CONTEXT-locked behavior; MEDIUM for per-product chat invocation strings (must be validated in Copilot Chat, Cursor, and Claude Code UIs at implementation time).

## Executive summary

- **Import is symmetric to Phase 12 “+” research:** a new command should mirror `leanquill.startResearch` — new chat, partial prefilled query, harness-specific prefix, no auto-send (`isPartialQuery: true`), with a fallback info message when `workbench.action.chat.open` is unavailable.
- **Target on-disk shape is fixed by Phase 12:** canonical contract lives in `.leanquill/workflows/research.md` (embedded in `initialize.ts` as `RESEARCH_WORKFLOW_CONTENT` for new inits); import workflow must produce the same frontmatter keys (`name`, `query`, `created`, `tags`, `sources`) and body sections, with **best-effort** mapping and explicit parking of leftovers (D-07).
- **Three thin harness entry points** follow `writeHarnessEntryPoints` in `src/initialize.ts`: Copilot `.github/agents/*.agent.md`, Cursor `.cursor/skills/<id>/SKILL.md`, Claude `.claude/agents/*.md`. Add a **second** agent/skill family for import alongside the renamed research agent (D-04–D-06).
- **Collision policy is agent-side:** extension must not silently overwrite; numeric suffix on the extension is **not** primary — the import agent lists `folders.research`, picks a non-colliding `{slug}-{YYYY-MM-DD}.md` (D-12).
- **Rename `researcher` → branded names** (`LeanQuill-Researcher`, `LeanQuill-Import-Research`) touches draft strings in `extension.ts` and YAML `name`/titles in harness files; **existing book repos** keep old files until a deliberate migration or dual-alias story (deferred in CONTEXT).
- **`Imported/data-contracts/project-config-schema.md` is stale** for `folders.research` (still `notes/research/` and schema v1); runtime truth is `src/initialize.ts` + `src/projectConfig.ts` / Phase 12 behavior (`research/leanquill/` default, schema v2). Planners should not treat the Imported doc as authoritative for research paths.
- **No `.leanquill/workflows/research.md` in the LeanQuill repo itself** — the template is created in **author book repos** on init. Research/import contract text should still be authored in `initialize.ts` (or a bundled resource) the same way as `RESEARCH_WORKFLOW_CONTENT`.
- **Tests today:** `node --test` via `npm run build:test` + `npm test` (191 passing); no tests for `leanquill.startResearch` harness branching — add focused unit tests for the new command’s query builder.
- **Binary / rich attachments** are out of the extension’s control; the workflow must instruct authors to paste text, export to `.md`, or use harness-supported uploads when the model cannot read PDF/DOCX (Claude’s discretion in CONTEXT).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked decisions (verbatim)

**Import via AI chat (sidebar + parity with “+” research)**

- **D-01:** **Import** is **chat-first**, not an extension-only file transform. Clicking **Import** in the Research sidebar **opens AI chat** with a **pre-filled, unsent** message that invokes the **LeanQuill import** skill/agent (same overall pattern as `leanquill.startResearch` / **`+`** for research).
- **D-02:** The extension **does not send** the message; the author **edits, attaches, and sends** when ready.
- **D-03:** The author supplies source material through **harness-native** means: pasted text, file attachments, or uploads — **including** raw text, `.txt`, `.md`, **PDF**, **Word**, etc., **as supported by that chat product**. The extension does not enumerate or enforce a single MIME list beyond what the chat UI allows.

**Harness pattern and LeanQuill-prefixed agent naming**

- **D-04:** Follow the **same three-harness pattern** as Phase 12: canonical workflow under **`.leanquill/workflows/`**, with **thin** entry points for **Copilot**, **Cursor**, and **Claude** (equivalent to `writeHarnessEntryPoints` in `initialize.ts`).
- **D-05:** **User-facing and agent naming** uses a **LeanQuill-** prefix for discoverability and consistency, e.g. **`LeanQuill-Researcher`** (existing research flow) and **`LeanQuill-Import-Research`** (import flow). Planning/implementation should align **display names**, skill/agent titles, and chat **draft** strings with these names (exact harness invocation syntax may differ per product — mirror how `@researcher` / `/agent:researcher` are handled today, but updated to the new names).
- **D-06:** Add a **new canonical workflow** file for import (e.g. `.leanquill/workflows/import-external-research.md` — filename is implementation detail; content defines normalization + save rules). **LeanQuill-Import-Research** reads and executes that contract.

**Normalization to Phase 12 research format**

- **D-07:** **Best-effort** mapping into Phase 12 **frontmatter** (`name`, `query`, `created`, `tags`, `sources`) and **body** sections (Summary, sub-topics, Sources, Open Questions, Project Relevancy). **Do not drop** unmapped content — park it under **Summary** and/or a clearly labeled **Imported content** subsection.
- **D-08:** **`created`:** default to **import-time ISO** unless the source has a **reliable** explicit date (do not infer from vague prose).
- **D-09:** **`sources`:** populate from obvious URLs in the source when possible; otherwise `[]`.
- **D-10:** **`query`:** from author clarification in chat and/or inferred from headings/first lines; use a clear placeholder if still unknown after import.
- **D-11:** **Preview / save:** Prefer **agent writes** the final `.md` directly into `folders.research` per workflow (author sees result in repo). If the harness cannot write files, fall back to **showing** markdown for manual save — **Claude’s discretion** in planning which path is primary per harness.

**Filename collisions**

- **D-12:** On **collision** with `{topic-slug}-{YYYY-MM-DD}.md`, the **AI agent** must **choose a new filename** that still follows the **slug + date** convention (e.g. adjust slug for disambiguation while staying readable). The agent should **inspect existing files** in `folders.research` and **avoid overwriting**. The extension **must not** silently overwrite; **numeric suffix** on the extension side is **not** the primary resolution — **the agent** resolves conflicts per D-12.

### Claude's Discretion (verbatim)

- Exact per-harness **draft query** strings and attachment UX differences
- Whether **LeanQuill-Researcher** rename ships in the same phase as import or as a tightly coupled prerequisite (same PR vs ordered tasks)
- PDF/Word handling when the model cannot read binary (fallback instructions to user)
- Minor wording in canonical import workflow markdown

### Deferred ideas (OUT OF SCOPE — verbatim)

- Extension-local import **without** AI (pure VS Code transform) — out of scope unless replanned
- Batch import of **folders** of exports — future phase/backlog
- Automatic **rename/migration** of existing user projects’ harness files from legacy `researcher` ids — decide during implementation (may offer one-time rewrite or dual aliases)
</user_constraints>

<phase_requirements>
## Phase decisions → research coverage

| Decision | What planning must nail down |
|----------|------------------------------|
| D-01–D-03 | New command duplicating `leanquill.startResearch` behavior: `workbench.action.chat.newChat` (best-effort) + `workbench.action.chat.open` with `{ query, isPartialQuery: true }`; harness-specific draft prefix for **LeanQuill-Import-Research**; never send. |
| D-04–D-06 | Extend `writeHarnessEntryPoints` (or parallel helper) to emit import entry points + new `.leanquill/workflows/import-*.md` on init; keep “read canonical workflow from disk” pattern from Phase 12. |
| D-05 | Update `leanquill.startResearch` draft from `@researcher` to harness-specific **LeanQuill-Researcher** invocation; align Copilot `name:` field, Cursor skill `name:` + adapter text, Claude agent frontmatter `name:` with product limits on IDs. |
| D-07–D-10 | Import workflow markdown: normalization rules, placeholder `query`, `sources` extraction heuristics, `created` policy, “Imported content” escape hatch. |
| D-11 | Document primary path = agent `write` to `folders.research`; secondary = output markdown only. |
| D-12 | Workflow steps: `Glob`/`list_dir` research folder before write; slug disambiguation examples; forbid overwrite. |
</phase_requirements>

## Project constraints (from `.cursor/rules/`)

**None found.** The workspace `.cursor/rules/` directory has no rule files (verified 2026-04-11). Continue to follow repo conventions: TypeScript, minimal scoped diffs, existing patterns in `extension.ts` / `initialize.ts`.

## Current codebase anchors

| Area | Location | Notes |
|------|----------|--------|
| Research chat entry | `src/extension.ts` — `leanquill.startResearch` | Lines 379–405: `vscode.env.appName` Cursor detection; `github.copilot-chat` extension check; `query = "@researcher "` vs `"Research: "`; `executeCommand("workbench.action.chat.open", { query, isPartialQuery: true })`; fallback `showInformationMessage` with `/agent:researcher` hint. |
| Research view title action | `package.json` | `view/title` entry ~316–318: `leanquill.startResearch` when `view == leanquill.research`. **Add** sibling command for Import (new `leanquill.startImportResearch` or similar). |
| Canonical research workflow + harness I/O | `src/initialize.ts` | `RESEARCH_WORKFLOW_CONTENT` (~123–178): workflow body + frontmatter contract; `writeHarnessEntryPoints` (~180–277): creates `.github/agents/researcher.agent.md`, `.cursor/skills/researcher/SKILL.md`, `.claude/agents/researcher.md` — **skips if file exists** (`stat` + `continue`). |
| Research tree | `src/researchTree.ts` | `ResearchTreeProvider`, `buildResearchItems`, `parseFrontmatter` (name/created only). Sidebar lists `.md` under `researchDir`; watcher in `extension.ts` ~334–339. |
| Research folder + safety | `src/extension.ts` | ~201–210, 249–251: `folders.research` from config, manuscript guard, `safeFileSystem.allowPath(safeResearchFolder, ".md")`. |
| Welcome copy | `package.json` `viewsWelcome` for `leanquill.research` | Mentions “+ button” for first research — update to mention **Import** when UI exists. |
| Tests for research listing | `test/researchTree.test.ts` | `parseFrontmatter`, `buildResearchItems` coverage — extend only if new parsing helpers are added (prefer keeping import logic in workflow/agent). |

## Harness-specific notes (draft strings and paths)

**Important:** Exact `@` names and slash commands are **product-specific**. Below mirrors the **current** Phase 12 split; replace identifiers with **LeanQuill-Researcher** / **LeanQuill-Import-Research** per D-05 and validate in each product.

| Harness | Entry path (today) | Draft pattern (today) | Phase 15 direction |
|---------|-------------------|------------------------|-------------------|
| **Cursor / Copilot-style** | `.cursor/skills/researcher/SKILL.md` | `extension.ts` uses `"@researcher "` prefix | Use the **skill/agent id** that the harness resolves from the new skill name (e.g. `@LeanQuill-Import-Research ` or product-normalized variant). Confirm whether Cursor uses folder name vs YAML `name:` for mentions. |
| **GitHub Copilot Chat** | `.github/agents/researcher.agent.md` | Same `@researcher` string in chat | Copilot Agent frontmatter `name:` must align with [@ mention](https://code.visualstudio.com/api/extension-guides/ai/chat) conventions; add **second** `.agent.md` for import. |
| **Claude Code** | `.claude/agents/researcher.md` | Fallback message: `/agent:researcher <question>` | Parallel file e.g. `.claude/agents/leanquill-import-research.md` with `tools:` line consistent with write-capable agents; update fallback strings to new agent id. |

**File creation:** `writeHarnessEntryPoints` uses raw `fs` (not `SafeFileSystem`) — intentional for config-like paths outside manuscript (see Phase 12 summary). New import files should follow the same pattern.

**Idempotency pitfall:** Because existing files are **not** overwritten, renaming `researcher` → `LeanQuill-Researcher` in place may require a **one-time migration** or **new filenames** + docs (per CONTEXT deferred item). Planner should choose: (a) only new projects get new names, (b) optional command to rewrite harness files, or (c) dual entry points (alias) during transition.

## Standard stack (verified)

| Component | Version / source | Role |
|-----------|------------------|------|
| VS Code engine | `^1.90.0` (`package.json`) | Minimum for chat commands used in extension |
| TypeScript | `^5.8.3` | Implementation language |
| Test runner | `node --test` + esbuild bundling of `test/*.test.ts` | CI-friendly unit tests |
| Canonical workflows | Markdown in `.leanquill/workflows/` in **book repos** | Single source of truth for agents |

**Registry check:** `npm view typescript version` → **5.9.3** (2026-04-11). Repo pins **5.8.3**; upgrading is optional and out of scope unless the phase needs new TS features.

## Architecture patterns

1. **Command factory:** Extract a small helper `buildHarnessDraftQuery(kind: 'research' | 'import'): string` used by `leanquill.startResearch` and `leanquill.startImportResearch` to avoid duplicated `isCursor` / `hasCopilot` branches (optional refactor; keep behavior identical).
2. **Workflow composition:** `import-*.md` should explicitly say: read `.leanquill/workflows/research.md` for **output shape** and restate only delta rules (normalization, collision avoidance, optional fallbacks).
3. **Sidebar:** Add `view/title` menu entry with distinct icon (e.g. `$(cloud-download)` or `$(import)`) next to `$(add)` for research.

## Don’t hand-roll

| Problem | Avoid | Use instead |
|---------|--------|-------------|
| Parsing research sidebar metadata | Custom YAML parser for full schema | Keep `parseFrontmatter` minimal; agent produces known shape |
| Import / collision logic in TypeScript | Extension guessing filenames | Agent lists directory + picks slug (D-12) |
| Per-harness workflow prose duplication | Three long copies | Canonical `.leanquill/workflows/import-*.md` + thin harness pointers (D-04) |

## Runtime state inventory

*(Import + harness rename phase — required.)*

| Category | Items found | Action required |
|----------|-------------|-----------------|
| **Stored data** | Open questions / issues may reference research by **basename** (`lq_research_file`). | **Code edit:** new imports create **new** basenames; no migration unless an issue pointed at a replaced file. Renaming existing research files would break links — out of scope unless explicitly planned. |
| **Live service config** | Claude Desktop / web sessions hold content **outside** the repo. | **None in extension** — author manually pastes/attaches into IDE chat per D-03. |
| **OS-registered state** | None identified. | None — verified N/A for this phase. |
| **Secrets / env vars** | None for import flow. | None. |
| **Book repos on disk** | Existing `.github/agents/researcher.agent.md`, `.cursor/skills/researcher/`, `.claude/agents/researcher.md` from prior inits; `writeHarnessEntryPoints` **does not** refresh them. | **Migration or dual-alias** (CONTEXT deferred): planner decides one-time rewrite, new files only, or backward-compatible aliases. |
| **Build artifacts** | `dist/extension.js` after `npm run build`. | Rebuild on release; no separate runtime state. |

## Risks and edge cases

- **PDF/DOCX / binary:** Extension cannot normalize binaries; agent must ask for pasted text or `.md` export when the harness/model cannot read the attachment (CONTEXT discretion).
- **Filename collision:** Multiple imports same day with same slug — agent adjusts slug (D-12); extension must not add competing auto-suffix logic that surprises authors.
- **Rename LeanQuill-Researcher:** Breaks author muscle memory and any docs/screenshots referencing `@researcher`; mitigate with dual-alias period or prominent changelog in extension release notes.
- **`workbench.action.chat.open` failure:** Already handled with informational fallback — new command should share the same try/catch pattern (`extension.ts` 397–404).
- **Cursor vs VS Code `appName`:** Heuristic `includes("cursor")` may need future tweak if branding changes; treat as **MEDIUM** maintenance risk.
- **Copilot without `github.copilot-chat`:** Falls through to generic branch — verify behavior on bare VS Code + other AI extensions.

## Recommended plan split (waves / plans)

| Wave | Focus | Deliverables |
|------|--------|----------------|
| **P01** | Contracts + init | New `RESEARCH_IMPORT_WORKFLOW_CONTENT` (or equivalent) in `initialize.ts`; write `.leanquill/workflows/import-external-research.md` on init; extend `writeHarnessEntryPoints` with **three new import files** (Copilot/Cursor/Claude). |
| **P02** | Extension UX | `leanquill.startImportResearch` command; `package.json` menus + activation; mirror `startResearch` harness detection with **LeanQuill-Import-Research** draft; update Research `viewsWelcome` text. |
| **P03** | Researcher rename (tightly coupled)** | Align D-05: update `startResearch` drafts, `RESEARCH_WORKFLOW_CONTENT` “Harness Setup” paths if filenames change, and three researcher entry files — **or** explicitly document alias strategy if deferred. |
| **P04** | Verification | Unit tests for draft-query builder; manual UAT matrix (Cursor, VS Code+Copilot, Claude) per **Validation Architecture**; update Phase 12 on-disk docs only if repo ships sample `.leanquill` (optional). |

**\*\***Combine P01+P03 in one plan file if the team wants a single atomic behavior change for authors.

## Validation Architecture

*(Nyquist enabled in `.planning/config.json` → `workflow.nyquist_validation: true`.)*

### Test framework

| Property | Value |
|----------|--------|
| Framework | Node.js built-in test runner (`node:test`) |
| Config | None — `package.json` scripts |
| Build tests | `npm run build:test` (esbuild `test/*.test.ts` → `dist-test/`) |
| Quick run | `npm test` (full suite ~under 30s locally; 191 tests as of 2026-04-11) |

### Automated (recommended Wave 0 / phase tasks)

| Behavior | Approach | Command |
|----------|----------|---------|
| Harness draft strings | Pure function tests: given `isCursor`, `hasCopilot`, assert query prefix for research vs import | `npm test` after adding `test/harnessDraft.test.ts` (new file) |
| `package.json` contribution | Optional: script or test that `contributes.commands` includes new command id | Manual grep or lightweight JSON parse test |

### Manual / UAT (cannot fully automate)

| Check | Harness | Pass criteria |
|-------|---------|---------------|
| Import opens chat, **does not** send | Each | Composer shows prefilled text; user must press Send |
| Import invokes correct agent/skill | Copilot / Cursor / Claude | Agent picks up **LeanQuill-Import-Research** and reads `.leanquill/workflows/import-*.md` |
| Saved file appears under `folders.research` | All with file-write | New `.md` with valid frontmatter; Research sidebar refreshes (existing watcher) |
| Collision handling | Any | Second import same slug/date yields **distinct filename**, no overwrite |
| Binary fallback | Any | When attachment unreadable, agent requests text/export per workflow |

### Wave 0 gaps

- [ ] No tests today for `leanquill.startResearch` / chat command wiring — add **unit** tests for extracted draft builders only (do not require VS Code headless in CI).
- [ ] Document manual UAT matrix in phase `VERIFICATION.md` or checklist artifact.

## Environment availability

| Dependency | Required by | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | build + tests | ✓ | v24.11.1 (agent machine) | Use LTS aligned with team CI |
| npm + local `node_modules` | `esbuild`, tests | ✓ after `npm install` | — | — |
| VS Code / Cursor | UAT | Human | ^1.90 | — |
| GitHub Copilot Chat | Copilot UAT | Human | — | Use fallback message path |
| Claude Code CLI / app | Claude UAT | Human | — | Use informational instructions |

**Step 2.6 note:** No server-side services; extension uses local workspace only.

## Open questions (for planner / implementer)

1. **Canonical Copilot/Cursor mention strings for names with hyphens** — What exact chat text reliably invokes the agent after renaming? **Mitigation:** spike in each product before freezing copy.
2. **Whether to rename on-disk harness files** (`researcher.agent.md` vs `leanquill-researcher.agent.md`) vs **only** changing YAML `name` inside fixed paths — affects docs and deep links.
3. **Import workflow filename** — `import-external-research.md` vs shorter name; must be consistent in init + harness “read this file” steps.

## Sources

### Primary (HIGH)

- **Repository:** `src/extension.ts`, `src/initialize.ts`, `src/researchTree.ts`, `package.json`, `test/researchTree.test.ts`
- **Phase contracts:** `.planning/phases/15-import-claude-desktop-research/15-CONTEXT.md`, `.planning/phases/12-.../12-CONTEXT.md`
- **VS Code Extension API (Context7):** `/websites/code_visualstudio_api` — chat extension guides (command link / chat patterns); built-in command list is a **subset** in [Built-in Commands](https://code.visualstudio.com/api/references/commands) (may not enumerate all `workbench.action.chat.*` IDs — implementation already uses them successfully in Phase 12)

### Secondary (MEDIUM)

- **Imported schema doc** `Imported/data-contracts/project-config-schema.md` — historical; cross-check against `src/initialize.ts` for `folders.research`

### Tertiary (LOW / validate in product)

- Exact `workbench.action.chat.open` argument schema in a given VS Code/Cursor build — behavior verified empirically by Phase 12 implementation, not located in the fetched built-in commands page subset.

## Metadata

**Confidence breakdown**

- Standard stack / anchors: **HIGH** — direct file reads
- Harness invocation strings: **MEDIUM** — depends on product UI conventions
- Pitfalls: **HIGH** — derived from CONTEXT + code behavior

**Valid until:** ~2026-05-11 (sooner if VS Code/Copilot changes chat command surface)

## RESEARCH COMPLETE
