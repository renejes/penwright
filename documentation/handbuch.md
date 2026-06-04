# vswrite Desktop — Handbuch

> **Version:** 0.7.0 (Pre-Release)
> **Letzte Aktualisierung:** 2026-04-29
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
- **„Open Sample Project"** auf dem Start Screen — kopiert eine kommentierte Mini-Thesis ueber AI-gestuetztes wissenschaftliches Arbeiten an einen Speicherort deiner Wahl (Default: `~/Documents/vswrite-sample-thesis`). Inkl. fuenf realer Open-Access-Quellen (PDFs in `sources/`), drei Beispiel-Comments und einer initialen Version im Verlauf. Jedes Feature mindestens einmal demonstriert
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
| Fn | Fußnote einfuegen (oeffnet Popup-Editor) | — |
| Cm | Kommentar zur Auswahl (oder Wort am Cursor) | `Cmd+Alt+M` |
| ⚙ Quick | Quick-Settings-Dropdown | — |
| ‥ Typewriter | Typewriter-Mode-Toggle | — |
| 𝓡 Reading | Reading-Mode-Toggle (Buchsatz-Typografie) | `Cmd+Alt+R` |
| ◎ Focus | Focus-Mode-Toggle | — |

### Native Menueleiste

Alle projekt- und dokument-bezogenen Aktionen liegen in der **nativen Menueleiste** (oben am Bildschirm auf macOS, oben am Fenster auf Windows / Linux). Fuenf Top-Level-Menues:

