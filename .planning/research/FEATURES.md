# Feature Landscape: VS Code Writing Assistant / Book Authoring Extensions

**Domain:** VS Code extension for fiction/non-fiction book authoring (LeanPub-style markdown/git)
**Researched:** 2026-03-29
**Overall confidence:** HIGH (tool survey direct; authoring workflow analysis from project artifacts)

---

## Competitive Baseline

Tools surveyed:

| Tool | Installs | Last Update | Domain | Status |
|------|----------|-------------|--------|--------|
| Foam | ~600K | Active (2026) | PKM / note-taking | Active |
| Dendron | ~162K | Aug 2023 | PKM / developer notes | Abandoned |
| Fiction Writer (vsc-zoctarine) | ~5K | Oct 2022 | Markdown fiction writing | Inactive (~3y stale) |
| Writer Mode (noaal) | ~4.7K | — | Distraction-free writing | Minimal |
| Harper | ~11K | Active | Grammar / spell check | Active |
| VS Code built-in Markdown | — | Active | Preview, syntax | Core editor |

**Key gap:** No actively maintained extension occupies the chapter-level project management + story intelligence space. Fiction Writer is the closest analog but is 3 years stale, has no AI integration, no issue model, and no chapter status concept.

---

## Table Stakes

Features authors expect. Missing means the tool feels unfinished or authors move on.

| # | Feature | Why Authors Expect It | Complexity | Exists in Competitors? |
|---|---------|----------------------|------------|----------------------|
| TS-01 | **Ordered chapter list / navigation** | LeanPub's `Book.txt` defines chapter order; authors need to see and navigate it | Low | Not in Foam/Dendron (generic hierarchy, not ordered narrative) |
| TS-02 | **Per-chapter status indicator** | Authors track where each chapter is in the pipeline (draft/editing/final); essential for any multi-chapter project | Low–Med | Not in any VS Code writing tool |
| TS-03 | **Open chapter from sidebar** | Standard affordance — click chapter → editor opens that file | Low | Partial in Foam/Dendron (file navigation, not chapter-concept navigation) |
| TS-04 | **Read-only notes/knowledge reference** | Authors constantly cross-reference characters, places, earlier events while writing | Med | Foam (wikilinks, backlinks), Dendron (hierarchy nav); neither renders ambient reference pane |
| TS-05 | **Manual issue / note capture** | Authors always have self-identified concerns ("fix this later", "continuity check here") | Low–Med | Fiction Writer (quick notes, file-scoped); Foam/Dendron (backlinks but not issue-typed) |
| TS-06 | **Word count / progress stats** | Universal expectation for long-form writing; authors track progress | Low | Fiction Writer (words, pages, repetitions); Foam (none) |
| TS-07 | **Project initialization command** | Authors want scaffolding so they don't set up structure manually | Low | Foam (workspace template); Dendron (vault creation); Fiction Writer (none) |
| TS-08 | **Works with existing LeanPub repo layout** | Anything requiring migration or restructuring is a non-starter | Low | N/A — no tool explicitly targets this layout |
| TS-09 | **State survives tool uninstall** | Authors using git repos won't accept locked-in data formats | Low | Foam/Dendron (markdown); Fiction Writer (yaml metadata) |
| TS-10 | **Context pane populates on chapter open** | Author should not need to manually hunt for issues/status when switching chapters | Med | Not in any surveyed tool |

---

## Differentiators

Features that position LeanQuill competitively. Not expected from generic tools, but uniquely valuable for the target user (solo author, multi-chapter fiction/non-fiction, LeanPub/git workflow).

### Story Intelligence

| # | Feature | Value Proposition | Complexity | Competitor Gap |
|---|---------|-------------------|------------|----------------|
| D-01 | **Post-write story intelligence update** | Agent analyzes newly written chapter content, updates character/event/location notes with source backlinks — without touching manuscript | High | Not in any VS Code tool; Scrivener has manual character sheets but no AI extraction |
| D-02 | **Entity cross-linking in knowledge pane** | Character/location names hyperlinked to their notes; clicking jumps to definition — creates a semantic navigation layer on top of flat markdown files | Med | Foam (wikilinks, manual); Dendron (hierarchy navigation); neither is fiction-entity-aware |
| D-03 | **Sequential reader context enforcement** | Reader/beta-reading agents are technically blocked from seeing future chapters — preserves authentic spoiler-free perspective | High | Unique — no tool models narrative chronology as a data-plane constraint |

