import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import {
  parseActivePersonas,
  parseProjectConfig,
  parseProjectIdentity,
  patchProjectIdentityInYaml,
  readProjectConfig,
  validateProjectYamlForSetup,
} from "../src/projectConfig";

async function withTempDir(run: (dir: string) => Promise<void>): Promise<void> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "leanquill-config-"));
  try {
    await run(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

test("parseActivePersonas returns three entries with ids and enabled flags", () => {
  const yaml = [
    "schema_version: '1'",
    "active_personas:",
    "  - id: casual-reader",
    "    enabled: true",
    "  - id: avid-genre-fan",
    "    enabled: false",
    "  - id: copy-editor",
    "    enabled: true",
    "folders:",
    "  research: research/leanquill/",
  ].join("\n");
  const r = parseActivePersonas(yaml);
  assert.equal(r.length, 3);
  assert.deepEqual(r[0], { id: "casual-reader", enabled: true });
  assert.deepEqual(r[1], { id: "avid-genre-fan", enabled: false });
  assert.deepEqual(r[2], { id: "copy-editor", enabled: true });
});

test("parseActivePersonas returns empty when key missing", () => {
  const yaml = 'schema_version: "1"\nfolders:\n  research: r/\n';
  assert.deepEqual(parseActivePersonas(yaml), []);
});

test("parseActivePersonas returns empty for flow-style active_personas: []", () => {
  const yaml = ["schema_version: '1'", "active_personas: []", "folders:", "  research: r/"].join("\n");
  assert.deepEqual(parseActivePersonas(yaml), []);
});

test("parseActivePersonas normalizes CRLF like parseProjectConfig", () => {
  const yaml = [
    "active_personas:",
    "  - id: one",
    "    enabled: true",
    "",
  ].join("\r\n");
  const r = parseActivePersonas(yaml);
  assert.deepEqual(r, [{ id: "one", enabled: true }]);
});

test("parseActivePersonas defaults enabled to false when omitted before next item", () => {
  const yaml = [
    "active_personas:",
    "  - id: no-flag",
    "  - id: with-flag",
    "    enabled: true",
  ].join("\n");
  const r = parseActivePersonas(yaml);
  assert.deepEqual(r, [
    { id: "no-flag", enabled: false },
    { id: "with-flag", enabled: true },
  ]);
});

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
  assert.equal(result.folders.settings, "notes/settings/");
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

test("parseProjectConfig parses threads folder from YAML", () => {
  const content = 'schema_version: "2"\nfolders:\n  research: research/leanquill/\n  threads: notes/threads/\n';
  const result = parseProjectConfig(content);
  assert.equal(result.folders.threads, "notes/threads/");
});

test("parseProjectConfig defaults threads to notes/threads/ when missing", () => {
  const content = 'schema_version: "2"\nfolders:\n  research: research/leanquill/\n';
  const result = parseProjectConfig(content);
  assert.equal(result.folders.threads, "notes/threads/");
});

test("parseProjectConfig parses custom threads folder path", () => {
  const content = 'schema_version: "2"\nfolders:\n  research: research/leanquill/\n  threads: custom/t/\n';
  const result = parseProjectConfig(content);
  assert.equal(result.folders.threads, "custom/t/");
});

test("parseProjectConfig parses settings folder from YAML", () => {
  const content = 'schema_version: "2"\nfolders:\n  research: research/leanquill/\n  settings: notes/settings/\n';
  const result = parseProjectConfig(content);
  assert.equal(result.folders.settings, "notes/settings/");
});

test("parseProjectConfig defaults settings to notes/settings/ when missing", () => {
  const content = 'schema_version: "2"\nfolders:\n  research: research/leanquill/\n';
  const result = parseProjectConfig(content);
  assert.equal(result.folders.settings, "notes/settings/");
});

test("parseProjectConfig parses custom settings folder path", () => {
  const content = 'schema_version: "2"\nfolders:\n  research: research/leanquill/\n  settings: custom/places/\n';
  const result = parseProjectConfig(content);
  assert.equal(result.folders.settings, "custom/places/");
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

test("validateProjectYamlForSetup not ok when schema_version missing", () => {
  const content = minimalValidSetupYaml.replace(/^schema_version:.*\n/m, "");
  const v = validateProjectYamlForSetup(content);
  assert.equal(v.ok, false);
  assert.equal(v.reason, "missing_schema_version");
});

test("parseProjectIdentity reads working_title and genre list", () => {
  const yaml = [
    'schema_version: "2"',
    "project_id: my-book",
    "working_title: 'My Novel'",
    "genre:",
    '  - "mystery"',
    "  - thriller",
    "folders:",
    "  manuscript: manuscript/",
  ].join("\n");
  const id = parseProjectIdentity(yaml);
  assert.equal(id.workingTitle, "My Novel");
  assert.deepEqual(id.genres, ["mystery", "thriller"]);
});

test("patchProjectIdentityInYaml updates title and replaces genre block", () => {
  const yaml = [
    'schema_version: "2"',
    "working_title: Old",
    "genre:",
    "  - fiction",
    "folders:",
    "  manuscript: manuscript/",
  ].join("\n");
  const next = patchProjectIdentityInYaml(yaml, {
    workingTitle: "New Title",
    genres: ["noir", "crime"],
  });
  assert.match(next, /working_title:.*New Title/);
  assert.match(next, /noir/);
  assert.match(next, /crime/);
  assert.match(next, /manuscript: manuscript\//);
});
