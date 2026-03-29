# Technology Stack — LeanQuill VS Code Extension

**Project:** LeanQuill  
**Researched:** 2026-03-29  
**Overall confidence:** HIGH (sourced from official VS Code docs, verified March 2026)

---

## Core Extension Stack

### Extension Scaffolding & TypeScript

| Technology | Version | Purpose | Why |
|---|---|---|---|
| TypeScript | `~5.7` | Language | VS Code itself is written in TS; full vscode.d.ts type coverage requires TS >= 5.0; 5.7 is the 2025 stable release |
| `@types/vscode` | `^1.96.0` | VS Code API type declarations | Pin to `≥ 1.95` to get full `vscode.lm`, tool-calling, and `WebviewView` typings. **Must match or be ≤ `engines.vscode`.** |
| `engines.vscode` | `^1.95.0` | Minimum VS Code version | 1.95 is the earliest release with stable `vscode.lm` tool calling (`lm.registerTool` / `lm.invokeTool`). Sets the install floor on the Marketplace. |

**Rationale for engine floor at 1.95:** The LM API's `tools` array, `lm.registerTool`, and `LanguageModelToolCallPart` landed in VS Code 1.95. Since AI-01 through AI-05 depend on tool-augmented agent flows, targeting earlier versions would require feature-gating every AI path and adds no real user base benefit — VS Code auto-updates.

---

### package.json Manifest — Critical Fields

```jsonc
{
  "name": "leanquill",
  "displayName": "LeanQuill",
  "publisher": "<your-publisher-id>",
  "version": "0.1.0",
  "engines": { "vscode": "^1.95.0" },
  "main": "./dist/extension.js",
  "categories": ["Other"],
  "activationEvents": [],        // ← intentionally empty; VS Code 1.74+ auto-infers from contributes
  "contributes": {
    "viewsContainers": {
      "activitybar": [
        { "id": "leanquill", "title": "LeanQuill", "icon": "media/icon.svg" }
      ]
    },
    "views": {
      "leanquill": [
        { "id": "leanquill.chapters",    "name": "Chapters",    "type": "tree" },
        { "id": "leanquill.chapterCtx",  "name": "Chapter",     "type": "webview" },
        { "id": "leanquill.knowledge",   "name": "Knowledge",   "type": "webview" }
      ]
    }
  }
}
```

**Key manifest facts (verified March 2026):**
- `activationEvents: []` — VS Code 1.74+ automatically fires `onView:<id>` when registered views appear, so explicit activation events are not needed for views. Only add explicit events for commands that should activate the extension before a view is visited.
- `type: "webview"` in `contributes.views` allows sidebar panels to be `WebviewViewProvider`-backed instead of tree-backed.
- The icon in `package.json` **cannot** be an SVG (Marketplace enforcement). Use PNG ≥ 128×128 px.
- Max 30 `keywords` in `package.json` or publish fails.

---

### Sidebar Views — TreeView & WebviewView (built-in API, no extra packages)

**Chapter Tree (CHAP-01 / CHAP-02):**

```typescript
// Implement vscode.TreeDataProvider<ChapterItem> — no npm package needed
class ChapterTreeProvider implements vscode.TreeDataProvider<ChapterItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<ChapterItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  getTreeItem(element: ChapterItem): vscode.TreeItem { return element; }
  getChildren(element?: ChapterItem): Thenable<ChapterItem[]> { ... }
  refresh(item?: ChapterItem) { this._onDidChangeTreeData.fire(item); }
}

vscode.window.createTreeView('leanquill.chapters', {
  treeDataProvider: new ChapterTreeProvider(),
  showCollapseAll: false
});
```

**Chapter Context Pane & Knowledge Pane (CHAP-03 / KNOW-01):**

```typescript
// Sidebar webview panels use WebviewViewProvider (not WebviewPanel)
class ChapterContextProvider implements vscode.WebviewViewProvider {
  resolveWebviewView(view: vscode.WebviewView, ...) {
    view.webview.options = { enableScripts: true, localResourceRoots: [...] };
    view.webview.html = this.buildHtml(view.webview);
  }
}

context.subscriptions.push(
  vscode.window.registerWebviewViewProvider('leanquill.chapterCtx', new ChapterContextProvider())
);
```

