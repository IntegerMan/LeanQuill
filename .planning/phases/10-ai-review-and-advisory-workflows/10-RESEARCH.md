# Phase 10: AI Review and Advisory Workflows - Research

**Researched:** 2026-04-25
**Domain:** VS Code extension AI workflows, local markdown audit artifacts, issue/chat metadata safety
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
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

### Deferred Ideas (OUT OF SCOPE)
## Deferred Ideas

- **Automated `master-issues.md` consolidation** — explicitly deferred beyond Phase 10 per D-17 (see `Imported/data-contracts/issue-schema.md` narrative for future consolidation work).

### Reviewed Todos (not folded)

- None (todo matcher returned no pending todos for Phase 10 during discuss-phase).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AIR-01 | Author can trigger a chapter review from chapter tree or chat command; configured active personas run against the chapter and produce a timestamped session issue file and chat log entry. | Use `getEnabledPersonasForProject`, QuickPick selection, session/chat stub stores, VS Code LM API or chat-open fallback, and issue session serializer. |
| AIR-02 | Author can invoke post-write story intelligence update; agent analyzes active chapter and updates notes with backlinks, never manuscript files. | Use debounced `onDidSaveTextDocument`, explicit command parity, whole-chapter input, and existing `MetadataAction` approval path for note writes. |
| AIR-03 | Issue chat is scoped to issue record and relevant chapter text around span hint; advisory mode only, never writes manuscript paths. | Extend `chatAboutIssue` context assembly to include issue markdown, linked full chapter/target file, active memory, and safety prompt. |
| ISSUE-05 | Author can right-click any issue and choose "Chat about this" to open focused AI conversation scoped to the issue. | Add UI row/context entry points in shared issues webviews and route to the existing `leanquill.chatAboutIssue` command with fixed context bundle. |
</phase_requirements>

## Summary

Phase 10 should be planned as an extension of the Phase 8 issue model and Phase 9 AI safety baseline, not as a new AI subsystem. The repo already has the core primitives: typed issue markdown under `.leanquill/issues/{type}/`, issue filters and webview hosts, active persona resolution, story chat context bundles, story memory, chat log persistence, metadata-action validation/application, and SafeFileSystem write boundaries.

The biggest implementation gap is workflow orchestration and artifact shape. Chapter review needs a first-class session store that creates `.leanquill/issues/sessions/{session_id}.md` and `.leanquill/chats/{session_id}.md` stubs before any model/chat interaction, then updates them with summary/output. Issue chat needs a context bug fix: current `chatAboutIssue` includes only `.leanquill/issues/${issue.fileName}` and a manuscript scope flag; it does not explicitly include the associated chapter or linked target file required by D-06 through D-08.

**Primary recommendation:** Build a small `aiReviewWorkflow` layer around existing stores: select personas, create durable session/chat stubs, assemble explicit context bundles, invoke VS Code LM/chat only from user actions, persist outcome summaries, and route all note updates through approved `MetadataAction` JSON.

## Project Constraints (from .cursor/rules/)

No `.cursor/rules/*.md` files were found. Applicable workspace constraints come from `AGENTS.md`, `.planning/PROJECT.md`, `docs/manuscript-safety.md`, and the GSD skills:

- AI may advise, never author manuscript prose.
- Normal operation must not write chapter files under `manuscript/**`; `manuscript/Book.txt` remains limited to non-AI scaffold/sync flows.
- All AI workflow state must be local-first and persisted under `.leanquill/**` or configured notes/research folders.
- Use VS Code LM API only for AI providers; no external provider HTTP calls or API keys.
- After changing `src/` or `test/`, run `npm run build:test` then `npm test`.
- GSD planning expects research-driven PLAN files, verification loops, and UAT artifacts; UI work should respect the existing webview/CSP/codicon patterns.

## Standard Stack

### Core

