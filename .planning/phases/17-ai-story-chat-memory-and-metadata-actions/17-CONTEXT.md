# Phase 17: AI Story Chat, Memory, and Metadata Actions - Context

**Gathered:** 2026-04-25
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers story-focused AI conversations for authors: general and contextual story chat, durable AI-derived conversation memory, and standardized metadata action contracts for updating LeanQuill state and story-note metadata. AI remains advisory and must never author or modify manuscript prose. Metadata changes must be auditable, portable across supported chat environments, and constrained by LeanQuill's existing safety model.

</domain>

<decisions>
## Implementation Decisions

### Chat Entry Points and Context Scope
- **D-01:** Phase 17 should provide both a general story chat entry point and contextual entry points from issues, entities, research, chapters, or selections where relevant.
- **D-02:** Story chat should receive selected context plus lightweight project indexes by default: the current issue/entity/chapter/selection when launched from context, plus project metadata such as outline, status, and LeanQuill indexes needed to answer coherently.
- **D-03:** Manuscript prose should be included only when the entry point implies it, bounded to the relevant chapter, selection, or explicitly approved chapter set. Full-manuscript context must not be automatic.
- **D-04:** Each story chat should save a chat-log summary. When relevant, the session may also produce structured artifacts such as issues, memory entries, or metadata action proposals.

### Durable Memory and Notes
- **D-05:** Durable AI-derived story memory should live in dedicated `.leanquill/memory/` markdown/YAML records, separate from author-owned story notes.
- **D-06:** Memory records should be topic-linked to existing LeanQuill associations where possible: book-wide, chapter, selection, issue, character, place, thread, theme, or research.
- **D-07:** Session summaries should be saved automatically as memory records. Planner should distinguish low-risk automatic session memory from higher-risk story-note metadata changes.
- **D-08:** Memory records should carry status/recency metadata and support superseding older entries rather than destructive overwrite. This lets evolving story decisions remain auditable.

### Metadata Action Contracts
- **D-09:** Metadata actions may target LeanQuill state and story-note metadata: issues, memory, chat logs, character/place/thread/theme frontmatter, and research associations. Manuscript prose remains excluded.
- **D-10:** AI metadata actions should be structured records with operation, target path, field path, old value if known, new value, rationale, and source chat/session id.
- **D-11:** The extension, not the agent, should validate and apply accepted structured actions through `SafeFileSystem` and schema/domain validators.
- **D-12:** The metadata action contract should be published as a canonical `.leanquill/workflows/` contract with generated thin entry points for Cursor, Copilot, and Claude, following the Phase 12/15 harness pattern.

### Safety, Approval, and Audit
- **D-13:** Low-risk artifacts such as chat logs and automatic session memory summaries may be applied automatically. Higher-risk story-note/entity metadata changes should require explicit author approval.
- **D-14:** Author review of proposed metadata actions should happen inline in the AI chat, using harness-native confirmation flow or text confirmation, rather than requiring a new Planning workspace review queue in v1.
- **D-15:** Applied and rejected metadata actions should be recorded in both the chat log and a compact action log containing target, timestamp, action status, and rationale.
- **D-16:** Hard-block proposed operations that attempt manuscript prose writes, target unconfigured paths, perform destructive deletes without explicit author action, or produce schema-invalid metadata.

### Claude's Discretion
- Exact command names, view labels, and harness-specific chat draft strings.
- Exact memory record filename convention and schema shape, as long as records are auditable and linked.
- Exact action-log location under `.leanquill/`.
- Exact validation layering between schema validation, `SafeFileSystem`, and feature-specific domain checks.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Scope and Product Constraints
- `.planning/ROADMAP.md` — Phase 17 goal, dependencies, success criteria, and fixed scope.
- `.planning/PROJECT.md` — core product principles: local-first, git-native state, VS Code extension, AI advises but never authors.
- `.planning/REQUIREMENTS.md` — AI requirements and out-of-scope constraints, especially manuscript immutability and VS Code LM API only.
- `docs/ai-integration.md` — current AI integration design philosophy and planned AI features.
- `docs/manuscript-safety.md` — write boundary policy and default writable path model.

### Prior Phase Context
- `.planning/phases/08-issue-capture-triage-and-editor-signals/08-CONTEXT.md` — issue model, triage lifecycle, gutter signals, and future AI session issue boundaries.
- `.planning/phases/12-add-the-ability-to-run-research-in-standardized-ways-and-collect-research-results-in-a-dedicated-research-folder-next-to-the-manuscript/12-CONTEXT.md` — canonical workflow plus cross-harness entry-point pattern.
- `.planning/phases/14-open-questions/14-CONTEXT.md` — context-first issue creation and association patterns.
- `.planning/phases/15-import-claude-desktop-research/15-CONTEXT.md` — LeanQuill-prefixed agent naming and import workflow contract pattern.

### Data Contracts and Implementation Anchors
- `Imported/data-contracts/chat-log-schema.md` — chat log location, frontmatter, session types, and audit transcript format.
- `Imported/data-contracts/persona-schema.md` — persona context-access model and safety-relevant context scoping rules.
- `Imported/data-contracts/issue-schema.md` — issue output shape, associations, statuses, and session issue concepts.
- `src/initialize.ts` — workflow file creation and cross-harness entry-point generation.
- `src/harnessChatDraft.ts` — existing chat draft/fallback helper for AI harness invocation.
- `src/safeFileSystem.ts` — current write boundary and dynamic allowlist enforcement.
- `src/types.ts` — existing LeanQuill entity, issue, and association types.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/initialize.ts` already creates canonical workflow files under `.leanquill/workflows/` and generates Copilot/Cursor/Claude entry points for research/import agents.
- `src/harnessChatDraft.ts` centralizes draft query and fallback copy for harness-backed AI workflows.
- `src/safeFileSystem.ts` enforces `.leanquill/**`, `manuscript/Book.txt`, and configured additional path writes; Phase 17 should reuse this rather than letting agents write arbitrary files.
- `src/openQuestionStore.ts` and related issue modules provide association, lifecycle, and persisted issue patterns that metadata actions can target.
- `src/types.ts` already models chapters, characters, places, themes, threads, open-question associations, and issue statuses.

### Established Patterns
- Tool-owned state lives under `.leanquill/`; author story notes live in configured markdown folders.
- Harness entry points are thin wrappers around canonical workflow files.
- AI-adjacent features draft chat messages rather than sending them automatically.
- Safety policy is structural: write boundaries and schema contracts matter more than prompt-only instructions.

### Integration Points
- Add story chat commands and any context-menu entry points in `src/extension.ts` / `package.json`.
- Add canonical workflow/action-contract files in the same family as `research.md` and `import-external-research.md`.
- Add memory storage and action-log modules under `src/`, using `SafeFileSystem` for writes under `.leanquill/`.
- Extend chat-log/session handling to include story-chat memory and metadata action provenance.

</code_context>

<specifics>
## Specific Ideas

- General story chat and contextual story chat are both first-class.
- Automatic memory is acceptable for low-risk session summaries, but story-note/entity metadata changes need author approval.
- Inline chat confirmation is preferred for v1 over a new Planning workspace review queue.
- Metadata actions should be portable structured records, not harness-specific natural-language instructions.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within Phase 17 scope.

</deferred>

---

*Phase: 17-ai-story-chat-memory-and-metadata-actions*
*Context gathered: 2026-04-25*
