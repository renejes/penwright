# vswrite Desktop — Electron Architecture

> **Stand:** 2026-03-26 (nach Session 3: Spellcheck, Code-Editor, PDF-Viewer)
> Dokumentation der tatsächlichen Architektur der eigenständigen Electron Desktop-App (vswrite-desktop).

---

## Projekt-Struktur (Ist-Stand nach Refactoring)

```
vswrite-desktop/
├── src/
│   ├── shared/                ← 1:1 Kopie aus Extension (unverändert)
│   │   ├── settingsParser.ts    Parst/appliziert #set Blöcke
│   │   ├── bibParser.ts         Parst .bib Dateien
│   │   ├── docxSerializer.ts    TipTap JSON → Word .docx
│   │   ├── styleTemplates.ts    Vordefinierte Typst Style-Templates
│   │   ├── mergeDocument.ts     Löst #include rekursiv auf
│   │   ├── splitDocument.ts     Splittet Dokument in chapters/
│   │   ├── rootFinder.ts        Findet Projekt-Root
│   │   ├── sourceImporter.ts    Auto-Import aus sources/
│   │   ├── markdownImporter.ts  Markdown → Typst Converter
│   │   └── projectTemplates.ts  Projekt-Vorlagen
│   ├── editor/                ← Kopie von webview/ (minimal angepasst)
│   │   ├── lib/
│   │   │   ├── serializer.ts      TipTap JSON → Typst
│   │   │   ├── deserializer.ts    Typst → TipTap JSON
│   │   │   ├── reconciler.ts      Inkrementelle Editor-Updates
│   │   │   ├── editor.ts          TipTap Editor Setup
│   │   │   ├── messages.ts        IPC Message Types (erweitert)
│   │   │   ├── ipcAdapter.ts      VS Code / Electron Auto-Detect
│   │   │   ├── citationSuggestion.ts
│   │   │   ├── slashCommands.ts
│   │   │   └── typst*.ts         Custom TipTap Nodes
│   │   ├── components/
│   │   │   ├── Toolbar.svelte
│   │   │   ├── CommandHub.svelte
│   │   │   ├── SettingsPanel.svelte
│   │   │   ├── SearchReplace.svelte
│   │   │   ├── QuickSettings.svelte
│   │   │   ├── ShortcutCheatsheet.svelte
│   │   │   └── WelcomeScreen.svelte
│   │   └── style.css           Globales Editor-Stylesheet
│   ├── mcp/                   ← MCP Server (eigenständiges CLI-Tool)
│   │   └── server.ts            11 Tools, stdio JSON-RPC, ~300 Zeilen
│   ├── cli/                   ← 1:1 Kopie (unverändert)
│   ├── main/                  ← Electron Main Process (~1.977 Zeilen, 12 Dateien)
│   │   ├── index.ts             Entry Point: Window, Terminal, Lifecycle (154 Z.)
│   │   ├── appState.ts          Zentrales State-Objekt (48 Z.)
│   │   ├── ipcHandlers.ts       Message Router: Switch + Dialog/Filetree/Includes (412 Z.)
│   │   ├── fileManager.ts       File I/O, Auto-Save, Compiler, Watcher, Preamble (309 Z.)
│   │   ├── importExport.ts      PDF, DOCX, Markdown, Zotero, Style Templates (310 Z.)
│   │   ├── projectManager.ts    New Project, File Tree, Skills, Images, Settings (296 Z.)
│   │   ├── menuBuilder.ts       Application Menu (macOS/Windows) (131 Z.)
│   │   ├── gitManager.ts        Git IPC Handler (84 Z.)
│   │   ├── lockManager.ts       File Locking für Shared Folders (Dropbox etc.)
│   │   ├── preload-entry.ts     contextBridge (send/on/invoke, 25 Channels)
│   │   ├── typstCompiler.ts     typst compile → SVG/PDF Pages
│   │   ├── terminalManager.ts   node-pty Wrapper
│   │   └── deserializer-bridge.ts  Re-Export für Main Process
│   └── renderer/              ← Electron Renderer (~3.124 Zeilen)
│       ├── main.ts              Svelte Mount + globaler CSS Import (9 Z.)
│       ├── App.svelte           App Shell, Layout, Template + CSS (834 Z.)
│       ├── appState.svelte.ts   Svelte 5 reaktiver State + Tab/Resize (132 Z.)
│       ├── messageHandler.ts    ExtensionMessage Handler (166 Z.)
│       └── components/
│           ├── Sidebar.svelte         File Tree (rekursiv, Drag-Images, Rechtsklick)
│           ├── OutlinePanel.svelte    Heading-Hierarchie (live aus Editor)
│           ├── IncludesPanel.svelte   #include Manager (Live-Update bei Reorder)
│           ├── PreviewPanel.svelte    SVG Preview (Scroll-Erhaltung)
│           ├── TerminalPanel.svelte   xterm.js Terminal
│           ├── TextFileViewer.svelte  Editor für .bib, .txt, .md, .yaml
│           ├── NewProjectDialog.svelte Modal für Projekt-Templates
│           ├── GitPanel.svelte        Git Status/Commit/Push
│           ├── ResizeHandle.svelte    Drag-to-Resize Handle
│           ├── StartScreen.svelte    Start Screen mit Onboarding + AI Info
│           ├── CodeEditor.svelte     CodeMirror 6 Wrapper (Syntax HL, Zeilennummern)
│           ├── PdfFileViewer.svelte  PDF In-App Viewer (pdf.js + TextLayer)
│           └── PdfPreviewPanel.svelte PDF Preview Rendering (für SVG/PDF Toggle)
├── index.html                 Renderer HTML Entry
├── package.json
├── electron.vite.config.mts   Build-Config (Main, Preload, Renderer)
├── esbuild.mcp.mjs            Build-Config MCP Server (eigenständig)
├── tsconfig.json
├── svelte.config.js
└── documentation/
    └── mcp-server-plan.md     MCP Server Dokumentation + offene Phasen
```