| Library/API | Version | Purpose | Why Standard |
|-------------|---------|---------|--------------|
| VS Code Extension API | Engine `^1.90.0`; local `code` CLI `1.115.0`; `@types/vscode` pinned `^1.90.0` (registry current `1.116.0`, modified 2026-04-15) | Commands, context menus, webviews, workspace save events, Language Model API | Existing extension target; Context7 official docs cover `registerCommand`, `executeCommand`, `vscode.lm.selectChatModels`, and `sendRequest`. |
| TypeScript | Pinned `^5.8.3` (registry current `6.0.3`, modified 2026-04-16) | Extension source and tests | Repo standard, strict TS, no need to upgrade for this phase. |
| Node.js APIs (`fs/promises`, `path`, `crypto`) | Local Node `v24.11.1`; package uses `@types/node ^22.10.0` (registry current `25.6.0`, modified 2026-04-10) | Local markdown/JSONL stores and IDs | Existing store modules use Node APIs directly. |
| `SafeFileSystem` | Local module | Enforced write allowlist | Phase 9 safety baseline; every AI write path should use it or a module that uses it. |
| `MetadataAction` contract/applier | Local modules | Approved story-note and metadata writes | Already validates paths, approval, stale `oldValue`, and outcome logging. |
| `openQuestionStore` issue model | Local module | Normal per-issue markdown creation, parsing, filtering | Phase 8 canonical issue storage and UI surfaces. |

### Supporting

| Library/API | Version | Purpose | When to Use |
|-------------|---------|---------|-------------|
| `@vscode/codicons` | Pinned/current `^0.0.45` (registry current `0.0.45`, modified 2026-04-14) | Webview icons and menu visual consistency | Add chapter review / chat affordance icons using existing codicon CSS. |
| `esbuild` | Pinned `^0.25.3` (registry current `0.28.0`, modified 2026-04-02) | Build/test bundling | Keep existing scripts; no phase-specific bundler work. |
| `node:test` + `assert/strict` | Built-in | Unit tests | Existing harness runs bundled `dist-test/**/*.test.js`. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Existing markdown/JSONL stores | SQLite or embedded DB | Contradicts local git-diffable design; unnecessary for v1 artifacts. |
| VS Code LM API | External OpenAI/Anthropic HTTP clients | Explicitly out of scope; would require API keys and new security surface. |
| Current webview issue hosts | New React/Svelte UI stack | Too much churn; existing shared HTML renderer already supports issue rows, filters, and postMessage. |
| MetadataAction JSON | Direct note-file mutation from AI workflow code | Loses approval/audit semantics and duplicates Phase 9 safety logic. |

**Installation:** No new package is recommended.

```bash
# No install step. Keep the existing dependency set.
```

**Version verification:** `npm view` checked `@vscode/codicons`, `esbuild`, `typescript`, `@types/vscode`, and `@types/node` on 2026-04-25. Do not upgrade pinned tooling as part of Phase 10 unless a specific VS Code API type gap blocks implementation.

## Architecture Patterns

### Recommended Project Structure

```text
src/
├── aiReviewWorkflow.ts          # chapter review and story-intelligence orchestration
├── aiReviewSessionStore.ts      # .leanquill/issues/sessions/*.md stubs/finalization
├── chatLogSchema.ts             # schema-aligned chat log serialization/backward-compatible parse
├── storyChatContext.ts          # extend launch/session types and explicit issue context paths
├── openQuestionStore.ts         # reuse for promotion into normal issue markdown
├── metadataAction*.ts           # reuse for story-note update application/audit
└── extension.ts                 # command registration, save prompt wiring, UI command handlers
test/
├── aiReviewSessionStore.test.ts
├── aiReviewWorkflow.test.ts
├── storyChatContext.test.ts
├── storyChatLogStore.test.ts
└── metadataAction*.test.ts
```

### Pattern 1: User-Triggered AI Workflow Shell

**What:** Every AI workflow starts from a VS Code command, context menu, or explicit Run action. It resolves input, asks for persona scope, creates stubs, then invokes the LM/chat path.

**When to use:** Chapter review and explicit story intelligence update. The save-trigger path should only prompt; it should not call AI until the user clicks Run.

**Example:**

```typescript
// Source: VS Code Extension API docs via Context7, /websites/code_visualstudio_api
const models = await vscode.lm.selectChatModels();
if (models.length === 0) {
  await vscode.commands.executeCommand("workbench.action.chat.open", { query, isPartialQuery: true });
  return;
}
const response = await models[0].sendRequest(messages, { justification: "Run LeanQuill chapter review" }, token);
```

**Planning note:** If direct `vscode.lm` is used, catch `LanguageModelError` for consent/quota/model failures and fall back to the existing chat-open draft query so the user still gets an advisory workflow without external keys.

