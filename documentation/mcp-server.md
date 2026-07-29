# Penwright MCP Server — AI Integration

> **63 Tools** fuer externe AI-Agents | Unabhaengig von der Electron-App | Claude Desktop, Codex, Cowork u.a.

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

**Der normale Weg ist der Auto-Discovery-Wizard in der App** — du musst nichts von Hand bauen oder konfigurieren.

### Empfohlen: Auto-Setup ueber die App

1. Penwright oeffnen → **Hilfe → Mit Claude Desktop verbinden** (MCP-Setup-Wizard, `McpSetupWizard.svelte`). Voraussetzung: Claude Desktop ist installiert + eine gueltige Penwright-Lizenz **oder eine laufende 14-Tage-Demo** (der MCP-Server ist in der kompletten Demo freigeschaltet — s. „Lizenz" unten).
2. Der Wizard kopiert die **Bun-kompilierte Standalone-Binary** (`penwright-mcp`, ~64 MB) aus dem App-Bundle (`Contents/Resources/mcp/bin/`) nach `~/Library/Application Support/Penwright/mcp-server/` und traegt einen `Penwright`-Eintrag in `~/Library/Application Support/Claude/claude_desktop_config.json` ein — **idempotent**, andere `mcpServers` bleiben erhalten, mit timestamped Backup.
3. In den Eintrag schreibt der Wizard die noetigen Env-Variablen:
   - `PENWRIGHT_LICENSE_KEY` — der Lizenz-Key (Server validiert beim Start selbst).
   - `TYPST_BIN` / `TYPST_PACKAGE_PATH` / `TYPST_FONT_PATH` — zeigen auf die gebuendelte Typst-Binary, die `@preview/*`-Packages und die OFL-Fonts im App-Bundle, **damit der Server auch auf einer Maschine ohne System-Typst kompiliert/exportiert**.
4. Claude Desktop neu starten. Die Penwright-Tools erscheinen im MCP-Menue.

Die Binary ist **von der laufenden App entkoppelt** — Claude Desktop kann sie unabhaengig spawnen, Reihenfolge egal, und Penwright zu beenden killt den MCP-Child nicht. (Plattformen: **macOS getestet**, Windows verdrahtet aber ungetestet; Linux n/a — kein Claude Desktop.) Aendert sich Binary oder Config-Schema, wird `MCP_SETUP_VERSION` (in `mcpSetup.ts`) erhoeht und der Wizard re-triggert.

### Alternativ: Meta-MCP oder Claude Code (Startauswahl, `mcpRegistration.ts`)

Statt (oder zusaetzlich zu) Claude Desktop kann Penwright sich auch bei **genau einem** von zwei weiteren Hosts registrieren — gewaehlt ueber **Hilfe → „MCP-Verbindung…"** (Dialog `McpConnectionDialog.svelte`, beim Erststart automatisch) oder den CLI-Flag `--mcp-target=meta|claude`:

- **Meta-MCP** — lokaler Aggregator-Proxy auf `http://localhost:3663`. Registrierung per `POST /register` (Hot-Reload, dedupliziert per `name`); Deregistrierung durch Editieren der beobachteten `…/com.metamcp.desktop/config.json` (es gibt keinen HTTP-Unregister).
- **Claude Code** — User-Scope (global): `claude mcp add --scope user penwright --env … -- <bin>`, mit Fallback auf ein direktes `~/.claude.json`-Edit, falls die `claude`-CLI nicht im PATH liegt.

Es ist **immer nur genau eine** dieser beiden Registrierungen aktiv (kein Doppel-Eintrag). Beim Start wird der gewaehlte Zustand idempotent hergestellt: Ziel registrieren, anderes Ziel deregistrieren. Server-Definition (Binary + Env, inkl. der oben genannten Typst-Pfade und Lizenz/Trial-Credential) ist identisch zum Claude-Desktop-Eintrag. Der **Claude-Desktop-Wizard** oben bleibt davon unberuehrt (eigener Host, koexistiert).

### Manuell (Power-User / Dev)

Wer den Server unter eigenem Node laufen lassen will:

```bash
npm run build:mcp          # -> dist/mcp/server.mjs           (esbuild, braucht Node 20+ zum Ausfuehren)
# ODER die Standalone-Binary selbst bauen (braucht Bun):
npm run build:mcp-binary   # -> dist/mcp/bin/penwright-mcp-<triple>   (bun build --compile)
```

`~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "Penwright": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/vswrite-desktop/dist/mcp/server.mjs"],
      "env": {
        "PENWRIGHT_LICENSE_KEY": "pw_LIC…",
        "TYPST_BIN": "/opt/homebrew/bin/typst"
      }
    }
  }
}
```

Kein `--project`-Pfad noetig — der Agent wechselt Projekte dynamisch via `penwright_set_project`. Beim manuellen Node-Pfad muss Typst im PATH sein **oder** `TYPST_BIN` gesetzt. Danach Claude Desktop neu starten — Claude sieht die Penwright-Tools im MCP-Menue.

---

## Verfuegbare Tools (63)

### Projekt & Dateien (5)

| Tool | Beschreibung |
|------|-------------|
| `penwright_set_project` | Projekt-Verzeichnis setzen/wechseln (auto-detect main.typ) |
| `penwright_list_files` | Projekt-Dateibaum anzeigen |
| `penwright_read_file` | Projektdatei lesen (Text oder Base64 fuer Binaerdateien) |
| `penwright_write_file` | Datei schreiben (mit auto-mkdir) |
| `penwright_create_project` | Neues Projekt aus Template (document, thesis, paper, letter, book, **magazine**). `magazine` ist die Slow-Media-Vorlage fuer ai-magazine-designer. Seit Session 42 laeuft das durch **denselben Scaffold wie „Neues Projekt" in der App** (`shared/projectScaffold`): `assets/` + `sources/`, `.gitignore`, `.penwright/`-Skelett, die fuenf Projekt-Skills unter `.claude/skills/`, `style.typ` in der Wurzel verdrahtet, Git-Repo + erste Version. Vorher entstanden hier drei Dateien und sonst nichts — kein Repo (also nichts, was „Version speichern" haette wiederherstellen koennen) und keine Skills (der naechste Agent wusste nichts ueber die Konventionen des Projekts). |

