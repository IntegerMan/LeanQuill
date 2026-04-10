# Architecture

LeanQuill runs as a VS Code extension with webview-based sidebars and an editor-area planning panel. All book state lives in the opened workspace on disk.

## System overview

```
┌─────────────────────────────────────────────────────┐
│                    VS Code Host                      │
│                                                      │
│  ┌──────────────┐  ┌─────────────┐  ┌────────────┐  │
│  │  Activity Bar │  │ Sidebar     │  │ Editor     │  │
│  │  (LeanQuill)  │  │ Webviews    │  │ Panel      │  │
│  │               │  │             │  │            │  │
│  │  ┌──────────┐ │  │ • Outline   │  │ Planning   │  │
│  │  │  Icon    │ │  │ • Context   │  │ Workspace  │  │
│  │  └──────────┘ │  │ • Research  │  │ (6 tabs)   │  │
│  │               │  │ • Characters│  │            │  │
│  └──────────────┘  └──────┬──────┘  └─────┬──────┘  │
│                           │               │          │
│  ┌────────────────────────┴───────────────┘          │
│  │           Extension Host (TypeScript)             │
│  │                                                   │
│  │  ┌─────────────────────────────────────────────┐  │
│  │  │              SafeFileSystem                  │  │
│  │  │  (write boundary enforcement layer)          │  │
│  │  └──────────────────┬──────────────────────────┘  │
│  │                     │                             │
│  │  ┌─────────┬────────┼────────┬──────────┐         │
│  │  │ Outline │ Themes │ Chars  │ Threads  │ ...     │
│  │  │ Store   │ Store  │ Store  │ Store    │         │
│  │  └────┬────┴───┬────┴───┬────┴────┬─────┘         │
│  │       │        │        │         │               │
│  └───────┴────────┴────────┴─────────┘               │
│                     │                                │
└─────────────────────┼────────────────────────────────┘
                      │
        ┌─────────────┴─────────────┐
        │    Book Workspace (git)    │
        │                            │
        │  manuscript/               │
        │    Book.txt                │
        │    ch1.md, ch2.md, ...     │
        │                            │
        │  .leanquill/               │
        │    project.yaml            │
        │    outline-index.json      │
        │    themes.yaml             │
        │    chapter-order.json      │
        │    chats/                  │
        │    personas/               │
        │    workflows/              │
        │                            │
        │  notes/                    │
        │    characters/*.md         │
        │    threads/*.md            │
        │                            │
        │  research/leanquill/*.md   │
        └────────────────────────────┘
```

## Key source modules

| Module | File | Role |
|--------|------|------|
| **Extension entry** | `src/extension.ts` | Registers commands, webviews, tree providers, file watchers, and safety allowances |
| **Safe filesystem** | `src/safeFileSystem.ts` | Central write boundary enforcement — only whitelisted paths are writable |
| **Outline webview** | `src/outlineWebviewPanel.ts` | Sidebar outline tree with drag-and-drop, context menus, and codicon status icons |
| **Context pane** | `src/outlineContextPane.ts` | Selection-driven detail view for the currently selected outline node |
| **Planning panel** | `src/planningPanel.ts`, `src/planningPanelHtml.ts` | Tabbed editor-area workspace (Themes, Outline, Cards, Characters, Threads, Places) |
| **Outline store** | `src/outlineStore.ts` | Read/write `.leanquill/outline-index.json`; v1→v2 migration |
| **Project config** | `src/projectConfig.ts` | Parse and validate `project.yaml` |
| **Themes store** | `src/themesStore.ts` | Read/write `.leanquill/themes.yaml` |
| **Character store** | `src/characterStore.ts` | CRUD for character markdown files with frontmatter |
| **Thread store** | `src/threadStore.ts` | CRUD for thread markdown files |
| **Book.txt sync** | `src/bookTxtSync.ts` | Generate `Book.txt` from outline; detect external edits |
| **LeanPub scaffold** | `src/leanpubScaffold.ts` | Create `manuscript/`, `Book.txt`, and starter chapter files |
| **Initialization** | `src/initialize.ts` | Full init flow: project.yaml, scaffold, harness files, outline bootstrap |
| **Chapter order** | `src/chapterOrder.ts` | Parse `Book.txt` into ordered chapter list; alpha fallback |
| **Types** | `src/types.ts` | Shared type definitions: `OutlineNode`, `OutlineIndex`, `CharacterProfile`, `ThreadProfile`, etc. |

For write boundaries and AI policy, see [Manuscript safety](manuscript-safety.md). For building and testing, see [Development](development.md).

---

[← Back to README](../README.md)
