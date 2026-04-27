import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import { ensureLeanquillDefaultPersonas } from "../src/personaDefaults";
import { validateProjectYamlForSetup } from "../src/projectConfig";

async function withTempDir(run: (dir: string) => Promise<void>): Promise<void> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "leanquill-personas-"));
  try {
    await run(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

const minimalValidSetupYaml = [
  'schema_version: "2"',
  'project_id: "my-book"',
  'working_title: "My Book"',
  "genre:",
  '  - "fiction"',
  "folders:",
  "  manuscript: manuscript/",
  "  research: research/leanquill/",
].join("\n");

test("ensureLeanquillDefaultPersonas writes three packaged persona files under .leanquill/personas", async () => {
  assert.equal(validateProjectYamlForSetup(minimalValidSetupYaml).ok, true);
  await withTempDir(async (dir) => {
    const lq = path.join(dir, ".leanquill");
    await fs.mkdir(lq, { recursive: true });
    await fs.writeFile(path.join(lq, "project.yaml"), minimalValidSetupYaml, "utf8");

    await ensureLeanquillDefaultPersonas(dir);

    const personasDir = path.join(lq, "personas");
    for (const id of ["casual-reader", "avid-genre-fan", "copy-editor"]) {
      await fs.access(path.join(personasDir, `${id}.md`));
    }
  });
});

test("ensureLeanquillDefaultPersonas skips existing files and repeat calls keep custom bytes", async () => {
  await withTempDir(async (dir) => {
    const lq = path.join(dir, ".leanquill");
    await fs.mkdir(lq, { recursive: true });
    await fs.writeFile(path.join(lq, "project.yaml"), minimalValidSetupYaml, "utf8");
    await fs.mkdir(path.join(lq, "personas"), { recursive: true });
    const custom = "---\nid: avid-genre-fan\ncustom: true\n---\nbody\n";
    await fs.writeFile(path.join(lq, "personas", "avid-genre-fan.md"), custom, "utf8");

    await ensureLeanquillDefaultPersonas(dir);

    const kept = await fs.readFile(path.join(lq, "personas", "avid-genre-fan.md"), "utf8");
    assert.equal(kept, custom);

    await ensureLeanquillDefaultPersonas(dir);
    const kept2 = await fs.readFile(path.join(lq, "personas", "avid-genre-fan.md"), "utf8");
    assert.equal(kept2, custom);

    const casual = await fs.readFile(path.join(lq, "personas", "casual-reader.md"), "utf8");
    assert.match(casual, /genre_familiarity: 0\.35/);
  });
});