### Presets — fertige Projekt-Starter (2)

Die **Preset-Bibliothek**: fertige, compile-getestete Projekt-Ordner (Magazin, Report, Kochbuch, Portfolio, Thesis, Brief, Newsletter, Bilderbuch, Poster …) mit fertigem Design **und** Platzhalter-Text (Lorem). Magazin-Presets geben **jedem Kapitel ein eigenes Layout**. Anders als `create_project` (leeres Template) kopiert der Agent hier ein **komplett designtes** Projekt und ersetzt nur den Platzhaltertext. Die Bibliothek liegt geb&uuml;ndelt unter `resources/presets/`; der MCP findet sie via `PENWRIGHT_PRESETS` (von `mcpSetup.buildMcpEnv` gesetzt) bzw. aus dem `TYPST_PACKAGE_PATH`-Nachbarordner.

| Tool | Beschreibung |
|------|-------------|
| `penwright_list_presets` | Alle Built-in-Presets auflisten (`id` / `type` / `label` / `tagline` / `openFile`), optional nach `type` gefiltert (magazine, report, document, cookbook, portfolio, thesis, letter, newsletter, book, paper) |
| `penwright_create_from_preset` | Neues Projekt aus einem Preset anlegen — kopiert den Ordner verbatim (Design + Makros + Assets + Lorem, ohne `preset.json`/`thumbnail`), dann derselbe Scaffold wie oben (ohne Restyling und ohne zusaetzliche Ordner — das Preset bringt seine eigene Struktur mit): `.penwright/`, `.gitignore`, **die fuenf Projekt-Skills**, `git init` + erste Version; wechselt auf die Startdatei des Presets. Bis Session 42 trug **kein einziges** der 35 geb&uuml;ndelten Presets `.claude/`. **Bevorzugt gegen&uuml;ber `create_project`, wenn ein designter Startpunkt gew&uuml;nscht ist.** |

### Dokument-Operationen (5)

| Tool | Beschreibung |
|------|-------------|
| `penwright_get_document` | Aktuelles Dokument lesen (Content, Pfad, Word Count) |
| `penwright_open_file` | .typ Datei als aktuelles Dokument oeffnen |
| `penwright_update_document` | Dokumentinhalt ersetzen und speichern |
| `penwright_compile` | Verifiziert, dass das Dokument kompiliert. Liefert `{ success, rootFile, sizeBytes }` oder strukturierte `errors[]`. Ergebnisdatei wird verworfen — fuer ein echtes Artefakt `penwright_export_pdf` / `penwright_export_docx` nutzen. |
| `penwright_render_page` | **Rendert eine Seite des kompilierten PDFs als Bild und liefert sie zurueck** (`type: 'image'`) — der Agent *sieht* das Layout, statt es aus dem Quelltext zu erraten. Vor jeder visuellen Beurteilung (Abstaende, Ueberlauf, Farbe, wo eine Ueberschrift gelandet ist) benutzen. Max. 2 Seiten / 4 MB pro Aufruf, `ppi` 72–300 (Default 144); hoehere Werte kosten Kontext. |

