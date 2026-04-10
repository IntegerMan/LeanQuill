import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import {
  slugifyPlaceName,
  parsePlaceFile,
  serializePlaceFile,
  listPlaces,
  createPlace,
  savePlace,
  deletePlace,
  scanManuscriptFileForPlaces,
} from "../src/placeStore";
import { SafeFileSystem } from "../src/safeFileSystem";
import { PlaceProfile } from "../src/types";
import { DEFAULT_PROJECT_CONFIG, ProjectConfig } from "../src/projectConfig";

async function withTempDir(run: (dir: string) => Promise<void>): Promise<void> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "leanquill-places-"));
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

function makeSafeFs(rootPath: string, settingsFolder = "notes/settings"): SafeFileSystem {
  const sfs = new SafeFileSystem(rootPath);
  sfs.allowPath(settingsFolder, ".md");
  return sfs;
}

function makePlace(overrides?: Partial<PlaceProfile>): PlaceProfile {
  return {
    fileName: "old-mill.md",
    name: "The Old Mill",
    aliases: ["Mill"],
    category: "landmark",
    region: "North",
    description: "A ruin by the river",
    referencedByNameIn: ["manuscript/ch1.md"],
    referencedInBeats: ["beat-a", "beat-b"],
    customFields: {},
    body: "Notes here.",
    ...overrides,
  };
}

test("slugifyPlaceName converts title to kebab-case .md", () => {
  assert.equal(slugifyPlaceName("The Old Mill"), "the-old-mill.md");
});

test("slugifyPlaceName trims and normalizes punctuation", () => {
  assert.equal(slugifyPlaceName("  O'Brien Hall  "), "o-brien-hall.md");
});

test("slugifyPlaceName falls back to place.md for empty input", () => {
  assert.equal(slugifyPlaceName("   "), "place.md");
});

test("parsePlaceFile extracts standard and reference fields", () => {
  const content = `---
name: The Old Mill
aliases:
  - Mill
category: landmark
region: North
description: Short blurb
referencedByNameIn:
  - manuscript/ch1.md
referencedInBeats:
  - node-1
  - node-2
---
Body line.
`;
  const p = parsePlaceFile("old-mill.md", content);
  assert.equal(p.name, "The Old Mill");
  assert.deepEqual(p.aliases, ["Mill"]);
  assert.equal(p.category, "landmark");
  assert.equal(p.region, "North");
  assert.equal(p.description, "Short blurb");
  assert.deepEqual(p.referencedByNameIn, ["manuscript/ch1.md"]);
  assert.deepEqual(p.referencedInBeats, ["node-1", "node-2"]);
  assert.equal(p.body, "Body line.");
});

test("parsePlaceFile applies defaults when frontmatter missing", () => {
  const p = parsePlaceFile("x.md", "no frontmatter");
  assert.equal(p.name, "");
  assert.deepEqual(p.aliases, []);
  assert.equal(p.category, "");
  assert.equal(p.region, "");
  assert.deepEqual(p.referencedByNameIn, []);
  assert.deepEqual(p.referencedInBeats, []);
  assert.deepEqual(p.customFields, {});
});

test("parsePlaceFile reads custom scalar keys into customFields", () => {
  const content = `---
name: X
climate: rainy
---
`;
  const p = parsePlaceFile("x.md", content);
  assert.equal(p.customFields["climate"], "rainy");
});

test("serializePlaceFile emits referencedInBeats list and empty-array syntax", () => {
  const profile = makePlace({ referencedInBeats: ["a", "b"], referencedByNameIn: [] });
  const out = serializePlaceFile(profile);
  assert.ok(out.includes("referencedInBeats:\n"), "list header");
  assert.ok(out.includes("  - a\n"), "beat a");
  assert.ok(out.includes("  - b\n"), "beat b");
  assert.ok(out.includes("referencedByNameIn: []\n"), "empty refs");
});

test("round-trip parsePlaceFile(serializePlaceFile(p)) preserves logical fields", () => {
  const profile = makePlace({
    aliases: ["Mill", "Ruin"],
    description: "Multi\nline",
    customFields: { climate: "wet" },
    body: "Extended.",
  });
  const serialized = serializePlaceFile(profile);
  const parsed = parsePlaceFile(profile.fileName, serialized);
  assert.equal(parsed.name, profile.name);
  assert.deepEqual(parsed.aliases, profile.aliases);
  assert.equal(parsed.category, profile.category);
  assert.equal(parsed.region, profile.region);
  assert.equal(parsed.description, profile.description);
  assert.deepEqual(parsed.referencedByNameIn, profile.referencedByNameIn);
  assert.deepEqual(parsed.referencedInBeats, profile.referencedInBeats);
  assert.deepEqual(parsed.customFields, profile.customFields);
  assert.equal(parsed.body.trim(), profile.body.trim());
});

