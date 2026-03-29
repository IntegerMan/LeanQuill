# Chapter Status Schema

Stored at: `{book-repo}/.leanquill/chapters/{chapter-id}-status.md`

One file per chapter. Tracks draft progress, open issue counts, and session handoff notes.
Renders as the master chapter status board in the tool UI.

---

## Schema Definition (YAML frontmatter)

```yaml
# chapter-status-schema v1
id: string                  # matches chapter filename stem, e.g. "ch03-dead-reckoning"
title: string               # chapter display title
source_file: string         # relative path to manuscript file
order: integer              # 1-based sequence for display and sequential-read logic

status: string              # see Status enum below
word_count: integer         # last known word count (updated on session close)
target_word_count: integer  # optional author-set goal

open_issues: integer        # count of open issues across all types
deferred_issues: integer
resolved_issues: integer

last_session_at: string     # ISO 8601
last_session_type: string   # drafting | editing | review | planning

next_action: string         # author's note on what to do next session
session_notes: string       # freeform notes added at session close

# ── Lifecycle Timestamps ─────────────────────────────
first_draft_started_at: string
first_draft_complete_at: string
editing_started_at: string
review_complete_at: string
```

## Status Enum

| Status | Meaning |
|--------|---------|
| `not-started` | Chapter planned but no prose written |
| `drafting` | Active first-draft work in progress |
| `draft-complete` | First draft done, ready for editing passes |
| `editing` | Active revision and issue resolution work |
| `review-pending` | Full AI/beta/expert review queued or in progress |
| `review-complete` | All review passes done, issues triaged |
| `final` | Author has marked chapter done for this release |

---

## Sample Instance — Chapter 3

File: `.leanquill/chapters/ch03-dead-reckoning-status.md`

```yaml
---
id: ch03-dead-reckoning
title: "Dead Reckoning"
source_file: manuscript/ch03-dead-reckoning.md
order: 3

status: editing
word_count: 4210
target_word_count: 4500

open_issues: 4
deferred_issues: 1
resolved_issues: 2

last_session_at: 2026-03-29T14:45:00
last_session_type: review

next_action: >
  Resolve cont-001 (watch timeline) and trim cargo hold scene per nr-001.
  Check maritime expert fr-001 against actual ISA vessel certification docs
  before deciding whether to restructure the sabotage method.

session_notes: >
  Good session. The blood discovery beats well — don't touch that sequence.
  The opening three paragraphs still feel slow; consider starting on the
  sound of the hull rather than the darkness description.

first_draft_started_at: 2026-03-10T09:00:00
first_draft_complete_at: 2026-03-18T17:30:00
editing_started_at: 2026-03-25T10:00:00
review_complete_at: ""
---
```

## Chapter 3 — Dead Reckoning

> Narrative summary and planning notes for this chapter.
> This optional freeform section is author-maintained and not tool-generated.

Yates discovers evidence of foul play during a routine pre-dawn systems check.
The chapter ends with the discovery of Dr. Osei's biometric card in a location
she had no legitimate reason to access.

**Key story events in this chapter:**
- Yates's 0340 watch rotation begins
- Cargo hold anomaly detection
- Blood trace discovery
- Card found in ROV bay access log

**Open questions:**
- Should Yates wake the captain here or wait until ch04?
- Is the ISA contract reference better handled in ch02 or here?
