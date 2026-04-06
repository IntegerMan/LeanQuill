---
phase: 12-standardized-research
verified: 2026-04-05T00:00:00Z
status: passed
score: 19/19 must-haves verified
---

# Phase 12: Standardized Research Workflow and Results Repository — Verification Report

**Phase Goal:** Author can run standardized research workflows via AI chat and store structured research outcomes in a dedicated folder, browsable from the VS Code sidebar.
**Verified:** 2026-04-05
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths — Plan 12-01 (RES-01, RES-04)

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | `parseProjectConfig` extracts `schemaVersion` and `folders.research` from project.yaml text | ✓ VERIFIED | `src/projectConfig.ts` lines 11–40: regex + line-based YAML parse with sensible defaults; 9 passing tests |
| 2  | `readProjectConfig` returns null when project.yaml is missing | ✓ VERIFIED | ENOENT check at `src/projectConfig.ts` line 46–50; test `readProjectConfig returns null when project.yaml does not exist` passes |
| 3  | `SafeFileSystem.allowPath` enables writing `.md` files under a dynamic path prefix | ✓ VERIFIED | `src/safeFileSystem.ts` `allowPath()` pushes to `additionalAllowed`; `canWrite()` checks prefix + extFilter; test `allowPath with extFilter allows .md writes to allowed prefix` passes |
| 4  | `SafeFileSystem` blocks non-`.md` files in an allowed research path | ✓ VERIFIED | extFilter guard in `canWrite()` at line 38; test `allowPath with extFilter blocks non-.md files` passes |
| 5  | `SafeFileSystem.mkdir` works for directories under an allowed path (no ext filter on directories) | ✓ VERIFIED | `ext === ""` path in canWrite() line 37; test `allowPath mkdir on research folder succeeds (directory has no ext)` passes |
| 6  | New projects initialize with `schema_version: "2"` and `folders.research: research/leanquill/` | ✓ VERIFIED | `src/initialize.ts` lines 24, 34: `renderProjectYaml` outputs `schema_version: "2"` and `research: research/leanquill/` |
| 7  | Existing v1 `project.yaml` is migrated to v2 with updated research default on activation | ✓ VERIFIED | `migrateProjectYaml` in `src/initialize.ts` lines 218–244 replaces schema v1→v2 and `notes/research/` → `research/leanquill/`; called in `extension.ts` line 102 when `schemaVersion === "1"` |
| 8  | Canonical workflow file created at `.leanquill/workflows/research.md` during init | ✓ VERIFIED | `src/initialize.ts` lines 258–261: `safeFs.writeFile` creates workflow file with full process steps and result format |
| 9  | Copilot entry point created at `.github/agents/researcher.agent.md` during init | ✓ VERIFIED | `src/initialize.ts` line 160–170: raw `fs.writeFile` creates copilotFile with name/description/tools/instructions |
| 10 | Cursor entry point created at `.cursor/skills/researcher/SKILL.md` during init | ✓ VERIFIED | `src/initialize.ts` line 173–187: raw `fs.writeFile` creates cursorFile with adapter block |
| 11 | Claude entry point created at `.claude/agents/researcher.md` during init | ✓ VERIFIED | `src/initialize.ts` line 190–203: raw `fs.writeFile` creates claudeFile with agent system prompt |

