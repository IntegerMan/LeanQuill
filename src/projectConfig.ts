import * as fs from "node:fs/promises";
import * as path from "node:path";

export interface ProjectConfig {
  schemaVersion: string;
  folders: {
    research: string;
    characters: string;
  };
}

export function parseProjectConfig(content: string): ProjectConfig {
  // Normalize CRLF so Windows-authored files parse correctly
  const normalized = content.replace(/\r\n/g, "\n");

  const schemaVersionMatch = /^schema_version:\s*["']?(.+?)["']?\s*$/m.exec(normalized);
  const schemaVersion = schemaVersionMatch ? schemaVersionMatch[1].trim() : "1";

  let research = "research/leanquill/";
  let characters = "notes/characters/";

  // Find the folders: block and extract research: from it
  const lines = normalized.split("\n");
  let inFolders = false;
  for (const line of lines) {
    if (/^folders:\s*$/.test(line)) {
      inFolders = true;
      continue;
    }
    if (inFolders) {
      // End of folders block: non-indented non-empty line
      if (line.length > 0 && !/^\s/.test(line)) {
        inFolders = false;
        continue;
      }
      const researchMatch = /^\s+research:\s*["']?(.+?)["']?\s*$/.exec(line);
      if (researchMatch) {
        research = researchMatch[1].trim();
      }
      const charactersMatch = /^\s+characters:\s*["']?(.+?)["']?\s*$/.exec(line);
      if (charactersMatch) {
        characters = charactersMatch[1].trim();
      }
    }
  }

  return {
    schemaVersion,
    folders: { research, characters },
  };
}

export async function readProjectConfig(rootPath: string): Promise<ProjectConfig | null> {
  const yamlPath = path.join(rootPath, ".leanquill", "project.yaml");
  try {
    const content = await fs.readFile(yamlPath, "utf8");
    return parseProjectConfig(content);
  } catch {
    // Return null for any I/O error (missing file, permission denied, locked file, etc.)
    // so callers never see a raw filesystem error during extension activation.
    return null;
  }
}
