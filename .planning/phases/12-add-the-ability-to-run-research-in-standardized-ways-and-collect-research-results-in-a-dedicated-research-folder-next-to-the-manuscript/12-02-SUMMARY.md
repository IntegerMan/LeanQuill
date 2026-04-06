---
plan: 12-02
phase: 12-standardized-research
status: complete
completed: 2026-04-05
commits:
  - a766557 feat(12-02): add ResearchTreeProvider with parseFrontmatter and buildResearchItems
  - 858dc6c feat(12-02): wire research sidebar, config loading, migration, multi-harness quick-start
key-files:
  created:
    - src/researchTree.ts
    - test/researchTree.test.ts
    - src/extension.ts (extended)
    - package.json (extended)
---

## Summary

Plan 12-02 delivered the user-facing research sidebar and multi-harness quick-start button.

### What was built

**Task 1 — Research TreeDataProvider (`src/researchTree.ts`):**
- `parseFrontmatter(content)` — extracts `name` and `created` from YAML frontmatter block; handles quoted/unquoted values; returns empty object when no frontmatter
- `ResearchItem` interface — `{ kind, filePath, name, created }`
- `buildResearchItems(researchDir)` — reads directory, filters to `.md` files, parses frontmatter, derives name from filename when missing (strips date suffix, title-cases), uses file mtime as created fallback, sorts newest-first
- `ResearchTreeProvider` — implements `vscode.TreeDataProvider<ResearchItem>`; renders items with `book` icon, formatted date description, and `vscode.open` command; `refresh()` method fires change event
- 13 unit tests for pure functions — all pass

**Task 2 — Extension wiring (`src/extension.ts`, `package.json`):**
- Config loading on activation: `readProjectConfig` → if v1, `migrateProjectYaml` → `safeFileSystem.allowPath(researchFolder, ".md")`
- ResearchTreeProvider registered with `vscode.window.registerTreeDataProvider("leanquill.research", ...)`
- `FileSystemWatcher` on `${researchFolder}/**/*.md` — refreshes tree on create/change/delete
- `leanquill.startResearch` command detects harness: Cursor (appName.includes("cursor")), Copilot (extension check), Claude/fallback (showInformationMessage with `/agent:researcher` guidance); commands `workbench.action.chat.open` with harness-appropriate query
- Research folder `mkdir` on activation (non-critical, catch block)
- `package.json`: Research view in leanquill sidebar (when: isInitialized), `startResearch` command with `$(add)` icon, `view/title` menu entry for Research view, viewsWelcome content for empty state, `onView:leanquill.research` activation event

### Test results
- 106 tests total, 106 pass, 0 fail

### Self-Check: PASSED
All must_haves verified:
- ✅ Sidebar shows a Research section listing .md files from the configured research folder
- ✅ Each research item displays the name from frontmatter and creation date as description
- ✅ Clicking a research item opens the markdown file in the editor
- ✅ Research section refreshes when files change in the research folder
- ✅ Plus button on Research section header opens AI chat with pre-populated research invocation
- ✅ Harness detection correctly identifies Copilot, Cursor, and Claude environments
- ✅ Extension reads project config on activation and configures SafeFileSystem for research folder
- ✅ Schema v1 projects are auto-migrated to v2 on activation
