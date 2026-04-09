import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { ThreadProfile } from "./types";
import type { ProjectConfig } from "./projectConfig";
import type { SafeFileSystem } from "./safeFileSystem";

export function slugifyThreadTitle(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${slug || "thread"}.md`;
}

function threadsDir(rootPath: string, config: ProjectConfig): string {
  const rel = config.folders.threads.replace(/\/+$/, "");
  return path.join(rootPath, ...rel.split("/"));
}

export function parseThreadFile(fileName: string, content: string): ThreadProfile {
  const normalized = content.replace(/\r\n/g, "\n");

  const fmMatch = /^---\n([\s\S]*?)\n---/.exec(normalized);
  if (!fmMatch) {
    return {
      fileName,
      title: "",
      touchesChapters: [],
      customFields: {},
      body: normalized,
    };
  }

  const frontmatter = fmMatch[1];
  const body = normalized.slice(fmMatch[0].length).replace(/^\n/, "").replace(/\n$/, "");

  let title = "";
  const touchesChapters: string[] = [];
  const customFields: Record<string, string> = {};

  let currentList: string[] | null = null;
  let currentBlockKey: string | null = null;
  let currentBlockLines: string[] = [];

  const flushBlock = () => {
    if (currentBlockKey === null) {
      return;
    }
    const blockVal = currentBlockLines.join("\n").replace(/\n+$/, "");
    customFields[currentBlockKey] = blockVal;
    currentBlockKey = null;
    currentBlockLines = [];
  };

  const lines = frontmatter.split("\n");
  for (const line of lines) {
    if (currentBlockKey !== null) {
      if (line.startsWith("  ") || line === "") {
        currentBlockLines.push(line.startsWith("  ") ? line.slice(2) : "");
        continue;
      } else {
        flushBlock();
      }
    }

    const listItemMatch = /^  - (.*)$/.exec(line);
    if (listItemMatch && currentList !== null) {
      currentList.push(listItemMatch[1].trim().replace(/\\/g, "/"));
      continue;
    }

    currentList = null;

    const keyValMatch = /^([a-zA-Z0-9_]+):\s*(.*)$/.exec(line);
    if (!keyValMatch) {
      continue;
    }

    const key = keyValMatch[1];
    const rawVal = keyValMatch[2].trim();

    if (rawVal === "|" || rawVal === "|-") {
      currentBlockKey = key;
      currentBlockLines = [];
      continue;
    }

    const val = rawVal.replace(/^["']|["']$/g, "");

    if (key === "title") {
      title = val;
    } else if (key === "touchesChapters") {
      if (rawVal === "[]") {
        touchesChapters.length = 0;
      } else {
        currentList = touchesChapters;
      }
    } else {
      customFields[key] = val;
    }
  }

  flushBlock();

  return { fileName, title, touchesChapters, customFields, body };
}

export function serializeThreadFile(profile: ThreadProfile): string {
  const lines: string[] = ["---"];

  lines.push(`title: ${profile.title}`);

  if (profile.touchesChapters.length === 0) {
    lines.push("touchesChapters: []");
  } else {
    lines.push("touchesChapters:");
    for (const p of profile.touchesChapters) {
      lines.push(`  - ${p.replace(/\\/g, "/")}`);
    }
  }

  for (const [key, val] of Object.entries(profile.customFields)) {
    if (val.includes("\n")) {
      lines.push(`${key}: |`);
      for (const valLine of val.split("\n")) {
        lines.push(`  ${valLine}`);
      }
    } else if (val === "|" || val === "|-") {
      lines.push(`${key}: "${val}"`);
    } else {
      lines.push(`${key}: ${val}`);
    }
  }

  lines.push("---");
  lines.push(profile.body);

  return lines.join("\n");
}

export async function listThreads(rootPath: string, config: ProjectConfig): Promise<ThreadProfile[]> {
  const dir = threadsDir(rootPath, config);
  let entries: string[];
  try {
    entries = await fs.readdir(dir);
  } catch {
    return [];
  }

  const profiles: ThreadProfile[] = [];
  for (const entry of entries.filter((e) => e.endsWith(".md"))) {
    const filePath = path.join(dir, entry);
    const content = await fs.readFile(filePath, "utf8");
    profiles.push(parseThreadFile(entry, content));
  }

  profiles.sort((a, b) => a.fileName.localeCompare(b.fileName));
  return profiles;
}

export async function createThread(
  initialTitle: string,
  rootPath: string,
  config: ProjectConfig,
  safeFs: SafeFileSystem,
): Promise<ThreadProfile> {
  const dir = threadsDir(rootPath, config);
  await safeFs.mkdir(dir);

  const base = slugifyThreadTitle(initialTitle).replace(/\.md$/, "");
  let slug = `${base}.md`;
  let attempt = 2;
  while (true) {
    try {
      await fs.access(path.join(dir, slug));
      slug = `${base}-${attempt}.md`;
      attempt++;
    } catch {
      break;
    }
  }

  const profile: ThreadProfile = {
    fileName: slug,
    title: initialTitle.trim(),
    touchesChapters: [],
    customFields: {},
    body: "",
  };

  await safeFs.writeFile(path.join(dir, slug), serializeThreadFile(profile));
  return profile;
}

export async function saveThread(
  profile: ThreadProfile,
  rootPath: string,
  config: ProjectConfig,
  safeFs: SafeFileSystem,
): Promise<void> {
  const dir = threadsDir(rootPath, config);
  await safeFs.writeFile(path.join(dir, profile.fileName), serializeThreadFile(profile));
}

export async function deleteThread(
  fileName: string,
  rootPath: string,
  config: ProjectConfig,
  safeFs: SafeFileSystem,
): Promise<void> {
  const dir = threadsDir(rootPath, config);
  const filePath = path.join(dir, fileName);
  if (!safeFs.canWrite(filePath, true)) {
    throw new Error(`Blocked delete outside LeanQuill boundary: ${filePath}`);
  }
  try {
    await fs.unlink(filePath);
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      throw err;
    }
  }
}