**Confidence: HIGH** — APIs are stable, documented March 2026.

---

### Gutter Decorations (ISSUE-03)

No external package needed. Use `vscode.window.createTextEditorDecorationType` with `gutterIconPath`:

```typescript
const issueDecoration = vscode.window.createTextEditorDecorationType({
  gutterIconPath: context.asAbsolutePath('media/issue-gutter.svg'),
  gutterIconSize: 'contain',
  overviewRulerColor: new vscode.ThemeColor('charts.orange'),
  overviewRulerLane: vscode.OverviewRulerLane.Left,
});

// Apply to active editor on document open / issue change
editor.setDecorations(issueDecoration, rangesOrOptions);
```

**Note:** `gutterIconPath` accepts a filesystem URI (`vscode.Uri`). SVGs work fine for gutters (only the extension-level icon and badge SVGs are restricted). Keep the gutter icon small (16×16 or 22×22 px recommended).

---

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

**Model selection pattern (AI-01 through AI-05):**

```typescript
// Always call selectChatModels inside a user-initiated command — required for consent dialog
const models = await vscode.lm.selectChatModels({ vendor: 'copilot', family: 'gpt-4o' });
if (models.length === 0) {
  vscode.window.showWarningMessage('No AI model available. Is GitHub Copilot active?');
  return;
}
const [model] = models;

// Streaming response
const response = await model.sendRequest(messages, {}, token);
for await (const part of response.text) {
  // stream to output
}
```

**Model families available (March 2026):** `gpt-4o`, `gpt-4o-mini`, `o1`, `o1-mini`, `claude-3.5-sonnet`. Use `gpt-4o` for chapter review (quality); `gpt-4o-mini` for quick inline queries.

**Error handling — mandatory pattern:**
```typescript
} catch (err) {
  if (err instanceof vscode.LanguageModelError) {
    if (err.code === vscode.LanguageModelError.Blocked.name) { /* content policy */ }
    if (err.code === vscode.LanguageModelError.NoPermissions.name) { /* user not consented */ }
    if (err.code === vscode.LanguageModelError.NotFound.name) { /* model gone */ }
  }
  throw err; // re-throw non-LM errors
}
```

**Confidence: HIGH** — verified against official docs (last updated March 2026).

---

### @vscode/prompt-tsx (OPTIONAL — for complex prompt composition)

| Package | Version | When to use |
|---|---|---|
| `@vscode/prompt-tsx` | `^0.3.x` stable / `0.4.0-alpha.8` latest | Complex prompts that need dynamic token-budget management |

**Use it when:** A prompt has multiple priority-ranked sections (system context + story knowledge + chapter text + user query) that need graceful pruning when close to the context window limit.

**Skip it for:** Simple single-shot review commands where you control prompt length manually. `LanguageModelChatMessage.User(string)` is sufficient for straightforward cases.

**Install only if needed:**
```bash
npm install --save @vscode/prompt-tsx
```
Add to `tsconfig.json`:
```json
{ "compilerOptions": { "jsx": "react", "jsxFactory": "vscpp", "jsxFragmentFactory": "vscppf" } }
```

**Confidence:** HIGH for API existence, MEDIUM for version stability (still in alpha on npm as of March 2026).

---

## Data / File Handling

### YAML Parsing — `yaml` (NOT `js-yaml`)

| Package | Version | Weekly Downloads | Why |
|---|---|---|---|
| `yaml` | `^2.7` | ~30M | First-class TypeScript types built-in, preserves comments & document structure on round-trip, YAML 1.2, active development |

