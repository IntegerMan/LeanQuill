# Chat Log Schema

Stored at: `{book-repo}/.leanquill/chats/{timestamp}-{session-type}.md`

One file per AI session. Provides a full audit trail of AI interactions.
The tool auto-saves a session log on close. The author may also trigger
explicit save at any point during a session.

---

## Schema Definition (YAML frontmatter)

```yaml
# chat-log-schema v1
session_id: string          # matches filename stem, e.g. "2026-03-29-1430-chapter-review"
session_type: string        # see Session Types below
started_at: string          # ISO 8601
ended_at: string
chapter_ref: string         # primary chapter context, or "project-wide"
chapters_in_context: string[]  # all chapter files included in this session's context
persona_ids: string[]       # active persona profiles used in this session
agent_mode: string          # ask | plan | review | update | consolidate

# ── Outcome Summary ───────────────────────────────────
summary: string             # 2–5 sentence plain language summary of what was done
issues_generated: integer   # how many new issues this session produced
issues_resolved: integer    # how many issues were marked resolved during session
session_issue_file: string  # path to the session issues output file (if any)

# ── Story Intelligence Updates ────────────────────────
story_updates_made: boolean
story_update_notes: string  # brief description of documentation updated
```

## Session Types

| Type | Description |
|------|-------------|
| `chapter-review` | Full chapter analysis: copy, quality, continuity |
| `beta-read` | Reader persona sequential feedback run |
| `expert-review` | Domain expert realism check |
| `story-intelligence-update` | Post-write extraction of events/entities into notes |
| `continuity-check` | Cross-chapter contradiction and timeline check |
| `issue-planning` | Author + AI conversation about resolving a specific issue |
| `pre-write-plan-review` | Expert review of outline/planning notes before drafting |
| `issue-consolidation` | Deferred consolidation agent rolling up open items |
| `planning` | Full-project planning / research conversation |

---

## Sample Instance A — Chapter Review Session

File: `.author-tool/chats/2026-03-29-1430-chapter-review.md`

```yaml
---
session_id: 2026-03-29-1430-chapter-review
session_type: chapter-review
started_at: 2026-03-29T14:30:00
ended_at: 2026-03-29T14:58:00
chapter_ref: manuscript/ch03-dead-reckoning.md
chapters_in_context:
  - manuscript/ch03-dead-reckoning.md
persona_ids:
  - maritime-expert
  - casual-thriller-fan
agent_mode: review

summary: >
  Reviewed Chapter 3 (Dead Reckoning) using maritime-expert and casual-thriller-fan
  personas. Found one timeline continuity conflict with Chapter 1, one significant
  factual plausibility issue around vessel steering redundancy, one pacing drag
  section in the cargo hold sequence, and one missing expected fact about ISA
  zone-entry permissions. The blood-discovery set piece was flagged positively
  as a high-engagement moment by the reader persona.

issues_generated: 4
issues_resolved: 0
session_issue_file: .leanquill/issues/sessions/2026-03-29-1430-chapter-review.md

story_updates_made: false
story_update_notes: ""
---
```

## Full Session Transcript

> The raw or edited conversation transcript is recorded below this frontmatter.
> This section may be truncated by the author; the summary above is the canonical
> reference. Transcripts are git-tracked and may be used as context in future sessions.

---

**[14:30]** *(session started — chapter-review mode)*

**Author:** Run a chapter review on ch03. Use the maritime expert and casual thriller fan personas.

**Agent:** Beginning chapter review of *Dead Reckoning* (ch03) with two active personas.

Loading chapter context... done.
Loading persona profiles (maritime-expert, casual-thriller-fan)... done.
Excluding future chapters from context... done.

Running maritime-expert pass...

---

**Agent [maritime-expert]:** I've completed the technical review pass. Before I detail findings, I want to highlight that overall the chapter handles the research vessel atmosphere well — the procedural detail in the ROV bay sequence reads as earned and confident. Findings:

**Finding 1 — Timeline conflict with Chapter 1 (High confidence)**
The chapter-3 timestamp of 0340 is approximately 80 minutes earlier than it should be given the Chapter 1 departure time and the described six-hour transit. This will feel wrong to a reader who double-checks. I'd suggest adjusting either the Chapter 1 departure time to approximately 9:30 PM, or the Chapter 3 timestamp to approximately 0500.

**Finding 2 — Steering redundancy (High confidence, source required)**
Modern research vessels — especially those operating in international zone areas — carry redundant steering systems by regulatory requirement. I'll attach source links in the issue record. The current sabotage framing needs either a more sophisticated attack that accounts for backups, or an explicit explanation of why backups weren't available.

*(findings 3–4 omitted from sample for brevity — see issue file for full records)*

---

**Agent [casual-thriller-fan]:** Switching to reader persona pass...

**Alex says:** Okay so I was really into this chapter mostly! The moment when Yates finds the card in the ROV log? Chills. That worked beautifully. I had goosebumps.

BUT — that cargo hold section in the middle? I kind of... stopped caring? It was just container after container and I knew nothing bad was going to happen until he reached the end and I was just waiting for it. Trim that down by at least half and we're good.

**Interest heatmap notes:**
- Paragraphs 1–3 (opening watch rotation): 6/10 — solid but slow
- Paragraphs 4–8 (first cargo hold entry): 7/10 — hook is working
- Paragraphs 9–22 (container checks): 4/10 — drag zone
- Paragraphs 23–27 (blood trace discovery): 9/10 — excellent
- Paragraph 28 (ROV bay card): 10/10 — chapter peak

**Reader questions after chapter 3:**
- Is Dr. Osei alive? Where is she?
- Who planted the card? Was it planted or did she leave it?
- Does Yates suspect anyone specific yet?
- Will the captain believe him?

---

**[14:58]** *(session closed — 4 issues generated, saved to issue file)*

---

## Sample Instance B — Issue Planning Conversation

File: `.author-tool/chats/2026-03-30-0915-issue-planning-fr001.md`

```yaml
---
session_id: 2026-03-30-0915-issue-planning-fr001
session_type: issue-planning
started_at: 2026-03-30T09:15:00
ended_at: 2026-03-30T09:34:00
chapter_ref: manuscript/ch03-dead-reckoning.md
chapters_in_context:
  - manuscript/ch03-dead-reckoning.md
persona_ids: []
agent_mode: plan

summary: >
  Planning session to explore resolution options for fr-001 (vessel steering
  redundancy implausibility). Three alternative sabotage scenarios were explored.
  Author selected option 2 (dual-system hydraulic cascade failure via coolant
  contamination) as the approach to implement. No manuscript edits were made;
  author will rewrite the relevant passage independently.

issues_generated: 0
issues_resolved: 0
session_issue_file: ""

story_updates_made: false
story_update_notes: ""
---
```

**[09:15]** *(session started — issue-planning mode for fr-001)*

**Author:** I want to think through how to fix the steering redundancy issue. What are my options?

**Agent:** Happy to help you think this through without touching the manuscript. Here are three directions that could preserve the dramatic outcome while fixing the plausibility gap...
