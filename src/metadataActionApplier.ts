import * as fs from "node:fs/promises";
import * as path from "node:path";
import { isDeepStrictEqual } from "node:util";
import type { ProjectConfig } from "./projectConfig";
import { readProjectConfigWithDefaults } from "./projectConfig";
import { SafeFileSystem } from "./safeFileSystem";
import { validateMetadataAction } from "./metadataActionContract";
import { appendMetadataActionLogEntry, type MetadataActionLogEntry } from "./metadataActionLog";
import { createStoryMemory, supersedeStoryMemory, type StoryMemoryAssociation } from "./storyMemoryStore";
import { createOpenQuestion, getOpenQuestion, saveOpenQuestion } from "./openQuestionStore";
import { parseCharacterFile, serializeCharacterFile } from "./characterStore";
import { parsePlaceFile, serializePlaceFile } from "./placeStore";
import { parseThreadFile, serializeThreadFile } from "./threadStore";
import { readThemesDocument, writeThemesDocument } from "./themesStore";
import {
  readStoryChatLogSummaryFromDisk,
  saveStoryChatLogSummary,
  type StoryChatLogSummary,
} from "./storyChatLogStore";

export function configuredMetadataWritableRoots(config: ProjectConfig): string[] {
  const slash = (p: string) => p.replace(/\\/g, "/").replace(/\/+$/, "") + "/";
  return [
    slash(config.folders.characters),
    slash(config.folders.settings),
    slash(config.folders.threads),
    slash(config.folders.research),
    ".leanquill/",
  ];
}

/** Mirrors extension activation allowPath rules for research/characters/threads/settings (manuscript guard + defaults). */
export function configureProjectWritableRoots(safeFs: SafeFileSystem, rootPath: string, config: ProjectConfig): void {
  void rootPath;
  const DEFAULT_RESEARCH_FOLDER = "research/leanquill";
  const DEFAULT_CHARACTERS_FOLDER = "notes/characters";
  const DEFAULT_THREADS_FOLDER = "notes/threads";
  const DEFAULT_SETTINGS_FOLDER = "notes/settings";

  const researchFolderClean = config.folders.research.replace(/\/+$/, "");
  const isResearchMs =
    researchFolderClean === "manuscript" || researchFolderClean.startsWith("manuscript/");
  const safeResearchFolder = isResearchMs ? DEFAULT_RESEARCH_FOLDER : researchFolderClean;
  safeFs.allowPath(safeResearchFolder, ".md");

  const charactersFolderRaw = config.folders.characters ?? DEFAULT_CHARACTERS_FOLDER;
  const charactersFolderClean = charactersFolderRaw.replace(/\/+$/g, "");
  const isCharsMs =
    charactersFolderClean === "manuscript" || charactersFolderClean.startsWith("manuscript/");
  const safeCharactersFolder = isCharsMs ? DEFAULT_CHARACTERS_FOLDER : charactersFolderClean;
  safeFs.allowPath(safeCharactersFolder, ".md");

  const threadsFolderRaw = config.folders.threads ?? DEFAULT_THREADS_FOLDER;
  const threadsFolderClean = threadsFolderRaw.replace(/\/+$/g, "");
  const isThreadsMs =
    threadsFolderClean === "manuscript" || threadsFolderClean.startsWith("manuscript/");
  const safeThreadsFolder = isThreadsMs ? DEFAULT_THREADS_FOLDER : threadsFolderClean;
  safeFs.allowPath(safeThreadsFolder, ".md");

  const settingsFolderRaw = config.folders.settings ?? DEFAULT_SETTINGS_FOLDER;
  const settingsFolderClean = settingsFolderRaw.replace(/\/+$/g, "");
  const isSettingsMs =
    settingsFolderClean === "manuscript" || settingsFolderClean.startsWith("manuscript/");
  const safeSettingsFolder = isSettingsMs ? DEFAULT_SETTINGS_FOLDER : settingsFolderClean;
  safeFs.allowPath(safeSettingsFolder, ".md");
}

function absFromRoot(rootPath: string, rel: string): string {
  return path.join(rootPath, ...rel.split("/").filter(Boolean));
}

function rawIds(raw: unknown): { actionId?: string; sourceChatId?: string } {
  if (!raw || typeof raw !== "object") {
    return {};
  }
  const o = raw as Record<string, unknown>;
  return {
    actionId: typeof o.actionId === "string" ? o.actionId : undefined,
    sourceChatId: typeof o.sourceChatId === "string" ? o.sourceChatId : undefined,
  };
}

