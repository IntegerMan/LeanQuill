# Architecture Patterns — LeanQuill VS Code Extension

**Domain:** VS Code extension for LeanPub markdown book authoring  
**Researched:** 2026-03-29  
**Overall confidence:** HIGH (sourced from official VS Code docs + verified data contracts)

---

## Component Map

```
┌──────────────────────────── Extension Host ─────────────────────────────────────┐
│                                                                                  │
│  extension.ts (activate)                                                         │
│       │                                                                          │
│       ├─── ProjectLoader ──────────────────────────────────► .leanquill/         │
│       │         │ reads project.yaml, Book.txt                project.yaml       │
│       │         ▼                                             chapters/*.md      │
│       ├─── LeanQuillCache (in-memory)◄──── CacheInvalidator  issues/**/*.md     │
│       │         │                               │            personas/*.md       │
│       │         │     ┌─────────────────────────┘            chats/*.md         │
│       │         │     │  FileSystemWatcher (.leanquill/**)                       │
│       │         │     │                                                          │
│       │   ┌─────┴──── ┴──────────────────────────────────┐                      │
│       │   │  UI Layer                                     │                      │
│       │   │  ┌──────────────────────────────────────────┐│                      │
│       │   │  │ ChapterTreeProvider (TreeDataProvider)   ││                      │
│       │   │  │   ChapterItem → IssueItem (children)     ││                      │
│       │   │  └──────────────────────────────────────────┘│                      │
│       │   │  ┌──────────────────────────────────────────┐│                      │
│       │   │  │ ChapterContextProvider (WebviewView)     ││                      │
│       │   │  │   reacts to onDidChangeActiveTextEditor  ││                      │
│       │   │  └──────────────────────────────────────────┘│                      │
│       │   │  ┌──────────────────────────────────────────┐│                      │
│       │   │  │ KnowledgePaneProvider (WebviewView)      ││                      │
│       │   │  │   renders notes/ markdown via markdown-it││                      │
│       │   │  └──────────────────────────────────────────┘│                      │
│       │   │  ┌──────────────────────────────────────────┐│                      │
│       │   │  │ GutterDecorationManager                  ││                      │
│       │   │  │   span_hint → line lookup → decoration   ││                      │
│       │   │  └──────────────────────────────────────────┘│                      │
│       │   └───────────────────────────────────────────────┘                      │
│       │                                                                          │
│       ├─── Commands (palette + context menus)                                    │
│       │       initProject, changeChapterStatus, createIssue,                    │
│       │       triageIssue, closeSession, triggerChapterReview,                  │
│       │       triggerStoryIntelligenceUpdate, chatAboutIssue                    │
│       │                                                                          │
│       └─── AI Layer                                                              │
│               │                                                                  │
│               ├─── @leanquill ChatParticipant (vscode.chat.createChatParticipant)│
│               │       /review, /intelligence, /issue slash commands              │
│               │                                                                  │
│               ├─── ToolRegistry (vscode.lm.registerTool × 5)                   │
│               │       leanquill_read_chapter      (read-only)                   │
│               │       leanquill_get_issues        (read-only)                   │
│               │       leanquill_get_story_knowledge (read-only)                 │
│               │       leanquill_write_issue       (write — manuscript/ BLOCKED) │
│               │       leanquill_update_chapter_status (write — .leanquill/ only)│
│               │                                                                  │
│               └─── WorkflowHandlers                                              │
│                       ReviewHandler       (AI-01)                                │
│                       StoryIntelHandler   (AI-02)                                │
│                       IssueConvoHandler   (AI-03)                                │
│                                                                                  │
│  ─────────────────────────── File I/O Boundary ───────────────────────────────  │
│                                                                                  │
│       SafeFileSystem (wraps vscode.workspace.fs)                                 │
│           assertNotManuscript(uri) called on every write                        │
│           ├── ProjectLoader / ChapterStatusRW / IssueRW / ChatLogRW             │
│           └── NEVER receives a manuscript/ URI — tools structurally prevent it  │
│                                                                                  │
└──────────────────────────────────────────────────────────────────────────────────┘
                              │ vscode.workspace.fs
                              ▼
              .leanquill/   manuscript/   notes/
              (read+write)   (read-only)  (read-only)
```