### Settings & Styles (2)

Document Settings sind seit Session 22 auf `lang` + `bibliographyStyle` reduziert — Typografie, Layout und Design-Tokens leben jetzt in `style.json` (siehe Design-Tools weiter unten).

| Tool | Beschreibung |
|------|-------------|
| `penwright_get_settings` | Document Settings lesen (lang + bibliographyStyle) |
| `penwright_update_settings` | Settings aendern (nur geaenderte Keys angeben) |

### Design (16) — Themes, Layouts, Palette, Fonts, Elements, Section Styles, Selection-Handoff

Die strukturierte Design-Surface aus dem Design-Editor-Tab. Schreibt direkt nach `.penwright/style.json`, regeneriert `style.typ`, und stellt sicher dass die root-`.typ` Datei `#import "style.typ": *` + `#show: apply-style` ganz oben hat. Operationen sind idempotent und preservieren `style.custom.preamble` (User-Escape-Hatch-Code) **und `style.sections`** (per-Chapter Section Styles) bei Theme- und Layout-Swaps.

**Jede Design-Mutation ist ein sicheres Experiment (seit Session 42).** Die Schreibvorgaenge werden gestaged, das Dokument wird testweise kompiliert, und wenn es danach nicht mehr kompiliert, wird **der komplette Satz** zurueckgerollt — das Projekt ist exakt wie vorher, und das Tool sagt das mit der Typst-Fehlermeldung dazu (`shared/safeApply`, dieselbe Maschinerie wie `safeApplyDesign` in der App). Vorher schrieb diese Seite ungeprueft: ein einziges `apply_layout` konnte das Dokument unkompilierbar hinterlassen, ohne Rueckweg, und das Tool meldete Erfolg, weil der Schreibvorgang gelungen war. War das Dokument **schon vorher** kaputt, wird die Aenderung trotzdem angewendet (ein Design-Schritt wird nicht fuer einen vorbestehenden Inhaltsfehler bestraft) und der Hinweis sagt das.

Bei einem Projekt mit **handgeschriebener `style.typ`** verweigern alle Design-Tools den Schreibvorgang — `penwright_get_style` meldet das vorab als `adopted: false`, damit die Absage keine Ueberraschung ist.

