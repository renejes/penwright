# Penwright MCP Server — AI Integration

> **66 Tools** fuer externe AI-Agents | Unabhaengig von der Electron-App | Cursor, Claude Desktop, Claude Code, Codex u.a.

---

## Was ist der MCP Server?

Der Penwright MCP Server ermoeglicht es externen KI-Desktop-Apps, Typst-Dokumente in Penwright fernzusteuern. Er laeuft als eigenstaendiges CLI-Tool ueber stdio (JSON-RPC) und nutzt die gleichen Shared-Module wie die Desktop-App.

```
AI-Desktop-App (Claude, Codex, ...)
  |
  | stdio (JSON-RPC)
  v
Penwright MCP Server (Standalone-Binary, Bun-compiled)
  |
  |-- Liest/schreibt .typ Dateien
  |-- Kompiliert via gebuendelte typst-Binary
  |-- Verwaltet Projekt-Struktur
  |-- Git-Operationen
```

---

## Setup

**Der normale Weg ist Auto-Registration in Cursor** — du musst nichts von Hand bauen oder konfigurieren.

### Empfohlen: Cursor (automatisch)

Beim Start schreibt Penwright sich in **`~/.cursor/mcp.json`** (global, jeder Workspace auf diesem Rechner). Server-Definition: Standalone-Binary + `TYPST_BIN` / `TYPST_PACKAGE_PATH` / `TYPST_FONT_PATH`. Falls die Tools in Cursor nicht erscheinen: Fenster neu laden oder unter Settings → Tools & MCP den Server einmal aus- und wieder einschalten. **Hilfe → MCP-Verbindung…** bestätigt oder schreibt den Eintrag erneut.

### Claude Desktop (Wizard in der App)

1. Penwright oeffnen → **Hilfe → Mit Claude Desktop verbinden** (MCP-Setup-Wizard, `McpSetupWizard.svelte`). Voraussetzung: Claude Desktop ist installiert.
2. Der Wizard kopiert die **Bun-kompilierte Standalone-Binary** (`penwright-mcp`, ~64 MB) aus dem App-Bundle (`Contents/Resources/mcp/bin/`) nach `~/Library/Application Support/Penwright/mcp-server/` und traegt einen `penwright`-Eintrag (Schluessel `MCP_SERVER_KEY`) in `~/Library/Application Support/Claude/claude_desktop_config.json` ein — **idempotent**, andere `mcpServers` bleiben erhalten, mit timestamped Backup.
3. In den Eintrag schreibt der Wizard die Env-Variablen `TYPST_BIN` / `TYPST_PACKAGE_PATH` / `TYPST_FONT_PATH` — sie zeigen auf die gebuendelte Typst-Binary, die `@preview/*`-Packages und die OFL-Fonts im App-Bundle, **damit der Server auch auf einer Maschine ohne System-Typst kompiliert/exportiert**.
4. Claude Desktop neu starten. Die Penwright-Tools erscheinen im MCP-Menue.

Die Binary ist **von der laufenden App entkoppelt** — Claude Desktop kann sie unabhaengig spawnen, Reihenfolge egal, und Penwright zu beenden killt den MCP-Child nicht. (Plattformen: **macOS getestet**, Windows verdrahtet aber ungetestet; Linux n/a — kein Claude Desktop.) Aendert sich Binary oder Config-Schema, wird `MCP_SETUP_VERSION` (in `mcpSetup.ts`) erhoeht und der Wizard re-triggert.

### Claude Code (optional, `mcpRegistration.ts`)

Ueber **Hilfe → „MCP-Verbindung…"** kann Penwright sich zusaetzlich bei Claude Code registrieren: `claude mcp add --scope user penwright --env … -- <bin>`, mit Fallback auf ein direktes `~/.claude.json`-Edit. Cursor und Claude Code duerfen gleichzeitig aktiv sein. Meta-MCP ist entfernt; ein Alt-Eintrag in dessen Config wird beim Start einmal entfernt.

### Manuell (Power-User / Dev)

Wer den Server unter eigenem Node laufen lassen will:

```bash
npm run build:mcp          # -> dist/mcp/server.mjs           (esbuild, braucht Node 20+ zum Ausfuehren)
# ODER die Standalone-Binary selbst bauen (braucht Bun):
npm run build:mcp-binary   # -> dist/mcp/bin/penwright-mcp-<triple>   (bun build --compile)
```

`~/Library/Application Support/Claude/claude_desktop_config.json` (or `~/.cursor/mcp.json` for Cursor):

```json
{
  "mcpServers": {
    "penwright": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/vswrite-desktop/dist/mcp/server.mjs"],
      "env": {
        "TYPST_BIN": "/opt/homebrew/bin/typst"
      }
    }
  }
}
```

Kein `--project`-Pfad noetig — der Agent wechselt Projekte dynamisch via `penwright_set_project`. Beim manuellen Node-Pfad muss Typst im PATH sein **oder** `TYPST_BIN` gesetzt. Danach Claude Desktop neu starten — Claude sieht die Penwright-Tools im MCP-Menue.

---

## Verfuegbare Tools (66)

Die Gliederung unten ist die des Servers selbst (`TOOL_META` in `src/mcp/server.ts`) — dieselben Gruppen (die Reihenfolge innerhalb einer Gruppe ist hier lesbarer sortiert). Jedes Tool traegt dort einen `title` und seine Annotations (`readOnlyHint` / `destructiveHint` / `idempotentHint` / `openWorldHint`); ein Tool ohne Eintrag wirft beim Registrieren, kann also nicht unklassifiziert ausgeliefert werden.

### Wo bin ich (5)

| Tool | Beschreibung |
|------|-------------|
| `penwright_set_project` | Setzt das aktive Projektverzeichnis (`projectDir`) und erkennt die Haupt-`.typ` automatisch (main.typ / document.typ / erste gefundene). Ein Easy-Writing-Ordner (`project.yaml` + `.mdx`) wird daraus gesetzt, ohne das Manuskript umzuschreiben. Meist **nicht noetig** — Projekt und offene Datei kommen aus dem Zustandskanal der App; nur aufrufen, wenn ein *anderer* Ordner gemeint ist. |
| `penwright_get_document` | Aktuelles Dokument: `content`, `filePath`, `projectDir`, `wordCount`. |
| `penwright_open_file` | Eine `.typ` als aktuelles Dokument oeffnen (absoluter oder projekt-relativer Pfad). |
| `penwright_list_files` | Projekt-Dateibaum (`.typ`, `.bib`, `.md`, `.yaml`/`.yml`, `.toml`, `.txt`, `.json`, `.csv`, `.tex`, `.pdf`, `.docx`, Bilder), max. 5 Ebenen tief. `.git`, `node_modules`, `dist`, `build` u.a. fliegen raus, `.claude/` bleibt drin. |
| `penwright_read_file` | Projektdatei als Text lesen. **Bei 400 000 Zeichen gekappt**, mit sichtbarem Hinweis + Verweis auf `penwright_search_project` — eine einzige Rueckgabe darf den Rest des Gespraechs nicht verdraengen, und still zu kuerzen waere schlimmer als gar nicht. |

### Schreiben (4)

