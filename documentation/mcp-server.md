# vswrite MCP Server — AI Integration

> **52 Tools** fuer externe AI-Agents | Unabhaengig von der Electron-App | Claude Desktop, Codex, Cowork u.a.

---

## Was ist der MCP Server?

Der vswrite MCP Server ermoeglicht es externen KI-Desktop-Apps, Typst-Dokumente in vswrite fernzusteuern. Er laeuft als eigenstaendiges CLI-Tool ueber stdio (JSON-RPC) und nutzt die gleichen Shared-Module wie die Desktop-App.

```
AI-Desktop-App (Claude, Codex, ...)
  |
  | stdio (JSON-RPC)
  v
vswrite MCP Server (Node.js)
  |
  |-- Liest/schreibt .typ Dateien
  |-- Kompiliert via typst CLI
  |-- Verwaltet Projekt-Struktur
  |-- Git-Operationen
```

---

## Setup

### 1. MCP Server bauen

```bash
cd vswrite-desktop
npm run build:mcp    # -> dist/mcp/server.mjs
```

### 2. Claude Desktop konfigurieren

Datei: `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "vswrite": {
      "command": "node",
      "args": [
        "/ABSOLUTE/PATH/TO/vswrite-desktop/dist/mcp/server.mjs"
      ]
    }
  }
}
```

Kein `--project` Pfad noetig — der Agent wechselt Projekte dynamisch via `vswrite_set_project`.

### 3. Claude Desktop neustarten

Claude sieht jetzt die vswrite-Tools im MCP-Menue.

---

## Verfuegbare Tools (52)

### Projekt & Dateien (5)

| Tool | Beschreibung |
|------|-------------|
| `vswrite_set_project` | Projekt-Verzeichnis setzen/wechseln (auto-detect main.typ) |
| `vswrite_list_files` | Projekt-Dateibaum anzeigen |
| `vswrite_read_file` | Projektdatei lesen (Text oder Base64 fuer Binaerdateien) |
| `vswrite_write_file` | Datei schreiben (mit auto-mkdir) |
| `vswrite_create_project` | Neues Projekt aus Template (document, thesis, paper, letter, book) |

### Dokument-Operationen (4)

| Tool | Beschreibung |
|------|-------------|
| `vswrite_get_document` | Aktuelles Dokument lesen (Content, Pfad, Word Count) |
| `vswrite_open_file` | .typ Datei als aktuelles Dokument oeffnen |
| `vswrite_update_document` | Dokumentinhalt ersetzen und speichern |
| `vswrite_compile` | Verifiziert, dass das Dokument kompiliert. Liefert `{ success, rootFile, sizeBytes }` oder strukturierte `errors[]`. Ergebnisdatei wird verworfen — fuer ein echtes Artefakt `vswrite_export_pdf` / `vswrite_export_docx` nutzen. |

### Settings & Styles (2)

Document Settings sind seit Session 22 auf `lang` + `bibliographyStyle` reduziert — Typografie, Layout und Design-Tokens leben jetzt in `style.json` (siehe Design-Tools weiter unten).

| Tool | Beschreibung |
|------|-------------|
| `vswrite_get_settings` | Document Settings lesen (lang + bibliographyStyle) |
| `vswrite_update_settings` | Settings aendern (nur geaenderte Keys angeben) |

### Design (11) — Themes, Layouts, Palette, Fonts, Elements

Die strukturierte Design-Surface aus dem Design-Editor-Tab. Schreibt direkt nach `.vswrite/style.json`, regeneriert `style.typ`, und stellt sicher dass die root-`.typ` Datei `#import "style.typ": *` + `#show: apply-style` ganz oben hat. Operationen sind idempotent und preservieren `style.custom.preamble` (User-Escape-Hatch-Code) bei Theme- und Layout-Swaps.

