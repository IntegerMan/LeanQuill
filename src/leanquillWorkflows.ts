import * as fs from "node:fs/promises";
import * as path from "node:path";
import { SafeFileSystem } from "./safeFileSystem";
import {
  isLeanquillWorkflowPinned,
  LEANQUILL_WORKFLOW_BUNDLE_VERSION,
  readWorkflowBundleFromContent,
} from "./workflowBundle";

const RESEARCH_WORKFLOW_CONTENT = `---
name: LeanQuill Research Workflow
version: 1
leanquill_workflow_bundle: ${LEANQUILL_WORKFLOW_BUNDLE_VERSION}
---

# LeanQuill Research Workflow

This workflow defines how the LeanQuill research agent investigates topics and produces structured research documents for your book project.

## Process

1. **Read project context** — Load \`.leanquill/project.yaml\`, \`.leanquill/outline-index.json\`, and any relevant manuscript chapters to understand the author's book project.
2. **Understand the query** — Interpret the research question in the context of the author's genre, themes, and current manuscript progress.
3. **Ask clarifying questions** — If the query is ambiguous or could mean different things for this project, ask before proceeding.
4. **Break into sub-topics** — Divide the research into 1–5 core sub-topics that together answer the original question.
5. **Research each sub-topic** — Use web search for each sub-topic. If web search is unavailable, warn the user and proceed with knowledge-based answers, clearly noting the limitation.
6. **Produce one result file** — Write a single structured markdown file with the results.

## Result File Format

Each research result file must include:

**Frontmatter:**
\`\`\`yaml
---
name: <short descriptive title>
query: <the original research question>
created: <ISO 8601 date>
tags: [<comma-separated relevance tags>]
sources: [<list of URLs or references used>]
---
\`\`\`

**Body sections:**
- **Summary** — 2–4 sentence overview of findings
- **Sub-topics** — One section per sub-topic (1–5 total), each with key facts and sources
- **Sources** — Full list of references
- **Open Questions** — What remains uncertain or worth further investigation
- **Project Relevancy** — How this research specifically applies to the author's current manuscript

**Length guidance:** Target 50–150 lines for a typical research result. Prioritize actionable information the author can use while writing. Avoid exhaustive academic-style breakdowns, lengthy comparison matrices, or operational planning details unless the author specifically asks for depth. Use concise prose over tables. If a query is genuinely complex, scale up — but default to concise.

**File naming:** \`{topic-slug}-{YYYY-MM-DD}.md\`

**Save location:** Read \`folders.research\` from \`.leanquill/project.yaml\`. Default: \`research/leanquill/\`

## Harness Setup

This workflow is invoked via harness-specific entry points. Prefer the **leanquill-researcher** entry points for new setups; older \`researcher\` files may still exist from earlier LeanQuill versions and are left untouched.

- **Copilot (legacy):** \`.github/agents/researcher.agent.md\`
- **Cursor (legacy):** \`.cursor/skills/researcher/SKILL.md\`
- **Claude (legacy):** \`.claude/agents/researcher.md\`
- **Copilot (recommended):** \`.github/agents/leanquill-researcher.agent.md\`
- **Cursor (recommended):** \`.cursor/skills/leanquill-researcher/SKILL.md\`
- **Claude (recommended):** \`.claude/agents/leanquill-researcher.md\`

All entry points read this file (\`research.md\`) and execute the process above.
`;

