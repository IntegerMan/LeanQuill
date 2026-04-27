# Phase 10: AI Review and Advisory Workflows - Context

**Gathered:** 2026-04-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver LeanQuill’s **Track 2 AI advisory workflows** on top of Track 1: **chapter review**, **issue-focused “Chat about this”**, and **post-write story intelligence updates**, with **durable, reproducible artifacts** under `.leanquill/**` — while preserving **manuscript immutability** and the Phase 9 safety/approval posture.

This phase intentionally **does not** ship automated `master-issues.md` consolidation/rollup.

</domain>

<decisions>
## Implementation Decisions

### Chapter review workflow (AIR-01)

- **D-01:** Primary UX is **chapter tree right-click**; **chat/command parity** must run the same workflow for power users.
- **D-02:** Output strategy is **hybrid**: create a **session issue artifact** first (aggregate findings), then allow **promotion** of selected findings into **normal per-issue markdown files** under `.leanquill/issues/{type}/`.
- **D-03:** **Persona selection is author-driven each run**: QuickPick **one enabled persona** vs **all enabled** (no silent “always all”).
- **D-04:** On run start, persist **both** immediately:
  - a **session stub** under `.leanquill/issues/sessions/`
  - a **chat log stub** under `.leanquill/chats/` using the **same `session_id`**
- **D-05:** Session issue files should follow the **session file narrative** in `Imported/data-contracts/issue-schema.md` (session header + embedded/per-finding records), even if some formatting details are left to implementation.

### Issue-focused chat (“Chat about this”) (ISSUE-05 / AIR-03)

- **D-06:** For **`chapter` association issues**, include the **full chapter manuscript** (`chapterRef` file) in the injected chat context bundle by default.
- **D-07:** For **`selection` association issues**, include the **full chapter manuscript** **and** treat `spanHint` as the **anchor snippet** to locate/highlight in-editor (do not introduce a new “partial chapter slice” contract in Phase 10).
- **D-08:** For **non-manuscript associations** (`book`, `character`, `place`, `thread`, `research`):
  - always include the **issue markdown**
  - also include the **linked association target file** when applicable
  - for `book`, rely on the **standard base bundle** paths (do not heuristically pull unrelated notes)
- **D-09:** **Always include active story memory** in issue chat context bundles (same baseline as general story chat).

### Post-write story intelligence update (AIR-02)

- **D-10:** Triggers are **hybrid**:
  - **Debounced manuscript save** prompts the author (toast/status) with **Run / Dismiss**
  - plus an **explicit command** that runs the **same** workflow on demand
- **D-11:** Analysis input scope is the **entire active chapter manuscript file** (whole-chapter pass).
- **D-12:** Note updates are applied via **`MetadataAction` JSON** with **`requiresApproval` + `authorApproval`** for story-note writes (consistent with Phase 9 defense-in-depth posture).
- **D-13:** Persona selection matches chapter review: **QuickPick one vs all enabled** before starting (including when launched from the save prompt’s **Run**).

### Auditability & contracts

- **D-14:** Treat `Imported/data-contracts/chat-log-schema.md` as **canonical** for `.leanquill/chats/*.md` frontmatter over time: **extend** current persisted logs toward that schema (`session_type`, `persona_ids`, `chapters_in_context`, `session_issue_file`, counters, etc.) while keeping **backward compatibility** for existing files.
- **D-15:** `.leanquill/metadata-actions.jsonl` remains **outcome-oriented**: log **`applied` / `rejected` / `blocked`** entries; **do not** add a separate **`proposed`** stream in Phase 10.
- **D-16:** Chat audit posture is **summary-first**; **transcripts are optional/best-effort** and must **not** block completing a workflow when transcripts can’t be captured automatically.
- **D-17:** **`master-issues.md` rollup/automation is explicitly out of scope** for Phase 10 (session outputs + promotion paths only).

### Claude's Discretion

