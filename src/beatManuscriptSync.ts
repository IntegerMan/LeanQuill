import * as fs from "node:fs/promises";
import * as path from "node:path";

/**
 * Convert a beat title to a kebab-case slug suitable for a filename.
 * Strips non-alphanumeric characters, collapses hyphens, trims edges.
 */
export function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    || "untitled";
}

/**
 * Generate a unique beat filename under `beats/` using a slugified title.
 * If the slug already exists in `existingSlugs`, appends `-2`, `-3`, etc.
 * Returns a path relative to manuscript/ (e.g., `beats/opening-scene.md`).
 */
export function generateBeatFileName(title: string, existingSlugs: Set<string>): string {
  const base = slugify(title);
  let candidate = `beats/${base}.md`;
  if (!existingSlugs.has(candidate)) {
    return candidate;
  }
  let n = 2;
  while (existingSlugs.has(`beats/${base}-${n}.md`)) {
    n++;
  }
  return `beats/${base}-${n}.md`;
}

/**
 * Collect all beat fileNames currently assigned across an outline index.
 */
export function collectExistingBeatSlugs(parts: Array<{ chapters: Array<{ beats: Array<{ fileName: string }> }> }>): Set<string> {
  const slugs = new Set<string>();
  for (const part of parts) {
    for (const chapter of part.chapters) {
      for (const beat of chapter.beats) {
        if (beat.fileName) {
          slugs.add(beat.fileName);
        }
      }
    }
  }
  return slugs;
}

/**
 * Write a beat's content to its manuscript file.
 * Creates the `manuscript/beats/` directory if needed.
 */
export async function writeBeatFile(rootPath: string, fileName: string, content: string): Promise<void> {
  const filePath = path.join(rootPath, "manuscript", fileName);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, "utf8");
}

/**
 * Read a beat's content from its manuscript file.
 * Returns empty string if the file does not exist.
 */
export async function readBeatFile(rootPath: string, fileName: string): Promise<string> {
  try {
    return await fs.readFile(path.join(rootPath, "manuscript", fileName), "utf8");
  } catch {
    return "";
  }
}

/**
 * Delete a beat's manuscript file. Silently ignores missing files.
 */
export async function deleteBeatFile(rootPath: string, fileName: string): Promise<void> {
  try {
    await fs.unlink(path.join(rootPath, "manuscript", fileName));
  } catch {
    // File may not exist — that's fine
  }
}

/**
 * Rename a beat's manuscript file. Writes content to the new path and
 * deletes the old one. If the old file doesn't exist, just writes the new one.
 */
export async function renameBeatFile(
  rootPath: string,
  oldFileName: string,
  newFileName: string,
  content: string,
): Promise<void> {
  await writeBeatFile(rootPath, newFileName, content);
  if (oldFileName && oldFileName !== newFileName) {
    await deleteBeatFile(rootPath, oldFileName);
  }
}