---

## Architektur-Diagramm

```
┌──────────────────────────────────────────────────────────────────┐
│                     Electron App (v41.0.4)                        │
│                                                                  │
│  ┌───────────────────┐     contextBridge      ┌─────────────────┐│
│  │   Main Process     │◄─────────────────────►│ Renderer Process ││
│  │   (Node.js v24)    │    preload-entry.ts    │ (Chromium)       ││
│  │                    │                        │                  ││
│  │  index.ts (Entry)  │    Channels:           │  App.svelte      ││
│  │  ipcHandlers.ts    │    ├─ vswrite (bidi)   │  ├─ Toolbar      ││
│  │  fileManager.ts    │    ├─ terminal:*       │  ├─ Editor       ││
│  │  menuBuilder.ts    │    ├─ filetree:*       │  ├─ Sidebar      ││
│  │  importExport.ts   │    └─ includes:*       │  │  ├─ Files     ││
│  │  projectManager.ts │                        │  │  ├─ Outline   ││
│  │  gitManager.ts     │                        │  │  └─ Chapters  ││
│  │  appState.ts       │                        │  ├─ Preview      ││
│  │                    │                        │  ├─ Terminal     ││
│  │  typstCompiler.ts  │                        │  └─ Status Bar   ││
│  │  ├─ execFile typst │                        │                  ││
│  │  └─ SVG Pages ────────────────────────────► │  PreviewPanel    ││
│  │                    │                        │                  ││
│  │  terminalManager.ts│                        │                  ││
│  │  ├─ node-pty  ────────── terminal:data ───► │  TerminalPanel   ││
│  │  └─ write() ◄────────── terminal:input ──── │  (xterm.js)      ││
│  │                    │                        │                  ││
│  │  ┌──────────────┐  │                        │  ┌────────────┐  ││
│  │  │   shared/    │  │                        │  │  editor/   │  ││
│  │  │  settings    │  │                        │  │  TipTap    │  ││
│  │  │  bibParser   │  │                        │  │  Svelte 5  │  ││
│  │  │  docx        │  │                        │  │  Serializer│  ││
│  │  │  merge/split │  │                        │  └────────────┘  ││
│  │  └──────────────┘  │                        │                  ││
│  └───────────────────┘                        └─────────────────┘│
└──────────────────────────────────────────────────────────────────┘
```

