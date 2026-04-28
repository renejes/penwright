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
  - `projectSearch.ts` — Project-wide find & replace across `.typ` (and optionally `.bib`), regex/case/whole-word, max 1000 hits with truncation flag. Whole-word uses `(?<!\w)…(?!\w)` lookarounds — **NOT** `\b…\b`, because `\b` doesn't fire when the term starts with a non-word char like `@` (citation backlinks would silently return zero hits otherwise). Live in-memory content for the open file is searched alongside disk content.
  - `commentManager.ts` — Comments live as `<project>/comments/<id>.md` (sortable id like `2026-04-28-1432-a3f`), one Markdown file per comment with YAML frontmatter (`id`, `file`, `anchor`, `rangeStart/End`, `author`, `date`, `resolved`) + Markdown body. Visible folder, cloud-sync-friendly, never compiled into PDF/DOCX. Reanchoring: exact offset hit → `indexOf` from `rangeHint - 200` → global → `orphaned: true`. Has its own minimal YAML parser (no external dep).
- `typstCompiler.ts` — Typst → PDF compilation only (SVG mode removed in Session 9 — was blocking the main thread on large docs). Emits `compiledPdf` event with raw buffer.
- `typstPath.ts` — Resolves the typst binary. Production: bundled at `resources/bin/typst-{arch}-{platform}`. Otherwise probes common locations (`/opt/homebrew/bin`, `/usr/local/bin`, `~/.cargo/bin`, …) and falls back to `command -v typst` via `/bin/sh -lc` because macOS GUI apps don't inherit Homebrew PATH.
- `terminalManager.ts` — node-pty wrapper for integrated terminal
- `menuBuilder.ts` — Native menu bar with five top-level menus. **File** (New / Open / Close Project, Save / Save As, Export PDF/DOCX, Import Markdown, Link Zotero, Open Sources Folder, Add Citation Manually), **Edit** (standard roles + Find & Replace `Cmd+F`, **Find in Project** `Cmd+Shift+F`, **Add Comment** `Cmd+Alt+M`, Undo AI Edit), **View** (panel toggles + Focus / Typewriter / **Reading Mode** `Cmd+Alt+R` + zoom roles), **Document** (Settings, Style Templates submenu, Merge / Split, Open as Typst Source, Ensure Bibliography), **Help** (User Guide, Keyboard Shortcuts, Report Issue). Most items send a `vswrite` IPC message that ipcHandlers / messageHandler dispatches.
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
- `project:search`, `project:replaceAll` — project-wide find/replace, used by `ProjectSearchPanel` and the backlinks triggers
- `comments:list`, `comments:create`, `comments:update`, `comments:delete` — comment CRUD on `<project>/comments/`
- `git:saveVersion`, `git:listVersions`, `git:showVersion`, `git:restoreVersion`, `git:ensureRepo`, `git:getRemote`, `git:setRemote`
- `export:getSections`, `export:run`

Message types are defined in `src/editor/lib/messages.ts`. The IPC adapter (`src/editor/lib/ipcAdapter.ts`) auto-detects Electron vs VS Code context, so editor code works in both environments.

### Renderer State

`src/renderer/appState.svelte.ts` uses Svelte 5 runes (`$state`, `$derived`, `$effect`) with sections: editor state, UI state (incl. `showProjectSearch`, `readingMode`), panel state (sidebar tab can be `'files' | 'outline' | 'includes' | 'git' | 'comments'`), preview state (PDF only — `pdfData`/`error`/`compiling`), tab state, context menu, new project dialog, export dialog state, **`projectSearchPreset`** (consumed-once seed for the next ProjectSearchPanel mount; see "Cross-component triggers" below).

`App.svelte` derives **`wordStats`** (`{ words, minutes }`) from the editor JSON, walking the tree and skipping `typstRawBlock` / `codeBlock` / `pagebreak` so code doesn't inflate the count. Tracked reactively via `editorVersion.value`. Displayed in the status bar as `1,247 words · 5 min read` (200 wpm).

Key components in `src/renderer/components/`:
- `Sidebar.svelte` — file tree with inline "New Folder" input + "Add Asset" picker, empty folders visible, `▾`/`▸` chevrons
- `OutlinePanel.svelte` — heading hierarchy navigation; each row has a hover-only `↪` button that dispatches `vswrite:find-backlinks` for the heading title
- `ProjectPanel.svelte` — replaces the old `GitPanel.svelte`. Contains the project header, "Save Version" card, change list with checkboxes, always-visible history, auto-backup status footer, collapsible "Advanced" section for cloud sync
- `CommentsPanel.svelte` — fifth sidebar tab. Lists comments for current file or whole project, body textarea with 400 ms debounced auto-save, resolve/delete actions, anchor-click jumps editor + flashes the highlight. Pushes decorations only on comment-list changes (NOT on `editorVersion` — that caused an infinite loop; the plugin handles `tr.docChanged` itself)
- `ProjectSearchPanel.svelte` — slide-in for `Cmd+Shift+F`. Live-debounced search with options Aa/W/.*/.bib, results grouped by file, click jumps + scrolls + briefly highlights. Reads `projectSearchPreset` on mount and clears it (consume-once)
- `VersionDetail.svelte` — modal for one history entry with source-text diff (red/green lines) and "Restore this version"
- `BackupListDialog.svelte` — auto-backup browser with collapsible settings (interval, max count, max AI snapshots)
- `ExportDialog.svelte` — format picker (PDF/DOCX) with chapter checkboxes; only opens for multi-chapter projects, single-file exports skip straight to the save dialog
- `StartScreen.svelte` — visible when no project is open; lists recent projects (folder paths)

