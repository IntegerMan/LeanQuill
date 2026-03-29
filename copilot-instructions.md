<!-- GSD:project-start source:PROJECT.md -->
## Project

**LeanQuill**

LeanQuill is a VS Code extension for independent authors who write books in LeanPub-style markdown/git repositories. It provides chapter-level project management, story intelligence organization (characters, settings, timelines, research notes), and AI-assisted editorial feedback — while enforcing strict manuscript immutability and keeping all project state local-first and git-native. AI may advise, never author.

**Core Value:** An author working in a LeanPub markdown repo can see the status of every chapter, track and triage issues (both manually created and AI-detected), and consult living story notes — all without ever leaving VS Code and without AI touching a single manuscript file.

### Constraints

- **Manuscript immutability**: AI agents must never write to `manuscript/` — enforced at the tool level, documented in AGENTS.md, and reflected in all agent context assembly logic.
- **Context scoping**: Review/reader agents receive manuscript-scoped context only (chapter, full manuscript, or sequential up to a boundary). Future chapters are never in context for reader agents.
- **Local-first**: No external database, no cloud sync. All state in `.leanquill/` as version-controlled files.
- **Human resolution**: AI may classify and suggest; only the author opens/closes recommendations.
- **VS Code API only**: Uses `vscode.lm` API. No external HTTP calls to AI providers in v1.
- **Organizer independence**: Hierarchy, status, and reference views must be fully usable with AI disabled or distrusted.
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

