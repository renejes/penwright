# vswrite — Handbuch

> **Version:** 0.0.1
> **Letzte Aktualisierung:** 2026-03-22

---

## Was ist vswrite?

vswrite verwandelt VS Code in einen visuellen Texteditor für Typst-Dateien. Statt Markup-Code zu sehen, arbeitest du in einem WYSIWYG-Editor — ähnlich wie in Google Docs oder Notion. Gleichzeitig bleibt die volle Typst-Funktionalität erhalten: Mathe-Formeln, Konfiguration und Layout werden als bearbeitbare Code-Blöcke angezeigt.

---

## Erste Schritte

### Voraussetzungen

- **VS Code** 1.85 oder neuer
- **Node.js** + npm (zum Bauen der Extension)
- **Typst CLI** (optional, für Live-Preview): `brew install typst`

### Extension starten (Entwicklungsmodus)

1. Terminal öffnen im Projektordner
2. `npm install` (einmalig)
3. `npm run build`
4. F5 drücken → Extension Development Host öffnet sich
5. Eine `.typ`-Datei öffnen → WYSIWYG-Editor erscheint

---

## Der Editor

### Toolbar

Die Toolbar oben bietet schnellen Zugriff auf alle Formatierungen:

| Button | Funktion | Shortcut |
|--------|----------|----------|
| **B** | Fett | `Cmd+B` |
| *I* | Kursiv | `Cmd+I` |
| ~~S~~ | Durchgestrichen | `Cmd+Shift+X` |
| `</>` | Inline-Code | `Cmd+E` |
| Link-Symbol | Link einfügen/bearbeiten | `Cmd+K` |
| H1 / H2 / H3 | Überschriften | `Cmd+Alt+1/2/3` |
| • | Aufzählung | `Cmd+Shift+8` |
| 1. | Nummerierte Liste | `Cmd+Shift+7` |
| " | Zitat (Blockquote) | `Cmd+Shift+B` |
| { } | Code-Block | `Cmd+Alt+C` |
| — | Horizontale Linie | — |
| ◀ | Linksbündig | `Cmd+Shift+L` |
| ▐ | Zentriert | `Cmd+Shift+E` |
| ▶ | Rechtsbündig | `Cmd+Shift+R` |
| ≡ | Blocksatz | `Cmd+Shift+J` |
| ↩ / ↪ | Rückgängig / Wiederholen | `Cmd+Z` / `Cmd+Shift+Z` |
| ⚙ | Quick-Settings (Font, Spacing, Sprache) | — |
| … | Typewriter Mode ein/aus | — |
| ◎ | Focus Mode ein/aus | — |
| ☰ | Aktions-Menü (Command Hub) | — |

### Aktions-Menü (Command Hub)

Rechts in der Toolbar befindet sich der ☰-Button (Hamburger-Menü). Ein Klick öffnet ein Dropdown mit **allen** verfügbaren Aktionen — gruppiert nach Kategorie:

- **Insert** — Überschriften, Listen, Zitat, Code Block, Math-Formel, Typst Code, Bild, Linie
- **Format** — Fett, Kursiv, Durchgestrichen, Inline-Code, Link, Textausrichtung (Links/Zentriert/Rechts/Blocksatz)
- **View** — Focus Mode, Suchen & Ersetzen
- **File** — PDF/DOCX exportieren, Dokument-Einstellungen, Dokument zusammenführen (Merge), Kapitel aufteilen (Split), Als Typst Source öffnen, Neues Projekt, Neue Typst-Datei
- **Style Templates** — 7 visuelle Vorlagen (Classic Academic, Modern Clean, Minimal, Vibrant, Elegant, Professional Report, Artsy)
- **Help** — Keyboard Shortcuts (Cheatsheet)

Jeder Eintrag zeigt den zugehörigen Shortcut (falls vorhanden). Das Menü schließt sich nach Auswahl oder mit Escape.

**Für wen?** Das Aktions-Menü macht alle Features auffindbar — auch ohne Shortcuts oder VS Code Command Palette zu kennen.

### Slash Commands

Tippe `/` an einer leeren Stelle im Editor. Ein Dropdown-Menü erscheint mit folgenden Befehlen:

| Befehl | Beschreibung |
|--------|-------------|
| `/Heading 1` | Große Überschrift |
| `/Heading 2` | Mittlere Überschrift |
| `/Heading 3` | Kleine Überschrift |
| `/Bullet List` | Aufzählung |
| `/Numbered List` | Nummerierte Liste |
| `/Quote` | Blockquote |
| `/Code Block` | Code-Block |
| `/Divider` | Horizontale Linie |
| `/Math` | Typst Mathe-Block einfügen |
| `/Typst Code` | Roher Typst-Code einfügen |
| `/Image` | Bild einfügen (öffnet Datei-Auswahl) |

- **Filtern:** Einfach weitertippen nach `/` um die Liste zu filtern
- **Navigation:** Pfeiltasten hoch/runter, Enter zum Auswählen
- **Abbrechen:** Escape oder Backspace

### Links

- **Einfügen:** Text markieren → `Cmd+K` → URL eingeben → Enter
- **Bearbeiten:** Cursor auf den Link setzen → `Cmd+K` → URL ändern
- **Entfernen:** Cursor auf den Link setzen → `Cmd+K` → URL löschen → Enter
- **Toolbar:** Link-Button (Kettensymbol) in der Toolbar

### Bilder

Bilder können auf vier Wegen eingefügt werden:

1. **Slash Command:** `/Image` tippen → Datei-Auswahl öffnet sich → Bild wählen
2. **Aktions-Menü:** ☰ → Insert → Image
3. **Drag & Drop:** Eine Bilddatei vom Finder oder aus dem VS Code Explorer direkt in den Editor ziehen
4. **Einfügen (Paste):** Ein Bild aus der Zwischenablage mit `Cmd+V` einfügen

