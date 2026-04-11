---
phase: 8
slug: issue-capture-triage-and-editor-signals
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-10
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Derived from `08-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in test runner (`node:test`) |
| **Config file** | none — tests in `test/*.test.ts`, compiled to `dist-test/` |
| **Quick run command** | `npm run build:test && npm test` |
| **Full suite command** | `npm run build:test && npm test` |
| **Estimated runtime** | ~30–90 seconds (grows with new tests) |

---

## Sampling Rate

- **After every task commit:** `npm run build:test && npm test` (or targeted `node --test dist-test/<file>.test.js` when only one module changed)
- **After every plan wave:** `npm run build:test && npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| (planner fills) | 01 | 1 | ISSUE-01 | unit | `npm run build:test && npm test` | ⬜ | ⬜ pending |

*Planner: replace rows after PLAN.md tasks are numbered. Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `test/issueMigration.test.ts` — v3 migration idempotency, `open-questions` → `issues/question/`, conflict cases
- [ ] `test/issueFilters.test.ts` — D-06 default filter (open+deferred) vs dismissed/all matrix
- [ ] `test/spanHintResolve.test.ts` — fragment search, stale detection, fuzzy bounds per PLAN
- [ ] Extend `test/openQuestionChapterCounts.test.ts` — sidebar **X Issues** uses agreed active count (open+deferred vs open-only)
- [ ] Extend `test/openQuestionStore.test.ts` — dismissed + `dismissed_reason`, `issues/` paths, unified types

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|---------------------|
| Gutter decoration visibility + theme | ISSUE-04 | Requires VS Code UI + extension host | Open manuscript with `span_hint` issues; confirm glyph + tooltip; theme switch light/dark |
| Gutter click → QuickPick vs direct nav | ISSUE-04 / D-12 | Decoration click API uncertain per research spike | Stack multiple issues at anchor; single issue; verify navigation targets issue file |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter after Wave 0 green

**Approval:** pending
