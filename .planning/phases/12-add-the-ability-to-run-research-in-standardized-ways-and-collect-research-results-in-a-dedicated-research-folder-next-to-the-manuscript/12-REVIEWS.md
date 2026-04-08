---
phase: 12
reviewers: [copilot-claude-sonnet-4.6]
reviewed_at: 2026-04-07T00:00:00Z
plans_reviewed:
  - 12-01-PLAN.md
  - 12-02-PLAN.md
review_mode: single-agent (no external CLI available)
---

# Cross-AI Plan Review — Phase 12
## Standardized Research Workflow and Results Repository

> **Note:** This is a single-agent review produced by GitHub Copilot (Claude Sonnet 4.6),
> performed against the completed implementation rather than the plans in isolation.
> External CLI reviewers (Gemini, Codex, Claude CLI) were not available in this environment.
> Findings reference both plan intent and actual code as shipped.

---

## Review

### Summary

Phase 12 delivers a clean, well-scoped feature: a project config reader, an extended SafeFileSystem, schema migration, three AI harness entry points, and a Research sidebar with quick-start button. The architecture is consistent with existing codebase patterns (TreeDataProvider, line-based YAML, SafeFileSystem allowlists), the plan coverage is complete, and the implementation passes all 19/19 must-have truths at 106/106 tests. The design decisions are sound with one genuine concern (CRLF line ending sensitivity in frontmatter parsing) that represents a real user-facing bug risk on Windows, and two moderate concerns around SafeFileSystem path hygiene and error resilience in config loading. Nothing in this phase is a blocker; the concerns are addressable in a maintenance phase.

---

### Strengths

- **`projectConfig.ts` is properly isolated.** A dedicated module for YAML parsing keeps config-reading logic out of `extension.ts` and out of `initialize.ts`. It has no external dependencies, and the line-based regex approach is appropriate for LeanQuill-generated controlled YAML — no third-party parser needed.

- **`SafeFileSystem.allowPath` composes with the existing model.** The extension filter (`.md` only for research writes) is a clean constraint layered on top of the proven allowlist pattern. SafeFileSystem remains the single enforcement point; no bypass was introduced.

- **Migration is conservative.** `migrateProjectYaml` only replaces the known default value `notes/research/` — it doesn't touch user-customized research paths. Schema version is bumped correctly regardless. This is the right behavior: users who customized the path don't lose their choice.

- **Harness entry points are idempotent at both init and activation.** Using `fs.stat` before `fs.writeFile` means running `Initialize Project` multiple times or activating on an existing project won't overwrite user-edited entry point files. Calling `writeHarnessEntryPoints` on activation (line 111 of `extension.ts`) also backfills the files for projects initialized before Phase 12 — a thoughtful backwards-compatibility addition not specified in the plan.

- **Testable pure functions in `researchTree.ts`.** `parseFrontmatter` and `buildResearchItems` are exported independently and tested without VS Code mocks. The `vscode` module is injected into `ResearchTreeProvider`'s constructor rather than imported directly, preserving platform-independent test coverage.

- **Graceful empty-state handling.** `buildResearchItems` catches ENOENT when the research directory doesn't exist yet, returns an empty array, and the `viewsWelcome` contribution in `package.json` gives the right user-facing message. No crash on first use.

- **`workbench.action.chat.newChat` → `chat.open` fallback sequence.** Trying `newChat` first prevents the quick-start button from hijacking an existing conversation; `isPartialQuery: true` keeps the query non-submitted so the author fills in their specific question before sending. This accurately implements D-09.

- **FileSystemWatcher covers all three change events.** Create, change, and delete all trigger a tree refresh. Many similar implementations only wire `onDidCreate`.

---

### Concerns

**[MEDIUM] CRLF line endings will silently break frontmatter parsing**

`parseFrontmatter` uses the regex `^---\n([\s\S]*?)\n---`. On Windows, markdown files edited in VS Code with default settings (or created by any tool that writes CRLF) will have `\r\n` line endings. The closing `---` in those files appears as `\r\n---`, which does not match `\n---`. The result is silent failure: `parseFrontmatter` returns `{}`, the tree item falls back to the filename-derived name and `mtime`, and the author sees a degraded (but not broken) display with no indication of why. AI harnesses themselves typically write LF, so agent-generated research files are probably safe — but manually created or edited files on Windows are a realistic failure path.

