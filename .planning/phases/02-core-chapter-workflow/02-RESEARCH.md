# Phase 2: Core Chapter Workflow — Research

**Phase:** 02-core-chapter-workflow
**Researched:** 2026-03-29
**Status:** Complete

---

## Standard Stack

**Runtime:** VS Code Extension API (TypeScript), esbuild bundler, `vscode ^1.90.0`
**No new npm dependencies required** for this phase. All capabilities are available via the VS Code Extension API.

---

## Architecture Patterns

### Pattern 1: Chapter Tree — `TreeDataProvider<ChapterTreeItem>`

The chapter sidebar list is a native VS Code tree view registered via `vscode.window.registerTreeDataProvider`. The provider implements `vscode.TreeDataProvider<ChapterTreeItem>` with:

- `getTreeItem(element)` → `vscode.TreeItem`
- `getChildren(element?)` → `ChapterTreeItem[]`
- `onDidChangeTreeData` → `EventEmitter` for refreshes

**Tree view registration** in `package.json`:
```json
"views": {
  "leanquill": [
    { "id": "leanquill.chapters", "name": "Chapters", "type": "tree" }
  ]
}
```

**Two-tier tree for "Not Included" group (D-16):**
```
getChildren(undefined) → [chapterA, chapterB, ..., notIncludedGroup]
getChildren(notIncludedGroup) → [orphanC, orphanD]
```
`NotIncludedGroupItem` has `collapsibleState: Collapsed`. Chapter items have `collapsibleState: None` (leaf nodes).

**TreeItem shape per chapter:**
```typescript
const item = new vscode.TreeItem(title);
item.description = status;           // shown after label in muted text
item.tooltip = `${title}\n${chapterPath}\nStatus: ${status}`;
item.iconPath = statusThemeIcon(status);  // codicon mapped from status
item.contextValue = fileExists ? 'chapter' : 'chapter-missing';
item.command = fileExists ? {
  command: 'vscode.open',
  title: 'Open',
  arguments: [vscode.Uri.file(absPath), { preview: true }]
} : undefined;
```

**Single-click preview / double-click pin (D-06):**
Setting `command` to `vscode.open` with `{ preview: true }` matches VS Code File Explorer native behavior. VS Code automatically pins the tab when the user double-clicks (or edits). No custom timer logic needed.

**Issue count in label (D-05):**
The `description` field is limited to a short string. The conventional approach is to append the count to the label when non-zero, or put it in `description`:
```typescript
item.label = title;
item.description = `${status}  · ${openIssueCount > 0 ? `${openIssueCount} issue${openIssueCount > 1 ? 's' : ''}` : ''}`;
```
In Phase 2, `openIssueCount` is always `0` per D-14 (issues pending integration).

**Status codicons mapping:**
```typescript
const STATUS_ICONS: Record<ChapterStatus, string> = {
  'planning':        'circle-outline',
  'not-started':     'dash',
  'drafting':        'edit',
  'draft-complete':  'pass',
  'editing':         'pencil',
  'review-pending':  'clock',
  'final':           'verified',
};
```

**Missing file placeholder (D-13):**
```typescript
item.iconPath = new vscode.ThemeIcon('warning');
item.contextValue = 'chapter-missing';
// no command — file doesn't exist
```

---

### Pattern 2: Chapter Context Pane — `WebviewViewProvider`

The Chapter Context Pane is a **webview view** (sidebar panel with custom HTML), not a second tree. This matches CHAP-04's requirement to show status, issues count, and eventually notes.

**Registration:**
```typescript
vscode.window.registerWebviewViewProvider('leanquill.chapterContext', provider, {
  webviewOptions: { retainContextWhenHidden: true }
});
```
`retainContextWhenHidden: true` prevents the webview from being destroyed when the user switches sidebar panels — important for smooth UX.

