import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import { SafeFileSystem } from "../src/safeFileSystem";

async function withTempDir(run: (dir: string) => Promise<void>): Promise<void> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "leanquill-safefs-"));
  try {
    await run(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

test("allows writes in .leanquill and project.yaml", async () => {
  await withTempDir(async (dir) => {
    const safeFs = new SafeFileSystem(dir);

    await safeFs.writeFile(path.join(dir, ".leanquill", "state.json"), "{}");
    await safeFs.writeFile(path.join(dir, ".leanquill", "project.yaml"), "schema_version: \"1\"\n");

    const state = await fs.readFile(path.join(dir, ".leanquill", "state.json"), "utf8");
    const project = await fs.readFile(path.join(dir, ".leanquill", "project.yaml"), "utf8");

    assert.equal(state, "{}");
    assert.match(project, /schema_version/);
  });
});

test("blocks writes to manuscript paths", async () => {
  await withTempDir(async (dir) => {
    const safeFs = new SafeFileSystem(dir);

    await assert.rejects(
      () => safeFs.writeFile(path.join(dir, "manuscript", "ch1.md"), "draft"),
      /Blocked write outside LeanQuill boundary/,
    );

    await assert.rejects(
      () => safeFs.writeFile(path.join(dir, "project.yaml"), "data"),
      /Blocked write outside LeanQuill boundary/,
    );
  });
});
