---
phase: 17-ai-story-chat-memory-and-metadata-actions
plan: "05"
subsystem: ai
tags: [extension-commands, story-chat, metadata-actions]

key-files:
  created:
    - test/storyChatExtensionCommands.test.ts
  modified:
    - src/extension.ts
    - package.json
---

## Self-Check: PASSED

## Outcomes

- Commands: `leanquill.startStoryChat`, contextual `chatAbout*` (issue, chapter, selection, character, place, thread, theme, research), `applyMetadataAction`, `saveStoryChatSummary`, `openStoryMemory`.
- `openStoryChatWithContext` merges `STORY_CHAT_BASE_CTX` (project, outline index, chapter status) with targets, `listStoryMemory` / `storyMemoryToContext` for `activeMemory`, bounded selection excerpt and `spanHint` for selection scope.
- `package.json`: `onCommand` activation entries, contributes.commands with titles/icons, command palette, `editor/context`, `view/item/context` (including `leanquill.openQuestionsPanel`), `webview/context` for outline chapter chat, outline title-bar `startStoryChat`.
- Static wiring test `storyChatExtensionCommands.test.ts` guards imports and command registration strings.

## Deviations

- Plan acceptance text referenced `selection.active`; implementation uses `ed.selection` / `editor.selection`. The static test matches the implementation.
