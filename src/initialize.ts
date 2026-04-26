import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as vscode from "vscode";
import { resolveChapterOrder } from "./chapterOrder";
import { applyLeanpubManuscriptScaffold } from "./leanpubScaffold";
import type { PlanningPanelProvider } from "./planningPanel";
import { validateProjectYamlForSetup } from "./projectConfig";
import { PACKAGED_PERSONA_IDS, packagedPersonaMarkdown } from "./personaDefaults";

export { ensureLeanquillDefaultPersonas } from "./personaDefaults";
import { SafeFileSystem } from "./safeFileSystem";
import { LEANQUILL_WORKFLOW_SPECS } from "./leanquillWorkflows";

export { ensureLeanquillWorkflows } from "./leanquillWorkflows";
import { bootstrapOutline, readOutlineIndex, writeOutlineIndex } from "./outlineStore";
import { InitInput, ChapterOrderResult } from "./types";

function toKebabCase(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-+|-+$/g, "");
}

function quote(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

/** Default `active_personas` block for `project.yaml` (shared with activation backfill, 09-04). */
export const DEFAULT_ACTIVE_PERSONAS_YAML_LINES = [
  "active_personas:",
  "  - id: casual-reader",
  "    enabled: true",
  "  - id: avid-genre-fan",
  "    enabled: true",
  "  - id: copy-editor",
  "    enabled: true",
] as const;

export const DEFAULT_ACTIVE_PERSONAS_YAML_BLOCK = [...DEFAULT_ACTIVE_PERSONAS_YAML_LINES].join("\n");

function renderProjectYaml(input: InitInput): string {
  const genres = input.genre.map((item) => `  - ${quote(item)}`).join("\n");

  return [
    'schema_version: "2"',
    `project_id: ${quote(input.projectId)}`,
    `working_title: ${quote(input.workingTitle)}`,
    "genre:",
    genres || "  - \"fiction\"",
    "folders:",
    "  manuscript: manuscript/",
    "  characters: notes/characters/",
    "  threads: notes/threads/",
    "  settings: notes/settings/",
    "  timeline: notes/timeline/",
    "  research: research/leanquill/",
    "  tool_state: .leanquill/",
    "manuscript:",
    "  file_pattern: ch*.md",
    "  chapter_order_source: Book.txt",
    "  front_matter_field_for_title: title",
    ...DEFAULT_ACTIVE_PERSONAS_YAML_LINES,
    "ai_policy:",
    "  manuscript_write_blocked: true",
    "  git_operations_blocked: true",
    "  default_context_scope: chapter",
    "  sequential_reader_boundary: strict",
    "issue_tracking:",
    "  consolidation_auto: false",
    "  default_view_filter: open",
    "",
  ].join("\n");
}

async function gatherInitInput(log: vscode.LogOutputChannel): Promise<InitInput | undefined> {
  log.info("Showing working title input box...");
  const workingTitle = await vscode.window.showInputBox({
    title: "LeanQuill Initialize",
    prompt: "Working title",
    ignoreFocusOut: true,
    validateInput: (value) => (value.trim() ? null : "Working title is required."),
  });
  if (!workingTitle) {
    return undefined;
  }

  const genreInput = await vscode.window.showInputBox({
    title: "LeanQuill Initialize",
    prompt: "Genres (comma separated, optional — set anytime in Planning → Themes)",
    placeHolder: "e.g. mystery, thriller (leave empty for fiction)",
    ignoreFocusOut: true,
  });
  // Esc cancels this step only — default genre; full init cancel is working-title cancel above
  const genreParts =
    genreInput === undefined || genreInput.trim() === ""
      ? ["fiction"]
      : genreInput.split(",").map((value) => value.trim()).filter(Boolean);
  const genre = genreParts.length > 0 ? genreParts : ["fiction"];

  return {
    projectId: toKebabCase(workingTitle),
    workingTitle: workingTitle.trim(),
    genre,
  };
}

async function ensureOverwriteIfNeeded(rootPath: string): Promise<boolean> {
  const projectYamlPath = path.join(rootPath, ".leanquill", "project.yaml");
  const leanquillPath = path.join(rootPath, ".leanquill");

  const hasProjectYaml = await fs.stat(projectYamlPath).then(() => true).catch(() => false);
  const hasLeanquill = await fs.stat(leanquillPath).then(() => true).catch(() => false);

  if (!hasProjectYaml && !hasLeanquill) {
    return true;
  }

  // Valid project.yaml: extend with manuscript scaffold without wiping .leanquill (Phase 13).
  if (hasProjectYaml) {
    try {
      const content = await fs.readFile(projectYamlPath, "utf8");
      if (validateProjectYamlForSetup(content).ok) {
        return true;
      }
    } catch {
      // Fall through to destructive overwrite prompt.
    }
  }

  const choice = await vscode.window.showWarningMessage(
    "LeanQuill project state already exists. Overwrite .leanquill and project.yaml?",
    { modal: true },
    "Overwrite",
    "Cancel",
  );

  return choice === "Overwrite";
}

export async function writeHarnessEntryPoints(rootPath: string): Promise<void> {
  const copilotDir = path.join(rootPath, ".github", "agents");
  const copilotFile = path.join(copilotDir, "researcher.agent.md");
  const copilotContent = `---
name: researcher
description: "Run the LeanQuill research workflow — investigates a topic with web search and produces a structured research document"
tools: ['read', 'write', 'search', 'web']
---

You are the LeanQuill research agent.

## Your job

Research the given topic using web search and produce a structured markdown result file saved to the project's research folder.

## Step 1 — Find the research folder

Read \`.leanquill/project.yaml\` and extract the \`folders.research\` value. This is the save location relative to the workspace root. Default is \`research/leanquill/\`.

## Step 2 — Follow the canonical workflow

Read \`.leanquill/workflows/research.md\` for the full research process and output format.

## Step 3 — Save the result file

Name the file \`{topic-slug}-{YYYY-MM-DD}.md\` and save it inside the \`folders.research\` path from Step 1.

Example: if \`folders.research\` is \`research/leanquill/\` and the topic is "yacht classes for deep sea expedition", save to \`research/leanquill/yacht-classes-deep-sea-2026-04-07.md\`.

**Do not save files to the workspace root or any other location. Always save inside the research folder.**
`;

  const cursorDir = path.join(rootPath, ".cursor", "skills", "researcher");
  const cursorFile = path.join(cursorDir, "SKILL.md");
  const cursorContent = `---
name: researcher
description: "Run the LeanQuill research workflow — investigates a topic with web search and produces a structured research document"
---

<cursor_skill_adapter>
## A. Skill Invocation
- This skill is invoked when the user mentions \`researcher\` or asks to research a topic for their book.
- Treat all user text after the skill mention as the research query.

## B. Find the research folder
Read \`.leanquill/project.yaml\` and extract \`folders.research\`. Save the result file there.

## C. Execution
Read \`.leanquill/workflows/research.md\` for the full research process and output format.
Save the result file as \`{topic-slug}-{YYYY-MM-DD}.md\` inside the \`folders.research\` directory.
Do not save files anywhere else \u2014 always use the research folder from project.yaml.
</cursor_skill_adapter>
`;

  const claudeDir = path.join(rootPath, ".claude", "agents");
  const claudeFile = path.join(claudeDir, "researcher.md");
  const claudeContent = `---
name: researcher
description: "Run the LeanQuill research workflow — investigates a topic with web search and produces a structured research document"
tools: Read, Write, Edit, Bash, Grep, Glob, WebSearch, WebFetch
---

You are the LeanQuill research agent.

## Your job

Research the given topic and produce a structured markdown result file saved to the project's research folder.

## Step 1 \u2014 Find the research folder

Read \`.leanquill/project.yaml\` and extract the \`folders.research\` value. This is the save location relative to the workspace root. Default is \`research/leanquill/\`.

## Step 2 \u2014 Follow the canonical workflow

Read \`.leanquill/workflows/research.md\` for the full research process and output format.

## Step 3 \u2014 Save the result file

Name the file \`{topic-slug}-{YYYY-MM-DD}.md\` and save it inside the \`folders.research\` path from Step 1.

**Do not save files to the workspace root or any other location. Always save inside the research folder.**
`;

  const copilotImportFile = path.join(copilotDir, "leanquill-import-research.agent.md");
  const copilotImportContent = `---
name: leanquill-import-research
description: "LeanQuill-Import-Research — import external research and normalize it into LeanQuill research notes"
tools: ['read', 'write', 'search', 'web']
---

You are the LeanQuill import-research agent.

## Your job

Normalize external research into a single structured markdown file per the LeanQuill import workflow.

## Step 1 — Find the research folder

Read \`.leanquill/project.yaml\` and extract \`folders.research\`. That path is relative to the workspace root (default \`research/leanquill/\`).

## Step 2 — Follow the canonical import workflow

Read \`.leanquill/workflows/import-external-research.md\` first, then perform import normalization exactly as described there (including D-07–D-12). Do not substitute a different workflow file.

## Step 3 — Save or hand off

Write the result under \`folders.research\` when possible; otherwise output markdown for the user to save manually, as the workflow specifies.
`;

  const cursorImportDir = path.join(rootPath, ".cursor", "skills", "leanquill-import-research");
  const cursorImportFile = path.join(cursorImportDir, "SKILL.md");
  const cursorImportContent = `---
name: leanquill-import-research
description: "LeanQuill-Import-Research — import external research and normalize it into LeanQuill research notes"
---

<cursor_skill_adapter>
## A. Skill Invocation
- This skill is invoked when the user mentions \`leanquill-import-research\` or asks to import external research into LeanQuill.
- Treat all user text after the skill mention as the import context (source text, file paths, or instructions).

## B. Execution
Read \`.leanquill/workflows/import-external-research.md\` first, then follow it end-to-end. Read \`folders.research\` from \`.leanquill/project.yaml\` before saving.
</cursor_skill_adapter>
`;

  const claudeImportFile = path.join(claudeDir, "leanquill-import-research.md");
  const claudeImportContent = `---
name: leanquill-import-research
description: "LeanQuill-Import-Research — import external research and normalize it into LeanQuill research notes"
tools: Read, Write, Edit, Bash, Grep, Glob, WebSearch, WebFetch
---

You are the LeanQuill import-research agent.

## Your job

Normalize external research into a single structured markdown file per the LeanQuill import workflow.

## Step 1 — Find the research folder

Read \`.leanquill/project.yaml\` and extract \`folders.research\`.

## Step 2 — Follow the canonical import workflow

Read \`.leanquill/workflows/import-external-research.md\` first, then perform import normalization exactly as described there. Do not substitute a different workflow file.

## Step 3 — Save or hand off

Write the result under \`folders.research\` when possible; otherwise output markdown for the user to save manually, as the workflow specifies.
`;

  const copilotLqResearcherFile = path.join(copilotDir, "leanquill-researcher.agent.md");
  const copilotLqResearcherContent = `---
name: leanquill-researcher
description: "LeanQuill-Researcher — run the LeanQuill research workflow with web search and structured research notes"
tools: ['read', 'write', 'search', 'web']
---

You are the LeanQuill research agent.

## Your job

Research the given topic using web search and produce a structured markdown result file saved to the project's research folder.

## Step 1 — Find the research folder

Read \`.leanquill/project.yaml\` and extract \`folders.research\`. Default is \`research/leanquill/\`.

## Step 2 — Follow the canonical workflow

Read \`.leanquill/workflows/research.md\` for the full research process and output format.

## Step 3 — Save the result file

Name the file \`{topic-slug}-{YYYY-MM-DD}.md\` and save it inside \`folders.research\`.

**Do not save files to the workspace root or any other location. Always save inside the research folder.**
`;

  const cursorLqResearcherDir = path.join(rootPath, ".cursor", "skills", "leanquill-researcher");
  const cursorLqResearcherFile = path.join(cursorLqResearcherDir, "SKILL.md");
  const cursorLqResearcherContent = `---
name: leanquill-researcher
description: "LeanQuill-Researcher — run the LeanQuill research workflow with web search and structured research notes"
---

<cursor_skill_adapter>
## A. Skill Invocation
- This skill is invoked when the user mentions \`leanquill-researcher\` or asks for LeanQuill research for their book.
- Treat all user text after the skill mention as the research query.

## B. Find the research folder
Read \`.leanquill/project.yaml\` and extract \`folders.research\`. Save the result file there.

## C. Execution
Read \`.leanquill/workflows/research.md\` for the full research process and output format.
Save the result file as \`{topic-slug}-{YYYY-MM-DD}.md\` inside the \`folders.research\` directory.
Do not save files anywhere else — always use the research folder from project.yaml.
</cursor_skill_adapter>
`;

  const claudeLqResearcherFile = path.join(claudeDir, "leanquill-researcher.md");
  const claudeLqResearcherContent = `---
name: leanquill-researcher
description: "LeanQuill-Researcher — run the LeanQuill research workflow with web search and structured research notes"
tools: Read, Write, Edit, Bash, Grep, Glob, WebSearch, WebFetch
---

You are the LeanQuill research agent.

## Your job

Research the given topic and produce a structured markdown result file saved to the project's research folder.

## Step 1 — Find the research folder

Read \`.leanquill/project.yaml\` and extract \`folders.research\`.

## Step 2 — Follow the canonical workflow

Read \`.leanquill/workflows/research.md\` for the full research process and output format.

## Step 3 — Save the result file

Name the file \`{topic-slug}-{YYYY-MM-DD}.md\` and save it inside \`folders.research\`.

**Do not save files to the workspace root or any other location. Always save inside the research folder.**
`;

  const copilotLqStoryChatFile = path.join(copilotDir, "leanquill-story-chat.agent.md");
  const copilotLqStoryChatContent = `---
name: leanquill-story-chat
description: "LeanQuill-Story-Chat — conversational story advisor using LeanQuill workflows and metadata actions"
tools: ['read', 'write', 'search', 'web']
---

You are the LeanQuill story chat agent.

Read \`.leanquill/workflows/story-chat.md\` and \`.leanquill/workflows/metadata-actions.md\` before answering. When the chat context lists relevant memory records, read active story memory from \`.leanquill/memory/\` for those ids.

**Saving memory or metadata:** Follow \`leanquill-story-metadata-commit\` (see \`leanquill-story-metadata-commit.agent.md\` in this repo's agents folder): use plain-language questions, numbered options including **Other**, and confirmation — not raw \`MetadataAction\` JSON as the main approval step. After confirmation, write \`.leanquill/pending-metadata-action.json\` and ask the author to run **LeanQuill: Apply Metadata Action** (or use selection/paste as fallback). Do not directly edit manuscript files or other LeanQuill files except that pending file when saving via the contract.

End story chats with a concise summary block the author can pass to \`LeanQuill: Save Story Chat Summary\`, including session summary, memory topic/body, and any approved metadata action ids.
`;

  const cursorLqStoryChatDir = path.join(rootPath, ".cursor", "skills", "leanquill-story-chat");
  const cursorLqStoryChatFile = path.join(cursorLqStoryChatDir, "SKILL.md");
  const cursorLqStoryChatContent = `---
name: leanquill-story-chat
description: "LeanQuill-Story-Chat — conversational story advisor using LeanQuill workflows and metadata actions"
---

<cursor_skill_adapter>
## A. Skill Invocation
- This skill is invoked when the user mentions \`leanquill-story-chat\` or asks for LeanQuill story chat.
- Treat all user text after the skill mention as the story chat request.

## B. Workflows
Read \`.leanquill/workflows/story-chat.md\` and \`.leanquill/workflows/metadata-actions.md\` before answering.

## C. Memory
When the chat context lists relevant memory records, read active story memory from \`.leanquill/memory/\` for those ids.

## D. Metadata and memory (author-friendly)
To persist memory or other metadata, follow \`.cursor/skills/leanquill-story-metadata-commit/SKILL.md\` (or mention \`leanquill-story-metadata-commit\`): interview with numbered choices and **Other** — not raw \`MetadataAction\` JSON as the primary approval. After they confirm, prefer writing \`.leanquill/pending-metadata-action.json\` and **LeanQuill: Apply Metadata Action** with nothing selected.

## E. Safety
Do not directly edit manuscript files. Do not edit LeanQuill state except via the pending file + Apply command (or the skill's fallbacks). Read \`.leanquill/workflows/metadata-actions.md\` only to build a valid machine payload.

## F. Wrap-up
End story chats with a concise summary block the author can pass to \`LeanQuill: Save Story Chat Summary\`, including session summary, memory topic/body, and any applied metadata action ids.
</cursor_skill_adapter>
`;

  const claudeLqStoryChatFile = path.join(claudeDir, "leanquill-story-chat.md");
  const claudeLqStoryChatContent = `---
name: leanquill-story-chat
description: "LeanQuill-Story-Chat — conversational story advisor using LeanQuill workflows and metadata actions"
tools: Read, Write, Edit, Bash, Grep, Glob, WebSearch, WebFetch
---

You are the LeanQuill story chat agent.

Read \`.leanquill/workflows/story-chat.md\` and \`.leanquill/workflows/metadata-actions.md\` before answering. When the chat context lists relevant memory records, read active story memory from \`.leanquill/memory/\` for those ids.

**Saving memory or metadata:** Follow \`leanquill-story-metadata-commit\` (see \`leanquill-story-metadata-commit.md\` in this agent folder): plain-language options and confirmation, then \`.leanquill/pending-metadata-action.json\` and **LeanQuill: Apply Metadata Action** — not raw \`MetadataAction\` JSON as the main approval path. Do not directly edit manuscript files; use the contract only after the author agrees.

End story chats with a concise summary block the author can pass to \`LeanQuill: Save Story Chat Summary\`, including session summary, memory topic/body, and any approved metadata action ids.
`;

  const copilotLqStoryMetadataCommitFile = path.join(copilotDir, "leanquill-story-metadata-commit.agent.md");
  const copilotLqStoryMetadataCommitContent = `---
name: leanquill-story-metadata-commit
description: "Interview the author and commit LeanQuill story memory or metadata (pending file + Apply), without raw JSON approval"
tools: ['read', 'write', 'search', 'web']
---

You help authors save **story memory** or other **metadata** for LeanQuill using **questions and choices**, not by showing \`MetadataAction\` JSON for them to read.

## When to use
- The author agreed something should be written to \`.leanquill/memory/\` or another allowed path, or you are closing a story chat with a storable idea.

## Never as the first move
- Do **not** paste a full \`MetadataAction\` JSON object as the main way to ask "approve this?" The author is not expected to know \`actionId\`, \`fieldPath\`, or \`schemaVersion\`.

## Interview (do this in chat)
1. In plain language, restate what will be stored (1–2 sentences).
2. If multiple sensible filenames or topics exist, offer **2–4 numbered options** plus **Other**; accept a short free-text for Other.
3. After they pick or confirm, restate in bullets: **What** · **Where** (everyday path, e.g. "a new memory file under .leanquill/memory/").

## Apply path
1. Build one valid JSON object per \`.leanquill/workflows/metadata-actions.md\` (read when you need the contract).
2. **Preferred:** Write it to \`.leanquill/pending-metadata-action.json\` in the workspace (single object, minified or pretty). Tell the author: run **LeanQuill: Apply Metadata Action** in VS Code with **no text selected** — the extension reads that file, applies it, and deletes it on success.
3. **Fallback:** If you cannot write the file, output **one** fenced \`json\` block and ask the author to run the same command with that block **selected** or to paste at the prompt.
`;

  const cursorLqStoryMetadataCommitDir = path.join(rootPath, ".cursor", "skills", "leanquill-story-metadata-commit");
  const cursorLqStoryMetadataCommitFile = path.join(cursorLqStoryMetadataCommitDir, "SKILL.md");
  const cursorLqStoryMetadataCommitContent = `---
name: leanquill-story-metadata-commit
description: "Interview the author and commit LeanQuill story memory or metadata (pending file + Apply), without raw JSON approval"
---

<cursor_skill_adapter>
## A. Skill invocation
- Invoked when the user mentions \`leanquill-story-metadata-commit\` or asks to **save** / **remember** / **write** something from story chat to LeanQuill memory or metadata in an author-friendly way.

## B. Forbid
- Do **not** use a raw \`MetadataAction\` JSON block as the **main** approval UI. The author is not required to read schema fields.

## C. Do instead (interview)
1. Summarize in plain language what will be stored. Offer **2–4 numbered options** (e.g. file slug / focus) and **Other**; accept free text for Other.
2. Confirm with a short bullet list (**What** · **Where** in everyday terms).
3. Read \`.leanquill/workflows/metadata-actions.md\` only to build a **valid** payload after they agree.

## D. Hand off
- **Preferred:** Write one JSON object to \`.leanquill/pending-metadata-action.json\`, then: *"Run **LeanQuill: Apply Metadata Action** with nothing selected."*
- **Fallback:** One fenced \`json\` block + same command with selection or paste.
</cursor_skill_adapter>
`;

  const claudeLqStoryMetadataCommitFile = path.join(claudeDir, "leanquill-story-metadata-commit.md");
  const claudeLqStoryMetadataCommitContent = `---
name: leanquill-story-metadata-commit
description: "Interview the author and commit LeanQuill story memory or metadata (pending file + Apply), without raw JSON approval"
tools: Read, Write, Edit, Bash, Grep, Glob, WebSearch, WebFetch
---

You help authors save **story memory** or other **metadata** for LeanQuill using **questions and choices**, not by showing \`MetadataAction\` JSON for them to read.

## When to use
- The author agreed something should be written to \`.leanquill/memory/\` or another allowed path, or you are closing a story chat with a storable idea.

## Never as the first move
- Do **not** paste a full \`MetadataAction\` JSON object as the main way to ask "approve this?" The author is not expected to know \`actionId\`, \`fieldPath\`, or \`schemaVersion\`.

## Interview (do this in chat)
1. In plain language, restate what will be stored (1–2 sentences).
2. If multiple sensible filenames or topics exist, offer **2–4 numbered options** plus **Other**; accept a short free-text for Other.
3. After they pick or confirm, restate in bullets: **What** · **Where** (everyday path, e.g. "a new memory file under .leanquill/memory/").

## Apply path
1. Build one valid JSON object per \`.leanquill/workflows/metadata-actions.md\` (read when you need the contract).
2. **Preferred:** Write it to \`.leanquill/pending-metadata-action.json\` in the workspace (single object). Tell the author: run **LeanQuill: Apply Metadata Action** in VS Code with **no text selected** — the extension reads that file, applies it, and deletes it on success.
3. **Fallback:** If you cannot write the file, output **one** fenced \`json\` block and ask the author to run the same command with that block **selected** or to paste at the prompt.
`;

  const entries: Array<{ file: string; dir: string; content: string }> = [
    { file: copilotFile, dir: copilotDir, content: copilotContent },
    { file: cursorFile, dir: cursorDir, content: cursorContent },
    { file: claudeFile, dir: claudeDir, content: claudeContent },
    { file: copilotImportFile, dir: copilotDir, content: copilotImportContent },
    { file: cursorImportFile, dir: cursorImportDir, content: cursorImportContent },
    { file: claudeImportFile, dir: claudeDir, content: claudeImportContent },
    { file: copilotLqResearcherFile, dir: copilotDir, content: copilotLqResearcherContent },
    { file: cursorLqResearcherFile, dir: cursorLqResearcherDir, content: cursorLqResearcherContent },
    { file: claudeLqResearcherFile, dir: claudeDir, content: claudeLqResearcherContent },
    { file: copilotLqStoryChatFile, dir: copilotDir, content: copilotLqStoryChatContent },
    { file: cursorLqStoryChatFile, dir: cursorLqStoryChatDir, content: cursorLqStoryChatContent },
    { file: claudeLqStoryChatFile, dir: claudeDir, content: claudeLqStoryChatContent },
    { file: copilotLqStoryMetadataCommitFile, dir: copilotDir, content: copilotLqStoryMetadataCommitContent },
    { file: cursorLqStoryMetadataCommitFile, dir: cursorLqStoryMetadataCommitDir, content: cursorLqStoryMetadataCommitContent },
    { file: claudeLqStoryMetadataCommitFile, dir: claudeDir, content: claudeLqStoryMetadataCommitContent },
  ];

  for (const { file, dir, content } of entries) {
    const exists = await fs.stat(file).then(() => true).catch(() => false);
    if (exists) {
      continue;
    }
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(file, content, "utf8");
  }
}

export async function migrateProjectYaml(rootPath: string, safeFs: SafeFileSystem): Promise<boolean> {
  const yamlPath = path.join(rootPath, ".leanquill", "project.yaml");
  let content: string;
  try {
    content = await fs.readFile(yamlPath, "utf8");
  } catch {
    return false;
  }

  const isV1 = /schema_version:\s*["']?1["']?/.test(content);
  if (!isV1) {
    return false;
  }

  let updated = content.replace(
    /schema_version:\s*["']?1["']?/,
    'schema_version: "2"',
  );
  // Only replace the default research path — leave customized paths alone
  updated = updated.replace(
    /^(\s+research:\s*)notes\/research\/\s*$/m,
    "$1research/leanquill/",
  );

  await safeFs.writeFile(yamlPath, updated);
  return true;
}

async function initializeProject(rootPath: string, input: InitInput): Promise<{ warnings: string[]; projectYamlPath: string }> {
  const safeFs = new SafeFileSystem(rootPath);

  await fs.mkdir(path.join(rootPath, "manuscript"), { recursive: true });
  await safeFs.mkdir(path.join(rootPath, ".leanquill"));
  await safeFs.mkdir(path.join(rootPath, ".leanquill", "chats"));
  await safeFs.mkdir(path.join(rootPath, ".leanquill", "memory"));
  await safeFs.mkdir(path.join(rootPath, ".leanquill", "personas"));
  for (const id of PACKAGED_PERSONA_IDS) {
    await safeFs.writeFile(
      path.join(rootPath, ".leanquill", "personas", `${id}.md`),
      packagedPersonaMarkdown(id),
    );
  }

  const projectYaml = renderProjectYaml(input);
  const projectYamlPath = path.join(rootPath, ".leanquill", "project.yaml");
  await safeFs.writeFile(projectYamlPath, projectYaml);

  await safeFs.mkdir(path.join(rootPath, ".leanquill", "workflows"));
  for (const { fileName, content } of LEANQUILL_WORKFLOW_SPECS) {
    await safeFs.writeFile(path.join(rootPath, ".leanquill", "workflows", fileName), content);
  }

  // Generate harness entry points (outside SafeFileSystem boundary — config files)
  await writeHarnessEntryPoints(rootPath);

  const chapterOrder = await resolveChapterOrder(rootPath);
  await safeFs.writeFile(
    path.join(rootPath, ".leanquill", "chapter-order.json"),
    JSON.stringify(chapterOrder, null, 2),
  );

  return { warnings: chapterOrder.warnings, projectYamlPath };
}

export interface RunInitializeFlowOptions {
  planningPanel?: PlanningPanelProvider;
  /** Refresh Outline webview after outline index is updated (e.g. post-scaffold bootstrap). */
  refreshOutline?: () => void | Promise<void>;
}

async function manuscriptLayoutComplete(rootPath: string): Promise<{ hasManuscript: boolean; hasBookTxt: boolean }> {
  const hasManuscript = await fs.stat(path.join(rootPath, "manuscript")).then(() => true).catch(() => false);
  const hasBookTxt = await fs.stat(path.join(rootPath, "manuscript", "Book.txt")).then(() => true).catch(() => false);
  return { hasManuscript, hasBookTxt };
}

async function persistChapterOrder(
  rootPath: string,
  safeFs: SafeFileSystem,
  log?: vscode.LogOutputChannel,
): Promise<ChapterOrderResult> {
  const chapterOrder = await resolveChapterOrder(rootPath);
  const target = path.join(rootPath, ".leanquill", "chapter-order.json");
  await safeFs.writeFile(target, JSON.stringify(chapterOrder, null, 2));
  if (chapterOrder.warnings.length > 0) {
    log?.warn(`Chapter order has ${chapterOrder.warnings.length} warning(s)`);
  }
  return chapterOrder;
}

async function runScaffoldAndFinish(
  rootPath: string,
  safeFs: SafeFileSystem,
  log: vscode.LogOutputChannel | undefined,
  planningPanel: PlanningPanelProvider | undefined,
  context: vscode.ExtensionContext,
  chapterWarnings: string[],
  options?: RunInitializeFlowOptions,
): Promise<boolean> {
  // Allow scaffold to create the default chapter .md under manuscript/ (one-time init only).
  safeFs.allowPath("manuscript", ".md");
  const result = await applyLeanpubManuscriptScaffold(rootPath, { safeFs });
  for (const p of result.created) {
    log?.info(`Scaffold created: ${p}`);
  }
  for (const p of result.skipped) {
    log?.info(`Scaffold skipped (unchanged): ${p}`);
  }

  if (result.status === "blocked") {
    log?.error(result.message);
    const openBook = "Open Book.txt";
    const choice = await vscode.window.showErrorMessage(
      `${result.message} You can run the command LeanQuill: Open Book.txt to fix Book.txt.`,
      openBook,
    );
    if (choice === openBook) {
      await vscode.commands.executeCommand("leanquill.openBookTxt");
    }
    return false;
  }

  await context.workspaceState.update("leanquill.initPromptDismissed", false);
  const chapterOrder = await persistChapterOrder(rootPath, safeFs, log);

  const existingOutline = await readOutlineIndex(rootPath);
  if (existingOutline.nodes.length === 0 && chapterOrder.chapterPaths.length > 0) {
    const index = bootstrapOutline(chapterOrder.chapterPaths);
    await writeOutlineIndex(rootPath, index, safeFs);
    log?.info("Bootstrapped outline from Book.txt after scaffold");
    await options?.refreshOutline?.();
  }

  if (chapterWarnings.length > 0) {
    await vscode.window.showWarningMessage(`LeanQuill initialized with ${chapterWarnings.length} chapter-order warning(s).`);
    const output = vscode.window.createOutputChannel("LeanQuill");
    output.appendLine("Chapter-order warnings:");
    for (const warning of chapterWarnings) {
      output.appendLine(`- ${warning}`);
    }
    output.show(true);
  } else if (result.status === "noop") {
    await vscode.window.showInformationMessage(result.message);
  } else {
    await vscode.window.showInformationMessage("LeanQuill initialized successfully.");
  }

  if (planningPanel) {
    await planningPanel.showCards();
  }
  return true;
}

export async function runInitializeFlow(
  context: vscode.ExtensionContext,
  log?: vscode.LogOutputChannel,
  options?: RunInitializeFlowOptions,
): Promise<void> {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) {
    await vscode.window.showErrorMessage("Open a workspace folder before running LeanQuill initialize.");
    return;
  }

  const rootPath = folder.uri.fsPath;
  const planningPanel = options?.planningPanel;
  log?.info(`Root path: ${rootPath}`);

  const shouldContinue = await ensureOverwriteIfNeeded(rootPath);
  if (!shouldContinue) {
    log?.info("User cancelled overwrite prompt");
    return;
  }
  log?.info("Overwrite check passed");

  const projectYamlPath = path.join(rootPath, ".leanquill", "project.yaml");
  let yamlText: string | undefined;
  try {
    yamlText = await fs.readFile(projectYamlPath, "utf8");
  } catch {
    yamlText = undefined;
  }
  const yamlValid = yamlText !== undefined && validateProjectYamlForSetup(yamlText).ok;
  const { hasManuscript, hasBookTxt } = await manuscriptLayoutComplete(rootPath);
  const manuscriptScaffoldComplete = hasManuscript && hasBookTxt;

  const safeFs = new SafeFileSystem(rootPath);

  if (yamlValid && manuscriptScaffoldComplete) {
    await vscode.window.showInformationMessage(
      "This folder already has a valid LeanQuill project.yaml and manuscript layout (manuscript/Book.txt).",
    );
    return;
  }

  try {
    if (!yamlValid) {
      log?.info("Gathering input for full initialize...");
      const input = await gatherInitInput(log ?? vscode.window.createOutputChannel("LeanQuill", { log: true }));
      if (!input) {
        log?.info("User cancelled input gathering");
        return;
      }

      const result = await initializeProject(rootPath, input);
      const ok = await runScaffoldAndFinish(rootPath, safeFs, log, planningPanel, context, result.warnings, options);
      if (!ok) {
        return;
      }
      return;
    }

    // Valid yaml — manuscript scaffold only (no title/genre prompts).
    log?.info("Valid project.yaml — applying manuscript scaffold if needed");
    await runScaffoldAndFinish(rootPath, safeFs, log, planningPanel, context, [], options);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await vscode.window.showErrorMessage(`LeanQuill initialization failed: ${message}`);
  }
}

export function shouldPromptInitialize(folderPath: string): Promise<boolean> {
  const hasBookTxt = fs.stat(path.join(folderPath, "manuscript", "Book.txt")).then(() => true).catch(() => false);
  const hasManuscript = fs.stat(path.join(folderPath, "manuscript")).then(() => true).catch(() => false);
  const hasLeanquill = fs.stat(path.join(folderPath, ".leanquill")).then(() => true).catch(() => false);

  return Promise.all([hasBookTxt, hasManuscript, hasLeanquill]).then(([book, manuscript, initialized]) => {
    return !initialized && (book || manuscript);
  });
}