| Tool | Beschreibung |
|------|-------------|
| `penwright_update_document` | Ersetzt den Inhalt des aktuellen Dokuments und speichert. Erst `penwright_get_document` lesen, aendern, den **kompletten** neuen Inhalt zurueckschicken. |
| `penwright_write_file` | Beliebige Projektdatei komplett ersetzen (Parent-Dirs werden angelegt). Fuer die Datei, die der Nutzer gerade ansieht, ist `penwright_update_document` die, die seinen Editor mitzieht. Die Vorversion wird gesnapshottet — `penwright_undo_last_edit` holt sie zurueck. |
| `penwright_import_markdown` | Markdown/MDX → Typst, geschrieben nach `destPath` im Projekt. Quelle: inline `markdown` **oder** `srcPath` (`.md`/`.mdx`/`.markdown`/`.txt`, darf ausserhalb des Projekts liegen — wird nur gelesen). Fehler, wenn `destPath` existiert, ausser `overwrite: true`. Ein Easy-Writing-*Ordner* wird nicht so flatten: `penwright_set_project` auf den Ordner mit `project.yaml`. |
| `penwright_add_image` | Bild nach `assets/` importieren (Content-Hash-Dedup), Typst-Snippet bauen (mit `caption` daraus ein `#figure(...)`, mit `caption + label` ein referenzierbares Figure-Target) und optional per `file` + `afterText` in einem Zug einfuegen. |

### Pruefen & sehen (2)

| Tool | Beschreibung |
|------|-------------|
| `penwright_compile` | Verifiziert, dass das Dokument kompiliert. Liefert `{ success, rootFile, sizeBytes, errors[], warnings[] }`; `errors`/`warnings` tragen Datei + Zeile. Die PDF-Datei wird verworfen (temp, ausserhalb des Projekts) — fuer ein echtes Artefakt `penwright_export_pdf` / `penwright_export_docx`. |
| `penwright_render_page` | **Rendert eine Seite des kompilierten PDFs als Bild und liefert sie zurueck** (`type: 'image'`) — der Agent *sieht* das Layout, statt es aus dem Quelltext zu erraten. Vor jeder visuellen Beurteilung (Abstaende, Ueberlauf, Farbe, wo eine Ueberschrift gelandet ist) benutzen. Max. 2 Seiten / 4 MB pro Aufruf, `ppi` 72–300 (Default 144); hoehere Werte kosten Kontext. |

### Settings (2)

Document Settings sind seit Session 22 auf `lang` + `bibliographyStyle` reduziert — Typografie, Layout und Design-Tokens leben jetzt in `style.json` (siehe Design-Tools weiter unten).

| Tool | Beschreibung |
|------|-------------|
| `penwright_get_settings` | Document Settings der **Wurzel** lesen — genau zwei: `lang` + `bibliographyStyle`. Liefert den Dateinamen mit, damit klar ist, worueber geredet wird. |
| `penwright_update_settings` | Dieselben zwei Settings in der **Wurzel** aendern (nur geaenderte Keys). Typisiert statt freies Key-Value: vorher wurde jeder unbekannte Key stillschweigend verworfen und Erfolg gemeldet. |

### Design (16) — Themes, Layouts, Palette, Fonts, Elements, Section Styles, Selection-Handoff

Die strukturierte Design-Surface aus dem Design-Editor-Tab. Schreibt direkt nach `.penwright/style.json`, regeneriert `style.typ`, und stellt sicher dass die root-`.typ` Datei `#import "style.typ": *` + `#show: apply-style` ganz oben hat. Operationen sind idempotent und preservieren `style.custom.preamble` (User-Escape-Hatch-Code) **und `style.sections`** (per-Chapter Section Styles) bei Theme- und Layout-Swaps.

**Jede Design-Mutation ist ein sicheres Experiment (seit Session 42).** Die Schreibvorgaenge werden gestaged, das Dokument wird testweise kompiliert, und wenn es danach nicht mehr kompiliert, wird **der komplette Satz** zurueckgerollt — das Projekt ist exakt wie vorher, und das Tool sagt das mit der Typst-Fehlermeldung dazu (`shared/safeApply`, dieselbe Maschinerie wie `safeApplyDesign` in der App). Vorher schrieb diese Seite ungeprueft: ein einziges `apply_layout` konnte das Dokument unkompilierbar hinterlassen, ohne Rueckweg, und das Tool meldete Erfolg, weil der Schreibvorgang gelungen war. War das Dokument **schon vorher** kaputt, wird die Aenderung trotzdem angewendet (ein Design-Schritt wird nicht fuer einen vorbestehenden Inhaltsfehler bestraft) und der Hinweis sagt das.

Bei einem Projekt mit **handgeschriebener `style.typ`** verweigern die Tools, die `style.json`/`style.typ` **regenerieren**, den Schreibvorgang rundheraus: `apply_style`, `update_style`, `apply_palette`, `apply_layout`, `generate_layout`, `define_section_style`. `penwright_get_style` meldet das vorab als `adopted: false`, damit die Absage keine Ueberraschung ist. `insert_design_element`, `clear_section_style` und ein `apply_section_style` auf eine bereits definierte Variante schreiben dagegen weiterhin — sie regenerieren nichts, und ihr Schutz ist das Test-Kompilat mit Rollback, nicht die Absage.

