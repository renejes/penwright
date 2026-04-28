# vswrite Desktop — Project Status

> **Stand:** 2026-04-28 (nach Session 11: Wortzahl + Lesezeit in der Status Bar, CommandHub entfernt, native Menues ausgebaut, Writer-Features-Plan)
> **Version (Doku):** 0.7.0 (Pre-Release) — package.json: 0.1.0, vor dem ersten Release auf 0.7.0 bumpen

---

## Zusammenfassung

vswrite Desktop ist eine eigenstaendige Electron Desktop-App, portiert aus der vswrite VS Code Extension. Die App bietet einen WYSIWYG-Editor fuer Typst-Dokumente mit integriertem Terminal, Live-PDF-Preview, Dateimanager, Versionssystem (Git unter der Haube, „Projekt"-UI darueber), Auto-Backup, Zotero-Anbindung und Claude Code Skills.

**Status Release-Readiness:**
- Security gehaertet (Path Traversal + Symlink-Bypass + MCP-Pfade + verschluesselte Lizenz)
- Performance-tauglich fuer 100+ Seiten Dokumente (PDF-Preview via pdf.js, inkrementeller Serializer, async File-I/O)
- **Projekt-First-Class:** App startet am StartScreen; Projekte werden bewusst geoeffnet/geschlossen; jedes Projekt ist self-contained (`.git/`, `.vswrite/backups/`, `.vswrite/ai-snapshots/` im Projektordner)
- **Versionssystem ohne Git-Vokabular:** „Version speichern" / „Verlauf" / „Wiederherstellen" statt Stage/Commit/Branch
- **Auto-Backup pro Projekt:** Crash-Schutz parallel zum Versionssystem, konfigurierbar (Intervall + Max-Anzahl)
- **Export-Modal:** Format-Wahl (PDF/DOCX) + Kapitel-Auswahl per Checkbox; DOCX nutzt jetzt `resolveIncludes` und exportiert Multi-Chapter-Projekte vollstaendig
- DOCX-Export produziert formatierte Word-Dateien mit Live-Multilevel-Numbering (iterative Verbesserung weiterhin im Gange)
- About-Dialog zeigt Version + Lizenz + System-Info
- **Offen fuer Launch:** Crash-Telemetrie, Auto-Updater End-to-End-Test, finale QA auf echter 100-Seiten-Thesis

**Codebase:** ~20.500 Zeilen in 78 Dateien
- Main Process: ~3.300 Zeilen (16 Module + pathSecurity.ts)
- Renderer: ~5.500 Zeilen (App.svelte + 18 Components inkl. ProjectPanel, VersionDetail, BackupListDialog, ExportDialog)
- Editor: ~5.300 Zeilen (CommandHub.svelte entfernt — ~456 Zeilen)
- Shared: ~2.700 Zeilen (docxSerializer mit Word-Styles)
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
- [x] Files: Dateibaum, Navigate Up, **„Neuer Ordner"** (inline input) + **„Asset hinzufügen"** (File-Picker → kopiert nach `assets/`), Drag-Bilder, leere Ordner sichtbar
- [x] Outline: Live Heading-Hierarchie, Click-to-Navigate
- [x] Chapters: Include-Manager mit sofortigem UI-Update bei Umsortierung
- [x] **Project (ehemals Git):** Projekt-Header mit „Im Finder zeigen", „Version speichern"-Card, „Änderungen seit letzter Version" mit Checkboxen, immer sichtbarer Verlauf, Auto-Backup-Status, „Erweitert"-Bereich für Cloud-Sync (Push/Pull/Remote-URL)

**Versionssystem (Drei-Schichten-Modell):**
- [x] **Versionen** (Git unter der Haube): „Version speichern" mit Namensfeld + Checkbox-Auswahl der Dateien → `git commit`. Verlauf-Liste mit Auto-Versionen ausgegraut. Klick auf Eintrag öffnet Versions-Detail mit Quelltext-Diff (rote/grüne Zeilen) + „Wiederherstellen"
- [x] **Auto-Backup** projekt-lokal in `<projekt>/.vswrite/backups/<timestamp>/`: Multi-File-Snapshots (alle `.typ`/`.bib`), Status-Zeile mit Live-Update, Backup-Liste-Dialog mit „Laden", konfigurierbares Intervall (10s–5min) + Max-Anzahl (10/30/100/1000)
- [x] **AI-Edit-Undo** persistiert in `<projekt>/.vswrite/ai-snapshots/`: Ringpuffer überlebt App-Neustart, separate Schicht vom Versionssystem
- [x] **Self-Contained Projekte:** `.git/`, `.gitignore` (mit `.vswrite/`-Eintrag), `.vswrite/`-Skeleton automatisch beim Projektanlegen
- [x] Lazy-Init: Bestehende Projekte ohne `.git/` → bei erstem „Version speichern"-Klick wird init durchgeführt
- [x] Recovery-Dialog beim Öffnen, wenn das jüngste Backup neuer ist als Disk-mtime

**Preview:**
- [x] **PDF-Only** via pdf.js (SVG-Modus entfernt — war bei großen Dokumenten zu langsam, blockierte Main-Thread)
- [x] Viewport-Virtualisierung via pdf.js TextLayer
- [x] Async PDF-Read — Main-Prozess blockiert nicht
- [x] PDF erscheint live während des Tippens (400ms Compile-Debounce)

**Import/Export:**
- [x] **Export-Modal** mit Format-Wahl (PDF/DOCX-Karten) + Kapitel-Auswahl per Checkbox + Bibliography-Toggle + „alle/keine"-Shortcuts. Single-File-Projekte ohne `#include` umgehen das Modal direkt.
- [x] PDF Export (typst compile, gebundelte Binary, gefilterte temporäre `.vswrite-export-temp.typ` für Teil-Export)
- [x] **DOCX Multi-Chapter:** nutzt jetzt `resolveIncludes` vor der Serialisierung — exportiert Multi-Chapter-Projekte vollständig, nicht nur die aktuell offene Datei
- [x] DOCX Word-Styles (Heading1-6, Quote, CodeBlock, BibliographyEntry, TableHeader, TableCell, Caption), Page-Size + Margins + Font + Line-Spacing aus Typst-Settings, **Live Multilevel-Heading-Numbering** (Word re-numbert bei Reorder), Citations als `(Autor Jahr)` statt `[citekey]`, lokalisierte TOC-/Bibliography-Labels (DE/EN/FR/ES/IT/PT/NL)
- [x] DOCX-Deserializer-Verbesserungen: Multi-line Listen (`+ item\n  cont.`), `#align(center + horizon)[…]` mit verschachtelten `#text(…)[X]`, `#datetime.today().display(…)` → heutiges Datum, balanced bracket matching für Title-/Abstract-Pages
- [x] PDF In-App Viewer (pdf.js, Text markieren & kopieren, virtualisiertes Rendering)
- [x] Markdown -> Typst Import (eigener Converter)
- [x] Zotero Better BibTeX Integration (File Watcher, Auto-Sync)
- [x] Eigene Style Templates importieren (.typ-Datei -> nur Preamble extrahiert)
- [x] **Style-Anwendung blockiert wenn nicht in main.typ** (verhinderte stille Korruption von Kapitel-Dateien durch fälschliches Prepend des Stil-Vorspanns)

**Projekt-Management:**
- [x] **Projekt First-Class:** App startet am StartScreen ohne Auto-Reopen; „Neues Projekt" / „Projekt öffnen" / **„Projekt schließen"** (Cmd+Shift+W, mit Save-Prompt) als explizite Menü-Aktionen
- [x] 5 Projekt-Templates (Document, Thesis, Paper, Letter, Book) mit Modal-Dialog
- [x] Templates legen `assets/` + `sources/` Unterordner an (auch leer im File-Tree sichtbar)
- [x] Document Settings, Quick Settings, 7 Style Templates
- [x] Merge/Split Document, Citation Management
- [x] Claude Code Skills auto-erstellt (`.claude/skills/`)
- [x] **Recent Projects als Ordner** (vorher Datei-Pfade) — tote Einträge automatisch gefiltert
- [x] File Watcher fuer externe Aenderungen (chokidar, 3s Self-Save Guard, ignoriert `.vswrite/`)
- [x] File Locking fuer Shared Folders (Dropbox, iCloud, OneDrive) — Lock-Datei, Heartbeat, Stale-Detection

**App Shell:**
- [x] macOS Titlebar (hiddenInset), **native Menueleiste mit fuenf Top-Level-Menues** (File / Edit / View / Document / Help)
- [x] **Document-Menue:** Document Settings, Style-Templates-Submenu (7 + Import Custom), Merge/Split Document, Open as Typst Source, Ensure Bibliography
- [x] **CommandHub entfernt** — alle Aktionen liegen jetzt in der nativen Menueleiste oder Slash-Commands; Toolbar ist minimaler (Quick / Typewriter / Focus rechts)
- [x] Status Bar mit Panel-Toggles, **Wortzahl + Lesezeit (live, 200 wpm)**, Save-Indikator, Filename, Lizenz-Status
- [x] Resizeable Panels, Keyboard Shortcuts
- [x] Terminal (node-pty + xterm.js), Auto-Resize, Max 5 Respawns
- [x] 40+ IPC Message Handler, ~50 IPC Channels
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

**Persistenz (electron-store + projekt-lokal):**
- [x] Window-Bounds (Position, Groesse, Maximized) — global
- [x] Panel-States (Sidebar/Preview/Terminal offen/zu, Groessen, aktiver Tab) — global
- [x] Recent Projects als Ordner-Pfade (max 10), tote Einträge automatisch gefiltert — global
- [x] Auto-Reopen entfernt — App startet immer am StartScreen (bewusste Designentscheidung)
- [x] Onboarding-Flag — global
- [x] Zotero .bib-Pfad — global
- [x] **Lizenz-Daten als verschluesselter Blob** (safeStorage / OS-Keychain / DPAPI / libsecret) — Tampering fuehrt zu Decrypt-Fail, gilt als "keine Lizenz"
- [x] **Backup-Config** (Intervall, Max-Backups, Max-AI-Snapshots) — global
- [x] **Versionen + Auto-Backups + AI-Snapshots projekt-lokal** in `<projekt>/.git/` und `<projekt>/.vswrite/` — wandern mit dem Projekt

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

- [ ] **DOCX-Iteration:** `#raw("…")` inline aufdröseln, `#outline()` als Word-TOC-Field, weitere Typst-Konstrukte nach Bedarf (iterativ — fundamentaler Refactor via Typst→HTML→DOCX optional später)
- [ ] **Crash-Telemetrie (Sentry)** mit Opt-out-Toggle — kritischster Launch-Enabler
- [ ] **Shortcut-Cheat-Sheet** (`Cmd+/` Overlay) — Discovery-Problem (nativen "Keyboard Shortcuts"-Menueeintrag gibt es seit Session 11)
- [ ] **"Open Sample Project"** im StartScreen — Conversion-Hebel
- [ ] **Bestaetigungsdialoge** bei destruktiven Versions-Operationen (Wiederherstellen alter Versionen mit Warndialog ist da; Cloud-Sync-Konflikte fehlen)
- [ ] **Auto-Updater** (electron-updater) einbinden + Firebase-Hosting einrichten + E2E-Test
- [ ] **DMG-Build & Notarization** real durchziehen
- [ ] **QA auf echter 100-Seiten-Thesis** (nicht nur die 8 Test-Chapters)
- [ ] **Netlify-Hosting fuer Handbuch** (de + en) live
- [ ] **package.json Version auf 0.7.0 bumpen** (aktuell 0.1.0)

### Writer-Features (Plan in [writer-features-plan.md](writer-features-plan.md))

Funktionale Reife als Writing-Tool — neun Features mit Implementierungsdetails dokumentiert:

- [ ] **Find in Project** (1 Tag) — Suche ueber alle `.typ`-Dateien
- [ ] **Footnote-UI** (1–1,5 Tage) — Toolbar/Slash-Command + Side-Editor
- [ ] **Cross-References** (1,5–2 Tage) — `<label>` und `@label`-Picker
- [ ] **Comments / Annotations** (2 Tage) — gelbe Margin-Notizen, kompilieren nicht
- [ ] **Outline drag-to-reorder** (1 Tag) — Sektionen in der Outline-Sidebar verschieben
- [ ] **Reading Mode** (½–1 Tag) — Editor in Buchsatz-Typografie
- [ ] **Inline Source Preview** (1 Tag) — Hover auf Citation zeigt PDF-Popover
- [ ] **Backlinks** (½ Tag, nach Find-in-Project) — wo wird ein Heading sonst noch erwähnt?
- [ ] **Manuscript Export** (1 Tag) — Shunn-Format fuer Belletristik

Vorgeschlagene Mini-Releases im Plan: **Polish-Sprint** (Reading Mode + Find + Backlinks + Word-Count [done]), **Annotation-Sprint** (Comments + Outline-Reorder), **Reference-Sprint** (Cross-Refs + Source-Preview).

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

### Session 11 (2026-04-28) — Writer-Tool-Polish: Wortzahl, Hub-Removal, native Menues, Feature-Plan

**Wortzahl + Lesezeit in der Status Bar:**
- Neuer `wordStats` `$derived.by(...)` in [App.svelte](src/renderer/App.svelte) — walks editor JSON, ueberspringt `typstRawBlock` / `codeBlock` / `pagebreak` damit Code nicht mitgezaehlt wird; reagiert live auf `editorVersion.value`
- Anzeige unten rechts: „1.247 words · 5 min read" (200 wpm, mindestens 1 min wenn > 0 Woerter)
- toLocaleString() fuer Tausender-Trennzeichen

**CommandHub komplett entfernt:**
- [CommandHub.svelte](src/editor/components/CommandHub.svelte) geloescht (~456 Zeilen)
- Import + JSX-Block + `openSettings`-Helper aus [App.svelte](src/renderer/App.svelte) raus
- Toolbar rechts schlanker: nur noch ⚙ Quick / ‥ Typewriter / ◎ Focus
- Bundle-Size ~15 KB JS kleiner

**Native Menueleiste ausgebaut:**
- [menuBuilder.ts](src/main/menuBuilder.ts) restrukturiert: fuenf Top-Level-Menues (File / Edit / View / Document / Help) statt drei
- **File:** + Open Sources Folder, + Add Citation Manually
- **Edit:** + Find & Replace (Cmd+F), + Undo AI Edit
- **View:** + Focus Mode, + Typewriter Mode
- **Document (neu):** Document Settings, Style-Templates-Submenu (alle 7 + Import Custom), Merge Document, Split into Chapters, Open as Typst Source, Ensure Bibliography
- **Help:** + Keyboard Shortcuts
- Alle Hub-Aktionen so erreichbar; Slash-Commands bleiben fuer In-Text-Inserts (Image/Math/Table/Citation/etc.)
- Vier neue Renderer-Message-Handler in [messageHandler.ts](src/renderer/messageHandler.ts): `showSearch`, `showShortcuts`, `toggleFocusMode`, `toggleTypewriterMode`

**Writer-Features-Plan:**
- Neue Datei [documentation/writer-features-plan.md](writer-features-plan.md) — pro Feature: Problem, Zielverhalten, Implementierungs-Pfad (Backend/Frontend/Editor mit Datei-Verweisen), Risiken, Aufwandsschaetzung
- Neun Features (Find in Project, Footnote-UI, Cross-References, Comments, Outline-Reorder, Reading Mode, Inline Source Preview, Backlinks, Manuscript Export) mit drei vorgeschlagenen Mini-Release-Sprints

**Doku-Sync:**
- [handbook.md](handbook.md) und [handbuch.md](handbuch.md): Hub-Sektion ersetzt durch „Native menu" / „Native Menueleiste"-Beschreibung mit allen fuenf Menues; Toolbar-Tabelle ohne Hub-Eintrag; alle Hub-Verweise im Fliesstext entfernt; neue Status-Bar-Beschreibung mit Wortzahl/Lesezeit; App-Layout-Diagramm aktualisiert

### Session 10 (2026-04-28) — DOCX-Bugfixes + Add-Folder + Status-Update

**DOCX-Strukturfixes:**
- `resolveIncludes` setzt jetzt `\n\n` zwischen Comment-Marker und Chapter-Inhalt — vorher gluete `// ─── chapter ───` an `= Heading`, das Block wurde als Config gedroppt → alle Kapitel-H1s waren weg, H2-Numbering lief chapter-übergreifend von 1 bis 19
- `parseAlignedBlock` mit balanced-bracket Matching: akzeptiert jetzt `#align(center + horizon)[…]`, splittet Inneres an `#v(…)` + Leerzeilen, unwrapped `#text(size:N, weight:"bold")[X]` → bei size≥18pt zentrierter H1, sonst zentrierter (bold) Paragraph; `#datetime.today().display(…)` → heutiges Datum als Text
- Listen-Parser: erlaubt eingeruckte Folgezeilen (`+ Item\n  Fortsetzung`) — vorher Block-Reject → schmale Vertikal-Spalte in Word

**Bugfixes:**
- **Add Folder:** `window.prompt()` ist im sandboxed Renderer deaktiviert → Inline-Eingabefeld in Sidebar mit Enter/Escape/Blur-Submit
- `previewMode is not defined` ReferenceError in `saveFile` (Restbestand vom SVG-Removal) → letzte Referenz entfernt, Save crasht nicht mehr → Live-PDF-Preview aktualisiert ohne Tab-Switch
- Style-Switch in Kapitel-Dateien wird jetzt blockiert (nativer Dialog erklärt warum); Schutz vor stiller Korruption durch Stil-Vorspann-Prepend

### Session 9 (2026-04-27/28) — Projekt First-Class + Versionssystem + SVG-Removal + Export-Modal

**Projekt-Versionierung (Drei-Schichten):**
- Plan in [done/project-versioning-plan.md](done/project-versioning-plan.md), Phase 1 + 2 abgeschlossen
- `gitManager` um `git:saveVersion`, `git:listVersions`, `git:showVersion`, `git:restoreVersion`, `git:ensureRepo`, `git:getRemote`, `git:setRemote` erweitert
- `persistenceManager` Backup-Storage komplett auf `<projekt>/.vswrite/backups/<timestamp>/` umgestellt (vorher global in userData) — Multi-File-Snapshots inkl. der in-memory Edits
- AI-Snapshots persistieren nach `<projekt>/.vswrite/ai-snapshots/` — überleben App-Neustart
- `projectManager.ensureProjectInfrastructure()`: legt `.git/` + `.gitignore` (mit `.vswrite/`-Eintrag) + `.vswrite/`-Skeleton + Initial-Commit beim Projektanlegen an
- Neue Frontend-Komponenten: `ProjectPanel.svelte` (ersetzt `GitPanel.svelte`), `VersionDetail.svelte` (Modal mit Quelltext-Diff), `BackupListDialog.svelte` (Backup-Liste + ausklappbare Settings)
- Backup-Config (Intervall, Max-Count, Max-AI-Snapshots) in electron-store

**Projekt First-Class:**
- `appState.closeProject` + `closeProjectInteractive` (mit Save-Prompt)
- `projectManager.openProject()` mit Folder-Picker, schließt aktuell offenes Projekt sauber vorher
- File-Menü: „New Project…" (Cmd+N), „Open Project…" (Cmd+O), „Close Project" (Cmd+Shift+W)
- Auto-Reopen beim Startup deaktiviert — App startet immer am StartScreen
- `addRecentProject` semantisch auf Ordner umgestellt; `getRecentProjects` filtert tote Einträge
- StartScreen: „Open File"-Button entfernt, „Open Folder" → „Open Project"
- `handleNewFile` + `'newFile'` IPC-Handler entfernt (jede Datei lebt in einem Projekt)
- Templates legen `assets/` + `sources/` Unterordner an, leere Ordner sind im File-Tree sichtbar
- Sidebar: „Neuer Ordner" + „Asset hinzufügen" Buttons, `.vswrite/` aus File-Tree gefiltert

**SVG-Preview entfernt:**
- `previewMode` + `setupPreviewModeIPC` aus fileManager raus, alle Compile-Aufrufe → `compilePdf()`
- `TypstCompiler.compile()` (SVG) komplett entfernt, nur `compilePdf()` bleibt
- `PreviewPanel.svelte` von ~320 auf ~60 Zeilen reduziert (dünner Wrapper um `PdfPreviewPanel`)
- `pages`/`previewMode`/`scrollToPage` aus `previewState` raus, `previewUpdate`-Message + Handler entfernt
- Bundle-Size ~55 KB JS kleiner

**Export-Modal:**
- `getExportableSections` parsed `#include`-Zeilen + `#bibliography`-Block aus dem Root-File, liest erste H1 jedes Kapitels als Anzeigetitel
- `runFilteredExport` schreibt gefilterte temporäre `.vswrite-export-temp.typ`, kompiliert dort (PDF: typst CLI; DOCX: `resolveIncludes` + Serializer), räumt auf
- `ExportDialog.svelte` mit Format-Karten (PDF/DOCX), Kapitel-Checkboxen, Bibliography-Toggle, „alle/keine"-Shortcuts
- `handleExportPdf`/`handleExportDocx` werden Trigger: Multi-Chapter → Modal, Single-File → direkter Save-Dialog
- DOCX exportiert jetzt das ganze Multi-Chapter-Projekt (vorher nur die offene Datei)

**Diverse Bugfixes:**
- `typstPath.ts`: probiert `/opt/homebrew/bin`, `/usr/local/bin`, `~/.cargo/bin` etc. + `command -v typst` via `/bin/sh -lc` durch — vorher zeigte die App fälschlich „Typst not found", weil GUI-Apps auf macOS keinen Homebrew-PATH erben
- `Sidebar.svelte`: HTML-Entities `&#9662;`/`&#9656;` (in `{...}`-Expression als Text gerendert) durch echte Unicode-Zeichen `▾`/`▸` ersetzt
- `readDirTree` zeigt leere Ordner an
- `.vswrite/` zu `IGNORED_DIRS` hinzugefügt
- `handleNewFolder`/`handleAddAssets` mit Path-Validierung
- AI-Snapshot-Count beim Projektöffnen aus Disk rekonstruiert

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
| `appState.svelte.ts` | ~165 | Svelte 5 reaktiver State inkl. `exportDialogState` |
| `messageHandler.ts` | ~210 | ExtensionMessage Handler inkl. `projectClosed`, `showExportDialog`, `showAbout` |
| `App.svelte` | ~840 | Template + lokales Wiring |
| 18 Components | ~2.700 | Inkl. ProjectPanel, VersionDetail, BackupListDialog, ExportDialog, AboutDialog, LicenseDialog, StartScreen, PreviewPanel, etc. |

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
| Git-Vokabular fuer Schreibende verwirrend | „Versionen"-UI mit „Version speichern" / „Verlauf" / „Wiederherstellen" — Git als Storage-Engine darunter unsichtbar |
| Auto-Reopen lud altes Projekt beim Start | Bewusst entfernt — App startet immer am StartScreen |
| Datei-zentriertes Modell (`projectDir = dirname(file)`) | Projekt First-Class: explizites „Projekt öffnen/schließen", Recents als Ordner-Pfade |
| SVG-Preview blockierte Main-Thread bei großen Dokumenten | SVG-Modus komplett entfernt, PDF-Only via pdf.js (viewport-virtualisiert) |
| `previewMode is not defined` in saveFile blockierte Live-Preview | Letzte Referenz im saveFile-Pfad entfernt |
| `window.prompt()` im sandboxed Renderer deaktiviert (Add Folder ohne Reaktion) | Inline-Eingabefeld in Sidebar |
| `&#9662;`-HTML-Entities als Text gerendert (Sidebar-Icons kaputt) | Echte Unicode-Zeichen `▾`/`▸` in `{...}`-Expressions |
| GUI-App auf macOS findet Homebrew-typst nicht | `typstPath`-Resolver probiert übliche Locations + `command -v typst` via Login-Shell |
| `// ─── chapter ───` glued an `= Heading` und droppt Kapitel-H1s im DOCX | `\n\n` zwischen Comment-Marker und Inhalt in `resolveIncludes` |
| DOCX nur die offene Datei statt ganzes Projekt | `resolveIncludes` vor Serialisierung; gefilterter Temp-File für Teil-Export |
| Stil-Wechsel in Kapitel-Datei korrumpierte die Datei | Native Block-Dialog wenn currentFile ≠ Root-File |
| Hamburger-Hub als Auffangbecken — alles zwei Klicks tief versteckt, doppelte Wege fuer File-Aktionen | CommandHub geloescht; native Menueleiste auf fuenf Top-Level-Menues (File/Edit/View/Document/Help) ausgebaut; Slash-Commands fuer In-Text-Inserts |
| Schreibende sehen ihre Wortzahl nicht | `wordStats` derived in der Status Bar, live, codefiltert, mit Lesezeit-Schaetzung bei 200 wpm |