| Tool | Beschreibung |
|------|-------------|
| `penwright_get_style` | Design-Zustand lesen: `{ initialized, adopted, rootFile, styleTypFile, style }`. **`initialized` zuerst lesen** — ist es `false`, sind die gezeigten Tokens Penwright-**Defaults** und beschreiben nicht, wie das Dokument aussieht; `adopted: false` heisst handgeschriebene `style.typ`, die Design-Tools verweigern. Ohne diese Flags sahen Defaults aus wie Tatsachen. |
| `penwright_update_style` | Partial-Patch (deep-merge mit Per-Leaf-Sanitizer). z.B. `{ colors: { primary: "#0f172a" } }` reicht; Rest bleibt. Invalid hex/weight/range faellt auf alten Wert zurueck statt zu erroren |
| `penwright_list_styles` | Built-in Themes auflisten (id / name / description / bestFor) — Classic Academic, Modern Tech, Editorial Magazine, Minimal, Marketing Brochure, Thesis |
| `penwright_apply_style` | Theme komplett anwenden — \`styleId: "marketing-brochure"\`. Ueberschreibt colors/fonts/scale/layout/headings/elements; behaelt `custom.preamble` |
| `penwright_list_layouts` | 7 Layout-Presets (A4 portrait/landscape, Magazine 2-col, Newsletter 3-col, A5 Booklet, A2 Poster, **Magazine Editorial**) inkl. Paper/Orientation/Columns/BaseSize-Metadata |
| `penwright_apply_layout` | Tauscht nur die `layout.*` Werte (+ optional `scale.base`) — Theme/Farben/Fonts bleiben. Kombinierbar mit `apply_style` |
| `penwright_list_fonts` | Die 7 gebuendelten OFL-Fonts (Inter, IBM Plex Sans/Serif/Mono, JetBrains Mono, Crimson Pro, Spectral) — family/category/description |
| `penwright_apply_palette` | 5-Farb-Palette setzen. Entweder `presetId` (z.B. "editorial", "earth-tones") ODER per-slot hex overrides (primary/accent/text/background/muted), kombinierbar. Kein-Argumente-Call returned die verfuegbaren Presets |
| `penwright_list_design_elements` | Library der **22** parametrischen Snippets (Banner / Sidebar / Pull-Quote / Callout / Hero / Divider + Drop-Cap / Divider-Asterisks / Divider-Ornament / Pull-Quote-Display / Pull-Quote-Block / Article-Opener / Section-Opener / Gallery-2up / Gallery-3up / **Gallery-Asymmetric** / **Image-Overlay** / **Stats-Box** / **Photo-Caption-Wrap** / Magazine-Cover / **Full-Bleed-Image** / **Spread-Opener** / **Margin-Note**) inkl. erwarteter Params pro Element |
| `penwright_insert_design_element` | Snippet an Anchor-Position einfuegen — z.B. Hero am Dokument-Anfang, Pull-Quote nach einem bestimmten Absatz. Snippets referenzieren `style-colors.*` und `style-fonts.*` und re-themen automatisch wenn Palette/Typografie wechselt |
| `penwright_generate_layout` | Hoch-Level-Komposit: `intent: "brochure"` waehlt Marketing-Brochure Theme + Magazine-2col Layout + optional Hero am Anfang. Intent-Mapping deckt brochure / thesis / magazine / report / spec / minimal / newsletter / poster / booklet / slide ab |
| `penwright_list_section_styles` | **Section Styles (Phase E)** — per-Chapter "Rubriken". Listet die 5 Built-in-Presets (feature / interview / essay / photo-essay / department), die im Projekt definierten Varianten, und welche Kapitel welche Variante nutzen |
| `penwright_define_section_style` | Variante anlegen/aendern — `fromPreset` als Startpunkt und/oder explizite Overrides (accent / fonts / baseSize / leading / columns / h1*). Schreibt nach `style.sections`, regeneriert `style.typ` mit einem `#let <id>-style(body)` pro Variante |
| `penwright_apply_section_style` | Variante einem Kapitel zuweisen — injiziert den scoped `#import "../style.typ": <id>-style` + `#show: <id>-style` oben in die Kapitel-Datei. Auto-definiert ein Preset falls noetig. Restyled NUR dieses Kapitel (accent / fonts / columns / headings); Page-Geometrie + Running-Heads bleiben dokument-level. Danach `penwright_compile` |
| `penwright_clear_section_style` | Section-Opt-in aus einem Kapitel entfernen (zurueck zum Dokument-Default-Look). Die Variante bleibt in `style.json` definiert |
| `penwright_get_selection` | **Design-with-AI-Handoff:** liest die im Editor gepinnte Auswahl aus `.penwright/selection.json` — Anker-Text + 1-basierte Occurrence + ein Design-Snapshot (Theme / Palette / Fonts / Layout / SectionStyle / grobe `usedElements`). Der Agent handelt an der Anker-Stelle (`insert_design_element` oder lokalisiertes Typst); der Watcher loescht den Pin automatisch, nachdem die Datei extern geaendert wurde |

### Kapitel & Struktur (6)

| Tool | Beschreibung |
|------|-------------|
| `penwright_get_chapters` | #include Kapitel-Struktur mit Titeln lesen |
| `penwright_reorder_chapters` | #include-Reihenfolge aendern |
| `penwright_add_chapter` | Neue Kapitel-Datei erstellen + #include einfuegen |
| `penwright_remove_chapter` | #include-Zeile entfernen (Datei bleibt erhalten) |
| `penwright_merge_document` | Alle #includes aufloeosen, zusammengefuehrtes Dokument zurueckgeben |
| `penwright_split_document` | An Heading-1-Grenzen in Kapitel aufteilen |

### Bibliographie & Citations (3)

| Tool | Beschreibung |
|------|-------------|
| `penwright_get_citations` | Alle .bib Eintraege im Projekt lesen (citekey, author, title, year) |
| `penwright_add_citation` | BibTeX-Eintrag hinzufuegen + #bibliography sicherstellen |
| `penwright_ensure_bibliography` | references.bib + #bibliography erstellen falls fehlend |

### Cross-References & Footnotes (3)

Spiegelung der Cross-Reference-Picker- und Footnote-UI aus dem Editor. Anker-basiert: der Agent gibt einen exakten Text-Snippet als `afterText`/`anchor` und Penwright findet und schreibt an die richtige Stelle.