---

## Extension Entry Points

### Activation

```jsonc
// package.json — contribution points (VS Code 1.95+)
"activationEvents": [
  "workspaceContains:.leanquill/project.yaml"   // auto-activate on leanquill repo open
  // "onCommand:leanquill.initProject" is auto-inferred — no explicit entry needed
],
"contributes": {
  "viewsContainers": {
    "activitybar": [
      { "id": "leanquill", "title": "LeanQuill", "icon": "media/icon.png" }
    ]
  },
  "views": {
    "leanquill": [
      { "id": "leanquill.chapters",   "name": "Chapters",   "type": "tree" },
      { "id": "leanquill.chapterCtx", "name": "Chapter",    "type": "webview" },
      { "id": "leanquill.knowledge",  "name": "Knowledge",  "type": "webview" }
    ]
  },
  "commands": [ ... ],
  "menus": {
    "view/item/context": [ ... ],   // right-click on chapter tree nodes
    "editor/context": [ ... ]       // right-click in manuscript editor
  },
  "chatParticipants": [
    {
      "id": "leanquill.leanquill",
      "name": "leanquill",
      "fullName": "LeanQuill",
      "description": "Chapter review, story intelligence, and issue analysis for your book",
      "commands": [
        { "name": "review",        "description": "Review the active chapter for issues" },
        { "name": "intelligence",  "description": "Update story knowledge from new chapter content" },
        { "name": "issue",         "description": "Discuss a specific issue with the AI" }
      ]
    }
  ]
}
```

**Key activation rules (verified March 2026):**
- `activationEvents: []` auto-infers `onView:leanquill.*` events — no explicit view events needed.
- `workspaceContains:.leanquill/project.yaml` ensures the extension only activates in LeanQuill repos, not every workspace.
- The extension **must not** depend on GitHub Copilot in its manifest (`extensionDependencies`). This keeps Track 1 (Author Workflow) usable by authors without Copilot.

---

## TreeDataProvider Architecture (Chapter Status Board)

### Tree Item Hierarchy

```
ChapterItem (collapsible)
  ├── label:       "Ch 03 — Dead Reckoning"
  ├── description: "editing"          ← status badge
  ├── tooltip:     "4 open · 1 deferred"
  ├── contextValue: "chapter"         ← drives context menu entries
  └── children: IssueItem[]
        ├── label:       "[P2] Navigator's watch contradicts Ch1"
        ├── description: "continuity"
        ├── contextValue: "issue.open" | "issue.deferred"
        └── command:     opens chapter file + scrolls to span_hint location
```

### Provider Interface

```typescript
// Unified item type — discriminated union via contextValue
type LeanQuillTreeItem = ChapterItem | IssueItem;

class ChapterTreeProvider implements vscode.TreeDataProvider<LeanQuillTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<LeanQuillTreeItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private cache: LeanQuillCache) {}

  getTreeItem(element: LeanQuillTreeItem): vscode.TreeItem { return element; }

  getChildren(element?: LeanQuillTreeItem): LeanQuillTreeItem[] {
    if (!element) {
      // Root: return chapters sorted by order
      return this.cache.chaptersInOrder().map(cs => new ChapterItem(cs));
    }
    if (element instanceof ChapterItem) {
      // Children: issues for this chapter
      return this.cache.issuesForChapter(element.chapterId)
        .filter(i => i.status === 'open' || i.status === 'deferred')
        .map(i => new IssueItem(i));
    }
    return [];
  }

  refresh(item?: LeanQuillTreeItem) { this._onDidChangeTreeData.fire(item); }
}
```

**Design decision:** Issues are children of their parent chapter, not top-level nodes. This keeps the board scannable at a glance: collapsed = chapter status overview; expanded = issue triage drill-down.

---

## WebviewViewProvider vs WebviewPanel