| Tool | Beschreibung |
|------|-------------|
| `penwright_get_style` | Design-Zustand lesen: `{ initialized, adopted, rootFile, styleTypFile, style }`. **`initialized` zuerst lesen** — ist es `false`, sind die gezeigten Tokens Penwright-**Defaults** und beschreiben nicht, wie das Dokument aussieht; `adopted: false` heisst handgeschriebene `style.typ`, die Design-Tools verweigern. Ohne diese Flags sahen Defaults aus wie Tatsachen. |
| `penwright_update_style` | Partial-Patch (deep-merge mit Per-Leaf-Sanitizer). z.B. `{ colors: { primary: "#0f172a" } }` reicht; Rest bleibt. Invalid hex/weight/range faellt auf alten Wert zurueck statt zu erroren |
| `penwright_list_styles` | Built-in Themes auflisten (id / name / description / bestFor) — Classic Academic, Modern Tech, Editorial Magazine, Minimal, Marketing Brochure, Thesis |
| `penwright_apply_style` | Theme komplett anwenden — `styleId: "marketing-brochure"`. Ueberschreibt colors/fonts/scale/layout/headings/elements; behaelt, was ein Theme nicht mitbringt: `custom.preamble`, `sections` und die Prepress-Felder (`bleed` / `cropMarks` / `facingPages` / `binding`) |
| `penwright_list_layouts` | Die **8** Layout-Presets (A4 Portrait Standard, A4 Landscape, Magazine 2-Column, Newsletter 3-Column, A5 Booklet, **Magazine Editorial**, A2 Poster, **Magazin (Druck) · A4 + 5 mm Beschnitt**) inkl. Paper/Orientation/Columns/BaseSize-Metadata |
| `penwright_apply_layout` | Tauscht nur die `layout.*` Werte (+ optional `scale.base`) — Theme/Farben/Fonts bleiben. Kombinierbar mit `apply_style`. Merged statt zu spreaden: die Prepress-Felder (`bleed` / `cropMarks` / `facingPages` / `binding`), die ein Bildschirm-Preset nicht mitbringt, bleiben stehen |
| `penwright_list_fonts` | Die 7 gebuendelten OFL-Fonts (Inter, IBM Plex Sans/Serif/Mono, JetBrains Mono, Crimson Pro, Spectral) — family/category/description. Immer verfuegbar, kein System-Install-Check noetig |
| `penwright_apply_palette` | 5-Farb-Palette setzen. Entweder `presetId` (z.B. "editorial", "earth-tones") ODER per-slot hex overrides (primary/accent/text/background/muted), kombinierbar. Kein-Argumente-Call returned die verfuegbaren Presets |
| `penwright_list_design_elements` | Library der **24** parametrischen Snippets inkl. erwarteter Params pro Element: Banner / Sidebar / Pull-Quote / Callout / Hero / Divider / Photo-Caption-Wrap / Stats-Box / Image-Overlay / Gallery-Asymmetric / Magazine-Cover / Gallery-2up / Gallery-3up / Section-Opener / Article-Opener / Pull-Quote-Display / Pull-Quote-Block / Divider-Asterisks / Divider-Ornament / Drop-Cap / Full-Bleed-Image / Spread-Opener / Margin-Note / **Spread-Image** (die Doppelseite, deren Bild exakt im Bund geteilt wird — braucht ein `style.typ`, das `style-bleed` exportiert). Vor handgeschriebenem Layout-Typst lesen: diese re-themen sich aus der Projekt-Palette, ein handgeschriebener Block nicht |
| `penwright_insert_design_element` | Snippet an Anchor-Position einfuegen — z.B. Hero am Dokument-Anfang, Pull-Quote nach einem bestimmten Absatz. Snippets referenzieren `style-colors.*` und `style-fonts.*` und re-themen automatisch wenn Palette/Typografie wechselt. Braucht also eine Datei, die `style.typ` importiert — sonst schlaegt der Test-Compile fehl und die Aenderung wird zurueckgerollt |
| `penwright_generate_layout` | Hoch-Level-Komposit: `intent: "brochure"` waehlt Marketing-Brochure Theme + Magazine-2col Layout + optional Hero am Anfang. Intent-Mapping deckt brochure / thesis / magazine / report / spec / minimal / newsletter / poster / booklet / slide ab |
| `penwright_list_section_styles` | **Section Styles (Phase E)** — per-Chapter "Rubriken". Listet die 5 Built-in-Presets (feature / interview / essay / photo-essay / department), die im Projekt definierten Varianten, und welche Kapitel welche Variante nutzen |
| `penwright_define_section_style` | Variante anlegen/aendern — `fromPreset` als Startpunkt und/oder explizite Overrides (accent / fonts / baseSize / leading / columns / h1*). Schreibt nach `style.sections`, regeneriert `style.typ` mit einem `#let <id>-style(body)` pro Variante |
| `penwright_apply_section_style` | Variante einem Kapitel zuweisen — injiziert den scoped `#import "../style.typ": <id>-style` + `#show: <id>-style` oben in die Kapitel-Datei. Auto-definiert ein Preset falls noetig. Restyled NUR dieses Kapitel (accent / fonts / columns / headings); Page-Geometrie + Running-Heads bleiben dokument-level. Danach `penwright_compile` |
| `penwright_clear_section_style` | Section-Opt-in aus einem Kapitel entfernen (zurueck zum Dokument-Default-Look). Die Variante bleibt in `style.json` definiert |
| `penwright_get_selection` | **Design-with-AI-Handoff:** liest die im Editor gepinnte Auswahl aus `.penwright/selection.json` — Anker-Text + 1-basierte Occurrence + ein Design-Snapshot (Theme / Palette / Fonts / Layout / SectionStyle / grobe `usedElements`). Der Agent handelt an der Anker-Stelle (`insert_design_element` oder lokalisiertes Typst); der Watcher loescht den Pin automatisch, nachdem die Datei extern geaendert wurde |

### Struktur (6)

Alles hier arbeitet auf der **Wurzel**, nicht auf der gerade offenen Datei — eine Kapitelliste, eine `#include`-Zeile, ein Split betrifft das Dokument als Ganzes.

| Tool | Beschreibung |
|------|-------------|
| `penwright_get_chapters` | Kapitel der **Wurzel**: welche Dateien in welcher Reihenfolge `#include`d sind und ob es sie auf der Platte gibt. Die zurueckgegebenen Pfade sind die, die `reorder`/`remove` erwarten |
| `penwright_reorder_chapters` | `#include`-Reihenfolge aendern — neue Ordnung als Array projekt-relativer Kapitelpfade |
| `penwright_add_chapter` | Kapitel-Datei anlegen (`chapters/`) und in der **Wurzel** einbinden. `position` ist 0-basiert; ohne sie wird angehaengt |
| `penwright_remove_chapter` | `#include`-Zeile aus der Wurzel entfernen. Loescht die Datei **nicht** — der Text bleibt liegen und kann wieder eingebunden werden |
| `penwright_merge_document` | Alle `#include`s der **Wurzel** aufloesen und das zusammengefuehrte Dokument zurueckgeben — zum Lesen ueber Kapitelgrenzen (globale Umschreibung, Konsistenzpass). Schreibt nichts; die Umkehrung `penwright_split_document` schon. Gleiche Kappung wie `read_file` |
| `penwright_split_document` | An `= Heading 1`-Grenzen in Kapitel aufteilen: legt `chapters/` an, schreibt die einzelnen `.typ` und ersetzt den Body der Wurzel durch `#include`-Zeilen |

### Bibliographie (4)

| Tool | Beschreibung |
|------|-------------|
| `penwright_get_citations` | Alle `.bib`-Eintraege im Projekt (citekey, type, title, author, year und alle BibTeX-Felder) |
| `penwright_add_citation` | BibTeX-Eintrag hinzufuegen; legt `references.bib` an, falls es fehlt, und stellt das `#bibliography` im Dokument sicher |
| `penwright_ensure_bibliography` | `references.bib` + `#bibliography`-Aufruf erstellen, falls fehlend |
| `penwright_find_source_for_citation` | Sucht in `sources/` nach `<citekey>.pdf` oder Suffix-Varianten (`<citekey>_supplement.pdf` etc.). Liefert den projekt-relativen Pfad oder `null` |

### Cross-Refs, Fussnoten & Comments (8)

Spiegelung von Cross-Reference-Picker, Footnote-UI und Comments-Panel aus dem Editor. Anker-basiert: der Agent gibt einen exakten Text-Snippet als `afterText`/`anchor` (plus optional eine 1-basierte `occurrence`) und Penwright findet und schreibt an die richtige Stelle. Comments leben als `comments/<id>.md` im Projekt-Root und werden **nie** in PDF/DOCX kompiliert.

