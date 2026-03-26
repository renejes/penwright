# vswrite Desktop — MCP Server Integration Plan

> **Stand:** 2026-03-26
> **Ziel:** vswrite als MCP-Server exponieren, damit externe KI-Desktop-Apps (Claude Desktop/Cowork, Codex Desktop, Clawdbot, etc.) Typst-Dokumente in vswrite fernsteuern können.

---

## Konzept

Der MCP-Server (Model Context Protocol) läuft im Electron Main Process und exponiert vswrite-spezifische Tools über das standardisierte JSON-RPC-Protokoll. Externe AI-Apps verbinden sich über stdio und können dann:

- Dokumente öffnen, lesen, bearbeiten, speichern
- Typst kompilieren und Fehler analysieren
- Document Settings und Style Templates anwenden
- Projekt-Struktur verwalten (Kapitel, Includes, Bilder)
- Bibliographie und Citations bearbeiten
- Git-Operationen ausführen
- PDFs und DOCX exportieren

**Wichtig:** Der MCP-Server bietet nur Funktionen an, die externen AI-Agents **nicht bereits zur Verfügung stehen** (wie Raw-Dateioperationen oder Websuche). Der Fokus liegt auf App-spezifischen Operationen, die Wissen über vswrite, Typst und den Editor-State erfordern.

---

## Architektur

```
┌─────────────────────────┐          stdio (JSON-RPC)          ┌─────────────────────┐
│   Claude Desktop /      │ ◄──────────────────────────────► │  vswrite MCP Server  │
│   Codex Desktop /       │                                    │  (Main Process)      │
│   Clawdbot / etc.       │                                    │                      │
└─────────────────────────┘                                    │  ┌────────────────┐  │
                                                               │  │ appState       │  │
                                                               │  │ fileManager    │  │
                                                               │  │ typstCompiler  │  │
                                                               │  │ projectManager │  │
                                                               │  │ importExport   │  │
                                                               │  │ gitManager     │  │
                                                               │  │ settingsParser │  │
                                                               │  └────────────────┘  │
                                                               └─────────────────────┘
```

### Prozess-Modell

Der MCP-Server läuft als **separater Node.js-Prozess** (nicht im Electron Main Process selbst), wird aber von der Electron-App gestartet und gestoppt. Er kommuniziert mit dem Main Process über eine interne IPC-Brücke (z.B. Unix Socket oder Named Pipe), um auf appState und die Module zuzugreifen.

**Alternative (einfacher für V1):** Der MCP-Server läuft als eigenständiges CLI-Tool (`vswrite-mcp`), das die gleichen Shared-Module importiert und direkt auf das Dateisystem zugreift — ohne laufende Electron-App. Für Compiler-Operationen ruft er `typst` CLI direkt auf.

**Empfehlung für V1:** Eigenständiges CLI-Tool. Das entkoppelt den MCP-Server von der Electron-App und macht ihn einfacher zu testen, deployen und konfigurieren.

---

## Dependency

```bash
npm install @modelcontextprotocol/sdk
```

---

## Dateistruktur

```
src/
├── mcp/
│   ├── server.ts              MCP Server Entry Point
│   ├── tools/
│   │   ├── document.ts        Dokument-Tools (open, read, write, save)
│   │   ├── compile.ts         Kompilierungs-Tools
│   │   ├── settings.ts        Settings & Style-Tools
│   │   ├── project.ts         Projekt-Tools (Dateien, Templates)
│   │   ├── bibliography.ts    Citation-Tools
│   │   ├── chapters.ts        Kapitel-Management
│   │   ├── export.ts          Export-Tools (PDF, DOCX)
│   │   └── git.ts             Git-Tools
│   └── resources/
│       └── document.ts        MCP Resources (aktuelles Dokument als Resource)
```

---

## Tool-Definitionen

### 1. Dokument-Operationen

