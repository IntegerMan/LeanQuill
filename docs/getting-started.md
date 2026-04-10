# Getting started

## Prerequisites

- **VS Code** 1.90 or later
- **Node.js** 18+ (for building from source)
- **Git** (LeanQuill projects are git repositories)
- **GitHub Copilot** or another VS Code Language Model API provider (optional — required only for AI features)

## Installation

### From source

```bash
git clone https://github.com/your-org/leanquill.git
cd leanquill
npm install
npm run build
```

Then press **F5** in VS Code to launch the Extension Development Host with LeanQuill loaded.

### From VSIX (local install)

```bash
npm run build
# Package with vsce if available:
npx @vscode/vsce package
code --install-extension leanquill-0.0.1.vsix
```

## First use

### 1. Open your book folder

Open a folder in VS Code that either already contains a `manuscript/` directory (LeanPub layout) or is an empty folder where you want to start a new book.

### 2. Initialize

Click the LeanQuill icon in the Activity Bar. If the workspace is not yet initialized, you will see a welcome panel:

- **No manuscript detected** — Click **Initialize Book** to create `project.yaml`, `manuscript/`, `.leanquill/`, and a starter chapter
- **Manuscript detected** — Click **Initialize or complete setup** to generate `project.yaml` and fill in any missing scaffolding

The initialization flow:

1. Prompts for book title and genre
2. Creates `.leanquill/project.yaml` with your project identity and folder configuration
3. Scaffolds `manuscript/Book.txt` and a starter chapter if they don't exist
4. Creates `.leanquill/` state directories (`chats/`, `personas/`, `workflows/`)
5. Writes AI harness entry points (`.cursor/skills/researcher/`, `.github/agents/`, `.claude/agents/`)
6. Bootstraps an outline from existing chapters

### 3. Build your outline

Use the **Outline** sidebar to organize your book:

- **Add nodes** — Use the `+` button or right-click context menu to add Parts, Chapters, or Beats
- **Drag and drop** — Rearrange the hierarchy by dragging nodes
- **Set status** — Right-click a node to update its status (e.g., Draft, Revised, Final)
- **Toggle active/inactive** — Mark chapters as active (included in `Book.txt`) or inactive (excluded from compilation)

### 4. Open the Planning Workspace

Click the notebook icon in the Outline view's title bar to open the full Planning Workspace in an editor tab. Use the tabs to manage Themes, view the Outline grid, arrange Cards on the corkboard, and manage Characters and Threads. See [Planning workspace](planning-workspace.md).

### 5. Track characters and research

- **Characters tab** — Create character profiles with names, aliases, descriptions, and notes. LeanQuill automatically scans your manuscript and links characters to the chapters where they appear.
- **Research view** — Browse research documents or start a new AI-assisted research session.

For LeanPub layout and `Book.txt` behavior, see [LeanPub integration](leanpub-integration.md).

---

[← Back to README](../README.md)
