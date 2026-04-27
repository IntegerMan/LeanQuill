# Phase 9 Research

**Researched:** 2026-04-25  
**Domain:** Persona files + `project.yaml` integration, YAML/frontmatter validation, `SafeFileSystem` vs metadata-action contracts, AI-adjacent extension surfaces (story chat, metadata applier).  
**Confidence:** HIGH for codebase-grounded sections; MEDIUM for recommended persona numeric defaults (explicitly left to planner/implementer per CONTEXT).

## Executive summary

- **PER-01** is unimplemented in code today: `active_personas` is emitted as an empty array in `renderProjectYaml`, `.leanquill/personas/` is created but never populated, and there is no `Persona` type or loader in `src/types.ts` / `src/`.
- **Locked decisions (09-CONTEXT.md):** Three packaged personas (`casual-reader`, `avid-genre-fan`, `copy-editor`) as real `.md` under `.leanquill/personas/` at init; `active_personas` remains `{ id, enabled }[]`; init seeds all three enabled; missing-on-disk enabled ids → warn + skip; disabled → ignored; defense in depth = `validateMetadataAction` + `SafeFileSystem`; hybrid persona validation (hard-fail core / warn non-critical); unknown frontmatter preserved; invalid personas skipped with summary warning; feedback via output channel + concise toasts.
- **Metadata contract (D-08–D-10, D-11 alignment):** `metadataActionContract.ts` already blocks all `manuscript/**` paths including `manuscript/Book.txt`, logs blocked actions via `metadataActionLog.ts`, and `extension.ts` surfaces blocked applies with `showErrorMessage`. Low-risk auto paths are restricted to `.leanquill/memory/**`, `.leanquill/chats/**`, and the action log file; entity/theme/research/issue paths require `risk: "requiresApproval"` with `authorApproval` — matching D-11 baseline.
- **SafeFileSystem gap vs D-09:** `SafeFileSystem.canWrite` unconditionally allows `manuscript/Book.txt` (and init uses `allowPath("manuscript", ".md")` for scaffold). That is correct for **author** outline/sync/scaffold flows but means **defense in depth for AI-specific writes** cannot rely on `SafeFileSystem` alone; planners should treat D-09 as “no AI-initiated path may call `writeFile` on manuscript; Book.txt only via explicit non-AI flows,” with optional future tightening (e.g., policy flag on `SafeFileSystem` or separate writer for AI code paths).
- **Story chat today** (`storyChatContext.ts`, `extension.ts`) assembles session context and safety strings but does **not** load personas or `active_personas`; Phase 9 establishes the library + resolution rules so Phase 10/17 consumers have a single API.
- **Parsing precedent:** Character/place/thread stores use a **regex-delimited frontmatter** + line state machine (no `yaml` npm package). Personas can follow the same pattern or introduce a small dedicated module; either fits repo conventions.
- **`.cursor/rules/`:** No rule files present; non-negotiables come from `.planning/PROJECT.md` and `docs/manuscript-safety.md` (align docs with `notes/settings` allowlist when Phase 9 touches safety docs, if in scope).
- **Tests:** Existing `metadataActionContract.test.ts`, `metadataActionApplier.test.ts`, `safeFileSystem.test.ts`, `projectConfig.test.ts` are the primary extension points for new assertions; full gate: `npm run build:test && npm test`.

---

## Current codebase map

