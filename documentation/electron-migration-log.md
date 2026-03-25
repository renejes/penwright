# Electron Migration Log

> **Stand:** 2026-03-25
> Dokumentation der bisherigen Schritte bei der Portierung von vswrite (VS Code Extension) zu einer eigenständigen Electron Desktop-App.

---

## Ausgangslage

Das vswrite Extension-Repo (`vswrite/`) enthält einen WYSIWYG-Editor für Typst-Dokumente als VS Code Extension. Die Codebase ist in drei Schichten aufgeteilt:

- **Shared** (`src/shared/`, ~2.065 Zeilen) — Plattformunabhängige Logik (Settings Parser, Bib Parser, DOCX Serializer, Style Templates, Merge/Split, Root Finder)
- **Webview** (`src/webview/`, ~6.344 Zeilen) — TipTap/Svelte Editor, Toolbar, CommandHub, Serializer/Deserializer, Custom Nodes
- **Extension Host** (`src/extension/`, ~3.389 Zeilen) — VS Code API abhängig (CustomTextEditorProvider, Compiler, Preview, Tree Views)
- **CLI** (`src/cli/`, ~801 Zeilen) — Standalone Node.js CLI Tool

~73% der Codebase (Shared + Webview + CLI) haben keine VS Code Abhängigkeit.

---

## Was wurde gemacht

### 1. Projekt-Struktur angelegt

Neues eigenständiges Repo `vswrite-desktop/` mit folgender Struktur:

```
vswrite-desktop/
├── src/
│   ├── shared/           ← 1:1 Kopie aus Extension (unverändert)
│   ├── editor/
│   │   ├── lib/          ← Kopie von webview/lib/ (Serializer, Deserializer, TipTap Nodes, etc.)
│   │   ├── components/   ← Kopie von webview/components/ (Toolbar, CommandHub, Settings, etc.)
│   │   └── style.css     ← Kopie von webview/style.css
│   ├── cli/              ← 1:1 Kopie (unverändert)
│   ├── main/             ← NEU: Electron Main Process
│   │   ├── index.ts      ← App Lifecycle, Window, Menü, IPC, File I/O
│   │   ├── preload-entry.ts ← contextBridge für sichere IPC
│   │   ├── typstCompiler.ts ← Portierung des VS Code Compilers (child_process)
│   │   └── deserializer-bridge.ts ← Re-Export des Deserializers für Main Process
│   └── renderer/         ← NEU: Electron Renderer Entry
│       ├── main.ts       ← Svelte Mount
│       └── App.svelte    ← Angepasste Version der Extension App.svelte
├── index.html            ← Renderer HTML Entry
├── package.json
├── electron.vite.config.mts
├── vite.config.mts
├── tsconfig.json
├── svelte.config.js
└── documentation/        ← Kopie aus Extension + diese Datei
```

### 2. IPC Adapter erstellt

**Datei:** `src/editor/lib/ipcAdapter.ts`

Abstrahiert die Kommunikation zwischen Renderer und Host-Prozess. Erkennt automatisch ob VS Code oder Electron läuft:

- **VS Code**: `acquireVsCodeApi().postMessage()` / `window.addEventListener('message')`
- **Electron**: `window.electronAPI.send()` / `window.electronAPI.on()` (via contextBridge)

Gleiche Message-Typen (`messages.ts`) in beiden Umgebungen — nur der Transport wechselt.

### 3. Electron Main Process geschrieben

**Datei:** `src/main/index.ts` (~350 Zeilen)

Portierung der Extension-Host-Logik ohne VS Code API:
- `BrowserWindow` mit `hiddenInset` Titlebar (macOS)
- File Open/Save/New über `dialog` API
- Auto-Save nach Edits (1s Debounce)
- Unsaved-Changes Warnung beim Schließen
- IPC Handler für alle 23 Webview→Extension Message-Typen
- Typst Compiler Integration (spawnt `typst compile`, emittiert SVG)
- PDF/DOCX Export über native Dialoge
- Settings Parser/Applier
- macOS App-Menü (File, Edit, View, Help)
- `open-file` Event Handler (Datei per Doppelklick öffnen)
- Command-Line Argument Support (`vswrite-desktop file.typ`)

### 4. Preload Script erstellt

**Datei:** `src/main/preload-entry.ts`

Sicherer IPC-Bridge via `contextBridge.exposeInMainWorld`:
- `electronAPI.send(channel, data)` — Renderer → Main
- `electronAPI.on(channel, callback)` — Main → Renderer
- `electronAPI.openFile()` / `electronAPI.saveFile()` — Dialog Handler
- Nur `'vswrite'` Channel erlaubt (Security)

