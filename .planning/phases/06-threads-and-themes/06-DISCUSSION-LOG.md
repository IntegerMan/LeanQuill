# Phase 6: Threads and Themes - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `06-CONTEXT.md`.

**Date:** 2026-04-09
**Phase:** 6 — Threads and Themes
**Discuss order:** Area 3 → 4 → 2 → 1 (user-specified)

---

## Session note

An initial context file was committed from **inferred** defaults before the user finished walking through areas. Subsequent messages replaced that intent. **`06-CONTEXT.md` was rewritten** to match the full discussion below.

---

## Area 3 — Taxonomy

**User intent**

- **Themes:** book-wide; underpinnings / central questions; possibly book-level metadata; may track to chapters/characters — later refined.
- **Threads:** more isolated (A/B/C plots); narrative strands across the book.
- **Flexibility:** match dynamic outline + character-style key/value patterns.

**Decisions**

- **Storage philosophy:** `.leanquill/` = metadata only; rich content in repo dirs (e.g. `notes/`), characters as precedent (md + frontmatter only in repo).
- **Themes:** hybrid — compact structured data in `.leanquill` + linked markdown under `notes/`.
- **UI:** **two entry points** — **Themes** tab (structured literary fields) vs **Threads** tab (individual threads + chapter presence).
- **Book-wide:** not “implicit everywhere” vs “must link”; structured **key/value and slots** at book level.
- **Clarification:** theme metadata in **dedicated file** `.leanquill/themes.yaml` (not `project.yaml`).

---

## Area 4 — UX

| Topic | Choice |
|-------|--------|
| Tab placement | **Early / book-level** — **Themes** before Characters, Places, Threads; concrete order: Outline → Cards → **Themes** → Characters → Places → Threads |
| Themes layout | **Single scrollable form**; includes **central question**, **book synopsis**, **book-level custom KVs**, **central themes (0…N)** |
| Threads layout | **Match Characters** (list/detail, inline edit) |
| Create flows | **Header + command palette** for **New Theme** and **New Thread** |

---

## Area 2 — Storage

| Topic | Choice |
|-------|--------|
| Thread files | **Yes** — one `.md` per thread, `folders.threads` / default `notes/threads/`, characters-style |
| Theme longform | Under **`notes/`** (paths in `themes.yaml`) |
| Book-level fields | **Single file** `.leanquill/themes.yaml` for all book theme framing + custom KVs |

---

## Area 1 — Linking

| Topic | Choice |
|-------|--------|
| Thread→chapter | **A.1** — author-maintained frontmatter list + UI chapter picker from outline/order |
| Outline granularity | **B.1** — **chapters only** (manuscript file nodes) |
| Theme links v1 | **C.3** — **chapters only** (optional); **no** theme→character links in v1 |

---

## Claude's Discretion (summary)

YAML structure for `themes.yaml`, thread list grouping, picker control style, filenames, styling.
