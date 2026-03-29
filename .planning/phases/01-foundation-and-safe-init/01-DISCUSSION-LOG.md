# Phase 1: Foundation and Safe Init - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md. This log preserves alternatives considered.

**Date:** 2026-03-29
**Mode:** discuss
**Areas discussed:** Initialization UX, SafeFileSystem policy model, Book.txt parsing behavior, Extension activation strategy

## 1. Initialization UX

### Q1: How should initialize collect `project.yaml` metadata?
- Options presented:
  - Guided prompts
  - Silent defaults
  - Open template file
- User selected: Guided prompts

### Q2: Which fields should be required in v1?
- Options presented:
  - Require only `working_title`
  - Require `working_title + genre`
  - Require full identity set
- User selected: Require full identity set

### Q3: Show confirmation summary before writing?
- Options presented:
  - Yes, show summary + confirm
  - No, write immediately
- User selected: No, write immediately

### Q4: If already initialized, what should initialize do?
- Options presented:
  - Stop and explain next step
  - Offer overwrite prompt
  - Merge missing pieces only
- User selected: Offer overwrite prompt

### Deepen pass follow-up

### Q5: `project_id` generation
- Options presented:
  - Auto-derive from `working_title` + allow edit
  - Always user-entered
  - Fixed placeholder
- User selected: Auto-derive + allow edit

### Q6: If `manuscript/` is missing during initialize
- Options presented:
  - Warn and continue
  - Block initialization
  - Create `manuscript/` automatically
- User selected: Create `manuscript/` automatically

### Q7: Post-initialize behavior
- Options presented:
  - Open `project.yaml` + success message
  - Toast only
  - Run chapter scan immediately
- User selected: Run chapter scan immediately

### Q8: Trigger model clarification (free text)
- User response: Wants both a command in the VS Code command palette and a button in the extension pane prompting initialization; both should run the same workflow.

## 2. SafeFileSystem Policy Model

### Q1: Write-permission enforcement model
- Options presented:
  - Default-deny allowlist
  - Denylist manuscript only
  - Runtime prompt on risky writes
- User selected: Default-deny allowlist

### Q2: Writable path scope for Phase 1
- Options presented:
  - `.leanquill/**` and `project.yaml` only
  - Any non-manuscript file
  - `.leanquill/**` only
- User selected: `.leanquill/**` and `project.yaml` only

### Q3: Blocked-write user experience
- Options presented:
  - Error notification + log entry
  - Silent block
  - Warning only then continue
- User selected: Error notification + log entry

### Q4: Path traversal/symlink handling
- Options presented:
  - Canonicalize real path then enforce
  - String-prefix check only
  - Defer for later phase
- User selected: Defer for later phase

## 3. Book.txt Parsing Behavior

### Q1: Source of truth when `Book.txt` exists
- Options presented:
  - `Book.txt` primary, append unlisted manuscript files
  - `Book.txt` strict only
  - Merge and alphabetically re-sort
- User selected: `Book.txt` strict only

### Q2: Missing file referenced by `Book.txt`
- Options presented:
  - Warn and continue
  - Fail initialization
  - Silently ignore
- User selected: Warn and continue

### Q3: Duplicate entries in `Book.txt`
- Options presented:
  - Keep first occurrence + warn
  - Keep last occurrence
  - Fail initialization
- User selected: Keep first occurrence + warn

### Q4: Fallback ordering when no `Book.txt`
- Options presented:
  - Natural filename sort
  - Lexicographic sort
  - Modified-time order
- User selected: Natural filename sort

## 4. Extension Activation Strategy

### Q1: Activation timing
- Options presented:
  - On command invocation + lightweight workspace-open check
  - On every workspace open
  - Only when `.leanquill` exists
- User selected: On command invocation + lightweight workspace-open check

### Q2: Initialize prompt visibility behavior
- Options presented:
  - Show when LeanPub markers are detected and not initialized
  - Always show in pane
  - Never prompt automatically
- User selected: Always show in pane

### Q3: Initialization affordance surfaces
- Options presented:
  - Both command palette and extension pane button
  - Command palette only
  - Extension pane only
- User selected: Both command palette and extension pane button

### Q4: Dismissal suppression behavior
- Options presented:
  - Prompt every open until initialized
  - Suppress for current workspace session
  - Suppress permanently
- User selected: Suppress for current workspace session

## Outcome

Discussion completed and CONTEXT decisions captured in:
- `.planning/phases/01-foundation-and-safe-init/01-CONTEXT.md`