### Chapter-Level Project Management

| # | Feature | Value Proposition | Complexity | Competitor Gap |
|---|---------|-------------------|------------|----------------|
| D-04 | **Chapter status workflow (not-started → final)** | Gives the author a production board native to the book project; matches how authors actually think about their work | Low–Med | Fiction Writer (metadata badges only, no workflow); Foam/Dendron (tagging, not status-workflow) |
| D-05 | **Issue tracking with typed categories** | continuity, copy-edit, voice, narrative-quality, beta-reader, factual-risk — allows author to triage by category and source | Med | No VS Code writing tool has typed editorial issue tracking |
| D-06 | **In-margin gutter indicators for issues** | Issues with `span_hint` references show as gutter decorations in the active editor → spatial context without leaving the writing surface | Med | Unique — no writing extension does positional issue indicators |
| D-07 | **Issue triage UI (dismiss with reason / defer / filter)** | Reduces noise without destroying history; deferred items stay queryable | Med | Unique for writing tools; issue trackers (GitHub Issues, JIRA) exist but are not chapter-scoped or editor-native |
| D-08 | **Session closure workflow** | Explicit session end: record chapter status, leave a note for next session — creates a handoff artifact for solo authors working across days | Low | Unique — no tool models session lifecycle for writing |

### AI Review System

| # | Feature | Value Proposition | Complexity | Competitor Gap |
|---|---------|-------------------|------------|----------------|
| D-09 | **Multi-persona chapter review** | Runs configurable reader personas (casual-reader, avid-genre-fan, copy-editor) against a chapter in one command — produces typed issues per persona | High | No tool provides configurable reader simulation with VS Code LM API |
| D-10 | **Manuscript write-block (tool-level enforcement)** | AI is structurally prevented from writing to `manuscript/` — not a convention or prompt instruction, but a hard policy at the tool layer | Med | Unique — general AI coding tools have no domain-specific write-block concept |
| D-11 | **Issue planning chat (focused, per-issue)** | Right-click any issue → "Chat about this" → AI receives that issue + surrounding chapter text as context, suggests resolution without rewriting | Med | GitHub Copilot Chat exists but has no manuscript-scoped, issue-scoped context model |
| D-12 | **Chat transcript audit trail (repo-native)** | All AI sessions saved as timestamped `.leanquill/chats/` files — provides traceability of what advice was given, when, and in what context | Low | No writing tool provides this; useful for trust and retrospective review |
| D-13 | **Persona library (per-project, author-configurable)** | Authors can create custom personas beyond the three packaged defaults; each persona has configurable expertise axis | Med | Unique — no tool models reader simulation as a configurable test harness |

---

## Anti-Features

Things to deliberately NOT build in v1 — either because they would harm the core value prop, are premature, or belong to other tools.

| Anti-Feature | Why Avoid | What to Do Instead |
|---|---|---|
| **Inline grammar / spell-check** | Harper, LanguageTool, and VS Code's native spell-check handle this. Duplicating adds maintenance burden and user confusion about which tool to trust. | Let Harper/LanguageTool coexist; LeanQuill focuses on structural and narrative issues |
| **Always-on background AI suggestions** | Destroys writing flow state. Authors in drafting mode write without interruption; constant suggestion pop-ups break zone. | Author explicitly invokes review; AI stays silent during drafting |
| **AI writes manuscript prose** | Violates the core design principle: authorial ownership. Ghostwriting destroys the product's identity. Any feature that generates prose to paste into the manuscript is a category violation. | AI output is advisory only: chat, issue files, notes updates |
| **Cloud sync / remote state** | Local-first is a non-negotiable constraint. Cloud sync introduces privacy risk (manuscripts are pre-publication IP), subscription complexity, and offline availability concerns. | All state in `.leanquill/` as git-versionable files |
| **Multi-author collaboration** | Adds auth, conflict resolution, and permission complexity that is out-of-scope for a solo author tool. Would require a fundamentally different architecture. | Defer indefinitely |
| **Automated git operations (commit, push, branch)** | Authors using git have their own git workflow; unsolicited commits would be destructive, surprising, and dangerous. LeanPub integration works via git push already. | Never invoke git programmatically; all git stays with the author |
| **LeanPub publishing pipeline integration** | LeanPub handles previews and publishing via git push to their repository. Building a duplicate publish command would lag behind LeanPub's own tooling and add maintenance surface. | Document the `git push` workflow; don't replicate it |
| **WYSIWYG / rich text editor replacement** | VS Code's markdown editor is the authoring surface. Replacing it creates a custom component burden, accessibility issues, and loses all VS Code editing niceties. | Use webviews only for reference panels and status boards, never for primary manuscript editing |
| **Timeline visualization (v1)** | High complexity, depends on an inference engine, and requires full manuscript context. Without quality extraction the visualization is misleading, not helpful. | Defer to v1.5; story intelligence update (D-01) lays the groundwork |
| **Character/relationship graph (v1)** | Builds on timeline work; premature before extraction quality is validated | Defer to v1.5 |
| **Paragraph-level engagement heatmap** | Requires custom rendering layer in the editor; high complexity for uncertain return on a feature that may produce noisy scores | Defer to v1.5 |
| **Issue consolidation agent (v1)** | Manual rollup is sufficient; auto-consolidation without author review risks surprises in the issue list | Manual master-issues.md rollup in v1; consolidation agent is v1.5 |
| **External API key management** | Adds auth UX surface, security responsibility (storing secrets), and marketplace requirements overhead. VS Code LM API with the user's existing Copilot subscription is simpler. | VS Code LM API only; no external HTTP AI calls in v1 |
| **Mobile / browser companion** | VS Code is a desktop tool and the target OS is desktop. No mobile markdown workflow exists that aligns with this. | Permanently out of scope |