**Was passiert im Hintergrund:**
- Das Bild wird automatisch in einen `assets/`-Ordner neben der `.typ`-Datei kopiert
- Bilder die bereits im Dokumentverzeichnis liegen werden nicht dupliziert — der relative Pfad wird direkt verwendet
- Im Typst-Code wird `#image("assets/dateiname.png")` eingefügt
- Im Editor erscheint das Bild als Vorschau mit dem Dateipfad darunter
- Falls ein Bild nicht geladen werden kann, wird ein Platzhalter mit dem Pfad angezeigt

**Unterstützte Formate:** PNG, JPG, JPEG, GIF, SVG, WebP, BMP, ICO

**Breiten-Angabe:** Wenn im Typst-Code eine Breite angegeben ist (z.B. `#image("bild.png", width: 80%)`), wird diese beim Round-Trip beibehalten.

**Bild-Dialog:** Klicke auf ein Bild im Editor, um den Bild-Dialog zu öffnen:

| Einstellung | Optionen |
|-------------|----------|
| **Breite** | Presets: 25%, 50%, 75%, 100% — oder Custom-Eingabe (z.B. 60%, 8cm, auto) |
| **Alt-Text** | Bildbeschreibung für Barrierefreiheit |
| **Ausrichtung** | Links, Zentriert, Rechts |

Änderungen werden sofort übernommen und in der Preview sichtbar. Der Dialog schließt sich mit Klick außerhalb oder Escape.

### Textausrichtung

Absätze und Überschriften können linksbündig, zentriert, rechtsbündig oder als Blocksatz ausgerichtet werden.

**Shortcuts:**

| Ausrichtung | Shortcut |
|-------------|----------|
| Linksbündig | `Cmd+Shift+L` |
| Zentriert | `Cmd+Shift+E` |
| Rechtsbündig | `Cmd+Shift+R` |
| Blocksatz | `Cmd+Shift+J` |

**Toolbar:** 4 Ausrichtungs-Buttons zwischen den Listen-Buttons und der horizontalen Linie.

**Im Typst-Code:** Zentrierter und rechtsbündiger Text wird als `#align(center)[...]` bzw. `#align(right)[...]` gespeichert. Linksbündig ist der Standard und benötigt keinen Wrapper. Blocksatz wird über `#set par(justify: true)` in den Dokument-Einstellungen gesteuert.

### Raw Blocks (Typst-Code)

Nicht jeder Typst-Code kann visuell dargestellt werden. Mathe-Formeln, Seiteneinstellungen, eigene Funktionen etc. erscheinen als **Raw Blocks** — bearbeitbare Code-Felder direkt im Editor.

**Typen und ihre Farben:**

| Typ | Label-Farbe | Beispiel |
|-----|-------------|---------|
| Math | Lila | `$ E = m c^2 $` |
| Configuration | Blau | `#set text(size: 12pt)` |
| Code | Orange | `#let greeting = "Hallo"` |
| Comment | Grün | `// Dies ist ein Kommentar` |

**Bearbeiten:** Klicke in den Raw Block und bearbeite den Typst-Code direkt. Der Code wird 1:1 in die `.typ`-Datei übernommen — kein Datenverlust, keine Veränderung.

**Block verlassen:** Klicke auf den **✓ Done** Button am unteren Rand des Blocks. Es wird eine neue Zeile unter dem Block erstellt und der Cursor springt dorthin.

**Einfügen:** Nutze die Slash Commands `/Math` oder `/Typst Code` um einen neuen Raw Block zu erstellen.

---

## Dokument-Einstellungen

Statt Typst-Konfiguration per Code zu schreiben, bietet vswrite ein grafisches Settings-Panel.

### Öffnen

- **Aktions-Menü:** ☰ → File → Document Settings

### Verfügbare Einstellungen

| Kategorie | Einstellung | Beispiel |
|-----------|------------|---------|
| **Text** | Schriftart | Arial, Georgia, New Computer Modern, ... |
| | Schriftgröße | 11pt, 12pt |
| | Sprache | Deutsch, English, Français, ... |
| **Seite** | Papierformat | a4, a5, us-letter, ... |
| | Seitenränder | 2.5cm, 1in |
| | Seitenzahlen | 1, 2, 3 / 1 / 1 (mit Gesamt) / i, ii, iii (roman) / ... |
| | Header | Freier Text für Kopfzeile |
| | Footer | Freier Text für Fußzeile |
| | Spalten | 1, 2, 3 |
| | Seitenhintergrund | Weiß, Hellgrau, Ivory, Warm Cream, Cool Blue |
| **Absatz** | Zeilenabstand | 0.65em, 1em |
| | Absatzabstand | 1.2em |
| | Erstzeileneinzug | 1em, 0pt |
| **Überschriften** | Nummerierung | 1. 2. 3. / 1.1 1.2 / I. II. III. |
| **Bibliographie** | Zitierstil | APA, IEEE, MLA, Chicago, Nature, ... (14 Stile) |

### So funktioniert's

- Änderungen im Panel werden als `#set text(...)`, `#set page(...)`, etc. in die `.typ`-Datei geschrieben
- Wenn die Datei bereits `#set`-Blöcke enthält, werden diese erkannt und im Panel angezeigt
- Bestehende Einstellungen werden beim Speichern aktualisiert (nicht dupliziert)
- **Bibliographie-Stil in Multi-File Projekten:** Wenn die `#bibliography(...)` in einer inkludierten Datei steht (z.B. in `main.typ`), wird der Stil trotzdem korrekt erkannt und kann über das Settings-Panel geändert werden
- **Apply** klicken um Änderungen zu übernehmen, **Cancel** oder **Escape** zum Abbrechen

### Wichtig für Multi-File Projekte

In Projekten mit mehreren Dateien (`main.typ` + `chapters/`) sollte der `#bibliography(...)`-Befehl immer in der **Root-Datei** (`main.typ`) stehen, nicht in den Kapitel-Dateien. Kapitel-Dateien sollten nur Inhalt enthalten.

---

## Kapitel-Übersicht (Sidebar)

Im Explorer-Panel von VS Code (linke Seite) erscheint ein **Headings**-Bereich wenn eine `.typ`-Datei geöffnet ist.

