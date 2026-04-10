import * as fs from "node:fs/promises";
import * as path from "node:path";
import { PlaceProfile } from "./types";
import { ProjectConfig } from "./projectConfig";
import { SafeFileSystem } from "./safeFileSystem";

// ---------------------------------------------------------------------------
// Pure helper utilities
// ---------------------------------------------------------------------------

export function slugifyPlaceName(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${slug || "place"}.md`;
}

function settingsDir(rootPath: string, config: ProjectConfig): string {
  const rel = config.folders.settings.replace(/\/+$/, "");
  return path.join(rootPath, ...rel.split("/"));
}

// ---------------------------------------------------------------------------
// File parsing / serialization
// ---------------------------------------------------------------------------

export function parsePlaceFile(fileName: string, content: string): PlaceProfile {
  const normalized = content.replace(/\r\n/g, "\n");

  const fmMatch = /^---\n([\s\S]*?)\n---/.exec(normalized);
  if (!fmMatch) {
    return {
      fileName,
      name: "",
      aliases: [],
      category: "",
      region: "",
      description: "",
      referencedByNameIn: [],
      referencedInBeats: [],
      customFields: {},
      body: normalized,
    };
  }

  const frontmatter = fmMatch[1];
  const body = normalized.slice(fmMatch[0].length).replace(/^\n/, "").replace(/\n$/, "");

  let name = "";
  let category = "";
  let region = "";
  let description = "";
  const aliases: string[] = [];
  const referencedByNameIn: string[] = [];
  const referencedInBeats: string[] = [];
  const customFields: Record<string, string> = {};

  let currentKey: string | null = null;
  let currentList: string[] | null = null;
  let currentBlockKey: string | null = null;
  let currentBlockLines: string[] = [];

  const flushBlock = () => {
    if (currentBlockKey === null) {
      return;
    }
    const blockVal = currentBlockLines.join("\n").replace(/\n+$/, "");
    if (currentBlockKey === "description") {
      description = blockVal;
    } else {
      customFields[currentBlockKey] = blockVal;
    }
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
      currentList.push(listItemMatch[1].trim());
      continue;
    }

    currentList = null;
    currentKey = null;

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

    if (key === "name") {
      name = val;
    } else if (key === "category") {
      category = val;
    } else if (key === "region") {
      region = val;
    } else if (key === "description") {
      description = val;
    } else if (key === "aliases") {
      currentKey = "aliases";
      currentList = aliases;
    } else if (key === "referencedByNameIn") {
      currentKey = "referencedByNameIn";
      currentList = referencedByNameIn;
    } else if (key === "referencedInBeats") {
      currentKey = "referencedInBeats";
      currentList = referencedInBeats;
    } else {
      customFields[key] = val;
    }
  }

  flushBlock();

  return {
    fileName,
    name,
    aliases,
    category,
    region,
    description,
    referencedByNameIn,
    referencedInBeats,
    customFields,
    body,
  };
}

export function serializePlaceFile(profile: PlaceProfile): string {
  const lines: string[] = ["---"];

  lines.push(`name: ${profile.name}`);

  if (profile.aliases.length === 0) {
    lines.push("aliases: []");
  } else {
    lines.push("aliases:");
    for (const a of profile.aliases) {
      lines.push(`  - ${a}`);
    }
  }

  lines.push(`category: ${profile.category}`);
  lines.push(`region: ${profile.region}`);

  if (profile.description.includes("\n")) {
    lines.push("description: |");
    for (const descLine of profile.description.split("\n")) {
      lines.push(`  ${descLine}`);
    }
  } else if (profile.description === "|" || profile.description === "|-") {
    lines.push(`description: "${profile.description}"`);
  } else {
    lines.push(`description: ${profile.description}`);
  }

  if (profile.referencedByNameIn.length === 0) {
    lines.push("referencedByNameIn: []");
  } else {
    lines.push("referencedByNameIn:");
    for (const r of profile.referencedByNameIn) {
      lines.push(`  - ${r.replace(/\\/g, "/")}`);
    }
  }

  if (profile.referencedInBeats.length === 0) {
    lines.push("referencedInBeats: []");
  } else {
    lines.push("referencedInBeats:");
    for (const id of profile.referencedInBeats) {
      lines.push(`  - ${id}`);
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

// ---------------------------------------------------------------------------
// I/O operations
// ---------------------------------------------------------------------------

export async function listPlaces(
  rootPath: string,
  config: ProjectConfig,
): Promise<PlaceProfile[]> {
  const dir = settingsDir(rootPath, config);
  let entries: string[];
  try {
    entries = await fs.readdir(dir);
  } catch {
    return [];
  }

  const profiles: PlaceProfile[] = [];
  for (const entry of entries.filter((e) => e.endsWith(".md"))) {
    const filePath = path.join(dir, entry);
    const content = await fs.readFile(filePath, "utf8");
    profiles.push(parsePlaceFile(entry, content));
  }

  profiles.sort((a, b) => a.fileName.localeCompare(b.fileName));
  return profiles;
}

export async function createPlace(
  name: string,
  rootPath: string,
  config: ProjectConfig,
  safeFs: SafeFileSystem,
): Promise<PlaceProfile> {
  const dir = settingsDir(rootPath, config);
  await safeFs.mkdir(dir);

  const base = slugifyPlaceName(name).replace(/\.md$/, "");
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

  const profile: PlaceProfile = {
    fileName: slug,
    name,
    aliases: [],
    category: "",
    region: "",
    description: "",
    referencedByNameIn: [],
    referencedInBeats: [],
    customFields: {},
    body: "",
  };

  await safeFs.writeFile(path.join(dir, slug), serializePlaceFile(profile));
  return profile;
}

export async function savePlace(
  profile: PlaceProfile,
  rootPath: string,
  config: ProjectConfig,
  safeFs: SafeFileSystem,
): Promise<void> {
  const dir = settingsDir(rootPath, config);
  await safeFs.writeFile(path.join(dir, profile.fileName), serializePlaceFile(profile));
}

export async function deletePlace(
  fileName: string,
  rootPath: string,
  config: ProjectConfig,
  safeFs: SafeFileSystem,
): Promise<void> {
  const dir = settingsDir(rootPath, config);
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