**View in `package.json`:**
```json
"views": {
  "leanquill": [
    { "id": "leanquill.chapters", "name": "Chapters", "type": "tree" },
    { "id": "leanquill.chapterContext", "name": "Chapter Context", "type": "webview" }
  ]
}
```

**Provider class shape:**
```typescript
class ChapterContextPaneProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;
  private _currentChapterPath?: string;

  resolveWebviewView(webviewView: vscode.WebviewView) {
    webviewView.webview.options = { enableScripts: false }; // no scripts needed for Phase 2
    this._view = webviewView;
    this._update();
  }

  setActiveChapter(chapterPath: string, entry: ChapterStatusEntry | undefined) {
    this._currentChapterPath = chapterPath;
    this._currentEntry = entry;
    this._update();
  }

  private _update() {
    if (!this._view) return;
    this._view.webview.html = this._buildHtml();
  }
}
```

**CSP (security requirement, never omit):**
```html
<meta http-equiv="Content-Security-Policy"
  content="default-src 'none'; style-src 'unsafe-inline';">
```
Phase 2 uses no external resources and no scripts, so `'unsafe-inline'` styles only. No nonce needed when `enableScripts: false`.

**HTML content for Phase 2 (D-09, D-11, D-15):**
- Status + open issues shown, notes section omitted (D-15)
- When no active chapter or file is not a known chapter: keep showing last chapter context (D-11)
- Empty state (before any chapter activated): "No chapter active — open a chapter file to see its context."

---

### Pattern 3: Auto-refresh Triggers (D-10)

```typescript
// Trigger 1: active editor changes
vscode.window.onDidChangeActiveTextEditor(editor => {
  if (!editor) return;
  const fsPath = editor.document.uri.fsPath;
  const chapterPath = findChapterPathForFile(fsPath, chapterOrderResult);
  if (chapterPath) {
    const entry = statusIndex.chapters[chapterPath];
    contextPaneProvider.setActiveChapter(chapterPath, entry);
    chapterTreeProvider.setActiveChapter(chapterPath); // optional: highlight
  }
  // D-11: if not a chapter, do NOT clear pane — keep last value
}, null, context.subscriptions);

// Trigger 2: after status update command completes
// The updateChapterStatus command calls chapterTreeProvider.refresh()
// and contextPaneProvider.setActiveChapter() at the end of its execution
```

---

### Pattern 4: Chapter Status Storage (D-02)

**File location:** `.leanquill/chapter-status-index.json`

**Schema (Phase 2 — simplified from data contract):**
```typescript
interface ChapterStatusIndex {
  schemaVersion: "1";
  chapters: Record<string, ChapterStatusEntry>;  // key = relative chapterPath e.g. "manuscript/ch01.md"
}

interface ChapterStatusEntry {
  chapterId: string;       // derived from path stem, e.g. "ch-001"
  title: string;           // chapter display title
  status: ChapterStatus;
  openIssueCount: number;  // always 0 in Phase 2 (D-14)
  updatedAt: string;       // ISO datetime
}

type ChapterStatus =
  | "planning" | "not-started" | "drafting"
  | "draft-complete" | "editing" | "review-pending" | "final";
```

**Read path** (`fs.readFile` — no SafeFileSystem guard on reads):
```typescript
async function readChapterStatusIndex(rootPath: string): Promise<ChapterStatusIndex> {
  const indexPath = path.join(rootPath, '.leanquill', 'chapter-status-index.json');
  try {
    const raw = await fs.readFile(indexPath, 'utf8');
    return JSON.parse(raw) as ChapterStatusIndex;
  } catch {
    return { schemaVersion: "1", chapters: {} }; // default empty index
  }
}
```