#### `vswrite_get_document`
Gibt den aktuellen Editor-Zustand zurück.

```json
{
  "name": "vswrite_get_document",
  "description": "Returns the current document state: content, file path, project directory, and whether there are unsaved changes.",
  "inputSchema": { "type": "object", "properties": {} }
}
```

**Rückgabe:**
```json
{
  "filePath": "/Users/.../main.typ",
  "projectDir": "/Users/.../my-thesis",
  "content": "#set text(font: \"Libertinus Serif\")\n\n= Introduction\n...",
  "isDirty": false,
  "wordCount": 4250
}
```

**Implementierung:** Liest `appState.currentFilePath`, `appState.currentContent`, `appState.projectDir`, `appState.isDirty`.

---

#### `vswrite_open_file`
Öffnet eine Datei im Editor.

```json
{
  "name": "vswrite_open_file",
  "description": "Opens a .typ file in the vswrite WYSIWYG editor. The file must exist on disk.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "filePath": { "type": "string", "description": "Absolute path to the .typ file" }
    },
    "required": ["filePath"]
  }
}
```

**Implementierung:** Ruft `openFile(filePath)` auf. Kein Dialog nötig da Pfad mitgegeben wird.

---

#### `vswrite_update_document`
Ersetzt den Dokumentinhalt. Der Agent sieht den aktuellen Inhalt (via `vswrite_get_document`), bearbeitet ihn, und schickt den neuen Inhalt zurück.

```json
{
  "name": "vswrite_update_document",
  "description": "Replaces the current document content. The editor will update in real-time. Use vswrite_get_document first to read the current content, then modify and send back.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "content": { "type": "string", "description": "The complete new Typst document content" }
    },
    "required": ["content"]
  }
}
```

**Implementierung:** Setzt `appState.currentContent`, sendet `update` Message an Renderer, markiert als dirty, triggert auto-save.

---

#### `vswrite_save`
Speichert das aktuelle Dokument.

```json
{
  "name": "vswrite_save",
  "description": "Saves the current document to disk.",
  "inputSchema": { "type": "object", "properties": {} }
}
```

**Implementierung:** Ruft `saveFile()` auf.

---

#### `vswrite_create_file`
Erstellt eine neue Datei im Projekt.

```json
{
  "name": "vswrite_create_file",
  "description": "Creates a new file in the project directory with the given content.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "filePath": { "type": "string", "description": "Absolute path for the new file" },
      "content": { "type": "string", "description": "File content", "default": "" }
    },
    "required": ["filePath"]
  }
}
```

**Implementierung:** `fs.writeFileSync(filePath, content)`, sendet `filetreeChanged` an Renderer.

---

### 2. Kompilierung

#### `vswrite_compile`
Kompiliert das aktuelle Typst-Dokument und gibt Fehler oder Erfolg zurück.

```json
{
  "name": "vswrite_compile",
  "description": "Compiles the current Typst document. Returns compilation errors if any, or success with page count. Automatically finds the root file for chapter-based projects.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "format": { "type": "string", "enum": ["svg", "pdf"], "default": "svg" }
    }
  }
}
```

**Rückgabe (Erfolg):**
```json
{ "success": true, "pages": 12, "format": "svg" }
```

**Rückgabe (Fehler):**
```json
{
  "success": false,
  "errors": [
    { "message": "unknown variable: autor", "line": 42 },
    { "message": "expected expression", "line": 58 }
  ]
}
```

**Implementierung:** Nutzt `TypstCompiler` mit `execFile('typst', ['compile', ...])`. Findet Root-File via `findRootFile()`. Parst stderr mit `parseErrors()`. Wartet auf Ergebnis (Promise-Wrapper um Event-Emitter).

---

#### `vswrite_export_pdf`
Exportiert das Dokument als PDF an einen bestimmten Pfad.