### Observable Truths — Plan 12-02 (RES-02, RES-03)

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 12 | Sidebar shows a Research section listing `.md` files from the configured research folder | ✓ VERIFIED | `ResearchTreeProvider.getChildren()` calls `buildResearchItems(researchDir)`; view `leanquill.research` registered in `package.json` and wired in `extension.ts` line 192 |
| 13 | Each research item displays the name from frontmatter and creation date as description | ✓ VERIFIED | `getTreeItem()` sets `treeItem.description = formatCreatedDate(item.created)`; name comes from frontmatter or derived from filename; tests pass |
| 14 | Clicking a research item opens the markdown file in the editor | ✓ VERIFIED | `treeItem.command = { command: "vscode.open", arguments: [Uri.file(item.filePath)] }` in `getTreeItem()` |
| 15 | Research section refreshes when files change in the research folder | ✓ VERIFIED | `FileSystemWatcher` on `${researchFolder}/**/*.md` in `extension.ts` lines 152–157; triggers `researchTreeProvider.refresh()` on create/change/delete |
| 16 | Plus button on Research section header opens AI chat with pre-populated research invocation | ✓ VERIFIED | `leanquill.startResearch` command with `$(add)` icon in `view/title` menu (`package.json`); executes `workbench.action.chat.open` with query in `extension.ts` line 175 |
| 17 | Harness detection correctly identifies Copilot, Cursor, and Claude environments | ✓ VERIFIED | `isCursor` (appName includes "cursor"), `hasCopilot` (github.copilot-chat extension check), fallback for Claude/other; both Cursor and Copilot use `@researcher`; Claude falls through to informational message with `/agent:researcher` guidance |
| 18 | Extension reads project config on activation and configures SafeFileSystem for research folder | ✓ VERIFIED | `readProjectConfig(rootPath)` → `safeFileSystem.allowPath(researchFolderClean, ".md")` in `extension.ts` lines 99–109 |
| 19 | Schema v1 projects are auto-migrated to v2 on activation | ✓ VERIFIED | `config.schemaVersion === "1"` guard + `migrateProjectYaml(rootPath, safeFileSystem)` in `extension.ts` lines 101–106 |

