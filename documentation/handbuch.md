# vswrite Desktop — Handbuch

> **Version:** 0.4.0
> **Letzte Aktualisierung:** 2026-03-26

---

## Was ist vswrite Desktop?

vswrite Desktop ist ein eigenständiger WYSIWYG-Editor für Typst-Dokumente. Statt Markup-Code zu sehen, arbeitest du in einem visuellen Editor — ähnlich wie in Google Docs oder Notion. Gleichzeitig bleibt die volle Typst-Funktionalität erhalten: Mathe-Formeln, Konfiguration und Layout werden als bearbeitbare Code-Blöcke angezeigt.

vswrite Desktop ist die Standalone-Version der gleichnamigen VS Code Extension — als eigenständige Electron-App mit integriertem Terminal, Preview, Dateimanager, Git und KI-Integration.

---

## Erste Schritte

### Voraussetzungen

- **macOS**, **Windows** oder **Linux**
- **Typst CLI** (für Live-Preview und PDF-Export): `brew install typst` (macOS) / `winget install typst` (Windows)

### App starten (Entwicklungsmodus)

```bash
npm install                              # einmalig
npx electron-rebuild -f -w node-pty      # einmalig, für Terminal
unset ELECTRON_RUN_AS_NODE && npm run dev
```

**Wichtig:** `unset ELECTRON_RUN_AS_NODE` ist nötig wenn du aus dem VS Code oder Cursor Terminal startest. Aus iTerm2 oder Terminal.app nicht.

### Erste Datei öffnen

- **File → Open** (`Cmd+O`) → `.typ`-Datei auswählen
- **File → Open Folder** → Projektordner öffnen
- **File → New Project** → Neues Projekt mit Template erstellen

---

## App-Layout

```
┌──────────────────────────────────────────────────────────────┐
│                        (Titelleiste)                          │
├──────────────────────────────────────────────────────────────┤
│  B I U S  │ H1 H2 H3 │ • 1. │ 🔗 │ ⚙ … ◎ ☰               │  Toolbar
├──────┬──────────────────────────────┬────────────────────────┤
│[Files│Outline│Chapters│Git]         │                        │
│      │  [main.typ] [refs.bib]       │                        │
│ Side-│                              │   Preview Panel        │
│ bar  │  WYSIWYG Editor              │   (SVG Pages)          │
│      │  (zentriert, max 680px)      │                        │
├──────┴──────────────────────────────┴────────────────────────┤
│  Terminal / AI  (echtes Shell-Terminal)                       │
├──────────────────────────────────────────────────────────────┤
│ [Project] [Terminal/AI] [Preview]      Saved 14:35  main.typ │
└──────────────────────────────────────────────────────────────┘
```

### Panels ein-/ausblenden

