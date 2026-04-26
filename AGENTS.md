# LeanQuill — agent guide

Conventions and commands for working on the LeanQuill VS Code extension. **AI may advise, never author written content in manuscripts it works with.** For manuscript write boundaries, see [docs/manuscript-safety.md](docs/manuscript-safety.md) and [`.planning/PROJECT.md`](.planning/PROJECT.md).

---

## Build, test, and run

From the repository root:

| Step | Command |
|------|--------|
| Install dependencies (once) | `npm install` |
| Build extension | `npm run build` |
| Rebuild on change | `npm run watch` |
| Bundle tests | `npm run build:test` |
| Run tests | `npm test` |

After you change `src/` or `test/`, run **`npm run build:test`** then **`npm test`**. The `test` script runs prebuilt files under `dist-test/`; it does not invoke `build:test` automatically.

**Run the extension interactively:** Open this folder in VS Code. Use **Run and Debug** → **Run LeanQuill Extension** (F5). That configuration runs the **npm: build** task first (see [`.vscode/launch.json`](.vscode/launch.json)). In the Extension Development Host, open a book folder (with or without `manuscript/`) and use **LeanQuill: Initialize** as needed.

**Optional typecheck (not in npm scripts):** `npx tsc --noEmit` — uses [tsconfig.json](tsconfig.json) for a full TypeScript check.

---

## New code, tests, and coverage

- **Layout:** Add or extend modules under `src/`. Put automated tests in `test/` as `*.test.ts`, following existing patterns (`node:test`, `node:assert/strict`). See [docs/development.md](docs/development.md).
- **When to run tests:** After substantive changes to code under test, run `npm run build:test && npm test`.
- **Unit tests:** The current harness runs **outside** the VS Code extension host. Favor testable units (stores, parsers, `SafeFileSystem`, pure helpers) the same way as existing files in `test/`.
- **Integration / UI:** Webviews and extension-host behavior are exercised manually via F5 until a dedicated integration harness exists.
- **Code coverage:** This repo has **no** configured line/branch coverage tool or CI gate. Do not treat a coverage percentage as required. For work tracked with GSD, phase-level verification in `.planning/` may apply; see the workflow links below.

---

## Workflow Bundle Maintenance

LeanQuill workflow docs under `.leanquill/workflows/` are versioned and can auto-refresh in existing projects.

- Source of truth for workflow content: `src/leanquillWorkflows.ts`
- Bundle id constant: `LEANQUILL_WORKFLOW_BUNDLE_VERSION` in `src/workflowBundle.ts`
- Rule: **bump the bundle id whenever workflow content changes**
- Runtime behavior (`ensureLeanquillWorkflows`): write missing files; replace only when on-disk `leanquill_workflow_bundle` is older
- Opt out: add `leanquill_workflow_pinned: true` to workflow frontmatter

After changing workflow bundle/version logic, run `npm run build:test && npm test`.

**Story chat:** The shipped `story-chat.md` / `story-state-scout.md` pair uses an **orchestrator + aggregate scout** pattern (sub-scout prompts and local read/Grep fallbacks in `leanquillWorkflows.ts`). Harnesses under `.cursor/`, `.github/agents/`, and `.claude/agents/` are generated on init from `src/initialize.ts` — keep orchestration wording in sync when editing workflows.

---

## Code style and tooling

| Choice | Notes |
|--------|--------|
| TypeScript | [tsconfig.json](tsconfig.json): `strict: true`, **ES2022** `target` and `lib`, `module: commonjs`, `esModuleInterop`, `skipLibCheck: true`, `sourceMap: true` |
| Bundle | [esbuild](package.json) — `npm run build` uses `--platform=node` and `--external:vscode` for the extension entry |
| Formatter / linter | No project-wide Prettier, ESLint, or Biome config in this repo. Match the style of neighboring files; avoid drive-by reformatting of unrelated code |

---

## Repository layout (top level)

Deeper `src/` module maps: [docs/development.md](docs/development.md) and [docs/architecture.md](docs/architecture.md).

| Path | Purpose |
|------|---------|
| `src/` | Extension TypeScript source |
| `test/` | Node test sources; bundled to `dist-test/` |
| `dist/` | Built extension output (gitignored) |
| `dist-test/` | Built test output (gitignored) |
| `docs/` | Product and technical documentation |
| `media/` | Extension assets (icons, static assets for webviews) |
| `.vscode/` | Launch configuration and tasks (F5, `npm: build`) |
| `.planning/` | GSD: roadmap, requirements, state, phase plans and verification |
| `.cursor/` | Cursor rules; GSD skills and [`.cursor/get-shit-done/`](.cursor/get-shit-done/) workflows |
| `Imported/` | Imported data contracts and reference material (not the main extension tree) |
| `.github/`, `.claude/`, `.agent/` | Supporting or mirrored GSD and tooling (workflows, templates, skills) |

---

## Further reading

**Application and product**

- [README.md](README.md) — overview and documentation index
- [docs/getting-started.md](docs/getting-started.md)
- [docs/architecture.md](docs/architecture.md)
- [docs/development.md](docs/development.md)
- [docs/leanpub-integration.md](docs/leanpub-integration.md)
- [docs/data-model.md](docs/data-model.md)
- [docs/manuscript-safety.md](docs/manuscript-safety.md)
- [docs/ai-integration.md](docs/ai-integration.md)
- [docs/planning-workspace.md](docs/planning-workspace.md)

**GSD / planning workflow**

- [`.planning/ROADMAP.md`](.planning/ROADMAP.md)
- [`.planning/REQUIREMENTS.md`](.planning/REQUIREMENTS.md)
- [`.planning/PROJECT.md`](.planning/PROJECT.md)
- [`.cursor/skills/gsd-help/SKILL.md`](.cursor/skills/gsd-help/SKILL.md) — available GSD commands (Cursor skills)
- [`.cursor/get-shit-done/`](.cursor/get-shit-done/) — workflow definitions used by the GSD system

---

[← Back to README](README.md)