| Concern | WebviewViewProvider | WebviewPanel |
|---------|--------------------|-----------------------------|
| Lives in sidebar | YES | NO (editor area) |
| Survives panel resize/hide | YES | Requires retainContextWhenHidden |
| Registered in package.json | YES (`"type": "webview"`) | NO (programmatic only) |
| Reactive to editor focus | postMessage from extension host | Same |
| **Use for LeanQuill** | Chapter Context + Knowledge Pane | Not used |

**Both panes use `WebviewViewProvider`** registered in `package.json` as `"type": "webview"` under `contributes.views`.

```typescript
class ChapterContextProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;

  resolveWebviewView(view: vscode.WebviewView) {
    this._view = view;
    view.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, 'media')]
    };
    view.webview.html = this.buildHtml(view.webview, null);
  }

  // Called by onDidChangeActiveTextEditor handler
  updateForChapter(chapterId: string) {
    if (!this._view) return;
    const data = this.cache.getChapterData(chapterId);
    this._view.webview.postMessage({ type: 'chapterChanged', data });
  }
}
```

**Webview messaging convention:** Extension → Webview via `postMessage({ type, data })`. Webview → Extension via `webview.onDidReceiveMessage`. Never serialize `vscode.Uri` objects directly — convert to string first.

**CSP (mandatory for every render):**
```html
<meta http-equiv="Content-Security-Policy"
  content="default-src 'none';
           style-src ${webview.cspSource} 'unsafe-inline';
           script-src 'nonce-${nonce}';">
```
Generate a fresh nonce per `resolveWebviewView` call using `crypto.getRandomValues`.

---

## VS Code Language Model API Integration Pattern

**Authoritative note (March 2026):** System messages are NOT supported by the VS Code LM API. Role-playing instructions and constraints go in a `User` message at the front of the prompt.

### Chat Participant Registration (AI-03 "Chat about this issue")

```typescript
// In activate():
const participant = vscode.chat.createChatParticipant('leanquill.leanquill', handler);
participant.iconPath = vscode.Uri.joinPath(context.extensionUri, 'media', 'icon.png');
context.subscriptions.push(participant);

const handler: vscode.ChatRequestHandler = async (request, chatContext, stream, token) => {
  const { command, prompt } = request;
  // Use request.model (the model the user picked in the dropdown)
  // rather than selectChatModels() inside a chat handler

  if (command === 'review') {
    await reviewHandler.handle(request, stream, token);
  } else if (command === 'intelligence') {
    await storyIntelHandler.handle(request, stream, token);
  } else if (command === 'issue') {
    await issueConvoHandler.handle(request, stream, token);
  }
};
```

### Tool Registration (used by all three AI workflows)

```typescript
// In activate() — tools are the ONLY way AI can touch files
context.subscriptions.push(
  vscode.lm.registerTool('leanquill_read_chapter',        new ReadChapterTool(cache)),
  vscode.lm.registerTool('leanquill_get_issues',          new GetIssuesTool(cache)),
  vscode.lm.registerTool('leanquill_get_story_knowledge', new GetStoryKnowledgeTool(cache)),
  vscode.lm.registerTool('leanquill_write_issue',         new WriteIssueTool(safeFs, cache)),
  vscode.lm.registerTool('leanquill_update_chapter_status', new UpdateChapterStatusTool(safeFs, cache)),
);
```

### Workflow Handler Pattern (AI-01 Chapter Review)

```typescript
class ReviewHandler {
  async handle(request: vscode.ChatRequest, stream: vscode.ChatResponseStream, token: vscode.CancellationToken) {
    stream.progress('Building review context...');
    const chapterPath = this.getActiveChapterPath();
    const chapterText = await this.cache.readChapterText(chapterPath);
    const storyKnowledge = this.cache.getRelevantKnowledge(chapterPath);
    const persona = this.cache.getActivePersona();

    const messages = [
      // No system message support — constraints go in User role
      vscode.LanguageModelChatMessage.User(
        `You are acting as the persona: ${persona.description}\n` +
        `RULES:\n` +
        `- You must NEVER suggest edits to the manuscript text directly.\n` +
        `- You may only output issues in the structured format below.\n` +
        `- Do not reference chapters beyond ${chapterPath}.\n\n` +
        `STORY KNOWLEDGE:\n${storyKnowledge}\n\n` +
        `CHAPTER TO REVIEW:\n${chapterText}`
      ),
      vscode.LanguageModelChatMessage.User(request.prompt),
    ];

    // For chat handlers, use request.model (user's choice)
    const response = await request.model.sendRequest(messages, {}, token);
    const issueJson: string[] = [];

    for await (const part of response.text) {
      stream.markdown(part);
      issueJson.push(part);
    }

    // Parse and persist via safe file system
    const sessionFile = await this.issueRW.writeSession(chapterPath, issueJson.join(''));
    stream.button({ command: 'leanquill.openIssues', title: 'Open Issues' });
    // FileWatcher will detect the new session file and refresh the tree
  }
}
```

