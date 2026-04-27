---
phase: 17-ai-story-chat-memory-and-metadata-actions
plan: "01"
subsystem: ai
tags: [story-chat, context-bundle, harness-draft]

key-files:
  created:
    - src/storyChatContext.ts
    - test/storyChatContext.test.ts
  modified:
    - src/harnessChatDraft.ts
    - test/harnessChatDraft.test.ts
---

## Self-Check: PASSED

## Outcomes

- Added `StoryChatContextBundle` construction with general default `manuscriptScope: none`, manuscript path stripping for `none`, selection validation and 2k excerpt cap, path normalization, and deterministic `buildStoryChatContextSummary` including required safety line.
- Extended harness draft helpers with `storyChat` kind, `buildStoryChatDraftQuery`, and story-chat fallback hint for Cursor/Copilot and plain editors.

## Deviations

- None.
