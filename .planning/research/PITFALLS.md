# Domain Pitfalls - LeanQuill VS Code Extension

**Domain:** VS Code extension for LeanPub markdown authoring with AI integration  
**Researched:** 2026-03-29  
**Overall confidence:** HIGH

## Phase Legend

| Phase | Focus |
|---|---|
| Phase 1 | Extension foundation (manifest, activation, build/publish baseline) |
| Phase 2 | Sidebar UI architecture (tree + multi-webview messaging) |
| Phase 3 | Local-first state layer (.leanquill files, watchers, cache/index) |
| Phase 4 | AI workflows + tool safety boundaries (vscode.lm + write-blocks) |
| Phase 5 | UX polish, performance hardening, onboarding, Marketplace readiness |

## 1) Multi-Webview Sidebar Panels (CSP, messaging, lifecycle)

| Pitfall | Warning Signs | Prevention Strategy | Phase |
|---|---|---|---|
| Missing or weak CSP in webviews | Webview works in dev but fails after adding scripts; console shows CSP errors; reviewer flags unsafe-inline/unsafe-eval | Generate strict CSP per view render; use nonce-based script tags; restrict localResourceRoots; ban remote script/style sources | Phase 2 |
| Message contract drift between extension host and webview | UI silently stops updating; onDidReceiveMessage gets unknown types; runtime JSON shape mismatches | Define shared message schema types in one source file; validate incoming message.type; reject unknown payloads and log telemetry/debug output | Phase 2 |
| View leaks from retained listeners/timers | Memory grows after opening/closing views; duplicate reactions to one event; stale updates after reload | Register every listener/timer in Disposable containers; dispose on view dispose; avoid global singleton listeners tied to transient views | Phase 2 and Phase 5 |
| Rebuilding full webview HTML on every state change | Flicker, scroll reset, poor responsiveness on active editor changes | Render shell once, then push incremental postMessage updates; diff payloads and update only changed sections | Phase 2 |
| Webview and extension state desync | Tree shows one chapter while context pane shows another; race after rapid editor switching | Use a monotonic request/version token for active-chapter updates; ignore stale responses in webview and host | Phase 2 and Phase 3 |

## 2) vscode.lm Integration (limits, streaming, tool loops, cold-start)

| Pitfall | Warning Signs | Prevention Strategy | Phase |
|---|---|---|---|
| Assuming system-role support exists | Prompts lose policy constraints; behavior changes across model providers | Put non-negotiable policy in first user message and in tool-level guards; never rely on hidden system prompts | Phase 4 |
| Unbounded context assembly causing token overflow and truncation | Responses stop mid-thought; missing issue fields; provider errors on larger chapters | Build a deterministic context budgeter (chapter text, knowledge snippets, issue history); trim by priority; include explicit truncation markers | Phase 4 |
| Streaming path not resilient to cancellation/errors | Partial response breaks parser; hung UI progress state; no saved transcript when canceling | Handle cancellation token in every async loop; checkpoint streamed chunks; write chat logs atomically with status metadata (complete/canceled/failed) | Phase 4 |
| Tool call recursion or loop chains | Same tool repeatedly invoked; excessive latency/cost; no terminal answer | Cap tool-call depth and total tool invocations per request; maintain visited-call signature set; enforce fail-fast fallback response | Phase 4 |
| Slow first-run due to model discovery and warm-up on critical path | First AI command appears frozen for several seconds; users retry command | Preflight model availability after activation idle; cache model selection per session; show progress stages and early failure messages | Phase 4 and Phase 5 |
| Treating model output as trusted structured data | JSON parse failures; malformed issue files committed to repo | Use strict schema validation before write; reject invalid payloads with repair prompt or manual review flow | Phase 4 |

## 3) Local-First File-Based State (.leanquill + workspace)

| Pitfall | Warning Signs | Prevention Strategy | Phase |
|---|---|---|---|
| File watcher race conditions and event storms | Duplicate refreshes, high CPU, stale tree after burst edits | Debounce watcher events by path/type; coalesce invalidations; re-read canonical file state before applying cache updates | Phase 3 |
| .gitignore and contributor excludes hide critical state | Team members missing .leanquill files; inconsistent behavior across machines | Add init-time guard that checks .gitignore for bad patterns; provide quick-fix command to whitelist required .leanquill paths | Phase 1 and Phase 3 |
| Cache/index invalidation misses transitive dependencies | Chapter order or issue counts wrong until reload | Maintain explicit dependency graph (Book.txt -> chapter order; issues -> chapter badges; personas -> AI context); invalidate by graph, not file alone | Phase 3 |
| Concurrent edits from extension + user + git operations | Lost writes, overwritten metadata, merge churn in YAML/MD | Use compare-before-write with file mtime/hash; perform atomic write temp->rename; surface conflict resolution UI when base changed | Phase 3 |
| Blocking extension host with heavy parse/index work | UI stalls during startup or large manuscript updates | Move parse/index to incremental async tasks; chunk long work and yield between batches; show background indexing status | Phase 3 and Phase 5 |
| Assuming Node fs semantics in all environments | Breakage in remote/WSL/Codespaces scenarios | Use vscode.workspace.fs and URI-based paths everywhere; normalize paths consistently before cache keys | Phase 1 and Phase 3 |

## 4) Marketplace Publishing and Manifest Hygiene

