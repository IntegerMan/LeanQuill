# Data Contracts — LeanQuill

Portable, repo-agnostic schemas for all tool-managed state. All artifacts are markdown files
with YAML frontmatter stored inside the author's book repository (not the tool repository).

## Schemas

| File | Purpose |
|------|---------|
| [project-config-schema.md](project-config-schema.md) | Per-project tool configuration and folder conventions |
| [chapter-status-schema.md](chapter-status-schema.md) | Chapter-level progress, status, and session notes |
| [issue-schema.md](issue-schema.md) | Issues, recommendations, and factual-risk findings |
| [persona-schema.md](persona-schema.md) | Beta-reader and expert-reviewer profiles |
| [chat-log-schema.md](chat-log-schema.md) | AI session audit trail entries |

## Repository Layout Convention (inside a book repo)

```
{book-repo}/
  manuscript/         # Chapter files — tool NEVER writes here
  notes/
    characters/
    settings/
    timeline/
    research/
  .leanquill/         # Tool-managed state — fully version-controlled
    project.yaml      # project-config-schema
    chapters/
      ch01-status.md  # chapter-status-schema (one per chapter)
    issues/
      sessions/
        2026-03-29-1430-chapter-review.md   # session issue output
      master-issues.md                       # consolidated open items
    personas/
      casual-fan.md   # persona-schema
      maritime-expert.md
    chats/
      2026-03-29-1430-chapter-review-chat.md  # chat-log-schema
```

## Conventions

- All IDs are kebab-case strings, unique within a project.
- Timestamps are ISO 8601 local date-time strings.
- Source references use relative paths from the book repo root.
- Tool must never write to `manuscript/` under any circumstances.
