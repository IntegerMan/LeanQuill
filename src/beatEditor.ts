import * as path from "node:path";
import type * as VSCode from "vscode";
import { readOutlineIndex, writeOutlineIndex } from "./outlineStore";
import { SafeFileSystem } from "./safeFileSystem";
import { OutlineBeat, OutlineIndex } from "./types";
import { readBeatFile, writeBeatFile } from "./beatManuscriptSync";

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

export async function openBeatInEditor(
  vscodeApi: typeof VSCode,
  rootPath: string,
  beatId: string,
  _safeFs: SafeFileSystem,
): Promise<void> {
  const index = await readOutlineIndex(rootPath);
  const beat = findBeat(index, beatId);
  if (!beat) {
    await vscodeApi.window.showWarningMessage(`Beat not found: ${beatId}`);
    return;
  }

  if (!beat.fileName) {
    await vscodeApi.window.showWarningMessage(`Beat has no manuscript file: ${beat.title}`);
    return;
  }

  const filePath = path.join(rootPath, "manuscript", beat.fileName);

  // Ensure the file exists (it should, but create if somehow missing)
  const content = await readBeatFile(rootPath, beat.fileName);
  if (content === "") {
    await writeBeatFile(rootPath, beat.fileName, beat.description);
  }

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

  // Determine beat fileName from the file path (relative to manuscript/)
  const manuscriptDir = path.join(rootPath, "manuscript");
  const relative = path.relative(manuscriptDir, filePath).replace(/\\/g, "/");

  // Only handle files under beats/
  if (!relative.startsWith("beats/")) {
    return false;
  }

  const index = await readOutlineIndex(rootPath);

  // Find beat by fileName match
  for (const part of index.parts) {
    for (const chapter of part.chapters) {
      for (const beat of chapter.beats) {
        if (beat.fileName === relative) {
          beat.description = content;
          await writeOutlineIndex(rootPath, index, safeFs);
          return true;
        }
      }
    }
  }

  return false;
}
