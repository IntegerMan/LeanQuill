---
phase: 17-ai-story-chat-memory-and-metadata-actions
plan: "03"
subsystem: ai
tags: [metadata-actions, validation, action-log]

key-files:
  created:
    - src/metadataActionContract.ts
    - src/metadataActionLog.ts
    - src/metadataActionApplier.ts
    - test/metadataActionContract.test.ts
    - test/metadataActionLog.test.ts
    - test/metadataActionApplier.test.ts
  modified:
    - src/storyChatLogStore.ts
---

## Self-Check: PASSED

## Outcomes

- Portable `MetadataAction` validation with manuscript/traversal blocks, approval rules, and corrected story-metadata detection (excluding generic `.leanquill/` prefix from entity bypass matching).
- JSONL action log append/read under `.leanquill/metadata-actions.jsonl`.
- `applyMetadataAction` with configured roots, memory/issue/theme/research/chat provenance updates, custom field mutations, and stale `oldValue` rejection.
- `readStoryChatLogSummaryFromDisk` + `launched_from` serialization field for provenance round-trips.

## Deviations

- Research association updates rewrite frontmatter scalars with JSON-stringified values for testability (sufficient for structured association keys).