| Tool | Beschreibung |
|------|-------------|
| `penwright_list_labels` | Alle `<label>`s im Projekt, klassifiziert nach Typ (figure / table / equation / heading / other) aus dem Praefix. **Vor `insert_reference` aufrufen**, sonst raet der Agent nur. Cap: 2000 |
| `penwright_list_project_macros` | Die Bausteine, die **dieses Projekt selbst** definiert — die `#let`-Makros in seinen eigenen `.typ`-Dateien, mit Parametern, dem `//`-Kommentar darueber als Label und dem Fundort. Das Design-Vokabular des Projekts (`#modul`, `#insight`, `#sumrow`), im Unterschied zu den 24 eingebauten Elementen aus `list_design_elements`. Mit `targetFile` nur das, was **dort** aufrufbar ist — ein `#import` in der Wurzel erreicht ein `#include`tes Kapitel nicht. Der Mensch sieht dieselbe Liste im Einfuegen-Menue unter „Aus diesem Projekt" |
| `penwright_insert_reference` | Eine `@`-Referenz an einer Anker-Position einfuegen — **entweder** ein `<label>` (Abbildung / Tabelle / Gleichung / Abschnitt) **oder ein Citekey aus der Bibliographie**. Typst schreibt beides gleich; bis Session 42 nahm das Tool nur Labels, womit die haeufigste Form ueberhaupt, ein `@` zu setzen (eine Quelle mitten im Absatz zitieren), im ganzen Server nicht bedienbar war. Prueft vorab, ob das Ziel existiert (sonst Vorschlaege aus **beiden** Mengen), und setzt ein Leerzeichen davor, wenn Typst es sonst ans vorherige Wort kleben wuerde |
| `penwright_add_footnote` | `#footnote[<body>]` an einer Anker-Position einfuegen. Der Body darf Inline-Typst enthalten; Klammer-Balance-Check darauf, damit der Typst-Parser nicht bricht |
| `penwright_list_comments` | Comments lesen, optional nach `file` gefiltert; erledigte sind per Default nicht dabei (`includeResolved: true` holt sie dazu). Pro Eintrag `{ id, file, anchor, body, resolved, orphaned }` — `orphaned` heisst, der Ankertext wurde wegeditiert |
| `penwright_add_comment` | Neuer Comment, verankert an einem wortgetreuen Text-Snippet (whitespace-exakt, ein Absatz). Erzeugt ID + YAML-Frontmatter; erscheint in Penwright als gelbe Markierung |
| `penwright_resolve_comment` | Comment als erledigt / wieder offen markieren. Erledigte sind im Panel per Default ausgeblendet, bleiben aber im Projekt |
| `penwright_delete_comment` | Comment-Datei endgueltig loeschen. Wer nur ausblenden will, nimmt `penwright_resolve_comment` |

### Suche (2)

**Pflicht fuer jeden Konsistenz-Check**: ohne diese Tools muesste der Agent jede Datei einzeln per `read_file` durchgehen, was bei 100+ Kapiteln teuer und fehleranfaellig wird.

| Tool | Beschreibung |
|------|-------------|
| `penwright_search_project` | Volltext-Suche ueber alle `.typ` (optional `.bib`), Treffer nach Datei gruppiert. Optionen: case-sensitive / whole-word / regex. Whole-Word funktioniert auch bei Tokens, die mit Sonderzeichen anfangen (`@chen2021codex` etc.) — Lookarounds statt `\b`. Cap: 1000 Treffer |
| `penwright_replace_in_project` | Bulk-Replace ueber alle Dateien in einem Durchgang. **Erst mit `dryRun: true` laufen lassen** — das meldet pro Datei, was sich aendern wuerde, und schreibt nichts. Ein Regex, der mehr trifft als gemeint, ist der Query allein nicht anzusehen, und das hier fasst alle Dateien auf einmal an. Der Dry-Run benutzt dieselbe Suche wie der Replace, nicht eine aehnliche |

### Projekte (3)

Zwei Wege, ein Projekt anzulegen. `create_project` gibt ein **leeres** Template (Struktur + Penwright-Defaults, kein Design, kein Inhalt). Die **Preset-Bibliothek** gibt fertige, compile-getestete Projekt-Ordner (Magazin, Report, Kochbuch, Portfolio, Thesis, Brief, Newsletter, Bilderbuch, Paper, Dokument) mit fertigem Design **und** Platzhalter-Text (Lorem); Magazin-Presets geben **jedem Kapitel ein eigenes Layout**. Die Bibliothek liegt gebuendelt unter `resources/presets/` (33 Presets); der MCP findet sie via `PENWRIGHT_PRESETS` (von `mcpSetup.buildMcpEnv` gesetzt) bzw. aus dem `TYPST_PACKAGE_PATH`-Nachbarordner — **und zusaetzlich die eigenen Presets des Nutzers** aus dem App-Datenordner.

| Tool | Beschreibung |
|------|-------------|
| `penwright_create_project` | Neues Projekt aus einem **leeren** Template (document / thesis / paper / letter / book / **magazine**). Seit Session 42 laeuft das durch **denselben Scaffold wie „Neues Projekt" in der App** (`shared/projectScaffold`): `assets/` + `sources/`, `.gitignore`, `.penwright/`-Skelett, die fuenf Projekt-Skills unter `.claude/skills/`, `style.typ` in der Wurzel verdrahtet, Git-Repo + erste Version. Vorher entstanden hier drei Dateien und sonst nichts — kein Repo (also nichts, was „Version speichern" haette wiederherstellen koennen) und keine Skills (der naechste Agent wusste nichts ueber die Konventionen des Projekts) |
| `penwright_list_presets` | Alle Presets auflisten (`id` / `type` / **`origin`** / `label` / `tagline` / `openFile`), optional nach `type` gefiltert (magazine, report, document, cookbook, portfolio, thesis, letter, newsletter, book, paper). `origin: "user"` sind die selbst gespeicherten Presets des Nutzers — bei „in meinem Stil" die zuerst nehmen |
| `penwright_create_from_preset` | Neues Projekt aus einem Preset anlegen — kopiert den Ordner verbatim (Design + Makros + Assets + Lorem, ohne `preset.json`/`thumbnail`), dann derselbe Scaffold wie oben, aber **ohne Restyling** (`wireRoot: false` — ein Preset bringt sein eigenes, oft handgeschriebenes `style.typ` mit, und das bleibt unangetastet): `.penwright/`, `.gitignore`, **die fuenf Projekt-Skills**, `git init` + erste Version; wechselt auf die Startdatei des Presets. Bis Session 42 trug **kein einziges** der gebuendelten Presets `.claude/`. **Bevorzugt gegenueber `create_project`, wenn ein designter Startpunkt gewuenscht ist** |

### Verlauf (8)

Drei getrennte Netze, und der Unterschied ist der Punkt: **Versionen** sind absichtlich und benannt (Git), **Auto-Backups** sind zeitgesteuert und vollstaendig (das Absturznetz), **Edit-Snapshots** sind pro Datei und pro Schreibvorgang (das Undo-Netz). Die Versionen-Tools sind die High-Level-API analog zum „Versionen"-Panel im UI: Schreiber-Vokabular („Version speichern" statt „Commit"), rein lokal, kein Push zum Remote, und das Git-Repo wird angelegt, wenn das Projekt noch keines hat.

Die Auto-Backups sind von dieser Seite aus **nur lesbar**: sie zu erzeugen ist Sache der App, und ein Fremdschreiben wuerde genau das Netz beschaedigen, an dem die Wiederherstellung des Nutzers haengt. Das Zurueckspielen bleibt darum auch beim Nutzer — der Agent verweist auf „Verlauf & Wiederherstellen" in Penwright.

