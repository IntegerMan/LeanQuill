# Project Configuration Schema

Stored at: `{book-repo}/.leanquill/project.yaml`

One file per book repository. Defines tool behavior, folder conventions, and active persona profiles.

---

## Schema Definition

```yaml
# project-config-schema v1
schema_version: "1"

# ── Identity ──────────────────────────────────────────
project_id: string           # kebab-case, unique per machine (e.g. "deep-water-silence")
working_title: string        # Human-readable working title
genre: string[]              # e.g. ["technothriller", "mystery"]
target_audience: string      # brief statement of intended readership

# ── Folder Layout (relative to repo root) ─────────────
folders:
  manuscript: manuscript/    # chapters live here — tool NEVER writes here
  characters: notes/characters/
  settings:   notes/settings/
  timeline:   notes/timeline/
  research:   notes/research/
  tool_state: .leanquill/    # all tool output lives here

# ── Manuscript Convention ─────────────────────────────
manuscript:
  file_pattern: "ch*.md"           # glob to identify chapter files
  chapter_order_source: "Book.txt" # optional LeanPub manifest, or "alpha" to sort alphabetically
  front_matter_field_for_title: "title"  # YAML frontmatter key containing chapter title

# ── Active Personas ───────────────────────────────────
active_personas:
  - id: string        # references persona file in .leanquill/personas/
    enabled: boolean

# ── AI Behavior Policy ────────────────────────────────
ai_policy:
  manuscript_write_blocked: true   # must always be true; tool enforces this
  git_operations_blocked: true     # agents must not run git commands
  default_context_scope: chapter   # chapter | manuscript | project
  # Reader agents receive sequential context only — no future chapter access
  sequential_reader_boundary: strict

# ── Issue Tracking ────────────────────────────────────
issue_tracking:
  consolidation_auto: false        # if true, consolidator agent runs on tool open
  default_view_filter: open        # open | all | deferred
```

---

## Sample Instance — "Deep Water Silence" (Yacht Thriller)

```yaml
schema_version: "1"

project_id: deep-water-silence
working_title: Deep Water Silence
genre:
  - technothriller
  - mystery
target_audience: >
  Adult readers who enjoy near-future techno-thrillers with
  maritime settings and geopolitical intrigue.

folders:
  manuscript: manuscript/
  characters: notes/characters/
  settings:   notes/settings/
  timeline:   notes/timeline/
  research:   notes/research/
  tool_state: .leanquill/

manuscript:
  file_pattern: "ch*.md"
  chapter_order_source: "Book.txt"
  front_matter_field_for_title: "title"

active_personas:
  - id: casual-thriller-fan
    enabled: true
  - id: avid-mystery-reader
    enabled: true
  - id: maritime-expert
    enabled: true
  - id: oceanography-specialist
    enabled: false   # enable when writing nodule retrieval chapters
  - id: geopolitics-analyst
    enabled: false   # enable when writing ISA governance scenes

ai_policy:
  manuscript_write_blocked: true
  git_operations_blocked: true
  default_context_scope: chapter
  sequential_reader_boundary: strict

issue_tracking:
  consolidation_auto: false
  default_view_filter: open
```
