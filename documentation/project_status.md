# vswrite — Projekt Status

> **Letzte Aktualisierung:** 2026-03-22
> **Aktueller Stand:** Phase 17 — Onboarding, Error Recovery, DOCX Export, Artsy Template

**Weitere Dokumente:**
- [handbuch.md](handbuch.md) — Nutzer-Handbuch mit allen aktuellen Funktionen
- [next_features.md](next_features.md) — Geplante Features und Priorisierung
- [implementation_plan.md](implementation_plan.md) — Ursprünglicher 6-Phasen Plan

---

## Was ist vswrite?

Eine VS Code Extension die `.typ` (Typst) Dateien als WYSIWYG-Editor öffnet statt im Standard-Texteditor. Zielgruppe: Akademiker, Autoren, Studenten — Menschen die schreiben, nicht programmieren. AI-Agenten (Claude Code, Codex) können die `.typ`-Dateien direkt auf der Disk bearbeiten, die Extension erkennt externe Änderungen und aktualisiert den Editor.

---

## Architektur

```
┌──────────────────────────────────────────────────────────┐
│ VS Code Extension Host (Node.js)                         │
│                                                          │
│  ┌──────────────────────┐  ┌──────────────────────────┐  │
│  │ typstEditorProvider   │  │ typstCompiler             │  │
│  │ - CustomTextEditor    │  │ - typst compile → SVG     │  │
│  │ - Webview Lifecycle   │  │ - Diagnostics (Errors)    │  │
│  │ - Auto-Save           │  │ - Debounced (configurable) │  │
│  └──────────┬────────────┘  └─────────────┬────────────┘  │
│             │                             │               │
│  ┌──────────┴────────────┐  ┌─────────────┴────────────┐  │
│  │ FileWatcher            │  │ previewPanel              │  │
│  │ - onDidChangeDocument  │  │ - WebviewPanel (Beside)   │  │
│  │ - External Edit Detect │  │ - SVG Page Rendering      │  │
│  └──────────┬────────────┘  └──────────────────────────┘  │
│             │ postMessage API                             │
├─────────────┼────────────────────────────────────────────┤
│             ▼                                            │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ Webview (Browser Context) — Svelte 5                 │ │
│ │                                                      │ │
│ │  ┌─────────────────────────────────────────────────┐ │ │
│ │  │ TipTap Editor (ProseMirror)                     │ │ │
│ │  │  - StarterKit (Headings, Lists, Bold, Italic…)  │ │ │
│ │  │  - typstRawBlock (Custom Atom Node)             │ │ │
│ │  │  - Serializer (AST → Typst)                     │ │ │
│ │  │  - Deserializer (Typst → AST, Block-Level)      │ │ │
│ │  └─────────────────────────────────────────────────┘ │ │
│ │  ┌────────────────┐                                  │ │
│ │  │ Toolbar.svelte │ — Reaktive Formatting-Buttons    │ │
│ │  └────────────────┘                                  │ │
│ └──────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

---

## Projektstruktur

```
vswrite/
├── .vscode/
│   ├── launch.json                 # F5 → Extension Development Host
│   └── tasks.json                  # Pre-launch Build Task
├── documentation/
│   ├── done/
│   │   └── vswrite_extension_idea.md   # Ursprüngliches Konzeptdokument
│   ├── implementation_plan.md          # 6-Phasen Implementierungsplan
│   ├── project_status.md               # ← Dieses Dokument
│   └── testfile/
│       └── test.typ                    # Testdatei für manuelle Tests
├── src/
│   ├── shared/                           # Plattformunabhängige Kernlogik
│   │   ├── settingsParser.ts            # Parse/Generate Typst #set Blöcke
│   │   ├── bibParser.ts                 # Pure-TypeScript BibTeX Parser (.bib → BibEntry[])
│   │   ├── styleTemplates.ts            # 6 Style Templates
│   │   ├── projectTemplates.ts          # 5 Projekt-Templates
│   │   ├── mergeDocument.ts             # #include Auflösung, Merge
│   │   ├── splitDocument.ts             # Dokument an H1-Headings aufteilen
│   │   └── sourceImporter.ts            # DOI-Extraktion, CrossRef API, Auto-Import
│   ├── cli/                              # Standalone CLI für AI-Agenten
│   │   └── index.ts                     # vswrite-cli Entry Point (info, check, merge, etc.)
│   ├── extension/                        # Node.js — Extension Host
│   │   ├── extension.ts                 # Entry Point, registriert Provider + CLI Auto-Install
│   │   ├── typstEditorProvider.ts       # CustomTextEditorProvider — Brücke Document↔Webview
│   │   ├── typstCompiler.ts             # Typst CLI Wrapper — compile → SVG, Error Parsing
│   │   ├── previewPanel.ts              # WebviewPanel für SVG Preview (rechte Seite)
│   │   ├── headingTreeProvider.ts       # TreeView Sidebar mit Heading-Hierarchie
│   │   ├── includeTreeProvider.ts       # TreeView Sidebar mit #include-Management (Drag & Drop)
│   │   ├── bibWatcher.ts               # .bib-Datei-Discovery, Parsing und FileSystemWatcher
│   │   └── ...
│   └── webview/                          # Browser — Svelte 5 App
│       ├── main.ts                     # Webview Entry: acquireVsCodeApi() + Svelte mount
│       ├── App.svelte                  # Root Component: Editor + Message Handling
│       ├── style.css                   # VS Code Theme-aware Editor Styling
│       ├── vscode.d.ts                 # Type Declaration für acquireVsCodeApi
│       ├── components/
│       │   ├── Toolbar.svelte          # Formatting Buttons (Bold, H1-H3, Lists, Undo/Redo…)
│       │   ├── CommandHub.svelte       # ☰ Aktions-Menü Dropdown (alle Commands)
│       │   ├── ShortcutCheatsheet.svelte # Keyboard Shortcuts Modal Overlay
│       │   ├── SettingsPanel.svelte    # Dokument-Settings Modal (Font, Page, Paragraph, Headings)
│       │   ├── SearchReplace.svelte    # Suchen & Ersetzen Bar (Cmd+F/Cmd+H)
│       │   └── QuickSettings.svelte    # Quick-Settings Dropdown (Font Size, Spacing, Language)
│       └── lib/
│           ├── editor.ts               # TipTap Editor Factory (StarterKit + Link + SlashCommands + typstRawBlock)
│           ├── slashCommands.ts        # Slash Command Extension mit Suggestion Popup
│           ├── serializer.ts           # TipTap JSON → Typst Text
│           ├── deserializer.ts         # Typst Text → TipTap JSON (Block-Level Hybrid Parser)
│           ├── typstRawBlock.ts        # Custom TipTap Node für nicht-WYSIWYG Typst Code
│           ├── typstImage.ts           # Custom TipTap Node für Bilder mit Pfadauflösung
│           ├── typstTable.ts           # Custom TipTap Nodes für Tabellen-Editor
│           ├── typstFootnote.ts        # Custom TipTap Atom-Node für Fußnoten mit Popup-Editor
│           ├── reconciler.ts           # Block-Level Diff + inkrementelle ProseMirror-Transaktionen (Undo-safe)
│           ├── typstCitation.ts       # Custom TipTap Inline-Atom-Node für @citekey Zitationen
│           ├── citationSuggestion.ts  # @-Trigger Autocomplete für Zitationen mit Popup
│           ├── typstTextAlign.ts     # Custom TipTap Extension für Textausrichtung (Left/Center/Right/Justify)
│           └── messages.ts             # TypeScript Interfaces für Extension↔Webview Messages
├── dist/                               # Build Output (gitignored)
│   ├── extension.js                    # Gebundelte Extension (CJS, Node.js)
│   └── webview/
│       ├── webview.js                  # Gebundelte Webview App (IIFE, Browser)
│       └── webview.css                 # Kompilierte Styles
├── package.json                        # Extension Manifest + Dependencies
├── tsconfig.json                       # TypeScript Config (ES2022, Bundler Resolution)
├── esbuild.config.mjs                  # Extension Build (esbuild → CJS)
├── vite.config.mts                     # Webview Build (Vite + Svelte → IIFE)
└── svelte.config.mjs                   # Svelte 5 mit vitePreprocess
```

---

## Phasen-Status

### Phase 1: Extension + TipTap Webview ✅ FERTIG

**Was gebaut wurde:**
- VS Code Extension mit `CustomTextEditorProvider` für `*.typ` Dateien
- TipTap v2 Editor in einem Svelte 5 Webview
- Bidirektionale Message-Pipeline (Extension ↔ Webview via `postMessage`)
- Reaktive Toolbar mit Formatting-Buttons
- Build-System: esbuild (Extension) + Vite (Webview)
- F5 Launch Configuration für Extension Development Host

**Schlüsseldateien:** `extension.ts`, `typstEditorProvider.ts`, `App.svelte`, `Toolbar.svelte`, `editor.ts`, `main.ts`

---

### Phase 2: Typst Serialisierung/Deserialisierung ✅ FERTIG

**Was gebaut wurde:**
- **Serializer** (`serializer.ts`): Rekursiver TipTap JSON → Typst Converter
  - Headings, Paragraphs, Lists, Blockquotes, Code Blocks, Horizontal Rules
  - Inline Marks: `*bold*`, `_italic_`, `` `code` ``, `~strike~`, `#link("url")[text]`
  - `typstRawBlock` Passthrough: Original-Typst wird 1:1 bewahrt