---

## Modul-Abhängigkeiten (Main Process)

```
index.ts (Entry Point)
├── appState.ts          ← Zentrales State-Objekt (Leaf, keine Imports)
├── lockManager.ts       ← File Locking (Shared Folders, Heartbeat)
├── menuBuilder.ts       ← Liest appState, ruft Callbacks
├── ipcHandlers.ts       ← Message Router
│   ├── fileManager.ts     ← File I/O, Auto-Save, Compiler, Watcher, Lock-Integration
│   ├── importExport.ts    ← PDF, DOCX, Markdown, Zotero, Citations
│   ├── projectManager.ts  ← Projects, File Tree, Images, Settings, Skills
│   └── gitManager.ts      ← Git IPC Handler
├── typstCompiler.ts     ← (unverändert)
├── terminalManager.ts   ← (unverändert)
└── preload-entry.ts     ← (unverändert, eigener Build-Target)
```

**Circular Dependencies** werden vermieden durch:
- `appState.ts` als Leaf-Modul (importiert nichts aus dem Projekt)
- Lazy `import()` wo Module sich gegenseitig brauchen (z.B. fileManager ↔ importExport)
- Callbacks im appState-Objekt (z.B. für Menu-Klicks)

---

## Das ELECTRON_RUN_AS_NODE Problem

### Das Problem

Der erste Build-Versuch schlug fehl mit:

```
TypeError: Cannot read properties of undefined (reading 'whenReady')
```

`require('electron')` gab einen **String** (Pfad zur Electron Binary) zurück statt dem Electron API-Objekt. `electron.app` war `undefined`.

### Ursache

**`ELECTRON_RUN_AS_NODE=1`** — Diese Umgebungsvariable wird von VS Code und Cursor in ihrem integrierten Terminal gesetzt. Wenn sie gesetzt ist, läuft die Electron-Binary als **reines Node.js** — ohne Chromium, ohne Browser-Prozess, ohne das built-in `'electron'` Modul.

Node.js' Modul-Resolution findet dann `node_modules/electron/index.js` (den npm Wrapper), der nur den Pfad zur Binary als String exportiert.

### Fehlgeschlagene Lösungsversuche

1. **`esbuild --external:electron`** — Korrekt, aber löst nicht das Runtime-Problem
2. **`Module._resolveFilename` Override** — Node versucht `'electron'` als Datei zu lesen → ENOENT
3. **ESM `import { app } from 'electron'`** — Gleicher Fehler
4. **`process._linkedBinding`** — SIGSEGV Crash
5. **`electron-vite externalizeDepsPlugin()`** — Gleiches Ergebnis
6. **npm Wrapper patchen** (`scripts/patch-electron.mjs`) — Kann nicht funktionieren, da es kein built-in Modul zum Re-Exportieren gibt wenn `ELECTRON_RUN_AS_NODE=1` gesetzt ist

### Lösung

```json
// package.json
"scripts": {
  "dev": "unset ELECTRON_RUN_AS_NODE && electron-vite dev",
  "build": "unset ELECTRON_RUN_AS_NODE && electron-vite build",
  "start": "unset ELECTRON_RUN_AS_NODE && electron-vite preview"
}
```

Alternativ: Terminal **außerhalb** von VS Code/Cursor verwenden (z.B. iTerm2, Terminal.app).

