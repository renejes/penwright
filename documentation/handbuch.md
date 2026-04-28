# vswrite Desktop — Handbuch

> **Version:** 0.7.0 (Pre-Release)
> **Letzte Aktualisierung:** 2026-04-28
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

### Erstes Projekt oeffnen

vswrite arbeitet projekt-basiert: ein Projekt ist ein Ordner mit mindestens einer `.typ`-Datei. Die App startet immer am Start Screen — du entscheidest, was geoeffnet wird.

- **File -> New Project…** (`Cmd+N`) — Neues Projekt aus Template
- **File -> Open Project…** (`Cmd+O`) — Ordner waehlen
- **Recent Projects** auf dem Start Screen — letzte Projekte mit einem Klick wieder oeffnen

Um ein Projekt zu schliessen ohne die App zu beenden: **File -> Close Project** (`Cmd+Shift+W`) — du kommst zum Start Screen zurueck und kannst ein anderes Projekt oeffnen.

---

## App-Layout

```
+--------------------------------------------------------------+
|                        (Titelleiste)                          |
+--------------------------------------------------------------+
|  B I U S  | H1 H2 H3 | bul num | Link  ⚙ ‥ ◎               |  Toolbar
+------+-------------------------------+-----------------------+
|[Files|Outline|Chapters|Project]      |                       |
|      |  [main.typ] [refs.bib]        |                       |
| Side-|                               |   Preview Panel       |
| bar  |  WYSIWYG Editor               |   (Live-PDF)          |
|      |                               |                       |
+------+-------------------------------+-----------------------+
|  Terminal / AI  (echtes Shell-Terminal)                       |
+--------------------------------------------------------------+
| [Project] [Terminal/AI] [Preview]   1.247 Wörter · 5 Min     |
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
| ⚙ Quick | Quick-Settings-Dropdown | — |
| ‥ Typewriter | Typewriter-Mode-Toggle | — |
| ◎ Focus | Focus-Mode-Toggle | — |

### Native Menueleiste

Alle projekt- und dokument-bezogenen Aktionen liegen in der **nativen Menueleiste** (oben am Bildschirm auf macOS, oben am Fenster auf Windows / Linux). Fuenf Top-Level-Menues:

- **File** — New Project (`Cmd+N`), Open Project (`Cmd+O`), Close Project (`Cmd+Shift+W`), Save (`Cmd+S`), Save As (`Cmd+Shift+S`), Export PDF / DOCX, Import Markdown, Link Zotero Library, Open Sources Folder, Add Citation Manually
- **Edit** — Undo / Redo / Cut / Copy / Paste / Select All, Find & Replace (`Cmd+F`), Undo AI Edit
- **View** — Toggle Sidebar (`Cmd+B`), Toggle Preview (`Cmd+Shift+P`), Toggle Terminal (`` Cmd+` ``), Focus Mode, Typewriter Mode, plus Standard-Window-/Zoom-Rollen
- **Document** — Document Settings, Style-Templates-Submenu (7 vordefinierte + Import Custom), Merge Document, Split into Chapters, Open as Typst Source, Ensure Bibliography
- **Help** — User Guide, Keyboard Shortcuts, Report Issue (und About auf Windows / Linux)

