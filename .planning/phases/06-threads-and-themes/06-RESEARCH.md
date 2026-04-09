# Phase 6: Threads and Themes — Implementation Research

**Purpose:** Answer *“What do I need to know to PLAN this phase well?”* for the LeanQuill VS Code extension.  
**Sources:** `06-CONTEXT.md`, `REQUIREMENTS.md` (THREAD-01), `ROADMAP.md`, Phase 4 context/code, current `src/` patterns.  
**Date:** 2026-04-09

---

## 1. Requirement alignment (THREAD-01 vs phase scope)

| Source | What it says |
|--------|----------------|
| **THREAD-01** (`REQUIREMENTS.md`) | Manage narrative threads and themes in the planning workspace **Threads** tab; visibility into which **beats and chapters** each thread touches. |
| **06-CONTEXT (authoritative)** | **Two tabs:** **Themes** (book-level) + **Threads** (per-thread markdown). Thread→chapter links are **chapter-level only**; **beats are not** a linking unit in v1. Optional theme→chapter links only; no theme→character in v1. |

**Planning implication:** Treat `06-CONTEXT.md` as the contract for Phase 6. When writing `PLAN.md` and success criteria, **replace “beats” with “chapters”** for thread/theme linking and note a **traceability refresh** for `REQUIREMENTS.md` / `ROADMAP.md` Phase 6 success criteria (per 06-CONTEXT deferred list).

**THREAD-01 coverage:** Satisfied by (a) Themes tab + `themes.yaml` for thematic/book framing, (b) Threads tab + `touchesChapters` (or equivalent) for subplot visibility across **chapter** files.

---

## 2. Product shape (frozen from discuss-phase)

### 2.1 Themes (book-level)

- **Storage:** `.leanquill/themes.yaml` — **dedicated file**, not embedded in `project.yaml`.
- **Content split:** Compact structured fields + references in YAML; longform markdown lives under `notes/` (paths recorded in YAML; default subdir e.g. `notes/themes/` is implementation choice).
- **Linking:** Optional **chapter-only** associations in v1 (stored in `themes.yaml` / per-theme section). No theme→character links in v1.
- **UX:** Single **scrollable form** (not master/detail for v1): central question, book synopsis, book-level custom key/values, 0…N central themes with metadata.

### 2.2 Threads (per-thread profiles)

- **Storage:** One `.md` per thread under `folders.threads` (default **`notes/threads/`**). Parsed from disk on load — **no** JSON index (same invariant as characters).
- **Model:** Mirror **Characters**: YAML frontmatter + markdown body; **Add Field** for author-defined keys; minimal defaults (e.g. title/name) + optional conventional fields (e.g. plot lane) at planner discretion.
- **Linking:** Author-maintained **`touchesChapters`** (name from context; exact key is discretionary) — array of **manuscript-relative paths** (same path style as `referencedByNameIn` on characters: e.g. `manuscript/ch01.md`).
- **Chapter picker source:** **Outline-derived list of nodes that map to manuscript chapter files** — i.e. nodes with a non-empty `fileName` under the manuscript convention — **not** manuscript grep and **not** arbitrary non-chapter outline containers. **Parts** / grouping nodes typically have `fileName: ""` in `outlineStore` bootstrap; chapters carry `fileName`.
- **UX:** List/detail like Characters; inline edit + debounced save; delete with confirmation; **no** search/filter in v1.

### 2.3 Tab order

**`Outline` → `Cards` → `Themes` → `Characters` → `Places` → `Threads`**

Today’s code has `TAB_IDS = ["outline", "cards", "characters", "places", "threads"]` in `planningPanelHtml.ts` — planning must insert **`themes`** between `cards` and `characters` and wire labels/panels.

---

## 3. Codebase map (where work lands)

| Area | Files / modules | Notes |
|------|-----------------|--------|
| Tab strip + HTML | `src/planningPanelHtml.ts` | Extend `TAB_IDS` / `TAB_LABELS`; add `renderThemesTab(...)`, `renderThreadsTab(...)`; replace stub for `threads`; add client script handlers mirroring `character:*` patterns. |
| Webview host | `src/planningPanel.ts` | Load/save themes + threads; new message types; selection state (`_selectedThreadFileName`); debounced writes (reuse character debounce / lock pattern). |
| Thread persistence | **New** module (e.g. `threadStore.ts`) | Clone the responsibilities of `characterStore.ts`: list dir, parse/serialize frontmatter, `create` / `save` / `delete` via `SafeFileSystem`. |
| Themes persistence | **New** module (e.g. `themesStore.ts`) | Read/write `.leanquill/themes.yaml`. Prefer a small dedicated parser/serializer or minimal YAML string building consistent with existing hand-rolled YAML in `characterStore.ts` / `projectConfig.ts`. |
| Chapter options | **New helper** or `outlineStore.ts` | Walk `OutlineIndex` tree; collect nodes with `fileName` pointing at manuscript chapters (`manuscript/...`). Optionally **sort** by `resolveChapterOrder()` from `chapterOrder.ts` so picker order matches Book.txt / alpha rules. |
| Config | `src/projectConfig.ts`, `src/initialize.ts` | Add `folders.threads`; parse line in `folders:` block; default `notes/threads/`; template line in `renderProjectYaml`. |
| Safe writes | `src/safeFileSystem.ts`, `src/extension.ts` | `allowPath` for threads folder (`.md` only), mirroring characters; reject config pointing into `manuscript/`. Theme **metadata** is under `.leanquill/` — already allowed. Theme **notes** under `notes/` need allowPath for the configured notes path(s) or a dedicated prefix (e.g. `notes/themes/`) — same pattern as characters. |
| Commands | `src/extension.ts`, `package.json` | **`LeanQuill: New Thread`**, **`LeanQuill: New Theme`** (exact IDs to align with existing `leanquill.newCharacter` style); optional `onCommand` activation entries. |
| Optional sidebar | TBD in plan | Characters have `CharacterTreeProvider` + watcher; threads may mirror for parity or defer if out of scope — call out in PLAN. |

