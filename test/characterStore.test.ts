import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import {
  slugifyCharacterName,
  parseCharacterFile,
  serializeCharacterFile,
  listCharacters,
  createCharacter,
  saveCharacter,
  deleteCharacter,
  scanManuscriptFileForCharacters,
} from "../src/characterStore";
import { SafeFileSystem } from "../src/safeFileSystem";
import { CharacterProfile } from "../src/types";
import { DEFAULT_PROJECT_CONFIG, ProjectConfig } from "../src/projectConfig";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

async function withTempDir(run: (dir: string) => Promise<void>): Promise<void> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "leanquill-chars-"));
  try {
    await run(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

function makeConfig(overrides?: Partial<ProjectConfig["folders"]>): ProjectConfig {
  return {
    schemaVersion: "1",
    folders: { ...DEFAULT_PROJECT_CONFIG.folders, ...overrides },
  };
}

function makeSafeFs(rootPath: string, charsFolder = "notes/characters"): SafeFileSystem {
  const sfs = new SafeFileSystem(rootPath);
  sfs.allowPath(charsFolder, ".md");
  return sfs;
}

function makeProfile(overrides?: Partial<CharacterProfile>): CharacterProfile {
  return {
    fileName: "jane-doe.md",
    name: "Jane Doe",
    aliases: ["Jane"],
    role: "protagonist",
    description: "The hero",
    referencedByNameIn: [],
    customFields: {},
    body: "",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Pure function tests (no filesystem)
// ---------------------------------------------------------------------------

test("slugifyCharacterName converts simple name to kebab-case .md", () => {
  assert.equal(slugifyCharacterName("Jane Doe"), "jane-doe.md");
});

test("slugifyCharacterName handles apostrophes and hyphens", () => {
  assert.equal(slugifyCharacterName("O'Brien-Smith"), "o-brien-smith.md");
});

test("slugifyCharacterName trims whitespace", () => {
  assert.equal(slugifyCharacterName("  Dr. Watson  "), "dr-watson.md");
});

test("slugifyCharacterName falls back to 'character.md' for empty input", () => {
  assert.equal(slugifyCharacterName("   "), "character.md");
});

test("parseCharacterFile extracts all standard fields", () => {
  const content = `---
name: Jane Doe
aliases:
  - Jane
  - JD
role: protagonist
description: The hero
referencedByNameIn:
  - manuscript/ch1.md
---
Some body text.
`;
  const p = parseCharacterFile("jane-doe.md", content);
  assert.equal(p.name, "Jane Doe");
  assert.deepEqual(p.aliases, ["Jane", "JD"]);
  assert.equal(p.role, "protagonist");
  assert.equal(p.description, "The hero");
  assert.deepEqual(p.referencedByNameIn, ["manuscript/ch1.md"]);
  assert.equal(p.body, "Some body text.");
});

test("parseCharacterFile applies defaults for missing fields", () => {
  const p = parseCharacterFile("x.md", "no frontmatter body");
  assert.equal(p.name, "");
  assert.deepEqual(p.aliases, []);
  assert.equal(p.role, "");
  assert.deepEqual(p.referencedByNameIn, []);
  assert.deepEqual(p.customFields, {});
});

test("parseCharacterFile reads custom fields", () => {
  const content = `---
name: Bob
occupation: detective
---
`;
  const p = parseCharacterFile("bob.md", content);
  assert.equal(p.customFields["occupation"], "detective");
});

test("serializeCharacterFile produces valid frontmatter", () => {
  const profile = makeProfile({ aliases: ["Jane"], referencedByNameIn: ["manuscript/ch1.md"] });
  const result = serializeCharacterFile(profile);
  assert.ok(result.startsWith("---\n"), "should start with ---");
  assert.ok(result.includes("name: Jane Doe\n"), "should contain name");
  assert.ok(result.includes("  - Jane\n"), "should list alias");
  assert.ok(result.includes("  - manuscript/ch1.md\n"), "should list reference");
});

test("serializeCharacterFile produces empty-list syntax for empty arrays", () => {
  const profile = makeProfile({ aliases: [], referencedByNameIn: [] });
  const result = serializeCharacterFile(profile);
  assert.ok(result.includes("aliases: []\n"), "empty aliases");
  assert.ok(result.includes("referencedByNameIn: []\n"), "empty refs");
});

test("round-trip: parseCharacterFile(serializeCharacterFile(profile)) === profile", () => {
  const profile = makeProfile({
    aliases: ["Jane", "JD"],
    referencedByNameIn: ["manuscript/ch1.md"],
    customFields: { occupation: "detective" },
    body: "Extended notes here.",
  });
  const serialized = serializeCharacterFile(profile);
  const parsed = parseCharacterFile(profile.fileName, serialized);
  assert.equal(parsed.name, profile.name);
  assert.deepEqual(parsed.aliases, profile.aliases);
  assert.equal(parsed.role, profile.role);
  assert.equal(parsed.description, profile.description);
  assert.deepEqual(parsed.referencedByNameIn, profile.referencedByNameIn);
  assert.deepEqual(parsed.customFields, profile.customFields);
  assert.equal(parsed.body.trim(), profile.body.trim());
});

// ---------------------------------------------------------------------------
// I/O tests
// ---------------------------------------------------------------------------

test("listCharacters returns empty array when folder does not exist", async () => {
  await withTempDir(async (dir) => {
    const config = makeConfig();
    const result = await listCharacters(dir, config);
    assert.deepEqual(result, []);
  });
});

test("listCharacters reads all .md files from chars folder", async () => {
  await withTempDir(async (dir) => {
    const config = makeConfig();
    const charsPath = path.join(dir, "notes", "characters");
    await fs.mkdir(charsPath, { recursive: true });
    const p1 = makeProfile({ fileName: "alice.md", name: "Alice" });
    const p2 = makeProfile({ fileName: "bob.md", name: "Bob" });
    await fs.writeFile(path.join(charsPath, "alice.md"), serializeCharacterFile(p1), "utf8");
    await fs.writeFile(path.join(charsPath, "bob.md"), serializeCharacterFile(p2), "utf8");

    const result = await listCharacters(dir, config);
    assert.equal(result.length, 2);
    assert.equal(result[0].fileName, "alice.md");
    assert.equal(result[1].fileName, "bob.md");
  });
});

test("createCharacter creates file with correct slugified name", async () => {
  await withTempDir(async (dir) => {
    const config = makeConfig();
    const safeFs = makeSafeFs(dir);
    const profile = await createCharacter("Jane Doe", dir, config, safeFs);

    assert.equal(profile.fileName, "jane-doe.md");
    assert.equal(profile.name, "Jane Doe");
    const filePath = path.join(dir, "notes", "characters", "jane-doe.md");
    const exists = await fs.access(filePath).then(() => true).catch(() => false);
    assert.ok(exists, "file should exist on disk");
  });
});

test("createCharacter appends -2 suffix for duplicate name", async () => {
  await withTempDir(async (dir) => {
    const config = makeConfig();
    const safeFs = makeSafeFs(dir);
    await createCharacter("Jane Doe", dir, config, safeFs);
    const second = await createCharacter("Jane Doe", dir, config, safeFs);
    assert.equal(second.fileName, "jane-doe-2.md");
  });
});

test("saveCharacter overwrites file content", async () => {
  await withTempDir(async (dir) => {
    const config = makeConfig();
    const safeFs = makeSafeFs(dir);
    const profile = await createCharacter("Sam", dir, config, safeFs);
    profile.description = "Updated description";
    await saveCharacter(profile, dir, config, safeFs);

    const charsPath = path.join(dir, "notes", "characters");
    const content = await fs.readFile(path.join(charsPath, profile.fileName), "utf8");
    assert.ok(content.includes("Updated description"), "should reflect updated description");
  });
});

test("deleteCharacter removes the file", async () => {
  await withTempDir(async (dir) => {
    const config = makeConfig();
    const safeFs = makeSafeFs(dir);
    const profile = await createCharacter("Dave", dir, config, safeFs);
    await deleteCharacter(profile.fileName, dir, config, safeFs);

    const result = await listCharacters(dir, config);
    assert.deepEqual(result, []);
  });
});

test("scanManuscriptFileForCharacters adds manuscript path when name matches", async () => {
  await withTempDir(async (dir) => {
    const config = makeConfig();
    const safeFs = makeSafeFs(dir);

    // Create character
    await createCharacter("Jane Doe", dir, config, safeFs);

    // Create manuscript file
    const msDir = path.join(dir, "manuscript");
    await fs.mkdir(msDir, { recursive: true });
    const msPath = path.join(msDir, "ch1.md");
    await fs.writeFile(msPath, "Jane Doe stood at the window.", "utf8");

    await scanManuscriptFileForCharacters(msPath, dir, config, safeFs);

    const [updated] = await listCharacters(dir, config);
    assert.ok(
      updated.referencedByNameIn.includes("manuscript/ch1.md"),
      "should include manuscript path",
    );
  });
});

test("scanManuscriptFileForCharacters removes stale entry when name no longer matches", async () => {
  await withTempDir(async (dir) => {
    const config = makeConfig();
    const safeFs = makeSafeFs(dir);

    // Create character already referenced
    const profile = await createCharacter("Jane Doe", dir, config, safeFs);
    profile.referencedByNameIn = ["manuscript/ch1.md"];
    await saveCharacter(profile, dir, config, safeFs);

    // Manuscript file no longer mentions Jane Doe
    const msDir = path.join(dir, "manuscript");
    await fs.mkdir(msDir, { recursive: true });
    const msPath = path.join(msDir, "ch1.md");
    await fs.writeFile(msPath, "This chapter has no character mentions.", "utf8");

    await scanManuscriptFileForCharacters(msPath, dir, config, safeFs);

    const [updated] = await listCharacters(dir, config);
    assert.ok(
      !updated.referencedByNameIn.includes("manuscript/ch1.md"),
      "stale reference should be removed",
    );
  });
});
