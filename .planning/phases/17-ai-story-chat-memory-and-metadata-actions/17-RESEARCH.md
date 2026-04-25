# Phase 17: AI Story Chat, Memory, and Metadata Actions - Research

**Researched:** 2026-04-25
**Domain:** VS Code AI chat integration, cross-harness agent workflows, local-first metadata contracts
**Confidence:** HIGH for existing LeanQuill patterns and VS Code API direction; MEDIUM for cross-harness approval mechanics because Cursor/Copilot/Claude expose different confirmation primitives.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
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

### Deferred Ideas (OUT OF SCOPE)
## Deferred Ideas

None — discussion stayed within Phase 17 scope.
</user_constraints>

## Summary

Phase 17 should be planned as a contract-first AI workflow, not as an unconstrained agent that directly edits project files. LeanQuill already has the right precedent in Phase 12/15: canonical workflow documents under `.leanquill/workflows/`, thin Cursor/Copilot/Claude entry points, and VS Code commands that open chat with a prefilled, unsent draft. Reuse that shape for story chat and metadata action instructions.

The extension should own all durable state application. Let AI produce advisory answers, memory summaries, and structured metadata action proposals; then run accepted actions through deterministic TypeScript validators, existing domain stores, and `SafeFileSystem`. Store low-risk AI memory in `.leanquill/memory/` automatically, but treat entity/story-note metadata updates as higher risk and require explicit approval plus an action log entry.

**Primary recommendation:** Implement portable harness-driven story chat first, backed by extension-side memory/action stores and validators; only add native VS Code Chat Participant or Language Model Tool integration if the plan explicitly targets Copilot/VS Code behavior separately from Cursor/Claude portability.

## Project Constraints (from .cursor/rules/)

No `.cursor/rules/*.md` files exist in this repository. The operative project constraints come from `AGENTS.md`, `.planning/PROJECT.md`, and docs:

- AI may advise but must never author or modify manuscript prose.
- v1 uses VS Code Language Model API / active chat providers only; no external AI API keys or direct provider HTTP calls.
- All durable LeanQuill state is local-first and git-native.
- All extension writes must go through `SafeFileSystem` or established domain store functions.
- `manuscript/Book.txt` is the only normal manuscript-path write; chapter markdown is read-only.
- After changes to `src/` or `test/`, run `npm run build:test` and then `npm test`.

Project `.cursor/skills/` contains GSD workflow skills, not book-facing LeanQuill runtime skills. Phase 17 should create book-repo harness entry points through `src/initialize.ts`, following existing generated `LeanQuill-Researcher` and `LeanQuill-Import-Research` patterns.

## Standard Stack

### Core

| Library / API | Version | Purpose | Why Standard |
|---|---:|---|---|
| VS Code Extension API | Engine currently `^1.90.0`; installed VS Code `1.115.0`; latest `@types/vscode` `1.116.0` | Commands, views, chat opening, optional Chat Participant and LM Tool APIs | Native extension surface; required by product constraints |
| `vscode.commands.executeCommand("workbench.action.chat.open")` | Built-in command | Open chat with prefilled unsent prompt via `{ query, isPartialQuery: true }` | Already used in `extension.ts` for research/import; works across current chat harnesses best-effort |
| VS Code Chat Participant API | Official docs updated 2026-04-22 | Optional native `@leanquill` participant in VS Code/Copilot chat | Gives LeanQuill full prompt control and access to `request.model`, but is less portable to Claude/Cursor-specific agent files |
| VS Code Language Model Tool API | Official docs updated 2026-04-22 | Optional extension-registered metadata apply/inspect tools with confirmation | Tool invocation includes schema validation and user confirmation; useful for Copilot agent mode |
| Node `node:test` + `assert/strict` | Node `v24.11.1` available | Unit tests for stores, validators, action applier, draft strings | Existing test harness |
| TypeScript + esbuild | Installed lock: TypeScript `5.8.3`, esbuild `0.25.12` | Extension source and test bundling | Existing repo standard |

### Supporting

