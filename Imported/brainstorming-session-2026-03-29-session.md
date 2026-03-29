---
stepsCompleted: [1, 2]
inputDocuments: []
session_topic: 'AI-assisted writing organization tool for markdown-based book authoring'
session_goals: 'Determine form factor, repository placement, feature scope, AI integration surface, and LeanPub/git workflow integration'
selected_approach: 'ai-recommended'
techniques_used: ['Question Storming', 'Role Playing', 'Morphological Analysis']
ideas_generated:
	- 'Role-scoped AI access policy'
	- 'Manuscript immutability guardrails'
	- 'On-demand continuity checking'
	- 'Configurable beta-reader personas'
	- 'Sequential context windows for reader agents'
	- 'Recommendation-first factual risk flags'
	- 'Organizer-first value even without AI trust'
	- 'Timeline and relationship visualization workspace'
	- 'Chat transcript audit trail'
	- 'Typed recommendation backlog with statuses'
	- 'Voice-preserving quality feedback engine'
	- 'Agent-level git command discouragement as safety net'
	- 'Hard context exclusion for future chapters'
	- 'Session-scoped recommendation files with deferred consolidation'
	- 'Human-only closure workflow for recommendations'
	- 'Contradiction handling with intentionality annotations'
	- 'Author-facing ambiguity surfacing on inconsistent runs'
	- 'Inference-enabled timeline/relationship extraction'
	- 'Progress-visible long-running AI task UX'
context_file: ''
---

# Brainstorming Session Results

**Facilitator:** Matthew-Hope
**Date:** 2026-03-29

## Session Overview

**Topic:** AI-assisted writing organization tool for markdown-based book authoring (LeanPub-style markdown/git repos)

**Goals:**

1. Determine the right form factor (VS Code extension vs. standalone desktop app vs. hybrid)
2. Determine if it belongs in the ElandApps monorepo or as a separate project
3. Explore feature scope — organizing, writing, and editing capabilities
4. Explore the AI integration surface — automated feedback and assistance
5. Explore integration with existing LeanPub-style markdown+git workflows

### Session Setup

The session focuses on brainstorming a tool for independent authors who work with LeanPub-style markdown repositories. The tool should help organize creative work (research, characters, timelines, notes, editing status, manuscripts) while leveraging AI capabilities for proofreading, copy editing, grammar/typo detection, factual accuracy, and simulated beta readers with configurable audience profiles. Key architectural decisions include form factor (VS Code extension vs. desktop app) and whether this belongs in the ElandApps monorepo or stands alone.

## Technique Selection

**Approach:** AI-Recommended Techniques
**Analysis Context:** AI-assisted writing organization tool for markdown-based book authoring with focus on form factor, repository placement, feature scope, AI integration, and LeanPub/git workflow compatibility

**Recommended Techniques:**

- **Question Storming:** Build a complete decision map before solutioning so the right product and architecture questions drive ideation.
- **Role Playing:** Explore needs through multiple personas (author, editor, beta reader, technical writer, publisher) to surface requirements and constraints.
- **Morphological Analysis:** Systematically combine choices across form factor, feature modules, and AI workflows to identify strong solution patterns.

**AI Rationale:** This sequence moves from clarity to creativity to decision structure: first define the right questions, then expand idea breadth with stakeholder lenses, then converge with a combination matrix for practical direction.

## Technique Execution

### Question Storming - Insight Capture