| Tool | Beschreibung |
|------|-------------|
| `vswrite_get_style` | Full ProjectStyle JSON lesen — colors / fonts / scale / layout / headings / elements / custom |
| `vswrite_update_style` | Partial-Patch (deep-merge mit Per-Leaf-Sanitizer). z.B. `{ colors: { primary: "#0f172a" } }` reicht; Rest bleibt. Invalid hex/weight/range faellt auf alten Wert zurueck statt zu erroren |
| `vswrite_list_styles` | Built-in Themes auflisten (id / name / description / bestFor) — Classic Academic, Modern Tech, Editorial Magazine, Minimal, Marketing Brochure, Thesis |
| `vswrite_apply_style` | Theme komplett anwenden — \`styleId: "marketing-brochure"\`. Ueberschreibt colors/fonts/scale/layout/headings/elements; behaelt `custom.preamble` |
| `vswrite_list_layouts` | 7 Layout-Presets (A4 portrait/landscape, Magazine 2-col, Newsletter 3-col, A5 Booklet, A2 Poster, **Magazine Editorial**) inkl. Paper/Orientation/Columns/BaseSize-Metadata |
| `vswrite_apply_layout` | Tauscht nur die `layout.*` Werte (+ optional `scale.base`) — Theme/Farben/Fonts bleiben. Kombinierbar mit `apply_style` |
| `vswrite_list_fonts` | Die 7 gebuendelten OFL-Fonts (Inter, IBM Plex Sans/Serif/Mono, JetBrains Mono, Crimson Pro, Spectral) — family/category/description |
| `vswrite_apply_palette` | 5-Farb-Palette setzen. Entweder `presetId` (z.B. "editorial", "earth-tones") ODER per-slot hex overrides (primary/accent/text/background/muted), kombinierbar. Kein-Argumente-Call returned die verfuegbaren Presets |
| `vswrite_list_design_elements` | Library der **15** parametrischen Snippets (Banner / Sidebar / Pull-Quote / Callout / Hero / Divider + Drop-Cap / Divider-Asterisks / Divider-Ornament / Pull-Quote-Display / Pull-Quote-Block / Article-Opener / Section-Opener / Gallery-2up / Gallery-3up / Magazine-Cover) inkl. erwarteter Params pro Element |
| `vswrite_insert_design_element` | Snippet an Anchor-Position einfuegen — z.B. Hero am Dokument-Anfang, Pull-Quote nach einem bestimmten Absatz. Snippets referenzieren `style-colors.*` und `style-fonts.*` und re-themen automatisch wenn Palette/Typografie wechselt |
| `vswrite_generate_layout` | Hoch-Level-Komposit: `intent: "brochure"` waehlt Marketing-Brochure Theme + Magazine-2col Layout + optional Hero am Anfang. Intent-Mapping deckt brochure / thesis / magazine / report / spec / minimal / newsletter / poster / booklet / slide ab |

### Kapitel & Struktur (6)

| Tool | Beschreibung |
|------|-------------|
| `vswrite_get_chapters` | #include Kapitel-Struktur mit Titeln lesen |
| `vswrite_reorder_chapters` | #include-Reihenfolge aendern |
| `vswrite_add_chapter` | Neue Kapitel-Datei erstellen + #include einfuegen |
| `vswrite_remove_chapter` | #include-Zeile entfernen (Datei bleibt erhalten) |
| `vswrite_merge_document` | Alle #includes aufloeosen, zusammengefuehrtes Dokument zurueckgeben |
| `vswrite_split_document` | An Heading-1-Grenzen in Kapitel aufteilen |

### Bibliographie & Citations (3)

| Tool | Beschreibung |
|------|-------------|
| `vswrite_get_citations` | Alle .bib Eintraege im Projekt lesen (citekey, author, title, year) |
| `vswrite_add_citation` | BibTeX-Eintrag hinzufuegen + #bibliography sicherstellen |
| `vswrite_ensure_bibliography` | references.bib + #bibliography erstellen falls fehlend |

### Cross-References & Footnotes (3)

Spiegelung der Cross-Reference-Picker- und Footnote-UI aus dem Editor. Anker-basiert: der Agent gibt einen exakten Text-Snippet als `afterText`/`anchor` und vswrite findet und schreibt an die richtige Stelle.

| Tool | Beschreibung |
|------|-------------|
| `vswrite_list_labels` | Alle `<label>`s im Projekt auflisten, optional nach Typ gefiltert (figure / table / equation / heading / other). Liefert `{ label, type, caption, relPath, line }`. **Vor `insert_reference` aufrufen**, sonst raet der Agent nur. |
| `vswrite_insert_reference` | `@label` an einer Anker-Position einfuegen. Validiert, dass das Label existiert (sonst Vorschlaege). Auto-Space, wenn der vorherige Char alphanumerisch ist (Typst-Syntax-Zwang). |
| `vswrite_add_footnote` | `#footnote[<body>]` an einer Anker-Position einfuegen. Klammer-Balance-Check auf den Body, damit der Typst-Parser nicht bricht. |