### Pattern 2: Stubs Before Model Work

**What:** Create session issue and chat log stubs using the same `session_id` before any model request or chat launch.

**When to use:** AIR-01 chapter review and AIR-02 story intelligence update.

**Example:**

```typescript
const sessionId = createAiWorkflowSessionId("chapter-review", now);
await saveReviewSessionStub(rootPath, safeFs, { sessionId, chapterRef, personaIds, startedAt });
await saveStoryChatLogSummary(rootPath, safeFs, {
  sessionId,
  startedAt,
  endedAt: "",
  launchedFrom: "chapter-review",
  chapterRef,
  chaptersInContext: [chapterRef],
  summary: "Session started.",
  memoryEntryIds: [],
  metadataActionIds: [],
});
```

**Planning note:** Extend `StoryChatLogSummary` instead of replacing it wholesale. Existing parser is intentionally best-effort and should remain backward compatible.

### Pattern 3: Explicit Issue Context Bundle

**What:** Issue chat context must include concrete paths, not just a `manuscriptScope` marker.

**When to use:** `leanquill.chatAboutIssue` and any webview row action calling it.

**Example:**

```typescript
const includedPaths = [`.leanquill/issues/${issue.fileName}`];
if (issue.association.kind === "chapter" || issue.association.kind === "selection") {
  includedPaths.push(issue.association.chapterRef);
}
```

**Planning note:** For character/place/thread/research issues, resolve configured folder paths and include the linked target file. For book-wide issues, include only the base bundle and issue markdown.

### Pattern 4: Story Intelligence Uses MetadataAction

**What:** AI proposes note updates as `MetadataAction` JSON; the extension applies only approved `requiresApproval` actions for configured notes/research/theme roots.

**When to use:** AIR-02 post-write entity/event backlinks and any metadata update suggested during issue chat.

**Example:**

```json
{
  "schemaVersion": "1",
  "actionId": "siu-001",
  "sourceChatId": "2026-04-25-184200-story-intelligence-update",
  "operation": "append",
  "targetPath": "notes/characters/hero.md",
  "fieldPath": ["customFields", "chapter_backlinks"],
  "oldValue": "",
  "newValue": "- manuscript/ch03.md: appeared in the dock scene",
  "rationale": "Adds a source backlink from the post-write update.",
  "risk": "requiresApproval",
  "authorApproval": {
    "approvedAt": "2026-04-25T18:44:00.000Z",
    "method": "extension-command"
  }
}
```

### Anti-Patterns to Avoid

- **AI writes direct notes/manuscript files:** Route note changes through `MetadataAction`; manuscript prose writes must remain blocked.
- **Session issue files treated as normal list issues:** `listOpenQuestions` intentionally skips `sessions`; promotion must create normal `.leanquill/issues/{type}/...` files.
- **Silent persona choice:** Always ask one enabled persona vs all enabled each run.
- **Transcript as required artifact:** VS Code chat history APIs expose history for a chat participant, not arbitrary workbench chat transcripts; keep transcripts optional and summary-first.
- **`master-issues.md` work:** Explicitly deferred. Do not plan consolidation, rollup automation, or sync semantics.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| File write safety | Custom `startsWith("manuscript")` checks in workflow code | `SafeFileSystem` plus `validateMetadataAction` | Handles configured roots, Book.txt AI block, traversal, absolute paths, and audit outcomes. |
| Persona enablement | Manual YAML scan in workflow | `getEnabledPersonasForProject` / `resolveActivePersonas` | Preserves Phase 9 warnings, disabled skip semantics, and validation behavior. |
| Normal issue creation | Raw markdown string scattered in workflow | `createOpenQuestion` / `saveOpenQuestion` or a narrow promotion helper built on their serializer | Keeps v3 typed folder layout, frontmatter shape, status set, and association fields consistent. |
| Story-note updates | Workflow-specific note patcher | `MetadataAction` JSON with `requiresApproval` | Provides author approval, stale checks, and outcome log entries. |
| Issue list UI duplication | Separate issue chat UI | `openQuestionsHtml` shared postMessage protocol and existing panel/planning hosts | Avoids divergent filters/actions across dual hosts. |
| External AI provider integration | HTTP SDK calls and API key storage | VS Code LM API / chat command fallback | Project policy is VS Code API only for v1. |