---

## Feature Complexity Matrix

| Feature | Track | Complexity | Risk | Dependencies |
|---------|-------|------------|------|--------------|
| TS-01 Chapter list / ordered navigation | Track 1 | Low | Low | Book.txt parsing |
| TS-02 Per-chapter status indicator | Track 1 | Low | Low | chapter-status schema |
| TS-03 Open chapter from sidebar | Track 1 | Low | Low | Tree view registration |
| TS-04 Read-only knowledge pane | Track 1 | Med | Low | Markdown folder parsing, Webview |
| TS-05 Manual issue capture | Track 1 | Med | Low | Issue schema, .leanquill/ writer |
| TS-06 Word count / stats | Track 1 | Low | Low | File watcher, StatusBar |
| TS-07 Project initialization | Track 1 | Low | Low | File scaffolding |
| TS-08 LeanPub layout compatibility | Track 1 | Low | Low | Book.txt detection |
| TS-09 Git-native / uninstall-safe state | Track 1 | Low | Low | Design discipline |
| TS-10 Context pane on chapter open | Track 1 | Med | Low | Active editor event, Webview |
| D-04 Chapter status workflow | Track 1 | Low–Med | Low | chapter-status schema |
| D-05 Typed issue tracking | Track 1 | Med | Low | Issue schema, tree view |
| D-06 In-margin gutter indicators | Track 1 | Med | Med | VS Code DecorationAPI, span_hint parsing |
| D-07 Issue triage UI | Track 1 | Med | Low | Webview, issue status updates |
| D-08 Session closure workflow | Track 1 | Low | Low | Command palette, chapter-status writer |
| D-09 Multi-persona chapter review | Track 2 | High | High | VS Code LM API, persona schema, context assembly |
| D-10 Manuscript write-block | Track 2 | Med | Med | Path filtering in tool invocation, AGENTS.md policy |
| D-11 Issue planning chat | Track 2 | Med | Med | VS Code LM API, issue schema, span_hint context |
| D-12 Chat transcript audit trail | Track 2 | Low | Low | File writer, chat-log schema |
| D-13 Persona library | Track 2 | Med | Low | persona schema, project.yaml |
| D-01 Post-write story intelligence | Track 2 | High | High | VS Code LM API, notes diff model, entity extraction |
| D-02 Entity cross-linking in knowledge pane | Track 2→v1.5 | Med | Med | Entity index, Webview link rendering |
| D-03 Sequential reader context enforcement | Track 2 | High | Med | Book.txt order, context assembly filtering |

**Risk legend:** Low = well-understood VS Code APIs; Med = some unknowns, needs prototype; High = VS Code LM API behavior / quality uncertain, requires iteration.

---

## Authoring Phase Considerations

Authors cycle through distinct phases with very different needs. LeanQuill features must map to all three.

### Drafting (Writing new prose)
**Author need:** Stay in the zone. Access reference notes without context-switching. Remember where you left off.
**Key features:**
- Knowledge pane on a secondary monitor (TS-04) — ambient reference without interrupting editor
- Context pane auto-population on chapter open (TS-10) — session notes from last close surface immediately
- No AI intrusion during drafting — AI is invoked, never ambient
- Word count in status bar (TS-06) — progress feedback without changing context

