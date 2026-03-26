# vswrite Desktop — Roadmap & Offene Aufgaben

> **Stand:** 2026-03-26 (nach Session 3: Spellcheck, Code-Editor, PDF-Viewer)
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

---

## Priorität 1: Nächste Schritte

### electron-store Persistenz

**Problem:** App-State geht beim Neustart verloren.

**Was speichern:**
- Recent Projects Liste
- Zuletzt geöffnetes Projekt (auto-reopen)
- Panel-Zustände (Sidebar/Preview/Terminal offen/zu)
- Panel-Größen (sidebarWidth, previewWidth, terminalHeight)
- Window-Position und -Größe
- Onboarding "gesehen"
- Zotero .bib Pfad (für auto-reconnect)

### Handbuch in den Build integrieren

**Problem:** Handbuch-Pfad ist relativ zum Source — funktioniert nur im Dev-Modus.

**Lösung:** `electron-builder extraResources` → `handbuch.md` wird in `app.getPath('userData')` oder `process.resourcesPath` gebundelt.

---

## Priorität 2: Polish

### App Icon & Branding
- Icon 1024x1024 (macOS), ICO (Windows)
- About Dialog
- Splash Screen

### Lizenz-Management (Lemon Squeezy)
- License Key Eingabe beim ersten Start
- Lemon Squeezy API Validierung
- Offline Grace Period (30 Tage)
- electron-store für Key Persistenz

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

## Priorität 3: Zusätzliche Features

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

### Multiple Terminals
- Tab-System, mehrere Shells

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
- [ ] electron-store Persistenz (Recent Projects, Panel State)
- [ ] Handbuch im Build gebundelt
- [ ] App Icon & Branding
- [ ] Lizenz-Management (Lemon Squeezy)
- [ ] macOS DMG Packaging + Notarization
- [ ] Auto-Update

### Sollte (v1.0 oder kurz danach)
- [ ] Windows Installer + Code Signing
- [ ] Linux AppImage
- [ ] Dark Mode
- [ ] Spell Check
- [ ] About Dialog

### Testing
- [ ] 1 Woche internes Testing
- [ ] macOS Intel + Apple Silicon
- [ ] Windows 10/11
- [ ] Verschiedene Typst-Versionen
- [ ] Große Dokumente (>50 Seiten)
