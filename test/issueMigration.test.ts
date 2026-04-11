import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import {
  migrateIssuesLayoutV3IfNeeded,
  MIGRATION_V3_MARKER_FILENAME,
} from "../src/issueMigration";
import { SafeFileSystem } from "../src/safeFileSystem";

/**
 * D-01–D-03: legacy `.leanquill/open-questions/*.md` → `.leanquill/issues/question/*.md`,
 * idempotent marker under `.leanquill/issues/` so a second run is a no-op.
 */

function minimalIssueMd(typeLine: string): string {
  return ["---", "id: foo", typeLine, "status: open", "title: Q", "created_at: 2026-01-01T00:00:00.000Z", "---", ""].join(
    "\n",
  );
}

test("migrateIssuesLayoutV3IfNeeded moves legacy open-questions to issues/question and writes marker", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "lq-mig-"));
  const legacyDir = path.join(root, ".leanquill", "open-questions");
  await fs.mkdir(legacyDir, { recursive: true });
  await fs.writeFile(path.join(legacyDir, "foo.md"), minimalIssueMd("type: author-note"), "utf8");

  const safeFs = new SafeFileSystem(root);
  const first = await migrateIssuesLayoutV3IfNeeded(root, safeFs);
  assert.equal(first.ran, true);

  const dest = path.join(root, ".leanquill", "issues", "question", "foo.md");
  await fs.access(dest);
  const text = await fs.readFile(dest, "utf8");
  assert.match(text, /type:\s*question/);

  const markerPath = path.join(root, ".leanquill", "issues", MIGRATION_V3_MARKER_FILENAME);
  const markerRaw = await fs.readFile(markerPath, "utf8");
  const marker = JSON.parse(markerRaw) as { version: number; completedAt: string };
  assert.equal(marker.version, 3);
  assert.ok(marker.completedAt);

  await assert.rejects(() => fs.access(path.join(legacyDir, "foo.md")));

  const second = await migrateIssuesLayoutV3IfNeeded(root, safeFs);
  assert.equal(second.ran, false);
});

test("migrateIssuesLayoutV3IfNeeded renames on conflict with existing issues/question file", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "lq-mig-"));
  const legacyDir = path.join(root, ".leanquill", "open-questions");
  await fs.mkdir(legacyDir, { recursive: true });
  const issuesQuestion = path.join(root, ".leanquill", "issues", "question");
  await fs.mkdir(issuesQuestion, { recursive: true });
  await fs.writeFile(path.join(issuesQuestion, "same.md"), minimalIssueMd("type: question"), "utf8");
  await fs.writeFile(path.join(legacyDir, "same.md"), minimalIssueMd("type: author-note"), "utf8");

  const safeFs = new SafeFileSystem(root);
  const first = await migrateIssuesLayoutV3IfNeeded(root, safeFs);
  assert.equal(first.ran, true);

  await fs.access(path.join(issuesQuestion, "same-2.md"));
  const moved = await fs.readFile(path.join(issuesQuestion, "same-2.md"), "utf8");
  assert.match(moved, /type:\s*question/);
});

test("migrateIssuesLayoutV3IfNeeded is no-op when legacy dir is absent", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "lq-mig-"));
  await fs.mkdir(path.join(root, ".leanquill"), { recursive: true });
  const safeFs = new SafeFileSystem(root);
  const r = await migrateIssuesLayoutV3IfNeeded(root, safeFs);
  assert.equal(r.ran, false);
  await assert.rejects(() => fs.access(path.join(root, ".leanquill", "issues", MIGRATION_V3_MARKER_FILENAME)));
});
