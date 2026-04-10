# Phase 5: Place and Setting Reference - Context

**Gathered:** 2026-04-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Populate the **Places** stub tab in the planning workspace webview with full place/setting profile management. Authors create, edit, organize, and delete location entries stored as markdown with structured frontmatter. **PLACE-01** and roadmap success criteria call for linking places to **chapters and beats** where scenes occur; the exact linking mechanism was **not** decided in this discuss-phase session (see planner alignment below).

</domain>

<decisions>
## Implementation Decisions

### Profile shape (frontmatter + body)

- **D-01:** Default frontmatter fields: **`name`**, **`aliases`** (YAML array), **`category`**, **`region`**, **`description`**, plus author-defined custom fields via the same **Add field** pattern as characters and beats.
- **D-02:** **`aliases`** are **optional** — authors may omit the key or use an empty array; no requirement to fill aliases for every place.
- **D-03:** **`category`** plays the same organizational role as character **`role`** (e.g. interior / city / landmark / recurring); authors may use any string, including values outside a fixed enum.
- **D-04:** **`region`** is a first-class default field so list grouping by region is well-defined (geographic or story region; free string like `category`).
- **D-05:** **Body** is freeform markdown for longer notes; short structured summary stays in **`description`**.

### List organization

- **D-06:** Places list is **grouped by `region`**.
- **D-07:** Entries with missing or empty **`region`** appear under a single group labeled **`Uncategorized`** (or equivalent copy — implementation discretion for exact label).
- **D-08:** Within each region group, sort **A→Z by `name`** (case-insensitive sort is acceptable).

### Not decided in this session (planner must resolve)

- **Linking model:** How place ↔ story associations are stored and maintained (e.g. manuscript name/alias scan like **04-CONTEXT** `referencedByNameIn`, author-maintained chapter lists like **06-CONTEXT** `touchesChapters`, beat-level IDs, or a hybrid). **Roadmap success criteria** explicitly mention **chapters and beats**; **06-CONTEXT** limits threads to **chapter-only** — places may differ per **PLACE-01**; planner should reconcile.
- **Config key and folder path:** **`project.yaml`** / **`projectConfig.ts`** — align with **`Imported/data-contracts/project-config-schema.md`** (`folders.settings` / `notes/settings/`) vs introducing an explicit **`places`** key; **`SafeFileSystem`** allowlist and **`initialize.ts`** template must match the chosen key.
- **Full UX parity:** Default expectation is **Characters-tab parity** (list/detail, inline edit, delete with confirmation, header + command palette create flow, no search/filter in v1 per Phase 4) unless the plan documents an intentional deviation.

### Claude's Discretion

- Exact debounce, styling, frontmatter key ordering, slug/filename rules for new place files.
- Whether **`category`** is also surfaced as a secondary grouping or filter later (v1 is **region**-grouped only per user decision).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope and requirements

- `.planning/ROADMAP.md` — Phase 5 goal, dependencies, success criteria (chapters + beats visibility)
- `.planning/REQUIREMENTS.md` — **PLACE-01**
- `.planning/PROJECT.md` — local-first, manuscript immutability, organizer independence

### Prior phase context (patterns to mirror or reconcile)

- `.planning/phases/04-character-reference/04-CONTEXT.md` — profile `.md` model, list/detail UX, `referencedByNameIn`, SafeFileSystem, commands
- `.planning/phases/06-threads-and-themes/06-CONTEXT.md` — chapter-only linking for threads; beats not a linking unit for threads (contrast with PLACE-01 wording)
- `.planning/phases/03-outline-and-beat-planning/03-CONTEXT.md` — planning webview, tabs, beats/outline data for any beat-level linking
- `.planning/phases/12-add-the-ability-to-run-research-in-standardized-ways-and-collect-research-results-in-a-dedicated-research-folder-next-to-the-manuscript/12-CONTEXT.md` — SafeFileSystem folder allowlist pattern

### Data contracts and templates

- `Imported/data-contracts/project-config-schema.md` — `folders.settings` / notes layout

### Code touchpoints

- `src/planningPanelHtml.ts` — `TAB_IDS` includes `places` stub; replace with real Places UI
- `src/planningPanel.ts` — message handlers (mirror characters/thread patterns)
- `src/projectConfig.ts`, `src/initialize.ts` — folder key for place/setting notes once chosen
- `src/safeFileSystem.ts` — writes under configured places/settings folder
- `src/extension.ts` — commands (e.g. New Place), watchers if auto-linking is chosen

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable assets

- **Characters tab** — primary reference for list/detail layout, inline editing, custom fields, CRUD postMessage flow, and command registration.
- **`renderStubTab("Places")`** — to be replaced with real content in `planningPanelHtml.ts`.
- **`manuscriptSync.ts` / slug helpers** — filename generation pattern if places use slugified file names like characters.

### Established patterns

- Debounced webview saves, CSP + nonce, VS Code theme variables, `escapeHtml` for webview markup.

### Integration points

- Extend **`ProjectConfig`** and YAML parsing when adding `settings` or `places` folder (currently **research / characters / threads** only in `projectConfig.ts`).
- **`SafeFileSystem`** allowlist for the chosen notes subdirectory, consistent with characters and threads.

</code_context>

<specifics>
## Specific Ideas

- **Category** parallels character **role**; **region** is explicitly for grouping the list (user chose group-by-region + A→Z within group).
- **Aliases** optional — keeps lightweight profiles uncluttered while still supporting richer entries when needed.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within Area 3 scope; linking and folder decisions deferred to planning, not backlog.

</deferred>

---

*Phase: 05-place-and-setting-reference*
*Context gathered: 2026-04-09*
