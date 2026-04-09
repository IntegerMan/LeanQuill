import * as fs from "node:fs/promises";
import * as path from "node:path";
import { CharacterProfile } from "./types";
import { ProjectConfig } from "./projectConfig";
import { SafeFileSystem } from "./safeFileSystem";

// ---------------------------------------------------------------------------
// Pure helper utilities
// ---------------------------------------------------------------------------

export function slugifyCharacterName(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${slug || "character"}.md`;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function charsDir(rootPath: string, config: ProjectConfig): string {
  const rel = config.folders.characters.replace(/\/+$/, "");
  return path.join(rootPath, ...rel.split("/"));
}

// ---------------------------------------------------------------------------
// File parsing / serialization
// ---------------------------------------------------------------------------

export function parseCharacterFile(fileName: string, content: string): CharacterProfile {
  // Normalize CRLF
  const normalized = content.replace(/\r\n/g, "\n");

  const fmMatch = /^---\n([\s\S]*?)\n---/.exec(normalized);
  if (!fmMatch) {
    return {
      fileName,
      name: "",
      aliases: [],
      role: "",
      description: "",
      referencedByNameIn: [],
      customFields: {},
      body: normalized,
    };
  }

  const frontmatter = fmMatch[1];
  const body = normalized.slice(fmMatch[0].length).replace(/^\n/, "").replace(/\n$/, "");

  let name = "";
  let role = "";
  let description = "";
  const aliases: string[] = [];
  const referencedByNameIn: string[] = [];
  const customFields: Record<string, string> = {};

  // State machine for parsing top-level keys, list values, and block scalars
  let currentKey: string | null = null;
  let currentList: string[] | null = null;
  let currentBlockKey: string | null = null;
  let currentBlockLines: string[] = [];

  const flushBlock = () => {
    if (currentBlockKey === null) { return; }
    // Strip trailing newlines that YAML block scalars add implicitly
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
    // Block scalar continuation (indented lines)
    if (currentBlockKey !== null) {
      if (line.startsWith("  ")) {
        currentBlockLines.push(line.slice(2));
        continue;
      } else {
        flushBlock();
      }
    }

    // List item under current key
    const listItemMatch = /^  - (.*)$/.exec(line);
    if (listItemMatch && currentList !== null) {
      currentList.push(listItemMatch[1].trim());
      continue;
    }

    // New key
    currentList = null;
    currentKey = null;

    const keyValMatch = /^([a-zA-Z0-9_]+):\s*(.*)$/.exec(line);
    if (!keyValMatch) { continue; }

    const key = keyValMatch[1];
    const rawVal = keyValMatch[2].trim();

    // Block scalar indicator
    if (rawVal === "|" || rawVal === "|-") {
      currentBlockKey = key;
      currentBlockLines = [];
      continue;
    }

    const val = rawVal.replace(/^["']|["']$/g, "");

    if (key === "name") {
      name = val;
    } else if (key === "role") {
      role = val;
    } else if (key === "description") {
      description = val;
    } else if (key === "aliases") {
      currentKey = "aliases";
      currentList = aliases;
      // inline value fallback: aliases: [a, b] not supported — list syntax only
    } else if (key === "referencedByNameIn") {
      currentKey = "referencedByNameIn";
      currentList = referencedByNameIn;
    } else {
      // Any other key → customFields (including empty values)
      customFields[key] = val;
    }
  }

  // Flush any trailing block scalar
  flushBlock();

  return { fileName, name, aliases, role, description, referencedByNameIn, customFields, body };
}

export function serializeCharacterFile(profile: CharacterProfile): string {
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

  lines.push(`role: ${profile.role}`);

  if (profile.description.includes("\n")) {
    lines.push("description: |");
    for (const descLine of profile.description.split("\n")) {
      lines.push(`  ${descLine}`);
    }
  } else {
    lines.push(`description: ${profile.description}`);
  }

  if (profile.referencedByNameIn.length === 0) {
    lines.push("referencedByNameIn: []");
  } else {
    lines.push("referencedByNameIn:");
    for (const r of profile.referencedByNameIn) {
      // Normalize to forward slashes
      lines.push(`  - ${r.replace(/\\/g, "/")}`);
    }
  }

  for (const [key, val] of Object.entries(profile.customFields)) {
    if (val.includes("\n")) {
      lines.push(`${key}: |`);
      for (const valLine of val.split("\n")) {
        lines.push(`  ${valLine}`);
      }
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

export async function listCharacters(
  rootPath: string,
  config: ProjectConfig,
): Promise<CharacterProfile[]> {
  const dir = charsDir(rootPath, config);
  let entries: string[];
  try {
    entries = await fs.readdir(dir);
  } catch {
    return [];
  }

  const profiles: CharacterProfile[] = [];
  for (const entry of entries.filter((e) => e.endsWith(".md"))) {
    const filePath = path.join(dir, entry);
    const content = await fs.readFile(filePath, "utf8");
    profiles.push(parseCharacterFile(entry, content));
  }

  // Deterministic order
  profiles.sort((a, b) => a.fileName.localeCompare(b.fileName));
  return profiles;
}

export async function createCharacter(
  name: string,
  rootPath: string,
  config: ProjectConfig,
  safeFs: SafeFileSystem,
): Promise<CharacterProfile> {
  const dir = charsDir(rootPath, config);
  await safeFs.mkdir(dir);

  const base = slugifyCharacterName(name).replace(/\.md$/, "");
  let slug = `${base}.md`;
  let attempt = 2;
  while (true) {
    try {
      await fs.access(path.join(dir, slug));
      // File exists — try next suffix
      slug = `${base}-${attempt}.md`;
      attempt++;
    } catch {
      // File does not exist — use this slug
      break;
    }
  }

  const profile: CharacterProfile = {
    fileName: slug,
    name,
    aliases: [],
    role: "",
    description: "",
    referencedByNameIn: [],
    customFields: {},
    body: "",
  };

  await safeFs.writeFile(path.join(dir, slug), serializeCharacterFile(profile));
  return profile;
}

export async function saveCharacter(
  profile: CharacterProfile,
  rootPath: string,
  config: ProjectConfig,
  safeFs: SafeFileSystem,
): Promise<void> {
  const dir = charsDir(rootPath, config);
  await safeFs.writeFile(path.join(dir, profile.fileName), serializeCharacterFile(profile));
}

export async function deleteCharacter(
  fileName: string,
  rootPath: string,
  config: ProjectConfig,
  safeFs: SafeFileSystem,
): Promise<void> {
  const dir = charsDir(rootPath, config);
  const filePath = path.join(dir, fileName);
  // Validate write permission before deleting (respects safety boundary)
  if (!safeFs.canWrite(filePath, true)) {
    throw new Error(`Blocked delete outside LeanQuill boundary: ${filePath}`);
  }
  try {
    await fs.unlink(filePath);
  } catch (err: unknown) {
    // Ignore ENOENT — file already gone
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      throw err;
    }
  }
}

export async function scanManuscriptFileForCharacters(
  manuscriptFilePath: string,
  rootPath: string,
  config: ProjectConfig,
  safeFs: SafeFileSystem,
): Promise<void> {
  const text = await fs.readFile(manuscriptFilePath, "utf8");
  const relativeManuscriptPath = path
    .relative(rootPath, manuscriptFilePath)
    .replace(/\\/g, "/");

  const profiles = await listCharacters(rootPath, config);

  for (const profile of profiles) {
    const terms = [profile.name, ...profile.aliases].filter(Boolean);
    const matched = terms.some((term) =>
      new RegExp(`\\b${escapeRegex(term)}\\b`, "i").test(text),
    );

    const alreadyIn = profile.referencedByNameIn.includes(relativeManuscriptPath);
    let changed = false;

    if (matched && !alreadyIn) {
      profile.referencedByNameIn = [...profile.referencedByNameIn, relativeManuscriptPath];
      changed = true;
    } else if (!matched && alreadyIn) {
      profile.referencedByNameIn = profile.referencedByNameIn.filter(
        (r) => r !== relativeManuscriptPath,
      );
      changed = true;
    }

    if (changed) {
      await saveCharacter(profile, rootPath, config, safeFs);
    }
  }
}