### 5. Renderer App.svelte angepasst

**Datei:** `src/renderer/App.svelte`

Basiert auf der Extension `App.svelte` mit folgenden Änderungen:
- Import-Pfade auf `../editor/` angepasst
- `acquireVsCodeApi()` ersetzt durch `ipc` aus `ipcAdapter.ts`
- `vscodeBridge` Objekt erstellt das `ipc.send()` wrapped (für CommandHub/QuickSettings Kompatibilität)
- Status Bar am unteren Rand hinzugefügt
- Neue Message-Handler: `previewUpdate`, `compileError` (TODO)
- `documentBaseUri` Handler akzeptiert sowohl `uri` als auch `baseUri` Feld

### 6. Build Pipeline konfiguriert

**Tool:** `electron-vite` v5.0.0

Drei Build-Targets in `electron.vite.config.mts`:
- **Main**: `src/main/index.ts` → `dist/main/index.js` (CJS, Node, externalize deps)
- **Preload**: `src/main/preload-entry.ts` → `dist/preload/preload-entry.js` (CJS, extern electron)
- **Renderer**: `index.html` + `src/renderer/main.ts` → `dist/renderer/` (Svelte/Vite)

Alle drei Targets kompilieren erfolgreich.

---

## Offenes Problem: Electron Module Resolution

### Das Problem

`require("electron")` im Main Process löst zum npm Wrapper (`node_modules/electron/index.js`) auf, der den **Pfad zur Electron Binary** als String zurückgibt — nicht die Electron API. Das führt zu:

```
TypeError: Cannot read properties of undefined (reading 'whenReady')
```

weil `electron.app` undefined ist (da `electron` ein String ist).

### Ursache

- `node_modules/electron/index.js` ist ein npm-Paket das nur den Binary-Pfad exportiert
- Electron registriert ein built-in `'electron'` Modul, aber Node.js' `Module._resolveFilename` findet `node_modules/electron` zuerst
- Weder CJS `require('electron')` noch ESM `import { app } from 'electron'` erreichen das built-in Modul
- `process.type` ist `undefined` (App noch nicht initialisiert wenn Main Script lädt)
- `Module.builtinModules` enthält `'electron'` NICHT

### Getestete Lösungsansätze (alle gescheitert)

1. **esbuild `--external:electron`** — Erzeugt korrektes `require("electron")`, aber Resolution geht zum npm Wrapper
2. **Module._resolveFilename Override** — Gibt `'electron'` als Pfad zurück, Node versucht das als Datei zu lesen → ENOENT
3. **ESM `import { app } from 'electron'`** — Node versucht npm Wrapper als CJS zu parsen → `exports` is undefined
4. **npm Wrapper temporär umbenannt** — Node hat den Pfad schon gecached, findet die Datei trotzdem nicht
5. **process._linkedBinding** — Low-Level C++ Bindings, SIGSEGV bei Zugriff
6. **electron-vite `externalizeDepsPlugin()`** — Gleiches Ergebnis wie esbuild external
7. **Proxy auf module.exports** — Geht grundsätzlich, aber `_linkedBinding` crasht

### Nächste Schritte

- Web-Recherche nach "electron require returns string" / "electron-vite module resolution"
- Eventuell: `electron-forge` mit Vite Plugin (hat eigene Toolchain für Module Resolution)
- Eventuell: Electron downgraden auf v28 oder v30 wo das Problem möglicherweise nicht existiert
- Eventuell: `electron-vite dev` (statt `preview`) testen — Dev-Server könnte anders resolven
- Custom Loader Script das vor dem Bundle lädt und den require Cache vorbereitet

---

## Dependencies

```json
{
  "dependencies": {
    "@tiptap/core": "^3.0.0",
    "@tiptap/extension-link": "^3.0.0",
    "@tiptap/extension-table": "^3.0.0",
    "@tiptap/extension-table-cell": "^3.0.0",
    "@tiptap/extension-table-header": "^3.0.0",
    "@tiptap/extension-table-row": "^3.0.0",
    "@tiptap/pm": "^3.0.0",
    "@tiptap/starter-kit": "^3.0.0",
    "@tiptap/suggestion": "^3.0.0",
    "chokidar": "^4.0.0",
    "docx": "^9.6.1",
    "electron-store": "^10.0.0"
  },
  "devDependencies": {
    "@sveltejs/vite-plugin-svelte": "^5.0.0",
    "electron": "^35.7.5",
    "electron-builder": "^26.0.0",
    "electron-vite": "^5.0.0",
    "esbuild": "^0.25.0",
    "svelte": "^5.0.0",
    "typescript": "^5.7.0",
    "vite": "^6.0.0"
  }
}
```
