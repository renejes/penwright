# vswrite — Implementierungsplan

> **Letzte Aktualisierung:** 2026-03-19

## Grundsatzentscheidungen

### Technologie-Stack
| Komponente | Technologie | Begründung |
|---|---|---|
| **IDE** | VS Code (CustomTextEditorProvider API) | Einzige IDE mit vollständiger Webview-Custom-Editor-Unterstützung. Kompatibel mit Cursor, Windsurf, etc. |
| **Editor-Framework** | TipTap v2 (ProseMirror) | Headless, schema-basiert, Transaktions-API für externe Reconciliation. Keine UI-Framework-Abhängigkeit im Core. |
| **UI in Webview** | Svelte 5 + TipTap Core | Kompiliert zu vanilla JS (~2 KB Runtime), kein Virtual-DOM-Overhead. Reaktiver State ideal für Toolbar die auf Editor-Selektion reagiert. Skaliert sauber wenn UI wächst (Slash-Commands, Modals, Sidebar). |
| **Backend-Format** | Typst (.typ Dateien) | Schnelle inkrementelle Kompilierung, saubere Syntax, wachsendes Ökosystem. |
| **Kompilierung** | Typst CLI (`typst compile`) | Lokal, kein Server nötig. Wird als Child-Process von der Extension gestartet. |
| **Sprache Extension** | TypeScript | VS Code Extension Standard. Typsicher, gutes Tooling. |
| **Build** | Vite (Webview) + esbuild (Extension) | Vite hat nativen Svelte-Support via `@sveltejs/vite-plugin-svelte`. esbuild für den Extension-Host (Node.js). |

### Architektur-Prinzip
Die Extension besteht aus zwei isolierten Kontexten die über Message-Passing kommunizieren:

