# vswrite Desktop — Roadmap & Offene Aufgaben

> **Stand:** 2026-03-26 (nach Session 4: MCP Server + Persistenz)
> Was noch fehlt, um die Anwendung vollständig und auslieferbar zu machen.

---

## Erledigte Aufgaben

### Session 1 — Features

- [x] Drag & Drop Bilder in den Editor (Finder + Sidebar)
- [x] Chapters-Tab Live-Update bei Umsortierung
- [x] User Guide öffnet lokales Handbuch
- [x] Bild-Dialog (Width, Alt, Align) funktioniert
- [x] Bilder werden im Editor gerendert (vswrite-asset:// Protocol)
- [x] @ Citation Autocomplete funktioniert
- [x] File Watcher für externe Änderungen (chokidar)
- [x] Project Templates mit Modal-Dialog (5 Templates)
- [x] Eigene Style Templates importieren
- [x] Markdown → Typst Import
- [x] Zotero Better BibTeX Integration
- [x] Guard: Bilder nicht in Code-Blöcke einfügbar
- [x] documentBaseUri Timing gefixt (Bilder nach Neustart sichtbar)
- [x] Citations laden automatisch beim Datei-Öffnen

### Session 2 — Refactoring + Start Screen

- [x] **Refactoring Main Process:** index.ts 1.699 → 154 Zeilen, aufgeteilt in 8 Module (appState, ipcHandlers, fileManager, importExport, projectManager, menuBuilder, gitManager)
- [x] **Refactoring Renderer:** App.svelte 1.067 → 834 Zeilen, State + MessageHandler extrahiert (appState.svelte.ts, messageHandler.ts)
- [x] **Start Screen:** Zeigt sich wenn keine Datei offen ist, mit New Project / Open File / Open Folder Buttons
- [x] **Typst-Check:** Automatische Erkennung ob `typst` im PATH ist, plattformspezifische Installationsanleitung
- [x] **Terminal/AI Info:** Onboarding erwähnt Claude Code, OpenAI Codex, Gemini CLI + 3 auto-deployierte Skills

### Session 3 — Spellcheck, Code-Editor, PDF-Viewer

- [x] **Spellcheck:** Electron's eingebauter Hunspell-Spellchecker, Sprache aus Typst-Settings (`#set text(lang: "de")`), natives Kontextmenü mit Vorschlägen + "Add to Dictionary"
- [x] **Code-Editor (CodeMirror 6):** Ersetzt textarea in TextFileViewer — Syntax Highlighting, Zeilennummern, Bracket Matching, History, Search. Sprachen: Typst, Markdown, JSON, YAML
- [x] **Typst Syntax-Highlighting:** Custom StreamLanguage für `#set`, `#show`, `#let`, Kommentare, Strings, Headings, Emphasis, Labels, Math, Zahlen mit Units
- [x] **"Open as Text" für .typ:** Rechtsklick in Sidebar → "Open as Text" öffnet .typ im Code-Editor statt WYSIWYG. Tab zeigt `[Text]` Suffix
- [x] **PDF In-App Viewer:** PDFs aus dem Projekt (z.B. sources/) öffnen als Tab mit pdf.js, virtualisiertes Rendering, Text markierbar & kopierbar (TextLayer)
- [x] **PDF Preview Modus:** SVG/PDF Toggle im Preview-Header, kompiliert zu PDF statt SVG, ebenfalls mit TextLayer
- [x] **TipTap Mount Fix:** Editor-Element immer im DOM (statt in `{:else}` Block), behebt leeren Editor nach StartScreen

### Session 4 — MCP Server + Persistenz

- [x] **MCP Server Phase 1+2 (11 Tools):** set_project, get/update_document, open_file, compile, get/update_settings, list/read/write_files, export_pdf. Eigenständiges CLI-Tool, getestet mit Claude Desktop
- [x] **MCP Server Phase 3 (15 Tools):** list/apply_style, get/reorder/add/remove_chapters, merge/split_document, get/add_citations, ensure_bibliography, create_project, git_status/commit/push. Total: 26 Tools
- [x] **File Locking:** lockManager.ts für Shared Folders (Dropbox, iCloud), Heartbeat, Stale-Detection, Dialog
- [x] **electron-store Persistenz:** Window-Bounds, Panel-States, Recent Projects (max 10 mit StartScreen-Liste), Auto-Reopen, Onboarding-Flag, Zotero-Pfad
- [x] **Lizenzierung:** Lemon Squeezy → Polar gewechselt (besseres Onboarding, günstigere Gebühren, Desktop-App-freundliche API)

---

## Priorität 1: Nächste Schritte

### Handbuch in den Build integrieren

**Problem:** Handbuch-Pfad ist relativ zum Source — funktioniert nur im Dev-Modus.

**Lösung:** `electron-builder extraResources` → `handbuch.md` wird in `app.getPath('userData')` oder `process.resourcesPath` gebundelt.

---

## Priorität 2: Polish

### App Icon & Branding
- Icon 1024x1024 (macOS), ICO (Windows)
- About Dialog
- Splash Screen

### Lizenz-Management (Polar)
- License Key Eingabe beim ersten Start (Settings-Dialog)
- Polar API Validierung (keine serverseitige Auth nötig, direkt aus Electron)
- Geräte-Aktivierung mit `polar.customerPortal.licenseKeys.activate()` (max N Geräte pro Lizenz)
- Validierung bei jedem App-Start mit `polar.customerPortal.licenseKeys.validate()`
- Brandable Key-Prefix: `VSWRITE_xxxx-xxxx-xxxx`
- Auto-Revoke bei Abo-Kündigung
- Offline Grace Period (30 Tage, lokal in electron-store)
- electron-store für Key + Activation-ID Persistenz

### Auto-Update
- `electron-updater` + GitHub Releases
- Update-Benachrichtigung in Status Bar

### Code Signing & Packaging
| Plattform | Tool | Kosten |
|-----------|------|--------|
| macOS | electron-builder + Notarization | 99$/Jahr |
| Windows | electron-builder + EV Certificate | ~300€/Jahr |
| Linux | AppImage + .deb | Kostenlos |

---

## Priorität 3: MCP Server & Zusätzliche Features

### ~~MCP Server (Model Context Protocol)~~ — Phase 1-3 erledigt (26 Tools)
> Detaillierter Plan: [mcp-server-plan.md](mcp-server-plan.md)

**Phase 4 (offen):** MCP Resources, Electron IPC-Bridge, Live-Updates, DOCX Export

### Dark Mode
- `nativeTheme.shouldUseDarkColors` erkennen
- Dunkles Theme für Editor, Sidebar, Toolbar
- Toggle in Settings

### ~~Spell Check~~ (erledigt Session 3)
- ~~Electron's eingebauter Spellchecker~~
- ~~Sprache aus Document Settings~~

### ~~Verbesserter Text-Editor~~ (erledigt Session 3)
- ~~Syntax Highlighting (CodeMirror 6)~~
- ~~Zeilennummern~~

### ~~PDF-in-App Viewer~~ (erledigt Session 3)
- ~~pdf.js Integration statt externe App~~

---

## Release-Checkliste (v1.0)

### Muss (Blocker)
- [x] ~~Start Screen mit Onboarding~~ (erledigt)
- [x] ~~Refactoring (index.ts + App.svelte aufteilen)~~ (erledigt)
- [x] ~~Spellcheck~~ (erledigt)
- [x] ~~Code-Editor mit Syntax Highlighting~~ (erledigt)
- [x] ~~PDF In-App Viewer~~ (erledigt)
- [x] ~~electron-store Persistenz~~ (erledigt)
- [x] ~~MCP Server Phase 1-3~~ (erledigt, 26 Tools)
- [ ] Handbuch im Build gebundelt
- [ ] App Icon & Branding
- [ ] Lizenz-Management (Polar)
- [ ] macOS DMG Packaging + Notarization
- [ ] Auto-Update

### Sollte (v1.0 oder kurz danach)
- [x] ~~MCP Server Phase 1-3~~ (erledigt, 26 Tools)
- [ ] Windows Installer + Code Signing
- [ ] Linux AppImage
- [ ] Dark Mode
- [ ] About Dialog

### Testing
- [ ] 1 Woche internes Testing
- [ ] macOS Intel + Apple Silicon
- [ ] Windows 10/11
- [ ] Verschiedene Typst-Versionen
- [ ] Große Dokumente (>50 Seiten)
