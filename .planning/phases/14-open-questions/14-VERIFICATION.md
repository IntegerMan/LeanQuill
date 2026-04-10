---
phase: 14-open-questions
status: passed
verified: "2026-04-10"
---

# Phase 14 Verification: Open Questions

## Automated

- `npm run build` — extension bundle succeeds.
- `npm run build:test && npm test` — all tests pass (including `openQuestionStore`, chapter counts, `chapterStatus` preservation).

## Must-haves (roadmap)

1. **Create with associations** — Commands and outline/planning row context create questions with book / chapter / selection / character / place / thread associations (`extension.ts`, `planningPanel.ts`, `planningPanelHtml.ts`, `outlineWebviewPanel.ts`).
2. **Consolidated list** — Planning **Open questions** tab and panel `leanquill.openQuestionsPanel` render via `openQuestionsHtml.ts` (D-01/D-02).
3. **Navigate targets** — `leanquill.openQuestionTarget` branches on `lq_assoc_kind` (via `OpenQuestionRecord.association`) to planning workspace, entity files under `folders.characters` / `folders.settings` / `folders.threads`, and manuscript with optional `span_hint` selection (`extension.ts`).
4. **Status + refresh** — `open` / `deferred` / `resolved` only; debounced save; `.leanquill/open-questions/**` watcher refreshes planning, panel, and outline.

## Human UAT

Manual checks per `14-VALIDATION.md` (docked panel, context menus in running VS Code) remain recommended but are not blocking for `status: passed` given automated coverage above.