```
┌─────────────────────────────────────────────────────┐
│ VS Code Extension Host (Node.js)                    │
│                                                     │
│  ┌─────────────────┐  ┌──────────────────────────┐  │
│  │ CustomTextEditor │  │ Typst Compiler Process   │  │
│  │ Provider         │  │ (typst compile → SVG)    │  │
│  └────────┬────────┘  └──────────────────────────┘  │
│           │                                         │
│  ┌────────┴────────┐  ┌──────────────────────────┐  │
│  │ FileWatcher     │  │ Preview Panel             │  │
│  │ (.typ files)    │  │ (SVG Seiten)              │  │
│  └─────────────────┘  └──────────────────────────┘  │
│           │ postMessage API                         │
├───────────┼─────────────────────────────────────────┤
│           ▼                                         │
│ ┌─────────────────────────────────────────────────┐ │
│ │ Webview (Browser Context)                       │ │
│ │                                                 │ │
│ │  ┌───────────────────────────────────────────┐  │ │
│ │  │ Svelte App                                │  │ │
│ │  │  ┌─────────────────────────────────────┐  │  │ │
│ │  │  │ TipTap Editor (headless)            │  │  │ │
│ │  │  │ - Schema (Typst-Subset Nodes/Marks) │  │  │ │
│ │  │  │ - Serializer (AST → Typst)          │  │  │ │
│ │  │  │ - Deserializer (Typst → AST)        │  │  │ │
│ │  │  │ - Slash Commands (@tiptap/suggestion)│  │  │ │
│ │  │  │ - Link Extension (@tiptap/link)     │  │  │ │
│ │  │  └─────────────────────────────────────┘  │  │ │
│ │  │  ┌─────────────────────────────────────┐  │  │ │
│ │  │  │ Svelte Components                   │  │  │ │
│ │  │  │ - Toolbar.svelte (Formatting + Link)│  │  │ │
│ │  │  │ - EditorView.svelte                 │  │  │ │
│ │  │  └─────────────────────────────────────┘  │  │ │
│ │  └───────────────────────────────────────────┘  │ │
│ └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

---

## Abgeschlossene Phasen

### ✅ Phase 1: Fundament — VS Code Extension + TipTap Webview

- Extension Scaffolding mit CustomTextEditorProvider für `*.typ`
- Svelte 5 + TipTap v2 im Webview (Toolbar, EditorView)
- Bidirektionale Message-Pipeline (Extension ↔ Webview via postMessage)
- Build-Setup: Vite (Webview) + esbuild (Extension)

### ✅ Phase 2: Typst Serialisierung/Deserialisierung

- Block-Level Hybrid Parser: Dokument an Leerzeilen splitten, Blöcke klassifizieren
- Visual Blocks → TipTap Nodes (Headings, Bold, Italic, Lists, Links, etc.)
- Raw Blocks → `typstRawBlock` Atom-Node (Math, Config, Code, Comments)
- Serializer (AST → Typst) + Deserializer (Typst → AST) mit Round-Trip-Sicherheit

### ✅ Phase 3 (Basis): Externe Änderungen & AI-Agent Kompatibilität

- `onDidChangeTextDocument` Listener erkennt externe Dateiänderungen
- `lastContentFromWebview` Tracking verhindert Feedback-Loops
- Webview aktualisiert sich automatisch bei externen Änderungen (AI-Agent, Terminal)
- Auto-Save nach jedem Edit (Typst kann von Disk kompilieren)
- **Offen:** Diff-Reconciliation (cursor-erhaltend) — aktuell Full-Reload bei externen Änderungen

### ✅ Phase 4: PDF-Preview & Typst-Kompilierung

- `TypstCompiler`: Child-Process (`typst compile` → SVG), debounced (400ms), Error-Parsing
- `PreviewPanel`: SVG-Seiten auf dunklem Hintergrund, cache-busting, scroll-preserve
- Diagnostics: Typst-Fehler als VS Code Diagnostics (rote Unterstreichung)
- Fehler-Anzeige im Preview-Panel
- Check ob Typst CLI installiert ist, Hinweis falls nicht

### ✅ Phase 5: UX-Polish & Schreib-Features

- Slash Commands: 10 Befehle via `/` (Headings, Listen, Quote, Code, Divider, Math, Typst Code)
- Link Extension: `Cmd+K` zum Einfügen/Bearbeiten/Entfernen von Links
- Toolbar: Link-Button, Shortcut-Hints für alle Buttons
- Statusbar: Wortanzahl + Kompilierungsstatus (✓ Typst / ↻ Compiling / ✗ errors / ⚠ No Typst CLI)
- Command: `vswrite: Open as Typst Source` (öffnet .typ im Standard-Texteditor)

---

## Nächste Phasen

> Basierend auf der Priorisierung in `next_features.md`. Ziel: vswrite von "funktioniert" zu "fühlt sich wie eine richtige Software an".

### ✅ Phase 6: Command Hub & PDF Export

- Command Hub: ☰-Button rechts in der Toolbar mit gruppiertem Dropdown (Insert, Format, File, Help)
- Jeder Eintrag mit Shortcut-Anzeige, Escape/Backdrop zum Schließen
- PDF Export: `vswrite: Export as PDF` Command mit Save-Dialog und Erfolgsmeldung
- Keyboard Shortcut Cheatsheet: Modal-Overlay erreichbar über Aktions-Menü → Help
- Neue Dateien: `CommandHub.svelte`, `ShortcutCheatsheet.svelte`
- Neue Message-Types: `exportPdf`, `openSource`

---

### ✅ Phase 7: Dokument-Settings & Projekt-Scaffolding

**Ziel:** Design per GUI statt per Code. Sofort loslegen mit einem neuen Projekt.

#### 7.1 Dokument-Settings Panel (→ next_features 2.1)
- [x] Modal mit Formular-Feldern: Schriftart, Schriftgröße, Sprache, Seitenformat, Seitenränder, Zeilenabstand, Absatzabstand, Heading-Nummerierung
- [x] `settingsParser.ts`: Regex-basierte Extraktion und Generierung von `#set`-Blöcken
- [x] Bidirektional: Änderungen im Panel → `#set`-Blöcke aktualisiert; Öffnen des Panels → aktuelle `#set`-Blöcke geparst
- [x] Erreichbar über Command Hub → File → Document Settings

#### 7.2 Neues Projekt Command (→ next_features 1.1)
- [x] `vswrite: New Project` — Template-Picker → Name → Ordner → Projekt erstellen → Ordner öffnen
- [x] 5 Templates: Document, Thesis, Paper, Letter, Book (`projectTemplates.ts`)
- [x] Erzeugt Ordnerstruktur (`main.typ`, `chapters/`, `assets/`, `bibliography.bib`)
- [x] Jedes Template mit sinnvollen `#set`-Defaults

#### 7.3 Neue Datei Command (→ next_features 1.2)
- [x] `vswrite: New Typst File` — Input-Box für Dateiname
- [x] Erstellt `.typ`-Datei im Workspace oder gewähltem Verzeichnis mit Heading aus Dateiname

**Neue Dateien:** `settingsParser.ts`, `projectTemplates.ts`, `SettingsPanel.svelte`
**Neue Message-Types:** `requestSettings`, `updateSettings`, `settingsData`

---

### ✅ Phase 8: Multi-File, Merge & Bilder

**Ziel:** Projekte mit mehreren Kapiteln verwalten, zusammenführen, und Bilder einfügen.

