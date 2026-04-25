import * as fs from "node:fs/promises";
import * as path from "node:path";
import { escapeYamlString } from "./yamlUtils";
import type { SafeFileSystem } from "./safeFileSystem";
import { createStoryMemory, type StoryMemoryAssociation, type StoryMemoryRecord } from "./storyMemoryStore";

export const LEANQUILL_CHATS_DIR = ".leanquill/chats";

export interface StoryChatLogSummary {
  sessionId: string;
  startedAt: string;
  endedAt: string;
  launchedFrom: string;
  chapterRef: string;
  chaptersInContext: string[];
  summary: string;
  memoryEntryIds: string[];
  metadataActionIds: string[];
  transcript?: string;
}

export function serializeStoryChatLogSummary(summary: StoryChatLogSummary): string {
  const storyUpdatesMade =
    summary.memoryEntryIds.length > 0 || summary.metadataActionIds.length > 0 ? "true" : "false";
  const lines: string[] = ["---"];
  lines.push(`session_id: ${escapeYamlString(summary.sessionId)}`);
  lines.push("session_type: story-chat");
  lines.push(`started_at: ${escapeYamlString(summary.startedAt)}`);
  lines.push(`ended_at: ${escapeYamlString(summary.endedAt)}`);
  lines.push(`chapter_ref: ${escapeYamlString(summary.chapterRef)}`);
  lines.push(`chapters_in_context: ${escapeYamlString(JSON.stringify(summary.chaptersInContext))}`);
  lines.push("agent_mode: story-chat");
  lines.push(`summary: ${escapeYamlString(summary.summary)}`);
  lines.push(`memory_entry_ids: ${escapeYamlString(JSON.stringify(summary.memoryEntryIds))}`);
  lines.push(`metadata_action_ids: ${escapeYamlString(JSON.stringify(summary.metadataActionIds))}`);
  lines.push(`story_updates_made: ${storyUpdatesMade}`);
  lines.push(`story_update_notes: ${escapeYamlString("")}`);
  lines.push("---");
  if (summary.transcript?.length) {
    lines.push(summary.transcript);
  }
  return lines.join("\n");
}

export async function saveStoryChatLogSummary(
  rootPath: string,
  safeFs: SafeFileSystem,
  summary: StoryChatLogSummary,
): Promise<string> {
  const rel = `${LEANQUILL_CHATS_DIR}/${summary.sessionId}.md`.split("\\").join("/");
  const abs = path.join(rootPath, ...rel.split("/"));
  await safeFs.writeFile(abs, serializeStoryChatLogSummary(summary));
  return rel;
}

export interface SaveStoryChatSessionSummaryInput {
  chatLog: StoryChatLogSummary;
  memoryTopic: string;
  memoryBody: string;
  memoryAssociation: StoryMemoryAssociation;
}

export async function saveStoryChatSessionSummary(
  rootPath: string,
  safeFs: SafeFileSystem,
  input: SaveStoryChatSessionSummaryInput,
): Promise<{ chatLogPath: string; memoryRecord: StoryMemoryRecord }> {
  const firstLog: StoryChatLogSummary = {
    ...input.chatLog,
    memoryEntryIds: [...input.chatLog.memoryEntryIds],
    metadataActionIds: [...input.chatLog.metadataActionIds],
  };
  await saveStoryChatLogSummary(rootPath, safeFs, firstLog);

  const memoryRecord = await createStoryMemory(
    {
      topic: input.memoryTopic,
      body: input.memoryBody,
      association: input.memoryAssociation,
      sourceChatId: input.chatLog.sessionId,
    },
    rootPath,
    safeFs,
  );

  const finalLog: StoryChatLogSummary = {
    ...firstLog,
    memoryEntryIds: [...new Set([...firstLog.memoryEntryIds, memoryRecord.id])],
  };
  const chatLogPath = await saveStoryChatLogSummary(rootPath, safeFs, finalLog);
  return { chatLogPath, memoryRecord };
}