**Das Undo-Netz** (`.penwright/ai-snapshots/`): `guardedWrite` sichert vor **jedem** Schreibvorgang dieses Servers die Vorversion der Datei — dieselbe Ablage, die „Undo AI Edit" und der Verlaufs-Hub der App lesen. Bis Session 42 konnte diese Seite den Ordner nur fuellen, nie hineinsehen. Begrenzt und pro Datei; fuer alles, was bleiben soll, `penwright_save_version`.

| Tool | Beschreibung |
|------|-------------|
| `penwright_list_backups` | Die automatischen Backups des Projekts, neueste zuerst — pro Eintrag `{ id, at, files, bytes }`. `id` ist der Zeitstempel-Ordnername und geht so in `penwright_read_backup` |
| `penwright_read_backup` | Was in einem Backup steht: ohne `file` die Dateiliste, mit `file` der Inhalt dieser einen Datei (gleiche 400-k-Kappung wie `read_file`). Zum Vergleich mit dem Ist-Zustand, bevor eine Wiederherstellung vorgeschlagen wird |
| `penwright_save_version` | Benannte Version speichern (Git-Commit). Optional auf bestimmte Dateien einschraenken. Returns `{ sha: null, skipped: true }`, wenn nichts zu speichern ist |
| `penwright_list_versions` | Versionsverlauf lesen, neueste zuerst, max. 200 Eintraege. Pro Eintrag `{ sha, message, date, author, isAuto }` |
| `penwright_show_version` | Diff einer einzelnen Version pro Datei: `{ path, status, patch }`, `status` = added / modified / deleted / renamed |
| `penwright_restore_version` | Dateien aus einer historischen Version zurueck in den Working-Tree — **verwirft alles, was seitdem geschrieben wurde**. **Verlangt `confirm: true`**, als einziges Tool hier, weil `git checkout` unkommittete Arbeit verwirft und dabei **keinen** Snapshot hinterlaesst, auf den `penwright_undo_last_edit` zurueckgreifen koennte. Ohne `confirm` passiert nichts und der Agent bekommt gesagt, was er stattdessen tun soll (vorher `penwright_save_version`) |
| `penwright_list_edits` | Die rueckgaengig machbaren Snapshots auflisten, neueste zuerst (`file` / `at` / `timestamp`) plus `count` und die geltende Aufbewahrungsgrenze (`retention`). Optional auf eine Datei eingeschraenkt |
| `penwright_undo_last_edit` | Den neuesten Snapshot zurueckspielen — die letzte Ueberschreibung einer Datei, oder ohne `file` die zuletzt geschriebene ueberhaupt. Mehrfach aufrufbar, meldet die Zahl der verbleibenden Undos. Laeuft selbst durch `guardedWrite`, ist also seinerseits rueckgaengig machbar. Erreicht nur, was durch Penwright oder diesen Server geschrieben wurde — fuer alles andere `penwright_restore_version` |

### Git — Low-Level (3)

Fuer Cloud-Sync-Workflows. Im Normalfall reicht der Verlaufs-Block oben. Alle drei verweigern, wenn das Projektverzeichnis **nicht selbst** die Wurzel eines Repos ist — sonst wuerde Git nach oben laufen und ein fremdes Repository stagen, committen oder pushen, ohne dass am Aufruf etwas falsch ausgesehen haette.

| Tool | Beschreibung |
|------|-------------|
| `penwright_git_status` | Branch, Ahead/Behind, geaenderte Dateien |
| `penwright_git_commit` | Stage all + Commit mit Message |
| `penwright_git_push` | Push zum Remote (das einzige Tool mit `openWorldHint`) |

### Export (3)

Alle drei schreiben in den Projektordner — Konvention: `exports/<name>.<ext>`, Parent-Dir wird automatisch angelegt. Pfade ausserhalb des Projekts und die falsche Endung werden abgelehnt. **Fuer den Web-/HTML-Export gibt es bewusst kein Tool** — der Agent verweist auf **Datei ▸ Ins Web exportieren (HTML)…** in der App.

| Tool | Beschreibung |
|------|-------------|
| `penwright_export_pdf` | PDF fuer Bildschirm und Buerodrucker, ueber die Typst-CLI. Identisch zur Live-Preview |
| `penwright_export_print` | PDF **fuer die Druckerei**: uebergrosse Seite mit Beschnitt (`bleed`, Default `"5mm"`, `""` schaltet ab) und Schnittmarken (`cropMarks`), Innen-/Aussenstege mit Bundzugabe (`facingPages` / `binding`), RGB — die Umwandlung nach CMYK/PDF-X macht die Druckerei. Schreibt nur Temp-Dateien und **aendert das Projekt-Design nicht**; bei einem handgestalteten Projekt ohne `style.json` wird nur ein export-eigener Geometrie-Overlay gelegt, das eigene Design bleibt. Ganzes Dokument — Kapitelauswahl gibt es nur im Export-Dialog der App |
| `penwright_export_docx` | DOCX fuer jemanden, der in Word redigieren oder kommentieren muss: echte Word-Styles (Heading1-6, Quote, CodeBlock, BibliographyEntry, Caption, …), Live-Multilevel-Numbering, Abbildungen, Tabellen, Fussnoten, Zitate. Multi-Chapter wird via `resolveIncludes` gemerged. **Rendert die reichen Konstrukte:** Abbildungen → Bild + „Abbildung N"-Caption, `#figure(table())` → echte Word-Tabelle, Display-Math + SVG → via gebuendeltem Typst rasterisierte Bilder, `@fig/@tbl/@eq`-Cross-Refs → aufgeloest, gentle-clues-Callouts → Akzent-Box, Seitenzahl-Footer, numerischer vs. Autor-Jahr-Zitierstil. Reiner Layout-/Design-Code (Magazin-Opener, Full-Bleed, …) wird uebersprungen statt geleakt — DOCX ist das Manuskript-Format, PDF das Design-Format |

---

## Was ein Agent seit Sessions 41–47 kann, das er vorher nicht konnte

Kurz, weil es nur vier Dinge sind — aber sie aendern, wie gearbeitet wird:

- **Design ist ein sicheres Experiment.** Jede Design-Mutation (`apply_style` / `update_style` / `apply_palette` / `apply_layout` / `generate_layout` / `insert_design_element` / `define_`, `apply_`, `clear_section_style`) wird gestaged, testweise kompiliert und bei einem Fehler **komplett** zurueckgerollt — mit der Typst-Meldung im Ergebnis. Vorher schrieb diese Seite ungeprueft und meldete Erfolg, weil der Schreibvorgang gelungen war. Also ausprobieren statt zoegern.
- **Der Agent kann die Seite sehen.** `penwright_render_page` liefert eine gerenderte Seite als Bild zurueck. Jede visuelle Frage — sitzt das Pull-Quote gut, laeuft das Bild aus der Spalte, wo ist die Ueberschrift gelandet — ist vorher aus dem Quelltext geraten worden.
- **Das Undo-Netz ist lesbar.** `penwright_list_edits` / `penwright_undo_last_edit` zeigen und spielen zurueck, was dieser Server (und Penwright) ueberschrieben hat; `penwright_list_backups` / `penwright_read_backup` machen dazu das Absturznetz der App einsehbar. Bis dahin konnte diese Seite den Ordner nur fuellen.
- **Das Projekt hat ein eigenes Vokabular, und es ist auflistbar.** `penwright_list_project_macros` gibt die `#let`-Makros zurueck, die das Projekt selbst definiert — mit Parametern, dem Kommentar darueber als Label und dem Fundort, und mit `targetFile` gefiltert auf das, was in dieser Datei ueberhaupt aufrufbar ist. Der Mensch sieht dieselbe Liste im Einfuegen-Menue unter „Aus diesem Projekt".