### Was wird angezeigt?

- Alle Überschriften (`= Heading 1`, `== Heading 2`, `=== Heading 3`) als Baumstruktur
- Verschachtelte Hierarchie: H1 enthält H2, H2 enthält H3
- Zeilennummer neben jedem Eintrag

### Navigation

- **Klick** auf eine Überschrift → Editor scrollt zur entsprechenden Stelle im WYSIWYG-Editor
- Funktioniert sowohl im vswrite-Editor als auch im Standard-Texteditor (Fallback)
- Die Ansicht aktualisiert sich automatisch beim Schreiben

### Icons

| Heading-Level | Icon |
|--------------|------|
| H1 | Klassen-Symbol |
| H2 | Methoden-Symbol |
| H3+ | Feld-Symbol |

---

## Include-Manager (Sidebar)

Im Explorer-Panel erscheint ein **Includes**-Bereich wenn eine `.typ`-Datei geöffnet ist. Er zeigt alle `#include`-Statements und erlaubt Kapitel per Drag & Drop neu zu ordnen.

### Was wird angezeigt?

- Alle `#include "..."` Einträge der aktiven `.typ`-Datei
- Dateiname als Titel, relativer Pfad als Beschreibung
- Fehlende Dateien werden mit Warning-Icon markiert

### Kapitel umordnen

- **Drag & Drop:** Kapitel im Baum ziehen → `#include`-Reihenfolge in der Datei wird automatisch aktualisiert
- **↑ / ↓ Buttons:** Inline-Buttons neben jedem Eintrag zum Verschieben

### Kapitel hinzufügen

- **(+) Button** in der Titelleiste → zwei Optionen:
  - **Bestehende Datei hinzufügen:** `.typ`-Datei auswählen → `#include` wird am Ende eingefügt
  - **Neues Kapitel erstellen:** Name eingeben → Datei wird in `chapters/` erstellt und `#include` eingefügt

### Kapitel entfernen

- **Rechtsklick** → "Remove Include" → bestätigen → `#include`-Zeile wird aus der Datei entfernt

### Kapitel öffnen

- **Doppelklick** auf einen Eintrag → inkludierte Datei wird im Editor geöffnet

---

## Dokument zusammenführen (Merge)

Wenn ein Projekt aus mehreren Dateien besteht (z.B. `main.typ` mit `#include "chapters/01.typ"`), können alle Kapitel zu einem Dokument zusammengeführt werden.

### Öffnen

- **Aktions-Menü:** ☰ → File → Merge Document
- **Command Palette:** `Cmd+Shift+P` → `vswrite: Merge Document`

### Optionen

Nach dem Aufruf erscheint ein Quick-Pick mit drei Optionen:

| Option | Beschreibung |
|--------|-------------|
| **Merge → neue .typ Datei** | Alle `#include`-Statements werden durch den tatsächlichen Dateiinhalt ersetzt. Ergebnis wird als neue Datei gespeichert. |
| **Merge → PDF** | Kompiliert die `main.typ` direkt zu PDF. Typst löst die `#include`-Statements automatisch auf. |
| **Merge → Clipboard** | Der zusammengeführte Inhalt wird in die Zwischenablage kopiert. |

### Hinweise

- `#include`-Statements werden **rekursiv** aufgelöst (Kapitel können weitere `#include` enthalten)
- Zirkuläre Includes werden erkannt und mit einem Kommentar markiert
- Fehlende Dateien werden mit einem Kommentar markiert (`// [file not found: ...]`)
- Jedes eingebundene Kapitel erhält einen Trenn-Kommentar (`// ─── kapitel.typ ───`)

---

## Neues Projekt erstellen

### Öffnen

- **Aktions-Menü:** ☰ → File → New Project
- **Command Palette:** `Cmd+Shift+P` → `vswrite: New Project`

### Ablauf

1. **Template wählen** — 5 Vorlagen zur Auswahl:

| Template | Beschreibung |
|----------|-------------|
| **Document** | Einfaches Dokument (eine Datei) |
| **Thesis** | Wissenschaftliche Arbeit mit Kapiteln, Literaturverzeichnis |
| **Paper** | Akademisches Paper (Abstract, Sections, References) |
| **Letter** | Brief-Template |
| **Book** | Buch mit Kapitelstruktur |

2. **Projektname eingeben** — Wird als Ordnername verwendet
3. **Speicherort wählen** — Wo der Ordner erstellt werden soll
4. **Projekt wird erstellt** — Ordnerstruktur mit allen Dateien
5. **Ordner wird geöffnet** — VS Code wechselt zum neuen Projekt

### Projektstruktur (Beispiel: Thesis)

```
meine-thesis/
├── main.typ              # Hauptdatei mit #include-Statements
├── chapters/
│   ├── introduction.typ
│   ├── methods.typ
│   ├── results.typ
│   └── conclusion.typ
├── assets/               # Ordner für Bilder
└── bibliography.bib      # Literaturverzeichnis
```

---

## Neue Typst-Datei erstellen

- **Aktions-Menü:** ☰ → File → New Typst File
- **Command Palette:** `Cmd+Shift+P` → `vswrite: New Typst File`

Dateiname eingeben (ohne `.typ`) → Die Datei wird im aktuellen Workspace erstellt. Aus dem Dateinamen wird automatisch eine Überschrift generiert (z.B. `chapter-01` → `= Chapter 01`).

---

## Live-Preview

Wenn Typst CLI installiert ist (`typst --version` zum Prüfen), öffnet sich automatisch ein Preview-Panel rechts neben dem Editor.

- **Automatisch:** Die Preview aktualisiert sich nach einer konfigurierbaren Verzögerung (Standard: 2 Sekunden nach dem letzten Tastendruck)
- **Format:** SVG-Seiten auf dunklem Hintergrund (wie ein PDF-Viewer)
- **Tab-Sync:** Beim Wechsel zwischen `.typ`-Dateien folgt das Preview-Panel automatisch dem aktiven Editor
- **Scroll-Erhaltung:** Die Scroll-Position im Preview bleibt bei Recompile erhalten — kein Zurückspringen zum Anfang
- **Fehler:** Kompilierungsfehler werden im Preview-Panel und als rote Unterstreichung im Editor angezeigt

