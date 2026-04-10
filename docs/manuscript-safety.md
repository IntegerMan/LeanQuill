# Manuscript safety

Manuscript immutability is a core design principle. AI agents and extension code are structurally prevented from modifying your writing.

## How it works

The `SafeFileSystem` layer intercepts all write operations and enforces a whitelist:

| Writable path | Scope |
|----------------|-------|
| `.leanquill/**` | All tool state and planning files |
| `manuscript/Book.txt` | Chapter ordering file only |
| `notes/characters/**/*.md` | Character profiles |
| `notes/threads/**/*.md` | Thread profiles |
| `research/leanquill/**/*.md` | Research documents |

**Everything else under `manuscript/` is read-only** — the extension cannot write to your chapter files during normal operation. The only exception is during initialization, when the scaffold flow temporarily allows creating a starter chapter.

Actual configured folder paths come from `project.yaml`; the table above reflects the default layout.

## Policy layers

1. **Code enforcement** — `SafeFileSystem` rejects writes to non-whitelisted paths at the API level
2. **Configuration** — `ai_policy.manuscript_write_blocked: true` in `project.yaml` documents the policy
3. **AI harness** — Harness files (`.cursor/skills/`, `.github/agents/`, `.claude/agents/`) instruct AI agents to never modify manuscript files

---

[← Back to README](../README.md)
