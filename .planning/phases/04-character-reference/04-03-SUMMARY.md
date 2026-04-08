# Phase 04-03 Summary: Extension Wiring

**Phase:** 04-character-reference  
**Plan:** 03  
**Completed:** 2026-04-08  
**Commits:** `4bdfd86`, `4b2c6c7`

## What Was Built

### Task 1 — Characters SafeFs Allowance + newCharacter Command

**`src/extension.ts`:**

- Added import: `createCharacter, scanManuscriptFileForCharacters` from `./characterStore`
- After the research folder `allowPath` call (inside the `if (config)` block), added characters folder allowance:
  - Reads `config.folders.characters` with fallback to `"notes/characters"`
  - Strips trailing slashes, rejects `manuscript/` paths (same pattern as research folder)
  - Calls `safeFileSystem.allowPath(safeCharactersFolder, ".md")`
- Registered `leanquill.newCharacter` command:
  - Prompts user via `showInputBox` for character name
  - Fetches fresh `ProjectConfig`
  - Calls `createCharacter(name, rootPath, config, safeFileSystem)`
  - Calls `planningPanel.refresh()` to update the Characters tab
  - Shows `showErrorMessage` on failure
  - Pushed to `context.subscriptions`

### Task 2 — Manuscript Scan Listeners + package.json

**`src/extension.ts`:**

- Added `scanManuscriptFile(filePath)` helper:
  - Checks path is relative to rootPath and starts with `manuscript/` and ends with `.md`
  - Calls `scanManuscriptFileForCharacters` with fresh config
  - Calls `planningPanel.refresh()` after scan
  - Catches all errors silently (background operation)
- Registered `onDidSaveTextDocument` listener: invokes `scanManuscriptFile`
- Registered `onDidOpenTextDocument` listener: invokes `scanManuscriptFile`
- Both pushed to `context.subscriptions`

**`package.json`:**

- Added to `contributes.commands`:
  ```json
  { "command": "leanquill.newCharacter", "title": "New Character", "category": "LeanQuill", "icon": "$(person-add)" }
  ```

## Artifacts

- Modified: `src/extension.ts` (+57 lines)
- Modified: `package.json` (+6 lines)

## Verification

- `npm run build` → clean (137.6kb bundle)
- `npm run test` → 131 pass, 0 fail

## Key Decisions

- Used `planningPanel` variable name (not `planningPanelProvider`) — confirmed from source
- Manuscript scan errors are always swallowed; scanning is a background best-effort operation
- Characters folder safety mirrors research folder pattern exactly