### Compile-Verzögerung einstellen

Die Verzögerung zwischen dem letzten Tastendruck und der Recompilierung kann in den VS Code Einstellungen angepasst werden:

1. `Cmd+,` → Einstellungen öffnen
2. Nach "vswrite" suchen
3. **Compile Delay** einstellen:

| Wert | Beschreibung |
|------|-------------|
| **0.5s** | Schnell — mehr CPU-Last |
| **1s** | Normal |
| **2s** | Entspannt (Standard) |
| **4s** | Langsam — für große Dokumente |

Alternativ in `settings.json`: `"vswrite.compileDelay": 2000` (Wert in Millisekunden)

### Typst installieren

```bash
# macOS
brew install typst

# Oder von https://typst.app herunterladen
```

Ohne Typst funktioniert der WYSIWYG-Editor normal — nur die Live-Preview fehlt.

---

## Statusbar

Unten links in VS Code zeigt vswrite:

- **Wortanzahl** — Aktualisiert sich bei jedem Edit
  - Mit Wort-Ziel: `📖 1234/3000 words (41%)` — inkl. Prozentzahl
  - Ohne Wort-Ziel: `📖 1234 words`
- **Kompilierungsstatus:**
  - `✓ Typst` — Erfolgreich kompiliert
  - `↻ Compiling` — Kompilierung läuft
  - `✗ 2 errors` — Anzahl der Kompilierungsfehler
  - `⚠ No Typst CLI` — Typst nicht installiert

Die Statusbar-Elemente erscheinen nur wenn eine `.typ`-Datei im vswrite-Editor geöffnet ist.

---

## AI-Agent Integration

vswrite ist kompatibel mit AI-Agenten wie Claude Code oder Codex. Die Agenten bearbeiten die `.typ`-Datei direkt auf der Festplatte — vswrite erkennt die Änderungen und aktualisiert den Editor automatisch.

### So funktioniert's

1. Öffne eine `.typ`-Datei in vswrite
2. Lass den AI-Agent die Datei bearbeiten (z.B. "Füge eine Mathe-Formel ein")
3. Der Agent schreibt direkt in die `.typ`-Datei
4. vswrite erkennt die Änderung → Editor aktualisiert sich → Preview zeigt das Ergebnis

Kein spezielles Setup nötig — es funktioniert mit jedem Tool das Dateien bearbeiten kann.

### CLI Tool (vswrite-cli)

vswrite installiert automatisch ein CLI-Tool `vswrite-cli` im VS Code Terminal. Es ermöglicht AI-Agenten (und Nutzern) strukturierte Operationen auf Typst-Dokumenten — ohne den Editor öffnen zu müssen.

**Dokument-Operationen:**

| Command | Beschreibung |
|---------|-------------|
| `vswrite-cli info <file.typ>` | Dokument-Übersicht: Wörter, Überschriften, Bilder, Zitationen |
| `vswrite-cli outline <file.typ>` | Heading-Hierarchie mit Zeilennummern |
| `vswrite-cli validate <file.typ>` | Strukturelle Probleme prüfen (fehlende Includes, Bilder) |
| `vswrite-cli check <file.typ>` | Validate + Typst-Kompilierung — gibt alle Fehler mit Datei und Zeile aus |
| `vswrite-cli merge <file.typ>` | Alle `#include`-Statements auflösen |
| `vswrite-cli split <file.typ>` | An H1-Überschriften aufteilen → separate Kapitel-Dateien |
| `vswrite-cli compile <file.typ>` | Zu PDF kompilieren (benötigt Typst CLI) |
| `vswrite-cli export-docx <file.typ>` | Als Word-Dokument (.docx) exportieren |

**Einstellungen & Styling:**

| Command | Beschreibung |
|---------|-------------|
| `vswrite-cli get-settings <file.typ>` | Aktuelle Dokument-Einstellungen lesen |
| `vswrite-cli set <file.typ> --font "Arial"` | Einstellungen ändern (--font, --font-size, --lang, etc.) |
| `vswrite-cli list-styles` | Verfügbare Style Templates anzeigen |
| `vswrite-cli apply-style <file.typ> --style "Modern Clean"` | Style Template anwenden |

**Bibliographie:**

| Command | Beschreibung |
|---------|-------------|
| `vswrite-cli parse-bib <file.bib>` | `.bib`-Einträge anzeigen |
| `vswrite-cli add-citation --bib f.bib --title "..." --author "..."` | Zitation manuell hinzufügen |
| `vswrite-cli import-sources` | DOIs aus PDFs im `sources/`-Ordner importieren |

**Scaffolding:**

| Command | Beschreibung |
|---------|-------------|
| `vswrite-cli new-project <name>` | Neues Projekt erstellen (--template document\|thesis\|paper\|letter\|book) |

**JSON-Output:** Die meisten Commands unterstützen `--json` für maschinenlesbare Ausgabe (z.B. `vswrite-cli check main.typ --json`).

**Für AI-Agenten:** Das CLI wird automatisch installiert und ist im VS Code Terminal verfügbar. Ein `SKILL.md` wird in Workspaces mit `.typ`-Dateien abgelegt, damit AI-Agenten die verfügbaren Commands entdecken.

---

## Typewriter Mode

Typewriter Mode hält die aktuelle Zeile immer in der vertikalen Mitte des Editors. Beim Schreiben scrollt das Dokument automatisch mit, sodass der Blick nicht nach unten wandert. Ideal für langes Schreiben — besonders in Kombination mit Focus Mode.

### Aktivieren

- **Toolbar:** …-Button (drei Punkte) rechts neben dem Zahnrad
- **Aktions-Menü:** ☰ → View → Typewriter Mode

### Verhalten