Dazu die stillen Aenderungen: der Server schickt seine `instructions` mit (sie erreichen das Modell, bevor es irgendetwas aufgerufen hat), jedes Tool traegt Titel und Annotations aus **einer** Tabelle, kein Tool deklariert ein `outputSchema`, das Handbuch des Nutzers ist als MCP-**Resource** abrufbar (`penwright://handbook/en`, `penwright://handbook/de`) — zu lesen, bevor erklaert wird, wie etwas **in der App** gemacht wird —, und Projekt sowie offene Datei werden bei jedem Tool-Aufruf aus dem Zustandskanal nachgezogen (intern auf 2 s gedrosselt) statt einmal beim Start — der Prozess lebt stundenlang, waehrend der Nutzer die Projekte wechselt.

### Absichtliche Luecken

- **Kein Tool bearbeitet eine Makro-Instanz.** Der Agent kann die Bausteine eines Projekts auflisten (`penwright_list_project_macros`) und Aufrufe als Text schreiben; das Formular-Karten-Editieren eines `#modul(...)`-Aufrufs ist eine Editor-Oberflaeche und hat bewusst kein Gegenstueck hier.
- **Kein Tool macht den Web-/HTML-Export.** Produktentscheidung; Menue und Dialog decken ihn ab. Die Export-Tools sagen das in ihrer Beschreibung, damit der Agent auf **Datei ▸ Ins Web exportieren (HTML)…** verweist statt stumm zu bleiben.

---

## Typische Workflows

### Projekt aus Preset anlegen

```
User:  "Mach mir ein Slow-Media-Magazin."
Agent: penwright_list_presets({ type: "magazine" })
  -> Available presets (5):
     [ { id: "magazine-slow", type: "magazine", origin: "bundled",
         label: "Slow / Literary", openFile: "chapters/01-editorial.typ" },
       { id: "magazine-bold", ... }, { id: "magazine-mono", ... }, ... ]
Agent: penwright_create_from_preset({ presetId: "magazine-slow", projectName: "mein-heft", parentDir: "/Users/.../Documents" })
  -> Created "mein-heft" from preset "magazine-slow" at /Users/.../Documents/mein-heft.
     Active file: chapters/01-editorial.typ
     …
     The project ships placeholder (Lorem) content — replace it with the real text.
Agent: penwright_get_document()          # liest das Editorial-Kapitel (Lorem)
Agent: penwright_update_document({ ... }) # ersetzt den Platzhaltertext
Agent: penwright_compile()
  -> { success: true, rootFile: ".../main.typ", sizeBytes: 1284310, errors: [], warnings: [] }
Agent: penwright_render_page({ page: 1 })  # nachsehen, ob es auch so aussieht
```

### Dokument bearbeiten

```
Agent: penwright_set_project({ projectDir: "/Users/.../my-thesis" })
Agent: penwright_get_document()
  -> { filePath: ".../main.typ", projectDir: "/Users/.../my-thesis", content: "…", wordCount: 4250 }
Agent: penwright_update_document({ content: "...geaenderter Inhalt..." })
Agent: penwright_compile()
  -> { success: true, rootFile: ".../main.typ", sizeBytes: 842103, errors: [], warnings: [] }
```

`set_project` ist meist ueberfluessig — Projekt und offene Datei kommen aus dem Zustandskanal der App. Nur aufrufen, wenn wirklich ein anderer Ordner gemeint ist.

### Kapitel-Struktur aufbauen

```
Agent: penwright_add_chapter({ title: "Methodology", position: 2 })
Agent: penwright_add_chapter({ title: "Results" })          # ohne position: angehaengt
Agent: penwright_get_chapters()
  -> { rootFile: "/Users/.../my-thesis/main.typ",
       chapters: [
         { index: 0, path: "chapters/introduction.typ", exists: true, title: "Introduction" },
         { index: 1, path: "chapters/methodology.typ",  exists: true, title: "Methodology" },
         { index: 2, path: "chapters/results.typ",      exists: true, title: "Results" }
       ]}
```

### Bibliographie aufbauen

```
Agent: penwright_ensure_bibliography()
Agent: penwright_add_citation({
  bibtex: "@article{smith2024, author={Smith}, title={...}, year={2024}, journal={...}}"
})
  -> "Added citation @smith2024 to references.bib"
Agent: penwright_get_citations()
  -> [{ file: "references.bib",
        entries: [{ citekey: "smith2024", type: "article", author: "Smith",
                    title: "...", year: "2024", fields: { … } }] }]

  # Gruppiert pro .bib-Datei. Gibt es gar keine, kommt stattdessen
  # { bibFiles: [], searchedFrom: [...] } — so bleibt „es gibt keine"
  # von „ich habe am falschen Ort gesucht" unterscheidbar.
```

### Style anwenden und exportieren

```
Agent: penwright_list_styles()
  -> [ { id: "classic-academic", … }, { id: "editorial-magazine", … }, … ]
Agent: penwright_apply_style({ styleId: "editorial-magazine" })
  -> "Applied theme "Editorial Magazine" — style.json + style.typ regenerated."
Agent: penwright_render_page({ page: 1 })
Agent: penwright_export_pdf({ outputPath: "exports/thesis.pdf" })
  -> "PDF exported to /.../my-thesis/exports/thesis.pdf (842.3 KB)"
```

Ein eigener `penwright_compile` danach ist nicht noetig: die Design-Tools kompilieren selbst testweise und rollen zurueck, wenn das Dokument dabei bricht. Der Output muss im Projekt liegen — Konvention ist `exports/<name>.pdf`. Der Ordner wird beim ersten Export automatisch angelegt. Wer das PDF ausserhalb des Projekts haben will, verschiebt es danach manuell. Fuer die Druckerei stattdessen `penwright_export_print`.

### Version speichern und wiederherstellen

```
Agent: penwright_save_version({ message: "Vor Lektorats-Feedback" })
  -> { sha: "a3f7b91", changes: 4, insertions: 120, deletions: 8 }

Agent: penwright_list_versions()
  -> [
       { sha: "a3f7b91...", message: "Vor Lektorats-Feedback", date: "...", isAuto: false },
       { sha: "9e2d4c8...", message: "Kapitel 3 erste Fassung", date: "...", isAuto: false }
     ]

Agent: penwright_show_version({ sha: "a3f7b91" })
  -> { sha: "a3f7b91", files: [{ path: "chapters/03-method.typ", status: "modified", patch: "@@ ..." }] }

Agent: penwright_restore_version({ sha: "9e2d4c8", files: ["chapters/03-method.typ"] })
  -> "Not restored. Restoring 9e2d4c8 would discard every change made since that version, …"

Agent: penwright_restore_version({ sha: "9e2d4c8", files: ["chapters/03-method.typ"], confirm: true })
  -> "Restored 1 file(s) from version 9e2d4c8."
```

