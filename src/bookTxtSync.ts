import * as fs from "node:fs/promises";
import * as path from "node:path";
import { OutlineIndex } from "./types";

/**
 * Generate Book.txt content from outline index.
 * Uses LeanPub `part:` format for multi-part books.
 * Only includes active parts and active chapters.
 * Active beats with a fileName are listed after their parent chapter.
 */
export function generateBookTxt(index: OutlineIndex): string {
  const activeParts = index.parts.filter((p) => p.active);

  if (activeParts.length === 0) {
    return "";
  }

  const lines: string[] = [];
  const multiPart = activeParts.length > 1;

  for (const part of activeParts) {
    if (multiPart) {
      lines.push(`part: ${part.name}`);
    }

    for (const chapter of part.chapters) {
      if (chapter.active) {
        // Strip manuscript/ prefix — Book.txt paths are relative to manuscript/
        const chapterEntry = chapter.fileName.replace(/^manuscript\//, "");
        lines.push(chapterEntry);
        // List active beat files after the chapter (already relative to manuscript/)
        for (const beat of chapter.beats) {
          if (beat.active && beat.fileName) {
            lines.push(beat.fileName);
          }
        }
      }
    }
  }

  return lines.length > 0 ? lines.join("\n") + "\n" : "";
}

/**
 * Write Book.txt inside the manuscript directory.
 * LeanPub expects manuscript/Book.txt with paths relative to manuscript/.
 */
export async function writeBookTxt(rootPath: string, content: string): Promise<void> {
  await fs.writeFile(path.join(rootPath, "manuscript", "Book.txt"), content, "utf8");
}

/**
 * Read current Book.txt content. Returns null if file does not exist.
 */
export async function readBookTxt(rootPath: string): Promise<string | null> {
  try {
    return await fs.readFile(path.join(rootPath, "manuscript", "Book.txt"), "utf8");
  } catch {
    return null;
  }
}

/**
 * Detect if Book.txt was edited externally (outside the outline).
 * Compares current file content against expected content.
 * Returns false if Book.txt does not exist (nothing to conflict with).
 */
export async function detectExternalBookTxtEdit(
  rootPath: string,
  expectedContent: string,
): Promise<boolean> {
  const current = await readBookTxt(rootPath);
  if (current === null) {
    return false;
  }
  return current !== expectedContent;
}