- Das Dokument bekommt zusätzlichen Leerraum unterhalb des Textes (50% der Fensterhöhe)
- Bei jedem Tastendruck und jeder Cursorbewegung scrollt der Editor sanft, sodass der Cursor vertikal zentriert bleibt
- Der Toolbar-Button leuchtet wenn der Modus aktiv ist

### Beenden

- **Escape** drücken
- Erneut auf den …-Button klicken

### Kombination mit Focus Mode

Typewriter Mode und Focus Mode sind unabhängig voneinander und können gleichzeitig aktiv sein. In Kombination ergibt sich ein besonders ablenkungsfreies Schreiberlebnis: Der aktuelle Absatz ist zentriert und hell, alles andere gedimmt.

---

## Rechtschreibprüfung

vswrite nutzt die **Browser-native Rechtschreibprüfung** deines Betriebssystems. Falsch geschriebene Wörter werden rot unterstrichen, Rechtsklick zeigt Korrekturvorschläge.

### Voraussetzungen

- **macOS:** Systemeinstellungen → Tastatur → Rechtschreibung → gewünschte Sprache(n) aktivieren
- **Windows/Linux:** Die Sprachpakete des Systems müssen installiert sein

### Sprach-Synchronisierung

Die Sprache der Rechtschreibprüfung wird automatisch mit der Dokumentsprache synchronisiert:

- Beim Öffnen: Die `#set text(lang: "de")` Einstellung wird ausgelesen
- Bei Änderung: Wenn die Sprache in den Quick-Settings oder Document Settings geändert wird, passt sich die Prüfung sofort an
- Unterstützte Sprachen: DE, EN, FR, ES, IT, PT, NL, SV, DA, NB, FI, PL, RU

### Hinweis

Die Browser-native Prüfung erkennt nur Rechtschreibfehler — keine Grammatik- oder Stilfehler. Für umfassendere Prüfungen kann ein externes Tool wie LanguageTool parallel verwendet werden.

---

## Undo AI Edit

Wenn ein AI-Agent (z.B. Claude Code) die `.typ`-Datei bearbeitet, kannst du die letzte externe Änderung mit einem Klick rückgängig machen — unabhängig von der normalen Undo-Historie (Cmd+Z).

### Auslösen

- **Aktions-Menü:** ☰ → File → Undo AI Edit
- **Command Palette:** `Cmd+Shift+P` → `vswrite: Undo Last AI Edit`

### So funktioniert's

- vswrite erstellt vor jeder externen Änderung automatisch einen Snapshot des Dateiinhalts
- Bis zu 20 Snapshots werden gespeichert (Stack-Prinzip — letzter zuerst)
- Der Command stellt den letzten Snapshot wieder her und aktualisiert Editor + Preview
- Eine Bestätigungs-Message zeigt die Uhrzeit des wiederhergestellten Snapshots

### Wann werden Snapshots erstellt?

- Bei jeder externen Dateiänderung (AI-Agent, Terminal, anderer Editor)
- Vor dem Anwenden eines Style Templates
- Vor dem Import eines Custom Style Templates

### Unterschied zu Cmd+Z

| | Cmd+Z | Undo AI Edit |
|---|---|---|
| **Was** | Einzelne Zeichen/Absätze im Editor | Gesamte Dateiänderung |
| **Für** | Eigene Tippfehler | AI-Agent-Edits |
| **Granularität** | Fein (Zeichen-Level) | Grob (ganzer Dateistand) |

---

## Conflict Guard

Der Conflict Guard schützt vor Datenverlust, wenn du gleichzeitig im Editor tippst und ein AI-Agent die Datei bearbeitet.

### So funktioniert's

- vswrite erkennt wenn du aktiv tippst (Zeitstempel bei jedem Tastendruck)
- Wenn eine externe Änderung eintrifft während du tippst, wird sie **gepuffert** statt sofort angewendet
- Die Statusbar zeigt `$(clock) AI edit pending` als Hinweis
- Nach 2 Sekunden ohne Tastendruck wird die gepufferte Änderung automatisch angewendet
- Vor dem Anwenden wird ein Snapshot erstellt (für Undo AI Edit)

### Warum?

Ohne Conflict Guard könnte ein AI-Agent-Edit mitten in deinem Tippen den Editor-Inhalt ersetzen — dein aktueller Satz wäre weg. Der Conflict Guard wartet bis du eine natürliche Pause machst.

---

## Focus Mode

Focus Mode blendet die Toolbar aus und dimmt alle Absätze außer dem, an dem du gerade arbeitest. Ideal für ablenkungsfreies Schreiben.

### Aktivieren

- **Toolbar:** ◎-Button rechts neben dem Zahnrad
- **Aktions-Menü:** ☰ → View → Focus Mode

### Verhalten

- Toolbar verschwindet komplett
- Alle Absätze im Editor werden gedimmt (30% Opazität)
- Der Absatz unter dem Cursor oder der Maus wird in voller Helligkeit angezeigt
- Ein schwebender "Exit Focus Mode"-Button erscheint unten rechts

### Beenden

- **Escape** drücken
- **"Exit Focus Mode"** Button klicken

---

## Suchen & Ersetzen

Im WYSIWYG-Editor nach Text suchen und optional ersetzen.

### Öffnen

- **Shortcut:** `Cmd+F` (Suchen) oder `Cmd+H` (Suchen & Ersetzen)
- **Aktions-Menü:** ☰ → View → Search & Replace

### Funktionen

- **Suchen:** Suchbegriff eingeben → Treffer werden gelb hervorgehoben, aktueller Treffer orange
- **Navigieren:** Pfeil-Buttons oder Enter (nächster) / Shift+Enter (vorheriger)
- **Ersetzen:** Ersatztext eingeben → "Replace" (einzelner Treffer) oder "All" (alle Treffer)
- **Trefferanzeige:** "3 / 12" zeigt aktuellen Treffer und Gesamtzahl
- **Schließen:** Escape oder ×-Button

### Hinweis

Die Suche arbeitet im visuellen Editor-Content. Typst-Raw-Blocks (Mathe, Config, Code) werden übersprungen — deren Inhalt muss direkt im Block bearbeitet werden.