**Key invariant:** Chapter review reads manuscript as context (read-only). All output goes to `.leanquill/issues/sessions/`. The LLM has no mechanism to write to `manuscript/` because no such tool is registered.

---

## File System Watcher Strategy

**Single watcher, narrowly scoped:**

```typescript
const watcher = vscode.workspace.createFileSystemWatcher(
  new vscode.RelativePattern(workspaceFolder, '.leanquill/**/*.{yaml,md}')
);

watcher.onDidChange(uri => cacheInvalidator.invalidate(uri));
watcher.onDidCreate(uri => cacheInvalidator.invalidate(uri));
watcher.onDidDelete(uri => cacheInvalidator.invalidate(uri));
context.subscriptions.push(watcher);
```

**CacheInvalidator cascade:**

```
FileSystemWatcher fires (uri)
  → parse uri to determine type: project.yaml | chapters/*.md | issues/**/*.md | personas/*.md
  → evict relevant cache entries
  → notify: ChapterTreeProvider.refresh()
  → notify: ChapterContextProvider.updateForChapter(affectedChapterId)
  → notify: GutterDecorationManager.refreshEditor(activeEditor)
  → notify: KnowledgePaneProvider.refresh() (only if notes/ file — separate watcher)
```

**Second watcher for notes/ (Knowledge Pane only):**

```typescript
const notesWatcher = vscode.workspace.createFileSystemWatcher(
  new vscode.RelativePattern(workspaceFolder, 'notes/**/*.md')
);
notesWatcher.onDidChange(() => knowledgePaneProvider.refresh());
context.subscriptions.push(notesWatcher);
```

Keeping two separate watchers avoids reloading the Knowledge Pane on every issue file change.

---

## JSON Index / Cache Layer

**Design principle:** The cache is a pure in-memory mirror of `.leanquill/` state. It is rebuilt on activation and invalidated by file watchers. No disk persistence for the cache — the source files are the ground truth.

```typescript
interface LeanQuillCache {
  // Primary indexes
  chapters:       Map<string, ChapterStatus>;   // chapterId → status
  issues:         Map<string, Issue>;            // issueId → issue
  personas:       Map<string, Persona>;          // personaId → persona
  projectConfig:  ProjectConfig | null;

  // Derived indexes (built from above, not stored separately)
  chapterOrder:   string[];                      // sorted by ChapterStatus.order
  chapterIssues:  Map<string, string[]>;         // chapterId → issueId[]
  spanHints:      Map<string, SpanHint[]>;       // abs filepath → [{issueId, text, range}]

  // Cache bookkeeping
  lastRefreshed:  number;                        // Date.now()
  isReady:        boolean;
}
```

**Population sequence (activation):**

```
1. Read project.yaml → populate projectConfig
2. Read Book.txt (or glob manuscript/) → determine chapter order
3. Read .leanquill/chapters/*.md in parallel → populate chapters map
4. Read .leanquill/issues/sessions/*.md + master-issues.md in parallel → populate issues map
5. Build chapterIssues (group by chapter_ref) + spanHints (from span_hint fields)
6. Read .leanquill/personas/*.md → populate personas map
7. Set isReady = true; fire onCacheReady event
```

**Partial invalidation (file watcher):**

