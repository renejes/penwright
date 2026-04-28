# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

vswrite-desktop is a standalone Electron desktop app for WYSIWYG editing of Typst documents, ported from the vswrite VS Code extension. Tech stack: Electron 41, electron-vite 5, Svelte 5 (runes), TipTap/ProseMirror 3, simple-git, pdf.js. Typst CLI is bundled with the app (no user installation needed).

The app is **project-first**: every file lives inside a project folder. Each project is self-contained — the Git history (`.git/`), auto-backups (`.vswrite/backups/`), and AI-edit snapshots (`.vswrite/ai-snapshots/`) all live inside the project, so copying or moving the folder takes the full state with it. The app starts at the Start Screen and never auto-reopens a project.

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
  - `fileManager.ts` — File I/O, auto-save (1s debounce), chokidar watcher (3s timestamp guard to prevent sidebar flicker), compiler invocation, AI snapshot ring buffer persisted to `<project>/.vswrite/ai-snapshots/` (configurable max), project-local auto-backup timer (configurable interval), `closeProject()` / `closeProjectInteractive()` for clean teardown
  - `importExport.ts` — PDF + DOCX export with chapter-selection modal, Markdown import, Zotero, style templates. `runFilteredExport()` writes a temporary filtered root file (`.vswrite-export-temp.typ`), compiles, and cleans up. DOCX uses `resolveIncludes()` from shared to merge the project before serialization.
  - `projectManager.ts` — Project templates, `openProject()` (folder picker), `ensureProjectInfrastructure()` (lazy `git init` + `.gitignore` + `.vswrite/` skeleton + initial commit), `handleNewFolder()` and `handleAddAssets()`, file tree with empty-folder visibility
  - `gitManager.ts` — Low-level Git verbs (status/stage/commit/push/pull) plus high-level "Versionen" API: `git:saveVersion`, `git:listVersions`, `git:showVersion` (parses unified diff), `git:restoreVersion`, `git:getRemote`/`setRemote`
- `typstCompiler.ts` — Typst → PDF compilation only (SVG mode removed in Session 9 — was blocking the main thread on large docs). Emits `compiledPdf` event with raw buffer.
- `typstPath.ts` — Resolves the typst binary. Production: bundled at `resources/bin/typst-{arch}-{platform}`. Otherwise probes common locations (`/opt/homebrew/bin`, `/usr/local/bin`, `~/.cargo/bin`, …) and falls back to `command -v typst` via `/bin/sh -lc` because macOS GUI apps don't inherit Homebrew PATH.
- `terminalManager.ts` — node-pty wrapper for integrated terminal
- `menuBuilder.ts` — Native menu bar with five top-level menus. **File** (New / Open / Close Project, Save / Save As, Export PDF/DOCX, Import Markdown, Link Zotero, Open Sources Folder, Add Citation Manually), **Edit** (standard roles + Find & Replace + Undo AI Edit), **View** (panel toggles + Focus / Typewriter Mode + zoom roles), **Document** (Settings, Style Templates submenu, Merge / Split, Open as Typst Source, Ensure Bibliography), **Help** (User Guide, Keyboard Shortcuts, Report Issue). Most items send a `vswrite` IPC message that ipcHandlers / messageHandler dispatches.
- `lockManager.ts` — File locking for shared folders (Dropbox, iCloud)
- `persistenceManager.ts` — Two-storage model. Global state via electron-store: window bounds, panel state, license blob (encrypted), recent projects (folder paths, dead entries auto-filtered), backup config. Project-local helpers for `<project>/.vswrite/backups/<timestamp>/`: `saveProjectBackup`, `listProjectBackups`, `loadProjectBackup`, `pruneProjectBackups`, `checkForFileRecovery`.
- `licenseManager.ts` — Polar SDK: license activation, validation, offline grace (30 days)

### IPC Communication