Fix: normalize line endings at the top of `parseFrontmatter`:
```typescript
const normalized = content.replace(/\r\n/g, "\n");
const match = /^---\n([\s\S]*?)\n---/.exec(normalized);
```

---

**[MEDIUM] `SafeFileSystem.allowPath` has no reset or deduplication**

`allowPath` pushes to `additionalAllowed` with no mechanism to clear or replace stale entries. Within a single extension host activation this is fine — the research folder path is read once from `project.yaml`. However, if the `SafeFileSystem` instance were ever reconfigured (e.g., a future command that allows changing the research path from the UI), old paths would continue to be writable for the lifetime of that instance. The current code is safe; the design leaves a trap for future maintainers.

Consider at minimum documenting the single-activation assumption in a comment on `allowPath`, or add a `resetAllowedPaths()` method that clears `additionalAllowed` so callers can reconfigure cleanly.

---

**[MEDIUM] `readProjectConfig` re-throws non-ENOENT errors**

The catch block in `readProjectConfig` only handles `ENOENT` — all other errors (permission denied, locked file, corrupted YAML returning a parse error from future code changes) are re-thrown. In `extension.ts` this call happens during the activation path; an unhandled rejection here could break extension activation for the author with no user-visible explanation. The function probably should return `null` for any `Error` with a meaningful error code, and log a warning, rather than bubbling a raw filesystem error up through activation.

---

**[LOW] The canonical workflow template is a string constant embedded in `initialize.ts`**

The `.leanquill/workflows/research.md` content is hard-coded as a string in the source. Future improvements to the research skill process (e.g., updating steps for new harness formats, improving the Project Relevancy section prompt, adding caveats for tools unavailability) require a code change, an extension version bump, and the author to update their extension. No in-place update command exists. Authors with existing projects won't see these improvements until they manually delete the workflow file and re-run init (or until someone adds a `LeanQuill: Update Research Workflow` command).

This is acceptable for v1 but worth tracking as a known limitation.

---

**[LOW] Harness entry point "no-overwrite" guard means improvements never propagate**

The `fs.stat`-before-`fs.writeFile` guard is correct for respecting user customization, but it means a future version of the researcher agent definition (e.g., more detailed instructions, updated tool list) never reaches existing projects. Authors who want new entry point behavior have to delete the files manually. Consider versioning the entry points with a comment header (e.g., `<!-- leanquill-version: 12 -->`) to enable selective updates without clobbering customizations.

---

**[LOW] `hasCopilot` extension ID detection could miss edge cases**

`vscode.extensions.getExtension("github.copilot-chat")` is the right check for standard Copilot Chat. However, GitHub Copilot for Business may ship under a different extension ID in some enterprise installations. In fallback, the query prefix degrades to `"Research: "` which still works with any harness — so this failure mode is benign (no crash, just a less-contextual query prefix). Worth noting if enterprise VS Code environments are part of the target market.

---

**[LOW] `buildResearchItems` uses sequential file reads**

The per-file `fs.readFile` calls in `buildResearchItems` run sequentially in a `for` loop. For a small research corpus (10–20 files) this is imperceptible. For a power author with hundreds of research documents, `Promise.all` over the reads would be significantly faster. This is a clear v1 trade-off, but the fix is a one-line change to parallel reads.

---

**[LOW] Verification report cites placeholder text that doesn't match implementation**