```json
{
  "name": "vswrite_export_pdf",
  "description": "Compiles and exports the document as PDF to the specified path.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "outputPath": { "type": "string", "description": "Absolute path for the PDF output" }
    },
    "required": ["outputPath"]
  }
}
```

**Implementierung:** `execFile('typst', ['compile', rootFile, outputPath])`. Kein Dialog nötig.

---

#### `vswrite_export_docx`
Exportiert als Word-Dokument.

```json
{
  "name": "vswrite_export_docx",
  "description": "Exports the current document as DOCX to the specified path.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "outputPath": { "type": "string", "description": "Absolute path for the DOCX output" }
    },
    "required": ["outputPath"]
  }
}
```

**Implementierung:** Nutzt `serializeDocx()` aus shared, schreibt Buffer in Datei.

---

### 3. Document Settings

#### `vswrite_get_settings`
Liest die aktuellen Dokument-Einstellungen.

```json
{
  "name": "vswrite_get_settings",
  "description": "Reads the document settings (#set blocks) from the current Typst file. Returns font, size, language, margins, page format, etc.",
  "inputSchema": { "type": "object", "properties": {} }
}
```

**Rückgabe:**
```json
{
  "font": "Libertinus Serif",
  "fontSize": "11pt",
  "lang": "de",
  "pageFormat": "a4",
  "marginTop": "2.5cm",
  "marginBottom": "2.5cm",
  "marginLeft": "2.5cm",
  "marginRight": "2.5cm",
  "leading": "0.65em",
  "columns": "",
  "numbering": ""
}
```

**Implementierung:** `parseSettings(appState.currentContent)`.

---

#### `vswrite_update_settings`
Ändert Dokument-Einstellungen.

```json
{
  "name": "vswrite_update_settings",
  "description": "Updates document settings (#set blocks). Only include the settings you want to change — others remain unchanged. Valid keys: font, fontSize, lang, pageFormat, marginTop, marginBottom, marginLeft, marginRight, leading, columns, numbering.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "settings": {
        "type": "object",
        "description": "Key-value pairs of settings to update"
      }
    },
    "required": ["settings"]
  }
}
```

**Implementierung:** Nutzt `handleUpdateSettings(settings)` — parst aktuelle Settings, merged mit neuen, generiert `#set` Blöcke, ersetzt Preamble.

---

#### `vswrite_apply_style`
Wendet ein Style-Template an.

```json
{
  "name": "vswrite_apply_style",
  "description": "Applies a predefined style template to the document. Available styles: classic-academic, modern-clean, minimal, vibrant, elegant, professional-report, artsy.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "styleId": { "type": "string", "description": "ID of the style template" }
    },
    "required": ["styleId"]
  }
}
```

**Implementierung:** `applyStyleTemplate(styleId)`.

---

#### `vswrite_list_styles`
Listet verfügbare Style-Templates.

```json
{
  "name": "vswrite_list_styles",
  "description": "Returns all available style templates with id, label, and description.",
  "inputSchema": { "type": "object", "properties": {} }
}
```

**Implementierung:** Gibt `styleTemplates.map(t => ({ id, label, description }))` zurück.

---

### 4. Projekt-Management

#### `vswrite_list_files`
Gibt den Dateibaum des Projekts zurück.

```json
{
  "name": "vswrite_list_files",
  "description": "Returns the project file tree as a nested structure. Includes all .typ, .bib, .md, .yaml, .json, .pdf, image files.",
  "inputSchema": { "type": "object", "properties": {} }
}
```

**Implementierung:** `readDirTree(appState.projectDir)`.

---

#### `vswrite_create_project`
Erstellt ein neues Projekt aus einem Template.

```json
{
  "name": "vswrite_create_project",
  "description": "Creates a new project from a template. Available templates: document, thesis, paper, letter, book. Creates project structure with main.typ, chapters/, assets/, and Claude Code skills.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "templateId": { "type": "string", "enum": ["document", "thesis", "paper", "letter", "book"] },
      "projectName": { "type": "string", "description": "Name of the project (becomes folder name)" },
      "parentDir": { "type": "string", "description": "Directory where the project folder will be created" }
    },
    "required": ["templateId", "projectName", "parentDir"]
  }
}
```