const RESEARCH_IMPORT_WORKFLOW_CONTENT = `---
name: LeanQuill Import External Research Workflow
version: 1
leanquill_workflow_bundle: ${LEANQUILL_WORKFLOW_BUNDLE_VERSION}
---

# LeanQuill Import External Research Workflow

Import external research (another AI session, PDF, document, or pasted notes) and normalize it into LeanQuill's structured research note format.

## Canonical format

1. Read \`.leanquill/workflows/research.md\` for the **Result File Format** — frontmatter keys \`name\`, \`query\`, \`created\`, \`tags\`, \`sources\` and body sections (**Summary**, **Sub-topics**, **Sources**, **Open Questions**, **Project Relevancy**). Your deliverable must follow that shape.

2. Read \`.leanquill/project.yaml\` and resolve \`folders.research\` (relative to the workspace root). That directory is the save location for research \`.md\` files.

## Normalization rules (D-07–D-12)

- **D-07 — Map without dropping content:** Map external material into the Result File Format. Content that does not map cleanly still belongs in the file: park it under **Summary** and/or a \`### Imported content\` subsection so nothing is silently discarded.

- **D-08 — \`created\`:** Use an ISO 8601 timestamp at import time unless the source provides an explicit, reliable date you can trust.

- **D-09 — \`sources\`:** Include URLs or references when obvious; otherwise use an empty YAML list \`[]\`.

- **D-10 — \`query\`:** Prefer the user's stated topic; otherwise infer from headings or opening lines. If still unclear, use a visible placeholder such as \`(import — topic to be confirmed)\`.

- **D-11 — Save location:** Prefer writing the final \`.md\` under \`folders.research\`. If this environment cannot write files, output the complete markdown only and instruct the user to save it under that folder manually.

- **D-12 — Collisions:** Before writing, list existing \`*.md\` files in \`folders.research\`. Name files \`{topic-slug}-{YYYY-MM-DD}.md\`. If that name exists, pick a new distinct slug (e.g. append \`-2\`, \`-alt\`) — **never overwrite** an existing file.

## Binary or unreadable sources

For PDF, DOCX, or other formats you cannot read as text, ask the user to paste excerpts or provide plain text so you can still apply the rules above.

## Output

Produce one markdown research note per import, matching \`research.md\` unless you are only returning text for manual save (D-11).
`;