| Tool | Beschreibung |
|------|-------------|
| `penwright_list_labels` | Alle `<label>`s im Projekt auflisten, optional nach Typ gefiltert (figure / table / equation / heading / other). Liefert `{ label, type, caption, relPath, line }`. **Vor `insert_reference` aufrufen**, sonst raet der Agent nur. |
| `penwright_insert_reference` | `@label` an einer Anker-Position einfuegen. Validiert, dass das Label existiert (sonst Vorschlaege). Auto-Space, wenn der vorherige Char alphanumerisch ist (Typst-Syntax-Zwang). |
| `penwright_add_footnote` | `#footnote[<body>]` an einer Anker-Position einfuegen. Klammer-Balance-Check auf den Body, damit der Typst-Parser nicht bricht. |

### Comments & Annotations (4)

Spiegelung des Comments-Panels. Comments leben als `comments/<id>.md` im Projekt-Root und werden **nie** in PDF/DOCX kompiliert — geeignet fuer Selbstnotizen oder Betreuer-Feedback.

| Tool | Beschreibung |
|------|-------------|
| `penwright_list_comments` | Comments lesen, optional nach Datei gefiltert. Standard: nur offene (nicht-erledigte). |
| `penwright_add_comment` | Neuer Comment, verankert an einem exakten Text-Snippet in einer Projektdatei. Erzeugt automatisch ID + YAML-Frontmatter. |
| `penwright_resolve_comment` | Comment als erledigt / wieder offen markieren. |
| `penwright_delete_comment` | Comment-Datei loeschen. |

### Discovery — Suche & Quellen (3)

Projekt-weite Suche und Citation-Source-Lookup. **Pflicht fuer jeden Konsistenz-Check**: ohne diese Tools muesste der Agent jede Datei einzeln per `read_file` durchgehen, was bei 100+ Kapiteln teuer und fehleranfaellig wird.

| Tool | Beschreibung |
|------|-------------|
| `penwright_search_project` | Volltext-Suche ueber alle `.typ` (optional `.bib`). Optionen: case-sensitive / whole-word / regex. Whole-Word funktioniert auch bei Tokens, die mit Sonderzeichen anfangen (`@chen2021codex` etc.) — Lookarounds statt `\b`. Cap: 1000 Treffer. |
| `penwright_replace_in_project` | Bulk-Replace ueber alle Dateien. **Destruktiv** — vorher `penwright_save_version` aufrufen. |
| `penwright_find_source_for_citation` | Sucht in `sources/` nach `<citekey>.pdf` oder Suffix-Varianten (`<citekey>_supplement.pdf` etc.). Liefert relativen Pfad oder `{ found: false }`. |

### Export (2)

PDF und DOCX schreiben in den Projektordner — Konvention: `exports/<name>.<ext>`, Parent-Dir wird automatisch angelegt. Pfade ausserhalb des Projekts werden abgelehnt.

| Tool | Beschreibung |
|------|-------------|
| `penwright_export_pdf` | PDF-Export ueber die Typst-CLI. Identisch zur Live-Preview. |
| `penwright_export_docx` | DOCX-Export mit echten Word-Styles (Heading1-6, Quote, CodeBlock, BibliographyEntry, Caption, …) und Live-Multilevel-Numbering. Multi-Chapter wird via `resolveIncludes` gemerged. **Rendert die reichen Konstrukte:** Abbildungen → Bild + „Abbildung N"-Caption, `#figure(table())` → echte Word-Tabelle, Display-Math + SVG → via gebundeltem Typst rasterisierte Bilder, `@fig/@tbl/@eq`-Cross-Refs → aufgeloest, Fussnoten → echte Word-Fussnoten, gentle-clues-Callouts → Akzent-Box, Seitenzahl-Footer, numerischer vs. Autor-Jahr-Zitierstil. Reiner Layout-/Design-Code (Magazin-Opener, Full-Bleed, …) wird uebersprungen statt geleakt — DOCX ist das Manuskript-Format, PDF das Design-Format. |

### Import & Assets (2)

| Tool | Beschreibung |
|------|-------------|
| `penwright_import_markdown` | Konvertiert Markdown nach Typst (Headings, Bold/Italic, Links, Bilder, Listen, Code-Bloecke, Blockquotes; YAML-Frontmatter wird uebersprungen). Source: inline `markdown`-Text ODER `srcPath` (kann ausserhalb des Projekts liegen). Destination ist immer im Projekt. |
| `penwright_add_image` | Kopiert ein Bild nach `assets/` (Content-Hash-Dedup) und liefert ein Typst-Snippet zurueck. Mit `caption` wird daraus ein `#figure(...)`, mit `caption + label` ein referenzierbares Figure-Target. Optional sofortiger Inline-Insert via `file + afterText` — spart eine Round-Trip. |