### Comments & Annotations (4)

Spiegelung des Comments-Panels. Comments leben als `comments/<id>.md` im Projekt-Root und werden **nie** in PDF/DOCX kompiliert — geeignet fuer Selbstnotizen oder Betreuer-Feedback.

| Tool | Beschreibung |
|------|-------------|
| `vswrite_list_comments` | Comments lesen, optional nach Datei gefiltert. Standard: nur offene (nicht-erledigte). |
| `vswrite_add_comment` | Neuer Comment, verankert an einem exakten Text-Snippet in einer Projektdatei. Erzeugt automatisch ID + YAML-Frontmatter. |
| `vswrite_resolve_comment` | Comment als erledigt / wieder offen markieren. |
| `vswrite_delete_comment` | Comment-Datei loeschen. |

### Discovery — Suche & Quellen (3)

Projekt-weite Suche und Citation-Source-Lookup. **Pflicht fuer jeden Konsistenz-Check**: ohne diese Tools muesste der Agent jede Datei einzeln per `read_file` durchgehen, was bei 100+ Kapiteln teuer und fehleranfaellig wird.

| Tool | Beschreibung |
|------|-------------|
| `vswrite_search_project` | Volltext-Suche ueber alle `.typ` (optional `.bib`). Optionen: case-sensitive / whole-word / regex. Whole-Word funktioniert auch bei Tokens, die mit Sonderzeichen anfangen (`@chen2021codex` etc.) — Lookarounds statt `\b`. Cap: 1000 Treffer. |
| `vswrite_replace_in_project` | Bulk-Replace ueber alle Dateien. **Destruktiv** — vorher `vswrite_save_version` aufrufen. |
| `vswrite_find_source_for_citation` | Sucht in `sources/` nach `<citekey>.pdf` oder Suffix-Varianten (`<citekey>_supplement.pdf` etc.). Liefert relativen Pfad oder `{ found: false }`. |

### Export (2)

PDF und DOCX schreiben in den Projektordner — Konvention: `exports/<name>.<ext>`, Parent-Dir wird automatisch angelegt. Pfade ausserhalb des Projekts werden abgelehnt.

| Tool | Beschreibung |
|------|-------------|
| `vswrite_export_pdf` | PDF-Export ueber die Typst-CLI. Identisch zur Live-Preview. |
| `vswrite_export_docx` | DOCX-Export mit echten Word-Styles (Heading1-6, Quote, CodeBlock, BibliographyEntry, …) und Live-Multilevel-Numbering. Multi-Chapter wird via `resolveIncludes` gemerged. Heading-Numbers aktualisieren sich live, wenn der Betreuer Kapitel in Word umstellt. |

### Import & Assets (2)

| Tool | Beschreibung |
|------|-------------|
| `vswrite_import_markdown` | Konvertiert Markdown nach Typst (Headings, Bold/Italic, Links, Bilder, Listen, Code-Bloecke, Blockquotes; YAML-Frontmatter wird uebersprungen). Source: inline `markdown`-Text ODER `srcPath` (kann ausserhalb des Projekts liegen). Destination ist immer im Projekt. |
| `vswrite_add_image` | Kopiert ein Bild nach `assets/` (Content-Hash-Dedup) und liefert ein Typst-Snippet zurueck. Mit `caption` wird daraus ein `#figure(...)`, mit `caption + label` ein referenzierbares Figure-Target. Optional sofortiger Inline-Insert via `file + afterText` — spart eine Round-Trip. |

### Versionen (4)

High-Level-API analog zum „Versionen"-Panel im UI. Spricht Schreiber-Vokabular („Version speichern" statt „Commit") und arbeitet rein lokal — kein Push zum Remote. Initialisiert das Git-Repo automatisch, wenn das Projekt noch keines hat.

