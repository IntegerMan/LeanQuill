# Phase 13: LeanPub Workspace Initialization - Context

**Gathered:** 2026-04-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Authors can bring **any** workspace folder into LeanQuill: the **Setup** experience (same surface as today’s initialize affordance) is extended so it also establishes **LeanPub manuscript scaffolding** when needed — `manuscript/`, `manuscript/Book.txt`, and a first chapter file — without overwriting existing work, within SafeFileSystem rules. Copy and behavior must reflect that a directory need not already be a “LeanQuill project.”

</domain>

<decisions>
## Implementation Decisions

### Area 1 — Setup visibility, eligibility, and copy

- **D-01:** The **Setup** view remains the home for this capability (no separate scaffold-only pane). The **Initialize** (or equivalent) action’s **behavior changes by state** rather than adding a parallel entry point.
- **D-02:** Show the Setup / initialize path when **any** of:
  - `.leanquill` is missing, or
  - `.leanquill/project.yaml` is missing, or
  - `project.yaml` is **invalid** (parse/schema failure — define validation in implementation), or
  - **Manuscript scaffolding is incomplete:** `manuscript/` is missing **or** `manuscript/Book.txt` is missing (**A + B** only; presence of `.md` files alone does not drive this gate).
- **D-03:** **Copy audit:** Review user-facing strings that assume the user already opened a “LeanQuill” or manuscript-marked folder (e.g. “Open a LeanQuill directory”). Wording should allow **any folder** to be initialized or scaffolded, consistent with D-01–D-02.
- **D-04:** Expose eligibility to UI via **workspace context keys** (extend or add alongside `leanquill.isInitialized`, `leanquill.hasManuscriptMarkers`) so `viewsWelcome` `when` clauses stay declarative.

### Area 2 — SafeFileSystem and safety

- **D-05:** **No** permanent allowlist for arbitrary `manuscript/**/*.md` for all callers. Implementation may use either **scoped scaffold mode** (e.g. run-only callback) or **dedicated SafeFileSystem APIs** for scaffold paths — **planner/implementation chooses** (Claude’s discretion) as long as D-05 holds.
- **D-06:** **No preference** whether scaffold I/O goes through `SafeFileSystem` or raw `fs`, except that **path checks** must keep writes inside the workspace manuscript tree and respect the same safety intent.
- **D-07:** **Never overwrite** existing files targeted by this flow (chapter files, `Book.txt`). Create-only or skip; see Area 3 for chapter naming and `Book.txt` rules.
- **D-08:** **Audit trail:** On success, log **concise per-path creation** (or “skipped existing”) to the extension output channel in addition to any toast (see Area 4).

### Area 3 — Generated files (`Book.txt`, placeholder chapter)

- **D-09:** Default new chapter filename **`ch1.md`** (lowercase convention; on case-insensitive OS, treat existing **`Ch1.md`** / **`ch1.md`** as **already present** — do not create or overwrite; use **actual on-disk basename** in any new `Book.txt` line).
- **D-10:** If **`ch1.md` (case-insensitive) already exists:** **do not** write a new chapter file; treat that file as the chapter. When **`Book.txt` is created in this flow** (because it was missing), **include a line** pointing at that existing file’s basename.
- **D-11:** If **`manuscript/Book.txt` already exists:** **do not modify** it (no append, no edit). Only **create** `Book.txt` when it is missing. If the operation **cannot** succeed without changing an existing `Book.txt` (e.g. `ch1.md` exists but is not listed and the user expects auto-wiring), **do not** silently change it — see **D-14** / **D-18**.
- **D-12:** **New** placeholder chapter **content:** `# Chapter 1` (or index-appropriate number) **plus** one short stub line (e.g. inviting the author to write).
- **D-13:** **Tension (explicit):** D-10 wants `Book.txt` to reference an existing `ch1.md` when **creating** `Book.txt`. D-11 forbids editing **existing** `Book.txt`. If both `Book.txt` and `ch1.md` exist but `Book.txt` does not list the chapter, the flow **must not** patch `Book.txt` — surface **clear guidance** via D-18.

### Area 4 — After success and failure UX