| Area | File(s) | Responsibility today | Phase 9 extension point |
|------|---------|------------------------|-------------------------|
| Init + template YAML | `src/initialize.ts` | `renderProjectYaml`, `initializeProject` creates `.leanquill/personas/`, `active_personas: []`, workflows, harness files | Seed three persona `.md` files; set `active_personas` to three `{ id, enabled: true }`; optional backfill for existing repos (see Risks) |
| Project config parse | `src/projectConfig.ts` | `parseProjectConfig` / `readProjectConfig*` — **folders + schemaVersion only**; no `active_personas` or `ai_policy` | Add `parseActivePersonas`, optional `readAiPolicy`, or widen `ProjectConfig` type; keep line-oriented parsing style or introduce minimal YAML slice reader |
| Shared types | `src/types.ts` | No persona types | Add `ActivePersonaEntry`, `PersonaRecord` (runtime shape), validation result types |
| Write boundary | `src/safeFileSystem.ts` | `.leanquill/**`, `manuscript/Book.txt`, dynamic `allowPath` prefixes | Document AI vs author policy; optional constructor/policy for stricter AI surfaces |
| Metadata safety | `src/metadataActionContract.ts`, `src/metadataActionApplier.ts`, `src/metadataActionLog.ts` | Contract validation, apply ops, JSONL audit | Ensure any new AI write entry points call `applyMetadataAction` or go through `safeFs`; extend tests for persona-related paths if any |
| Story chat | `src/storyChatContext.ts`, `src/extension.ts` | Context bundle + commands | Inject resolved enabled personas (post Phase 9 API) |
| Contracts (reference) | `Imported/data-contracts/persona-schema.md`, `project-config-schema.md` | Canonical field semantics | Implementation must match schema + CONTEXT D-12–D-14 |
| Docs | `docs/ai-integration.md`, `docs/manuscript-safety.md` | High-level policy | Update after behavior is definitive (optional Phase 9 task) |

**PER-01 mapping**

| Requirement | What “done” means in repo | Evidence gap before Phase 9 |
|-------------|---------------------------|----------------------------|
| PER-01 | Persona library on disk + `project.yaml` enable/disable + custom personas validatable against schema | No loader, no default files, no `active_personas` parsing |

---

## Persona packaging and schema

### D-01 — D-03 (packaged defaults, init generation, meaningful distinction)

- **File layout:** `.leanquill/personas/casual-reader.md`, `avid-genre-fan.md`, `copy-editor.md` — each with YAML frontmatter per `Imported/data-contracts/persona-schema.md` plus markdown body after `---`.
- **Init wiring:** In `initializeProject` (after `safeFs.mkdir` for personas), write three files via `safeFs.writeFile` (paths under `.leanquill/` — already allowed). Use the same pattern as workflow writes in `initialize.ts` (string templates or imported constants from a new `src/personaDefaults.ts` to keep `initialize.ts` readable).
- **D-03 (meaningful distinction):** Set **`context_access`** and **`feedback`** differently per sample in `persona-schema.md` (e.g., casual: `scope: sequential`, `include_*: false`, reader-focused `allowed_types`; copy-editor: stricter `allowed_types`, `tone: critical`, `include_research_notes: true` where schema allows; avid-genre-fan: higher `genre_familiarity`, `scope: chapter` or `sequential` per planner). Exact floats are **Claude’s discretion** per CONTEXT.
- **Ids:** Must match roadmap ids exactly (`casual-reader`, `avid-genre-fan`, `copy-editor`) — frontmatter `id` and filename stem aligned.

### D-04 — D-07 (config shape, init seeds, missing file, disabled)

- **`renderProjectYaml`:** Replace `active_personas: []` with three list entries (YAML list of objects with `id` / `enabled`).
- **Runtime resolution:** New function e.g. `resolveActivePersonas(rootPath, entries): { personas: ValidPersona[]; warnings: string[] }` — for each entry with `enabled: true`, if `path.join(rootPath, '.leanquill/personas', id + '.md')` missing, push warning (D-06), skip. Disabled entries: do not read file (D-07).
- **Warning surfacing:** Use existing patterns: `vscode.window.showWarningMessage` for short summary + `LogOutputChannel` / `createOutputChannel('LeanQuill')` for detail (D-15 partial); batch “3 invalid / 2 missing” into one toast where possible (D-14).

### D-12 — D-15 (custom personas, unknown fields, invalid handling, UX)

- **Validation strategy (hybrid):**
  - **Hard-fail (skip file, D-14):** Missing `---` fence; missing or empty `id`, `name`, `type`; malformed nested objects `expertise`, `context_access`, `feedback` if required keys absent per contract.
  - **Warn + defaults:** Optional numeric fields out of 0–1 range → clamp or warn; empty `domain_focus` → `[]`; optional booleans default false per schema intent.
  - **Unknown top-level keys:** Store in `Record<string, unknown>` or preserve raw frontmatter string slice for round-trip (D-13) — simplest approach: keep **unparsed** frontmatter lines in a `extensions: Record<string,string>` or retain full raw frontmatter for re-serialize only if Phase 10 needs write-back (v1 likely read-only); minimum is **do not throw** on unknown keys and **do not require** them in validator.
