# Phase 13: LeanPub Workspace Initialization - Research

**Researched:** 2026-04-08  
**Domain:** VS Code extension UX (`viewsWelcome`, `setContext`), filesystem scaffolding under `manuscript/`, `SafeFileSystem` boundaries, Planning Workspace webview tabs  
**Confidence:** HIGH (codebase-verified); MEDIUM (invalid-`project.yaml` policy — discretion per CONTEXT)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

> Copied from `13-CONTEXT.md` under **Implementation Decisions** (Areas 1–4, D-01–D-18).

### Area 1 — Setup visibility, eligibility, and copy

- **D-01:** The **Setup** view remains the home for this capability (no separate scaffold-only pane). The **Initialize** (or equivalent) action’s **behavior changes by state** rather than adding a parallel entry point.
- **D-02:** Show the Setup / initialize path when **any** of:
  - `.leanquill` is missing, or
  - `.leanquill/project.yaml` is missing, or
  - `project.yaml` is **invalid** (parse/schema failure — define validation in implementation), or
  - **Manuscript scaffolding is incomplete:** `manuscript/` is missing **or** `manuscript/Book.txt` is missing (**A + B** only; presence of `.md` files alone does not drive this gate).
- **D-03:** **Copy audit:** Review user-facing strings that assume the user already opened a “LeanQuill” or manuscript-marked folder (e.g. “Open a LeanQuill directory”). Wording should allow **any folder** to be initialized or scaffolded, consistent with D-01–D-02.
- **D-04:** Expose eligibility to UI via **workspace context keys** (extend or add alongside `leanquill.isInitialized`, `leanquill.hasManuscriptMarkers`) so `viewsWelcome` `when` clauses stay declarative.

### Area 2 — SafeFileSystem and safety

- **D-05:** **No** permanent allowlist for arbitrary `manuscript/**/*.md` for all callers. Implementation may use either **scoped scaffold mode** (e.g. run-only callback) or **dedicated SafeFileSystem APIs** for scaffold paths — **planner/implementation chooses** (Claude’s discretion) as long as D-05 holds.
- **D-06:** **No preference** whether scaffold I/O goes through `SafeFileSystem` or raw `fs`, except that **path checks** must keep writes inside the workspace manuscript tree and respect the same safety intent.
- **D-07:** **Never overwrite** existing files targeted by this flow (chapter files, `Book.txt`). Create-only or skip; see Area 3 for chapter naming and `Book.txt` rules.
- **D-08:** **Audit trail:** On success, log **concise per-path creation** (or “skipped existing”) to the extension output channel in addition to any toast (see Area 4).

### Area 3 — Generated files (`Book.txt`, placeholder chapter)

- **D-09:** Default new chapter filename **`ch1.md`** (lowercase convention; on case-insensitive OS, treat existing **`Ch1.md`** / **`ch1.md`** as **already present** — do not create or overwrite; use **actual on-disk basename** in any new `Book.txt` line).
- **D-10:** If **`ch1.md` (case-insensitive) already exists:** **do not** write a new chapter file; treat that file as the chapter. When **`Book.txt` is created in this flow** (because it was missing), **include a line** pointing at that existing file’s basename.
- **D-11:** If **`manuscript/Book.txt` already exists:** **do not modify** it (no append, no edit). Only **create** `Book.txt` when it is missing. If the operation **cannot** succeed without changing an existing `Book.txt` (e.g. `ch1.md` exists but is not listed and the user expects auto-wiring), **do not** silently change it — see **D-14** / **D-18**.
- **D-12:** **New** placeholder chapter **content:** `# Chapter 1` (or index-appropriate number) **plus** one short stub line (e.g. inviting the author to write).
- **D-13:** **Tension (explicit):** D-10 wants `Book.txt` to reference an existing `ch1.md` when **creating** `Book.txt`. D-11 forbids editing **existing** `Book.txt`. If both `Book.txt` and `ch1.md` exist but `Book.txt` does not list the chapter, the flow **must not** patch `Book.txt` — surface **clear guidance** via D-18.

### Area 4 — After success and failure UX

