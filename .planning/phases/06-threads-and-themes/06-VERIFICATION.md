---
status: passed
phase: 06-threads-and-themes
completed: 2026-04-09
---

# Phase 6: Threads and Themes — Verification

## Requirement

- **THREAD-01** — Themes document + thread profiles with chapter-level linking via outline-derived picker.

## Must-haves (automated / code review)

| # | Criterion | Result |
|---|-----------|--------|
| 1 | `ProjectConfig.folders.threads` with default `notes/threads/`; init template emits `threads:` | ✓ `projectConfig.ts`, `initialize.ts`, tests |
| 2 | `.leanquill/themes.yaml` read/write via hand-rolled YAML (no new npm yaml dep); writes use SafeFileSystem | ✓ `themesStore.ts` |
| 3 | Thread markdown with `touchesChapters`; CRUD via `threadStore` + SafeFileSystem | ✓ `threadStore.ts`, tests |
| 4 | `buildChapterPickerOptions` only includes `manuscript/*.md` outline nodes; order matches plan | ✓ `chapterPickerOptions.ts`, tests |
| 5 | Planning webview tab order Outline → Cards → Themes → Characters → Places → Threads | ✓ `planningPanelHtml.ts` |
| 6 | Themes + Threads tabs wired in `PlanningPanelProvider`; `showThemes` / `showThreads` | ✓ `planningPanel.ts` |
| 7 | Extension: `safeThreadsFolder` allowPath, `threadsWatcher`, `leanquill.newThread`, `leanquill.newTheme` | ✓ `extension.ts`, `package.json` |

## Automated checks

```text
npm run build
npm run build:test && npm test
```

All tests passed (159) on 2026-04-09.

## Human verification (optional)

- Open Planning Workspace → Themes tab: edit book fields, add central theme, toggle chapter links.
- Threads tab: create thread, set touches chapters, delete with webview confirm.
- Command palette: **LeanQuill: New Thread**, **LeanQuill: New Theme**.

## Gaps

None identified from automated verification.