- Exact UI copy/placement for the debounced save prompt (toast vs status bar vs both), as long as it’s **non-blocking** and offers **Run/Dismiss**.
- Exact session/ch filenames beyond the shared `session_id` linkage requirement.
- Exact mapping table from internal launch sources to `chat-log-schema.md` `session_type` strings, as long as the mapping is **stable and documented** in-plan.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope and requirements

- `.planning/ROADMAP.md` — Phase 10 goal, success criteria, dependencies (Phase 9), mapped requirements (AIR-01/02/03, ISSUE-05)
- `.planning/REQUIREMENTS.md` — AIR-01/02/03 and ISSUE-05 acceptance text
- `.planning/PROJECT.md` — manuscript immutability, local-first `.leanquill/`, VS Code LM API-only posture

### Prior locked decisions that constrain Phase 10

- `.planning/phases/09-ai-safety-rails-and-persona-baseline/09-CONTEXT.md` — persona defaults + **metadata action / SafeFileSystem defense-in-depth** + approval baseline (notably: story-note writes require explicit approval)
- `.planning/phases/08-issue-capture-triage-and-editor-signals/08-CONTEXT.md` — author issue layout + triage semantics; explicitly deferred AI session outputs / rollups (Phase 10 should respect what is still deferred)

### Data contracts (schemas)

- `Imported/data-contracts/issue-schema.md` — session issue file location/narrative, embedded issue record shape, and (for awareness) `master-issues.md` rollup concept **(rollup not implemented in Phase 10 per D-17)**
- `Imported/data-contracts/chat-log-schema.md` — canonical chat log frontmatter fields and session typing guidance (Phase 10 alignment target per D-14)
- `Imported/data-contracts/persona-schema.md` — persona file semantics for “enabled personas” runs
- `Imported/data-contracts/project-config-schema.md` — `active_personas` configuration shape

### Product + safety docs

- `docs/manuscript-safety.md` — non-negotiable manuscript write boundaries for any AI surface
- `docs/ai-integration.md` — advisory-only posture and VS Code chat harness assumptions

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `src/extension.ts` — existing story chat launch commands (`leanquill.chatAboutIssue`, chapter/selection chat entry points) and chat open flow (`workbench.action.chat.open`)
- `src/storyChatContext.ts` — context bundle construction rules (notably manuscript path filtering vs `manuscriptScope`, excerpt cap for selection chats)
- `src/storyChatLogStore.ts` — persists `.leanquill/chats/{sessionId}.md` summaries today (extend toward `chat-log-schema.md` per D-14)
- `src/metadataActionApplier.ts` + `src/metadataActionContract.ts` + `src/metadataActionLog.ts` — validated metadata writes + JSONL audit trail (append `proposed` is **not** a Phase 10 requirement per D-15)

### Established Patterns

- “Open chat with injected context summary” rather than embedding full file contents into the query string
- Append-only JSONL audit logs for machine-readable provenance

### Integration Points

- Issues UI hosts + shared renderer: `src/openQuestionsHtml.ts` / `src/openQuestionsPanel.ts` / `src/planningPanelHtml.ts` (ISSUE-05 entry points likely land here alongside commands)
- Issue persistence APIs: `src/openQuestionStore.ts` (promotion flows should reuse the same issue record pipeline as author-created issues)

</code_context>

<specifics>
## Specific Ideas

- Treat **imported chat/issue schema docs** as the long-term contract targets, but allow **incremental extension** of on-disk formats already present in the extension (avoid a big-bang migration unless necessary).

</specifics>

<deferred>
## Deferred Ideas

- **Automated `master-issues.md` consolidation** — explicitly deferred beyond Phase 10 per D-17 (see `Imported/data-contracts/issue-schema.md` narrative for future consolidation work).

### Reviewed Todos (not folded)

- None (todo matcher returned no pending todos for Phase 10 during discuss-phase).

</deferred>

---

*Phase: 10-ai-review-and-advisory-workflows*
*Context gathered: 2026-04-25*