**Write path** (via `SafeFileSystem` — enforces `.leanquill/**` guard):
```typescript
async function writeChapterStatus(
  safeFs: SafeFileSystem,
  rootPath: string,
  chapterPath: string,
  entry: ChapterStatusEntry,
  existing: ChapterStatusIndex
): Promise<void> {
  const updated: ChapterStatusIndex = {
    ...existing,
    chapters: { ...existing.chapters, [chapterPath]: entry }
  };
  const indexPath = path.join(rootPath, '.leanquill', 'chapter-status-index.json');
  await safeFs.writeFile(indexPath, JSON.stringify(updated, null, 2));
}
```

**Invalid status fallback (D-04):** Read function validates the `status` field against the known enum; on unknown value, replaces with `"not-started"` and emits a warning notification.

---

### Pattern 5: Context Menu + Quick Pick for Status Updates (D-07, D-12)

**package.json menus contribution:**
```json
"menus": {
  "view/item/context": [
    {
      "command": "leanquill.updateChapterStatus",
      "when": "view == leanquill.chapters && viewItem == chapter",
      "group": "leanquill@1"
    }
  ]
}
```

**Command registration:**
```json
"commands": [
  { "command": "leanquill.initialize", "title": "LeanQuill: Initialize" },
  { "command": "leanquill.updateChapterStatus", "title": "LeanQuill: Update Chapter Status" }
]
```

**Quick Pick implementation:**
```typescript
const CHAPTER_STATUSES: vscode.QuickPickItem[] = [
  { label: "$(circle-outline) planning",        description: "planning" },
  { label: "$(dash) not-started",               description: "not-started" },
  { label: "$(edit) drafting",                  description: "drafting" },
  { label: "$(pass) draft-complete",            description: "draft-complete" },
  { label: "$(pencil) editing",                 description: "editing" },
  { label: "$(clock) review-pending",           description: "review-pending" },
  { label: "$(verified) final",                 description: "final" },
];

async function runUpdateStatusFlow(chapterItem: ChapterTreeItem): Promise<void> {
  const pick = await vscode.window.showQuickPick(CHAPTER_STATUSES, {
    placeHolder: `Set status for: ${chapterItem.label}`,
  });
  if (!pick || !pick.description) return;
  const newStatus = pick.description as ChapterStatus;
  // ... write to index, refresh tree, refresh pane
}
```

Same command works from tree context menu (receives `ChapterTreeItem`) and from context pane (requires knowing current chapter path — stored in provider state).

---

## Don't Hand-Roll

1. **TreeDataProvider** — use VS Code's native `vscode.TreeDataProvider`. No custom tree rendering.
2. **File watching** — use `vscode.workspace.createFileSystemWatcher` with `RelativePattern`, not polling.
3. **Status storage** — use plain JSON, not YAML or sqlite. Safe filesystem already established in Phase 1.
4. **Webview theming** — use CSS variables `var(--vscode-editor-foreground)` etc. for automatic dark/light mode compatibility. Do not hardcode colors.

---

## Common Pitfalls

1. **Webview dispose leak**: Must wire `webviewView.onDidDispose(() => { this._view = undefined; })` — otherwise refresh calls on a disposed view throw errors.
2. **Path normalization on Windows**: `chapter-order.json` paths use forward-slash (`manuscript/ch01.md`). `onDidChangeActiveTextEditor` provides `fsPath` with backslashes on Windows. Normalize before comparison: `editor.document.uri.fsPath.split('\\').join('/')`.
3. **Title extraction from chapter-order.json**: Phase 1 only stores paths, not titles. For Phase 2, derive title by: (1) reading `title:` frontmatter field from manuscript file, (2) falling back to filename stem.
4. **SafeFileSystem scope check**: The Phase 1 `SafeFileSystem.canWrite()` checks `rel === '.leanquill' || rel.startsWith('.leanquill' + path.sep)`. On Windows `path.sep` is `\\`. Feeds into write paths correctly — no change needed.
5. **TreeView `when` clause activation**: The `leanquill.isInitialized` context key (set in Phase 1) should gate the chapter tree view — show the tree only after initialization. Use `"when": "leanquill.isInitialized"` in the view contribution.
6. **retainContextWhenHidden**: Set `true` on the webview view to avoid destroying state when user opens another sidebar panel. Without this, context pane blanks out unexpectedly.

