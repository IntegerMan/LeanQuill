# Development

## Tech stack

- **Language**: TypeScript (strict mode, ES2022 target)
- **Bundler**: esbuild (fast single-file bundle)
- **Runtime**: VS Code Extension Host (Node.js)
- **UI**: VS Code Webview API for sidebar panels and editor tabs
- **Icons**: `@vscode/codicons`

## Build commands

```bash
npm run build        # Bundle extension to dist/extension.js
npm run watch        # Rebuild on file changes
npm run build:test   # Bundle test files to dist-test/
npm test             # Run tests via node --test
```

## Project structure

```
src/
├── extension.ts              # Entry point — activation, command registration
├── safeFileSystem.ts         # Write boundary enforcement
├── types.ts                  # Shared type definitions
├── initialize.ts             # Init flow, scaffold, harness files
│
├── outlineWebviewPanel.ts    # Sidebar outline tree (webview)
├── outlineContextPane.ts     # Sidebar context detail pane (webview)
├── outlineStore.ts           # Outline index read/write
│
├── planningPanel.ts          # Planning workspace panel logic
├── planningPanelHtml.ts      # Planning workspace HTML/tabs
│
├── projectConfig.ts          # project.yaml parsing/validation
├── themesStore.ts            # themes.yaml read/write
├── characterStore.ts         # Character profile CRUD
├── threadStore.ts            # Thread profile CRUD
│
├── bookTxtSync.ts            # Book.txt generation from outline
├── leanpubScaffold.ts        # Manuscript scaffolding
├── chapterOrder.ts           # Chapter order resolution
│
├── actionsView.ts            # Setup sidebar tree provider
├── researchTree.ts           # Research sidebar tree provider
├── characterTree.ts          # Characters sidebar tree provider
│
├── htmlUtils.ts              # HTML escaping utilities
├── yamlUtils.ts              # YAML parsing helpers
├── nodeEditor.ts             # Open-by-node-id utility
└── chapterPickerOptions.ts   # Chapter picker for themes/threads

test/
├── safeFileSystem.test.ts
├── outlineStore.test.ts
├── bookTxtSync.test.ts
├── leanpubScaffold.test.ts
├── projectConfig.test.ts
├── characterStore.test.ts
├── researchTree.test.ts
├── themesStore.test.ts
├── threadStore.test.ts
└── ...

media/
└── leanquill.svg             # Activity bar icon
```

## Running in development

1. Open the `LeanQuill` folder in VS Code
2. Run `npm install` to install dependencies
3. Press **F5** to launch the Extension Development Host
4. Open a folder containing a `manuscript/` directory (or use the Initialize command)

## Testing

Tests use Node.js built-in test runner with esbuild for bundling:

```bash
npm run build:test   # Compile test files
npm test             # Run all tests
```

Test files mirror the source structure and cover stores, file system safety, scaffold logic, config parsing, and sync behavior. Tests run outside VS Code — they do not require the extension host.

For architecture and key modules, see [Architecture](architecture.md).

---

[← Back to README](../README.md)
