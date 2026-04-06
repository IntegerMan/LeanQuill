import { OutlineNode, OutlineIndex } from "./types";

// --- Node types ---

export interface OutlineDataNode {
  kind: "node";
  data: OutlineNode;
  parentId: string | null;
  depth: number;
}

export type OutlineTreeNode = OutlineDataNode | OutlineOrphanGroupNode | OutlineOrphanNode;

// --- Orphan (Not Included) node types ---

export interface OutlineOrphanGroupNode {
  kind: "orphanGroup";
  data: { fileNames: string[] };
}

export interface OutlineOrphanNode {
  kind: "orphan";
  data: { fileName: string };
}

// --- Pure tree builder ---

export function buildOutlineTree(index: OutlineIndex): OutlineDataNode[] {
  return index.nodes.map((node) => ({
    kind: "node" as const,
    data: node,
    parentId: null,
    depth: 0,
  }));
}