---

## Wort-Ziel (Word Goal)

Setze ein Wort-Ziel für dein Dokument. Die Statusbar zeigt den Fortschritt als Prozentwert.

### Setzen

- **Command Palette:** `Cmd+Shift+P` → `vswrite: Set Word Goal`
- Zahl eingeben (z.B. `3000`) → Bestätigen

### Anzeige

Die Statusbar zeigt: `📖 1234/3000 words (41%)`

### Löschen

- Erneut `vswrite: Set Word Goal` aufrufen → `0` eingeben

Das Wort-Ziel wird pro Workspace gespeichert und bleibt auch nach dem Schließen von VS Code erhalten.

---

## Quick-Settings

Schnellzugriff auf die wichtigsten Dokument-Einstellungen direkt aus der Toolbar.

### Öffnen

- **Toolbar:** ⚙-Button (Zahnrad) rechts in der Toolbar

### Einstellungen

| Einstellung | Optionen |
|-------------|----------|
| **Schriftgröße** | 10pt, 11pt, 12pt, 13pt, 14pt |
| **Zeilenabstand** | Tight (0.5em), Normal (0.65em), Wide (1em), Double (1.3em) |
| **Sprache** | EN, DE, FR, ES, IT |

### So funktioniert's

- Wert auswählen (Chip-Buttons für Größe/Abstand, Dropdown für Sprache)
- **Apply** klicken → Einstellungen werden sofort in die `.typ`-Datei geschrieben
- Preview aktualisiert sich automatisch
- Schließen mit Klick außerhalb des Dropdowns

---

## Kapitel aufteilen (Split)

Ein langes Dokument automatisch an den Hauptüberschriften aufteilen und in eine Projektstruktur überführen.

### Öffnen

- **Aktions-Menü:** ☰ → File → Split into Chapters
- **Command Palette:** `Cmd+Shift+P` → `vswrite: Split into Chapters`

### Was passiert?

1. Das Dokument wird an jeder `= Heading 1` Grenze aufgeteilt
2. Pro Kapitel wird eine Datei erstellt: `chapters/01-titel.typ`, `chapters/02-titel.typ` etc.
3. Eine `main.typ` wird generiert mit `#include`-Statements in der richtigen Reihenfolge
4. `#set`-Konfigurationsblöcke (vor dem ersten Heading) bleiben in `main.typ`
5. Das Projekt wird nach dem Split geöffnet

### Beispiel

**Vorher:** Ein langes `dokument.typ` mit 5 Kapiteln

**Nachher:**
```
chapters/
├── 01-einleitung.typ
├── 02-methoden.typ
├── 03-ergebnisse.typ
├── 04-diskussion.typ
└── 05-fazit.typ
main.typ   ← mit #include-Statements
```

---

## PDF Export

Dokument als PDF exportieren — Typst CLI muss installiert sein.

- **Über Aktions-Menü:** ☰ → File → Export as PDF
- **Über Command Palette:** `Cmd+Shift+P` → `vswrite: Export as PDF`
- Es öffnet sich ein Speichern-Dialog → Zielort wählen → PDF wird erstellt
- Nach Erfolg: Benachrichtigung mit "Open PDF" Button

---

## DOCX Export

Dokument als Word-Datei (.docx) exportieren — kein externes Tool nötig.

### Öffnen

- **Aktions-Menü:** ☰ → File → Export as DOCX
- **Command Palette:** `Cmd+Shift+P` → `vswrite: Export as DOCX`
- **CLI:** `vswrite-cli export-docx <file.typ> [--output datei.docx]`

### Was wird exportiert?

| Element | DOCX-Darstellung |
|---------|-----------------|
| Headings (H1–H6) | Word-Überschriften-Stile |
| Bold, Italic, Underline, Strikethrough | Standard-Textformatierung |
| Bullet & Ordered Lists | Word-Listen |
| Tabellen | Word-Tabellen (mit Header-Erkennung) |
| Bilder | Eingebettete Bilder (aus `assets/`) |
| Links | Klickbare Hyperlinks |
| Fußnoten | Word-Fußnoten |
| Seitenumbrüche | Word-Seitenumbrüche |
| Zitationen (`@citekey`) | Kursiver Text `[citekey]` |
| Raw Blocks (Math, Config, Code) | Grauer Monospace-Text |

### Multi-File Projekte

Bei Projekten mit `#include`-Statements werden alle Kapitel automatisch zusammengeführt — der Export enthält das gesamte Dokument.

### Einschränkungen

- Typst-spezifische Features (`#set`/`#show`-Regeln, Math-Formeln) haben kein DOCX-Äquivalent und werden als grauer Text dargestellt
- Komplexe Layouts (Spalten, Custom-Fonts) werden vereinfacht
- Der Export nutzt Calibri 12pt als Standardschrift

---

## Style Templates

Mit Style Templates kannst du das komplette Erscheinungsbild deines Dokuments mit einem Klick ändern — Schriftart, Seitenränder, Überschriften-Styling und mehr.

### Anwenden

- **Aktions-Menü:** ☰ → Style Templates → Stil auswählen

### Verfügbare Stile

| Stil | Beschreibung |
|------|-------------|
| **Classic Academic** | Traditionelle Serifenschrift (New Computer Modern), nummerierte Überschriften, sauberes Layout |
| **Modern Clean** | Sans-Serif (Helvetica), blaue Akzente, farbige Überschriften mit Unterstreichungen |
| **Minimal** | Ultra-clean, großzügiger Weißraum, Überschriften in Großbuchstaben, leichte Typografie |
| **Vibrant** | Farbenfrohe Überschriften, dunkler H1-Block mit weißer Schrift, rote Akzentleisten |
| **Elegant** | Warme Brauntöne, zentrierte H1-Überschriften, ornamentale Trennlinien |
| **Professional Report** | Corporate-Stil, dunkle Unterstreichung bei H1, strukturiertes Layout |
| **Artsy** | Zeitungs-inspiriert, farbige Überschriften (rot/blau), Georgia-Schrift |