| Tool | Beschreibung |
|------|-------------|
| `vswrite_save_version` | Benannte Version speichern (Git-Commit). Optional auf bestimmte Dateien einschraenken. Returns `{ sha: null, skipped: true }`, wenn nichts zu speichern ist. |
| `vswrite_list_versions` | Versionsverlauf lesen, neueste zuerst, max. 200 Eintraege. Pro Eintrag: `{ sha, message, date, author, isAuto }`. |
| `vswrite_show_version` | Diff einer einzelnen Version pro Datei: `{ path, status, patch }`. |
| `vswrite_restore_version` | Dateien aus einer historischen Version zurueck in den Working-Tree. **Achtung:** ueberschreibt unkommittete Aenderungen. Vorher `vswrite_save_version` aufrufen, um den aktuellen Stand zu sichern. |

### Git — Low-Level (3)

Fuer Cloud-Sync-Workflows. Im Normalfall reicht der Versionen-Block oben.

| Tool | Beschreibung |
|------|-------------|
| `vswrite_git_status` | Branch, Ahead/Behind, geaenderte Dateien |
| `vswrite_git_commit` | Stage all + Commit mit Message |
| `vswrite_git_push` | Push zum Remote |

---

## Typische Workflows

### Dokument bearbeiten

```
Agent: vswrite_set_project({ dir: "/Users/.../my-thesis" })
Agent: vswrite_get_document()
  -> { content: "...", filePath: "main.typ", wordCount: 4250 }
Agent: vswrite_update_document({ content: "...geaenderter Inhalt..." })
Agent: vswrite_compile()
  -> { success: true, pages: 12 }
```

### Kapitel-Struktur aufbauen

```
Agent: vswrite_add_chapter({ title: "Methodology", position: 2 })
Agent: vswrite_add_chapter({ title: "Results", position: 3 })
Agent: vswrite_get_chapters()
  -> { includes: [
       { path: "chapters/introduction.typ", title: "Introduction" },
       { path: "chapters/methodology.typ", title: "Methodology" },
       { path: "chapters/results.typ", title: "Results" }
     ]}
```

### Bibliographie aufbauen

```
Agent: vswrite_ensure_bibliography()
Agent: vswrite_add_citation({
  bibtex: "@article{smith2024, author={Smith}, title={...}, year={2024}, journal={...}}"
})
Agent: vswrite_get_citations()
  -> [{ citekey: "smith2024", author: "Smith", title: "...", year: "2024" }]
```

### Style anwenden und exportieren

```
Agent: vswrite_list_styles()
Agent: vswrite_apply_style({ styleId: "elegant" })
Agent: vswrite_compile()
Agent: vswrite_export_pdf({ outputPath: "exports/thesis.pdf" })
  -> "PDF exported to /.../my-thesis/exports/thesis.pdf (842.3 KB)"
```

Der Output muss im Projekt liegen — Konvention ist `exports/<name>.pdf`. Der Ordner wird beim ersten Export automatisch angelegt. Wer das PDF ausserhalb des Projekts haben will, verschiebt es danach manuell.

### Version speichern und wiederherstellen

```
Agent: vswrite_save_version({ message: "Vor Lektorats-Feedback" })
  -> { sha: "a3f7b91", changes: 4, insertions: 120, deletions: 8 }

Agent: vswrite_list_versions()
  -> [
       { sha: "a3f7b91...", message: "Vor Lektorats-Feedback", date: "...", isAuto: false },
       { sha: "9e2d4c8...", message: "Kapitel 3 erste Fassung", date: "...", isAuto: false }
     ]

Agent: vswrite_show_version({ sha: "a3f7b91" })
  -> { sha: "a3f7b91", files: [{ path: "chapters/03-method.typ", status: "modified", patch: "@@ ..." }] }

Agent: vswrite_restore_version({ sha: "9e2d4c8", files: ["chapters/03-method.typ"] })
  -> "Restored 1 file(s) from version 9e2d4c8."
```

Vor einem `restore` empfiehlt sich ein `save_version`, sonst gehen die aktuellen Aenderungen der wiederhergestellten Dateien verloren.

### Cross-Reference einfuegen

```
Agent: vswrite_list_labels({ type: "figure" })
  -> { labels: [
       { label: "fig:scaling",   type: "figure", caption: "Parameter scaling …", relPath: "chapters/04-results.typ", line: 24 },
       { label: "fig:dataflow",  type: "figure", caption: "Dataflow overview",   relPath: "chapters/03-method.typ",  line: 12 }
     ]}

Agent: vswrite_insert_reference({
  file: "chapters/05-discussion.typ",
  afterText: "as shown in",
  label: "fig:scaling"
})
  -> "Inserted \" @fig:scaling\" into chapters/05-discussion.typ at offset 1273. Run vswrite_compile to verify the cross-reference resolves."

Agent: vswrite_compile()
  -> { success: true }
```