---

## Integration Points

| Consumer | Depends On | How |
|----------|-----------|-----|
| `ChapterTreeProvider` | `resolveChapterOrder()` (Phase 1) | Reads `chapter-order.json` on init and after file watcher fires |
| `ChapterTreeProvider` | `ChapterStatusIndex` | Reads status for each chapter path |
| `ChapterContextPaneProvider` | `ChapterStatusIndex` | Reads entry for active chapter |
| `extension.ts` | Both providers | Registers + wires `onDidChangeActiveTextEditor` |
| Status write command | `SafeFileSystem` (Phase 1) | Writes `chapter-status-index.json` via existing safe boundary |

---

## File Plan

| New File | Purpose |
|---------|---------|
| `src/chapterStatus.ts` | Types + read/write for `chapter-status-index.json` |
| `src/chapterTree.ts` | `ChapterTreeProvider` (TreeDataProvider) |
| `src/chapterContextPane.ts` | `ChapterContextPaneProvider` (WebviewViewProvider) |

| Modified File | Change |
|--------------|--------|
| `src/types.ts` | Add `ChapterStatus`, `ChapterStatusEntry`, `ChapterStatusIndex` types |
| `src/extension.ts` | Register tree + pane providers, status command, `onDidChangeActiveTextEditor` |
| `package.json` | New view IDs, commands, menus, context-menu `when` clauses |

---

## Validation Architecture

> Nyquist validation strategy for Phase 2. Commands run after each task wave.

**Framework:** `node --test` (built-in Node.js test runner, already in use)
**Build command:** `npm run build && npm run build:test`
**Unit test run:** `npm test`
**Estimated runtime:** ~3 seconds

### Automated Test Coverage

| Behavior | Automated Check | Command |
|----------|----------------|---------|
| Status types compile | TypeScript build passes | `npm run build` |
| Status read — empty index returns defaults | Unit test | `npm test` |
| Status read — invalid status coerces to not-started + warns | Unit test | `npm test` |
| Status write — persists to index file | Unit test | `npm test` |
| Tree items match chapter order | Unit test | `npm test` |
| Tree includes Not Included group | Unit test | `npm test` |
| updateChapterStatus command present in bundle | Grep build artifact | `grep -r "updateChapterStatus" dist/extension.js` |
| CSP present in webview HTML | Grep source | `grep -r "Content-Security-Policy" src/chapterContextPane.ts` |
| chapter context view registered in bundle | Grep build artifact | `grep -r "leanquill.chapterContext" dist/extension.js` |

### Manual-Only Verifications

| Behavior | Requirement | Why Manual |
|----------|-------------|------------|
| Single-click previews chapter in editor | CHAP-02 | VS Code tab behavior requires live editor |
| Double-click pins preview tab | CHAP-02 (D-06) | VS Code tab pinning is UI-only |
| Context pane refreshes on file switch | CHAP-04 | Requires active editor event in running extension |
| Context menu appears on right-click | CHAP-03 | Requires running extension host |
| Quick pick shows all 7 statuses | CHAP-03 | Requires running extension host |
| Status change reflected immediately in tree | CHAP-03 (D-10) | Requires live extension + file system |

---

## RESEARCH COMPLETE

Phase 2 research finished. Key findings:
- No new npm dependencies required
- Two new providers: `ChapterTreeProvider` (tree) + `ChapterContextPaneProvider` (webview)
- One new module: `chapterStatus.ts` for status persistence  
- Three files modified: `types.ts`, `extension.ts`, `package.json`
- Title extraction from frontmatter is a pitfall — needs `front_matter_field_for_title` from `project.yaml`
- Windows path normalization needed in active-editor comparisons
