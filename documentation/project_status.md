# vswrite Desktop — Project Status

> **Stand:** 2026-04-17 (nach Session 8: Security-Haertung, Performance-Optimierung, DOCX-Rewrite, About-Dialog)
> **Version (Doku):** 0.7.0 (Pre-Release) — package.json: 0.1.0, vor dem ersten Release auf 0.7.0 bumpen

---

## Zusammenfassung

vswrite Desktop ist eine eigenstaendige Electron Desktop-App, portiert aus der vswrite VS Code Extension. Die App bietet einen WYSIWYG-Editor fuer Typst-Dokumente mit integriertem Terminal, Live-Preview, Dateimanager, Git-Integration, Zotero-Anbindung und Claude Code Skills.

**Status Release-Readiness:**
- Security gehaertet (Path Traversal + Symlink-Bypass + MCP-Pfade + verschluesselte Lizenz)
- Performance-tauglich fuer 100+ Seiten Dokumente (virtualisierte Preview, inkrementeller Serializer, async File-I/O)
- DOCX-Export produziert sauber formatierte Word-Dateien mit Live-Multilevel-Numbering
- About-Dialog zeigt Version + Lizenz + System-Info
- **Offen fuer Launch:** Crash-Telemetrie, Auto-Updater End-to-End-Test, finale QA auf echter 100-Seiten-Thesis

**Codebase:** ~19.500 Zeilen in 74 Dateien
- Main Process: ~2.950 Zeilen (15 Module + pathSecurity.ts)
- Renderer: ~5.400 Zeilen (App.svelte + 15 Components inkl. AboutDialog)
- Editor: ~5.700 Zeilen
- Shared: ~2.700 Zeilen (docxSerializer rewritten mit Word-Styles)
- MCP: ~800 Zeilen
- CLI: ~800 Zeilen (aus Extension, unused)

**Weitere Dokumente:**
- [handbuch.md](handbuch.md) — Nutzer-Handbuch (Deutsch)
- [handbook.md](handbook.md) — User Handbook (English)
- [next-steps.md](next-steps.md) — Release-Plan + Build-Workflow + Security-Audit
- [mcp-server.md](mcp-server.md) — MCP-Server-Dokumentation
- [done/](done/) — Abgeschlossene Plaene (Architektur, Migration, Pricing, etc.)

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
| Lizenz-Verschluesselung | Electron safeStorage | OS-Keychain / DPAPI / libsecret |
| Asset Protocol | vswrite-asset:// | Custom Electron Protocol |

---

## Feature-Status

### Vollstaendig implementiert

**Editor:**
- [x] WYSIWYG Editor (TipTap/ProseMirror) mit allen Formatierungen
- [x] Typst <-> TipTap Round-Trip (Serializer / Deserializer / Reconciler)
- [x] **Inkrementelle Serialisierung** — WeakMap-Cache pro PMNode, Serialize-Cost bei 100 Seiten von ~150 ms auf ~1-2 ms pro Keystroke
- [x] Multi-Tab Editor mit Tab-Bar und Rechtsklick-Menue
- [x] Text-Editor (CodeMirror 6) fuer .bib, .txt, .md, .yaml, .json etc. — Syntax Highlighting, Zeilennummern, Bracket Matching
- [x] "Open as Text" fuer .typ Dateien (Rechtsklick -> Raw-Editing im Code-Editor)
- [x] Typst Syntax-Highlighting im Code-Editor
- [x] Bilder: Pick Dialog, Drag & Drop (Finder + Sidebar), Bild-Dialog (Width/Alt/Align), echte Aspect-Ratio in Export
- [x] Bild-Rendering via `vswrite-asset://` Custom Protocol mit Pfad-Validierung
- [x] Raw Blocks fuer Typst-Code, Slash Commands, Citation Autocomplete (@)
- [x] Suchen & Ersetzen, Focus Mode, Typewriter Mode
- [x] Guard: Bilder nicht in Code-Bloecke einfuegbar
- [x] Rechtschreibpruefung (Electron Spellchecker, Sprache aus Typst-Settings)

**Sidebar (4 Tabs):**
- [x] Files: Dateibaum, Navigate Up, Open Folder, Drag-Bilder
- [x] Outline: Live Heading-Hierarchie, Click-to-Navigate
- [x] Chapters: Include-Manager mit sofortigem UI-Update bei Umsortierung
- [x] Git: Status, Stage/Unstage, Commit, Push/Pull, Init (lokal; GitHub-Repo-Anlegen via Terminal)

