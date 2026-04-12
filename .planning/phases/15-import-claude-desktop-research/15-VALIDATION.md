---
phase: 15
slug: import-claude-desktop-research
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-11
---

# Phase 15 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in test runner (`node:test`) |
| **Config file** | none — `package.json` scripts + esbuild bundle of `test/*.test.ts` |
| **Quick run command** | `npm test` |
| **Full suite command** | `npm run build:test && npm test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test`
- **After every plan wave:** Run `npm run build:test && npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 15-01-01 | 01 | 1 | CONTEXT D-04–D-06 | unit + grep | `npm test` + manual grep | ✅ | ⬜ pending |
| 15-01-02 | 01 | 1 | CONTEXT D-06 | grep | `grep -r import-external-research .planning` N/A — verify in `initialize.ts` / book fixture | ⬜ W0 | ⬜ pending |
| 15-02-01 | 02 | 2 | CONTEXT D-01–D-03 | unit | `npm test` (`harnessDraft` or equivalent) | ⬜ W0 | ⬜ pending |
| 15-02-02 | 02 | 2 | CONTEXT D-05 | grep | `package.json` contains `leanquill.startImportResearch` | ✅ | ⬜ pending |
| 15-03-01 | 03 | 3 | CONTEXT D-05 | manual UAT | Cursor / Copilot / Claude chat matrices in RESEARCH.md | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `test/harnessDraft.test.ts` (or agreed name) — pure-function tests for research vs import draft query strings
- [ ] Existing `npm run build:test` + `npm test` pipeline — no new framework

*If none: "Existing infrastructure covers all phase requirements."* — **False:** add harness draft unit tests per RESEARCH.md.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Import opens chat, message not sent | D-01, D-02 | VS Code chat UI | Click Research Import; confirm prefilled query; confirm Send not pressed |
| Agent reads import workflow | D-06 | Product harness | Invoke LeanQuill-Import-Research; confirm it references `.leanquill/workflows/import-external-research.md` |
| Saved `.md` in `folders.research` | D-07, D-11 | End-to-end + file IO | Complete import; open file; confirm frontmatter keys |
| Collision / no overwrite | D-12 | Agent + FS | Two imports same slug/date; distinct filenames |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
