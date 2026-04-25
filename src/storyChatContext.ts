export type StoryChatLaunchSource =
  | "general"
  | "issue"
  | "character"
  | "place"
  | "thread"
  | "theme"
  | "research"
  | "chapter"
  | "selection";

export type StoryChatManuscriptScope = "none" | "selection" | "chapter" | "approved-chapter-set";

export interface StoryChatTarget {
  kind: StoryChatLaunchSource;
  label: string;
  id?: string;
  path?: string;
  fileName?: string;
  chapterRef?: string;
  spanHint?: string;
  selectedTextExcerpt?: string;
}

export interface StoryChatMemoryContext {
  id: string;
  topic: string;
  associationLabel: string;
  updatedAt: string;
  path: string;
}

export interface StoryChatContextBundle {
  sessionId: string;
  createdAt: string;
  launchedFrom: StoryChatLaunchSource;
  target?: StoryChatTarget;
  includedPaths: string[];
  excludedPaths: string[];
  activeMemory: StoryChatMemoryContext[];
  manuscriptScope: StoryChatManuscriptScope;
  summary: string;
}

const MAX_EXCERPT = 2000;

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

export function createStoryChatSessionId(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = pad2(now.getMonth() + 1);
  const d = pad2(now.getDate());
  const hh = pad2(now.getHours());
  const mm = pad2(now.getMinutes());
  const ss = pad2(now.getSeconds());
  return `${y}-${m}-${d}-${hh}${mm}${ss}-story-chat`;
}

function normalizePath(p: string): string {
  return p.replaceAll("\\", "/");
}

function uniqueSorted(paths: string[]): string[] {
  const norm = paths.map((p) => normalizePath(p.trim())).filter(Boolean);
  return [...new Set(norm)].sort((a, b) => a.localeCompare(b));
}

function dedupeMemoryById(entries: StoryChatMemoryContext[]): StoryChatMemoryContext[] {
  const byId = new Map<string, StoryChatMemoryContext>();
  for (const e of entries) {
    const normalized: StoryChatMemoryContext = { ...e, path: normalizePath(e.path) };
    byId.set(normalized.id, normalized);
  }
  return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
}

export function buildStoryChatContextSummary(bundle: StoryChatContextBundle): string {
  const lines: string[] = [];
  lines.push(`Launch source: ${bundle.launchedFrom}`);
  if (bundle.target) {
    const t = bundle.target;
    const parts = [t.label, t.id, t.path, t.fileName, t.chapterRef].filter(Boolean);
    lines.push(`Target: ${parts.join(" — ") || "(unspecified)"}`);
  } else {
    lines.push("Target: (none)");
  }
  lines.push(`Included paths: ${bundle.includedPaths.join(", ") || "(none)"}`);
  lines.push(`Excluded paths: ${bundle.excludedPaths.join(", ") || "(none)"}`);
  if (bundle.activeMemory.length === 0) {
    lines.push("Active story memory: (none)");
  } else {
    lines.push("Active story memory:");
    for (const m of bundle.activeMemory) {
      lines.push(`  - ${m.topic} (${m.path}) — ${m.associationLabel}, updated ${m.updatedAt}`);
    }
  }
  lines.push(`Manuscript scope: ${bundle.manuscriptScope}`);
  if (bundle.launchedFrom === "selection" && bundle.target) {
    if (bundle.target.spanHint) {
      lines.push(`Selection span: ${bundle.target.spanHint}`);
    }
    if (bundle.target.selectedTextExcerpt !== undefined) {
      lines.push(`Selected excerpt: ${bundle.target.selectedTextExcerpt}`);
    }
  }
  lines.push(
    "Safety: LeanQuill advises but never authors manuscript prose. Full manuscript context is never automatic.",
  );
  return lines.join("\n");
}

export function buildStoryChatContextBundle(input: {
  launchedFrom: StoryChatLaunchSource;
  target?: StoryChatTarget;
  includedPaths?: string[];
  excludedPaths?: string[];
  activeMemory?: StoryChatMemoryContext[];
  manuscriptScope?: StoryChatManuscriptScope;
  now?: Date;
}): StoryChatContextBundle {
  const now = input.now ?? new Date();
  let manuscriptScope = input.manuscriptScope;
  if (input.launchedFrom === "general" && manuscriptScope === undefined) {
    manuscriptScope = "none";
  }
  if (manuscriptScope === undefined) {
    manuscriptScope = "none";
  }

  let target = input.target;
  if (input.launchedFrom === "selection") {
    const t = input.target;
    if (!t?.chapterRef || !t.spanHint || t.selectedTextExcerpt === undefined) {
      throw new Error("Selection story chat requires target.chapterRef, target.spanHint, and target.selectedTextExcerpt.");
    }
    let excerpt = t.selectedTextExcerpt;
    if (excerpt.length > MAX_EXCERPT) {
      excerpt = excerpt.slice(0, MAX_EXCERPT);
    }
    target = { ...t, selectedTextExcerpt: excerpt };
  }

  let includedPaths = uniqueSorted(input.includedPaths ?? []);
  const excludedPaths = uniqueSorted(input.excludedPaths ?? []);

  if (manuscriptScope === "none") {
    includedPaths = includedPaths.filter((p) => !p.startsWith("manuscript/"));
  }

  const activeMemory = dedupeMemoryById(input.activeMemory ?? []);

  const bundle: StoryChatContextBundle = {
    sessionId: createStoryChatSessionId(now),
    createdAt: now.toISOString(),
    launchedFrom: input.launchedFrom,
    target,
    includedPaths,
    excludedPaths,
    activeMemory,
    manuscriptScope,
    summary: "",
  };
  bundle.summary = buildStoryChatContextSummary(bundle);
  return bundle;
}