**Preview:**
- [x] Typst -> SVG Kompilierung (Root-File fuer Chapters)
- [x] **Virtualisiertes Rendering** via `content-visibility: auto` + `contain-intrinsic-size`
- [x] **Lazy DOMPurify** via IntersectionObserver (Sanitize nur fuer sichtbare Seiten + Vorspann, Cache pro Seite)
- [x] Auto-Scroll zu Chapter-Position, Scroll-Erhaltung bei Recompile
- [x] SVG/PDF Preview Toggle (pdf.js mit TextLayer)
- [x] Async SVG-Reads (parallel via `Promise.all`), async PDF-Read — Main-Prozess blockiert nicht mehr

**Import/Export:**
- [x] PDF Export (typst compile, gebundelte Binary)
- [x] **DOCX Export** — benannte Word-Styles (Heading1-6, Quote, CodeBlock, BibliographyEntry, TableHeader, TableCell, Caption), Page-Size + Margins + Font + Line-Spacing aus Typst-Settings, **Live Multilevel-Heading-Numbering** (Word re-numbert bei Reorder), Citations als `(Autor Jahr)` statt `[citekey]`, lokalisierte TOC-/Bibliography-Labels (DE/EN/FR/ES/IT/PT/NL)
- [x] PDF In-App Viewer (pdf.js, Text markieren & kopieren, virtualisiertes Rendering)
- [x] Markdown -> Typst Import (eigener Converter)
- [x] Zotero Better BibTeX Integration (File Watcher, Auto-Sync)
- [x] Eigene Style Templates importieren (.typ-Datei -> nur Preamble extrahiert)

**Projekt-Management:**
- [x] 5 Projekt-Templates (Document, Thesis, Paper, Letter, Book) mit Modal-Dialog
- [x] Document Settings, Quick Settings, 7 Style Templates
- [x] Merge/Split Document, Citation Management
- [x] Claude Code Skills auto-erstellt (`.claude/skills/`)
- [x] File Watcher fuer externe Aenderungen (chokidar, 3s Self-Save Guard)
- [x] File Locking fuer Shared Folders (Dropbox, iCloud, OneDrive) — Lock-Datei, Heartbeat, Stale-Detection

**App Shell:**
- [x] macOS Titlebar (hiddenInset), native Menues
- [x] Status Bar mit Panel-Toggles, Save-Indikator, Lizenz-Status
- [x] Resizeable Panels, Keyboard Shortcuts
- [x] Terminal (node-pty + xterm.js), Auto-Resize, Max 5 Respawns
- [x] 37+ IPC Message Handler, 35 IPC Channels
- [x] Modularer Main Process (16 Module)
- [x] Modularer Renderer (State + MessageHandler extrahiert)
- [x] Start Screen mit Onboarding (Typst-Check, AI/Terminal Info, Skills)
- [x] App Icon & Branding (Logo SVG, build/icons/ 16-1024px, appId: com.vswrite.desktop)
- [x] **About-Dialog** — Version, Electron/Chromium/Node-Versionen, Platform/Arch, Lizenz-Tier (Unlicensed/Basic/Pro-Badge), Links (User Guide, Website, Report Issue), "Copy Diagnostics" fuer Bug-Reports

**MCP Server (Model Context Protocol) — 26 Tools:**
- [x] Eigenstaendiges CLI-Tool (`src/mcp/server.ts`, ~800 Zeilen)
- [x] Phase 1+2: set_project, get/update_document, open_file, compile, get/update_settings, list/read/write_files, export_pdf
- [x] Phase 3: list/apply_style, get/reorder/add/remove_chapters, merge/split_document, get/add_citations, ensure_bibliography, create_project, git_status/commit/push
- [x] **Path-Validierung fuer alle File-Tools** via `resolveInsideProject()` — blockiert `../`-Traversal und Symlink-Escape
- [x] @modelcontextprotocol/sdk + StdioServerTransport
- [x] Dynamischer Projektwechsel (kein hardcoded Pfad in Config)
- [x] Getestet mit Claude Desktop (Cowork)
- [x] 3 Skill-Dateien als MCP Prompts (typst-reference, vswrite-conventions, research-workflow)
- [x] Pro-Lizenz-Gating (via `--license-key` Flag oder `VSWRITE_LICENSE_KEY` Env)