**Implementierung:** Variante von `handleCreateProject()` die `parentDir` als Parameter akzeptiert statt Dialog.

---

#### `vswrite_read_file`
Liest eine beliebige Datei aus dem Projekt.

```json
{
  "name": "vswrite_read_file",
  "description": "Reads a file from the project. Returns content as string for text files, or base64 for binary files (PDF, images).",
  "inputSchema": {
    "type": "object",
    "properties": {
      "filePath": { "type": "string", "description": "Absolute path to the file" }
    },
    "required": ["filePath"]
  }
}
```

**Implementierung:** `fs.readFileSync()` mit Encoding-Detection nach Extension.

---

#### `vswrite_write_file`
Schreibt eine Datei im Projekt.

```json
{
  "name": "vswrite_write_file",
  "description": "Writes content to a file in the project. Creates parent directories if needed.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "filePath": { "type": "string", "description": "Absolute path" },
      "content": { "type": "string", "description": "File content" }
    },
    "required": ["filePath", "content"]
  }
}
```

**Implementierung:** `fs.writeFileSync()`, sendet `filetreeChanged`.

---

### 5. Kapitel & Struktur

#### `vswrite_get_chapters`
Gibt die Include-Struktur des Dokuments zurück.

```json
{
  "name": "vswrite_get_chapters",
  "description": "Returns the #include chapter structure of the current document. Shows which files are included and in what order.",
  "inputSchema": { "type": "object", "properties": {} }
}
```

**Rückgabe:**
```json
{
  "rootFile": "/Users/.../main.typ",
  "includes": [
    { "path": "chapters/introduction.typ", "exists": true },
    { "path": "chapters/methodology.typ", "exists": true },
    { "path": "chapters/results.typ", "exists": false }
  ]
}
```

**Implementierung:** Regex über `appState.currentContent` für `#include` Zeilen, `fs.existsSync()` für Validierung.

---

#### `vswrite_merge_document`
Löst alle #include Referenzen auf und gibt das zusammengeführte Dokument zurück.

```json
{
  "name": "vswrite_merge_document",
  "description": "Resolves all #include statements recursively and returns the complete merged document.",
  "inputSchema": { "type": "object", "properties": {} }
}
```

**Implementierung:** `resolveIncludes(appState.currentFilePath)`.

---

#### `vswrite_split_document`
Teilt ein Dokument an `= Heading 1` Grenzen in Kapitel auf.

```json
{
  "name": "vswrite_split_document",
  "description": "Splits the current document into separate chapter files at = Heading 1 boundaries. Creates chapters/ directory and updates main file with #include statements.",
  "inputSchema": { "type": "object", "properties": {} }
}
```

**Implementierung:** `splitIntoChapters()`, Dateien schreiben, Content aktualisieren.

---

### 6. Bibliographie

#### `vswrite_get_citations`
Gibt alle verfügbaren Citations zurück.

```json
{
  "name": "vswrite_get_citations",
  "description": "Returns all citation entries from .bib files in the project. Each entry includes citekey, type, title, author, year, and other fields.",
  "inputSchema": { "type": "object", "properties": {} }
}
```

**Implementierung:** Scannt Projektverzeichnis nach `.bib` Dateien, parst mit `parseBibFile()`.

---

#### `vswrite_ensure_bibliography`
Stellt sicher, dass eine Bibliographie im Dokument existiert.

```json
{
  "name": "vswrite_ensure_bibliography",
  "description": "Ensures the document has a references.bib file and a #bibliography statement. Creates them if missing.",
  "inputSchema": { "type": "object", "properties": {} }
}
```