The verification report (line describing truth #16) mentions `"Replace with your research question"` as the placeholder text in the pre-populated chat query. The actual implementation at line 175 of `extension.ts` sends `@researcher ` (trailing space, no placeholder text). The `isPartialQuery: true` flag means the query is editable before sending, so the author just types their question after the `@researcher ` prefix. This is correct behavior per D-09, and the UX is actually cleaner than injecting a placeholder the author has to delete. The verification report text is just imprecise — not a functional issue.

---

**[LOW] `writeHarnessEntryPoints` called on activation is an undocumented plan deviation**

Plan 12-01 specifies harness entry points are created during `initializeProject` only (with an `fs.stat` guard). The implementation also calls `writeHarnessEntryPoints(rootPath)` during activation (line 111, fire-and-forget with `.catch(() => {})`). This is a strictly better design: existing projects initialized before Phase 12 get the entry point files automatically without needing to re-run init. But it isn't covered by the plan, isn't in the must-have truths, and has no test. The behavior is correct and idempotent, but the test gap means a future regression could go undetected.

---

### Suggestions

1. **Fix CRLF parsing now** — add `content.replace(/\r\n/g, "\n")` at the top of `parseFrontmatter` and add a test with CRLF content. This is the highest-value single change from this review.

2. **Harden `readProjectConfig` error handling** — catch all errors (not just ENOENT), log a warning with the path and error code, and return `null`. Prevents activation failure from a locked/corrupted YAML file.

3. **Document the `allowPath` single-activation contract** — add an inline comment on the method explaining that entries are not deduplicated or cleared, so callers must only call this once per configured path (which is guaranteed today by the activation flow).

4. **Add a test for `writeHarnessEntryPoints` on activation (backfill case)** — create a temp dir with a valid `project.yaml` but no harness files, simulate activation, and assert the three files are created. This covers the undocumented-but-correct activation path.

5. **Track the workflow update problem** — add a `deferred` item or TODO in the code for a `LeanQuill: Update Research Workflow` command that would overwrite `.leanquill/workflows/research.md` unconditionally, so authors can opt into new workflow versions without re-initializing.

6. **Parallel reads in `buildResearchItems`** — low priority, but the fix is trivial:
   ```typescript
   const itemsOrNull = await Promise.all(mdFiles.map(async (file) => { ... }));
   const items = itemsOrNull.filter(Boolean) as ResearchItem[];
   ```

---

### Risk Assessment

**Overall: LOW**

This phase is well-implemented and fully verified. The architecture is coherent, the patterns are consistent with the codebase, and the test coverage is substantive. The highest-severity concern (CRLF parsing) is a genuine Windows-specific bug that will surface for a non-trivial percentage of authors, but it degrades gracefully rather than crashing — the author sees a fallback display name, not an error. All other concerns are maintenance and defensive-coding opportunities that do not affect the core functionality. The implementation delivers exactly what the phase goal describes.

---

## Consensus Summary

> Single-reviewer review — no cross-model consensus available.
> Findings below represent the most actionable and high-confidence analysis.

### Top Findings (Action Priority)

| Priority | Finding | File | Severity |
|----------|---------|------|---------|
| 1 | CRLF line endings break frontmatter parsing silently | `src/researchTree.ts` | MEDIUM |
| 2 | Non-ENOENT errors bubble through activation in `readProjectConfig` | `src/projectConfig.ts` | MEDIUM |
| 3 | `allowPath` accumulates without reset — design trap for future maintainers | `src/safeFileSystem.ts` | MEDIUM |
| 4 | `writeHarnessEntryPoints` on-activation path has no test | `test/` gap | LOW |
| 5 | Canonical workflow embedded string — no in-place update mechanism | `src/initialize.ts` | LOW |

### What's Well-Designed

- Clean module separation (`projectConfig.ts` as its own unit)
- SafeFileSystem extension filter elegantly layered on the existing model
- Idempotent harness file writes at both init and activation
- Testable pure functions in `researchTree.ts` without VS Code mocks
- Graceful empty-state handling at every layer

### Primary Recommendation

Fix the CRLF issue in `parseFrontmatter` before shipping. It's a one-line fix with a one-test addition, and it prevents a real authoring experience degradation on Windows — exactly the target platform.

---

*Reviewed: 2026-04-07T00:00:00Z*
*Reviewer: GitHub Copilot (Claude Sonnet 4.6) — single-agent manual review*
*To incorporate feedback: address Priority 1–2 as maintenance fixes; track 4–5 as future work*
