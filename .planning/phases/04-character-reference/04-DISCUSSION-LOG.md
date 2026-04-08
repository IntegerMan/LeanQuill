# Phase 4: Character Reference - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-07
**Phase:** 4-Character Reference
**Areas discussed:** Data model & storage, Character-to-story linking, Characters tab layout & editing, Character organization

---

## Data Model & Storage

### Where should character data live?

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated character-index.json in .leanquill/ | Separate file like outline-index.json and chapter-status-index.json — follows the established one-index-per-domain pattern | |
| Inline in outline-index.json | Characters stored alongside outline nodes — keeps everything in one file but couples domains | |
| Individual markdown files in notes/characters/ | One .md file per character with YAML frontmatter — author-visible and git-diffable, but slower to query | ✓ |

**User's choice:** Individual markdown files in notes/characters/
**Notes:** Author preferred git-diffable, human-readable character files over internal JSON indexes.

### How should character profile fields be structured?

| Option | Description | Selected |
|--------|-------------|----------|
| Template defaults + author-defined fields | Provide a starter set (name, aliases, role, description) that the author can extend with custom key-value fields | ✓ |
| Fully freeform fields only | Author creates all fields from scratch — maximum flexibility, no assumptions | |
| Fixed schema | Fixed schema (name, age, role, appearance, backstory, etc.) with no custom extension | |

**User's choice:** Template defaults + author-defined fields
**Notes:** Mirrors the beat customFields pattern from Phase 3.

### Should the extension maintain a JSON index for fast lookups?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — JSON index as cache, .md files as source of truth | A lightweight character-index.json caches name, id, file path, and tags for fast rendering | |
| No index — always parse from filesystem | Scan the characters folder every time the tab renders — simpler but potentially slower | ✓ |

**User's choice:** No index — always parse from filesystem
**Notes:** User chose simplicity over performance optimization. Can be revisited if performance becomes an issue.

---

## Character-to-Story Linking

### How should characters get associated with chapters and beats?

| Option | Description | Selected |
|--------|-------------|----------|
| Manual tagging via outline node fields | Authors tag characters in outline node 'who' fields or 'traits' | |
| Explicit link UI in Characters tab | Characters tab has 'Link to chapter/beat' UI that creates bidirectional references | |
| Auto-detection from manuscript text | Extension scans manuscript text for character name mentions and builds associations automatically | |

**User's choice:** Other (free text)
**Notes:** User described a specific approach: Store associations in character file frontmatter as a `referencedByNameIn` field (array of file paths). On manuscript file save/open, scan all characters for name/alias matches and update the field. No separate mapping file needed.

### Which files should be scanned for character name mentions?

| Option | Description | Selected |
|--------|-------------|----------|
| Manuscript files only | Only scan files inside the configured manuscript folder | ✓ |
| Manuscript + planning content | Scan manuscript files plus planning node files | |
| All markdown files | Scan all .md files in the project | |

**User's choice:** Manuscript files only
**Notes:** None

### How should character names be matched in manuscript text?

| Option | Description | Selected |
|--------|-------------|----------|
| Exact name/alias match (case-insensitive) | Simple substring/word-boundary match against name + aliases | ✓ |
| Pattern-based matching | Use regex patterns per character for flexible matching | |

**User's choice:** Exact name/alias match (case-insensitive)
**Notes:** None

---

## Characters Tab Layout & Editing

### How should the Characters tab present profiles?

| Option | Description | Selected |
|--------|-------------|----------|
| List/detail split | Left sidebar list of character names, clicking one shows full profile in the main area | ✓ |
| Card grid | Card grid like the Cards tab — shows all characters at a glance | |
| Full-page editor | Full single-character view with prev/next navigation | |

**User's choice:** List/detail split
**Notes:** None

### How should character editing work?

| Option | Description | Selected |
|--------|-------------|----------|
| Read-only detail + Open in Editor | Detail pane shows rendered view with 'Open in Editor' button | |
| Inline webview editing | Inline editing directly in the webview detail pane with live save | ✓ |
| Hybrid | Quick inline edits for short fields, Open in Editor for long | |

**User's choice:** Inline webview editing
**Notes:** Departs slightly from Phase 3 beat editing pattern (which used hybrid). User wants full inline control.

### How should authors add custom fields?

| Option | Description | Selected |
|--------|-------------|----------|
| Add Field button in detail pane | Adds a new key-value row — mirrors beat customFields pattern | ✓ |
| Edit frontmatter manually | Author edits frontmatter directly in the .md file | |

**User's choice:** Add Field button in detail pane
**Notes:** None

### How should authors create a new character?

| Option | Description | Selected |
|--------|-------------|----------|
| Button in tab + template file | '+ New Character' button creates a new .md file with template frontmatter | |
| Command palette | Command palette command only | |
| Both | Both button and command | ✓ |

**User's choice:** Both (button in tab + command palette)
**Notes:** None

---

## Character Organization

### How should characters be organized in the list?

| Option | Description | Selected |
|--------|-------------|----------|
| Flat list, alphabetical | All characters in one flat list sorted alphabetically | |
| Grouped by role/category | Author assigns a 'role' field and the list groups by it | ✓ |
| Author-defined groups | Author creates custom groups/folders | |

**User's choice:** Grouped by role/category
**Notes:** None

### Should role categories be preset or author-defined?

| Option | Description | Selected |
|--------|-------------|----------|
| Default roles + author-extensible | Defaults (protagonist, antagonist, supporting, minor) that the author can extend | ✓ |
| Fully author-defined roles | Author defines all categories from scratch | |
| Fixed role set | Fixed set that cannot be changed | |

**User's choice:** Default roles + author-extensible
**Notes:** None

### Should the Characters tab have search/filtering?

| Option | Description | Selected |
|--------|-------------|----------|
| Filter/search box | Text filter at top of character list — filters by name/alias as you type | |
| No search (just browsing) | No search — just scroll the grouped list | ✓ |

**User's choice:** No search (just browsing)
**Notes:** None

### Can authors delete characters from the Characters tab?

| Option | Description | Selected |
|--------|-------------|----------|
| Delete with confirmation | Delete button with confirmation prompt — removes the .md file | ✓ |
| Manual file deletion only | No delete from UI — author manages files manually | |

**User's choice:** Delete with confirmation
**Notes:** None

---

## Agent's Discretion

- Debounce timing for manuscript scan events
- Frontmatter field ordering and template cosmetics
- Detail pane styling
- How `referencedByNameIn` entries are displayed in detail view
- Character file naming convention (slugification)
- "Add Field" interaction UX details

## Deferred Ideas

- Character relationship mapping (v1.5)
- Character timeline (v1.5)
- Auto-suggesting character names during manuscript writing
- Character conflict/goal tracking
- Cross-reference from Knowledge Pane (Phase 7)
- Part synopsis/notes fields (deferred from Phase 3)