## Core Extension Stack
### Extension Scaffolding & TypeScript
| Technology | Version | Purpose | Why |
|---|---|---|---|
| TypeScript | `~5.7` | Language | VS Code itself is written in TS; full vscode.d.ts type coverage requires TS >= 5.0; 5.7 is the 2025 stable release |
| `@types/vscode` | `^1.96.0` | VS Code API type declarations | Pin to `≥ 1.95` to get full `vscode.lm`, tool-calling, and `WebviewView` typings. **Must match or be ≤ `engines.vscode`.** |
| `engines.vscode` | `^1.95.0` | Minimum VS Code version | 1.95 is the earliest release with stable `vscode.lm` tool calling (`lm.registerTool` / `lm.invokeTool`). Sets the install floor on the Marketplace. |
### package.json Manifest — Critical Fields
- `activationEvents: []` — VS Code 1.74+ automatically fires `onView:<id>` when registered views appear, so explicit activation events are not needed for views. Only add explicit events for commands that should activate the extension before a view is visited.
- `type: "webview"` in `contributes.views` allows sidebar panels to be `WebviewViewProvider`-backed instead of tree-backed.
- The icon in `package.json` **cannot** be an SVG (Marketplace enforcement). Use PNG ≥ 128×128 px.
- Max 30 `keywords` in `package.json` or publish fails.
### Sidebar Views — TreeView & WebviewView (built-in API, no extra packages)
### Gutter Decorations (ISSUE-03)
## AI Integration
### VS Code Language Model API (built-in, no npm package)
| API Surface | Since | Purpose |
|---|---|---|
| `vscode.lm.selectChatModels()` | 1.90 | Discover available LM providers (Copilot, etc.) |
| `vscode.lm.registerTool()` | 1.95 | Register a named tool agents can call |
| `vscode.lm.invokeTool()` | 1.95 | Invoke a tool from within a chat handler |
| `vscode.chat.createChatParticipant()` | 1.90 | Register a `/leanquill` chat participant |
| `LanguageModelChatMessage.User()` | 1.90 | Build user-role prompt messages |
| `LanguageModelError` | 1.90 | Typed LM error handling |
### @vscode/prompt-tsx (OPTIONAL — for complex prompt composition)
| Package | Version | When to use |
|---|---|---|
| `@vscode/prompt-tsx` | `^0.3.x` stable / `0.4.0-alpha.8` latest | Complex prompts that need dynamic token-budget management |
## Data / File Handling
### YAML Parsing — `yaml` (NOT `js-yaml`)
| Package | Version | Weekly Downloads | Why |
|---|---|---|---|
| `yaml` | `^2.7` | ~30M | First-class TypeScript types built-in, preserves comments & document structure on round-trip, YAML 1.2, active development |
- `yaml` v2.x has built-in TypeScript types — no separate `@types/yaml` needed.
- **Comment and whitespace preservation** on round-trip: when the author has hand-crafted `project.yaml`, LeanQuill should not destroy their formatting on write. `yaml` preserves this; `js-yaml` does not.
- `js-yaml` 4.1.1 (last publish: 4 months ago) has 203M weekly downloads and is battle-tested, but its last release was August 2021. `yaml` v2 is actively maintained.
### File I/O — VS Code workspace.fs (NO Node.js `fs`)
### Markdown Rendering in Webviews — `markdown-it`
| Package | Version | Why |
|---|---|---|
| `markdown-it` | `^14.1` | VS Code's own markdown renderer; 14.x is the version in VS Code itself; works in both Node and browser contexts; CSP-friendly |
| `@types/markdown-it` | `^14.1` | TypeScript types |
### JSON Schema Validation — `ajv`
| Package | Version | Why |
|---|---|---|
| `ajv` | `^8.17` | Validate `.leanquill/` data files against the JSON schemas already defined in `Imported/contracts/`. Fast, tree-shakeable, TypeScript-native |
| `ajv-formats` | `^3.0` | date-time and other format validators |
## Build & Test
### Bundler — esbuild (CONFIRMED PREFERENCE)
| Package | Version | Why |
|---|---|---|
| `esbuild` | `^0.24` | Official VS Code recommendation; 10-100× faster than webpack; simple config; handles TypeScript natively |
| `npm-run-all2` | `^6.0` | Run `watch:esbuild` and `watch:tsc` in parallel (successor to `npm-run-all`) |
### tsconfig.json — Recommended Settings
### Testing — @vscode/test-cli + @vscode/test-electron
| Package | Version | Why |
|---|---|---|
| `@vscode/test-cli` | `^0.0.10` | Modern CLI runner; integrates with VS Code's Extension Test Runner UI; uses Mocha under the hood |
| `@vscode/test-electron` | `^2.4` | Downloads and runs VS Code for integration tests |
| `mocha` | `^10.7` | Test framework (via test-cli) |
- ✅ Unit-test: YAML parsing logic, issue schema validation, chapter ordering, `span_hint` range parsing
- ✅ Integration-test: TreeDataProvider output, workspace.fs read/write, decoration application
- ❌ Do NOT use LM API in tests — nondeterministic + rate-limited. Mock the `vscode.lm` namespace.
### Publishing — @vscode/vsce
| Package | Version | Why |
|---|---|---|
| `@vscode/vsce` | `^3.x` | Official VS Code packaging + publish CLI |
# Package for local install
# Publish
## Summary: Full devDependencies Block
## What NOT to Use
| Technology | Why Not |
|---|---|
| **webpack** | 10–100× slower than esbuild for this project's size; more config boilerplate; no advantage |
| **Rollup** | Poor CommonJS interop; VS Code extensions must output CJS; requires extra plugins |
| **js-yaml** | Actively maintained but no comment preservation; `yaml` v2 is the better choice for all new projects |
| **axios / node-fetch** | Out of scope (v1 uses no external HTTP); `vscode.lm` API handles all AI calls |
| **React / Vue / Svelte** | Heavyweight for sidebar webviews; plain HTML + `markdown-it` + minimal vanilla JS is sufficient for LeanQuill's read-mostly panels. Add only if webview complexity grows beyond simple rendered markdown + button actions |
| **SQLite / better-sqlite3** | The project decision is markdown + YAML files for git-diffability. SQLite creates binary blobs that don't survive tool uninstall gracefully. Use a JSON index file (`.leanquill/index.json`) for fast lookups instead |
| **Lodash** | Unnecessary for a TypeScript project with ES2022; use native array/object methods |
| **`fs` / `path` directly** | Use `vscode.workspace.fs` and `vscode.Uri.joinPath` for all file operations to ensure remote workspace compatibility |
| **`openai` / `anthropic` SDK** | Project constraint: VS Code LM API only (no external API keys in v1) |
| **Jest** | VS Code official testing stack is Mocha + @vscode/test-cli. Jest requires a Node.js environment and can't access the VS Code extension host API |
| **`tslint`** | Deprecated; use ESLint with `@typescript-eslint` if linting is needed |
## Confidence Summary
| Area | Confidence | Source |
|---|---|---|
| Extension manifest / activation | HIGH | Official docs verified March 2026 |
| TreeDataProvider / WebviewViewProvider | HIGH | Official docs verified March 2026 |
| Gutter decorations API | HIGH | vscode.d.ts reviewed directly |
| `vscode.lm` API surface | HIGH | Official LM API guide verified March 2026 |
| Model families available | MEDIUM | Listed in docs but subject to change without notice |
| esbuild config | HIGH | Official bundling guide verified March 2026 |
| @vscode/test-cli setup | HIGH | Official testing guide verified March 2026 |
| `yaml` v2 vs js-yaml | HIGH | npm verified, js-yaml 4.1.1 last publish Nov 2024 |
| markdown-it v14 | HIGH | npm verified, matches VS Code internal version |
| @vscode/prompt-tsx | MEDIUM | Still in alpha (0.4.0-alpha.8); API has shifted between minor versions |
## Sources
- VS Code API Reference: https://code.visualstudio.com/api/references/vscode-api (verified 2026-03-29)
- Language Model API: https://code.visualstudio.com/api/extension-guides/language-model (last edit: 3/25/2026)
- Tree View API: https://code.visualstudio.com/api/extension-guides/tree-view (last edit: 3/25/2026)
- Bundling Extensions: https://code.visualstudio.com/api/working-with-extensions/bundling-extension (last edit: 3/25/2026)
- Testing Extensions: https://code.visualstudio.com/api/working-with-extensions/testing-extension (last edit: 3/25/2026)
- Publishing Extensions: https://code.visualstudio.com/api/working-with-extensions/publishing-extension (last edit: 3/25/2026)
- Extension Manifest Reference: https://code.visualstudio.com/api/references/extension-manifest (last edit: 3/25/2026)
- `@vscode/prompt-tsx` npm: https://www.npmjs.com/package/@vscode/prompt-tsx (v0.4.0-alpha.8, verified 2026-03-29)
- `js-yaml` npm: https://www.npmjs.com/package/js-yaml (v4.1.1, verified 2026-03-29)
- `yaml` npm: https://www.npmjs.com/package/yaml (v2.7, 30M weekly downloads)
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