### Versionen (4) + Rueckgaengig (2)

High-Level-API analog zum „Versionen"-Panel im UI. Spricht Schreiber-Vokabular („Version speichern" statt „Commit") und arbeitet rein lokal — kein Push zum Remote. Initialisiert das Git-Repo automatisch, wenn das Projekt noch keines hat.

| Tool | Beschreibung |
|------|-------------|
| `penwright_save_version` | Benannte Version speichern (Git-Commit). Optional auf bestimmte Dateien einschraenken. Returns `{ sha: null, skipped: true }`, wenn nichts zu speichern ist. |
| `penwright_list_versions` | Versionsverlauf lesen, neueste zuerst, max. 200 Eintraege. Pro Eintrag: `{ sha, message, date, author, isAuto }`. |
| `penwright_show_version` | Diff einer einzelnen Version pro Datei: `{ path, status, patch }`. |
| `penwright_restore_version` | Dateien aus einer historischen Version zurueck in den Working-Tree. **Achtung:** ueberschreibt unkommittete Aenderungen. Vorher `penwright_save_version` aufrufen, um den aktuellen Stand zu sichern. |

**Das Undo-Netz** (`.penwright/ai-snapshots/`) ist etwas anderes als Versionen: `guardedWrite` sichert vor **jedem** Schreibvorgang dieses Servers die Vorversion der Datei — dieselbe Ablage, die „Undo AI Edit" und der Verlaufs-Hub der App lesen. Bis Session 42 konnte diese Seite den Ordner nur fuellen, nie hineinsehen. Begrenzt und pro Datei; fuer alles, was bleiben soll, `penwright_save_version`.

| Tool | Beschreibung |
|------|-------------|
| `penwright_list_edits` | Die rueckgaengig machbaren Snapshots auflisten, neueste zuerst (`file` / `at` / `timestamp`) plus die geltende Aufbewahrungsgrenze. Optional auf eine Datei eingeschraenkt. |
| `penwright_undo_last_edit` | Den neuesten Snapshot zurueckspielen — die letzte Ueberschreibung einer Datei, oder ohne `file` die zuletzt geschriebene ueberhaupt. Mehrfach aufrufbar. Laeuft selbst durch `guardedWrite`, ist also seinerseits rueckgaengig machbar. |

### Git — Low-Level (3)

Fuer Cloud-Sync-Workflows. Im Normalfall reicht der Versionen-Block oben.

| Tool | Beschreibung |
|------|-------------|
| `penwright_git_status` | Branch, Ahead/Behind, geaenderte Dateien |
| `penwright_git_commit` | Stage all + Commit mit Message |
| `penwright_git_push` | Push zum Remote |

---

## Typische Workflows

### Projekt aus Preset anlegen

```
User:  "Mach mir ein Slow-Media-Magazin."
Agent: penwright_list_presets({ type: "magazine" })
  -> [ { id: "magazine-slow", label: "Slow / Literary", openFile: "chapters/01-editorial.typ" },
       { id: "magazine-bold", ... }, { id: "magazine-mono", ... }, ... ]
Agent: penwright_create_from_preset({ presetId: "magazine-slow", projectName: "mein-heft", parentDir: "/Users/.../Documents" })
  -> Created "mein-heft" from preset "magazine-slow" — active file: chapters/01-editorial.typ
Agent: penwright_get_document()          # liest das Editorial-Kapitel (Lorem)
Agent: penwright_update_document({ ... }) # ersetzt den Platzhaltertext
Agent: penwright_compile()
  -> { success: true, pages: 10 }        # jedes Kapitel ein eigenes Layout
```

### Dokument bearbeiten

```
Agent: penwright_set_project({ dir: "/Users/.../my-thesis" })
Agent: penwright_get_document()
  -> { content: "...", filePath: "main.typ", wordCount: 4250 }
Agent: penwright_update_document({ content: "...geaenderter Inhalt..." })
Agent: penwright_compile()
  -> { success: true, pages: 12 }
```

### Kapitel-Struktur aufbauen

```
Agent: penwright_add_chapter({ title: "Methodology", position: 2 })
Agent: penwright_add_chapter({ title: "Results", position: 3 })
Agent: penwright_get_chapters()
  -> { includes: [
       { path: "chapters/introduction.typ", title: "Introduction" },
       { path: "chapters/methodology.typ", title: "Methodology" },
       { path: "chapters/results.typ", title: "Results" }
     ]}
```

