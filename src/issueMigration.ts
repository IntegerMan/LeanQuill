import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { SafeFileSystem } from "./safeFileSystem";

/** Legacy Phase 14 layout (flat markdown per question). */
const LEGACY_OPEN_QUESTIONS_DIR = ".leanquill/open-questions";

/** v3 typed issues root (author + future AI/session issues). */
const LEANQUILL_ISSUES_DIR = ".leanquill/issues";

const QUESTION_TYPE_SLUG = "question";

/** Written under `.leanquill/issues/` after a successful v3 migration (idempotency). */
export const MIGRATION_V3_MARKER_FILENAME = ".migration-v3-complete.json";

function legacyOpenQuestionsAbs(rootPath: string): string {
  return path.join(rootPath, ...LEGACY_OPEN_QUESTIONS_DIR.split("/"));
}

function issuesRootAbs(rootPath: string): string {
  return path.join(rootPath, ...LEANQUILL_ISSUES_DIR.split("/"));
}

function questionDirAbs(rootPath: string): string {
  return path.join(issuesRootAbs(rootPath), QUESTION_TYPE_SLUG);
}

function markerAbs(rootPath: string): string {
  return path.join(issuesRootAbs(rootPath), MIGRATION_V3_MARKER_FILENAME);
}

function rewriteAuthorNoteToQuestion(content: string): string {
  return content.replace(/^type:\s*author-note\s*$/m, "type: question");
}

/**
 * One-time v3 migration: `.leanquill/open-questions/*` → `.leanquill/issues/question/*` (D-01–D-03).
 */
export async function migrateIssuesLayoutV3IfNeeded(
  rootPath: string,
  safeFs: SafeFileSystem,
): Promise<{ ran: boolean }> {
  try {
    await fs.access(markerAbs(rootPath));
    return { ran: false };
  } catch {
    // marker missing — may need migration
  }

  const legacyDir = legacyOpenQuestionsAbs(rootPath);
  let legacyIsDir = false;
  try {
    const st = await fs.stat(legacyDir);
    legacyIsDir = st.isDirectory();
  } catch {
    legacyIsDir = false;
  }

  if (!legacyIsDir) {
    return { ran: false };
  }

  await safeFs.mkdir(questionDirAbs(rootPath));

  const names = (await fs.readdir(legacyDir)).filter((n) => n.endsWith(".md"));
  for (const name of names) {
    const src = path.join(legacyDir, name);
    let destName = name;
    let dest = path.join(questionDirAbs(rootPath), destName);

    try {
      await fs.access(dest);
      const base = path.basename(name, ".md");
      let n = 2;
      while (true) {
        destName = `${base}-${n}.md`;
        dest = path.join(questionDirAbs(rootPath), destName);
        try {
          await fs.access(dest);
          n++;
        } catch {
          break;
        }
      }
      console.warn(
        `[LeanQuill] migrateIssuesLayoutV3: conflict for "${name}" — writing as issues/question/${destName}`,
      );
    } catch {
      // no conflict at initial dest
    }

    const raw = await fs.readFile(src, "utf8");
    const next = rewriteAuthorNoteToQuestion(raw);
    await safeFs.writeFile(dest, next);
    await fs.unlink(src);
  }

  try {
    const remaining = await fs.readdir(legacyDir);
    if (remaining.length === 0) {
      await fs.rmdir(legacyDir);
    }
  } catch {
    // ignore
  }

  const completedAt = new Date().toISOString();
  await safeFs.writeFile(markerAbs(rootPath), `${JSON.stringify({ completedAt, version: 3 }, null, 2)}\n`);

  return { ran: true };
}