| Library / API | Version | Purpose | When to Use |
|---|---:|---|---|
| `@vscode/prompt-tsx` | Optional; current docs recommend for advanced prompt composition | Token-aware prompt assembly for native Chat Participant implementation | Use only if Phase 17 implements a native participant and prompt truncation becomes difficult |
| Existing `yamlUtils.ts` | Local | YAML scalar escaping/parsing | Use for simple frontmatter fields; do not build a generic YAML mutation engine |
| Existing domain stores | Local | Read/write issues, characters, places, threads, themes, project config | Metadata action application should delegate to these where possible |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|---|---|---|
| Harness-first workflows | Native Chat Participant only | Better UX in VS Code/Copilot, but weaker Cursor/Claude portability and conflicts with D-12 |
| JSON action contract | YAML-only action records | YAML is human-friendly, but JSON is safer for exact machine validation of `fieldPath`, `oldValue`, and `newValue` |
| Extension LM calls | External provider SDKs | External SDKs violate v1 "VS Code LM API only" and add API key burden |

**Installation:** No new dependency is required for the recommended v1. If native participant prompt composition needs token management later:

```bash
npm install @vscode/prompt-tsx
```

**Version verification:** `npm view` on 2026-04-25 reported `@types/vscode` `1.116.0` modified 2026-04-15, TypeScript `6.0.3` modified 2026-04-16, and esbuild `0.28.0` modified 2026-04-02. The repo lock currently uses `@types/vscode` `1.110.0`, TypeScript `5.8.3`, and esbuild `0.25.12`; do not upgrade these just to implement Phase 17 unless using APIs absent from current installed typings. If planning a native Chat Participant or Language Model Tool, first verify `@types/vscode` includes those types and bump `engines.vscode` intentionally.

## Architecture Patterns

### Recommended Project Structure

```text
src/
├── storyChatContext.ts          # Deterministic context bundle assembly for chat entry points
├── storyMemoryStore.ts          # .leanquill/memory/*.md parse/serialize/list/supersede
├── metadataActionContract.ts    # Types, JSON schema-like validation, path/operation allowlists
├── metadataActionApplier.ts     # Applies accepted actions via domain stores + SafeFileSystem
├── metadataActionLog.ts         # Compact append/read action log under .leanquill/
├── storyChatLogStore.ts         # Chat log summary helpers, aligned with chat-log-schema.md
├── storyChatWorkflow.ts         # Canonical workflow content strings for initialize.ts
└── harnessChatDraft.ts          # Extend kind union for story-chat/action workflows
test/
├── storyMemoryStore.test.ts
├── metadataActionContract.test.ts
├── metadataActionApplier.test.ts
├── storyChatContext.test.ts
└── harnessChatDraft.test.ts
```

### Pattern 1: Harness-First Story Chat

**What:** Add story chat as another `openHarnessChat` kind. Commands/context menus build a draft invocation for `@leanquill-story-chat` / `/agent:leanquill-story-chat` with a lightweight, explicit context descriptor.

**When to use:** General story chat, "Chat about this issue", "Chat about this character/place/thread/theme/research item", and selected manuscript range chat.

**Example:**

```typescript
// Existing pattern in src/extension.ts should be generalized from "research" | "import".
await vscode.commands.executeCommand("workbench.action.chat.newChat");
await vscode.commands.executeCommand("workbench.action.chat.open", {
  query: buildHarnessDraftQuery({ isCursorOrCopilot, kind: "storyChat" }),
  isPartialQuery: true,
});
```

**Planning note:** `workbench.action.chat.open` receives a string query. It should be treated as a draft/fallback mechanism, not as a structured API for guaranteed variable expansion.

### Pattern 2: Context Bundles Are Deterministic

**What:** The extension should assemble a bounded context manifest: project identity, outline/status indexes, selected target metadata, and only the manuscript text explicitly implied by the entry point.

**When to use:** Every chat launch.

**Recommended shape:**

