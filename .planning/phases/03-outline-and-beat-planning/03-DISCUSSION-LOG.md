# Phase 3: Outline and Beat Planning - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-30
**Phase:** 3-Outline and Beat Planning
**Areas discussed:** Outline data model & persistence, Webview architecture & interaction, Beat fields & candidate/committed workflow, Part grouping & chapter deactivation, Book.txt sync timing & format, Beat editor tab format, Sidebar outline tree depth & actions, Outline bootstrapping for existing projects, Save behavior & undo/redo, Card view visual design, Tab navigation UX, Beat document ↔ outline sync

---

## Outline Data Model & Persistence

| Option | Description | Selected |
|--------|-------------|----------|
| Single outline file (e.g. outline-index.json) | One JSON/YAML file under .leanquill/ holding the entire Parts → Chapters → Beats tree. Simple, atomic reads/writes, single source of truth. | ✓ |
| Per-chapter beat files | Each part or chapter gets its own beats file under .leanquill/outline/. More git-friendly diffs, but more file I/O and ordering gets complex. | |
| Inline in manuscript frontmatter | Beats are markdown sections inside manuscript files or notes with YAML frontmatter. Keeps beats close to prose, but couples outline to manuscript. | |

**User's choice:** Single outline file (outline-index.json)

| Option | Description | Selected |
|--------|-------------|----------|
| JSON | Consistent with chapter-status-index.json. Easy to parse, well-typed. | ✓ |
| YAML | Familiar to authors, readable diffs. | |
| Markdown with YAML frontmatter | Most author-friendly for viewing/editing outside the extension. | |

**User's choice:** JSON

| Option | Description | Selected |
|--------|-------------|----------|
| Outline references manuscript chapters (loose coupling) | Outline chapter entries reference manuscript file paths. Outline is the planning surface; Book.txt remains the publishing order source. | |
| Outline drives Book.txt (tight coupling) | Changes in the outline automatically rewrite Book.txt ordering. Single workflow, but risks accidental publishing-order changes. | ✓ |
| Fully independent (no manuscript link) | Outline is standalone — no link to manuscript files. Pure brainstorming tool. | |

**User's choice:** Outline drives Book.txt (tight coupling)

| Option | Description | Selected |
|--------|-------------|----------|
| One outline per project | One outline tree per book project. Simple, matches the single-project extension model. | ✓ |
| Multiple named outlines | Author can maintain multiple outlines (e.g., alternate plot structures, subplot breakdowns). | |

**User's choice:** One outline per project

---

## Webview Architecture & Interaction

| Option | Description | Selected |
|--------|-------------|----------|
| Editor panel webview | Full-size editor panel (like a document tab). | |
| Sidebar panel webview | Another sidebar panel next to the chapter context pane. | |
| Dual surface (sidebar + editor panel) | Both — sidebar for quick glance, editor panel for full interaction. | ✓ |

**User's choice:** Dual surface (sidebar + editor panel)

**View Modes:**
**User's choice (free text):** Multiple tabs/view modes — one for parts/chapters/beats cards, another for characters, another for places, another for threads/concepts/themes. Sidebar serves as a simple outline view with drag-and-drop and context menu commands.

**Follow-up scope clarification:**

| Option | Description | Selected |
|--------|-------------|----------|
| Phase 3 = outline cards only; other tabs later | Phase 3 builds the editor panel with beats/chapters/parts cards only. | |
| Phase 3 = full tabbed shell with outline + stubs | Phase 3 builds the full tabbed editor panel with all tab types, including stubs. | ✓ |

**User's choice (free text):** Full UI with stubs, but concerned Phase 4 requirements aren't detailed enough. Wants dedicated phases per major area (characters, places, threads/themes) after Phase 3.

| Option | Description | Selected |
|--------|-------------|----------|
| Cross-level + promote/demote | Drag items anywhere plus promote/demote. Maximum flexibility. | ✓ |
| Cross-level drag | Drag a beat from one chapter to another, or a chapter from one part to another. | |
| Same-level only | Drag items only within their containing level. | |

**User's choice:** Cross-level + promote/demote

**Messaging:**
**User's choice (free text):** No preference — deferred to agent recommendation. Agent selected postMessage (standard VS Code pattern).

---

## Beat Fields & Candidate/Committed Workflow

| Option | Description | Selected |
|--------|-------------|----------|
| PLAN-02 fields only (what/who/where/why) | Exactly the four fields from PLAN-02. | |
| Extended field set | Add fields for emotional tone, pacing notes, etc. | |
| Custom/freeform fields | Author defines their own fields per beat. Maximum flexibility. | ✓ |

**User's choice:** Custom/freeform fields

**Candidate/Committed:**
**User's choice (free text):** Each chapter can have multiple beats, so beats need binary toggle on/off.