- **File** — New Project (`Cmd+N`), Open Project (`Cmd+O`), Close Project (`Cmd+Shift+W`), Save (`Cmd+S`), Save As (`Cmd+Shift+S`), Export PDF / DOCX, Import Markdown, Link Zotero Library, Open Sources Folder, Add Citation Manually
- **Edit** — Undo / Redo / Cut / Copy / Paste / Select All, Find & Replace (`Cmd+F`), **Find in Project…** (`Cmd+Shift+F`), **Add Comment** (`Cmd+Alt+M`), **Insert Reference…** (`Cmd+Alt+L`), Undo AI Edit
- **View** — Toggle Sidebar (`Cmd+B`), Toggle Preview (`Cmd+Shift+P`), Toggle Terminal (`` Cmd+` ``), Focus Mode, Typewriter Mode, **Reading Mode** (`Cmd+Alt+R`), plus Standard-Window-/Zoom-Rollen
- **Document** — Document Settings (Sprache + Zitierstil; das volle Design lebt im Design-Sidebar-Tab), Merge Document, Split into Chapters, Open as Typst Source, Ensure Bibliography
- **Help** — User Guide, Keyboard Shortcuts (`Cmd+/`), Report Issue, **Open Crash Reports** (oeffnet `<userData>/crash-reports/` im Finder); About auf Windows / Linux

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
| `/Footnote` | Fussnote — Popup oeffnet sich automatisch zur Eingabe |
| `/Citation` | `@` als Trigger fuer den Citation-Picker |
| `/Reference` | Cross-Reference-Picker — waehle ein `<label>` zum Einfuegen als `@label` |
| `/Table` | Tabelle einfuegen (mit Header) |

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

### Inline Source Preview

Hover ueber ein `@citekey`-Badge fuer ~ 350 ms und ein kleines Popover erscheint mit:
- Autor, Titel und Jahr aus dem `.bib`-Eintrag
- **PDF oeffnen**-Button, wenn eine passende Quelle in `sources/` liegt

Konvention: Quell-PDFs in den `sources/`-Ordner legen und so benennen, dass der **Dateiname mit dem Citekey beginnt** — `chen2021codex.pdf`, `chen2021codex_supplement.pdf`, `chen2021codex-arxiv.pdf` matchen alle. Klick auf **PDF oeffnen** und die Quelle erscheint als regulaerer Tab im integrierten PDF-Viewer (Text markierbar + kopierbar).

Die Karte bleibt 250 ms nach Verlassen des Badges sichtbar — du kannst die Maus also auf die Karte fuehren, ohne dass sie verschwindet.

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
| **Magazine** | Editorial-Magazin mit Cover, Editorial, Inhaltsverzeichnis und Article-Slots. Cover-Makro stabil in `chapters/_cover-macro.typ`; Macro-Call in `chapters/00-cover.typ` wird vom `cover-designer`-Skill des [ai-magazine-designer](https://github.com/renejes/ai-magazine-designer) pro Ausgabe umgeschrieben |

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

Die Sidebar hat sechs Tabs:

### Files
- Rekursiver Dateibaum, Back-Button, **Neuer Ordner** (Inline-Eingabefeld — Enter speichert, Esc bricht ab), **Asset hinzufuegen** (Datei-Auswahl, kopiert nach `assets/`)
- Leere Ordner wie `assets/` und `sources/` bleiben sichtbar, damit du immer weisst, wo Sachen hingehoeren
- `.claude/` Ordner sichtbar fuer Skills; `.git/` und `.vswrite/` sind ausgeblendet
- Bilder aus `assets/` sind per Drag & Drop in den Editor ziehbar
- Rechtsklick -> "Open in New Tab"

### Outline
- Live Heading-Hierarchie (H1 -> H2 -> H3), Klick navigiert zum Heading
- **Per Drag umsortieren:** zieh eine Heading-Zeile nach oben oder unten — die ganze Sektion (Heading + alles bis zum naechsten gleich- oder hoeherrangigen Heading) wandert mit. Eine blaue 2-px-Linie zeigt das Drop-Ziel. Funktioniert nur innerhalb einer Datei; kapitelweises Umsortieren laeuft weiterhin ueber den **Chapters**-Tab.
- **Backlinks finden:** Hovern ueber ein Heading laesst rechts einen kleinen Pfeil **↪** erscheinen — Klick darauf zeigt jede Stelle im Projekt, wo das Heading erwaehnt wird (siehe [Backlinks](#backlinks--wo-wird-das-sonst-noch-erwaehnt))

### Chapters (Include-Manager)
- `#include` Statements, Pfeile zum Umsortieren (sofortiges UI-Update), x zum Entfernen, + Add Chapter
- **Section-Style-Dropdown** pro Kapitel — weist eine Magazin-"Rubrik" zu (Feature / Interview / Essay / …), die nur dieses Kapitel restyled. Auswahl injiziert ein scoped `#show` oben in die Kapitel-Datei; "Default" entfernt es. Varianten anlegen / tunen im **Design**-Tab unter *Section Styles* (siehe [Design-Panel](#design-panel--visueller-style-editor))

### Project
Dieser Tab ersetzt das alte Git-Panel und nutzt Schreiber-Vokabular statt roher Git-Befehle. Vollstaendiger Workflow: siehe Abschnitt **[Versionen & Auto-Backup](#versionen--auto-backup)** weiter unten. Kurzfassung:
- **Version speichern** — benennt deinen aktuellen Stand und legt ihn im Verlauf des Projekts ab
- **Aenderungen seit letzter Version** — Checkboxen, welche Dateien in die naechste Version kommen
- **Verlauf** (immer sichtbar) — alle gespeicherten Versionen, Klick zeigt Diff + „Wiederherstellen"
- **Auto-Backup-Status** — kleine Fusszeile, die zeigt, wann das letzte automatische Backup gemacht wurde
- **Erweitert** (zugeklappt) — optional: Cloud-Sync (Push/Pull zu GitHub oder einem beliebigen Git-Remote)

### Comments
- Liste aller Kommentare zur **aktuellen Datei** oder **dem ganzen Projekt** (Tab oben im Panel)
- Pro Eintrag: Anker-Vorschau (kursiv, klickbar — springt im Editor zur Stelle), Body-Textarea (Auto-Save nach kurzer Tippe-Pause), „erledigt"-Haken, Loeschen
- Erledigte Kommentare sind ausgeblendet — Checkbox „Erledigte zeigen" macht sie wieder sichtbar
- Vollstaendiger Workflow: siehe Abschnitt **[Kommentare & Notizen](#kommentare--notizen)** weiter unten

### Design
- Der visuelle Style-Editor — Farben, Fonts, Skalierung, Layout, Headings, Special-Elements
- Ein-Klick **Theme-Presets** (sechs vollwertige Looks) und **Palette-Presets** (acht kuratierte Farbsets)
- **Layout-Presets** fuer Papier / Orientierung / Spaltenzahl
- **Font-Browser** mit Live-Previews der sieben gebuendelten OFL-Fonts
- **Custom Typst-Code**-Section als Escape-Hatch
- Voller Workflow im Abschnitt [Design-Panel](#design-panel--visueller-style-editor)

---

## Suche im Projekt

Fuer **Suche und Ersetzen ueber alle Kapitel hinweg** gibt es eine separate Suche, getrennt von der einzeldatei-Suche (`Cmd+F`).

**Oeffnen:** `Cmd+Shift+F` oder Menue **Edit -> Find in Project…**

**Funktionen:**
- Live-Suche, debounced ~ 200 ms
- Vier Optionen, alle als Toggle-Buttons:
  - **Aa** — Gross-/Kleinschreibung beachten
  - **W** — Nur ganze Woerter
  - **.*** — Regulaerer Ausdruck
  - **.bib** — `.bib`-Dateien einschliessen (sonst nur `.typ`)
- Treffer gruppiert nach Datei, jede Datei mit Treffer-Anzahl, auf-/zuklappbar
- **Klick auf einen Treffer** oeffnet die Datei und scrollt im Editor zur Stelle, das Match wird kurz hervorgehoben
- **Ersetzen** (Pfeil-Toggle links neben der Suche): zweites Eingabefeld erscheint, „Alle ersetzen"-Knopf bittet vorher um Bestaetigung („X Treffer in Y Datei(en) ersetzen?")
- Maximal 1000 Treffer total — bei mehr wird die Liste mit Hinweis abgeschnitten

**Tipps:**
- Vor einem grossen Replace empfiehlt sich, zuerst ueber das Project-Panel **eine Version zu speichern** — dann kannst du jederzeit zurueck.
- In der laufenden Datei greift weiterhin `Cmd+F` mit der gewohnten Suche (visuelles Highlight im aktuellen Tab).

---

## Fussnoten

Typst rendert Fussnoten nativ — gross-Buchstabe als hochgestellte Zahl im Fliesstext, Fussnotenkoerper unten auf derselben Seite.

**Einfuegen:**
- **Toolbar:** Klick auf **Fn** in der Editor-Toolbar
- **Slash-Command:** `/Footnote`

In beiden Faellen wird eine leere Fussnote an der Cursor-Position eingefuegt und der **Inline-Popup-Editor oeffnet sich automatisch** zum Eingeben.

**Bearbeiten:** Klick auf eine bestehende Fussnote im Editor oeffnet den Popup mit dem Body zum Editieren. Der Body wird **live** gespeichert (jeder Tastendruck), Esc oder `Cmd+Enter` schliesst den Popup.

**In der Source:** `#footnote[Dein Text]` — wird vom Typst-Compiler nummeriert und positioniert.

**Im Editor:** kleine hochgestellte Markierung mit Preview-Text (erste ~30 Zeichen). Echte Nummer + Position-am-Seitenende erscheinen erst in der PDF-Preview rechts (400 ms Compile-Debounce).

---

## Cross-References

In Typst kannst du Figuren, Tabellen, Gleichungen oder Headings mit einem `<label>` markieren und von ueberall im Projekt mit `@label` darauf verweisen. Typst nummeriert beim Compilen automatisch — wenn du Kapitel umstellst oder eine Figur einfuegst, aktualisieren sich alle Verweise ohne Zutun.

vswrite gibt dir einen Picker, der jedes `<label>` im Projekt auflistet, damit du dir keine Namen merken musst.

### Label setzen

Schreib das Label direkt nach dem Element, auf das du verweisen willst:

```typst
#figure(
  image("plot.png"),
  caption: [Parameter-Skalierung],
) <fig:scaling>

= Method <sec:method>

$ "Attention"(Q, K, V) = "softmax"(frac(Q K^T, sqrt(d_k))) V $ <eq:attention>
```

Konventionell bekommen Labels ein Praefix nach Art des Verweises — `fig:`, `tbl:`, `eq:`, `sec:`, `chap:` etc. Der Picker gruppiert seine Treffer ueber diese Praefixe, und der Editor unterscheidet damit Reference von Citation (siehe unten).

> **Equation-Refs** brauchen aktivierte Nummerierung. Setze in deiner `main.typ` Preamble `#set math.equation(numbering: "(1)")` — sonst weist Typst jeden `@eq:…`-Verweis beim Compile zurueck.

### Reference einfuegen

Drei Wege, den Picker zu oeffnen:

- **Slash-Command:** `/Reference`
- **Menue:** `Edit -> Insert Reference…`
- **Shortcut:** `Cmd+Alt+L`

Der Picker zeigt jedes Label im Projekt, gruppiert nach Typ (Abbildungen / Tabellen / Gleichungen / Ueberschriften / Andere) mit Caption-Vorschau und Quellort (`chapters/04-results.typ:24`). Das Suchfeld filtert ueber Label, Caption und Pfad. ↑↓ navigiert, Enter fuegt ein, Esc bricht ab.

Im Editor erscheint die eingefuegte Node als **orangene `↳ label`-Pille** — visuell klar unterschieden vom blauen `@citekey`-Citation-Badge. In der Source serialisiert sie zur normalen Typst-Syntax `@label`.

### Citation vs. Reference — Disambiguierung

Typst nutzt fuer Citations (`@chen2021codex`) und Cross-References (`@fig:scaling`) dieselbe `@…`-Syntax. vswrite unterscheidet sie ueber den Namen:

- Enthaelt einen Doppelpunkt (`:`) — Reference
- Beginnt mit einem bekannten Praefix (`fig`, `tbl`, `eq`, `sec`, `chap`, `app`, `thm`, `lem`, `def`, `cor`, `prop`, `algo`, `lst` und ihre Vollformen) — Reference
- Sonst — Citation

Deshalb ist das `@`-Autocomplete reserviert fuer Citations (Citekeys sind konventionell schlichte Slugs). Fuer Refs nutzt du den Picker.

---

## Kommentare & Notizen

Kommentare sind **gelbe Anmerkungen am Text**, die nur im vswrite-Editor sichtbar sind und **nicht** ins PDF/DOCX kompilieren. Geeignet fuer Selbstnotizen („hier noch Quelle ergaenzen") oder Betreuer-Feedback.

**Speicherung:** Jeder Kommentar ist eine **eigene Markdown-Datei** im sichtbaren Ordner `comments/` im Projekt-Wurzelverzeichnis. Frontmatter (YAML) speichert Anker-Text, Datei, Autor, Datum, Status. Body ist freier Markdown — Listen, Links, Code-Snippets, alles erlaubt.

```
mein-projekt/
├── main.typ
├── chapters/
├── comments/                              ← sichtbar
│   ├── 2026-04-28-1432-a3f.md
│   └── 2026-04-29-0901-b1e.md
└── ...
```

Vorteil: Cloud-Sync (Dropbox / iCloud) nimmt Kommentare automatisch mit, dein Betreuer kann sie in jedem beliebigen Editor oeffnen, sie sind Git-diffbar, du kannst sie auch von ausserhalb der App bearbeiten.

**Erstellen:**
1. Text im Editor markieren (oder Cursor in ein Wort setzen)
2. **Toolbar-Button „Cm"** klicken oder Menue **Edit -> Add Comment** (`Cmd+Alt+M`)
3. Sidebar wechselt automatisch in den **Comments-Tab**, der neue Eintrag ist fokussiert, du kannst direkt lostippen
4. Tippen wird mit ~ 400 ms Verzoegerung in die `.md` geschrieben

**Visuell:** Der kommentierte Text bekommt einen **gelb-orangenen Hintergrund** mit unterer Linie. Klick auf das Highlight scrollt im Comments-Panel zum passenden Eintrag.

**Filter im Panel:**
- **Aktuelle Datei** vs **Ganzes Projekt** (Tabs oben im Panel)
- **Erledigte zeigen** (Checkbox) — erledigte Kommentare sind sonst ausgeblendet

**Aktionen pro Kommentar:**
- **Anker-Klick** (kursiver Text in Anfuehrungszeichen) springt im Editor zur Stelle, das Highlight blinkt kurz
- **✓ Erledigt** versteckt den Kommentar aus der Liste (umkehrbar mit ↺)
- **× Loeschen** entfernt die `.md`-Datei nach Bestaetigung

**Reanchoring:** Wenn du Text vor einem kommentierten Abschnitt einfuegst, verschiebt sich der Anker. vswrite findet ihn beim Datei-OEffnen ueber den gespeicherten Anker-Text wieder. Wenn der Anker-Text geloescht oder so stark geaendert wurde, dass er nicht mehr findbar ist, wird der Kommentar **orphaned** markiert (rotes Warndreieck) — du kannst ihn dann manuell neu zuordnen oder loeschen.

**Bekannte MVP-Limitierungen:**
- Anker-Text muss innerhalb eines Absatzes / einer Ueberschrift liegen — Kommentare, die ueber Absatz-Grenzen hinweg ankern, werden als orphaned markiert.
- Mehrere Kommentare mit **identischem** Anker-Text in derselben Datei zeigen alle dasselbe (erste) Highlight.

---

## Reading Mode

Zum Korrekturlesen schaltet vswrite den Editor auf **Buchsatz-Typografie** um — Serife, grosszuegiger Zeilenabstand, Justified Text, schmaler Spaltenbereich. Im Gegensatz zur PDF-Preview bleibt das Editing aktiv: Tippfehler kannst du direkt in dieser Ansicht korrigieren.

**Aktivieren:**
- Toolbar-Button **𝓡** (zwischen Typewriter und Focus)
- Menue **View → Reading Mode**
- Shortcut `Cmd+Alt+R`

**Was passiert:**
- Schriftart wechselt auf Iowan Old Style / Palatino / Georgia (je nach Verfuegbarkeit)
- Schriftgrosse 17 px, Zeilenhoehe 1.75, max. 640 px Spaltenbreite
- Absaetze sind im Blocksatz mit Auto-Trennung
- Hintergrund leicht waermer (`#fdfcf8`) — angenehmer fuer laengeres Lesen
- Headings bekommen klassische Buchsatz-Stile (H3 italic + 600er Gewicht etc.)
- **Code-, Math- und Raw-Typst-Bloecke bleiben Monospace** — Code muss strukturell lesbar bleiben

Sidebar und Preview bleiben so, wie du sie hattest. Wer voll ungestoert lesen will, kombiniert Reading Mode mit Focus Mode (`◎`-Toolbar-Button).

---

## Backlinks — „Wo wird das sonst noch erwaehnt?"

Bei wissenschaftlichem Schreiben ist der Konsistenz-Check wichtig: jede Erwaehnung eines Konzepts oder einer Quelle ueber alle Kapitel hinweg finden. vswrite hat dafuer zwei eingebaute Trigger, die im Hintergrund [Suche im Projekt](#suche-im-projekt) mit der richtigen Query starten.

**Heading-Backlinks:**
- Im **Outline**-Sidebar-Tab: hovern ueber ein Heading laesst rechts einen kleinen Pfeil **↪** erscheinen
- Klick darauf oeffnet die Project-Search mit dem **Heading-Titel** als Query
- Zeigt jede Stelle im Projekt, wo dieser Begriff (oder ein Cross-Reference auf das Heading) auftaucht

**Citation-Backlinks:**
- **Right-Click** (Cmd+Klick auf macOS) auf eine Citation-Badge im Editor (`@chen2021codex` etc.)
- Oeffnet die Project-Search mit `@<citekey>` als Whole-Word-Query
- Listet alle Kapitel auf, in denen die Quelle zitiert wird

In beiden Faellen ist die Suche eine ganz normale [Find-in-Project](#suche-im-projekt) — du kannst die Optionen (Aa / W / .* / .bib) nachjustieren oder gleich „Alle ersetzen" durchziehen, falls du z. B. einen Citekey umbenennen willst.

---

## Live-Preview

- **Root-Datei Kompilierung:** Bei Chapters wird automatisch main.typ kompiliert
- **PDF-Rendering** ueber pdf.js — viewport-virtualisiert, also bleibt die Vorschau auch bei 100+ Seiten fluessig
- **Text markieren & kopieren** in der Vorschau dank pdf.js' TextLayer
- **Fehleranzeige:** Typst-Fehler werden im Preview Panel ausgegeben
- **Live-Update** waehrend du tippst, mit 400 ms Compile-Debounce

---

## Zoom (Editor + Vorschau)

Editor- und PDF-Vorschau lassen sich unabhaengig voneinander zoomen, 50 % bis 200 % in 10er-Schritten:

- **Editor-Zoom:** unten rechts in der Status-Leiste steht das aktuelle `100 %` als Button. Klick darauf oeffnet einen kleinen Slider mit `−` / `+` und Reset. Per Tastatur: `Cmd+Alt+=` (rein), `Cmd+Alt+-` (raus), `Cmd+Alt+0` (zurueck auf 100 %).
- **PDF-Vorschau-Zoom:** oben im Preview-Panel ist eine schmale Leiste mit `− 100 % +`. Klick auf das Prozent setzt zurueck. Per Tastatur: `Cmd+Shift+=` (rein), `Cmd+Shift+-` (raus), `Cmd+Shift+0` (zurueck). Der PDF-Zoom gilt sowohl fuer die Live-Vorschau rechts als auch fuer geoeffnete Source-PDFs (z. B. via Citation-Hover „PDF oeffnen").
- **Scrollbars** sind immer sichtbar — bei Zoom > 100 % wird die Seite breiter als das Panel und du kannst horizontal scrollen.
- **Pro Projekt gespeichert:** Beim naechsten Oeffnen desselben Projekts sind deine Zoom-Levels wieder da. Die Werte liegen in `<projekt>/.vswrite/preferences.json` und reisen mit, wenn du den Ordner kopierst.
- **Browser-Zoom** (`Cmd+=` / `Cmd+-` / `Cmd+0`) zoomt das ganze Fenster und bleibt im View-Menue unter „Zoom Window In/Out" verfuegbar — selten noetig, aber unveraendert.

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

Das DOCX wird mit echten Word-Styles erzeugt und deckt jetzt die reichen akademischen Konstrukte ab, nicht nur Fliesstext:
- **Multi-Chapter-faehig:** alle `#include`-Kapitel werden in den Output gemerged (das alte „nur die offene Datei"-Verhalten ist weg)
- Ueberschriften, Bibliographie, Code-Bloecke und Zitate nutzen benannte Word-Styles — im Style-Panel einheitlich anpassbar
- Seitengroesse, Raender, Schriftart, Schriftgroesse, Zeilenabstand werden aus deinen Typst `#set`-/Design-Settings uebernommen (z. B. A4 + Libertinus 11 pt); ein zentrierter **Seitenzahl-Footer** wird geschrieben, wenn das Design Seitennummerierung aktiviert
- **Heading-Nummerierung live:** hat deine Typst-Datei `#set heading(numbering: "1.1")`, bekommen die Ueberschriften Word-Multilevel-Numbering. Wenn dein Betreuer Kapitel in Word umstellt, aktualisieren sich die Zahlen automatisch.
- **Abbildungen** werden zu einem eingebetteten Bild plus „Abbildung N"-Caption; ein `#figure(table(…))` wird zu einer echten Word-Tabelle mit „Tabelle N"-Caption
- **Formeln** (`$ … $` Display-Math) werden ueber das gebundelte Typst zu scharfen Bildern gerendert und behalten ihre Gleichungsnummer; **SVG-Abbildungen** werden genauso rasterisiert
- **Cross-References** (`@fig:…` / `@tbl:…` / `@eq:…`) loesen zu „Abbildung 1" / „Tabelle 2" / „(3)" auf
- **Fussnoten** werden zu echten Word-Fussnoten (inkl. ihrer Inline-Auszeichnung); verschachtelte und aufeinanderfolgende nummerierte Listen behalten die korrekte Nummerierung
- Citations werden als `(Autor Jahr)` gerendert, oder als `[n]`, wenn der Bibliographie-Stil numerisch ist (IEEE, Vancouver, …); `#info` / `#tip` / `#warning` / …-Callouts werden zu einer schattierten Akzent-Box
- TOC- und Bibliographie-Ueberschriften werden passend zur Dokumentsprache lokalisiert (DE/EN/FR/ES/IT/PT/NL)
- **Was bewusst weggelassen wird:** reiner Seiten-Design-Code — Full-Bleed-Layouts, Magazin-Opener, mehrspaltige Spreads, Drop-Caps und anderes rein Visuelles — hat kein Word-Aequivalent und wird *uebersprungen* statt als Monospace-Quelltext gedumpt. Fuer design-getriebenen Output ist PDF das Liefer-Format; **DOCX ist das Manuskript-Format** (Fliesstext, Struktur, Abbildungen, Math, Tabellen, Fussnoten, Referenzen).

---

## Design-Panel — visueller Style-Editor

Jede Design-Entscheidung lebt im **Design**-Sidebar-Tab. Klick auf ein Theme uebernimmt einen kompletten Look; Klick auf ein Palette-Preset tauscht nur die Farben; Einzelfelder (Font, Padding, Heading-Groesse, Tabellen-Rahmenfarbe) sind frei justierbar. Jede Aenderung schreibt nach `<project>/.vswrite/style.json` und regeneriert `<project>/style.typ` — `main.typ` zieht die Regeln per `#import "style.typ": *` plus `#show: apply-style` rein.

### Sections im Design-Tab

| Section | Steuert |
|---------|---------|
| **Farbpalette** | Fuenf semantische Slots (primary / accent / text / background / muted) — jeder mit Coloris-Picker plus Hex-Textfeld |
| **Paletten-Presets** | Acht kuratierte 5-Farben-Paletten (Modern Tech, Editorial, Earth Tones, High Contrast, Minimal Mono, Forest Deep, Sunset Warm, Ocean Classic). Apply tauscht nur Farben |
| **Themes** | Sechs vollstaendige ProjectStyle-Snapshots (Classic Academic, Modern Tech, Editorial Magazine, Minimal, Marketing Brochure, Thesis). Apply ueberschreibt alles ausser dem Custom-Code-Block |
| **Layout-Presets** | Sieben Geometrie-Wechsel (A4 Portrait, A4 Landscape, Magazine 2-Spalten, Newsletter 3-Spalten, A5 Booklet, A2 Poster, Magazine Editorial mit Header-Strip) — Paper, Orientation, Margin, Columns, optional Base-Size |
| **Fonts** | Drei Font-Slots (body / heading / code) plus Font-Browser. Jede Karte rendert die Familie + Beispielsatz live in den sieben gebuendelten OFL-Fonts |
| **Scale** | Base-Size, Leading, Paragraph-Spacing, First-Line-Indent |
| **Layout** | Paper, Orientation, Margin, Columns, Page-Numbering, Header-Markup, Footer-Markup, Page-Fill (Background-Color-Expression). Header/Footer akzeptieren die Platzhalter `{chapter}` (aktueller H1-Titel) und `{section}` (aktueller H2-Titel) — z.B. `{chapter} · ISSUE 1` ergibt eine pro-Kapitel mitwandernde Running-Head. |
| **Headings** | H1–H6 als collapsible Cards — Size, Weight, Color-Slot, Top-Margin pro Level; plus ein einziges Numbering-Pattern |
| **Elements** | Blockquote, Code-Block, Figure (inkl. Photographer-Credit-Separator + Label fuer `figure-caption-credit(caption, credit)` Helper), Table — jede als collapsible Card mit strukturierten Feldern (Border-Slot / Padding / Italic-Toggle / Caption-Position / Zebra-Rows / etc.) |
| **Section Styles** | Per-Chapter "Rubriken" fuer Magazin-Layouts — benannte Overlays (Accent / Fonts / Spalten / Heading-Treatment), die du im **Chapters**-Tab einem einzelnen Kapitel zuweist. Fuenf Built-in-Presets (Feature / Interview / Essay / Photo-Essay / Department); collapsible Liste mit Accent-Swatch, Spaltenzahl und Loeschen. Page-Geometrie + Running-Heads bleiben dokument-level |
| **Custom Typst-Code** | Escape-Hatch: freier Typst-Code im CodeMirror-Editor. Wird ans Ende von `style.typ` in einen fenced Block angehaengt, der jede Regeneration ueberlebt |

### Themes vs. Palette-Presets vs. Layout-Presets

- **Palette-Preset** — nur die fuenf Farb-Slots aendern sich. Nimm das wenn Typografie und Layout passen, aber die Farben nicht.
- **Theme** — Farben + Fonts + Scale + Layout + Headings + Elements aendern sich alle in einem Klick. Dein Custom-Code-Block bleibt erhalten.
- **Layout-Preset** — nur Paper / Orientation / Margin / Columns / Base-Size aendern sich. Stapelbar auf ein Theme um Typografie zu behalten und Geometrie zu swappen (z.B. *Editorial Magazine* Theme + *Magazine 2-Spalten* Layout).

### Power-User-Escape-Hatch

Die Custom-Typst-Code-Section unten im Design-Panel akzeptiert beliebigen Typst — `#import` von gebuendelten Paketen, custom `#show heading.where(level: 1): it => { … }` Regeln mit Linien-Dekoration, Helper `#let` Bindings etc. Der Block ist fenced (Marker-Kommentare am Anfang und Ende), sodass der Auto-Generator ihn nie ueberschreibt. Bei jedem Save eines Themes, einer Palette oder eines Feldes wird der Custom-Block woertlich zurueckgelesen und am Ende der regenerierten `style.typ` neu emittiert.

### Design-Elemente (Library)

Eine **22 Elemente** umfassende Library parametrischer Snippets — Banner, Sidebar, Pull-Quote (drei Varianten: regular / Display / Block), Callout, Hero, Section-Divider (drei Varianten: regular / Asterisks / Ornament), Drop-Cap, Article-Opener, Section-Opener, Image-Gallery 2-up / 3-up / asymmetric (1 gross + 2 klein), Image-Overlay (Foto mit Gradient + Headline drueber), Stats-Box ("By the numbers"-Sidebar), Photo-Caption-Wrap (kleines Foto mit Caption drumherum via wrap-it), Magazine-Cover, Full-Bleed-Image (randlose Ganzseite), Spread-Opener (full-bleed Opener mit Headline ueber Gradient), Margin-Note (Marginalia im Aussenrand via drafting). Sie werden ueber die MCP-Tools `vswrite_list_design_elements` / `vswrite_insert_design_element` von Claude Desktop aus eingefuegt; jede Referenz auf `style-colors.*` / `style-fonts.*` bedeutet das Element re-themed sich automatisch wenn du Palette oder Fonts wechselst. Der `magazine-cover` setzt `#page(margin: 0pt)` fuer die Coverseite — der Rest des Dokuments behaelt seine konfigurierten Raender. `style.typ` exportiert dafuer drei Modul-level Werte: `style-colors`, `style-fonts` und `figure-caption-credit(caption, credit)` (fuer Foto-Quellen-Captions).

### Gebuendelte OFL-Fonts (offline-tauglich)

Sieben Font-Familien sind mit vswrite ausgeliefert — keine System-Installation noetig, kein Internet beim Compile:

| Familie | Kategorie | Geeignet fuer |
|---------|-----------|---------------|
| Inter | Sans | Modern / Tech / Minimal-Dokumente |
| IBM Plex Sans | Sans | Brochures, Reports, Branded Docs |
| IBM Plex Serif | Serif | Moderner editorialer Body |
| IBM Plex Mono | Mono | Code-Bloecke |
| JetBrains Mono | Mono | Code-lastige Dokumente |
| Crimson Pro | Serif | Akademischer Body, Theses |
| Spectral | Serif | Magazine, Newsletter |

### Style-Templates-Menue (Legacy)

Das alte **Document → Style Templates** Submenu (Classic / Modern / Minimal / Vibrant / Elegant / Professional / Artsy) wurde in Session 22 ersetzt durch die Themes-Section im Design-Tab. Die MCP-Tools `vswrite_list_styles` und `vswrite_apply_style` funktionieren weiterhin — sie zeigen jetzt auf die neuen Theme-Presets.

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

Die KI kann ueber den MCP-Server (56 Tools):
- Typst-Dokumente oeffnen, lesen, bearbeiten und verifizieren (`compile` ist reiner Verifier; das Schreiben von Artefakten uebernehmen die Export-Tools)
- Dokument-Einstellungen aendern (Schriftart, Groesse, Sprache, Raender …) und Style-Templates anwenden
- Kapitel und Bibliographie End-to-End verwalten (inkl. anker-basierter Inserts fuer Comments, Footnotes, Cross-References)
- Projektweite Suche und Bulk-Replace mit Versions-Sicherheitsnetz (Whole-Word funktioniert dank Lookarounds auch bei `@citekey`-Backlinks)
- Quell-PDFs in `sources/` per Citekey nachschlagen
- Versionen speichern / auflisten / anzeigen / wiederherstellen — im selben Vokabular wie das Project-Panel
- PDF und DOCX exportieren (DOCX mit echten Word-Styles + Live-Multilevel-Numbering, rendert Abbildungen, Display-Math, Tabellen, Cross-References, Fussnoten und Callouts; reiner Design-Code wird uebersprungen)
- Markdown importieren und Bilder einfuegen (Content-Hash-Dedup + Figure-Builder)
- Die gesamte Design-Surface fernsteuern — Themes / Palettes / Layouts / Fonts wechseln, Design-Elemente (19 Stueck inkl. Drop-Cap, Pull-Quote-Varianten, Article-Opener, Section-Opener, Image-Galleries inkl. asymmetric, Image-Overlay, Stats-Box, Photo-Caption-Wrap, Magazine-Cover) anker-basiert einfuegen, per-Chapter Section Styles (Magazin-Rubriken: feature / interview / essay / …) zuweisen, NL-Intents (`brochure` / `magazine` / `thesis` / …) auf passende Theme+Layout-Kombis mappen
- Zwischen Projekten wechseln, Git-Operationen ausfuehren, Skill-Prompts abfragen (typst-reference / vswrite-conventions / research-workflow / writing-style / design-conventions)

### Einrichtung: Auto-Setup-Wizard (macOS)

Beim ersten Start auf macOS bietet vswrite automatisch an, Claude Desktop zu verbinden — du musst keine JSON-Datei selbst editieren. Voraussetzungen:

- **Pro-Lizenz aktiviert** (siehe [Lizenz-Management](#lizenz-management)) — der MCP-Server lehnt sonst beim Start ab
- **Claude Desktop installiert** unter `/Applications/Claude.app` oder `~/Applications/Claude.app`

**Ablauf:**

1. Wizard erscheint nach ein paar Sekunden automatisch (oder ueber `Hilfe → "Mit Claude Desktop verbinden…"`)
2. Klick auf **„Jetzt verbinden"**
3. Im Hintergrund:
   - Das Server-Binary wird aus dem .app-Bundle nach `~/Library/Application Support/vswrite/mcp-server/vswrite-mcp` kopiert
   - `~/Library/Application Support/Claude/claude_desktop_config.json` bekommt einen `vswrite`-Eintrag — andere bestehende MCP-Server bleiben unangetastet, ein Backup deiner alten Config wird angelegt
   - Dein Pro-Lizenzschluessel wird als Umgebungsvariable (`VSWRITE_LICENSE_KEY`) in den Eintrag geschrieben
4. **Claude Desktop neu starten** — die vswrite-Tools erscheinen automatisch

**Standalone:** der MCP-Server laeuft als eigener Prozess, **unabhaengig von der vswrite-App**. Du kannst vswrite beenden, Claude weiterhin nutzen, vswrite spaeter wieder oeffnen — die Reihenfolge ist egal.

**Idempotenz:** wiederholtes Ausfuehren ist sicher — kein Duplikat-Eintrag. Falls du spaeter eine neue Lizenz aktivierst, fuehre den Wizard ueber das Hilfe-Menue nochmal aus, damit der neue Key in die Config geschrieben wird.

### Einrichtung: Manuell (Windows, Linux, oder Power-User)

Auf Windows / Linux ist der Wizard derzeit nicht verfuegbar. Auch auf macOS kannst du manuell konfigurieren wenn du moechtest:

**Schritt 1:** Im vswrite-Repo das Server-Binary bauen (einmalig):

```bash
npm run build:mcp-binary       # nur Host-Arch
# oder
npm run build:mcp-binary:all   # arm64 + x86_64
```

Output: `dist/mcp/bin/vswrite-mcp-<arch>` (~64 MB Single-File-Binary, kein Node noetig).

Alternativ kannst du den klassischen Node-Pfad nehmen (erfordert Node ≥ 20 auf der Maschine):

```bash
npm run build:mcp   # → dist/mcp/server.mjs
```

**Schritt 2:** Konfigurationsdatei oeffnen:

- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

**Schritt 3:** vswrite als MCP-Server eintragen. Mit Standalone-Binary (empfohlen):

```json
{
  "mcpServers": {
    "vswrite": {
      "command": "/PFAD/ZU/vswrite-desktop/dist/mcp/bin/vswrite-mcp",
      "env": { "VSWRITE_LICENSE_KEY": "VSWRITE_PRO_xxxx..." }
    }
  }
}
```

Oder via Node + `.mjs`:

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

### Verfuegbare Tools (56)

Volle Referenz mit Parameter-Schemata, Return-Shapes und End-to-End-Workflow-Beispielen liegt in [mcp-server.md](mcp-server.md). Hier alle 56 Tools mit Ein-Satz-Beschreibung, gruppiert nach Kategorie:

**Projekt & Dateien (5)**

- `vswrite_set_project` — Setzt das aktive Projekt-Verzeichnis; auto-detected `main.typ` / `document.typ`. Muss als Erstes aufgerufen werden.
- `vswrite_list_files` — Liefert den Projekt-Dateibaum (`.typ`, `.bib`, `.md`, `.yaml`, `.json`, `.pdf`, Bilder).
- `vswrite_read_file` — Liest eine Datei im Projekt; Text-Inhalt als String, Binaer-Dateien als Base64.
- `vswrite_write_file` — Schreibt Inhalt in eine Datei im Projekt; erzeugt Parent-Ordner automatisch.
- `vswrite_create_project` — Legt ein neues Typst-Projekt aus einer Vorlage an (`document`, `thesis`, `paper`, `letter`, `book`, `magazine`). Die `magazine`-Vorlage ist fuer die [ai-magazine-designer](https://github.com/renejes/ai-magazine-designer)-Pipeline.

**Dokument-Operationen (4)**

- `vswrite_get_document` — Liefert das aktuelle Dokument (Inhalt, Pfad, Projekt-Verzeichnis, Word-Count).
- `vswrite_open_file` — OEffnet eine `.typ`-Datei als aktuelles Dokument; Pfad absolut oder projekt-relativ.
- `vswrite_update_document` — Ersetzt den Inhalt des aktuellen Dokuments und speichert auf Disk.
- `vswrite_compile` — Verifiziert dass das Dokument fehlerfrei kompiliert; nur PDF, Artefakt wird wieder geloescht — fuer Real-Output `export_pdf` / `export_docx` benutzen.

**Settings (2)**

- `vswrite_get_settings` — Liest die Document-Settings (Sprache + Bibliographie-Stil; alles andere lebt seit Phase A im Design-Editor).
- `vswrite_update_settings` — Aendert Document-Settings; nur uebergebene Keys werden modifiziert.

**Design (15) — Themes, Layouts, Palette, Fonts, Elements, Section Styles**

Die strukturierte Design-Surface aus dem Design-Tab. Schreibt direkt nach `.vswrite/style.json`, regeneriert `style.typ`, stellt sicher dass die Root-`.typ`-Datei `#import "style.typ": *` + `#show: apply-style` ganz oben hat. Theme-/Layout-Swaps preservieren `style.custom.preamble` (User-Escape-Hatch-Code) und `style.sections` (per-Chapter Section Styles).

- `vswrite_get_style` — Liefert das vollstaendige `ProjectStyle`-JSON (colors / fonts / scale / layout / headings / elements / custom).
- `vswrite_update_style` — Partial-Patch mit Deep-Merge und Per-Leaf-Sanitizer; ungueltige Werte fallen auf den alten zurueck.
- `vswrite_list_styles` — Listet die sechs Built-in-Themes (Classic Academic, Modern Tech, Editorial Magazine, Minimal, Marketing Brochure, Thesis).
- `vswrite_apply_style` — Wendet ein Theme an; ersetzt colors/fonts/scale/layout/headings/elements, behaelt `custom.preamble`.
- `vswrite_list_layouts` — Liefert die sieben Layout-Presets (A4 portrait/landscape, Magazine 2-col, Newsletter 3-col, A5 Booklet, A2 Poster, Magazine Editorial).
- `vswrite_apply_layout` — Tauscht nur `layout.*` (+ optional `scale.base`) — Theme, Farben, Fonts bleiben.
- `vswrite_list_fonts` — Liefert die sieben gebuendelten OFL-Fonts mit family / category / description.
- `vswrite_apply_palette` — Setzt die 5-Farb-Palette via `presetId` oder per-Slot-Hex-Overrides (kombinierbar).
- `vswrite_list_design_elements` — Library der **22** parametrischen Snippets inkl. Param-Beschreibung — Banner, Sidebar, Pull-Quote (regular / Display / Block), Callout, Hero, Divider (regular / Asterisks / Ornament), Drop-Cap, Article-Opener, Section-Opener, Gallery 2-up / 3-up / asymmetric, Image-Overlay, Stats-Box, Photo-Caption-Wrap, Magazine-Cover, Full-Bleed-Image, Spread-Opener, Margin-Note.
- `vswrite_insert_design_element` — Fuegt ein Element an einem Anker ein; Snippets referenzieren `style-colors.*` / `style-fonts.*` und re-themen automatisch.
- `vswrite_generate_layout` — Hoch-Level-NL-Komposit: `intent: "magazine"` waehlt z.B. Editorial-Theme + Magazine-Editorial-Layout + optionalen Hero.
- `vswrite_list_section_styles` — Per-Chapter-"Rubriken": die fuenf Presets (feature / interview / essay / photo-essay / department), die definierten Varianten + welche Kapitel welche nutzen.
- `vswrite_define_section_style` — Section-Overlay anlegen/aendern (aus Preset und/oder explizite accent / fonts / columns / heading-Overrides); regeneriert ein `#let <id>-style` pro Variante.
- `vswrite_apply_section_style` — Variante einem Kapitel zuweisen (injiziert das scoped `#show`; auto-definiert Preset falls noetig). Restyled nur dieses Kapitel; Page-Geometrie bleibt dokument-level.
- `vswrite_clear_section_style` — Section-Opt-in aus einem Kapitel entfernen.

**Kapitel & Struktur (6)**

- `vswrite_get_chapters` — Liefert die `#include`-Struktur (Reihenfolge, Pfade, ob Dateien existieren).
- `vswrite_reorder_chapters` — Aendert die Reihenfolge der `#include`-Statements im Hauptdokument.
- `vswrite_add_chapter` — Legt eine neue Kapitel-Datei in `chapters/` an und fuegt einen `#include` ein.
- `vswrite_remove_chapter` — Entfernt einen `#include`-Eintrag aus dem Hauptdokument; die Datei selbst bleibt.
- `vswrite_merge_document` — Loest alle `#include`-Statements rekursiv auf und liefert das fertige Gesamtdokument als String (read-only).
- `vswrite_split_document` — Splittet das aktuelle Dokument an `=` Heading-1-Grenzen in einzelne Kapitel-Dateien.

**Bibliographie & Citations (3)**

- `vswrite_get_citations` — Liefert alle BibTeX-Eintraege aus den `.bib`-Dateien im Projekt.
- `vswrite_add_citation` — Fuegt einen BibTeX-Eintrag zu `references.bib` hinzu; legt Datei und `#bibliography`-Statement bei Bedarf an.
- `vswrite_ensure_bibliography` — Stellt sicher dass das Projekt eine `references.bib` und einen `#bibliography`-Eintrag hat.

**Cross-References & Footnotes (3)**

- `vswrite_list_labels` — Liefert alle `<label>`-Definitionen im Projekt mit Typ-Klassifikation (figure / table / equation / heading / other) und Caption-Vorschau.
- `vswrite_insert_reference` — Fuegt eine Typst-Cross-Reference (`@label`) an einem Anker ein; validiert dass das Label existiert und schlaegt aehnliche vor.
- `vswrite_add_footnote` — Fuegt eine Typst-Footnote (`#footnote[…]`) an einem Anker ein; mit Klammer-Balance-Check fuer den Body.

**Comments & Annotations (4)**

- `vswrite_list_comments` — Listet alle vswrite-Comments (oder nur die einer Datei); Comments leben als `.md`-Dateien in `comments/` und werden nie kompiliert.
- `vswrite_add_comment` — Legt einen Comment an einem Verbatim-Anker an; generiert ID, Frontmatter und Offset-Hints.
- `vswrite_resolve_comment` — Markiert einen Comment als „erledigt" (oder hebt das wieder auf); Eintrag bleibt im Projekt erhalten.
- `vswrite_delete_comment` — Loescht einen Comment endgueltig (entfernt die `.md`-Datei).

**Versionen (4) — entspricht dem Project-Panel-Vokabular**

- `vswrite_save_version` — Speichert eine benannte Version (Git-Commit); initialisiert das Repo falls noch keins da ist; lokal-only, kein Push.
- `vswrite_list_versions` — Liefert die Versions-Historie (max. 200, neueste zuerst) inkl. `isAuto`-Flag fuer vswrite-interne Auto-Versionen.
- `vswrite_show_version` — Zeigt den Per-File-Diff einer Version (added/modified/deleted/renamed + Unified-Diff-Hunks).
- `vswrite_restore_version` — Stellt Dateien aus einer historischen Version wieder her; vorher selbst eine Version speichern!

**Discovery — Suche & Quellen (3)**

- `vswrite_search_project` — Sucht in allen `.typ`-Dateien (optional `.bib`); whole-word funktioniert dank Lookarounds auch bei `@citekey`-Backlinks; max. 1000 Treffer.
- `vswrite_replace_in_project` — Ersetzt alle Vorkommen einer Suche projektweit; **destruktiv** — vorher `save_version` aufrufen.
- `vswrite_find_source_for_citation` — Sucht ein PDF in `sources/` das zum Citekey passt (`<citekey>.pdf` bevorzugt, Suffix-Varianten erlaubt).

**Export (2)**

- `vswrite_export_pdf` — Kompiliert und exportiert als PDF; Output-Pfad muss im Projekt liegen, Konvention `exports/<name>.pdf`.
- `vswrite_export_docx` — Exportiert als DOCX mit echten Word-Styles (Heading1-6, Quote, CodeBlock, Caption …) und Live-Multilevel-Numbering — der Betreuer kann in Word umordnen und die Nummern aktualisieren sich. Rendert auch die reichen Konstrukte: Abbildungen → Bild + „Abbildung N"-Caption, `#figure(table())` → echte Word-Tabelle, Display-Math + SVG → Bilder via gebundeltem Typst, `@fig/@tbl/@eq`-Cross-Refs → aufgeloest, Fussnoten → echte Word-Fussnoten, Callouts → Akzent-Box; reiner Design-/Layout-Code wird uebersprungen statt geleakt (DOCX = Manuskript, PDF = Design).

**Import & Assets (2)**

- `vswrite_import_markdown` — Konvertiert Markdown zu Typst und schreibt in eine Projekt-Datei; inline-Markdown oder `srcPath` zu einer `.md`-Datei.
- `vswrite_add_image` — Importiert ein Bild nach `assets/` (Content-Hash-Dedup), baut den Typst-Snippet (mit optionaler Caption + Label → `#figure(…)`) und kann ihn direkt am Anker einfuegen.

**Git Low-Level (3) — fuer Sync mit Remote**

- `vswrite_git_status` — Liefert Branch, ahead/behind und geaenderte Dateien.
- `vswrite_git_commit` — Stagt alle Aenderungen und committet mit der gegebenen Message.
- `vswrite_git_push` — Pusht commits zum Remote-Repository.

Alle datei-beruehrenden Tools laufen ueber `resolveInsideProject` — symlink-aware, blockiert `../`-Traversal. Anker-basierte Tools (`add_comment` / `insert_reference` / `add_footnote` / `add_image`) nehmen einen `afterText`/`anchor` plus optional einen 1-basierten `occurrence`, wenn der Anker mehrfach vorkommt — der Agent muss keine Offsets selbst berechnen.

Der MCP-Server bietet zusaetzlich fuenf **Prompts** (`typst-reference`, `vswrite-conventions`, `research-workflow`, `writing-style`, `design-conventions`), gespeist aus den deployed `.claude/skills/<name>/SKILL.md`-Dateien:

- **typst-reference** — Typst-Sprachreferenz (Syntax, Math, Layout, Cross-Refs, Footnotes, Bibliographie, gebuendelte Packages mit Code-Beispielen).
- **vswrite-conventions** — Projekt-Konventionen (Ordnerstruktur, Persistenz-Schichten, Design-Surface, Comments, Cross-Refs, Mode-Toggles).
- **research-workflow** — Vier-Phasen-Workflow (Discover / Capture / Synthesize / Integrate) plus End-to-End-Recipes mit MCP-Tools.
- **writing-style** — Stil-Checkliste fuer akademische Prosa mit vier Sektionen: **Source Discipline** (nie Quellen / BibTeX-Eintraege / Zitate erfinden, Pre-Submission-Audit), **Anti-AI-Tells** (Em-Dash-Inflation, "Not just X, but Y", Dreierlisten-Reflex, Buzzwords wie `delve into`/`Landschaft`), **Aktiv-Prinzipien**, **Akademik-Konventionen** (Tempus, Hedging, Citation-Integration). Zweisprachig (EN + DE).
- **design-conventions** — Visuelle Design-Konventionen: Color-Theory (5 semantische Slots, WCAG-Kontrast-Regeln), Typografie-Pairing, Heading-Hierarchy, Layout-Patterns, "Modern Looks 2026", Anti-Patterns (z.B. mehrere Drop-Caps pro Section, doppelte Article-Opener), Workflow-Rezept fuer Composing-Design-Decisions.

---

## Keyboard Shortcuts

| Aktion | Shortcut |
|--------|----------|
| Neues Projekt | `Cmd+N` |
| Projekt oeffnen | `Cmd+O` |
| Projekt schliessen | `Cmd+Shift+W` |
| Speichern | `Cmd+S` |
| Speichern unter | `Cmd+Shift+S` |
| Suchen (aktuelle Datei) | `Cmd+F` |
| Suchen & Ersetzen (aktuelle Datei) | `Cmd+H` |
| Suchen im Projekt | `Cmd+Shift+F` |
| Kommentar hinzufuegen | `Cmd+Alt+M` |
| Cross-Reference einfuegen | `Cmd+Alt+L` |
| Reading Mode | `Cmd+Alt+R` |
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
| Shortcut-Uebersicht | `Cmd+/` |

Auf Windows/Linux jeweils `Ctrl` statt `Cmd`.

---

## Crash-Berichte

Sollte vswrite einmal abstuerzen, schreibt die App lokal einen Bericht im Klartext:

- Was fuer ein Fehler aufgetreten ist
- Stack-Trace mit Datei + Zeile
- Deine letzten Aktionen (Bearbeitungs-Schritte, keine Inhalte)
- App-, OS- und Versions-Informationen

Beim naechsten Start oeffnet sich automatisch ein Dialog mit dem Bericht — du entscheidest selbst, was passiert: **In Zwischenablage kopieren**, **E-Mail vorbereiten** (oeffnet deinen Mail-Client mit `feedback@vswrite.com` vorausgefuellt), **Ordner oeffnen** (zeigt alle gespeicherten Berichte im Finder) oder **Verwerfen** (loescht sie).

**Was vswrite NICHT tut:** Daten automatisch ins Internet senden. Es gibt keine externe Crash-Telemetrie, keinen Account-Login, keinen Server der mitliest. Berichte bleiben auf deinem Rechner, bis du sie aktiv weitergibst.

**Was anonymisiert wird:** Pfade wie `/Users/<Vorname>/...` werden vor dem Schreiben durch `/Users/<redacted>/...` ersetzt. Datei-Inhalte landen nie in den Berichten — nur Datei-**Endungen** und Aktions-Typen (etwa „Datei gespeichert", „Projekt geoeffnet").

**Spaeter wieder oeffnen:** Help → Open Crash Reports oeffnet den Ordner mit allen gespeicherten Berichten.

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