```typescript
class CacheInvalidator {
  invalidate(uri: vscode.Uri) {
    const rel = vscode.workspace.asRelativePath(uri);
    if (rel.includes('chapters/')) {
      const id = extractChapterId(rel);
      this.cache.chapters.delete(id);
      ChapterStatusReader.read(uri).then(cs => {
        this.cache.chapters.set(id, cs);
        this.rebuildChapterIssues();
        this.treeProvider.refresh();
      });
    } else if (rel.includes('issues/')) {
      this.reloadIssues();
    }
    // ... etc
  }
}
```

**Why no disk-based cache (e.g. `.leanquill/.cache/index.json`):**  
The `.leanquill/` state files are small (< 1 KB each, dozens of files). Cold startup read costs ~20–50 ms total. Adding a disk cache introduces staleness risk, merge conflicts in git, and extra write operations. Not worth the complexity for this data volume.

---

## Gutter Decoration API

**Manager class:**

```typescript
class GutterDecorationManager {
  private decorationType: vscode.TextEditorDecorationType;

  constructor(private cache: LeanQuillCache, context: vscode.ExtensionContext) {
    this.decorationType = vscode.window.createTextEditorDecorationType({
      gutterIconPath: context.asAbsolutePath('media/issue-gutter.svg'),
      gutterIconSize: 'contain',
      overviewRulerColor: new vscode.ThemeColor('charts.orange'),
      overviewRulerLane: vscode.OverviewRulerLane.Left,
    });
    context.subscriptions.push(this.decorationType);
  }

  attachToEditor(editor: vscode.TextEditor) {
    const relPath = vscode.workspace.asRelativePath(editor.document.uri);
    const hints = this.cache.spanHints.get(relPath) ?? [];
    const decorations: vscode.DecorationOptions[] = hints.flatMap(hint =>
      this.resolveSpanHint(editor, hint)
    );
    editor.setDecorations(this.decorationType, decorations);
  }

  private resolveSpanHint(editor: vscode.TextEditor, hint: SpanHint): vscode.DecorationOptions[] {
    const text = editor.document.getText();
    const idx = text.indexOf(hint.text);
    if (idx === -1) return [];   // span_hint no longer present (text was edited)
    const pos = editor.document.positionAt(idx);
    return [{
      range: new vscode.Range(pos, pos),
      hoverMessage: new vscode.MarkdownString(`**[${hint.issueId}]** ${hint.title}`)
    }];
  }

  refreshEditor(editor: vscode.TextEditor | undefined) {
    if (editor) this.attachToEditor(editor);
  }
}

// Wire to editor events in activate():
context.subscriptions.push(
  vscode.window.onDidChangeActiveTextEditor(e => gutterMgr.refreshEditor(e))
);
```

**Span hint matching strategy:** Linear text search (`String.indexOf`) on the `span_hint` fragment. This is intentionally unsophisticated — fragments are short quoted excerpts, and authors do not mass-edit. If a span_hint is edited away, the decoration simply disappears (graceful degradation, no errors).

**Icon format note:** SVGs are acceptable for gutter icons (unlike the extension icon badge). Recommend 16×16 or 22×22 px, single-color, minimal visual noise.

---

## Write-Block Enforcement Architecture

**Threat model:** An LLM response or buggy extension code accidentally writes to `manuscript/`. This must be structurally impossible, not just policy.

### Layer 1 — Tool Absence (primary enforcement)

The `ToolRegistry` registers exactly five tools. **No tool accepts a manuscript path as a write target.** Even if the LLM generates a tool call with a `filePath` pointing to `manuscript/`, no such tool exists to execute it.

```typescript
// leanquill_write_issue: only writes to .leanquill/issues/
// leanquill_update_chapter_status: only writes to .leanquill/chapters/
// leanquill_read_chapter: read-only, no write
// leanquill_get_issues: read-only
// leanquill_get_story_knowledge: read-only
```

### Layer 2 — SafeFileSystem (defense in depth)

Every write in the extension codebase goes through `SafeFileSystem`, never directly through `vscode.workspace.fs.writeFile`:

```typescript
class SafeFileSystem {
  private readonly manuscriptRoot: string;

  constructor(projectConfig: ProjectConfig, workspaceFolder: vscode.WorkspaceFolder) {
    this.manuscriptRoot = vscode.Uri.joinPath(
      workspaceFolder.uri,
      projectConfig.folders.manuscript   // e.g. "manuscript/"
    ).path;
  }

  async writeFile(uri: vscode.Uri, content: Uint8Array): Promise<void> {
    // Normalize both paths before comparison
    const target = uri.path;
    if (target.startsWith(this.manuscriptRoot)) {
      const err = new Error(
        `LeanQuill write-block: attempted write to manuscript/ is forbidden. URI: ${uri.toString()}`
      );
      // Surface as VS Code error notification, not silent failure
      vscode.window.showErrorMessage(err.message);
      throw err;
    }
    await vscode.workspace.fs.writeFile(uri, content);
  }
}
```

### Layer 3 — Prompt Constraint (LLM guidance, not enforcement)

Since the LM API does not support system messages, the constraint is delivered as a `User` message at the top of every AI workflow prompt:

```typescript
vscode.LanguageModelChatMessage.User(
  `CONSTRAINTS (mandatory — these are system rules, not user preferences):\n` +
  `1. You must NEVER produce content intended to modify files in the manuscript/ directory.\n` +
  `2. Your only output mechanism is the provided leanquill_write_issue tool.\n` +
  `3. Do not suggest direct file edits.\n`
)
```

### Layer 4 — AGENTS.md

A `.github/AGENTS.md` (or `.leanquill/AGENTS.md`) documents the constraint for any future agent or agentic mode that might inherit this workspace context, preventing accidental future bypass.

**Build order implication:** `SafeFileSystem` must be implemented and tested before any file-writing command or AI workflow is built. It is the foundation of the File I/O layer.

---

## Extension State Persistence Strategy

| State Type | Storage Mechanism | Rationale |
|------------|-------------------|-----------|
| Chapter status, issues, personas | `.leanquill/` files (markdown + YAML) | Source of truth; git-diffable; survives reinstall |
| Last active chapter ID | `context.workspaceState.update('leanquill.activeChapter', id)` | Per-workspace, non-critical UI state |
| Tree filter setting (open/all/deferred) | `context.workspaceState` | Per-workspace preference |
| Active persona selection | `project.yaml` (via SafeFileSystem) | Project-scoped, should be version-controlled |
| Dismissed onboarding prompt | `context.globalState` | Per-user, extension-wide |
| First-run init flag | `context.workspaceState` | Per-workspace |

**Rule:** Project data (anything an author cares about) lives in `.leanquill/`. `workspaceState` and `globalState` are for throwaway UI state only. Never store issue content, session notes, or chapter status in VS Code's internal storage — it is not git-diffable and not portable.

---

## Data Flow Diagrams

### Flow 1 — Extension Activation

```
activate()
  └─ ProjectLoader.load(workspaceFolder)
       ├─ read .leanquill/project.yaml → ProjectConfig
       ├─ read Book.txt or glob manuscript/ → chapter file list
       ├─ read .leanquill/chapters/*.md (parallel) → ChapterStatus[]
       ├─ read .leanquill/issues/sessions/*.md (parallel) → Issue[]
       └─ populate LeanQuillCache
            ├─ register ChapterTreeProvider → ready
            ├─ register ChapterContextProvider → ready (empty until chapter opened)
            ├─ register KnowledgePaneProvider → ready
            ├─ register GutterDecorationManager → ready
            └─ register FileSystemWatcher → watching
```

### Flow 2 — Author Opens a Chapter File

```
vscode.window.onDidChangeActiveTextEditor(editor)
  ├─ ChapterContextProvider.updateForChapter(chapterId)
  │    └─ postMessage({ type: 'chapterChanged', data: { status, issues, sessionNotes } })
  │         └─ Webview renders: status badge, open issue list, next_action, session_notes
  └─ GutterDecorationManager.attachToEditor(editor)
       └─ resolve span_hints for this file → setDecorations(editor, ranges)
```

### Flow 3 — Author Triages an Issue (dismiss / defer)

