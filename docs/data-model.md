# Data model & file layout

All LeanQuill state lives in `.leanquill/` and configured note directories as version-controlled files. No database, no binary blobs, no cloud sync.

## `.leanquill/` directory

| File | Format | Purpose |
|------|--------|---------|
| `project.yaml` | YAML | Project identity, folder paths, AI policy, issue tracking config |
| `outline-index.json` | JSON | Hierarchical outline tree (source of truth for structure) |
| `themes.yaml` | YAML | Central question, synopsis, book custom fields, per-theme data |
| `chapter-order.json` | JSON | Cached chapter order resolved from `Book.txt` |
| `workflows/research.md` | Markdown | Canonical research workflow instructions |
| `chats/` | Directory | AI chat session logs (timestamped) |
| `personas/` | Directory | AI persona profiles |

## `project.yaml` schema

```yaml
schema_version: 2
project_id: "uuid"
working_title: "My Book"
genre: "fiction"

folders:
  manuscript: "manuscript"
  characters: "notes/characters"
  threads: "notes/threads"
  settings: "notes/settings"
  timeline: "notes/timeline"
  research: "research/leanquill"
  tool_state: ".leanquill"

manuscript:
  file_pattern: "*.md"
  chapter_order_source: "Book.txt"

ai_policy:
  manuscript_write_blocked: true
```

## Outline node structure

Each node in `outline-index.json` has:

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier |
| `title` | string | Display title |
| `fileName` | string | Path to manuscript file (e.g., `manuscript/ch1.md`) |
| `active` | boolean | Whether included in `Book.txt` compilation |
| `status` | string | Writing status (e.g., Draft, Revised, Final) |
| `description` | string | Synopsis / beat description |
| `customFields` | object | Arbitrary key-value metadata |
| `traits` | string[] | Node traits (e.g., `part` for part-level nodes) |
| `children` | OutlineNode[] | Nested child nodes |

## Character profiles

Stored as individual markdown files under the configured characters folder (default: `notes/characters/`):

```markdown
---
name: "Detective Harper"
aliases:
  - "Harper"
  - "Det. Harper"
role: "protagonist"
referencedByNameIn:
  - "manuscript/ch1.md"
  - "manuscript/ch3.md"
---

Free-form character notes, backstory, and development arcs...
```

## Thread profiles

Stored as individual markdown files under the configured threads folder (default: `notes/threads/`):

```markdown
---
name: "The Missing Witness"
touchesChapters:
  - "manuscript/ch2.md"
  - "manuscript/ch5.md"
---

Thread notes and arc planning...
```

---

[← Back to README](../README.md)