async function logEntry(
  rootPath: string,
  fs: SafeFileSystem,
  partial: Pick<MetadataActionLogEntry, "actionId" | "sourceChatId" | "operation" | "targetPath" | "fieldPath" | "status" | "rationale" | "message">,
): Promise<void> {
  const entry: MetadataActionLogEntry = {
    timestamp: new Date().toISOString(),
    ...partial,
  };
  await appendMetadataActionLogEntry(rootPath, fs, entry);
}

function getCustomField(profile: { customFields: Record<string, string> }, key: string): string {
  return profile.customFields[key] ?? "";
}

export async function applyMetadataAction(
  rootPath: string,
  _safeFs: SafeFileSystem,
  rawAction: unknown,
): Promise<{ status: "applied" | "blocked" | "rejected"; message: string; actionId?: string }> {
  void _safeFs;
  const config = await readProjectConfigWithDefaults(rootPath);
  const opFs = new SafeFileSystem(rootPath, { denyManuscriptBookTxt: true });
  configureProjectWritableRoots(opFs, rootPath, config);
  const configuredWritableRoots = configuredMetadataWritableRoots(config);
  const vr = validateMetadataAction(rawAction, { configuredWritableRoots });

  const ids = rawIds(rawAction);

  if (!vr.ok) {
    const msg = vr.blockedReasons.length > 0 ? vr.blockedReasons.join("; ") : vr.errors.join("; ");
    if (ids.actionId && ids.sourceChatId) {
      await logEntry(rootPath, opFs, {
        actionId: ids.actionId,
        sourceChatId: ids.sourceChatId,
        operation: String((rawAction as Record<string, unknown>).operation ?? ""),
        targetPath: String((rawAction as Record<string, unknown>).targetPath ?? ""),
        fieldPath: Array.isArray((rawAction as Record<string, unknown>).fieldPath)
          ? ((rawAction as Record<string, unknown>).fieldPath as string[])
          : [],
        status: "blocked",
        rationale: String((rawAction as Record<string, unknown>).rationale ?? ""),
        message: msg,
      });
    }
    return { status: "blocked", message: msg, actionId: ids.actionId };
  }

  const action = vr.action!;

  const reject = async (message: string): Promise<{ status: "rejected"; message: string; actionId?: string }> => {
    await logEntry(rootPath, opFs, {
      actionId: action.actionId,
      sourceChatId: action.sourceChatId,
      operation: action.operation,
      targetPath: action.targetPath,
      fieldPath: action.fieldPath,
      status: "rejected",
      rationale: action.rationale,
      message,
    });
    return { status: "rejected", message, actionId: action.actionId };
  };

  const staleOk = async (readCurrent: () => Promise<unknown>): Promise<boolean> => {
    if (action.oldValue === undefined) {
      return true;
    }
    const cur = await readCurrent();
    return isDeepStrictEqual(cur, action.oldValue);
  };

  try {
    switch (action.operation) {
      case "createMemory": {
        const nv = action.newValue as { topic?: string; body?: string; association?: StoryMemoryAssociation } | null;
        if (!nv || typeof nv.topic !== "string" || typeof nv.body !== "string") {
          return await reject("createMemory newValue must include topic and body strings.");
        }
        await createStoryMemory(
          { topic: nv.topic, body: nv.body, association: nv.association, sourceChatId: action.sourceChatId },
          rootPath,
          opFs,
        );
        break;
      }
      case "supersedeMemory": {
        if (action.fieldPath[0] !== "memory" || typeof action.fieldPath[1] !== "string") {
          return await reject("supersedeMemory requires fieldPath [\"memory\", <oldId>].");
        }
        const nv = action.newValue as { topic?: string; body?: string; association?: StoryMemoryAssociation } | null;
        if (!nv || typeof nv.topic !== "string" || typeof nv.body !== "string") {
          return await reject("supersedeMemory newValue must include topic and body.");
        }
        await supersedeStoryMemory(rootPath, opFs, action.fieldPath[1], {
          topic: nv.topic,
          body: nv.body,
          association: nv.association,
          sourceChatId: action.sourceChatId,
        });
        break;
      }
      case "createIssue": {
        const nv = action.newValue as {
          title?: string;
          issueType?: string;
          association?: unknown;
          body?: string;
        } | null;
        if (!nv || typeof nv.title !== "string" || !nv.association) {
          return await reject("createIssue newValue must include title and association.");
        }
        const rec = await createOpenQuestion(opFs, rootPath, {
          title: nv.title,
          issueType: nv.issueType,
          association: nv.association as import("./types").OpenQuestionAssociation,
        });
        if (typeof nv.body === "string" && nv.body.length > 0) {
          await saveOpenQuestion({ ...rec, body: nv.body }, rootPath, opFs);
        }
        break;
      }
      case "updateIssueStatus": {
        if (!action.targetPath.startsWith(".leanquill/issues/")) {
          return await reject("updateIssueStatus target must be under .leanquill/issues/.");
        }
        if (!isDeepStrictEqual(action.fieldPath, ["status"])) {
          return await reject('updateIssueStatus fieldPath must be ["status"].');
        }
        const base = path.basename(action.targetPath, ".md");
        const q = await getOpenQuestion(rootPath, base);
        if (!q) {
          return await reject("Issue not found for status update.");
        }
        if (!(await staleOk(async () => q.status))) {
          return await reject("This metadata action is out of date.");
        }
        await saveOpenQuestion({ ...q, status: action.newValue as import("./types").OpenQuestionStatus }, rootPath, opFs);
        break;
      }
      case "set":
      case "append":
      case "removeFromList": {
        if (action.fieldPath[0] !== "customFields" || typeof action.fieldPath[1] !== "string") {
          return await reject("set/append/removeFromList only supports fieldPath [\"customFields\", key].");
        }
        const key = action.fieldPath[1];
        const abs = absFromRoot(rootPath, action.targetPath);
        const raw = await fs.readFile(abs, "utf8");
        const rel = action.targetPath.replace(/\\/g, "/");
        const charRoot = config.folders.characters.replace(/\/+$/, "").replace(/\\/g, "/");
        const placeRoot = config.folders.settings.replace(/\/+$/, "").replace(/\\/g, "/");
        const threadRoot = config.folders.threads.replace(/\/+$/, "").replace(/\\/g, "/");
        if (rel.startsWith(charRoot + "/") || rel === charRoot) {
          const profile = parseCharacterFile(path.basename(action.targetPath), raw);
          const cur = getCustomField(profile, key);
          if (!(await staleOk(async () => cur))) {
            return await reject("This metadata action is out of date.");
          }
          let nextVal = cur;
          const nv = action.newValue;
          if (action.operation === "set") {
            nextVal = typeof nv === "string" ? nv : String(nv ?? "");
          } else if (action.operation === "append") {
            nextVal = `${cur}${cur ? "\n" : ""}${typeof nv === "string" ? nv : String(nv ?? "")}`;
          } else {
            const line = typeof nv === "string" ? nv : String(nv ?? "");
            nextVal = cur
              .split("\n")
              .filter((ln) => ln !== line)
              .join("\n");
          }
          profile.customFields[key] = nextVal;
          await opFs.writeFile(abs, serializeCharacterFile(profile));
        } else if (rel.startsWith(placeRoot + "/") || rel === placeRoot) {
          const profile = parsePlaceFile(path.basename(action.targetPath), raw);
          const cur = getCustomField(profile as { customFields: Record<string, string> }, key);
          if (!(await staleOk(async () => cur))) {
            return await reject("This metadata action is out of date.");
          }
          let nextVal = cur;
          const nv = action.newValue;
          if (action.operation === "set") {
            nextVal = typeof nv === "string" ? nv : String(nv ?? "");
          } else if (action.operation === "append") {
            nextVal = `${cur}${cur ? "\n" : ""}${typeof nv === "string" ? nv : String(nv ?? "")}`;
          } else {
            const line = typeof nv === "string" ? nv : String(nv ?? "");
            nextVal = cur
              .split("\n")
              .filter((ln) => ln !== line)
              .join("\n");
          }
          (profile as { customFields: Record<string, string> }).customFields[key] = nextVal;
          await opFs.writeFile(abs, serializePlaceFile(profile));
        } else if (rel.startsWith(threadRoot + "/") || rel === threadRoot) {
          const profile = parseThreadFile(path.basename(action.targetPath), raw);
          const cur = getCustomField(profile as { customFields: Record<string, string> }, key);
          if (!(await staleOk(async () => cur))) {
            return await reject("This metadata action is out of date.");
          }
          let nextVal = cur;
          const nv = action.newValue;
          if (action.operation === "set") {
            nextVal = typeof nv === "string" ? nv : String(nv ?? "");
          } else if (action.operation === "append") {
            nextVal = `${cur}${cur ? "\n" : ""}${typeof nv === "string" ? nv : String(nv ?? "")}`;
          } else {
            const line = typeof nv === "string" ? nv : String(nv ?? "");
            nextVal = cur
              .split("\n")
              .filter((ln) => ln !== line)
              .join("\n");
          }
          (profile as { customFields: Record<string, string> }).customFields[key] = nextVal;
          await opFs.writeFile(abs, serializeThreadFile(profile));
        } else {
          return await reject("set/append/removeFromList supported only for character, place, or thread markdown roots.");
        }
        break;
      }
      case "updateThemeMetadata": {
        const doc = await readThemesDocument(rootPath);
        const nv = action.newValue as Partial<typeof doc> | null;
        if (!nv || typeof nv !== "object") {
          return await reject("updateThemeMetadata requires object newValue.");
        }
        const next = {
          ...doc,
          ...(nv.centralQuestion !== undefined ? { centralQuestion: nv.centralQuestion } : {}),
          ...(nv.bookSynopsis !== undefined ? { bookSynopsis: nv.bookSynopsis } : {}),
          ...(nv.bookCustomFields !== undefined ? { bookCustomFields: nv.bookCustomFields } : {}),
          ...(nv.centralThemes !== undefined ? { centralThemes: nv.centralThemes } : {}),
        };
        await writeThemesDocument(rootPath, next, opFs);
        break;
      }
      case "updateResearchAssociation": {
        const abs = absFromRoot(rootPath, action.targetPath);
        const raw = await fs.readFile(abs, "utf8");
        const normalized = raw.replace(/\r\n/g, "\n");
        const fmMatch = /^---\n([\s\S]*?)\n---/.exec(normalized);
        if (!fmMatch) {
          return await reject("Research file missing frontmatter.");
        }
        const body = normalized.slice(fmMatch[0].length).replace(/^\n/, "");
        const lines = fmMatch[1].split("\n");
        const nv = action.newValue as Record<string, string>;
        const map: Record<string, string> = {};
        for (const line of lines) {
          const m = /^([a-zA-Z0-9_]+):\s*(.*)$/.exec(line);
          if (m) {
            map[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
          }
        }
        for (const [k, v] of Object.entries(nv)) {
          map[k] = v;
        }
        const fmOut = ["---", ...Object.entries(map).map(([k, v]) => `${k}: ${JSON.stringify(v)}`), "---"].join("\n");
        await opFs.writeFile(abs, `${fmOut}\n${body}`);
        break;
      }
      case "updateChatLogProvenance": {
        if (!action.targetPath.startsWith(".leanquill/chats/")) {
          return await reject("updateChatLogProvenance only supports .leanquill/chats/ paths.");
        }
        const cur = await readStoryChatLogSummaryFromDisk(rootPath, action.targetPath);
        if (!cur) {
          return await reject("Chat log not found.");
        }
        const nv = action.newValue as Partial<StoryChatLogSummary> | null;
        if (!nv || typeof nv !== "object") {
          return await reject("updateChatLogProvenance requires object newValue.");
        }
        const merged: StoryChatLogSummary = {
          ...cur,
          memoryEntryIds: nv.memoryEntryIds ?? cur.memoryEntryIds,
          metadataActionIds: nv.metadataActionIds ?? cur.metadataActionIds,
          summary: nv.summary ?? cur.summary,
        };
        if (
          !(await staleOk(async () => ({
            memoryEntryIds: cur.memoryEntryIds,
            metadataActionIds: cur.metadataActionIds,
          })))
        ) {
          return await reject("This metadata action is out of date.");
        }
        await saveStoryChatLogSummary(rootPath, opFs, merged);
        break;
      }
      default:
        return await reject("Unsupported operation.");
    }

    await logEntry(rootPath, opFs, {
      actionId: action.actionId,
      sourceChatId: action.sourceChatId,
      operation: action.operation,
      targetPath: action.targetPath,
      fieldPath: action.fieldPath,
      status: "applied",
      rationale: action.rationale,
      message: "Applied LeanQuill metadata action.",
    });
    return { status: "applied", message: "Applied LeanQuill metadata action.", actionId: action.actionId };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    await logEntry(rootPath, opFs, {
      actionId: action.actionId,
      sourceChatId: action.sourceChatId,
      operation: action.operation,
      targetPath: action.targetPath,
      fieldPath: action.fieldPath,
      status: "blocked",
      rationale: action.rationale,
      message,
    });
    return { status: "blocked", message, actionId: action.actionId };
  }
}
