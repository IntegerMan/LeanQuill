import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { SafeFileSystem } from "../src/safeFileSystem";
import {
  appendMetadataActionLogEntry,
  readMetadataActionLog,
  LEANQUILL_METADATA_ACTION_LOG,
} from "../src/metadataActionLog";

test("append and read metadata action log", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "lq-meta-log-"));
  const safe = new SafeFileSystem(root);
  await appendMetadataActionLogEntry(root, safe, {
    timestamp: "2026-01-01T00:00:00.000Z",
    actionId: "a1",
    sourceChatId: "s1",
    operation: "createMemory",
    targetPath: ".leanquill/memory/x.md",
    fieldPath: [],
    status: "applied",
    rationale: "r",
    message: "ok",
  });
  const logPath = path.join(root, ...LEANQUILL_METADATA_ACTION_LOG.split("/"));
  assert.ok(logPath.includes("metadata-actions.jsonl"));
  const rows = await readMetadataActionLog(root);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]!.status, "applied");
});

test("readMetadataActionLog missing file returns empty", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "lq-meta-log2-"));
  const rows = await readMetadataActionLog(root);
  assert.deepEqual(rows, []);
});
