---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
current_phase: 08
status: executing
stopped_at: Completed 08-04-PLAN.md
last_updated: "2026-04-11T01:55:21.708Z"
progress:
  total_phases: 15
  completed_phases: 8
  total_plans: 36
  completed_plans: 33
---

# Project State: LeanQuill

**Current phase:** 08
**Status:** Ready to execute

## Project Reference

- Core value: Keep LeanPub authors fully inside VS Code with chapter status, issue workflows, and knowledge context while preserving manuscript immutability.
- Current focus: Establish Track 1 standalone author workflow before layering Track 2 AI workflows.
- Milestone: v1.0
- Granularity: Standard

## Current Position

Phase: 08 (issue-capture-triage-and-editor-signals) — EXECUTING
Plan: 4 of 5

- Phase 6 (Threads and Themes) already **complete** (2026-04-09)
- **Next:** Phase 7 — Global Knowledge Reference (not started)
- Overall progress: **9/14** roadmap phases complete (1–6, 12–14)
- Progress bar: [========----] ~62%

## Phase Status

| Phase | Name | Status | Completed |
|-------|------|--------|-----------|
| 1 | Foundation and Safe Init | Completed | 2026-03-29 |
| 2 | Core Chapter Workflow | Completed | 2026-03-30 |
| 3 | Outline and Beat Planning | Completed | 2026-04-05 |
| 4 | Character Reference | Completed | 2026-04-09 |
| 5 | Place and Setting Reference | Completed | 2026-04-09 |
| 6 | Threads and Themes | Completed | 2026-04-09 |
| 7 | Global Knowledge Reference | Not Started | - |
| 8 | Issue Capture, Triage, and Editor Signals | In Progress | - |
| 9 | AI Safety Rails and Persona Baseline | Not Started | - |
| 10 | AI Review and Advisory Workflows | Not Started | - |
| 11 | Outline and Card Usability Improvements | Not Started | - |
| 12 | Standardized Research Workflow and Results Repository | Completed | 2026-04-07 |
| 13 | LeanPub Workspace Initialization | Completed (UAT) | 2026-04-09 |
| 14 | Open Questions | Completed | 2026-04-10 |

## Performance Metrics

| Metric | Value |
|--------|-------|
| v1 requirements total | 24 |
| Requirements mapped | 24 |
| Coverage | 100% |
| Completed phases | 9 |
| Blockers | 0 |
| Phase 13 P01 | 12min | 2 tasks | 2 files |
| Phase 05-place-and-setting-reference P01 | 20min | 3 tasks | 6 files |
| Phase 05-place-and-setting-reference P02 | 28min | 3 tasks | 3 files |
| Phase 05-place-and-setting-reference P03 | 25min | 2 tasks | 2 files |
| Phase 05-place-and-setting-reference P04 | 18min | 2 tasks | 2 files |
| Phase 08 P01 | 25min | 3 tasks | 9 files |
| Phase 08-issue-capture-triage-and-editor-signals P02 | 40min | 3 tasks | 14 files |
| Phase 08 P04 | 20min | 3 tasks | 8 files |

## Decisions Log

| Date | Decision | Context |
|------|----------|---------|
| 2026-03-29 | Two-track MVP (Track 1 author workflow first, Track 2 AI second) | Design decision from brainstorming |
| 2026-03-29 | VS Code LM API only - no external keys in v1 | Config decision |
| 2026-03-29 | TypeScript + esbuild bundling | Tech stack decision |
| 2026-03-29 | Manuscript write-block at tool + SafeFileSystem level | Safety architecture decision |
| 2026-03-29 | PLAN-01 Scrivener-style outline isolated into its own phase | Sequencing decision due to webview complexity |
| 2026-03-30 | Character, Place, and Thread phases inserted after Phase 3 | Phase 3 discuss-phase: user wants dedicated planning workspace tabs per domain |
| 2026-04-09 | PLACE-01 not marked complete after 05-01 | Data layer only; UI, scans, and extension wiring remain in 05-02–05-04 |
| 2026-04-10 | PLACE-01 still open after 05-02 | Hybrid scans landed; Places webview and extension wiring remain in 05-03–05-04 |
| 2026-04-10 | Scoped character webview listeners to the Characters tab panel | Places tab reuses `char-*` layout; avoids duplicate `.char-container` capturing clicks |
| 2026-04-10 | Split 05-03 commits: minimal `_renderPanel` wiring in task 1 | `renderPlanningHtml` signature needs TS call site so `npm run build` stays green |
| 2026-04-10 | OpenQuestionRecord supports `dismissed` and optional `dismissedReason` | Phase 08-01 ISSUE-02 tests and issue-schema alignment |
| 2026-04-10 | Chapter sidebar counts use open + deferred (D-06) in `countOpenQuestionsByChapter` | Phase 08-01; deferred no longer excluded from per-chapter active counts |
| 2026-04-11 | Issue v3 marker `.leanquill/issues/.migration-v3-complete.json` for idempotent layout migration | Phase 08-02 |
| 2026-04-11 | Migration conflicts: numeric suffix rename + `console.warn`; never overwrite existing `issues/question` files | Phase 08-02 |
| 2026-04-10 | ResearchTreeProvider takes `workspaceRoot` for `listOpenQuestions` while `researchDir` still lists research `.md` files | Phase 08-04 D-09 counts |
| 2026-04-10 | `countActiveQuestionsLinkedToEntity` is canonical; `countOpenQuestionsLinkedToEntity` kept as compatibility alias | Phase 08-04 entity sidebar counts |

## Accumulated Context

- Track 1 must be independently valuable and fully usable without AI.
- Chapter workflow is scheduled before knowledge pane to de-risk data dependencies.
- Issue tracking and gutter decorations are grouped to keep triage and editor feedback coherent.
- AI phases are sequenced after write-block and tool-contract safety baseline.

### Roadmap Evolution

- Phase 11 added: Make the outline and card views more usable with the ability to insert, remove, and reorder cards. The outline should also support changing hierarchy structures like we can in the sidebar.
- Phase 12 added: add the ability to run research in standardized ways and collect research results in a dedicated research folder next to the manuscript.
- Phase 14 added: Open Questions — author-created open-question notes linked to book, characters, threads, places, or manuscript selections with issues list, navigation, and status management. Stepping stone toward full Issue Capture (Phase 8).

## Session Continuity

- Last updated: 2026-04-11
- Next checkpoint: `/gsd-discuss-phase 7` or `/gsd-plan-phase 7` for Global Knowledge Reference; optional `/gsd-verify-work 5` for conversational UAT

Last session: 2026-04-11T01:55:21.698Z
Stopped at: Completed 08-04-PLAN.md
