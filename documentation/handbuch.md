# Penwright Desktop — Handbuch

> **Version:** 0.12.0 (Pre-Release)
> **Letzte Aktualisierung:** 2026-07-31
> **English version:** [handbook.md](handbook.md)

---

## Was ist Penwright Desktop?

Penwright Desktop ist ein eigenstaendiger WYSIWYG-Editor fuer Typst-Dokumente. Statt Markup-Code zu sehen, arbeitest du in einem visuellen Editor — aehnlich wie in Google Docs oder Notion. Gleichzeitig bleibt die volle Typst-Funktionalitaet erhalten: Mathe-Formeln, Konfiguration und Layout werden als bearbeitbare Code-Bloecke angezeigt.

Typisches Einsatzgebiet: wissenschaftliche Arbeiten, Buecher, laengere Dokumente mit Multi-Chapter-Struktur, Bibliografie und Mathe-Satz — alles, wofuer man sonst LaTeX oder Word bemuehen wuerde.

---

## Erste Schritte

### Voraussetzungen

- **macOS**, **Windows** oder **Linux**
- **Typst CLI** — **nicht mehr noetig**. Die App bringt die passende Typst-Binary selbst mit, du brauchst nichts zusaetzlich zu installieren.

### App installieren

Ab v0.7.0:
- **macOS:** DMG von [penwright.online](https://penwright.online) herunterladen und in den Ordner "Programme" ziehen
- **Windows:** NSIS-Installer herunterladen und ausfuehren
- **Linux:** AppImage herunterladen, ausfuehrbar machen (`chmod +x`), starten

### Erstes Projekt oeffnen

Penwright arbeitet projekt-basiert: ein Projekt ist ein Ordner mit mindestens einer `.typ`-Datei. Die App startet immer am Start Screen — du entscheidest, was geoeffnet wird.

- **File -> New Project…** (`Cmd+N`) — Neues Projekt aus Template
- **File -> Open Project…** (`Cmd+O`) — Ordner waehlen
- **„Open Sample Project"** auf dem Start Screen — kopiert eine kommentierte Mini-Thesis ueber AI-gestuetztes wissenschaftliches Arbeiten an einen Speicherort deiner Wahl (Default: `~/Documents/penwright-sample-thesis`). Inkl. fuenf realer Open-Access-Quellen (PDFs in `sources/`), drei Beispiel-Comments und einer initialen Version im Verlauf. Jedes Feature mindestens einmal demonstriert
- **Recent Projects** auf dem Start Screen — letzte Projekte mit einem Klick wieder oeffnen

Um ein Projekt zu schliessen ohne die App zu beenden: **File -> Close Project** (`Cmd+Shift+W`) — du kommst zum Start Screen zurueck und kannst ein anderes Projekt oeffnen.

---

## App-Layout

```
+--------------------------------------------------------------+
|                        (Titelleiste)                          |
+------------------------------+-------------------------------+
|[Files Outline Chapters       | ＋ B I U S  H1 H2 H3  bul Link|  Top-Bar:
| Project Comments]            |                              |  Nav-Tabs + Toolbar
+------+-------------------------------+-----------------------+
|      |  [main.typ] [refs.bib]        |                       |
| Side-|                               |   Preview Panel       |
| bar  |  WYSIWYG Editor               |   (Live-PDF)          |
|      |                               |                       |
+------+-------------------------------+-----------------------+
| [Project][Preview]  Kapitel-Look ▾  1.247 Wörter · …  DE  Trial |
+--------------------------------------------------------------+
```
Die **Navigations-Tabs** (Files / Outline / Chapters / Project / Comments) sitzen in der Top-Bar; Klick zeigt das Panel, Klick auf den aktiven Tab klappt die Seitenleiste ein. Der **＋-Button** links in der Toolbar öffnet das Einfügen-Menü (siehe [Inhalte einfügen](#inhalte-einfügen--button--und-)). Die **Mitte der Statusleiste** ist die kontextuelle **Look**-Steuerung (Kapitel-Look / Global-Look / Look — siehe [das Look-Modell](#design--das-look-modell)). Es gibt keinen separaten „Design"-Tab — Gestalten lebt in `style.typ` und der Statusleiste.

**Oberflächensprache (Englisch / Deutsch):** Penwright übernimmt beim ersten Start die OS-Sprache. Wechseln kannst du jederzeit über den kleinen **DE/EN-Schalter** rechts in der Statusleiste oder unter **Dokument → Dokument-Einstellungen… → Oberfläche**. (Das ist die *App*-Sprache — getrennt von der Textsprache eines Dokuments, die `#set text(lang: …)` setzt.)

### Panels ein-/ausblenden

| Panel | Shortcut | Status Bar Button |
|-------|----------|-------------------|
| Sidebar (links) | `Cmd+Alt+B` | **Project** |
| Preview (rechts) | `Cmd+Shift+P` | **Preview** |

Alle Panels sind per Drag resizeable.

---

## Der Editor

### Toolbar

| Button | Funktion | Shortcut |
|--------|----------|----------|
| **＋ Einfügen** | Öffnet ein Menü mit allem Einfügbaren — Überschriften, Listen, Bilder, Tabellen, Formeln, Fußnoten, Zitate, Querverweise, Seitenumbrüche, Typst-Blöcke. **Dieselbe Liste wie `/`** im Text; `@` springt direkt zu Zitaten & Verweisen. | — |
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

### Native Menueleiste

Alle projekt- und dokument-bezogenen Aktionen liegen in der **nativen Menueleiste** (oben am Bildschirm auf macOS, oben am Fenster auf Windows / Linux). Fuenf Top-Level-Menues:

- **File** — New Project (`Cmd+N`), Open Project (`Cmd+O`), Close Project (`Cmd+Shift+W`), **Save Project as Preset…**, Save (`Cmd+S`), Save As (`Cmd+Shift+S`), Export PDF / DOCX, **Export to Web (HTML)**, Import Markdown, Link Zotero Library, Open Sources Folder, Add Citation Manually
- **Edit** — Undo / Redo / Cut / Copy / Paste / Select All, Find & Replace (`Cmd+F`), **Find in Project…** (`Cmd+Shift+F`), **Add Comment** (`Cmd+Alt+M`), **Insert Reference…** (`Cmd+Alt+L`), Undo AI Edit
- **View** — Toggle Sidebar (`Cmd+Alt+B`), Toggle Preview (`Cmd+Shift+P`), plus Standard-Window-/Zoom-Rollen
- **Document** — Document Settings (**Oberflächensprache** + Dokumentsprache + Zitierstil; der Look des Dokuments lebt in `style.typ`), Merge Document, Split into Chapters, Open as Typst Source, Ensure Bibliography
- **Help** — Show Introduction, User Guide, Keyboard Shortcuts (`Cmd+/`), Report Issue, **MCP Connection…**, **Connect to Claude Desktop…**, **Open Crash Reports** (oeffnet `<userData>/crash-reports/` im Finder); About auf Windows / Linux

In-Text-Inserts (Bild, Tabelle, Mathe, Zitat, Trenner, Seitenumbruch etc.) gehen drei Wege: der **＋ Einfügen**-Button links in der Toolbar, **Slash-Commands** (tippe `/` im Editor — siehe unten) oder `@` für Zitate & Verweise.

### Inhalte einfügen — ＋-Button, `/` und `@`

Der Toolbar-**＋**-Button und das Slash-Menü speisen sich aus **derselben Liste** — nimm, was dir lieber ist: der Button ist der sichtbare Einstieg, `/` der schnelle Weg, wenn du die Namen kennst. Tippe `@` direkt für Zitate und Querverweise.

| Befehl | Beschreibung |
|--------|--------------|
| `/Überschrift 1-3` | Ueberschriften |
| `/Aufzählung` | Ungeordnete Liste |
| `/Nummerierte Liste` | Geordnete Liste |
| `/Zitat` | Blockzitat |
| `/Codeblock` | Generischer Code-Block (für Code-Beispiele im Text) |
| `/Trennlinie` | Horizontale Linie |
| `/Seitenumbruch` | Neue Seite beginnen |
| `/Inhaltsverzeichnis` | Fügt `#outline()` ein |
| `/Formel` | Typst-Formelblock |
| `/Typst-Code` | Roher Typst-Block — für `#set` / `#show` / Farben etc. Verlassen mit **✓ Fertig**, `Esc` oder `Cmd+Enter` |
| `/Bild` | Bild einfuegen |
| `/Fußnote` | Fussnote — Popup oeffnet sich automatisch zur Eingabe |
| `/Zitation` | `@` als Trigger fuer den Citation-Picker |
| `/Querverweis` | Cross-Reference-Picker — waehle ein `<label>` zum Einfuegen als `@label` |
| `/Tabelle` | Tabelle einfuegen (mit Header) |
| `/Artikel-Auftakt` | Kicker, Titel, Vorspann & Byline |
| `/Initial` | Erster Absatz mit Initialbuchstaben |
| `/Pull-Quote` | Großes zentriertes Zitat mit Quelle |
| `/Interview-Frage` | Fette Frage für ein Interview |
| `/Notizkasten` | Gerahmte Notiz mit Titel |
| `/Bildtafel` | Foto mit gerahmter Anmerkung |
| `/Spalten` | Mehrspaltiger Abschnitt |
| `/Zwischenstück` | Stiller zentrierter Trenner |
| `/Randnotiz` | Stille Notiz im Außenrand |

### „Aus diesem Projekt" — die eigenen Bausteine deines Projekts

Unter den Standard-Einträgen hat das ＋-Menü einen Abschnitt **Aus diesem Projekt**. Er listet die Bausteine, die *dieses* Projekt für sich selbst definiert: eine Bildtafel, ein Pull-Quote, ein Infokasten, eine Preiszeile — was auch immer in den projekteigenen Dateien (`style.typ`, `macros.typ`, …) steht, von dir geschrieben oder von der KI, die das Design gebaut hat. Ein Klick fügt den fertigen Aufruf mit Platzhalterwerten ein, die du überschreibst — ein Textfeld trägt den Namen des Parameters, ein Bildfeld `assets/bild.jpg`, der Rumpf das Wort `Inhalt`. Optionale Werte bleiben ganz weg und behalten so die Vorgabe, die der Baustein selbst definiert. Das `/`-Menü bietet dieselben Bausteine an; es ist eine flache Liste, tippe also den Namen des Bausteins.

Dafür muss nichts registriert werden. Penwright liest die Definitionen des Projekts und bietet sie an, wie sie sind. Im Menü steht immer der Name des Bausteins; eine Kommentarzeile direkt über der Definition wird zur Beschreibung darunter, sonst siehst du die Signatur. (Auf der Karte weiter unten ist der Kommentar dann die Überschrift.)

**Warum ein Baustein in manchen Dateien auftaucht und in anderen nicht:** Ein Baustein funktioniert nur in einer Datei, die ihn importiert hat. Typst reicht einen Import aus dem Hauptdokument *nicht* an ein Kapitel weiter — ein Kapitel, das die Datei mit der Definition nicht selbst importiert, kann den Baustein nicht benutzen, und das Dokument würde nicht mehr kompilieren. Deshalb wird die Liste pro Datei gebaut: Sie zeigt genau das, was an deiner Cursorposition benutzbar ist, und ändert sich beim Dateiwechsel. Fehlt ein Baustein, den du erwartest, importiert die Datei ihn nicht (das Hauptdokument tut es meist).

Definiert ein Projekt nichts Eigenes, fehlt der Abschnitt einfach.

### Die Baustein-Karte

Ein Baustein in deinem Text — selbst eingefügt oder von der KI ins Dokument geschrieben — ist keine Code-Wand, die du nur anschauen kannst. Ist ein Block genau ein Aufruf eines Bausteins, den diese Datei sieht, zeigt Penwright ihn als **Karte**: oben der Name des Bausteins, darunter eine Zeile pro Wert, links die Bezeichnung, rechts der aktuelle Wert. Ein weggelassener Wert steht als *(Vorgabe)* da. Ein Baustein ohne Werte sagt das ausdrücklich.

- **Klick auf die Karte** öffnet ein kleines Formular mit einem Feld pro Wert. Was du tippst, geht direkt ins Dokument.
- **Ein Feld, das eine Datei will, bekommt einen „Datei wählen…"-Knopf**, statt dich einen Pfad tippen zu lassen — du wählst das Bild, Penwright kopiert es nach `assets/` und schreibt den richtigen relativen Pfad.
- **Ein Feld leer lassen** heißt „nimm den Vorgabewert aus der Definition": der Wert wird aus dem Aufruf entfernt und nicht als leerer Text geschrieben.
- **`</> Code`** oben rechts auf der Karte zeigt den rohen Typst-Quelltext genau dieses Blocks, **Formular** führt zurück. In beide Richtungen geht nichts verloren.

Eine Änderung ersetzt genau den einen Wert, den du geändert hast. Alles andere im Block bleibt unangetastet — deine Zeilenumbrüche, deine Kommentare und jeder Wert, den du nicht angefasst hast.

**Manche Blöcke bleiben absichtlich Code.** Ist ein Block nicht ein ganzer Aufruf, den Penwright sicher lesen kann — zwei Aufrufe in einem Block, eine offene Klammer, etwas, das sich nicht unverändert zurückschreiben lässt — behält er das schlichte Textfeld. Das ist Absicht: Ein Formular über einem Block, den der Editor nur halb versteht, würde irgendwann an der falschen Stelle hineinschreiben.

### Tabellen

Eine `#table(...)` im Dokument öffnet sich als **echte Tabelle, in die du tippen kannst**. Klick in eine Zelle und bearbeite sie wie jeden anderen Text. Die kleine Leiste unter der Tabelle hat ein Zahnrad zum Hinzufügen und Entfernen von Zeilen und Spalten (und zum Löschen der Tabelle) sowie einen **✓ Fertig**-Knopf, der den Cursor zurück in den Text darunter setzt.

Die Gestaltung der Tabelle selbst — Spaltenbreiten, Ausrichtung, Hintergrundfarben, Linien, Innenabstände — bleibt **genau so, wie sie geschrieben wurde**, und wird nie neu erzeugt. Penwright macht den *Inhalt* bearbeitbar und lässt das Design in Ruhe. Genau darum geht es: In einer Preistabelle willst du den Preis ändern.

**Manche Tabellen bleiben absichtlich ein Code-Block.** Macht eine Tabelle etwas, das Penwright nicht unverändert zurückgeben kann — per Ausdruck berechnete Spaltenbreiten, eine Zelle über mehrere Spalten, eine Zelle, deren Inhalt sich nicht exakt reproduzieren ließ —, bleibt die ganze Tabelle Typst-Quelltext. Sie als bearbeitbare Tabelle zu zeigen, hieße zu riskieren, beim nächsten Speichern still einen Teil davon zu verlieren.

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
- **Slash-Command:** `/Bild` -> Datei-Auswahl
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

**OEffnen:** File -> New Project… (`Cmd+N`) — oder die grosse „Neues Projekt"-Karte auf dem Start-Screen.

### Die Preset-Gallery

Der Dialog ist eine **Gallery, nach Projekttyp gruppiert**, mit gerenderten Vorschau-Thumbnails. Pro Typ gibt es oben eine **„Leer"-Karte** (nur das Grundgeruest) und darunter fertige **Presets** — echte, compile-getestete Projekte mit fertigem Design **und** Platzhalter-Text (Lorem), den du einfach ueberschreibst.

Projekttypen: Dokument · Abschlussarbeit · Paper · Brief · Buch · **Magazin** · Report/Whitepaper · Newsletter/Zine · Portfolio/Case-Study · Kochbuch. Jeder Typ hat mehrere Design-Varianten — von sehr modern ueber Dark-Mode, Pastell, Pop, Retro bis knallbunt (Kinderbuch, Poster).

**Magazin-Presets sind das Highlight:** **jedes Kapitel hat ein anderes Layout** (Cover, Editorial mit Initiale, Feature mit Bildtafel, zweispaltiges Interview, Essay, dreispaltige Rubrik …) — du schreibst einfach ins Kapitel und bekommst das Layout geschenkt.

**Vorschau:** Ueber eine Preset-Karte hovern -> **„Vorschau"** -> ein Overlay blaettert dir die ersten Seiten des Designs durch (Pfeile / ←→ / Punkte), mit „Diese Vorlage verwenden".

**Erstellen:** Karte waehlen -> „Projekt erstellen" -> Speicherort waehlen -> das Preset wird kopiert und oeffnet sich auf einem schreibbaren Kapitel.

### Eigene Presets speichern

**File -> „Save Project as Preset…"** (bei geoeffnetem Projekt) speichert dein aktuelles Projekt als wiederverwendbares Preset in deine persoenliche Bibliothek (`userData/presets/`), inkl. gerendertem Thumbnail. Es erscheint dann in der Gallery unter seinem Typ mit einem **„Meins"-Badge** (und einem Loeschen-Button beim Hover). So baust du dir deine eigene Vorlagen-Sammlung.

### Design aus einem Preset importieren

Im **Look-Designer** (Doppelklick auf `style.typ`) -> Abschnitt **„Aus Preset importieren"**: uebernimm aus einem beliebigen Preset das **ganze Design**, nur die **Farben**, nur die **Schriften**, nur das **Layout** oder die **Kapitel-Rubriken** — direkt in dein offenes Projekt. Laeuft ueber die safe-apply-Engine (kompiliert-oder-Rollback, rueckgaengig-machbar).

### Was jedes neue Projekt automatisch bekommt

- Die Projektdateien (main.typ, chapters/, ggf. style.typ / macros.typ / assets)
- `assets/` fuer Bilder, `sources/` fuer Quellen-PDFs
- `.claude/skills/` mit Claude-Code-Skills (typst, Penwright, research, writing-style, design)
- `.git/` + `.gitignore` — Versionssystem ab der ersten Speicherung
- `.penwright/` fuer Auto-Backups + AI-Edit-Snapshots (versteckt, projekt-lokal)
- Einen Initial-Commit

> Ein **KI-Agent** kann per MCP dasselbe: `penwright_list_presets` + `penwright_create_from_preset` legen ein Projekt aus einem Preset an (siehe „MCP Server").

---

## Sidebar

Die Sidebar hat fuenf Tabs:

### Files
- Rekursiver Dateibaum, Back-Button, **Neuer Ordner** (Inline-Eingabefeld — Enter speichert, Esc bricht ab), **Asset hinzufuegen** (Datei-Auswahl, kopiert nach `assets/`)
- Leere Ordner wie `assets/` und `sources/` bleiben sichtbar, damit du immer weisst, wo Sachen hingehoeren
- `.claude/` Ordner sichtbar fuer Skills; `.git/` und `.penwright/` sind ausgeblendet
- Bilder aus `assets/` sind per Drag & Drop in den Editor ziehbar
- Rechtsklick -> "Open in New Tab"

### Outline
- Live Heading-Hierarchie (H1 -> H2 -> H3), Klick navigiert zum Heading
- **Per Drag umsortieren:** zieh eine Heading-Zeile nach oben oder unten — die ganze Sektion (Heading + alles bis zum naechsten gleich- oder hoeherrangigen Heading) wandert mit. Eine blaue 2-px-Linie zeigt das Drop-Ziel. Funktioniert nur innerhalb einer Datei; kapitelweises Umsortieren laeuft weiterhin ueber den **Chapters**-Tab.
- **Backlinks finden:** Hovern ueber ein Heading laesst rechts einen kleinen Pfeil **↪** erscheinen — Klick darauf zeigt jede Stelle im Projekt, wo das Heading erwaehnt wird (siehe [Backlinks](#backlinks--wo-wird-das-sonst-noch-erwaehnt))

### Chapters (Include-Manager)
- `#include` Statements, Pfeile zum Umsortieren (sofortiges UI-Update), x zum Entfernen, + Add Chapter
- Der **Look** des Kapitels wird nicht mehr hier gesetzt — er lebt in der **Statusleiste**, während du das Kapitel bearbeitest (Kapitel-Look ▾ + der **✎**-Editor). Siehe [das Look-Modell](#design--das-look-modell).

### Project
Dieser Tab ersetzt das alte Git-Panel und nutzt Schreiber-Vokabular statt roher Git-Befehle. Vollstaendiger Workflow: siehe Abschnitt **[Versionen & Auto-Backup](#versionen--auto-backup)** weiter unten. Kurzfassung:
- **Version speichern** — benennt deinen aktuellen Stand und legt ihn im Verlauf des Projekts ab
- **Aenderungen seit letzter Version** — Checkboxen, welche Dateien in die naechste Version kommen
- **Verlauf & Wiederherstellen** — ein Button oeffnet einen Hub mit allem, was du zurueckholen kannst: gespeicherte Versionen, automatische Backups und KI-Aenderungen (siehe unten)
- **Erweitert** (zugeklappt) — optional: Cloud-Sync (Push/Pull zu GitHub oder einem beliebigen Git-Remote)

### Comments
- Liste aller Kommentare zur **aktuellen Datei** oder **dem ganzen Projekt** (Tab oben im Panel)
- Pro Eintrag: Anker-Vorschau (kursiv, klickbar — springt im Editor zur Stelle), Body-Textarea (Auto-Save nach kurzer Tippe-Pause), „erledigt"-Haken, Loeschen
- Erledigte Kommentare sind ausgeblendet — Checkbox „Erledigte zeigen" macht sie wieder sichtbar
- Vollstaendiger Workflow: siehe Abschnitt **[Kommentare & Notizen](#kommentare--notizen)** weiter unten

> **Hinweis:** Es gibt keinen „Design"-Sidebar-Tab mehr. Gestalten lebt jetzt **dort, wo es wirkt** — `style.typ` öffnen für den Look des ganzen Dokuments, die Statusleisten-Steuerung für den Look eines Kapitels, Rechtsklick → „Design with AI" für eine einzelne Stelle. Siehe [das Look-Modell](#design--das-look-modell).

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
- **Slash-Command:** `/Fußnote`

In beiden Faellen wird eine leere Fussnote an der Cursor-Position eingefuegt und der **Inline-Popup-Editor oeffnet sich automatisch** zum Eingeben.

**Bearbeiten:** Klick auf eine bestehende Fussnote im Editor oeffnet den Popup mit dem Body zum Editieren. Der Body wird **live** gespeichert (jeder Tastendruck), Esc oder `Cmd+Enter` schliesst den Popup.

**In der Source:** `#footnote[Dein Text]` — wird vom Typst-Compiler nummeriert und positioniert.

**Im Editor:** kleine hochgestellte Markierung mit Preview-Text (erste ~30 Zeichen). Echte Nummer + Position-am-Seitenende erscheinen erst in der PDF-Preview rechts (400 ms Compile-Debounce).

---

## Cross-References

In Typst kannst du Figuren, Tabellen, Gleichungen oder Headings mit einem `<label>` markieren und von ueberall im Projekt mit `@label` darauf verweisen. Typst nummeriert beim Compilen automatisch — wenn du Kapitel umstellst oder eine Figur einfuegst, aktualisieren sich alle Verweise ohne Zutun.

Penwright gibt dir einen Picker, der jedes `<label>` im Projekt auflistet, damit du dir keine Namen merken musst.

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

- **Slash-Command:** `/Querverweis`
- **Menue:** `Edit -> Insert Reference…`
- **Shortcut:** `Cmd+Alt+L`

Der Picker zeigt jedes Label im Projekt, gruppiert nach Typ (Abbildungen / Tabellen / Gleichungen / Ueberschriften / Andere) mit Caption-Vorschau und Quellort (`chapters/04-results.typ:24`). Das Suchfeld filtert ueber Label, Caption und Pfad. ↑↓ navigiert, Enter fuegt ein, Esc bricht ab.

Im Editor erscheint die eingefuegte Node als **orangene `↳ label`-Pille** — visuell klar unterschieden vom blauen `@citekey`-Citation-Badge. In der Source serialisiert sie zur normalen Typst-Syntax `@label`.

### Citation vs. Reference — Disambiguierung

Typst nutzt fuer Citations (`@chen2021codex`) und Cross-References (`@fig:scaling`) dieselbe `@…`-Syntax. Penwright unterscheidet sie ueber den Namen:

- Enthaelt einen Doppelpunkt (`:`) — Reference
- Beginnt mit einem bekannten Praefix (`fig`, `tbl`, `eq`, `sec`, `chap`, `app`, `thm`, `lem`, `def`, `cor`, `prop`, `algo`, `lst` und ihre Vollformen) — Reference
- Sonst — Citation

Deshalb ist das `@`-Autocomplete reserviert fuer Citations (Citekeys sind konventionell schlichte Slugs). Fuer Refs nutzt du den Picker.

---

## Kommentare & Notizen

Kommentare sind **gelbe Anmerkungen am Text**, die nur im Penwright-Editor sichtbar sind und **nicht** ins PDF/DOCX kompilieren. Geeignet fuer Selbstnotizen („hier noch Quelle ergaenzen") oder Betreuer-Feedback.

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

**Reanchoring:** Wenn du Text vor einem kommentierten Abschnitt einfuegst, verschiebt sich der Anker. Penwright findet ihn beim Datei-OEffnen ueber den gespeicherten Anker-Text wieder. Wenn der Anker-Text geloescht oder so stark geaendert wurde, dass er nicht mehr findbar ist, wird der Kommentar **orphaned** markiert (rotes Warndreieck) — du kannst ihn dann manuell neu zuordnen oder loeschen.

**Bekannte MVP-Limitierungen:**
- Anker-Text muss innerhalb eines Absatzes / einer Ueberschrift liegen — Kommentare, die ueber Absatz-Grenzen hinweg ankern, werden als orphaned markiert.
- Mehrere Kommentare mit **identischem** Anker-Text in derselben Datei zeigen alle dasselbe (erste) Highlight.

---

## Backlinks — „Wo wird das sonst noch erwaehnt?"

Bei wissenschaftlichem Schreiben ist der Konsistenz-Check wichtig: jede Erwaehnung eines Konzepts oder einer Quelle ueber alle Kapitel hinweg finden. Penwright hat dafuer zwei eingebaute Trigger, die im Hintergrund [Suche im Projekt](#suche-im-projekt) mit der richtigen Query starten.

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

- **Root-Datei Kompilierung:** Bei Chapters wird automatisch main.typ kompiliert (die Vorschau zeigt immer das *ganze* Dokument, nicht ein einzelnes Kapitel)
- **PDF-Rendering** ueber pdf.js — viewport-virtualisiert, also bleibt die Vorschau auch bei 100+ Seiten fluessig
- **Text markieren & kopieren** in der Vorschau dank pdf.js' TextLayer
- **Fehleranzeige:** Typst-Fehler werden im Preview Panel ausgegeben
- **Aktualisierungs-Modus (auto / manuell):** standardmäßig aktualisiert sich die Vorschau live beim Tippen (400 ms Debounce). Für lange Dokumente kannst du unter **Dokument → Dokument-Einstellungen… → Vorschau** auf **manuell** umstellen — dann wird weiterhin automatisch gespeichert, die Vorschau kompiliert aber nur, wenn du den **↻ Aktualisieren**-Button in der Vorschau-Leiste klickst. Ein „Veraltet"-Hinweis + ein hervorgehobenes ↻ zeigen, wenn die Vorschau hinterherhinkt.
- **Folgt dem aktiven Kapitel:** wechselst du zu einer Kapiteldatei, scrollt die Vorschau zur ersten Seite dieses Kapitels (über die PDF-Lesezeichen gematcht). Der Sprung passiert nur beim *Wechsel*, nie beim Tippen.
- **Einzelseite oder Doppelseite:** ein kleiner `▭▭`-Schalter in der Vorschau-Leiste wechselt zwischen Einzelseiten-Scrollen und einer **2-up-Doppelseiten-Ansicht** — Seite 1 allein, dann 2–3, 4–5 … nebeneinander, so wie ein Magazin aufgeschlagen wird. Praktisch für Doppelseiten und Full-Bleed-Layouts. Pro Projekt gespeichert (zusammen mit den Zoom-Stufen).

---

## Zoom (Editor + Vorschau)

Editor- und PDF-Vorschau lassen sich unabhaengig voneinander zoomen, 50 % bis 200 % in 10er-Schritten:

- **Editor-Zoom:** unten rechts in der Status-Leiste steht das aktuelle `100 %` als Button. Klick darauf oeffnet einen kleinen Slider mit `−` / `+` und Reset. Per Tastatur: `Cmd+Alt+=` (rein), `Cmd+Alt+-` (raus), `Cmd+Alt+0` (zurueck auf 100 %).
- **PDF-Vorschau-Zoom:** oben im Preview-Panel ist eine schmale Leiste mit `− 100 % +`. Klick auf das Prozent setzt zurueck. Per Tastatur: `Cmd+Shift+=` (rein), `Cmd+Shift+-` (raus), `Cmd+Shift+0` (zurueck). Der PDF-Zoom gilt sowohl fuer die Live-Vorschau rechts als auch fuer geoeffnete Source-PDFs (z. B. via Citation-Hover „PDF oeffnen").
- **Scrollbars** sind immer sichtbar — bei Zoom > 100 % wird die Seite breiter als das Panel und du kannst horizontal scrollen.
- **Pro Projekt gespeichert:** Beim naechsten Oeffnen desselben Projekts sind deine Zoom-Levels wieder da. Die Werte liegen in `<projekt>/.penwright/preferences.json` und reisen mit, wenn du den Ordner kopierst.
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
- Mit einem Klick zwischen **PDF**, **DOCX** und **Web (HTML)** wechseln kannst. Bei Web kommen zwei weitere Optionen dazu: ob das Heft eine lange Seite wird oder eine Seite pro Kapitel, und ob Bilder ins HTML eingebettet oder danebengelegt werden
- **Die zu exportierenden Kapitel** per Checkbox auswaehlst — jedes Kapitel zeigt seine erste H1 als Titel
- Das **Literaturverzeichnis** ein-/ausschalten kannst
- Per **alle / keine**-Shortcuts schnell die Auswahl steuern kannst

Titelseite, Abstract und alles ausserhalb von `#include` werden immer mit-exportiert. **PDF oeffnet diesen Dialog immer**, auch bei einem Ein-Datei-Dokument, weil die Druckoptionen hier liegen. Nur ein DOCX-Export aus einer einzelnen Datei geht direkt zum Save-Dialog.

### PDF Export

Nutzt die gebundelte Typst-CLI fuer das (ggf. gefilterte) Projekt. Das PDF entspricht 1:1 der Vorschau.

### Für den Druck (Print-Export)

Beim PDF-Export zeigt der Dialog jetzt eine Option **„Für den Druck"**, die aus dem Bildschirm-PDF eine **druckerei-taugliche** Datei macht — komplett in Typst, ohne externes Tool:

- **Beschnitt (Bleed)** (3 mm / 5 mm / frei): die physische Seite wird auf allen Seiten über das Endformat hinaus vergrößert, damit randabfallende Bilder nach dem Schneiden keinen weißen Blitzer hinterlassen.
- **Schnittmarken:** Eckwinkel im Beschnitt — *diese Marken sind die Trim-Definition* (siehe Hinweis unten).
- **Doppelseiten + Bundzuwachs:** Innen-/Außenstege je nach Seitenparität, mit Extra-Platz am Bund. Anders als der Beschnitt werden Doppelseiten **auch beim Schreiben** angezeigt, weil ein gebundenes Heft sich tatsächlich anders liest.
- **dpi-Preflight:** ein nicht-blockierender Hinweis listet Bilder, die wahrscheinlich zu niedrig aufgelöst für den Druck sind (unter ~1500 px an der kurzen Kante).
- **„Als Standard merken":** speichert die Druckeinstellungen im Projekt-Design, sodass der Dialog beim nächsten Mal vorbelegt ist.

Schnellster Weg: **Datei → Als PDF exportieren… → „Für den Druck" anhaken**. Um ein Projekt einmalig als Druckprojekt einzurichten, im Look-Designer das Layout-Preset **„Magazin (Druck) · A4 + 5 mm Beschnitt"** anwenden — dann ist der Dialog vorbelegt und Doppelseiten erscheinen schon beim Schreiben.

Ein **Doppelseiten-Bild** („Double-Truck" — ein Foto über zwei gegenüberliegende Seiten und über den Bund) gibt es als Design-Element; im Druck-Export blutet es automatisch an die physischen Ränder. Zum Beurteilen die **Doppelseiten-Vorschau** nutzen (siehe Live-Preview).

> **RGB, nicht CMYK.** Penwright liefert ein druckfertiges **RGB**-PDF mit Beschnitt + Schnittmarken. Typst kann weder ein ICC-Profil einbetten noch PDF/X-Boxen (Trim/Bleed) setzen, daher **sind die gezeichneten Schnittmarken die Trim-Definition** — die CMYK-/PDF-X-Umwandlung ist ein Nachschritt (die Druckerei mit ihrem kalibrierten Profil, oder Acrobat / Ghostscript). Für farbverbindlichen Offsetdruck die Druckerei konvertieren lassen.

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

### Web-Export (HTML) — das Editorial Web Pack

**Print *und* Web aus einer Quelle.** Exportiere dein Dokument — oder ein ganzes Magazin — als self-contained, responsives HTML fürs Web. Dasselbe Manuskript, aus dem dein Druck-PDF wird, wird eine echte Webseite, ohne zweites Editieren.

**So geht's:** **Datei → Ins Web exportieren (HTML)… (HTML)…**, dann einen Ordner wählen — Penwright schreibt ein kleines Bundle dorthin.

**Zwei Formen, automatisch aus dem Dokument erkannt:**
- Ein **normales Dokument** (Thesis, Bericht, Paper) → **eine self-contained Seite** (`index.html`), plus `fragment.html` (nur der Artikel, zum Einbetten), eine neutrale `meta.json` und ein `assets/`-Ordner für Bilder.
- Ein **Magazin** (eine Titelseite oder zwei bzw. mehr Artikel-Auftakte) → eine **Mini-Website**: ein Heft-**Index** (Cover + anklickbares Inhaltsverzeichnis) und **eine Seite pro Artikel**, jede mit „‹ zurück zum Inhalt" und Vor/Zurück-Navigation. Jeder Artikel bekommt eine eigene Datei — ein einzelner Artikel ist für sich teilbar.

**Was mitkommt** — alles Bedeutungstragende, nicht nur Fließtext:
- Überschriften, Listen, Zitate, Code
- **Abbildungen** und **Tabellen** mit automatischer „Abbildung N"- / „Tabelle N"-Caption
- **Mathe** — Display-Formeln werden vom gebündelten Typst zu scharfem, skalierbarem Inline-**SVG** gerendert (kein unscharfes Raster, keine externe Mathe-Bibliothek)
- **Querverweise** — `@fig:x` wird zu „Figure 1", `@sec:y` zu „Section 2.1", auf das Ziel auf der Seite verlinkt
- **Zitate** — gruppiert und formatiert wie im PDF (`(Bender et al., 2021; …)`, oder `[1, 2]` bei numerischen Stilen), in die Bibliographie verlinkt
- **Fußnoten** — nummeriert, am Artikelende in einer Endnoten-Sektion gesammelt, mit „↩"-Rücksprung
- **Bibliographie** — eine APA-nahe „References"-Sektion, jeder Eintrag verankert, sodass Zitate direkt darauf verlinken
- das **Magazin-Design** — Drop-Caps, Pull-Quotes, Callouts, mehrspaltige Abschnitte, Randnotizen, Artikel-Auftakte und das Cover — als echtes, responsives Web-Design; Farben und Schriften kommen aus denselben Design-Tokens wie das PDF, und Blocksatz wird übernommen

**Es ist eine Neu-Interpretation, kein Screenshot des PDFs.** Das Web ist eine umfließende Spalte, deshalb wird die Print-Geometrie *übersetzt*, nicht kopiert: ein Full-Bleed-Aufmacher oder ein Doppelseiten-Bild wird ein Vollbreiten-Web-Hero; Randnotizen sitzen auf breiten Screens in einer Außenspalte und klappen auf dem Handy inline; mehrspaltige Abschnitte fallen auf Mobil auf eine Spalte zusammen.

**Bewusst framework-agnostisch** — der Output macht keine Annahmen darüber, wohin er kommt:
- der Artikel trägt sein eigenes **scoped CSS**, präfixiert, sodass es nie mit den Styles einer Host-Seite kollidiert
- `fragment.html` ist nur der `<article>` — einbettbar in Astro, WordPress, Ghost, einen Static-Site-Generator oder dein eigenes CMS
- `index.html` ist eine eigenständige Seite, als reine Datei hostbar
- `meta.json` sind neutrale Metadaten (Titel, Sprache und — beim Magazin — die Artikelliste)
- Bilder werden mit relativen Links nach `assets/` kopiert

---

## Design — das „Look"-Modell

Penwright entkoppelt Schreiben und Gestalten. Du gestaltest **dort, wo es wirkt** — drei Flächen, ein Wort („Look"):

- **Ganzes Dokument → `style.typ` öffnen.** Doppelklick auf `style.typ` im Datei-Baum (oder die **✦ Look**-Steuerung in der Mitte der Statusleiste) öffnet den **visuellen Look-Designer** — nicht den rohen generierten Code. Themes, Palette, Fonts, Scale, Layout, Headings, Elemente, Custom-Code. Jedes Projekt hat eine `style.typ`.
- **Ein Kapitel → die Statusleiste.** Während du ein Kapitel bearbeitest, zeigt die Statusleiste in der Mitte **Kapitel-Look ▾** — wähle eine Magazin-Rubrik (Feature / Interview / Essay / …). Das **✎** öffnet einen vollen Editor für diesen Look (Akzent- + Primärfarbe, Body/Heading-Font, Basisgröße, Zeilenabstand, Spalten, H1–H3) mit **„Für alle mit diesem Look"** vs. **„Nur dieses Kapitel"** (forkt eine kapitel-eigene Variante). Seitenformat, Ränder und Kopfzeilen bleiben immer dokumentweit.
- **Eine Stelle → Design with AI.** Text markieren, Rechtsklick **✨ Design with AI** — ein kleines Popover erscheint an der Auswahl (Prompt kopieren / Claude öffnen). Claude liest sie via `penwright_get_selection` und gestaltet genau diese Stelle.

**Sicher per Design:** Jede Design-Änderung — deine in der App und die der KI über MCP — wird *vor* dem Übernehmen kompiliert. Würde sie nicht kompilieren, wird sie zurückgerollt und dein letzter funktionierender Look bleibt; das Dokument bleibt nie kaputt. Der Look-Designer hat ein **↩ Rückgängig**.

Jede Änderung schreibt nach `<project>/.penwright/style.json` und regeneriert `<project>/style.typ` — die Root-Datei zieht die Regeln per `#import "style.typ": *` plus `#show: apply-style` rein.

### Bereiche im Look-Designer (`style.typ` öffnen)

| Section | Steuert |
|---------|---------|
| **Farbpalette** | Fuenf semantische Slots (primary / accent / text / background / muted) — jeder mit Coloris-Picker plus Hex-Textfeld |
| **Paletten-Presets** | Acht kuratierte 5-Farben-Paletten (Modern Tech, Editorial, Earth Tones, High Contrast, Minimal Mono, Forest Deep, Sunset Warm, Ocean Classic). Apply tauscht nur Farben |
| **Themes** | Sechs vollstaendige ProjectStyle-Snapshots (Classic Academic, Modern Tech, Editorial Magazine, Minimal, Marketing Brochure, Thesis). Apply ueberschreibt alles ausser dem Custom-Code-Block |
| **Layout-Presets** | Acht Geometrie-Wechsel (A4 Portrait, A4 Landscape, Magazine 2-Spalten, Newsletter 3-Spalten, A5 Booklet, Magazine Editorial mit Header-Strip, A2 Poster, Magazin (Druck) · A4 + 5 mm Beschnitt) — Paper, Orientation, Margin, Columns, optional Base-Size |
| **Fonts** | Drei Font-Slots (body / heading / code) plus Font-Browser. Jede Karte rendert die Familie + Beispielsatz live in den sieben gebuendelten OFL-Fonts |
| **Scale** | Base-Size, Leading, Paragraph-Spacing, First-Line-Indent |
| **Layout** | Paper, Orientation, Margin, Columns, Page-Numbering, Header-Markup, Footer-Markup, Page-Fill (Background-Color-Expression). Header/Footer akzeptieren die Platzhalter `{chapter}` (aktueller H1-Titel) und `{section}` (aktueller H2-Titel) — z.B. `{chapter} · ISSUE 1` ergibt eine pro-Kapitel mitwandernde Running-Head. |
| **Headings** | H1–H6 als collapsible Cards — Size, Weight, Color-Slot, Top-Margin pro Level; plus ein einziges Numbering-Pattern |
| **Bausteine** | Die 24 fertigen Layout-Bausteine (siehe unten) — Liste filtern, Felder ausfuellen, **An Cursorposition einfuegen**. Warnt, wenn die offene Datei `style.typ` nicht importiert, weil ein Baustein dort die Projektfarben nicht faende |
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

Eine **24 Elemente** umfassende Library parametrischer Snippets — Banner, Sidebar, Pull-Quote (drei Varianten: regular / Display / Block), Callout, Hero, Section-Divider (drei Varianten: regular / Asterisks / Ornament), Drop-Cap, Article-Opener, Section-Opener, Image-Gallery 2-up / 3-up / asymmetric (1 gross + 2 klein), Image-Overlay (Foto mit Gradient + Headline drueber), Stats-Box ("By the numbers"-Sidebar), Photo-Caption-Wrap (kleines Foto mit Caption drumherum via wrap-it), Magazine-Cover, Full-Bleed-Image (randlose Ganzseite), Spread-Opener (full-bleed Opener mit Headline ueber Gradient), Margin-Note (Marginalia im Aussenrand via drafting), Spread-Image (ein Foto ueber zwei gegenueberliegende Seiten, im Druck-Export bis an die physischen Raender).

Du erreichst sie **auf zwei Wegen**: ueber den Abschnitt **Bausteine** im Look-Designer (`style.typ` oeffnen) — filtern, Felder ausfuellen, „An Cursorposition einfuegen" — oder aus Claude Desktop ueber die MCP-Tools `penwright_list_design_elements` / `penwright_insert_design_element`. Jede Referenz auf `style-colors.*` / `style-fonts.*` bedeutet, dass sich das Element automatisch re-themed, wenn du Palette oder Fonts wechselst. Der `magazine-cover` setzt `#page(margin: 0pt)` fuer die Coverseite — der Rest des Dokuments behaelt seine konfigurierten Raender. `style.typ` exportiert dafuer sechs Modul-level Werte: `style-colors`, `style-fonts`, `style-bleed` (0 mm am Bildschirm, im Druckexport der Beschnitt — das Element „Doppelseiten-Bild" braucht es, ein handgeschriebenes `style.typ` ohne diesen Wert kann es also nicht tragen), `figure-caption-credit(caption, credit)` fuer Foto-Quellen-Captions sowie `chapter-name()` / `section-name()` fuer Kolumnentitel.

### Gebuendelte OFL-Fonts (offline-tauglich)

Sieben Font-Familien sind mit Penwright ausgeliefert — keine System-Installation noetig, kein Internet beim Compile:

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

Das alte **Dokument → Stil-Vorlagen** Submenu (Classic / Modern / Minimal / Vibrant / Elegant / Professional / Artsy) wurde in Session 22 ersetzt durch die Themes-Section im Look-Designer (öffne `style.typ`). Die MCP-Tools `penwright_list_styles` und `penwright_apply_style` funktionieren weiterhin — sie zeigen jetzt auf die neuen Theme-Presets.

---

## Versionen & Auto-Backup

Penwright haelt drei unabhaengige Schichten zur Absicherung deiner Arbeit — jede mit klar abgegrenztem Zweck:

| Schicht | Ausloeser | Zweck | Wo es lebt |
|---------|-----------|-------|------------|
| **Versionen** | Du klickst **Version speichern** | Bewusste Meilensteine im Projektverlauf | `<projekt>/.git/` |
| **Auto-Backup** | Timer (konfigurierbar, Default alle 30 s) | Crash-/Hänger-Schutz — nie mehr als X Sekunden Arbeit verlieren | `<projekt>/.penwright/backups/` |
| **AI-Edit-Undo** | Externe Aenderung (KI-Agent / MCP) | Schnelles Rueckgaengig der letzten AI-Aenderung | `<projekt>/.penwright/ai-snapshots/` |

Alle drei leben **innerhalb des Projektordners**, das Projekt ist also self-contained: kopierst oder verschiebst du es, wandert der vollstaendige Verlauf mit. Erreichbar sind sie alle an einem Ort — der Button **Verlauf & Wiederherstellen** im **Project**-Tab oeffnet einen Hub mit je einem beschrifteten Abschnitt.

### Eine Version speichern

Im **Project**-Sidebar-Tab:
1. Tippe eine kurze Beschreibung in **Version speichern** ("Kapitel 3 erste Fassung", "Vor Lektorats-Feedback", …)
2. Optional: hak einzelne Dateien in **Aenderungen seit letzter Version** ab, die nicht in diese Version sollen
3. Klick **Version speichern**

Deine neue Version erscheint im Abschnitt **Versionen** von **Verlauf & Wiederherstellen**. Jeder Eintrag bleibt fuer immer abrufbar (bis du das Projekt loeschst).

### Verlauf durchsuchen

Oeffne **Verlauf & Wiederherstellen** (im **Project**-Tab) und klick auf einen Eintrag im Abschnitt **Versionen**, um die Detail-Ansicht zu oeffnen:
- Datum + Beschreibung
- Diff pro Datei im Quelltext-Stil (rote entfernte Zeilen, gruene neue — wie GitHub)
- **Diese Version wiederherstellen**-Button — ueberschreibt die aktuellen Dateien mit dem historischen Stand (mit Bestaetigung)

Dein aktueller Stand geht nie verloren: vor dem Wiederherstellen kannst du eine **Version speichern**, um den jetzigen Zwischenstand festzuhalten.

### Auto-Backup

Der Abschnitt **Auto-Backups** in **Verlauf & Wiederherstellen** listet jeden automatischen Snapshot:
- Jedes Backup ist ein vollstaendiger Snapshot aller `.typ`- und `.bib`-Dateien zum Zeitpunkt
- **Wiederherstellen** stellt ein Backup in den Working-Tree zurueck (mit Bestaetigung — vorher Version speichern, falls du den jetzigen Stand nicht verlieren willst)
- Das **Zahnrad-Icon** an diesem Abschnitt oeffnet die Einstellungen: Backup-Intervall (10 s – 5 min), maximale Anzahl gespeicherter Backups (10 / 30 / 100 / 1000), maximale AI-Edit-Snapshots

### AI-Edit-Undo

Wenn ein externes Tool (ein KI-Agent, der MCP-Server, …) eine Datei im Projekt aendert, wird der vorherige Inhalt **vor** der Aenderung gesichert — fuer jede Datei, nicht nur fuer die gerade geoeffnete. Geh sie einzeln im Abschnitt **KI-Aenderungen** von **Verlauf & Wiederherstellen** zurueck (oder ueber den Menue-Eintrag **Undo AI Edit**). Snapshots ueberleben App-Neustarts (sie liegen in `.penwright/ai-snapshots/`), und die KI sieht genau dieselbe Liste: sie kann sie lesen und ihre eigene letzte Aenderung zuruecknehmen.

### Cloud-Backup (optional)

Der Versionsverlauf ist standardmaessig lokal. Wer ihn zu GitHub (oder einem beliebigen Git-Remote) pushen will — als externes Backup oder um auf einem zweiten Geraet zu arbeiten:

1. **Project**-Tab oeffnen, **Erweitert** ausklappen
2. Remote-URL einfuegen (z. B. `https://github.com/dein-user/deine-thesis.git`)
3. **Mit Cloud synchronisieren** (Push) und **Cloud-Backup laden** (Pull) nach Bedarf nutzen

Zwei Geraete parallel sind nicht abgesichert — immer nur ein Geraet zur Zeit.

---

## File Watcher

Externe Dateiaenderungen (z. B. durch einen KI-Agenten oder den MCP-Server) werden automatisch erkannt:
- Aktuelle Datei geaendert -> Editor updatet sofort
- `.bib` geaendert -> Citations werden neu geladen
- Dateien hinzugefuegt/geloescht -> File-Tree refresht
- Eigene Saves werden ignoriert (3s Schutzfenster)
- Der `.penwright/`-Ordner wird vom Watcher ausgeschlossen, damit Backups keine Refresh-Schleifen ausloesen

Zum Rueckgaengig-Machen von AI-Edits siehe Abschnitt [Versionen & Auto-Backup](#versionen--auto-backup).

---

## Rechtschreibpruefung

- **Automatisch aktiv:** nutzt den eingebauten Electron-Spellchecker (Hunspell)
- **Sprachsynchronisation:** Sprache wird aus `#set text(lang: "de")` im Typst-Dokument gelesen
- **Dynamischer Wechsel:** aendert sich mit der Dokumentsprache in den Document Settings
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
  - **Lizenz-Status**-Badge (Testphase: N Tage / Lizenziert / Gesperrt) — Klick oeffnet den Lizenz-Dialog
- Warnung beim Schliessen bei ungespeicherten AEnderungen
- **Crash Recovery:** Auto-Backups werden nach `<projekt>/.penwright/backups/<timestamp>/` geschrieben (Intervall konfigurierbar, Default 30 s). Wenn die App abstuerzt und das juengste Backup neuer ist als die zuletzt gespeicherte Datei auf der Platte, bietet Penwright beim Wiederoeffnen des Projekts an, den Backup-Stand zurueckzuholen. Details siehe [Versionen & Auto-Backup](#versionen--auto-backup).

---

## Persistenz

Penwright trennt zwei Arten von Zustand: **App-Einstellungen**, die global zur Installation gehoeren, und **Projekt-Zustand**, der mit jedem Projektordner mitwandert.

**Global** (im OS-User-Data-Ordner):
- Fenster-Position & -Groesse
- Panel-Zustaende (Sidebar/Preview offen/zu, Groessen, aktiver Tab)
- Recent Projects (die letzten 10 Projektordner — tote Eintraege werden automatisch gefiltert)
- Onboarding-Flag (Welcome-Screen "Don't show again")
- Zotero `.bib`-Pfad
- Auto-Backup-Konfiguration (Intervall, Max-Anzahl Backups, Max-AI-Snapshots)
- License-Key (verschluesselt im OS-Keychain)

**Pro Projekt** (im Projektordner):
- Versionsverlauf (`.git/`)
- Auto-Backups (`.penwright/backups/`)
- AI-Edit-Snapshots (`.penwright/ai-snapshots/`)
- Claude Code Skills (`.claude/skills/`)

Die App **startet immer am Start Screen** — kein Auto-Reopen. Bewusste Designentscheidung, damit das OEffnen von Penwright dich nie mit einem Projekt ueberrascht, mit dem du gar nicht arbeiten wolltest.

---

## Lizenz-Management

Penwright ist ein **Einmalkauf — 59 €**. Eine Lizenz, kein Abo, keine Stufen. **Ein Key (`pw_LIC…`) schaltet alles frei**, inklusive des MCP-Servers fuer die KI-Integration.

### Kostenlose Testphase

Beim ersten Start bekommst du eine **14-taegige lokale Testphase** mit vollem Funktionsumfang — ohne Key, ohne Account. Die Status Bar zeigt die verbleibenden Tage, ein schlanker Banner bietet **„Jetzt kaufen – 59 €"**. Laeuft die Testphase ab, wird Penwright hinter einem Kauf-Screen gesperrt, bis du einen Key eingibst.

### Lizenzstatus in der Status Bar

In der Status Bar (unten rechts) wird dein aktueller Status angezeigt:
- **Testphase: N Tage** — Testphase aktiv, N Tage verbleibend
- **Lizenziert** — ein gueltiger Key ist aktiv
- **Gesperrt** — Testphase abgelaufen, noch kein Key; die App ist gesperrt, bis du aktivierst

**Klick auf den Lizenzstatus** oeffnet den Lizenz-Dialog.

### Kaufen & aktivieren

1. **Kaufen** — der Kauf-Button (**„Jetzt kaufen – 59 €"** im Banner, **„Lizenz kaufen – 59 €"** auf dem Sperr-Screen) oeffnet direkt den **Polar-Checkout**. Nach der Zahlung bekommst du deinen `pw_LIC…`-Key per E-Mail.
2. **Aktivieren** — Lizenz-Dialog oeffnen (Klick auf den Lizenzstatus), Key einfuegen, bestaetigen. Er wird gegen **Polar** validiert und lokal gespeichert (verschluesselt im System-Keychain). Die Lizenz ist sofort aktiv und ein eventueller Sperr-Screen verschwindet.

### Offline-Nutzung

Einmal validiert, funktioniert Penwright ohne Internetverbindung. Es gilt eine **7-Tage Grace Period** — nach 7 Tagen ohne erneute Online-Validierung faellt die App zurueck in den Testphasen-/Sperr-Zustand, bis du wieder online bist. Die Offline-Grace verlaengert die Testphase nie.

### Sicherheit

Die Lizenzdaten werden mittels Electrons `safeStorage` verschluesselt im System-Keychain (macOS), DPAPI (Windows) oder libsecret (Linux) abgelegt. Der MCP-Server validiert denselben Key beim Start unabhaengig.

---

## About-Dialog

Erreichbar ueber:
- **macOS:** `Penwright -> About Penwright`
- **Windows/Linux:** `Help -> About Penwright`

Der Dialog zeigt:
- App-Version und Logo
- Aktuellen Lizenz-Status (Licensed / Unlicensed)
- System-Info: Platform + Architektur, Electron / Chromium / Node Versionen
- Links: User Guide, Website, Report Issue
- **Copy Diagnostics** — kopiert Version + Platform + Electron-Stack + Lizenz-Tier in die Zwischenablage. Hilfreich wenn du ein Issue meldest.

---

## MCP Server — KI-Integration mit Claude Desktop & Co.

Penwright enthaelt einen eingebauten MCP-Server (Model Context Protocol), mit dem externe KI-Anwendungen wie **Claude Desktop**, **Codex Desktop** oder **Clawdbot** direkt mit deinen Typst-Dokumenten arbeiten koennen — ohne das Terminal zu benutzen.

> **Hinweis:** Der MCP-Server laeuft mit einer **gueltigen Lizenz** — demselben `pw_LIC…`-Key wie die App (keine Stufen) — **oder waehrend der kostenlosen 14-taegigen Testphase**, dann in vollem Umfang. Er verweigert erst, wenn die Testphase abgelaufen ist und kein Key aktiv ist. Siehe [Lizenz-Management](#lizenz-management).

### Was kann der MCP-Server?

Die KI kann ueber den MCP-Server (66 Tools):
- **Ein komplettes Projekt aus einem Preset anlegen** (`penwright_list_presets` + `penwright_create_from_preset`) — designter Startpunkt inkl. Platzhalter-Text, statt bei null anzufangen; Magazin-Presets mit eigenem Layout pro Kapitel
- Typst-Dokumente oeffnen, lesen, bearbeiten und verifizieren (`compile` ist reiner Verifier; das Schreiben von Artefakten uebernehmen die Export-Tools)
- **Die Seite sehen.** `penwright_render_page` rendert eine Seite des kompilierten PDFs als Bild und gibt sie zurueck — die KI kann Abstaende, Ueberlaeufe, Farben und die Position einer Ueberschrift beurteilen, statt sie aus dem Quelltext zu erraten
- **Die Bausteine nachschlagen, die dein Projekt selbst definiert** (`penwright_list_project_macros`) — derselbe Katalog, den dir das ＋-Menue zeigt, begrenzt auf die Datei, in der gearbeitet wird
- Dokument-Einstellungen aendern (Schriftart, Groesse, Sprache, Raender …) und Style-Templates anwenden
- Kapitel und Bibliographie End-to-End verwalten (inkl. anker-basierter Inserts fuer Comments, Footnotes, Cross-References)
- Projektweite Suche und Bulk-Replace mit Versions-Sicherheitsnetz (Whole-Word funktioniert dank Lookarounds auch bei `@citekey`-Backlinks)
- Quell-PDFs in `sources/` per Citekey nachschlagen
- Versionen speichern / auflisten / anzeigen / wiederherstellen — im selben Vokabular wie das Project-Panel
- **Dasselbe Sicherheitsnetz lesen, das du siehst** — die automatischen Backups auflisten und lesen, die rueckgaengig machbaren Aenderungen auflisten und die letzte zuruecknehmen (`penwright_list_backups` / `read_backup` / `list_edits` / `undo_last_edit`). Ein Backup wiederherzustellen bleibt deine Entscheidung: die KI verweist dich auf „Verlauf & Wiederherstellen", statt alte Inhalte selbst zurueckzuschreiben
- PDF, druckfertiges PDF (Beschnitt + Schnittmarken) und DOCX exportieren (DOCX mit echten Word-Styles + Live-Multilevel-Numbering, rendert Abbildungen, Display-Math, Tabellen, Cross-References, Fussnoten und Callouts; reiner Design-Code wird uebersprungen)
- Markdown importieren und Bilder einfuegen (Content-Hash-Dedup + Figure-Builder)
- Die gesamte Design-Surface fernsteuern — Themes / Palettes / Layouts / Fonts wechseln, Design-Elemente (24 Stueck inkl. Drop-Cap, Pull-Quote-Varianten, Article-Opener, Section-Opener, Image-Galleries inkl. asymmetric, Image-Overlay, Stats-Box, Photo-Caption-Wrap, Magazine-Cover, Full-Bleed-Image, Spread-Opener, Margin-Note, Spread-Image) anker-basiert einfuegen, per-Chapter Section Styles (Magazin-Rubriken: feature / interview / essay / …) zuweisen, NL-Intents (`brochure` / `magazine` / `thesis` / …) auf passende Theme+Layout-Kombis mappen
- Zwischen Projekten wechseln, Git-Operationen ausfuehren, Skill-Prompts abfragen (typst-reference / penwright-conventions / research-workflow / writing-style / design-conventions)

**Dieselben Zusagen wie in der App.** Jede Design-Aenderung der KI wird zuerst in eine Zwischenkopie geschrieben, probeweise kompiliert und nur behalten, wenn das Dokument weiterhin kompiliert — sonst steht das Projekt exakt so da wie vorher, und du erfaehrst warum. Von jeder Datei, die die KI ueberschreibt, wird vorher der bisherige Inhalt gesichert, in dieselbe Liste **KI-Aenderungen**, die du in „Verlauf & Wiederherstellen" durchgehen kannst.

**Zwei Dinge haben bewusst kein Tool, statt still zu scheitern:** eine bestehende Baustein-Instanz zu bearbeiten (die Karte mit ihrem Formular gibt es, weil *du* kein Typst schreiben kannst — die KI schreibt es direkt), und den Web-Export (der liegt unter **Datei → Ins Web exportieren (HTML)… (HTML)…**, und die Export-Tools sagen das, damit die KI dich aufs Menue verweist).

### Einrichtung: Auto-Setup-Wizard (macOS & Windows)

Penwright bietet automatisch an, Claude Desktop zu verbinden — du musst keine JSON-Datei selbst editieren. Voraussetzungen:

- **Aktive Lizenz oder laufende Testphase** (siehe [Lizenz-Management](#lizenz-management)) — der MCP-Server lehnt erst ab, wenn die Testphase ohne Key abgelaufen ist
- **Claude Desktop installiert** unter `/Applications/Claude.app` bzw. `~/Applications/Claude.app` (macOS) oder am ueblichen `%LOCALAPPDATA%`-Ort (Windows)

**Ablauf:**

1. Wizard erscheint nach ein paar Sekunden automatisch (oder ueber `Hilfe → "Mit Claude Desktop verbinden…"`)
2. Klick auf **„Jetzt verbinden"**
3. Im Hintergrund:
   - Das Server-Binary wird aus dem .app-Bundle nach `~/Library/Application Support/Penwright/mcp-server/penwright-mcp` kopiert
   - `~/Library/Application Support/Claude/claude_desktop_config.json` bekommt einen `Penwright`-Eintrag — andere bestehende MCP-Server bleiben unangetastet, ein Backup deiner alten Config wird angelegt
   - Dein Lizenzschluessel wird als Umgebungsvariable (`PENWRIGHT_LICENSE_KEY`) in den Eintrag geschrieben
4. **Claude Desktop neu starten** — die Penwright-Tools erscheinen automatisch

**Standalone:** der MCP-Server laeuft als eigener Prozess, **unabhaengig von der Penwright-App**. Du kannst Penwright beenden, Claude weiterhin nutzen, Penwright spaeter wieder oeffnen — die Reihenfolge ist egal.

**Idempotenz:** wiederholtes Ausfuehren ist sicher — kein Duplikat-Eintrag. Falls du spaeter eine neue Lizenz aktivierst, fuehre den Wizard ueber das Hilfe-Menue nochmal aus, damit der neue Key in die Config geschrieben wird.

### Einrichtung: Manuell (Linux, oder Power-User)

Auf Linux gibt es kein Claude Desktop, deshalb laeuft der Wizard dort nicht. Auf macOS / Windows kannst du auch manuell konfigurieren, wenn du moechtest:

**Schritt 1:** Im Penwright-Repo das Server-Binary bauen (einmalig):

```bash
npm run build:mcp-binary       # nur Host-Arch
# oder
npm run build:mcp-binary:all   # arm64 + x86_64
```

Output: `dist/mcp/bin/penwright-mcp-<arch>` (~64 MB Single-File-Binary, kein Node noetig).

Alternativ kannst du den klassischen Node-Pfad nehmen (erfordert Node ≥ 20 auf der Maschine):

```bash
npm run build:mcp   # → dist/mcp/server.mjs
```

**Schritt 2:** Konfigurationsdatei oeffnen:

- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

**Schritt 3:** Penwright als MCP-Server eintragen. Mit Standalone-Binary (empfohlen):

```json
{
  "mcpServers": {
    "Penwright": {
      "command": "/PFAD/ZU/vswrite-desktop/dist/mcp/bin/penwright-mcp",
      "env": { "PENWRIGHT_LICENSE_KEY": "pw_LIC_xxx..." }
    }
  }
}
```

Oder via Node + `.mjs`:

```json
{
  "mcpServers": {
    "Penwright": {
      "command": "node",
      "args": ["/PFAD/ZU/vswrite-desktop/dist/mcp/server.mjs"],
      "env": { "PENWRIGHT_LICENSE_KEY": "pw_LIC_xxx..." }
    }
  }
}
```

**Schritt 4:** Claude Desktop neu starten.

### Benutzung

Nach dem Neustart sieht Claude die Penwright-Tools. Du kannst direkt in Claude Desktop sagen:

- *"OEffne mein Thesis-Projekt in /Users/.../my-thesis"*
- *"Zeig mir den Inhalt meines Typst-Dokuments"*
- *"AEndere die Schriftgroesse auf 12pt und die Sprache auf Englisch"*
- *"Kompiliere mein Dokument und zeig mir die Fehler"*
- *"Exportiere das Dokument als PDF nach ~/Desktop/thesis.pdf"*

Claude nutzt dafuer automatisch die Penwright-Tools im Hintergrund. Alle Pfade werden gegen das Projekt-Verzeichnis validiert — der Agent kann nicht versehentlich aus dem Projekt ausbrechen.

### Projekt wechseln

Du musst die Config **nicht** jedes Mal aendern, wenn du das Projekt wechselst. Sag Claude einfach:

*"Wechsle zum Projekt /Users/.../anderes-projekt"*

Claude ruft dann `penwright_set_project` auf und arbeitet ab sofort mit dem neuen Projekt.

### Verfuegbare Tools (66)

Volle Referenz mit Parameter-Schemata, Return-Shapes und End-to-End-Workflow-Beispielen liegt in [mcp-server.md](mcp-server.md). Hier alle 66 Tools mit Ein-Satz-Beschreibung, gruppiert nach Kategorie:

**Projekt & Dateien (5)**

- `penwright_set_project` — Setzt das aktive Projekt-Verzeichnis; auto-detected `main.typ` / `document.typ`. Muss als Erstes aufgerufen werden.
- `penwright_list_files` — Liefert den Projekt-Dateibaum (`.typ`, `.bib`, `.md`, `.yaml`, `.json`, `.pdf`, Bilder).
- `penwright_read_file` — Liest eine Datei im Projekt; Text-Inhalt als String, Binaer-Dateien als Base64.
- `penwright_write_file` — Schreibt Inhalt in eine Datei im Projekt; erzeugt Parent-Ordner automatisch.
- `penwright_create_project` — Legt ein neues Typst-Projekt aus einer Vorlage an (`document`, `thesis`, `paper`, `letter`, `book`, `magazine`). Die `magazine`-Vorlage ist fuer die [ai-magazine-designer](https://github.com/renejes/ai-magazine-designer)-Pipeline.

**Presets — fertige Projekt-Starter (2)**

- `penwright_list_presets` — Listet alle Built-in-Presets (fertige, designte Projekte mit Platzhalter-Text) auf — `id` / `type` / `label` / `tagline`, optional nach `type` gefiltert (magazine, report, cookbook, portfolio, thesis …).
- `penwright_create_from_preset` — Legt ein neues Projekt aus einem Preset an: kopiert den kompletten Ordner (Design + Makros + Assets + Lorem), `git init`, wechselt auf die Startdatei. Bevorzugt gegenueber `create_project`, wenn ein designter Startpunkt gewuenscht ist — Magazin-Presets bringen pro Kapitel ein eigenes Layout mit.

**Dokument-Operationen (5)**

- `penwright_get_document` — Liefert das aktuelle Dokument (Inhalt, Pfad, Projekt-Verzeichnis, Word-Count).
- `penwright_open_file` — OEffnet eine `.typ`-Datei als aktuelles Dokument; Pfad absolut oder projekt-relativ.
- `penwright_update_document` — Ersetzt den Inhalt des aktuellen Dokuments und speichert auf Disk.
- `penwright_compile` — Verifiziert dass das Dokument fehlerfrei kompiliert; nur PDF, Artefakt wird wieder geloescht — fuer Real-Output `export_pdf` / `export_docx` benutzen.
- `penwright_render_page` — Rendert eine Seite des kompilierten PDFs als Bild und gibt sie zurueck, damit die KI das Layout *sieht* statt es aus dem Quelltext zu erschliessen. Max. 2 Seiten pro Aufruf.

**Settings (2)**

- `penwright_get_settings` — Liest die Document-Settings (Sprache + Bibliographie-Stil; alles andere lebt seit Phase A im Design-Editor).
- `penwright_update_settings` — Aendert Document-Settings; nur uebergebene Keys werden modifiziert.

**Design (16) — Themes, Layouts, Palette, Fonts, Elements, Section Styles, Selection-Handoff**

Die strukturierte Design-Surface — der visuelle Look-Designer (öffne `style.typ`). Schreibt direkt nach `.penwright/style.json`, regeneriert `style.typ`, stellt sicher dass die Root-`.typ`-Datei `#import "style.typ": *` + `#show: apply-style` ganz oben hat. Theme-/Layout-Swaps preservieren `style.custom.preamble` (User-Escape-Hatch-Code) und `style.sections` (per-Chapter Section Styles).

- `penwright_get_style` — Liefert das vollstaendige `ProjectStyle`-JSON (colors / fonts / scale / layout / headings / elements / custom).
- `penwright_update_style` — Partial-Patch mit Deep-Merge und Per-Leaf-Sanitizer; ungueltige Werte fallen auf den alten zurueck.
- `penwright_list_styles` — Listet die sechs Built-in-Themes (Classic Academic, Modern Tech, Editorial Magazine, Minimal, Marketing Brochure, Thesis).
- `penwright_apply_style` — Wendet ein Theme an; ersetzt colors/fonts/scale/layout/headings/elements, behaelt `custom.preamble`.
- `penwright_list_layouts` — Liefert die acht Layout-Presets (A4 portrait/landscape, Magazine 2-col, Newsletter 3-col, A5 Booklet, Magazine Editorial, A2 Poster, Magazin (Druck) · A4 + 5 mm Beschnitt).
- `penwright_apply_layout` — Tauscht nur `layout.*` (+ optional `scale.base`) — Theme, Farben, Fonts bleiben.
- `penwright_list_fonts` — Liefert die sieben gebuendelten OFL-Fonts mit family / category / description.
- `penwright_apply_palette` — Setzt die 5-Farb-Palette via `presetId` oder per-Slot-Hex-Overrides (kombinierbar).
- `penwright_list_design_elements` — Library der **24** parametrischen Snippets inkl. Param-Beschreibung — Banner, Sidebar, Pull-Quote (regular / Display / Block), Callout, Hero, Divider (regular / Asterisks / Ornament), Drop-Cap, Article-Opener, Section-Opener, Gallery 2-up / 3-up / asymmetric, Image-Overlay, Stats-Box, Photo-Caption-Wrap, Magazine-Cover, Full-Bleed-Image, Spread-Opener, Margin-Note, Spread-Image.
- `penwright_insert_design_element` — Fuegt ein Element an einem Anker ein; Snippets referenzieren `style-colors.*` / `style-fonts.*` und re-themen automatisch.
- `penwright_generate_layout` — Hoch-Level-NL-Komposit: `intent: "magazine"` waehlt z.B. Editorial-Theme + Magazine-Editorial-Layout + optionalen Hero.
- `penwright_list_section_styles` — Per-Chapter-"Rubriken": die fuenf Presets (feature / interview / essay / photo-essay / department), die definierten Varianten + welche Kapitel welche nutzen.
- `penwright_define_section_style` — Section-Overlay anlegen/aendern (aus Preset und/oder explizite accent / fonts / columns / heading-Overrides); regeneriert ein `#let <id>-style` pro Variante.
- `penwright_apply_section_style` — Variante einem Kapitel zuweisen (injiziert das scoped `#show`; auto-definiert Preset falls noetig). Restyled nur dieses Kapitel; Page-Geometrie bleibt dokument-level.
- `penwright_clear_section_style` — Section-Opt-in aus einem Kapitel entfernen.
- `penwright_get_selection` — Design-with-AI-Handoff: liest die gepinnte Editor-Auswahl aus `.penwright/selection.json` (Anker-Text + Occurrence + Design-Snapshot); der Agent handelt an der Anker-Stelle, der Watcher loescht den Pin nach der externen Aenderung.

**Kapitel & Struktur (6)**

- `penwright_get_chapters` — Liefert die `#include`-Struktur (Reihenfolge, Pfade, ob Dateien existieren).
- `penwright_reorder_chapters` — Aendert die Reihenfolge der `#include`-Statements im Hauptdokument.
- `penwright_add_chapter` — Legt eine neue Kapitel-Datei in `chapters/` an und fuegt einen `#include` ein.
- `penwright_remove_chapter` — Entfernt einen `#include`-Eintrag aus dem Hauptdokument; die Datei selbst bleibt.
- `penwright_merge_document` — Loest alle `#include`-Statements rekursiv auf und liefert das fertige Gesamtdokument als String (read-only).
- `penwright_split_document` — Splittet das aktuelle Dokument an `=` Heading-1-Grenzen in einzelne Kapitel-Dateien.

**Bibliographie & Citations (3)**

- `penwright_get_citations` — Liefert alle BibTeX-Eintraege aus den `.bib`-Dateien im Projekt.
- `penwright_add_citation` — Fuegt einen BibTeX-Eintrag zu `references.bib` hinzu; legt Datei und `#bibliography`-Statement bei Bedarf an.
- `penwright_ensure_bibliography` — Stellt sicher dass das Projekt eine `references.bib` und einen `#bibliography`-Eintrag hat.

**Cross-References, Footnotes & Bausteine (4)**

- `penwright_list_project_macros` — Liefert die Bausteine, die dieses Projekt selbst definiert (seine eigenen `#let`-Makros), mit Parametern, dem Kommentar darueber als Label und dem Fundort. Mit `targetFile` nur das, was dort aufrufbar ist.
- `penwright_list_labels` — Liefert alle `<label>`-Definitionen im Projekt mit Typ-Klassifikation (figure / table / equation / heading / other) und Caption-Vorschau.
- `penwright_insert_reference` — Fuegt eine Typst-Cross-Reference (`@label`) an einem Anker ein; validiert dass das Label existiert und schlaegt aehnliche vor.
- `penwright_add_footnote` — Fuegt eine Typst-Footnote (`#footnote[…]`) an einem Anker ein; mit Klammer-Balance-Check fuer den Body.

**Comments & Annotations (4)**

- `penwright_list_comments` — Listet alle Penwright-Comments (oder nur die einer Datei); Comments leben als `.md`-Dateien in `comments/` und werden nie kompiliert.
- `penwright_add_comment` — Legt einen Comment an einem Verbatim-Anker an; generiert ID, Frontmatter und Offset-Hints.
- `penwright_resolve_comment` — Markiert einen Comment als „erledigt" (oder hebt das wieder auf); Eintrag bleibt im Projekt erhalten.
- `penwright_delete_comment` — Loescht einen Comment endgueltig (entfernt die `.md`-Datei).

**Versionen, Backups & Rueckgaengig (8) — entspricht „Verlauf & Wiederherstellen"**

- `penwright_save_version` — Speichert eine benannte Version (Git-Commit); initialisiert das Repo falls noch keins da ist; lokal-only, kein Push.
- `penwright_list_versions` — Liefert die Versions-Historie (max. 200, neueste zuerst) inkl. `isAuto`-Flag fuer Penwright-interne Auto-Versionen.
- `penwright_show_version` — Zeigt den Per-File-Diff einer Version (added/modified/deleted/renamed + Unified-Diff-Hunks).
- `penwright_restore_version` — Stellt Dateien aus einer historischen Version wieder her; vorher selbst eine Version speichern!
- `penwright_list_backups` — Listet die automatischen Backups des Projekts (zeitgesteuerte Snapshots aller Textdateien, neueste zuerst) — das Absturz-Netz, verschieden von Versionen und von Edit-Snapshots.
- `penwright_read_backup` — Liest, was in einem Backup steckt: die Dateiliste oder den Inhalt einer Datei. Nur lesend — das Wiederherstellen bleibt deine Entscheidung in „Verlauf & Wiederherstellen".
- `penwright_list_edits` — Listet die rueckgaengig machbaren Edit-Snapshots: den vorherigen Stand jeder Datei, die Penwright oder der Server ueberschrieben hat, neueste zuerst. Dieselbe Liste wie der Abschnitt **KI-Aenderungen**.
- `penwright_undo_last_edit` — Stellt den neuesten Edit-Snapshot wieder her, fuer eine Datei oder fuer das zuletzt Geschriebene. Mehrfach aufrufen, um weiter zurueckzugehen.

**Discovery — Suche & Quellen (3)**

- `penwright_search_project` — Sucht in allen `.typ`-Dateien (optional `.bib`); whole-word funktioniert dank Lookarounds auch bei `@citekey`-Backlinks; max. 1000 Treffer.
- `penwright_replace_in_project` — Ersetzt alle Vorkommen einer Suche projektweit; **destruktiv** — vorher `save_version` aufrufen.
- `penwright_find_source_for_citation` — Sucht ein PDF in `sources/` das zum Citekey passt (`<citekey>.pdf` bevorzugt, Suffix-Varianten erlaubt).

**Export (3)**

- `penwright_export_pdf` — Kompiliert und exportiert als PDF; Output-Pfad muss im Projekt liegen, Konvention `exports/<name>.pdf`.
- `penwright_export_print` — Exportiert ein PDF fuer die Druckerei: uebergrosse Seite mit Beschnitt, Schnittmarken in den Ecken, Doppelseiten mit Bundzuwachs. RGB — die Druckerei konvertiert nach CMYK. Nur das ganze Dokument; die Kapitelauswahl liegt im Export-Dialog der App. Schreibt nur temporaere Dateien und aendert das Projekt-Design nie.
- `penwright_export_docx` — Exportiert als DOCX mit echten Word-Styles (Heading1-6, Quote, CodeBlock, Caption …) und Live-Multilevel-Numbering — der Betreuer kann in Word umordnen und die Nummern aktualisieren sich. Rendert auch die reichen Konstrukte: Abbildungen → Bild + „Abbildung N"-Caption, `#figure(table())` → echte Word-Tabelle, Display-Math + SVG → Bilder via gebundeltem Typst, `@fig/@tbl/@eq`-Cross-Refs → aufgeloest, Fussnoten → echte Word-Fussnoten, Callouts → Akzent-Box; reiner Design-/Layout-Code wird uebersprungen statt geleakt (DOCX = Manuskript, PDF = Design).

**Import & Assets (2)**

- `penwright_import_markdown` — Konvertiert Markdown zu Typst und schreibt in eine Projekt-Datei; inline-Markdown oder `srcPath` zu einer `.md`-Datei.
- `penwright_add_image` — Importiert ein Bild nach `assets/` (Content-Hash-Dedup), baut den Typst-Snippet (mit optionaler Caption + Label → `#figure(…)`) und kann ihn direkt am Anker einfuegen.

**Git Low-Level (3) — fuer Sync mit Remote**

- `penwright_git_status` — Liefert Branch, ahead/behind und geaenderte Dateien.
- `penwright_git_commit` — Stagt alle Aenderungen und committet mit der gegebenen Message.
- `penwright_git_push` — Pusht commits zum Remote-Repository.

Alle datei-beruehrenden Tools laufen ueber `resolveInsideProject` — symlink-aware, blockiert `../`-Traversal. Anker-basierte Tools (`add_comment` / `insert_reference` / `add_footnote` / `add_image`) nehmen einen `afterText`/`anchor` plus optional einen 1-basierten `occurrence`, wenn der Anker mehrfach vorkommt — der Agent muss keine Offsets selbst berechnen.

Der MCP-Server bietet zusaetzlich fuenf **Prompts** (`typst-reference`, `penwright-conventions`, `research-workflow`, `writing-style`, `design-conventions`), gespeist aus den deployed `.claude/skills/<name>/SKILL.md`-Dateien:

- **typst-reference** — Typst-Sprachreferenz (Syntax, Math, Layout, Cross-Refs, Footnotes, Bibliographie, gebuendelte Packages mit Code-Beispielen).
- **penwright-conventions** — Projekt-Konventionen (Ordnerstruktur, Persistenz-Schichten, Design-Surface, Comments, Cross-Refs, Mode-Toggles).
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
| Sidebar ein/aus | `Cmd+Alt+B` |
| Preview ein/aus | `Cmd+Shift+P` |
| Rueckgaengig | `Cmd+Z` |
| Wiederholen | `Cmd+Shift+Z` |
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

Sollte Penwright einmal abstuerzen, schreibt die App lokal einen Bericht im Klartext:

- Was fuer ein Fehler aufgetreten ist
- Stack-Trace mit Datei + Zeile
- Deine letzten Aktionen (Bearbeitungs-Schritte, keine Inhalte)
- App-, OS- und Versions-Informationen

Beim naechsten Start oeffnet sich automatisch ein Dialog mit dem Bericht — du entscheidest selbst, was passiert: **In Zwischenablage kopieren**, **E-Mail vorbereiten** (oeffnet deinen Mail-Client mit `feedback@penwright.online` vorausgefuellt), **Ordner oeffnen** (zeigt alle gespeicherten Berichte im Finder) oder **Verwerfen** (loescht sie).

**Was Penwright NICHT tut:** Daten automatisch ins Internet senden. Es gibt keine externe Crash-Telemetrie, keinen Account-Login, keinen Server der mitliest. Berichte bleiben auf deinem Rechner, bis du sie aktiv weitergibst.

**Was anonymisiert wird:** Pfade wie `/Users/<Vorname>/...` werden vor dem Schreiben durch `/Users/<redacted>/...` ersetzt. Datei-Inhalte landen nie in den Berichten — nur Datei-**Endungen** und Aktions-Typen (etwa „Datei gespeichert", „Projekt geoeffnet").

**Spaeter wieder oeffnen:** Hilfe → Absturzberichte öffnen oeffnet den Ordner mit allen gespeicherten Berichten.

---

## Updates

Penwright aktualisiert sich **nicht** automatisch. Die installierte Version siehst du im About-Dialog.

Neue Versionen werden ueber den **Penwright-Newsletter** angekuendigt; die aktuelle Version laedst du von [penwright.online](https://penwright.online) und ersetzt deine installierte Kopie. Deine Projekte sind in sich abgeschlossen (alles liegt im Projektordner), ein App-Update fasst deine Arbeit also nie an.

---

## Hilfe & Support

- **User Guide (dieses Handbuch):** jederzeit im App-Menue unter **Help -> User Guide** — es ist in die App eingebaut, kein Internet noetig
- **Bugs / Feature-Wuensche:** [github.com/renejes/vswrite-desktop/issues](https://github.com/renejes/vswrite-desktop/issues) — oder im App-Menue unter **Help -> Report Issue**
- **Website:** [penwright.online](https://penwright.online)

Wenn du einen Bug meldest, hilft es sehr, im About-Dialog **"Copy Diagnostics"** zu klicken und den Output mit ins Issue zu packen — damit sieht man auf einen Blick Version, Plattform und Lizenz-Stufe.
