---
phase: 10
slug: ai-review-and-advisory-workflows
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-25
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | node:test bundled with esbuild |
| **Config file** | `package.json`, `tsconfig.test.json`, `test/run-tests.cjs` |
| **Quick run command** | `npm run build:test && npm test` |
| **Full suite command** | `npm run build:test && npm test` |
| **Estimated runtime** | ~20 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run build:test && npm test`
- **After every plan wave:** Run `npm run build:test && npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 20 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 10-01-01 | 01 | 0 | AIR-01, AIR-02, AIR-03, ISSUE-05 | unit/contract | `npm run build:test && npm test` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Wave 0 plan must add automated coverage for AI review artifact contracts, advisory-only chat prompts, issue chat context assembly, and metadata action generation.
- [ ] Wave 0 plan must preserve existing test infrastructure and avoid watch-mode commands.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| VS Code LM chat invocation and command UX | AIR-01, AIR-02, AIR-03, ISSUE-05 | Requires Extension Development Host and an active VS Code LM/Copilot-capable session | Launch the extension with F5, run chapter review, issue chat, and story intelligence commands from their intended UI entry points, then verify persisted `.leanquill/` artifacts and no manuscript file changes. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 20s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