- **Deserializer** (`deserializer.ts`): Block-Level Hybrid Parser
  - Smart Block Splitter: Respektiert Code Fences, Brace/Bracket/Paren Nesting
  - Klassifiziert Blöcke als Visual (WYSIWYG) oder Raw (Code-Ansicht)
  - Visual Blocks: Heading, Bullet List, Ordered List, Blockquote, Code Block, Image, Paragraph mit Inline Parsing
  - Raw Blocks: Alles mit `#set`, `#let`, `#show`, `$math$`, `//comments` etc.
  - `classifyRawBlock()`: Unterscheidet math, config, code, comment für UI-Styling
- **typstRawBlock** (`typstRawBlock.ts`): Custom TipTap Atom Node
  - Nicht-inline-editierbar, draggable, selectable
  - Textarea für Rohtext-Bearbeitung innerhalb des Blocks
  - Farbcodierte Labels: Mathe (lila), Config (blau), Code (orange), Comment (grün)
  - `ignoreMutation: () => true` verhindert ProseMirror-Interferenz
  - `update()` Methode für externe Content-Updates (AI Agent Edits)

**Schlüsseldateien:** `serializer.ts`, `deserializer.ts`, `typstRawBlock.ts`

---

### Phase 3: Externe Änderungen & AI-Agent Kompatibilität ✅ FERTIG (abgeschlossen in Phase 11)

**Was funktioniert:**
- `onDidChangeTextDocument` Listener erkennt externe Änderungen
- `lastContentFromWebview` Tracking unterscheidet interne vs. externe Edits
- Bei externer Änderung → Content wird an Webview gesendet → Deserializer erzeugt neues AST
- **Block-Level Reconciliation** (`reconciler.ts`): Vergleicht altes und neues Dokument auf Node-Ebene, wendet nur die Änderungen als ProseMirror-Transaktion an
- **Undo-Historie bleibt intakt:** Externe Edits sind via Cmd+Z rückgängig machbar
- **Cursor-Position bleibt erhalten:** ProseMirror Position-Mapping bei inkrementellen Updates
- **Getestet:** Claude Code hat `test.typ` editiert, Änderungen erschienen korrekt im WYSIWYG Editor, Cmd+Z macht die Änderung rückgängig

**Noch offen (Nice-to-have):**
- Conflict-Guard bei gleichzeitigen User+Agent Edits (Agent-Edits puffern während User tippt)

---

### Phase 4: PDF Preview & Typst Kompilierung ✅ FERTIG

**Was gebaut wurde:**
- **TypstCompiler** (`typstCompiler.ts`):
  - Prüft ob `typst` CLI installiert ist (`typst --version`)
  - Spawnt `typst compile <file>.typ <outputDir>/page-{n}.svg` als Child Process
  - Debounced (konfigurierbar, Standard 2s) — verhindert excessive Kompilierungen bei schnellem Tippen
  - Parsed Typst Compiler Errors aus stderr → VS Code DiagnosticCollection
  - Erkennt Error-Format: `error: message` + `┌─ file.typ:line:col`
  - Temp-Directory Cleanup beim Dispose
- **PreviewPanel** (`previewPanel.ts`):
  - WebviewPanel rechts neben dem Editor (`ViewColumn.Beside`, `preserveFocus: true`)
  - Rendert SVG-Seiten als `<img>` Tags auf dunklem Hintergrund (Paper-Look mit Shadow)
  - Cache-Busting via Timestamp Query Parameter (`?t=Date.now()`)
  - Scroll-Position bleibt erhalten bei Updates
  - Error-Anzeige mit Syntax-Highlighting-freundlichem Styling
  - CSP: Nur lokale Ressourcen + inline Scripts/Styles
