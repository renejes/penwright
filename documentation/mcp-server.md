# vswrite MCP Server — AI Integration

> **26 Tools** fuer externe AI-Agents | Unabhaengig von der Electron-App | Claude Desktop, Codex, Cowork u.a.

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

## Verfuegbare Tools (26)

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
| `vswrite_compile` | Typst kompilieren (SVG/PDF), Fehler zurueckgeben |

### Settings & Styles (4)

| Tool | Beschreibung |
|------|-------------|
| `vswrite_get_settings` | Document Settings lesen (#set Bloecke: Font, Size, Lang, Margins) |
| `vswrite_update_settings` | Settings aendern (nur geaenderte Keys angeben) |
| `vswrite_list_styles` | Verfuegbare Style-Templates auflisten |
| `vswrite_apply_style` | Style-Template anwenden (classic, modern, minimal, vibrant, elegant, professional, artsy) |

### Kapitel & Struktur (5)

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

### Export (1)

| Tool | Beschreibung |
|------|-------------|
| `vswrite_export_pdf` | PDF an bestimmten Pfad exportieren |

### Git (3)

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
Agent: vswrite_export_pdf({ outputPath: "/Users/.../thesis.pdf" })
```

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
src/mcp/server.ts      <- Alle 26 Tools in einer Datei (~800 Zeilen)
esbuild.mcp.mjs        <- Build-Script (ESM, Node 20)
dist/mcp/server.mjs    <- Gebundelte Ausgabe
```

### Abgrenzung

Der MCP Server bietet nur Funktionen an, die externe AI-Agents **nicht selbst koennen**:

- Keine Websuche (Agents haben eigene Suchtools)
- Keine Dateisuche (Agents koennen grep/find)
- Keine Shell-Commands (Agents haben eigene Terminals)
- Fokus auf **vswrite-spezifische Operationen**: Typst-Kompilierung, Document Settings, Style Templates, Kapitel-Verwaltung, Citation Management