**Rationale for `yaml` over `js-yaml`:**
- `yaml` v2.x has built-in TypeScript types — no separate `@types/yaml` needed.
- **Comment and whitespace preservation** on round-trip: when the author has hand-crafted `project.yaml`, LeanQuill should not destroy their formatting on write. `yaml` preserves this; `js-yaml` does not.
- `js-yaml` 4.1.1 (last publish: 4 months ago) has 203M weekly downloads and is battle-tested, but its last release was August 2021. `yaml` v2 is actively maintained.

```typescript
import { parse, stringify, parseDocument } from 'yaml';

// Read
const doc = parse(rawYaml) as ProjectConfig;

// Write (preserves comments if using parseDocument/Document API)
const document = parseDocument(rawYaml);
document.setIn(['version'], '1.1');
const updated = String(document);
```

**Security note:** Never call `yaml.load()` with untrusted input and a non-safe schema — `yaml`'s `parse()` is safe by default (equivalent to `CORE_SCHEMA`).

**Confidence: HIGH** — npm-verified, 30M weekly downloads, MIT, TypeScript-native.

---

### File I/O — VS Code workspace.fs (NO Node.js `fs`)

Use `vscode.workspace.fs` exclusively. It works across all VS Code environments (remote SSH, WSL, Codespaces) and handles URI abstractions correctly:

```typescript
// Read
const bytes = await vscode.workspace.fs.readFile(uri);
const text = new TextDecoder().decode(bytes);

// Write
await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(text));

// Watch
const watcher = vscode.workspace.createFileSystemWatcher(
  new vscode.RelativePattern(workspaceFolder, '.leanquill/**/*.{yaml,md}')
);
watcher.onDidChange(uri => { /* invalidate cache */ });
context.subscriptions.push(watcher);
```

**Why not `fs.readFileSync`?** It breaks in remote workspaces (SSH, WSL) where the extension host runs remotely but `fs` sees the remote filesystem only if the extension is properly classified. `workspace.fs` is always correct.

---

### Markdown Rendering in Webviews — `markdown-it`

| Package | Version | Why |
|---|---|---|
| `markdown-it` | `^14.1` | VS Code's own markdown renderer; 14.x is the version in VS Code itself; works in both Node and browser contexts; CSP-friendly |
| `@types/markdown-it` | `^14.1` | TypeScript types |

**Use for:** Rendering knowledge pane content (character sheets, settings, timeline entries) from markdown source files.

```typescript
import MarkdownIt from 'markdown-it';
const md = new MarkdownIt({ html: false, linkify: true, typographer: true });

// In webview HTML generation:
const rendered = md.render(markdownSource);
```

**CSP requirement for webviews — mandatory:**
```html
<meta http-equiv="Content-Security-Policy"
  content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
```
Always generate a cryptographic nonce per webview render. Never use `unsafe-eval`. Never allow `http:` image sources.

**Confidence: HIGH** — markdown-it is what VS Code bundles internally; 14.x is current.

---

### JSON Schema Validation — `ajv`

| Package | Version | Why |
|---|---|---|
| `ajv` | `^8.17` | Validate `.leanquill/` data files against the JSON schemas already defined in `Imported/contracts/`. Fast, tree-shakeable, TypeScript-native |
| `ajv-formats` | `^3.0` | date-time and other format validators |

Use to validate issue files and chapter-status files on load, surfacing errors as VS Code warnings rather than silent data corruption.

**Confidence: MEDIUM** — ajv v8 is current stable; recommended for schema-validated reads.

---

## Build & Test

### Bundler — esbuild (CONFIRMED PREFERENCE)

| Package | Version | Why |
|---|---|---|
| `esbuild` | `^0.24` | Official VS Code recommendation; 10-100× faster than webpack; simple config; handles TypeScript natively |
| `npm-run-all2` | `^6.0` | Run `watch:esbuild` and `watch:tsc` in parallel (successor to `npm-run-all`) |

**Canonical esbuild config for this extension:**

