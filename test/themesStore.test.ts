import test from "node:test";
import assert from "node:assert/strict";
import {
  addCentralThemeEntry,
  defaultThemesDocument,
  parseThemesYaml,
  serializeThemesYaml,
} from "../src/themesStore";

test("defaultThemesDocument has schema 1 and empty collections", () => {
  const d = defaultThemesDocument();
  assert.equal(d.schemaVersion, "1");
  assert.equal(d.centralQuestion, "");
  assert.equal(d.bookSynopsis, "");
  assert.deepEqual(d.bookCustomFields, {});
  assert.deepEqual(d.centralThemes, []);
  assert.deepEqual(d.bookLinkedChapters, []);
});

test("parseThemesYaml reads minimal scalars", () => {
  const yaml = [
    'schema_version: "1"',
    "central_question: Why?",
    "book_synopsis: A story.",
    "book_custom_fields: {}",
    "central_themes: []",
    "book_linked_chapters: []",
  ].join("\n");
  const d = parseThemesYaml(yaml);
  assert.equal(d.centralQuestion, "Why?");
  assert.equal(d.bookSynopsis, "A story.");
});

test("serialize then parse round-trips central themes and book linked chapters", () => {
  let d = defaultThemesDocument();
  d.centralQuestion = "Q";
  d.bookSynopsis = "S";
  d.bookCustomFields = { tone: "dark" };
  d.bookLinkedChapters = ["manuscript/ch1.md"];
  d = addCentralThemeEntry(d).doc;
  d.centralThemes[0]!.title = "T1";
  d.centralThemes[0]!.summary = "Sum one";
  d.centralThemes[0]!.notePath = "notes/t.md";
  d.centralThemes[0]!.linkedChapters = ["manuscript/ch2.md"];
  const { doc: d2 } = addCentralThemeEntry(d);
  d2.centralThemes[1]!.title = "T2";
  d2.centralThemes[1]!.linkedChapters = [];

  const yaml = serializeThemesYaml(d2);
  const back = parseThemesYaml(yaml);
  assert.equal(back.centralQuestion, "Q");
  assert.equal(back.bookSynopsis, "S");
  assert.equal(back.bookCustomFields.tone, "dark");
  assert.deepEqual(back.bookLinkedChapters, ["manuscript/ch1.md"]);
  assert.equal(back.centralThemes.length, 2);
  assert.equal(back.centralThemes[0]!.title, "T1");
  assert.deepEqual(back.centralThemes[0]!.linkedChapters, ["manuscript/ch2.md"]);
  assert.equal(back.centralThemes[1]!.title, "T2");
});

test("parseThemesYaml malformed returns default", () => {
  const d = parseThemesYaml("this is not valid ::: {{{");
  assert.equal(d.schemaVersion, "1");
  assert.deepEqual(d.centralThemes, []);
});

test("addCentralThemeEntry appends one theme with uuid id", () => {
  const d = defaultThemesDocument();
  const { doc, newId } = addCentralThemeEntry(d);
  assert.equal(doc.centralThemes.length, 1);
  assert.equal(doc.centralThemes[0]!.id, newId);
  assert.match(newId, /^[0-9a-f-]{36}$/i);
});