#### 8.1 Kapitel-Merge (→ next_features 7.1)
- [x] `vswrite: Merge Document` — parsed `#include`-Statements rekursiv
- [x] Quick-Pick: Merge → neue .typ Datei / Merge → PDF / Merge → Zwischenablage
- [x] Ersetzt `#include` durch tatsächlichen Dateiinhalt (mit Kommentar-Trennern)
- [x] Circular-Include-Erkennung, fehlende Dateien markiert
- [x] Erreichbar über Command Hub → File → Merge Document

#### 8.2 Kapitel-Übersicht Sidebar (→ next_features 3.1)
- [x] VS Code TreeDataProvider: Headings aus der `.typ`-Datei als Baum
- [x] Klick → Editor scrollt zur Stelle (`vswrite.goToHeading`)
- [x] Live-Aktualisierung beim Schreiben und Tab-Wechsel
- [x] Hierarchische Darstellung (H1 > H2 > H3) mit Icons

#### 8.3 Bilder (→ next_features 4.1)
- [x] Custom `TypstImage` TipTap-Node mit Pfadauflösung (relative → Webview-URI)
- [x] Serializer: `image` → `#image("path")` / `#image("path", width: ...)` Round-Trip
- [x] Deserializer: `#image("path", width: ...)` erweitert
- [x] File-Picker via Extension: Bild auswählen → `assets/` kopieren → `#image()` einfügen
- [x] Drag & Drop + Paste: Bilder in Editor ziehen → automatisch in `assets/` gespeichert
- [x] `/image` Slash-Command + Command Hub Eintrag
- [x] CSP erweitert (`img-src`), `localResourceRoots` inkludiert Dokument-Verzeichnis
- [x] Fehler-Placeholder wenn Bild nicht ladbar

**Neue Dateien:** `typstImage.ts`, `mergeDocument.ts`, `headingTreeProvider.ts`
**Neue Message-Types:** `pickImage`, `dropImage`, `insertImage`, `documentBaseUri`, `mergeDocument`

---

### ✅ Phase 9: UX-Verfeinerung

**Ziel:** Schreib-Erlebnis auf Notion/Typora-Niveau bringen.

#### 9.1 Focus Mode (→ next_features 10.1)
- [x] Toggle über Toolbar-Button (◎) oder Command Hub → View → Focus Mode
- [x] Toolbar ausblenden, umgebende Absätze dimmen (Opacity 0.3, Hover/Focus → 1)
- [x] Escape oder "Exit Focus Mode"-Button zum Beenden

#### 9.2 Suchen & Ersetzen (→ next_features 10.5)
- [x] Cmd+F / Cmd+H öffnen Search-Bar (`SearchReplace.svelte`)
- [x] DOM-basierte Textsuche via TreeWalker, `<mark>` Highlighting
- [x] Respektiert Visual vs. Raw Blocks (überspringt `.typst-raw-block`)
- [x] Navigate Prev/Next, Replace One / Replace All

#### 9.3 Wort-Ziel (→ next_features 10.3)
- [x] `vswrite: Set Word Goal` Command (Input-Box, 0 = löschen)
- [x] Statusbar: `words/goal (pct%)` wenn Ziel gesetzt
- [x] Persistiert in `workspaceState`

#### 9.4 Kapitel-Split (→ next_features 7.2)
- [x] `vswrite: Split into Chapters` — splittet an `= Heading 1` Grenzen
- [x] Erzeugt `chapters/01-titel.typ` etc. + `main.typ` mit `#include`-Statements
- [x] `#set`-Konfiguration bleibt in `main.typ`

#### 9.5 Quick-Settings Toolbar (→ next_features 2.2)
- [x] Zahnrad-Button (⚙) rechts in Toolbar → Dropdown (`QuickSettings.svelte`)
- [x] Chip-Auswahl: Schriftgröße (10-14pt), Zeilenabstand (Tight/Normal/Wide/Double), Sprache (EN/DE/FR/ES/IT)
- [x] Nutzt `parseSettings()`/`applySettings()`, sofortige Aktualisierung

**Neue Dateien:** `splitDocument.ts`, `SearchReplace.svelte`, `QuickSettings.svelte`
**Neue Message-Types:** `splitDocument`, `setWordGoal`, `quickSettings`

---

### Phase 10: Fortgeschrittene Features (Post-MVP)

**Ziel:** Komplexere Features für Power-User und akademisches Schreiben.

#### 10.1 Tabellen-Editor (→ next_features 5.1)
- [ ] TipTap Table Extension → Typst `#table()` Serialisierung
- [ ] Toolbar: Zeilen/Spalten-Picker, Kontextmenü
- [ ] MVP: einfache Tabellen ohne Spanning

