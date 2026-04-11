/**
 * Author-selectable issue types (folder slugs under `.leanquill/issues/{type}/`).
 * Mirrors Imported/data-contracts/issue-schema.md — `question` replaces legacy `author-note`.
 */
export const AUTHOR_ISSUE_TYPES: readonly string[] = [
  "question",
  "task",
  "continuity",
  "copy-edit",
  "voice",
  "narrative-quality",
  "beta-reader",
  "factual-risk",
  "missing-expected-fact",
  "expert-realism",
];
