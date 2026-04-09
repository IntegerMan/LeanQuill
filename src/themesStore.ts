import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as crypto from "node:crypto";
import type { CentralThemeEntry, ThemesDocument } from "./types";
import type { SafeFileSystem } from "./safeFileSystem";
import { stripYamlQuotes } from "./yamlUtils";

export const THEMES_FILE_NAME = "themes.yaml";

export function defaultThemesDocument(): ThemesDocument {
  return {
    schemaVersion: "1",
    centralQuestion: "",
    bookSynopsis: "",
    bookCustomFields: {},
    centralThemes: [],
  };
}

function yamlScalarValue(raw: string): string {
  return stripYamlQuotes(raw);
}

function readBlockScalar(lines: string[], startIdx: number, baseIndent: number): { value: string; next: number } {
  const linesOut: string[] = [];
  let j = startIdx;
  while (j < lines.length) {
    const line = lines[j];
    if (line.length === 0) {
      linesOut.push("");
      j++;
      continue;
    }
    const indent = line.match(/^(\s*)/)![1].length;
    if (indent <= baseIndent && line.trim() !== "") {
      break;
    }
    if (indent >= baseIndent + 2) {
      linesOut.push(line.slice(baseIndent + 2));
    } else {
      break;
    }
    j++;
  }
  return { value: linesOut.join("\n").replace(/\n+$/, ""), next: j };
}

function parseCentralThemesBlock(lines: string[], startIdx: number): { themes: CentralThemeEntry[]; next: number } {
  const themes: CentralThemeEntry[] = [];
  let i = startIdx;
  while (i < lines.length) {
    const line = lines[i];
    if (line.length > 0 && !/^\s/.test(line)) {
      break;
    }
    if (/^\s*-\s+/.test(line)) {
      const entry: CentralThemeEntry = {
        id: "",
        title: "",
        summary: "",
        notePath: "",
        linkedChapters: [],
      };
      const idSame = /^\s*-\s+id:\s*(.+)$/.exec(line);
      if (idSame) {
        entry.id = yamlScalarValue(idSame[1]);
      }
      i++;
      while (i < lines.length) {
        const l = lines[i];
        if (/^\s{2}-\s+/.test(l)) {
          break;
        }
        if (l.length > 0 && !/^\s/.test(l)) {
          break;
        }
        const field = /^\s{4}([a-z_]+):\s*(.*)$/.exec(l);
        if (!field) {
          i++;
          continue;
        }
        const fk = field[1];
        const fv = field[2].trim();
        if (fk === "linked_chapters") {
          if (fv === "[]") {
            entry.linkedChapters = [];
            i++;
          } else {
            i++;
            while (i < lines.length) {
              const ll = lines[i];
              if (ll.length > 0 && !/^\s/.test(ll)) {
                break;
              }
              if (/^\s{2}-\s+/.test(ll)) {
                break;
              }
              const li = /^\s{6}-\s+(.+)$/.exec(ll);
              if (li) {
                entry.linkedChapters.push(stripYamlQuotes(li[1]).replace(/\\/g, "/"));
                i++;
              } else if (/^\s{4}[a-z_]+:/.test(ll)) {
                break;
              } else {
                i++;
              }
            }
          }
        } else if (fk === "summary" && (fv === "|" || fv === "|-")) {
          const { value, next } = readBlockScalar(lines, i + 1, 4);
          entry.summary = value;
          i = next;
        } else if (fk === "id") {
          entry.id = yamlScalarValue(fv);
          i++;
        } else if (fk === "title") {
          entry.title = yamlScalarValue(fv);
          i++;
        } else if (fk === "summary") {
          entry.summary = yamlScalarValue(fv);
          i++;
        } else if (fk === "note_path") {
          entry.notePath = yamlScalarValue(fv);
          i++;
        } else {
          i++;
        }
      }
      themes.push(entry);
    } else {
      i++;
    }
  }
  return { themes, next: i };
}

