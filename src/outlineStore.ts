import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as crypto from "node:crypto";
import { SafeFileSystem } from "./safeFileSystem";
import { ChapterStatus, OutlineNode, OutlineIndex } from "./types";

const VALID_STATUSES: ChapterStatus[] = [
  "planning",
  "not-started",
  "drafting",
  "draft-complete",
  "editing",
  "review-pending",
  "final",
];

function isChapterStatus(value: unknown): value is ChapterStatus {
  return typeof value === "string" && VALID_STATUSES.includes(value as ChapterStatus);
}

const OUTLINE_FILE = ".leanquill/outline-index.json";

function emptyIndex(): OutlineIndex {
  return {
    schemaVersion: 2,
    nodes: [],
  };
}

function normalizeNode(raw: unknown): OutlineNode {
  if (!raw || typeof raw !== "object") {
    return {
      id: crypto.randomUUID(),
      title: "",
      fileName: "",
      active: true,
      status: "not-started",
      description: "",
      customFields: {},
      traits: [],
      children: [],
    };
  }

  const candidate = raw as Record<string, unknown>;

  // Accept either "title" or legacy "name" field
  const title = typeof candidate.title === "string" ? candidate.title
    : typeof candidate.name === "string" ? candidate.name
    : "";

  return {
    id: typeof candidate.id === "string" && candidate.id.length > 0 ? candidate.id : crypto.randomUUID(),
    title,
    fileName: typeof candidate.fileName === "string" ? candidate.fileName : "",
    active: typeof candidate.active === "boolean" ? candidate.active : true,
    status: isChapterStatus(candidate.status) ? candidate.status : "not-started",
    description: typeof candidate.description === "string" ? candidate.description : "",
    customFields:
      candidate.customFields && typeof candidate.customFields === "object" && !Array.isArray(candidate.customFields)
        ? Object.fromEntries(
            Object.entries(candidate.customFields as Record<string, unknown>)
              .filter(([, v]) => typeof v === "string")
              .map(([k, v]) => [k, v as string]),
          )
        : {},
    traits: Array.isArray(candidate.traits)
      ? (candidate.traits as unknown[]).filter((t): t is string => typeof t === "string")
      : [],
    children: Array.isArray(candidate.children) ? candidate.children.map(normalizeNode) : [],
  };
}

/**
 * Migrate a v1 index (parts→chapters→beats) to v2 (recursive nodes).
 */
function migrateV1ToV2(raw: Record<string, unknown>): OutlineIndex {
  const parts = Array.isArray(raw.parts) ? raw.parts : [];

  const nodes: OutlineNode[] = parts.map((rawPart: unknown) => {
    if (!rawPart || typeof rawPart !== "object") {
      return normalizeNode(rawPart);
    }
    const part = rawPart as Record<string, unknown>;
    const chapters = Array.isArray(part.chapters) ? part.chapters : [];

    const childNodes: OutlineNode[] = chapters.map((rawCh: unknown) => {
      if (!rawCh || typeof rawCh !== "object") {
        return normalizeNode(rawCh);
      }
      const ch = rawCh as Record<string, unknown>;
      const beats = Array.isArray(ch.beats) ? ch.beats : [];

      // Beats become grandchildren
      const beatChildren: OutlineNode[] = beats.map((rawBeat: unknown) => normalizeNode(rawBeat));

      // Chapter node — carries its own fileName, status, etc.
      const chapterNode = normalizeNode(ch);
      chapterNode.children = beatChildren;
      return chapterNode;
    });

    // Part node — has trait "part", carries its children
    const partNode = normalizeNode(part);
    partNode.traits = partNode.traits.includes("part") ? partNode.traits : ["part", ...partNode.traits];
    partNode.children = childNodes;
    return partNode;
  });

  return { schemaVersion: 2, nodes };
}

export function normalizeOutlineIndex(raw: unknown): OutlineIndex {
  if (!raw || typeof raw !== "object") {
    return emptyIndex();
  }

  const candidate = raw as Record<string, unknown>;

  // Detect v1 schema (has "parts" array) and auto-migrate
  if (Array.isArray(candidate.parts)) {
    return migrateV1ToV2(candidate);
  }

  return {
    schemaVersion: 2,
    nodes: Array.isArray(candidate.nodes) ? candidate.nodes.map(normalizeNode) : [],
  };
}

export async function readOutlineIndex(rootPath: string): Promise<OutlineIndex> {
  const filePath = path.join(rootPath, OUTLINE_FILE);
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return normalizeOutlineIndex(JSON.parse(raw));
  } catch {
    return emptyIndex();
  }
}

export async function writeOutlineIndex(
  rootPath: string,
  index: OutlineIndex,
  safeFs: SafeFileSystem,
): Promise<void> {
  const filePath = path.join(rootPath, OUTLINE_FILE);
  await safeFs.writeFile(filePath, JSON.stringify(index, null, 2));
}

function deriveChapterName(filePath: string): string {
  const baseName = path.basename(filePath, path.extname(filePath));
  const withSpaces = baseName.replaceAll(/[-_]+/g, " ").trim();
  if (!withSpaces) {
    return filePath;
  }
  return withSpaces.replaceAll(/\b\w/g, (char) => char.toUpperCase());
}

export function bootstrapOutline(chapterPaths: string[]): OutlineIndex {
  if (chapterPaths.length === 0) {
    return emptyIndex();
  }

  return {
    schemaVersion: 2,
    nodes: [
      {
        id: crypto.randomUUID(),
        title: "Book",
        fileName: "",
        active: true,
        status: "not-started",
        description: "",
        customFields: {},
        traits: ["part"],
        children: chapterPaths.map((filePath) => ({
          id: crypto.randomUUID(),
          title: deriveChapterName(filePath),
          fileName: filePath,
          active: true,
          status: "not-started" as const,
          description: "",
          customFields: {},
          traits: [],
          children: [],
        })),
      },
    ],
  };
}

// --- Recursive helpers ---

export interface FindNodeResult {
  node: OutlineNode;
  parent: OutlineNode | null;
  index: number;
  siblings: OutlineNode[];
}

/**
 * Recursively find a node by ID. Returns the node, its parent, and its
 * index within the parent's children (or top-level nodes array).
 */
export function findNodeById(
  nodes: OutlineNode[],
  id: string,
  parent: OutlineNode | null = null,
): FindNodeResult | undefined {
  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i].id === id) {
      return { node: nodes[i], parent, index: i, siblings: nodes };
    }
    const found = findNodeById(nodes[i].children, id, nodes[i]);
    if (found) {
      return found;
    }
  }
  return undefined;
}

/**
 * Recursively remove a node by ID from the tree.
 * Returns [remainingNodes, removedNode | undefined].
 */
export function removeNodeById(
  nodes: OutlineNode[],
  id: string,
): [OutlineNode[], OutlineNode | undefined] {
  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i].id === id) {
      const removed = nodes.splice(i, 1)[0];
      return [nodes, removed];
    }
    const [, found] = removeNodeById(nodes[i].children, id);
    if (found) {
      return [nodes, found];
    }
  }
  return [nodes, undefined];
}

/**
 * Check if `ancestorId` is an ancestor of `descendantId` in the tree.
 * Used for cycle detection during DnD.
 */
export function isAncestorOf(nodes: OutlineNode[], ancestorId: string, descendantId: string): boolean {
  const found = findNodeById(nodes, ancestorId);
  if (!found) {
    return false;
  }
  return findNodeById(found.node.children, descendantId) !== undefined;
}