`restore_version` ist das einzige Tool mit `confirm: true`. Ohne das Flag passiert nichts, und der Agent bekommt gesagt, was er stattdessen tun soll — vor einem `restore` gehoert ein `save_version`, sonst gehen die aktuellen Aenderungen der wiederhergestellten Dateien verloren.

### Cross-Reference einfuegen

```
Agent: penwright_list_labels({ type: "figure" })
  -> { labels: [
       { label: "fig:scaling",   type: "figure", caption: "Parameter scaling …", relPath: "chapters/04-results.typ", line: 24 },
       { label: "fig:dataflow",  type: "figure", caption: "Dataflow overview",   relPath: "chapters/03-method.typ",  line: 12 }
     ], truncated: false }

Agent: penwright_insert_reference({
  file: "chapters/05-discussion.typ",
  afterText: "as shown in",
  label: "fig:scaling"
})
  -> "Inserted " @fig:scaling" into chapters/05-discussion.typ at offset 1273 (cross-reference). Run penwright_compile to verify it resolves."

Agent: penwright_compile()
  -> { success: true, rootFile: ".../main.typ", sizeBytes: 842103, errors: [], warnings: [] }
```

`list_labels` ist Pflicht-Vorbereitung — `insert_reference` lehnt unbekannte Namen ab und schlaegt aehnliche vor. Dasselbe Tool setzt auch **Zitate**: `label: "chen2021codex"` (ein Citekey aus der Bibliographie) erzeugt dieselbe `@name`-Syntax und meldet sich als `(citation — it will render through the bibliography style)`.

### Footnote einfuegen

```
Agent: penwright_add_footnote({
  file: "chapters/03-method.typ",
  afterText: "five reference works",
  body: "Selection was peer-reviewed only — see the methodological note."
})
  -> "Inserted footnote into chapters/03-method.typ at offset 842."
```

Wenn `afterText` mehrfach vorkommt, antwortet das Tool mit der Anzahl Treffer und verlangt einen `occurrence`-Parameter.

### Comment hinterlassen

```
Agent: penwright_add_comment({
  file: "chapters/01-introduction.typ",
  anchor: "five reference works",
  body: "Quelle ergaenzen — vielleicht den Mueller-Artikel?",
  author: "Claude (research)"
})
  -> { id: "2026-04-29-1547-x9k", file: "chapters/01-introduction.typ", anchor: "five reference works", … }

Agent: penwright_list_comments({ file: "chapters/01-introduction.typ" })
  -> [{ id: "2026-04-29-1547-x9k", body: "Quelle ergaenzen …", resolved: false, … }]

Agent: penwright_resolve_comment({ id: "2026-04-29-1547-x9k" })
  -> "Comment 2026-04-29-1547-x9k marked as resolved."
```

Comments werden **nie** ins PDF/DOCX kompiliert — sie leben als sichtbare Markdown-Dateien im `comments/`-Ordner und sind cloud-sync-tauglich (Dropbox / iCloud / Git nehmen sie mit).

### Backlinks — Konsistenz-Check ueber alle Kapitel

```
Agent: penwright_search_project({ query: "@chen2021codex", wholeWord: true })
  -> {
       totalMatches: 7,
       truncated: false,
       files: [
         { relPath: "chapters/02-related.typ",   matches: [{ line: 18, ... }, { line: 34, ... }] },
         { relPath: "chapters/04-results.typ",   matches: [{ line: 92, ... }] },
         { relPath: "chapters/05-discussion.typ", matches: [{ line: 12, ... }, ...] }
       ]
     }

Agent: penwright_find_source_for_citation({ citekey: "chen2021codex" })
  -> { found: true, citekey: "chen2021codex", relPath: "sources/chen2021codex.pdf" }
```

Das Citation-Whole-Word funktioniert nur dank Lookaround-Pattern — `\b@key\b` waere kaputt, weil `\b` zwischen `@` und Buchstabe nicht greift.

### Bulk-Refactor mit Sicherheitsnetz

```
Agent: penwright_save_version({ message: "Vor Citekey-Umbenennung" })
  -> { sha: "8f2a91c", message: "…", changes: 4, insertions: 12, deletions: 12 }

Agent: penwright_replace_in_project({
  query: "smith2023", replacement: "smith2024", wholeWord: true, dryRun: true
})
  -> { dryRun: true, wouldChangeFiles: 4, wouldReplace: 11, truncated: false,
       files: [{ file: "chapters/02-related.typ", matches: 3 }, …],
       note: "Nothing was written. Repeat without dryRun to apply." }

Agent: penwright_replace_in_project({
  query: "smith2023", replacement: "smith2024", wholeWord: true
})
  -> { filesChanged: 4, totalReplacements: 11 }

Agent: penwright_compile()
  -> { success: true, rootFile: ".../main.typ", sizeBytes: 842103, errors: [], warnings: [] }
```

Der `dryRun` ist kein Ritual: er laeuft ueber dieselbe Suche wie der Replace, und ein Regex, der mehr trifft als gemeint, ist der Query allein nicht anzusehen. Wenn der Compile fehlschlaegt: `penwright_restore_version({ sha: "8f2a91c", confirm: true })` rollt zurueck — oder, fuer die letzte einzelne Ueberschreibung, `penwright_undo_last_edit`.

### Recherche-Notizen als Kapitel importieren

```
Agent: penwright_import_markdown({
  markdown: "# Verwandte Arbeiten\n\n## Chen et al. (2021)\n...",
  destPath: "chapters/verwandte-arbeiten.typ"
})
  -> "Imported Markdown to chapters/verwandte-arbeiten.typ (1842 characters). Review the output — complex Markdown constructs may need manual adjustment."

Agent: penwright_add_chapter({ title: "Verwandte Arbeiten" })
  -> "Included existing chapter "Verwandte Arbeiten" → chapters/verwandte-arbeiten.typ, included from main.typ."
```

`import_markdown` schreibt nur die konvertierte Body-Datei; den `#include`-Eintrag setzt `penwright_add_chapter` in einem zweiten Schritt — in der **Wurzel**, nicht in der gerade offenen Datei. Der Dateiname wird dabei aus dem Titel geslugt (`Verwandte Arbeiten` → `chapters/verwandte-arbeiten.typ`); passt der `destPath` dazu, wird die vorhandene Datei eingebunden statt einer zweiten angelegt.

### Bild als Figure mit Cross-Reference einbauen

```
Agent: penwright_add_image({
  srcPath: "/Users/.../scaling-plot.png",
  caption: "Parameter-Skalierung von Encoder vs. Decoder",
  label: "fig:scaling",
  width: "80%",
  alt: "Plot mit Parameter-Skalierung",
  file: "chapters/04-results.typ",
  afterText: "Wir untersuchen die Skalierung."
})
  -> "Asset placed at assets/scaling-plot.png. Inserted figure into chapters/04-results.typ at offset 1245."

Agent: penwright_insert_reference({
  file: "chapters/05-discussion.typ",
  afterText: "wie in",
  label: "fig:scaling"
})
  -> "Inserted " @fig:scaling" into chapters/05-discussion.typ at offset 832 (cross-reference). Run penwright_compile to verify it resolves."

Agent: penwright_compile()
  -> { success: true, rootFile: ".../main.typ", sizeBytes: 851904, errors: [], warnings: [] }
```

