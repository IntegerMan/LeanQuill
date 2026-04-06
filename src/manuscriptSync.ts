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
 * Returns slugs without the `manuscript/` prefix for comparison with generateNodeFileName.
 */
export function collectExistingSlugs(nodes: OutlineNode[]): Set<string> {
  const slugs = new Set<string>();
  for (const node of nodes) {
    if (node.fileName) {
      slugs.add(node.fileName.replace(/^manuscript\//, ""));
    }
    for (const s of collectExistingSlugs(node.children)) {
      slugs.add(s);
    }
  }
  return slugs;
}

