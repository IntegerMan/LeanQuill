import * as fs from "node:fs/promises";
import * as path from "node:path";

export interface ProjectConfig {
  schemaVersion: string;
  folders: {
    research: string;
  };
}

export function parseProjectConfig(content: string): ProjectConfig {
  const schemaVersionMatch = /^schema_version:\s*["']?(.+?)["']?\s*$/m.exec(content);
  const schemaVersion = schemaVersionMatch ? schemaVersionMatch[1].trim() : "1";

  let research = "research/leanquill/";

  // Find the folders: block and extract research: from it
  const lines = content.split("\n");
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
        break;
      }
    }
  }

  return {
    schemaVersion,
    folders: { research },
  };
}

export async function readProjectConfig(rootPath: string): Promise<ProjectConfig | null> {
  const yamlPath = path.join(rootPath, ".leanquill", "project.yaml");
  try {
    const content = await fs.readFile(yamlPath, "utf8");
    return parseProjectConfig(content);
  } catch (err: unknown) {
    if (err && typeof err === "object" && "code" in err && (err as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw err;
  }
}
