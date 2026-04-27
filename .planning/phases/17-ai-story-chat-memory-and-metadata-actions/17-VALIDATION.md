---
phase: 17
slug: ai-story-chat-memory-and-metadata-actions
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-25
updated: 2026-04-25
---

# Phase 17 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | node:test |
| **Config file** | package.json |
| **Quick run command** | `npm run build:test` |
| **Full suite command** | `npm run build:test && npm test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run build:test`
- **After every plan wave:** Run `npm run build:test && npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 17-01-T1 | 17-01 | 1 | D-01/D-02/D-03 | unit | `npm run build:test && npm test` | `test/storyChatContext.test.ts` planned | pending |
| 17-01-T2 | 17-01 | 1 | D-01/D-12 | unit | `npm run build:test && npm test` | `test/harnessChatDraft.test.ts` planned | pending |
| 17-02-T1 | 17-02 | 2 | D-05/D-06/D-08 | unit | `npm run build:test && npm test` | `test/storyMemoryStore.test.ts` planned | pending |
| 17-02-T2 | 17-02 | 2 | D-04/D-07/D-15 | unit | `npm run build:test && npm test` | `test/storyChatLogStore.test.ts` planned | pending |
| 17-03-T1 | 17-03 | 3 | D-09/D-10/D-13/D-16 | unit | `npm run build:test && npm test` | `test/metadataActionContract.test.ts` planned | pending |
| 17-03-T2 | 17-03 | 3 | D-15 | unit | `npm run build:test && npm test` | `test/metadataActionLog.test.ts` planned | pending |
| 17-03-T3 | 17-03 | 3 | D-09/D-11/D-13/D-15/D-16 | unit/integration-lite | `npm run build:test && npm test` | `test/metadataActionApplier.test.ts` planned | pending |
| 17-04-T1 | 17-04 | 4 | D-04/D-07/D-12 | static unit | `npm run build:test && npm test` | `test/storyChatWorkflow.test.ts` planned | pending |
| 17-04-T2 | 17-04 | 4 | D-12 | static unit | `npm run build:test && npm test` | `test/storyChatWorkflow.test.ts` planned | pending |
| 17-05-T1 | 17-05 | 4 | D-01/D-02/D-03 | static unit + build; asserts shared base context paths on every contextual launch and target metadata for issue/chapter/thread/theme | `npm run build:test && npm test && npm run build` | `test/storyChatExtensionCommands.test.ts` planned | pending |
| 17-05-T2 | 17-05 | 4 | D-04/D-07/D-11/D-14/D-15 | static unit + build | `npm run build:test && npm test && npm run build` | `test/storyChatExtensionCommands.test.ts` planned | pending |
| 17-05-T3 | 17-05 | 4 | D-01/D-04/D-07/D-13/D-14 | manifest check + build; includes issue/chapter/thread/theme menu wiring or tested fallback command metadata | `node -e "const p=require('./package.json'); const ids=p.contributes.commands.map(c=>c.command); for (const id of ['leanquill.startStoryChat','leanquill.applyMetadataAction','leanquill.saveStoryChatSummary','leanquill.openStoryMemory','leanquill.chatAboutSelection','leanquill.chatAboutTheme']) { if(!ids.includes(id)) process.exit(1); } console.log('ok');" && npm run build` | `package.json` existing | pending |
| 17-06-T1 | 17-06 | 5 | Phase 17 success criteria + Phase 9/10 dependency gate | dependency gate + full automated gate | `npm run build:test && npm test && npm run build` | full suite planned | pending |
| 17-06-T2 | 17-06 | 5 | Phase 17 success criteria + Phase 9/10 dependency gate | manual checkpoint with automated prerequisite and dependency blocker surfaced | `npm run build:test && npm test && npm run build` | Extension Development Host manual | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [x] Planner added concrete test files for story chat contracts, memory persistence, metadata action validation/application, workflow generation, extension command wiring, and package manifest checks.
- [x] Planner included manual extension-host checks for VS Code chat, QuickPick, command palette, metadata action application, and file persistence behavior that cannot run in the current node:test harness.

*Existing infrastructure covers unit-level tests; extension-host UI checks remain manual unless the plan adds a harness.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Phase 9/10 dependency gate | Phase 17 roadmap dependency | Execution readiness depends on earlier roadmap phases, not only Phase 17 code | Before final Phase 17 verification, confirm Phase 9 and Phase 10 are complete; if not, report `Phase 17 is not runnable until Phase 9 and Phase 10 are complete.` |
| Extension-host story chat UX | Phase 17 success criterion 1 | Current automated harness runs outside VS Code extension host | Use F5 Extension Development Host after Phase 9/10 completion and verify the chat flow answers story questions without modifying manuscript prose. |
| Cross-environment metadata action handoff | Phase 17 success criterion 3 | Cursor/Copilot approval surfaces differ by host | Run the generated workflow contract from at least one supported harness and verify the extension applies only accepted metadata actions. |
| Active memory and base indexes in chat draft | D-02/D-04/D-07 | Chat provider draft content is opened through VS Code UI and is not available to node:test | Create or seed active `.leanquill/memory/`, run `LeanQuill: Start Story Chat`, and verify the draft lists active story memory plus `.leanquill/project.yaml`, `.leanquill/outline-index.json`, and `.leanquill/chapter-status-index.json` without manuscript prose. |
| Bounded selection chat | D-03 | Requires editor selection and chat UI inspection | Select a short chapter range, run `Chat about selection`, and verify the draft includes chapter identity plus only the selected excerpt/range. |
| Post-chat summary persistence | D-04/D-07 | Command UX and file opening are extension-host behavior | Run `LeanQuill: Save Story Chat Summary` with valid summary JSON and verify `.leanquill/chats/` and `.leanquill/memory/` files are written. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** ready for execution
