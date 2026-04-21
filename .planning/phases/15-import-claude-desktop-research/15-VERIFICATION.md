---
phase: 15
slug: import-claude-desktop-research
status: draft
created: 2026-04-11
---

# Phase 15 verification — Import Claude Desktop research

Checklist for automated checks, static review, and manual UAT across chat hosts. Traceability: **D-01**–**D-03** (chat open / no auto-send / attachments), **D-06**–**D-12** (workflow, normalization, frontmatter, save path, collisions).

## Automated

- `npm run build`
- `npm run build:test`
- `npm test`

## Static grep checks

- `leanquill.startImportResearch` appears in `package.json` (`contributes.commands`, `activationEvents`, `menus`) and in `src/extension.ts` (`registerCommand`).
- `import-external-research.md` and `RESEARCH_IMPORT_WORKFLOW_CONTENT` appear in `src/initialize.ts` (init writes `.leanquill/workflows/import-external-research.md`).

## Manual UAT matrix

| Host | Steps | Pass criteria |
|------|--------|----------------|
| **Cursor** | Open Research view → Import (title) or run **LeanQuill: Import External Research** | Chat opens with a **prefilled** starter (`@leanquill-import-research `); message is **not** auto-sent (**D-01**, **D-02**). User can paste or attach source per **D-03**. Agent follows `.leanquill/workflows/import-external-research.md` (**D-06**). Saved note under `folders.research` with Phase 12 frontmatter; **`created`** per **D-08**, **`sources`** per **D-09**, **`query`** per **D-10**; unmapped content in Summary / **Imported content** (**D-07**, **D-11**). Two imports same day same slug → **distinct** filenames, **no overwrite** (**D-12**). |
| **VS Code + Copilot Chat** | Same commands / Research view buttons | Same as Cursor (draft prefix may differ for non-Copilot; with Copilot extension, expect `@leanquill-import-research `). **D-01**–**D-12** as above. |
| **Claude Code** | Use harness file from `.claude/agents/leanquill-import-research.md` (or `/agent:leanquill-import-research`) | Reads **import-external-research** workflow (**D-06**); output shape and collision rules **D-07**–**D-12**; save path **`folders.research`** (**D-11**). |

## Checkbox walkthrough

- [ ] **D-01** — Import path opens chat with visible starter text (no silent failure).
- [ ] **D-02** — Chat does **not** auto-send; user explicitly sends.
- [ ] **D-03** — User can attach files or paste long excerpts where the host allows.
- [ ] **D-06** — Import agent reads `.leanquill/workflows/import-external-research.md` (not a stale filename).
- [ ] **D-07** — Output uses research note shape; extra material under Summary or `### Imported content`.
- [ ] **D-08** — Frontmatter `created` is import-time ISO unless a trustworthy source date exists.
- [ ] **D-09** — `sources` lists URLs when known, else `[]`.
- [ ] **D-10** — `query` reflects user topic or inferred text, or placeholder `(import — topic to be confirmed)`.
- [ ] **D-11** — File written under `folders.research` from `project.yaml`, or user instructed to save there.
- [ ] **D-12** — Collision on `{slug}-{date}.md` resolved with a new filename, not overwrite.
- [ ] **Research rename** — New Research chat uses `@leanquill-researcher ` (Cursor/Copilot) per **D-05** alignment.

## Sign-off

- [ ] Reviewer name / date: _________________________