`list_labels` ist Pflicht-Vorbereitung — `insert_reference` lehnt unbekannte Label-Namen ab und schlaegt aehnlich aussehende Labels vor.

### Footnote einfuegen

```
Agent: vswrite_add_footnote({
  file: "chapters/03-method.typ",
  afterText: "five reference works",
  body: "Selection was peer-reviewed only — see the methodological note."
})
  -> "Inserted footnote into chapters/03-method.typ at offset 842."
```

Wenn `afterText` mehrfach vorkommt, antwortet das Tool mit der Anzahl Treffer und verlangt einen `occurrence`-Parameter.

### Comment hinterlassen

```
Agent: vswrite_add_comment({
  file: "chapters/01-introduction.typ",
  anchor: "five reference works",
  body: "Quelle ergaenzen — vielleicht den Mueller-Artikel?",
  author: "Claude (research)"
})
  -> { id: "2026-04-29-1547-x9k", file: "chapters/01-introduction.typ", anchor: "five reference works", … }

Agent: vswrite_list_comments({ file: "chapters/01-introduction.typ" })
  -> [{ id: "2026-04-29-1547-x9k", body: "Quelle ergaenzen …", resolved: false, … }]

Agent: vswrite_resolve_comment({ id: "2026-04-29-1547-x9k" })
  -> "Comment 2026-04-29-1547-x9k marked as resolved."
```

Comments werden **nie** ins PDF/DOCX kompiliert — sie leben als sichtbare Markdown-Dateien im `comments/`-Ordner und sind cloud-sync-tauglich (Dropbox / iCloud / Git nehmen sie mit).

### Backlinks — Konsistenz-Check ueber alle Kapitel

```
Agent: vswrite_search_project({ query: "@chen2021codex", wholeWord: true })
  -> {
       totalMatches: 7,
       files: [
         { relPath: "chapters/02-related.typ",   matches: [{ line: 18, ... }, { line: 34, ... }] },
         { relPath: "chapters/04-results.typ",   matches: [{ line: 92, ... }] },
         { relPath: "chapters/05-discussion.typ", matches: [{ line: 12, ... }, ...] }
       ]
     }

Agent: vswrite_find_source_for_citation({ citekey: "chen2021codex" })
  -> { found: true, citekey: "chen2021codex", relPath: "sources/chen2021codex.pdf" }
```

Das Citation-Whole-Word funktioniert nur dank Lookaround-Pattern — `\b@key\b` waere kaputt, weil `\b` zwischen `@` und Buchstabe nicht greift.

### Bulk-Refactor mit Sicherheitsnetz

```
Agent: vswrite_save_version({ message: "Vor Citekey-Umbenennung" })
  -> { sha: "8f2a91c", changes: 0 }   // skipped if nothing to save

Agent: vswrite_replace_in_project({
  query: "smith2023",
  replacement: "smith2024",
  wholeWord: true
})
  -> { filesChanged: 4, totalReplacements: 11 }

Agent: vswrite_compile()
  -> { success: true }
```

Wenn der Compile fehlschlaegt: `vswrite_restore_version({ sha: "8f2a91c" })` rollt zurueck.

### Recherche-Notizen als Kapitel importieren

```
Agent: vswrite_import_markdown({
  markdown: "# Verwandte Arbeiten\n\n## Chen et al. (2021)\n...",
  destPath: "chapters/06-related.typ"
})
  -> "Imported Markdown to chapters/06-related.typ (1842 characters). Review the output …"

Agent: vswrite_add_chapter({ title: "Verwandte Arbeiten" })
  // …or directly add an #include statement to main.typ via update_document
```

`import_markdown` schreibt nur die konvertierte Body-Datei. Den `#include`-Eintrag in `main.typ` setzt der Agent in einem zweiten Schritt.

### Bild als Figure mit Cross-Reference einbauen

