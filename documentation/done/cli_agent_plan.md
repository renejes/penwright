# vswrite CLI & Agent-Skill — Implementierungsplan

> **Erstellt:** 2026-03-22
> **Ziel:** Ein CLI-Tool (`vswrite-cli`) das AI-Agenten (Claude Code, Codex) die programmatische Interaktion mit Typst-Dokumenten ermoeglicht — plus automatisches Deployment einer SKILL.md die den Agenten die Benutzung beibringt.

---

## Warum CLI statt MCP?

| | MCP Server | CLI Tool |
|---|---|---|
| **Context-Kosten** | Hoch — alle Tool-Schemas werden sofort geladen (tausende Token) | Null — Agent ruft bei Bedarf `vswrite-cli <cmd>` auf |
| **Zustandslos** | Nein — laeuft als Prozess | Ja — in, out, fertig |
| **Setup fuer Nutzer** | MCP-Config in `claude_desktop_config.json` etc. | Nichts — Extension installiert alles automatisch |
| **Kompatibilitaet** | Nur Claude Desktop / MCP-faehige Clients | Jeder Agent der Shell-Befehle ausfuehren kann |
| **Wartung** | Separater Server-Prozess, Lifecycle-Management | Einzelnes Binary/Script, kein Lifecycle |

---

## Teil 1: Das CLI-Tool

### 1.1 Architektur-Entscheidung: Shared Library + CLI Entry Point

Das Projekt hat bereits standalone-faehige Module die **keine VS Code API** benoetigen:

| Modul | Funktion | VS Code Abhaengigkeit |
|---|---|---|
| `settingsParser.ts` | `parseSettings()`, `applySettings()` | Keine |
| `bibParser.ts` | `parseBibFile()`, `serializeBibFile()` | Keine |
| `splitDocument.ts` | `splitIntoChapters()` | Nur fuer `vscode.window` UI — Kernlogik standalone |
| `mergeDocument.ts` | `resolveIncludes()` | Nur fuer `vscode.window` UI — Kernlogik standalone |
| `styleTemplates.ts` | Template-Daten + `applyStyle()` | Keine |
| `projectTemplates.ts` | Template-Daten | Keine |
| `sourceImporter.ts` | DOI-Extraktion, CrossRef API | Nur `vscode.window` fuer UI |
| `serializer.ts` | TipTap JSON → Typst | Keine |
| `deserializer.ts` | Typst → TipTap JSON | Keine |

**Strategie:** Die Kernlogik wird in einen `shared/`-Ordner extrahiert, den sowohl die Extension als auch die CLI importieren. Kein Code wird dupliziert.

### 1.2 Neue Projektstruktur

```
vswrite/
├── src/
│   ├── shared/                    ← NEU: Geteilte Kernlogik (kein vscode import!)
│   │   ├── settingsParser.ts      # parseSettings(), applySettings(), generateSetBlocks()
│   │   ├── bibParser.ts           # parseBibFile(), serializeBibFile()
│   │   ├── mergeDocument.ts       # resolveIncludes()
│   │   ├── splitDocument.ts       # splitIntoChapters()
│   │   ├── styleTemplates.ts      # styleTemplates[], findPreambleEnd()
│   │   ├── projectTemplates.ts    # templates[]
│   │   ├── sourceImporter.ts      # SourceImporter (CrossRef, DOI)
│   │   ├── serializer.ts          # serializeTypst()
│   │   └── deserializer.ts        # deserializeTypst()
│   ├── extension/                 ← Importiert aus shared/, enthaelt nur VS Code Glue
│   │   ├── extension.ts
│   │   ├── typstEditorProvider.ts
│   │   ├── typstCompiler.ts
│   │   ├── previewPanel.ts
│   │   └── ...
│   ├── webview/                   ← Importiert serializer/deserializer aus shared/
│   │   └── ...
│   └── cli/                       ← NEU: CLI Entry Point
│       └── index.ts               # Argument-Parsing, Command-Dispatch
├── dist/
│   ├── extension.js
│   ├── webview/
│   └── cli/
│       └── vswrite-cli.js         ← Einzelnes gebundeltes Script (Node.js)
└── ...
```

### 1.3 CLI Commands

Jeder Command gibt strukturierten Text auf stdout aus (JSON wenn `--json` Flag gesetzt). Exit-Code 0 = Erfolg, 1 = Fehler mit Meldung auf stderr.

