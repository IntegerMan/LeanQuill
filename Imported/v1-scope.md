# LeanQuill — v1 Scope

**Version:** 1.0-alpha  
**Status:** Draft — pre-implementation  
**Date:** 2026-03-29  
**Repository:** TBD (to be migrated from ElandApps to dedicated LeanQuill repository)

---

## Product Summary

LeanQuill is a VS Code extension for independent authors who write in LeanPub-style markdown/git repositories. It provides chapter-level project management, story intelligence organization, and AI-assisted editorial feedback — while maintaining strict manuscript immutability and local-first, git-native project state.

---

## Design Principles (Non-Negotiable)

These constraints govern every v1 decision:

1. **AI never writes manuscript text.** All AI output is advisory: chat, recommendation files, or issue records only. Manuscript files are write-blocked from agent actions at the tool level.
2. **Context is role-scoped.** Planning agents see the full repository. Review, editing, and reader agents see manuscript content only — scoped to chapter, full manuscript, or sequential chapters up to a boundary. Future chapters are never in context for reader agents.
3. **All state is repo-native.** Issues, statuses, chat logs, and personas live as version-controlled files inside the author's book repository under `.leanquill/`. The tool has no external database.
4. **Humans own resolution.** AI may classify and suggest, but open/closed decisions on all recommendations are made by the author.
5. **Organizer value is independent of AI.** Hierarchy, status, and reference views must be useful even when AI assistance is disabled or produces low-trust output.

---

## v1 Feature Scope

### In Scope

#### 1. Chapter Status Board
- Tree view panel showing all chapters in project-defined order
- Per-chapter status indicator (not-started / drafting / draft-complete / editing / review-pending / review-complete / final)
- Open issue count badge per chapter
- Click to open chapter file in editor

#### 2. Chapter Context Pane
- Auto-populates when active editor file matches a chapter in the project
- Shows: current chapter status, open issues for this chapter, session notes from last session
- Right-click actions on issues: "Chat about this", "Mark as non-issue", "Defer"
- Author can manually add a new issue from this pane

#### 3. Global Knowledge Pane
- Read-only rendered view of project notes (characters, settings, timeline, research)
- Parses markdown files from configured notes folders
- Hyperlinks for known entity names (characters, locations) when mentioned
- Usable on a second monitor as ambient reference

#### 4. Issue Tracking
- Full issue model per [issue-schema.md](data-contracts/issue-schema.md)
- Issue types: continuity, copy-edit, voice, narrative-quality, beta-reader, factual-risk, missing-expected-fact, expert-realism, author-note
- Per-session issue output files under `.leanquill/issues/sessions/`
- Master issues rollup file at `.leanquill/issues/master-issues.md`
- Filter view: open / deferred / all
- Dismiss with optional reason; dismissed items hidden from default view
- In-margin gutter indicators in the editor for issues with `span_hint` references

#### 5. Chapter Review Workflow (AI)
- Trigger from right-click on chapter in tree view, or via chat command
- Runs configured active review personas against the chapter
- Output: session issue file + chat log entry
- Persona context access strictly enforced per persona schema

#### 6. Post-Write Story Intelligence Update (AI)
- Author-invoked after a writing session
- Agent analyzes newly written content in the active chapter
- Updates notes (character appearances, events, location mentions) with backlinks to source chapter
- Does not modify manuscript files

#### 7. Issue Planning Chat (AI)
- Right-click an issue → "Chat about this" → opens a focused AI chat in Ask or Plan mode
- Agent receives: the issue record, the relevant chapter text around `span_hint`, and any linked research notes
- Agent does not write to manuscript under any circumstances
- Chat saved as a chat log entry

#### 8. Session Closure
- Command/button to close current work session
- Prompts: new chapter status (optional), session notes for next time (optional)
- Updates chapter status file

#### 9. Chat Audit Trail
- All AI sessions auto-saved as `.leanquill/chats/{timestamp}-{type}.md`
- Includes session summary, context used, issues generated, and full transcript

#### 10. Persona Library
- Per-project persona files under `.leanquill/personas/`
- Configurable via `project.yaml`
- Enable/disable individual personas per project
- Packaged default personas: casual-reader, avid-genre-fan, copy-editor
- Author can create custom personas using the schema

#### 11. Project Initialization
- Command: "LeanQuill: Initialize project"
- Creates `.leanquill/` folder structure
- Creates `project.yaml` from template with sensible defaults
- Detects LeanPub `Book.txt` for chapter ordering if present

