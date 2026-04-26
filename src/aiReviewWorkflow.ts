import {
  createAiWorkflowSessionId,
  finalizeAiReviewSession,
  saveAiReviewSessionStub,
  type AiReviewSessionFinding,
  type AiReviewSessionSummary,
  type AiWorkflowSessionType,
} from "./aiReviewSessionStore";
import {
  readStoryChatLogSummaryFromDisk,
  saveStoryChatLogSummary,
  type StoryChatLogSummary,
} from "./storyChatLogStore";
import type { SafeFileSystem } from "./safeFileSystem";

export type PersonaScopeChoice = { kind: "all" } | { kind: "one"; personaId: string };

export interface PersonaIdName {
  id: string;
}

export function selectPersonaIdsForScope(personas: PersonaIdName[], choice: PersonaScopeChoice): string[] {
  if (choice.kind === "all") {
    return personas.map((p) => p.id);
  }
  const hit = personas.find((p) => p.id === choice.personaId);
  if (!hit) {
    throw new Error(`Persona not enabled: ${choice.personaId}`);
  }
  return [hit.id];
}

export interface PrepareChapterReviewRunInput {
  chapterRef: string;
  personas: PersonaIdName[];
  choice: PersonaScopeChoice;
  now?: Date;
}

export interface PreparedAiWorkflowRun {
  sessionId: string;
  sessionType: AiWorkflowSessionType;
  personaIds: string[];
  chapterRef: string;
  sessionIssueFile: string;
  chatLogFile: string;
}

export async function prepareChapterReviewRun(
  rootPath: string,
  safeFs: SafeFileSystem,
  input: PrepareChapterReviewRunInput,
): Promise<PreparedAiWorkflowRun> {
  const now = input.now ?? new Date();
  const personaIds = selectPersonaIdsForScope(input.personas, input.choice);
  const sessionId = createAiWorkflowSessionId("chapter-review", now);
  const generatedAt = now.toISOString();
  const sessionIssueFile = await saveAiReviewSessionStub(rootPath, safeFs, {
    sessionId,
    sessionType: "chapter-review",
    chapterRef: input.chapterRef,
    personaIds,
    generatedAt,
  });
  const chatLog: StoryChatLogSummary = {
    sessionId,
    startedAt: generatedAt,
    endedAt: generatedAt,
    launchedFrom: "chapter-review",
    chapterRef: input.chapterRef,
    chaptersInContext: [input.chapterRef],
    summary: "Session started.",
    memoryEntryIds: [],
    metadataActionIds: [],
    sessionType: "chapter-review",
    personaIds,
    issuesGenerated: 0,
    issuesResolved: 0,
    sessionIssueFile,
    storyUpdatesMade: false,
  };
  const chatLogFile = await saveStoryChatLogSummary(rootPath, safeFs, chatLog);
  return {
    sessionId,
    sessionType: "chapter-review",
    personaIds,
    chapterRef: input.chapterRef,
    sessionIssueFile,
    chatLogFile,
  };
}

export async function prepareStoryIntelligenceRun(
  rootPath: string,
  safeFs: SafeFileSystem,
  input: PrepareChapterReviewRunInput,
): Promise<PreparedAiWorkflowRun> {
  const now = input.now ?? new Date();
  const personaIds = selectPersonaIdsForScope(input.personas, input.choice);
  const sessionId = createAiWorkflowSessionId("story-intelligence-update", now);
  const generatedAt = now.toISOString();
  const sessionIssueFile = await saveAiReviewSessionStub(rootPath, safeFs, {
    sessionId,
    sessionType: "story-intelligence-update",
    chapterRef: input.chapterRef,
    personaIds,
    generatedAt,
  });
  const chatLog: StoryChatLogSummary = {
    sessionId,
    startedAt: generatedAt,
    endedAt: generatedAt,
    launchedFrom: "story-intelligence-update",
    chapterRef: input.chapterRef,
    chaptersInContext: [input.chapterRef],
    summary: "Session started.",
    memoryEntryIds: [],
    metadataActionIds: [],
    sessionType: "story-intelligence-update",
    personaIds,
    issuesGenerated: 0,
    issuesResolved: 0,
    sessionIssueFile,
    storyUpdatesMade: false,
  };
  const chatLogFile = await saveStoryChatLogSummary(rootPath, safeFs, chatLog);
  return {
    sessionId,
    sessionType: "story-intelligence-update",
    personaIds,
    chapterRef: input.chapterRef,
    sessionIssueFile,
    chatLogFile,
  };
}