#### Dokument-Operationen

```bash
# Dokument zusammenfuehren (alle #include aufloesen)
vswrite-cli merge <input.typ> [--output merged.typ]
# Ohne --output: stdout

# Dokument an H1-Headings aufteilen
vswrite-cli split <input.typ> [--output-dir chapters/]
# Erzeugt chapters/01-*.typ + main.typ

# Typst → PDF kompilieren (Wrapper um typst compile)
vswrite-cli compile <input.typ> [--output output.pdf]
# Prueft ob typst installiert ist, gibt klare Fehlermeldung wenn nicht

# Neues Projekt aus Template erstellen
vswrite-cli new-project <name> --template <document|thesis|paper|letter|book> [--dir .]
# Erzeugt Ordnerstruktur mit allen Dateien
```

#### Settings & Styling

```bash
# Aktuelle Dokument-Settings lesen
vswrite-cli get-settings <input.typ>
# Output: JSON mit font, fontSize, lang, paper, margin, leading, spacing, ...

# Einzelne Setting aendern
vswrite-cli set <input.typ> --font "Arial" --font-size "12pt" --lang "de" --paper "a4"
# Schreibt die #set-Bloecke direkt in die Datei

# Style-Template anwenden
vswrite-cli apply-style <input.typ> --style <classic|modern|minimal|vibrant|elegant|professional>
# Ersetzt bestehende Preamble durch den gewaehlten Style

# Verfuegbare Styles auflisten
vswrite-cli list-styles
# Output: ID, Name, Beschreibung pro Style
```

#### Bibliografie

```bash
# .bib-Datei parsen und als JSON ausgeben
vswrite-cli parse-bib <references.bib> [--json]
# Output: Array von {citekey, type, author, title, year, fields}

# Zitation manuell hinzufuegen
vswrite-cli add-citation --bib <references.bib> --title "..." --author "..." --year "..." [--type article]
# Haengt Eintrag an .bib an, generiert citekey aus nachname+jahr

# Quellen aus sources/ importieren (DOI → CrossRef)
vswrite-cli import-sources [--sources-dir sources/] [--bib references.bib]
# Scannt PDFs/TXTs, extrahiert DOIs, queryt CrossRef, schreibt .bib
```

#### Analyse & Introspection

```bash
# Dokument-Struktur analysieren
vswrite-cli info <input.typ>
# Output:
#   Woerter: 3450
#   Headings: 12 (3x H1, 5x H2, 4x H3)
#   Bilder: 4
#   Zitationen: 8
#   Includes: 3
#   Raw Blocks: 7 (2x Math, 3x Config, 1x Code, 1x Comment)

# Heading-Gliederung extrahieren
vswrite-cli outline <input.typ> [--json]
# Output: Hierarchische Heading-Liste mit Zeilennummern

# Round-Trip validieren (Typst → JSON → Typst)
vswrite-cli validate <input.typ>
# Deserialisiert + Serialisiert, zeigt Diff wenn Aenderungen
```

### 1.4 Build-Konfiguration

```javascript
// esbuild.cli.mjs (NEU)
import * as esbuild from 'esbuild';

await esbuild.build({
  entryPoints: ['src/cli/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'cjs',
  outfile: 'dist/cli/vswrite-cli.js',
  banner: { js: '#!/usr/bin/env node' },
  external: ['pdf-parse'],  // optional dependency
});
```

package.json Ergaenzung:
```json
{
  "scripts": {
    "build:cli": "node esbuild.cli.mjs",
    "build": "npm run build:extension && npm run build:webview && npm run build:cli"
  },
  "bin": {
    "vswrite-cli": "./dist/cli/vswrite-cli.js"
  }
}
```

### 1.5 CLI Entry Point — Minimal, keine Dependencies

```typescript
// src/cli/index.ts (Skizze)
import { parseArgs } from 'node:util';  // Node 18+ built-in
import * as fs from 'fs';
import * as path from 'path';

// Imports aus shared/
import { parseSettings, applySettings } from '../shared/settingsParser';
import { resolveIncludes } from '../shared/mergeDocument';
import { splitIntoChapters } from '../shared/splitDocument';
import { parseBibFile, serializeBibFile } from '../shared/bibParser';
import { styleTemplates } from '../shared/styleTemplates';
import { templates } from '../shared/projectTemplates';

const args = process.argv.slice(2);
const command = args[0];

switch (command) {
  case 'merge':     handleMerge(args.slice(1)); break;
  case 'split':     handleSplit(args.slice(1)); break;
  case 'info':      handleInfo(args.slice(1)); break;
  case 'set':       handleSet(args.slice(1)); break;
  // ... etc
  default:
    printUsage();
    process.exit(1);
}
```

