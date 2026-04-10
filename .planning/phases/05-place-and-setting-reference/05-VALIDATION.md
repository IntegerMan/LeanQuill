---
phase: 5
slug: place-and-setting-reference
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-09
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in `node:test` |
| **Config file** | `package.json` scripts `build:test` + `test` |
| **Quick run command** | `npm run build:test && npm test` |
| **Full suite command** | `npm run build:test && npm test` |
| **Estimated runtime** | ~30–90 seconds (depends on suite growth) |

---

## Sampling Rate

- **After every task commit:** Run `npm run build:test && npm test`
- **After every plan wave:** Run `npm run build:test && npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| TBD | 01 | 1 | PLACE-01 | unit | `npm run build:test && npm test` | ⬜ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Planner: replace TBD rows with concrete task IDs and map each plan task to a command or grep gate.*

---

## Wave 0 Requirements

- [ ] `test/placeStore.test.ts` — stubs for PLACE-01 (mirror `characterStore.test.ts`)
- [ ] Extend `test/projectConfig.test.ts` — `folders.settings` parsing
- [ ] `test/fixtures/` or shared `OutlineIndex` JSON for beat-scan unit tests

*Existing infrastructure: `node:test` + esbuild test bundle; no new framework install.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Places tab list/detail UX in VS Code webview | PLACE-01 | Webview + theme integration | Open planning workspace → Places tab → create place, edit fields, confirm grouping by region and chapter/beat refs |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
