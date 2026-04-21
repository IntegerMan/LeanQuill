---
phase: 15
slug: import-claude-desktop-research
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-11
---

# Phase 15 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. **Aligned with** `15-01` … `15-04` PLAN.md automated `<verify>` steps.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in test runner (`node:test`) |
| **Config file** | none — `package.json` scripts + esbuild bundle of `test/*.test.ts` |
| **Quick run command** | `npm test` (after `npm run build:test` when `test/harnessChatDraft.test.ts` exists) |
| **Full suite command** | `npm run build:test && npm test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Plans 01–03: `npm run build`; Plan 04 Task 1: `npm run build:test && npm test`
- **After every plan wave:** Same as task-level for that wave
- **Before `/gsd-verify-work`:** Full suite (`npm run build:test && npm test`) must be green once plan 04 Task 1 lands
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 15-01-01 | 01 | 1 | CONTEXT D-04–D-06 | build + grep | `npm run build` + task acceptance `rg` | ✅ | ⬜ pending |
| 15-01-02 | 01 | 1 | CONTEXT D-06 / workflow prose | build + grep | `npm run build` + task acceptance `rg` | ✅ | ⬜ pending |
| 15-02-01 | 02 | 2 | CONTEXT D-01–D-03 | build + grep | `npm run build` + task acceptance `rg` / `node -e` JSON | ✅ | ⬜ pending |
| 15-02-02 | 02 | 2 | CONTEXT D-01–D-03 / package | build + grep | `npm run build` + `package.json` parse | ✅ | ⬜ pending |
| 15-03-01 | 03 | 3 | CONTEXT D-05 (harness trio) | build + grep | `npm run build` + task acceptance `rg` | ✅ | ⬜ pending |
| 15-03-02 | 03 | 3 | CONTEXT D-05 (drafts) | build + grep | `npm run build` + task acceptance `rg` | ✅ | ⬜ pending |
| 15-04-01 | 04 | 4 | Nyquist / pure draft logic | unit | `npm run build:test && npm test` | ⬜ plan 04 | ⬜ pending |
| 15-04-02 | 04 | 4 | Manual UAT checklist | grep + human | `rg` on `15-VERIFICATION.md` + checkpoint | ⬜ plan 04 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Unit tests (Plan 04, Wave 4)

- [ ] `test/harnessChatDraft.test.ts` — pure-function tests for `buildHarnessDraftQuery` / `buildHarnessFallbackHint` (created in **15-04-PLAN.md** Task 1, not a separate “Wave 0” plan)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Import opens chat, message not sent | D-01, D-02 | VS Code chat UI | Click Research Import; confirm prefilled query; confirm Send not pressed |
| Agent reads import workflow | D-06 | Product harness | Invoke LeanQuill-Import-Research; confirm it references `.leanquill/workflows/import-external-research.md` |
| Saved `.md` in `folders.research` | D-07, D-11 | End-to-end + file IO | Complete import; open file; confirm frontmatter keys |
| **`created` / `sources` / `query`** | D-08, D-09, D-10 | Human inspect output | Confirm imported file frontmatter matches workflow rules |
| Collision / no overwrite | D-12 | Agent + FS | Two imports same slug/date; distinct filenames |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or documented checkpoint
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] `test/harnessChatDraft.test.ts` exists after plan 04 Task 1
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter when phase complete

**Approval:** pending