**Keine npm-Dependencies** fuer die Kern-Commands. Nur Node.js built-ins (`fs`, `path`, `child_process`, `https`, `node:util`). `pdf-parse` bleibt optional (fuer `import-sources`).

---

## Teil 2: Auto-Installation & SKILL.md Deployment

### 2.1 Wann wird was installiert?

Die Extension deployt CLI + Skill automatisch bei diesen Events:

| Event | Aktion |
|---|---|
| **Extension aktiviert** (`.typ` geoeffnet) | Prueft ob `vswrite-cli` im PATH ist → wenn nicht, symlinkt es |
| **`vswrite.newProject`** ausgefuehrt | Erzeugt `.claude/skills/vswrite/SKILL.md` im neuen Projekt |
| **Workspace mit `.typ`-Dateien geoeffnet** | Erzeugt `.claude/skills/vswrite/SKILL.md` wenn nicht vorhanden |

### 2.2 CLI Installation (im Extension Host)

```typescript
// In extension.ts bei activate()
async function ensureCli(context: vscode.ExtensionContext) {
  const cliSource = path.join(context.extensionPath, 'dist', 'cli', 'vswrite-cli.js');

  if (!fs.existsSync(cliSource)) return;  // dev mode, not built

  // Option A: Symlink in einen Ordner der im PATH liegt
  // Option B: Shell-Alias erzeugen
  // Option C: npx-kompatibel ueber package.json "bin" (wenn via npm installiert)

  // Bevorzugt: Extension-eigener bin-Ordner + PATH-Erweiterung
  // Claude Code / Codex erben den PATH des VS Code Terminals
  const binDir = path.join(context.globalStorageUri.fsPath, 'bin');
  fs.mkdirSync(binDir, { recursive: true });

  const linkPath = path.join(binDir, 'vswrite-cli');

  // Wrapper-Script das node + den gebundelten CLI-Code aufruft
  const wrapper = `#!/bin/bash\nnode "${cliSource}" "$@"`;
  fs.writeFileSync(linkPath, wrapper, { mode: 0o755 });

  // PATH-Erweiterung ueber VS Code Terminal Profile
  const config = vscode.workspace.getConfiguration('terminal.integrated');
  const currentEnv = config.get<Record<string, string>>('env.osx') || {};
  if (!currentEnv['PATH']?.includes(binDir)) {
    currentEnv['PATH'] = `${binDir}:${currentEnv['PATH'] || '$PATH'}`;
    await config.update('env.osx', currentEnv, vscode.ConfigurationTarget.Global);
  }
  // Analog fuer Linux (env.linux) und Windows (env.windows)
}
```

**Ergebnis:** Nach dem ersten Oeffnen einer `.typ`-Datei ist `vswrite-cli` in jedem VS Code Terminal (und damit fuer Claude Code) verfuegbar. Der Nutzer muss nichts tun.

### 2.3 SKILL.md Auto-Deployment

Die Extension erzeugt bei Bedarf `.claude/skills/vswrite/SKILL.md` im Workspace:

```typescript
// In extension.ts oder typstEditorProvider.ts
function deploySkill(workspaceRoot: string) {
  const skillDir = path.join(workspaceRoot, '.claude', 'skills', 'vswrite');
  const skillPath = path.join(skillDir, 'SKILL.md');

  if (fs.existsSync(skillPath)) return;  // bereits vorhanden

  fs.mkdirSync(skillDir, { recursive: true });
  fs.writeFileSync(skillPath, SKILL_MD_CONTENT, 'utf-8');
}
```

Die SKILL.md wird auch in `.gitignore` eingetragen (falls gewuenscht), oder bewusst committed damit alle Projektmitarbeiter den Skill nutzen koennen.

### 2.4 SKILL.md Inhalt

```markdown
---
name: vswrite
description: CLI tools for working with Typst documents in vswrite projects
---

# vswrite CLI — Agent Instructions

You are working in a project that uses **vswrite**, a WYSIWYG editor for Typst (.typ) files.
The `vswrite-cli` command is available in your terminal.