```
User right-clicks IssueItem → "Dismiss Issue" command
  └─ triageIssue(issueId, 'dismissed', reason?)
       ├─ IssueRW.updateStatus(issueId, 'dismissed', reason)
       │    └─ SafeFileSystem.writeFile(.leanquill/issues/sessions/...)
       └─ FileSystemWatcher.onDidChange fires
            ├─ CacheInvalidator.invalidate(uri)
            │    ├─ cache.issues updated
            │    └─ chapterIssues rebuilt
            ├─ ChapterTreeProvider.refresh(chapterItem)
            ├─ ChapterContextProvider.updateForChapter(chapterId)
            └─ GutterDecorationManager.refreshEditor(activeEditor)
```

### Flow 4 — AI Chapter Review (AI-01)

```
User: "Review Ch 03" command or @leanquill /review
  └─ ReviewHandler.handle(request, stream, token)
       ├─ stream.progress('Reading chapter context...')
       ├─ cache.readChapterText(chapterPath)    ← READ ONLY
       ├─ cache.getStoryKnowledge()             ← READ ONLY
       ├─ cache.getActivePersona()              ← READ ONLY
       ├─ build messages[] (User role × 2 — system-as-user pattern)
       ├─ request.model.sendRequest(messages, {}, token)
       ├─ stream response to ChatResponseStream (user sees it live)
       ├─ SafeFileSystem.writeFile(.leanquill/issues/sessions/{timestamp}-review.md)
       ├─ SafeFileSystem.writeFile(.leanquill/chats/{timestamp}-review-chat.md)
       └─ FileSystemWatcher detects new files → cache update → tree refresh
```

### Flow 5 — Write-Block Triggered (Error Path)

```
Any code calls SafeFileSystem.writeFile(uri)
  └─ uri.path.startsWith(manuscriptRoot)?
       ├─ YES → vscode.window.showErrorMessage('LeanQuill write-block: ...')
       │         throw Error (call stack preserved for debugging)
       └─ NO  → vscode.workspace.fs.writeFile(uri, content)
```

---

## Suggested Build Order

Components are ordered by dependency depth. Each phase is independently shippable.

| Phase | Components | Depends On | Delivers |
|-------|------------|-----------|---------|
| 1 | `types/index.ts`, `SafeFileSystem`, `ProjectLoader`, `CacheInvalidator` | Nothing | File I/O foundation + write-block |
| 2 | `LeanQuillCache`, `ChapterStatusRW`, `IssueRW`, `FileSystemWatcher` | Phase 1 | In-memory state layer |
| 3 | `ChapterTreeProvider`, chapter commands (init, changeStatus) | Phase 2 | CHAP-01, CHAP-02, INIT-01 |
| 4 | `ChapterContextProvider`, `GutterDecorationManager`, session close | Phase 3 | CHAP-03, ISSUE-03, SESS-01 |
| 5 | `Issue CRUD commands` (create, triage), `KnowledgeReader` | Phase 2 | ISSUE-01, ISSUE-02 |
| 6 | `KnowledgePaneProvider` | Phase 5 | KNOW-01, KNOW-02 |
| 7 | `ToolRegistry`, `ChatParticipant`, `ReviewHandler` | Phase 2 + all reads | AI-01, AI-04 |
| 8 | `StoryIntelHandler`, `IssueConvoHandler` | Phase 7 | AI-02, AI-03, AI-05 |

**Critical path:** Phase 1 → Phase 2 → Phase 3 delivers a fully functional Track 1. Phase 7+ is Track 2.

---

## Suggested Module / Folder Structure