Mit `caption + label + file + afterText` sind Asset-Anlegen, Figure-Block bauen und Einfuegen ein einziger Tool-Call. (`label` verlangt `caption` — ein Typst-Label muss an einem `#figure`-Block haengen.)

### DOCX fuer Betreuer-Feedback exportieren

```
Agent: penwright_export_docx({ outputPath: "exports/thesis-v3-feedback.docx" })
  -> "DOCX exported to /.../my-thesis/exports/thesis-v3-feedback.docx (642.8 KB)"
```

Der Betreuer kann die Datei direkt in Word oeffnen und Kapitel umordnen — Heading-Numbering passt sich live an, weil Penwright Word-Multilevel-Numbering schreibt. Bibliographie wird zu `(Autor Jahr)` aufgeloest.

---

## Skill-Prompts und Handbuch

Der MCP-Server bietet fuenf MCP-Prompts an, die die im Projekt deployten Skill-Dateien laden:

| Prompt | Inhalt |
|--------|--------|
| `typst-reference` | Typst-Sprachreferenz — Syntax, Math, Cross-Refs, Footnotes, Bibliographie, gebuendelte Packages |
| `penwright-conventions` | Penwright-Projekt-Konventionen — Ordnerstruktur, Persistenz-Schichten, Design-Surface, Comments, Mode-Toggles |
| `research-workflow` | End-to-End-Recherche-Workflow — Discover, Capture, Synthesize, Integrate |
| `writing-style` | Schreib-Konventionen — Anti-AI-Tells, Active Prose, akademische Konventionen, Quellen-Disziplin (EN/DE) |
| `design-conventions` | Visuelle Design-Konventionen — Color-Theory, Typografie-Pairing, Heading-Hierarchy, Layout-Patterns, Modern Looks 2026, Anti-Patterns |

Der Agent ruft sie ueber MCP `prompts/get` ab. Inhalt liegt in `<projekt>/.claude/skills/{typst,penwright,research,writing-style,design}/SKILL.md` — der Ordnername ist **nicht** der Prompt-Name (`typst-reference` liegt in `typst/`, `penwright-conventions` in `penwright/`, `research-workflow` in `research/`, `design-conventions` in `design/`) — bei `penwright_create_project` **und** `penwright_create_from_preset` automatisch deployed, bei bestehenden Projekten on-demand bei Open. Master-Quelle: [src/shared/skillTemplates.ts](../src/shared/skillTemplates.ts). Weil die Creation-Pfade die Skill-Texte inzwischen aus der Binary heraus schreiben, braucht eine Aenderung an `skillTemplates.ts` einen MCP-Binary-Rebuild, um dort anzukommen — der Prompt-Pfad liest weiter von der Platte, da genuegt das Loeschen der veralteten SKILL.md.

**Update bestehender Projekte:** Wenn der Skill-Inhalt nach einem Penwright-Update aktualisiert werden soll, einfach die alte SKILL.md loeschen — beim naechsten Open wird sie aus dem Master neu geschrieben. Eigene User-Anpassungen werden nicht ueberschrieben (per-file-Guard).

**Das Handbuch als Resource.** Die Skills beschreiben Typst und die Konventionen des Projekts — nicht die **App**. Wo der Export-Dialog liegt, was „Fuer den Druck" tut, wie sich Versionen von Auto-Backups unterscheiden: das steht im Benutzerhandbuch, und das liefert der Server als MCP-Resource aus, `penwright://handbook/en` und `penwright://handbook/de`. Vor jeder Erklaerung, wie etwas **in Penwright** gemacht wird, gehoert es gelesen — sonst raet der Agent ueber eine Oberflaeche, die er nie gesehen hat, und das liest sich wie Wissen. Das Handbuch wird als Datei ausgeliefert und ueber `PENWRIGHT_DOCS` bzw. den `TYPST_PACKAGE_PATH`-Nachbarordner gefunden (nicht einkompiliert), damit eine Korrektur am Handbuch keinen Binary-Rebuild braucht.

---

## Voraussetzungen

**Beim Auto-Setup (Standalone-Binary) brauchst du weder System-Node noch System-Typst** — die Binary ist eigenstaendig, und Typst-Binary/Packages/Fonts kommen gebuendelt aus dem App-Bundle (via `TYPST_BIN` & Co.). Noetig ist nur **Claude Desktop** — der MCP-Server laeuft ohne Lizenz und ohne Zeitlimit (s. „Lizenz").

Fuer den **manuellen Node-Pfad** zusaetzlich:

- **Node.js 20+** — zum Ausfuehren von `server.mjs`
- **Typst CLI** im PATH (`typst --version`) **oder** `TYPST_BIN` gesetzt
- **Git** — fuer die Versionen-/Git-Tools (optional; das Repo wird bei der ersten Version automatisch initialisiert)

### Typst installieren (nur manueller Pfad)

```bash
# macOS
brew install typst

# Linux
curl -fsSL https://typst.community/typst-install/install.sh | sh

# Windows
winget install --id Typst.Typst
```

---

## Lizenz

**Der MCP Server ist ungesperrt. Er startet fuer alle** — alle 66 Tools, ohne Key, ohne Zeitlimit. Penwright selbst ist kostenlos fuer alle, inklusive Unternehmen; der Quelltext darf nicht in fremde Projekte uebernommen werden. Siehe [LICENSE.md](../LICENSE.md).

---

## Architektur

Der MCP Server ist ein **eigenstaendiger Prozess** — er laeuft unabhaengig von der Electron-App. Er importiert Shared-Module (settingsParser, rootFinder, bibParser) direkt und ruft die (gebuendelte oder System-)`typst`-Binary fuer Kompilierung auf.

```
src/mcp/server.ts             <- Alle 66 Tools in einer Datei
esbuild.mcp.mjs               <- Build (ESM, Node 20) -> dist/mcp/server.mjs (Dev / manueller Node-Pfad)
scripts/build-mcp-binary.mjs  <- Bun `--compile` -> dist/mcp/bin/penwright-mcp-<triple> (die ausgelieferte Standalone-Binary)
```

Die **ausgelieferte Form** ist die Bun-kompilierte Standalone-Binary (~64 MB), gebuendelt im App-Bundle (`Contents/Resources/mcp/bin/`) und vom Wizard nach `~/Library/Application Support/Penwright/mcp-server/` kopiert — entkoppelt von der laufenden App. `dist/mcp/server.mjs` (esbuild) bleibt nur fuer den manuellen Node-Pfad.

### Abgrenzung

Der MCP Server bietet nur Funktionen an, die externe AI-Agents **nicht selbst koennen**:

- Keine Websuche (Agents haben eigene Suchtools)
- Keine Shell-Commands (Agents haben eigene Terminals)
- Kein generisches Dateisystem — `search_project` / `replace_in_project` sind **projekt-scoped** und kennen die Regeln des Projekts (`.typ`/`.bib`, Lookaround-Whole-Word, Treffer-Cap, Sandbox); das ist etwas anderes als grep ueber einen Ordner
- Fokus auf **Penwright-spezifische Operationen**: Typst-Kompilierung und Seiten-Rendering, Document Settings, die Design-Tokens, Kapitel-Verwaltung, Citation Management, die Verlaufs-Netze
