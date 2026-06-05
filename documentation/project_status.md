# vswrite Desktop — Project Status

> **⚠️ Historie / Changelog.** Diese Datei ist ein session-weiser Verlauf und nennt
> das Produkt noch „vswrite". Es heißt inzwischen **Penwright** (Rebrand
> abgeschlossen). Für den **aktuellen** Stand siehe `documentation/handover.md` +
> `CLAUDE.md`. Historische Einträge bleiben bewusst unverändert.
>
> **Stand:** 2026-06-05 (nach Session 27: **Design after writing + einheitliches „Look"-Modell + macOS-Launch-Reife**). Kurz:
> - **Look-Modell** (du gestaltest, wo es wirkt): `style.typ` öffnet den visuellen Look-Designer · Kapitel-Look + „✎ anpassen"-Editor in der Statusleiste (per-Chapter ODER geteilt) · Design-with-AI als Popover an der Auswahl (MCP `penwright_get_selection`). „Design"-Tab raus, Nav-Tabs in eine Top-Bar.
> - **Safe-Apply-Engine:** jede Design-Mutation wird vor dem Commit kompiliert (verify) → Rollback bei Fehler, „↩ Rückgängig". Design kann das Dokument nicht mehr zerschießen.
> - **macOS „just works" bewiesen:** notarisiertes + gestapeltes DMG gebaut (`spctl: Notarized Developer ID`). `TYPST_BIN`/Package/Font-Path für MCP, Notarize-Dedup, Identity-Präfix-Fix, Electron-Fuses, Typst+MCP signiert.
> - **Härtung:** Security (dropImage-Traversal, tote URL, Fuses) + Performance (wordStats/Kommentar-Dekorationen/Compile-Cancel/async-Backup). **Onboarding-Wizard.** **Windows-Scaffolding** (ungetestet).
> - Davor Session 26: **Phase E — Per-Chapter Section Styles**; Session 25: **DOCX-Overhaul**.
> **Version:** 0.7.0 (Pre-Release) — package.json + Doku synchron. **Nächste Aufgabe:** Lokalisierung (Englisch / i18n).

---

## Zusammenfassung

vswrite Desktop ist eine eigenstaendige Electron Desktop-App, portiert aus der vswrite VS Code Extension. Die App bietet einen WYSIWYG-Editor fuer Typst-Dokumente mit integriertem Terminal, Live-PDF-Preview, Dateimanager, Versionssystem (Git unter der Haube, „Projekt"-UI darueber), Auto-Backup, Zotero-Anbindung, einen visuellen Design-Editor mit Themes / Palettes / Layouts / Fonts / 22 Design-Elementen / per-Chapter Section-Styles, Claude Code Skills und einen MCP-Server mit 56 Tools fuer externe Agents.

**Status Release-Readiness:**
- Security gehaertet (Path Traversal + Symlink-Bypass + MCP-Pfade + verschluesselte Lizenz)
- Performance-tauglich fuer 100+ Seiten Dokumente (PDF-Preview via pdf.js, inkrementeller Serializer, async File-I/O)
- **Projekt-First-Class:** App startet am StartScreen; Projekte werden bewusst geoeffnet/geschlossen; jedes Projekt ist self-contained (`.git/`, `.vswrite/backups/`, `.vswrite/ai-snapshots/` im Projektordner)
- **Versionssystem ohne Git-Vokabular:** „Version speichern" / „Verlauf" / „Wiederherstellen" statt Stage/Commit/Branch
- **Auto-Backup pro Projekt:** Crash-Schutz parallel zum Versionssystem, konfigurierbar (Intervall + Max-Anzahl)
- **Export-Modal:** Format-Wahl (PDF/DOCX) + Kapitel-Auswahl per Checkbox; DOCX nutzt jetzt `resolveIncludes` und exportiert Multi-Chapter-Projekte vollstaendig
- DOCX-Export produziert journal-submission-taugliche Word-Dateien: Live-Multilevel-Numbering + Abbildungen (Bild + „Abbildung N"-Caption) + Display-Math/SVG als Bilder + echte Word-Tabellen + aufgeloeste Cross-Refs + echte Fussnoten + Callouts-als-Box + Seitenzahlen. Reiner Design-/Layout-Code wird uebersprungen statt geleakt (Session 25)
- About-Dialog zeigt Version + Lizenz + System-Info
- **Lokales Crash-Reporting:** Plaintext-Reports nach `<userData>/crash-reports/`, Boot-Dialog beim naechsten Start, User entscheidet selbst ueber Weitergabe — keine externe Telemetrie
- **MCP-Server mit 57 Tools**: Versionen-API, Writer-Features (Comments / Cross-Refs / Footnotes), Discovery (Search / Replace / Citation-Source-Lookup), Import / Export / Assets, **Design-Surface (16 Tools, inkl. per-Chapter Section Styles + `penwright_get_selection`)** — externe Agents koennen die kompletten Editor- und Design-Workflows fahren
- **Distribution macOS:** notarisiertes + gestapeltes DMG-Build erfolgreich (`npm run package:mac`, Apple Silicon). Auto-Updater **gestrichen** (Updates per Newsletter).
- **Offen fuer Launch:** `penwright.online` registrieren, **Lokalisierung (Englisch / i18n)**, manueller E2E-Test Design-with-AI mit Claude Desktop, finale QA auf echter 100-Seiten-Thesis, Windows als Fast-Follow.

**Codebase:** ~24.500 Zeilen in 87 Dateien (Session 16)
- Main Process: ~4.200 Zeilen (20 Module inkl. `pathSecurity`, `projectSearch`, `commentManager`, `citationSources`, `crashReporter`)
- Renderer: ~6.300 Zeilen (App.svelte + 21 Components inkl. ProjectPanel, VersionDetail, BackupListDialog, ExportDialog, ProjectSearchPanel, CommentsPanel, CrashReportDialog)
- Editor: ~5.500 Zeilen (CommandHub.svelte entfernt — ~456 Zeilen, dafür `commentDecorations.ts` neu)
- Shared: ~3.400 Zeilen (docxSerializer mit Word-Styles, `skillTemplates.ts` mit den fuenf Claude-Skills als Master-Quelle)
- MCP: ~1.900 Zeilen (56 Tools)
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
- [x] **Find in Project** (Cmd+Shift+F): Slide-In-Panel mit Query/Replace, Optionen Aa/W/.*/.bib, Treffer gruppiert pro Datei (auf-/zuklappbar), Klick springt + scrollt im Editor zur Stelle; max 1000 Treffer mit Truncation-Hinweis; Replace-All über Confirm-Dialog
- [x] **Footnote-UI**: Toolbar-Button „Fn" + Slash-Command `/Footnote` legen leere Fußnote an und öffnen automatisch den Inline-Popup-Editor; Klick auf bestehende Fußnote öffnet sie zum Editieren; Esc / Cmd+Enter schließt; Nummerierung via Typst beim Compile
- [x] **Comments / Annotations**: Toolbar-Button „Cm" oder Menü „Edit → Add Comment" (Cmd+Alt+M) legt Comment an die Selektion (oder das Wort am Cursor); gelbes Highlight im Editor via ProseMirror-Decorations; Side-Panel als 5. Sidebar-Tab
- [x] **Reading Mode** (Cmd+Alt+R): Buchsatz-Typografie im Editor (Serife, Justified-Text, Buchspiegel-Margins), Code/Math/Raw-Blöcke bleiben monospace; Toggle in Toolbar + View-Menü; Editing bleibt aktiv
- [x] **Backlinks**: Hover-Button („↪") an jedem Heading im Outline-Panel öffnet Project-Search mit dem Heading-Titel; Right-Click auf eine Citation öffnet die Suche mit `@<citekey>` als Whole-Word-Treffer — beide Trigger nutzen einen Preset-State, der von ProjectSearchPanel beim Mount konsumiert wird
- [x] **Inline Source Preview**: 350-ms-Hover über `@citekey` öffnet Karte mit Autor / Titel / Jahr aus der Bib + „PDF öffnen"-Button, wenn `sources/<citekey>*.pdf` existiert; Klick öffnet das PDF als Tab via `PdfFileViewer`
- [x] **Cross-References**: `/Reference` Slash-Command, `Edit → Insert Reference…` Menü, `Cmd+Alt+L` öffnen Picker mit allen `<label>`s im Projekt (gruppiert nach Typ + Caption-Vorschau); inserter eine orangene `↳ label`-Pille, die zu `@label` serialisiert. Disambiguierung via Heuristik (Doppelpunkt oder bekannter Präfix → Reference, sonst Citation)
- [x] Guard: Bilder nicht in Code-Bloecke einfuegbar
- [x] Rechtschreibpruefung (Electron Spellchecker, Sprache aus Typst-Settings)

**Sidebar (5 Tabs):**
- [x] Files: Dateibaum, Navigate Up, **„Neuer Ordner"** (inline input) + **„Asset hinzufügen"** (File-Picker → kopiert nach `assets/`), Drag-Bilder, leere Ordner sichtbar
- [x] Outline: Live Heading-Hierarchie, Click-to-Navigate, **Drag-to-Reorder** (Heading + zugehöriger Block bis zum nächsten gleich-/höherrangigen Heading wandert per ProseMirror-Transaction)
- [x] Chapters: Include-Manager mit sofortigem UI-Update bei Umsortierung
- [x] **Project (ehemals Git):** Projekt-Header mit „Im Finder zeigen", „Version speichern"-Card, „Änderungen seit letzter Version" mit Checkboxen, immer sichtbarer Verlauf, Auto-Backup-Status, „Erweitert"-Bereich für Cloud-Sync (Push/Pull/Remote-URL)
- [x] **Comments (neu):** sichtbare `.md`-Dateien in `comments/`, Filter „Aktuelle Datei / Ganzes Projekt", Resolved-Toggle, Klick auf Anker springt im Editor an die Stelle, gelbes Highlight per ProseMirror-Decorations

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
- [x] DOCX Word-Styles (Heading1-6, Quote, CodeBlock, BibliographyEntry, TableHeader, TableCell, Caption), Page-Size + Margins + Font + Line-Spacing aus Typst-Settings, **Live Multilevel-Heading-Numbering** (Word re-numbert bei Reorder), Citations als `(Autor Jahr)` (oder `[n]` bei numerischem Stil), lokalisierte TOC-/Bibliography-Labels (DE/EN/FR/ES/IT/PT/NL)
- [x] **DOCX rich constructs (Session 25):** Abbildungen → eingebettetes Bild + „Abbildung N"-Caption, `#figure(table())` → echte Word-Tabelle + „Tabelle N", Display-Math + SVG → via gebundeltem Typst rasterisiert (Render-Callback aus Main/MCP injiziert, `shared` bleibt dependency-frei), `@fig/@tbl/@eq`-Cross-Refs → aufgeloest, Fussnoten (auch mehrzeilige) → echte Word-Fussnoten mit Inline-Markup, gentle-clues-Callouts → Akzent-Box, Seitenzahl-Footer, Ordered-List-Reset + Verschachtelung. Unbekannter Layout-/Design-Code wird uebersprungen statt als Monospace geleakt (Sample: 355 → 0 Code-Leaks, 0 → 3 Bilder)
- [x] **Deserializer-Fix (Session 25):** Prosa mit `#emph`/`#strong`/`#raw`/`#footnote` (auch mehrzeilig) kippt nicht mehr in einen Raw-Block — verbessert Editor-WYSIWYG **und** DOCX. Round-trip-sicher (mappt auf bestehende italic/bold/code-Marks + footnote-Node)
- [x] DOCX-Deserializer-Verbesserungen: Multi-line Listen (`+ item\n  cont.`), `#align(center + horizon)[…]` mit verschachtelten `#text(…)[X]`, `#datetime.today().display(…)` → heutiges Datum, balanced bracket matching für Title-/Abstract-Pages
- [x] PDF In-App Viewer (pdf.js, Text markieren & kopieren, virtualisiertes Rendering)
- [x] Markdown -> Typst Import (eigener Converter)
- [x] Zotero Better BibTeX Integration (File Watcher, Auto-Sync)
- [x] Eigene Style Templates importieren (.typ-Datei -> nur Preamble extrahiert)
- [x] **Style-Anwendung blockiert wenn nicht in main.typ** (verhinderte stille Korruption von Kapitel-Dateien durch fälschliches Prepend des Stil-Vorspanns)

**Projekt-Management:**
- [x] **Projekt First-Class:** App startet am StartScreen ohne Auto-Reopen; „Neues Projekt" / „Projekt öffnen" / **„Projekt schließen"** (Cmd+Shift+W, mit Save-Prompt) als explizite Menü-Aktionen
- [x] 6 Projekt-Templates (Document, Thesis, Paper, Letter, Book, **Magazine**) mit Modal-Dialog
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
- [x] **Shortcut-Cheatsheet** (`Cmd+/` oder Help → Keyboard Shortcuts) — sieben Gruppen mit ~30 Eintraegen aus dem Handbuch (Project & Files, Search, Writer Features, Formatting, Blocks, View, General). Cross-Plattform per `navigator.platform`-Check (Cmd auf macOS, Ctrl sonst)
- [x] **Help-Menue:** User Guide, Keyboard Shortcuts (`Cmd+/`), Report Issue, **Crash-Berichte oeffnen** (oeffnet `<userData>/crash-reports/` direkt im Finder)
- [x] Terminal (node-pty + xterm.js), Auto-Resize, Max 5 Respawns
- [x] 50+ IPC Message Handler, ~60 IPC Channels (inkl. `crash:*`)
- [x] Modularer Main Process (20 Module)
- [x] Modularer Renderer (State + MessageHandler extrahiert)
- [x] Start Screen mit Onboarding (Typst-Check, AI/Terminal Info, Skills)
- [x] App Icon & Branding (Logo SVG, build/icons/ 16-1024px, appId: com.vswrite.desktop)
- [x] **About-Dialog** — Version, Electron/Chromium/Node-Versionen, Platform/Arch, Lizenz-Tier (Unlicensed/Basic/Pro-Badge), Links (User Guide, Website, Report Issue), "Copy Diagnostics" fuer Bug-Reports
- [x] **Bestaetigungsdialoge bei destruktiven Cloud-Ops:** Restore Version, Apply Backup, Cloud-Backup laden (Pull) — Vokabular bleibt im Versionen-Sprech, kein „Pull / Reset / Branch"

**MCP Server (Model Context Protocol) — 56 Tools, Server-Version 0.9.0 (Bun-Binary 0.8.0):**
- [x] Eigenstaendiges CLI-Tool (`src/mcp/server.ts`, ~1.700 Zeilen)
- [x] **Projekt & Dateien (5):** set_project, list_files, read_file, write_file, create_project
- [x] **Dokument-Operationen (4):** get_document, open_file, update_document, **compile** (reiner Verifier — SVG-Mode entfernt, kein Output-Path; Artefakt-Schreiben uebernehmen die Export-Tools)
- [x] **Settings (2):** get_settings, update_settings (nur lang + bibliographyStyle — alles andere lebt seit Phase A im Design-Block)
- [x] **Design (15):** get_style, update_style, list_styles (6 Themes), apply_style, list_layouts (7 Presets), apply_layout, list_fonts, apply_palette, list_design_elements (22 Snippets), insert_design_element, generate_layout, **+ Section Styles (Phase E): list_section_styles / define_section_style / apply_section_style / clear_section_style** (per-Chapter Magazin-Rubriken via scoped `#show`)
- [x] **Kapitel & Struktur (6):** get_chapters, reorder_chapters, add_chapter, remove_chapter, merge_document, split_document
- [x] **Bibliographie & Citations (3):** get_citations, add_citation, ensure_bibliography
- [x] **Cross-References & Footnotes (3):** list_labels (gefiltert nach Typ), insert_reference (Label-Existenz-Check + Vorschlaege fuer aehnliche Labels, Auto-Space wenn vorheriger Char alphanumerisch), add_footnote (Klammer-Balance-Check auf Body)
- [x] **Comments & Annotations (4):** list_comments, add_comment (anker-basiert, generiert ID + YAML-Frontmatter), resolve_comment, delete_comment
- [x] **Versionen (4):** save_version (auto-init Git + .gitignore wenn fehlt), list_versions (max 200), show_version (per-File-Diff), restore_version (mit File-Path-Validierung)
- [x] **Discovery (3):** search_project (lookarounds fuer whole-word — `@citekey`-Backlinks funktionieren!), replace_in_project (mit Versions-Sicherheitsnetz-Hinweis), find_source_for_citation (sucht in `sources/<citekey>*.pdf`)
- [x] **Export (2):** export_pdf (strikt projekt-only via `resolveInsideProject`, Auto-mkdir fuer `exports/`), **export_docx** (echte Word-Styles + Live-Multilevel-Numbering, mergt #include-Kapitel)
- [x] **Import & Assets (2):** import_markdown (inline `markdown` ODER `srcPath`, kann ausserhalb des Projekts liegen), add_image (Content-Hash-Dedup auf `assets/`, Figure-Builder mit Caption + Label, optional Inline-Insert via Anchor)
- [x] **Git Low-Level (3):** git_status, git_commit, git_push — fuer Cloud-Sync-Workflows; im Normalfall reicht der Versionen-Block
- [x] **Path-Validierung fuer alle File-Tools** via `resolveInsideProject()` — blockiert `../`-Traversal und Symlink-Escape, neuerdings auch `export_pdf` (Sicherheitsfix in Session 16)
- [x] **Anker-basiertes Editing-Pattern:** add_footnote / insert_reference / add_comment / add_image / insert_design_element nehmen alle einen `afterText`-/`anchor`-Parameter und einen optionalen `occurrence` (1-basiert), wenn der Anker mehrfach vorkommt — Agent muss keine Offsets berechnen
- [x] @modelcontextprotocol/sdk + StdioServerTransport
- [x] Dynamischer Projektwechsel (kein hardcoded Pfad in Config)
- [x] Getestet mit Claude Desktop (Cowork)
- [x] **5 Skill-Dateien als MCP Prompts** (typst-reference, vswrite-conventions, research-workflow, writing-style, design-conventions) — Inhalt aus `src/shared/skillTemplates.ts`, deployed pro Projekt nach `.claude/skills/<name>/SKILL.md`. Tilde-Fences (`~~~`) statt Backticks im Source, damit keine Escape-Hoelle in TS-Strings
- [x] Pro-Lizenz-Gating (via `--license-key` Flag oder `VSWRITE_LICENSE_KEY` Env)
- [x] **Doku komplett:** [mcp-server.md](mcp-server.md) mit allen 56 Tools, neun Workflow-Beispielen (Backlinks, Bulk-Refactor mit Versions-Safety-Net, Recherche-Markdown als Kapitel, Bild + Figure + Reference in einem Rutsch, etc.)

**Comments / Annotations (Session 12):**
- [x] Storage als sichtbarer `comments/`-Ordner im Projekt-Root (nicht in `.vswrite/`) — eine `.md`-Datei pro Comment, YAML-Frontmatter (`id`, `file`, `anchor`, `rangeStart/End`, `author`, `date`, `resolved`) + Markdown-Body
- [x] Cloud-Sync-tauglich: Comments wandern mit Dropbox/iCloud mit, Betreuer kann sie in jedem Editor öffnen
- [x] Source bleibt komplett clean — Comments werden nie in PDF/DOCX kompiliert
- [x] Reanchoring beim Open: erst exakte Offset-Treffer, dann `indexOf` mit Hint-Distanz, sonst global; nicht gefunden → `orphaned: true`
- [x] Editor-Highlight via ProseMirror Decorations (ephemer, mutiert das Doc nicht); Click auf Highlight → `vswrite:comment-click`-Event scrollt im Side-Panel zum Eintrag
- [x] Side-Panel: Filter „Aktuelle Datei" / „Ganzes Projekt", „Erledigte zeigen"-Checkbox, Body-Textarea mit Auto-Save (400 ms debounce), Resolve/Delete-Buttons
- [x] Bekannte MVP-Limitierung: Anker-Text muss innerhalb eines Textnodes liegen (nicht über Absatz-Grenzen) — sonst orphaned

**Crash-Reporting (lokal, kein Sentry):**
- [x] Neues Modul [src/main/crashReporter.ts](src/main/crashReporter.ts) — `setupCrashCapture()` registriert `uncaughtException` + `unhandledRejection` in Main, startet Electrons nativen `crashReporter` (Chromium / V8), aktiviert `process.setSourceMapsEnabled(true)` fuer lesbare Stack-Traces
- [x] **Renderer-Capture** in [src/renderer/main.ts](src/renderer/main.ts) — `window.error` + `unhandledrejection` schicken Payload via IPC `crash:report` an Main
- [x] **Plaintext-Reports** nach `<userData>/crash-reports/<timestamp>-<ms>-<rand>.txt` — Slug mit Millisekunden + 4-char Random damit zwei Crashes derselben Sekunde sich nicht ueberschreiben. Rotation auf max 10 Files
- [x] **Path-Scrubbing** vor dem Schreiben — `/Users/<name>/`, `/home/<user>/`, `C:\Users\<name>\` werden alle durch `<redacted>` ersetzt. Damit ist der Bericht ohne weitere Bearbeitung verschicktbar
- [x] **Breadcrumb-Ringpuffer** (max 50) — `addBreadcrumb(kind, message)` an Schluesselstellen instrumentiert: Lifecycle (started, window created), Project (opened, closed), File (saved success/fail, opened success/fail). Nur Event-Typen, keine Inhalte
- [x] **Boot-Detection** via mtime-Vergleich gegen `<crash-reports>/.last-shown` Marker — Marker speichert die mtime-Float korrekt via `Number()` (parseInt-Bug abgewehrt: haette Fraktionalmillisekunden abgeschnitten und denselben Crash bei jedem Boot wieder gezeigt)
- [x] **CrashReportDialog** ([src/renderer/components/CrashReportDialog.svelte](src/renderer/components/CrashReportDialog.svelte)) zeigt Plaintext-Report mit Buttons: „In Zwischenablage", „E-Mail vorbereiten" (`mailto:feedback@vswrite.com` via `shell.openExternal`, Body bei > 1500 chars gekuerzt mit Hinweis auf vollstaendige Datei), „Ordner oeffnen", „Verwerfen", „Schliessen"
- [x] **6 Crash-IPC-Channels** in [preload-entry.ts](src/main/preload-entry.ts) whitelisted: `crash:report`, `:getLatest`, `:markShown`, `:deleteAll`, `:openFolder`, `:copyToClipboard`, `:openMail`
- [x] **24/24 Smoke-Test gruen** — esbuild-bundled Standalone-Test mit gestubbtem Electron deckt: Capture+Read-Roundtrip, Path-Scrubbing fuer drei Plattformen, Marker-Roundtrip, Renderer-Payload mit Breadcrumb-Merge, Rotation auf max 10, deleteAllReports
- [x] **Datenschutz first:** Reports verlassen das Geraet nur durch aktive User-Action — kein Account, kein Server, keine DSGVO-Komplikationen. Passt zum Trust-Profil von Schreibsoftware
- [x] Doku in [handbuch.md](handbuch.md) + [handbook.md](handbook.md) mit eigenem Abschnitt „Crash-Berichte"

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

- [ ] **„Open Sample Project"** im StartScreen — Conversion-Hebel: ein Beispielprojekt das die App selbst dokumentiert (Meta-Idee: das Sample-Projekt ist eine kleine Anleitung zu vswrite, geschrieben in vswrite). Wir bauen das gegen Ende
- [ ] **Auto-Updater** (electron-updater) einbinden + Firebase-Hosting einrichten + E2E-Test
- [ ] **DMG-Build & Notarization** real durchziehen
- [ ] **QA auf echter 100-Seiten-Thesis** (nicht nur die 8 Test-Chapters); Writer-Features-Smoke auf `/Users/renejesser/Desktop/test_thesis`
- [ ] **Netlify-Hosting fuer Handbuch** (de + en) live
- [x] **DOCX-Overhaul** (Session 25): `#raw("…")` inline + Figures/Math/Tables/Cross-Refs/Footnotes/Callouts gerendert, Code-Leak eliminiert. **Bewusst nicht gemacht** (schlechtes Aufwand/Nutzen, billig nachruestbar): live Word-SEQ/REF-Felder statt statischer Nummern, Inline-Math-in-Prosa als Bild

### Writer-Features (Plan archiviert unter [done/writer-features-plan.md](done/writer-features-plan.md))

Funktionale Reife als Writing-Tool — neun Features mit Implementierungsdetails dokumentiert:

- [x] **Find in Project** — Suche ueber alle `.typ`-Dateien (Session 12)
- [x] **Footnote-UI** — Toolbar/Slash-Command + Auto-Open-Popup (Session 12)
- [x] **Cross-References** — Picker via Slash / Menü / `Cmd+Alt+L` (Session 15)
- [x] **Comments / Annotations** — sichtbare `.md`-Dateien in `comments/`, kompilieren nicht (Session 12)
- [x] **Outline drag-to-reorder** — HTML5-Drag, Block-Move via ProseMirror-Transaction (Session 14)
- [x] **Reading Mode** — Buchsatz-Typografie als Editor-Toggle (Session 13)
- [x] **Backlinks** — Outline-Hover + Citation-Right-Click (Session 13)
- [x] **Inline Source Preview** — Hover-Karte mit Bib-Daten + „PDF öffnen" (Session 14)
- [ ] **Manuscript Export** (1 Tag) — Shunn-Format fuer Belletristik

Vorgeschlagene Mini-Releases im Plan: **Polish-Sprint** (Reading Mode + Find + Backlinks + Word-Count [done]), **Annotation-Sprint** (Comments + Outline-Reorder), **Reference-Sprint** (Cross-Refs + Source-Preview).

### Offen (nach v1.0)

- [ ] Dark Mode
- [ ] Deutsche UI-Uebersetzung (UI-Strings extrahieren, i18n-Framework)
- [ ] Linux AppImage + `.rpm` + Windows Installer deployen
- [ ] Offline-Bundling des Handbuchs (via `extraResources` in electron-builder)
- [ ] "Publish to GitHub"-Button (aktuell nur via Terminal + `gh` CLI)
- [ ] Editor-interne Virtualisierung (TipTap rendert aktuell alle DOM-Nodes — Obergrenze liegt bei ~200 Seiten pro Einzel-Datei)
- [ ] MCP Server Phase 4 (Resources, Electron IPC-Bridge)
- [ ] Vollstaendiges WCAG 2.1 AA Accessibility-Audit

---

## Session-Log

### Session 26 (2026-06-04) — Phase E: Per-Chapter Section Styles (Magazin-Rubriken)

Magazine wie „Neues Lernen" nutzen pro Rubrik (Feature / Interview / Essay / Department) einen eigenen Look. vswrite kann das jetzt: eine benannte **Section Style** = ein Overlay, das via scoped `#show: <id>-style` auf ein einzelnes Kapitel angewendet wird, waehrend Page-Geometrie + Running-Heads dokument-level bleiben.

**Mechanismus** (in Step 1 zuerst bewiesen): ein Kapitel meldet sich mit zwei Zeilen an — `#import "../style.typ": <id>-style` + `#show: <id>-style`. Typsts Block-Scoping (`set`/`show` im Funktions-Block) + die `#include`-Grenze containen das Restyle, kein Bluten ins Folgekapitel.

**Step 1 — Schema + Generator (`f134efd`):** `ProjectStyle.sections: SectionStyle[]` (Overlay: colors / fonts / scale / columns / per-level headings) + Sanitizer. `styleParser`: `emitCoreRules` extrahiert (geteilt von `apply-style` und jeder Section); pro Section ein `#let <id>-style(body)` mit **gemergten Literal**-Farben/Fonts (eine Section kann nicht `style-colors` referenzieren — das haelt die Basis-Palette). Regression byte-identisch fuer sectionslose Projekte.

**Step 2 — MCP + Presets + Injektion (`e5c7ac0`):** `styleParser` Chapter-Injektions-Helfer (`ensureSectionStyle`/`clearSectionStyle`/`getSectionStyleId`, marker-bracketed, round-trip-sicher). 5 Rubrik-Presets (`sectionPresets.ts`). 4 MCP-Tools: `list/define/apply/clear_section_style`. MCP_SETUP_VERSION 0.7.1 → 0.8.0.

**Step 3 — IPC + UI (`ccd48d0`):** `section:get/apply/clear` IPC (+ Preload-Whitelist). IncludesPanel: per-Chapter Rubrik-Dropdown. DesignPanel: collapsible „Section Styles"-Editor (Add-from-Preset, Accent-Swatch, Spalten, Delete). `applyTheme` erhaelt jetzt `sections`.

**Step 4 — Preservation + Skill + Doku:** MCP `apply_style` / `generate_layout` erhalten `style.sections` (wie `custom.preamble`). DESIGN_SKILL „Per-chapter rubrics"-Block. Doku (mcp-server.md / Handbuecher / dieser Eintrag).

**Verifikation:** define→apply→swap→clear end-to-end ueber die geteilten Helfer; injizierter Block ueberlebt den Editor-Round-Trip als Fixpunkt; deployment-genaues `#include`-Szenario kompiliert; tsc clean, svelte-check 0 errors, electron-vite + MCP-Builds gruen.

**Round 6 — 3 Magazin-Bausteine + Dogfooding:** Drei neue Design-Elemente (Library 19 → **22**): `full-bleed-image` (randlose Ganzseite + optionale Caption/Credit), `spread-opener` (full-bleed Opener mit Kicker/Headline-im-Outline/Standfirst/Byline ueber Gradient), `margin-note` (Marginalia im Aussenrand via gebundeltem `drafting`-Paket, self-contained mit `stroke: none`). Dabei `magazine-cover`-Bug gefixt (Hintergrundbild war via `#place(width:100%)` nicht full-bleed → jetzt Page-`background:`). Als Dogfooding-Test ein komplettes 13-Seiten-Magazin **„LANGSAM"** gebaut (4 Rubriken + ~22 Features), das alle neuen Tools end-to-end ueber die echten Code-Pfade nutzt.

### Session 25 (2026-06-04) — DOCX-Overhaul (journal-submission-tauglich)

Der DOCX-Export war strukturell solide (Ueberschriften / Prosa / Listen / Bib / Geometrie), verlor aber praktisch jedes „reiche" Element. Befund am Sample-Projekt (42-Seiten-PDF ↔ DOCX): **355 Absaetze als Monospace-Code gedumpt**, 0 eingebettete Bilder, 0 Fussnoten, alle Cross-Refs gedroppt. Ursache: der Deserializer liess Figures / Math / `#quote` / Callouts / Prosa-mit-Inline-Calls als `typstRawBlock`, und der DOCX-Serializer dumpte jeden Nicht-Config-Raw-Block zeilenweise als Code.

**Stage A — Serializer (`47f0dbf`, [src/shared/docxSerializer.ts](src/shared/docxSerializer.ts)):**
- Raw-Block-Dispatcher (`classifyRawBlock` + `renderRawBlock`): `#figure` → Bild + „Abbildung N"-Caption; `#figure(table())` → echte Word-Tabelle + „Tabelle N"; Display-Math + SVG → via injiziertem Typst-Snippet-Renderer rasterisiert (300 ppi); `#quote` → Quote-Style; gentle-clues-Callouts → schattierte Akzent-Box; `#heading` → echte Ueberschrift; Prosa-mit-Inline → sauberer Absatz via neuem Inline-Typst-Parser. Reiner Layout-/Design-Code wird **uebersprungen statt geleakt**.
- Inline `reference`-Node → „Abbildung 1"/„Tabelle 2"/„(3)" via Pre-Pass-Label-Map (war komplett gedroppt). Fussnoten-Body geparst (Markup + verschachtelte Citations). Ordered-List-Reset pro Liste + Verschachtelung. SVG eingebettet. Chapter-relative `../assets/`-Pfade vom Root aufgeloest. Seitenzahl-Footer aus `style.layout`. Numerischer vs. Autor-Jahr-Zitierstil.
- `serializeDocx` bekommt `opts.renderTypstSnippet` (`shared` bleibt dependency-frei); verdrahtet aus [importExport.ts](src/main/importExport.ts) und MCP `export_docx` (das jetzt auch den Projekt-Style uebergibt).

**Stage B — Deserializer (`bef5c0d`, [src/editor/lib/deserializer.ts](src/editor/lib/deserializer.ts)):**
- `isRawBlock` strippt bekannte Inline-Konstrukte jetzt ueber den **ganzen Block** (statt zeilenweise) → mehrzeilige `#footnote[…]` kippen nicht mehr in einen Raw-Block.
- `#emph` → italic, `#strong` → bold, `#raw("…")` → code als Inline-Konstrukte ergaenzt. **Keine neuen Node-Typen** → der TipTap→Typst-Serializer round-trippt sie als `_x_` / `*x*` / `` `x` `` / `#footnote[…]`.
- Verbessert Editor-WYSIWYG **und** DOCX zugleich.

**Verifikation:** Sample-Projekt **355 → 0** Code-Leaks, **0 → 3** eingebettete Bilder (SVG-Diagramm + 2 Formeln), **0 → 4** echte Tabellen, 7 Captions, Fussnote recovered, Seitenzahlen. Round-Trip auf allen synthetischen Faellen idempotent; Voll-Sample-Save-Stabilitaet **identisch** zum Original-Deserializer (die 2 design-lastigen Kapitel churnen vorher wie nachher — vorbestehend). `tsc` clean, electron-vite + MCP-Builds gruen. Verifiziert ueber eine Wegwerf-Harness, die die exakte App-Pipeline (`resolveIncludes` → `deserializeTypst` → `serializeDocx`) nachbaut.

**Bewusst ausgelassen** (schlechtes Aufwand/Nutzen, billig nachruestbar): live Word-SEQ/REF-Felder (statische Nummern sind beim Export korrekt; Betreuer ordnen kaum einzelne Abbildungen in Word um), Inline-Math-in-Prosa als Bild (die wichtigen nummerierten Display-Gleichungen rendern bereits).

### Session 24 (2026-05-20) — Magazine-Template für ai-magazine-designer

Neuer Projekt-Template-Eintrag `magazine` in [src/shared/projectTemplates.ts](src/shared/projectTemplates.ts). Designed für die Slow-Media-Pipeline aus dem Schwester-Repo [ai-magazine-designer](https://github.com/renejes/ai-magazine-designer) — der `typst-architekt`-Skill orchestriert via vswrite-MCP, der `cover-designer`-Skill rewriteet das Cover-Kapitel pro Issue.

**Was geliefert wird:**
- `main.typ` — A4, 10pt, Serif-Body, Single-Column-Default. Includes für Cover / Editorial / TOC + Marker-Kommentar für Article-Includes (typst-architekt appended dort die `articles/`-Markdown-Imports).
- `chapters/_cover-macro.typ` — Definition des `magazine-cover(title, subtitle, date, theme, accent)`-Makros. **Stabil** über alle Issues hinweg.
- `chapters/00-cover.typ` — Macro-CALL mit Default-Werten. Der cover-designer-Skill ersetzt nur diese Datei, niemals `_cover-macro.typ`. Trennung Macro-Definition vs. Macro-Invocation ist die Schlüssel-Entscheidung dieser Session.
- `chapters/01-editorial.typ` — Editorial-Slot mit Placeholder-Text + Herausgeber-Zeile.
- `chapters/02-toc.typ` — `#outline(title: none, depth: 2)`.

**Design-Editor-Integration:** Das Template liefert **kein** `.vswrite/style.json` und **kein** `style.typ`. Wer den visuellen Design-Editor aktivieren will, ruft `vswrite_generate_layout("magazine")` oder `vswrite_update_style(...)` — beide schreiben Style-Files on-demand. Out-of-the-box compile basiert auf plain `#set`-Rules in main.typ und braucht keine Style-Infrastruktur.

**MCP:** `vswrite_create_project` akzeptiert jetzt `magazine` im `templateId`-Enum; Tool-Beschreibung + `manifest.template.json` updated. `vswrite_generate_layout` kennt das Intent `"magazine"` bereits seit Session 22 (mappt auf `editorial-magazine` Theme + `magazine-2col` Layout), bleibt unverändert.

**Renderer:** Keine Änderung nötig — `NewProjectDialog.svelte` rendert die Template-Liste dynamisch aus `projectTemplates`. Magazine erscheint automatisch im Dialog.

**Verifikation:**
- `npx tsc --noEmit` — clean
- `npm run build` — 274 Module, build erfolgreich
- Test-Compile mit dem System-`typst` auf einem manuell gespiegelten Template-Ordner → 21 KB PDF, alle 3 Section-Includes laufen, Cover rendert mit Macro

**Architektur-Entscheidung:** Cover-Macro-Definition wurde aus `chapters/00-cover.typ` herausgezogen in `chapters/_cover-macro.typ` (underscore-prefix konventionell "internal"), damit der cover-designer-Skill den Macro-CALL frei umschreiben kann, ohne die stabile Definition zu gefährden. Die Schwester-App ai-magazine-designer hat ihren cover-designer-Skill entsprechend angepasst (`#import "_cover-macro.typ"` statt `#import "../style.typ"`).

### Session 23.2 (2026-05-20) — Per-Chapter Running Heads

Kleines, in sich abgeschlossenes Feature: Header- und Footer-Markup-Strings im Design-Panel akzeptieren jetzt zwei Platzhalter, die pro Seite zur Compile-Zeit aufgeloest werden:

- `{chapter}` — Body des letzten H1-Headings, der auf oder vor der aktuellen Seite steht
- `{section}` — dasselbe fuer H2

Implementiert ueber zwei Modul-level Helper in `style.typ` (`chapter-name()` / `section-name()`), die via `context { here() + query(heading.where(level: N)).filter(...).last() }` arbeiten. Der Generator (`styleParser.substituteRunningHeadPlaceholders`) ersetzt `{chapter}` / `{section}` in `pageHeader` / `pageFooter` mit den Helper-Calls bevor das Markup in `#set page(header: [...])` eingebacken wird — der User schreibt einfach `{chapter} · ISSUE 1`, kein Typst-Context-Syntax noetig.

**Mit-Updates:**
- `magazine-editorial` Layout-Preset benutzt jetzt `{chapter}` statt der hardcoded `NEUES LERNEN`-Zeile — gibt sofort ein funktionierendes Beispiel beim Apply
- DesignPanel: kleine `.design-hint`-Note unter Header/Footer-Inputs mit den zwei Platzhaltern + Hinweis dass Raw-Typst weiterhin funktioniert
- `DESIGN_SKILL` bekommt einen "Running heads (per-chapter)"-Block unter Layout Patterns mit einer Beispiel-Tabelle (Plain / mit Separator / mit `#h(1fr)` Split / styled)
- handbuch.md / handbook.md Layout-Row erwaehnt die Platzhalter

**Verifikation:** End-to-end gegen 4-seitiges Testdokument — Header folgt korrekt dem Kapitelwechsel ("The Quiet Architect" → "After the Storm"), Folgeseite eines Kapitels ohne neue Heading zeigt weiterhin das aktive Kapitel. `npm run build` + `svelte-check` clean.

Damit ist auch der zweite der beiden "Round 4 out-of-scope but lohnenswert"-Punkte erledigt. Bleibende Themen aus der Magazin-Liste: Full-Bleed-Innenseiten, Marginalia, Mosaik-Grids, Magazine-TOC mit Thumbnails (alle bewusst aufgehoben, siehe Session 23.1).

### Session 23.1 (2026-05-20) — Lifestyle Quick-Wins

Vier weitere Design-Elemente fuer lifestyle-/magazine-grade Output, jedes als eigener Commit + Test-Compile. Library waechst 15 → **19** Snippets; keine Schema-Aenderungen, keine neuen MCP-Tools.

1. **`gallery-asymmetric` (`38bf128`):** 1 grosses Bild links (2fr) + 2 kleine gestackt rechts (1fr) mit optionalen Captions pro Cell. Editorialer "Hero + 2 Supporting Shots"-Klassiker.
2. **`image-overlay` (`838e9ee`):** Foto mit edge-to-edge fill, Gradient-Block (50% Hoehe, transparent → 70% schwarz) am Boden, weiss-Headline + optional Subtitle drueber. Section-Opener mit Foto, oder visueller Break mit Headline mitten im Artikel. `clip: true` damit das Bild nicht aus den runden Ecken bleedet.
3. **`stats-box` (`983809b`):** "By the numbers"-Sidebar mit 3 oder 4 grossen Zahlen + kurzen Labels, oben Accent-Strip, Header optional. Trailing-positional `#stack(spacing, …)` war fragil bei leerer vierter Row, daher sequentielle Bloecke mit `#v()`-Spacing.
4. **`photo-caption-wrap` (`3d99cf8`):** Kleines Bild floated links/rechts mit langer Caption flowed drumherum via `wrap-it`. Museumskatalog-Pattern — die Caption IST der Body. Konfigurierbares Side, Bildbreite, optionaler Photographer-Credit in Italics.

**Wrap-up:**
- `MCP_SETUP_VERSION` 0.7.0 → 0.7.1, Bun-Binary neu fuer beide Mac-Archs gebaut
- Sample-Showcase (`chapters/07-design-showcase.typ`) um eine "Lifestyle quick-wins (Round 5)"-Section erweitert, die alle vier live demonstriert
- Doku-Stragglers in handbuch.md / handbook.md / mcp-server.md / project_status.md aktualisiert (15 → 19 Snippets)

**Bewusst weiter aufgehoben fuer eine spaetere Iteration:**
- **Per-Chapter-Running-Heads** — braucht `#set page(header: context { let chap = query(...); … })` Typst-Logik plus eine UI-Lösung im Design-Panel oder Custom-Code-Snippet. Realistisch 1-2 Tage inkl. Doku.
- **Magazine-TOC mit Thumbnails** — `#outline` ist relativ starr, jede Entry-Komposition aus Thumbnail + Title + Page-Number waere eine custom `outline.entry`-Show-Rule. Realistisch 3-5 Tage weil Image-pro-Heading mit dem Outline-Query verheiratet werden muesste.
- Full-Bleed-Innenseiten, Marginalia, asymmetrische Mosaik-Grids (3+ Bilder) — siehe Round-4-Out-of-Scope-Liste.

### Session 23 (2026-05-19) — Magazine-Polish-Pack

**Strategischer Kontext:** Der Design-Editor (Phasen A–D, Session 22) deckt das Standard-Repertoire ab — Themes, Palettes, Layouts, Headings, vier Elements. Für editorial-magazine-grade Output (Neues Lernen, The Local Project) fehlten noch gezielte Bausteine. Plan: [done/magazine-polish-plan.md](done/magazine-polish-plan.md), Audience zu ~100% AI (Claude Desktop via MCP), also Lego-Block-First.

**Geliefert in 12 reverbaren Commits:**

1. **Drop Cap + `style-fonts` Cross-Cutting (`6797e5b`):** Neuer `drop-cap` Design-Element, wrappt das gebundelte `droplet`-Paket. **Wichtige Generator-Erweiterung:** `style.typ` exportiert jetzt `style-fonts` (body/heading/code) als Modul-level Dict neben `style-colors` — Design-Elemente referenzieren `style-fonts.heading` statt einen Font-Namen ins Template einzubacken. Themes-Swap aktualisiert Typografie automatisch. **Plan-Abweichung:** Drop-Cap-Template hat nur einen `body`-Param (statt `letter` + `body` separat) — der Plan-Vorschlag `[*{letter}*{body}]` schlägt fehl, weil Typsts `*`-Strong-Markup einen Word-Boundary am schließenden `*` braucht und `*T*his` als unclosed delimiter parst; droplet's Auto-Extract des ersten Body-Zeichens ist robuster.
2. **Editorial-Divider-Varianten (`6255916`):** `divider-asterisks` (zentrierte `* * *`, klassisch) + `divider-ornament` (Single-Glyph, default ❦, parametrisierbar).
3. **Pull-Quote-Varianten (`15dffaf`):** `pull-quote-display` (monumental, 2.2em bold, keine Dekoration) + `pull-quote-block` (boxed inline mit accent bar + optional Attribution).
4. **Article-Opener (`85d4fda`):** Kicker / Headline / Standfirst / Byline. **Headline wird in `#heading(level: 1, outlined: true, numbering: none)` gewrappt**, damit sie in der Outline/TOC erscheint — Designer-Article behält damit seinen Platz in der Struktur.
5. **Section-Opener (`37ec55b`):** Full-page typografischer Divider (Pagebreak / `v(1fr)` / kleines Uppercase-Title / großes Subtitle / Accent-Rule / `v(1fr)` / Pagebreak). `weak: true` Pagebreaks, damit ein bereits vorhandener Pagebreak daneben keine Leerseite triggert.
6. **Image Gallery 2-up + 3-up (`24201fb`):** Equal-column `#grid()` mit optionalen Caption-Cells (leer = leerer Grid-Cell, Geometrie bleibt stabil).
7. **Photographer-Credit Schema (`dfaf544`):** `StyleFigure` bekommt `creditSeparator` + `creditLabel` (default `" — "` + `"Photo: "`, je 16 char cap). Generator emittiert Modul-level `figure-caption-credit(caption, credit)` Helper neben `style-colors` / `style-fonts`. Chapter-Files können ihn via `#import "../style.typ": figure-caption-credit` ziehen. DesignPanel Figure-Card erweitert um die zwei Inputs.
8. **Magazine-Cover (`9aaf617`):** Full-Page-Composite mit Masthead / Issue / Headline / optional Subhead / Date / optional Background-Image. Nutzt `#page(margin: 0pt)` für **per-page-margin-override** ohne Schema-Arbeit — die einzige Stelle, an der diese Session den Full-Bleed-Concept touched.
9. **Magazine-Editorial Layout-Preset (`16f9430`):** 7. Layout-Preset — A4 portrait, 2 columns, 2.2cm margins, 10.5pt body, mit Header-Strip `SECTION · ISSUE` links + Accent-Rule rechts. Header ist Styled-Markup-String mit `style-colors.muted` / `.accent` Referenzen (funktioniert weil Layout inside `apply-style` angewendet wird).
10. **Sample-Showcase Update (`f7ff31c`):** `resources/sample-project/chapters/07-design-showcase.typ` erweitert um "Magazine elements (Round 4)"-Section mit Live-Demo aller neuen Elemente (außer Section-Opener und Magazine-Cover, die per Pagebreak die Kapitel-Geometrie zerstören würden — beide werden in Prosa beschrieben). Sample-`style.typ` + `style.json` bekommen die neuen `style-fonts` + Credit-Felder.
11. **MCP-Version-Bump (`0c93518`):** `MCP_SETUP_VERSION` 0.6.0 → 0.7.0. Bun-Binary neu gebaut für aarch64-apple-darwin + x86_64-apple-darwin via `node scripts/build-mcp-binary.mjs --all`. Setup-Wizard re-triggert auf Pro-Usern, neue Elemente / Layout / Schema-Felder propagieren.
12. **Docs (dieser Commit):** Session-23-Eintrag hier; relevante next-steps.md Punkte abgehakt.

**Skill-Updates** (Session 23, im Verlauf der Commits eingebaut):
- `DESIGN_SKILL` Anti-Patterns: "More than one drop cap per section", "Article-Opener AND a separate H1+lead", "Multiple section-openers without intervening content".

**Verifikation:**
- Jeder Commit: `npm run build` exit 0, `svelte-check --threshold error` 0 errors, Element-spezifischer Typst-Test-Compile gegen bundled fonts + packages
- End-to-end: Full sample project (7 Kapitel inkl. neue Showcase-Section) → 402 KB PDF
- `vswrite_list_design_elements` liefert jetzt 15 entries (vorher 6); `vswrite_list_layouts` 7 (vorher 6)

**Bewusst out of scope** (für eine spätere Iteration aufgehoben):
- Full-Bleed-Images mit Per-Section-Page-Margin-Overrides (Schema-Arbeit)
- Marginalia / Side-Notes mit drafting-Package
- Mosaik-Grids (3+ asymmetrische Bilder)
- Initialen-Heading-Differenzierung (erste Seite eines Kapitels vs. Folgeseiten)

### Session 22 (2026-05-17) — Design-Editor Phase B: Foundation + Konsolidierung

**Phase B Round 1 ausgeliefert + Style-Surface konsolidiert.** Vier Commits, jeweils eigenständig reverbar:

**1. Color-Palette + Coloris (`dc0f5dd`):**
- Neuer Sidebar-Tab "Design" ([DesignPanel.svelte](src/renderer/components/DesignPanel.svelte)), `panelState.sidebarTab` Union erweitert um `'design'`
- [@melloware/coloris](https://github.com/melloware/coloris) (10 KB MIT) für Color-Picker — bewusste Library-Wahl statt Eigenbau, weil Designer-Standard
- 5 semantische Slots (primary / accent / text / background / muted), 8 kuratierte Palette-Presets in [palettePresets.ts](src/shared/palettePresets.ts) (Modern Tech, Editorial, Earth Tones, High Contrast, Minimal Mono, Forest Deep, Sunset Warm, Ocean Classic — alle WCAG-AA-geprüft)
- Debounced `style:save` (300ms) → style.typ regeneration → recompile

**2. 7 OFL-Fonts gebündelt + Font-Browser (`08f6742`):**
- Static-TTF-Bundle: Inter, IBM Plex Sans/Serif/Mono, JetBrains Mono, Crimson Pro, Spectral (~6.6 MB total). Static gewählt weil Typst 0.14.2 bei Variable-Fonts warnt
- [scripts/fetch-typst-fonts.mjs](scripts/fetch-typst-fonts.mjs) — direkte GitHub-Quellen + Inter-Release-ZIP-Extraktion. Idempotent. Wirft 24 Files in `resources/fonts/<Family>/`
- [scripts/audit-bundled-deps.mjs](scripts/audit-bundled-deps.mjs) erweitert: walkt `resources/fonts/`, klassifiziert OFL.txt-Dateien, generiert `fonts`-Section in `THIRD_PARTY_LICENSES.md` + `bundle-licenses.json`. Build failed auf Deny-List-Hit
- [typstPath.ts](src/main/typstPath.ts) `getTypstFontPath()` + `buildTypstCompileArgs()` praependiert `--font-path`. MCP-Server kriegt `TYPST_FONT_PATH` env-Var via [mcpSetup.ts](src/main/mcpSetup.ts) (MCP_SETUP_VERSION 0.4.0 → 0.5.0)
- `vswrite-font://` Custom-Protokoll in [index.ts](src/main/index.ts) — path-validierter Zugriff aus dem Renderer für @font-face live preview
- DesignPanel Font-Browser: Cards gruppiert nach Sans/Serif/Mono, jede Card rendert Family-Name + Beispiel-Satz in eigener Schrift, Apply-Buttons für Body/Heading/Code, Active-Pills bei aktueller Zuweisung
- AcknowledgmentsDialog zeigt Fonts in eigener Section neben Packages

**3. Custom-Code-Escape-Hatch (`2b64813`):**
- ProjectStyle.custom.preamble — free-form Typst-Source der ans Ende von style.typ angehängt wird. Wrapped in fenced markers, sodass Round-Trip-Regenerierung den Block niemals zerstört
- `extractCustomBlock()` parsed den Block beim Laden zurück. style:get IPC fällt auf disk-style.typ zurück, wenn style.json leer ist aber on-disk-edits existieren — manuelle Edits an style.typ überleben den nächsten Designer-Save
- DesignPanel-Section "Custom Typst-Code" (collapsible) mit CodeMirror via [CodeEditor.svelte](src/renderer/components/CodeEditor.svelte) — Typst-Syntax-Highlighting, Zeilenzahl-Badge bei nicht-leerem Block

**4. Schema-Erweiterung + Konsolidierung (`5363f12` + `1d63f82`):**
- Schema absorbiert Layout (pageNumbering / pageHeader / pageFooter / pageFill), Scale (paragraphSpacing / firstLineIndent), Headings.numbering. Sanitizer mit `pickLenOrEmpty` und `pickFreeString` für die neuen Free-Form-Felder
- DesignPanel um Sections Scale / Layout / Headings (inkl. H1/H2-Subgruppen) erweitert
- Document Settings Dialog **vollständig entrümpelt**: war 320 Zeilen mit 14 Feldern in 5 Sections, ist jetzt 130 Zeilen mit `lang` + `bibliographyStyle`. Blue Info-Hinweis: "Typografie und Design leben jetzt im Design-Tab"
- [settingsParser.ts](src/shared/settingsParser.ts): DocumentSettings auf zwei Felder reduziert, alte balanced-paren/bracket-arg Helpers entfernt (~120 LOC weg)
- QuickSettings-Toolbar-Popover schreibt jetzt scale.base/scale.leading in style.json + triggert style.typ regen
- docxSerializer akzeptiert optionalen `ProjectStyle`-Parameter, resolveConfig liest Typografie aus style, lang weiterhin aus DocumentSettings. importExport.ts lädt style.json und reicht es durch
- Konflikt-Banner (Phase A Hack für "manuelle #set Rules in main.typ") entfernt — kein Pfad mehr konkurriert
- Legacy "Style Templates"-Submenu aus dem Document-Menü entfernt. IPC-Handler + `applyStyleTemplate` bleiben für die MCP-Tools `vswrite_list_styles` / `vswrite_apply_style`, bis das neue Theme-Preset-Format steht

**Verifikation:**
- Build: 3.72 MB Renderer-Bundle (Coloris + DesignPanel + CodeMirror-Wiederverwendung)
- svelte-check: 0 Errors (4 vor-existente pdfjs/CSS-Errors als Bonus mitbehoben)
- End-to-end Compile: Editorial-Palette + Crimson Pro + IBM Plex Sans + JetBrains Mono + #set page numbering/header + style.json roundtrip → 23 KB PDF, Null Typst-Warnings

**Phase B Round 2 (gleicher Session 22 Tag, nach den vier Foundation-Commits):**

- **H1–H6 Heading-Designer (`922e2f7`):** StyleHeadings auf alle sechs Level erweitert mit progressive size reduction (24pt → 10pt). Generator loopt über HEADING_LEVELS statt hardcoded H1/H2. DesignPanel-Cards sind collapsible (H1+H2 default offen, H3-H6 zu) mit Live-Preview-Sample in der eigenen Heading-Font + Weight + Color-Slot, plus Summary-Line "size · weight · color" wenn collapsed.
- **Special-Elements (`890d5fc`):** Strukturierte Tokens für vier Block-Elemente. Blockquote (Border-Slot/Width, Padding, Text-Slot, Italic), Code-Block (Background als raw Typst color expr mit kurzer Dropdown-Curation, Padding X/Y, Border-Radius), Figure (Caption position/size/color/align/separator), Table (Header-BG/Text-Color-Slots, optionale Zebra-Rows via `calc.rem` + `style-colors.muted.lighten(85%)`, Border-Slot, Cell-Padding). Generator emittet pro Element ein `#show`-Rule. Callouts bewusst draußen — `gentle-clues`-Paket übernimmt das via Custom-Code-Block.

**Phase B Round 3 — Themes + Layout-Presets (Session 22, später am Tag):**

- **6 Theme-Presets (`aee6b79`):** Classic Academic, Modern Tech, Editorial Magazine, Minimal, Marketing Brochure, Thesis. Jedes ist ein vollständiger ProjectStyle-Snapshot. Apply überschreibt alle Branches außer `custom.preamble` (Escape-Hatch-Code bleibt). [themePresets.ts](src/shared/themePresets.ts) mit `theme(overlay)`-Helper für kompakte Definition als Overlay über Defaults. Im DesignPanel neue "Themes"-Section mit Cards: 5-Stripe-Swatch + body/heading/code-Sample + "best for"-Zeile.
- **6 Layout-Presets + `layout.orientation` Schema (`ac443a3`):** A4 Portrait Standard, A4 Landscape, Magazine 2-Column, Newsletter 3-Column, A5 Booklet, A2 Poster. Schema um `orientation: 'portrait' | 'landscape'` erweitert; Generator emittiert `flipped: true` für Landscape. Manche Presets passen Base-Size an (A5 → 10pt, A2 → 14pt, Newsletter → 9.5pt). DesignPanel "Layout-Presets"-Section mit Mini-Page-Icon (orientation-aware: 1-col = horizontale Bars, 2/3-col = vertikale Spalten). [layoutPresets.ts](src/shared/layoutPresets.ts).

**Phase C — 9 Design-MCP-Tools (`7c46333`):**

- **Migration:** `vswrite_list_styles` und `vswrite_apply_style` zeigen jetzt auf THEME_PRESETS statt der retired Preamble-String-Templates. apply_style schreibt in style.json, regeneriert style.typ, ensure-includes; preserviert `custom.preamble`.
- **Neu:** `vswrite_get_style` (full ProjectStyle JSON), `vswrite_update_style` (deep-merge mit Per-Leaf-Sanitizer — partial wie `{ colors: { primary: "..." } }` reicht), `vswrite_list_fonts` (liest fonts/manifest.json, gibt family/category/description), `vswrite_apply_palette` (presetId ODER per-slot hex, kombinierbar), `vswrite_list_layouts` / `vswrite_apply_layout`, `vswrite_list_design_elements` / `vswrite_insert_design_element` mit 6-Element-Library (Banner / Sidebar / Pull-Quote / Callout / Hero / Divider — alle referenzieren `style-colors.*` so dass sie automatisch re-themen), `vswrite_generate_layout` (NL-Intent → Theme + Layout + optionaler Hero — z.B. "brochure" → marketing-brochure + magazine-2col mit Hero).
- **Helpers:** `readProjectStyle`, `writeProjectStyleAndRegenerate`, `deepMergeStyle` in [mcp/server.ts](src/mcp/server.ts). MCP-Server ist separater Prozess, schreibt also style.json und style.typ direkt und ensure-included die root-file.
- **Design-Element-Library in [designElements.ts](src/shared/designElements.ts)** mit parametrischen Snippets. `renderDesignElement(element, params)` substituiert `{name}` Placeholders + conditional sub-blocks (optionale Subtitle, Attribution, Callout-Title).
- MCP_SETUP_VERSION 0.5.0 → 0.6.0 (existierende Pro-User müssen Wizard re-runnen für neue Tools).

**Phase D — Design-Skill (`f71c196`):**

- [DESIGN_SKILL](src/shared/skillTemplates.ts) ergänzt: Color Theory (5-Slot-Verständnis, WCAG-Regeln, Palette-Combination), Typography Pairing (Bundled-Font-Cheat-Sheet, Working-Combos, Anti-Pairs), Heading Hierarchy (≥20% Size-Reduction, Numbering-Conventions), Layout Patterns (Single/Multi-Column, Don'ts), Elements (per-Element Design-Regeln), "Modern Looks 2026" (high contrast, tight tracking, single accent), Anti-Patterns (Word-Default-Look, Font Proliferation, Sub-Pixel-Tracking, Centered-Body, Decorative-Divider-Overuse), Workflow-Rezept für "make this look like X".
- In `ensureClaudeSkills` als 5. Skill registriert → `.claude/skills/design/SKILL.md` in jedem neuen Projekt.
- MCP-Prompt `design-conventions` im Server registriert.

**Phasen B + C + D damit komplett.** Stand des Design-Editors: Designer im DesignPanel kann Color/Font/Scale/Layout/Heading/Elements/Custom-Code editieren; Themes und Layout-Presets als One-Click-Apply; Claude kann über MCP-Tools strukturiert manipulieren; Design-Skill gibt der KI die Vokabel zum Reasoning.

**Follow-up Session 22 — Generator-Bug-Fix + Sample-Erweiterung (`82efbff`):**

- **Echter Typst-Bug gefunden und gefixt:** der Phase-A-`#include "style.typ"`-Approach war fundamental falsch. In Typst propagieren `#set`-Rules aus einer `#include`d-Datei NICHT in den Scope des Includers — sie greifen nur innerhalb der eigenen Auswertung. Heisst: alle Projekte mit dem Include-Pattern haben Paper-Size, Heading-Numbering, Font-Choices stillschweigend ignoriert. Repro: `#include "style.typ"` mit `#set page(paper: "a5")` rendert immer noch A4.
- **Fix:** Generator emittiert jetzt `#let apply-style(body) = { … body }` mit allen Set/Show-Rules drin. `ensureStyleInclude` schreibt `#import "style.typ": *` + `#show: apply-style` an den Top der Root-Datei. Legacy `#include "style.typ"` wird in-place migriert beim naechsten style:save. Die Palette `style-colors` bleibt module-level damit Body-Content sie direkt referenzieren kann.
- **Sample-Projekt fleshed out:** [resources/sample-project/](resources/sample-project/) hat jetzt `.vswrite/style.json` mit Classic-Academic-Theme + custom.preamble fuer math-equation/figure-numbering/link-styling. `main.typ` nutzt den neuen `#import`-`#show`-Pattern, hat bundled-package imports fuer `wrap-it` + `gentle-clues`, und einen Hero-Block als Title. Neue Chapter `07-design-showcase.typ` als Tutorial-Walk-Through: H1–H6-Hierarchie, Blockquote, Pull-Quote, gentle-clues Callouts (info/tip/warning/memo), inline + block Code, nummeriert Math mit Cross-Ref, Figure mit Caption, Text-um-Bild via `wrap-content`, Tabelle mit Header + Zebra, Theme-Switching-Workflow. ~365 KB PDF, null Warnings gegen die gebuendelten Pakete und Fonts.
- **MCP-Binary** fuer beide Darwin-Arches neu kompiliert mit dem gefixten Generator, sodass `vswrite_apply_style` / `vswrite_update_style` Calls von Claude Desktop tatsaechlich funktionierende Preambles produzieren.

**Was noch offen ist:**
- Cover-Page-Builder (Title / Logo / Hero-Image-Overlay) — bewusst nicht gebaut, zu spezifisch
- v1.0 Distribution-Pipeline (Firebase + DMG + Notarization) — siehe `next-steps.md` Phase 4

### Session 21 (2026-05-17) — Design-Editor Phase A: Style Variables

**Phase A des Design-Editors umgesetzt** ([design-editor-plan.md](done/design-editor-plan.md)): strukturierte „Design-Tokens" pro Projekt, bidirektional zwischen JSON-Modell und Typst-Preamble synchronisiert. Erste Etappe der Akademiker→Design-Tool-Pivots, die in Session 20 mit dem Package-Bundling begann.

**Datenmodell:**
- [src/shared/styleTypes.ts](src/shared/styleTypes.ts) — `ProjectStyle` Schema (version: '1'), 5 semantische Farb-Slots (primary / accent / text / background / muted), 3 Font-Slots (body / heading / code), Scale (base / leading), Layout (paper / margin / columns), Headings (H1 / H2 mit size / weight / color-slot / marginTop). `sanitizeProjectStyle()` validiert per Regex (Hex / Typst-Length / Paper-Slug / Weight-Keyword) und kollabiert kaputte / fehlende Felder still auf Defaults — keine Exceptions im Frontend nötig.
- Persistenz in [persistenceManager.ts](src/main/persistenceManager.ts) per `getProjectStyle` / `saveProjectStyle` / `hasProjectStyle`. Datei `<project>/.vswrite/style.json` — vierte Säule der projektlokalen Persistenz neben Versionen, Auto-Backups, AI-Snapshots, Preferences. Saubere Trennung weil späteres Phase-B/C/D-Tooling (Visual Editor, MCP-Tools, Skill) die Style-Surface adressieren wird.

**Generator + Migration:**
- [src/shared/styleParser.ts](src/shared/styleParser.ts) — `generateStyleTypst(style)` emittet einen deterministischen Preamble: `#let style-colors = (...)` Palette + `#set page`, `#set text`, `#set par`, `#show raw`, `#show heading.where(level: N)` Regeln. Palette-Variable bewusst exponiert, damit Phase-C-MCP-Tools (`vswrite_apply_palette`) und Phase-D-Design-Skill Farben per Namen referenzieren können statt Hex-Codes durch den Generator zu jagen.
- `ensureStyleInclude(rootFileContents)` schiebt `#include "style.typ"` an die Spitze des Root-Files, überspringt Top-Kommentare. Idempotent.
- `detectStylePreambleConflicts(...)` scannt die Preamble auf manuelle `#set text|page|par|heading(...)` und `#show heading…` und gibt sie zurück. **Wichtig:** wir schreiben den Include trotzdem — Typsts „later wins"-Regel hält bestehendes Verhalten stabil. Das Banner ist UX-Hinweis, kein Blocker.
- Erste Implementierung emittierte CSS-Style-Fallbacks `("Inter", "sans-serif")`. Typst hat aber keine generischen Familien-Aliase — `"sans-serif"` ist für Typst ein Schriftname und löste pro Compile vier `unknown font family`-Warnings aus. Korrigiert: single-string fontLiteral. Echte Fallback-Ketten gehen weiterhin in Typst, kommen in Phase B mit dem Multi-Font-Picker zurück.

**IPC + Frontend:**
- [ipcHandlers.ts](src/main/ipcHandlers.ts) — `style:get` (returned `{ style, initialized }`) und `style:save` (sanitized + persisted + `style.typ` geschrieben + Include nachgezogen + offene Editor-Datei synchronisiert wenn nötig + Compiler getriggert + Konflikt-Findings zurückgegeben). `INVOKE_CHANNELS` in [preload-entry.ts](src/main/preload-entry.ts) entsprechend whitelist'd.
- [SettingsPanel.svelte](src/editor/components/SettingsPanel.svelte) — neue Tab-Bar (`Style` / `Document`), Style-Tab default-aktiv. Color-Slots mit nativer `<input type="color">` + Hex-Textfeld. Heading-Subgruppen via `.settings-subgroup` (linker Akzent-Border). Bestehende Document-Sektionen (Text / Page / Paragraph / Headings / Bibliography) unverändert im Document-Tab.
- App-Seite: `currentStyle` + `styleConflicts` in [appState.svelte.ts](src/renderer/appState.svelte.ts); [messageHandler.ts](src/renderer/messageHandler.ts) lädt Style parallel zum `settingsData`-Event; [App.svelte](src/renderer/App.svelte) ruft `style:save` ab und zeigt bei Konflikt-Findings ein gelbes Banner unten rechts mit Liste der überschreibenden `#set`-Zeilen.

**Migration für Bestandsprojekte:** kein Auto-Migrate, kein Pflicht-Migrate-Button. Existierende Projekte öffnen ohne Änderung; Style-Tab zeigt Defaults. Beim ersten „Apply" entstehen `style.json` + `style.typ` + `#include`, vorhandene inline `#set` bleiben stehen (überlagern). Banner-Hinweis lädt zum Aufräumen ein, blockiert aber nichts.

**Verifikation:**
- electron-vite build clean (3,66 MB Renderer-Bundle, +~3 KB für die Style-Schicht)
- svelte-check: 0 Errors (4 vor-existente PDFjs- / CSS-Side-Effect-Errors mitbehoben — siehe „Cleanup" unten)
- End-to-End: generierter `style.typ` aus Defaults + minimaler `main.typ` mit `#include` kompiliert offline gegen die in Session 20 gebündelten Packages — keine Warnings, 20 KB PDF.

**Cleanup bei der Gelegenheit (4 vor-existente svelte-check-Fehler):**
- [src/renderer/assets.d.ts](src/renderer/assets.d.ts) — `declare module '*.css'` für die side-effect CSS-Imports in `main.ts` und `TerminalPanel.svelte`
- [PdfPreviewPanel.svelte:176](src/renderer/components/PdfPreviewPanel.svelte:176) und [PdfFileViewer.svelte:166](src/renderer/components/PdfFileViewer.svelte:166) — `canvas` Property ins pdfjs `page.render(...)` Argument mit aufgenommen (neue Typings verlangen es)

**Was bewusst draußen blieb (Phase B oder später):**
- Color-Palette-Tool, Bild-Color-Extraction, Font-Browser mit Preview, H3–H6 Tuning, per-Section-Style-Overrides, Cover-Page-Builder. Phase-A-UI ist absichtlich „plain dropdowns + color picker" — die richtigen Hebel kommen erst nachdem das Datenmodell stabil ist.

### Session 20 (2026-05-17) — Bundled Typst-Package Infrastructure

**Hybrid-Bundling-Strategie umgesetzt:** vswrite bringt jetzt 24 Typst-Packages (13 user-facing + 11 transitive Deps) als Offline-Bundle mit. Erster Compile eines Dokuments, das `wrap-it`, `cetz`, `fletcher`, `lilaq`, `showybox`, `codly` etc. nutzt, braucht kein Internet mehr. Klar abgegrenzt vom Lazy-Fetch-Pfad: Packages ausserhalb der Whitelist gehen weiterhin ueber Typst's CDN.

**Bundle-Liste (13 user-facing, MIT / Unlicense bis auf eines):**
- **Layout/Flow:** `wrap-it` (Unlicense), `meander` (MIT), `drafting` (Unlicense)
- **Graphics:** `cetz` 0.5.2 (LGPL-3.0-or-later — einziges Copyleft im Bundle, OK weil unmodifiziertes Bundling + Source vollstaendig accessible), `fletcher` (MIT), `lilaq` (MIT)
- **Editorial/Decoration:** `droplet` (MIT), `codly` (MIT) + `codly-languages` (MIT), `showybox` (MIT), `gentle-clues` (MIT)
- **Academic:** `glossarium` (MIT), `subpar` (MIT), `lovelace` (MIT)
- **Transitive (auto-discovered aus Package-Sources):** `oxifmt`, `cetz 0.3.4` (fuer fletcher — andere Version als die user-facing 0.5.2, beide Versionen koexistieren), `linguify`, `elembic`, `komet 0.1.0` + `komet 0.2.0`, `suiji`, `tiptoe`, `zero`, `hy-dro-gen`

**Build-Pipeline:**
- [scripts/fetch-typst-packages.mjs](scripts/fetch-typst-packages.mjs) — laedt alle 24 Packages aus dem offiziellen `packages.typst.org` CDN nach `resources/typst-packages/preview/<name>/<version>/`. Idempotent. LICENSE-Fallback per `licenseFetch: <URL>`-Override im Manifest fuer Packages mit fehlenden / Placeholder LICENSE-Files (tiptoe, elembic, oxifmt liefern leere oder dual-license Stub-Texte — wir holen die echten MIT-Texte direkt von GitHub).
- [scripts/audit-bundled-deps.mjs](scripts/audit-bundled-deps.mjs) — klassifiziert jede LICENSE per Fingerprint-Matching, cross-checked gegen typst.toml-Declaration, failed auf Deny-List (GPL/AGPL — bei uns NICHT vorhanden), generiert [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md) + `resources/typst-packages/bundle-licenses.json` (fuettert die In-App-Acknowledgments).
- [package.json](package.json) `package:mac` Script kettet jetzt: `build → build:mcp-binary:all → fetch:packages → audit:packages → electron-builder`. Audit failed = Release-Build failed.
- `extraResources` erweitert um `resources/typst-packages/preview/` — landet im signierten .app unter `Contents/Resources/typst-packages/`.

**Typst-CLI-Wiring:**
- Neue Funktion `getTypstPackagePath()` in [typstPath.ts](src/main/typstPath.ts) resolved dev (Repo-Pfad) vs. prod (`process.resourcesPath/typst-packages`).
- Neue Helper-Funktion `buildTypstCompileArgs()` praependiert `--package-path <path>` zu jedem `typst compile`-Aufruf. Verwendet in [typstCompiler.ts](src/main/typstCompiler.ts) (Live-Preview) und [importExport.ts](src/main/importExport.ts) (PDF-Export).
- MCP-Server ([src/mcp/server.ts](src/mcp/server.ts)) hat seinen eigenen `typstCompileArgs()`-Helper, der `TYPST_PACKAGE_PATH` aus den env-Variablen liest. [mcpSetup.ts](src/main/mcpSetup.ts) schreibt diese Env-Var beim Wizard-Run in die Claude-Desktop-Config (zusammen mit `VSWRITE_LICENSE_KEY`), zeigt auf den .app-Resources-Pfad. `MCP_SETUP_VERSION` auf 0.4.0 gebumpt damit der Wizard fuer existierende Pro-Nutzer wieder auftaucht und die Env-Var nachtraegt.

**In-App-Acknowledgments:**
- [AcknowledgmentsDialog.svelte](src/renderer/components/AcknowledgmentsDialog.svelte) — Modal mit License-Summary-Chips, ausklappbarer Pro-Package-Card mit vollem LICENSE-Text, Repo-Link, Notes (z.B. LGPL-Hinweis fuer cetz). Liest aus `bundle-licenses.json` ueber neuen IPC-Channel `app:getBundleLicenses` (resolved dev vs. prod automatisch).
- Button "Open Source Lizenzen" in den [AboutDialog.svelte](src/renderer/components/AboutDialog.svelte) Links eingehaengt.

**Skill-Updates:**
- [TYPST_SKILL](src/shared/skillTemplates.ts) — neuer Abschnitt "Bundled Packages" mit Per-Package-Code-Beispielen + pinned-Versionen + Hinweis dass diese offline-tauglich sind. Agents (lokal via `.claude/skills/typst/SKILL.md` oder ueber den MCP-Prompt `typst-reference`) wissen ab jetzt, welche Packages sie aus dem Bundle benutzen koennen statt zu raten.
- [VSWRITE_SKILL](src/shared/skillTemplates.ts) — kurzer Verweis-Block, der die Liste der 13 user-facing Packages nach Kategorie zusammenfasst und auf den `typst`-Skill fuer Details verweist.
- MCP-Binary mit den aktualisierten Skill-Strings neu kompiliert (`bun build --compile`, ~135 ms).

**Smoke-Test:** Test-Dokument mit `showybox`, `gentle-clues`, `fletcher` (zieht transitiv `cetz:0.3.4`), `codly` + `codly-languages`, `droplet` kompiliert sauber zu 29 KB PDF — alles offline aus dem Bundle, keine CDN-Calls.

### Session 19 (2026-05-16) — Writing-Style Skill

**Vierter Skill neben typst / vswrite / research:** [WRITING_STYLE_SKILL](src/shared/skillTemplates.ts) — Prosa-Checkliste fuer akademisches und nicht-fiktives Schreiben. Ziel ist nicht "schreib anders als die KI", sondern "revidiere, was die KI (oder du an einem muden Tag) geschrieben hat". Zweisprachig EN + DE, weil AI-Tells nicht symmetrisch sind: deutsche Akademiker neigen zu Schachtelsaetzen mit "es zeigt sich, dass…", englische zu Triplets und "delve into" — die KI macht beide.

**Vier Sektionen:**
- **A) Anti-AI-Tells (9 Pattern):** Em-Dash-Inflation, "Not just X, but Y" / "Nicht nur X, sondern Y" (laut Skill der staerkste Marker), Dreierlisten-Reflex, vague hedging (`various`/`moeglicherweise` kumulativ), Buzzword-Konzentration (`delve into`, `tapestry`, `Landschaft`, `nahtlos`), Closing-Statement-Reflex (`In conclusion`/`Abschliessend laesst sich sagen`), Furthermore-by-default, symmetrische Parallelismen, Throat-Clearing-Openers. Jedes Pattern mit before/after-Beispielen in beiden Sprachen.
- **B) Aktiv-Prinzipien:** Konkret > abstrakt (Zahlen + Namen statt "various studies"), Aktiv-Default (Methoden-Sektionen ausgenommen), Satz-Rhythmus-Variation, Trust-the-Reader (Cross-References statt Prosa-Meta-Talk), Voice-Preservation nach AI-Revision.
- **C) Akademik-Konventionen:** Tempus-Map nach Sektion (Abstract/Intro/Method/Results/Discussion, EN + DE), Hedging gehoert in Discussion + Limitations nicht in Methods/Results, Citation-Integration (`@chen2021codex` Badge statt prose-form "(Chen et al., 2021)"), Listen-vs-Prosa-Faustregel, deutsche vs. englische akademische Register-Unterschiede.
- **D) Source Discipline (Anti-Hallucination)** — vom Skill explizit als hoechster Hebel markiert: nie Citekeys oder BibTeX-Eintraege oder Zitate erfinden (\`vswrite_get_citations\` zuerst, dann entweder mit \`vswrite_add_citation\` aus echter Quelle anlegen oder ohne Citation + `needs source`-Comment schreiben), Verb-Inflation vermeiden (`suggests` → `proves` ist Fabrikation), Zitate verbatim aus geoeffneter PDF (\`vswrite_find_source_for_citation\` zuerst), Seitenzahlen verifizieren, Multi-Source-Claims brauchen echte Mehrzahl, kein Citation-Laundering (Survey-Quellen offenlegen), Pre-Submission-Audit-Workflow ueber alle Citekeys.

Abschluss: Revisions-Checkliste in zwei Bloecken (Integrity zuerst — fuenf Source-Verification-Schritte —, dann Style mit acht Stil-Schritten) plus erweiterte "Don't"-Liste mit drei expliziten Anti-Fabrikations-Geboten zu Beginn.

**Verkabelung:**
- [skillTemplates.ts](src/shared/skillTemplates.ts) — neuer `WRITING_STYLE_SKILL` String-Konstante
- [projectManager.ts](src/main/projectManager.ts) — `ensureClaudeSkills` deployed jetzt vier Skills, neuer wird beim naechsten Open neu angelegter Projekte gezogen (per-file-guard, also keine Ueberschreibung bestehender Skills in alten Projekten)
- [mcp/server.ts](src/mcp/server.ts) — `SKILL_PROMPTS` erweitert um `writing-style`, gespeist aus `.claude/skills/writing-style/SKILL.md`
- Handbuecher (DE+EN) listen den neuen Prompt unter "Verfuegbare Prompts"; CLAUDE.md aktualisiert ("drei → vier skill prompts")

**Bestandsprojekte:** der `per-file-guard` in `ensureClaudeSkills` schreibt das SKILL.md nur wenn nicht vorhanden — alte Projekte bekommen den Writing-Style-Skill bei naechstem Open automatisch dazu. Pre-existierende Skills bleiben unangetastet.

### Session 18 (2026-05-16) — Auto-Discover MCP Server

**Problem:** Nutzer mussten den MCP-Server manuell in `claude_desktop_config.json` eintragen — abschreckend, error-prone. Erster Wurf war zudem an die Electron-App gekoppelt (Path zeigte auf vswrite-Binary mit `ELECTRON_RUN_AS_NODE=1`), was zwei Symptome erzeugte: vswrite musste vor Claude starten, und Quittieren von vswrite killte den MCP-Child. Fix: synova-style Setup-Wizard + Bun-compiled Standalone-Binary, vollstaendig entkoppelt.

**Standalone-Binary via Bun --compile:**
- Neues Script [scripts/build-mcp-binary.mjs](scripts/build-mcp-binary.mjs) — kompiliert `src/mcp/server.ts` mit `bun build --compile --minify` zu single-file Native-Binary (~64 MB, JavaScriptCore-Runtime eingebacken). Default: Host-Arch nur; `--all` produziert `aarch64-apple-darwin` + `x86_64-apple-darwin`. Drop-in `vswrite-mcp` alias auf Host-Build fuer manuelles Testen.
- npm-Scripts: `build:mcp-binary` (host) + `build:mcp-binary:all` (arm64 + x86)
- Output: `dist/mcp/bin/vswrite-mcp-<triple>`
- esbuild-`.mjs`-Pfad bleibt fuer den Fall dass jemand den Server doch lieber unter eigenem Node fahren will, wird aber nicht mehr vom Wizard verwendet

**Setup-Wizard ([McpSetupWizard.svelte](src/renderer/components/McpSetupWizard.svelte)):**
- Opt-in Modal, States `intro (probing) → no_claude | unsupported | ready → running → done | error`
- Wird 2 s nach Boot automatisch aufgemacht wenn `mcpSetupVersion !== MCP_SETUP_VERSION` (electron-store) und `process.platform === 'darwin'` und kein Crash-Dialog ansteht
- Auch manuell ueber `Help → Mit Claude Desktop verbinden…`
- "Spaeter"-Button stasht die aktuelle Version damit der Wizard nicht bei jedem Boot kommt; manuelle Re-Trigger ueber das Menue bleiben moeglich

**Setup-Logik ([mcp/src/main/mcpSetup.ts](src/main/mcpSetup.ts)):**
- `MCP_SETUP_VERSION = '0.3.0'` — bei Bump triggert der Wizard automatisch wieder
- `checkClaudeDesktopInstalled()` probt `/Applications/Claude.app` + `~/Applications/Claude.app`
- `setupMcpServer()` — pre-flight Pro-Lizenz-Check (Pull aus electron-store via `getLicenseData()`), Binary-Copy `<resources>/mcp/bin/vswrite-mcp-<triple>` → `~/Library/Application Support/vswrite/mcp-server/vswrite-mcp`, `chmod 755`, dann Merge in `claude_desktop_config.json` (idempotent + preserved-servers + timestamped Backup)
- Resultierender Config-Eintrag: `{ command: "<copied-path>", env: { VSWRITE_LICENSE_KEY: <key> } }` — kein Node noetig, keine args, kein Path-Hassle. Lizenz-Key in env statt args damit er nicht in `ps`-Output auftaucht
- Refuses-to-overwrite-invalid-JSON, refuses-non-object-mcpServers — defensives Merging gegen verkorkste User-Configs

**Hardened Runtime + Notarization:**
- Bun-Binary braucht `disable-library-validation` zusaetzlich zu den `allow-jit` Entitlements der Main-App. Loesung: separate Entitlements-File [build/entitlements.mac.mcp.plist](build/entitlements.mac.mcp.plist) NUR fuer die Binary, Main-App behaelt strengere Entitlements
- electron-builder `afterPack`-Hook [scripts/afterPack-sign-mcp.mjs](scripts/afterPack-sign-mcp.mjs) re-signiert die Binary nach electron-builders Default-Sign mit der MCP-Entitlements-Datei. Skipped auf non-macOS und auf unsigned Dev-Builds
- `package.json` `afterPack`-Eintrag verkabelt den Hook in den Build-Flow

**Bundling ([package.json](package.json)):**
- `extraResources` erweitert um `dist/mcp/bin/` mit Filter `vswrite-mcp-*` → Binary landet unter `Contents/Resources/mcp/bin/` im signierten + notarized .app
- `dist/mcp/**` aus dem `files`-Pattern excluded, da via extraResources ausgeliefert (vermeidet Duplikat in asar)

**IPC-Surface ([ipcHandlers.ts](src/main/ipcHandlers.ts), [preload-entry.ts](src/main/preload-entry.ts)):**
- 5 neue Channels: `mcp:checkClaudeDesktop`, `mcp:setup`, `mcp:openClaude`, `mcp:getSetupStatus`, `mcp:skipSetup`
- `mcp:skipSetup` stasht die aktuelle Version damit ein Dismiss persistent ist

**Persistence ([persistenceManager.ts](src/main/persistenceManager.ts)):**
- Neuer `mcpSetupVersion`-Key im StoreSchema + `getMcpSetupVersion` / `saveMcpSetupVersion`

**Menue ([menuBuilder.ts](src/main/menuBuilder.ts)):**
- Help-Menue bekommt „Mit Claude Desktop verbinden…" als separaten Eintrag

**Verifikation:**
- Bun-Compile durchgelaufen (303 module bundled, ~152 ms compile, 64 MB Binary)
- Smoke-Test der Binary: stdio-aufruf liefert sauberen License-Required-Error (Runtime + License-Check leben)
- Im laufenden Setup wurde das Tool-Listing im Claude-Code-Agent ad-hoc um alle 43 `mcp__vswrite__*` Tools erweitert — der MCP-Server laeuft also wirklich Standalone und wird parallel von Claude Desktop wie auch von Claude Code aufgegriffen

**Bug-Fixes beim Implementieren:**
- Erster Wurf hatte `command = process.execPath` mit `ELECTRON_RUN_AS_NODE` env — bedeutet jeder Quit von vswrite killte den MCP-Child. Bun-Binary loest das endgueltig: separater Prozess, separater Filesystem-Pfad, keine geteilte Identitaet.
- Bei den ersten Tests hat der Server immer mit „License required" abgebrochen. Behoben durch License-Pull aus electron-store + Schreiben als env in den Config-Eintrag. Wenn die User-Lizenz nicht Pro ist, blockt der Wizard mit verstaendlicher Fehlermeldung bevor er die Config anfasst.

### Session 17 (2026-05-15) — Document Zoom

**Per-Dokument-Zoom fuer Editor + PDF-Vorschau (50–200 %, Schritt 10 %):**
- Beide Zoom-Levels unabhaengig, **pro Projekt persistiert** in `<project>/.vswrite/preferences.json` — vierte Persistenz-Schicht neben Git-Versionen, Auto-Backups und AI-Snapshots, faellt in den bestehenden „alles im Projektordner"-Vertrag
- Neuer State [zoomState](src/renderer/appState.svelte.ts) `{ editor, pdf }` + Helper (`setEditorZoom`/`zoomEditorIn`/`resetEditorZoom`, dito `Pdf*`), Konstanten `ZOOM_MIN=0.5` / `ZOOM_MAX=2.0` / `ZOOM_STEP=0.1`, `clampZoom()` rundet auf 2 Nachkommastellen

**Editor-Zoom:**
- CSS `zoom: var(--editor-zoom, 1)` auf `.editor` — Chromium reflowt das Layout korrekt, ProseMirror-Cursor / Selection-Koordinaten bleiben praezise (im Gegensatz zu `transform: scale()`, das die Click-Koordinaten verschiebt)
- CSS-Variable wird inline auf `.editor-container` gesetzt: `style="--editor-zoom: {zoomState.editor}"`
- Status-Bar bekommt rechts eine **Prozent-Anzeige** als Button; Klick oeffnet ein Popover mit Slider (`min/max` aus ZOOM_*-Konstanten, Step 0.05 fuer Feinkontrolle) + `−` / `+` Buttons + Reset
- Popover hat eigenes `zoom-popover-overlay` (fixed, z-index 199) zum Click-outside-Schliessen

**PDF-Zoom (PreviewPanel + PdfFileViewer teilen sich denselben `pdfZoom`-Wert):**
- pdfjs-Viewport-Skalierung wird mit `BASE_SCALE (1.5) * zoomState.pdf` multipliziert — der Canvas rasterisiert bei hoeherem Zoom mit hoeherer DPI, also keine verwaschene Bitmap
- Placeholder-Wrapper-Width = `(container.clientWidth - 32) * zoomState.pdf`; bei Zoom > 100 % wird die Seite breiter als der Container, horizontaler Scroll greift
- `$effect(zoomState.pdf)` triggert `rebuildAtCurrentZoom()`: `renderedPages.clear()` + Observer disconnect + neue Placeholders + Observer wieder anhaengen — der bereits geladene `currentPdf` bleibt erhalten, nur die Page-Canvas werden re-rasterisiert
- Beide Viewer haben einen schmalen Zoom-Header (`− 100% +`, Prozent klickbar zum Reset)

**Menu + Shortcuts:**
- View-Menue bekommt zwei Submenues: **Editor Zoom** (In `Cmd+Alt+=`, Out `Cmd+Alt+-`, Reset `Cmd+Alt+0`) und **Preview Zoom** (`Cmd+Shift+=` / `-` / `0`)
- Native Browser-Zoom (`Cmd+=` / `-` / `0`) bleibt erhalten, aber unter neuen Labels „Zoom Window In/Out/Reset Window Zoom" — fuer eine Writing-App selten sinnvoll, aber nicht entfernt um keine Erwartungen zu brechen
- Menu sendet IPC `vswrite { type: 'zoomEditorIn' / ... }`, [messageHandler.ts](src/renderer/messageHandler.ts) ruft direkt die Helper aus appState

**Per-Projekt-Preferences (neue Persistenz-Schicht):**
- [getProjectPreferences/saveProjectPreferences](src/main/persistenceManager.ts) liest/schreibt `<project>/.vswrite/preferences.json` mit `{ editorZoom, pdfZoom }`-Schema, `clampZoom`-Sanitisierung beim Laden und Speichern
- IPC `project:getPreferences` / `project:setPreferences` in [ipcHandlers.ts](src/main/ipcHandlers.ts), Preload-whitelisted
- [App.svelte](src/renderer/App.svelte) loadt Prefs beim ersten `currentFile`-Event eines neuen Projekts (cached `loadedPrefsForProject` damit Datei-Wechsel innerhalb des Projekts keinen Re-Load triggert); debouncedes `setPreferences` (400 ms) bei jeder Zoom-Aenderung
- Bei `projectClosed` werden beide Zooms auf 1.0 zurueckgesetzt und `loadedPrefsForProject` durch Window-Event `vswrite:project-closed` geleert — sonst wuerde ein erneutes Oeffnen desselben Projekts die Prefs nicht neu laden
- `.vswrite/preferences.json` wird vom Backup-Ignore-Set + chokidar-Watcher schon abgedeckt (`.vswrite/**`), keine zusaetzlichen Ausnahmen noetig

**Scrollbars (always visible):**
- `.pdf-scroll` und `.editor-container` bekommen `overflow: auto` (vorher nur `overflow-y: auto` — verhinderte Horizontal-Scroll bei Zoom > 100 %)
- `::-webkit-scrollbar` (12 px, abgerundeter grauer Thumb mit 3 px transparent Border fuers Padding-Look) + `scrollbar-gutter: stable`, weil macOS' default Hide-on-Idle dem Nutzer nicht zeigt dass beim Zoom mehr Inhalt verfuegbar ist

**Bug-Fix beim Implementieren entdeckt:**
- PdfPreviewPanel rief urspruenglich `renderPdf(pdfData)` beim Zoom-Aenderung auf — das warf `DataCloneError: ArrayBuffer at index 0 is already detached` weil pdfjs den Buffer beim ersten Laden zum Worker transferiert (Zero-Copy-Optimierung, danach im Main-Thread leer). Fix: PDF-Dokument bleibt geladen, nur Placeholders + Observer werden rebuildet
- Worktree-Setup-Issue gefixt: `node_modules` im Worktree ist leer, pdfjs liegt im Parent-Repo. Vites Dev-Server-Allowlist liess das pdf.worker.mjs urspruenglich nicht durch → `renderer.server.fs.allow` in [electron.vite.config.mts](electron.vite.config.mts) zeigt auf das Parent-Repo-Root

**Geaenderte Dateien:** [appState.svelte.ts](src/renderer/appState.svelte.ts) (+~30 Zeilen), [App.svelte](src/renderer/App.svelte) (Editor-Zoom CSS + Status-Bar-Popover + Prefs-Load/Save), [PdfPreviewPanel.svelte](src/renderer/components/PdfPreviewPanel.svelte) + [PdfFileViewer.svelte](src/renderer/components/PdfFileViewer.svelte) (reaktiver Zoom + Header-Controls + Scrollbars), [PreviewPanel.svelte](src/renderer/components/PreviewPanel.svelte) (Zoom-Header), [messageHandler.ts](src/renderer/messageHandler.ts) (Menu-Dispatcher + Zoom-Reset bei projectClosed), [persistenceManager.ts](src/main/persistenceManager.ts) (Prefs-API), [ipcHandlers.ts](src/main/ipcHandlers.ts) (`project:getPreferences/setPreferences`), [preload-entry.ts](src/main/preload-entry.ts) (Whitelist), [menuBuilder.ts](src/main/menuBuilder.ts) (View-Submenues), [electron.vite.config.mts](electron.vite.config.mts) (Worktree-Allow-List).

### Session 16 (2026-04-29) — Pre-Launch-Polish

**MCP-Server expanded 26 → 43 Tools, Server-Version 0.5.0 → 0.9.0:**
- **Tier 1 (Writer-Features):** `list_comments` / `add_comment` / `resolve_comment` / `delete_comment`, `list_labels`, `insert_reference` (Label-Existenz-Check + Vorschlaege fuer aehnliche Labels, Auto-Space wenn vorheriger Char alphanumerisch — Typst-Syntax-Zwang), `add_footnote` (Klammer-Balance-Check)
- **Tier 2 (Discovery):** `search_project` / `replace_in_project` (lookarounds fuer whole-word, damit `@citekey`-Backlinks funktionieren), `find_source_for_citation`
- **Tier 3 (Import / Export / Assets):** `export_docx` (echte Word-Styles), `import_markdown` (inline ODER srcPath), `add_image` (Content-Hash-Dedup auf `assets/`, Figure-Builder mit Caption + Label, optional Inline-Insert via Anchor)
- **Versionen-Block (4):** `save_version` (auto-init Git + .gitignore), `list_versions`, `show_version` (per-File-Diff), `restore_version` — spiegelt das ProjectPanel-Vokabular im MCP
- **Maintenance:** `vswrite_export_pdf` ging vorher mit beliebigen Absolutpfaden raus → jetzt `resolveInsideProject` + Auto-mkdir fuer `exports/`. `vswrite_compile` zum reinen Verifier vereinfacht (kein SVG, kein Output-Path, Artefakt-Schreiben uebernehmen die Export-Tools)
- **Refactors als Beifang:** `projectLabels` + `projectSearch` nehmen jetzt einen optionalen `projectDir`-Parameter (dual-tauglich fuer IPC und MCP), `findSourceForCitation` aus `ipcHandlers.ts` ausgelagert in eigenes Modul `citationSources.ts`, `messages.ts` bekommt `PreviewPdfUpdateMessage` + `ExportStatusMessage` (Type-Hygiene-Fix — `as unknown as`-Casts in `messageHandler.ts` weg)
- **Gemeinsamer Helper** `findAnchorOffset()` im MCP-Server fuer das wiederkehrende Pattern „finde n-tes Vorkommen, sonst sprechende Fehlermeldung mit Treffer-Anzahl"

**Skills-Overhaul (~15 Zeilen pro Skill → ~150):**
- Inhalt aus den Inline-Strings in `projectManager.ts` raus, in neues Modul [src/shared/skillTemplates.ts](src/shared/skillTemplates.ts) (~6.500 chars pro Skill)
- Tilde-Fences (`~~~`) statt Triple-Backticks im Source — keine Escape-Hoelle mehr in TypeScript-Strings
- **typst:** Cross-Refs mit Praefix-Konventionen, Equation-Numbering-Voraussetzung (`#set math.equation(numbering: "(1)")`), Footnotes mit Bracket-Escaping, Source-vs-vswrite-Comments-Unterscheidung
- **vswrite:** Drei Persistenz-Schichten, `sources/`-Naming-Konvention, `comments/`-YAML-Schema, Citation-vs-Reference-Disambiguierungs-Heuristik, Mode-Toggles, **MCP-Tool-Mapping-Tabelle** (welcher Use-Case → welches Tool)
- **research:** 4-Phasen-Workflow (Discover / Capture / Synthesize / Integrate), Backlinks-Pattern, Bulk-Refactor mit Versions-Sicherheitsnetz, Pre-Submission-Checkliste
- **Dual-tauglich:** jede Skill erklaert sowohl Filesystem-Pfad (Terminal Claude / VS Code Claude / Cowork mit Folder-Permission) als auch MCP-Tool-Pfad
- `ensureClaudeSkills` jetzt **per-File-Guard** (vorher Dir-Level): User-Anpassungen bleiben erhalten, neue Skills werden bei Open nachgezogen wenn fehlend

**Lokales Crash-Reporting (statt Sentry):**
- Eigenes Konzept gewaehlt — passt zum Trust-Profil von Schreibsoftware. Daten verlassen das Geraet nur durch aktive User-Action
- Neues Modul [src/main/crashReporter.ts](src/main/crashReporter.ts) mit `setupCrashCapture` / `addBreadcrumb` / `captureMainCrash` / `captureRendererCrash` / `getLatestUnshownReport` / `markLatestAsShown` / `deleteAllReports`
- Boot-Dialog [CrashReportDialog.svelte](src/renderer/components/CrashReportDialog.svelte) mit zwei Views (Intro + Detail), Buttons fuer Copy / Mail / Folder / Discard / Close
- Path-Scrubbing fuer macOS / Linux / Windows User-Pfade vor dem Schreiben
- Help-Menue: „Crash-Berichte oeffnen" oeffnet den Ordner direkt
- **Smoke-Test (24/24 gruen)** mit esbuild-bundled Standalone-Test + gestubbtem Electron — hat zwei echte Bugs vor Production gefangen: (1) Filename-Kollision bei zwei Crashes derselben Sekunde (Fix: ms + 4-char Random im Slug), (2) `parseInt` schnitt Marker-Float ab → derselbe Crash haette bei jedem Boot wieder hochgekommen (Fix: `Number()` mit `Number.isFinite()`-Guard)

**Polish + Bestaetigungsdialog:**
- [ShortcutCheatsheet.svelte](src/editor/components/ShortcutCheatsheet.svelte) refresh: 15 → ~30 Eintraege in 7 Gruppen, alle Sessions-12-15-Shortcuts (`Cmd+Alt+M` / `L` / `R`, `Cmd+Shift+F`) ergaenzt, `Cmd`/`Ctrl`-Switch via `navigator.platform`
- `Cmd+/`-Accelerator auf Help → Keyboard Shortcuts ([menuBuilder.ts](src/main/menuBuilder.ts))
- `cloudPull()` bekommt einen Confirm im Versionen-Vokabular („Cloud-Backup wird mit dem aktuellen Stand zusammengefuehrt … Tipp: Speichere vorher den aktuellen Stand als eigene Version … Fortfahren?"). Push-Error-Toast auch entgittert
- `package.json` 0.1.0 → 0.7.0 (About-Dialog liest via `app.getVersion()` automatisch)

**Sample Project — „Open Sample Project" auf dem StartScreen:**
- Sample lebt unter `resources/sample-project/` (~8 MB, 14 PDF-Seiten kompiliert): Thesis-style Mini-Arbeit ueber AI-gestuetztes wissenschaftliches Schreiben, jedes Feature mindestens 1× demonstriert (Cross-Refs, Figures, Tables, Math, Footnotes, Comments, Code-Blocks, Citations); 5 echte Open-Access-PDFs in `sources/` (chen2021codex, bender2021parrots, weidinger2021risks, ji2022hallucination, liu2023chatgpt)
- Bundling via `extraResources` in [package.json](package.json) → in Production unter `process.resourcesPath/sample-project/`, in Dev unter `resources/sample-project/`
- `openSampleProject()` in [projectManager.ts](src/main/projectManager.ts): Resolver mit Production+Dev-Fallback, rekursive Copy nach User-Wahl-Pfad (Save-Dialog mit Default `~/Documents/vswrite-sample-thesis`, Suffix-Counter bei Konflikt), `git init` + `.gitignore` + Initial-Version "Sample 0.7.0 — initial state", dann normales `openProject`
- IPC-Handler `project:openSample` in [ipcHandlers.ts](src/main/ipcHandlers.ts), Preload-whitelisted
- StartScreen-Button zwischen „New Project" und „Open Project" mit Stern-Icon, eigene Beschreibung „A guided thesis on AI-assisted writing — every feature in one place"

### Session 15 (2026-04-29) — Cross-References

**Backend:**
- Neues Modul [src/main/projectLabels.ts](src/main/projectLabels.ts) — walks alle `.typ`-Dateien (ignoriert `.git`, `.vswrite`, `assets`, `sources`, `comments`), scannt jede Zeile auf `<label>` (Regex `<([a-zA-Z][\w:.-]*)>`), klassifiziert nach Präfix (`fig|tbl|eq|sec|chap|…`) und extrahiert Caption per Heuristik: für Headings die `=+ Heading`-Zeile, für Figuren/Tabellen das nächste `caption: [...]` in den umliegenden Zeilen, für Equations einen `$…$`-Snippet
- Live in-memory Content der offenen Datei wird mitberücksichtigt (analog projectSearch)
- Cap bei 2.000 Labels mit Truncation-Flag
- IPC: `project:listLabels` in [ipcHandlers.ts](src/main/ipcHandlers.ts) + Whitelist in [preload-entry.ts](src/main/preload-entry.ts)

**Editor:**
- Neue TipTap-Node [src/editor/lib/typstReference.ts](src/editor/lib/typstReference.ts) — inline atomic, Attribute `label`, `caption`, `refType`. Rendert als orangene Pille `↳ label` mit Caption als Tooltip. Distinkte CSS-Klasse `.typst-reference` (warmes Orange) zur visuellen Abgrenzung vom blauen `.typst-citation`
- [Serializer](src/editor/lib/serializer.ts): `reference`-Node → `@label`
- [Deserializer](src/editor/lib/deserializer.ts): bestehender `@`-Path erweitert auf `[a-zA-Z][\w:.-]*`, neuer `isReferenceLabel()`-Check entscheidet zwischen `citation`- und `reference`-Segment. Heuristik: Label enthält `:` ODER ist exakt ein bekannter Präfix (`fig|tbl|eq|sec|chap|app|thm|lem|def|cor|prop|algo|lst` und Vollformen). Reine Slugs wie `chen2021codex` bleiben Citations
- Auch der vorgelagerte Raw-Block-Skip-Path wurde auf `:`/`.` erweitert, damit `@fig:results` keine False-Positives in der Raw-Detection auslöst

**UI:**
- Neue Komponente [src/renderer/components/ReferencePicker.svelte](src/renderer/components/ReferencePicker.svelte) — Modal mit Backdrop, Filter-Input, Type-Tabs (Alle / Abb. / Tab. / Gl. / § / Andere), Treffer gruppiert nach Typ mit Caption + `relPath:line`. Keyboard: `↑/↓` navigiert, `Enter` fügt ein, `Esc` schließt
- Eintrag im Slash-Menu: [slashCommands.ts](src/editor/lib/slashCommands.ts) `Reference` mit `↳`-Icon → dispatcht `vswrite:open-reference-picker`-Event
- Native Menü: [menuBuilder.ts](src/main/menuBuilder.ts) `Edit → Insert Reference…` mit Shortcut `Cmd+Alt+L`. Sendet `showReferencePicker`-IPC, der von [messageHandler.ts](src/renderer/messageHandler.ts) zum gleichen Window-Event umgeleitet wird
- App-Integration ([App.svelte](src/renderer/App.svelte)): Listener für das Window-Event, `showReferencePicker`-State, `Cmd+Alt+L`-Shortcut im globalen Keydown-Handler, Render des Modals, `insertReferenceFromPicker`-Callback fügt einen `reference`-Node mit Label / Caption / refType ein

**Doku:**
- [writer-features-plan.md](writer-features-plan.md): Cross-Refs ✅, Implementierungs-Notiz mit Picker-only-Design (kein neuer Inline-Trigger), Disambiguierungs-Heuristik dokumentiert
- [project_status.md](project_status.md) (diese Datei) + [CLAUDE.md](../CLAUDE.md) erweitert

### Session 14 (2026-04-28) — Outline drag-to-reorder + Inline Source Preview

**Outline drag-to-reorder:**
- [OutlinePanel.svelte](src/renderer/components/OutlinePanel.svelte) komplett überarbeitet — Heading-Rows sind `draggable="true"`. Pro Heading werden jetzt zusätzlich `nodeSize` getrackt
- `blockRange(i)` ermittelt den „Sektions-Block": vom Heading-`pos` bis zum `pos` des nächsten Headings mit gleichem oder höherem Rang (oder bis Doc-Ende). So wandert ein H1 mit allen Unter-Headings + Paragraphen
- Drop-Logik per ProseMirror-Transaction: `slice = doc.slice(from, to)` → `tr.delete(from, to)` → `tr.replace(adjTarget, adjTarget, slice)` mit Position-Korrektur falls Target hinter dem Source-Range lag
- Drop-Indikator: blaue 2-px-Linie zwischen Rows (oben/unten der Hover-Row, abhängig von Y-Position der Maus). Zusätzliches `.outline-end`-Element fängt „Drop ans Ende"
- No-Op-Detection: drop-on-self und drop-direkt-darunter werden ignoriert (vermeidet unnötige Transactions)
- Cross-File-Reorder bleibt dem Chapters-Tab überlassen — Outline sieht nur die offene Datei

**Inline Source Preview (Citation-Hover-Karte):**
- Backend: neuer IPC-Handler `project:findSourceForCitation` in [ipcHandlers.ts](src/main/ipcHandlers.ts) — sucht in `<project>/sources/` nach `<citekey>.pdf` (exact) oder `<citekey>{_,-,space,.}*.pdf` (Prefix). Pfad wird via `isPathWithinProject` validiert. Channel in [preload-entry.ts](src/main/preload-entry.ts) whitelisted
- TypstCitation-Node: Mouse-Enter startet 350-ms-Timer, der `vswrite:citation-hover`-Event mit `{ citekey, rect }` dispatcht; Mouse-Leave dispatcht `vswrite:citation-leave`
- Neue Komponente [CitationHoverCard.svelte](src/renderer/components/CitationHoverCard.svelte): liest Bib-Eintrag aus `getCitationEntries()` (in-memory), zeigt Autor + Jahr + Titel + Citekey, fragt PDF-Pfad via IPC ab, rendert „PDF öffnen"-Button wenn vorhanden
- Position: rechts neben dem Badge; bei Platzmangel unter dem Badge, mit Viewport-Clamp
- Close-with-Grace-Period: Verlässt der User Badge oder Karte, läuft 250-ms-Timer; Eintritt in eine der beiden Flächen cancelt ihn — so kann die Maus von Badge zur Karte wandern, ohne dass sie verschwindet
- Klick auf „PDF öffnen" → `filetree:open` + `openTab(path, 'pdf')`, das PDF erscheint als regulärer Tab im PdfFileViewer (mit Zoom, Scrolling, Text-Selection — kein Mini-Modal nötig)
- App-State: neues `citationHover`-State in [App.svelte](src/renderer/App.svelte), Listener für `vswrite:citation-hover`, Render der Karte am Container-Ende mit `position: fixed`

**Doku:**
- [writer-features-plan.md](writer-features-plan.md): Outline-Reorder + Source-Preview als ✅ markiert, Implementierungs-Notizen am Anfang der Sektionen, Empfehlungs-Tabelle aktualisiert
- [project_status.md](project_status.md) (diese Datei): Sidebar-Beschreibung erweitert + Writer-Features-Block aktualisiert

### Session 13 (2026-04-28) — Polish-Sprint: Reading Mode + Backlinks + Comments-Bugfix

**Reading Mode (Cmd+Alt+R):**
- Neue CSS-Klasse `.reading-mode` auf `.vswrite-container` in [App.svelte](src/renderer/App.svelte) — Editor-Container schaltet auf Buchsatz-Typografie um (Iowan Old Style / Palatino / Georgia, 17 px / 1.75 line-height, 640 px max-width, justified Paragraphs, Heading-Style mit Serife)
- Code-, Math- und Raw-Typst-Blöcke behalten Monospace via `.reading-mode .ProseMirror pre, code, .typst-raw-block`
- State `uiState.readingMode` in [appState.svelte.ts](src/renderer/appState.svelte.ts), Toolbar-Button (𝓡) zwischen Typewriter und Focus, View-Menü-Eintrag, `toggleReadingMode`-Message-Handler
- Editing bleibt aktiv — User kann Tippfehler in dieser Ansicht direkt korrigieren

**Backlinks (Hover + Right-Click):**
- Neuer Preset-State `projectSearchPreset` in [appState.svelte.ts](src/renderer/appState.svelte.ts) — `{ query, wholeWord, caseSensitive }`, ProjectSearchPanel liest ihn beim Mount und löscht ihn (Consume-once)
- [OutlinePanel.svelte](src/renderer/components/OutlinePanel.svelte): Hover-Button (`↪`) rechts an jeder Heading-Row dispatcht `vswrite:find-backlinks`-Event mit dem Heading-Titel als Query
- [typstCitation.ts](src/editor/lib/typstCitation.ts): Right-Click auf Citation-Badge dispatcht dasselbe Event mit `@<citekey>` als Whole-Word-Query
- Event-Handler in [App.svelte](src/renderer/App.svelte) setzt Preset und öffnet Project-Search; falls bereits offen, kurzer Close+Open-Cycle damit der Mount-Hook erneut greift

**Comments-Bugfix (Endlosschleife):**
- Der `$effect`, der `editorVersion.value` trackte und bei jedem Editor-Tick `pushDecorations()` rief, hat eine Endlosschleife verursacht: `setCommentMarks` dispatched eine PM-Transaktion → `onTransaction` feuert → `editorVersion.value++` → Effect re-runs → dispatcht erneut. UI-Thread blockiert, Sidebar-Tabs wurden unklickbar
- Fix in [CommentsPanel.svelte](src/renderer/components/CommentsPanel.svelte): den editorVersion-Effect entfernt; das Plugin-eigene `apply()` in [commentDecorations.ts](src/editor/lib/commentDecorations.ts) erkennt `tr.docChanged` selbst und baut die Decorations bei Tippvorgängen automatisch neu

**Doku:**
- [writer-features-plan.md](writer-features-plan.md): Reading Mode + Backlinks mit ✅ markiert, Backlinks-Sektion mit umgesetzter „Aufsatz auf Find-in-Project"-Variante dokumentiert
- [project_status.md](project_status.md) + [handbuch.md](handbuch.md) + [handbook.md](handbook.md) erweitert

### Session 12 (2026-04-28) — Writer-Sprint #1: Find in Project, Footnote-UI, Comments

**Find in Project (Cmd+Shift+F):**
- Neues Modul [src/main/projectSearch.ts](src/main/projectSearch.ts) — `searchProject` walks `.typ` (+optional `.bib`), nutzt In-Memory-Content für die offene Datei, regex/case/whole-word, max 1000 Treffer, Pfade per `isPathWithin` validiert
- `replaceInProject` schreibt direkt auf Disk, bumps `lastSaveTimestamp` für Watcher-Self-Save-Guard, aktualisiert die offene Datei live
- IPC: `project:search` + `project:replaceAll` in [ipcHandlers.ts](src/main/ipcHandlers.ts) + Whitelist
- Frontend: [ProjectSearchPanel.svelte](src/renderer/components/ProjectSearchPanel.svelte) als Slide-In oben, Treffer pro Datei aufklappbar, Optionen Aa/W/.*/.bib, Klick auf Treffer dispatcht `vswrite:project-search-jump`-Event → scrollt im Editor; Confirm-Dialog vor Replace-All
- Cmd+Shift+F + Menü „Edit → Find in Project…" + showProjectSearch im messageHandler

**Footnote-UI:**
- Neuer Helper `insertFootnoteWithEditor()` in [typstFootnote.ts](src/editor/lib/typstFootnote.ts) — fügt leere Footnote ein und triggert per requestAnimationFrame einen synthetischen Click auf das frisch gemountete DOM-Element → Popup öffnet automatisch
- Slash-Command auf den Helper umgestellt (vorher Platzhaltertext „Footnote text", jetzt empty + auto-open)
- Toolbar-Button „Fn" in [Toolbar.svelte](src/editor/components/Toolbar.svelte) zwischen Smallcaps und Align-Group

**Comments / Annotations:**
- Neues Modul [src/main/commentManager.ts](src/main/commentManager.ts) — eigener YAML-Frontmatter-Parser ohne externe Deps, `listComments` / `createComment` / `updateComment` / `deleteComment`, Reanchoring per `indexOf` mit Hint-Offset, Orphaned-Detection
- Storage in **`<project>/comments/<id>.md`** (sichtbarer Ordner, **nicht** `.vswrite/`!) — Cloud-Sync-tauglich, in jedem Editor lesbar
- IPC: `comments:list` / `:create` / `:update` / `:delete` + Whitelist
- Editor-Plugin [commentDecorations.ts](src/editor/lib/commentDecorations.ts) — ProseMirror-Decoration-Set (ephemer, mutiert das Doc nicht), `setCommentMarks(editor, marks)` als API; Click auf Highlight dispatcht `vswrite:comment-click`-Event
- UI: [CommentsPanel.svelte](src/renderer/components/CommentsPanel.svelte) als 5. Sidebar-Tab — Filter „Aktuelle Datei / Ganzes Projekt", Resolved-Toggle, Body-Textarea mit 400-ms-Debounced-Save, Anker-Klick scrollt im Editor + flasht das Highlight
- Trigger: Toolbar-Button „Cm" + Menü „Edit → Add Comment" (Cmd+Alt+M); ohne Selektion expandiert auf das Wort am Cursor
- CSS-Highlight in [editor/style.css](src/editor/style.css): gelb-orange, Hover heller, `vswrite-comment-active` für 1,6 s Flash beim Anker-Klick
- File-Watcher emittiert beim Comment-Write `filetreeChanged` → CommentsPanel reloadet, Sidebar zeigt das neue Markdown

**Doku:**
- [writer-features-plan.md](writer-features-plan.md): Find/Footnote/Comments mit ✅ markiert, Comments-Sektion mit umgesetzter Storage-Variante (sichtbares `comments/` statt `.vswrite/comments.json`) + MVP-Limitierungen aktualisiert
- [project_status.md](project_status.md) (diese Datei) + [handbuch.md](handbuch.md) + [handbook.md](handbook.md) erweitert

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

**Main Process** (urspruenglich `index.ts` 1.699 -> 230 Zeilen):

| Modul | Zeilen | Inhalt |
|-------|--------|--------|
| `appState.ts` | 50 | Zentrales State-Objekt (leaf module) |
| `index.ts` | 230 | Entry Point: Window, Terminal, Lifecycle, Protocol, Crash-Capture-Setup |
| `ipcHandlers.ts` | ~570 | Central IPC message router (inkl. `crash:*`) |
| `fileManager.ts` | ~410 | File I/O, Auto-Save, Compiler, File Watcher (mit Breadcrumbs) |
| `importExport.ts` | ~310 | PDF, DOCX, Markdown, Zotero, Style Templates |
| `projectManager.ts` | ~250 | New Project, File Tree, Images — Skills jetzt aus `skillTemplates.ts` |
| `persistenceManager.ts` | ~220 | electron-store + safeStorage fuer Lizenz |
| `crashReporter.ts` | ~310 | **Neu (Session 16):** Lokales Crash-Reporting + Breadcrumbs |
| `licenseManager.ts` | 160 | Polar SDK |
| `lockManager.ts` | 157 | File Locking fuer Shared Folders |
| `menuBuilder.ts` | ~150 | Native Menu (mit `Cmd+/` Cheatsheet-Accelerator + Crash-Berichte oeffnen) |
| `typstCompiler.ts` | ~130 | Async PDF Compilation (SVG entfernt in Session 9) |
| `commentManager.ts` | ~370 | YAML-Frontmatter-Parser + Comment-CRUD + Reanchoring |
| `projectLabels.ts` | ~200 | Label-Scanner mit optionalem `projectDir`-Parameter (dual-tauglich) |
| `projectSearch.ts` | ~280 | Whole-Word per Lookarounds; optional `projectDir` (dual-tauglich) |
| `citationSources.ts` | 70 | **Neu (Session 16):** PDF-Lookup in `sources/<citekey>*.pdf` (aus ipcHandlers ausgelagert) |
| `gitManager.ts` | ~280 | Git IPC + High-Level „Versionen"-API |
| `typstPath.ts` | ~30 | Bundled Typst Binary Resolver |
| `terminalManager.ts` | 78 | node-pty Wrapper |
| `pathSecurity.ts` | 47 | Realpath-basierte Path-Validierung |
| `preload-entry.ts` | 95 | IPC-Whitelist (~70 Channels) |

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
| MCP-Tool-Surface deckte die Sessions-12-15-Editor-Features nicht ab — externe Agents konnten Cross-Refs / Comments / Footnotes nicht ansprechen | 17 neue Tools (Tier 1: Writer-Features, Tier 2: Discovery, Tier 3: Import/Export/Assets) plus High-Level-Versionen-API mit User-Vokabular |
| `vswrite_export_pdf` erlaubte beliebige Output-Pfade (Sicherheitsluecke) | `resolveInsideProject` + Auto-mkdir analog zu `compile`; Konvention `exports/<name>.pdf` |
| `vswrite_compile` mit `format: 'svg'` war veraltet (SVG in App entfernt, im MCP funktionierte es noch via direkten typst-CLI-Call — verwirrender Doppelpfad) | Compile zum reinen Verifier vereinfacht; Artefakt-Schreiben nur via `export_pdf` / `export_docx` |
| Sentry-Integration fuehlt sich tonal falsch fuer ein Writing-Tool, plus DSGVO-Ueberhang | Lokales Crash-Reporting: Plaintext nach `<userData>/crash-reports/`, Boot-Dialog beim naechsten Start, User entscheidet ueber Weitergabe — kein externer Service |
| Filename-Kollision: zwei Crashes innerhalb einer Sekunde wuerden sich ueberschreiben | Slug bekommt Millisekunden + 4-char Random-Suffix |
| `parseInt` schnitt mtime-Float auf den Marker ab → derselbe Crash wurde bei jedem Boot wieder gezeigt | `Number()` mit `Number.isFinite()`-Guard fuer den Marker-Roundtrip |
| Inline-Skills mit Backtick-Escape-Hoelle in `projectManager.ts` | Inhalt nach `src/shared/skillTemplates.ts` ausgelagert, Tilde-Fences (`~~~`) statt Triple-Backticks im Source |
| `cloudPull()` ueberschrieb Local-Changes ohne Confirm | Confirm-Dialog im Versionen-Vokabular, gleiches Format wie Restore Version + Apply Backup |
| Cheatsheet-Inhalt veraltet (15 Eintraege, Handbuch hatte 30) | Sieben Gruppen mit allen Sessions-12-15-Shortcuts + `Cmd`/`Ctrl`-Switch |