| Panel | Shortcut | Status Bar Button |
|-------|----------|-------------------|
| Sidebar (links) | `Cmd+B` | **Project** |
| Terminal (unten) | `` Cmd+` `` | **Terminal / AI** |
| Preview (rechts) | `Cmd+Shift+P` | **Preview** |

Alle Panels sind per Drag resizeable.

---

## Der Editor

### Toolbar

| Button | Funktion | Shortcut |
|--------|----------|----------|
| **B** | Fett | `Cmd+B` |
| *I* | Kursiv | `Cmd+I` |
| ~~S~~ | Durchgestrichen | `Cmd+Shift+X` |
| `</>` | Inline-Code | `Cmd+E` |
| Link | Link einfügen/bearbeiten | `Cmd+K` |
| H1 / H2 / H3 | Überschriften | `Cmd+Alt+1/2/3` |
| • | Aufzählung | `Cmd+Shift+8` |
| 1. | Nummerierte Liste | `Cmd+Shift+7` |
| { } | Code-Block | `Cmd+Alt+C` |
| ⚙ | Quick-Settings | — |
| … | Typewriter Mode | — |
| ◎ | Focus Mode | — |
| ☰ | Aktions-Menü (Command Hub) | — |

### Aktions-Menü (Command Hub ☰)

Öffnet ein Dropdown mit allen verfügbaren Aktionen:

- **Insert** — Überschriften, Listen, Zitat, Code Block, Math-Formel, Typst Code, Bild, Linie
- **Format** — Fett, Kursiv, Durchgestrichen, Inline-Code, Link, Textausrichtung
- **View** — Focus Mode, Suchen & Ersetzen
- **File** — PDF/DOCX exportieren, Import Markdown, Link Zotero, Dokument-Einstellungen, Merge, Split, Neues Projekt/Datei
- **Style Templates** — 7 vordefinierte + eigene Templates importieren
- **Help** — Keyboard Shortcuts

### Slash Commands

Tippe `/` an einer leeren Stelle im Editor:

| Befehl | Beschreibung |
|--------|-------------|
| `/Heading 1-3` | Überschriften |
| `/Bullet List` | Aufzählung |
| `/Numbered List` | Nummerierte Liste |
| `/Quote` | Blockquote |
| `/Code Block` | Code-Block |
| `/Math` | Typst Mathe-Block |
| `/Typst Code` | Roher Typst-Code |
| `/Image` | Bild einfügen |

### Multi-Tab Editor

- Mehrere Dateien gleichzeitig als Tabs offen
- Tab-Leiste über dem Editor mit Dateinamen
- × Button zum Schließen einzelner Tabs
- **Rechtsklick** auf Dateien in der Sidebar → "Open in New Tab"
- **Rechtsklick** auf `.typ` Dateien → "Open as Text" (öffnet im Code-Editor statt WYSIWYG)
- `.typ` Dateien öffnen im WYSIWYG Editor
- `.bib`, `.txt`, `.md`, `.yaml` etc. öffnen im Code-Editor (CodeMirror 6 mit Syntax Highlighting, Zeilennummern)
- `.pdf` Dateien öffnen im eingebauten PDF-Viewer (Text markierbar + kopierbar)

### Bilder

**Einfügen:**
- **Slash Command:** `/Image` → Datei-Auswahl
- **Drag & Drop:** Bild vom Finder oder aus der Sidebar (assets/) in den Editor ziehen
- **Command Hub:** ☰ → Insert → Image

**Bild-Dialog (Klick aufs Bild):**
- **Breite:** Presets (25%, 50%, 75%, 100%) oder Custom (z.B. `60%`, `8cm`)
- **Alt-Text:** Bildbeschreibung
- **Ausrichtung:** Links, Zentriert, Rechts

**Guard:** Bilder die in einen Code-Block (Preamble, #show etc.) gedroppt werden, werden automatisch nach dem Block eingefügt — kein "expected Expression" Fehler.

Bilder werden automatisch in `assets/` kopiert und als `#image("assets/...")` eingefügt. Bilder die bereits im Projekt liegen werden nicht dupliziert.

### Citation Autocomplete

Tippe `@` im Editor → Dropdown mit allen Quellen aus den `.bib` Dateien:
- Filterbar nach Citekey, Autor, Titel, Jahr
- Klick fügt `@citekey` als Citation-Node ein
- Citations werden automatisch beim Datei-Öffnen geladen
- Funktioniert auch mit Zotero-verknüpften `.bib` Dateien

---

## Neues Projekt erstellen

**Öffnen:** File → New Project oder ☰ → File → New Project

**Dialog:**
1. **Projektname** eingeben (wird zum Ordnernamen)
2. **Template** wählen:

| Template | Beschreibung |
|----------|-------------|
| **Document** | Einfaches Dokument (eine Datei) |
| **Thesis** | Wissenschaftliche Arbeit mit Kapiteln + Bibliography |
| **Paper** | Akademisches Paper (Abstract, Sections, References) |
| **Letter** | Formaler Brief |
| **Book** | Buch mit Kapiteln + Inhaltsverzeichnis |

3. **Speicherort** wählen → Projektstruktur wird erstellt

Jedes neue Projekt bekommt automatisch:
- Template-Dateien (main.typ, chapters/, bibliography.bib)
- `assets/` Ordner für Bilder
- `.claude/skills/` mit Claude Code Skills (typst, vswrite, research)

---

## Sidebar

Die Sidebar hat vier Tabs:

### Files
- Rekursiver Dateibaum, ← Back-Button, + Open Folder
- `.claude/` Ordner sichtbar für Skills
- Bilder aus assets/ sind per Drag & Drop in den Editor ziehbar
- Rechtsklick → "Open in New Tab"

### Outline
- Live Heading-Hierarchie (H1 → H2 → H3), Klick navigiert zum Heading

