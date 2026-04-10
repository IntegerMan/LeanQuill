---
phase: 14
slug: open-questions
status: draft
shadcn_initialized: false
preset: none
created: 2026-04-10
reviewed_at: null
---

# Phase 14 — UI Design Contract

> Visual and interaction contract for Open Questions: Planning workspace host + bottom-panel host sharing one webview implementation. Generated for plan-phase gate; verify with `/gsd-ui-review` after implementation if desired.

---

## Design System

| Property | Value |
| -------- | ----- |
| Tool | VS Code extension webviews |
| Preset | not applicable |
| Component library | none — static HTML string build + shared CSS (same pattern family as `planningPanelHtml.ts`) |
| Icon library | VS Codicons in extension chrome; webview uses text/icons only as encoded in shared markup |
| Font | VS Code theme variables (`--vscode-font-family`, `--vscode-font-size`) in webviews |

---

## Surface Contract

### Planning workspace — Open Questions tab

- Surface type: webview hosted inside the existing Planning workspace (new tab alongside Characters / Places / Threads / Outline patterns).
- Primary layout: **master–detail** — left (or top on narrow width): scrollable list of open questions; right (or below): detail editor for title, body, status, association summary.
- List row shows: **title** (primary), **association chip** (book / character / place / thread / chapter / selection), **status** (icon + label), optional one-line body preview truncated with ellipsis.
- Detail panel shows full fields; association is **read-first from context** on create; changing association after create may use compact pickers (planner discretion).

### Bottom panel — Open Questions view

- Surface type: `WebviewViewProvider` in the **panel** region (same container family as Problems / Output / Terminal), via `package.json` `viewsContainers.panel` contribution.
- **D-02:** Reuse the **same** HTML structure, CSS tokens, and client message protocol as the Planning tab host. No divergent card styles, spacing scale, or list row templates between hosts.
- Use `retainContextWhenHidden: true` on the webview view options so switching tabs does not lose in-progress edits when practical.

### Chapter tree (native)

- **D-03:** `openIssueCount` on chapter rows reflects **open** questions linked to that chapter (file and/or selection within file). Book-wide or entity-only questions do not inflate chapter counts unless explicitly decided otherwise in PLAN.
- Count presentation matches existing chapter row pattern (`description` or equivalent) — no new badge component family.

---

## Status presentation (Phase 14 subset)

Statuses in this phase: **`open`**, **`resolved`**, **`deferred`** only (ISSUE-02 partial). Map labels for display:

| Status | Display label | Icon suggestion (codicon or text) |
| ------ | --------------- | ----------------------------------- |
| open | Open | `circle-outline` or `issue-opened` |
| deferred | Deferred | `clock` |
| resolved | Resolved | `check` or `pass` |

Do not surface dismissed, triage filters, or Phase 8-only states.

---

## Interaction Contract

| Interaction | Contract |
| ----------- | -------- |
| Create from chapter tree | Context menu on chapter row → command opens question UI with **chapter** association pre-filled. |
| Create from editor selection | Command when selection non-empty → association pre-filled with chapter + selection anchor (`chapter_ref` + `span_hint` per schema); author completes title/body/status. |
| Create from entity row | Context menu on character / place / thread planning row → pre-fill entity association. |
| Create book-wide | Command from palette or dedicated entry when no entity context — association = book. |
| Navigate from list | Activating a list row opens target: entity → reveal planning row or markdown file; chapter → open manuscript and set selection when anchor resolvable; on stale/ambiguous anchor → open chapter + show **stale link** state in UI (exact copy: planner discretion). |
| Save | Debounced or explicit save consistent with existing planning webview patterns; errors surfaced inline. |
| Panel vs tab | Both hosts show the same feature; user may keep panel visible while editing manuscript. |

---

## Layout Contract