```
Agent: vswrite_add_image({
  srcPath: "/Users/.../scaling-plot.png",
  caption: "Parameter-Skalierung von Encoder vs. Decoder",
  label: "fig:scaling",
  width: "80%",
  alt: "Plot mit Parameter-Skalierung",
  file: "chapters/04-results.typ",
  afterText: "Wir untersuchen die Skalierung."
})
  -> "Asset placed at assets/scaling-plot.png. Inserted figure into chapters/04-results.typ at offset 1245."

Agent: vswrite_insert_reference({
  file: "chapters/05-discussion.typ",
  afterText: "wie in",
  label: "fig:scaling"
})
  -> "Inserted \" @fig:scaling\" into chapters/05-discussion.typ at offset 832."

Agent: vswrite_compile()
  -> { success: true }
```

Mit `caption + label + file + afterText` ist Asset-Anlegen, Figure-Block bauen und Cross-Reference setzen ein einziger Tool-Call.

### DOCX fuer Betreuer-Feedback exportieren

```
Agent: vswrite_export_docx({ outputPath: "exports/thesis-v3-feedback.docx" })
  -> "DOCX exported to /.../my-thesis/exports/thesis-v3-feedback.docx (642.8 KB)"
```

Der Betreuer kann die Datei direkt in Word oeffnen und Kapitel umordnen — Heading-Numbering passt sich live an, weil vswrite Word-Multilevel-Numbering schreibt. Bibliographie wird zu `(Autor Jahr)` aufgeloest.

---

## Skill-Prompts

Der MCP-Server bietet fuenf MCP-Prompts an, die die im Projekt deployed Skill-Dateien laden:

| Prompt | Inhalt |
|--------|--------|
| `typst-reference` | Typst-Sprachreferenz — Syntax, Math, Cross-Refs, Footnotes, Bibliographie, gebuendelte Packages |
| `vswrite-conventions` | vswrite-Projekt-Konventionen — Ordnerstruktur, Persistenz-Schichten, Design-Surface, Comments, Mode-Toggles |
| `research-workflow` | End-to-End-Recherche-Workflow — Discover, Capture, Synthesize, Integrate |
| `writing-style` | Schreib-Konventionen — Anti-AI-Tells, Active Prose, akademische Konventionen, Quellen-Disziplin (EN/DE) |
| `design-conventions` | Visuelle Design-Konventionen — Color-Theory, Typografie-Pairing, Heading-Hierarchy, Layout-Patterns, Modern Looks 2026, Anti-Patterns |

Der Agent ruft sie ueber MCP `prompts/get` ab. Inhalt liegt in `<projekt>/.claude/skills/<name>/SKILL.md` — bei jedem `vswrite_create_project` automatisch deployed, bei bestehenden Projekten on-demand bei Open. Master-Quelle: [src/shared/skillTemplates.ts](../src/shared/skillTemplates.ts).

**Update bestehender Projekte:** Wenn der Skill-Inhalt nach einem vswrite-Update aktualisiert werden soll, einfach die alte SKILL.md loeschen — beim naechsten Open wird sie aus dem Master neu geschrieben. Eigene User-Anpassungen werden nicht ueberschrieben (per-file-Guard).

---

## Voraussetzungen

- **Node.js 20+** — Zum Ausfuehren des MCP-Servers
- **Typst CLI** — Muss im PATH installiert sein (`typst --version`)
- **Git** — Fuer Git-Operationen (optional)

### Typst installieren

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

Der MCP Server erfordert eine **Pro-Lizenz**. Ohne Lizenz sind die Tools nicht verfuegbar.

---

## Architektur

Der MCP Server ist ein **eigenstaendiger Prozess** — er laeuft unabhaengig von der Electron-App. Er importiert Shared-Module (settingsParser, rootFinder, bibParser) direkt und ruft `typst` CLI fuer Kompilierung auf.

```
src/mcp/server.ts      <- Alle 52 Tools in einer Datei (~1.700 Zeilen)
esbuild.mcp.mjs        <- Build-Script (ESM, Node 20)
dist/mcp/server.mjs    <- Gebundelte Ausgabe
```

### Abgrenzung

Der MCP Server bietet nur Funktionen an, die externe AI-Agents **nicht selbst koennen**:

- Keine Websuche (Agents haben eigene Suchtools)
- Keine Dateisuche (Agents koennen grep/find)
- Keine Shell-Commands (Agents haben eigene Terminals)
- Fokus auf **vswrite-spezifische Operationen**: Typst-Kompilierung, Document Settings, Style Templates, Kapitel-Verwaltung, Citation Management