| Option | Description | Selected |
|--------|-------------|----------|
| Inline editing in webview | Click a beat card or row to open an inline editing panel within the webview. | partial ✓ |
| Separate editor tab per beat | Click a beat to open a VS Code editor tab with the beat's data. | partial ✓ |

**User's choice (free text):** Hybrid — inline editing in the webview for quick changes, plus an "Open in Editor" button that opens a VS Code editor tab for detailed editing.

---

## Part Grouping & Chapter Deactivation

**Parts:**
**User's choice (free text):** Author creates parts; parts should influence markup in the generated document, just like chapters.

| Option | Description | Selected |
|--------|-------------|----------|
| Visual toggle (greyed/struck) + excluded from Book.txt sync | Toggle to grey out/strike through. Still visible but marked inactive. Excluded from Book.txt sync. | ✓ |
| Move to 'Inactive' section | Deactivated items move to a separate section. | |
| Hidden with filter toggle | Deactivated items are hidden entirely. | |

**User's choice:** Visual toggle (greyed/struck) + excluded from Book.txt sync

**Part metadata:**
**User's choice (free text):** Name only for now, with expectation that synopsis notes can be added to parts in a future phase.

---

## Book.txt Sync Timing & Format

| Option | Description | Selected |
|--------|-------------|----------|
| Live sync (every change) | Every outline change immediately updates Book.txt. | ✓ |
| Manual sync (explicit action) | Author explicitly triggers sync via a command or button. | |
| Sync on close/save | Sync on webview close or session end. | |

**User's choice:** Live sync (every change)

| Option | Description | Selected |
|--------|-------------|----------|
| LeanPub-native part: lines in Book.txt | LeanPub supports Part separators in Book.txt as `part:` lines. | ✓ |
| Comments in Book.txt (metadata only) | Write Part headings as comments. Informational only. | |
| Parts omitted from Book.txt | Don't represent Parts in Book.txt at all. | |

**User's choice:** LeanPub-native part: lines in Book.txt

| Option | Description | Selected |
|--------|-------------|----------|
| Outline wins (overwrite Book.txt) | Outline is authoritative — Book.txt is always overwritten on sync. | |
| Detect external edits and warn | If Book.txt was edited externally, warn the author and offer merge/overwrite. | ✓ |
| Bidirectional sync | Two-way sync — changes in Book.txt also update the outline. | |

**User's choice:** Detect external edits and warn

---

## Beat Editor Tab Format

| Option | Description | Selected |
|--------|-------------|----------|
| Custom editor with form UI | A VS Code CustomEditor showing a structured form. | |
| Virtual markdown document (YAML frontmatter + body) | Beat opens as a virtual markdown document. Familiar editing surface. | ✓ |
| Raw data file (JSON/YAML) | Opens a JSON/YAML file directly showing the beat's raw data. | |

**User's choice:** Virtual markdown document (YAML frontmatter + body)

| Option | Description | Selected |
|--------|-------------|----------|
| Add via UI (key-value pairs) | Author adds fields through the beat editor UI (e.g., 'Add Field' button). | ✓ |
| Project-level field schema | A project-level configuration defines available custom fields. | |
| Project defaults + per-beat ad-hoc | Both — project-level defaults plus per-beat ad-hoc fields. | |

**User's choice:** Add via UI (key-value pairs)

---

## Sidebar Outline Tree Depth & Actions

| Option | Description | Selected |
|--------|-------------|----------|
| Full depth (Parts → Chapters → Beats) | Author sees everything in the sidebar. | |
| Parts → Chapters only (beats in editor panel) | Beats only visible in the editor panel webview. | |
| Configurable depth | Author can choose how deep the sidebar tree goes. | ✓ |

**User's choice:** Configurable depth

| Option | Description | Selected |
|--------|-------------|----------|
| Standard set for all nodes | Add/remove child, rename, activate/deactivate, move up/down, open in editor. | ✓ |
| Type-specific context menus | Different actions per node type. | |
| Minimal (rename + delete only) | All other actions happen in the editor panel. | |

**User's choice:** Standard set for all nodes

| Option | Description | Selected |
|--------|-------------|----------|
| Native VS Code TreeView | Use the existing VS Code TreeView API. Native feel, consistent with Phase 2. | ✓ |
| Custom webview sidebar | Custom webview sidebar with its own tree rendering. | |

**User's choice:** Native VS Code TreeView

---

## Outline Bootstrapping

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-scaffold from existing chapters | Auto-scaffold from Book.txt/chapter order: one Part ("Book"), one Chapter per file, no beats. | ✓ |
| Empty outline (manual setup) | Start with a completely empty outline. | |
| Prompted import | Prompt the author: 'Import existing chapters into outline?' | |

**User's choice:** Auto-scaffold from existing chapters

| Option | Description | Selected |
|--------|-------------|----------|
| Start empty (expected for planning-first) | New outline starts empty. | ✓ |
| Template structure | New outline scaffolds a template structure (e.g., 3 Acts with placeholder chapters). | |