- **Integration in typstEditorProvider:**
  - Auto-Save nach jedem Webview-Edit (damit Typst von Disk lesen kann)
  - Recompile nach jedem Edit (Webview oder extern)
  - Preview öffnet automatisch wenn `.typ` Datei geöffnet wird
  - Falls `typst` nicht installiert: Info-Message mit Download-Link
  - Cleanup (Compiler + Preview) beim Schließen des Editors
- **DiagnosticCollection** in `extension.ts` registriert

**Output-Format:** SVG (nicht PDF) — Vorteile:
- Kein PDF.js nötig (keine extra Dependency)
- Vektor-Qualität, scharf bei jedem Zoom
- Nativ im Webview renderbar (`<img>` Tag)
- Typst erzeugt pro Seite eine SVG-Datei (Multi-Page Support)

**Voraussetzung:** Typst CLI muss installiert sein (`brew install typst` auf macOS)

**Schlüsseldateien:** `typstCompiler.ts`, `previewPanel.ts`, `typstEditorProvider.ts`

---

### Phase 5: UX-Polish & Schreib-Features ✅ FERTIG

**Was gebaut wurde:**
- **Link Extension** (`@tiptap/extension-link`):
  - Links im Editor anklickbar und editierbar
  - `Cmd+K` Shortcut zum Einfügen/Bearbeiten/Entfernen von Links
  - URL-Prompt Dialog
  - Link-Button in der Toolbar
- **Slash Commands** (`slashCommands.ts`):
  - `/` tippen öffnet Dropdown-Menü mit 10 Befehlen
  - Headings, Listen, Quote, Code Block, Divider, Math Block, Typst Code
  - Echtzeit-Filter beim Tippen, Pfeiltasten-Navigation
  - Vanilla DOM Popup mit VS Code Theme-Styling
  - Nutzt `@tiptap/suggestion` unter der Haube
- **Statusbar** (in `typstEditorProvider.ts`):
  - Wortanzahl (links, aktualisiert bei jedem Edit)
  - Kompilierungsstatus: Compiling / Ready / Errors mit Icons
  - Zeigt/versteckt sich automatisch basierend auf aktivem Editor
- **Source Toggle** Command:
  - `vswrite: Open as Typst Source` in Command Palette
  - Öffnet die aktuelle `.typ`-Datei im Standard-Texteditor
- **Toolbar Update**:
  - Neuer Link-Button mit Kettensymbol
  - Alle Tooltips zeigen macOS Shortcuts (Cmd statt Ctrl)
  - Placeholder-Text: "Type / for commands..."
- **Keyboard Shortcuts** (via TipTap StarterKit + Link):
  - `Cmd+B` Bold, `Cmd+I` Italic, `Cmd+E` Code, `Cmd+Shift+X` Strike
  - `Cmd+Alt+1/2/3` Headings, `Cmd+Shift+7/8` Lists
  - `Cmd+K` Link, `Cmd+Z` Undo, `Cmd+Shift+Z` Redo

**Neue Dateien:** `slashCommands.ts`
**Neue Dependencies:** `@tiptap/extension-link`, `@tiptap/suggestion`
**Schlüsseldateien:** `editor.ts`, `slashCommands.ts`, `Toolbar.svelte`, `style.css`, `extension.ts`, `typstEditorProvider.ts`

---

### Phase 6: Command Hub & PDF Export ✅ FERTIG

**Was gebaut wurde:**
- **Command Hub** (`CommandHub.svelte`):
  - ☰-Button rechts in der Toolbar
  - Gestyltes Dropdown mit gruppierten Aktionen: Insert, Format, File, Help
  - Jeder Eintrag zeigt zugehörigen Keyboard-Shortcut
  - Backdrop-Click und Escape zum Schließen
  - Alle Editor-Actions + Extension-Commands über ein einziges Menü erreichbar
- **PDF Export** (in `typstEditorProvider.ts`):
  - `vswrite: Export as PDF` Command
  - VS Code Save-Dialog → `typst compile input.typ output.pdf`
  - Progress-Notification während Export
  - Erfolgsmeldung mit "Open PDF" Button
  - Fehlerbehandlung bei fehlender Typst CLI
- **Shortcut Cheatsheet** (`ShortcutCheatsheet.svelte`):
  - Modal-Overlay erreichbar über Aktions-Menü → Help → Keyboard Shortcuts
  - Alle Shortcuts gruppiert nach Kategorie (Formatting, Blocks, General)
  - Escape oder Klick außerhalb zum Schließen
- **Messages** (`messages.ts`):
  - Neue Message-Types: `exportPdf`, `openSource` (Webview → Extension)

**Neue Dateien:** `CommandHub.svelte`, `ShortcutCheatsheet.svelte`
**Schlüsseldateien:** `App.svelte`, `Toolbar.svelte`, `typstEditorProvider.ts`, `messages.ts`, `style.css`

---

## Technologie-Stack

| Komponente | Technologie | Version |
|---|---|---|
| IDE Integration | VS Code CustomTextEditorProvider API | Engine ^1.85.0 |
| Editor Framework | TipTap v2 (ProseMirror) | ^2.11.0 |
| UI Framework | Svelte 5 (Runes: `$state`, `$props`) | ^5.0.0 |
| Backend Format | Typst (.typ) | CLI erforderlich |
| Extension Build | esbuild | ^0.25.0 |
| Webview Build | Vite + @sveltejs/vite-plugin-svelte | Vite ^6.0.0, Plugin ^5.0.0 |
| Sprache | TypeScript | ^5.7.0 |
| Preview Output | SVG via `typst compile` | — |

---

## Entwicklung

### Build
```bash
npm run build              # Extension + Webview + CLI
npm run build:extension    # Nur Extension (esbuild)
npm run build:webview      # Nur Webview (Vite + Svelte)
npm run build:cli          # Nur CLI (esbuild → dist/cli/vswrite-cli.js)
```

### Watch Mode
```bash
npm run watch              # Beides parallel
npm run watch:extension    # Nur Extension
npm run watch:webview      # Nur Webview
```

### Testen
1. `npm run build`
2. F5 in VS Code → Extension Development Host startet
3. Im neuen Fenster eine `.typ` Datei öffnen
4. Testdatei: `documentation/testfile/test.typ`

### Voraussetzungen
- Node.js + npm
- VS Code ^1.85.0
- Typst CLI (`brew install typst`) — nur für PDF Preview nötig, Editor funktioniert auch ohne

---

## Bidirektionaler Sync — Wie es funktioniert

