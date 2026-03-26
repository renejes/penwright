# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

vswrite-desktop is a standalone Electron desktop app for WYSIWYG editing of Typst documents, ported from the vswrite VS Code extension. Tech stack: Electron 41, electron-vite 5, Svelte 5 (runes), TipTap/ProseMirror 3, node-pty + xterm.js, simple-git.

## Commands

```bash
# Development (the `unset ELECTRON_RUN_AS_NODE` prefix is required when running from VS Code/Cursor terminals)
unset ELECTRON_RUN_AS_NODE && electron-vite dev

# Build
unset ELECTRON_RUN_AS_NODE && electron-vite build

# Preview built app
unset ELECTRON_RUN_AS_NODE && electron-vite preview

# Package for distribution
electron-builder --mac
electron-builder --win
electron-builder --linux
```

There are no test or lint scripts configured.

## Architecture

### Process Model

Three build targets configured in `electron.vite.config.mts`:
- **Main process** (`src/main/index.ts`) — Window management, file I/O, IPC routing, terminal, git
- **Preload** (`src/main/preload-entry.ts`) — contextBridge with whitelisted channels (contextIsolation: true, nodeIntegration: false)
- **Renderer** (`src/renderer/main.ts` → `App.svelte`) — Svelte 5 UI shell, panels, state

Build outputs go to `dist/main/`, `dist/preload/`, `dist/renderer/`.

### Main Process Modules

`appState.ts` is a leaf-module singleton imported by all other main modules — never import project modules into it (circular dependency prevention). The remaining modules are organized by domain:

- `ipcHandlers.ts` — Central IPC message router dispatching to:
  - `fileManager.ts` — File I/O, auto-save (300ms debounce), chokidar watcher, compiler invocation
  - `importExport.ts` — PDF (via typst CLI), DOCX (via docx lib), Markdown, Zotero
  - `projectManager.ts` — Project templates, file tree, image handling, settings
  - `gitManager.ts` — Git operations via simple-git
- `typstCompiler.ts` — Typst → SVG compilation (compiles root file, reads zero-padded page SVGs)
- `terminalManager.ts` — node-pty wrapper for integrated terminal
- `menuBuilder.ts` — Native menu (macOS/Windows)

### IPC Communication

Three patterns through the preload bridge (`window.electronAPI`):
- **send** (fire-and-forget): `vswrite`, `terminal:*` channels
- **on** (push from main): `vswrite`, `terminal:data` channels
- **invoke** (request-response): `dialog:*`, `app:*`, `filetree:*`, `includes:*`, `textfile:*`, `git:*` (33 channels)

Message types are defined in `src/editor/lib/messages.ts`. The IPC adapter (`src/editor/lib/ipcAdapter.ts`) auto-detects Electron vs VS Code context, so editor code works in both environments.

### Renderer State

`src/renderer/appState.svelte.ts` uses Svelte 5 runes (`$state`, `$derived`, `$effect`) with sections: editor state, UI state, panel state, preview state, tab state, context menu, new project dialog.

### Editor (`src/editor/`)

TipTap-based rich text editor with ~19 custom Typst node extensions (`typst*.ts`). Key modules:
- `serializer.ts` — TipTap JSON → Typst source
- `deserializer.ts` — Typst source → TipTap JSON
- `reconciler.ts` — Incremental document updates
- Svelte components: Toolbar, CommandHub, SettingsPanel, SearchReplace

### Shared Code (`src/shared/`)

Code used by both main and renderer: settings parser, bib parser, DOCX serializer, style/project templates, document merge/split, markdown importer. Import via `@shared` alias.

### Path Aliases

Configured in electron.vite.config.mts: `@shared` → `src/shared/`, `@editor` → `src/editor/`.

## Key Patterns

- Preload whitelist: any new IPC channel must be added to the allowed lists in `preload-entry.ts`
- Typst compilation always targets the root file (for multi-chapter support) and outputs zero-padded SVG filenames
- External file changes are detected via chokidar and prompt the user to reload
- `src/cli/` exists from the VS Code extension but is unused in the desktop app
