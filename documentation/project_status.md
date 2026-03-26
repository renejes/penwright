# vswrite Desktop — Project Status

> **Stand:** 2026-03-26 (nach Session 5: Lizenz-Management + App Icon & Branding)
> **Version:** 0.6.0

---

## Zusammenfassung

vswrite Desktop ist eine eigenständige Electron Desktop-App, portiert aus der vswrite VS Code Extension. Die App bietet einen WYSIWYG-Editor für Typst-Dokumente mit integriertem Terminal, Live-Preview, Dateimanager, Git-Integration, Zotero-Anbindung und Claude Code Skills.

**Codebase:** ~18.000 Zeilen in 71 Dateien (nach Lizenz-Management + Branding)
- Main Process: ~2.768 Zeilen in 15 Dateien (modular aufgeteilt)
  - ipcHandlers.ts 492, fileManager.ts 396, importExport.ts 313, projectManager.ts 296
  - index.ts 220, persistenceManager.ts 191, licenseManager.ts 160, lockManager.ts 157
  - menuBuilder.ts 131, typstCompiler 121, gitManager.ts 84, terminalManager 78
  - preload 75, appState.ts 48, deserializer-bridge 6
- Renderer: ~5.096 Zeilen (App.svelte 974, appState.svelte.ts 140, messageHandler.ts 192, main.ts 9, assets.d.ts 9, 14 Components inkl. StartScreen + LicenseDialog)
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
| Code-Editor | CodeMirror 6 | 6.x |
| PDF Viewer | pdfjs-dist | 5.x |
| MCP Server | @modelcontextprotocol/sdk | 1.28 |
| Persistenz | electron-store | 10.x |
| Lizenz-Management | @polar-sh/sdk | 0.x |
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
- [x] 34 IPC Message Handler, 30 IPC Channels
- [x] Modularer Main Process (8 Module statt 1 Monolith)
- [x] Modularer Renderer (State + MessageHandler extrahiert)
- [x] Start Screen mit Onboarding (Typst-Check, AI/Terminal Info, 3 Skills)
- [x] App Icon & Branding (Logo SVG, build/icons/ 16-1024px, electron-builder Config, appId: com.vswrite.desktop)
- [x] StartScreen zeigt großes Logo (512px) statt Text-Logo
- [x] "Open User Guide" verlinkt auf vswrite.netlify.app/de/docs

**MCP Server (Model Context Protocol) — 26 Tools:**
- [x] MCP Server als eigenständiges CLI-Tool (`src/mcp/server.ts`, ~800 Zeilen)
- [x] Phase 1+2: set_project, get/update_document, open_file, compile, get/update_settings, list/read/write_files, export_pdf
- [x] Phase 3: list/apply_style, get/reorder/add/remove_chapters, merge/split_document, get/add_citations, ensure_bibliography, create_project, git_status/commit/push
- [x] @modelcontextprotocol/sdk + StdioServerTransport
- [x] Dynamischer Projektwechsel (kein hardcoded Pfad in Config)
- [x] Getestet mit Claude Desktop (Cowork)
- [x] Setup-Anleitung im Handbuch dokumentiert

**Persistenz (electron-store):**
- [x] Window-Bounds (Position, Größe, Maximized) — speichert bei Close, stellt bei Start wieder her
- [x] Panel-States (Sidebar/Preview/Terminal offen/zu, Größen, aktiver Tab) — debounced
- [x] Recent Projects (max 10) — im StartScreen als klickbare Liste
- [x] Auto-Reopen letztes Projekt beim App-Start
- [x] Onboarding "gesehen" Flag
- [x] Zotero .bib Pfad
- [x] Lizenz-Daten (Key, Status, Ablaufdatum, Offline-Grace-Period)

**Lizenz-Management (Polar):**
- [x] `licenseManager.ts` mit Polar SDK (activate, validate, deactivate, 30-Tage Offline-Grace)
- [x] `LicenseDialog.svelte` (Key-Eingabe, Status-Anzeige, Deaktivierung, Upgrade-Button)
- [x] 5 neue IPC Channels (license:activate/validate/deactivate/getStatus/openCheckout)
- [x] Status Bar zeigt "Unlicensed" / "Licensed" / "Pro" — klickbar zum Dialog
- [x] MCP Server Feature-gated: erfordert Pro-Lizenzschlüssel
- [x] Benutzerfreundliche Fehlermeldungen (ungültige Keys, Gerätelimits, Offline)
- [x] electron-store und @polar-sh/sdk gebundelt statt externalisiert (ESM/CJS Interop-Fix)

### Offen

- [ ] MCP Server Phase 4 (Resources, Electron IPC-Bridge)
- [ ] App Packaging (DMG, EXE, AppImage)
- [ ] Auto-Update (electron-updater)
- [ ] Dark Mode
- [ ] Handbuch im Build gebundelt (aktuell: Link auf vswrite.netlify.app/de/docs)

---

## Refactoring (erledigt)

Die beiden Monolith-Dateien wurden erfolgreich aufgeteilt:

**Main Process** (`index.ts` 1.699 → 154 Zeilen):

| Modul | Zeilen | Inhalt |
|-------|--------|--------|
| `appState.ts` | 48 | Zentrales State-Objekt (von allen Modulen importiert) |
| `index.ts` | 220 | Entry Point: Window, Terminal, Lifecycle |
| `ipcHandlers.ts` | 492 | Switch-Statement Message Router + Dialog/Filetree/Includes |
| `fileManager.ts` | 396 | File I/O, Auto-Save, Compiler, File Watcher, Preamble Stripper |
| `importExport.ts` | 313 | PDF, DOCX, Markdown Import, Zotero, Style Templates, Citations |
| `projectManager.ts` | 296 | New Project, File Tree, Claude Skills, Images, Settings |
| `persistenceManager.ts` | 191 | electron-store: Window-Bounds, Panel-States, Lizenz-Daten |
| `licenseManager.ts` | 160 | Polar SDK: Lizenz-Aktivierung, Validierung, Offline-Grace |
| `lockManager.ts` | 157 | File Locking für Shared Folders |
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
| electron-store/@polar-sh/sdk ESM in CJS Main | Bundling statt Externalisierung in electron-vite Config |