- **D-14:** On **success:** show an **information notification** (toast).
- **D-15:** On **success:** **do not** focus the chapter in the **text editor** as the primary affordance. Instead, open the **Planning Workspace** webview (`PlanningPanelProvider`, same surface as **LeanQuill: Open Planning Workspace**) with the **Cards** tab active. Today `show()` defaults to the outline tab; **`showCharacter`-style** behavior is the precedent — add a **small API** (e.g. `showCards()` or `show({ initialTab: "cards" })`) that sets `_activeTab` to **`cards`** before `show` / `_renderPanel`. Implementation detail is Claude’s discretion.
- **D-16:** **Toast + output channel** both for the user-visible outcome (success or failure), consistent with D-08.
- **D-17:** **Refresh after success:** Planner chooses the minimal set of refreshes so the new structure appears **without window reload** (e.g. `setWorkspaceContext`, chapter-order consumers, outline index bootstrap from `Book.txt` if empty — align with existing `extension.ts` activation patterns). No mandatory new contract beyond “no reload required.”
- **D-18:** When the flow **stops** because **existing `Book.txt` must not be modified** (D-11) but the user’s intent would require editing it, UX is **Claude’s discretion** between clear **error notification** vs **modal** — must include **actionable** next steps (e.g. open `Book.txt`, add line `ch1.md`).

### Claude's Discretion

- Scoped vs dedicated SafeFileSystem API (D-05).
- Raw `fs` vs `SafeFileSystem` wiring (D-06).
- Exact refresh sequence (D-17).
- Error vs modal for D-18.
- Exact invalid-`project.yaml` detection rules (D-02).

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **INIT-01** | Author can initialize a LeanPub repo with a single "LeanQuill: Initialize" command that scaffolds the `.leanquill/` folder structure and creates a `project.yaml` from a sensible template | Existing `runInitializeFlow` / `initializeProject` in `src/initialize.ts`; extend unified flow for manuscript scaffold per D-01–D-02; `package.json` command `leanquill.initialize` and Setup `viewsWelcome` links. |
| **INIT-02** | On initialization, LeanQuill auto-detects `Book.txt` for chapter ordering; falls back to alphabetical sort of manuscript files if not present | Implemented in `resolveChapterOrder` (`src/chapterOrder.ts`); persisted via `.leanquill/chapter-order.json` in `initializeProject`; activation auto-bootstrap in `src/extension.ts` when outline empty. Scaffold must produce `Book.txt` + chapter consistent with this resolver. |
</phase_requirements>

## Summary

Phase 13 extends the **existing single entry point** (`LeanQuill: Initialize` / Setup view) so that **any workspace folder** can move toward a valid LeanQuill + LeanPub layout: ensure `manuscript/`, `manuscript/Book.txt`, and a first chapter file when missing, **without overwriting** existing `Book.txt` or chapter files, and with **path safety** equivalent to today’s `SafeFileSystem` intent (D-05–D-07).

The codebase already creates `manuscript/` during `initializeProject` and allows **only** `manuscript/Book.txt` (not arbitrary `manuscript/*.md`) through `SafeFileSystem.writeFile` (`src/safeFileSystem.ts`). Scaffold logic must therefore either use **raw `fs`** with strict workspace-relative checks (D-06) or a **temporary** scoped allowance (D-05), not a permanent global `manuscript/**/*.md` allowlist.

Workspace UI state is driven by `setWorkspaceContext` (`src/extension.ts`) and `package.json` `viewsWelcome` `when` clauses. A **new boolean context key** (e.g. manuscript scaffold complete) is required so Setup copy can distinguish “`.leanquill` ok but `Book.txt` missing” from “fully ready” (D-02, D-04). After success, UX must diverge from today’s `runInitializeFlow` tail (which opens `project.yaml` in the editor): prefer **Planning Workspace** with **`cards`** tab, mirroring `showCharacter`’s `_activeTab` pattern (`src/planningPanel.ts`, tab ids in `src/planningPanelHtml.ts`).

