# LeanQuill Research Summary

## 1. Stack
- Use VS Code extension APIs with TypeScript 5.7 + @types/vscode >=1.96 and engines.vscode ^1.95.0 to guarantee lm tools/chat support and stable sidebar/webview APIs.
- Use esbuild as the extension bundler (with vscode externalized) plus parallel tsc --noEmit for type safety and fast iteration.
- Use vscode.workspace.fs (URI-first) for all file IO to stay reliable across local, WSL, SSH, and Codespaces environments.
- Use yaml v2 for project/state parsing because it is TS-native and preserves comments/structure on round-trip edits.
- Use VS Code LM API (chat participant + registered tools) with strict schema validation and tool-guarded writes for AI workflows without external API keys.

## 2. Table Stakes
- One-command project initialization that scaffolds .leanquill and validates LeanPub-compatible layout.
- Ordered chapter navigation based on Book.txt with chapter open action.
- Per-chapter status tracking and quick status updates from sidebar/context.
- Auto-populated chapter context pane on file focus (status, open issues, session notes).
- Manual issue capture and issue triage (open/deferred/dismissed with rationale).
- Read-only knowledge pane for characters/settings/timeline/research notes.
- Word count/progress visibility and session-closure handoff notes.
- Local-first, git-native state that survives uninstall and requires no migration.

## 3. Differentiators
- Multi-persona chapter review that produces typed editorial issues instead of generic prose suggestions.
- Hard manuscript write-block enforced at tool and filesystem boundaries (AI can advise, never author).
- Sequential reader-context enforcement so review personas cannot see future chapters.
- In-editor gutter indicators linked to issue span hints for spatially precise revision workflows.
- Story intelligence update flow that extracts chapter-derived knowledge with backlinks into project notes.
- Repo-native AI audit trail (.leanquill/chats) and issue-scoped "Chat about this" workflows for traceable decisions.

## 4. Architecture Highlights
- Three-pane sidebar architecture: chapter TreeDataProvider plus two WebviewViewProviders (Chapter Context and Knowledge).
- Cache/index layer mirrors .leanquill as source of truth, with dependency-aware invalidation from file watchers.
- SafeFileSystem boundary wraps workspace.fs and deny-by-default write rules for manuscript paths.
- AI orchestration uses chat participant handlers + explicit lm tool registry, with validation before any persisted output.
- Incremental webview updates via postMessage contracts (not full rerenders) to prevent flicker and lifecycle leaks.

## 5. Watch Out For
- Webview CSP or lifecycle mistakes (nonce/CSP, leaked listeners, full-rerender flicker) can destabilize sidebar UX early.
- Unbounded AI context assembly can cause truncation, malformed outputs, and inconsistent issue generation.
- File watcher storms and weak invalidation graphs can desync chapter status/issue counts from disk reality.
- Safety implemented only in prompt text (without hard write guards + adversarial tests) risks manuscript integrity.
- Manifest/publish hygiene issues (engine mismatch, activation scope, VSIX bloat, asset rules) can block release late.

## 6. Build Order Recommendation
Ship Track 1 first: initialization, chapter/status board, context pane, issue triage, and knowledge pane, because this delivers daily author value with zero AI dependency and validates the local-first data model. Add infrastructure hardening in parallel: cache invalidation correctness, watcher debouncing, webview lifecycle discipline, and manifest/packaging gates so the foundation scales. Then layer Track 2 AI in safety-first order: manuscript write-block + tool contracts, persona-backed review generation, issue-scoped chat, and finally story-intelligence updates once schema quality and context-budget controls are proven.
