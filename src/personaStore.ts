import * as fs from "node:fs/promises";
import * as path from "node:path";
import { parseActivePersonas, readProjectYamlRaw } from "./projectConfig";
import type {
  ActivePersonaEntry,
  PersonaContextAccess,
  PersonaExpertise,
  PersonaFeedback,
  PersonaRecord,
  PersonaType,
} from "./types";

const PERSONA_TYPES: ReadonlySet<string> = new Set([
  "beta-reader",
  "expert-reviewer",
  "copy-editor",
  "continuity-checker",
]);

export type LoadPersonaFileResult =
  | { ok: true; markdown: string }
  | { ok: false; reason: string };

export async function loadPersonaFile(rootPath: string, personaId: string): Promise<LoadPersonaFileResult> {
  const target = path.join(rootPath, ".leanquill", "personas", `${personaId}.md`);
  try {
    const markdown = await fs.readFile(target, "utf8");
    return { ok: true, markdown };
  } catch {
    return { ok: false, reason: `persona file not found: ${personaId}` };
  }
}

export type PersonaValidateResult =
  | { ok: true; persona: PersonaRecord; softWarnings: string[] }
  | { ok: false; reason: string };

type ScalarMap = Record<string, string>;
type BlockMap = Record<string, string>;

function splitTopLevelFrontmatter(fm: string): { scalars: ScalarMap; blocks: BlockMap } {
  const lines = fm.replace(/\r\n/g, "\n").split("\n");
  const scalars: ScalarMap = {};
  const blocks: BlockMap = {};
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    if (/^\s/.test(line)) {
      i++;
      continue;
    }
    const top = /^([a-zA-Z0-9_]+):\s*(.*)$/.exec(line);
    if (!top) {
      i++;
      continue;
    }
    const key = top[1];
    const rest = top[2].trimEnd();
    if (rest === "" || rest === "|" || rest === "|-" || rest === ">") {
      i++;
      const sub: string[] = [];
      while (i < lines.length) {
        const L = lines[i];
        if (L.length > 0 && !/^\s/.test(L)) {
          break;
        }
        sub.push(L);
        i++;
      }
      blocks[key] = sub.join("\n");
      continue;
    }
    scalars[key] = rest.replace(/^['"]|['"]$/g, "");
    i++;
  }
  return { scalars, blocks };
}

function parseIndentedBlock(block: string): Map<string, string | boolean | string[]> {
  const map = new Map<string, string | boolean | string[]>();
  const lines = block.replace(/\r\n/g, "\n").split("\n");
  let currentListKey: string | null = null;
  let list: string[] = [];
  const flushList = () => {
    if (currentListKey !== null) {
      map.set(currentListKey, list);
    }
    currentListKey = null;
    list = [];
  };
  for (const raw of lines) {
    if (!raw.trim()) {
      continue;
    }
    const mList = /^  - (.+)$/.exec(raw);
    if (mList && currentListKey !== null) {
      list.push(mList[1].trim().replace(/^['"]|['"]$/g, ""));
      continue;
    }
    flushList();
    const m = /^  ([a-zA-Z0-9_]+):\s*(.*)$/.exec(raw);
    if (!m) {
      continue;
    }
    const k = m[1];
    const v = m[2].trim();
    if (v === "") {
      currentListKey = k;
      list = [];
    } else if (v === "true" || v === "false") {
      map.set(k, v === "true");
    } else {
      map.set(k, v.replace(/^['"]|['"]$/g, ""));
    }
  }
  flushList();
  return map;
}

function clamp01(n: number, label: string, fileLabel: string, soft: string[]): number {
  if (Number.isNaN(n)) {
    soft.push(`${fileLabel}: ${label} NaN; using 0`);
    return 0;
  }
  if (n < 0) {
    soft.push(`${fileLabel}: ${label} below 0; clamped`);
    return 0;
  }
  if (n > 1) {
    soft.push(`${fileLabel}: ${label} above 1; clamped`);
    return 1;
  }
  return n;
}

function requireStr(m: Map<string, string | boolean | string[]>, k: string, fileLabel: string): string | null {
  const v = m.get(k);
  if (typeof v !== "string" || v.trim() === "") {
    return null;
  }
  return v;
}

function requireBool(m: Map<string, string | boolean | string[]>, k: string): boolean | null {
  const v = m.get(k);
  if (typeof v !== "boolean") {
    return null;
  }
  return v;
}

function requireStrList(m: Map<string, string | boolean | string[]>, k: string): string[] | null {
  const v = m.get(k);
  if (Array.isArray(v)) {
    return v;
  }
  return null;
}

function buildExpertise(block: string | undefined, fileLabel: string, soft: string[]): PersonaExpertise | null {
  if (!block?.trim()) {
    return null;
  }
  const m = parseIndentedBlock(block);
  const dd = Number(requireStr(m, "domain_depth", fileLabel));
  const gf = Number(requireStr(m, "genre_familiarity", fileLabel));
  const tl = Number(requireStr(m, "technical_literacy", fileLabel));
  const df = requireStrList(m, "domain_focus");
  if (df === null) {
    return null;
  }
  if ([dd, gf, tl].some((x) => Number.isNaN(x))) {
    return null;
  }
  return {
    domain_depth: clamp01(dd, "domain_depth", fileLabel, soft),
    genre_familiarity: clamp01(gf, "genre_familiarity", fileLabel, soft),
    technical_literacy: clamp01(tl, "technical_literacy", fileLabel, soft),
    domain_focus: df,
  };
}

function buildContextAccess(block: string | undefined, fileLabel: string): PersonaContextAccess | null {
  if (!block?.trim()) {
    return null;
  }
  const m = parseIndentedBlock(block);
  const scope = requireStr(m, "scope", fileLabel);
  const ipf = requireBool(m, "include_planning_files");
  const icn = requireBool(m, "include_character_notes");
  const isn = requireBool(m, "include_setting_notes");
  const irn = requireBool(m, "include_research_notes");
  const itl = requireBool(m, "include_timeline");
  if (scope === null || ipf === null || icn === null || isn === null || irn === null || itl === null) {
    return null;
  }
  return {
    scope,
    include_planning_files: ipf,
    include_character_notes: icn,
    include_setting_notes: isn,
    include_research_notes: irn,
    include_timeline: itl,
  };
}

function buildFeedback(block: string | undefined, fileLabel: string): PersonaFeedback | null {
  if (!block?.trim()) {
    return null;
  }
  const m = parseIndentedBlock(block);
  const pf = requireStrList(m, "primary_focus");
  const at = requireStrList(m, "allowed_types");
  const tone = requireStr(m, "tone", fileLabel);
  const mef = requireBool(m, "min_evidence_for_factual");
  const ih = requireBool(m, "interest_heatmap");
  const rqs = requireBool(m, "reader_question_stream");
  if (pf === null || at === null || tone === null || mef === null || ih === null || rqs === null) {
    return null;
  }
  return {
    primary_focus: pf,
    allowed_types: at,
    tone,
    min_evidence_for_factual: mef,
    interest_heatmap: ih,
    reader_question_stream: rqs,
  };
}

function normalizeDescriptionBlock(raw: string): string {
  const lines = raw.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  for (const L of lines) {
    if (L.startsWith("  ")) {
      out.push(L.slice(2));
    } else if (L === "") {
      out.push("");
    } else {
      out.push(L);
    }
  }
  return out.join("\n").replace(/\n+$/, "").trim();
}

/**
 * Hybrid validation (D-12–D-14): hard-fail on missing fence or required keys; clamp numeric expertise 0..1.
 */
export function validatePersonaMarkdown(markdown: string, fileLabel: string): PersonaValidateResult {
  const normalized = markdown.replace(/\r\n/g, "\n");
  const fmMatch = /^---\n([\s\S]*?)\n---/.exec(normalized);
  if (!fmMatch) {
    return { ok: false, reason: `${fileLabel}: missing YAML frontmatter fence (---)` };
  }
  const fm = fmMatch[1];
  const body = normalized.slice(fmMatch[0].length).replace(/^\n/, "");

  const soft: string[] = [];
  const { scalars, blocks } = splitTopLevelFrontmatter(fm);

  const knownTop = new Set([
    "id",
    "name",
    "type",
    "expertise",
    "context_access",
    "feedback",
    "description",
  ]);
  const rawFrontmatterUnknown: Record<string, string> = {};
  for (const [k, v] of Object.entries(scalars)) {
    if (!knownTop.has(k)) {
      rawFrontmatterUnknown[k] = v;
    }
  }

  const id = scalars.id?.trim();
  const name = scalars.name?.trim();
  const typeRaw = scalars.type?.trim();
  if (!id || !name || !typeRaw) {
    return { ok: false, reason: `${fileLabel}: missing required id, name, or type` };
  }
  if (!PERSONA_TYPES.has(typeRaw)) {
    return { ok: false, reason: `${fileLabel}: invalid persona type "${typeRaw}"` };
  }
  const type = typeRaw as PersonaType;

  let description = "";
  if (blocks.description !== undefined) {
    description = normalizeDescriptionBlock(blocks.description);
  } else if (scalars.description !== undefined) {
    description = scalars.description.trim();
  }
  if (!description) {
    return { ok: false, reason: `${fileLabel}: missing description` };
  }

  const expertise = buildExpertise(blocks.expertise, fileLabel, soft);
  const context_access = buildContextAccess(blocks.context_access, fileLabel);
  const feedback = buildFeedback(blocks.feedback, fileLabel);
  if (!expertise || !context_access || !feedback) {
    return { ok: false, reason: `${fileLabel}: missing or invalid expertise, context_access, or feedback block` };
  }

  const persona: PersonaRecord = {
    id,
    name,
    type,
    expertise,
    context_access,
    feedback,
    description,
    body,
  };
  if (Object.keys(rawFrontmatterUnknown).length > 0) {
    persona.rawFrontmatterUnknown = rawFrontmatterUnknown;
  }
  return { ok: true, persona, softWarnings: soft };
}

export interface ResolvePersonasResult {
  personas: PersonaRecord[];
  warnings: string[];
  errors: string[];
}

export async function resolveActivePersonas(
  rootPath: string,
  entries: ActivePersonaEntry[],
): Promise<ResolvePersonasResult> {
  const personas: PersonaRecord[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];

  for (const e of entries) {
    if (!e.enabled) {
      continue;
    }
    const loaded = await loadPersonaFile(rootPath, e.id);
    if (!loaded.ok) {
      warnings.push(`${e.id}: missing or unreadable persona file (${loaded.reason})`);
      continue;
    }
    const label = `.leanquill/personas/${e.id}.md`;
    const v = validatePersonaMarkdown(loaded.markdown, label);
    if (!v.ok) {
      errors.push(v.reason);
      continue;
    }
    warnings.push(...v.softWarnings);
    personas.push(v.persona);
  }

  return { personas, warnings, errors };
}

export async function getEnabledPersonasForProject(rootPath: string): Promise<ResolvePersonasResult> {
  const raw = await readProjectYamlRaw(rootPath);
  const entries = raw ? parseActivePersonas(raw) : [];
  return resolveActivePersonas(rootPath, entries);
}