### Bibliographie aufbauen

```
Agent: penwright_ensure_bibliography()
Agent: penwright_add_citation({
  bibtex: "@article{smith2024, author={Smith}, title={...}, year={2024}, journal={...}}"
})
Agent: penwright_get_citations()
  -> [{ citekey: "smith2024", author: "Smith", title: "...", year: "2024" }]
```

### Style anwenden und exportieren

```
Agent: penwright_list_styles()
Agent: penwright_apply_style({ styleId: "elegant" })
Agent: penwright_compile()
Agent: penwright_export_pdf({ outputPath: "exports/thesis.pdf" })
  -> "PDF exported to /.../my-thesis/exports/thesis.pdf (842.3 KB)"
```

Der Output muss im Projekt liegen — Konvention ist `exports/<name>.pdf`. Der Ordner wird beim ersten Export automatisch angelegt. Wer das PDF ausserhalb des Projekts haben will, verschiebt es danach manuell.

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
  -> "Restored 1 file(s) from version 9e2d4c8."
```

Vor einem `restore` empfiehlt sich ein `save_version`, sonst gehen die aktuellen Aenderungen der wiederhergestellten Dateien verloren.

### Cross-Reference einfuegen

```
Agent: penwright_list_labels({ type: "figure" })
  -> { labels: [
       { label: "fig:scaling",   type: "figure", caption: "Parameter scaling …", relPath: "chapters/04-results.typ", line: 24 },
       { label: "fig:dataflow",  type: "figure", caption: "Dataflow overview",   relPath: "chapters/03-method.typ",  line: 12 }
     ]}

Agent: penwright_insert_reference({
  file: "chapters/05-discussion.typ",
  afterText: "as shown in",
  label: "fig:scaling"
})
  -> "Inserted \" @fig:scaling\" into chapters/05-discussion.typ at offset 1273. Run penwright_compile to verify the cross-reference resolves."

Agent: penwright_compile()
  -> { success: true }
```

`list_labels` ist Pflicht-Vorbereitung — `insert_reference` lehnt unbekannte Label-Namen ab und schlaegt aehnlich aussehende Labels vor.

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
  -> { sha: "8f2a91c", changes: 0 }   // skipped if nothing to save

Agent: penwright_replace_in_project({
  query: "smith2023",
  replacement: "smith2024",
  wholeWord: true
})
  -> { filesChanged: 4, totalReplacements: 11 }

Agent: penwright_compile()
  -> { success: true }
```

Wenn der Compile fehlschlaegt: `penwright_restore_version({ sha: "8f2a91c" })` rollt zurueck.

### Recherche-Notizen als Kapitel importieren

```
Agent: penwright_import_markdown({
  markdown: "# Verwandte Arbeiten\n\n## Chen et al. (2021)\n...",
  destPath: "chapters/06-related.typ"
})
  -> "Imported Markdown to chapters/06-related.typ (1842 characters). Review the output …"

Agent: penwright_add_chapter({ title: "Verwandte Arbeiten" })
  // …or directly add an #include statement to main.typ via update_document
```

`import_markdown` schreibt nur die konvertierte Body-Datei. Den `#include`-Eintrag in `main.typ` setzt der Agent in einem zweiten Schritt.

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
  -> "Inserted \" @fig:scaling\" into chapters/05-discussion.typ at offset 832."

Agent: penwright_compile()
  -> { success: true }
```

Mit `caption + label + file + afterText` ist Asset-Anlegen, Figure-Block bauen und Cross-Reference setzen ein einziger Tool-Call.

### DOCX fuer Betreuer-Feedback exportieren

```
Agent: penwright_export_docx({ outputPath: "exports/thesis-v3-feedback.docx" })
  -> "DOCX exported to /.../my-thesis/exports/thesis-v3-feedback.docx (642.8 KB)"
