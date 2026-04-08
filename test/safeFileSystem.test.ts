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

test("allows writing manuscript/Book.txt", async () => {
  await withTempDir(async (dir) => {
    const safeFs = new SafeFileSystem(dir);
    await safeFs.writeFile(path.join(dir, "manuscript", "Book.txt"), "ch1.md\n");
    const content = await fs.readFile(path.join(dir, "manuscript", "Book.txt"), "utf8");
    assert.equal(content, "ch1.md\n");
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

test("allowPath with extFilter allows .md writes to allowed prefix", async () => {
  await withTempDir(async (dir) => {
    const safeFs = new SafeFileSystem(dir);
    safeFs.allowPath("research/leanquill", ".md");
    assert.equal(safeFs.canWrite(path.join(dir, "research", "leanquill", "topic.md")), true);
  });
});

test("allowPath with extFilter blocks non-.md files", async () => {
  await withTempDir(async (dir) => {
    const safeFs = new SafeFileSystem(dir);
    safeFs.allowPath("research/leanquill", ".md");
    assert.equal(safeFs.canWrite(path.join(dir, "research", "leanquill", "topic.txt")), false);
  });
});

test("allowPath with extFilter allows deep subdirectory .md writes", async () => {
  await withTempDir(async (dir) => {
    const safeFs = new SafeFileSystem(dir);
    safeFs.allowPath("research/leanquill", ".md");
    assert.equal(safeFs.canWrite(path.join(dir, "research", "leanquill", "sub", "deep.md")), true);
  });
});

test("allowPath without extFilter allows any file type", async () => {
  await withTempDir(async (dir) => {
    const safeFs = new SafeFileSystem(dir);
    safeFs.allowPath("research/leanquill");
    assert.equal(safeFs.canWrite(path.join(dir, "research", "leanquill", "anything.txt")), true);
  });
});

test("allowPath mkdir on research folder succeeds (directory has no ext)", async () => {
  await withTempDir(async (dir) => {
    const safeFs = new SafeFileSystem(dir);
    safeFs.allowPath("research/leanquill", ".md");
    await safeFs.mkdir(path.join(dir, "research", "leanquill"));
    const stat = await fs.stat(path.join(dir, "research", "leanquill"));
    assert.ok(stat.isDirectory());
  });
});

test("allowPath writeFile to .md succeeds after allowPath", async () => {
  await withTempDir(async (dir) => {
    const safeFs = new SafeFileSystem(dir);
    safeFs.allowPath("research/leanquill", ".md");
    await safeFs.writeFile(path.join(dir, "research", "leanquill", "test.md"), "# Test");
    const content = await fs.readFile(path.join(dir, "research", "leanquill", "test.md"), "utf8");
    assert.equal(content, "# Test");
  });
});

test("allowPath writeFile to .txt throws when extFilter is .md", async () => {
  await withTempDir(async (dir) => {
    const safeFs = new SafeFileSystem(dir);
    safeFs.allowPath("research/leanquill", ".md");
    await assert.rejects(
      () => safeFs.writeFile(path.join(dir, "research", "leanquill", "test.txt"), "data"),
      /Blocked write outside LeanQuill boundary/,
    );
  });
});

test("allowPath does not affect existing .leanquill and manuscript/Book.txt rules", async () => {
  await withTempDir(async (dir) => {
    const safeFs = new SafeFileSystem(dir);
    safeFs.allowPath("research/leanquill", ".md");
    // Existing allowed paths still work
    await safeFs.writeFile(path.join(dir, ".leanquill", "state.json"), "{}");
    await safeFs.writeFile(path.join(dir, "manuscript", "Book.txt"), "ch1.md\n");
    // Outside allowed areas still blocked
    assert.equal(safeFs.canWrite(path.join(dir, "other", "file.md")), false);
  });
});

test("allowPath with extFilter blocks writeFile to extensionless path (canWrite allows for mkdir only)", async () => {
  await withTempDir(async (dir) => {
    const safeFs = new SafeFileSystem(dir);
    safeFs.allowPath("research/leanquill", ".md");
    // canWrite (default) still allows extensionless (needed by mkdir)
    assert.equal(safeFs.canWrite(path.join(dir, "research", "leanquill")), true);
    // writeFile to an extensionless path in the research folder must be blocked
    await assert.rejects(
      () => safeFs.writeFile(path.join(dir, "research", "leanquill", "noext"), "data"),
      /Blocked write outside LeanQuill boundary/,
    );
  });
});