In-Text-Inserts (Bild, Tabelle, Mathe, Zitat, Trenner, Seitenumbruch etc.) gehen ueber [Slash-Commands](#slash-commands) — tippe `/` an einer leeren Stelle im Editor.

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

**OEffnen:** File -> New Project… (`Cmd+N`)

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
- `sources/` Ordner fuer Quellen-PDFs und sonstiges Recherchematerial
- `.claude/skills/` mit Claude Code Skills (typst, vswrite, research)
- `.git/` Repository + `.gitignore`, damit das Versionssystem von der ersten Speicherung an funktioniert
- `.vswrite/` Ordner fuer Auto-Backups und AI-Edit-Snapshots (versteckt, projekt-lokal)
- Einen Initial-Commit mit dem Template-Inhalt

---

## Sidebar

Die Sidebar hat vier Tabs:

### Files
- Rekursiver Dateibaum, Back-Button, **Neuer Ordner** (Inline-Eingabefeld — Enter speichert, Esc bricht ab), **Asset hinzufuegen** (Datei-Auswahl, kopiert nach `assets/`)
- Leere Ordner wie `assets/` und `sources/` bleiben sichtbar, damit du immer weisst, wo Sachen hingehoeren
- `.claude/` Ordner sichtbar fuer Skills; `.git/` und `.vswrite/` sind ausgeblendet
- Bilder aus `assets/` sind per Drag & Drop in den Editor ziehbar
- Rechtsklick -> "Open in New Tab"

### Outline
- Live Heading-Hierarchie (H1 -> H2 -> H3), Klick navigiert zum Heading

### Chapters (Include-Manager)
- `#include` Statements, Pfeile zum Umsortieren (sofortiges UI-Update), x zum Entfernen, + Add Chapter

### Project
Dieser Tab ersetzt das alte Git-Panel und nutzt Schreiber-Vokabular statt roher Git-Befehle. Vollstaendiger Workflow: siehe Abschnitt **[Versionen & Auto-Backup](#versionen--auto-backup)** weiter unten. Kurzfassung:
- **Version speichern** — benennt deinen aktuellen Stand und legt ihn im Verlauf des Projekts ab
- **Aenderungen seit letzter Version** — Checkboxen, welche Dateien in die naechste Version kommen
- **Verlauf** (immer sichtbar) — alle gespeicherten Versionen, Klick zeigt Diff + „Wiederherstellen"
- **Auto-Backup-Status** — kleine Fusszeile, die zeigt, wann das letzte automatische Backup gemacht wurde
- **Erweitert** (zugeklappt) — optional: Cloud-Sync (Push/Pull zu GitHub oder einem beliebigen Git-Remote)

---

## Live-Preview

- **Root-Datei Kompilierung:** Bei Chapters wird automatisch main.typ kompiliert
- **PDF-Rendering** ueber pdf.js — viewport-virtualisiert, also bleibt die Vorschau auch bei 100+ Seiten fluessig
- **Text markieren & kopieren** in der Vorschau dank pdf.js' TextLayer
- **Fehleranzeige:** Typst-Fehler werden im Preview Panel ausgegeben
- **Live-Update** waehrend du tippst, mit 400 ms Compile-Debounce

---

## Import & Export

### Markdown Import
- **File -> Import Markdown…**
- Konvertiert: Headings, Bold/Italic, Links, Images, Listen, Code Blocks, Blockquotes
- YAML-Frontmatter wird uebersprungen
- Erzeugt eine neue `.typ`-Datei mit Standard-Preamble

### Zotero Integration
- **File -> Link Zotero Library…**
- Zotero Better BibTeX `.bib`-Datei auswaehlen
- Wird als `zotero.bib` ins Projekt kopiert
- **Auto-Sync:** AEnderungen in Zotero werden automatisch uebernommen (solange die App laeuft)
- Alle Zotero-Quellen erscheinen im `@`-Autocomplete

### Export-Dialog

Bei Multi-Chapter-Projekten oeffnen **File -> Export PDF** oder **Export DOCX** einen Dialog, in dem du:
- Mit einem Klick zwischen **PDF** und **DOCX** wechseln kannst
- **Die zu exportierenden Kapitel** per Checkbox auswaehlst — jedes Kapitel zeigt seine erste H1 als Titel
- Das **Literaturverzeichnis** ein-/ausschalten kannst
- Per **alle / keine**-Shortcuts schnell die Auswahl steuern kannst

Titelseite, Abstract und alles ausserhalb von `#include` werden immer mit-exportiert. Single-File-Projekte ohne `#include` umgehen den Dialog und gehen direkt zum Save-Dialog.

### PDF Export

Nutzt die gebundelte Typst-CLI fuer das (ggf. gefilterte) Projekt. Das PDF entspricht 1:1 der Vorschau.

### DOCX Export

Das DOCX wird mit echten Word-Styles erzeugt:
- **Multi-Chapter-faehig:** alle `#include`-Kapitel werden in den Output gemerged (das alte „nur die offene Datei"-Verhalten ist weg)
- Ueberschriften, Bibliographie, Code-Bloecke und Zitate nutzen benannte Word-Styles — im Style-Panel einheitlich anpassbar
- Seitengroesse, Raender, Schriftart, Schriftgroesse, Zeilenabstand werden aus deinen Typst `#set`-Settings uebernommen (z. B. A4 + Libertinus 11 pt)
- **Heading-Nummerierung live:** hat deine Typst-Datei `#set heading(numbering: "1.1")`, bekommen die Ueberschriften Word-Multilevel-Numbering. Wenn dein Betreuer Kapitel in Word umstellt, aktualisieren sich die Zahlen automatisch.
- Citations werden als `(Autor Jahr)` gerendert, wenn sie in der `.bib`-Datei gefunden werden, sonst als `[citekey]`
- TOC- und Bibliographie-Ueberschriften werden passend zur Dokumentsprache lokalisiert (DE/EN/FR/ES/IT/PT/NL)
- **Hinweis:** Der DOCX-Export wird iterativ verbessert. Stark angepasste Typst-Konstrukte (z. B. Titelseiten mit eigenen `#show heading: …`-Regeln) werden nicht immer perfekt uebernommen — fuer das treueste Layout: PDF nutzen.

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

**Template anwenden:** Document-Menue -> Style Templates -> Stil waehlen. Wendet das gewaehlte Preamble auf deine `main.typ` an (nur erlaubt, wenn die Hauptdatei aktiv ist — siehe Hinweis unten).

**Eigene Templates importieren:** Document-Menue -> Style Templates -> Import Custom Template… -> `.typ`-Datei waehlen. Nur das Preamble (#set/#show Regeln) wird extrahiert, auch aus kompletten Dokumenten. Gespeichert in `.claude/style-templates/`.

**Hinweis:** Stile koennen nur angewendet werden, solange du im Hauptdokument des Projekts (`main.typ` bzw. die Datei, auf die deine `#include`s zeigen) bist. Wer einen Stil aus einem Kapitel heraus anwenden will, bekommt einen Block-Dialog — sonst wuerde der Stil-Vorspann an den Kapitel-Anfang gehaengt und die Datei stillschweigend kaputtmachen.

---

## Versionen & Auto-Backup

vswrite haelt drei unabhaengige Schichten zur Absicherung deiner Arbeit — jede mit klar abgegrenztem Zweck:

| Schicht | Ausloeser | Zweck | Wo es lebt |
|---------|-----------|-------|------------|
| **Versionen** | Du klickst **Version speichern** | Bewusste Meilensteine im Projektverlauf | `<projekt>/.git/` |
| **Auto-Backup** | Timer (konfigurierbar, Default alle 30 s) | Crash-/Hänger-Schutz — nie mehr als X Sekunden Arbeit verlieren | `<projekt>/.vswrite/backups/` |
| **AI-Edit-Undo** | Externe Aenderung (Terminal / MCP) | Schnelles Rueckgaengig der letzten AI-Aenderung | `<projekt>/.vswrite/ai-snapshots/` |

Alle drei leben **innerhalb des Projektordners**, das Projekt ist also self-contained: kopierst oder verschiebst du es, wandert der vollstaendige Verlauf mit.

### Eine Version speichern

Im **Project**-Sidebar-Tab:
1. Tippe eine kurze Beschreibung in **Version speichern** ("Kapitel 3 erste Fassung", "Vor Lektorats-Feedback", …)
2. Optional: hak einzelne Dateien in **Aenderungen seit letzter Version** ab, die nicht in diese Version sollen
3. Klick **Version speichern**

Die Verlaufsliste aktualisiert sich sofort. Jeder Eintrag bleibt fuer immer abrufbar (bis du das Projekt loeschst).

### Verlauf durchsuchen

Klick auf einen Eintrag im **Verlauf** oeffnet die Detail-Ansicht:
- Datum + Beschreibung
- Diff pro Datei im Quelltext-Stil (rote entfernte Zeilen, gruene neue — wie GitHub)
- **Diese Version wiederherstellen**-Button — ueberschreibt die aktuellen Dateien mit dem historischen Stand (mit Bestaetigung)

Dein aktueller Stand geht nie verloren: vor dem Wiederherstellen kannst du eine **Version speichern**, um den jetzigen Zwischenstand festzuhalten.

### Auto-Backup

Eine kleine Status-Zeile am unteren Rand des **Project**-Tabs zeigt, wann das letzte automatische Backup gemacht wurde („Letztes Backup vor 12 s"). Klick darauf oeffnet den Backup-Browser:
- Jedes Backup ist ein vollstaendiger Snapshot aller `.typ`- und `.bib`-Dateien zum Zeitpunkt
- **Laden** stellt ein Backup in den Working-Tree zurueck (mit Bestaetigung — vorher Version speichern, falls du den jetzigen Stand nicht verlieren willst)
- Das **Zahnrad-Icon** im Header oeffnet die Einstellungen: Backup-Intervall (10 s – 5 min), maximale Anzahl gespeicherter Backups (10 / 30 / 100 / 1000), maximale AI-Edit-Snapshots

### AI-Edit-Undo

Wenn ein externes Tool (Claude Code im Terminal, der MCP-Server, …) eine offene Datei aendert, sichert vswrite den vorherigen Inhalt **vor** der Aenderung in den AI-Snapshot-Ringpuffer. Mit dem Menue-Eintrag **Undo AI Edit** gehst du Schritt fuer Schritt zurueck. Snapshots ueberleben App-Neustarts (sie liegen in `.vswrite/ai-snapshots/`).

### Cloud-Backup (optional)

Der Versionsverlauf ist standardmaessig lokal. Wer ihn zu GitHub (oder einem beliebigen Git-Remote) pushen will — als externes Backup oder um auf einem zweiten Geraet zu arbeiten:

1. **Project**-Tab oeffnen, **Erweitert** ausklappen
2. Remote-URL einfuegen (z. B. `https://github.com/dein-user/deine-thesis.git`)
3. **Mit Cloud synchronisieren** (Push) und **Cloud-Backup laden** (Pull) nach Bedarf nutzen

Zwei Geraete parallel sind nicht abgesichert — immer nur ein Geraet zur Zeit.

---

## File Watcher

Externe Dateiaenderungen (z. B. durch Claude Code im Terminal) werden automatisch erkannt:
- Aktuelle Datei geaendert -> Editor updatet sofort
- `.bib` geaendert -> Citations werden neu geladen
- Dateien hinzugefuegt/geloescht -> File-Tree refresht
- Eigene Saves werden ignoriert (3s Schutzfenster)
- Der `.vswrite/`-Ordner wird vom Watcher ausgeschlossen, damit Backups keine Refresh-Schleifen ausloesen

Zum Rueckgaengig-Machen von AI-Edits siehe Abschnitt [Versionen & Auto-Backup](#versionen--auto-backup).

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
- Status Bar (unten rechts) zeigt jederzeit:
  - **Wortzahl + Lesezeit** des aktiven Dokuments (z. B. *1.247 Wörter · 5 Min Lesezeit*) — live waehrend du tippst, mit 200 Woertern pro Minute. Code-Bloecke und rohe Typst-Bloecke werden nicht mitgezaehlt, damit der Wert sinnvoll bleibt.
  - **Save-Status:** "Unsaved" (orange) oder "Saved 14:35"
  - **Dateiname** des aktiven Tabs
  - **Lizenz-Tier**-Badge (Unlicensed / Licensed / Pro)
- Warnung beim Schliessen bei ungespeicherten AEnderungen
- **Crash Recovery:** Auto-Backups werden nach `<projekt>/.vswrite/backups/<timestamp>/` geschrieben (Intervall konfigurierbar, Default 30 s). Wenn die App abstuerzt und das juengste Backup neuer ist als die zuletzt gespeicherte Datei auf der Platte, bietet vswrite beim Wiederoeffnen des Projekts an, den Backup-Stand zurueckzuholen. Details siehe [Versionen & Auto-Backup](#versionen--auto-backup).

---

## Persistenz

vswrite trennt zwei Arten von Zustand: **App-Einstellungen**, die global zur Installation gehoeren, und **Projekt-Zustand**, der mit jedem Projektordner mitwandert.

**Global** (im OS-User-Data-Ordner):
- Fenster-Position & -Groesse
- Panel-Zustaende (Sidebar/Preview/Terminal offen/zu, Groessen, aktiver Tab)
- Recent Projects (die letzten 10 Projektordner — tote Eintraege werden automatisch gefiltert)
- Onboarding-Flag (Welcome-Screen "Don't show again")
- Zotero `.bib`-Pfad
- Auto-Backup-Konfiguration (Intervall, Max-Anzahl Backups, Max-AI-Snapshots)
- License-Key (verschluesselt im OS-Keychain)

**Pro Projekt** (im Projektordner):
- Versionsverlauf (`.git/`)
- Auto-Backups (`.vswrite/backups/`)
- AI-Edit-Snapshots (`.vswrite/ai-snapshots/`)
- Claude Code Skills (`.claude/skills/`)

Die App **startet immer am Start Screen** — kein Auto-Reopen. Bewusste Designentscheidung, damit das OEffnen von vswrite dich nie mit einem Projekt ueberrascht, mit dem du gar nicht arbeiten wolltest.

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
| Neues Projekt | `Cmd+N` |
| Projekt oeffnen | `Cmd+O` |
| Projekt schliessen | `Cmd+Shift+W` |
| Speichern | `Cmd+S` |
| Speichern unter | `Cmd+Shift+S` |
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