```

Der Betreuer kann die Datei direkt in Word oeffnen und Kapitel umordnen — Heading-Numbering passt sich live an, weil Penwright Word-Multilevel-Numbering schreibt. Bibliographie wird zu `(Autor Jahr)` aufgeloest.

---

## Skill-Prompts

Der MCP-Server bietet fuenf MCP-Prompts an, die die im Projekt deployed Skill-Dateien laden:

| Prompt | Inhalt |
|--------|--------|
| `typst-reference` | Typst-Sprachreferenz — Syntax, Math, Cross-Refs, Footnotes, Bibliographie, gebuendelte Packages |
| `penwright-conventions` | Penwright-Projekt-Konventionen — Ordnerstruktur, Persistenz-Schichten, Design-Surface, Comments, Mode-Toggles |
| `research-workflow` | End-to-End-Recherche-Workflow — Discover, Capture, Synthesize, Integrate |
| `writing-style` | Schreib-Konventionen — Anti-AI-Tells, Active Prose, akademische Konventionen, Quellen-Disziplin (EN/DE) |
| `design-conventions` | Visuelle Design-Konventionen — Color-Theory, Typografie-Pairing, Heading-Hierarchy, Layout-Patterns, Modern Looks 2026, Anti-Patterns |

Der Agent ruft sie ueber MCP `prompts/get` ab. Inhalt liegt in `<projekt>/.claude/skills/<name>/SKILL.md` — bei jedem `penwright_create_project` automatisch deployed, bei bestehenden Projekten on-demand bei Open. Master-Quelle: [src/shared/skillTemplates.ts](../src/shared/skillTemplates.ts).

**Update bestehender Projekte:** Wenn der Skill-Inhalt nach einem Penwright-Update aktualisiert werden soll, einfach die alte SKILL.md loeschen — beim naechsten Open wird sie aus dem Master neu geschrieben. Eigene User-Anpassungen werden nicht ueberschrieben (per-file-Guard).

---

## Voraussetzungen

**Beim Auto-Setup (Standalone-Binary) brauchst du weder System-Node noch System-Typst** — die Binary ist eigenstaendig, und Typst-Binary/Packages/Fonts kommen gebuendelt aus dem App-Bundle (via `TYPST_BIN` & Co.). Noetig sind nur **Claude Desktop** + eine gueltige **Penwright-Lizenz** (`pw_LIC…`) **oder eine laufende 14-Tage-Demo** (s. „Lizenz").

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

Der MCP Server laeuft mit einer **gueltigen Lizenz ODER waehrend der 14-Tage-Demo** — er ist in der kompletten Demo voll freigeschaltet (`validateAccess()` = gueltige Lizenz **oder** aktiver Trial). Konkret:

- **Lizenz aktiv** → der App-seitige `buildMcpEnv()` schreibt `env.PENWRIGHT_LICENSE_KEY` (derselbe `pw_LIC…`-Key wie die App, Single-Tier); der Server validiert beim Start selbst.
- **Demo laeuft, keine Lizenz** → stattdessen `env.PENWRIGHT_TRIAL_UNTIL=<Trial-Ende epoch-ms>`; der Server startet, solange `now < PENWRIGHT_TRIAL_UNTIL`.
- **Demo abgelaufen, keine Lizenz** → kein Credential, der Server verweigert den Start (Tools nicht verfuegbar).

Das gilt fuer **alle In-App-Registrierungswege** (Claude-Desktop-Wizard, Meta-MCP, Claude Code). Die standalone **`.mcpb`-Distribution** ist ein separater Manual-Install-Kanal ohne App-Trial-Stempel und bleibt **lizenzpflichtig** (`license_key` ist dort `required`).

---

## Architektur

Der MCP Server ist ein **eigenstaendiger Prozess** — er laeuft unabhaengig von der Electron-App. Er importiert Shared-Module (settingsParser, rootFinder, bibParser) direkt und ruft die (gebuendelte oder System-)`typst`-Binary fuer Kompilierung auf.

```
src/mcp/server.ts             <- Alle 63 Tools in einer Datei
esbuild.mcp.mjs               <- Build (ESM, Node 20) -> dist/mcp/server.mjs (Dev / manueller Node-Pfad)
scripts/build-mcp-binary.mjs  <- Bun `--compile` -> dist/mcp/bin/penwright-mcp-<triple> (die ausgelieferte Standalone-Binary)
```

Die **ausgelieferte Form** ist die Bun-kompilierte Standalone-Binary (~64 MB), gebuendelt im App-Bundle (`Contents/Resources/mcp/bin/`) und vom Wizard nach `~/Library/Application Support/Penwright/mcp-server/` kopiert — entkoppelt von der laufenden App. `dist/mcp/server.mjs` (esbuild) bleibt nur fuer den manuellen Node-Pfad.

### Abgrenzung

Der MCP Server bietet nur Funktionen an, die externe AI-Agents **nicht selbst koennen**:

- Keine Websuche (Agents haben eigene Suchtools)
- Keine Dateisuche (Agents koennen grep/find)
- Keine Shell-Commands (Agents haben eigene Terminals)
- Fokus auf **Penwright-spezifische Operationen**: Typst-Kompilierung, Document Settings, Style Templates, Kapitel-Verwaltung, Citation Management
