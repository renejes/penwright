# vswrite Desktop — Roadmap & Offene Aufgaben

> **Stand:** 2026-03-26 (nach Session 5: Licensing, Branding)
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

### Session 5 — Licensing, Branding

- [x] **Lizenz-Management (Polar SDK):** licenseManager.ts mit Polar SDK Integration, LicenseDialog.svelte (Key-Eingabe, Validierung, Deaktivierung), Persistenz in electron-store, Status Bar Badge (Unlicensed/Licensed/Pro), MCP Server feature-gated für Pro-User, benutzerfreundliche Fehlermeldungen
- [x] **App Icon & Branding:** Logo SVG designed (Pen-V + S in Rounded Rectangle), build/icons/ mit allen Größen für electron-builder, StartScreen mit großem 512px Logo, electron-builder Config in package.json
- [x] **Handbuch:** Verlinkt jetzt auf vswrite.netlify.app/de/docs (externe Website), nicht mehr im Build gebundelt
- [x] **macOS Code Signing:** Developer ID Application Certificate konfiguriert, Hardened Runtime Entitlements, electron-builder-notarize
- [x] **MCP Prompts:** 3 Skill-Dateien (typst, vswrite, research) als MCP Prompts exponiert für Claude Desktop

---

## Priorität 1: Nächste Schritte (Session 6)

### 1. DMG bauen und testen

**Vorbereitung (einmalig):**
```bash
# App-spezifisches Passwort generieren: https://appleid.apple.com → App-Specific Passwords
export APPLE_ID="r.f.jesser@gmail.com"
export APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"
export APPLE_TEAM_ID="3LAHNFWNT3"
```

**Build-Befehl:**
```bash
npm run build && npm run build:mcp && npm run package:mac
```

**Output:** `release/vswrite-{version}.dmg` + `release/vswrite-{version}-mac.zip`

**Was passiert beim Build:**
1. `electron-vite build` → kompiliert Main/Preload/Renderer nach `dist/`
2. `electron-builder --mac` → verpackt `dist/` + `node_modules` in `.app`
3. Code Signing mit "Developer ID Application: Rene Jesser (3LAHNFWNT3)"
4. Notarization: App wird an Apple gesendet, geprüft, und gestempelt
5. DMG + ZIP werden in `release/` erstellt

### 2. Ausführliches Testing

**Funktions-Test (auf eigenem Mac):**
- [ ] DMG öffnen → App in Applications ziehen → starten (keine Gatekeeper-Warnung)
- [ ] Neues Projekt erstellen (alle 5 Templates testen)
- [ ] Datei öffnen, bearbeiten, speichern
- [ ] Preview (SVG + PDF Modus)
- [ ] Terminal öffnen, `echo "test"` ausführen
- [ ] Git: Init, Stage, Commit
- [ ] PDF aus sources/ öffnen (In-App Viewer)
- [ ] Lizenz eingeben → "Pro" in Status Bar
- [ ] MCP Server: `npm run build:mcp` im Projekt, Claude Desktop verbinden
- [ ] App schließen → Fensterposition + Panels merken → App öffnen → wiederhergestellt
- [ ] Recent Projects im StartScreen

**Edge Cases:**
- [ ] Typst nicht installiert → Warnung im StartScreen
- [ ] Große Dokumente (>50 Seiten) → Performance ok?
- [ ] File Locking: Gleiche Datei in zwei Instanzen öffnen → Lock-Dialog
- [ ] Offline: WLAN aus → Lizenz funktioniert (Grace Period)
- [ ] Falscher Lizenz-Key → benutzerfreundliche Fehlermeldung

**Plattform-Tests:**
- [ ] macOS Apple Silicon (eigener Mac)
- [ ] macOS Intel (falls verfügbar, oder Rosetta-Kompatibilität prüfen)

### 3. GitHub Release Repo erstellen

**Einmalig:**
1. Public Repo `renejes/vswrite-releases` auf GitHub erstellen (leer, kein README)
2. Kurze Beschreibung: "Official releases for vswrite Desktop — WYSIWYG Editor for Typst"