- List and detail regions use the **same** flex/grid rules in both hosts (no panel-specific compact theme unless viewport-driven responsive rules are shared).
- Master–detail split: default **40% / 60%** list/detail on wide view; stack vertically below ~520px webview width.
- Detail form: single column; 16px padding; 8px vertical gap between fields; primary actions at bottom of form.
- No duplicate toolbars between hosts — each host gets one toolbar strip with **New question** (if applicable) and refresh.

---

## Spacing Scale

Declared values (multiples of 4); must match between Planning tab and panel:

| Token | Value | Usage |
| ----- | ----- | ----- |
| xs | 4px | Inline chips, icon gaps |
| sm | 8px | List row internal padding, field gaps |
| md | 16px | Pane padding, card padding |
| lg | 24px | Section separation in detail |
| xl | 32px | Empty state vertical rhythm |

---

## Typography

| Role | Size | Weight | Line height |
| ---- | ---- | ------ | ----------- |
| Body | `var(--vscode-font-size)` | 400 | 1.5 |
| Label | 12px | 600 | 1.3 |
| List title | 13px | 600 | 1.3 |
| Detail title | 15px | 600 | 1.25 |

Rules: use theme tokens for color; no custom webfonts; truncation with ellipsis on list title and preview.

---

## Color

| Role | Token | Usage |
| ---- | ----- | ----- |
| Surface | `var(--vscode-sideBar-background)` or `var(--vscode-editor-background)` | Webview root (match planning panels) |
| Elevated | `var(--vscode-editorWidget-background)` | Detail card, selected list row background |
| Border | `var(--vscode-widget-border)` | Dividers, list row separators |
| Muted | `var(--vscode-descriptionForeground)` | Preview text, association chips |
| Stale / warning | `var(--vscode-list-warningForeground)` | Stale anchor indicator |
| Error | `var(--vscode-errorForeground)` | Save/load failures |

No hardcoded hex.

---

## Copywriting Contract

| Element | Copy |
| ------- | ---- |
| Tab / view title | Open questions |
| Empty list | No open questions yet |
| Empty list body | Create a question from the chapter tree, a selection in the manuscript, or a character, place, or thread row. |
| Stale anchor | This link may be out of date after edits. Opened the chapter — update the link from the question if needed. |
| Save error | Could not save this question. Check the file is writable and retry. |

Use **sentence case**; say **question** in UI (not “issue”) where it reads clearer for authors; internal types may still follow `author-note` schema.

---

## Empty, Warning, and Error States

| State | Contract |
| ----- | -------- |
| No questions | Show empty list message + hint toward context-first creation. |
| Loading | Skeleton rows or single centered “Loading…” — same in both hosts. |
| Stale manuscript anchor | Navigate to chapter + inline warning in detail (see copy table). |
| Missing target file | Error inline; list row may show warning icon. |

---

## Accessibility and Safety

- List and detail must be operable with keyboard: arrow keys in list, Enter to open, Tab through form fields.
- Status must not rely on color alone (pair with icon/label).
- Webview CSP and script policy: **align with existing Planning workspace webview** (if scripts enabled for message passing, keep CSP strict and no `unsafe-eval`).
- Core actions reachable without hover-only affordances.

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
| -------- | ----------- | ----------- |
| none — VS Code APIs + shared HTML strings | none | No third-party UI registry |

---

## Source Notes

- `14-CONTEXT.md`: D-01–D-05, dual surfaces, context-first authoring, chapter counts.
- `14-RESEARCH.md`: WebviewView in panel, shared protocol with Planning tab, `issue-schema.md` alignment.
- `02-UI-SPEC.md`: spacing/typography/token patterns to stay visually coherent with rest of LeanQuill.

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: pending
- [ ] Dimension 2 Visuals: pending
- [ ] Dimension 3 Color: pending
- [ ] Dimension 4 Typography: pending
- [ ] Dimension 5 Spacing: pending
- [ ] Dimension 6 Registry Safety: pending

**Approval:** pending
