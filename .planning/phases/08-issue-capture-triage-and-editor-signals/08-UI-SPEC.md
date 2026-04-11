---
phase: 8
slug: issue-capture-triage-and-editor-signals
status: draft
shadcn_initialized: false
preset: none
created: 2026-04-10
reviewed_at: null
---

# Phase 8 — UI Design Contract

> Visual and interaction contract for unified author issues: planning workspace + bottom-panel triage (Phase 14 parity), sidebar **X Issues** counts, and manuscript **gutter** signals for `span_hint` anchors. Aligns with `08-CONTEXT.md` D-05–D-16.

---

## Design System

| Property | Value |
| -------- | ----- |
| Tool | VS Code extension webviews + native editor decorations |
| Preset | not applicable |
| Component library | none — static HTML string build + shared CSS (extend `openQuestionsHtml.ts` / planning patterns) |
| Icon library | VS Codicons in extension chrome and gutter decorations; webview uses theme tokens |
| Font | VS Code theme variables (`--vscode-font-family`, `--vscode-font-size`) in webviews |

---

## Surface Contract

### Planning workspace — Issues tab (name TBD in PLAN; replaces Open Questions as primary triage host for author issues)

- Surface type: webview inside the Planning workspace (tab adjacent to Outline / Characters / Places / Threads / Open questions or successor tab order per PLAN).
- Primary layout: **master–detail** — scrollable issue list; detail panel for title, body, status, type label, associations (chapter, entity, research file as applicable), optional `dismissed_reason`.
- List row shows: **title** (primary), **type label** via unified `displayIssueTypeLabel` pattern (D-16), **association chip(s)**, **status** (icon + label). No separate “research-question” type in UI; research-linked items use normal types + association (D-15).

### Bottom panel — Issues view

- Surface type: `WebviewViewProvider` in the **panel** region (same family as Phase 14 open-questions panel).
- **Reuse** the same HTML structure, CSS tokens, and client message protocol as the Planning tab host (Phase 14 D-02 pattern). `retainContextWhenHidden: true` when consistent with existing views.

### Sidebar trees (native)

- **D-09:** Outline, Characters, Places, Threads (and similar entity rows) show **open issue count** as **`X Issues`** in the row description area — **counts only** in Phase 8; no drill-down rows (backlog 999.1).

### Manuscript editor — gutter

- **D-11–D-13:** `TextEditorDecorationType` in the **gutter** (not overview ruler unless PLAN unifies). Theme-friendly codicon; **tooltip** lists issue title(s) and count when stacked.
- **Single issue** at anchor: click navigates **directly** to issue file / reveals in list.
- **Multiple issues** at/near anchor: **one** glyph; click opens **QuickPick** to choose target unless exactly one resolved match (then direct navigation).

---

## Status presentation (Phase 8 full set)

| Status | Display label | Notes |
| ------ | --------------- | ----- |
| open | Open | default triage |
| deferred | Deferred | visible in default filter (D-06) |
| dismissed | Dismissed | hidden until user selects filter that includes dismissed |
| resolved | Resolved | shown when filter includes resolved / all per PLAN |

**D-06:** Default list filter = **`open` + `deferred`**; **dismissed** excluded until user chooses **All**, **Dismissed**, or equivalent. Apply identically in Planning tab and panel.

**D-07:** Dismiss action from row and/or command palette; optional rationale persisted as **`dismissed_reason`**.

---

## Filter contract

| Filter / view | Included statuses |
| ------------- | ----------------- |
| Default | open, deferred |
| Open | open only (if exposed) |
| Deferred | deferred only (if exposed) |
| Dismissed | dismissed |
| All | all statuses |

Exact control chrome (dropdown vs tabs) is planner discretion; semantics are fixed.

---

## Interaction Contract

| Interaction | Contract |
| ----------- | -------- |
| **D-14** New issue | Primary flow: **New issue** → enter **name/title** → **choose issue type** (palette or toolbar). Type-first context menus are not the default story. |
| Create with context | Chapter tree / entity row / selection commands may pre-fill association after type+title step per PLAN. |
| Triage | Status changes apply immediately; dismissed stores optional `dismissed_reason`. |
| Navigate from list | Same rules as Phase 14: resolve `chapter_ref` / `span_hint`; stale anchor shows muted/warning treatment + best-effort open chapter (D-13). |
| Gutter click | Direct open or QuickPick per stacking rules (D-12). |
| Research linkage (PLAN-03) | Surface issues with research associations **alongside** others in the same lists; no separate “research question” type label (D-15). |