Three patterns through the preload bridge (`window.electronAPI`):
- **send** (fire-and-forget): `vswrite`, `terminal:*` channels
- **on** (push from main): `vswrite`, `terminal:data` channels
- **invoke** (request-response): `dialog:*`, `app:*`, `filetree:*`, `includes:*`, `textfile:*`, `git:*`, `project:*`, `export:*`, `persist:*`, `license:*`, `spellcheck:*` (~50 channels)

Notable channel groups added since the original port:
- `project:open`, `project:close`, `project:newFolder`, `project:addAssets`, `project:listBackups`, `project:loadBackup`, `project:applyBackup`, `project:getBackupConfig`, `project:setBackupConfig`, `project:openBackupFolder`, `project:showInFinder`, `project:getInfo`
- `git:saveVersion`, `git:listVersions`, `git:showVersion`, `git:restoreVersion`, `git:ensureRepo`, `git:getRemote`, `git:setRemote`
- `export:getSections`, `export:run`

Message types are defined in `src/editor/lib/messages.ts`. The IPC adapter (`src/editor/lib/ipcAdapter.ts`) auto-detects Electron vs VS Code context, so editor code works in both environments.

### Renderer State

`src/renderer/appState.svelte.ts` uses Svelte 5 runes (`$state`, `$derived`, `$effect`) with sections: editor state, UI state, panel state, preview state (PDF only — `pdfData`/`error`/`compiling`), tab state, context menu, new project dialog, export dialog state.

`App.svelte` derives **`wordStats`** (`{ words, minutes }`) from the editor JSON, walking the tree and skipping `typstRawBlock` / `codeBlock` / `pagebreak` so code doesn't inflate the count. Tracked reactively via `editorVersion.value`. Displayed in the status bar as `1,247 words · 5 min read` (200 wpm).

Key components in `src/renderer/components/`:
- `Sidebar.svelte` — file tree with inline "New Folder" input + "Add Asset" picker, empty folders visible, `▾`/`▸` chevrons
- `ProjectPanel.svelte` — replaces the old `GitPanel.svelte`. Contains the project header, "Save Version" card, change list with checkboxes, always-visible history, auto-backup status footer, collapsible "Advanced" section for cloud sync
- `VersionDetail.svelte` — modal for one history entry with source-text diff (red/green lines) and "Restore this version"
- `BackupListDialog.svelte` — auto-backup browser with collapsible settings (interval, max count, max AI snapshots)
- `ExportDialog.svelte` — format picker (PDF/DOCX) with chapter checkboxes; only opens for multi-chapter projects, single-file exports skip straight to the save dialog
- `StartScreen.svelte` — visible when no project is open; lists recent projects (folder paths)

`messageHandler.ts` listens for backend events including `projectClosed` (resets all editor state), `showExportDialog` (opens ExportDialog), `backupCreated` (refreshes the auto-backup status line), `aiSnapshotCount`. It also handles native-menu-driven renderer state changes: `showSearch`, `showShortcuts`, `toggleFocusMode`, `toggleTypewriterMode`.

### Editor (`src/editor/`)

TipTap-based rich text editor with ~19 custom Typst node extensions (`typst*.ts`). Key modules:
- `serializer.ts` — TipTap JSON → Typst source
- `deserializer.ts` — Typst source → TipTap JSON. Handles `#align(spec)[…]` blocks (incl. combined alignments like `center + horizon`), unwraps nested `#text(size, weight)[…]`, recognises `#datetime.today().display(…)`. Multi-line list items (`+ item\n  cont.`) are joined.
- `reconciler.ts` — Incremental document updates
- Svelte components: `Toolbar.svelte`, `SettingsPanel.svelte`, `SearchReplace.svelte`, `QuickSettings.svelte`, `ShortcutCheatsheet.svelte`, `WelcomeScreen.svelte`. (The old `CommandHub.svelte` was retired in Session 11 — its actions live in the native menu bar and slash commands now.)