#### 10.2 Zitations-Management (→ next_features 8.1)
- [ ] `.bib`-Datei parsen, TipTap Mention mit `@`-Trigger
- [ ] Autocomplete: Autor + Titel + Jahr
- [ ] Serialisierung zu `@citekey`

#### ✅ 10.3 Include-Manager Sidebar (→ next_features 7.3)
- [x] TreeView: `#include`-Einträge der aktiven `.typ`-Datei
- [x] Drag & Drop zum Umordnen + ↑/↓ Inline-Buttons
- [x] Broken `#include` mit Warning-Icon markieren
- [x] (+)-Button: Bestehende Datei oder neues Kapitel hinzufügen
- [x] Rechtsklick: Remove Include, Doppelklick: Datei öffnen

#### 10.4 Multi-File Projekt Ansicht (→ next_features 3.2)
- [ ] `#include` / `#import` Statements parsen → Dateibaum mit Beziehungen

#### 10.5 Diff-Reconciliation (→ Phase 3 offen)
- [ ] diff-match-patch für cursor-erhaltende Merges bei externen Änderungen
- [ ] Position-Mapping: Text-Offsets → ProseMirror-Positionen
- [ ] Conflict-Guard bei gleichzeitigem User+Agent-Edit

#### 10.6 Rechtschreibprüfung (→ next_features 10.4)
- [ ] Integration mit VS Code Spell-Check oder LanguageTool

---

## Übersicht: Phasen-Status

| Phase | Beschreibung | Status |
|-------|-------------|--------|
| 1 | Fundament (Extension + TipTap Webview) | ✅ Fertig |
| 2 | Typst Serialisierung/Deserialisierung | ✅ Fertig |
| 3 | Externe Änderungen (Basis) | ✅ Fertig (Diff-Reconciliation offen) |
| 4 | PDF-Preview & Kompilierung | ✅ Fertig |
| 5 | UX-Polish (Slash Commands, Links, Statusbar) | ✅ Fertig |
| 6 | Command Hub & PDF Export | ✅ Fertig |
| 7 | Dokument-Settings & Projekt-Scaffolding | ✅ Fertig |
| 8 | Multi-File, Merge & Bilder | ✅ Fertig |
| 9 | UX-Verfeinerung | ✅ Fertig |
| 10 | Fortgeschrittene Features (Post-MVP) | ⬜ Langfristig |

---

## Risiken und Mitigationen

| Risiko | Wahrscheinlichkeit | Impact | Mitigation |
|---|---|---|---|
| Typst-Deserializer kann komplexe Syntax nicht parsen | Hoch | Mittel | `rawBlock`-Fallback für alles Unbekannte. Roundtrip-Sicherheit priorisieren. |
| Diff-zu-ProseMirror Mapping ist ungenau | Mittel | Hoch | Extensive Tests mit Edge Cases. Fallback: Vollständiger Reload mit Cursor-Restore. |
| Gleichzeitige User+Agent-Edits erzeugen Konflikte | Mittel | Hoch | Debounce + Buffer. Bei echtem Konflikt: User gewinnt, Agent-Änderung in Diff-View. |
| TipTap in Webview hat Performance-Probleme bei großen Dokumenten | Niedrig | Mittel | Virtualisierung / Lazy-Rendering für lange Dokumente. |
| Typst CLI nicht installiert bei User | Niedrig | Niedrig | Check beim Start, Installationshinweis, Optional: Typst WASM Compiler einbetten. |

---

## Definition of Done: MVP (Erreicht — Ende Phase 5)

Das MVP ist erreicht ✅:
1. ✅ Man kann `.typ`-Dateien in VS Code als WYSIWYG öffnen und bearbeiten
2. ✅ Basis-Formatierung (Headings, Bold, Italic, Listen, Links, Code) funktioniert
3. ✅ Unbekannter Typst-Code als Raw-Block erhalten bleibt (kein Datenverlust)
4. ✅ Ein AI-Agent die `.typ`-Datei extern editieren kann und die Änderungen im Editor erscheinen
5. ✅ Live-SVG-Preview neben dem Editor funktioniert
6. ✅ Round-Trip ist stabil: Typst → Editor → Typst verändert den Code nicht ungewollt

## Nächster Meilenstein: "Richtige Software" (Ende Phase 8)

vswrite fühlt sich wie eine eigenständige Anwendung an:
1. Alle Features über ein sichtbares Menü erreichbar (kein VS Code-Wissen nötig)
2. PDF-Export mit einem Klick
3. Design-Einstellungen per GUI
4. Projekt-Scaffolding ("Neues Projekt" → fertige Struktur)
5. Multi-File Projekte mit Kapitel-Merge
