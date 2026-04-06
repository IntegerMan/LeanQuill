---
plan: 12-01
phase: 12-standardized-research
status: complete
completed: 2026-04-05
commits:
  - 350b46e feat(12-01): add projectConfig reader with parseProjectConfig and readProjectConfig
  - 51b9d92 feat(12-01): extend SafeFileSystem with allowPath for dynamic write boundaries
  - 48bc586 feat(12-01): schema v2, migrateProjectYaml, canonical workflow, harness entry points
key-files:
  created:
    - src/projectConfig.ts
    - test/projectConfig.test.ts
    - src/safeFileSystem.ts (extended)
    - test/safeFileSystem.test.ts (extended)
    - src/initialize.ts (extended)
---

## Summary

Plan 12-01 delivered the foundational infrastructure for the research workflow feature.

### What was built

**Task 1 — Project Config Reader (`src/projectConfig.ts`):**
- `ProjectConfig` interface with `schemaVersion` and `folders.research`
- `parseProjectConfig(content)` — line-based YAML parser, handles v1 and v2 formats, quoted/unquoted values, sensible defaults
- `readProjectConfig(rootPath)` — reads `.leanquill/project.yaml`, returns `null` on ENOENT
- 9 unit tests covering all edge cases — all pass

**Task 2 — SafeFileSystem `allowPath` (`src/safeFileSystem.ts`):**
- `allowPath(prefix, extFilter?)` method for dynamic write boundary expansion
- Supports extension filtering: `.md` files only, or any file when no filter
- Directory paths (no extension) always allowed within the prefix
- 9 new integration tests — all pass; existing 3 tests unchanged

**Task 3 — Schema v2, Migration, Workflow, Harness Entry Points (`src/initialize.ts`):**
- `renderProjectYaml` now outputs `schema_version: "2"` and `research: research/leanquill/`
- `migrateProjectYaml(rootPath, safeFs)` — detects v1 projects and upgrades to v2; only replaces default research path (preserves user customizations); exported for extension wiring
- `initializeProject` now creates `.leanquill/workflows/research.md` with the canonical workflow (process steps, result file format, harness setup documentation)
- Three harness entry points generated on init using raw `fs.writeFile` (outside SafeFileSystem boundary): `.github/agents/researcher.agent.md`, `.cursor/skills/researcher/SKILL.md`, `.claude/agents/researcher.md`
- Existing files are never overwritten (stat check before write)

### Test results
- 93 tests total, 93 pass, 0 fail

### Self-Check: PASSED
All must_haves verified:
- ✅ parseProjectConfig extracts schemaVersion and folders.research
- ✅ readProjectConfig returns null when project.yaml is missing
- ✅ SafeFileSystem.allowPath enables writing .md files under a dynamic path prefix
- ✅ SafeFileSystem blocks non-.md files in an allowed research path
- ✅ SafeFileSystem.mkdir works for directories under an allowed path
- ✅ New projects initialize with schema_version 2 and folders.research research/leanquill/
- ✅ Existing v1 project.yaml is migrated to v2 with updated research default on activation
- ✅ Canonical workflow file created at .leanquill/workflows/research.md during init
- ✅ Copilot entry point created at .github/agents/researcher.agent.md during init
- ✅ Cursor entry point created at .cursor/skills/researcher/SKILL.md during init
- ✅ Claude entry point created at .claude/agents/researcher.md during init