```javascript
// esbuild.js
const esbuild = require('esbuild');
const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

async function main() {
  const ctx = await esbuild.context({
    entryPoints: ['src/extension.ts'],
    bundle: true,
    format: 'cjs',
    minify: production,
    sourcemap: !production,
    sourcesContent: false,
    platform: 'node',
    outfile: 'dist/extension.js',
    external: ['vscode'],   // ← CRITICAL: always externalize vscode
    logLevel: 'warning',
  });
  watch ? await ctx.watch() : (await ctx.rebuild(), await ctx.dispose());
}
main().catch(e => { console.error(e); process.exit(1); });
```

**package.json scripts:**
```json
{
  "scripts": {
    "compile":          "npm run check-types && node esbuild.js",
    "check-types":      "tsc --noEmit",
    "watch":            "npm-run-all -p watch:*",
    "watch:esbuild":    "node esbuild.js --watch",
    "watch:tsc":        "tsc --noEmit --watch --project tsconfig.json",
    "vscode:prepublish": "npm run package",
    "package":          "npm run check-types && node esbuild.js --production"
  }
}
```

**Why `tsc --noEmit` separately?** esbuild strips types without checking them. Running `tsc --noEmit` in parallel catches type errors while esbuild handles the fast emit.

---

### tsconfig.json — Recommended Settings

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "target": "ES2022",
    "lib": ["ES2022"],
    "outDir": "out",
    "rootDir": "src",
    "strict": true,
    "noImplicitAny": true,
    "skipLibCheck": true,
    "moduleResolution": "node16",
    "sourceMap": true,
    "declaration": false
  },
  "exclude": ["node_modules", ".vscode-test"]
}
```

---

### Testing — @vscode/test-cli + @vscode/test-electron

| Package | Version | Why |
|---|---|---|
| `@vscode/test-cli` | `^0.0.10` | Modern CLI runner; integrates with VS Code's Extension Test Runner UI; uses Mocha under the hood |
| `@vscode/test-electron` | `^2.4` | Downloads and runs VS Code for integration tests |
| `mocha` | `^10.7` | Test framework (via test-cli) |

**Setup:**
```bash
npm install --save-dev @vscode/test-cli @vscode/test-electron
```

```javascript
// .vscode-test.mjs
import { defineConfig } from '@vscode/test-cli';
export default defineConfig({
  files: 'out/test/**/*.test.js',
  workspaceFolder: './test-fixtures/sample-book',
  mocha: { timeout: 20000 }
});
```

**What to test vs. not test:**
- ✅ Unit-test: YAML parsing logic, issue schema validation, chapter ordering, `span_hint` range parsing
- ✅ Integration-test: TreeDataProvider output, workspace.fs read/write, decoration application
- ❌ Do NOT use LM API in tests — nondeterministic + rate-limited. Mock the `vscode.lm` namespace.

---

### Publishing — @vscode/vsce

| Package | Version | Why |
|---|---|---|
| `@vscode/vsce` | `^3.x` | Official VS Code packaging + publish CLI |

```bash
npm install -g @vscode/vsce

# Package for local install
vsce package

# Publish
vsce publish
```

**`.vscodeignore` (required — exclude all non-dist files):**
```
.vscode/
node_modules/
out/
src/
test/
.vscode-test.mjs
esbuild.js
tsconfig.json
**/*.ts
**/*.map
```

---

## Summary: Full devDependencies Block

```json
{
  "devDependencies": {
    "@types/markdown-it":      "^14.1",
    "@types/node":             "^22",
    "@types/vscode":           "^1.96.0",
    "@vscode/test-cli":        "^0.0.10",
    "@vscode/test-electron":   "^2.4",
    "@vscode/vsce":            "^3.3",
    "esbuild":                 "^0.24",
    "mocha":                   "^10.7",
    "npm-run-all2":            "^6.0",
    "typescript":              "~5.7"
  },
  "dependencies": {
    "ajv":          "^8.17",
    "ajv-formats":  "^3.0",
    "markdown-it":  "^14.1",
    "yaml":         "^2.7"
  }
}
```

**Note:** `@vscode/prompt-tsx` starts as an **optional** devDependency added only when implementing AI-01 complex prompt assembly. `vscode` is never in dependencies — it is provided by the runtime and must be externalized in esbuild.

---

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

---

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

---

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