- **Parser implementation:** Mirror `parseCharacterFile` frontmatter extraction (`/^---\n([\s\S]*?)\n---/`) then either (a) key/value line parser for known keys only, ignoring others, or (b) structured sub-parse for `expertise:` / nested blocks. Avoid adding a heavy YAML dependency unless planner prefers `yaml` package for nested objects — **tradeoff:** dependency vs duplicated logic (existing codebase favors no dependency).
- **D-15:** On validation summary, `log.warn` lines + `showWarningMessage` with count; fatal init failures should not block extension activation — only degrade persona set.

---

## SafeFileSystem and AI write surface

### Current behavior (facts)

```22:55:c:\Dev\LQ\src\safeFileSystem.ts
  public canWrite(targetPath: string, isFileOperation = false): boolean {
    const normalized = path.normalize(targetPath);
    const rel = path.relative(this.rootPath, normalized);
    // ...
    if (rel === ".leanquill" || rel.startsWith(`.leanquill${path.sep}`)) {
      return true;
    }

    // Book.txt is the only permitted write outside .leanquill/
    if (rel === `manuscript${path.sep}Book.txt`) {
      return true;
    }
    // ... additionalAllowed ...
```

- **Metadata actions:** `isManuscriptPath` treats **`manuscript/Book.txt` as manuscript** and blocks metadata actions to it; chapter paths also blocked.

```79:88:c:\Dev\LQ\src\metadataActionContract.ts
function isManuscriptPath(targetPath: string): boolean {
  const n = normSlashes(targetPath);
  if (n === "manuscript/Book.txt") {
    return true;
  }
  if (n.startsWith("manuscript/") || n.includes("/manuscript/")) {
    return true;
  }
  return false;
}
```

- **Apply path:** `applyMetadataAction` → `validateMetadataAction` then operations using `safeFs` / `fs.readFile` on resolved paths — blocked/rejected paths log to `.leanquill/metadata-actions.jsonl` via `appendMetadataActionLogEntry` (checks `safeFs.canWrite` before append).
- **User-visible errors:** `leanquill.applyMetadataAction` uses `showErrorMessage` for blocked, `showWarningMessage` for rejected.

### D-08 — D-11 implementation notes for planner

| Decision | Where to enforce | Notes |
|----------|------------------|-------|
| D-08 Defense in depth | Keep **both** contract validation and `SafeFileSystem` on every apply/write | New AI features must not bypass with raw `fs.writeFile` except documented exceptions (see `metadataActionLog` append pattern). |
| D-09 Book.txt / manuscript | Contract already blocks metadata to `manuscript/**`. `SafeFileSystem` still allows `Book.txt` and temp `allowPath("manuscript",".md")` for scaffold. | **Planner task:** Audit call graph so no command triggered as part of “AI apply” calls `writeBookTxt` or scaffold helpers; document in module comments. Optional hardening: `SafeFileSystem` policy enum `author | ai` where `ai` denies `Book.txt`. |
| D-10 Unsafe actions | `metadataActionApplier` + log + extension messages | Already present; extend tests if new operations added. |
| D-11 Approval baseline | `metadataActionContract.ts` (`lowRiskLeanQuillPath`, `risk === "low"` restrictions) | Already encodes low = memory/chats/log only; story notes require `requiresApproval`. |

### Audit / error surfacing patterns to reuse

- **JSONL audit:** `.leanquill/metadata-actions.jsonl` — `status: "blocked" | "rejected" | "applied"`.
- **Output channel:** Chapter-order warnings in `initialize.ts` use `createOutputChannel("LeanQuill")` + `show(true)` — same pattern for persona validation dumps.
- **Toasts:** `showWarningMessage` / `showErrorMessage` one-liners in `extension.ts` for command outcomes.

---

