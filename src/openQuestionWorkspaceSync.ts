import * as path from "node:path";
import type { SafeFileSystem } from "./safeFileSystem";
import { readProjectConfigWithDefaults } from "./projectConfig";
import {
  deleteOpenQuestionsForChapterRef,
  deleteOpenQuestionsForEntity,
  patchChapterRefInOpenQuestions,
  patchEntityFileNameInOpenQuestions,
} from "./openQuestionStore";

function relFromRoot(rootPath: string, fsPath: string): string {
  return path.relative(rootPath, fsPath).split(path.sep).join("/");
}

function trimFolder(f: string): string {
  return f.replace(/\/+$/g, "");
}

function underFolder(rel: string, folderYaml: string): boolean {
  const p = trimFolder(folderYaml);
  return rel.startsWith(`${p}/`);
}

/**
 * When workspace files are renamed, keep open-question frontmatter in sync (entity basenames + chapter_ref).
 */
export async function handleOpenQuestionWorkspaceRename(
  rootPath: string,
  safeFs: SafeFileSystem,
  oldFsPath: string,
  newFsPath: string,
): Promise<void> {
  const relOld = relFromRoot(rootPath, oldFsPath);
  const relNew = relFromRoot(rootPath, newFsPath);
  if (!relOld.endsWith(".md") || !relNew.endsWith(".md")) {
    return;
  }

  const pc = await readProjectConfigWithDefaults(rootPath);
  if (underFolder(relOld, pc.folders.characters) && underFolder(relNew, pc.folders.characters)) {
    await patchEntityFileNameInOpenQuestions(rootPath, safeFs, "character", path.basename(relOld), path.basename(relNew));
    return;
  }
  if (underFolder(relOld, pc.folders.settings) && underFolder(relNew, pc.folders.settings)) {
    await patchEntityFileNameInOpenQuestions(rootPath, safeFs, "place", path.basename(relOld), path.basename(relNew));
    return;
  }
  if (underFolder(relOld, pc.folders.threads) && underFolder(relNew, pc.folders.threads)) {
    await patchEntityFileNameInOpenQuestions(rootPath, safeFs, "thread", path.basename(relOld), path.basename(relNew));
    return;
  }
  if (underFolder(relOld, pc.folders.research) && underFolder(relNew, pc.folders.research)) {
    await patchEntityFileNameInOpenQuestions(rootPath, safeFs, "research", path.basename(relOld), path.basename(relNew));
    return;
  }
  if (relOld.startsWith("manuscript/") && relNew.startsWith("manuscript/")) {
    await patchChapterRefInOpenQuestions(rootPath, safeFs, relOld, relNew);
  }
}

/**
 * When a linked workspace file is deleted, remove open questions that pointed at it.
 */
export async function handleOpenQuestionWorkspaceDelete(
  rootPath: string,
  safeFs: SafeFileSystem,
  deletedFsPath: string,
): Promise<void> {
  const rel = relFromRoot(rootPath, deletedFsPath);
  if (!rel.endsWith(".md")) {
    return;
  }

  const pc = await readProjectConfigWithDefaults(rootPath);
  if (underFolder(rel, pc.folders.characters)) {
    await deleteOpenQuestionsForEntity(rootPath, safeFs, "character", path.basename(rel));
    return;
  }
  if (underFolder(rel, pc.folders.settings)) {
    await deleteOpenQuestionsForEntity(rootPath, safeFs, "place", path.basename(rel));
    return;
  }
  if (underFolder(rel, pc.folders.threads)) {
    await deleteOpenQuestionsForEntity(rootPath, safeFs, "thread", path.basename(rel));
    return;
  }
  if (underFolder(rel, pc.folders.research)) {
    await deleteOpenQuestionsForEntity(rootPath, safeFs, "research", path.basename(rel));
    return;
  }
  if (rel.startsWith("manuscript/")) {
    await deleteOpenQuestionsForChapterRef(rootPath, safeFs, rel);
  }
}
