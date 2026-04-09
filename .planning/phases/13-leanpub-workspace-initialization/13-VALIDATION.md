---
phase: 13
slug: leanpub-workspace-initialization
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-08
---

# Phase 13 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in test runner (`node:test`) |
| **Config file** | none — uses `dist-test/**/*.test.js` after build |
| **Quick run command** | `npm test` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| *Planner fills per PLAN.md tasks* | — | — | INIT-01, INIT-02 | unit | `npm test` | ⬜ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] New or extended `*.test.ts` under `src/` (compiled to `dist-test/`) for scaffold helpers — paths, no-overwrite, `Book.txt` create-only rules
- [ ] Existing `npm test` pipeline covers Phase 13 pure functions where possible

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Setup `viewsWelcome` visibility | INIT-01 | VS Code UI `when` clauses | Open folder missing `manuscript/Book.txt`; confirm Setup shows initialize affordance; after scaffold, confirm state transitions |
| Planning Workspace opens on Cards tab | CONTEXT D-15 | Webview tab state | Run scaffold success path; verify Cards tab active without editor focus on chapter |

*If none: "All phase behaviors have automated verification."*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