- **D-14:** On **success:** show an **information notification** (toast).
- **D-15:** On **success:** **do not** focus the chapter in the **text editor** as the primary affordance. Instead, open the **Planning Workspace** webview (`PlanningPanelProvider`, same surface as **LeanQuill: Open Planning Workspace**) with the **Cards** tab active. Today `show()` defaults to the outline tab; **`showCharacter`-style** behavior is the precedent — add a **small API** (e.g. `showCards()` or `show({ initialTab: "cards" })`) that sets `_activeTab` to **`cards`** before `show` / `_renderPanel`. Implementation detail is Claude’s discretion.
- **D-16:** **Toast + output channel** both for the user-visible outcome (success or failure), consistent with D-08.
- **D-17:** **Refresh after success:** Planner chooses the minimal set of refreshes so the new structure appears **without window reload** (e.g. `setWorkspaceContext`, chapter-order consumers, outline index bootstrap from `Book.txt` if empty — align with existing `extension.ts` activation patterns). No mandatory new contract beyond “no reload required.”
- **D-18:** When the flow **stops** because **existing `Book.txt` must not be modified** (D-11) but the user’s intent would require editing it, UX is **Claude’s discretion** between clear **error notification** vs **modal** — must include **actionable** next steps (e.g. open `Book.txt`, add line `ch1.md`).

### Claude's Discretion

- Scoped vs dedicated SafeFileSystem API (D-05).
- Raw `fs` vs `SafeFileSystem` wiring (D-06).
- Exact refresh sequence (D-17).
- Error vs modal for D-18.
- Exact invalid-`project.yaml` detection rules (D-02).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase and product scope
- `.planning/ROADMAP.md` — Phase 13 goal, success criteria, dependency on Phase 1.
- `.planning/REQUIREMENTS.md` — INIT-01, INIT-02.
- `.planning/PROJECT.md` — Manuscript immutability for AI, local-first, LeanPub layout.

### Prior phase context
- `.planning/phases/01-foundation-and-safe-init/01-CONTEXT.md` — Init UX baseline (note: Phase 13 **extends** eligibility and Setup behavior; resolve any overlap in one unified flow).
- `.planning/phases/02-core-chapter-workflow/02-CONTEXT.md` — Chapter order, `Book.txt` semantics.

### Code
- `src/chapterOrder.ts` — `manuscript/Book.txt` path and line format.
- `src/safeFileSystem.ts` — Write boundaries; scaffold integration.
- `src/extension.ts` — `setWorkspaceContext`, activation, watchers, outline bootstrap.
- `src/initialize.ts` — Current initialize flow (merge or refactor with scaffold logic).
- `src/planningPanel.ts` — `PlanningPanelProvider.show`, `_activeTab`, pattern from `showCharacter`.
- `src/planningPanelHtml.ts` — Tab ids (`outline`, `cards`, …).
- `package.json` — `leanquill.actions` Setup view, `viewsWelcome`, commands, context keys.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable assets
- `PlanningPanelProvider` — Add a first-class way to open with **Cards** tab (mirror `showCharacter` tab switching).
- `SafeFileSystem` — Today allows `manuscript/Book.txt`; chapter `.md` requires scoped or dedicated paths for scaffold only.
- `setWorkspaceContext` — Extend context keys for new eligibility (D-04).
- `package.json` `viewsWelcome` — Three Setup states today; may need a fourth or refined `when` for “initialized but manuscript incomplete.”

### Established patterns
- `showCharacter` sets `_activeTab` before `show` / `_renderPanel`.
- Post-init outline bootstrap and `bookTxtWatcher` in `extension.ts`.

### Integration points
- Unify **palette command** and **Setup** link so both invoke the same orchestration after Phase 13.
- Ensure success path refreshes data the Cards view needs (outline index / chapter list).

</code_context>

<specifics>
## Specific Ideas

- User corrected an earlier mistaken “Continue” as acceptance; decisions above come from explicit walkthrough Areas 1–4.
- Success UX explicitly prioritizes **Planning Workspace → Cards** over opening the `.md` in the editor.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 13-leanpub-workspace-initialization*
*Context gathered: 2026-04-08*