**Primary recommendation:** Implement a **single orchestration** invoked from `leanquill.initialize` that branches on state (leanquill vs manuscript completeness), extracts **pure scaffold helpers** (testable with `node:test` + temp dirs), extends `setWorkspaceContext` + `viewsWelcome`, adds `PlanningPanelProvider.showCards()` (or equivalent), and sequences refresh so **watchers + auto-bootstrap** pick up new files without reload (D-17).

## Project Constraints (from .cursor/rules/)

No files were present under `.cursor/rules/` at research time — **no additional project rule directives** to merge beyond repo conventions and user CONTEXT.

## Standard Stack

### Core

| Library / surface | Version | Purpose | Why Standard |
|-------------------|---------|---------|--------------|
| VS Code Extension API | `engines.vscode`: **^1.90.0** (`package.json`) | Commands, webviews, `setContext`, notifications, output channel | Product target; already declared |
| TypeScript | **^5.8.3** (`package.json` devDependency) | Extension source | Repo standard |
| Node.js `fs/promises` | Runtime (Node **v24+** verified in env) | Scaffold I/O when using raw `fs` (D-06) | Matches existing `initialize.ts` / `chapterOrder.ts` |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@types/vscode` | **^1.90.0** (devDependency) | Typings for API surface | Already in use |
| esbuild | **^0.25.3** | Bundle `src/extension.ts` | Existing build |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Raw `fs` for `ch1.md` | `SafeFileSystem` + scoped allow | Scoped API is more uniform but needs explicit design so `allowPath` is not left globally permissive (D-05) |

**Installation:** No new packages required for Phase 13 unless planner adds a YAML schema validator for D-02 (optional).

**Version verification:** `npm view @types/vscode version` → **1.115.0** (2026-04-08); extension `engines.vscode` remains **^1.90.0** — compatible.

## Architecture Patterns

### Recommended Project Structure

```
src/
├── initialize.ts          # Orchestration: merge manuscript scaffold with existing init flow
├── safeFileSystem.ts      # Boundaries; optional scaffold-scoped helpers
├── chapterOrder.ts        # Book.txt semantics + alpha fallback (INIT-02)
├── extension.ts           # setWorkspaceContext, watchers, auto-bootstrap outline
├── planningPanel.ts       # show / showCharacter pattern → showCards
├── planningPanelHtml.ts   # TAB_IDS includes "cards"
└── (new optional) leanpubScaffold.ts  # Pure functions: eligibility, file plan, apply — easy to unit test
```

### Pattern 1: Declarative Setup via `setContext`

**What:** Push boolean/string context keys after filesystem checks so `package.json` `when` expressions stay simple.  
**When to use:** All Setup / `viewsWelcome` eligibility (D-04).  
**Example:**

```typescript
// Source: https://code.visualstudio.com/api/references/when-clause-contexts
await vscode.commands.executeCommand("setContext", "leanquill.isInitialized", true);
```

### Pattern 2: Tab-first webview open (precedent: `showCharacter`)

**What:** Set `_activeTab` before `show()` / `_renderPanel()` so the first paint shows the correct tab.  
**When to use:** Success path D-15 (`cards`).  
**Example (existing codebase):**

```73:81:c:\Dev\LeanQuill\src\planningPanel.ts
  public async showCharacter(fileName: string): Promise<void> {
    this._activeTab = "characters";
    this._selectedCharacterFileName = fileName;
    if (this._panel) {
      this._panel.reveal(this.vscodeApi.ViewColumn.One);
      await this._renderPanel();
    } else {
      await this.show();
    }
  }