**Reference implementation:** `characterStore.ts` (parse/serialize, slug filename, list), `planningPanel.ts` (`character:*` handlers, `_flushPendingCharacter`), `planningPanelHtml.ts` (list/detail UI + `input`/`textarea` + postMessage), `extension.ts` (`allowPath`, manuscript boundary check).

---

## 4. Data design notes (for PLAN.md decisions)

### 4.1 `themes.yaml`

- **Not** specified in `project-config-schema.md` yet — plan should add a short contract (version field optional; list of themes with `id` or stable key, `title`, optional `notePath`, optional `linkedChapters: []`).
- **Validation:** Malformed YAML should fail gracefully (empty form + error toast vs. partial load — match extension norms).
- **Concurrency:** Same as outline/characters — last-write-wins via webview; optional file watcher refresh later.

### 4.2 Thread frontmatter

- Reserved keys (suggested): `title` or `name`, `touchesChapters` (list of strings).
- **Path normalization:** Store forward slashes like `characterStore` does for `referencedByNameIn`.
- **Display:** Detail pane should show touched chapters **prominently** (titles from outline node `title` if resolvable, else path).

### 4.3 Chapter picker UX (discretionary)

- Multi-select list vs. checkbox list vs. dual-list — any is fine if it writes a clean string array.
- **Eligibility rule:** Only nodes with real chapter `fileName` (non-empty, under `manuscript/`). Exclude `traits.includes("part")` **if** they never carry files; in current `outlineStore` bootstrap, parts use empty `fileName` — still safest to gate on **non-empty `fileName` + manuscript prefix**.

---

## 5. Dependencies and sequencing

- **Phase 3** (outline webview, tabs, postMessage): already delivered.
- **Phase 4** (characters): **direct template** for Threads.
- **Phase 5** (places): runs before Phase 6 on the roadmap; `project.yaml` may gain `folders.settings` or similar. Phase 6 should **add `folders.threads` in a way that merges cleanly** with whatever Phase 5 does to `parseProjectConfig` / init template — expect **one shared folders block** with multiple keys.

---

## 6. Risks and edge cases

| Risk | Mitigation |
|------|------------|
| Outline out of sync with `Book.txt` | Picker should still only offer **outline nodes with `fileName`**; optionally warn if `resolveChapterOrder()` lists chapters not in outline. |
| Empty outline | Threads/themes still work; chapter pickers empty or disabled with copy. |
| `themes.yaml` missing on old repos | Create on first save or ship init migration in “open planning” path — decide in PLAN. |
| YAML complexity | Keep `themes.yaml` flat enough to avoid a new npm dependency unless project already adds a YAML library. |
| SafeFileSystem | Never allow `folders.threads` inside `manuscript/` (copy characters check in `extension.ts`). |

---

## 7. What the planner should output in PLAN.md

1. **Work breakdown:** Themes tab + YAML I/O; Threads tab + threadStore; config + SafeFS + init; chapter enumeration helper; commands + package.json; CSS/HTML parity with Characters.
2. **Message protocol:** `theme:*` / `thread:*` names and payloads (mirror `character:*`).
3. **File list** touching each wave.
4. **UAT checklist:** tab order, create/edit/delete, persistence across reload, chapter picker constraints, manuscript never written.
5. **Docs updates:** `Imported/data-contracts/project-config-schema.md` for `folders.threads`; optional `themes.yaml` fragment.

---

## Validation Architecture

*(Nyquist / Dimension 8 — repeatable verification gates.)*

### Automated commands

| Command | Role |
|---------|------|
| `npm run build` | **Required after every wave** that changes `src/`. Bundles `extension.ts` → `dist/extension.js` via esbuild; catches TypeScript/bundle errors. |
| `npm run build:test` | Compiles `test/*.test.ts` → `dist-test/**/*.test.js`. Run before `npm test` when test sources change. |
| `npm test` | Runs **`node --test dist-test/**/*.test.js`** (Node built-in test runner — **not** Vitest/Jest). |

### Tests to add or extend (recommended)

- **`threadStore`:** parse/serialize round-trip, `touchesChapters` list handling, slug/filename rules (mirror `test/characterStore.test.ts`).
- **`themesStore` (or equivalent):** parse minimal/malformed `themes.yaml`, serialize stability.
- **`projectConfig`:** `folders.threads` parsing and defaults (`test/projectConfig.test.ts` pattern).
- **`safeFileSystem`:** optional case ensuring threads prefix allowed/blocked consistently (`test/safeFileSystem.test.ts`).

### Manual / webview checks (cannot be fully automated in repo today)

1. Run Extension Development Host, open a workspace with LeanQuill initialized.
2. **Planning Workspace:** verify tab order and labels; Themes form loads/saves; Threads list/detail CRUD; chapter picker only shows real chapter files; paths persist in frontmatter / YAML.
3. **Reload window:** confirm `themes.yaml` and thread files retain edits.
4. **Safety:** confirm no writes to `manuscript/*.md` from Threads/Themes actions (only `.leanquill/` + allowed notes prefixes).

### After each planning wave (execution phase)

1. `npm run build`
2. If tests touched: `npm run build:test && npm test`
3. Smoke the webview flows above for the wave’s surface area (Themes-only wave vs Threads-only wave).

---

## RESEARCH COMPLETE
