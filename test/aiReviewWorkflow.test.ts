import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { SafeFileSystem } from "../src/safeFileSystem";
import {
  buildAiWorkflowFallbackQuery,
  finalizeChapterReviewRun,
  prepareChapterReviewRun,
  prepareStoryIntelligenceRun,
  selectPersonaIdsForScope,
} from "../src/aiReviewWorkflow";
import type { AiReviewSessionFinding } from "../src/aiReviewSessionStore";
import { readStoryChatLogSummaryFromDisk } from "../src/storyChatLogStore";

const personas = [
  { id: "casual-reader", name: "J", type: "beta-reader" },
  { id: "copy-editor", name: "S", type: "copy-editor" },
];

test("selectPersonaIdsForScope all and one", () => {
  assert.deepEqual(selectPersonaIdsForScope(personas, { kind: "all" }), ["casual-reader", "copy-editor"]);
  assert.deepEqual(selectPersonaIdsForScope(personas, { kind: "one", personaId: "copy-editor" }), ["copy-editor"]);
  assert.throws(() => selectPersonaIdsForScope(personas, { kind: "one", personaId: "missing" }), /Persona not enabled/);
});

test("prepareChapterReviewRun creates stubs", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "lq-chrev-"));
  const safe = new SafeFileSystem(root);
  const run = await prepareChapterReviewRun(root, safe, {
    chapterRef: "manuscript/ch01.md",
    personas,
    choice: { kind: "all" },
    now: new Date(2026, 3, 25, 9, 7, 5),
  });
  assert.equal(run.sessionType, "chapter-review");
  assert.equal(run.chapterRef, "manuscript/ch01.md");
  assert.ok(run.sessionIssueFile.includes("sessions"));
  assert.ok(run.chatLogFile.includes(".leanquill/chats"));
  assert.deepEqual(run.personaIds, ["casual-reader", "copy-editor"]);
});

test("prepareStoryIntelligenceRun sets story-intelligence chat stub", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "lq-si-"));
  const safe = new SafeFileSystem(root);
  const run = await prepareStoryIntelligenceRun(root, safe, {
    chapterRef: "manuscript/ch02.md",
    personas,
    choice: { kind: "one", personaId: "casual-reader" },
    now: new Date(2026, 3, 25, 10, 0, 0),
  });
  assert.equal(run.sessionType, "story-intelligence-update");
  const disk = await fs.readFile(path.join(root, ...run.chatLogFile.split("/")), "utf8");
  assert.match(disk, /story-intelligence-update/);
  assert.match(disk, /story_updates_made: false/);
});

test("buildAiWorkflowFallbackQuery chapter review includes safety lines", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "lq-fb-cr-"));
  const safe = new SafeFileSystem(root);
  const run = await prepareChapterReviewRun(root, safe, {
    chapterRef: "manuscript/ch01.md",
    personas,
    choice: { kind: "all" },
  });
  const q = buildAiWorkflowFallbackQuery(run);
  assert.match(q, /Session issue file: \.leanquill\/issues\/sessions\//);
  assert.match(q, /Chat log file: \.leanquill\/chats\//);
  assert.match(q, /Manuscript files are read-only/);
  assert.match(q, /Do not write manuscript files/);
});

test("buildAiWorkflowFallbackQuery story intelligence names MetadataAction", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "lq-fb-si-"));
  const safe = new SafeFileSystem(root);
  const run = await prepareStoryIntelligenceRun(root, safe, {
    chapterRef: "manuscript/ch01.md",
    personas,
    choice: { kind: "all" },
  });
  const q = buildAiWorkflowFallbackQuery(run);
  assert.match(q, /MetadataAction/);
  assert.match(q, /requiresApproval/);
  assert.match(q, /authorApproval/);
  assert.match(q, /Do not apply note changes directly/);
});

test("finalizeChapterReviewRun updates chat log issues_generated", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "lq-fin-cr-"));
  const safe = new SafeFileSystem(root);
  const run = await prepareChapterReviewRun(root, safe, {
    chapterRef: "manuscript/ch01.md",
    personas,
    choice: { kind: "all" },
    now: new Date(2026, 4, 1, 12, 0, 0),
  });
  const f: AiReviewSessionFinding = {
    id: "a",
    type: "question",
    status: "open",
    priority: 3,
    title: "T",
    createdAt: "2026-05-01T00:00:00.000Z",
    source: "",
    chapterRef: "manuscript/ch01.md",
    spanHint: "",
    agentProfile: "p",
    evidenceLinks: [],
    confidence: "unrated",
    verifyManually: false,
    intentional: false,
    intentionalNote: "",
    dismissedReason: "",
    body: "b",
  };
  await finalizeChapterReviewRun(root, safe, {
    sessionId: run.sessionId,
    chapterRef: run.chapterRef,
    personaIds: run.personaIds,
    sessionIssueFile: run.sessionIssueFile,
    summary: "Two findings",
    findings: [f, { ...f, id: "b", title: "T2" }],
  });
  const log = await readStoryChatLogSummaryFromDisk(root, run.chatLogFile);
  assert.equal(log?.issuesGenerated, 2);
  assert.match(log?.summary ?? "", /Two findings/);
});