```typescript
export interface StoryChatContextBundle {
  sessionId: string;
  launchedFrom: "general" | "issue" | "character" | "place" | "thread" | "theme" | "research" | "chapter" | "selection";
  target?: Record<string, string>;
  includedPaths: string[];
  excludedPaths: string[];
  manuscriptScope: "none" | "selection" | "chapter" | "approved-chapter-set";
  summary: string;
}
```

**Critical invariant:** Full-manuscript context is never automatic.

### Pattern 3: Memory Records Supersede, They Do Not Overwrite

**What:** Store AI-derived memory as one markdown file per session/topic under `.leanquill/memory/`, with frontmatter for `id`, `topic`, `status`, `created_at`, `updated_at`, `supersedes`, `associations`, `source_chat_id`, and `recency`.

**When to use:** Automatic session summaries and manually promoted memory items.

**Example frontmatter:**

```yaml
---
schema_version: "1"
id: mem-20260425-160701-story-chat
topic: "chapter 3 steering plausibility"
status: active
created_at: 2026-04-25T20:07:01.000Z
updated_at: 2026-04-25T20:07:01.000Z
recency: current
supersedes: []
source_chat_id: 2026-04-25-160701-story-chat
lq_assoc_kind: issue
lq_issue_id: fr-001
---
```

### Pattern 4: Metadata Actions Are Structured and Extension-Applied

**What:** Use a machine-validated action payload, preferably JSON or JSON embedded in markdown, for changes that may update LeanQuill state or story-note metadata. Agents propose actions; the extension validates and applies accepted actions.

**When to use:** Issue status updates, memory creation/superseding, chat log updates, entity frontmatter fields, research associations.

**Recommended action contract:**

```typescript
export interface MetadataAction {
  schemaVersion: "1";
  actionId: string;
  sourceChatId: string;
  operation: "set" | "append" | "removeFromList" | "supersedeMemory" | "createIssue" | "updateIssueStatus";
  targetPath: string;
  fieldPath: string[];
  oldValue?: unknown;
  newValue?: unknown;
  rationale: string;
  risk: "low" | "requiresApproval";
  authorApproval?: {
    approvedAt: string;
    method: "native-tool-confirmation" | "chat-text-confirmation" | "extension-command";
    transcriptExcerpt?: string;
  };
}
```

**Hard blocks:** `targetPath` under manuscript chapter files, unconfigured path roots, path traversal, destructive deletes without explicit author action, unknown operations, schema-invalid payloads, and stale `oldValue` conflicts.

### Anti-Patterns to Avoid

- **Prompt-only safety:** Do not rely on agent instructions to protect manuscript files; enforce with path validation and `SafeFileSystem`.
- **Generic YAML mutation:** Do not write an ad hoc "edit any YAML field" engine for arbitrary files. Route known domains through known stores/serializers.
- **One monolithic chat module:** Keep context assembly, memory storage, action validation, and action application separate so each is unit-testable without an LM call.
- **Native-only chat UX:** A VS Code Chat Participant can be good later, but a native-only plan would miss the explicit Cursor/Copilot/Claude portability requirement.
- **Silent metadata application:** Entity/story-note metadata changes need explicit approval and action log provenance.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| AI provider integration | OpenAI/Anthropic SDK wrappers or API-key config | Active chat harnesses and VS Code LM APIs | v1 forbids external API keys; users already have Copilot/Cursor/Claude |
| Manuscript write safety | Prompt text like "do not edit manuscript" | `SafeFileSystem.canWrite/writeFile` plus target allowlists | Structural enforcement is the product promise |
| Metadata updates | Regex replacements across markdown files | Domain store serializers (`openQuestionStore`, character/place/thread/theme stores) | Preserves schema-specific invariants and associations |
| Complex action payload parsing | Freeform markdown instruction parsing | Typed JSON action records plus validator | Avoids ambiguous extraction and injection problems |
| Approval tracking | Ephemeral chat-only memory | Action log + chat log fields | Auditability requires durable records |
| Full context retrieval | "Read the whole repo/book" agent instruction | Deterministic bounded context bundle | Prevents token blowups and future-chapter leakage |

