import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import { migrateIssuesLayoutV3IfNeeded } from "../src/issueMigration";
import { SafeFileSystem } from "../src/safeFileSystem";

/**
 * D-01–D-03: legacy `.leanquill/open-questions/*.md` → `.leanquill/issues/question/*.md`,
 * idempotent marker (e.g. `.leanquill/issues/.migration-v3.json`) so a second run is a no-op.
 * Phase 08-01 only asserts stub `{ ran: false }`; filesystem assertions below are documented for 08-02.
 */

test("migrateIssuesLayoutV3IfNeeded stub: legacy .leanquill/open-questions present but ran false", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "lq-mig-"));
  const legacyDir = path.join(root, ".leanquill", "open-questions");
  await fs.mkdir(legacyDir, { recursive: true });
  const minimal = [
    "---",
    "id: foo",
    "type: author-note",
    "status: open",
    "title: Q",
    "created_at: 2026-01-01T00:00:00.000Z",
    "---",
    "",
  ].join("\n");
  await fs.writeFile(path.join(legacyDir, "foo.md"), minimal, "utf8");

  const safeFs = new SafeFileSystem(root);
  const first = await migrateIssuesLayoutV3IfNeeded(root, safeFs);
  assert.deepEqual(first, { ran: false });

  // Post-08-02: expect `foo.md` under `.leanquill/issues/question/`, legacy dir removed or empty,
  // marker file written. Second call: idempotent — `{ ran: false }` and no duplicate moves.
  const second = await migrateIssuesLayoutV3IfNeeded(root, safeFs);
  assert.deepEqual(second, { ran: false });

  // Conflict case (08-02): legacy `open-questions/same.md` and pre-existing
  // `.leanquill/issues/question/same.md` — planner must define merge/rename behavior.
});