```
src/
  extension.ts                        # activate() / deactivate()

  types/
    index.ts                          # TypeScript interfaces matching data contracts
                                      # ChapterStatus, Issue, Persona, ProjectConfig, ChatLog

  file-system/
    SafeFileSystem.ts                 # Write-block enforced wrapper
    ProjectLoader.ts                  # Reads project.yaml, Book.txt
    ChapterStatusRW.ts                # Read/write chapter-status files
    IssueRW.ts                        # Read/write issue session files
    KnowledgeReader.ts                # Read notes/ markdown files (read-only)
    ChatLogRW.ts                      # Write chat log entries

  cache/
    LeanQuillCache.ts                 # In-memory state store + derived indexes
    CacheInvalidator.ts               # File watcher → cache eviction → event bus

  providers/
    ChapterTreeProvider.ts            # TreeDataProvider<LeanQuillTreeItem>
    ChapterItem.ts                    # vscode.TreeItem for chapters
    IssueItem.ts                      # vscode.TreeItem for issues
    ChapterContextProvider.ts         # WebviewViewProvider — sidebar Chapter pane
    KnowledgePaneProvider.ts          # WebviewViewProvider — sidebar Knowledge pane

  commands/
    initProject.ts                    # INIT-01
    changeChapterStatus.ts            # CHAP-02
    createIssue.ts                    # ISSUE-01
    triageIssue.ts                    # ISSUE-02
    closeSession.ts                   # SESS-01
    triggerChapterReview.ts           # AI-01 command entry point
    triggerStoryIntelligenceUpdate.ts # AI-02 command entry point
    chatAboutIssue.ts                 # AI-03 command entry point

  ai/
    chatParticipant.ts                # vscode.chat.createChatParticipant + handler router
    tools/
      ReadChapterTool.ts              # leanquill_read_chapter
      GetIssuesTool.ts                # leanquill_get_issues
      GetStoryKnowledgeTool.ts        # leanquill_get_story_knowledge
      WriteIssueTool.ts               # leanquill_write_issue (blocked from manuscript/)
      UpdateChapterStatusTool.ts      # leanquill_update_chapter_status
    handlers/
      ReviewHandler.ts                # AI-01 chapter review workflow
      StoryIntelligenceHandler.ts     # AI-02 story intelligence update workflow
      IssueConversationHandler.ts     # AI-03 issue-focused chat workflow
    prompts/
      chapterReview.ts                # Prompt assembly for review (+ opt. prompt-tsx)
      storyUpdate.ts                  # Prompt assembly for story intelligence

  decorations/
    GutterDecorationManager.ts        # span_hint → gutter icon decoration

  webview/
    buildChapterContextHtml.ts        # HTML generator for Chapter Context pane
    buildKnowledgeHtml.ts             # HTML generator for Knowledge pane
    webview-ui/
      chapterContext.js               # Client-side JS (vanilla — no framework)
      knowledge.js

  utils/
    nonce.ts                          # Cryptographic nonce for CSP
    pathUtils.ts                      # Relative ↔ absolute path helpers
    validation.ts                     # ajv-based schema validators

media/
  icon.png                            # 128×128 PNG (SVG not allowed for extension icon)
  issue-gutter.svg                    # 16×16 / 22×22 SVG (SVG is fine for gutters)

dist/                                 # esbuild output (gitignored)
package.json
tsconfig.json
esbuild.js
```

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Activation & contribution points | HIGH | Verified via official docs March 2026 |
| TreeDataProvider pattern | HIGH | Stable API, well-documented |
| WebviewViewProvider (sidebar) | HIGH | Stable since 1.73, confirmed by STACK.md |
| vscode.lm API (chat + tools) | HIGH | Official docs verified March 2026; system messages confirmed unsupported |
| File system watcher | HIGH | Documented, no changes since 1.x |
| In-memory cache design | HIGH | Standard pattern for this type of extension |
| Gutter decoration API | HIGH | Stable API, confirmed by STACK.md |
| Write-block multi-layer approach | HIGH | Tool-absence is structural; SafeFileSystem is defense-in-depth |
| State persistence split | HIGH | workspaceState vs files — documented best practice |
| Folder structure | HIGH | Follows official VS Code extension sample conventions |

---

## Sources

- VS Code Chat Participant API: https://code.visualstudio.com/api/extension-guides/ai/chat (March 2026)
- VS Code Language Model API: https://code.visualstudio.com/api/extension-guides/ai/language-model (March 2026)
- STACK.md (this project, 2026-03-29)
- Imported/data-contracts/ — all five schema files
- PROJECT.md — requirements, constraints, decisions
