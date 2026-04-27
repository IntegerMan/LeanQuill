import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { SafeFileSystem } from "../src/safeFileSystem";
import {
  createAiWorkflowSessionId,
  finalizeAiReviewSession,
  parseAiReviewSessionFile,
  promoteAiReviewFindingToIssue,
  saveAiReviewSessionStub,
  type AiReviewSessionFinding,
} from "../src/aiReviewSessionStore";

test("createAiWorkflowSessionId uses local padded date/time and session suffix", () => {
  const id = createAiWorkflowSessionId("chapter-review", new Date(2026, 3, 25, 9, 7, 5));
  assert.equal(id, "2026-04-25-090705-chapter-review");
});

test("saveAiReviewSessionStub writes session stub", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "lq-ai-sess-"));
  const safe = new SafeFileSystem(root);
  const sid = "2026-04-25-090705-chapter-review";
  const rel = await saveAiReviewSessionStub(root, safe, {
    sessionId: sid,
    sessionType: "chapter-review",
    chapterRef: "manuscript/ch01.md",
    personaIds: ["p1"],
    generatedAt: "2026-04-25T09:07:05.000Z",
  });
  assert.match(rel, /sessions\/2026-04-25-090705-chapter-review\.md$/);
  const raw = await fs.readFile(path.join(root, ".leanquill", "issues", "sessions", `${sid}.md`), "utf8");
  assert.match(raw, /Session started\./);
  assert.match(raw, /issue_count: 0/);
  assert.match(raw, /session_type:/);
});

test("finalizeAiReviewSession rewrites with findings", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "lq-ai-fin-"));
  const safe = new SafeFileSystem(root);
  const sid = "sess-final";
  await saveAiReviewSessionStub(root, safe, {
    sessionId: sid,
    sessionType: "chapter-review",
    chapterRef: "manuscript/ch01.md",
    personaIds: ["a"],
    generatedAt: "2026-01-01T00:00:00.000Z",
  });
  const f1: AiReviewSessionFinding = {
    id: "f1",
    type: "question",
    status: "open",
    priority: 3,
    title: "T1",
    createdAt: "2026-01-01T00:00:00.000Z",
    source: "",
    chapterRef: "manuscript/ch01.md",
    spanHint: "",
    agentProfile: "copy-editor",
    evidenceLinks: [],
    confidence: "high",
    verifyManually: true,
    intentional: false,
    intentionalNote: "",
    dismissedReason: "",
    body: "Body one",
  };
  const f2: AiReviewSessionFinding = { ...f1, id: "f2", title: "T2", body: "Body two" };
  await finalizeAiReviewSession(root, safe, {
    sessionId: sid,
    sessionType: "chapter-review",
    chapterRef: "manuscript/ch01.md",
    personaIds: ["a"],
    generatedAt: "2026-01-02T00:00:00.000Z",
    issueCount: 2,
    summary: "Done",
    findings: [f1, f2],
  });
  const raw = await fs.readFile(path.join(root, ".leanquill", "issues", "sessions", `${sid}.md`), "utf8");
  assert.match(raw, /### Finding/);
  assert.match(raw, /issue_count: 2/);
  const parsed = parseAiReviewSessionFile(`${sid}.md`, raw);
  assert.equal(parsed.findings.length, 2);
  assert.equal(parsed.findings[0]!.title, "T1");
  assert.equal(parsed.findings[0]!.verifyManually, true);
});

test("parseAiReviewSessionFile round-trips finding fields", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "lq-ai-parse-"));
  const safe = new SafeFileSystem(root);
  const sid = "round-1";
  const finding: AiReviewSessionFinding = {
    id: "fx",
    type: "question",
    status: "open",
    priority: 2,
    title: "Finding title",
    createdAt: "2026-04-01T00:00:00.000Z",
    source: "s",
    chapterRef: "manuscript/ch09.md",
    spanHint: "L1–L2",
    agentProfile: "beta-reader",
    evidenceLinks: ["http://x"],
    confidence: "rated",
    verifyManually: true,
    intentional: false,
    intentionalNote: "",
    dismissedReason: "",
    body: "Finding body text",
  };
  await finalizeAiReviewSession(root, safe, {
    sessionId: sid,
    sessionType: "chapter-review",
    chapterRef: "manuscript/ch09.md",
    personaIds: ["p"],
    generatedAt: "2026-04-01T01:00:00.000Z",
    issueCount: 1,
    summary: "S",
    findings: [finding],
  });
  const raw = await fs.readFile(path.join(root, ".leanquill", "issues", "sessions", `${sid}.md`), "utf8");
  const back = parseAiReviewSessionFile(`${sid}.md`, raw).findings[0]!;
  assert.equal(back.id, finding.id);
  assert.equal(back.type, finding.type);
  assert.equal(back.title, finding.title);
  assert.equal(back.body, finding.body);
  assert.equal(back.spanHint, finding.spanHint);
  assert.equal(back.agentProfile, finding.agentProfile);
  assert.equal(back.confidence, finding.confidence);
  assert.equal(back.verifyManually, finding.verifyManually);
});

test("promoteAiReviewFindingToIssue creates typed issue with provenance", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "lq-ai-prom-"));
  const safe = new SafeFileSystem(root);
  const sid = "prom-s";
  const finding: AiReviewSessionFinding = {
    id: "f99",
    type: "question",
    status: "open",
    priority: 3,
    title: "Promoted",
    createdAt: "2026-01-01T00:00:00.000Z",
    source: "",
    chapterRef: "manuscript/ch01.md",
    spanHint: "",
    agentProfile: "expert-reviewer",
    evidenceLinks: [],
    confidence: "high",
    verifyManually: true,
    intentional: false,
    intentionalNote: "",
    dismissedReason: "",
    body: "Issue body from session",
  };
  await finalizeAiReviewSession(root, safe, {
    sessionId: sid,
    sessionType: "chapter-review",
    chapterRef: "manuscript/ch01.md",
    personaIds: ["p"],
    generatedAt: "2026-01-01T00:00:00.000Z",
    issueCount: 1,
    summary: "S",
    findings: [finding],
  });
  const sessionRel = `.leanquill/issues/sessions/${sid}.md`;
  const created = await promoteAiReviewFindingToIssue(root, safe, {
    sessionIssueFile: sessionRel,
    findingId: "f99",
    issueType: "question",
  });
  assert.ok(created.fileName.startsWith("question/"));
  const disk = await fs.readFile(path.join(root, ".leanquill", "issues", ...created.fileName.split("/")), "utf8");
  assert.match(disk, /Promoted/);
  assert.match(disk, /Issue body from session/);
  assert.match(disk, /sessions\/prom-s\.md/);
});
