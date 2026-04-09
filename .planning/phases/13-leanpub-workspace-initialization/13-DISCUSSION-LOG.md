# Phase 13: LeanPub Workspace Initialization - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-08
**Phase:** 13-leanpub-workspace-initialization
**Areas discussed:** Sidebar visibility & eligibility, SafeFileSystem & manuscript writes, Generated files, Post-success UX

---

## Sidebar visibility and eligibility

| Option | Description | Selected |
|--------|-------------|----------|
| A | Affordance only when LeanQuill initialized + scaffold incomplete | ✓ |
| B | Affordance for any workspace with incomplete scaffold | |
| C | Always show alongside Initialize | |

**User's choice:** Continue — adopted **A** with scaffold incomplete defined as missing `manuscript/`, missing `manuscript/Book.txt`, or no `*.md` under `manuscript/`; new context key for `when` clauses.

**Notes:** Uninitialized flow remains Phase 1 Setup welcome + initialize command.

---

## SafeFileSystem and manuscript writes

| Option | Description | Selected |
|--------|-------------|----------|
| A | Permanent allowlist for all `manuscript/*.md` | |
| B | Command-scoped expansion or dedicated SafeFileSystem APIs for scaffold paths only | ✓ |

**User's choice:** Continue — adopted **B** (no permanent blanket `.md` allowlist; scoped write path for mkdir + `Book.txt` + created `ch*.md` only).

**Notes:** Preserves manuscript safety story for non-scaffold callers.

---

## Generated files (Book.txt and placeholder chapter)

| Option | Description | Selected |
|--------|-------------|----------|
| A | Fixed `ch1.md` + fresh `Book.txt` with one line | ✓ (with collision / existing-file rules) |
| B | User-picked filename each time | |
| C | Match only `project.yaml` pattern dynamically in UI | |

**User's choice:** Continue — default `ch1.md`, `Book.txt` lines relative to `manuscript/`; create vs append rules for existing `Book.txt`; bump to `ch2.md`, … on collision; placeholder body `# Chapter 1` + short stub.

---

## After success (UX and refresh)

| Option | Description | Selected |
|--------|-------------|----------|
| A | Toast + refresh context + open new chapter | ✓ |
| B | Toast only, no auto-open | |
| C | Modal confirmation before every write | |

**User's choice:** Continue — adopted **A**; no modal unless `Book.txt` edit is ambiguous/destructive (per CONTEXT D-10/D-17).

---

## Claude's Discretion

- Notification copy; exact SafeFileSystem mechanism (callback vs methods) subject to planner/implementation.

## Deferred Ideas

None recorded.
