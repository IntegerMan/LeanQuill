# LeanQuill — Project Guidelines

VS Code extension for LeanPub-style authoring — chapter-level project management with strict manuscript safety boundaries.

## Architecture

Modular file-sync pattern: outline state in `.leanquill/`, manuscript files are read-only.

| Module | Purpose |
|--------|---------|
| `extension.ts` | VS Code lifecycle, command registration |
| `outlineStore.ts` | Recursive outline tree CRUD (→ `.leanquill/outline-index.json`) |
| `outlineTree.ts` | TreeDataProvider + orphan detection |
| `manuscriptSync.ts` | Filename generation, slugification, node file I/O |
| `bookTxtSync.ts` | Generates `manuscript/Book.txt` from outline |
| `chapterOrder.ts` | Parses Book.txt, natural sort, missing-file warnings |
| `chapterStatus.ts` | Per-chapter status tracking (→ `.leanquill/chapter-status-index.json`) |
| `safeFileSystem.ts` | **Safety boundary** — blocks all writes outside `.leanquill/` |
| `planningPanel.ts` / `planningPanelHtml.ts` | Webview-based outline editor |
| `outlineContextPane.ts` / `chapterContextPane.ts` | Sidebar webviews for metadata |
| `nodeEditor.ts` | Opens node files in editor, syncs content back |
| `initialize.ts` | First-run setup, `project.yaml` generation |

Key types in `types.ts`: `OutlineNode` (recursive tree with id, title, fileName, active, status, children, traits).

## Safety Boundary (Critical)

**The extension never writes to `manuscript/`.** All state lives in `.leanquill/`. This is enforced by `SafeFileSystem.canWrite()` — any write outside `.leanquill/` throws. Always use `SafeFileSystem` for file operations; never bypass it with raw `fs` calls from extension code.

See `Imported/v1-scope.md` for the 5 non-negotiable design principles.

## Build & Test

```bash
npm run build        # esbuild: src/extension.ts → dist/extension.js
npm run watch        # continuous rebuild
npm run build:test   # esbuild: test/*.test.ts → dist-test/*.test.js
npm run test         # node --test dist-test/**/*.test.js
```

- **Bundler**: esbuild (single-file, platform=node, external=vscode)
- **TypeScript**: strict mode, target ES2022, module commonjs
- **Test runner**: Node.js native `node:test` + `node:assert/strict`
- Always run `npm run build:test` before `npm run test`

## Conventions

- **Test isolation**: Every test uses a `withTempDir()` helper for a unique temp directory. No shared state, no mocking libraries — real filesystem I/O.
- **Data factories**: Use `makeNode()` helpers to create test fixtures with sensible defaults.
- **Slugification**: Titles → kebab-case filenames (`"Opening Scene"` → `"opening-scene.md"`).
- **Node IDs**: UUIDs. Status values: `planning | not-started | drafting | draft-complete | editing | review-pending | final`.
- **Paths**: Normalize to forward slashes internally; use `path.posix` where appropriate.
- **Book.txt format**: One filename per line (relative to `manuscript/`); `part: Title` prefix for multi-part books.
- **Outline schema**: v2 (`schemaVersion: 2`). Store includes migration from v1.

## Domain Reference

- `Imported/data-contracts/` — YAML schemas for all persisted state files
- `Imported/contracts/` — JSON Schema files (chapter-status, issues)
- `Imported/v1-scope.md` — Design principles and feature scope

<!-- GSD Configuration — managed by get-shit-done installer -->
## GSD Workflow

- Use the get-shit-done skill when the user asks for GSD or uses a `gsd-*` command.
- Treat `/gsd-...` or `gsd-...` as command invocations and load the matching file from `.github/skills/gsd-*`.
- When a command says to spawn a subagent, prefer a matching custom agent from `.github/agents`.
- Do not apply GSD workflows unless the user explicitly asks for them.
- After completing any `gsd-*` command (or any deliverable it triggers: feature, bug fix, tests, docs, etc.), ALWAYS: (1) offer the user the next step by prompting via `ask_user`; repeat this feedback loop until the user explicitly indicates they are done.
<!-- /GSD Configuration -->