---

### Out of Scope for v1

These are deferred to v1.5 or later, or to the standalone app path:

| Feature | Why Deferred |
| ------- | ------------ |
| Timeline visualization | Depends on inference engine; higher complexity |
| Relationship/character graph | Same — builds on timeline work |
| Paragraph-level engagement heatmap | Needs custom rendering layer; v1.5 |
| Interest score stream per persona | Deprioritized relative to issue-first model |
| Continuity checker (cross-chapter) | On-demand only; requires full manuscript context assembly |
| Issue consolidation agent | Useful but not blocking; can be manual rollup in v1 |
| Pre-write plan review (expert realism on outlines) | Phase 2 — needs planning-doc schema first |
| Mobile / browser companion | Out of scope permanently for v1 |
| Cloud sync or cloud state | Out of scope — local-first only |
| Multi-author collaboration | Out of scope for v1 |
| LeanPub publishing workflow integration | Out of scope — LeanPub handles this via git push |
| Automated git operations | Explicitly forbidden by design policy |
| Desktop companion app | Escalation path only if extension UX proves insufficient |

---

## MVP Feature Tracks

v1 ships in two tracks with a stable release gate between them.

### Track 1: Author Workflow (Target: Alpha)

Enables the core daily authoring loop:

- Project initialization
- Chapter status board + chapter context pane
- Global knowledge pane (read-only)
- Manual issue creation and triage
- Session closure with notes + status update
- In-margin gutter issue indicators

**Success criterion:** Author can open a LeanPub repo, see chapter status, open a chapter, view notes on a second monitor, log manual issues, and close a session with updated status. No AI required.

### Track 2: AI Review Workflows (Target: Beta)

Adds AI-assisted editorial capability on top of Track 1:

- Chapter review workflow (AI)
- Post-write story intelligence update (AI)
- Issue planning chat (AI)
- Chat audit trail
- Persona library with default profiles

**Success criterion:** Author can trigger a chapter review, receive issues in the pane linked to chapter text, chat about a specific issue without touching the manuscript, and find a full chat log in the repo afterward.

---

## Data Model Summary

All state stored under `{book-repo}/.leanquill/` as version-controlled files.

```
.leanquill/
  project.yaml              # project config and persona activation
  chapters/
    {id}-status.md          # one per chapter
  issues/
    sessions/
      {timestamp}-{type}.md # per-session AI output
    master-issues.md        # consolidated rollup
  personas/
    {id}.md                 # persona profiles
  chats/
    {timestamp}-{type}.md   # AI session transcripts
```

See [data-contracts/](data-contracts/README.md) for full schemas and samples.

---

## Key Open Decisions (Pre-PRD)

These need resolution before detailed technical design:

1. **Extension API surface for write-blocking** — How does the extension prevent agent tools from writing to `manuscript/`? Options: VS Code workspace file guards, agent instruction file conventions, or tool-layer path filtering.
2. **AI model and API** — LeanQuill should be provider-agnostic (uses VS Code's language model API where available, configurable API keys otherwise). Confirm API surface for tool-use and streaming.
3. **Sequential context boundary enforcement** — How is chapter order determined at retrieval time? Relies on `Book.txt` or alpha sort. Need to confirm retrieval strategy for context assembly.
4. **Index/cache format** — JSON cache files for fast entity/issue lookups. Needs schema definition for character, location, and event entity indexes.
5. **In-margin issue indicators** — VS Code decoration API supports gutter icons and inline annotations. Needs UX decision on visual treatment for different issue types.
6. **Story intelligence update diffing** — The post-write agent needs to know what is "new" text. Options: git diff against last commit, or a LeanQuill-managed draft checkpoint file.

---

## Repository Migration Checklist

Before implementation begins, migrate to a dedicated LeanQuill repository:

- [ ] Create new GitHub repository: `LeanQuill` (or `leanquill-vscode`)
- [ ] Copy `_bmad-output/projects/lean-quill/` as root planning artifacts
- [ ] Rename folder references as needed for new repo root
- [ ] Initialize as VS Code extension project (`yo code`)
- [ ] Set up `AGENTS.md` with manuscript write-block policy for AI agents
- [ ] Port brainstorming session document as `docs/brainstorming-2026-03-29.md`
- [ ] Create initial PRD from v1 scope and data contracts
