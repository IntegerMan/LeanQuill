import test from "node:test";
import assert from "node:assert/strict";
import { renderPlanningHtml } from "../src/planningPanelHtml";
import type { OutlineIndex, ThemesDocument, ThreadProfile } from "../src/types";

function makeMinimalIndex(): OutlineIndex {
  return { schemaVersion: 2, nodes: [] };
}

function makeMinimalThemes(): ThemesDocument {
  return {
    centralThemes: [],
    bookSynopsis: "",
    centralQuestion: "",
    bookCustomFields: {},
  };
}

function renderMinimal(activeTab = "characters"): string {
  return renderPlanningHtml(
    makeMinimalIndex(),
    [],
    undefined,
    [],
    undefined,
    makeMinimalThemes(),
    [] as ThreadProfile[],
    undefined,
    [],
    [],
    "Test Book",
    "",
    "test-nonce",
    "vscode-resource:",
    activeTab,
  );
}

test("planning HTML uses shared __lqVsApi global in main script to avoid double-acquire", () => {
  const html = renderMinimal("characters");
  assert.match(html, /__lqVsApi/,
    "main script must use cached global so OQ fragment cannot cause double acquireVsCodeApi()");
  // The bare `const vscode = acquireVsCodeApi()` pattern must not appear; only the
  // guarded `window.__lqVsApi || (window.__lqVsApi = acquireVsCodeApi())` form should.
  assert.doesNotMatch(html, /const vscode = acquireVsCodeApi\(\)/,
    "bare unconditional acquireVsCodeApi() must not appear");
});

test("inactive tab panels have pointer-events: none so hidden DOM cannot intercept clicks", () => {
  const html = renderMinimal("characters");
  assert.match(html, /\.tab-panel\s*\{[^}]*pointer-events:\s*none/s,
    ".tab-panel rule must set pointer-events: none");
  assert.match(html, /\.tab-panel--active\s*\{[^}]*pointer-events:\s*auto/s,
    ".tab-panel--active rule must restore pointer-events: auto");
});

test("tab switch handler removes stale oq-ctx-menu elements", () => {
  const html = renderMinimal("outline");
  assert.match(html, /oq-ctx-menu.*\.remove\(\)|\.remove\(\).*oq-ctx-menu/s,
    "tab switch handler must clean up orphan OQ context menus");
});

test("character tab panel is active when activeTab is characters", () => {
  const html = renderMinimal("characters");
  assert.match(html, /tab-panel tab-panel--active.*data-panel-id="characters"|data-panel-id="characters".*tab-panel--active/s);
});

test("themes tab panel is active when activeTab is themes", () => {
  const html = renderMinimal("themes");
  assert.match(html, /data-panel-id="themes"/);
  assert.match(html, /tab-panel--active.*data-panel-id="themes"|data-panel-id="themes".*tab-panel--active/s);
});