**Persistenz (electron-store):**
- [x] Window-Bounds (Position, Groesse, Maximized)
- [x] Panel-States (Sidebar/Preview/Terminal offen/zu, Groessen, aktiver Tab)
- [x] Recent Projects (max 10)
- [x] Auto-Reopen letztes Projekt
- [x] Onboarding-Flag
- [x] Zotero .bib-Pfad
- [x] **Lizenz-Daten als verschluesselter Blob** (safeStorage / OS-Keychain / DPAPI / libsecret) — Tampering fuehrt zu Decrypt-Fail, gilt als "keine Lizenz"

**Lizenz-Management (Polar):**
- [x] `licenseManager.ts` mit Polar SDK (activate, validate, deactivate, 30-Tage Offline-Grace)
- [x] `LicenseDialog.svelte` (Key-Eingabe, Status-Anzeige, Deaktivierung, Upgrade-Button)
- [x] 5 IPC Channels (license:activate/validate/deactivate/getStatus/openCheckout)
- [x] Status Bar zeigt "Unlicensed" / "Licensed" / "Pro" — klickbar
- [x] MCP Server Pro-gated
- [x] Benutzerfreundliche Fehlermeldungen (ungueltige Keys, Geraetelimits, Offline)

**Security (Session 6 + 8):**
- [x] **Path Security-Modul** (`src/main/pathSecurity.ts`) mit realpath-basiertem `isPathWithin()` — symlink-sicher, funktioniert auch fuer noch nicht existierende Pfade
- [x] Path-Validierung in ipcHandlers, gitManager, Asset-Protocol, MCP-Server
- [x] Command Injection Fix: `execSync` -> `execFileSync` mit Array-Argumenten
- [x] SVG Injection Fix: DOMPurify-Sanitisierung mit SVG-Profil
- [x] OS-Level Sandbox (`sandbox: true`)
- [x] CSP-Header in index.html
- [x] Terminal-Respawn-Limit
- [x] `app:openExternal` IPC nur fuer `https://`
- [x] Lizenz-Blob OS-verschluesselt
- [x] `@xmldom/xmldom` Vulnerability gefixt

**Code Signing & Packaging (konfiguriert, noch nicht gebaut):**
- [x] Apple Developer ID Application Certificate im Keychain
- [x] Hardened Runtime Entitlements (JIT, Network, File Access)
- [x] electron-builder-notarize konfiguriert
- [x] electron-builder Config in package.json (appId: com.vswrite.desktop, mac/linux/win Targets)
- [x] Typst-Binary pro Platform gebundelt in `resources/bin/typst-{arch}-{platform}`
- [ ] DMG bauen und Notarization real durchlaufen lassen
- [ ] `publish`-Config fuer Auto-Updater in package.json

**Dokumentation:**
- [x] Handbuch 2-sprachig: [handbuch.md](handbuch.md) (Deutsch) + [handbook.md](handbook.md) (Englisch)
- [x] MCP-Server-Doku
- [x] Release-Workflow + Build-Flow + Security-Audit in [next-steps.md](next-steps.md)
- [x] Abgeschlossene Architektur-/Migration-Plaene in [done/](done/) archiviert

### Noch offen vor Launch

- [ ] **Crash-Telemetrie (Sentry)** mit Opt-out-Toggle — kritischster Launch-Enabler
- [ ] **Shortcut-Cheat-Sheet** (`Cmd+/` Overlay) — Discovery-Problem
- [ ] **"Open Sample Project"** im StartScreen — Conversion-Hebel
- [ ] **Bestaetigungsdialoge** bei destruktiven Git-Operationen
- [ ] **Auto-Updater** (electron-updater) einbinden + Firebase-Hosting einrichten + E2E-Test
- [ ] **DMG-Build & Notarization** real durchziehen
- [ ] **QA auf echter 100-Seiten-Thesis** (nicht nur die 8 Test-Chapters)
- [ ] **Netlify-Hosting fuer Handbuch** (de + en) live
- [ ] **package.json Version auf 0.7.0 bumpen** (aktuell 0.1.0)

### Offen (nach v1.0)

