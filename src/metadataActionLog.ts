import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { SafeFileSystem } from "./safeFileSystem";

export const LEANQUILL_METADATA_ACTION_LOG = ".leanquill/metadata-actions.jsonl";

export type MetadataActionLogStatus = "applied" | "rejected" | "blocked";

export interface MetadataActionLogEntry {
  timestamp: string;
  actionId: string;
  sourceChatId: string;
  operation: string;
  targetPath: string;
  fieldPath: string[];
  status: MetadataActionLogStatus;
  rationale: string;
  message: string;
}

export async function appendMetadataActionLogEntry(
  rootPath: string,
  safeFs: SafeFileSystem,
  entry: MetadataActionLogEntry,
): Promise<void> {
  const logPath = path.join(rootPath, ...LEANQUILL_METADATA_ACTION_LOG.split("/"));
  if (!safeFs.canWrite(logPath, true)) {
    throw new Error(`Cannot write metadata action log: ${logPath}`);
  }
  await fs.mkdir(path.dirname(logPath), { recursive: true });
  await fs.appendFile(logPath, `${JSON.stringify(entry)}\n`, "utf8");
}

export async function readMetadataActionLog(rootPath: string): Promise<MetadataActionLogEntry[]> {
  const logPath = path.join(rootPath, ...LEANQUILL_METADATA_ACTION_LOG.split("/"));
  let raw: string;
  try {
    raw = await fs.readFile(logPath, "utf8");
  } catch {
    return [];
  }
  const out: MetadataActionLogEntry[] = [];
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t) {
      continue;
    }
    try {
      out.push(JSON.parse(t) as MetadataActionLogEntry);
    } catch {
      // skip invalid JSON lines
    }
  }
  return out;
}