```

Cards tab id is canonical in `TAB_IDS`:

```167:171:c:\Dev\LeanQuill\src\planningPanelHtml.ts
const TAB_IDS = ["outline", "cards", "characters", "places", "threads"] as const;
const TAB_LABELS: Record<(typeof TAB_IDS)[number], string> = {
  outline: "Outline",
  cards: "Cards",
```

### Pattern 3: `Book.txt` line format (LeanPub / LeanQuill)

**What:** Non-empty, non-comment lines are paths **relative to `manuscript/`**; `#` and `part:` lines are ignored by ordering resolver.  
**When to use:** Any new `Book.txt` content (D-09–D-11).  
**Example (existing resolver):**

```21:53:c:\Dev\LeanQuill\src\chapterOrder.ts
export async function resolveChapterOrder(rootPath: string): Promise<ChapterOrderResult> {
  const manuscriptDir = path.join(rootPath, "manuscript");
  const bookTxtPath = path.join(rootPath, "manuscript", "Book.txt");
  const markdownFiles = await listMarkdownFiles(manuscriptDir);

  try {
    const rawBookTxt = await fs.readFile(bookTxtPath, "utf8");
    const lines = rawBookTxt
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith("#") && !line.startsWith("part:"));
    // ... resolves to manuscript/<file> paths
```

### Pattern 4: Safe writes today vs scaffold

**What:** `SafeFileSystem.canWrite` allows `.leanquill/**` and **exactly** `manuscript/Book.txt` (plus dynamic `allowPath` prefixes).  
**When to use:** Prefer `safeFs.writeFile` for `Book.txt`; for `ch1.md`, comply with D-05/D-06 explicitly.  
**Example:**

```22:55:c:\Dev\LeanQuill\src\safeFileSystem.ts
  public canWrite(targetPath: string, isFileOperation = false): boolean {
    const normalized = path.normalize(targetPath);
    const rel = path.relative(this.rootPath, normalized);
    if (rel.startsWith("..") || path.isAbsolute(rel)) {
      return false;
    }
    // ...
    if (rel === `manuscript${path.sep}Book.txt`) {
      return true;
    }
    // ... additionalAllowed ...
    return false;
  }
```

### Anti-Patterns to Avoid

- **Global `allowPath("manuscript", ".md")`:** Violates D-05 (permanent broad manuscript allowlist).
- **Silent `Book.txt` edits** when the file already exists: Violates D-11 / D-13; must stop and use D-18.
- **Relying only on `hasManuscriptMarkers`:** Today it is true if `manuscript/` **or** `manuscript/Book.txt` exists (`src/extension.ts`); D-02 requires a stricter **scaffold-complete** signal for Setup eligibility.
- **Leaving `shouldPromptInitialize` on wrong `Book.txt` path:** It currently checks `folderPath/Book.txt` (repo root), not `manuscript/Book.txt` — misaligned with LeanPub layout and CONTEXT.

```367:374:c:\Dev\LeanQuill\src\initialize.ts
export function shouldPromptInitialize(folderPath: string): Promise<boolean> {
  const hasBookTxt = fs.stat(path.join(folderPath, "Book.txt")).then(() => true).catch(() => false);
  const hasManuscript = fs.stat(path.join(folderPath, "manuscript")).then(() => true).catch(() => false);
  const hasLeanquill = fs.stat(path.join(folderPath, ".leanquill")).then(() => true).catch(() => false);

  return Promise.all([hasBookTxt, hasManuscript, hasLeanquill]).then(([book, manuscript, initialized]) => {
    return !initialized && (book || manuscript);
  });
}
```

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Chapter order / `Book.txt` parsing | Custom line parser diverging from LeanPub | `resolveChapterOrder` (`src/chapterOrder.ts`) | Duplicates warning semantics, `alpha` fallback, `manuscript/` prefix rules |
| “Is path inside workspace?” | Ad-hoc string contains checks | `path.relative(root, abs)` + `..` guard (same as `SafeFileSystem`) | Prevents traversal bugs |
| Outline from chapters | Manual node construction in the scaffold | `bootstrapOutline` + `writeOutlineIndex` (`src/outlineStore.ts`) | Matches existing auto-bootstrap in `extension.ts` |

**Key insight:** Scaffold should **feed** existing order + outline pipelines so INIT-02 and sidebar/webviews stay consistent.

## Common Pitfalls

### Pitfall 1: `syncBookTxt` overwriting a freshly created `Book.txt`

**What goes wrong:** After scaffold, `writeOutlineIndex` triggers the outline watcher → `onOutlineChanged` → `syncBookTxt()` (`src/extension.ts`). If `generateBookTxt` ever produced divergent or empty content vs the new `Book.txt`, `writeBookTxt` could clobber author/scaffold content.

**Why it happens:** `syncBookTxt` always writes from outline index, not from “preserve existing file if outline empty.”

**How to avoid:** After Phase 13, verify ordering: for the **default** bootstrap (single part + `manuscript/ch1.md` child), `generateBookTxt` reproduces `ch1.md\n` — today’s `bootstrapOutline` + `generateBookTxt` are aligned for a single top-level part with one child. Add tests if outline shape changes. If `generateBookTxt` returns `""` (no active nodes), avoid calling `writeBookTxt` or guard against wiping a non-empty `Book.txt`.

**Warning signs:** Integration test or manual run shows `Book.txt` empty after init scaffold.

### Pitfall 2: Case-insensitive duplicate `ch1.md` / `Ch1.md`

**What goes wrong:** On Windows/macOS, creating `ch1.md` when `Ch1.md` exists causes collision or overwrite.

**Why it happens:** OS filesystem case folding vs D-09 “treat as already present.”

**How to avoid:** Before `writeFile`, **read `manuscript/` directory** and detect any `.md` whose basename matches `ch1` case-insensitively; use **on-disk basename** in new `Book.txt` lines (D-09–D-10).

### Pitfall 3: D-11 vs D-10 deadlock messaging

**What goes wrong:** User has `Book.txt` and `ch1.md`, but `Book.txt` omits `ch1.md` — scaffold cannot fix (D-11); user is confused.

**Why it happens:** Explicit tension D-13.

**How to avoid:** Implement D-18 with actionable copy + command to `leanquill.openBookTxt` (`package.json` already contributes it).

### Pitfall 4: Success UX still opens `project.yaml`

**What goes wrong:** `runInitializeFlow` ends with `showTextDocument(project.yaml)` — conflicts with D-15 “Planning Workspace → Cards” as primary success affordance for this flow.

**Why it happens:** Legacy success path from Phase 1 init.

**How to avoid:** Branch success tail: full greenfield init may still open `project.yaml` if product wants; Phase 13 CONTEXT prioritizes Planning Cards — planner should reconcile explicitly.

## Code Examples

### `setWorkspaceContext` extension point (today)

```23:30:c:\Dev\LeanQuill\src\extension.ts
async function setWorkspaceContext(rootPath: string): Promise<void> {
  const hasBookTxt = await fs.stat(path.join(rootPath, "manuscript", "Book.txt")).then(() => true).catch(() => false);
  const hasManuscript = await fs.stat(path.join(rootPath, "manuscript")).then(() => true).catch(() => false);
  const hasLeanquill = await fs.stat(path.join(rootPath, ".leanquill", "project.yaml")).then(() => true).catch(() => false);

  await vscode.commands.executeCommand("setContext", "leanquill.hasManuscriptMarkers", hasBookTxt || hasManuscript);
  await vscode.commands.executeCommand("setContext", "leanquill.isInitialized", hasLeanquill);
}
```

Phase 13 should add at least one key for **manuscript scaffold complete** (both `manuscript/` and `manuscript/Book.txt`) per D-02/D-04.

### Initialize command refreshes context (pattern to reuse after scaffold)

```73:88:c:\Dev\LeanQuill\src\extension.ts
  const initializeCommand = vscode.commands.registerCommand("leanquill.initialize", async () => {
    // ...
    const rootPath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (rootPath) {
      await setWorkspaceContext(rootPath);
    }
  });
```

### Auto-bootstrap outline when initialized but outline empty

```688:700:c:\Dev\LeanQuill\src\extension.ts
  try {
    const hasProject = await fs.stat(path.join(rootPath, ".leanquill", "project.yaml")).then(() => true).catch(() => false);
    if (hasProject) {
      const existingIndex = await readOutlineIndex(rootPath);
      if (existingIndex.nodes.length === 0) {
        const chapterOrder = await readChapterOrderState(rootPath);
        if (chapterOrder.chapterPaths.length > 0) {
          const index = bootstrapOutline(chapterOrder.chapterPaths);
          await writeOutlineIndex(rootPath, index, safeFileSystem);
          log.info("Auto-bootstrapped outline from Book.txt");
        }
      }
```

Scaffold must leave the repo in a state where `chapterOrder.chapterPaths.length > 0` once `Book.txt` + at least one listed `.md` exist.

### Setup view is empty tree + `viewsWelcome`

```11:14:c:\Dev\LeanQuill\src\actionsView.ts
  getChildren(): vscode.TreeItem[] {
    // Return empty so the viewsWelcome content renders
    return [];
  }
```

### `package.json`: third Setup state always tied to `leanquill.isInitialized` only

```192:196:c:\Dev\LeanQuill\package.json
      {
        "view": "leanquill.actions",
        "contents": "Welcome to LeanQuill \u2014 your LeanPub-style authoring assistant.\n\nLeanQuill keeps your manuscript safe with strict write boundaries while helping you organize chapters, track characters, and manage your writing project.\n\nThis project is initialized and ready to use.\n\n[Re-initialize](command:leanquill.initialize)",
        "when": "leanquill.isInitialized"
      },
```

Phase 13 needs **additional `when` refinement** so “ready” does not show when `Book.txt` is missing (D-02).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Setup assumes manuscript markers or LeanQuill folder | Any folder can be driven through Setup with state-based behavior | Phase 13 (planned) | Broadens acquisition / onboarding |
| Planning opens on Outline tab | Success opens Cards tab | Phase 13 (planned) | Matches author mental model post-scaffold |

**Deprecated/outdated:** N/A — incremental extension.

## Open Questions

1. **Invalid `project.yaml` definition (D-02, discretion)**
   - What we know: `readProjectConfig` returns best-effort parse or `null` on I/O error; it does not fully validate schema (`src/projectConfig.ts`).
   - What’s unclear: Which failures count as “invalid” for showing Setup (syntax vs missing `schema_version` vs unknown fields)?
   - Recommendation: Planner picks minimal rules (e.g. unreadable file, missing `schema_version`, or failed required sections) and adds tests.

2. **Should full init still open `project.yaml` after scaffold-only completion?**
   - What we know: D-15 emphasizes Planning Cards for success.
   - What’s unclear: Whether greenfield init (new `project.yaml`) should **also** open editor or only webview.
   - Recommendation: Single toast; open Planning Cards; optionally open `project.yaml` only when **new** template was written — product choice, document in PLAN.

3. **`shouldPromptInitialize` alignment**
   - What we know: Uses root `Book.txt` not `manuscript/Book.txt`.
   - What’s unclear: Whether proactive prompt is in scope for Phase 13 or follow-up.
   - Recommendation: Fix path when touching init eligibility to avoid false negatives.

## Environment Availability

Step 2.6: **SKIPPED** for blocking external services — Phase 13 is in-repo TypeScript/VS Code only.

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | build, `npm test` | ✓ | v24.11.1 (verified) | — |
| npm | scripts | ✓ | 11.6.2 | — |
| VS Code / Cursor | manual UAT | — | — | — |

**Missing dependencies with no fallback:** None for implementation.

## Validation Architecture

> Nyquist **Dimension 8** (representative): behavioral correctness + safety invariants for scaffold flows. Map automated tests to INIT-01/INIT-02 and CONTEXT D-05–D-18.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node.js built-in **test** runner (`node:test`) + `assert/strict` |
| Config file | none — see `package.json` `scripts.test` |
| Quick run command | `npm run build:test && npm test` |
| Full suite command | same (full suite is fast) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| INIT-01 | Single command path can create `.leanquill` + `project.yaml` (existing) and manuscript scaffold when needed | unit / integration-style (temp dir) | `npm run build:test && npm test -- test/initializeScaffold.test.ts` | ❌ Wave 0 — add `test/initializeScaffold.test.ts` (or extend `initialize` tests) |
| INIT-02 | `Book.txt` drives order; missing file → alpha sort | unit | `npm run build:test && npm test -- test/chapterOrder.test.ts` | ✅ `test/chapterOrder.test.ts` |
| D-07 | No overwrite of existing `Book.txt` / chapter | unit | same new test file | ❌ |
| D-09–D-10 | Case-insensitive existing chapter basename preserved in new `Book.txt` | unit | same | ❌ |
| D-11/D-18 | When `Book.txt` exists and chapter unlisted, scaffold returns structured “blocked” result (no file mutation) | unit | same | ❌ |
| Safe boundary | No writes outside `root/manuscript/**` for scaffold | unit | `npm run build:test && npm test -- test/safeFileSystem.test.ts` + scaffold tests | ✅ partial (`test/safeFileSystem.test.ts`) |
| Context keys | After apply, `setWorkspaceContext` would set scaffold-complete true | integration | Optional — may require `@vscode/test-electron` later; **defer** if too heavy | ❌ |
| Refresh | Files on disk + `chapter-order.json` / outline bootstrap consistent | manual / future e2e | Manual UAT in VS Code | — |

### Sampling Rate

- **Per task commit:** `npm run build:test && npm test` (targeted file if large suite grows)
- **Per wave merge:** full `npm test`
- **Phase gate:** full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `test/initializeScaffold.test.ts` (or modular `test/leanpubScaffold.test.ts`) — covers scaffold plan + apply: create-only, skip existing, case folding, D-11 stop
- [ ] Optional: extract **pure functions** from `initialize.ts` to keep tests free of `vscode` mocks
- [ ] Manual checklist: `viewsWelcome` shows correct Setup state for (a) no `.leanquill`, (b) `.leanquill` but no `Book.txt`, (c) complete; success opens **Cards** tab

*(Existing `test/chapterOrder.test.ts` and `test/safeFileSystem.test.ts` already support INIT-02 and boundary regression.)*

## Sources

### Primary (HIGH confidence)

- Codebase: `src/chapterOrder.ts`, `src/safeFileSystem.ts`, `src/initialize.ts`, `src/extension.ts`, `src/planningPanel.ts`, `src/planningPanelHtml.ts`, `package.json`, `src/actionsView.ts`, `src/bookTxtSync.ts`, `src/outlineStore.ts`
- Context7 `/websites/code_visualstudio_api` — `setContext` / `executeCommand` / `createFileSystemWatcher` topics

### Secondary (MEDIUM confidence)

- `https://code.visualstudio.com/api/references/when-clause-contexts` — custom context keys

### Tertiary (LOW confidence)

- None required for core findings

## Metadata

**Confidence breakdown:**

- Standard stack: **HIGH** — pinned in `package.json`; versions verified via npm registry
- Architecture: **HIGH** — direct file reads
- Pitfalls: **MEDIUM-HIGH** — `syncBookTxt` interaction inferred from `extension.ts` control flow; worth explicit test

**Research date:** 2026-04-08  
**Valid until:** ~2026-05-08 (stable stack); revisit if VS Code engine minimum bumps

---

## RESEARCH COMPLETE

**Phase:** 13 - LeanPub Workspace Initialization  
**Confidence:** HIGH

### Key Findings

- **`SafeFileSystem` blocks `manuscript/ch1.md`**; only `manuscript/Book.txt` is allowed by default — scaffold must use D-05/D-06 compliant I/O.
- **`resolveChapterOrder` + `bootstrapOutline` + `syncBookTxt`** form a pipeline: scaffold content must stay consistent to avoid `Book.txt` churn after outline writes.
- **`setWorkspaceContext` + `viewsWelcome`** need new keys/strings for “initialized but manuscript incomplete” (D-02/D-04).
- **`PlanningPanelProvider`** should gain a **`cards` entry** parallel to `showCharacter` (D-15).
- **`shouldPromptInitialize`** uses **wrong `Book.txt` path**; align with `manuscript/Book.txt` when editing init eligibility.

### File Created

`.planning/phases/13-leanpub-workspace-initialization/13-RESEARCH.md`

### Confidence Assessment

| Area | Level | Reason |
|------|-------|--------|
| Standard stack | HIGH | Declared in repo + npm view |
| Architecture | HIGH | Canonical files inspected |
| Pitfalls | MEDIUM-HIGH | Control-flow analysis; validate with tests |

### Open Questions

Invalid `project.yaml` rules; whether to open `project.yaml` after full init; proactive prompt path fix scope.

### Ready for Planning

Research complete. Planner can now create PLAN.md files.
