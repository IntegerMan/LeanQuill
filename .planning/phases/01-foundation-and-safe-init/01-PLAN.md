# Phase 1 Plan: Foundation and Safe Init

**Phase:** 01-foundation-and-safe-init
**Date:** 2026-03-29
**Status:** Ready for execution
**Source context:** 01-CONTEXT.md

## Goal

Bootstrap LeanQuill foundation so an author can initialize a LeanPub repository with safe write boundaries and deterministic chapter ordering.

## Scope Lock

In scope:
- Extension scaffold and command wiring for initialize flow
- `.leanquill/` and `project.yaml` creation workflow
- Chapter order resolution (`Book.txt` strict when present, natural alpha fallback when absent)
- Safe write boundary that only allows `.leanquill/**` and `project.yaml`

Out of scope:
- Symlink/realpath canonicalization hardening (explicitly deferred)
- Phase 2+ features (chapter tree UI, issue workflows, knowledge pane, AI flows)

## Inputs and Canonical References

- `.planning/ROADMAP.md`
- `.planning/REQUIREMENTS.md` (INIT-01, INIT-02)
- `.planning/PROJECT.md`
- `Imported/data-contracts/project-config-schema.md`
- `Imported/contracts/chapter-status.schema.json`
- `Imported/contracts/issue.schema.json`

## Workstreams

### WS-1: Extension Foundation and Activation

1. Initialize extension TypeScript scaffold (`src/extension.ts`, command registration, `package.json` contributions).
2. Register initialize command for command palette.
3. Add extension pane affordance that triggers the same initialize handler.
4. Implement activation strategy:
   - Command invocation activation
   - Lightweight workspace-open detection to surface initialize affordance behavior
5. Implement session-level dismissal suppression for proactive initialize prompt behavior.

Deliverables:
- Activation and command wiring committed
- One shared initialize entry point used by palette + pane button

### WS-2: Initialize Workflow and Project Scaffolding

1. Implement guided prompt sequence for required fields:
   - `project_id` (auto-derived kebab-case from `working_title`, editable)
   - `working_title`
   - `genre`
   - `target_audience`
2. Implement existing-project behavior:
   - If `.leanquill/` or `project.yaml` exists, prompt for overwrite.
3. Implement file/folder creation:
   - Create `manuscript/` if missing
   - Create `.leanquill/` base structure
   - Create `project.yaml` from contract-aligned defaults
4. Persist immediately after prompts (no confirmation gate).
5. Trigger chapter scan immediately after successful initialize.

Deliverables:
- Working initialize flow that satisfies INIT-01
- Valid `project.yaml` structure aligned to imported schema

### WS-3: Chapter Ordering Resolution

1. Implement chapter discovery pipeline:
   - If `Book.txt` exists: strict order from `Book.txt`
   - If `Book.txt` absent: natural filename sort from `manuscript/`
2. Add edge-case handling:
   - Missing file listed in `Book.txt` -> warn and continue
   - Duplicate entries -> keep first, warn for duplicates
3. Persist resolved chapter ordering to LeanQuill internal state for downstream phases.

Deliverables:
- Deterministic chapter ordering behavior satisfying INIT-02
- Warning telemetry/log entries for malformed `Book.txt`

### WS-4: SafeFileSystem Boundary

1. Implement a default-deny write gateway used by all extension write paths.
2. Define allowlist for Phase 1:
   - `.leanquill/**`
   - `project.yaml` at repo root
3. Reject any write outside allowlist, including manuscript paths.
4. On blocked attempt:
   - Show explicit error notification
   - Emit audit/log entry with attempted path and operation
5. Add unit tests for allowed and blocked path scenarios.

Deliverables:
- Enforced write boundary satisfying Phase 1 safety criterion
- Test coverage proving manuscript writes are blocked

## Verification Plan

### Functional Checks

1. Run initialize in a fresh LeanPub-style repo:
   - `.leanquill/` created
   - `project.yaml` created with required values
2. Validate chapter ordering:
   - With `Book.txt`: order follows file list exactly
   - Without `Book.txt`: natural alphabetical fallback
3. Validate safety boundary:
   - Allowed writes succeed for `.leanquill/**` and `project.yaml`
   - Attempted manuscript write is blocked and logged

### Test Coverage

1. Unit tests for prompt-to-config mapping and `project_id` derivation.
2. Unit tests for `Book.txt` parser edge cases (missing, duplicate, absent).
3. Unit tests for SafeFileSystem allowlist decisions.
4. Integration test for end-to-end initialize command.

### Exit Criteria

- INIT-01 and INIT-02 demonstrably satisfied
- All three Phase 1 roadmap success criteria pass
- No code path allows extension write to manuscript files

## Risks and Mitigations

- Risk: Ambiguous prompt behavior in non-LeanPub repos
  - Mitigation: keep prompt detection lightweight and suppress per workspace session when dismissed
- Risk: Inconsistent writes if handlers bypass boundary
  - Mitigation: centralize all writes through single SafeFileSystem gateway and test for bypass attempts
- Risk: Confusion between strict `Book.txt` and fallback mode
  - Mitigation: explicit warning messages and deterministic branch logic

## Execution Order

1. WS-1 foundation/activation
2. WS-2 initialize workflow
3. WS-3 chapter order resolution
4. WS-4 safety boundary
5. verification tests and manual acceptance checks

---

## Next Command

/gsd-execute-phase 1
