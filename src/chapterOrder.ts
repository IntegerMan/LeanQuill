import * as fs from "node:fs/promises";
import * as path from "node:path";
import { ChapterOrderResult } from "./types";

function naturalSort(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

async function listMarkdownFiles(manuscriptDir: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(manuscriptDir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".md"))
      .map((entry) => entry.name)
      .sort(naturalSort);
  } catch {
    return [];
  }
}

export async function resolveChapterOrder(rootPath: string): Promise<ChapterOrderResult> {
  const manuscriptDir = path.join(rootPath, "manuscript");
  const bookTxtPath = path.join(rootPath, "Book.txt");
  const markdownFiles = await listMarkdownFiles(manuscriptDir);

  try {
    const rawBookTxt = await fs.readFile(bookTxtPath, "utf8");
    const lines = rawBookTxt
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith("#"));

    const seen = new Set<string>();
    const warnings: string[] = [];
    const ordered: string[] = [];

    for (const relPath of lines) {
      if (seen.has(relPath)) {
        warnings.push(`Duplicate Book.txt entry ignored: ${relPath}`);
        continue;
      }
      seen.add(relPath);

      const normalizedRel = relPath.split("\\").join("/");
      if (!normalizedRel.startsWith("manuscript/")) {
        warnings.push(`Book.txt entry is not under manuscript/: ${relPath}`);
        continue;
      }

      const fileName = normalizedRel.slice("manuscript/".length);
      if (!markdownFiles.includes(fileName)) {
        warnings.push(`Book.txt references missing manuscript file: ${relPath}`);
        continue;
      }

      ordered.push(normalizedRel);
    }

    return {
      chapterPaths: ordered,
      warnings,
      source: "book-txt",
    };
  } catch {
    return {
      chapterPaths: markdownFiles.map((file) => `manuscript/${file}`),
      warnings: [],
      source: "alpha",
    };
  }
}
