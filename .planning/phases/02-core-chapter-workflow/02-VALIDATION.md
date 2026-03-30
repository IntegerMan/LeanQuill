---
phase: 2
slug: core-chapter-workflow
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-29
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in test runner (`node --test`) |
| **Config file** | none — test files discovered via `dist-test/**/*.test.js` |
| **Build command** | `npm run build && npm run build:test` |
| **Quick run command** | `npm test` |
| **Full suite command** | `npm run build && npm run build:test && npm test` |
| **Estimated runtime** | ~3 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run build` (TypeScript compile check)
- **After every plan wave:** Run `npm run build && npm run build:test && npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | CHAP-01, CHAP-03 | compile | `npm run build` | ✅ | ⬜ pending |
| 02-01-02 | 01 | 1 | CHAP-01, CHAP-03 | unit | `npm test` | ❌ W0 | ⬜ pending |
| 02-02-01 | 02 | 2 | CHAP-01, CHAP-02 | compile + grep | `npm run build && grep -r "leanquill.chapters" dist/extension.js` | ❌ W0 | ⬜ pending |
| 02-03-01 | 03 | 2 | CHAP-04 | compile + grep | `npm run build && grep -r "leanquill.chapterContext" dist/extension.js && grep -r "Content-Security-Policy" src/chapterContextPane.ts` | ❌ W0 | ⬜ pending |
| 02-04-01 | 04 | 3 | CHAP-01–04 | compile + grep | `npm run build && grep -r "updateChapterStatus" dist/extension.js && grep -r "onDidChangeActiveTextEditor" dist/extension.js` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `test/chapterStatus.test.ts` — stubs for status read/write, invalid coercion, default behavior
- [ ] `test/chapterTree.test.ts` — stubs for tree item generation, Not Included group, missing placeholder

*Existing `test/chapterOrder.test.ts` and `test/safeFileSystem.test.ts` cover Phase 1 behaviors and should remain green.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Single-click opens chapter in preview tab | CHAP-02 | VS Code tab behavior requires live extension host | Open extension in debugger (`F5`), click chapter in tree — verify preview tab opens |
| Double-click pins the preview tab | CHAP-02 / D-06 | VS Code tab pinning is UI-only | Click same chapter twice — verify tab title loses italics |
| Context menu → status quick pick appears | CHAP-03 | Requires running extension host | Right-click chapter row, confirm "LeanQuill: Update Chapter Status" option appears, all 7 statuses listed |
| Status update immediately reflects in tree | CHAP-03 | Requires live file system + tree refresh | Change status → confirm tree badge/description updates without reload |
| Switching to chapter file refreshes context pane | CHAP-04 | Requires `onDidChangeActiveTextEditor` in live host | Open editor with two chapters → switch between files → verify context pane updates |
| "Not Included" group appears for orphan files | D-16 | Requires real workspace folder | Copy an extra `.md` to `manuscript/` that is not in `Book.txt` → verify it appears under "Not Included" |
| Missing file shows warning icon (no crash) | D-13 | Requires real workspace + file deletion | Remove a chapter file referenced in `Book.txt` → tree shows warning row, extension does not crash |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