const STORY_CHAT_WORKFLOW_CONTENT = `---
name: LeanQuill Story Chat Workflow
version: 1
leanquill_workflow_bundle: ${LEANQUILL_WORKFLOW_BUNDLE_VERSION}
---

# LeanQuill Story Chat Workflow (orchestrator)

You are the **orchestrator** for LeanQuill story chat. You do not load and narrate the whole project in one monologue. You **delegate** read-only discovery, receive **compact** scout findings, **synthesize** what matters, then ask the author **one** focused next-step question. Avoid long craft essays in the first reply.

## Context rules

LeanQuill advises but never authors manuscript prose.
Full manuscript context is never automatic.
Read active story memory from .leanquill/memory/ before answering, using only records supplied by the LeanQuill chat context or active memory index.

## Read these workflows first

1. This file (orchestrator rules).
2. \`.leanquill/workflows/story-state-scout.md\` (aggregate scout contract and sub-scout prompts).
3. \`.leanquill/workflows/metadata-actions.md\` only when you must build a machine payload *after* the author agrees (not for day-to-day chat).

## Orchestrator loop

1. **Delegate discovery (read-only).** Use your environment’s subagent or task feature when available. Follow the GSD pattern: a short \`Task\`-style prompt with a clear goal and a pointer to the **sub-scout** blocks in \`story-state-scout.md\` (e.g. conceptually \`Task(subagent_type="generalPurpose", description="LeanQuill: run story state scout", prompt="...")\`). Prefer running the **aggregate** \`leanquill-story-state-scout\` work as one sub-task that internally follows all four sub-scouts in \`story-state-scout.md\`, or run **parallel** sub-tasks (project / entity / theme-thread / memory) if the platform allows. Scouts return **only** compact bullets, not story critique.
2. **If subagents are unavailable (fallback).** Perform the same discovery yourself, in order, as documented under **Local fallback (no subagents)** in \`story-state-scout.md\` — \`read\` + \`list\` + \`grep\` / glob — still read-only; do not open manuscript chapters unless the active chat context explicitly included a scoped path.
3. **Synthesize.** In **1-3 short bullets**, state what LeanQuill already has that matches the author’s prompt (name files or “nothing saved for this yet”). Use author-facing words: *story memory*, *character profile*, *place/setting note*, *thread*, *theme*, *research note*, *open question* — never “memory module,” “MetadataAction,” or \`fieldPath\` unless the user asked.
4. **One focused question.** Ask **exactly one** next-action question. Offer **2-4** concrete options plus **Other**. If the product exposes a structured question tool (for example, AskQuestion), call that tool and **wait for the user response** before continuing. Do not invent or simulate the user's answer. If no question tool exists, use a **numbered** list in chat.
5. **Advertise the right entry point** for the likely choice using the **Capability router** below. When suggesting something the author can type, prefer a slash form (for example: \`/leanquill-story-state-scout\`).

## Capability router (match the author’s need to a LeanQuill path)

- **Missing or thin major person** — character profile creation/updates; then \`/leanquill-story-state-scout\` to re-check.
- **Recurring motif, moral question, or thematic axis** — theme (e.g. \`.leanquill/themes.yaml\` or project “theme” / planning flows).
- **Ongoing causal or plot strand** — thread (notes under configured \`folders.threads\`).
- **Unclear craft or domain facts** — \`/leanquill-researcher\`; for pasted external material use \`/leanquill-import-research\`.
- **Durable takeaway from this chat** — \`/leanquill-story-metadata-commit\` (interview, then pending file + **LeanQuill: Apply Metadata Action**).
- **Ambiguous concern to revisit** — open question / issue under \`.leanquill/issues/\` when the project uses that.

## Helpful skills (advertise, don’t hide)

- \`/leanquill-story-state-scout\` — read-only; runs the sub-scout contract in \`story-state-scout.md\`.
- \`/leanquill-story-metadata-commit\` — save story memory or metadata through plain-language choices.
- \`/leanquill-researcher\` / \`/leanquill-import-research\` — research notes.

## Conversation rules

Do not write to manuscript chapter files.
Keep the first answer short: brief synthesis + **one** question, not a lecture.

## Active story memory

Use memory summaries to stay consistent with prior LeanQuill story chat sessions.

## Memory output

Do not append a "Save Story Chat Summary" block to normal author replies. Keep chat output conversational and focused. If a summary or durable memory should be persisted, route through \`/leanquill-story-metadata-commit\` and let LeanQuill store it as metadata.

## Metadata action proposals

AI proposes metadata actions; LeanQuill extension code validates and applies accepted actions.
Use **LeanQuill: Apply Metadata Action** only after the author has confirmed what to save.

**Author experience (required):** Do **not** use raw \`MetadataAction\` JSON in chat as the main way to ask for approval — authors should not have to read schema fields. Follow the **\`leanquill-story-metadata-commit\`** interview (plain-language choices, including **Other**), then write the final JSON to \`.leanquill/pending-metadata-action.json\` when you have file access and ask the author to run **LeanQuill: Apply Metadata Action** with nothing selected, or use selection/paste as a fallback. See the harness skill files for that flow and read \`.leanquill/workflows/metadata-actions.md\` only to build a valid payload.

## Safety

Low-risk automatic memory/chat-log writes are limited to .leanquill/memory/ and .leanquill/chats/. Entity, theme, and research metadata actions require authorApproval.
`;

