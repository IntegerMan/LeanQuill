import type { ChapterOrderResult, OutlineIndex, OutlineNode } from "./types";

export interface ChapterPickerOption {
  path: string;
  title: string;
}

function collectManuscriptChapterNodes(nodes: OutlineNode[], acc: Map<string, string>): void {
  for (const node of nodes) {
    const fn = node.fileName.replace(/\\/g, "/").trim();
    if (fn && /^manuscript\/.+\.md$/i.test(fn)) {
      acc.set(fn, node.title || "(untitled)");
    }
    collectManuscriptChapterNodes(node.children, acc);
  }
}

/**
 * Chapter paths eligible for thread/theme linking: outline nodes whose fileName is a non-empty
 * manuscript/*.md path. Order: Book.txt (chapterOrder) first, then remaining by title.
 */
export function buildChapterPickerOptions(
  index: OutlineIndex,
  chapterOrder: ChapterOrderResult,
): ChapterPickerOption[] {
  const map = new Map<string, string>();
  collectManuscriptChapterNodes(index.nodes, map);
  const out: ChapterPickerOption[] = [];
  const seen = new Set<string>();

  for (const p of chapterOrder.chapterPaths) {
    const title = map.get(p);
    if (title !== undefined) {
      out.push({ path: p, title });
      seen.add(p);
    }
  }

  const rest = [...map.keys()].filter((k) => !seen.has(k));
  rest.sort((a, b) => (map.get(a) ?? a).localeCompare(map.get(b) ?? b, undefined, { sensitivity: "base" }));
  for (const p of rest) {
    out.push({ path: p, title: map.get(p)! });
  }

  return out;
}