### Editing (Revising existing chapters)
**Author need:** Work through a prioritized list of known problems. Get focused help on specific issues without distracting tangents.
**Key features:**
- Issue triage UI with filter (D-07) — open/deferred/all with category filter
- In-margin gutter indicators (D-06) — locate issue in prose without hunting
- Issue planning chat (D-11) — focused per-issue AI conversation
- Author-created issues (TS-05) — capture self-identified problems as they emerge

### Review (Structured AI-assisted critique)
**Author need:** Systematic feedback from multiple perspectives. Audit trail of what was flagged and why.
**Key features:**
- Multi-persona chapter review (D-09) — trigger when chapter is ready; generates typed issues
- Post-write story intelligence update (D-01) — extract new entities/events into notes
- Chat audit trail (D-12) — all review sessions preserved as repo files
- Issue disposition with rationale (D-07) — close the loop on each recommendation

---

## Competitive Differentiation Summary

| Feature Area | Foam | Dendron | Fiction Writer | LeanQuill |
|---|---|---|---|---|
| Chapter progress board | ❌ | ❌ | ❌ (metadata badges) | ✅ |
| Typed editorial issue tracking | ❌ | ❌ | ❌ | ✅ |
| In-margin issue indicators | ❌ | ❌ | ❌ | ✅ |
| AI review with personas | ❌ | ❌ | ❌ | ✅ |
| Manuscript write-block | ❌ | ❌ | ❌ | ✅ |
| Sequential reader context | ❌ | ❌ | ❌ | ✅ |
| Session closure workflow | ❌ | ❌ | ❌ | ✅ |
| Story intelligence update | ❌ | ❌ | ❌ | ✅ |
| Git-native state | ✅ | ✅ | ❌ | ✅ |
| Knowledge/notes reference pane | Backlinks | Hierarchy | ❌ | ✅ |
| Word count | ❌ | ❌ | ✅ | ✅ |

**Conclusion:** Foam and Dendron are generic PKM tools aimed at developers; they have no concept of a chapter, a manuscript, an issue type, or a reader persona. Fiction Writer is the closest analog but is inactive, has no AI, no issue model, and no project management layer. LeanQuill's differentiation is genuine — the feature set does not exist in any active VS Code extension.

---

## MVP Recommendation

**Track 1 priority order (Author Workflow):**
1. Project initialization (TS-07) — required for anything to work
2. Chapter list + status board (TS-01, TS-02, TS-03, D-04) — the control tower
3. Chapter context pane (TS-10, TS-05, D-07) — makes the chapter view useful
4. Knowledge pane (TS-04) — ambient reference while writing
5. Session closure (D-08) — closes the daily workflow loop
6. In-margin gutter indicators (D-06) — spatial context for issues

**Track 2 priority order (AI Reviews):**
1. Manuscript write-block (D-10) — safety prerequisite
2. Persona library (D-13) — data model needed before review
3. Multi-persona chapter review (D-09) — core Track 2 value
4. Issue planning chat (D-11) — editorial follow-through
5. Chat audit trail (D-12) — low cost, high trust signal
6. Post-write story intelligence (D-01) — most complex, most novel; validate after review loop works

**Defer to v1.5:**
- Entity cross-linking in knowledge pane (D-02)
- Timeline visualization
- Character/relationship graph
- Paragraph engagement heatmap
- Consolidation agent

---

## Sources

- Foam GitHub repository: https://github.com/foambubble/foam (active, 17k stars)
- Dendron VS Code Marketplace: last updated Aug 2023 (effectively abandoned)
- Fiction Writer extension: https://marketplace.visualstudio.com/items?itemName=vsc-zoctarine.markdown-fiction-writer (last updated Oct 2022, inactive)
- VS Code writing search results (March 2026): 477 results, no dominant fiction/book authoring tool
- LeanQuill brainstorming session (2026-03-29): 46 categories under Question Storming / Role Playing / Morphological Analysis
- LeanQuill v1-scope.md and PROJECT.md (2026-03-29)
- Confidence: HIGH for tool survey (direct inspection); HIGH for author workflow analysis (grounded in PROJECT.md and brainstorming artifacts); MEDIUM for competitive landscape completeness (VS Code Marketplace search may miss niche tools)
