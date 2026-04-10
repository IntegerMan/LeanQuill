# LeanQuill

A VS Code extension for independent authors who write books in LeanPub-style markdown/git repositories. LeanQuill provides chapter-level project management, story intelligence organization (characters, settings, themes, threads, research), and AI-assisted editorial feedback — while enforcing strict manuscript immutability and keeping all project state local-first and git-native.

**AI may advise, never author.**

---

## Why LeanQuill

Authors working in LeanPub markdown repos lack the organizational tooling that apps like Scrivener provide. LeanQuill bridges that gap inside VS Code:

- See the status of every chapter at a glance
- Track and triage issues — both manually created and AI-detected
- Consult living story notes (characters, places, themes, threads, research)
- Never leave VS Code, and never worry about AI touching your manuscript

## Feature highlights

### Sidebar views

| View | Description |
|------|-------------|
| **Setup** | Welcome panel with initialization flow; detects existing manuscript markers |
| **Outline** | Scrivener-style hierarchical tree (Parts → Chapters → Beats) with drag-and-drop reordering, status icons, and context menus |
| **Context** | Selection-driven detail pane showing the selected node's status, traits, description, custom fields, and manuscript path |
| **Research** | Browse and create research documents; integrates with AI chat for research workflows |
| **Characters** | List and manage character profiles with automatic manuscript cross-referencing |

### Planning workspace

A tabbed editor panel with **Themes**, **Outline**, **Cards**, **Characters**, **Threads**, and **Places** (coming soon). Open it from the Outline view toolbar. Full tab descriptions: [docs/planning-workspace.md](docs/planning-workspace.md).

### Outline & story intelligence

- Hierarchical outline, drag-and-drop, status and active/inactive toggles, orphan detection, and automatic `Book.txt` sync — see [LeanPub integration](docs/leanpub-integration.md)
- Characters, themes, threads, and research as markdown + YAML in your repo — see [Data model](docs/data-model.md)

## Quick start

1. Open your book folder (with or without an existing `manuscript/`).
2. Click the LeanQuill activity bar icon and run **Initialize** when prompted.
3. Use **Outline** to structure chapters; open **Planning Workspace** for themes, cards, and characters.

**Full walkthrough:** [docs/getting-started.md](docs/getting-started.md)

## Documentation

| Doc | Contents |
|-----|----------|
| [Getting started](docs/getting-started.md) | Prerequisites, install, first-use steps |
| [Architecture](docs/architecture.md) | System diagram and key `src/` modules |
| [LeanPub integration](docs/leanpub-integration.md) | Repo layout, `Book.txt`, chapter order, publishing |
| [Planning workspace](docs/planning-workspace.md) | Themes, Outline, Cards, Characters, Threads, Places tabs |
| [Data model](docs/data-model.md) | `.leanquill/`, `project.yaml`, outline, characters, threads |
| [Manuscript safety](docs/manuscript-safety.md) | `SafeFileSystem` and write boundaries |
| [AI integration](docs/ai-integration.md) | VS Code LM API, philosophy, planned features |
| [Development](docs/development.md) | Build, project layout, tests |

## Design principles

| Principle | What it means |
|-----------|---------------|
| **Manuscript immutability** | AI and extension code never write to chapter files — enforced structurally, not by convention |
| **Local-first** | No cloud sync, no external database. All state in `.leanquill/` as git-tracked files |
| **Git-native** | Markdown + YAML + JSON state files are diffable, portable, and survive tool uninstall |
| **Human resolution** | AI may classify and suggest; only the author opens, closes, or acts on recommendations |
| **Organizer independence** | Hierarchy, status, and reference views work fully with AI disabled or distrusted |
| **Context scoping** | Review agents receive manuscript-scoped context only; future chapters are never leaked to reader agents |
| **VS Code native** | Uses VS Code APIs exclusively — no external HTTP calls to AI providers |

---

*LeanQuill is in active development. Track 1 (Author Workflow) delivers standalone value; Track 2 (AI Reviews) layers on top.*