`messageHandler.ts` listens for backend events including `projectClosed` (resets all editor state), `showExportDialog` (opens ExportDialog), `backupCreated` (refreshes the auto-backup status line), `aiSnapshotCount`. It also handles native-menu-driven renderer state changes: `showSearch`, `showProjectSearch`, `showShortcuts`, `toggleFocusMode`, `toggleTypewriterMode`, `toggleReadingMode`, `addComment` (re-dispatches as `vswrite:add-comment` window event).

### Editor (`src/editor/`)

TipTap-based rich text editor with ~19 custom Typst node extensions (`typst*.ts`). Key modules:
- `serializer.ts` — TipTap JSON → Typst source
- `deserializer.ts` — Typst source → TipTap JSON. Handles `#align(spec)[…]` blocks (incl. combined alignments like `center + horizon`), unwraps nested `#text(size, weight)[…]`, recognises `#datetime.today().display(…)`. Multi-line list items (`+ item\n  cont.`) are joined. Inline `#footnote[…]` is parsed into a footnote node.
- `reconciler.ts` — Incremental document updates
- `typstFootnote.ts` — Inline atomic node `footnote` with click-to-edit popup. Exports `insertFootnoteWithEditor(editor)` — inserts an empty footnote and synthesises a click on the freshly mounted DOM node so the popup auto-opens. Used by both the toolbar Fn button and the `/Footnote` slash command.
- `typstCitation.ts` — Inline atomic node `citation` (`@citekey` badge). `contextmenu` handler dispatches `vswrite:find-backlinks` with `@<citekey>` (whole-word) so right-click finds every usage in the project.
- `commentDecorations.ts` — TipTap extension that renders gold-yellow inline decorations for active comment anchors **without modifying the document**. `setCommentMarks(editor, marks)` pushes a new mark list via plugin-meta transaction. The plugin's `apply()` rebuilds decorations on `tr.docChanged` itself — DO NOT trigger `setCommentMarks` from a `$effect` that tracks `editorVersion`, that loops infinitely (transaction → onTransaction → editorVersion++ → effect → transaction).
- Svelte components: `Toolbar.svelte` (Fn / Cm buttons + reading-mode 𝓡 toggle), `SettingsPanel.svelte`, `SearchReplace.svelte`, `QuickSettings.svelte`, `ShortcutCheatsheet.svelte`, `WelcomeScreen.svelte`. (The old `CommandHub.svelte` was retired in Session 11 — its actions live in the native menu bar and slash commands now.)

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
- **Action-discovery split:** native menu bar = project / document / file actions and rare dialogs. Slash commands (`/`) = in-text content insertions (image, table, math, citation, divider, page break, footnote …). Toolbar = frequent inline format buttons (B/I/U/S, headings, lists, code, link, Fn/Cm) plus the right-side mode toggles (Quick / Typewriter / Reading 𝓡 / Focus). When adding a new action, decide which surface it belongs to and pick exactly one — don't duplicate.
- **Cross-component triggers via `window` Custom Events:** UI surfaces dispatch DOM `CustomEvent`s on `window` and `App.svelte` listens at the top. Current events:
  - `vswrite:add-comment` — Toolbar Cm button / menu / `Cmd+Alt+M` → `addCommentFromSelection()`
  - `vswrite:comment-click` — comment-decoration click → `CommentsPanel` scrolls panel to entry
  - `vswrite:comment-created` — after `comments:create` IPC → `CommentsPanel` refreshes + focuses new entry
  - `vswrite:find-backlinks` — OutlinePanel hover-arrow / Citation right-click → seeds `projectSearchPreset` + opens ProjectSearchPanel
  - `vswrite:project-search-jump` — match-click in ProjectSearchPanel → editor scrolls to first occurrence of match text
  Pattern works because there's only one App-level listener — keep it that way; don't dispatch the same event from two listeners.
- **`src/cli/` and `src/mcp/`** exist from the VS Code extension; CLI is unused, MCP server runs as a standalone Node.js process and supports both PDF and SVG output via the typst CLI directly (the in-app SVG preview was removed, but external SVG export from the MCP tool remains).
- **Writer-features status** (see `documentation/writer-features-plan.md` for full detail):
  - ✅ Find in Project (Session 12), Footnote UI (Session 12), Comments / Annotations (Session 12), Reading Mode (Session 13), Backlinks (Session 13)
  - ⏳ Open: Cross-References, Outline drag-to-reorder, Inline Source Preview, Manuscript Export
  - Each completed feature has its implementation summary in the plan; each open feature has a target architecture, file references, and effort estimate so a future session can pick up without re-deriving context.