**Key insight:** The hard part is not model invocation; it is preserving auditability and safety while threading exact context through existing issue, chat, persona, memory, and metadata contracts.

## Common Pitfalls

### Pitfall 1: `chatAboutIssue` Scope Without Context

**What goes wrong:** The model sees the issue markdown but not the chapter or linked note file, so ISSUE-05/AIR-03 technically fires but gives under-scoped advice.
**Why it happens:** Current command calculates manuscript scope but only includes `.leanquill/issues/${issue.fileName}`.
**How to avoid:** Add association-aware included paths and tests for chapter, selection, character, place, thread, research, and book associations.
**Warning signs:** Context summary says `Manuscript scope: chapter` but `Included paths` lacks `manuscript/...`.

### Pitfall 2: Save Event Runs AI Without Consent

**What goes wrong:** A debounced save silently starts model calls.
**Why it happens:** Treating `onDidSaveTextDocument` as the trigger rather than a prompt source.
**How to avoid:** Save event should set/refresh a non-blocking Run/Dismiss prompt; only Run invokes persona selection and AI.
**Warning signs:** Tests or code call `vscode.lm.sendRequest` from save-handler code before user choice.

### Pitfall 3: Session Artifacts Created Too Late

**What goes wrong:** A failed or cancelled review leaves no reproducible history.
**Why it happens:** Creating files only after model output succeeds.
**How to avoid:** Persist session and chat log stubs immediately after author confirms run/persona scope.
**Warning signs:** Error path has only a toast/output log and no `.leanquill/issues/sessions/*.md`.

### Pitfall 4: Proposed Metadata Log Stream

**What goes wrong:** Phase adds `proposed` entries to `.leanquill/metadata-actions.jsonl`, contradicting D-15.
**Why it happens:** `MetadataActionLogStatus` currently includes `"proposed"` as a type option even though the applier writes only outcomes.
**How to avoid:** Plans should avoid writing proposed entries. If touching the type, narrow it to outcome statuses or add tests proving no proposed records are appended.
**Warning signs:** JSONL entries with `"status":"proposed"`.

### Pitfall 5: YAML/Markdown Parsing Expansion

**What goes wrong:** Session issue embedded records become unparseable as formatting evolves.
**Why it happens:** Copy-pasted regex frontmatter parsing for multi-record markdown.
**How to avoid:** Centralize session issue serialization/parsing in `aiReviewSessionStore.ts`; keep the accepted session format narrow and test round trips.
**Warning signs:** Multiple files independently split `---` fences or parse embedded issue blocks differently.

## Code Examples

### Existing Command Registration Pattern

```typescript
// Source: VS Code Extension API docs and current src/extension.ts pattern
const chapterReviewCommand = vscode.commands.registerCommand(
  "leanquill.reviewChapter",
  async (arg?: { chapterPath?: string }) => {
    const chapterRef = await resolveChapterFromArgOrEditor(arg);
    if (!chapterRef) {
      await vscode.window.showWarningMessage("LeanQuill: Choose a chapter to review.");
      return;
    }
    await runChapterReviewWorkflow({ rootPath, safeFileSystem, chapterRef });
  },
);
context.subscriptions.push(chapterReviewCommand);
```

### Save Prompt Debounce Pattern

```typescript
// Source: VS Code Extension API event model; keep AI call behind explicit Run.
let storyUpdateTimer: ReturnType<typeof setTimeout> | undefined;
context.subscriptions.push(vscode.workspace.onDidSaveTextDocument((doc) => {
  const rel = path.relative(rootPath, doc.uri.fsPath).split(path.sep).join("/");
  if (!rel.startsWith("manuscript/") || !rel.endsWith(".md")) {
    return;
  }
  if (storyUpdateTimer) {
    clearTimeout(storyUpdateTimer);
  }
  storyUpdateTimer = setTimeout(() => {
    void vscode.window.showInformationMessage(
      "Run LeanQuill story intelligence update for this chapter?",
      "Run",
      "Dismiss",
    ).then((choice) => {
      if (choice === "Run") {
        void vscode.commands.executeCommand("leanquill.runStoryIntelligenceUpdate", { chapterPath: rel });
      }
    });
  }, 1500);
}));
```

### Issue Chat Context Fix

