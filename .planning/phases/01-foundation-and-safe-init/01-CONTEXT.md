# Phase 1: Foundation and Safe Init - Context

**Gathered:** 2026-03-29
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers extension foundation and safe initialization only: create LeanQuill project state, resolve chapter ordering deterministically, and enforce a hard write boundary that protects manuscript files.

</domain>

<decisions>
## Implementation Decisions

### Initialization UX
- **D-01:** Initialization flow uses guided prompts (not silent defaults and not template-only editing).
- **D-02:** Initialize requires the full identity set before file creation: `project_id`, `working_title`, `genre`, and `target_audience`.
- **D-03:** Initialization writes immediately after prompts (no separate summary-confirmation step).
- **D-04:** If project state already exists (`.leanquill/` or `project.yaml`), initialize offers an overwrite prompt.
- **D-05:** `project_id` is auto-derived from `working_title` as kebab-case, with user override.
- **D-06:** If `manuscript/` is missing, initialize creates it automatically.
- **D-07:** After successful initialize, run chapter scan immediately.
- **D-08:** Initialization is available from both the command palette and an extension-pane button; both trigger the same workflow.

### Safe File Boundary
- **D-09:** Use a default-deny allowlist model for write permissions.
- **D-10:** In Phase 1, writable targets are limited to `.leanquill/**` and `project.yaml`.
- **D-11:** Blocked write attempts show an error notification and produce an audit/log entry.
- **D-12:** Symlink/realpath traversal hardening is deferred from Phase 1 (track as follow-up hardening work).

### Chapter Order Resolution
- **D-13:** If `Book.txt` exists, it is strict source of truth for chapter ordering.
- **D-14:** Missing files referenced by `Book.txt` produce warnings and processing continues.
- **D-15:** Duplicate entries in `Book.txt` keep first occurrence and emit warnings for later duplicates.
- **D-16:** If `Book.txt` is absent, fallback ordering uses natural filename sort (for example, `ch2` before `ch10`).

### Activation and Discovery
- **D-17:** Extension activation uses command invocation plus a lightweight workspace-open check.
- **D-18:** Initialize affordance is always visible in the extension pane.
- **D-19:** Automatic proactive initialize prompting should use LeanPub markers (`Book.txt` or `manuscript/`) when not yet initialized.
- **D-20:** If dismissed, prompt suppression applies for the current workspace session.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Product and Scope
- `.planning/ROADMAP.md` - phase boundary, success criteria, and dependency order for Phase 1.
- `.planning/REQUIREMENTS.md` - INIT-01 and INIT-02 requirement details.
- `.planning/PROJECT.md` - core constraints (local-first, manuscript immutability, VS Code extension target).

### Data Contracts
- `Imported/data-contracts/project-config-schema.md` - required `project.yaml` structure and policy fields.
- `Imported/contracts/chapter-status.schema.json` - chapter state schema reference for future chapter scan/index outputs.
- `Imported/contracts/issue.schema.json` - issue schema reference for foundation-level file model compatibility.
- `Imported/contracts/persona-schema.json` - persona data contract baseline for later AI phases.
- `Imported/contracts/chat-log-schema.json` - chat-log contract baseline for later AI audit trails.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- No extension source code exists yet in this repository.

### Established Patterns
- Current repository is planning/contracts-first; implementation patterns are not established yet.

### Integration Points
- Phase 1 should establish initial extension scaffolding and safe I/O boundary primitives that future phases call into.

</code_context>

<specifics>
## Specific Ideas

- Initialization should be discoverable for both command-driven and UI-driven users (palette command plus pane button).
- The two initialize entry points should execute the same underlying workflow and produce identical outcomes.

</specifics>

<deferred>
## Deferred Ideas

- Safe boundary hardening for symlink/realpath canonicalization was explicitly deferred (not in Phase 1).

</deferred>

---

*Phase: 01-foundation-and-safe-init*
*Context gathered: 2026-03-29*
