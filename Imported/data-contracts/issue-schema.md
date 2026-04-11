# Issue Schema

Stored at: `{book-repo}/.leanquill/issues/sessions/{timestamp}-{type}.md`
and rolled up into: `.leanquill/issues/master-issues.md`

Each AI session produces one session file with its own priority-ordered findings.
A consolidation step merges open/deferred items into the master list.

---

## Schema Definition — Individual Issue Entry (YAML frontmatter)

```yaml
# issue-schema v1
id: string                    # unique kebab-case id e.g. "cont-003"
type: string                  # see Types below
status: string                # open | dismissed | deferred | resolved
priority: integer             # 1 (critical) – 5 (low)
title: string                 # short human label
created_at: string            # ISO 8601
source: string                # session-file path that generated this, or "author"
chapter_ref: string           # relative path to chapter file, or "project-wide"
span_hint: string             # optional — quoted text fragment near the issue
agent_profile: string         # persona/agent id that raised this, or "author"
evidence_links: string[]      # URLs supporting factual claims (required for factual-risk type)
confidence: string            # high | medium | low | unrated (for AI-generated issues)
verify_manually: boolean      # true for factual-risk issues referencing external facts
intentional: boolean          # true if author annotates as deliberate narrative choice
intentional_note: string      # explanation if intentional is true
dismissed_reason: string      # why author dismissed (optional)
body: string                  # markdown description — the actionable feedback
```

## Issue Types

| Type | Description | Evidence Required |
|------|------------|---------------------|
| `question` | Author-captured question or self-identified weakness (unified type for migrated Phase 14 open questions; replaces long-term `author-note` for new files) | No |
| `continuity` | Internal story contradiction or timeline conflict | No |
| `copy-edit` | Grammar, spelling, punctuation, or sentence-level clarity | No |
| `voice` | Phrasing that drifts from author's established style | No |
| `narrative-quality` | Pacing, tension, engagement, or structure concern | No |
| `beta-reader` | Engagement/confusion/curiosity signals from reader persona | No |
| `factual-risk` | Factual claim that may be incorrect or misleading | Yes — required |
| `missing-expected-fact` | Knowledge/detail an informed reader would expect to see | Yes — recommended |
| `expert-realism` | Credibility break detectable by domain expert reader | Yes — recommended |
| `author-note` | **Legacy alias** for author open questions (Phase 14). On v3 layout migration, files are rewritten to `type: question` and stored under `.leanquill/issues/question/`. New author issues should use `question`. | No |

---

## Sample Session File — Chapter 3 Review

File: `.leanquill/issues/sessions/2026-03-29-1430-chapter-review.md`

```yaml
---
session_id: 2026-03-29-1430-chapter-review
chapter_ref: manuscript/ch03-dead-reckoning.md
agent_profile: maritime-expert
generated_at: 2026-03-29T14:30:00
issue_count: 4
---
```

### Issue cont-001

```yaml
---
id: cont-001
type: continuity
status: open
priority: 2
title: "Navigator's watch contradicts chapter 1 timeline"
created_at: 2026-03-29T14:31:22
source: .author-tool/issues/sessions/2026-03-29-1430-chapter-review.md
chapter_ref: manuscript/ch03-dead-reckoning.md
span_hint: "...Yates checked his watch. 0340."
agent_profile: maritime-expert
evidence_links: []
confidence: high
verify_manually: false
intentional: false
intentional_note: ""
dismissed_reason: ""
---
```

In Chapter 1, the yacht departs at 11:00 PM and the crossing to the research zone is described as approximately six hours. Chapter 3 opens with Yates checking his watch at 0340 — only 4 hours 40 minutes later — but the vessel is already described as being on-station. Either the departure time, the transit duration, or the chapter-3 timestamp needs to be reconciled.

---

### Issue fr-001

```yaml
---
id: fr-001
type: factual-risk
status: open
priority: 2
title: "Research yacht described as lacking backup steering — implausible for ISA-certified vessels"
created_at: 2026-03-29T14:31:45
source: .author-tool/issues/sessions/2026-03-29-1430-chapter-review.md
chapter_ref: manuscript/ch03-dead-reckoning.md
span_hint: "...disabled the steering entirely, leaving them with no way to maneuver."
agent_profile: maritime-expert
evidence_links:
  - "https://www.imo.org/en/OurWork/Safety/Pages/SafetyTopics.aspx"
  - "https://www.oceanexplorer.noaa.gov/vessels/"
confidence: high
verify_manually: true
intentional: false
intentional_note: ""
dismissed_reason: ""
---
```

Modern research vessels — particularly those conducting ROV operations in international treaty zones — are typically required to have redundant steering systems including emergency backup hydraulic steering and sometimes azimuth thrusters. Completely disabling all steering in a single sabotage action is implausible unless the saboteur has sophisticated access to redundant systems. Consider having the sabotage disable propulsion control instead, or explicitly name which backup system was also targeted and how that was possible.

---

### Issue nr-001

```yaml
---
id: nr-001
type: narrative-quality
status: open
priority: 3
title: "Cargo hold scene runs long — pacing drag detected"
created_at: 2026-03-29T14:32:10
source: .author-tool/issues/sessions/2026-03-29-1430-chapter-review.md
chapter_ref: manuscript/ch03-dead-reckoning.md
span_hint: "...Yates moved through the hold methodically, checking each container in turn..."
agent_profile: casual-thriller-fan
evidence_links: []
confidence: medium
verify_manually: false
intentional: false
intentional_note: ""
dismissed_reason: ""
---
```

The cargo hold inspection sequence runs approximately 600 words with no new information revealed after the first 200. The reader's curiosity about what happened to Dr. Osei temporarily drops here before recovering when the blood sample is found. Consider trimming the intermediate container checks to three beats maximum, or planting a false-lead detail earlier in the sequence to sustain tension throughout.

---

### Issue mef-001

```yaml
---
id: mef-001
type: missing-expected-fact
status: open
priority: 3
title: "ISA exploration contract not mentioned during zone entry scene"
created_at: 2026-03-29T14:32:55
source: .author-tool/issues/sessions/2026-03-29-1430-chapter-review.md
chapter_ref: manuscript/ch03-dead-reckoning.md
span_hint: "...they crossed into the Clarion-Clipperton Zone..."
agent_profile: geopolitics-analyst
evidence_links:
  - "https://www.isa.org.jm/exploration-contracts"
  - "https://www.isa.org.jm/deep-seabed-mining-regulations"
confidence: medium
verify_manually: true
intentional: false
intentional_note: ""
dismissed_reason: ""
---
```

An expert reader familiar with deep-sea resource governance would expect acknowledgment that operating in the Clarion-Clipperton Zone requires an ISA-sponsored exploration contract, and that the sponsoring state carries treaty obligations. The research vessel's presence without at least a passing reference to this legal framework may feel like an oversight to informed readers. Even a single line of character dialogue noting the contract or its unusual terms could add realism and could also serve as a plot pressure point.
