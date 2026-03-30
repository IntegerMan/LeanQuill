# Phase 3: Outline and Beat Planning — Research

**Researched:** 2026-03-30
**Discovery Level:** 2 (Standard Research)
**Status:** Complete

## Standard Stack

| Concern | Technology | Status |
|---------|-----------|--------|
| Sidebar tree | VS Code `TreeDataProvider` + `TreeDragAndDropController` | Native API, no deps |
| Editor panel webview | VS Code `WebviewPanel` (`createWebviewPanel`) | Native API, no deps |
| Webview ↔ host messaging | `postMessage` / `onDidReceiveMessage` | Native API |
| JSON persistence | Node `fs` via `vscode.workspace.fs` | Existing pattern |
| Virtual beat documents | `FileSystemProvider` or `.leanquill/beats/*.md` temp files | Native API |

No new external dependencies required. Everything uses VS Code built-in APIs.

## Architecture Patterns

### 1. WebviewPanel for Planning Workspace (D-05, D-06)

The planning workspace uses `vscode.window.createWebviewPanel()` — a full editor-area panel (not a sidebar `WebviewViewProvider`).

```typescript
const panel = vscode.window.createWebviewPanel(
  'leanquill.planningWorkspace',  // viewType
  'Planning Workspace',           // title
  vscode.ViewColumn.One,          // show in editor area
  {
    enableScripts: true,           // D-09: postMessage requires scripts
    retainContextWhenHidden: true, // preserve state when tab loses focus
    localResourceRoots: [extensionUri]
  }
);
```

**Key differences from Phase 2 sidebar webview:**
- `enableScripts: true` (Phase 2 context pane had scripts disabled)
- CSP must include `script-src` with nonce + `${webview.cspSource}`
- Full `postMessage`/`onDidReceiveMessage` bidirectional protocol
- Uses editor column space, not sidebar

**State persistence:** In-webview state via `acquireVsCodeApi().setState()`/`getState()`. Cross-restart persistence via `WebviewPanelSerializer` (register in `package.json` `contributes.webviewPanelSerializers`).

### 2. TreeView with Drag-and-Drop (D-11, D-14, D-08)

The sidebar outline tree extends the Phase 2 `TreeDataProvider` pattern with `TreeDragAndDropController`.

```typescript
const treeView = vscode.window.createTreeView('leanquill.outlineTree', {
  treeDataProvider: outlineTreeProvider,
  dragAndDropController: outlineDragDropController,
  showCollapseAll: true,
  canSelectMany: true
});
```

**TreeDragAndDropController API:**
```typescript
interface TreeDragAndDropController<T> {
  dragMimeTypes: readonly string[];   // MIME types handleDrag adds
  dropMimeTypes: readonly string[];   // MIME types accepted on drop
  handleDrag(source: T[], dataTransfer: DataTransfer, token: CancellationToken): void;
  handleDrop(target: T | undefined, dataTransfer: DataTransfer, token: CancellationToken): void;
}
```

- `handleDrag`: Serialize dragged node IDs into `DataTransfer` using a custom MIME type (e.g., `application/vnd.code.tree.leanquill.outlineTree`)
- `handleDrop`: Deserialize, determine target position, update `outline-index.json`, fire `onDidChangeTreeData`
- Promote/demote (D-08): When dropping at a different tree depth — a beat dropped onto the chapter level becomes a chapter, etc. Determine new node type from drop target's depth.
- `dropMimeTypes` must include the custom MIME type to accept internal reordering

### 3. Beat Document Editing Strategy (D-17, D-18, D-19, D-20)

**Critical finding:** `TextDocumentContentProvider` creates READ-ONLY virtual documents. For writable beat documents (D-17, D-21), two viable approaches:

**Option A — FileSystemProvider (virtual filesystem):**
Register a custom `leanquill-beat://` scheme. Implements full `readFile`/`writeFile`/`stat`/`watch`. Save triggers write-back to `outline-index.json`. More complex but clean URI scheme.

**Option B — Real temp files in `.leanquill/beats/` (recommended):**
Write beat markdown to `.leanquill/beats/{beatId}.md`. Open as regular file with `vscode.window.showTextDocument()`. Watch for saves, parse content, sync description back to JSON. Simpler, uses existing SafeFileSystem boundary, survives extension restarts naturally.

**Recommendation: Option B.** Real files are simpler, already within SafeFileSystem boundary, and avoid the complexity of a full FileSystemProvider. The beat markdown format per D-18:

```markdown
---
beatId: "beat-abc123"
title: "The Discovery"
---

Long-form description and notes go here...
```

On save: parse YAML frontmatter to identify beat, extract body, write description back to `outline-index.json`.

### 4. PostMessage Protocol Design (D-09)

Bidirectional messaging between webview and extension host:

**Extension → Webview:**
```typescript
panel.webview.postMessage({ type: 'outline:update', payload: outlineData });
panel.webview.postMessage({ type: 'beat:updated', payload: { beatId, fields } });
```