### Chapters (Include-Manager)
- `#include` Statements, ↑/↓ Umsortieren (sofortiges UI-Update), × Entfernen, + Add Chapter

### Git
- Branch, Stage/Unstage, Commit, Push/Pull, Init

---

## Live-Preview

- **Root-Datei Kompilierung:** Bei Chapters wird automatisch main.typ kompiliert
- **Chapter-Navigation:** Preview scrollt zum aktiven Kapitel
- **Scroll-Erhaltung:** Position bleibt bei Recompile erhalten
- **Fehleranzeige:** Typst-Fehler im Preview Panel
- **SVG/PDF Modus:** Toggle im Preview-Header — SVG (schnell, Standard) oder PDF (via pdf.js mit Textauswahl)

---

## Import & Export

### Markdown Import
- **File → Import Markdown** oder ☰ → Import Markdown
- Konvertiert: Headings, Bold/Italic, Links, Images, Listen, Code Blocks, Blockquotes
- YAML Frontmatter wird übersprungen
- Erzeugt eine neue `.typ` Datei mit Standard-Preamble

### Zotero Integration
- **File → Link Zotero Library** oder ☰ → Link Zotero Library
- Zotero Better BibTeX `.bib` Datei auswählen
- Wird als `zotero.bib` ins Projekt kopiert
- **Auto-Sync:** Änderungen in Zotero werden automatisch übernommen (solange die App läuft)
- Alle Zotero-Quellen erscheinen im `@` Autocomplete

### PDF Export
☰ → File → Export PDF

### DOCX Export
☰ → File → Export DOCX

---

## Style Templates

7 vordefinierte + eigene Templates:

| Template | Beschreibung |
|----------|-------------|
| Classic Academic | Serifenschrift, nummerierte Überschriften |
| Modern Clean | Sans-Serif, blaue Akzente |
| Minimal | Ultra-clean, großzügig |
| Vibrant | Kräftige Farben |
| Elegant | Dekorativ, goldene Akzente |
| Professional Report | Business-Layout |
| Artsy | Rot-blaues Farbschema |