**Key insight:** The hard part is not chatting; it is proving that AI-originated state changes are bounded, approved, auditable, and portable. Plan validators and stores before UI polish.

## Common Pitfalls

### Pitfall 1: Treating Phase 17 as a General AI Agent

**What goes wrong:** The agent gets broad workspace access and starts editing files directly.
**Why it happens:** Chat workflows are easier to write than deterministic action appliers.
**How to avoid:** The canonical workflow must say AI proposes metadata actions; extension code validates/applies them.
**Warning signs:** Plans mention "agent updates frontmatter" without naming `SafeFileSystem` or a validator.

### Pitfall 2: Accidental Manuscript Context Expansion

**What goes wrong:** General story chat includes full manuscript or future chapters by default.
**Why it happens:** "Story chat" feels project-wide, but manuscript text is author-owned and context-sensitive.
**How to avoid:** `StoryChatContextBundle.manuscriptScope` must default to `none`; chapter/selection text only when launched from that scope or explicitly approved.
**Warning signs:** A context builder reads `manuscript/**/*.md` for every chat.

### Pitfall 3: Approval UX Drift Across Harnesses

**What goes wrong:** Copilot native tools show confirmation, but Cursor/Claude text-confirmation flows do not map cleanly to extension-side application.
**Why it happens:** Harnesses expose different action/confirmation primitives.
**How to avoid:** Define `authorApproval.method` and log the method used. Treat native tool confirmation as strongest; text confirmation as acceptable but auditable.
**Warning signs:** One harness can apply actions and another can only print instructions with no durable record.

### Pitfall 4: YAML Parser Creep

**What goes wrong:** A generic field-path patcher corrupts markdown frontmatter or loses comments/body content.
**Why it happens:** Existing notes are markdown/YAML-like, but the repo intentionally avoids a full YAML dependency.
**How to avoid:** For existing domain files, parse and serialize through domain stores. For action payloads, use JSON.
**Warning signs:** New code splits on `:` to mutate arbitrary nested values.

### Pitfall 5: Native Chat APIs Increase Engine Requirements

**What goes wrong:** Implementation compiles locally but marketplace users on the declared `^1.90.0` engine do not have the needed chat/tool APIs.
**Why it happens:** Installed `@types/vscode` and VS Code may be newer than `package.json` engine.
**How to avoid:** If using `vscode.chat.createChatParticipant` or `vscode.lm.registerTool`, verify typings and bump `engines.vscode` deliberately.
**Warning signs:** New code references `vscode.chat` while `package.json` still advertises compatibility with `^1.90.0`.

## Code Examples

### Existing Harness Draft Pattern

```typescript
// Source: src/extension.ts and official workbench.action.chat.open behavior.
const query = buildHarnessDraftQuery({ isCursorOrCopilot, kind });

await vscode.commands.executeCommand("workbench.action.chat.open", {
  query,
  isPartialQuery: true,
});
```

### Existing Safe Write Boundary

```typescript
// Source: src/safeFileSystem.ts
if (rel === ".leanquill" || rel.startsWith(`.leanquill${path.sep}`)) {
  return true;
}

if (rel === `manuscript${path.sep}Book.txt`) {
  return true;
}
```

### Optional Native Chat Participant Registration

```typescript
// Source: VS Code Chat Participant API docs, 2026-04-22.
"contributes": {
  "chatParticipants": [
    {
      "id": "leanquill.story",
      "name": "leanquill",
      "fullName": "LeanQuill",
      "description": "Ask story questions with LeanQuill context.",
      "isSticky": true
    }
  ]
}
```

```typescript
// Source: VS Code Chat Participant API docs, 2026-04-22.
const participant = vscode.chat.createChatParticipant("leanquill.story", handler);
context.subscriptions.push(participant);
```

### Optional Native Metadata Tool Registration