### So funktioniert's

- Ein Style ersetzt alle bestehenden `#set`- und `#show`-Regeln am Anfang des Dokuments
- Der eigentliche Inhalt (Überschriften, Text, Bilder etc.) bleibt unverändert
- Man kann jederzeit zwischen Stilen wechseln
- Bestehende Styles werden automatisch erkannt und ersetzt (nicht dupliziert)

---

## Fußnoten

Fußnoten werden im Editor als nummerierte Inline-Marker angezeigt. Die Nummerierung erfolgt automatisch.

### Einfügen

- Im Typst-Code: `#footnote[Fußnotentext hier]`
- Der Text wird automatisch als Fußnote erkannt und im Editor dargestellt

### Bearbeiten

- **Klick** auf den Fußnoten-Marker → Popup-Editor erscheint
- Fußnotentext im Textfeld bearbeiten
- **Schließen:** Escape, Cmd+Enter oder Klick außerhalb

### Darstellung

- Fußnoten erscheinen als kleine nummerierte Badges im Text (z.B. ¹, ², ³)
- Die Nummer wird automatisch vergeben und aktualisiert sich beim Hinzufügen/Entfernen
- Hover zeigt den Fußnotentext als Vorschau

---

## Zitationen und Quellenmanagement

vswrite unterstützt akademisches Zitieren mit `.bib`-Dateien und `@citekey`-Syntax direkt im WYSIWYG-Editor. Es gibt drei Wege, Quellen hinzuzufügen — von vollautomatisch bis manuell.

### Überblick: Wie funktioniert das Zitieren?

Das Zitationssystem besteht aus drei Teilen:

1. **`.bib`-Datei** — Enthält die bibliografischen Daten deiner Quellen (Autor, Titel, Jahr etc.) im BibTeX-Format
2. **`@citekey` im Text** — Verweise auf Quellen, die als blaue Badges im Editor erscheinen
3. **`#bibliography("references.bib")`** — Typst-Befehl am Ende deines Dokuments, der das Literaturverzeichnis erzeugt

**Wichtig:** Die `.bib`-Datei ist die zentrale Datenquelle. Ohne sie funktionieren weder Autocomplete noch Literaturverzeichnis. Es gibt drei Wege, diese Datei zu befüllen.

### Weg 1: Quellen automatisch aus PDFs importieren

Ideal für Journal-Artikel und wissenschaftliche Papers, die eine DOI enthalten.

**Schritt für Schritt:**

1. **`sources/`-Ordner erstellen:** Lege einen Ordner namens `sources/` im Projektverzeichnis an (oder lass ihn über den Command erstellen)
2. **PDFs ablegen:** Kopiere deine Quell-PDFs in den `sources/`-Ordner
3. **Import starten:**
   - Aktions-Menü: ☰ → File → Import Sources
   - Oder: `Cmd+Shift+P` → `vswrite: Import Sources`
4. **Was passiert im Hintergrund:**
   - Jede PDF wird mit `pdf-parse` gelesen (erste 3 Seiten)
   - Per Regex wird nach einer DOI gesucht (z.B. `10.1038/nature12373`)
   - Bei DOI-Fund: Die CrossRef API wird abgefragt → Autor, Titel, Jahr, Journal werden automatisch ermittelt
   - Fallback: Falls keine DOI gefunden wird, werden die PDF-Metadaten gelesen (Titel, Autor aus den PDF-Properties)
   - Neue Einträge werden in `references.bib` geschrieben (existierende Einträge werden nicht dupliziert)
5. **Ergebnis:** Eine Benachrichtigung zeigt, wie viele Quellen importiert wurden und wie viele manuell ergänzt werden müssen

**Wann funktioniert der Auto-Import gut?**

| Quellentyp | Erfolgsrate | Grund |
|---|---|---|
| Journal-Artikel (Elsevier, Springer etc.) | Hoch | Enthalten fast immer eine DOI im Text |
| Konferenzbeiträge mit DOI | Hoch | DOI wird aus dem Text extrahiert |
| Bücher mit DOI | Mittel | Manche haben DOI, manche nicht |
| Studienbriefe, Skripte, Vorlesungsfolien | Niedrig | Haben in der Regel keine DOI |
| Selbst erstellte Dokumente | Keine | Manuelle Eingabe nötig |

**Tipp:** Auch `.txt`- und `.md`-Dateien im `sources/`-Ordner werden gescannt — wenn sie eine DOI enthalten, wird diese aufgelöst.

### Weg 2: Quellen manuell eingeben

Für Quellen ohne DOI oder wenn du gezielt einzelne Einträge hinzufügen willst.

- **Aktions-Menü:** ☰ → File → Add Citation Manually
- **Command Palette:** `Cmd+Shift+P` → `vswrite: Add Citation Manually`

**Ablauf:**
1. Titel eingeben (z.B. "Geschichte pädagogischen Denkens")
2. Autor(en) eingeben (z.B. "Fuchs, Birgitta")
3. Jahr eingeben (z.B. "2013")
4. Typ wählen: article, book, inproceedings, thesis oder misc

Der Eintrag wird automatisch in `references.bib` geschrieben. Der Citekey wird aus Nachname + Jahr generiert (z.B. `fuchs2013`).

### Weg 3: `.bib`-Datei direkt bearbeiten

Du kannst die `references.bib` auch direkt in VS Code öffnen und Einträge im BibTeX-Format schreiben:

```bibtex
@book{fuchs2013,
  author = {Fuchs, Birgitta},
  title = {Geschichte pädagogischen Denkens},
  year = {2013},
  publisher = {FernUniversität in Hagen}
}
```

vswrite erkennt Änderungen an `.bib`-Dateien automatisch — das Autocomplete-Dropdown aktualisiert sich sofort.

### Zitat im Text einfügen

Sobald die `.bib`-Datei Einträge enthält, kannst du Zitate einfügen:

