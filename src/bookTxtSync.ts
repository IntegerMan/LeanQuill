import * as fs from "node:fs/promises";
import * as path from "node:path";
import { OutlineIndex, OutlineNode } from "./types";

/**
 * Recursively collect file entries from active nodes via depth-first traversal.
 * Nodes with trait "part" emit `part: {title}` when there are multiple
 * active top-level part nodes. All other nodes with a fileName emit
 * the path stripped of the `manuscript/` prefix.
 */
function flattenNodes(nodes: OutlineNode[], emitParts: boolean, lines: string[]): void {
  for (const node of nodes) {
    if (!node.active) {
      continue;
    }

    if (node.traits.includes("part") && emitParts) {
      lines.push(`part: ${node.title}`);
    }

    if (node.fileName) {
      const entry = node.fileName.replace(/^manuscript\//, "");
      lines.push(entry);
    }

    flattenNodes(node.children, emitParts, lines);
  }
}

/**
 * Generate Book.txt content from outline index.
 * Uses LeanPub `part:` format for multi-part books.
 * Only includes active nodes. Depth-first traversal.
 */
export function generateBookTxt(index: OutlineIndex): string {
  const activeTopLevel = index.nodes.filter((n) => n.active);

  if (activeTopLevel.length === 0) {
    return "";
  }

  const multiPart = activeTopLevel.filter((n) => n.traits.includes("part")).length > 1;

  const lines: string[] = [];
  flattenNodes(index.nodes, multiPart, lines);

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