## Risks and edge cases

| Risk | Detail | Mitigation |
|------|--------|------------|
| **Existing workspaces** | `initializeProject` only runs on fresh init; many repos have `active_personas: []` and empty personas dir | Add **activation or init backfill** (like `ensureLeanquillWorkflows`): idempotent create of missing default persona files + merge default `active_personas` only if key missing or empty — CONTEXT implies “during initialize” for full template; discuss whether **LeanQuill: Initialize** on valid yaml should also seed personas (planner decision). |
| **Partial / invalid YAML** | Typos in custom persona break line-parser | Hard-fail that file, continue others (D-14); collect messages |
| **Id mismatch** | `active_personas.id` does not match filename | Warn; try `id.md` first; optionally fuzzy message |
| **Book.txt confusion** | Authors may think AI can reorder chapters | Docs + contract block; no metadata target should use `manuscript/Book.txt` |
| **Schema drift** | `Imported/data-contracts` vs runtime | Single module maps contract field names; tests assert three packaged files parse |
| **`ensureLeanquillWorkflows` vs personas** | Workflows use `'wx'` no-clobber; personas might need same if authors edited defaults | CONTEXT D-02 says “during initialize” for packaged defaults — fresh init overwrites via `safeFs.writeFile`; updates use `'wx'` or “skip if exists” per product choice |
| **Dual schema_version** | `project.yaml` is v2 in `renderProjectYaml`; `parseProjectConfig` still only reads folders | Any new fields must not break `validateProjectYamlForSetup` |

---

## Open questions for planner

1. **Backfill scope:** Should `ensureLeanquillPersonas` (or similar) run on **every activation** for legacy repos, or only when author runs Initialize / a dedicated command?
2. **Persona consumption in Phase 9 UI:** CONTEXT says UI hint “no” for Phase 9 roadmap — confirm persona resolution is **API + init + validation only**, with no webview, unless a minimal “validate personas” command is desired for UAT.
3. **`ai_policy` in runtime:** `project.yaml` includes `ai_policy` block today but `projectConfig.ts` does not parse it — Phase 9 should either start reading it (for future LM hooks) or explicitly defer to Phase 10 with a comment in PLAN.

---

## Suggested plan slices

1. **Types + project.yaml parsing** — `src/types.ts`, `src/projectConfig.ts`, tests in `test/projectConfig.test.ts` for `active_personas` extraction and malformed lists.
2. **Default persona content + init** — new `src/personaDefaults.ts` (or inline constants), `src/initialize.ts` (`renderProjectYaml`, `initializeProject`), optional `ensureLeanquillPersonas` backfill mirroring `ensureLeanquillWorkflows`.
3. **Persona load/validate module** — e.g. `src/personaStore.ts`: `loadPersonaFile`, `validatePersonaFrontmatter`, `resolveActivePersonas` returning warnings; tests `test/personaStore.test.ts`.
4. **SafeFileSystem / AI boundary hardening (if in scope)** — `src/safeFileSystem.ts` + call-site audit in `src/extension.ts`, `src/bookTxtSync.ts`, `src/initialize.ts`; tests updating `test/safeFileSystem.test.ts` if API changes.
5. **Integration surface for downstream phases** — export a single helper used by story chat / future LM code: `getEnabledPersonasForProject(rootPath): ResolvedPersona[]` with logging side effects; wire **read-only** call from `openStoryChatWithContext` path if planner wants early smoke (optional).
6. **Docs sync** — `docs/manuscript-safety.md` table should mention `notes/settings` (places) allowlist to match `extension.ts` (minor accuracy fix).

**Suggested file touch list:** `initialize.ts`, `projectConfig.ts`, `types.ts`, new `personaStore.ts` / `personaDefaults.ts`, `test/*.test.ts`, optionally `extension.ts`, `safeFileSystem.ts`, `docs/manuscript-safety.md`.

---

## Validation Architecture

`.planning/config.json` has `workflow.nyquist_validation: true` — include automated + manual dimensions below.

### Test framework

| Property | Value |
|----------|-------|
| Framework | Node.js `node:test` + `node:assert/strict` |
| Config | `package.json` scripts; tests bundled to `dist-test/` |
| Quick / full command | `npm run build:test && npm test` |

