# vswrite Desktop — Handbuch

> **Version:** 0.7.0 (Pre-Release)
> **Letzte Aktualisierung:** 2026-04-17
> **English version:** [handbook.md](handbook.md)

---

## Was ist vswrite Desktop?

vswrite Desktop ist ein eigenstaendiger WYSIWYG-Editor fuer Typst-Dokumente. Statt Markup-Code zu sehen, arbeitest du in einem visuellen Editor — aehnlich wie in Google Docs oder Notion. Gleichzeitig bleibt die volle Typst-Funktionalitaet erhalten: Mathe-Formeln, Konfiguration und Layout werden als bearbeitbare Code-Bloecke angezeigt.

Typisches Einsatzgebiet: wissenschaftliche Arbeiten, Buecher, laengere Dokumente mit Multi-Chapter-Struktur, Bibliografie und Mathe-Satz — alles, wofuer man sonst LaTeX oder Word bemuehen wuerde.

---

## Erste Schritte

### Voraussetzungen

- **macOS**, **Windows** oder **Linux**
- **Typst CLI** — **nicht mehr noetig**. Die App bringt die passende Typst-Binary selbst mit, du brauchst nichts zusaetzlich zu installieren.

### App installieren

Ab v0.7.0:
- **macOS:** DMG von [vswrite.com](https://vswrite.com) herunterladen und in den Ordner "Programme" ziehen
- **Windows:** NSIS-Installer herunterladen und ausfuehren
- **Linux:** AppImage herunterladen, ausfuehrbar machen (`chmod +x`), starten

### Erste Datei oeffnen

- **File -> Open** (`Cmd+O`) -> `.typ`-Datei auswaehlen
- **File -> Open Folder** -> Projektordner oeffnen
- **File -> New Project** -> Neues Projekt mit Template erstellen

---

## App-Layout

```
+--------------------------------------------------------------+
|                        (Titelleiste)                          |
+--------------------------------------------------------------+
|  B I U S  | H1 H2 H3 | bul num | Link | Quick Focus Hub      |  Toolbar
+------+-------------------------------+-----------------------+
|[Files|Outline|Chapters|Git]          |                       |
|      |  [main.typ] [refs.bib]        |                       |
| Side-|                               |   Preview Panel       |
| bar  |  WYSIWYG Editor               |   (SVG Pages)         |
|      |                               |                       |
+------+-------------------------------+-----------------------+
|  Terminal / AI  (echtes Shell-Terminal)                       |
+--------------------------------------------------------------+
| [Project] [Terminal/AI] [Preview]      Saved 14:35  main.typ |
+--------------------------------------------------------------+
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
| S | Durchgestrichen | `Cmd+Shift+X` |
| `</>` | Inline-Code | `Cmd+E` |
| Link | Link einfuegen/bearbeiten | `Cmd+K` |
| H1 / H2 / H3 | Ueberschriften | `Cmd+Alt+1/2/3` |
| bul | Aufzaehlung | `Cmd+Shift+8` |
| num | Nummerierte Liste | `Cmd+Shift+7` |
| { } | Code-Block | `Cmd+Alt+C` |
| Quick | Quick-Settings | — |
| Focus | Focus Mode | — |
| Hub | Aktions-Menue (Command Hub) | — |

### Aktions-Menue (Command Hub)

OEffnet ein Dropdown mit allen verfuegbaren Aktionen:

- **Insert** — Ueberschriften, Listen, Zitat, Code Block, Math-Formel, Typst Code, Bild, Linie
- **Format** — Fett, Kursiv, Durchgestrichen, Inline-Code, Link, Textausrichtung
- **View** — Focus Mode, Suchen & Ersetzen
- **File** — PDF/DOCX exportieren, Import Markdown, Link Zotero, Dokument-Einstellungen, Merge, Split, Neues Projekt/Datei
- **Style Templates** — 7 vordefinierte + eigene Templates importieren
- **Help** — Keyboard Shortcuts

### Slash Commands

Tippe `/` an einer leeren Stelle im Editor:

| Befehl | Beschreibung |
|--------|--------------|
| `/Heading 1-3` | Ueberschriften |
| `/Bullet List` | Aufzaehlung |
| `/Numbered List` | Nummerierte Liste |
| `/Quote` | Blockquote |
| `/Code Block` | Code-Block |
| `/Math` | Typst Mathe-Block |
| `/Typst Code` | Roher Typst-Code |
| `/Image` | Bild einfuegen |

### Multi-Tab Editor

- Mehrere Dateien gleichzeitig als Tabs offen
- Tab-Leiste ueber dem Editor mit Dateinamen
- x Button zum Schliessen einzelner Tabs
- **Rechtsklick** auf Dateien in der Sidebar -> "Open in New Tab"
- **Rechtsklick** auf `.typ`-Dateien -> "Open as Text" (oeffnet im Code-Editor statt WYSIWYG)
- `.typ` oeffnet im WYSIWYG-Editor
- `.bib`, `.txt`, `.md`, `.yaml` etc. oeffnen im Code-Editor (CodeMirror 6)
- `.pdf` oeffnet im eingebauten PDF-Viewer (Text markierbar + kopierbar)

### Bilder

**Einfuegen:**
- **Slash Command:** `/Image` -> Datei-Auswahl
- **Drag & Drop:** Bild vom Finder oder aus der Sidebar (assets/) in den Editor ziehen
- **Command Hub:** Hub -> Insert -> Image

**Bild-Dialog (Klick aufs Bild):**
- **Breite:** Presets (25 %, 50 %, 75 %, 100 %) oder Custom (z. B. `60%`, `8cm`)
- **Alt-Text:** Bildbeschreibung
- **Ausrichtung:** Links, Zentriert, Rechts

**Guard:** Bilder, die in einen Code-Block (Preamble, #show etc.) gedroppt werden, werden automatisch nach dem Block eingefuegt — kein Compile-Fehler.

Bilder werden automatisch in `assets/` kopiert und als `#image("assets/...")` eingefuegt. Bilder, die bereits im Projekt liegen, werden nicht dupliziert.

### Citation Autocomplete

Tippe `@` im Editor -> Dropdown mit allen Quellen aus den `.bib`-Dateien:
- Filterbar nach Citekey, Autor, Titel, Jahr
- Klick fuegt `@citekey` als Citation-Node ein
- Citations werden automatisch beim Datei-OEffnen geladen
- Funktioniert auch mit Zotero-verknuepften `.bib`-Dateien

---

## Neues Projekt erstellen

**OEffnen:** File -> New Project oder Hub -> File -> New Project

**Dialog:**
1. **Projektname** eingeben (wird zum Ordnernamen)
2. **Template** waehlen:

| Template | Beschreibung |
|----------|--------------|
| **Document** | Einfaches Dokument (eine Datei) |
| **Thesis** | Wissenschaftliche Arbeit mit Kapiteln + Bibliography |
| **Paper** | Akademisches Paper (Abstract, Sections, References) |
| **Letter** | Formaler Brief |
| **Book** | Buch mit Kapiteln + Inhaltsverzeichnis |

3. **Speicherort** waehlen -> Projektstruktur wird erstellt

Jedes neue Projekt bekommt automatisch:
- Template-Dateien (main.typ, chapters/, bibliography.bib)
- `assets/` Ordner fuer Bilder
- `.claude/skills/` mit Claude Code Skills (typst, vswrite, research)

---

## Sidebar

Die Sidebar hat vier Tabs:

### Files
- Rekursiver Dateibaum, Back-Button, Open-Folder
- `.claude/` Ordner sichtbar fuer Skills
- Bilder aus `assets/` sind per Drag & Drop in den Editor ziehbar
- Rechtsklick -> "Open in New Tab"

### Outline
- Live Heading-Hierarchie (H1 -> H2 -> H3), Klick navigiert zum Heading

### Chapters (Include-Manager)
- `#include` Statements, Pfeile zum Umsortieren (sofortiges UI-Update), x zum Entfernen, + Add Chapter

### Git
- Branch, Stage/Unstage, Commit, Push/Pull, Init
- **Hinweis:** Anlegen eines neuen GitHub-Repos geschieht aktuell ueber das integrierte Terminal, z. B. mit `gh repo create my-thesis --public --source . --push`. Push/Pull ueber die Sidebar funktionieren, sobald ein Remote konfiguriert ist.

---

## Live-Preview

- **Root-Datei Kompilierung:** Bei Chapters wird automatisch main.typ kompiliert
- **Chapter-Navigation:** Preview scrollt zum aktiven Kapitel
- **Scroll-Erhaltung:** Position bleibt bei Recompile erhalten
- **Virtualisiert:** Bei grossen Dokumenten (50+ Seiten) werden nur die sichtbaren Seiten gerendert — fluessiges Scrollen auch bei 100+ Seiten
- **Fehleranzeige:** Typst-Fehler werden im Preview Panel ausgegeben
- **SVG/PDF Modus:** Toggle im Preview-Header — SVG (schnell, Standard) oder PDF (via pdf.js mit Textauswahl)

---

## Import & Export

### Markdown Import
- **File -> Import Markdown** oder Hub -> Import Markdown
- Konvertiert: Headings, Bold/Italic, Links, Images, Listen, Code Blocks, Blockquotes
- YAML-Frontmatter wird uebersprungen
- Erzeugt eine neue `.typ`-Datei mit Standard-Preamble

### Zotero Integration
- **File -> Link Zotero Library** oder Hub -> Link Zotero Library
- Zotero Better BibTeX `.bib`-Datei auswaehlen
- Wird als `zotero.bib` ins Projekt kopiert
- **Auto-Sync:** AEnderungen in Zotero werden automatisch uebernommen (solange die App laeuft)
- Alle Zotero-Quellen erscheinen im `@`-Autocomplete

### PDF Export
Hub -> File -> Export PDF

### DOCX Export

Hub -> File -> Export DOCX.

Das DOCX wird mit echten Word-Styles erzeugt:
- Ueberschriften, Bibliographie, Code-Bloecke und Zitate nutzen benannte Word-Styles — im Style-Panel einheitlich anpassbar
- Seitengroesse, Raender, Schriftart, Schriftgroesse, Zeilenabstand werden aus deinen Typst `#set`-Settings uebernommen (z. B. A4 + Libertinus 11 pt)
- **Heading-Nummerierung live:** hat deine Typst-Datei `#set heading(numbering: "1.1")`, bekommen die Ueberschriften Word-Multilevel-Numbering. Wenn dein Betreuer Kapitel in Word umstellt, aktualisieren sich die Zahlen automatisch.
- Citations werden als `(Autor Jahr)` gerendert, wenn sie in der `.bib`-Datei gefunden werden, sonst als `[citekey]`
- TOC- und Bibliographie-Ueberschriften werden passend zur Dokumentsprache lokalisiert (DE/EN/FR/ES/IT/PT/NL)

---

## Style Templates

7 vordefinierte + eigene Templates:

| Template | Beschreibung |
|----------|--------------|
| Classic Academic | Serifenschrift, nummerierte Ueberschriften |
| Modern Clean | Sans-Serif, blaue Akzente |
| Minimal | Ultra-clean, grosszuegig |
| Vibrant | Kraeftige Farben |
| Elegant | Dekorativ, goldene Akzente |
| Professional Report | Business-Layout |
| Artsy | Rot-blaues Farbschema |

**Eigene Templates importieren:** Hub -> Style Templates -> Import Style Template -> `.typ`-Datei waehlen. Nur das Preamble (#set/#show Regeln) wird extrahiert, auch aus kompletten Dokumenten. Gespeichert in `.claude/style-templates/`.

---

## File Watcher

Externe Dateiaenderungen (z. B. durch Claude Code im Terminal) werden automatisch erkannt:
- Aktuelle Datei geaendert -> Editor updatet sofort
- `.bib` geaendert -> Citations werden neu geladen
- Dateien hinzugefuegt/geloescht -> File-Tree refresht
- Eigene Saves werden ignoriert (3s Schutzfenster)

**Undo AI Edit:** Bevor eine externe AEnderung im Editor landet, wird der aktuelle Stand in einen Ring-Buffer (max. 20 Eintraege) gesichert. Du kannst ueber das Menue zum Stand vor der AI-AEnderung zurueckspringen.

---

## Terminal / AI

Echtes PTY-Terminal (xterm.js + node-pty):
- Shell: zsh (macOS), bash (Linux), PowerShell (Windows)
- Working Directory: Projektordner
- Claude Code: `claude` direkt starten
- Claude Code Skills werden automatisch in `.claude/skills/` erzeugt
- Auto-Resize, Auto-Respawn (max. 5 Mal)

---

## Rechtschreibpruefung

- **Automatisch aktiv:** nutzt den eingebauten Electron-Spellchecker (Hunspell)
- **Sprachsynchronisation:** Sprache wird aus `#set text(lang: "de")` im Typst-Dokument gelesen
- **Dynamischer Wechsel:** aendert sich bei Quick Settings oder Settings Panel
- **Rechtsklick auf Fehler:** Kontextmenue mit bis zu 5 Korrekturvorschlaegen + "Add to Dictionary"
- **Unterstuetzte Sprachen:** en, de, fr, es, it, pt, nl, sv, da, nb, fi, pl, ru

---

## PDF-Viewer

- `.pdf`-Dateien aus der Sidebar per Klick im integrierten Viewer oeffnen
- **Virtualisiertes Rendering:** nur sichtbare Seiten werden gerendert (performant auch bei grossen PDFs)
- **Text markieren & kopieren:** TextLayer ueber dem Canvas ermoeglicht Cmd+C
- Header mit Dateiname, Seitenzahl und Close-Button
- Ideal zum Lesen von Quellen in `sources/`

---

## Auto-Save & Status

- Edits werden nach 1 Sekunde automatisch gespeichert
- Status Bar: "Unsaved" (orange) oder "Saved 14:35"
- Warnung beim Schliessen bei ungespeicherten AEnderungen
- **Crash Recovery:** alle 30 s wird ein Backup-Snapshot nach `~/Library/Application Support/vswrite/backups/` (macOS) geschrieben. Wenn die App abstuerzt und du die Datei spaeter wieder oeffnest, bietet dir vswrite an, den Backup-Stand wiederherzustellen.

---

## Persistenz

vswrite merkt sich deinen App-Zustand zwischen Neustarts:

- **Window-Position & -Groesse** — Fenster oeffnet sich dort, wo du es zuletzt hattest
- **Panel-Zustaende** — Sidebar, Preview, Terminal bleiben offen/zu wie zuletzt
- **Panel-Groessen** — Sidebar-Breite, Preview-Breite, Terminal-Hoehe
- **Recent Projects** — die letzten 10 Projekte erscheinen auf dem Start Screen
- **Auto-Reopen** — beim App-Start wird automatisch das letzte Projekt geoeffnet
- **Onboarding** — Welcome-Screen wird nicht erneut angezeigt, wenn du "Don't show again" aktiviert hast

---

## Lizenz-Management

vswrite verwendet ein Lizenzmodell mit zwei Stufen:

| Lizenz | Umfang |
|--------|--------|
| **Basic** | Alle Editor-Features (WYSIWYG, Preview, Terminal, Git, Import/Export) |
| **Pro** | Alles aus Basic + MCP-Server-Zugang fuer KI-Integration |

### Lizenzstatus in der Status Bar

In der Status Bar (unten rechts) wird der aktuelle Lizenzstatus angezeigt:
- **Unlicensed** — keine Lizenz hinterlegt
- **Licensed** — gueltige Basic-Lizenz aktiv
- **Pro** — gueltige Pro-Lizenz aktiv

**Klick auf den Lizenzstatus** oeffnet den Lizenz-Dialog.

### Lizenz aktivieren

1. Lizenz-Dialog oeffnen (Klick auf Lizenzstatus in der Status Bar)
2. **License Key** eingeben (z. B. `VSWRITE_PRO_xxxx...`)
3. Der Key wird gegen **Polar** validiert und lokal gespeichert (verschluesselt im System-Keychain)
4. Nach erfolgreicher Validierung ist die Lizenz sofort aktiv

**Lizenz kaufen:** ueber [vswrite.com/pricing](https://vswrite.com/pricing) oder direkt ueber den **"Buy License"**-Button im Lizenz-Dialog.

### Offline-Nutzung

Wurde die Lizenz einmal validiert, funktioniert vswrite auch ohne Internetverbindung. Es gilt eine **30-Tage Grace Period** — nach 30 Tagen ohne erneute Online-Validierung wird die Lizenz deaktiviert.

### Sicherheit

Die Lizenzdaten werden mittels Electrons `safeStorage` verschluesselt im System-Keychain (macOS), DPAPI (Windows) oder libsecret (Linux) abgelegt. Manipulieren der Konfigurationsdatei reicht nicht, um die Pro-Stufe freizuschalten.

---

## About-Dialog

Erreichbar ueber:
- **macOS:** `vswrite -> About vswrite`
- **Windows/Linux:** `Help -> About vswrite`

Der Dialog zeigt:
- App-Version und Logo
- Aktuellen Lizenz-Status (Unlicensed / Basic / Pro)
- System-Info: Platform + Architektur, Electron / Chromium / Node Versionen
- Links: User Guide, Website, Report Issue
- **Copy Diagnostics** — kopiert Version + Platform + Electron-Stack + Lizenz-Tier in die Zwischenablage. Hilfreich wenn du ein Issue meldest.

---

## MCP Server — KI-Integration mit Claude Desktop & Co.

vswrite enthaelt einen eingebauten MCP-Server (Model Context Protocol), mit dem externe KI-Anwendungen wie **Claude Desktop**, **Codex Desktop** oder **Clawdbot** direkt mit deinen Typst-Dokumenten arbeiten koennen — ohne das Terminal zu benutzen.

> **Hinweis:** Der MCP Server erfordert eine **Pro-Lizenz**. Siehe [Lizenz-Management](#lizenz-management).

### Was kann der MCP-Server?

Die KI kann ueber den MCP-Server (26 Tools):
- Typst-Dokumente oeffnen, lesen und bearbeiten
- Dokument-Einstellungen aendern (Schriftart, Groesse, Sprache, Raender, etc.)
- Style Templates anwenden (7 vordefinierte Stile)
- Typst kompilieren und Fehler analysieren
- PDFs exportieren
- Kapitel verwalten (lesen, umordnen, hinzufuegen, entfernen, zusammenfuehren, aufteilen)
- Bibliographie und Citations verwalten (BibTeX-Eintraege hinzufuegen)
- Projektdateien verwalten (lesen, schreiben, auflisten)
- Neue Projekte aus Templates erstellen
- Git-Operationen (Status, Commit, Push)
- Zwischen Projekten wechseln

### Einrichtung: Claude Desktop

**Schritt 1:** MCP-Server bauen (einmalig, im vswrite-Verzeichnis):

```bash
npm run build:mcp
```

**Schritt 2:** Konfigurationsdatei oeffnen:

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
        "/PFAD/ZU/vswrite-desktop/dist/mcp/server.mjs",
        "--license-key", "VSWRITE_PRO_xxxx..."
      ]
    }
  }
}
```

Ersetze `/PFAD/ZU/vswrite-desktop` durch den tatsaechlichen Installationspfad und `VSWRITE_PRO_xxxx...` durch deinen Pro-Lizenzschluessel.

**Alternativ:** statt `--license-key` in der Config kannst du die Umgebungsvariable `VSWRITE_LICENSE_KEY` setzen:

```json
{
  "mcpServers": {
    "vswrite": {
      "command": "node",
      "args": ["/PFAD/ZU/vswrite-desktop/dist/mcp/server.mjs"],
      "env": { "VSWRITE_LICENSE_KEY": "VSWRITE_PRO_xxxx..." }
    }
  }
}
```

**Schritt 4:** Claude Desktop neu starten.

### Benutzung

Nach dem Neustart sieht Claude die vswrite-Tools. Du kannst direkt in Claude Desktop sagen:

- *"OEffne mein Thesis-Projekt in /Users/.../my-thesis"*
- *"Zeig mir den Inhalt meines Typst-Dokuments"*
- *"AEndere die Schriftgroesse auf 12pt und die Sprache auf Englisch"*
- *"Kompiliere mein Dokument und zeig mir die Fehler"*
- *"Exportiere das Dokument als PDF nach ~/Desktop/thesis.pdf"*

Claude nutzt dafuer automatisch die vswrite-Tools im Hintergrund. Alle Pfade werden gegen das Projekt-Verzeichnis validiert — der Agent kann nicht versehentlich aus dem Projekt ausbrechen.

### Projekt wechseln

Du musst die Config **nicht** jedes Mal aendern, wenn du das Projekt wechselst. Sag Claude einfach:

*"Wechsle zum Projekt /Users/.../anderes-projekt"*

Claude ruft dann `vswrite_set_project` auf und arbeitet ab sofort mit dem neuen Projekt.

### Verfuegbare Tools (26)

**Dokument & Projekt:**

| Tool | Beschreibung |
|------|--------------|
| `vswrite_set_project` | Projekt-Verzeichnis setzen/wechseln |
| `vswrite_get_document` | Aktuelles Dokument lesen |
| `vswrite_open_file` | .typ-Datei oeffnen |
| `vswrite_update_document` | Dokument bearbeiten und speichern |
| `vswrite_compile` | Typst kompilieren (SVG/PDF) |
| `vswrite_export_pdf` | PDF exportieren |
| `vswrite_create_project` | Neues Projekt aus Template erstellen |
| `vswrite_list_files` | Dateibaum anzeigen |
| `vswrite_read_file` | Datei lesen |
| `vswrite_write_file` | Datei schreiben |

**Settings & Styling:**

| Tool | Beschreibung |
|------|--------------|
| `vswrite_get_settings` | Dokument-Einstellungen lesen |
| `vswrite_update_settings` | Einstellungen aendern |
| `vswrite_list_styles` | Verfuegbare Style-Templates auflisten |
| `vswrite_apply_style` | Style-Template anwenden |

**Kapitel:**

| Tool | Beschreibung |
|------|--------------|
| `vswrite_get_chapters` | Kapitel-Struktur lesen |
| `vswrite_reorder_chapters` | Kapitel-Reihenfolge aendern |
| `vswrite_add_chapter` | Neues Kapitel erstellen |
| `vswrite_remove_chapter` | Kapitel entfernen |
| `vswrite_merge_document` | Alle Kapitel zusammenfuehren |
| `vswrite_split_document` | Dokument in Kapitel aufteilen |

**Bibliographie:**

| Tool | Beschreibung |
|------|--------------|
| `vswrite_get_citations` | Alle Citations aus .bib lesen |
| `vswrite_add_citation` | BibTeX-Eintrag hinzufuegen |
| `vswrite_ensure_bibliography` | Bibliographie-Setup sicherstellen |

**Git:**

| Tool | Beschreibung |
|------|--------------|
| `vswrite_git_status` | Git-Status anzeigen |
| `vswrite_git_commit` | AEnderungen committen |
| `vswrite_git_push` | Zum Remote pushen |

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
| Rueckgaengig | `Cmd+Z` |
| Wiederholen | `Cmd+Shift+Z` |
| Focus Mode beenden | `Escape` |
| Fett | `Cmd+B` |
| Kursiv | `Cmd+I` |
| Durchgestrichen | `Cmd+Shift+X` |
| Inline-Code | `Cmd+E` |
| Link | `Cmd+K` |
| Ueberschrift 1/2/3 | `Cmd+Alt+1/2/3` |
| Bullet List | `Cmd+Shift+8` |
| Numbered List | `Cmd+Shift+7` |
| Code-Block | `Cmd+Alt+C` |

Auf Windows/Linux jeweils `Ctrl` statt `Cmd`.

---

## Updates

Die App prueft bei jedem Start, ob eine neue Version verfuegbar ist (5 s nach Start, dann alle 4 Stunden). Wenn ja, erscheint ein nativer Dialog mit der Option, das Update herunterzuladen und beim naechsten Start zu installieren.

Manueller Check: About-Dialog oeffnen -> die Version dort entspricht der installierten Version. Aktuellste Version siehe [vswrite.com/download](https://vswrite.com) oder [releases.vswrite.com](https://releases.vswrite.com).

---

## Hilfe & Support

- **User Guide (dieses Handbuch):** [vswrite.netlify.app/de/docs](https://vswrite.netlify.app/de/docs) — oder im App-Menue unter **Help -> User Guide**
- **Bugs / Feature-Wuensche:** [github.com/renejes/vswrite-desktop/issues](https://github.com/renejes/vswrite-desktop/issues) — oder im App-Menue unter **Help -> Report Issue**
- **Website:** [vswrite.com](https://vswrite.com)

Wenn du einen Bug meldest, hilft es sehr, im About-Dialog **"Copy Diagnostics"** zu klicken und den Output mit ins Issue zu packen — damit sieht man auf einen Blick Version, Plattform und Lizenz-Stufe.
