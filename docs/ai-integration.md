# AI integration

LeanQuill uses the **VS Code Language Model API** — no external API keys required. It works with GitHub Copilot or any other compatible LM provider active in your VS Code session.

## Design philosophy

- AI is an **advisor**, never an **author**
- All AI output goes to `.leanquill/` state files, never to `manuscript/`
- The author has final say on all recommendations
- All AI features are optional — the extension is fully functional without them

## Planned AI features

- **Chapter review** — Trigger an AI review that produces issues and a chat log
- **Story intelligence updates** — AI analyzes new content and updates character/setting notes (without touching the manuscript)
- **Issue chat** — Right-click any issue to open a focused AI conversation
- **Persona library** — Per-project AI personas (casual-reader, avid-genre-fan, copy-editor) with three packaged defaults

## Research workflow

The Research view integrates with AI chat providers to support structured research sessions. Research output is saved as markdown files in the configured research directory with structured frontmatter.

---

[← Back to README](../README.md)