### User tippt im WYSIWYG:
```
Webview: TipTap onChange → Serialize (AST→Typst) → postMessage('edit', typstText)
Extension: onDidReceiveMessage → WorkspaceEdit → document.save() → typstCompiler.requestCompile()
Preview: onDidCompile → SVG lesen → postMessage('pages', svgUris) → <img> update
```

### AI Agent editiert .typ Datei:
```
Filesystem: Agent schreibt Datei → VS Code erkennt Änderung
Extension: onDidChangeTextDocument → content ≠ lastContentFromWebview → postMessage('update', newContent)
Webview: onMessage → Deserialize (Typst→AST) → editor.setContent(newDoc)
Extension: typstCompiler.requestCompile() → Preview aktualisiert sich
```

### Feedback-Loop Prevention:
- `lastContentFromWebview`: Speichert letzten Content aus dem Webview. Nur wenn der neue Document-Content davon abweicht, wird es als externer Edit erkannt.
- `isUpdatingFromExtension`: Flag im Webview verhindert dass ein Update vom Extension-Host einen Edit zurück sendet.

---

## Bekannte Limitierungen

1. ~~**Kein inkrementelles Update bei externen Edits:**~~ ✅ Gelöst — Block-Level Reconciliation bewahrt Undo-Historie und Cursor-Position.
2. **Kein Conflict-Guard:** Wenn User und AI Agent gleichzeitig denselben Absatz editieren, gewinnt der letzte Schreiber.
3. **typst CLI erforderlich für Preview:** Ohne Typst keine SVG-Kompilierung. Editor funktioniert aber weiterhin.
4. **`{n}` Template im Output-Pfad:** Abhängig von Typst CLI Version. Falls `{n}` nicht unterstützt wird, muss der Output-Pfad angepasst werden.
5. **Auto-Save bei jedem Keystroke (debounced):** Kann bei sehr großen Dateien oder langsamen Disks spürbar sein.
6. ~~**Kein Undo für externe Edits:**~~ ✅ Gelöst — `reconcileContent()` wendet externe Änderungen als ProseMirror-Transaktion an, Cmd+Z macht Agent-Edits rückgängig.

### Phase 7: Dokument-Settings & Projekt-Scaffolding ✅ FERTIG

**Was gebaut wurde:**
- **Settings Panel** (`SettingsPanel.svelte`):
  - Modal mit Formular-Feldern für: Font, Font Size, Language, Paper, Margins, Leading, Spacing, First-Line-Indent, Heading Numbering
  - Predefined Options: 14 Fonts, 6 Papierformate, 13 Sprachen, 5 Nummerierungsstile
  - Erreichbar über Command Hub → File → Document Settings
- **Settings Parser** (`settingsParser.ts`):
  - `parseSettings()`: Regex-basierte Extraktion aus `#set text(...)`, `#set page(...)`, `#set par(...)`, `#set heading(...)`
  - `applySettings()`: Entfernt alte `#set`-Blöcke, generiert neue am Dateianfang
  - Bidirektionaler Sync: Panel ↔ Datei über `requestSettings` / `updateSettings` Messages
- **New Project Command** (`vswrite.newProject`):
  - Template-Picker → Name → Ordner → Projekt erstellen → Ordner öffnen
  - 5 Templates in `projectTemplates.ts`: Document, Thesis, Paper, Letter, Book
  - Thesis/Book mit `chapters/`-Unterordner und `#include`-Statements
  - Paper/Thesis mit `bibliography.bib`
- **New File Command** (`vswrite.newFile`):
  - Input-Box für Dateiname → `.typ`-Datei im Workspace oder gewähltem Verzeichnis
  - Heading aus Dateiname generiert (z.B. `chapter-01` → `= Chapter 01`)
  - Warnung bei bestehender Datei, öffnet sie stattdessen
- **Messages** (`messages.ts`):
  - Neue Types: `RequestSettingsMessage`, `UpdateSettingsMessage`, `SettingsDataMessage`

**Neue Dateien:** `settingsParser.ts`, `projectTemplates.ts`, `SettingsPanel.svelte`
**Schlüsseldateien:** `extension.ts`, `typstEditorProvider.ts`, `App.svelte`, `CommandHub.svelte`, `messages.ts`, `style.css`

---

### Phase 8: Multi-File, Merge & Bilder ✅ FERTIG

**Was gebaut wurde:**
- **Kapitel-Merge** (`mergeDocument.ts`):
  - `vswrite: Merge Document` Command — parsed `#include "..."` Statements rekursiv
  - Quick-Pick mit 3 Optionen: Merge → neue .typ Datei / Merge → PDF / Merge → Clipboard
  - Circular-Include-Erkennung, fehlende Dateien markiert
  - Erreichbar über Command Hub → File → Merge Document
- **Kapitel-Übersicht Sidebar** (`headingTreeProvider.ts`):
  - VS Code TreeDataProvider im Explorer-Panel ("Headings")
  - Parsed `= Heading` Syntax → hierarchischer Baum (H1 > H2 > H3)
  - Klick navigiert zur Zeile im Editor
  - Live-Aktualisierung bei Textänderungen und Tab-Wechsel
  - Icons: `symbol-class` (H1), `symbol-method` (H2), `symbol-field` (H3+)
- **Image Support** (`typstImage.ts`):
  - Custom `TypstImage` TipTap-Node mit Webview-URI-Pfadauflösung
  - Deserializer: `#image("path")` und `#image("path", width: ...)` → Image-Node
  - Serializer: Image-Node → `#image("path")` / `#image("path", width: ...)` Round-Trip
  - File-Picker: `/image` Slash-Command oder Command Hub → Extension öffnet Datei-Dialog → kopiert nach `assets/` → fügt `#image()` ein
  - Drag & Drop + Paste: Bilder in Editor ziehen → base64 an Extension → speichert in `assets/`
  - CSP erweitert (`img-src`), `localResourceRoots` inkludiert Dokument-Verzeichnis
  - Fehler-Placeholder wenn Bild nicht ladbar, Pfad-Label unter Bildern
- **Messages** (`messages.ts`):
  - Neue Types: `pickImage`, `dropImage`, `insertImage`, `documentBaseUri`, `mergeDocument`

**Neue Dateien:** `typstImage.ts`, `mergeDocument.ts`, `headingTreeProvider.ts`
**Schlüsseldateien:** `editor.ts`, `serializer.ts`, `deserializer.ts`, `typstEditorProvider.ts`, `App.svelte`, `CommandHub.svelte`, `slashCommands.ts`, `messages.ts`, `style.css`, `package.json`