- [ ] Dark Mode
- [ ] Deutsche UI-Uebersetzung (UI-Strings extrahieren, i18n-Framework)
- [ ] Dokumenten-Zoom (Slider 15-200 %)
- [ ] Linux AppImage + `.rpm` + Windows Installer deployen
- [ ] Offline-Bundling des Handbuchs (via `extraResources` in electron-builder)
- [ ] "Publish to GitHub"-Button (aktuell nur via Terminal + `gh` CLI)
- [ ] Editor-interne Virtualisierung (TipTap rendert aktuell alle DOM-Nodes — Obergrenze liegt bei ~200 Seiten pro Einzel-Datei)
- [ ] MCP Server Phase 4 (Resources, Electron IPC-Bridge)
- [ ] Vollstaendiges WCAG 2.1 AA Accessibility-Audit

---

## Session-Log

### Session 8 (2026-04-17) — Security + Performance + DOCX-Quality + About-Dialog

**Security-Haertung:**
- Path Traversal mit Symlink-Bypass geschlossen: neues Modul `pathSecurity.ts` mit realpath-Aufloesung, angewandt auf ipcHandlers, gitManager, Asset-Protocol-Handler
- MCP-Server: `resolveInsideProject()` in `read_file`/`write_file`/`open_file`/`compile`/`add_citation` — verhindert dass AI-Agents aus dem Projekt-Dir ausbrechen
- Lizenz-Daten: von Plaintext in electron-store auf verschluesselten Blob (safeStorage) umgestellt

**Performance-Optimierungen:**
- Preview-Virtualisierung via `content-visibility: auto` + IntersectionObserver-Lazy-DOMPurify
- Async File-I/O in `fileManager.saveFile`/`openFile`/Watcher + textfile-IPC-Handler
- Parallele async SVG-Reads in `typstCompiler`
- Inkrementelle Serialisierung: `serializeTypstCached()` mit WeakMap-Cache pro PMNode

**DOCX-Export Quality:**
- Komplett-Rewrite auf benannte Word-Styles (Heading1-6, Quote, CodeBlock, BibliographyEntry, TableHeader, TableCell, Caption)
- Page-Size + Margins + Body-Font + Font-Size + Line-Spacing aus Typst-Settings
- Live Multilevel-Heading-Numbering mit Typst-Pattern-Parsing (`"1.1"`, `"A.1"`, `"I.A.1"`, `"1.a"`)
- Citations: Lookup in `.bib` -> `(Autor Jahr)` statt `[citekey]`
- Table-Header-Bug gefixt: Inline-Marks bleiben erhalten, Bold via Style statt Run-Mangling
- Bilder: echte Aspect-Ratio aus PNG-/JPEG-Header
- Lokalisierte TOC-/Bibliography-Labels

**UX:**
- About-Dialog (`AboutDialog.svelte`) mit Version + Electron-Stack + Lizenz-Badge + Links + Diagnostics-Copy
- Menue: macOS App-Menue + Help-Menue auf Windows/Linux, `Help -> Report Issue` auf allen Plattformen
- User-Guide-URL gefixt (war auf totem Stub)

**Docs:**
- Handbuch 2-sprachig (handbuch.md + handbook.md)
- next-steps.md + project_status.md aktualisiert
- Git-Integration-Frage geklaert (lokal + push zu existierendem Remote; Repo-Anlegen via Terminal)

### Session 7 — Typst CLI Bundling

- Typst-Binary pro Platform in `resources/bin/` gebundelt
- `typstPath.ts` resolver (Production: gebundelt, Development: System-PATH)
- File-Watcher Flacker-Fix (Timestamp-Guard)
- Tauri-Migration evaluiert, verworfen

### Session 6 — Security Phase 1 + Recovery + Accessibility

- Path Traversal basic, execSync -> execFileSync, DOMPurify, sandbox:true, CSP
- Crash Recovery (30s Backups), Undo AI Edit (Snapshot-Ring)
- ARIA-Labels, Export Loading-State, CommandHub Redesign

### Session 5 — Lizenz-Management + Branding

- Polar-SDK-Integration, License-Dialog, Pro-Gating
- App-Icon + Branding, Logo-StartScreen

### Sessions 1-4

Siehe [done/electron-migration-log.md](done/electron-migration-log.md) — Port von VS Code Extension zu Electron, Modul-Split, Editor-Features.