## Quick Reference

### Understand the document
```bash
vswrite-cli info <file.typ>           # Word count, structure overview
vswrite-cli outline <file.typ>        # Heading hierarchy
vswrite-cli get-settings <file.typ>   # Current document settings (font, paper, margins)
```

### Edit document settings
```bash
vswrite-cli set <file.typ> --font "Arial" --font-size "12pt" --lang "de"
vswrite-cli apply-style <file.typ> --style modern
vswrite-cli list-styles               # Show available style templates
```

### Work with multi-file projects
```bash
vswrite-cli merge main.typ --output merged.typ   # Resolve all #include
vswrite-cli split long-doc.typ                     # Split at H1 headings
```

### Bibliography
```bash
vswrite-cli parse-bib references.bib              # List all citations
vswrite-cli add-citation --bib references.bib --title "..." --author "..." --year "..."
vswrite-cli import-sources --sources-dir sources/  # Auto-import DOIs from PDFs
```

### Scaffold
```bash
vswrite-cli new-project my-thesis --template thesis
```

### Validate
```bash
vswrite-cli validate <file.typ>       # Check round-trip fidelity
```

## Important Rules

1. **Edit .typ files directly** — vswrite detects external changes and updates the
   WYSIWYG editor automatically. You do NOT need the CLI to edit content.
2. **Use the CLI for structural operations** — merging, splitting, settings,
   bibliography, and analysis.
3. **Typst syntax basics:**
   - `= Heading 1`, `== Heading 2`, `=== Heading 3`
   - `*bold*`, `_italic_`, `` `code` ``
   - `- bullet`, `+ numbered`
   - `#image("assets/photo.png")`
   - `@citekey` for citations
   - `#include "chapters/01.typ"` for multi-file
4. **Do not modify lines starting with `#set`, `#show`, or `#import`** unless you
   know what you're doing — use `vswrite-cli set` instead.
5. **Images go in `assets/`** next to the .typ file.
6. **Round-trip safety:** Unknown Typst constructs are preserved as raw blocks.
   The serializer/deserializer never drops content.
```

---

## Teil 3: Implementierungsreihenfolge

### Schritt 1: Shared Library extrahieren

**Was:** Die Kernlogik aus `src/extension/` und `src/webview/lib/` in `src/shared/` verschieben.

**Dateien:**
1. `settingsParser.ts` → `src/shared/settingsParser.ts` (1:1, hat keine vscode Imports)
2. `bibParser.ts` → `src/shared/bibParser.ts` (1:1, pure TypeScript)
3. `styleTemplates.ts` → `src/shared/styleTemplates.ts` (1:1, nur Daten)
4. `projectTemplates.ts` → `src/shared/projectTemplates.ts` (1:1, nur Daten)
5. `mergeDocument.ts` → `resolveIncludes()` extrahieren nach `src/shared/mergeDocument.ts`, VS Code UI-Code bleibt in `src/extension/mergeDocument.ts`
6. `splitDocument.ts` → `splitIntoChapters()` extrahieren nach `src/shared/splitDocument.ts`, VS Code UI-Code bleibt
7. `sourceImporter.ts` → Kernklasse nach `src/shared/sourceImporter.ts` (nutzt nur `fs`, `path`, `https`)
8. `serializer.ts` + `deserializer.ts` → bleiben in `src/webview/lib/` (werden vom CLI via Build importiert — oder auch nach shared/ verschoben)

**Aufwand:** Mittel. Hauptsaechlich Imports umbiegen. Die Extension-Dateien werden zu duennen Wrappern die `shared/` importieren und VS Code UI drumherum bauen.

**Validierung:** `npm run build` muss weiterhin funktionieren. Extension manuell testen (F5).

### Schritt 2: CLI Entry Point bauen

**Was:** `src/cli/index.ts` mit Command-Dispatch und `esbuild.cli.mjs` fuer den Build.

**Commands in Reihenfolge implementieren:**
1. `info` — Am einfachsten, guter Smoke-Test
2. `outline` — Heading-Parser wiederverwenden
3. `get-settings` / `set` — `parseSettings()` / `applySettings()` aufrufen
4. `list-styles` / `apply-style` — Daten + String-Replacement
5. `merge` — `resolveIncludes()` aufrufen
6. `split` — `splitIntoChapters()` aufrufen
7. `parse-bib` / `add-citation` — `parseBibFile()` / `serializeBibFile()`
8. `import-sources` — CrossRef-Integration
9. `compile` — `typst compile` Wrapper
10. `new-project` — Template-Scaffolding
11. `validate` — Deserialize → Serialize → Diff

**Aufwand:** Mittel. Die Kernlogik existiert bereits, es geht nur um CLI-Argumente parsen und Output formatieren.

### Schritt 3: Auto-Installation in der Extension

**Was:** `ensureCli()` in `extension.ts` einbauen. Wrapper-Script erzeugen, PATH im VS Code Terminal konfigurieren.

**Aufwand:** Klein. Ein paar Zeilen in `activate()`.

### Schritt 4: SKILL.md Deployment

**Was:** `deploySkill()` in Extension einbauen. SKILL.md Content als String-Konstante oder aus einer Datei lesen.

**Trigger:**
- `activate()` wenn Workspace `.typ`-Dateien enthaelt
- `vswrite.newProject` Command

**Aufwand:** Klein. Datei schreiben + `.gitignore`-Eintrag.

### Schritt 5: Testen & Iterieren

**Was:** Claude Code auffordern die CLI zu benutzen und beobachten:
- Versteht der Agent die SKILL.md?
- Sind die Commands intuitiv benannt?
- Ist der Output nuetzlich (zu viel/zu wenig)?
- Fehlen Commands fuer haeufige Workflows?

**Methode:** Manuelle Tests im Extension Development Host mit Claude Code im Terminal.

---

## Teil 4: Technische Details

### 4.1 Output-Format

Alle Commands geben standardmaessig **menschenlesbaren Text** aus. Mit `--json` Flag wechseln sie zu strukturiertem JSON. AI-Agenten koennen beides verarbeiten, JSON ist aber praeziser.

```bash
$ vswrite-cli info thesis.typ
Words: 3450
Headings: 12 (3× H1, 5× H2, 4× H3)
Images: 4
Citations: 8
Includes: 3
Settings: font=Arial, size=12pt, lang=de, paper=a4