const STORY_STATE_SCOUT_WORKFLOW_CONTENT = `---
name: LeanQuill Story State Scout Workflow
version: 1
leanquill_workflow_bundle: ${LEANQUILL_WORKFLOW_BUNDLE_VERSION}
---

# LeanQuill Story State Scout Workflow (aggregate read-only scout)

**Audience:** The story chat **orchestrator** and the \`leanquill-story-state-scout\` entry point. Everything here is **read-only**; do not write manuscript or other blocked paths. Return **compact** findings the orchestrator can fold into 1-3 bullets.

This is the **single aggregate** scout contract: it contains **four** focused sub-scout prompts. Run them as separate sub-tasks when the host supports \`Task\` / subagents, or run them **sequentially yourself** in one session when it does not.

## Output to hand back to the orchestrator (always this shape)

1. **Sub-scout results** — for each of A-D below, 0-2 bullets (file paths or “none found”); no prose storytelling.
2. **Optional: search hits** — if you used \`Grep\` / search, the **shortest** matching filenames only.
3. **No** raw JSON, no internal schema field names, no approval prompts — the orchestrator handles the next question to the author.

---

## A. Project state scout (folders + project identity)

**Goal:** Know where notes live and the book’s high-level config.

**Subagent / task prompt (copy, adapt, attach author prompt keywords):**
\`\`\`
You are a LeanQuill project state scout (project slice only, read-only).
Read \`.leanquill/project.yaml\`. List configured \`folders.*\` relevant to story state (manuscript, characters, threads, settings, research, tool_state, etc.).
If \`.leanquill/outline-index.json\` exists, note whether the outline is non-trivial (count or “empty”).
Return 2-4 short bullets, no story advice.
\`\`\`

**Local fallback (no subagents):** \`read\` \`.leanquill/project.yaml\`. Optionally \`read\` \`.leanquill/outline-index.json\` if present (first lines / length only).

---

## B. Entity scout (names and topics from the author prompt)

**Goal:** See if people, places, or named threads already exist in metadata notes.

**Subagent / task prompt:**
\`\`\`
You are a LeanQuill entity scout (read-only). The author’s prompt (keywords, names) is: <PASTE HERE>.
From \`.leanquill/project.yaml\` resolve \`folders.characters\`, \`folders.settings\`, \`folders.threads\`.
List directories; use \`Grep\` or filename search for the keywords against \`*.md\` in those folders (and in \`.leanquill/issues/\` if present).
Return bullets: "found: <path>" or "not found" per keyword cluster. No manuscript reads unless the chat context explicitly included a chapter path.
\`\`\`

**Local fallback:** \`list\` the character, settings, and threads directories; \`Grep\` / \`ripgrep\` for the prompt’s proper nouns and key topic words. Cap at the most relevant ~10 file hits.

---

## C. Theme & thread scout (thematic and arc structure)

**Goal:** Thematic and ongoing-arc state.

**Subagent / task prompt:**
\`\`\`
You are a LeanQuill theme/thread scout (read-only).
Read \`.leanquill/themes.yaml\` if it exists; summarize theme titles/slugs that plausibly relate to: <PASTE KEYWORDS FROM PROMPT>.
List \`folders.threads\` (from project.yaml) for files whose names or first lines connect to the prompt.
Return 2-3 bullets, or "no themes/threads on disk yet."
\`\`\`

**Local fallback:** \`read\` themes file; \`list\` + skim thread file names; optional \`Grep\` in threads for 1-2 topic words.

---

## D. Memory, chats, and research scout (prior LeanQuill context)

**Goal:** Story memory, prior chat logs, research, open questions.

**Subagent / task prompt:**
\`\`\`
You are a LeanQuill memory-and-context scout (read-only).
Scan \`.leanquill/memory/*.md\` (or list if many — prioritize filenames matching the prompt’s keywords). Skim \`.leanquill/chats/\` for recent session filenames only unless a path is obviously relevant. Check \`folders.research\` for 1-3 \`.md\` files whose titles or openings match the prompt. Check \`.leanquill/issues/\` for open items matching the topic.
Return 2-4 bullets: what prior LeanQuill artifacts exist for this book that relate to the prompt, or "none found."
\`\`\`

**Local fallback:** \`list\` / \`glob\` \`.leanquill/memory\`, \`.leanquill/chats\`, research folder, issues; \`Grep\` prompt keywords with a tight scope.

---

## Stale or missing data

If a folder from \`project.yaml\` is missing, say so in one bullet; do not invent content.

## Standalone \`leanquill-story-state-scout\` skill

When invoked alone (not only as a subagent), still follow A-D, then add **one** focused question (2-4 options + **Other**) and the **one** best matching capability from the capability map the orchestrator uses (character / theme / thread / research / metadata-commit / open question). If AskQuestion (or equivalent) is available, use it and wait for the user response; never answer on the user's behalf.
`;