---

## Refactoring (erledigt)

Die Monolith-Dateien wurden erfolgreich aufgeteilt:

**Main Process** (urspruenglich `index.ts` 1.699 -> 220 Zeilen):

| Modul | Zeilen | Inhalt |
|-------|--------|--------|
| `appState.ts` | 48 | Zentrales State-Objekt (leaf module) |
| `index.ts` | 220 | Entry Point: Window, Terminal, Lifecycle, Protocol |
| `ipcHandlers.ts` | ~510 | Central IPC message router |
| `fileManager.ts` | ~400 | File I/O, Auto-Save, Compiler, File Watcher |
| `importExport.ts` | ~310 | PDF, DOCX, Markdown, Zotero, Style Templates |
| `projectManager.ts` | ~290 | New Project, File Tree, Claude Skills, Images |
| `persistenceManager.ts` | ~220 | electron-store + safeStorage fuer Lizenz |
| `licenseManager.ts` | 160 | Polar SDK |
| `lockManager.ts` | 157 | File Locking fuer Shared Folders |
| `menuBuilder.ts` | ~145 | Native Menu (macOS/Windows/Linux) |
| `typstCompiler.ts` | ~130 | Async SVG/PDF Compilation |
| `typstPath.ts` | ~30 | Bundled Typst Binary Resolver |
| `gitManager.ts` | ~100 | Git IPC Handlers |
| `terminalManager.ts` | 78 | node-pty Wrapper |
| `pathSecurity.ts` | 40 | **Neu:** Realpath-basierte Path-Validierung |
| `preload-entry.ts` | 77 | IPC-Whitelist |

**Renderer** (`App.svelte` 1.067 -> ~840 Zeilen):

| Modul | Zeilen | Inhalt |
|-------|--------|--------|
| `appState.svelte.ts` | ~145 | Svelte 5 reaktiver State |
| `messageHandler.ts` | ~195 | ExtensionMessage Handler inkl. `showAbout` |
| `App.svelte` | ~840 | Template + lokales Wiring |
| 15 Components | ~2.100 | Inkl. AboutDialog, LicenseDialog, StartScreen, PreviewPanel, etc. |

**Abhaengigkeitsrichtung:** `index.ts` -> `ipcHandlers` -> `fileManager`, `importExport`, `projectManager`, etc. -> `appState` (Leaf)

---

## Geloeste Herausforderungen

| Problem | Loesung |
|---------|---------|
| `ELECTRON_RUN_AS_NODE=1` von VS Code | `unset ELECTRON_RUN_AS_NODE` in npm Scripts |
| Style Template Preamble (multi-line #show) | `stripPreamble()` mit Klammer-Tracking |
| Typst SVG Page Numbers (zero-padded) | Directory-Scan statt konstruierte Pfade |
| Bilder nicht sichtbar im Editor | Custom Protocol `vswrite-asset://` |
| Bilder in Code-Bloecke gedroppt | Guard prueft Parent-Node, fuegt nach Block ein |
| Citations nicht geladen | Auto-Load bei `ready` + `openFile`, Suche in Root-Dir |
| Chapters-Tab nicht sofort aktualisiert | Lokales State-Update nach IPC-Call |
| Style Template Import mit Body-Content | `stripPreamble()` extrahiert nur Preamble |
| electron-store/@polar-sh/sdk ESM in CJS Main | Bundling statt Externalisierung |
| Preview-Flackern bei Auto-Save | 3s Timestamp-Guard im Watcher |
| Sidebar laggt bei 100+ Seiten | `content-visibility: auto` + IntersectionObserver |
| Symlink im Projekt umgeht `isPathWithin` | `fs.realpathSync` vor Vergleich |
| Lizenz-Tier durch JSON-Edit manipulierbar | Verschluesselter Blob via `safeStorage` |
| Serialisierung kostet 150 ms pro Keystroke | WeakMap-Cache pro immutable PMNode |
| DOCX-Output unbrauchbar formatiert | Named Word-Styles + Live-Multilevel-Numbering |
| Table-Header Inline-Marks verschwinden | `TableHeader`-Style statt TextRun-Reassembly |
| Bilder im DOCX gequetscht | PNG-/JPEG-Header-Parsing fuer echte Aspect-Ratio |
