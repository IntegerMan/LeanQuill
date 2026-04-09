# LeanQuill

## What This Is

LeanQuill is a VS Code extension for independent authors who write books in LeanPub-style markdown/git repositories. It provides chapter-level project management, story intelligence organization (characters, settings, timelines, research notes), and AI-assisted editorial feedback — while enforcing strict manuscript immutability and keeping all project state local-first and git-native. AI may advise, never author.

## Core Value

An author working in a LeanPub markdown repo can see the status of every chapter, track and triage issues (both manually created and AI-detected), and consult living story notes — all without ever leaving VS Code and without AI touching a single manuscript file.

## Requirements

### Validated

- **INIT-01** — Validated in Phase 13: LeanPub Workspace Initialization (unified command: full init + manuscript scaffold when `project.yaml` already valid).
- **INIT-02** — Validated in Phase 13: chapter order refresh after scaffold; `Book.txt` under `manuscript/`.

### Active

<!-- Track 1: Author Workflow (MVP) -->
- [ ] **CHAP-01**: Author can view all chapters in project-defined order with per-chapter status and open issue count
- [ ] **CHAP-02**: Author can change chapter status from the chapter tree or context pane
- [ ] **CHAP-03**: Opening a chapter file auto-populates a context pane with that chapter's status, open issues, and last session notes
- [ ] **PLAN-01**: Author can access a Scrivener-style outline view with hierarchical Parts → Chapters → Beats and drag-and-drop rearranging
- [ ] **PLAN-02**: Each story beat supports per-beat fields (what/who/where/why) plus candidate/committed status
- [ ] **CHAR-01**: Author can manage character profiles in the planning workspace Characters tab with visibility into chapter/beat associations
- [ ] **PLACE-01**: Author can manage place/setting profiles in the planning workspace Places tab linked to scenes
- [ ] **THREAD-01**: Author can manage narrative threads and themes in the planning workspace Threads tab across the story structure
- [ ] **KNOW-01**: Author can view a read-only global knowledge pane (characters, settings, timeline, research) parsed from configured notes folders
- [ ] **KNOW-02**: Known entity names (characters, locations) are hyperlinked in the knowledge pane for quick navigation
- [ ] **ISSUE-01**: Author can manually create issues attached to a chapter or project-wide
- [ ] **ISSUE-02**: Author can triage issues (dismiss with optional reason, defer, view open/deferred/all)
- [ ] **ISSUE-03**: Open issues with `span_hint` references are shown as in-margin gutter indicators in the editor
- [ ] **SESS-01**: Author can close a session — recording optional chapter status change and notes for next session

<!-- Track 2: AI Review Workflows (Beta) -->
- [ ] **AI-01**: Author can trigger a chapter review via AI (right-click or chat command), producing a session issue file and chat log
- [ ] **AI-02**: Author can invoke a post-write story intelligence update — agent analyzes new chapter content and updates notes with backlinks (does not modify manuscript)
- [ ] **AI-03**: Author can right-click any issue and open a focused "Chat about this" AI conversation (agent never writes to manuscript)
- [ ] **AI-04**: All AI sessions are auto-saved as timestamped chat log files in `.leanquill/chats/`
- [ ] **AI-05**: Project supports a persona library (per-project profiles) with three packaged defaults: casual-reader, avid-genre-fan, copy-editor

### Out of Scope

- Timeline visualization — depends on inference engine; deferred to v1.5
- Character/relationship graph — builds on timeline work; deferred to v1.5
- Paragraph-level engagement heatmap — needs custom rendering layer; deferred to v1.5
- Issue consolidation agent — manual rollup sufficient in v1
- Pre-write plan review (expert realism on outlines) — needs planning-doc schema; Phase 2
- Continuity checker (cross-chapter, on-demand) — requires full manuscript context assembly; Phase 2
- Cloud sync / cloud state — local-first only; permanently out of scope
- Multi-author collaboration — out of scope for v1
- Automated git operations — explicitly forbidden by design policy
- LeanPub publishing workflow integration — LeanPub handles via git push
- Mobile / browser companion — out of scope permanently
- External API keys / non-VS Code LM providers — using VS Code Language Model API only (v1)

## Context

- **LeanPub workflow**: Authors maintain a git repo with a `manuscript/` folder of ordered markdown chapter files, a `Book.txt` ordering file, and freeform `notes/` for research/characters/settings/timeline. The tool must feel native to this layout.
- **VS Code Language Model API**: v1 uses only the VS Code LM API (GitHub Copilot or other compatible providers active in the user's session) — no separate API keys.
- **Build tooling**: TypeScript + esbuild for the extension; webviews for the Knowledge Pane and Chapter Context Pane sidebar panels.
- **Data backbone**: All state lives in `.leanquill/` inside the book repo as version-controlled markdown + YAML files. A JSON index/cache layer will support fast lookups without re-parsing markdown on every interaction.
- **Test bed**: Primary development test case is a working murder mystery book project at `C:\dev\MurderMysteryBook`.
- **Existing contracts**: Brainstorming session (2026-03-29) and data contracts (issue, chapter-status, persona, chat-log, project-config schemas) already defined in `Imported/`.
- **Distribution target**: VS Code Marketplace — extension must meet marketplace publishing requirements.
- **Design lineage**: 46 categories from a structured brainstorming session (Question Storming + Role Playing + Morphological Analysis) produced the Rank 1 selected architecture: Extension-First, Safety-Hardened Local Workflow.

## Constraints

- **Manuscript immutability**: AI agents must never write to `manuscript/` — enforced at the tool level, documented in AGENTS.md, and reflected in all agent context assembly logic.
- **Context scoping**: Review/reader agents receive manuscript-scoped context only (chapter, full manuscript, or sequential up to a boundary). Future chapters are never in context for reader agents.
- **Local-first**: No external database, no cloud sync. All state in `.leanquill/` as version-controlled files.
- **Human resolution**: AI may classify and suggest; only the author opens/closes recommendations.
- **VS Code API only**: Uses `vscode.lm` API. No external HTTP calls to AI providers in v1.
- **Organizer independence**: Hierarchy, status, and reference views must be fully usable with AI disabled or distrusted.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| VS Code extension (not standalone app) | Author stays in VS Code; no context switching; leverages existing editor surface | — Pending |
| VS Code LM API only (no external keys) | Simpler auth, works with user's existing Copilot subscription, marketplace-friendly | — Pending |
| Markdown + YAML state files (not SQLite) | Git-diffable, portable, no binary blobs, survives tool uninstall gracefully | — Pending |
| Manuscript write-block at tool level | Authorial ownership is non-negotiable; policy enforced structurally, not by convention | — Pending |
| Separate repository (not ElandApps monorepo) | Distinct audience and publish target; avoids coupling with unrelated apps | — Pending |
| TypeScript + esbuild | Fast builds, minimal config, aligns with VS Code extension best practices | — Pending |
| Two-track MVP (Author Workflow → AI Reviews) | De-risks AI dependency; Track 1 delivers standalone value; Track 2 layered on top | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-08 — Phase 13 complete; INIT-01/INIT-02 moved to Validated*
