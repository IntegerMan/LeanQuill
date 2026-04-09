---
phase: 06
slug: threads-and-themes
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-09
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in test runner (`node --test`) |
| **Config file** | `package.json` scripts (`build`, `build:test`, `test`) |
| **Quick run command** | `npm run build` |
| **Full suite command** | `npm run build && npm run build:test && npm test` |
| **Estimated runtime** | ~30–90 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run build`
- **After every plan wave:** Run `npm run build && npm run build:test && npm test` (skip `build:test`/`test` if no test files changed)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| *TBD by planner* | *TBD* | *TBD* | THREAD-01 | unit / manual | `npm run build` / Extension Host | ⬜ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Extend `test/characterStore.test.ts` patterns for `threadStore` (or new `test/threadStore.test.ts`)
- [ ] `test/themesStore.test.ts` (or equivalent) for `themes.yaml` parse/serialize
- [ ] `test/projectConfig.test.ts` — `folders.threads` parsing
- [ ] Existing `npm run build:test` pipeline covers new tests

*Planner fills concrete file paths per PLAN.md tasks.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Planning webview Themes tab | THREAD-01 | VS Code webview + Extension Host | Open Planning Workspace; edit themes form; reload; confirm `.leanquill/themes.yaml` |
| Planning webview Threads tab + chapter picker | THREAD-01 | Webview UX | CRUD threads; picker lists only manuscript chapter files; `touchesChapters` persists |
| Manuscript immutability | PROJECT safety | Integration | Confirm Threads/Themes actions never write under `manuscript/` |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
