import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as vscode from "vscode";
import { resolveChapterOrder } from "./chapterOrder";
import { applyLeanpubManuscriptScaffold } from "./leanpubScaffold";
import type { PlanningPanelProvider } from "./planningPanel";
import { validateProjectYamlForSetup } from "./projectConfig";
import { SafeFileSystem } from "./safeFileSystem";
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
    "active_personas: []",
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

const RESEARCH_WORKFLOW_CONTENT = `---
name: LeanQuill Research Workflow
version: 1
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

This workflow is invoked via harness-specific entry points:

- **Copilot:** \`.github/agents/researcher.agent.md\`
- **Cursor:** \`.cursor/skills/researcher/SKILL.md\`
- **Claude:** \`.claude/agents/researcher.md\`

All three entry points read this file and execute the process above.
`;

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

  const entries: Array<{ file: string; dir: string; content: string }> = [
    { file: copilotFile, dir: copilotDir, content: copilotContent },
    { file: cursorFile, dir: cursorDir, content: cursorContent },
    { file: claudeFile, dir: claudeDir, content: claudeContent },
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
  await safeFs.mkdir(path.join(rootPath, ".leanquill", "personas"));

  const projectYaml = renderProjectYaml(input);
  const projectYamlPath = path.join(rootPath, ".leanquill", "project.yaml");
  await safeFs.writeFile(projectYamlPath, projectYaml);

  // Create canonical research workflow
  await safeFs.mkdir(path.join(rootPath, ".leanquill", "workflows"));
  await safeFs.writeFile(
    path.join(rootPath, ".leanquill", "workflows", "research.md"),
    RESEARCH_WORKFLOW_CONTENT,
  );

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
