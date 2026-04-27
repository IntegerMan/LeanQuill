---
phase: 09
slug: ai-safety-rails-and-persona-baseline
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-25
---

# Phase 09 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Derived from `09-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js `node:test` + `node:assert/strict` |
| **Config file** | `package.json` scripts; `esbuild` bundles tests to `dist-test/` |
| **Quick run command** | `npm run build:test && npm test` |
| **Full suite command** | `npm run build:test && npm test` |
| **Estimated runtime** | ~30–90 seconds |

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
| *TBD* | *TBD* | *TBD* | PER-01 | unit | `npm run build:test && npm test` | ⬜ after impl | ⬜ pending |

*Fill rows when PLAN.md tasks exist. Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `test/personaStore.test.ts` — persona load/validate/resolve (PER-01 core)
- [ ] Extend or add `test/projectConfig.test.ts` (if present) or equivalent — `active_personas` parsing
- [ ] Init / scaffold coverage for three default files under `.leanquill/personas/` (new or extended test)

*Existing infrastructure: `metadataActionContract.test.ts`, `safeFileSystem.test.ts` — extend if Phase 9 changes behavior.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test instructions |
|----------|-------------|------------|-------------------|
| Warning UX (toast + output channel) for invalid/missing personas | D-15 | VS Code UI | F5 Extension Host: project with broken persona + enabled entry → observe toast and Output channel |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