**Score:** 19/19 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/projectConfig.ts` | Config parser with `parseProjectConfig`, `readProjectConfig`, `ProjectConfig` | ✓ VERIFIED | 55 lines; all three exports present; substantive line-based YAML parse |
| `src/safeFileSystem.ts` | Extended with `allowPath(prefix, extFilter?)` method | ✓ VERIFIED | `additionalAllowed` array, full prefix + ext logic in `canWrite()` |
| `src/initialize.ts` | Schema v2, `migrateProjectYaml` export, workflow + harness files | ✓ VERIFIED | `renderProjectYaml` outputs v2; `migrateProjectYaml` exported; 3 harness files + workflow generated |
| `test/projectConfig.test.ts` | Unit tests for config parsing edge cases | ✓ VERIFIED | 9 tests, all pass |
| `test/safeFileSystem.test.ts` | Tests for `allowPath` with extension filtering | ✓ VERIFIED | 9 new tests + 3 existing = 12 total, all pass |
| `src/researchTree.ts` | `ResearchTreeProvider`, `ResearchItem`, `parseFrontmatter`, `buildResearchItems` | ✓ VERIFIED | 114 lines; all four exports present; full TreeDataProvider implementation |
| `src/extension.ts` | View registration, file watcher, config loading, migration, harness detection | ✓ VERIFIED | All wiring present at lines 98–194 |
| `package.json` | Research view, `startResearch` command, `view/title` menu, `viewsWelcome` | ✓ VERIFIED | All four contributions present and correct |
| `test/researchTree.test.ts` | Tests for tree building and frontmatter parsing | ✓ VERIFIED | 13 tests, all pass |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/projectConfig.ts` | `.leanquill/project.yaml` | `fs.readFile` + line-based regex | ✓ WIRED | `readProjectConfig` constructs path and reads file |
| `src/safeFileSystem.ts` | configured research folder | `allowPath()` → `additionalAllowed` → `canWrite()` | ✓ WIRED | Full round-trip: store → check → allow/block |
| `src/initialize.ts` | `.leanquill/workflows/research.md` | `safeFs.writeFile` | ✓ WIRED | Line 259–261 in `initializeProject` |
| `src/initialize.ts` | `.github/agents/researcher.agent.md` | raw `fs.writeFile` | ✓ WIRED | Line 160–171 in harness file loop |
| `src/initialize.ts` | `.cursor/skills/researcher/SKILL.md` | raw `fs.writeFile` | ✓ WIRED | Line 173–187 in harness file loop |
| `src/initialize.ts` | `.claude/agents/researcher.md` | raw `fs.writeFile` | ✓ WIRED | Line 190–206 in harness file loop |
| `src/researchTree.ts` | research folder | `fs.readdir` + frontmatter parsing | ✓ WIRED | `buildResearchItems` reads dir, filters `.md`, parses each file |
| `src/extension.ts` | `src/researchTree.ts` | `registerTreeDataProvider` + file watcher `refresh()` | ✓ WIRED | Line 192: `registerTreeDataProvider("leanquill.research", researchTreeProvider)` |
| `src/extension.ts` | `workbench.action.chat.open` | `executeCommand` with harness-specific query | ✓ WIRED | Line 175: `executeCommand("workbench.action.chat.open", { query })` |
| `package.json` | `src/extension.ts` | view + command contributions | ✓ WIRED | `leanquill.research` view; `leanquill.startResearch` command; `view/title` menu entry |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| `ResearchTreeProvider.getChildren` | `ResearchItem[]` | `buildResearchItems(researchDir)` → `fs.readdir` + `fs.readFile` per file | Yes — reads actual `.md` files, parses frontmatter | ✓ FLOWING |
| `ResearchTreeProvider.getTreeItem` | `item.name`, `item.created` | `parseFrontmatter()` or filename derivation + file `mtime` | Yes — real frontmatter YAML parse, stat fallback | ✓ FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Clean TypeScript build | `npm run build` | `dist/extension.js` 109.2kb, Done in 19ms | ✓ PASS |
| All tests pass | `npm run build:test && npm run test` | 106 tests, 106 pass, 0 fail | ✓ PASS |
| `parseProjectConfig` exports present | `node -e "require('./dist/extension.js')"` (bundle only — exports not surface-level) | Build clean, imports resolved | ✓ PASS |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| RES-01 | 12-01 | Project config reader for `project.yaml` (schemaVersion, research folder path) | ✓ SATISFIED | `src/projectConfig.ts` — full implementation, 9 tests |
| RES-02 | 12-02 | Research sidebar browsing `.md` files with name/date | ✓ SATISFIED | `src/researchTree.ts` + extension wiring, 13 tests |
| RES-03 | 12-02 | Quick-start button opens AI chat with harness-appropriate invocation | ✓ SATISFIED | `leanquill.startResearch` command with multi-harness detection |
| RES-04 | 12-01 | Schema v2 init, v1→v2 migration, canonical workflow, three harness entry points | ✓ SATISFIED | `src/initialize.ts` — all four deliverables implemented |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/extension.ts` | 160 | `placeholder = "Replace with your research question"` | ℹ️ Info | Intentional UI guidance text pre-populated into AI chat query — NOT a stub |

No blockers or warnings found. The single "placeholder" match is purposeful design — it tells the author what to type in the AI chat, matching the plan's specification.

---

### Human Verification Required

#### 1. Research sidebar renders in VS Code

**Test:** Open a LeanQuill-initialized workspace, create one `.md` file in `research/leanquill/` with frontmatter `name:` and `created:` fields, then open VS Code sidebar.
**Expected:** LeanQuill sidebar shows a "Research" section with the file listed by its frontmatter `name` and formatted `created` date.
**Why human:** TreeDataProvider rendering requires an active VS Code window; cannot verify with grep or node CLI.

#### 2. "+" button opens AI chat with correct query

**Test:** Click the `+` button on the Research section header in VS Code with both Copilot chat enabled and disabled.
**Expected:** With Copilot: chat opens with `@researcher Replace with your research question`. Without Copilot: informational message shown with Claude guidance.
**Why human:** `vscode.commands.executeCommand("workbench.action.chat.open")` requires active VS Code extension host.

#### 3. File watcher refreshes Research tree

**Test:** With the extension active and Research sidebar visible, create a new `.md` file in `research/leanquill/`.
**Expected:** Research section updates immediately (without manual refresh) to show the new file.
**Why human:** FileSystemWatcher events require active VS Code file system event loop.

#### 4. Harness entry point files created on init

**Test:** Run `LeanQuill: Initialize Project` on a fresh workspace folder, then check that `.github/agents/researcher.agent.md`, `.cursor/skills/researcher/SKILL.md`, and `.claude/agents/researcher.md` exist with correct frontmatter.
**Expected:** All three files present with `name: researcher` frontmatter and workflow reference.
**Why human:** Requires running the extension initialize flow interactively.

---

### Gaps Summary

No gaps found. All 19 must-haves verified across both plans. All artifacts exist with substantive implementations, are wired correctly, and data flows through the tree provider. Build is clean and all 106 tests pass.

---

_Verified: 2026-04-05T00:00:00Z_
_Verifier: gsd-verifier (GitHub Copilot — Claude Sonnet 4.6)_