- **`@` tippen:** Schreibe `@` gefolgt vom Suchbegriff → Autocomplete-Dropdown erscheint
- **Slash Command:** `/Citation` → triggert den `@`-Autocomplete
- **Aktions-Menü:** ☰ → Insert → Citation
- **Dropdown:** Zeigt Autor, Titel, Jahr und Citekey pro Eintrag → Enter zum Auswählen
- **Filtern:** Sucht gleichzeitig in Citekey, Autor, Titel und Jahr

### Darstellung im Editor

- Zitationen erscheinen als blaue Inline-Badges: `@ Einstein (1905)`
- Hover zeigt den vollständigen Citekey
- Im Typst-Output wird daraus `@einstein1905`

### Literaturverzeichnis-Vorschau

Wenn dein Dokument einen `#bibliography("references.bib")`-Block enthält, zeigt vswrite an dieser Stelle eine Live-Vorschau aller Einträge aus der `.bib`-Datei — mit Autor, Jahr und Titel. Die Vorschau aktualisiert sich automatisch, wenn sich die `.bib`-Datei ändert.

Statt eines grauen Raw-Blocks siehst du einen formatierten Block mit:
- Header "Bibliography"
- Dateipfad der `.bib`-Datei
- Liste aller Einträge (Autor, Jahr, Titel)

### .bib-Datei: Erkennung und Priorität

vswrite findet automatisch alle `.bib`-Dateien im Workspace. Die Reihenfolge:

1. `.bib`-Dateien im selben Verzeichnis wie das Dokument (höchste Priorität)
2. `.bib`-Dateien im Projekt-Root
3. Dateien namens `references.bib` werden bevorzugt
4. Alle anderen `.bib`-Dateien alphabetisch

Falls noch kein `#bibliography(...)` im Dokument existiert, wird es beim ersten Zitieren automatisch eingefügt.

### Kompletter Workflow: Beispiel

Angenommen, du schreibst eine Hausarbeit und hast 5 Journal-Artikel als PDF und 2 Bücher ohne DOI:

1. **Projekt erstellen:** ☰ → File → New Project → Thesis → "meine-hausarbeit"
2. **PDFs importieren:**
   - `sources/`-Ordner im Projekt anlegen
   - Die 5 Journal-PDFs in `sources/` kopieren
   - ☰ → File → Import Sources → 5 Einträge werden automatisch importiert
3. **Bücher manuell hinzufügen:**
   - ☰ → File → Add Citation Manually → Titel, Autor, Jahr eingeben (2×)
4. **Im Text zitieren:**
   - `@` tippen → Dropdown zeigt alle 7 Quellen → Auswählen
   - Blaues Badge erscheint inline
5. **Literaturverzeichnis:**
   - `#bibliography("references.bib")` am Ende des Dokuments einfügen (oder Thesis-Template hat es schon)
   - Im Editor erscheint die Vorschau aller Quellen
6. **PDF exportieren:** ☰ → File → Export as PDF → Typst generiert das fertige Literaturverzeichnis

---

## Keyboard Shortcuts Cheatsheet

Alle Shortcuts auf einen Blick:

- **Über Aktions-Menü:** ☰ → Help → Keyboard Shortcuts
- Ein Overlay zeigt alle verfügbaren Shortcuts gruppiert nach Kategorie
- Schließen mit Escape, × Button oder Klick außerhalb

---

## Commands

Über die VS Code Command Palette (`Cmd+Shift+P`):

| Command | Beschreibung |
|---------|-------------|
| `vswrite: Open as Typst Source` | Öffnet die aktuelle `.typ`-Datei im Standard-Texteditor (roher Typst-Code) |
| `vswrite: Export as PDF` | Exportiert die aktuelle `.typ`-Datei als PDF |
| `vswrite: Export as DOCX` | Exportiert die aktuelle `.typ`-Datei als Word-Dokument (.docx) |
| `vswrite: Merge Document` | Führt alle `#include`-Kapitel zu einem Dokument zusammen |
| `vswrite: New Project` | Neues Typst-Projekt aus Template erstellen |
| `vswrite: New Typst File` | Neue `.typ`-Datei im Workspace erstellen |
| `vswrite: Split into Chapters` | Dokument an H1-Headings aufteilen → separate Kapitel-Dateien |
| `vswrite: Set Word Goal` | Wort-Ziel für die Statusbar setzen (0 = löschen) |
| `vswrite: Import Sources` | Quell-Dokumente aus `sources/` scannen und `.bib`-Einträge generieren |
| `vswrite: Add Citation Manually` | Zitation manuell eingeben (Titel, Autor, Jahr) |
| `vswrite: Undo Last AI Edit` | Letzte externe Änderung (AI-Agent) rückgängig machen |

---

## Typst ↔ Editor Zuordnung

So werden Typst-Elemente im Editor dargestellt:

| Typst Syntax | Editor-Darstellung |
|---|---|
| `= Titel` | Heading 1 |
| `== Untertitel` | Heading 2 |
| `=== Abschnitt` | Heading 3 |
| `*fett*` | **Fett** |
| `_kursiv_` | *Kursiv* |
| `` `code` `` | `Inline Code` |
| `~durchgestrichen~` | ~~Durchgestrichen~~ |
| `- Punkt` | Aufzählung |
| `+ Punkt` | Nummerierte Liste |
| `#quote[Text]` | Blockquote |
| `#link("url")[Text]` | Klickbarer Link |
| `#image("assets/bild.png")` | Bild-Vorschau (klickbar → Bild-Dialog) |
| `#align(center)[...]` | Zentrierter Absatz/Überschrift |
| `#align(right)[...]` | Rechtsbündiger Absatz/Überschrift |
| `#footnote[Text]` | Nummerierter Fußnoten-Marker (klickbar) |
| `@citekey` | Blaues Zitations-Badge (z.B. `@ Einstein (1905)`) |
| `#line(length: 100%)` | Horizontale Linie |
| ` ```code``` ` | Code-Block |
| `#set text(...)` | Raw Block (Configuration) |
| `$ E = mc^2 $` | Raw Block (Math) |
| `// Kommentar` | Raw Block (Comment) |