---

### Phase 9: UX-Verfeinerung ✅ FERTIG

**Was gebaut wurde:**
- **Focus Mode** (in `App.svelte` + `style.css`):
  - Toolbar wird ausgeblendet, umgebende Absätze werden gedimmt (Opacity 0.3)
  - Hover/Focus auf einen Absatz stellt volle Sichtbarkeit her
  - Toggle über Toolbar-Button (◎), Command Hub → View → Focus Mode
  - Escape oder "Exit Focus Mode"-Button zum Beenden
- **Suchen & Ersetzen** (`SearchReplace.svelte`):
  - DOM-basierte Textsuche via TreeWalker — findet Text in Visual Blocks
  - Überspringt `.typst-raw-block` Inhalte
  - Treffer werden als `<mark>` Elemente hervorgehoben (gelb = Treffer, orange = aktueller Treffer)
  - Navigieren mit Prev/Next Buttons, Replace One / Replace All
  - Öffnen via `Cmd+F` oder `Cmd+H`, neuer "View"-Bereich im Command Hub
- **Wort-Ziel** (Word Goal):
  - `vswrite: Set Word Goal` Command in der Command Palette
  - Statusbar zeigt `${words}/${goal} words (${pct}%)` wenn ein Ziel gesetzt ist
  - Ziel wird in `workspaceState` gespeichert (persistiert pro Workspace)
- **Quick-Settings Toolbar** (`QuickSettings.svelte`):
  - Zahnrad-Button (⚙) rechts in der Toolbar
  - Dropdown mit Chip-Auswahl: Schriftgröße (10-14pt), Zeilenabstand (Tight/Normal/Wide/Double), Sprache (EN/DE/FR/ES/IT)
  - Nutzt bestehende `parseSettings()`/`applySettings()` Infrastruktur
  - Sofortige Aktualisierung: Datei wird gespeichert und neu kompiliert
- **Kapitel-Split** (`splitDocument.ts`):
  - `vswrite: Split into Chapters` Command
  - Splittet Dokument an `= Heading 1` Grenzen
  - Erzeugt `chapters/01-titel.typ`, `chapters/02-titel.typ` etc.
  - Generiert `main.typ` mit `#include`-Statements, `#set`-Konfiguration bleibt in `main.typ`
  - Erreichbar über Command Hub → File → Split into Chapters

**Neue Dateien:** `splitDocument.ts`, `SearchReplace.svelte`, `QuickSettings.svelte`
**Neue Message-Types:** `splitDocument`, `setWordGoal`, `quickSettings`
**Schlüsseldateien:** `App.svelte`, `CommandHub.svelte`, `typstEditorProvider.ts`, `extension.ts`, `messages.ts`, `style.css`, `package.json`

---

### Post-Phase 9: Include-Manager, Heading-Navigation & Preview-Sync ✅ FERTIG

**Was gebaut wurde:**
- **Include-Manager Sidebar** (`includeTreeProvider.ts`):
  - TreeView im Explorer-Panel ("Includes") — zeigt alle `#include`-Einträge der aktiven `.typ`-Datei
  - Drag & Drop zum Umordnen der Kapitelreihenfolge (via `TreeDragAndDropController`)
  - Inline-Buttons: ↑/↓ zum Verschieben, Kontextmenü: Remove
  - (+)-Button in Titelleiste: Bestehende Datei hinzufügen oder neues Kapitel erstellen
  - Doppelklick öffnet die inkludierte Datei
  - Broken Include Detection: Fehlende Dateien werden mit Warning-Icon markiert
  - Live-Updates bei Dokumentänderungen und Tab-Wechsel
- **Heading-Navigation verbessert** (`headingTreeProvider.ts`, `typstEditorProvider.ts`, `App.svelte`):
  - Sidebar-Sichtbarkeit: Custom Context Key `vswrite.typActive` statt `resourceExtname` (funktioniert mit Custom Editors)
  - Klick scrollt im WYSIWYG-Editor zur Überschrift (statt Raw-File zu öffnen)
  - Static `panels` Map auf `TypstEditorProvider` für Panel-Tracking
  - `scrollToHeading` Message: Extension → Webview, ProseMirror `doc.descendants()` + `scrollIntoView()`
- **Preview-Sync bei Tab-Wechsel** (`typstEditorProvider.ts`, `previewPanel.ts`):
  - Per-Editor Compile-Status-Tracking (`lastCompileStatus`/`lastCompileColor`)
  - `preview.show()` beim Tab-Wechsel → richtiges Preview-Panel kommt in den Vordergrund
  - `retainContextWhenHidden: true` auf Preview-Panel → SVGs bleiben erhalten
- **QuickSettings-Position** (`style.css`):
  - Dropdown von `position: absolute` auf `position: fixed` umgestellt

**Neue Dateien:** `includeTreeProvider.ts`
**Neue Message-Types:** `scrollToHeading`
**Schlüsseldateien:** `typstEditorProvider.ts`, `headingTreeProvider.ts`, `previewPanel.ts`, `App.svelte`, `messages.ts`, `extension.ts`, `package.json`, `style.css`

---

### Phase 10: Footnotes, Links, Tabellen & Style Templates ✅ FERTIG

**Was gebaut wurde:**
- **Footnote Support** (`typstFootnote.ts`):
  - Custom TipTap Atom-Node für `#footnote[...]`
  - Floating Popup-Editor statt `window.prompt()` — Klick auf Marker öffnet Textarea
  - Automatische CSS-Counter-Nummerierung (¹, ², ³ etc.)
  - Farbcodiertes Badge (lila) mit Text-Vorschau
  - Schließen via Escape, Cmd+Enter oder Backdrop-Klick
- **Footnote-sichere Raw-Block-Erkennung** (`deserializer.ts`):
  - `stripKnownInlines()` — Balanced-Bracket-Parser entfernt bekannte Inline-Konstrukte
  - Verhindert False Positives: `#footnote[...]`, `#text(...)[]`, `#link(...)[]` etc. werden nicht als Raw Block erkannt
  - `isRawBlock()` prüft nur den "äußeren" Text nach Inline-Stripping
- **Link Round-Trip** (`deserializer.ts`):
  - `#link("url")[text]` wird korrekt zu TipTap-Link-Marks deserialisiert
  - Balanced-Paren-Parsing für URL-Extraktion
  - Vorher: Links gingen beim Reload verloren → wurden als Raw Block dargestellt