### Shared Code (`src/shared/`)

Code used by both main and renderer: settings parser, bib parser, DOCX serializer, style/project templates, document merge/split, markdown importer. Import via `@shared` alias.

### Path Aliases

Configured in electron.vite.config.mts: `@shared` → `src/shared/`, `@editor` → `src/editor/`.

## Key Patterns

- **Preload whitelist:** any new IPC channel must be added to the allowed lists in `preload-entry.ts`. The `SEND_CHANNELS` list is small (terminal + `vswrite` event channel); most new work goes into `INVOKE_CHANNELS`.
- **Typst compilation** always targets the root file (for multi-chapter support) and outputs PDF only. Never call `'typst'` directly — always use `getTypstPath()` so bundled-vs-system resolution works.
- **External file changes** are detected via chokidar; the watcher uses a 3-second timestamp guard (`lastSaveTimestamp`) to ignore self-triggered events. The watcher also ignores `**/.vswrite/**` so backups never trigger refresh loops.
- **Three independent persistence layers** — keep them conceptually separate:
  - **Versions** (Git): user-triggered "Save Version" → `git commit`. Lives in `<project>/.git/`. Use the high-level handlers (`git:saveVersion`, `git:listVersions`, `git:restoreVersion`); the low-level verbs are kept for the "Advanced" cloud-sync UI only.
  - **Auto-backups**: timer-driven multi-file snapshots in `<project>/.vswrite/backups/<timestamp>/`. Each snapshot is a flat folder of files plus a `.meta.json`. On open, `checkForFileRecovery()` offers to restore if the latest backup is newer than the disk file.
  - **AI-edit snapshots**: ring buffer in `<project>/.vswrite/ai-snapshots/`, persisted as JSON per entry, restored into memory on project open. Used by "Undo AI Edit" — never confuse with versions.
- **`resolveIncludes()` from `src/shared/mergeDocument.ts`** is used for DOCX export (typst itself follows includes natively for PDF). It produces a merged source with comment markers separating each chapter — note the **blank line after the marker** is essential, otherwise the marker glues to the chapter's H1 and the deserializer drops the heading as a config block.
- **Style template application is blocked outside the root file** — applying a style preamble to a chapter file silently corrupts it. `applyStyleTemplate()` checks `findRootFile(currentFilePath) === currentFilePath` and shows a native dialog otherwise.
- **Project lifecycle:** `closeProject()` (clean teardown — releases lock, stops watcher, disposes compiler, clears timers, sends `projectClosed` to renderer) vs. `closeProjectInteractive()` (prompts to save first if dirty). `openProject()` calls the interactive close before opening a new one. Always go through these — never reset `appState` fields directly.
- **Security:** all file read/write IPC handlers validate paths with `isPathWithin()` from `pathSecurity.ts` (realpath-based, symlink-safe). Sandbox is enabled; preload uses contextIsolation. The asset protocol (`vswrite-asset://`) and the MCP server's file tools have their own path validation.
- **Action-discovery split:** native menu bar = project / document / file actions and rare dialogs. Slash commands (`/`) = in-text content insertions (image, table, math, citation, divider, page break, …). Toolbar = frequent inline format buttons (B/I/U/S, headings, lists, code, link). When adding a new action, decide which surface it belongs to and pick exactly one — don't duplicate.
- **`src/cli/` and `src/mcp/`** exist from the VS Code extension; CLI is unused, MCP server runs as a standalone Node.js process and supports both PDF and SVG output via the typst CLI directly (the in-app SVG preview was removed, but external SVG export from the MCP tool remains).
- **Future writer features** are pre-planned in `documentation/writer-features-plan.md` — Find in Project, Footnote UI, Cross-References, Comments / Annotations, Outline drag-to-reorder, Reading Mode, Inline Source Preview, Backlinks, Manuscript Export. Each entry contains the implementation path, file references, and effort estimate so a future session can pick up without re-deriving context.
