# Phase 5: Place and Setting Reference — Research

**Researched:** 2026-04-09  
**Domain:** VS Code extension webview (planning panel), markdown frontmatter profiles, manuscript + outline indexing  
**Confidence:** HIGH for codebase-aligned storage/UX patterns; MEDIUM for beat-linking semantics (outline model + product wording tension)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Profile shape (frontmatter + body)**

- **D-01:** Default frontmatter fields: **`name`**, **`aliases`** (YAML array), **`category`**, **`region`**, **`description`**, plus author-defined custom fields via the same **Add field** pattern as characters and beats.
- **D-02:** **`aliases`** are **optional** — authors may omit the key or use an empty array; no requirement to fill aliases for every place.
- **D-03:** **`category`** plays the same organizational role as character **`role`** (e.g. interior / city / landmark / recurring); authors may use any string, including values outside a fixed enum.
- **D-04:** **`region`** is a first-class default field so list grouping by region is well-defined (geographic or story region; free string like `category`).
- **D-05:** **Body** is freeform markdown for longer notes; short structured summary stays in **`description`**.

**List organization**

- **D-06:** Places list is **grouped by `region`**.
- **D-07:** Entries with missing or empty **`region`** appear under a single group labeled **`Uncategorized`** (or equivalent copy — implementation discretion for exact label).
- **D-08:** Within each region group, sort **A→Z by `name`** (case-insensitive sort is acceptable).

**Not decided in discuss-phase (planner must resolve)**

- **Linking model:** How place ↔ story associations are stored and maintained (e.g. manuscript name/alias scan like **04-CONTEXT** `referencedByNameIn`, author-maintained chapter lists like **06-CONTEXT** `touchesChapters`, beat-level IDs, or a hybrid). **Roadmap success criteria** explicitly mention **chapters and beats**; **06-CONTEXT** limits threads to **chapter-only** — places may differ per **PLACE-01**; planner should reconcile.
- **Config key and folder path:** **`project.yaml`** / **`projectConfig.ts`** — align with **`Imported/data-contracts/project-config-schema.md`** (`folders.settings` / `notes/settings/`) vs introducing an explicit **`places`** key; **`SafeFileSystem`** allowlist and **`initialize.ts`** template must match the chosen key.
- **Full UX parity:** Default expectation is **Characters-tab parity** (list/detail, inline edit, delete with confirmation, header + command palette create flow, no search/filter in v1 per Phase 4) unless the plan documents an intentional deviation.

### Claude's Discretion

- Exact debounce, styling, frontmatter key ordering, slug/filename rules for new place files.
- Whether **`category`** is also surfaced as a secondary grouping or filter later (v1 is **region**-grouped only per user decision).

### Deferred Ideas (OUT OF SCOPE)

- None — discussion stayed within Area 3 scope; linking and folder decisions deferred to planning, not backlog.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PLACE-01 | Author can manage place and setting profiles within the planning workspace Places tab — creating, editing, and organizing location entries with author-defined fields, **linking places to the beats and chapters** where scenes occur | Mirror **characterStore** + **planningPanel** patterns for CRUD; extend **projectConfig** + **SafeFileSystem** + **extension** wiring; resolve **chapter vs beat** linking via recommended hybrid (below) or explicit author-maintained model |
</phase_requirements>

---

## Summary

Phase 5 replaces the **Places** stub in `planningPanelHtml.ts` with a **Characters-style** list/detail webview backed by **one markdown file per place** under a configured notes folder. Locked UX and field shapes parallel Phase 4 (roles → categories, but **grouping is by `region`**). The main planning risk is **PLACE-01’s beat linkage**: manuscript text alone does not encode beat boundaries, so beat visibility must come from **outline data** (`outline-index.json`), author-maintained IDs, or a hybrid.