export type AiWorkflowInvocationResult =
  | { mode: "direct-lm"; sessionId: string; summary: string }
  | { mode: "chat-fallback"; sessionId: string; query: string };

export function buildAiWorkflowFallbackQuery(run: PreparedAiWorkflowRun): string {
  const personaCsv = run.personaIds.join(", ");
  const lines: string[] = [];
  lines.push(`LeanQuill advisory workflow: ${run.sessionType}`);
  lines.push(`Session id: ${run.sessionId}`);
  lines.push(`Session issue file: ${run.sessionIssueFile}`);
  lines.push(`Chat log file: ${run.chatLogFile}`);
  lines.push(`Chapter in context: ${run.chapterRef}`);
  lines.push(`Persona ids: ${personaCsv}`);
  lines.push("Manuscript files are read-only. Do not write manuscript files.");
  if (run.sessionType === "story-intelligence-update") {
    lines.push(
      'Output MetadataAction JSON with risk "requiresApproval" and authorApproval. Do not apply note changes directly.',
    );
    lines.push(
      "Target story-note updates only to configured LeanQuill metadata roots such as notes/characters, notes/settings, notes/threads, research/leanquill, .leanquill/themes.yaml, or .leanquill/memory.",
    );
    lines.push("Never target manuscript/");
  }
  return lines.join("\n");
}

export interface FinalizeChapterReviewRunInput {
  sessionId: string;
  chapterRef: string;
  personaIds: string[];
  sessionIssueFile: string;
  summary: string;
  findings: AiReviewSessionFinding[];
  endedAt?: string;
}

export async function finalizeChapterReviewRun(
  rootPath: string,
  safeFs: SafeFileSystem,
  input: FinalizeChapterReviewRunInput,
): Promise<void> {
  const endedAt = input.endedAt ?? new Date().toISOString();
  const sessionSummary: AiReviewSessionSummary = {
    sessionId: input.sessionId,
    sessionType: "chapter-review",
    chapterRef: input.chapterRef,
    personaIds: input.personaIds,
    generatedAt: endedAt,
    issueCount: input.findings.length,
    summary: input.summary,
    findings: input.findings,
  };
  await finalizeAiReviewSession(rootPath, safeFs, sessionSummary);

  const prior = await readStoryChatLogSummaryFromDisk(rootPath, `.leanquill/chats/${input.sessionId}.md`);
  const chatLog: StoryChatLogSummary = {
    sessionId: input.sessionId,
    startedAt: prior?.startedAt ?? endedAt,
    endedAt,
    launchedFrom: prior?.launchedFrom ?? "chapter-review",
    chapterRef: input.chapterRef,
    chaptersInContext: prior?.chaptersInContext?.length ? prior.chaptersInContext : [input.chapterRef],
    summary: input.summary,
    memoryEntryIds: prior?.memoryEntryIds ?? [],
    metadataActionIds: prior?.metadataActionIds ?? [],
    sessionType: "chapter-review",
    personaIds: input.personaIds,
    issuesGenerated: input.findings.length,
    issuesResolved: prior?.issuesResolved ?? 0,
    sessionIssueFile: input.sessionIssueFile,
    storyUpdatesMade: prior?.storyUpdatesMade ?? false,
    storyUpdateNotes: prior?.storyUpdateNotes,
  };
  await saveStoryChatLogSummary(rootPath, safeFs, chatLog);
}