/** Hand-rolled subset parser for fixed themes.yaml schema; returns default on failure. */
export function parseThemesYaml(content: string): ThemesDocument {
  const doc = defaultThemesDocument();
  const text = content.replace(/\r\n/g, "\n");
  if (!text.trim()) {
    return doc;
  }

  try {
    const lines = text.split("\n");
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];
      if (!line.trim()) {
        i++;
        continue;
      }

      const top = /^([a-z_]+):\s*(.*)$/.exec(line);
      if (!top || /^\s/.test(line)) {
        i++;
        continue;
      }

      const key = top[1];
      const rest = top[2].trim();

      if (key === "schema_version") {
        doc.schemaVersion = yamlScalarValue(rest) || "1";
        i++;
      } else if (key === "central_question") {
        if (rest === "|" || rest === "|-") {
          const { value, next } = readBlockScalar(lines, i + 1, 0);
          doc.centralQuestion = value;
          i = next;
        } else {
          doc.centralQuestion = yamlScalarValue(rest);
          i++;
        }
      } else if (key === "book_synopsis") {
        if (rest === "|" || rest === "|-") {
          const { value, next } = readBlockScalar(lines, i + 1, 0);
          doc.bookSynopsis = value;
          i = next;
        } else {
          doc.bookSynopsis = yamlScalarValue(rest);
          i++;
        }
      } else if (key === "book_custom_fields") {
        if (rest === "{}") {
          doc.bookCustomFields = {};
          i++;
        } else {
          i++;
          while (i < lines.length) {
            const l = lines[i];
            if (l.length > 0 && !/^\s/.test(l)) {
              break;
            }
            const m = /^\s{2}([a-zA-Z0-9_]+):\s*(.*)$/.exec(l);
            if (m) {
              doc.bookCustomFields[m[1]] = yamlScalarValue(m[2]);
            }
            i++;
          }
        }
      } else if (key === "book_linked_chapters") {
        // Legacy key — skip block (feature removed)
        if (rest === "[]") {
          i++;
        } else {
          i++;
          while (i < lines.length) {
            const l = lines[i];
            if (l.length > 0 && !/^\s/.test(l)) {
              break;
            }
            i++;
          }
        }
      } else if (key === "central_themes") {
        if (rest === "[]") {
          doc.centralThemes = [];
          i++;
        } else {
          i++;
          const { themes, next } = parseCentralThemesBlock(lines, i);
          doc.centralThemes = themes;
          i = next;
        }
      } else {
        i++;
      }
    }

    return doc;
  } catch {
    return defaultThemesDocument();
  }
}

function escapeYamlString(s: string): string {
  if (s === "") {
    return '""';
  }
  if (/[\n:#"'\[\]{}]/.test(s) || s.includes("\\")) {
    return JSON.stringify(s);
  }
  return s;
}

export function serializeThemesYaml(doc: ThemesDocument): string {
  const lines: string[] = [];

  lines.push(`schema_version: ${escapeYamlString(doc.schemaVersion)}`);

  if (doc.centralQuestion.includes("\n")) {
    lines.push("central_question: |");
    for (const ln of doc.centralQuestion.split("\n")) {
      lines.push(`  ${ln}`);
    }
  } else {
    lines.push(`central_question: ${escapeYamlString(doc.centralQuestion)}`);
  }

  if (doc.bookSynopsis.includes("\n")) {
    lines.push("book_synopsis: |");
    for (const ln of doc.bookSynopsis.split("\n")) {
      lines.push(`  ${ln}`);
    }
  } else {
    lines.push(`book_synopsis: ${escapeYamlString(doc.bookSynopsis)}`);
  }

  const bk = Object.keys(doc.bookCustomFields).sort();
  if (bk.length === 0) {
    lines.push("book_custom_fields: {}");
  } else {
    lines.push("book_custom_fields:");
    for (const k of bk) {
      const v = doc.bookCustomFields[k];
      if (v.includes("\n")) {
        lines.push(`  ${k}: |`);
        for (const ln of v.split("\n")) {
          lines.push(`    ${ln}`);
        }
      } else {
        lines.push(`  ${k}: ${escapeYamlString(v)}`);
      }
    }
  }

  if (doc.centralThemes.length === 0) {
    lines.push("central_themes: []");
  } else {
    lines.push("central_themes:");
    for (const t of doc.centralThemes) {
      lines.push(`  - id: ${escapeYamlString(t.id)}`);
      lines.push(`    title: ${escapeYamlString(t.title)}`);
      if (t.summary.includes("\n")) {
        lines.push("    summary: |");
        for (const ln of t.summary.split("\n")) {
          lines.push(`      ${ln}`);
        }
      } else {
        lines.push(`    summary: ${escapeYamlString(t.summary)}`);
      }
      lines.push(`    note_path: ${escapeYamlString(t.notePath)}`);
      if (t.linkedChapters.length === 0) {
        lines.push("    linked_chapters: []");
      } else {
        lines.push("    linked_chapters:");
        for (const p of t.linkedChapters) {
          lines.push(`      - ${p.replace(/\\/g, "/")}`);
        }
      }
    }
  }

  return lines.join("\n") + "\n";
}

export async function readThemesDocument(rootPath: string): Promise<ThemesDocument> {
  const filePath = path.join(rootPath, ".leanquill", THEMES_FILE_NAME);
  try {
    const content = await fs.readFile(filePath, "utf8");
    return parseThemesYaml(content);
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return defaultThemesDocument();
    }
    return defaultThemesDocument();
  }
}

export async function writeThemesDocument(
  rootPath: string,
  doc: ThemesDocument,
  safeFs: SafeFileSystem,
): Promise<void> {
  const filePath = path.join(rootPath, ".leanquill", THEMES_FILE_NAME);
  await safeFs.writeFile(filePath, serializeThemesYaml(doc));
}

export function addCentralThemeEntry(doc: ThemesDocument): { doc: ThemesDocument; newId: string } {
  const newId = crypto.randomUUID();
  const entry: CentralThemeEntry = {
    id: newId,
    title: "",
    summary: "",
    notePath: "",
    linkedChapters: [],
  };
  return {
    doc: {
      ...doc,
      centralThemes: [...doc.centralThemes, entry],
    },
    newId,
  };
}