| Pitfall | Warning Signs | Prevention Strategy | Phase |
|---|---|---|---|
| Oversized VSIX package | Publish warnings/errors; slow install; users report bloat | Bundle with esbuild, externalize vscode, exclude tests/docs/sources via .vscodeignore or files whitelist; enforce size budget in CI | Phase 1 and Phase 5 |
| Over-eager activation harming startup | Extension activates in unrelated folders; activation time spikes | Use precise activation conditions (workspaceContains project marker, commands, views); measure and track activation time budget | Phase 1 and Phase 5 |
| Incorrect engines.vscode targeting | Extension fails on intended users or misses required APIs | Set minimum engine to lm/tool API requirement; test on min supported version and latest stable before publish | Phase 1 |
| Missing or incorrect contributes entries | Commands absent from palette/context menus; views not visible | Add manifest contract tests that assert contributes.commands, menus, views, chat participant IDs match code constants | Phase 1 and Phase 5 |
| Marketplace asset violations (icons, keywords, metadata) | Publish rejection late in release flow | Add prepublish lint for icon format/size, keyword count, mandatory metadata fields | Phase 1 |

## 5) TypeScript + esbuild for VS Code Extensions

| Pitfall | Warning Signs | Prevention Strategy | Phase |
|---|---|---|---|
| Tree-shaking removes side-effect registrations | Commands/chat/tools exist in code but not active at runtime | Keep registration calls in explicit activation path; avoid relying on import side effects; mark sideEffects only when truly needed | Phase 1 and Phase 4 |
| Native module assumptions in extension host bundle | Runtime module load errors on some platforms | Avoid native deps unless required; if required, package per-platform artifacts and test matrix before adoption | Phase 1 |
| Path alias mismatch between tsconfig and bundler | Build passes in tsc but runtime cannot resolve modules | Mirror alias config in esbuild; prefer relative imports for extension entry graph unless alias adds clear value | Phase 1 |
| Watch mode drift between type-check and bundle outputs | Dev appears fine but CI/package fails, or inverse | Run parallel watch for esbuild + tsc --noEmit; fail CI on either; validate dist smoke test in prepublish script | Phase 1 and Phase 5 |

## 6) Gutter Decoration Management

| Pitfall | Warning Signs | Prevention Strategy | Phase |
|---|---|---|---|
| Creating many decoration types instead of reusing | Memory growth and rendering slowdown in large chapters | Reuse a small fixed set of decoration types per severity/status; update ranges only | Phase 2 and Phase 5 |
| Not disposing stale decoration types and editor listeners | Decorations persist after issue dismissal; duplicate event handlers | Track all disposables centrally; dispose on deactivate and on feature re-init; integration test for repeated open/close cycles | Phase 2 |
| Span hints not remapped after edits | Gutter markers drift away from intended text | Recompute ranges on document change with resilient matcher (line anchor + text probe); degrade gracefully to chapter-level marker when exact span fails | Phase 3 |
| Updating decorations on every keystroke without throttling | Editor typing lag | Throttle decoration refresh; prioritize visible editor only; defer full recompute until idle | Phase 5 |

## 7) Write-Block Enforcement for AI Safety

| Pitfall | Warning Signs | Prevention Strategy | Phase |
|---|---|---|---|
| Policy-only protection (instructions without hard guardrails) | Rare but severe manuscript writes after prompt drift | Enforce deny-by-default write layer: hard block all manuscript URIs in SafeFileSystem and tool registry; no tool capable of manuscript write is ever registered | Phase 4 |
| Single-layer defense | One bug bypasses protection and causes irreversible edits | Implement multi-layer controls: URI path guard, tool allowlist, operation audit log, pre-write assertion tests, and manual dry-run mode for risky actions | Phase 4 and Phase 5 |
| No adversarial or regression tests for safety boundary | Safety assumptions unverified; changes silently weaken controls | Add dedicated test suite with malicious prompt/tool-call scenarios and path traversal attempts; gate release on pass | Phase 4 and Phase 5 |

## 8) Author-Centric UX Inside a Developer IDE

| Pitfall | Warning Signs | Prevention Strategy | Phase |
|---|---|---|---|
| Technical-first UI language overwhelms authors | High command abandonment; user confusion in first session | Use author vocabulary (chapter, issue, session note) in commands/views; hide internal terms (cache, index, tool) from primary flows | Phase 2 and Phase 5 |
| Command palette clutter and ambiguous names | Multiple similar commands chosen incorrectly | Create task-oriented command groups with clear prefixes and short verbs; include when-clause scoping so only relevant commands appear | Phase 2 |
| No first-run onboarding path | Users do not initialize project structure correctly; support questions spike | Provide one guided setup command with validation checklist and fix actions (missing folders, config schema, gitignore checks) | Phase 1 and Phase 5 |
| AI features overshadow non-AI core workflow | Product feels unusable when AI is unavailable | Ensure Track 1 workflows are complete and discoverable without AI; add graceful fallback messaging when model unavailable | Phase 4 and Phase 5 |

## Cross-Phase Early Warning Dashboard

| Signal | Likely Root Cause | Escalate By |
|---|---|---|
| Activation time regression beyond baseline budget | Over-broad activation or heavy startup indexing | Phase 1 owner |
| Increasing memory after repeated webview open/close | Disposable leaks in webview lifecycle | Phase 2 owner |
| Inconsistent chapter/issue counts after file churn | Cache invalidation graph incomplete | Phase 3 owner |
| AI output parse failures above threshold | Context budget or schema validation weak | Phase 4 owner |
| First-week user drop after install | Onboarding friction and command discoverability issues | Phase 5 owner |

## Sources

- VS Code extension docs (activation, webviews, TreeView, workspace.fs, publishing)
- VS Code Language Model API docs (chat participant, tools, streaming, errors)
- Project constraints and decisions in PROJECT.md, STACK.md, and ARCHITECTURE.md

## Confidence Notes

- HIGH: Pitfalls tied directly to explicit LeanQuill constraints (local-first, manuscript immutability, vscode.lm-only)
- MEDIUM: Threshold values for performance budgets should be calibrated with real telemetry during implementation