---

## Layout Contract

- Master–detail split: default **40% / 60%** list/detail on wide view; stack below ~520px webview width.
- Detail form: single column; **16px** padding; **8px** vertical gap between fields; primary actions at bottom.
- **One** toolbar strip per host: **New issue**, filter control, refresh (exact labels in Copywriting table).

---

## Spacing Scale

| Token | Value | Usage |
| ----- | ----- | ----- |
| xs | 4px | Chips, icon gaps |
| sm | 8px | List row padding, field gaps |
| md | 16px | Pane padding |
| lg | 24px | Section separation in detail |
| xl | 32px | Empty state rhythm |

Must match between Planning tab and panel.

---

## Typography

| Role | Size | Weight | Line height |
| ---- | ---- | ------ | ----------- |
| Body | `var(--vscode-font-size)` | 400 | 1.5 |
| Label | 12px | 600 | 1.3 |
| List title | 13px | 600 | 1.3 |
| Detail title | 15px | 600 | 1.25 |

---

## Color

| Role | Token | Usage |
| ---- | ----- | ----- |
| Surface | `var(--vscode-sideBar-background)` / `var(--vscode-editor-background)` | Webview root |
| Elevated | `var(--vscode-editorWidget-background)` | Selected row, detail card |
| Border | `var(--vscode-widget-border)` | Dividers |
| Muted | `var(--vscode-descriptionForeground)` | Previews, chips |
| Stale / warning | `var(--vscode-list-warningForeground)` | Unresolved `span_hint`, stale links |
| Error | `var(--vscode-errorForeground)` | Save/load failures |

Gutter decoration colors must use theme-aware decoration API (no hardcoded hex).

---

## Copywriting Contract

| Element | Copy |
| ------- | ---- |
| Default new-issue command title | LeanQuill: New issue (or PLAN-finalized string) |
| Sidebar count suffix | `X Issues` (e.g. `3 Issues`) |
| Empty list (triage) | No issues match this filter. |
| Empty hint | Create an issue from the command palette or a chapter, selection, or planning row. |
| Filter: default | Active issues |
| Filter: all | All issues |
| Dismiss confirm (if used) | Dismiss this issue? (optional rationale field) |
| Gutter tooltip (single) | `{title}` |
| Gutter tooltip (multiple) | `{count} issues — click to choose` |

Sentence case for sentences; **Issues** capitalized in count label per D-09.

---

## Empty, Warning, and Error States

| State | Contract |
| ----- | -------- |
| No issues in filter | Empty list + filter-appropriate hint. |
| Loading | Same pattern as Phase 14 (skeleton or “Loading…”). |
| Stale `span_hint` | Muted gutter + tooltip indicates uncertain match; list/detail may show stale state (align with Phase 14 copy family). |
| Save failure | Inline error; retain unsaved edits where possible. |

---

## Accessibility and Safety

- Keyboard: list navigation, Enter to open detail, Tab through form; QuickPick for multi-issue gutter follows VS Code defaults.
- Status not color-only (icon + text).
- Webview CSP aligned with existing Planning webviews.
- Gutter glyphs have accessible titles/tooltips.

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
| -------- | ----------- | ----------- |
| none — VS Code APIs + HTML strings | none | No third-party UI registry |

---

## Source Notes

- `08-CONTEXT.md`: D-05–D-16, migration, gutter, sidebar counts.
- `14-UI-SPEC.md`: dual-host parity, spacing, typography baseline.
- `Imported/data-contracts/issue-schema.md`: fields and associations.

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: pending
- [ ] Dimension 2 Visuals: pending
- [ ] Dimension 3 Color: pending
- [ ] Dimension 4 Typography: pending
- [ ] Dimension 5 Spacing: pending
- [ ] Dimension 6 Registry Safety: pending

**Approval:** pending
