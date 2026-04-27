import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { OpenQuestionAssociation } from "./types";
import { createOpenQuestion, saveOpenQuestion, type OpenQuestionRecord } from "./openQuestionStore";
import type { SafeFileSystem } from "./safeFileSystem";
import { escapeYamlString, stripYamlQuotes } from "./yamlUtils";

export const LEANQUILL_AI_REVIEW_SESSIONS_DIR = ".leanquill/issues/sessions";

export type AiWorkflowSessionType = "chapter-review" | "story-intelligence-update" | "issue-planning";

export interface AiReviewSessionFinding {
  id: string;
  type: string;
  status: string;
  priority: number;
  title: string;
  createdAt: string;
  source: string;
  chapterRef: string;
  spanHint: string;
  agentProfile: string;
  evidenceLinks: string[];
  confidence: string;
  verifyManually: boolean;
  intentional: boolean;
  intentionalNote: string;
  dismissedReason: string;
  body: string;
}

export interface AiReviewSessionSummary {
  sessionId: string;
  sessionType: AiWorkflowSessionType;
  chapterRef: string;
  personaIds: string[];
  generatedAt: string;
  issueCount: number;
  summary: string;
  findings: AiReviewSessionFinding[];
}

export interface SaveAiReviewSessionStubInput {
  sessionId: string;
  sessionType: AiWorkflowSessionType;
  chapterRef: string;
  personaIds: string[];
  generatedAt: string;
}

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

export function createAiWorkflowSessionId(sessionType: AiWorkflowSessionType, now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = pad2(now.getMonth() + 1);
  const d = pad2(now.getDate());
  const hh = pad2(now.getHours());
  const mm = pad2(now.getMinutes());
  const ss = pad2(now.getSeconds());
  return `${y}-${m}-${d}-${hh}${mm}${ss}-${sessionType}`;
}

function sessionRelPath(sessionId: string): string {
  return `${LEANQUILL_AI_REVIEW_SESSIONS_DIR}/${sessionId}.md`.split("\\").join("/");
}

function findingToYamlBlock(f: AiReviewSessionFinding): string {
  const lines: string[] = [];
  lines.push(`id: ${escapeYamlString(f.id)}`);
  lines.push(`type: ${escapeYamlString(f.type)}`);
  lines.push(`status: ${escapeYamlString(f.status)}`);
  lines.push(`priority: ${f.priority}`);
  lines.push(`title: ${escapeYamlString(f.title)}`);
  lines.push(`created_at: ${escapeYamlString(f.createdAt)}`);
  lines.push(`source: ${escapeYamlString(f.source)}`);
  lines.push(`chapter_ref: ${escapeYamlString(f.chapterRef)}`);
  lines.push(`span_hint: ${escapeYamlString(f.spanHint)}`);
  lines.push(`agent_profile: ${escapeYamlString(f.agentProfile)}`);
  lines.push(`evidence_links: ${escapeYamlString(JSON.stringify(f.evidenceLinks))}`);
  lines.push(`confidence: ${escapeYamlString(f.confidence)}`);
  lines.push(`verify_manually: ${f.verifyManually ? "true" : "false"}`);
  lines.push(`intentional: ${f.intentional ? "true" : "false"}`);
  lines.push(`intentional_note: ${escapeYamlString(f.intentionalNote)}`);
  lines.push(`dismissed_reason: ${escapeYamlString(f.dismissedReason)}`);
  return lines.join("\n");
}

function parseScalarLines(block: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of block.split("\n")) {
    const m = /^([a-zA-Z0-9_]+):\s*(.*)$/.exec(line);
    if (!m) {
      continue;
    }
    out[m[1]] = stripYamlQuotes(m[2].trim());
  }
  return out;
}

export function serializeAiReviewSession(summary: AiReviewSessionSummary): string {
  const lines: string[] = ["---"];
  lines.push(`session_id: ${escapeYamlString(summary.sessionId)}`);
  lines.push(`session_type: ${escapeYamlString(summary.sessionType)}`);
  lines.push(`chapter_ref: ${escapeYamlString(summary.chapterRef)}`);
  lines.push(`persona_ids: ${escapeYamlString(JSON.stringify(summary.personaIds))}`);
  lines.push(`generated_at: ${escapeYamlString(summary.generatedAt)}`);
  lines.push(`issue_count: ${summary.issueCount}`);
  lines.push("---");
  lines.push(summary.summary);
  for (const f of summary.findings) {
    lines.push("");
    lines.push(`### Finding ${f.id}`);
    lines.push("```yaml");
    lines.push(findingToYamlBlock(f));
    lines.push("```");
    if (f.body.trim().length > 0) {
      lines.push(f.body);
    }
  }
  return lines.join("\n");
}