const METADATA_ACTION_WORKFLOW_CONTENT = `---
name: LeanQuill Metadata Action Contract
version: 1
leanquill_workflow_bundle: ${LEANQUILL_WORKFLOW_BUNDLE_VERSION}
---

# LeanQuill Metadata Action Contract

**Audience:** This document is a **machine contract** for the extension and for agents when constructing payloads. In story chat, the author is guided with questions and options via **\`leanquill-story-metadata-commit\`**; the JSON form below is not something authors should be asked to judge in the chat. Apply via **LeanQuill: Apply Metadata Action** (reads \`.leanquill/pending-metadata-action.json\` when no text is selected, then clears it on success), selection, or paste.

Allowed operations: \`set\`, \`append\`, \`removeFromList\`, \`createMemory\`, \`supersedeMemory\`, \`createIssue\`, \`updateIssueStatus\`, \`updateThemeMetadata\`, \`updateResearchAssociation\`, \`updateChatLogProvenance\`.

Blocked categories: manuscript prose writes, path traversal, unconfigured path roots, unknown operations, schema-invalid payloads, approval bypass, destructive deletes.

## Example MetadataAction JSON

\`\`\`json
{
  "schemaVersion": "1",
  "actionId": "example-action",
  "sourceChatId": "example-session",
  "operation": "createMemory",
  "targetPath": ".leanquill/memory/example.md",
  "fieldPath": [],
  "oldValue": null,
  "newValue": { "topic": "Example", "body": "Body" },
  "rationale": "Example rationale",
  "risk": "low",
  "authorApproval": { "approvedAt": "2026-01-01T00:00:00.000Z", "method": "extension-command" }
}
\`\`\`
`;

/**
 * Canonical `.leanquill/workflows/*.md` files shipped with the extension.
 * Add entries here when introducing new harness-backed workflows so activation backfill and fresh init stay in sync.
 */
export const LEANQUILL_WORKFLOW_SPECS: ReadonlyArray<{ fileName: string; content: string }> = [
  { fileName: "research.md", content: RESEARCH_WORKFLOW_CONTENT },
  { fileName: "import-external-research.md", content: RESEARCH_IMPORT_WORKFLOW_CONTENT },
  { fileName: "story-chat.md", content: STORY_CHAT_WORKFLOW_CONTENT },
  { fileName: "story-state-scout.md", content: STORY_STATE_SCOUT_WORKFLOW_CONTENT },
  { fileName: "metadata-actions.md", content: METADATA_ACTION_WORKFLOW_CONTENT },
];

/**
 * Creates or refreshes bundled workflow files under `.leanquill/workflows/`.
 * Missing files are created. Existing files are **replaced** when their
 * `leanquill_workflow_bundle` front matter is **older** than
 * `LEANQUILL_WORKFLOW_BUNDLE_VERSION` in this extension. Files with
 * `leanquill_workflow_pinned: true` in front matter are left unchanged. Authors can
 * set `leanquill_workflow_bundle` higher than the extension value to keep a custom file
 * if the extension’s bundle id would otherwise decrease (downgrade guard).
 */
export async function ensureLeanquillWorkflows(
  rootPath: string,
  safeFs: SafeFileSystem = new SafeFileSystem(rootPath),
): Promise<void> {
  const workflowsDir = path.join(rootPath, ".leanquill", "workflows");
  let ensuredDir = false;
  for (const { fileName, content } of LEANQUILL_WORKFLOW_SPECS) {
    const target = path.join(workflowsDir, fileName);
    if (!ensuredDir) {
      await safeFs.mkdir(workflowsDir);
      ensuredDir = true;
    }
    let onDisk: string;
    try {
      onDisk = await fs.readFile(target, "utf8");
    } catch {
      onDisk = "";
    }
    if (onDisk.length === 0) {
      await safeFs.writeFile(target, content);
      continue;
    }
    if (isLeanquillWorkflowPinned(onDisk)) {
      continue;
    }
    const diskBundle = readWorkflowBundleFromContent(onDisk);
    const shippedBundle = readWorkflowBundleFromContent(content);
    if (diskBundle < shippedBundle) {
      await safeFs.writeFile(target, content);
    }
  }
}