**Eigene Templates importieren:** ☰ → Style Templates → Import Style Template → `.typ` Datei wählen. Nur das Preamble (#set/#show Regeln) wird extrahiert, auch aus kompletten Dokumenten. Gespeichert in `.claude/style-templates/`.

---

## File Watcher

Externe Dateiänderungen (z.B. durch Claude Code im Terminal) werden automatisch erkannt:
- Aktuelle Datei geändert → Editor updatet sofort
- `.bib` geändert → Citations werden neu geladen
- Dateien hinzugefügt/gelöscht → File Tree refresht
- Eigene Saves werden ignoriert (2s Schutzfenster)

---

## Terminal / AI

Echtes PTY-Terminal (xterm.js + node-pty):
- Shell: zsh (macOS), bash (Linux), PowerShell (Windows)
- Working Directory: Projektordner
- Claude Code: `claude` direkt starten
- Claude Code Skills automatisch in `.claude/skills/`
- Auto-Resize, Auto-Respawn

---

## Rechtschreibprüfung

- **Automatisch aktiv:** Nutzt Electron's eingebauten Spellchecker (Hunspell)
- **Sprachsynchronisation:** Sprache wird aus `#set text(lang: "de")` im Typst-Dokument gelesen
- **Dynamischer Wechsel:** Ändert sich bei Quick Settings oder Settings Panel
- **Rechtsklick auf Fehler:** Kontextmenü mit bis zu 5 Korrekturvorschlägen + "Add to Dictionary"
- **Unterstützte Sprachen:** en, de, fr, es, it, pt, nl, sv, da, nb, fi, pl, ru

---

## PDF-Viewer

- `.pdf` Dateien aus der Sidebar per Klick im integrierten Viewer öffnen
- **Virtualisiertes Rendering:** Nur sichtbare Seiten werden gerendert (performant auch bei großen PDFs)
- **Text markieren & kopieren:** TextLayer über dem Canvas ermöglicht Cmd+C
- Header mit Dateiname, Seitenzahl und Close-Button
- Ideal zum Lesen von PDFs in `sources/`

---

## Auto-Save & Status

- Edits werden nach 1 Sekunde automatisch gespeichert
- Status Bar: "Unsaved" (orange) oder "Saved 14:35"
- Warnung beim Schließen bei ungespeicherten Änderungen

---

## MCP Server — KI-Integration mit Claude Desktop & Co.

vswrite enthält einen eingebauten MCP-Server (Model Context Protocol), mit dem externe KI-Anwendungen wie **Claude Desktop**, **Codex Desktop** oder **Clawdbot** direkt mit deinen Typst-Dokumenten arbeiten können — ohne das Terminal zu benutzen.

### Was kann der MCP-Server?

Die KI kann über den MCP-Server:
- Typst-Dokumente öffnen, lesen und bearbeiten
- Dokument-Einstellungen ändern (Schriftart, Größe, Sprache, Ränder, etc.)
- Typst kompilieren und Fehler analysieren
- PDFs exportieren
- Projektdateien verwalten (lesen, schreiben, auflisten)
- Zwischen Projekten wechseln

### Einrichtung: Claude Desktop (Cowork)

**Schritt 1:** MCP-Server bauen (einmalig, im vswrite-Verzeichnis):

```bash
npm run build:mcp
```

**Schritt 2:** Konfigurationsdatei öffnen:

- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

Falls die Datei noch nicht existiert, erstelle sie.

**Schritt 3:** vswrite als MCP-Server eintragen:

```json
{
  "mcpServers": {
    "vswrite": {
      "command": "node",
      "args": [
        "/PFAD/ZU/vswrite-desktop/dist/mcp/server.mjs"
      ]
    }
  }
}
```

Ersetze `/PFAD/ZU/vswrite-desktop` durch den tatsächlichen Installationspfad von vswrite auf deinem Rechner.

> **Tipp:** Falls in der Datei bereits andere Einträge stehen (z.B. `"preferences": {...}`), füge den `"mcpServers"` Block mit einem Komma nach dem bestehenden Block ein.

**Schritt 4:** Claude Desktop neu starten.

### Benutzung

Nach dem Neustart sieht Claude die vswrite-Tools. Du kannst direkt in Claude Desktop sagen:

- *"Öffne mein Thesis-Projekt in /Users/.../my-thesis"*
- *"Zeig mir den Inhalt meines Typst-Dokuments"*
- *"Ändere die Schriftgröße auf 12pt und die Sprache auf Englisch"*
- *"Kompiliere mein Dokument und zeig mir die Fehler"*
- *"Exportiere das Dokument als PDF nach ~/Desktop/thesis.pdf"*

Claude nutzt dafür automatisch die vswrite-Tools im Hintergrund.

### Projekt wechseln

Du musst die Config **nicht** jedes Mal ändern wenn du das Projekt wechselst. Sag Claude einfach:

*"Wechsle zum Projekt /Users/.../anderes-projekt"*

Claude ruft dann `vswrite_set_project` auf und arbeitet ab sofort mit dem neuen Projekt.

### Verfügbare Tools

| Tool | Beschreibung |
|------|-------------|
| `vswrite_set_project` | Projekt-Verzeichnis setzen/wechseln |
| `vswrite_get_document` | Aktuelles Dokument lesen |
| `vswrite_open_file` | .typ Datei öffnen |
| `vswrite_update_document` | Dokument bearbeiten und speichern |
| `vswrite_compile` | Typst kompilieren (SVG/PDF) |
| `vswrite_get_settings` | Dokument-Einstellungen lesen |
| `vswrite_update_settings` | Einstellungen ändern |
| `vswrite_list_files` | Dateibaum anzeigen |
| `vswrite_read_file` | Datei lesen |
| `vswrite_write_file` | Datei schreiben |
| `vswrite_export_pdf` | PDF exportieren |

---

## Keyboard Shortcuts

| Aktion | Shortcut |
|--------|----------|
| Speichern | `Cmd+S` |
| Suchen | `Cmd+F` |
| Suchen & Ersetzen | `Cmd+H` |
| Sidebar ein/aus | `Cmd+B` |
| Preview ein/aus | `Cmd+Shift+P` |
| Terminal ein/aus | `` Cmd+` `` |
| Rückgängig | `Cmd+Z` |
| Wiederholen | `Cmd+Shift+Z` |
| Focus Mode beenden | `Escape` |