**Implementierung:** Erstellt `references.bib` falls nötig, fügt `#bibliography("references.bib")` ans Ende.

---

### 7. Git

#### `vswrite_git_status`
Git-Status des Projekts.

```json
{
  "name": "vswrite_git_status",
  "description": "Returns git status: branch name, ahead/behind counts, and list of changed files with their status.",
  "inputSchema": { "type": "object", "properties": {} }
}
```

---

#### `vswrite_git_commit`
Erstellt einen Commit.

```json
{
  "name": "vswrite_git_commit",
  "description": "Stages all changes and creates a git commit with the given message.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "message": { "type": "string", "description": "Commit message" },
      "stageAll": { "type": "boolean", "default": true, "description": "Stage all changes before committing" }
    },
    "required": ["message"]
  }
}
```

---

#### `vswrite_git_push`
Pusht zum Remote.

```json
{
  "name": "vswrite_git_push",
  "description": "Pushes committed changes to the remote repository.",
  "inputSchema": { "type": "object", "properties": {} }
}
```

---

## MCP Resources

Neben Tools exponiert der Server auch **Resources** — statische Datenquellen die der Agent lesen kann:

### `vswrite://document/current`
Das aktuelle Dokument als Resource. Wird automatisch aktualisiert wenn sich der Inhalt ändert.

### `vswrite://project/structure`
Die Projektstruktur (Dateibaum) als Resource.

### `vswrite://settings`
Die aktuellen Document Settings.

---

## Server-Implementierung

### Entry Point (`src/mcp/server.ts`)

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const server = new McpServer({
  name: 'vswrite',
  version: '0.4.0',
  description: 'MCP server for vswrite — a WYSIWYG editor for Typst documents',
});

// Tools registrieren
server.tool('vswrite_get_document', ...);
server.tool('vswrite_update_document', ...);
server.tool('vswrite_compile', ...);
// ... etc.

