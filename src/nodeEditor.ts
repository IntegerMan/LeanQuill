import * as path from "node:path";
import type * as VSCode from "vscode";
import { readOutlineIndex, writeOutlineIndex, findNodeById } from "./outlineStore";
import { SafeFileSystem } from "./safeFileSystem";
import { OutlineNode, OutlineIndex } from "./types";

export async function openNodeInEditor(
  vscodeApi: typeof VSCode,
  rootPath: string,
  nodeId: string,
  _safeFs: SafeFileSystem,
): Promise<void> {
  const index = await readOutlineIndex(rootPath);
  const found = findNodeById(index.nodes, nodeId);
  if (!found) {
    await vscodeApi.window.showWarningMessage(`Node not found: ${nodeId}`);
    return;
  }

  const node = found.node;
  if (!node.fileName) {
    await vscodeApi.window.showWarningMessage(`Node has no manuscript file: ${node.title}`);
    return;
  }

  const filePath = path.join(rootPath, node.fileName);

  await vscodeApi.window.showTextDocument(vscodeApi.Uri.file(filePath), {
    viewColumn: vscodeApi.ViewColumn.Beside,
    preview: false,
  });
}

export async function syncNodeFromFile(
  rootPath: string,
  filePath: string,
  safeFs: SafeFileSystem,
): Promise<boolean> {
  // Determine fileName from the file path (relative to rootPath, including manuscript/ prefix)
  const relative = path.relative(rootPath, filePath).replace(/\\/g, "/");

  // Skip syncing for full manuscript chapter files (directly under manuscript/).
  // Only sync beat files (e.g., files in .leanquill/beats/) to avoid bloating
  // outline-index.json with entire chapter contents.
  if (relative.startsWith("manuscript/") && !relative.includes("/", "manuscript/".length)) {
    return false;
  }

  const fsModule = await import("node:fs/promises");
  const content = await fsModule.readFile(filePath, "utf8");

  const index = await readOutlineIndex(rootPath);

  // Recursive search for node with matching fileName
  function findByFileName(nodes: OutlineNode[]): OutlineNode | undefined {
    for (const node of nodes) {
      if (node.fileName === relative) {
        return node;
      }
      const found = findByFileName(node.children);
      if (found) {
        return found;
      }
    }
    return undefined;
  }

  const node = findByFileName(index.nodes);
  if (!node) {
    return false;
  }

  node.description = content;
  await writeOutlineIndex(rootPath, index, safeFs);
  return true;
}