### Dimension-by-dimension strategy

| Dimension | What to verify | Test type | How |
|-----------|----------------|-----------|-----|
| **PER-01a — Library on disk** | After init, three files exist under `.leanquill/personas/` | Unit / integration-style temp dir | Extend init tests or new test that calls `renderProjectYaml` + file writer helper; assert file contents include required frontmatter keys |
| **PER-01b — project.yaml enable/disable** | Parsing respects `enabled: false`; resolver omits | Unit | `parseActivePersonas` + `resolveActivePersonas` tests |
| **PER-01c — Custom persona** | Valid custom file with extra unknown key still loads; core-invalid skipped | Unit | Fixture strings in `test/personaStore.test.ts` |
| **Success criterion 3 — AI write surface** | Metadata cannot target manuscript; low-risk only under memory/chats | Unit (existing + add) | `metadataActionContract.test.ts` assert `manuscript/Book.txt` blocked; `safeFileSystem.test.ts` assert `ch*.md` blocked; grep guard: `rg "fs\\.writeFile.*manuscript" src` should only hit scaffold / non-AI modules (manual review) |
| **D-06 / D-14 warnings** | Missing file produces warning array; multiple invalid → summary | Unit | Assert `warnings.length` and message substrings |
| **D-15 UX** | (If logic is pure) message formatting tested; full toast/channel | Manual | F5 Extension Host: broken persona file + enabled entry → expect warning toast + output channel lines |
| **Regression** | Chapter init, metadata applier, story chat unchanged | Automated | Full `npm test` |

### Phase requirements → tests

| Req ID | Behavior | Test file (proposed / existing) |
|--------|----------|----------------------------------|
| PER-01 | Personas on disk + config + validation | `test/personaStore.test.ts` (new), `test/initialize.test.ts` or extend scaffold tests if init-only |
| D-08–D-11 (support PER-01 sc3) | Contract + SafeFS | `test/metadataActionContract.test.ts`, `test/safeFileSystem.test.ts` |

### Grep / file checks for VALIDATION.md

- `rg "active_personas" src` — expect hits in `initialize.ts`, `projectConfig.ts` (after impl), not only empty string.
- `rg "personas/" src` — seed + loader paths.
- `rg "isManuscriptPath|manuscript/Book" src/metadataActionContract.ts` — confirms Book.txt remains blocked at contract layer.
- `npm run build:test && npm test` — exit code 0.

### Wave 0 gaps

- [ ] `test/personaStore.test.ts` — does not exist yet; add before or with implementation.
- [ ] Init integration test for persona files if not covered by existing `leanpubScaffold` / init tests.

---

## Sources

### Primary (HIGH)

- `c:\Dev\LQ\.planning\phases\09-ai-safety-rails-and-persona-baseline\09-CONTEXT.md` — D-01–D-15, discretion, deferred.
- `c:\Dev\LQ\Imported\data-contracts\persona-schema.md`, `project-config-schema.md`.
- `c:\Dev\LQ\src\initialize.ts`, `projectConfig.ts`, `safeFileSystem.ts`, `metadataActionContract.ts`, `metadataActionApplier.ts`, `metadataActionLog.ts`, `extension.ts`, `storyChatContext.ts`, `characterStore.ts` (parser pattern).

### Secondary (MEDIUM)

- `c:\Dev\LQ\.planning\REQUIREMENTS.md` (PER-01), `ROADMAP.md` Phase 9, `PROJECT.md` constraints.
- `c:\Dev\LQ\docs\ai-integration.md`, `docs/manuscript-safety.md`.

### Project rules directory

- `c:\Dev\LQ\.cursor\rules\` — **empty** (no additional machine-enforceable rules beyond workspace docs).

---

## Metadata

**Research date:** 2026-04-25  
**Valid until:** ~2026-05-25 (stable stack; revisit if VS Code LM API integration lands).  
**Confidence:** HIGH for code map and metadata alignment; MEDIUM for migration/backfill policy pending planner answers.

## RESEARCH COMPLETE