// Server starten
const transport = new StdioServerTransport();
await server.connect(transport);
```

### Zugriff auf App-State

**V1 (eigenständiges CLI-Tool):** Der MCP-Server arbeitet direkt mit dem Dateisystem. Er liest `.typ`-Dateien von der Platte, ruft `typst` CLI für Kompilierung auf, und nutzt die Shared-Module (`settingsParser`, `bibParser`, `mergeDocument`, etc.) direkt.

**V2 (mit Electron-Integration):** Der MCP-Server kommuniziert mit dem laufenden Electron Main Process über IPC (Unix Socket), um auch auf den Editor-State (aktueller unsaved Content, Cursor-Position) zugreifen zu können.

### Build-Konfiguration

Separater Build-Target in `package.json`:

```json
{
  "bin": {
    "vswrite-mcp": "./dist/mcp/server.js"
  },
  "scripts": {
    "build:mcp": "esbuild src/mcp/server.ts --bundle --platform=node --outfile=dist/mcp/server.js --external:@modelcontextprotocol/sdk"
  }
}
```

---

## Nutzer-Setup

### Claude Desktop / Cowork

Nutzer fügt in `~/Library/Application Support/Claude/claude_desktop_config.json` hinzu:

```json
{
  "mcpServers": {
    "vswrite": {
      "command": "node",
      "args": ["/Applications/vswrite.app/Contents/Resources/mcp/server.js"],
      "env": {
        "VSWRITE_PROJECT_DIR": "/Users/.../my-thesis"
      }
    }
  }
}
```

Oder falls als npm-Package installiert:
```json
{
  "mcpServers": {
    "vswrite": {
      "command": "npx",
      "args": ["vswrite-mcp", "--project", "/Users/.../my-thesis"]
    }
  }
}
```

### Codex Desktop / Clawdbot

Analoges Setup über deren MCP-Konfiguration (falls sie MCP unterstützen — derzeit vor allem Claude Desktop).

---

## Implementierungsreihenfolge

### Phase 1: Kern-Tools (MVP)
1. `@modelcontextprotocol/sdk` installieren
2. `src/mcp/server.ts` Entry Point erstellen
3. **5 essentielle Tools:**
   - `vswrite_get_document` — Dokument lesen
   - `vswrite_update_document` — Dokument schreiben
   - `vswrite_compile` — Kompilieren + Fehler
   - `vswrite_get_settings` — Settings lesen
   - `vswrite_update_settings` — Settings ändern
4. Build-Konfiguration + Testlauf mit Claude Desktop
5. Dokumentation: Setup-Anleitung für Nutzer

### Phase 2: Projekt-Tools
6. `vswrite_list_files` — Dateibaum
7. `vswrite_read_file` / `vswrite_write_file` — Dateien lesen/schreiben
8. `vswrite_create_file` — Neue Dateien
9. `vswrite_get_chapters` — Kapitel-Struktur
10. `vswrite_get_citations` — Bibliographie

### Phase 3: Erweiterte Tools
11. `vswrite_export_pdf` / `vswrite_export_docx` — Export
12. `vswrite_apply_style` / `vswrite_list_styles` — Styling
13. `vswrite_create_project` — Projektvorlagen
14. `vswrite_merge_document` / `vswrite_split_document` — Struktur
15. `vswrite_ensure_bibliography` — Bibliographie-Setup
16. `vswrite_git_status` / `vswrite_git_commit` / `vswrite_git_push` — Git

### Phase 4: Resources + Electron-Integration
17. MCP Resources (document, project structure, settings)
18. IPC-Bridge zum laufenden Electron Process
19. Live-Updates (Resource Subscriptions)

---

## Abgrenzung: Was der MCP-Server NICHT macht

- **Keine Websuche** — die AI-Agents haben eigene Suchtools
- **Keine Dateisuche** — die AI-Agents können grep/find
- **Keine Shell-Commands** — die AI-Agents haben eigene Terminals
- **Kein Chat-Interface** — das ist Sache der AI-Desktop-App
- **Kein API-Key-Management** — der Agent bringt seinen eigenen LLM-Zugang mit

Der MCP-Server fokussiert sich ausschließlich auf **vswrite-spezifische Operationen**, die ein externer Agent nicht selbst durchführen kann.

---

## Bestehende Funktionen die wiederverwendet werden

| MCP Tool | Bestehende Funktion | Modul |
|----------|-------------------|-------|
| `get_document` | `appState.currentContent` + `currentFilePath` | `appState.ts` |
| `open_file` | `openFile(filePath)` | `fileManager.ts` |
| `update_document` | Content setzen + `update` Message senden | `fileManager.ts` |
| `save` | `saveFile()` | `fileManager.ts` |
| `compile` | `TypstCompiler.compile()` / `compilePdf()` | `typstCompiler.ts` |
| `get_settings` | `parseSettings(content)` | `settingsParser.ts` |
| `update_settings` | `handleUpdateSettings(settings)` | `projectManager.ts` |
| `apply_style` | `applyStyleTemplate(styleId)` | `importExport.ts` |
| `list_files` | `readDirTree(dir)` | `projectManager.ts` |
| `get_chapters` | Regex + `fs.existsSync` | inline |
| `merge_document` | `resolveIncludes(filePath)` | `mergeDocument.ts` |
| `split_document` | `splitIntoChapters(content)` | `splitDocument.ts` |
| `get_citations` | `parseBibFile(content)` | `bibParser.ts` |
| `export_pdf` | `execFile('typst', ['compile', ...])` | `typstCompiler.ts` |
| `export_docx` | `serializeDocx()` | `docxSerializer.ts` |
| `git_*` | `simple-git` Instanz | `gitManager.ts` |

Fast alle Funktionen existieren bereits. Der MCP-Server ist primär ein dünner Wrapper mit JSON-Schema-Definitionen.