- **Tabellen-Editor** (`typstTable.ts`):
  - Custom TipTap Nodes: `typstTable`, `typstTableRow`, `typstTableCell`, `typstTableHeader`
  - Deserializer parst `#table(columns: N, [...])` → visueller Tabellen-Editor
  - Serializer erzeugt Round-Trip-sicheren Typst-Output
  - Control-Bar unter Tabelle: Zeilen/Spalten hinzufügen/entfernen, Tabelle löschen
  - `/table` Slash-Command + Command Hub Eintrag
  - Tab-Navigation zwischen Zellen
- **Style Templates** (`styleTemplates.ts`):
  - 6 visuelle Vorlagen: Classic Academic, Modern Clean, Minimal, Vibrant, Elegant, Professional Report
  - Jeder Style enthält `#set` + `#show` Regeln (Schrift, Seite, Absatz, Überschriften-Styling)
  - Command Hub → Style Templates → Stil auswählen
  - Intelligente Preamble-Erkennung mit Brace-Depth-Tracking (erkennt mehrzeilige `#show` Regeln)
  - Bestehende Preamble wird ersetzt, Dokumentinhalt bleibt erhalten

**Neue Dateien:** `typstFootnote.ts`, `typstTable.ts`, `styleTemplates.ts`
**Neue Message-Types:** `applyStyle`
**Schlüsseldateien:** `deserializer.ts`, `serializer.ts`, `editor.ts`, `typstEditorProvider.ts`, `CommandHub.svelte`, `messages.ts`, `style.css`

---

### Phase 11: Undo für externe Edits (AI Agent Kompatibilität) ✅ FERTIG

**Was gebaut wurde:**
- **Block-Level Reconciler** (`reconciler.ts`):
  - Ersetzt `editor.commands.setContent()` (Full-Reload, löscht Undo-Historie) durch inkrementelle ProseMirror-Transaktionen
  - Vergleicht altes und neues Dokument auf Top-Level-Node-Ebene mittels `PMNode.eq()`
  - Findet minimalen Änderungsbereich: gemeinsames Prefix + Suffix → nur die geänderte Mitte wird ersetzt
  - Externe Edits sind als einzelner Undo-Step rückgängig machbar via Cmd+Z
  - Cursor-Position bleibt erhalten (ProseMirror Position-Mapping)
  - Fallback auf `setContent()` falls JSON-Parsing fehlschlägt
- **Kein Feedback-Loop:** `isUpdatingFromExtension`-Flag verhindert dass die Transaktion als User-Edit zurückgesendet wird

**Vorher:** AI Agent editiert → `setContent()` → Undo-Historie gelöscht → Cmd+Z tut nichts
**Nachher:** AI Agent editiert → `reconcileContent()` → Transaktion → Cmd+Z macht den Edit rückgängig

**Neue Dateien:** `reconciler.ts`
**Schlüsseldateien:** `App.svelte`, `reconciler.ts`

---

### Phase 12: Zitations-Management ✅ FERTIG

**Was gebaut wurde:**

**Stufe 1 — Klassische .bib-Unterstützung:**
- **BibTeX Parser** (`bibParser.ts`): Pure-TypeScript BibTeX-Parser mit Balanced-Brace-Tracking, `@string`-Makros, LaTeX-Cleanup. Keine externe Dependency.
- **BibWatcher** (`bibWatcher.ts`): Findet alle `.bib`-Dateien im Workspace, parst und merged Einträge, `FileSystemWatcher` für Live-Updates bei Änderungen.
- **Citation TipTap Node** (`typstCitation.ts`): Inline-Atom-Node für `@citekey`. Blaues Badge mit `@`-Icon und Autor/Jahr-Label.
- **Citation Suggestion** (`citationSuggestion.ts`): `@`-Trigger Autocomplete via `@tiptap/suggestion`. Dropdown zeigt Autor, Titel, Jahr pro Eintrag. Filter beim Tippen, Pfeiltasten-Navigation.
- **Deserializer**: `@citekey` wird inline erkannt und als Citation-Node deserialisiert (Word-Boundary-Check verhindert False Positives bei E-Mail-Adressen).
- **Serializer**: Citation-Node → `@citekey` (ein Einzeiler).
- **`#bibliography()` Auto-Insertion**: Beim `ensureBibliography`-Message prüft die Extension ob bereits ein `#bibliography(...)`-Statement existiert; wenn nicht, wird es automatisch am Dokumentende eingefügt.
- **CommandHub + SlashCommands**: "Citation" Eintrag in Insert-Gruppe und `/Citation` Slash-Command, beide triggern den `@`-Autocomplete.

**Stufe 2 — Auto-Import aus Quelldateien:**
- **SourceImporter** (`sourceImporter.ts`): Scannt `sources/`-Ordner (PDF, DOCX, TXT, MD), extrahiert DOIs per Regex, queryt CrossRef API (kostenlos, kein API-Key), generiert `.bib`-Einträge.
- **CrossRef Integration**: DOI → vollständige Bibliografie-Daten (Titel, Autoren, Jahr, Journal). Polite API-Nutzung mit 200ms Rate-Limiting.
- **PDF-Metadaten-Fallback**: Falls kein DOI gefunden, werden PDF-Properties (Title, Author, CreationDate) ausgelesen (via optionale `pdf-parse` Library).
- **Manuelle Eingabe**: `vswrite: Add Citation Manually` Command — sequentielle Input-Boxen für Titel, Autor, Jahr, Typ → generiert `.bib`-Eintrag mit auto-generiertem Citekey.
- **Import Sources Command**: `vswrite: Import Sources` — scannt `sources/`, verarbeitet alle Dateien, erstellt/aktualisiert `references.bib`. Progress-Notification während des Imports.

**Neue Dateien:** `bibParser.ts`, `bibWatcher.ts`, `sourceImporter.ts`, `typstCitation.ts`, `citationSuggestion.ts`
**Neue Message-Types:** `citationData`, `requestCitations`, `ensureBibliography`, `importSources`, `addCitationManually`
**Schlüsseldateien:** `deserializer.ts`, `serializer.ts`, `editor.ts`, `typstEditorProvider.ts`, `extension.ts`, `CommandHub.svelte`, `slashCommands.ts`, `messages.ts`, `style.css`, `package.json`

---

### Phase 13: Bild-Dialog, Textausrichtung & Drag-&-Drop-Verbesserungen ✅ FERTIG

**Was gebaut wurde:**
- **Bild-Dialog** (`typstImage.ts`):
  - Klick auf Bild öffnet Overlay-Dialog mit: Breiten-Presets (25/50/75/100%), Custom-Width-Input (%, cm, auto), Alt-Text, Alignment (Left/Center/Right)
  - Done-Button zum Weiterschreiben nach dem Bild
  - Backdrop-Klick oder Escape zum Schließen
