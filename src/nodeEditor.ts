import * as path from "node:path";
import type * as VSCode from "vscode";
import { readOutlineIndex, writeOutlineIndex, findNodeById } from "./outlineStore";
import { SafeFileSystem } from "./safeFileSystem";
import { OutlineNode, OutlineIndex } from "./types";
import { readNodeFile, writeNodeFile } from "./manuscriptSync";

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

  const filePath = path.join(rootPath, "manuscript", node.fileName);

  // Ensure the file exists (create with description if somehow missing)
  const content = await readNodeFile(rootPath, node.fileName);
  if (content === "") {
    await writeNodeFile(rootPath, node.fileName, node.description);
  }

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
  const fsModule = await import("node:fs/promises");
  const content = await fsModule.readFile(filePath, "utf8");

  // Determine fileName from the file path (relative to manuscript/)
  const manuscriptDir = path.join(rootPath, "manuscript");
  const relative = path.relative(manuscriptDir, filePath).replace(/\\/g, "/");

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
