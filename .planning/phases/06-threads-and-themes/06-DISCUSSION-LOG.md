# Phase 6: Threads and Themes - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `06-CONTEXT.md`.

**Date:** 2026-04-09
**Phase:** 6 — Threads and Themes
**Areas discussed (user order):** Thread vs theme taxonomy, Threads tab UX, Storage and project config, Linking to story structure

---

## Area 3 — Thread vs theme taxonomy

| Option | Description | Selected |
|--------|-------------|----------|
| Single type + `kind` field | One markdown profile type; subplot/theme/motif distinguished by string `kind` | ✓ |
| Separate “theme” vs “thread” record types | Two schemas or folders | |
| Only “threads” label, tags only | No structured kind | |

**User's choice:** Discuss area 3 first; aligned with **single profile type + `kind`** with datalist defaults and freeform values (mirrors character role pattern).

**Notes:** User did not request separate tabs or file taxonomies.

---

## Area 4 — Threads tab UX and organization

| Option | Description | Selected |
|--------|-------------|----------|
| Match Characters (list/detail, grouping, commands) | Consistent planning workspace | ✓ |
| Simplified single-column list | Lighter UI | |
| Rename tab “Threads & Themes” | Broader label | |

**User's choice:** **Match Characters** layout and flows; keep tab label **“Threads”** (themes live under same tab per taxonomy decision).

**Notes:** Group list by **`kind`**. Include + New control and command palette create; delete with confirmation; no search box (Characters parity).

---

## Area 2 — Storage and project config

| Option | Description | Selected |
|--------|-------------|----------|
| Mirror Characters | Per-file `.md` under `folders.threads`, no JSON index, SafeFileSystem allowlist | ✓ |
| Store threads only in `outline-index.json` | Central JSON | |
| Single rollup markdown file | One file for all threads | |

**User's choice:** **Mirror Characters** — dedicated folder (default `notes/threads/`), `folders.threads` in `project.yaml`, parse-on-render.

---

## Area 1 — Linking threads to the story

| Option | Description | Selected |
|--------|-------------|----------|
| Chapter paths only, author-maintained | Frontmatter list + UI picker; no beat granularity | ✓ |
| Character-style auto scan | Keywords/aliases in manuscript | |
| Beat/outline child node IDs | Fine-grained outline links | |

**User's choice:** **Chapter-level, author-maintained** linking. **Explicit product note:** **beats are no longer a thing** — no beat-level linking or UI.

**Notes:** Use a frontmatter array of manuscript-relative paths (e.g. `touchesChapters`), analogous to `referencedByNameIn` for characters. Defer automatic manuscript scanning for abstract threads.

---

## Claude's Discretion

- Filename/slug rules for new thread files
- Exact UI for editing `touchesChapters`
- Styling and debounce defaults

## Deferred Ideas

- Optional future keyword scanning for motifs
- Finer-than-chapter linking if outline model gains new primitives
- Updating REQUIREMENTS.md / ROADMAP wording away from “beats” for THREAD-01