- **Textausrichtung** (`typstTextAlign.ts`):
  - Custom TipTap Extension mit `textAlign`-Attribut für Paragraph und Heading Nodes
  - Keyboard Shortcuts: `Cmd+Shift+L` (Left), `Cmd+Shift+E` (Center), `Cmd+Shift+R` (Right), `Cmd+Shift+J` (Justify)
  - 4 Alignment-Buttons in der Toolbar
  - Serializer: `#align(center)[...]` / `#align(right)[...]` Wrapping
  - Deserializer: `#align(...)[]` Erkennung für Headings, Paragraphs, Images
- **Style Templates Submenu** (`CommandHub.svelte`):
  - Style Templates als eigene Gruppe im Command Hub mit Floating-Submenu-Overlay
  - `position: fixed` mit JS-berechneten Viewport-Koordinaten
- **Drag & Drop aus VS Code Explorer** (`editor.ts`, `typstEditorProvider.ts`):
  - VS Code Explorer sendet `text/uri-list` statt `File`-Objekten — beides wird jetzt unterstützt
  - Neuer Message-Type `dropImagePath` für URI-basierte Drops
  - `handleDropImagePath()` in Extension: Löst `file://` URIs auf, kopiert nach `assets/`
- **Bild-Import Deduplizierung** (`typstEditorProvider.ts`):
  - `copyToAssets()` prüft ob die Quelldatei bereits im Dokumentverzeichnis liegt
  - Wenn ja: Relativer Pfad wird zurückgegeben ohne zu kopieren — keine Duplikate mehr
- **Bild-Anzeige nach Reload behoben**:
  - `documentBaseUri` wird jetzt VOR dem Content an das Webview gesendet (Race-Condition behoben)
  - Fallback: Wenn Content vor `baseUri` ankommt, werden bereits gerenderte Bilder nachträglich aktualisiert

**Neue Dateien:** `typstTextAlign.ts`
**Neue Message-Types:** `dropImagePath`
**Schlüsseldateien:** `typstImage.ts`, `typstTextAlign.ts`, `editor.ts`, `typstEditorProvider.ts`, `CommandHub.svelte`, `Toolbar.svelte`, `serializer.ts`, `deserializer.ts`, `App.svelte`, `messages.ts`, `style.css`

---

### Phase 14: CLI Tool & AI Agent Integration ✅ FERTIG

**Was gebaut wurde:**
- **Shared Library** (`src/shared/`):
  - Plattformunabhängige Kernmodule aus `src/extension/` extrahiert: `settingsParser.ts`, `bibParser.ts`, `styleTemplates.ts`, `projectTemplates.ts`, `mergeDocument.ts`, `splitDocument.ts`, `sourceImporter.ts`
  - Importierbar von Extension und CLI ohne VS Code Dependency
- **CLI Tool** (`src/cli/index.ts`):
  - Standalone Node.js CLI (`vswrite-cli`) für AI-Agent-Integration
  - 14 Commands: `info`, `outline`, `validate`, `check`, `get-settings`, `set`, `list-styles`, `apply-style`, `merge`, `split`, `parse-bib`, `add-citation`, `import-sources`, `new-project`, `compile`
  - `--json` Flag für maschinenlesbare Ausgabe
  - `check` Command: Strukturelle Validierung + Typst-Kompilierung, gibt Fehler mit Dateiname und Zeilennummer aus
  - `parseTypstErrors()`: Parst Typst stderr-Output (`error: message` + `┌─ file:line:col`) in strukturierte Objekte
- **Auto-Install** (`extension.ts`):
  - CLI wird beim Extension-Start automatisch in den VS Code Terminal PATH installiert (Symlink nach `~/.local/bin/vswrite-cli`)
  - `SKILL.md` wird automatisch in `.claude/skills/vswrite/` deployt, damit Claude Code die CLI-Commands entdeckt
- **esbuild Config** (`esbuild.config.mjs`):
  - Dritter Build-Target: `src/cli/index.ts` → `dist/cli/vswrite-cli.js` (CJS, Node.js)
  - `npm run build:cli` und `npm run build` (inkl. CLI)

**Neue Dateien:** `src/shared/*.ts` (extrahiert), `src/cli/index.ts`
**Schlüsseldateien:** `extension.ts`, `esbuild.config.mjs`, `package.json`, `CLAUDE.md`

---

### Phase 15: Compile Delay, Root-Erkennung, Bibliographie Multi-File ✅ FERTIG

**Was gebaut wurde:**
- **Konfigurierbarer Compile-Delay** (`typstCompiler.ts`, `package.json`):
  - VS Code Setting `vswrite.compileDelay` mit Dropdown (500ms / 1000ms / 2000ms / 4000ms)
  - Default: 2000ms (vorher hardcoded 400ms)
  - Dynamisch gelesen bei jedem `requestCompile()` — keine Extension-Neustart nötig
- **Scroll-Position-Erhaltung** (`previewPanel.ts`):
  - Preview merkt sich die Scroll-Position bei Recompile und stellt sie danach wieder her
  - Kein Zurückspringen zum Anfang bei jeder Änderung mehr
- **Bibliographie Multi-File Support** (`typstEditorProvider.ts`):
  - `findBibliographyInIncludes()`: Sucht `#bibliography(...)` in allen `#include`-referenzierten Dateien
  - `updateBibStyleInFile()`: Ändert den `style:`-Parameter direkt in der Datei wo `#bibliography` steht
  - Settings-Panel zeigt und ändert den Zitierstil auch wenn `#bibliography` in einer inkludierten Datei liegt
- **SKILL.md Updates** (`extension.ts`):
  - 3 Skill-Varianten (vswrite, typst, research) aktualisiert
  - Klare Anweisung: `#bibliography` gehört in die Root-Datei, Kapitel-Dateien nur Content
  - Multi-File-Projektstruktur dokumentiert

**Schlüsseldateien:** `typstCompiler.ts`, `previewPanel.ts`, `typstEditorProvider.ts`, `extension.ts`, `package.json`

---

### Phase 16: Typewriter Mode, Spellcheck, Undo AI Edit, Conflict Guard ✅ FERTIG

**Was gebaut wurde:**
- **Typewriter Mode** (`App.svelte`, `style.css`):
  - Aktueller Absatz bleibt vertikal zentriert beim Schreiben
  - `scrollCursorToCenter()` nutzt `editor.view.coordsAtPos()` für Cursor-Position
  - CSS `padding-bottom: 50vh` auf dem Editor-Container für Scroll-Spielraum
  - Toggle über Toolbar-Button (…) und Command Hub → View → Typewriter Mode
  - Kombinierbar mit Focus Mode (unabhängige Toggles)
  - Escape zum Beenden
