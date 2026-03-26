# vswrite Desktop — Project Status

> **Stand:** 2026-03-26 (nach Session 3: Spellcheck, Code-Editor, PDF-Viewer)
> **Version:** 0.4.0

---

## Zusammenfassung

vswrite Desktop ist eine eigenständige Electron Desktop-App, portiert aus der vswrite VS Code Extension. Die App bietet einen WYSIWYG-Editor für Typst-Dokumente mit integriertem Terminal, Live-Preview, Dateimanager, Git-Integration, Zotero-Anbindung und Claude Code Skills.

**Codebase:** ~16.200 Zeilen in 60 Dateien (nach Refactoring + Start Screen)
- Main Process: ~1.977 Zeilen in 12 Dateien (modular aufgeteilt)
  - index.ts 154, appState.ts 48, ipcHandlers.ts 412, fileManager.ts 309
  - importExport.ts 310, projectManager.ts 296, menuBuilder.ts 131
  - gitManager.ts 84, typstCompiler 87, terminalManager 78, preload 62, deserializer-bridge 6
- Renderer: ~3.400 Zeilen (App.svelte ~870, appState.svelte.ts 132, messageHandler.ts 166, main.ts 9, 10 Components inkl. StartScreen)
- Editor (aus Extension): ~5.640 Zeilen (Lib 3.826, Components 1.814)
- Shared: ~2.555 Zeilen (10 Module inkl. markdownImporter)
- CLI (aus Extension): ~800 Zeilen

**Weitere Dokumente:**
- [handbuch.md](handbuch.md) — Nutzer-Handbuch
- [electron-architecture.md](electron-architecture.md) — Architektur-Dokumentation
- [roadmap.md](roadmap.md) — Offene Aufgaben und Roadmap
- [refactoring-plan.md](refactoring-plan.md) — Refactoring-Plan

---

## Technologie-Stack

| Komponente | Technologie | Version |
|-----------|-------------|---------|
| App-Framework | Electron | 41.0.4 |
| Build-Tool | electron-vite | 5.0.0 |
| UI-Framework | Svelte 5 | Runes ($state, $derived, $effect) |
| Rich-Text Editor | TipTap | 3.x (ProseMirror) |
| Terminal | node-pty + xterm.js | 1.x / 6.x |
| Git | simple-git | 3.x |
| File Watching | chokidar | 4.x |
| Word Export | docx | 9.x |
| Asset Protocol | vswrite-asset:// | Custom Electron Protocol |

---

## Feature-Status

### Vollständig implementiert

