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
| 10-00-01 | 00 | 0 | AIR-01, AIR-02, AIR-03, ISSUE-05 | validation map | `rg -n "10-00-01\|10-04-03\|10-05-03\|10-06-02" .planning/phases/10-ai-review-and-advisory-workflows/10-VALIDATION.md` | ✅ existing | ⬜ pending |
| 10-00-02 | 00 | 0 | AIR-01, AIR-02, AIR-03, ISSUE-05 | test scaffold | `npm run build:test && npm test` | ❌ W0 | ⬜ pending |
| 10-01-01 | 01 | 1 | AIR-01, AIR-02, AIR-03 | unit/contract | `npm run build:test && npm test` | ❌ `test/aiReviewSessionStore.test.ts` | ⬜ pending |
| 10-01-02 | 01 | 1 | AIR-01, AIR-02, AIR-03 | unit/contract | `npm run build:test && npm test` | ✅ `test/storyChatLogStore.test.ts` | ⬜ pending |
| 10-02-01 | 02 | 2 | AIR-01, AIR-02 | unit/workflow | `npm run build:test && npm test` | ❌ `test/aiReviewWorkflow.test.ts` | ⬜ pending |
| 10-02-02 | 02 | 2 | AIR-01, AIR-02 | unit/workflow | `npm run build:test && npm test` | ❌ `test/aiReviewWorkflow.test.ts` | ⬜ pending |
| 10-03-01 | 03 | 2 | AIR-03, ISSUE-05 | unit/context | `npm run build:test && npm test` | ✅ `test/storyChatContext.test.ts` | ⬜ pending |
| 10-03-02 | 03 | 2 | ISSUE-05 | webview protocol/static | `npm run build:test && npm test` | ❌ `test/openQuestionsHtml.test.ts` | ⬜ pending |
| 10-04-01 | 04 | 3 | AIR-01 | command/static | `npm run build:test && npm test` | ✅ `test/storyChatExtensionCommands.test.ts` | ⬜ pending |
| 10-04-02 | 04 | 3 | AIR-01 | manifest/static | `npm run build:test && npm test` | ✅ `test/storyChatExtensionCommands.test.ts` | ⬜ pending |
| 10-04-03 | 04 | 3 | AIR-01 | unit/command/static | `npm run build:test && npm test` | ❌ `test/aiReviewWorkflow.test.ts`, `test/aiReviewSessionStore.test.ts` | ⬜ pending |
| 10-05-01 | 05 | 4 | AIR-02 | command/static | `npm run build:test && npm test` | ✅ `test/storyChatExtensionCommands.test.ts` | ⬜ pending |
| 10-05-02 | 05 | 4 | AIR-02 | unit/contract | `npm run build:test && npm test` | ❌ `test/aiReviewWorkflow.test.ts`, ✅ `test/metadataActionLog.test.ts` | ⬜ pending |
| 10-05-03 | 05 | 4 | AIR-02 | unit/integration | `npm run build:test && npm test` | ✅ `test/metadataActionContract.test.ts`, ✅ `test/metadataActionApplier.test.ts` | ⬜ pending |
| 10-06-01 | 06 | 5 | AIR-01, AIR-02, AIR-03, ISSUE-05 | full automated gate | `npm run build:test && npm test && npm run build` | n/a | ⬜ pending |
| 10-06-02 | 06 | 5 | AIR-01, AIR-02, AIR-03, ISSUE-05 | manual UAT checkpoint | `npm run build:test && npm test && npm run build` | n/a | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Wave 0 plan must add automated coverage targets for AI review artifact contracts, advisory-only chat prompts, issue chat context assembly, session finding promotion, review finalization, and metadata action generation/application.
- [ ] Wave 0 plan must preserve existing test infrastructure and avoid watch-mode commands.
- [ ] Keep `nyquist_compliant: false` and `wave_0_complete: false` until implementation tasks replace any Wave 0 TODO scaffolds with active assertions and the full automated gate is green.

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
