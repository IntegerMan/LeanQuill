import * as fs from "node:fs/promises";
import * as path from "node:path";
import { OutlineNode } from "./types";

/**
 * Convert a title to a kebab-case slug suitable for a filename.
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
 * Generate a unique node filename using a slugified title.
 * If the slug already exists in `existingSlugs`, appends `-2`, `-3`, etc.
 * Returns a path relative to manuscript/ (e.g., `opening-scene.md`).
 */
export function generateNodeFileName(title: string, existingSlugs: Set<string>): string {
  const base = slugify(title);
  let candidate = `${base}.md`;
  if (!existingSlugs.has(candidate)) {
    return candidate;
  }
  let n = 2;
  while (existingSlugs.has(`${base}-${n}.md`)) {
    n++;
  }
  return `${base}-${n}.md`;
}

/**
 * Recursively collect all fileNames currently assigned in the node tree.
 */
export function collectExistingSlugs(nodes: OutlineNode[]): Set<string> {
  const slugs = new Set<string>();
  for (const node of nodes) {
    if (node.fileName) {
      slugs.add(node.fileName);
    }
    for (const s of collectExistingSlugs(node.children)) {
      slugs.add(s);
    }
  }
  return slugs;
}

/**
 * Write a node's content to its manuscript file.
 * Creates the directory if needed.
 */
export async function writeNodeFile(rootPath: string, fileName: string, content: string): Promise<void> {
  const filePath = path.join(rootPath, "manuscript", fileName);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, "utf8");
}

/**
 * Read a node's content from its manuscript file.
 * Returns empty string if the file does not exist.
 */
export async function readNodeFile(rootPath: string, fileName: string): Promise<string> {
  try {
    return await fs.readFile(path.join(rootPath, "manuscript", fileName), "utf8");
  } catch {
    return "";
  }
}

/**
 * Delete a node's manuscript file. Silently ignores missing files.
 */
export async function deleteNodeFile(rootPath: string, fileName: string): Promise<void> {
  try {
    await fs.unlink(path.join(rootPath, "manuscript", fileName));
  } catch {
    // File may not exist — that's fine
  }
}

/**
 * Rename a node's manuscript file. Writes content to the new path and
 * deletes the old one. If the old file doesn't exist, just writes the new one.
 */
export async function renameNodeFile(
  rootPath: string,
  oldFileName: string,
  newFileName: string,
  content: string,
): Promise<void> {
  await writeNodeFile(rootPath, newFileName, content);
  if (oldFileName && oldFileName !== newFileName) {
    await deleteNodeFile(rootPath, oldFileName);
  }
}