### 4. Release hochladen

**Workflow bei jedem Release:**
```bash
# 1. Version in package.json hochsetzen (z.B. 1.0.0)
# 2. Bauen
npm run build && npm run build:mcp && npm run package:mac

# 3. Linux AppImage bauen (optional, auf Linux-Maschine oder CI)
# npm run package:linux

# 4. Release erstellen im Public Repo
gh release create v1.0.0 \
  release/vswrite-1.0.0.dmg \
  release/vswrite-1.0.0-mac.zip \
  --repo renejes/vswrite-releases \
  --title "vswrite v1.0.0" \
  --notes "$(cat <<'NOTES'
## vswrite v1.0.0 — Initial Release

WYSIWYG Editor for Typst documents.

### Downloads
- **macOS:** `vswrite-1.0.0.dmg` (Universal, signiert + notarisiert)
- **Linux:** kommt bald

### Voraussetzungen
- Typst CLI: `brew install typst` (macOS) / `winget install typst` (Windows)

### Features
- WYSIWYG Editor mit Typst Round-Trip
- 26-Tool MCP Server für Claude Desktop / Codex
- Integrierter Terminal, PDF-Viewer, Git, Spellcheck
- Polar Lizenz-Management

Vollständiges Handbuch: https://vswrite.netlify.app/de/docs
NOTES
)"
```

### 5. Homepage Download-Link

Auf vswrite.netlify.app/pricing oder /download:
```
https://github.com/renejes/vswrite-releases/releases/latest/download/vswrite-1.0.0.dmg
```

Oder generisch (zeigt immer auf den neuesten Release):
```
https://github.com/renejes/vswrite-releases/releases/latest
```

---

## Priorität 2: Nach v1.0 Release

### Auto-Update
- `electron-updater` + GitHub Releases (aus `vswrite-releases` Repo)
- Update-Benachrichtigung in Status Bar
- Konfiguration: `publish.provider: "github"`, `publish.owner: "renejes"`, `publish.repo: "vswrite-releases"`

### Linux AppImage
- `npm run package:linux` → AppImage + .deb
- Kein Code Signing nötig
- Im gleichen GitHub Release hochladen

### Dark Mode
- `nativeTheme.shouldUseDarkColors` erkennen
- Dunkles Theme für Editor, Sidebar, Toolbar
- Toggle in Settings

### About Dialog
- App-Version, Logo, Links zu Homepage/Handbuch/GitHub

### Windows Installer (hinten angestellt)
- `npm run package:win` → NSIS Installer
- EV Code Signing Certificate (~300€/Jahr) — erst wenn Windows-Nachfrage da ist

---

## Priorität 3: Spätere Features

### MCP Server Phase 4
- MCP Resources, Electron IPC-Bridge, Live-Updates, DOCX Export
> Detaillierter Plan: [mcp-server-plan.md](mcp-server-plan.md)

---

## Release-Checkliste (v1.0)

### Erledigt
- [x] Start Screen mit Onboarding
- [x] Refactoring (index.ts + App.svelte aufteilen)
- [x] Spellcheck
- [x] Code-Editor mit Syntax Highlighting
- [x] PDF In-App Viewer
- [x] electron-store Persistenz
- [x] MCP Server Phase 1-3 (26 Tools + 3 Prompts)
- [x] Handbuch (verlinkt auf externe Website)
- [x] App Icon & Branding
- [x] Lizenz-Management (Polar)
- [x] macOS Code Signing + Notarization konfiguriert

### Offen (Session 6)
- [ ] DMG bauen und lokal testen
- [ ] Funktions-Tests (alle Features durchklicken)
- [ ] Edge-Case-Tests (Offline, große Dokumente, File Locking)
- [ ] `vswrite-releases` Public Repo erstellen
- [ ] Ersten Release hochladen (`gh release create`)
- [ ] Download-Link auf Homepage einbauen

### Nach v1.0
- [ ] Auto-Update (electron-updater)
- [ ] Linux AppImage
- [ ] Dark Mode
- [ ] About Dialog
- [ ] Windows Installer (wenn Nachfrage)
