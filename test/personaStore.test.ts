import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import { getEnabledPersonasForProject, resolveActivePersonas, validatePersonaMarkdown } from "../src/personaStore";
import { packagedPersonaMarkdown } from "../src/personaDefaults";

async function withTempDir(run: (dir: string) => Promise<void>): Promise<void> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "leanquill-persona-store-"));
  try {
    await run(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

const validMinimalPersona = (id: string, extraTop = ""): string =>
  [
    "---",
    `id: ${id}`,
    `name: 'Test ${id}'`,
    "type: beta-reader",
    "x_custom: hello",
    "expertise:",
    "  domain_depth: 0.5",
    "  genre_familiarity: 0.5",
    "  technical_literacy: 0.5",
    "  domain_focus:",
    "    - pacing",
    "context_access:",
    "  scope: chapter",
    "  include_planning_files: false",
    "  include_character_notes: false",
    "  include_setting_notes: false",
    "  include_research_notes: false",
    "  include_timeline: false",
    "feedback:",
    "  primary_focus:",
    "    - beta-reader",
    "  allowed_types:",
    "    - beta-reader",
    "  tone: neutral",
    "  min_evidence_for_factual: false",
    "  interest_heatmap: false",
    "  reader_question_stream: false",
    "description: 'Short.'",
    extraTop,
    "---",
    "Body line.",
  ].filter(Boolean).join("\n");

test("validatePersonaMarkdown accepts unknown top-level scalar and returns persona", () => {
  const md = validMinimalPersona("p-one");
  const r = validatePersonaMarkdown(md, "t.md");
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.persona.id, "p-one");
    assert.equal(r.persona.rawFrontmatterUnknown?.x_custom, "hello");
  }
});

test("resolveActivePersonas skips enabled:false without reading disk (D-07)", async () => {
  await withTempDir(async (dir) => {
    const lq = path.join(dir, ".leanquill", "personas");
    await fs.mkdir(lq, { recursive: true });
    await fs.writeFile(path.join(lq, "avid-genre-fan.md"), packagedPersonaMarkdown("avid-genre-fan"), "utf8");

    const r = await resolveActivePersonas(dir, [
      { id: "casual-reader", enabled: false },
      { id: "avid-genre-fan", enabled: true },
    ]);
    assert.equal(r.personas.length, 1);
    assert.equal(r.personas[0]!.id, "avid-genre-fan");
    assert.equal(r.warnings.some((w) => w.includes("casual-reader")), false);
  });
});

test("resolveActivePersonas warns when enabled persona file missing", async () => {
  await withTempDir(async (dir) => {
    await fs.mkdir(path.join(dir, ".leanquill", "personas"), { recursive: true });
    const r = await resolveActivePersonas(dir, [{ id: "avid-genre-fan", enabled: true }]);
    assert.equal(r.personas.length, 0);
    const joined = r.warnings.join(" ").toLowerCase();
    assert.match(joined, /avid-genre-fan/);
    assert.match(joined, /missing|not found/);
  });
});

test("resolveActivePersonas skips invalid frontmatter but keeps valid persona (D-14)", async () => {
  await withTempDir(async (dir) => {
    const lq = path.join(dir, ".leanquill", "personas");
    await fs.mkdir(lq, { recursive: true });
    await fs.writeFile(path.join(lq, "bad.md"), "no fence at all\n", "utf8");
    await fs.writeFile(path.join(lq, "good.md"), validMinimalPersona("good"), "utf8");

    const r = await resolveActivePersonas(dir, [
      { id: "bad", enabled: true },
      { id: "good", enabled: true },
    ]);
    assert.equal(r.personas.length, 1);
    assert.equal(r.personas[0]!.id, "good");
    assert.ok(r.errors.length >= 1);
  });
});

test("getEnabledPersonasForProject reads project.yaml active_personas", async () => {
  await withTempDir(async (dir) => {
    const lq = path.join(dir, ".leanquill");
    await fs.mkdir(path.join(lq, "personas"), { recursive: true });
    await fs.writeFile(path.join(lq, "personas", "casual-reader.md"), packagedPersonaMarkdown("casual-reader"), "utf8");
    const yaml = [
      'schema_version: "2"',
      'project_id: "x"',
      'working_title: "X"',
      "genre:",
      '  - "fiction"',
      "folders:",
      "  manuscript: manuscript/",
      "  research: research/leanquill/",
      "active_personas:",
      "  - id: casual-reader",
      "    enabled: true",
    ].join("\n");
    await fs.writeFile(path.join(lq, "project.yaml"), yaml, "utf8");

    const r = await getEnabledPersonasForProject(dir);
    assert.equal(r.personas.length, 1);
    assert.equal(r.personas[0]!.id, "casual-reader");
  });
});

test("resolveActivePersonas collects soft warnings for out-of-range expertise", async () => {
  const md = validMinimalPersona("clamp-me")
    .replace("domain_depth: 0.5", "domain_depth: 2")
    .replace("x_custom: hello\n", "");
  const v = validatePersonaMarkdown(md, "c.md");
  assert.equal(v.ok, true);
  if (v.ok) {
    assert.equal(v.persona.expertise.domain_depth, 1);
    assert.ok(v.softWarnings.some((s) => s.includes("clamp")));
  }
});