```typescript
// Source: current OpenQuestionAssociation contract in src/types.ts
function pathsForIssueChat(issue: OpenQuestionRecord, cfg: ProjectConfig): string[] {
  const paths = [`.leanquill/issues/${issue.fileName}`];
  switch (issue.association.kind) {
    case "chapter":
      paths.push(issue.association.chapterRef);
      break;
    case "selection":
      paths.push(issue.association.chapterRef);
      break;
    case "character":
      paths.push(`${cfg.folders.characters.replace(/\/+$/, "")}/${issue.association.fileName}`);
      break;
    case "place":
      paths.push(`${cfg.folders.settings.replace(/\/+$/, "")}/${issue.association.fileName}`);
      break;
    case "thread":
      paths.push(`${cfg.folders.threads.replace(/\/+$/, "")}/${issue.association.fileName}`);
      break;
    case "research":
      paths.push(`${cfg.folders.research.replace(/\/+$/, "")}/${issue.association.fileName}`);
      break;
  }
  return paths;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Extension opens chat with only a starter prompt | Extension can use VS Code LM API `selectChatModels`/`sendRequest` for user-triggered requests, with chat-open fallback | VS Code AI APIs documented in current Extension API docs | Chapter review can be extension-owned and auditable, but must handle consent/quota/model absence. |
| Chat transcript as full audit | Summary-first chat log with optional transcript | Locked by Phase 10 D-16 and supported by VS Code chat API limitations | Planner should make summaries/counters/session paths canonical, transcript best effort. |
| Single issue markdown files only | Hybrid session issue artifact plus promotion into normal issues | Locked by Phase 10 D-02/D-05 | Need separate session store; do not force session findings through `listOpenQuestions`. |
| Low-risk metadata writes for notes | Story-note writes require `requiresApproval` + `authorApproval` | Phase 9 D-11 and Phase 10 D-12 | Story intelligence must produce approved actions, not auto-append notes. |

**Deprecated/outdated:**

- `master-issues.md` consolidation in imported issue schema: future concept only; out of scope for Phase 10.
- External AI keys/providers: out of scope for v1.
- Treating `proposed` metadata-action JSONL entries as required: explicitly not Phase 10.

## Open Questions

1. **Direct LM requests vs chat-open fallback for AIR-01**
   - What we know: Official VS Code docs support `vscode.lm.selectChatModels` and `sendRequest`, but calls can fail for consent, missing model, or quota. Existing LeanQuill flows already use `workbench.action.chat.open`.
   - What's unclear: Whether product wants fully extension-owned automated model runs in this phase or a chat-harness workflow with durable stubs.
   - Recommendation: Plan the workflow interface so direct LM is the primary implementation for review output, with chat-open fallback that still creates stubs and instructs the user/agent to save the summary.

2. **Exact session issue embedded-record parser**
   - What we know: `issue-schema.md` gives a narrative and examples, not a strict parser-ready grammar.
   - What's unclear: Whether every embedded finding must be machine-promotable immediately.
   - Recommendation: Define a minimal fenced-record format in `aiReviewSessionStore.ts` and test promotion from that format only.

3. **Story intelligence target note taxonomy**
   - What we know: MetadataAction supports character, place, thread, theme, research, memory, and issues; AIR-02 mentions entities/events/backlinks.
   - What's unclear: There is no dedicated event/timeline store in current code.
   - Recommendation: Start with character/place/thread/theme/research/memory actions supported by existing applier. Do not create a new timeline/event schema unless planner scopes a separate task and tests it.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | Build/test scripts and stores | Yes | `v24.11.1` | None needed |
| npm | Dependency/test scripts and version checks | Yes | `11.6.2` | None needed |
| VS Code CLI | Manual extension-host verification | Yes | `1.115.0` | Use Cursor/VS Code Run and Debug if CLI unavailable |
| VS Code LM provider | Runtime AI workflows | Not probeable from shell | User's active VS Code/Copilot session | Chat-open fallback and manual summary save |

**Missing dependencies with no fallback:** None found at research time.

**Missing dependencies with fallback:**

- VS Code LM model availability cannot be verified from shell; planner should include graceful handling for no model, consent denial, and quota errors.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | `node:test` with `node:assert/strict`, bundled by esbuild |
| Config file | none; package scripts in `package.json` |
| Quick run command | `npm run build:test && npm test` |
| Full suite command | `npm run build:test && npm test` |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| AIR-01 | Chapter review command creates session issue stub and chat log stub with same `session_id`, selected persona ids, chapter context, and final summary/counters. | unit + extension command smoke via pure helpers | `npm run build:test && npm test` | No - add `test/aiReviewSessionStore.test.ts`, `test/aiReviewWorkflow.test.ts` |
| AIR-02 | Save prompt does not auto-run AI; explicit Run/command performs whole-chapter story update and only applies approved MetadataActions. | unit | `npm run build:test && npm test` | Partial - extend `metadataAction*.test.ts`; add workflow tests |
| AIR-03 | Issue chat context includes issue markdown, full chapter for chapter/selection associations, linked target files for entity/research associations, and active memory. | unit | `npm run build:test && npm test` | Partial - extend `test/storyChatContext.test.ts` and add command helper tests |
| ISSUE-05 | Issue UI/right-click action routes selected issue id to `leanquill.chatAboutIssue`. | unit/webview protocol | `npm run build:test && npm test` | Partial - extend open question HTML/panel tests or add host helper tests |

### Sampling Rate

- **Per task commit:** `npm run build:test && npm test`
- **Per wave merge:** `npm run build:test && npm test`
- **Phase gate:** Full suite green, then manual F5 verification in Extension Development Host with a LeanPub book workspace.

### Wave 0 Gaps

- [ ] `test/aiReviewSessionStore.test.ts` - session issue stub/finalization, embedded finding round trip, promotion source path.
- [ ] `test/aiReviewWorkflow.test.ts` - persona selection inputs, session/chat stub creation before AI call, fallback handling.
- [ ] `test/storyChatContext.test.ts` - issue association path inclusion and active memory guarantees.
- [ ] `test/storyChatLogStore.test.ts` - schema-aligned fields: `session_type`, `persona_ids`, `chapters_in_context`, `session_issue_file`, counters, backward-compatible parse.
- [ ] `test/metadataActionContract.test.ts` / `test/metadataActionApplier.test.ts` - no proposed JSONL entries; story-note writes require approval.

## Sources

### Primary (HIGH confidence)

- `Imported/data-contracts/issue-schema.md` - session issue narrative, issue field shape, issue types.
- `Imported/data-contracts/chat-log-schema.md` - canonical chat log frontmatter and session types.
- `Imported/data-contracts/persona-schema.md` - enabled persona semantics, context access, feedback priorities.
- `Imported/data-contracts/project-config-schema.md` - `active_personas`, `ai_policy`, folder roots.
- `docs/manuscript-safety.md` - SafeFileSystem write boundary and manuscript immutability.
- `docs/ai-integration.md` - VS Code LM API-only and advisory-only posture.
- `.planning/phases/10-ai-review-and-advisory-workflows/10-CONTEXT.md` - locked Phase 10 decisions.
- `.planning/phases/09-ai-safety-rails-and-persona-baseline/09-CONTEXT.md` - Phase 9 persona and metadata-action safety decisions.
- `.planning/phases/08-issue-capture-triage-and-editor-signals/08-CONTEXT.md` - issue layout and deferred AI session outputs.
- `src/storyChatContext.ts`, `src/storyChatLogStore.ts`, `src/metadataAction*.ts`, `src/openQuestionStore.ts`, `src/personaStore.ts`, `src/extension.ts` - current implementation seams.
- Context7 `/websites/code_visualstudio_api` - current VS Code command, chat, and LM API documentation.

### Secondary (MEDIUM confidence)

- `package.json` and `npm view` registry checks on 2026-04-25 - dependency pin/current version comparison.

### Tertiary (LOW confidence)

- None. Research did not rely on unverified community sources.

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH - repo-local stack is established and package/API versions were verified.
- Architecture: HIGH - based on locked decisions plus existing Phase 8/9 code seams.
- Pitfalls: HIGH - backed by direct code inspection and current tests.
- VS Code chat transcript limitations: MEDIUM - Context7 documents chat participant history for participant sessions and LM requests, but does not provide an explicit negative statement for arbitrary workbench chat transcript capture.

**Research date:** 2026-04-25
**Valid until:** 2026-05-25 for repo architecture; re-check VS Code LM API docs before implementing direct model calls.