$ vswrite-cli info thesis.typ --json
{
  "words": 3450,
  "headings": { "total": 12, "h1": 3, "h2": 5, "h3": 4 },
  "images": 4,
  "citations": 8,
  "includes": 3,
  "settings": { "font": "Arial", "fontSize": "12pt", "lang": "de", "paper": "a4" }
}
```

### 4.2 Error Handling

```bash
$ vswrite-cli merge nonexistent.typ
Error: File not found: nonexistent.typ
$ echo $?
1

$ vswrite-cli compile thesis.typ
Error: Typst CLI not found. Install with: brew install typst
$ echo $?
1
```

Klare, einzeilige Fehlermeldungen auf stderr. Kein Stack-Trace fuer User-Fehler.

### 4.3 Keine globale npm-Installation noetig

Das CLI wird **nicht** ueber `npm install -g` installiert. Die Extension bundelt es mit (`dist/cli/vswrite-cli.js` ist Teil des Extension-Pakets) und erzeugt beim Aktivieren ein Wrapper-Script im VS Code Terminal PATH. Der Nutzer installiert nur die Extension — alles andere passiert automatisch.

### 4.4 CLAUDE.md Ergaenzung

Zusaetzlich zur SKILL.md wird die projektweite `CLAUDE.md` um einen kurzen Hinweis ergaenzt:

```markdown
## AI Agent CLI

The `vswrite-cli` command is available in the terminal for structural
document operations. Run `vswrite-cli --help` for usage.
```

Das reicht als Trigger — Claude Code liest die CLAUDE.md automatisch und weiss dann dass ein CLI-Tool existiert.

---

## Zusammenfassung

| Komponente | Dateien | Aufwand |
|---|---|---|
| Shared Library | ~8 Dateien verschieben/extrahieren | Mittel |
| CLI Entry Point | 1 neue Datei + Build-Config | Mittel |
| Auto-Installation | ~30 Zeilen in `extension.ts` | Klein |
| SKILL.md Deployment | ~20 Zeilen in `extension.ts` + Content | Klein |
| Testen | Manuell mit Claude Code | Klein |

**Gesamt:** Ueberschaubarer Aufwand, da 90% der Kernlogik bereits existiert und nur extrahiert + mit CLI-Argumenten versehen werden muss. Kein neues Framework, keine neuen Dependencies.