**Primary recommendation:** Use **`folders.settings`** (default `notes/settings/`) per `Imported/data-contracts/project-config-schema.md` and `initialize.ts` — extend `projectConfig.ts` parsing and `SafeFileSystem.allowPath` like characters/threads. For linking: **chapter-level** use the same **word-boundary name/alias scan** on manuscript open/save as `scanManuscriptFileForCharacters` (new `placeStore` + `scanManuscriptFileForPlaces`). For **beat-level**, run a parallel scan over **outline nodes** (see [Linking model](#linking-model-options-recommendation)) and persist beat references as **outline node IDs** in place frontmatter.

---

## Scope

| In scope | Out of scope (unless planner explicitly expands) |
|----------|---------------------------------------------------|
| Places tab UI (list/detail, inline edit, Add Field, delete w/ confirm, + New Place + command) | Global Knowledge pane (Phase 7) |
| CRUD for `.md` profiles under configured folder | AI / manuscript writes |
| Visibility into **chapters** (and **beats** per requirement) referencing each place | WYSIWYG markdown editor inside webview |
| `project.yaml` folder key + SafeFs + watcher + command registration | Renaming `folders.settings` in schema doc (follow contract) |

---

## Codebase Findings

### Planning webview integration

- **`planningPanelHtml.ts`:** `TAB_IDS` includes `places`; `renderPlanningHtml` still uses `renderStubTab` for `places` (lines ~496–510). Characters/threads provide the template: container layout, header button, debounced `postMessage` in embedded script, `escapeHtml` for all dynamic strings.
- **`planningPanel.ts`:** Holds panel state (`_selectedCharacterFileName`, debounce locks, `_handleMessage` switch). Places will need analogous state (`_selectedPlaceFileName`, `_pendingPlace`, flush on dispose), new message types (`place:create`, `place:updateField`, …), and `renderPlanningHtml` signature extended to pass `places[]` and selection.
- **`extension.ts`:** Registers `allowPath` for research, characters, threads; manuscript watchers call `scanManuscriptFileForCharacters`. Places should add **settings folder** allowlist, optional **places watcher** (`*.md`) to refresh planning panel, **`leanquill.newPlace`** command, and **scan hook** alongside character scan (or a single orchestrator that runs both).

### Config gap (important)

- **`Imported/data-contracts/project-config-schema.md`** defines `folders.settings: notes/settings/`.
- **`initialize.ts`** `renderProjectYaml` already emits `settings: notes/settings/`.
- **`projectConfig.ts`** `ProjectConfig` and `parseProjectConfig` currently expose only `research`, `characters`, `threads` — **no `settings`**. Phase 5 must add parsing + defaults + tests (mirror `threads` extraction pattern).

### Safe file boundary

- **`safeFileSystem.ts`:** `allowPath(prefix, ".md")` is the established pattern for notes folders. Settings/places notes must use the **resolved** folder (reject `manuscript/` prefix like characters/threads).

### Character reference as canonical implementation

- **`characterStore.ts`:** `parseCharacterFile` / `serializeCharacterFile`, `listCharacters`, `createCharacter` (slug collision suffix), `saveCharacter`, `deleteCharacter`, `scanManuscriptFileForCharacters` (word-boundary regex per name/alias).
- **`types.ts`:** `CharacterProfile` shape; places need `PlaceProfile` (or equivalent) with `name`, `aliases`, `category`, `region`, `description`, `customFields`, `body`, plus **linkage fields** (planner-chosen names).
- **Tests:** `test/characterStore.test.ts` + `test/threadStore.test.ts` show temp-dir filesystem tests and `SafeFileSystem` setup — copy patterns for `placeStore.test.ts`.

### Chapter picker precedent (contrast)

- **`chapterPickerOptions.ts`:** Builds manuscript chapter options from outline + `Book.txt` order — used by **threads/themes**, not characters. Places could use this **only** if planner chooses **author-maintained chapter lists** (like `touchesChapters`); locked discuss-phase preference for automation is closer to **characters** for chapters.

### Product wording vs current character UI

- **REQUIREMENTS.md** CHAR-01 and PLACE-01 both mention **chapters and beats**.
- **Current `renderCharacterDetail`** only lists `referencedByNameIn` (manuscript paths) — **chapter-granular**, no beat IDs in the UI.
- **Implication:** Phase 5 can either (a) implement beat visibility for places first (making Places richer than current Characters UI), or (b) plan a small follow-up to align Characters with the same beat model. Call this out in the plan to avoid silent requirement drift.

---

## Linking model options (recommendation)

### Option A — Manuscript scan only (chapter paths)

- **Mechanism:** Same as `referencedByNameIn` — array of `manuscript/ch*.md` paths.
- **Pros:** Trivial reuse of `scanManuscriptFileForCharacters` logic; zero outline coupling.
- **Cons:** **Does not satisfy PLACE-01 beat wording** without reinterpretation.

### Option B — Author-maintained lists (thread-style)

- **Mechanism:** `touchesChapters: string[]` plus e.g. `touchesBeats: string[]` (outline node UUIDs) edited via checkbox UI built from `buildChapterPickerOptions` + **flat beat list** from outline tree.
- **Pros:** Predictable, no false positives; mirrors Phase 6 for chapters.
- **Cons:** Heavy UX; beat picker must enumerate non-chapter outline nodes; authors must manually curate.

### Option C — Hybrid (recommended)

**Chapters:** Word-boundary scan of manuscript text for `name` + `aliases` → store as `referencedByNameIn: string[]` (same semantics as characters).

**Beats:** On **outline index** change (and optionally on planning panel refresh), scan each outline node:

- Consider nodes **that are not manuscript chapter files** (e.g. `fileName` empty or not matching `manuscript/*.md`) as candidate **beat/scene** nodes — or use a stricter rule (only **leaf** descendants under a chapter node) if the planner defines “beat” precisely for this codebase.
- For each candidate, run the same word-boundary match against **`node.description`** and string values in **`node.customFields`** (optionally prioritize a `where` key if present).
- Persist matches as **`referencedInBeats: string[]`** (outline node IDs) or equivalent in place frontmatter.

**Rationale:** Meets “visibility across story structure” without forcing manual beat tagging; reuses proven matching rules; aligns with Phase 4 automation philosophy. **Tradeoff:** Common place names increase false positives (same class of issue as character scanning).

**Confidence:** MEDIUM — exact “beat” node identification in `OutlineNode` trees should be validated against real `outline-index.json` samples (nested parts, empty `fileName`, inactive nodes).

### Option D — Outline-only (no manuscript scan for places)

- **Mechanism:** Only Option C’s outline scan.
- **Cons:** Misses locations mentioned only in prose, not in beat cards — **inferior** to hybrid for typical workflows.

**Planner instruction:** Pick **Option C** unless UX research favors **Option B**; do not ship **Option A** alone if PLACE-01 is interpreted literally.

---

## Config / folder / SafeFileSystem alignment

| Artifact | Action |
|----------|--------|
| `Imported/data-contracts/project-config-schema.md` | Already documents `folders.settings` — no change required unless planner renames (not recommended). |
| `initialize.ts` | Already includes `settings: notes/settings/` in template — ensure migrations/old YAML still get defaults via `parseProjectConfig` defaults. |
| `projectConfig.ts` | Add `folders.settings` to interface, parser loop, and `DEFAULT_PROJECT_CONFIG` (`notes/settings/`). |
| `safeFileSystem` via `extension.ts` | `allowPath(safeSettingsFolder, ".md")` with manuscript-prefix guard (copy characters/threads). |
| `migrateProjectYaml` | Only if v1 projects lack `settings` key — optional line append pattern (planner decides; many repos may already have full template). |

**Naming in code:** Internal config key **`settings`**; UI string remains **Places** (avoids confusion with VS Code “settings” by context).

---

## Risks

| Risk | Mitigation |
|------|------------|
| **Beat definition ambiguous** in outline (leaf vs empty `fileName` vs depth) | Document invariant in PLAN; add unit tests with fixture `OutlineIndex` trees. |
| **Dual scan** (manuscript + outline) doubles IO on save | Run place scan in same handler as character scan; share file reads where possible (LOW priority optimization). |
| **False positives** on short place names | Same as characters; document author guidance (use distinctive names or aliases). |
| **CHAR-01 / PLACE-01 parity** | If Places shows beats and Characters does not, either add beats to Characters in same phase or record intentional deferral in PLAN. |
| **`folders.settings` vs `places`** | Deviating from schema breaks contract docs and sample YAML — prefer **`settings`**. |

---

## Open Questions

1. **Inactive outline nodes:** Should beat references include matches inside `active: false` nodes? (Recommend: **yes** for continuity auditing; optionally style them muted in UI.)
2. **Chapter file rename:** `referencedByNameIn` stores paths — renames orphan entries until next scan; same for beat IDs if outline nodes are deleted/rebuilt. Acceptable v1 behavior vs migration task?
3. **Sidebar tree for places:** Characters have `CharacterTreeProvider`; Phase 5 scope does not require a places tree — confirm with planner (likely **out of scope** for v1).

---

## Validation Architecture

`workflow.nyquist_validation` is **true** in `.planning/config.json` — automated checks should gate the phase.

### Test framework

| Property | Value |
|----------|-------|
| Framework | Node.js built-in `node:test` |
| Config | `package.json` scripts `build:test` + `test` |
| Quick run | `npm run build:test && npm test` |
| Full suite | Same (single suite today) |

### Phase requirements → concrete signals

| Req ID | Automated signal | Type |
|--------|------------------|------|
| PLACE-01 (CRUD) | `placeStore.test.ts`: parse/serialize round-trip; create with slug collision; delete blocked without SafeFs | unit + temp FS |
| PLACE-01 (config) | `projectConfig.test.ts`: YAML with `folders.settings` parses; default when missing | unit |
| PLACE-01 (safety) | `safeFileSystem.test.ts` or extension integration test: writes under resolved settings folder **allowed**; writes under `manuscript/` **blocked** | unit |
| PLACE-01 (chapters) | `scanManuscriptFileForPlaces`: given temp manuscript text containing place name, `referencedByNameIn` contains relative path; removal on delete of text | unit |
| PLACE-01 (beats) | Pure function test: given `OutlineIndex` fixture + place names, expected beat ID set matches | unit |
| Wiring | `grep` / test: `leanquill.newPlace` in `package.json` contributes; message types handled in `planningPanel.ts` | static or smoke |

### Grep / CLI gates (CI-friendly)

- `rg 'renderStubTab\\(\"Places\"\\)' src/` → **no matches** after implementation.
- `rg 'place:' src/planningPanel.ts` → at least N handler cases (or equivalent `place:` message prefix).
- `rg 'folders\\.settings|settings:' src/projectConfig.ts` → parser includes settings.
- `rg 'allowPath.*settings|notes/settings' src/extension.ts` → SafeFs registration present.

### Wave 0 gaps (before feature work)

- [ ] `test/placeStore.test.ts` — new file mirroring `characterStore.test.ts`.
- [ ] Extend `test/projectConfig.test.ts` for `folders.settings`.
- [ ] `OutlineIndex` fixture helper shared for beat-scan tests (could live in `test/fixtures/` as JSON).

---

## Standard Stack

| Component | Version / note | Purpose |
|-----------|----------------|---------|
| VS Code extension API | `^1.90.0` (`package.json`) | WebviewPanel, commands, watchers |
| TypeScript | `^5.8.3` | Implementation language |
| esbuild | `^0.25.3` | Bundle + test bundle |

**No new npm dependencies anticipated** — reuse existing patterns (markdown frontmatter parsing as in `characterStore`).

---

## Don't Hand-Roll

| Problem | Use instead |
|---------|-------------|
| Profile CRUD + YAML frontmatter | Clone **`characterStore`** / **`threadStore`** structure |
| Webview list/detail + debounce | Clone **`planningPanelHtml.ts`** characters block + **`planningPanel.ts`** handlers |
| Safe writes outside `.leanquill/` | **`SafeFileSystem.allowPath`** |
| Chapter ordering labels | **`buildChapterPickerOptions`** (if author-maintained linking) |
| Slug filenames | **`slugifyCharacterName`** pattern → `slugifyPlaceName` |

---

## Architecture Patterns

### Recommended modules

```
src/
├── placeStore.ts      # parse/serialize/list/create/save/delete + scan helpers
├── types.ts           # PlaceProfile interface
├── projectConfig.ts   # folders.settings
├── planningPanelHtml.ts  # renderPlacesTab
├── planningPanel.ts   # message handlers + state
└── extension.ts       # allowPath, watcher, newPlace command, scan hook
```

### Anti-patterns

- Writing place files without going through **SafeFileSystem**.
- Introducing a JSON index file for places (violates **md-as-source-of-truth** pattern from Phase 4).
- Using `folders.places` without updating **Imported** schema and all templates.

---

## Environment Availability

**Step 2.6:** No exotic external services. Development requires Node.js for `npm run build` / tests. **None — verified:** phase is implementable with repo toolchain only.

---

## Sources

### Primary (HIGH)

- `05-CONTEXT.md` — locked field/grouping decisions and open linking/config questions.
- `04-CONTEXT.md`, `06-CONTEXT.md` — pattern references and thread chapter-only contrast.
- `src/planningPanel.ts`, `src/planningPanelHtml.ts`, `src/characterStore.ts`, `src/projectConfig.ts`, `src/extension.ts`, `src/safeFileSystem.ts`, `src/chapterPickerOptions.ts`, `src/types.ts`, `Imported/data-contracts/project-config-schema.md`, `src/initialize.ts`.

### Secondary (MEDIUM)

- `.planning/REQUIREMENTS.md` PLACE-01; `.planning/ROADMAP.md` Phase 5 success criteria.

---

## Metadata

**Confidence breakdown**

- Standard stack / module boundaries: **HIGH** (explicit in repo).
- Beat linking via outline scan: **MEDIUM** (depends on outline tree conventions).
- Product parity with CHAR-01 beat wording: **MEDIUM** (current UI is chapter-only for characters).

**Valid until:** ~2026-05-09 (or sooner if outline/beat model changes).