**[Category #7]**: Role-Scoped AI Access Policy
_Concept_: Planning-focused agents can read the full repository, while editing/proofreading/beta-reader agents receive manuscript-scoped context only: single chapter, full manuscript, or sequential chapters up to a selected boundary. This policy is role- and task-dependent rather than one-size-fits-all.
_Novelty_: Uses explicit context governance as a product feature, not a prompt convention.

**[Category #8]**: Manuscript Immutability Guardrail
_Concept_: AI must never directly edit manuscript files; all feedback is delivered via chat or recommendation documents. The final prose remains exclusively author-written while still benefiting from structured critique.
_Novelty_: Enforces authorial ownership at the file-system policy level.

**[Category #9]**: On-Demand Continuity Engine
_Concept_: Continuity and consistency checks run only when explicitly requested by the author or by a delegated agent. This avoids noisy background processing and supports intentional review cycles.
_Novelty_: Prioritizes user-controlled review cadence over always-on automation.

**[Category #10]**: Persona Library for Beta Readers
_Concept_: Each project can define reusable beta-reader personas with tunable expertise dimensions: technical depth, genre familiarity, and newcomer perspective. Domain-specialist personas can be added to stress-test setting and technology realism.
_Novelty_: Treats reader simulation as a configurable test harness rather than generic feedback.

**[Category #11]**: Sequential Reader Context Windows
_Concept_: Reader-facing agents should only access manuscript material up to a specific chapter, with future-chapter retrieval excluded from embeddings and context assembly. This preserves authentic spoiler-free reader reactions.
_Novelty_: Implements narrative chronology constraints in retrieval logic.

**[Category #12]**: Recommendation-First Risk Surfacing
_Concept_: Factual issues are reported as recommendations, not automatic edits, and can be triaged by type and status. Suggestion files can be markdown-based with headings and structured tables for manual workflow.
_Novelty_: Combines editorial freedom with auditable, type-aware issue management.

**[Category #13]**: Organizer Utility Independent of AI
_Concept_: Even if AI trust degrades due to false continuity assumptions, the tool should retain strong value through planning and organization: hierarchy views, relationship mapping, and timeline diagrams.
_Novelty_: Decouples durable product value from AI reliability risk.

**[Category #14]**: Local-First Conversation Audit Trail
_Concept_: Store summarized or raw chat transcripts in a project chats folder using timestamped naming conventions plus chat-type indicators. This enables traceability and retrospective insight without cloud dependency.
_Novelty_: Applies development-style observability to writing assistance workflows.

**[Category #15]**: Voice-Preserving Quality Copilot
_Concept_: Core AI value centers on copy editing, proofreading, and quality lift while preserving the author's voice and avoiding ghostwriting behavior. Suggestions should bias toward clarity and correctness, never authorship replacement.
_Novelty_: Optimizes for author identity preservation as a measurable design goal.

**[Category #16]**: Human-Reversible Safety Envelope
_Concept_: AI behavior can be constrained through repository rules (for example via agent instruction files) and by discouraging autonomous git operations so all AI output remains easily reversible by the author. This prioritizes manual control and rollback confidence.
_Novelty_: Blends policy-level safety with operational reversibility rather than relying on trust alone.

**[Category #17]**: Hard Chronology Input Gate
_Concept_: Sequential-reader agents should be technically blocked from future-chapter access by excluding those chapters from admissible context and retrieval sources. The model should never receive future content as permissible input.
_Novelty_: Enforces spoiler boundaries as a strict data-plane rule.

**[Category #18]**: Session Recommendation Queues
_Concept_: Each AI session emits its own priority-ordered recommendations file; deferred items are periodically consolidated into a master active-issues list by a separate consolidation agent. This supports focused work sessions without losing backlog continuity.
_Novelty_: Adapts issue-tracking workflow patterns to editorial recommendations.

**[Category #19]**: Human-Authorized Resolution Model
_Concept_: Recommendation lifecycle remains author-controlled: AI may classify and suggest, but open/closed decisions are made by the human. Optional status-assist from AI is allowed only under explicit author direction.
_Novelty_: Establishes human decision authority as a permanent workflow invariant.

**[Category #20]**: Contradiction with Intent Metadata
_Concept_: Contradictions are surfaced as potential issues, and intentional narrative inconsistencies can be explicitly annotated as accepted context for future agents. This prevents repeated false alarms while preserving creative intent.
_Novelty_: Converts ambiguity from recurring noise into reusable narrative metadata.

**[Category #21]**: Author-First Uncertainty Surfacing
_Concept_: When analyses disagree across runs, the system should surface confusion and uncertainty directly to the author instead of auto-resolving silently. Transparency is preferred over brittle confidence.
_Novelty_: Treats model disagreement as a first-class signal.

**[Category #22]**: Inference-Driven Story Graphs
_Concept_: Timeline and relationship visualizations may be inferred from manuscript and notes, not only explicitly entered data. This lowers author overhead and turns existing writing into navigable structure.
_Novelty_: Uses passive extraction to create active planning intelligence.

**[Category #23]**: Interruptible Agent Workflows
_Concept_: Long-running AI tasks should stream progress, allow mid-run interaction, support pause/stop, and resume cleanly. If a standalone app is ever explored, this interaction model becomes a mandatory parity feature.
_Novelty_: Brings IDE-style agent ergonomics into author tooling requirements.

### Question Storming Checkpoint

Question Storming produced a strong policy and workflow foundation: role-scoped context, manuscript immutability, sequential-reader constraints, recommendation-first review loops, and local-first auditability. The session is now transitioning to Role Playing to pressure-test these ideas through different stakeholder lenses.

### Role Playing - Persona 1 (Primary Author Workflow)

**Scenario Tested:** Mid-draft work session with chapter-level writing/editing/review needs and strict local-first versioned project state.

**[Category #24]**: Master Chapter Status Surface
_Concept_: Session starts with a global chapter status board showing progress and next-action state for each chapter, either tool-rendered or file-backed markdown. Chapter selection should be the first action gateway.
_Novelty_: Establishes a project-level control tower before entering chapter-level flow.

**[Category #25]**: Chapter-Scoped Active Context Pane
_Concept_: Opening a chapter auto-populates a context pane with chapter-linked tasks, recommendations, and issues. Context should be tied to the active chapter file and update without manual hunting.
_Novelty_: Treats chapter focus as a dynamic context switch for all operational data.

**[Category #26]**: Parallel Global Knowledge Pane
_Concept_: A separate always-available pane should expose project-wide notes (characters, settings, timeline, research), parsed from markdown and rendered for quick glancing on a second monitor.
_Novelty_: Explicitly supports dual-surface cognition for focused writing plus ambient reference.

**[Category #27]**: Zone-Preserving Writing Mode
_Concept_: The author writes prose without interruption, then explicitly invokes analysis during natural breaks. AI enters only when requested so drafting momentum remains protected.
_Novelty_: Prioritizes flow state over constant suggestion churn.

**[Category #28]**: Post-Write Story Intelligence Update
_Concept_: After writing, a user-invoked agent analyzes newly added text and updates story documentation with event/location/continuity notes linked to source chapter locations.
_Novelty_: Converts fresh prose into structured story intelligence with traceable backlinks.

**[Category #29]**: Issue-Centric Editing Assistant
_Concept_: In editing mode, chapter issues drive work; right-click actions should open focused AI planning conversations on a specific issue to brainstorm resolution options without direct manuscript rewriting.
_Novelty_: Embeds AI-assisted problem solving directly into issue triage interactions.

**[Category #30]**: Multi-Entry Chapter Review Workflow
_Concept_: Full chapter review can be triggered from hierarchy UI or AI chat, generating suggestions, chat notes, and issue entries that persist as repository files.
_Novelty_: Supports equivalent workflows across command surfaces while preserving one canonical data backend.

**[Category #31]**: Repo-Native State Persistence
_Concept_: All tool state (issues, recommendations, notes, statuses, chat artifacts) should be represented as version-controlled files inside the repository for machine portability and historical traceability.
_Novelty_: Makes project state fully reproducible and git-verifiable across devices.

**[Category #32]**: Issue Disposition with Rationale
_Concept_: Authors must be able to mark an issue as non-issue with optional rationale, automatically changing status and removing it from default active views.
_Novelty_: Reduces noise while preserving decision history and reviewer intent.

**[Category #33]**: Author-Created Issues
_Concept_: The tool should support manually authored issues for self-identified weaknesses, rewrite targets, or open narrative questions independent of AI detection.
_Novelty_: Keeps human editorial judgment first-class in the issue model.

**[Category #34]**: Session Closure Notes and Chapter Status Update
_Concept_: End-of-session workflow should support chapter status changes and optional notes for next session continuity.
_Novelty_: Bridges daily authoring sessions with explicit handoff metadata.

### Role Playing - Persona 2 (Casual Genre Fan Beta Reader)

**Scenario Tested:** Sequentially constrained beta reader with no planning-note access, focused on reading experience and narrative engagement.

**[Category #35]**: Reader Experience Feedback Pack
_Concept_: High-value feedback includes boredom points, confusion on phrasing, read-aloud friction (audiobook suitability), emotional highs, and curiosity spikes around unresolved plot elements.
_Novelty_: Prioritizes experiential reader telemetry over purely technical critique.

**[Category #36]**: Positive Signal Capture as First-Class Data
_Concept_: Capture what readers liked most, not only problems, to preserve and amplify strengths in revision cycles.
_Novelty_: Balances corrective editing with reinforcement of effective narrative techniques.

**[Category #37]**: Paragraph/Page Interest Heatmap
_Concept_: Generate engagement intensity scoring at paragraph or page granularity to highlight drag zones and momentum peaks.
_Novelty_: Introduces quantitative narrative pacing diagnostics into manuscript review.

**[Category #38]**: Reader Question Stream
_Concept_: Track reader predictions, questions, and next-event expectations while reading sequentially to validate suspense and clue placement.
_Novelty_: Turns audience curiosity into structured design feedback for plot progression.

**[Category #39]**: Dual View Authoring Surface
_Concept_: Pair standard markdown editing with a story-lens view that overlays hyperlinks for recurring characters/entities/locations and contextual issue indicators near relevant text spans.
_Novelty_: Combines authoring and semantic narrative navigation in synchronized views.

**[Category #40]**: In-Margin Issue Markers Across Views
_Concept_: Both prose editor and story-lens surfaces should show local issue indicators tied to text regions, enabling quick attention without leaving writing context.
_Novelty_: Creates context-preserving triage directly at the writing location.

**[Category #41]**: Beta Reader Scope Priority
_Concept_: Beta readers may note obvious grammar/spelling defects, but primary weighting should remain story experience, comprehension, and engagement quality.
_Novelty_: Defines role-specific weighting to prevent over-indexing on copy edits during narrative validation.

**[Category #42]**: Open Feedback Envelope with Role Bias
_Concept_: Beta-reader comments can include broad observations, but UI and ranking should bias toward story-quality insights over mechanical correctness.
_Novelty_: Maintains flexible input while enforcing purposeful interpretation.

### Role Playing - Persona 3 (Domain Expert Reviewer)

**Scenario Tested:** Expert realism reviewer for technical, scientific, geographic, and maritime fidelity in fiction settings where author domain knowledge is limited.

**[Category #43]**: Expert Realism Risk Detector
_Concept_: Domain expert profiles should flag implausible operational details (for example vessel redundancy assumptions, nautical terminology, oceanographic process descriptions, extraction workflows, and governance/legal framing) that would break credibility for informed readers.
_Novelty_: Targets credibility breaks that casual readers may miss but expert readers will immediately detect.

**[Category #44]**: Missing-Expected-Fact Suggestions
_Concept_: Review should not only detect incorrect claims but also identify relevant omitted facts or options that experts would reasonably expect in the narrative context.
_Novelty_: Expands from error detection to opportunity discovery for richer, more credible storytelling.

**[Category #45]**: Dual-Phase Expert Workflow
_Concept_: Expert review should support two adjacent modes: pre-writing plan validation (outline/notes realism check) and post-draft chapter validation (manuscript realism check), each with overlapping but distinct prompts.
_Novelty_: Treats realism assurance as a lifecycle process, not a single late-stage gate.

**[Category #46]**: Evidence-Linked Recommendations
_Concept_: Expert findings should include links to authoritative web resources that support each claim and be stored as a distinct issue type in the tracking model.
_Novelty_: Combines fact-risk detection with citation-ready research trails for rapid author verification.

### Role Playing Checkpoint

Role Playing validated three complementary feedback ecosystems: author operations workflow, experiential beta-reading, and domain-expert realism assurance. The session is now ready to transition into Morphological Analysis for architecture selection and implementation strategy.

## Morphological Analysis - Ranked Recommendation Bundles

### Rank 1: Extension-First, Safety-Hardened Local Workflow (Recommended Baseline)

- Product Form Factor: Extension + optional local web companion view
- Repository Placement: Separate now, with later monorepo integration hooks
- Data Backbone: Markdown + JSON index/cache files
- Issue Model: Per-session recommendation files + consolidator + master index
- Context Enforcement: Hard allowlists + retrieval filtering
- Manuscript Protection: Write-block + optional patch preview in non-manuscript files
- Entry Points: UI actions + chat commands
- Visual Layer: Hierarchy first, graphs in v1.5 behind flag
- Evidence Policy: Factual risk requires source + confidence + verify-manually flag
- Build Strategy: Two-track MVP (author workflow + beta reader workflow)

Why this ranks first: aligns with VS Code-first preference, preserves local/repo-native state, and implements hard guardrails before advanced visual complexity.

### Rank 2: Fastest MVP to Learn Quickly

- Product Form Factor: VS Code extension only
- Repository Placement: Separate now, with later monorepo integration hooks
- Data Backbone: Markdown + JSON index/cache files
- Issue Model: Per-session recommendations + consolidator + master index
- Context Enforcement: Hard allowlists + retrieval filtering
- Manuscript Protection: Write-block + patch preview outside manuscript paths
- Entry Points: UI actions + chat commands
- Visual Layer: Basic hierarchy and issue lists first
- Evidence Policy: Factual risk requires at least one source link
- Build Strategy: Single MVP focused on chapter workflow

Why this ranks second: lowest build risk and fastest feedback loop while still preserving core safety and context constraints.

### Rank 3: Credibility-Heavy Expert Edition

- Product Form Factor: Extension + optional local companion view
- Repository Placement: Separate repository
- Data Backbone: Markdown + JSON index/cache files
- Issue Model: Per-session recommendations + consolidator + master index
- Context Enforcement: Hard allowlists + retrieval filtering
- Manuscript Protection: Write-block + patch preview outside manuscript files
- Entry Points: UI actions + chat commands
- Visual Layer: Hierarchy first, graphs in v1.5
- Evidence Policy: Factual risk requires source + confidence + verify-manually flag
- Build Strategy: Three-track MVP (author + beta reader + expert realism)

Why this ranks third: strongest realism and trust features, but broader MVP scope increases delivery complexity.

### Rank 4: Graph-Forward Story Intelligence

- Product Form Factor: Extension + optional local companion view
- Repository Placement: Separate now, with later integration hooks
- Data Backbone: Markdown + local SQLite sidecar (reproducible)
- Issue Model: Single canonical issues store with derived views
- Context Enforcement: Hard allowlists + retrieval filtering
- Manuscript Protection: Write-block + patch preview outside manuscript files
- Entry Points: UI actions + chat commands
- Visual Layer: Timeline + relationship graph in v1
- Evidence Policy: Factual risk requires source + confidence + verify-manually flag
- Build Strategy: Two-track MVP

Why this ranks fourth: best for advanced story-lens UX, but data-model and sync complexity is higher earlier.

### Rank 5: Monorepo-Native Integration Path

- Product Form Factor: VS Code extension only
- Repository Placement: ElandApps monorepo app
- Data Backbone: Markdown + JSON index/cache files
- Issue Model: Per-chapter files + project rollup
- Context Enforcement: Retrieval filtering by profile/chapter boundary
- Manuscript Protection: Tool-enforced write-block
- Entry Points: UI actions + chat commands
- Visual Layer: Basic hierarchy first
- Evidence Policy: Factual risk requires at least one source link
- Build Strategy: Two-track MVP

Why this ranks fifth: integration convenience is high, but this project's audience and domain are currently outside ElandApps app focus and may create repository coupling too early.

### Morphological Decision

**Selected Bundle:** Rank 1 - Extension-First, Safety-Hardened Local Workflow

**Decision Summary:**

- Build as a VS Code extension with optional local companion view for dual-surface workflows.
- Keep project state local-first and repository-native using markdown + JSON indexing artifacts.
- Enforce manuscript immutability and role-scoped AI context with hard technical boundaries.
- Support both command-surface entry points (UI actions and chat commands).
- Prioritize hierarchy/issue workflows first, with timeline/relationship graphs as a later staged capability.
- Require evidence-oriented factual-risk recommendations with explicit human verification cues.

**Repository Strategy Decision:**

- Planning and early documentation may live in this repository.
- Before deep implementation detail and build-out, migrate project artifacts to a dedicated standalone repository.
- Preserve portability by keeping design artifacts, schemas, and workflow contracts repository-agnostic from the start.

**Rationale:** This path best matches the author's VS Code-first workflow, local-first requirements, strict authorial control over manuscript text, and need for trustworthy AI assistance with auditable recommendations.

## Artifacts Produced

Data contracts and portable schemas are stored at:
`_bmad-output/projects/lean-quill/data-contracts/`

| Artifact | Purpose |
| -------- | ------- |
| [README.md](..\projects\lean-quill\data-contracts\README.md) | Folder overview and repo layout convention |
| [project-config-schema.md](..\projects\lean-quill\data-contracts\project-config-schema.md) | Per-project tool configuration with Deep Water Silence sample |
| [issue-schema.md](..\projects\lean-quill\data-contracts\issue-schema.md) | All issue/recommendation types with 4 realistic sample issues |
| [chapter-status-schema.md](..\projects\lean-quill\data-contracts\chapter-status-schema.md) | Chapter progress tracking with Chapter 3 sample |
| [persona-schema.md](..\projects\lean-quill\data-contracts\persona-schema.md) | Beta-reader and expert-reviewer profiles with 2 complete samples |
| [chat-log-schema.md](..\projects\lean-quill\data-contracts\chat-log-schema.md) | AI session audit trail with chapter review and issue-planning samples |