**Referenzen:**
- [Electron Issue #49034](https://github.com/electron/electron/issues/49034)
- [electron-forge: wipe ELECTRON_RUN_AS_NODE](https://github.com/electron/forge/commit/c702fe4a)
- [VS Code Issue #113687](https://github.com/microsoft/vscode/issues/113687)

---

## IPC-Architektur

### Preload Script (preload-entry.ts)

Sicherheitsschicht zwischen Main und Renderer. Whitelist-basiert:

```typescript
const SEND_CHANNELS = ['vswrite', 'terminal:input', 'terminal:resize', 'terminal:create', 'preview:setMode'];
const ON_CHANNELS = ['vswrite', 'terminal:data'];
const INVOKE_CHANNELS = [
  'dialog:openFile', 'dialog:saveFile', 'dialog:saveFileAs',
  'app:getPlatform', 'app:checkTypst',
  'filetree:list', 'filetree:open', 'filetree:navigateUp', 'filetree:openFolder',
  'includes:validate', 'includes:open', 'includes:add',
  'textfile:read', 'textfile:readBinary', 'textfile:write',
  'git:status', 'git:stage', 'git:unstage', 'git:stageAll',
  'git:commit', 'git:push', 'git:pull', 'git:init',
  'spellcheck:setLanguage',
];

contextBridge.exposeInMainWorld('electronAPI', {
  send(channel, data) { ... },      // Fire-and-forget
  on(channel, callback) { ... },    // Push-Events vom Main Process
  invoke(channel, ...args) { ... }, // Request/Response (Promise)
});
```

### IPC Adapter (ipcAdapter.ts)

Auto-Detection ob VS Code oder Electron läuft:

```typescript
export function createIPCAdapter(): IPCAdapter {
  if (window.electronAPI) return createElectronAdapter();
  if (window.acquireVsCodeApi) return createVSCodeAdapter();
  return createNoopAdapter();
}
```

### Message Types (26 Renderer → Main)

Alle implementiert mit Handlern in `ipcHandlers.ts` (delegiert an spezialisierte Module):

| Kategorie | Messages |
|-----------|----------|
| **Lifecycle** | `ready`, `edit`, `deserializeError` |
| **Export** | `exportPdf`, `exportDocx` |
| **Settings** | `requestSettings`, `updateSettings`, `quickSettings`, `applyStyle` |
| **Dateien** | `newFile`, `newProject`, `openSource`, `mergeDocument`, `splitDocument` |
| **Bilder** | `pickImage`, `dropImage`, `dropImagePath` |
| **Zitationen** | `requestCitations`, `ensureBibliography`, `importSources`, `addCitationManually` |
| **UI** | `dismissWelcome`, `openUserGuide`, `setWordGoal`, `undoLastAiEdit`, `importStyleTemplate` |
| **Preview** | `preview:setMode` (svg/pdf) |

### Message Types (Main → Renderer)

| Message | Beschreibung |
|---------|-------------|
| `update` | Typst-Content an Editor senden |
| `settingsData` | Geparste Settings für Settings-Panel |
| `documentBaseUri` | Basis-Pfad für Bild-Auflösung |
| `insertImage` | Bild programmatisch einfügen |
| `previewUpdate` | SVG Pages nach Kompilierung |
| `previewPdfUpdate` | PDF-Daten (base64) nach Kompilierung |
| `compileError` | Typst Compile-Fehler |
| `openPdfFile` | PDF-Datei im In-App Viewer öffnen |
| `saveStatus` | Gespeichert/Ungespeichert + Zeitstempel |
| `currentFile` | Aktuelle Datei (für Sidebar Highlighting) |
| `filetreeChanged` | File Tree neu laden |
| `togglePanel` | Panel ein-/ausblenden (vom Menü) |
| `citationData` | Geparste .bib Einträge |

---

## App-Shell Layout

```
┌──────────────────────────────────────────────────────────────┐
│  ◉ ◉ ◉                    (Drag Region)                      │
├──────────────────────────────────────────────────────────────┤
│  B I U S  │ H1 ▾│ • — │ 🔗 📷 │  ⚙ … ◎ ☰                  │  ← Toolbar
├──────┬──────────────────────────────┬────────────────────────┤
│[Files│Outline│Chapters]             │                        │
│      │                              │                        │
│ ▸ chapters/│     TipTap WYSIWYG     │   Preview Panel        │
│ ▸ assets/  │     Editor             │   (SVG Pages)          │
│   main.typ │     max-width: 700px   │                        │
│   refs.bib │     padding: 48px      │                        │
│            │                        │                        │
├──────┴──────────────────────────────┴────────────────────────┤
│  Terminal / AI  (xterm.js + node-pty)                        │
│  $ claude ▌                                                  │
├──────────────────────────────────────────────────────────────┤
│ [Project] [Terminal/AI] [Preview]     Saved 14:35  main.typ  │  ← Status Bar
└──────────────────────────────────────────────────────────────┘
```

**Sidebar Tabs:**
1. **Files** — Rekursiver Dateibaum, ← Button für Parent, + Button für Open Folder
2. **Outline** — Live Heading-Hierarchie aus TipTap Editor, Click-to-Navigate
3. **Chapters** — #include Manager: Umsortieren (↑↓), Entfernen (×), + Add Chapter

**Panel Toggles (Status Bar + Keyboard):**
- `Cmd+B` → Sidebar
- `Cmd+Shift+P` → Preview
- `` Cmd+` `` → Terminal

---

## Build Pipeline

**Tool:** `electron-vite` v5.0.0

Drei Build-Targets in `electron.vite.config.mts`:

| Target | Eingang | Ausgang | Plugins |
|--------|---------|---------|---------|
| **Main** | `src/main/index.ts` | `dist/main/index.js` | `externalizeDepsPlugin()` |
| **Preload** | `src/main/preload-entry.ts` | `dist/preload/preload-entry.js` | `externalizeDepsPlugin()` |
| **Renderer** | `index.html` + `src/renderer/main.ts` | `dist/renderer/` | `svelte()` |

```json
{
  "scripts": {
    "dev": "unset ELECTRON_RUN_AS_NODE && electron-vite dev",
    "build": "unset ELECTRON_RUN_AS_NODE && electron-vite build",
    "start": "unset ELECTRON_RUN_AS_NODE && electron-vite preview"
  }
}
```

**Wichtig:** `unset ELECTRON_RUN_AS_NODE` ist nötig wenn aus VS Code/Cursor Terminal gestartet wird.

---

## Dependencies

```json
{
  "dependencies": {
    "@tiptap/*": "^3.0.0",        // Rich-Text Editor
    "@codemirror/*": "^6.0.0",    // Code-Editor (Syntax HL, Zeilennummern)
    "@modelcontextprotocol/sdk": "^1.28.0", // MCP Server
    "@xterm/xterm": "^6.0.0",     // Terminal UI
    "@xterm/addon-fit": "^0.11.0", // Terminal Auto-Resize
    "chokidar": "^4.0.0",         // File Watching
    "docx": "^9.6.1",             // Word Export
    "electron-store": "^10.0.0",  // Persistenter State
    "node-pty": "^1.0.0",          // Terminal PTY (native)
    "pdfjs-dist": "^5.5.0",       // PDF In-App Viewer
    "simple-git": "^3.27.0",      // Git Operations
    "zod": "^3.25.0"              // Schema-Validierung (MCP Server)
  },
  "devDependencies": {
    "electron": "^41.0.4",
    "electron-builder": "^26.0.0",
    "electron-vite": "^5.0.0",
    "svelte": "^5.0.0",
    "vite": "^6.0.0",
    "typescript": "^5.7.0"
  }
}
```

**node-pty** erfordert `electron-rebuild`: `npx electron-rebuild -f -w node-pty`

---

## Implementierungsstatus

### Fertig (Phase E1–E4 + Refactoring)

- [x] Electron Main Process mit BrowserWindow
- [x] Preload Script mit contextBridge (send/on/invoke)
- [x] IPC-Adapter mit VS Code/Electron Auto-Detect
- [x] TipTap Editor lädt in Electron
- [x] Datei öffnen/speichern/Save As
- [x] Auto-Save (1s Debounce nach Edit)
- [x] Unsaved-Changes Warnung beim Schließen
- [x] Typst Compiler Integration (SVG Preview)
- [x] Preview Panel mit SVG Rendering + Root-File Kompilierung
- [x] PDF Export, DOCX Export
- [x] Document Settings Panel
- [x] Quick Settings
- [x] Style Templates (mit korrekter Multi-Line Preamble Ersetzung)
- [x] File Tree Sidebar (rekursiv, Expand/Collapse, Navigate Up)
- [x] Heading Outline Sidebar (live)
- [x] Include Manager Sidebar (Reorder, Add, Remove)
- [x] Terminal (node-pty + xterm.js)
- [x] Git Integration (simple-git: Status, Stage, Commit, Push/Pull, Init)
- [x] Multi-Tab Editor (Tabs, Rechtsklick "Open in New Tab")
- [x] Text-Editor für .bib, .txt, .md, .yaml etc.
- [x] Bild einfügen (Pick, Drop, Drop Path → assets/)
- [x] Merge/Split Document
- [x] Citations (Bib Parser, Request Citations)
- [x] Status Bar mit Panel-Toggles und Save-Indikator
- [x] Native macOS Menü (File, Edit, View, Help)
- [x] Keyboard Shortcuts (Cmd+S, Cmd+B, Cmd+Shift+P, Cmd+`)
- [x] Alle 26 Webview→Main Message Handler
- [x] Claude Code Skills (auto-erstellt bei neuen Projekten)
- [x] .claude/ Ordner im File Tree sichtbar
- [x] Drag & Drop Bilder in den Editor (Finder + Sidebar)
- [x] File Watcher (chokidar) für externe Edits
- [x] **Refactoring:** Main Process modularisiert (index.ts 1.699 → 154 Z., aufgeteilt in 8 Module)
- [x] **Refactoring:** Renderer modularisiert (App.svelte 1.067 → 834 Z., State + MessageHandler extrahiert)
- [x] Start Screen mit Onboarding (Typst-Check, New Project/Open File/Open Folder, AI Terminal Info, 3 Skills)

### Session 3 — Spellcheck, Code-Editor, PDF-Viewer

- [x] Electron Spellchecker mit Sprach-Sync aus Typst-Settings
- [x] Natives Kontextmenü mit Rechtschreibvorschlägen + "Add to Dictionary"
- [x] CodeMirror 6 Code-Editor (ersetzt textarea in TextFileViewer)
- [x] Typst Syntax-Highlighting (Custom StreamLanguage)
- [x] "Open as Text" für .typ Dateien (Rechtsklick in Sidebar)
- [x] PDF In-App Viewer mit pdf.js (Text markierbar via TextLayer)
- [x] SVG/PDF Preview Toggle im Preview-Panel
- [x] Binary File Read IPC (textfile:readBinary)
- [x] TipTap Editor Mount-Fix (Element immer im DOM)
- [x] File Locking für Shared Folders (lockManager.ts, Heartbeat, Stale-Detection)
- [x] MCP Server (11 Tools, Phase 1+2, getestet mit Claude Desktop)
  - Eigenständiges CLI-Tool (`npm run build:mcp` → `dist/mcp/server.mjs`)
  - @modelcontextprotocol/sdk + StdioServerTransport
  - Tools: set_project, get/update_document, compile, get/update_settings, list/read/write_files, export_pdf
  - Dynamischer Projektwechsel (kein hardcoded Pfad in Config)

### Offen (Phase E5: Polish & Packaging)

- [ ] electron-store Persistenz (Recent Projects, Panel State, Window Position)
- [ ] MCP Server Phase 3 (Style Templates, Chapters, Citations, Git, DOCX Export)
- [ ] MCP Server Phase 4 (Resources, Electron IPC-Bridge, Live-Updates)
- [ ] Lizenz-Management (Polar — License Keys + Device Activation)
- [ ] Auto-Update (electron-updater)
- [ ] App Icon & Branding
- [ ] macOS Notarization, Windows Code Signing
- [ ] DMG/EXE/AppImage Packaging