**Editor:**
- [x] WYSIWYG Editor (TipTap/ProseMirror) mit allen Formatierungen
- [x] Typst ↔ TipTap Round-Trip (Serializer/Deserializer/Reconciler)
- [x] Multi-Tab Editor mit Tab-Bar und Rechtsklick-Menü
- [x] Text-Editor für .bib, .txt, .md, .yaml etc.
- [x] Bilder: Pick Dialog, Drag & Drop (Finder + Sidebar), Bild-Dialog (Width/Alt/Align)
- [x] Bild-Rendering im Editor via `vswrite-asset://` Custom Protocol
- [x] Raw Blocks für Typst-Code, Slash Commands, Citation Autocomplete (@)
- [x] Suchen & Ersetzen, Focus Mode, Typewriter Mode
- [x] Guard: Bilder nicht in Code-Blöcke einfügbar
- [x] Rechtschreibprüfung (Electron Spellchecker, Sprache aus Typst-Settings, Kontextmenü mit Vorschlägen)
- [x] Code-Editor (CodeMirror 6) für .bib, .md, .yaml, .json etc. — Syntax Highlighting, Zeilennummern, Bracket Matching
- [x] "Open as Text" für .typ Dateien (Rechtsklick → Raw-Editing im Code-Editor)
- [x] Typst Syntax-Highlighting im Code-Editor (#set, #show, Kommentare, Strings, Headings)

**Sidebar (4 Tabs):**
- [x] Files: Dateibaum, Navigate Up, Open Folder, Drag-Bilder
- [x] Outline: Live Heading-Hierarchie, Click-to-Navigate
- [x] Chapters: Include-Manager mit sofortigem UI-Update bei Umsortierung
- [x] Git: Status, Stage/Unstage, Commit, Push/Pull, Init

**Preview:**
- [x] Typst → SVG Kompilierung (Root-File für Chapters)
- [x] Auto-Scroll zu Chapter-Position, Scroll-Erhaltung bei Recompile
- [x] SVG/PDF Preview Toggle (pdf.js mit TextLayer für Textauswahl)

**Import/Export:**
- [x] PDF Export (typst compile)
- [x] DOCX Export (docx-Library)
- [x] PDF In-App Viewer (pdf.js, Text markieren & kopieren, virtualisiertes Rendering)
- [x] Markdown → Typst Import (eigener Converter)
- [x] Zotero Better BibTeX Integration (File Watcher, Auto-Sync)
- [x] Eigene Style Templates importieren (.typ Datei → nur Preamble extrahiert)

**Projekt-Management:**
- [x] 5 Projekt-Templates (Document, Thesis, Paper, Letter, Book) mit Modal-Dialog
- [x] Document Settings, Quick Settings, 7 Style Templates
- [x] Merge/Split Document, Citation Management
- [x] Claude Code Skills auto-erstellt (.claude/skills/)
- [x] File Watcher für externe Änderungen (chokidar)
- [x] File Locking für Shared Folders (Dropbox, iCloud, OneDrive)
  - Lock-Datei (.filename.typ.lock) mit User, Machine, Timestamp
  - Heartbeat alle 30s, Stale-Detection nach 2 Min
  - Dialog: Read-Only / Open Anyway / Cancel
  - Automatisches Release bei Close/Quit/Crash

**App Shell:**
- [x] macOS Titlebar (hiddenInset), native Menüs
- [x] Status Bar mit Panel-Toggles und Save-Indikator
- [x] Resizeable Panels, Keyboard Shortcuts
- [x] Terminal (node-pty + xterm.js), Auto-Resize
- [x] 29 IPC Message Handler, 25 IPC Channels
- [x] Modularer Main Process (8 Module statt 1 Monolith)
- [x] Modularer Renderer (State + MessageHandler extrahiert)
- [x] Start Screen mit Onboarding (Typst-Check, AI/Terminal Info, 3 Skills)

**MCP Server (Model Context Protocol):**
- [x] MCP Server als eigenständiges CLI-Tool (`src/mcp/server.ts`, ~300 Zeilen)
- [x] 11 Tools implementiert: set_project, get/update_document, open_file, compile, get/update_settings, list/read/write_files, export_pdf
- [x] @modelcontextprotocol/sdk + StdioServerTransport
- [x] Dynamischer Projektwechsel (kein hardcoded Pfad in Config nötig)
- [x] Getestet mit Claude Desktop (Cowork)
- [x] Setup-Anleitung im Handbuch dokumentiert

### Offen

- [ ] electron-store Persistenz (Recent Projects, Panel State, Window Position)
- [ ] MCP Server Phase 3 (Style Templates, Chapters, Citations, Git, DOCX Export)
- [ ] MCP Server Phase 4 (Resources, Electron IPC-Bridge)
- [ ] App Packaging (DMG, EXE, AppImage)
- [ ] Lizenz-Management (Polar)
- [ ] Auto-Update (electron-updater)
- [ ] Dark Mode

---

## Refactoring (erledigt)

Die beiden Monolith-Dateien wurden erfolgreich aufgeteilt:

**Main Process** (`index.ts` 1.699 → 154 Zeilen):

| Modul | Zeilen | Inhalt |
|-------|--------|--------|
| `appState.ts` | 48 | Zentrales State-Objekt (von allen Modulen importiert) |
| `index.ts` | 154 | Entry Point: Window, Terminal, Lifecycle |
| `ipcHandlers.ts` | 412 | Switch-Statement Message Router + Dialog/Filetree/Includes |
| `fileManager.ts` | 309 | File I/O, Auto-Save, Compiler, File Watcher, Preamble Stripper |
| `importExport.ts` | 310 | PDF, DOCX, Markdown Import, Zotero, Style Templates, Citations |
| `projectManager.ts` | 296 | New Project, File Tree, Claude Skills, Images, Settings |
| `menuBuilder.ts` | 131 | Application Menu (macOS/Windows) |
| `gitManager.ts` | 84 | 8 Git IPC Handler |

**Renderer** (`App.svelte` 1.067 → 834 Zeilen):

| Modul | Zeilen | Inhalt |
|-------|--------|--------|
| `appState.svelte.ts` | 132 | Svelte 5 reaktiver State (.svelte.ts) + Tab/Resize Operationen |
| `messageHandler.ts` | 166 | Alle ExtensionMessage Handler |
| `App.svelte` | 834 | Template + CSS + lokales Wiring |

**Abhängigkeitsrichtung:** `index.ts` → `ipcHandlers` → `fileManager`, `importExport`, `projectManager`, etc. → `appState` (Leaf)

---

## Gelöste Herausforderungen

| Problem | Lösung |
|---------|--------|
| `ELECTRON_RUN_AS_NODE=1` von VS Code | `unset ELECTRON_RUN_AS_NODE` in npm Scripts |
| Style Template Preamble (multi-line #show) | `stripPreamble()` mit Klammer-Tracking |
| Typst SVG Page Numbers (zero-padded) | Directory-Scan statt konstruierte Pfade |
| Bilder nicht sichtbar im Editor | Custom Protocol `vswrite-asset://` |
| Bilder in Code-Blöcke gedroppt | Guard prüft Parent-Node, fügt nach Block ein |
| Citations nicht geladen | Auto-Load bei `ready` + `openFile`, Suche in Root-Dir |
| Chapters-Tab nicht sofort aktualisiert | Lokales State-Update nach IPC-Call |
| Style Template Import mit Body-Content | `stripPreamble()` extrahiert nur Preamble |