```json
// Source: VS Code Language Model Tool API docs, 2026-04-22.
{
  "name": "leanquill_applyMetadataAction",
  "toolReferenceName": "leanquillApplyMetadataAction",
  "displayName": "Apply LeanQuill Metadata Action",
  "modelDescription": "Validate and apply an accepted LeanQuill metadata action. Never writes manuscript prose.",
  "canBeReferencedInPrompt": true,
  "inputSchema": {
    "type": "object",
    "properties": {
      "action": { "type": "object" }
    },
    "required": ["action"]
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed / Verified | Impact |
|---|---|---|---|
| Extension opens generic chat prompt only | Chat Participant API can define a domain-specific `@participant` | Official docs current 2026-04-22 | Useful for native VS Code/Copilot story chat if engine is bumped |
| Agent writes files directly | LM Tool API lets extensions expose typed tools with confirmation | Official docs current 2026-04-22 | Strong fit for metadata action application in Copilot agent mode |
| Hardcoding one model | Use `request.model` in chat participants or handle empty `selectChatModels` defensively | Official Language Model API docs current 2026-04-22 | Avoids assuming a specific Copilot model exists |
| Testing LM output directly | Unit-test prompt building and response/action interpretation; do not use LM API for integration tests | Official Language Model API docs current 2026-04-22 | Phase tests should focus deterministic code |
| Structured chat draft API | `workbench.action.chat.open` still uses string `query` plus `isPartialQuery` | Verified via VS Code issue/docs search | Draft strings are useful but not a typed contract |

**Deprecated/outdated:**

- Relying on legacy unprefixed `researcher` agent names should not be copied. Phase 15 established `LeanQuill-` prefixed naming for discoverability.
- Treating `.author-tool/` sample paths in imported contracts as canonical is outdated; LeanQuill runtime state belongs under `.leanquill/`.

## Open Questions

1. **How should non-native harness approval trigger extension application?**
   - What we know: Native VS Code tools can show confirmation; Cursor/Claude workflow files can ask for text confirmation.
   - What's unclear: Whether v1 should auto-apply accepted action files, require a LeanQuill command, or add harness-specific command/tool links.
   - Recommendation: Plan a deterministic `MetadataActionApplier` first and support command-based application as the portable baseline; add native tool confirmation as an enhancement when available.

2. **Are Phase 9 and Phase 10 complete when Phase 17 starts?**
   - What we know: Phase 17 depends on Phase 9 and Phase 10, but current `STATE.md` marks both not started.
   - What's unclear: Whether the planner should create prerequisite tasks or assume those phases will land before execution.
   - Recommendation: Treat Phase 17 planning as downstream; call out dependencies on persona baseline, AI safety rails, and AI review/chat-log contracts.

3. **Should story chat be native `@leanquill` in v1?**
   - What we know: Official APIs support it, but cross-environment portability is locked.
   - What's unclear: How much value a native participant adds relative to harness workflow files.
   - Recommendation: Do not make native participant required for Phase 17 success. Prefer harness-first; optionally plan a native participant only after portable workflows and stores are done.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|---|---|---:|---|---|
| Node.js | build/test | Yes | `v24.11.1` | None needed |
| npm | dependency/test scripts | Yes | `11.6.2` | None needed |
| Git | repo/audit workflow | Yes | `2.49.0.windows.1` | None needed |
| VS Code CLI | extension host/manual verification | Yes | `1.115.0` | Manual VS Code launch if CLI unavailable |
| Cursor/Copilot/Claude chat harnesses | story chat runtime | Partially verified | Existing repo has GSD harness dirs; LeanQuill runtime harness files are generated by init, not present in repo root | Use existing `workbench.action.chat.open` fallback hints |

**Missing dependencies with no fallback:** None for research/planning.

**Missing dependencies with fallback:**

- Harness-specific book-repo files are not present in the extension repo root. This is expected; `initialize.ts` generates them in initialized book workspaces. Plan tests around generated content strings, not current repo-root runtime files.

## Validation Architecture

### Test Framework

| Property | Value |
|---|---|
| Framework | Node built-in `node:test` with `node:assert/strict` |
| Config file | None; tests are bundled by esbuild |
| Quick run command | `npm run build:test && npm test` |
| Full suite command | `npm run build:test && npm test` |

### Phase Success Criteria -> Test Map

| Behavior | Test Type | Automated Command | File Exists? |
|---|---|---|---|
| Story chat draft opens with correct harness invocation for general/contextual chat | unit | `npm run build:test && npm test` | No, Wave 0 |
| Context bundle includes selected context and lightweight indexes but not full manuscript by default | unit | `npm run build:test && npm test` | No, Wave 0 |
| Memory records serialize/parse, link to associations, and supersede older records | unit | `npm run build:test && npm test` | No, Wave 0 |
| Metadata actions reject manuscript writes, path traversal, unknown operations, and stale old values | unit | `npm run build:test && npm test` | No, Wave 0 |
| Accepted metadata actions apply through domain stores and `SafeFileSystem` | unit/integration-lite | `npm run build:test && npm test` | No, Wave 0 |
| Chat/action logs record applied/rejected actions | unit | `npm run build:test && npm test` | No, Wave 0 |
| Actual chat UX works in Extension Development Host | manual | F5, then run LeanQuill story chat commands | Manual-only |

### Sampling Rate

- **Per task commit:** `npm run build:test && npm test` for changed `src/` / `test/`.
- **Per wave merge:** Full suite green.
- **Phase gate:** Full suite green plus manual F5 verification of chat draft/context menu entry points.

### Wave 0 Gaps

- [ ] `test/storyChatContext.test.ts` — context scoping, selected chapter/selection inclusion, full manuscript exclusion.
- [ ] `test/storyMemoryStore.test.ts` — memory schema, association frontmatter, superseding behavior.
- [ ] `test/metadataActionContract.test.ts` — action schema, path allowlist, operation allowlist, risk classification.
- [ ] `test/metadataActionApplier.test.ts` — applies issue/entity/memory updates through stores and blocks manuscript writes.
- [ ] `test/storyChatWorkflow.test.ts` or expanded `test/harnessChatDraft.test.ts` — generated workflow/entry point names and draft strings.

## Sources

### Primary (HIGH confidence)

- `.planning/phases/17-ai-story-chat-memory-and-metadata-actions/17-CONTEXT.md` - locked implementation decisions.
- `.planning/PROJECT.md`, `.planning/REQUIREMENTS.md`, `.planning/STATE.md` - product constraints, AI requirements, dependency state.
- `docs/ai-integration.md`, `docs/manuscript-safety.md` - AI philosophy and write boundary model.
- `src/initialize.ts`, `src/harnessChatDraft.ts`, `src/safeFileSystem.ts`, `src/openQuestionStore.ts`, `src/types.ts` - existing implementation patterns.
- VS Code Chat Participant API docs - https://code.visualstudio.com/api/extension-guides/chat, fetched 2026-04-25, page dated 2026-04-22.
- VS Code Language Model API docs - https://code.visualstudio.com/api/extension-guides/language-model, fetched 2026-04-25, page dated 2026-04-22.
- VS Code Language Model Tool API docs - https://code.visualstudio.com/api/extension-guides/tools, fetched 2026-04-25, page dated 2026-04-22.

### Secondary (MEDIUM confidence)

- Web search result for `workbench.action.chat.open` parameters and related VS Code issue #210819 - useful for current draft-query behavior, but not a formal stable API reference.
- `npm view` registry checks for package currency on 2026-04-25.

### Tertiary (LOW confidence)

- None used for architectural recommendations.

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH - repo stack and official VS Code docs are current.
- Architecture: HIGH - patterns are anchored in existing LeanQuill Phase 12/15 workflow generation and `SafeFileSystem`.
- Pitfalls: HIGH for safety/context risks; MEDIUM for cross-harness approval details because confirmation support varies by environment.
- Environment: MEDIUM - local Node/npm/git/VS Code are verified; chat harness availability must be manually verified in Extension Development Host and supported user environments.

**Research date:** 2026-04-25
**Valid until:** 2026-05-25 for repo patterns; recheck VS Code chat/LM docs before implementing native Chat Participant or LM Tool APIs.