**User's choice:** Start empty

| Option | Description | Selected |
|--------|-------------|----------|
| On first open of outline view | Outline opens automatically when the author activates the outline view. | |
| Explicit command | Explicit command: 'LeanQuill: Create Outline' in command palette. | |
| Both (auto + command) | Auto-create on first open, but also available as explicit command. | ✓ |

**User's choice:** Both (auto + command)

---

## Save Behavior & Undo/Redo

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-save with debounce | Every change writes to outline-index.json with debounce to batch rapid edits. | ✓ |
| Explicit save only | Author explicitly saves via Ctrl+S or save button. | |
| Idle auto-save | Auto-save after a period of inactivity. | |

**User's choice:** Auto-save with debounce

| Option | Description | Selected |
|--------|-------------|----------|
| Webview-level undo/redo | Webview maintains its own undo/redo stack. | |
| No undo (git is the safety net) | No undo — rely on git history for reverting changes. | ✓ |
| VS Code-integrated undo | Full VS Code-integrated undo that crosses webview/editor boundaries. | |

**User's choice:** No undo (git is the safety net)

---

## Card View Visual Design

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed-size grid | Fixed-size cards in a uniform grid. Clean, predictable layout. | ✓ |
| Auto-sizing cards | Cards resize to fit content. | |
| Configurable card size | Author can resize cards or choose presets. | |

**User's choice:** Fixed-size grid

| Option | Description | Selected |
|--------|-------------|----------|
| Title + preview + status badge | Beat title, first line of description (truncated), active/inactive badge. | ✓ |
| Title only | Minimal, maximum density. | |
| Title + all field summaries | Full field summary: title, all custom fields shown as compact labels. | |

**User's choice:** Title + preview + status badge

| Option | Description | Selected |
|--------|-------------|----------|
| Greyed + strikethrough | Greyed out / reduced opacity card with strikethrough. Still visible in grid. | ✓ |
| Separate inactive section | Moved to a separate 'Inactive' section below the active grid. | |
| Hidden in card view | Hidden entirely in card view. | |

**User's choice:** Greyed + strikethrough

**Card grouping:**
**User's choice (free text):** Grouped by Part, then by Chapter. Option to choose grouping level or filter to a specific act/chapter.

---

## Tab Navigation UX

| Option | Description | Selected |
|--------|-------------|----------|
| Horizontal top tabs | Horizontal tab bar at top of the editor panel webview. | ✓ |
| Vertical icon sidebar | Left-side vertical icon strip. | |
| Dropdown view selector | Dropdown selector instead of visible tabs. | |

**User's choice:** Horizontal top tabs

| Option | Description | Selected |
|--------|-------------|----------|
| Placeholder message | Show tab with a message like 'Characters — coming in a future update'. | ✓ |
| Toast notification on click | Clicking shows a toast notification that the feature is upcoming. | |
| No stub tabs (add when ready) | Don't show stub tabs at all in Phase 3. | |

**User's choice:** Placeholder message

| Option | Description | Selected |
|--------|-------------|----------|
| Click only | No keyboard shortcuts for tab switching — click only. | ✓ |
| Numbered shortcuts | Ctrl+1/2/3/4 to switch tabs within the webview. | |

**User's choice:** Click only

---

## Beat Document ↔ Outline Sync

| Option | Description | Selected |
|--------|-------------|----------|
| YAML frontmatter = fields, body = freeform | YAML frontmatter has structured fields. Body is freeform notes. | ✓ |
| All fields in YAML frontmatter | Everything in YAML frontmatter, no freeform body. | |

**User's choice:** YAML frontmatter = fields, body = freeform

**Sync direction:**
**User's choice (free text):** JSON as source of truth, but the virtual markdown doc should only store minimal identifiers (beat ID, title) in YAML frontmatter — not all key-value fields. Custom fields stay exclusively in JSON/webview to avoid confusion about where "real" data lives.

| Option | Description | Selected |
|--------|-------------|----------|
| Standard VS Code dirty/save flow | VS Code shows the standard dirty indicator. Saving writes back to outline JSON. | ✓ |
| Immediate auto-sync (no dirty state) | Changes auto-sync back to JSON immediately. | |

**User's choice:** Standard VS Code dirty/save flow

---

## Agent's Discretion

- Debounce timing for auto-save and Book.txt sync
- postMessage protocol structure
- Card grid dimensions
- Configurable tree depth setting implementation
- Virtual markdown document filesystem provider details
- Styling/theming of cards and tabs

## Deferred Ideas

- Dedicated phases for Characters, Places, and Threads/Themes — insert after Phase 3 in roadmap
- Part synopsis/notes fields — add in future knowledge/notes phase
- Symlink/realpath hardening — still pending from Phase 1
