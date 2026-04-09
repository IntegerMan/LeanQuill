import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { SafeFileSystem } from "./safeFileSystem";

/** First-line placeholder for a new default chapter (D-12). */
const PLACEHOLDER_CHAPTER_BODY =
  "# Chapter 1\n\nYour chapter starts here — replace this stub with your own writing.\n";

export type LeanpubScaffoldStatus = "noop" | "success" | "blocked";

export interface LeanpubScaffoldResult {
  status: LeanpubScaffoldStatus;
  created: string[];
  skipped: string[];
  message: string;
}

export interface ApplyLeanpubManuscriptScaffoldOptions {
  /** When set, `manuscript/Book.txt` is written only via this instance (D-05 / SafeFileSystem boundary). */
  safeFs?: SafeFileSystem;
}

/**
 * Scan `manuscriptDir` for a `.md` file whose basename is `ch1` case-insensitively (D-09/D-10).
 * Returns the actual on-disk filename (e.g. `Ch1.md`) or null.
 */
export async function findDefaultChapterBasename(manuscriptDir: string): Promise<string | null> {
  try {
    const entries = await fs.readdir(manuscriptDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile()) {
        continue;
      }
      const name = entry.name;
      if (!name.toLowerCase().endsWith(".md")) {
        continue;
      }
      const base = name.slice(0, -".md".length);
      if (base.localeCompare("ch1", undefined, { sensitivity: "base" }) === 0) {
        return name;
      }
    }
  } catch {
    return null;
  }
  return null;
}

/** Returns line array or null if the file is missing. */
export async function readBookTxtLinesIfExists(bookTxtPath: string): Promise<string[] | null> {
  try {
    const raw = await fs.readFile(bookTxtPath, "utf8");
    return raw.split(/\r?\n/);
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    if (err.code === "ENOENT") {
      return null;
    }
    throw e;
  }
}

/**
 * Whether `Book.txt` lists `basename` on an active line (same rules as `resolveChapterOrder`:
 * trim; ignore empty, `#`, and `part:` lines). Paths are compared with `/` normalization.
 */
export function chapterListedInBookTxt(rawLines: string[], basename: string): boolean {
  const normalizedBasename = basename.split("\\").join("/");
  for (const line of rawLines) {
    const t = line.trim();
    if (t.length === 0 || t.startsWith("#") || t.startsWith("part:")) {
      continue;
    }
    const rel = t.split("\\").join("/");
    if (rel === normalizedBasename) {
      return true;
    }
  }
  return false;
}

function assertResolvedPathUnderManuscript(manuscriptDir: string, absTarget: string): void {
  const manuscriptResolved = path.resolve(manuscriptDir);
  const targetResolved = path.resolve(absTarget);
  const rel = path.relative(manuscriptResolved, targetResolved);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error(`Scaffold path escapes manuscript directory: ${absTarget}`);
  }
}

async function writeBookTxt(
  rootPath: string,
  content: string,
  options: ApplyLeanpubManuscriptScaffoldOptions,
): Promise<void> {
  const bookAbs = path.join(rootPath, "manuscript", "Book.txt");
  if (options.safeFs) {
    await options.safeFs.writeFile(bookAbs, content);
    return;
  }
  await fs.mkdir(path.dirname(bookAbs), { recursive: true });
  await fs.writeFile(bookAbs, content, "utf8");
}

async function writeChapterFile(
  manuscriptDir: string,
  basename: string,
  body: string,
  options: ApplyLeanpubManuscriptScaffoldOptions,
): Promise<void> {
  const abs = path.resolve(path.join(manuscriptDir, basename));
  assertResolvedPathUnderManuscript(manuscriptDir, abs);
  if (options.safeFs) {
    await options.safeFs.writeFile(abs, body);
  } else {
    await fs.writeFile(abs, body, "utf8");
  }
}

/**
 * Create-only LeanPub manuscript scaffold (D-07, D-09–D-12).
 *
 * D-18: When `manuscript/Book.txt` already exists, the default chapter file exists on disk, but no
 * active Book.txt line lists that file's basename (exact path segment match after slash normalization),
 * returns `blocked` and performs **no** writes (including no `Book.txt` mutation and no new chapter file).
 *
 * Callers that omit `safeFs` must ensure writes to `manuscript/Book.txt` are allowed by the same
 * rules as `SafeFileSystem` (typically only that path outside `.leanquill/`).
 */
export async function applyLeanpubManuscriptScaffold(
  rootPath: string,
  options: ApplyLeanpubManuscriptScaffoldOptions = {},
): Promise<LeanpubScaffoldResult> {
  const manuscriptDir = path.join(rootPath, "manuscript");
  const bookTxtPath = path.join(manuscriptDir, "Book.txt");
  const bookLines = await readBookTxtLinesIfExists(bookTxtPath);

  if (bookLines !== null) {
    const defaultBasename = await findDefaultChapterBasename(manuscriptDir);
    if (defaultBasename !== null && !chapterListedInBookTxt(bookLines, defaultBasename)) {
      return {
        status: "blocked",
        created: [],
        skipped: [],
        message:
          "Book.txt exists but does not list the default chapter file. Add a line with that file's name (e.g. open Book.txt and add the chapter path) — LeanQuill will not modify an existing Book.txt.",
      };
    }
  }

  await fs.mkdir(manuscriptDir, { recursive: true });

  const created: string[] = [];
  const skipped: string[] = [];

  const defaultBasename = await findDefaultChapterBasename(manuscriptDir);

  if (bookLines !== null) {
    skipped.push("manuscript/Book.txt");
    if (defaultBasename !== null) {
      skipped.push(`manuscript/${defaultBasename}`);
    } else {
      const chapterName = "ch1.md";
      const absChapter = path.resolve(path.join(manuscriptDir, chapterName));
      assertResolvedPathUnderManuscript(manuscriptDir, absChapter);
      try {
        await fs.access(absChapter);
        skipped.push(`manuscript/${chapterName}`);
      } catch {
        await writeChapterFile(manuscriptDir, chapterName, PLACEHOLDER_CHAPTER_BODY, options);
        created.push(`manuscript/${chapterName}`);
      }
    }
    const status: LeanpubScaffoldStatus = created.length > 0 ? "success" : "noop";
    return {
      status,
      created,
      skipped,
      message:
        status === "noop"
          ? "Manuscript scaffold already satisfied; no new files were created."
          : "Created missing default chapter; existing Book.txt was not modified.",
    };
  }

  let bookLineBasename: string;
  if (defaultBasename !== null) {
    bookLineBasename = defaultBasename;
    skipped.push(`manuscript/${defaultBasename}`);
  } else {
    bookLineBasename = "ch1.md";
    await writeChapterFile(manuscriptDir, bookLineBasename, PLACEHOLDER_CHAPTER_BODY, options);
    created.push(`manuscript/${bookLineBasename}`);
  }

  const bookContent = `${bookLineBasename.split("\\").join("/")}\n`;
  await writeBookTxt(rootPath, bookContent, options);
  created.push("manuscript/Book.txt");

  return {
    status: "success",
    created,
    skipped,
    message: "Created manuscript/Book.txt and any missing default chapter file.",
  };
}
