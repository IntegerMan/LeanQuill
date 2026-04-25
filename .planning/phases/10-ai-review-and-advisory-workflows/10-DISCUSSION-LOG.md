# Phase 10: AI Review and Advisory Workflows - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `10-CONTEXT.md` — this log preserves the alternatives considered.

**Date:** 2026-04-25
**Phase:** 10-AI Review and Advisory Workflows
**Areas discussed:** Chapter review workflow, Issue chat contract, Post-write story intelligence, Auditability

---

## Chapter review workflow

| Option | Description | Selected |
|--------|-------------|----------|
| Tree-first + chat parity | Tree is primary UX; chat/command runs the same workflow | ✓ |
| Chat-first | Chat canonical; tree is secondary |  |
| Tree-only | Defer chat command parity |  |

**User's choice:** Tree-first + chat parity

| Option | Description | Selected |
|--------|-------------|----------|
| Single session file | One aggregate session artifact |  |
| One issue per finding | Immediate fan-out into many issue files |  |
| Hybrid | Session artifact first; promote selected findings to individual issues | ✓ |

**User's choice:** Hybrid

| Option | Description | Selected |
|--------|-------------|----------|
| Sequential personas | Ordered passes; grouped output |  |
| Combined single pass | One prompt simulating all personas |  |
| Author picks each run | QuickPick one vs all enabled | ✓ |

**User's choice:** Author picks per run (QuickPick: one enabled persona vs all enabled)

| Option | Description | Selected |
|--------|-------------|----------|
| Session stub only | Persist session artifact first |  |
| Chat log first | Persist chat log first |  |
| Both stub + chat log | Persist both immediately with shared session id | ✓ |

**User's choice:** Both session stub (`.leanquill/issues/sessions/`) and chat stub (`.leanquill/chats/`) immediately

---

## Issue chat contract

| Option | Description | Selected |
|--------|-------------|----------|
| Full chapter | Include full `chapterRef` manuscript for chapter-attached issues | ✓ |
| Partial chapter | Include excerpt only |  |
| Issue only | No manuscript unless opted in |  |

**User's choice:** Full chapter for `chapter` associations

| Option | Description | Selected |
|--------|-------------|----------|
| Full chapter + span anchor | Full chapter + treat `spanHint` as locate/highlight anchor | ✓ |
| Windowed excerpt | Bounded excerpt around match |  |
| Excerpt-only | `spanHint` only |  |

**User's choice:** Full chapter + span anchoring for `selection` associations

| Option | Description | Selected |
|--------|-------------|----------|
| Issue + linked association file | Include association targets; book uses base bundle only | ✓ |
| Issue only | Never auto-attach association targets |  |
| Issue + heuristic bundle | Pull extra related files heuristically |  |

**User's choice:** Issue + linked association file (book uses standard base bundle, not heuristic extra notes)

| Option | Description | Selected |
|--------|-------------|----------|
| Always include active memory | Keep continuity across sessions | ✓ |
| Default off | Reduce bias/noise |  |
| Conditional memory | e.g., book-only |  |

**User's choice:** Always include active story memory in issue chat bundles

---

## Post-write story intelligence (AIR-02)

| Option | Description | Selected |
|--------|-------------|----------|
| Explicit command only | Manual only |  |
| Save debounced | Auto behavior on save | ✓ (combined) |
| Session end hook | Out of scope / later |  |

**User's choice:** **Save debounced trigger + explicit command** (same underlying workflow)

| Option | Description | Selected |
|--------|-------------|----------|
| Notify + Run/Dismiss | Non-blocking prompt | ✓ |
| Auto-open chat | Immediate chat open |  |
| Silent queue marker | Marker file + passive surfacing |  |

**User's choice:** Notify + Run/Dismiss for debounced save path

| Option | Description | Selected |
|--------|-------------|----------|
| Whole chapter file | Analyze entire chapter markdown | ✓ |
| Git-diff scoped | Only changed hunks |  |
| Tail heuristic | Last N lines/words |  |

**User's choice:** Whole chapter file as analysis input

| Option | Description | Selected |
|--------|-------------|----------|
| MetadataActions + approval | Contracted writes with explicit approval | ✓ |
| Patch-only human apply | Chat output only |  |
| Auto safe fields | Auto-append limited fields |  |

**User's choice:** MetadataActions + approval for story-note writes

| Option | Description | Selected |
|--------|-------------|----------|
| Same persona picker as chapter review | QuickPick one vs all enabled | ✓ |
| Fixed extractor personas | Ignore persona library selection |  |
| Silent all-enabled | No prompts |  |

**User's choice:** Same persona picker as chapter review

---

## Auditability

| Option | Description | Selected |
|--------|-------------|----------|
| Align to imported chat-log schema | Extend current `.leanquill/chats` logs toward `chat-log-schema.md` (backward compatible) | ✓ |
| Keep minimal internal format | Imported schema is reference-only |  |
| New sessions only | Split formats by age |  |

**User's choice:** Align chat logs to imported `chat-log-schema.md` over time (extend + backward compatible)

| Option | Description | Selected |
|--------|-------------|----------|
| Log proposed actions | JSONL includes proposed + outcomes |  |
| Outcomes only | JSONL logs applied/rejected/blocked | ✓ |
| Dual-channel | Proposed only in transcript |  |

**User's choice:** JSONL logs outcomes only (no `proposed` stream)

| Option | Description | Selected |
|--------|-------------|----------|
| Summary-first, transcript optional | Canonical audit is frontmatter summary; transcript best-effort | ✓ |
| Transcript-required | Hard gate |  |
| Transcript-only | No summaries |  |

**User's choice:** Summary-first; transcripts optional/best-effort

| Option | Description | Selected |
|--------|-------------|----------|
| Defer master rollup | No `master-issues.md` automation in Phase 10 | ✓ |
| Manual rollup command | Author-triggered refresh |  |
| Automatic rollup | Always merge to master |  |

**User's choice:** Defer `master-issues.md` rollup/automation (explicitly out of scope for Phase 10)

---

## Claude's Discretion

- UI microcopy and placement for save-triggered prompts (within non-blocking Run/Dismiss requirement).

## Deferred Ideas

- Automated `master-issues.md` consolidation/rollup (deferred beyond Phase 10).