test("listPlaces returns empty array when folder does not exist", async () => {
  await withTempDir(async (dir) => {
    const config = makeConfig();
    const result = await listPlaces(dir, config);
    assert.deepEqual(result, []);
  });
});

test("listPlaces reads all .md files from settings folder", async () => {
  await withTempDir(async (dir) => {
    const config = makeConfig();
    const settingsPath = path.join(dir, "notes", "settings");
    await fs.mkdir(settingsPath, { recursive: true });
    const p1 = makePlace({ fileName: "a.md", name: "Alpha" });
    const p2 = makePlace({ fileName: "b.md", name: "Beta" });
    await fs.writeFile(path.join(settingsPath, "a.md"), serializePlaceFile(p1), "utf8");
    await fs.writeFile(path.join(settingsPath, "b.md"), serializePlaceFile(p2), "utf8");

    const result = await listPlaces(dir, config);
    assert.equal(result.length, 2);
    assert.equal(result[0].fileName, "a.md");
    assert.equal(result[1].fileName, "b.md");
  });
});

test("createPlace writes under notes/settings with slugified fileName", async () => {
  await withTempDir(async (dir) => {
    const config = makeConfig();
    const safeFs = makeSafeFs(dir);
    const profile = await createPlace("The Old Mill", dir, config, safeFs);
    assert.equal(profile.fileName, "the-old-mill.md");
    const filePath = path.join(dir, "notes", "settings", "the-old-mill.md");
    assert.ok(await fs.access(filePath).then(() => true).catch(() => false));
  });
});

test("createPlace appends -2 for duplicate display name", async () => {
  await withTempDir(async (dir) => {
    const config = makeConfig();
    const safeFs = makeSafeFs(dir);
    await createPlace("The Old Mill", dir, config, safeFs);
    const second = await createPlace("The Old Mill", dir, config, safeFs);
    assert.equal(second.fileName, "the-old-mill-2.md");
  });
});

test("savePlace overwrites file on disk", async () => {
  await withTempDir(async (dir) => {
    const config = makeConfig();
    const safeFs = makeSafeFs(dir);
    const profile = await createPlace("Ruins", dir, config, safeFs);
    profile.description = "Updated blurb";
    await savePlace(profile, dir, config, safeFs);
    const settingsPath = path.join(dir, "notes", "settings");
    const content = await fs.readFile(path.join(settingsPath, profile.fileName), "utf8");
    assert.ok(content.includes("Updated blurb"));
  });
});

test("deletePlace removes the profile file", async () => {
  await withTempDir(async (dir) => {
    const config = makeConfig();
    const safeFs = makeSafeFs(dir);
    const profile = await createPlace("Grove", dir, config, safeFs);
    await deletePlace(profile.fileName, dir, config, safeFs);
    const result = await listPlaces(dir, config);
    assert.deepEqual(result, []);
  });
});

test("deletePlace throws when SafeFileSystem cannot write target path", async () => {
  await withTempDir(async (dir) => {
    const config = makeConfig();
    const allowed = makeSafeFs(dir);
    const profile = await createPlace("Blocked", dir, config, allowed);
    const blocked = new SafeFileSystem(dir);
    await assert.rejects(
      () => deletePlace(profile.fileName, dir, config, blocked),
      /Blocked delete outside LeanQuill boundary/,
    );
  });
});

test("scanManuscriptFileForPlaces adds manuscript path when place name matches", async () => {
  await withTempDir(async (dir) => {
    const config = makeConfig();
    const safeFs = makeSafeFs(dir);

    await createPlace("Red Inn", dir, config, safeFs);

    const msDir = path.join(dir, "manuscript");
    await fs.mkdir(msDir, { recursive: true });
    const msPath = path.join(msDir, "ch1.md");
    await fs.writeFile(msPath, "They met at the Red Inn at dusk.", "utf8");

    await scanManuscriptFileForPlaces(msPath, dir, config, safeFs);

    const [updated] = await listPlaces(dir, config);
    assert.ok(
      updated.referencedByNameIn.includes("manuscript/ch1.md"),
      "should include manuscript path",
    );
  });
});

test("scanManuscriptFileForPlaces removes stale entry when name no longer matches", async () => {
  await withTempDir(async (dir) => {
    const config = makeConfig();
    const safeFs = makeSafeFs(dir);

    const profile = await createPlace("Red Inn", dir, config, safeFs);
    profile.referencedByNameIn = ["manuscript/ch1.md"];
    await savePlace(profile, dir, config, safeFs);

    const msDir = path.join(dir, "manuscript");
    await fs.mkdir(msDir, { recursive: true });
    const msPath = path.join(msDir, "ch1.md");
    await fs.writeFile(msPath, "This chapter has no setting mentions.", "utf8");

    await scanManuscriptFileForPlaces(msPath, dir, config, safeFs);

    const [updated] = await listPlaces(dir, config);
    assert.ok(
      !updated.referencedByNameIn.includes("manuscript/ch1.md"),
      "stale reference should be removed",
    );
  });
});