- **Browser-native Rechtschreibprüfung** (`editor.ts`, `App.svelte`):
  - `spellcheck="true"` Attribut auf dem TipTap-Editor via `editorProps.attributes`
  - `setEditorLanguage()`: Setzt `lang`-Attribut (BCP 47) auf dem ProseMirror DOM-Element
  - Sprach-Mapping: Typst-Sprachcodes → BCP 47 Tags (13 Sprachen)
  - Synchronisiert mit Dokument-Sprache: Wird beim Öffnen und bei Settings-Änderung aktualisiert
  - `documentLang` Message-Type für Extension → Webview Kommunikation
  - Nutzt OS-Wörterbücher (macOS: Einstellungen → Tastatur → Rechtschreibung)
- **Undo Last AI Edit** (`typstEditorProvider.ts`, `extension.ts`):
  - Snapshot-Stack (max 20 Einträge) für externe Edits auf Dateiebene
  - `pushSnapshot()` vor jedem externen Edit, Style-Apply und Style-Import
  - `performUndoAiEdit()`: Stellt letzten Snapshot wieder her, aktualisiert Webview + Preview
  - `vswrite.undoLastAiEdit` Command in Command Palette
  - Static `undoHandlers` Map auf `TypstEditorProvider` für Command-Palette-Zugriff
  - Erreichbar über Command Hub → File → Undo AI Edit
  - Bestätigungs-Message mit Zeitstempel des Snapshots
- **Conflict Guard** (`typstEditorProvider.ts`):
  - Puffert externe Edits (AI-Agent) während User aktiv tippt
  - `lastUserEditTime` Tracking bei jedem Webview-Edit
  - `isUserActive()`: Prüft ob User in den letzten 2 Sekunden getippt hat
  - Bei aktivem User: Edit wird gepuffert, Statusbar zeigt "AI edit pending"
  - Nach 2s Inaktivität: Gepufferter Edit wird automatisch angewendet
  - Self-rescheduling Timer falls User weiter tippt
  - Snapshot wird vor dem Anwenden des gepufferten Edits erstellt

**Neue Message-Types:** `documentLang` (Extension → Webview), `undoLastAiEdit` (Webview → Extension)
**Schlüsseldateien:** `App.svelte`, `editor.ts`, `typstEditorProvider.ts`, `extension.ts`, `CommandHub.svelte`, `messages.ts`, `style.css`, `package.json`

---

### Phase 17: Onboarding, Error Recovery, DOCX Export ✅ FERTIG

**Was gebaut wurde:**
- **Welcome Screen** (`WelcomeScreen.svelte`):
  - Wird beim erstmaligen Öffnen einer `.typ`-Datei angezeigt
  - Zeigt Typst-Installationsstatus, Quick-Links, "Don't show again" Option
  - Erreichbar über Command Hub → Help → User Guide
- **Error Recovery** (`deserializer.ts`, `serializer.ts`, `App.svelte`, `typstEditorProvider.ts`):
  - **Partial Parse Mode:** Einzelne Block-Parse-Fehler werden als `typstRawBlock` mit `blockType: 'error'` dargestellt statt das ganze Dokument abstürzen zu lassen
  - **Total Crash Fallback:** Wenn der Deserializer komplett crasht, wird der gesamte Typst-Content als ein Raw Block angezeigt
  - **Serializer Guard:** Leerer Output bei nicht-leerem Dokument wird nicht gespeichert (Data Loss Protection)
  - **Extension-Side Guard:** Leere Edits auf nicht-leere Dokumente werden blockiert und geloggt
  - **Error Reporting:** `deserializeError` Message → Notification mit "Open as Source" / "Retry" / "Show Log" Optionen
  - **Output Channel:** `vscode.window.createOutputChannel('vswrite')` für Fehler-Logging mit Timestamps
- **DOCX Export** (`src/shared/docxSerializer.ts`):
  - Neuer Serializer: TipTap JSON → DOCX via `docx` npm Package (pure JS, keine externe Dependency)
  - **Exportiert:** Headings (H1–H6), Paragraphs, Bold/Italic/Underline/Strike, Bullet & Ordered Lists, Tabellen (mit Header-Erkennung), Bilder (eingebettet aus `assets/`), Links (als Hyperlinks), Fußnoten (als Word-Fußnoten), Seitenumbrüche, Zitationen (als kursiver Text), Textausrichtung (Left/Center/Right/Justify)
  - **Raw Blocks** (Math, Config, Code): Grauer Monospace-Text (Courier New, 9pt)
  - **Multi-File Support:** `#include`-Statements werden vor Export automatisch gemergt
  - **Extension:** `vswrite: Export as DOCX` Command, Save-Dialog mit `.docx` Filter, "Open DOCX" Button nach Export
  - **Command Hub:** Neuer Eintrag unter File → "Export as DOCX"
  - **CLI:** `vswrite-cli export-docx <file.typ> [--output f.docx]`
- **Artsy Style Template** (`styleTemplates.ts`):
  - Zeitungs-inspiriertes Design mit Georgia-Schrift, farbigen Überschriften (rot/blau)
  - H1: Bold uppercase zwischen roten Linien, H2: Weiß auf blauem Hintergrund, H3: Rot
- **Style Template Heading Numbering Fix:**
  - Alle `#show heading` Regeln in allen Templates enthalten jetzt `counter(heading).display(it.numbering)` für korrekte Nummerierung im Fließtext
  - Guard `if it.numbering != none` verhindert Crash bei `#outline()` Headings

**Neue Dateien:** `docxSerializer.ts`, `WelcomeScreen.svelte`
**Neue Dependencies:** `docx`
**Neue Message-Types:** `exportDocx`, `deserializeError`, `welcomeData`, `dismissWelcome`, `openUserGuide`
**Schlüsseldateien:** `docxSerializer.ts`, `deserializer.ts`, `serializer.ts`, `App.svelte`, `typstEditorProvider.ts`, `CommandHub.svelte`, `messages.ts`, `styleTemplates.ts`, `extension.ts`, `package.json`, `src/cli/index.ts`

---

## Nächste Schritte

Detaillierte Feature-Planung: siehe [next_features.md](next_features.md)
Implementierungsplan: siehe [implementation_plan.md](implementation_plan.md)

**Phase 18+ — Verbleibend:**
- Licensing & Freemium (nach Feature-Freeze)
