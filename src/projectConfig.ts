import * as fs from "node:fs/promises";
import * as path from "node:path";
import { stripYamlQuotes } from "./yamlUtils";

export interface ProjectConfig {
  schemaVersion: string;
  folders: {
    research: string;
    characters: string;
    threads: string;
  };
}

export const DEFAULT_PROJECT_CONFIG: ProjectConfig = {
  schemaVersion: "1",
  folders: { research: "research/leanquill/", characters: "notes/characters/", threads: "notes/threads/" },
};

export function parseProjectConfig(content: string): ProjectConfig {
  // Normalize CRLF so Windows-authored files parse correctly
  const normalized = content.replace(/\r\n/g, "\n");

  const schemaVersionMatch = /^schema_version:\s*["']?(.+?)["']?\s*$/m.exec(normalized);
  const schemaVersion = schemaVersionMatch ? schemaVersionMatch[1].trim() : "1";

  let research = "research/leanquill/";
  let characters = "notes/characters/";
  let threads = "notes/threads/";

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
      const threadsMatch = /^\s+threads:\s*["']?(.+?)["']?\s*$/.exec(line);
      if (threadsMatch) {
        threads = threadsMatch[1].trim();
      }
    }
  }

  return {
    schemaVersion,
    folders: { research, characters, threads },
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

export async function readProjectConfigWithDefaults(rootPath: string): Promise<ProjectConfig> {
  return await readProjectConfig(rootPath) ?? DEFAULT_PROJECT_CONFIG;
}

/** Book title + genres from `project.yaml` (for Themes pane). */
export interface ProjectIdentity {
  workingTitle: string;
  genres: string[];
}


export async function readProjectYamlRaw(rootPath: string): Promise<string | null> {
  const yamlPath = path.join(rootPath, ".leanquill", "project.yaml");
  try {
    return await fs.readFile(yamlPath, "utf8");
  } catch {
    return null;
  }
}

export function parseProjectIdentity(content: string): ProjectIdentity {
  const normalized = content.replace(/\r\n/g, "\n");
  const wt = /^working_title:\s*(.+)$/m.exec(normalized);
  const workingTitle = wt ? stripYamlQuotes(wt[1]) : "";

  const genres: string[] = [];
  const lines = normalized.split("\n");
  const gi = lines.findIndex((l) => /^genre:\s*$/.test(l));
  if (gi !== -1) {
    let i = gi + 1;
    while (i < lines.length) {
      const l = lines[i];
      if (l.length > 0 && !/^\s/.test(l)) {
        break;
      }
      const m = /^\s*-\s+(.+)$/.exec(l);
      if (m) {
        genres.push(stripYamlQuotes(m[1]));
      }
      i++;
    }
  }

  return { workingTitle, genres };
}

export async function readProjectIdentity(rootPath: string): Promise<ProjectIdentity> {
  const raw = await readProjectYamlRaw(rootPath);
  if (!raw) {
    return { workingTitle: "", genres: [] };
  }
  return parseProjectIdentity(raw);
}

function quoteProjectYamlScalar(value: string): string {
  if (value === "") {
    return '""';
  }
  if (/[\n:#'"[\]{}]/.test(value)) {
    return JSON.stringify(value);
  }
  return `'${value.replace(/'/g, "''")}'`;
}

/**
 * Update `working_title` and/or `genre:` list in existing project.yaml text.
 * Preserves other keys and relative order where possible.
 */
export function patchProjectIdentityInYaml(
  content: string,
  patch: { workingTitle?: string; genres?: string[] },
): string {
  const lines = content.replace(/\r\n/g, "\n").split("\n");

  const genreBlock = (genres: string[]): string[] => {
    const g = genres.length > 0 ? genres : ["fiction"];
    return ["genre:", ...g.map((x) => `  - ${quoteProjectYamlScalar(x)}`)];
  };

  if (patch.workingTitle !== undefined) {
    const idx = lines.findIndex((l) => /^working_title:\s*/.test(l));
    const nl = `working_title: ${quoteProjectYamlScalar(patch.workingTitle)}`;
    if (idx >= 0) {
      lines[idx] = nl;
    } else {
      const svi = lines.findIndex((l) => /^schema_version:\s*/.test(l));
      if (svi >= 0) {
        lines.splice(svi + 1, 0, nl);
      } else {
        lines.unshift(nl);
      }
    }
  }

  if (patch.genres !== undefined) {
    const gLines = genreBlock(patch.genres);
    const gi = lines.findIndex((l) => /^genre:\s*$/.test(l));
    if (gi >= 0) {
      let end = gi + 1;
      while (end < lines.length) {
        const l = lines[end];
        if (/^\s*-\s+/.test(l)) {
          end++;
          continue;
        }
        break;
      }
      lines.splice(gi, end - gi, ...gLines);
    } else {
      const wti = lines.findIndex((l) => /^working_title:\s*/.test(l));
      if (wti >= 0) {
        lines.splice(wti + 1, 0, ...gLines);
      } else {
        const svi = lines.findIndex((l) => /^schema_version:\s*/.test(l));
        if (svi >= 0) {
          lines.splice(svi + 1, 0, ...gLines);
        } else {
          lines.unshift(...gLines);
        }
      }
    }
  }

  const text = lines.join("\n");
  return text.endsWith("\n") ? text : `${text}\n`;
}

export interface ProjectYamlSetupValidation {
  ok: boolean;
  reason?: string;
}

/**
 * Minimal validity for Setup / initialize eligibility (D-02).
 * No YAML parser dependency — mirrors `renderProjectYaml` shape checks.
 */
export function validateProjectYamlForSetup(content: string): ProjectYamlSetupValidation {
  if (content.trim().length === 0) {
    return { ok: false, reason: "empty" };
  }

  const normalized = content.replace(/\r\n/g, "\n");

  if (!/^project_id:\s+/m.test(normalized)) {
    return { ok: false, reason: "missing_project_id" };
  }
  if (!/^working_title:\s+/m.test(normalized)) {
    return { ok: false, reason: "missing_working_title" };
  }

  if (!/^schema_version:\s+/m.test(normalized)) {
    return { ok: false, reason: "missing_schema_version" };
  }

  const parsed = parseProjectConfig(content);
  const schemaVersion = parsed.schemaVersion.trim();
  if (schemaVersion !== "1" && schemaVersion !== "2") {
    return { ok: false, reason: "invalid_schema_version" };
  }

  const lines = normalized.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (!/^folders:\s*$/.test(lines[i])) {
      continue;
    }
    let hasManuscript = false;
    i++;
    while (i < lines.length) {
      const line = lines[i];
      if (line.length > 0 && !/^\s/.test(line)) {
        i--;
        break;
      }
      if (/^\s+manuscript:\s*/.test(line)) {
        hasManuscript = true;
      }
      i++;
    }
    if (!hasManuscript) {
      return { ok: false, reason: "folders_missing_manuscript" };
    }
  }

  return { ok: true };
}
