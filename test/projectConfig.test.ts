import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import { parseProjectConfig, readProjectConfig, validateProjectYamlForSetup } from "../src/projectConfig";

async function withTempDir(run: (dir: string) => Promise<void>): Promise<void> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "leanquill-config-"));
  try {
    await run(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

test("parseProjectConfig extracts schemaVersion v1", () => {
  const content = 'schema_version: "1"\nfolders:\n  research: notes/research/\n';
  const result = parseProjectConfig(content);
  assert.equal(result.schemaVersion, "1");
  assert.equal(result.folders.research, "notes/research/");
});

test("parseProjectConfig extracts schemaVersion v2", () => {
  const content = 'schema_version: "2"\nfolders:\n  research: research/leanquill/\n';
  const result = parseProjectConfig(content);
  assert.equal(result.schemaVersion, "2");
  assert.equal(result.folders.research, "research/leanquill/");
});

test("parseProjectConfig defaults schemaVersion to 1 when missing", () => {
  const content = "folders:\n  research: notes/research/\n";
  const result = parseProjectConfig(content);
  assert.equal(result.schemaVersion, "1");
});

test("parseProjectConfig defaults folders.research when missing", () => {
  const content = 'schema_version: "2"\nfolders:\n  manuscript: manuscript/\n';
  const result = parseProjectConfig(content);
  assert.equal(result.folders.research, "research/leanquill/");
});

test("parseProjectConfig returns all defaults for empty string", () => {
  const result = parseProjectConfig("");
  assert.equal(result.schemaVersion, "1");
  assert.equal(result.folders.research, "research/leanquill/");
});

test("parseProjectConfig handles quoted values", () => {
  const content = "schema_version: '2'\nfolders:\n  research: 'my/research/'\n";
  const result = parseProjectConfig(content);
  assert.equal(result.schemaVersion, "2");
  assert.equal(result.folders.research, "my/research/");
});

test("parseProjectConfig handles folders block with many entries", () => {
  const content = [
    'schema_version: "2"',
    "folders:",
    "  manuscript: manuscript/",
    "  characters: notes/characters/",
    "  settings: notes/settings/",
    "  timeline: notes/timeline/",
    "  research: research/leanquill/",
    "  tool_state: .leanquill/",
  ].join("\n");
  const result = parseProjectConfig(content);
  assert.equal(result.folders.research, "research/leanquill/");
});

test("readProjectConfig returns parsed config when project.yaml exists", async () => {
  await withTempDir(async (dir) => {
    const leanquillDir = path.join(dir, ".leanquill");
    await fs.mkdir(leanquillDir, { recursive: true });
    await fs.writeFile(
      path.join(leanquillDir, "project.yaml"),
      'schema_version: "2"\nfolders:\n  research: research/leanquill/\n',
      "utf8",
    );
    const result = await readProjectConfig(dir);
    assert.notEqual(result, null);
    assert.equal(result!.schemaVersion, "2");
    assert.equal(result!.folders.research, "research/leanquill/");
  });
});

test("readProjectConfig returns null when project.yaml does not exist", async () => {
  await withTempDir(async (dir) => {
    const result = await readProjectConfig(dir);
    assert.equal(result, null);
  });
});

test("parseProjectConfig handles CRLF line endings in schema_version", () => {
  const content = 'schema_version: "2"\r\nfolders:\r\n  research: research/leanquill/\r\n';
  const result = parseProjectConfig(content);
  assert.equal(result.schemaVersion, "2");
  assert.equal(result.folders.research, "research/leanquill/");
});

test("parseProjectConfig handles CRLF line endings in folders block", () => {
  const content = [
    'schema_version: "2"',
    "folders:",
    "  manuscript: manuscript/",
    "  research: custom/research/",
  ].join("\r\n") + "\r\n";
  const result = parseProjectConfig(content);
  assert.equal(result.folders.research, "custom/research/");
});

test("parseProjectConfig parses characters folder from YAML", () => {
  const content = 'schema_version: "2"\nfolders:\n  research: research/leanquill/\n  characters: notes/characters/\n';
  const result = parseProjectConfig(content);
  assert.equal(result.folders.characters, "notes/characters/");
});

test("parseProjectConfig defaults characters to notes/characters/ when missing", () => {
  const content = 'schema_version: "2"\nfolders:\n  research: research/leanquill/\n';
  const result = parseProjectConfig(content);
  assert.equal(result.folders.characters, "notes/characters/");
});

test("parseProjectConfig parses custom characters folder path", () => {
  const content = 'schema_version: "2"\nfolders:\n  research: research/leanquill/\n  characters: custom/chars/\n';
  const result = parseProjectConfig(content);
  assert.equal(result.folders.characters, "custom/chars/");
});

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

test("validateProjectYamlForSetup ok for minimal valid v2-shaped yaml", () => {
  const v = validateProjectYamlForSetup(minimalValidSetupYaml);
  assert.equal(v.ok, true);
});

test("validateProjectYamlForSetup not ok for empty string", () => {
  const v = validateProjectYamlForSetup("");
  assert.equal(v.ok, false);
});

test("validateProjectYamlForSetup not ok when project_id missing", () => {
  const content = minimalValidSetupYaml.replace(/^project_id:.*\n/m, "");
  const v = validateProjectYamlForSetup(content);
  assert.equal(v.ok, false);
});

test("validateProjectYamlForSetup not ok for schema_version 9", () => {
  const content = minimalValidSetupYaml.replace('schema_version: "2"', 'schema_version: "9"');
  const v = validateProjectYamlForSetup(content);
  assert.equal(v.ok, false);
});
