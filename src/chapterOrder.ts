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
  const bookTxtPath = path.join(rootPath, "manuscript", "Book.txt");
  const markdownFiles = await listMarkdownFiles(manuscriptDir);

  try {
    const rawBookTxt = await fs.readFile(bookTxtPath, "utf8");
    const lines = rawBookTxt
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith("#") && !line.startsWith("part:"));

    const seen = new Set<string>();
    const warnings: string[] = [];
    const ordered: string[] = [];

    for (const relPath of lines) {
      if (seen.has(relPath)) {
        warnings.push(`Duplicate Book.txt entry ignored: ${relPath}`);
        continue;
      }
      seen.add(relPath);

      // Paths in Book.txt are relative to manuscript/
      const normalizedRel = relPath.split("\\").join("/");
      if (!markdownFiles.includes(normalizedRel)) {
        warnings.push(`Book.txt references missing manuscript file: ${relPath}`);
        continue;
      }

      // Internally we use manuscript/-prefixed paths
      ordered.push(`manuscript/${normalizedRel}`);
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