export function parseAiReviewSessionFile(fileName: string, markdown: string): AiReviewSessionSummary {
  const normalized = markdown.replace(/\r\n/g, "\n");
  const fmMatch = /^---\n([\s\S]*?)\n---/.exec(normalized);
  if (!fmMatch) {
    throw new Error(`AI review session ${fileName}: missing frontmatter`);
  }
  const fm = parseScalarLines(fmMatch[1]);
  const afterFm = normalized.slice(fmMatch[0].length).replace(/^\n/, "");
  const personaIds = (() => {
    try {
      const v = JSON.parse(fm.persona_ids || "[]") as unknown;
      return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
    } catch {
      return [];
    }
  })();
  const issueCount = Number.parseInt(fm.issue_count || "0", 10) || 0;
  const findings: AiReviewSessionFinding[] = [];
  const summaryMatch = /^([\s\S]*?)(?=\n### Finding\s|$)/.exec(afterFm);
  const summaryBody = (summaryMatch?.[1] ?? afterFm).trim();
  let rest = afterFm.slice(summaryMatch?.[0].length ?? afterFm.length);
  while (rest.length > 0) {
    const m = /^\n### Finding\s+(\S+)\s*\n```yaml\n([\s\S]*?)\n```/.exec(rest);
    if (!m) {
      break;
    }
    rest = rest.slice(m[0].length);
    const scalars = parseScalarLines(m[2]);
    let evidence: string[] = [];
    try {
      const ev = JSON.parse(scalars.evidence_links || "[]") as unknown;
      evidence = Array.isArray(ev) ? ev.filter((x): x is string => typeof x === "string") : [];
    } catch {
      evidence = [];
    }
    const bodyMatch = /^([\s\S]*?)(?=\n### Finding\s|$)/.exec(rest);
    const body = (bodyMatch?.[1] ?? "").trim();
    rest = rest.slice(bodyMatch?.[0].length ?? 0);
    findings.push({
      id: scalars.id || m[1],
      type: scalars.type || "question",
      status: scalars.status || "open",
      priority: Number.parseInt(scalars.priority || "3", 10) || 3,
      title: scalars.title || "",
      createdAt: scalars.created_at || "",
      source: scalars.source || "",
      chapterRef: scalars.chapter_ref || "",
      spanHint: scalars.span_hint || "",
      agentProfile: scalars.agent_profile || "",
      evidenceLinks: evidence,
      confidence: scalars.confidence || "unrated",
      verifyManually: scalars.verify_manually === "true",
      intentional: scalars.intentional === "true",
      intentionalNote: scalars.intentional_note || "",
      dismissedReason: scalars.dismissed_reason || "",
      body,
    });
  }
  return {
    sessionId: fm.session_id || path.basename(fileName, ".md"),
    sessionType: (fm.session_type as AiWorkflowSessionType) || "chapter-review",
    chapterRef: fm.chapter_ref || "",
    personaIds,
    generatedAt: fm.generated_at || "",
    issueCount,
    summary: summaryBody,
    findings,
  };
}

export async function saveAiReviewSessionStub(
  rootPath: string,
  safeFs: SafeFileSystem,
  input: SaveAiReviewSessionStubInput,
): Promise<string> {
  const rel = sessionRelPath(input.sessionId);
  const abs = path.join(rootPath, ...rel.split("/"));
  const summary: AiReviewSessionSummary = {
    sessionId: input.sessionId,
    sessionType: input.sessionType,
    chapterRef: input.chapterRef,
    personaIds: input.personaIds,
    generatedAt: input.generatedAt,
    issueCount: 0,
    summary: "Session started.",
    findings: [],
  };
  await safeFs.writeFile(abs, serializeAiReviewSession(summary));
  return rel;
}

export async function finalizeAiReviewSession(
  rootPath: string,
  safeFs: SafeFileSystem,
  summary: AiReviewSessionSummary,
): Promise<void> {
  const rel = sessionRelPath(summary.sessionId);
  const abs = path.join(rootPath, ...rel.split("/"));
  await safeFs.writeFile(abs, serializeAiReviewSession(summary));
}

export interface PromoteAiReviewFindingInput {
  sessionIssueFile: string;
  findingId: string;
  issueType: string;
  titleOverride?: string;
}

function associationForFinding(f: AiReviewSessionFinding): OpenQuestionAssociation {
  const chapterRef = f.chapterRef.trim();
  const span = f.spanHint.trim();
  if (chapterRef.startsWith("manuscript/") && span.length > 0) {
    return { kind: "selection", chapterRef, spanHint: span };
  }
  if (chapterRef.startsWith("manuscript/")) {
    return { kind: "chapter", chapterRef };
  }
  return { kind: "book" };
}

export async function promoteAiReviewFindingToIssue(
  rootPath: string,
  safeFs: SafeFileSystem,
  input: PromoteAiReviewFindingInput,
): Promise<OpenQuestionRecord> {
  const norm = input.sessionIssueFile.replace(/\\/g, "/");
  const abs = path.join(rootPath, ...norm.split("/").filter(Boolean));
  const raw = await fs.readFile(abs, "utf8");
  const parsed = parseAiReviewSessionFile(path.basename(input.sessionIssueFile), raw);
  const finding = parsed.findings.find((x) => x.id === input.findingId);
  if (!finding) {
    throw new Error(`Finding not found: ${input.findingId}`);
  }
  const title = (input.titleOverride ?? finding.title).trim() || `Finding ${finding.id}`;
  const record = await createOpenQuestion(safeFs, rootPath, {
    title,
    association: associationForFinding(finding),
    issueType: input.issueType,
  });
  const next: OpenQuestionRecord = {
    ...record,
    body: finding.body,
    issueSource: input.sessionIssueFile.replace(/\\/g, "/"),
    agentProfile: finding.agentProfile || "ai-session",
    confidence: finding.confidence || "unrated",
    verifyManually: finding.verifyManually,
  };
  await saveOpenQuestion(next, rootPath, safeFs);
  return next;
}
