import * as path from "node:path";
import type * as VSCode from "vscode";
import { readOutlineIndex, writeOutlineIndex } from "./outlineStore";
import { SafeFileSystem } from "./safeFileSystem";
import { OutlineBeat, OutlineIndex } from "./types";

function findBeat(
  index: OutlineIndex,
  beatId: string,
): OutlineBeat | undefined {
  for (const part of index.parts) {
    for (const chapter of part.chapters) {
      for (const beat of chapter.beats) {
        if (beat.id === beatId) {
          return beat;
        }
      }
    }
  }
  return undefined;
}

function beatToMarkdown(beat: OutlineBeat): string {
  return `---\nbeatId: "${beat.id}"\ntitle: "${beat.title}"\n---\n\n${beat.description}`;
}

function parseFrontmatter(content: string): { beatId: string; title: string; body: string } | undefined {
  const parts = content.split("---");
  if (parts.length < 3) {
    return undefined;
  }

  const frontmatter = parts[1];
  const beatIdMatch = frontmatter.match(/beatId:\s*"([^"]+)"/);
  const titleMatch = frontmatter.match(/title:\s*"([^"]*)"/);

  if (!beatIdMatch) {
    return undefined;
  }

  // Body is everything after the second ---
  const body = parts.slice(2).join("---").replace(/^\n+/, "");

  return {
    beatId: beatIdMatch[1],
    title: titleMatch ? titleMatch[1] : "",
    body,
  };
}

export async function openBeatInEditor(
  vscodeApi: typeof VSCode,
  rootPath: string,
  beatId: string,
  safeFs: SafeFileSystem,
): Promise<void> {
  const index = await readOutlineIndex(rootPath);
  const beat = findBeat(index, beatId);
  if (!beat) {
    await vscodeApi.window.showWarningMessage(`Beat not found: ${beatId}`);
    return;
  }

  const beatsDir = path.join(rootPath, ".leanquill", "beats");
  await safeFs.mkdir(beatsDir);

  const filePath = path.join(beatsDir, `${beatId}.md`);
  const content = beatToMarkdown(beat);
  await safeFs.writeFile(filePath, content);

  await vscodeApi.window.showTextDocument(vscodeApi.Uri.file(filePath), {
    viewColumn: vscodeApi.ViewColumn.Beside,
    preview: false,
  });
}

export async function syncBeatFromFile(
  rootPath: string,
  filePath: string,
  safeFs: SafeFileSystem,
): Promise<boolean> {
  const fs = await import("node:fs/promises");
  const content = await fs.readFile(filePath, "utf8");
  const parsed = parseFrontmatter(content);
  if (!parsed) {
    return false;
  }

  const index = await readOutlineIndex(rootPath);
  const beat = findBeat(index, parsed.beatId);
  if (!beat) {
    return false;
  }

  beat.description = parsed.body;
  await writeOutlineIndex(rootPath, index, safeFs);
  return true;
}
