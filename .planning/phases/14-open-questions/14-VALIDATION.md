---
phase: 14
slug: open-questions
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-10
---

# Phase 14 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in `node:test` + `node:assert/strict` |
| **Config file** | none — conventions in `test/*.test.ts` |
| **Quick run command** | `npm run build:test && node --test dist-test/<file>.test.js` |
| **Full suite command** | `npm run build:test && npm test` |
| **Estimated runtime** | ~30–90 seconds (project-dependent) |

---

## Sampling Rate

- **After every task commit:** Run `npm run build:test && node --test dist-test/<touched>.test.js`
- **After every plan wave:** Run `npm run build:test && npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| TBD | 01 | 1 | ISSUE-01 (partial) | unit | `npm run build:test && node --test dist-test/openQuestionStore.test.js` | ❌ W0 | ⬜ pending |
| TBD | 01 | 1 | ISSUE-02 (partial) | unit | status enum tests in store or pure helpers | ❌ W0 | ⬜ pending |
| TBD | 02+ | 2+ | D-03 (chapter counts) | unit | `openQuestionChapterCounts` or extended `chapterStatus` tests | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `test/openQuestionStore.test.ts` — ISSUE-01 partial (parse/serialize, associations, statuses)
- [ ] `test/openQuestionChapterCounts.test.ts` (or merged) — D-03 counting + path normalization
- [ ] Adjust `test/chapterStatus.test.ts` if `writeChapterStatusEntry` behavior changes
- [ ] `npm run build` after TS changes — existing CI expectation

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|---------------------|
| Planning tab + bottom panel visual parity | D-01, D-02 | Webview rendering in two hosts | Open both surfaces; confirm list/detail layout and typography match; exercise create from context menu on tree row and editor selection |
| Navigate to manuscript selection | Success criterion 3 | Editor selection + stale `span_hint` UX | Create question from selection; navigate; edit chapter text to break anchor; confirm graceful open + stale indicator |
| Immediate list refresh after status change | Success criterion 4 | Full extension host | Change status in detail; confirm list row updates without reload |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