**Webview → Extension:**
```typescript
// Inside webview script
vscode.postMessage({ type: 'beat:updateField', beatId, field, value });
vscode.postMessage({ type: 'outline:reorder', nodeId, newParentId, newIndex });
vscode.postMessage({ type: 'beat:openInEditor', beatId });
vscode.postMessage({ type: 'tab:switch', tabId });
```

**Extension listener:**
```typescript
panel.webview.onDidReceiveMessage(msg => {
  switch (msg.type) {
    case 'beat:updateField': /* update JSON, debounce save */ break;
    case 'outline:reorder': /* update tree order, sync Book.txt */ break;
    case 'beat:openInEditor': /* write temp md, open in editor */ break;
  }
});
```

### 5. Outline Data Model (D-01, D-02, D-03)

```typescript
interface OutlineIndex {
  schemaVersion: number;           // Forward compat (existing pattern)
  parts: OutlinePart[];
}

interface OutlinePart {
  id: string;
  name: string;
  active: boolean;                 // D-23: deactivation toggle
  chapters: OutlineChapter[];
}

interface OutlineChapter {
  id: string;
  name: string;
  fileName: string;                // Links to manuscript file
  active: boolean;
  beats: OutlineBeat[];
}

interface OutlineBeat {
  id: string;
  title: string;
  active: boolean;                 // D-16: binary toggle
  description: string;             // Markdown body
  what: string;                    // D-15: default field
  who: string;
  where: string;
  why: string;
  customFields: Record<string, string>;  // D-15: freeform fields
}
```

### 6. Book.txt Bidirectional Sync (D-25, D-26, D-27)

**Outline → Book.txt (D-25, D-26):**
- On outline change (reorder, add, remove, activate/deactivate), regenerate Book.txt
- Active parts emit `part: {name}` lines (LeanPub native format)
- Active chapters emit their filename
- Deactivated items excluded (D-23)
- Debounced write (300-500ms per agent discretion)

**Book.txt → Outline (D-27):**
- File watcher on `Book.txt`
- On external change, compare with expected state
- If different: warn author via `vscode.window.showWarningMessage` with "Merge" / "Overwrite" options
- "Overwrite" = regenerate Book.txt from outline
- "Merge" = update outline order to match Book.txt edits

### 7. Bootstrapping (D-34, D-35, D-36)

**Existing projects (D-34):**
1. Read chapter order from `chapter-order.json` / `Book.txt`
2. Create one Part ("Book") as container
3. Create one Chapter per existing manuscript file, ordered per Book.txt
4. No beats initially

**New projects (D-35):**
- Empty `outline-index.json` with `schemaVersion: 1` and empty `parts: []`

**Trigger (D-36):**
- Auto on first open of outline view (if no `outline-index.json` exists)
- Manual via `leanquill.createOutline` command

## Don't Hand-Roll

| Area | Use Instead | Why |
|------|------------|-----|
| Tree rendering | VS Code `TreeDataProvider` | Native performance, accessibility, theming |
| Drag-and-drop | `TreeDragAndDropController` + webview HTML5 DnD | Built-in, consistent UX |
| Panel lifecycle | `WebviewPanel` + `WebviewPanelSerializer` | Handles dispose/restore automatically |
| CSS theming | VS Code CSS variables (`--vscode-*`) | Auto light/dark/high-contrast |
| File watching | `vscode.workspace.createFileSystemWatcher` | Existing pattern from Phase 2 |
| Debouncing | Simple `setTimeout`/`clearTimeout` wrapper | No lodash needed for one utility |

## Common Pitfalls

1. **Forgetting `retainContextWhenHidden: true`** — Without this, webview state resets when tab loses focus. Critical for the planning workspace.
2. **CSP blocking scripts** — Must configure CSP with nonce for inline scripts. Use `webview.cspSource` for style/script sources.
3. **Drag-and-drop MIME types** — `dropMimeTypes` must exactly match what `handleDrag` puts into `DataTransfer`. Use `application/vnd.code.tree.{viewId}` convention.
4. **Book.txt write loops** — Outline change → writes Book.txt → file watcher fires → tries to update outline → writes Book.txt again. Need a "self-edit" flag to break the loop.
5. **Beat file sync race** — Author edits beat markdown while outline auto-saves. Need to handle concurrent modifications gracefully (last-write-wins with the JSON as authority per D-20).
6. **WebviewPanel dispose** — Must handle `onDidDispose` to clean up listeners. Don't keep references to disposed panels.
7. **postMessage before webview ready** — Queue messages until webview signals readiness (e.g., send a `'ready'` message from webview on load).

## Validation Strategy

### Automated Verification
- `npm run build` compiles without errors after each plan
- Unit tests for pure functions: `buildOutlineTree()`, `generateBookTxt()`, `parseOutlineIndex()`, `bootstrapOutline()`
- Integration test: create outline → add beat → save → verify JSON on disk

### Manual Verification
- Open planning workspace → verify tabs render
- Drag-and-drop in sidebar tree → verify reorder persists
- Edit beat in card view → verify field saves
- Open beat in editor → edit → save → verify JSON updated
- Deactivate chapter → verify Book.txt excludes it

## RESEARCH COMPLETE
