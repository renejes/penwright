# vswrite Standalone — Electron Architecture Plan

> **Stand:** 2026-03-25
> Architekturplan für die Portierung von vswrite (VS Code Extension) zu einer eigenständigen Electron Desktop-App.

---

## Strategie: Monorepo mit zwei Targets

**Kein Fork, kein separates Repo.** Stattdessen ein Monorepo mit zwei Build-Targets:

```
vswrite/
├── src/
│   ├── shared/          ← Unverändert (2.065 Zeilen, 0 Änderungen)
│   ├── webview/         ← 95% identisch, nur IPC-Bridge getauscht
│   ├── cli/             ← Unverändert (801 Zeilen, 0 Änderungen)
│   ├── extension/       ← Bleibt für VS Code Extension
│   └── electron/        ← NEU: Electron Main Process (~1.500 Zeilen)
├── package.json         ← Erweitert um Electron-Scripts
├── electron-builder.yml ← NEU: Packaging-Konfiguration
└── forge.config.ts      ← NEU: Electron Forge Config
```

**Warum Monorepo statt Fork?**
- Shared/Webview/CLI Code wird nur einmal gepflegt
- Bugfixes in Serializer/Deserializer wirken sofort auf beide Targets
- `npm run build:extension` baut die VS Code Extension
- `npm run build:electron` baut die Standalone-App
- Git Branch `electron` für die Entwicklung, Merge in `main` wenn stabil

---

## Was sich ändert, was bleibt

### Unverändert (9.211 Zeilen = 73%)

| Modul | Zeilen | Änderungen |
|-------|--------|-----------|
| `src/shared/` (settingsParser, bibParser, docxSerializer, styleTemplates, projectTemplates, mergeDocument, splitDocument, rootFinder, sourceImporter) | 2.065 | Keine |
| `src/webview/components/` (Toolbar, CommandHub, SettingsPanel, SearchReplace, QuickSettings, ShortcutCheatsheet, WelcomeScreen) | 1.497 | Keine |
| `src/webview/lib/` (serializer, deserializer, reconciler, editor, slashCommands, citationSuggestion, alle TipTap Nodes) | 4.824 | Keine (außer messages.ts) |
| `src/cli/` | 801 | Keine |
| `src/webview/style.css` | ~300 | Minimale Ergänzungen (App-Shell Styling) |

### Angepasst (~236 Zeilen)

| Datei | Änderung |
|-------|---------|
| `src/webview/lib/messages.ts` | IPC-Adapter: `acquireVsCodeApi().postMessage()` → `window.electronAPI.send()`. Gleiche Message-Typen, nur der Transport wechselt. |
| `src/webview/App.svelte` | Statt `window.addEventListener('message')` → `window.electronAPI.on()`. ~20 Zeilen. |
| `src/webview/main.ts` | Conditional: `if (window.electronAPI)` vs `if (acquireVsCodeApi)`. |

### Neu zu schreiben (~2.500–3.000 Zeilen)

| Datei | Zeilen (ca.) | Beschreibung |
|-------|-------------|-------------|
| `src/electron/main.ts` | 200 | App-Lifecycle, Window-Management, Menü, Auto-Update |
| `src/electron/fileManager.ts` | 400 | Datei öffnen/speichern/watcher, Recent Files, Dirty State |
| `src/electron/ipcBridge.ts` | 300 | IPC Handler — Mapping der 32 Message-Typen auf Electron IPC |
| `src/electron/typstCompiler.ts` | 100 | Portierung von extension/typstCompiler.ts (child_process bleibt gleich) |
| `src/electron/previewManager.ts` | 120 | SVG Preview in eigenem BrowserWindow oder Panel |
| `src/electron/terminalManager.ts` | 250 | node-pty + xterm.js Terminal-Integration |
| `src/electron/fileTree.svelte` | 500 | Dateibaum-Sidebar (rekursiv, Icons, Kontextmenü) |
| `src/electron/gitIntegration.ts` | 150 | simple-git Wrapper (Status, Commit, Push, Pull) |
| `src/electron/appShell.svelte` | 300 | Äußere App-Shell (Sidebar, Tabs, Status Bar, Layout) |
| `src/electron/preload.ts` | 80 | Electron Preload Script (contextBridge für sichere IPC) |
| `electron-builder.yml` | 50 | macOS, Windows, Linux Packaging |

---

## Architektur-Diagramm

```
┌─────────────────────────────────────────────────────┐
│                   Electron App                       │
│                                                     │
│  ┌──────────────┐    IPC (contextBridge)    ┌──────────────────┐
│  │  Main Process │◄─────────────────────────►│  Renderer Process │
│  │  (Node.js)    │                           │  (Chromium)        │
│  │               │                           │                    │
│  │  fileManager  │    ┌──────────────────┐   │  ┌──────────┐     │
│  │  typstCompiler│    │  preload.ts       │   │  │ App Shell│     │
│  │  ipcBridge    │    │  contextBridge    │   │  │ ┌──────┐│     │
│  │  terminalMgr  │    │  electronAPI      │   │  │ │Editor││     │
│  │  gitIntegr.   │    └──────────────────┘   │  │ │TipTap││     │
│  │               │                           │  │ └──────┘│     │
│  │  ┌──────────┐ │                           │  │ Toolbar  │     │
│  │  │ shared/  │ │                           │  │ Sidebar  │     │
│  │  │ bibParser│ │                           │  │ Terminal │     │
│  │  │ settings │ │                           │  │ Preview  │     │
│  │  │ docx     │ │                           │  └──────────┘     │
│  │  │ merge    │ │                           │                    │
│  │  └──────────┘ │                           │  ┌──────────┐     │
│  └──────────────┘                           │  │ webview/  │     │
│                                              │  │ (identisch│     │
│                                              │  │  zu Ext.) │     │
│                                              │  └──────────┘     │
│                                              └──────────────────┘
└─────────────────────────────────────────────────────┘
```

---

## IPC-Bridge: Der zentrale Swap

Die VS Code Extension kommuniziert über `postMessage`. In Electron wird das zu `ipcRenderer`/`ipcMain` via `contextBridge`:

### Aktuell (VS Code)

```typescript
// Webview → Extension
const vscode = acquireVsCodeApi();
vscode.postMessage({ type: 'edit', content: typstText });

// Extension → Webview
panel.webview.postMessage({ type: 'update', content: newContent });

// Webview empfängt
window.addEventListener('message', (e) => {
  const msg = e.data;
  if (msg.type === 'update') { ... }
});
```

### Neu (Electron)

```typescript
// preload.ts — sicherer Bridge
contextBridge.exposeInMainWorld('electronAPI', {
  send: (channel: string, data: unknown) => ipcRenderer.send(channel, data),
  on: (channel: string, callback: Function) =>
    ipcRenderer.on(channel, (_event, data) => callback(data)),
});

// Renderer → Main
window.electronAPI.send('vswrite', { type: 'edit', content: typstText });

// Main → Renderer
mainWindow.webContents.send('vswrite', { type: 'update', content: newContent });

// Renderer empfängt
window.electronAPI.on('vswrite', (msg) => {
  if (msg.type === 'update') { ... }
});
```

### Adapter-Pattern für messages.ts

```typescript
// src/webview/lib/ipcAdapter.ts — NEU, ~40 Zeilen
interface IPCAdapter {
  send(msg: WebviewMessage): void;
  onMessage(handler: (msg: ExtensionMessage) => void): void;
}

// VS Code Adapter
function createVSCodeAdapter(): IPCAdapter {
  const vscode = acquireVsCodeApi();
  return {
    send: (msg) => vscode.postMessage(msg),
    onMessage: (handler) =>
      window.addEventListener('message', (e) => handler(e.data)),
  };
}

// Electron Adapter
function createElectronAdapter(): IPCAdapter {
  return {
    send: (msg) => window.electronAPI.send('vswrite', msg),
    onMessage: (handler) => window.electronAPI.on('vswrite', handler),
  };
}

// Auto-detect
export const ipc: IPCAdapter =
  typeof acquireVsCodeApi !== 'undefined'
    ? createVSCodeAdapter()
    : createElectronAdapter();
```

Damit ändert sich in `App.svelte` nur eine Zeile:
```diff
- const vscode = acquireVsCodeApi();
+ import { ipc } from './lib/ipcAdapter';
```

---

## IPC Message-Map: Extension → Electron

Alle 32 Message-Typen bleiben identisch. Nur die Handler-Seite wechselt:

### Extension → Webview (9 Typen)

| Message | VS Code Handler | Electron Handler |
|---------|----------------|-----------------|
| `update` | `panel.webview.postMessage()` | `mainWindow.webContents.send()` |
| `settingsData` | `panel.webview.postMessage()` | `mainWindow.webContents.send()` |
| `documentBaseUri` | `panel.webview.postMessage()` | Nicht nötig (lokale Pfade direkt) |
| `insertImage` | `panel.webview.postMessage()` | `mainWindow.webContents.send()` |
| `wordGoal` | `panel.webview.postMessage()` | `mainWindow.webContents.send()` |
| `scrollToHeading` | `panel.webview.postMessage()` | `mainWindow.webContents.send()` |
| `citationData` | `panel.webview.postMessage()` | `mainWindow.webContents.send()` |
| `documentLang` | `panel.webview.postMessage()` | `mainWindow.webContents.send()` |
| `welcomeData` | `panel.webview.postMessage()` | `mainWindow.webContents.send()` |

### Webview → Extension (23 Typen)

| Message | VS Code Handler | Electron Handler |
|---------|----------------|-----------------|
| `ready` | Lade Dokument aus TextDocument | Lade Datei von Disk |
| `edit` | WorkspaceEdit → auto-save | `fs.writeFile()` → auto-save |
| `exportPdf` | typst compile | typst compile (identisch) |
| `exportDocx` | serializeDocx → showSaveDialog | serializeDocx → dialog.showSaveDialog |
| `openSource` | vscode.open() | shell.openPath() oder internes Tab |
| `newProject` | vscode.window.showQuickPick | Eigener Dialog |
| `newFile` | vscode.window.showSaveDialog | dialog.showSaveDialog |
| `mergeDocument` | shared/mergeDocument | shared/mergeDocument (identisch) |
| `pickImage` | vscode.window.showOpenDialog | dialog.showOpenDialog |
| `dropImage` | Base64 → assets/ speichern | Base64 → assets/ speichern (identisch) |
| `requestSettings` | parseSettings() | parseSettings() (identisch) |
| `updateSettings` | applySettings() | applySettings() (identisch) |
| `splitDocument` | shared/splitDocument | shared/splitDocument (identisch) |
| `applyStyle` | shared/styleTemplates | shared/styleTemplates (identisch) |
| `requestCitations` | bibWatcher | chokidar + bibParser (ähnlich) |
| `undoLastAiEdit` | Snapshot restore | Snapshot restore (identisch) |
| `dismissWelcome` | globalState.update() | electron-store |
| `openUserGuide` | vscode.env.openExternal | shell.openExternal |
| `deserializeError` | vscode.window.showErrorMessage | dialog.showErrorBox |

**Fazit:** ~70% der Handler sind 1:1 Portierungen (gleiche Node.js APIs). ~30% ersetzen VS Code UI-APIs durch Electron-Äquivalente.

---

## Neue Abhängigkeiten

```json
{
  "dependencies": {
    "electron-store": "^10.0.0",
    "node-pty": "^1.0.0",
    "@xterm/xterm": "^5.5.0",
    "@xterm/addon-fit": "^0.10.0",
    "simple-git": "^3.27.0",
    "chokidar": "^4.0.0"
  },
  "devDependencies": {
    "electron": "^35.0.0",
    "electron-builder": "^26.0.0"
  }
}
```

| Paket | Zweck | Größe |
|-------|-------|-------|
| `electron` | App-Framework | ~150MB (gebundelt) |
| `node-pty` | Terminal PTY | ~2MB (native C++ binding) |
| `@xterm/xterm` | Terminal UI | ~1MB |
| `simple-git` | Git Operationen | ~200KB |
| `chokidar` | File Watching | ~300KB |
| `electron-store` | Persistenter State (statt globalState) | ~50KB |
| `electron-builder` | Packaging + Code Signing | Dev only |

---

## App-Shell Layout

```
┌─────────────────────────────────────────────────────────┐
│  ◉ ◉ ◉   vswrite — main.typ                    ─ □ ✕  │  ← Title Bar (nativ oder custom)
├─────────┬───────────────────────────────────────────────┤
│ 📁 Files │  B I U S  │ H1 ▾│ • — │ 🔗 📷 │ ☰      │  ← Toolbar (bestehend)
├─────────┤───────────────────────────────────────────────┤
│         │                                               │
│ ▼ Kapitel│           TipTap WYSIWYG Editor              │  ← Editor (bestehend)
│   01-ein│           (identisch zur Extension)           │
│   02-met│                                               │
│   03-erg│                                               │
│         │                                               │
│─────────│                                               │
│ Outline │                                               │
│  = Einl.│                                               │
│   = Frag│                                               │
│   = Ziel│                                               │
│─────────│───────────────────────────────────────────────│
│ 🔧 Git  │  $ ▌                                         │  ← Terminal (xterm.js)
│  M main │  claude ▌                                     │  ← Claude Code läuft hier
│         │                                               │
├─────────┴───────────────────────────────────────────────┤
│  Wörter: 1.234 / 5.000  │  ✓ Compiled  │  § 2.1 Meth. │  ← Status Bar
└─────────────────────────────────────────────────────────┘
```

**Sidebar-Panels (umschaltbar):**
1. **Files** — Dateibaum des Projektordners
2. **Outline** — Heading-Hierarchie (bestehender HeadingTreeProvider, portiert zu Svelte)
3. **Git** — Status, Staged/Unstaged, Commit-Button
4. **Includes** — Kapitel-Manager (bestehender IncludeTreeProvider, portiert zu Svelte)

---

## Terminal-Integration

```typescript
// src/electron/terminalManager.ts
import * as pty from 'node-pty';

const shell = process.platform === 'win32' ? 'powershell.exe' : 'zsh';

const ptyProcess = pty.spawn(shell, [], {
  name: 'xterm-256color',
  cols: 80,
  rows: 24,
  cwd: projectDir,
  env: { ...process.env, TERM_PROGRAM: 'vswrite' },
});

// pty → xterm.js (Renderer)
ptyProcess.onData((data) => {
  mainWindow.webContents.send('terminal-data', data);
});

// xterm.js → pty (User Input)
ipcMain.on('terminal-input', (_event, data: string) => {
  ptyProcess.write(data);
});
```

**Claude Code funktioniert hier vollständig** — es ist ein echtes PTY-Terminal, kein simuliertes. Claude Code erkennt `TERM_PROGRAM` und kann interaktiv arbeiten. Der `vswrite-cli` ist automatisch im PATH verfügbar.

---

## Build-Pipeline

```json
{
  "scripts": {
    "build:extension": "node esbuild.config.mjs --production",
    "build:webview": "vite build",
    "build:cli": "node esbuild.cli.mjs",
    "build": "npm run build:extension && npm run build:webview && npm run build:cli",

    "build:electron-main": "esbuild src/electron/main.ts --bundle --platform=node --outfile=dist-electron/main.js --external:electron --external:node-pty",
    "build:electron-preload": "esbuild src/electron/preload.ts --bundle --platform=node --outfile=dist-electron/preload.js --external:electron",
    "build:electron-renderer": "vite build --config vite.electron.config.ts",
    "build:electron": "npm run build:electron-main && npm run build:electron-preload && npm run build:electron-renderer",

    "dev:electron": "concurrently \"vite --config vite.electron.config.ts\" \"electron .\"",
    "package:mac": "electron-builder --mac",
    "package:win": "electron-builder --win",
    "package:linux": "electron-builder --linux"
  }
}
```

**Webview Vite Config** wird minimal angepasst:
- Extension: Output als IIFE (single file für VS Code Webview)
- Electron: Output als normaler ES Module (Chromium Renderer)
- Gleiche Svelte Components, gleiche TipTap Extensions

---

## Implementierungs-Phasen

### Phase E1: Skeleton (3–4 Tage)
- [ ] Electron Main Process mit BrowserWindow
- [ ] Preload Script mit contextBridge
- [ ] IPC-Adapter in messages.ts (VSCode/Electron auto-detect)
- [ ] Webview lädt in Electron (TipTap Editor sichtbar)
- [ ] Datei öffnen/speichern über File Menü
- **Ergebnis:** Editor öffnet .typ Dateien, Formatierung funktioniert

### Phase E2: Core Features (4–5 Tage)
- [ ] Auto-Save nach Edits (wie in Extension)
- [ ] Typst Compiler Integration (SVG Preview)
- [ ] Preview Panel (rechts oder unten)
- [ ] File Watcher für externe Edits (chokidar)
- [ ] Conflict Guard (AI Agent Kompatibilität)
- [ ] Settings Panel, Quick Settings
- [ ] PDF Export, DOCX Export
- **Ergebnis:** Vollständiger Editor mit Preview und Export

### Phase E3: Sidebar & Navigation (3–4 Tage)
- [ ] File Tree Sidebar (Svelte Component)
- [ ] Heading Outline Sidebar
- [ ] Include Manager Sidebar
- [ ] Tab-System (mehrere Dateien gleichzeitig)
- [ ] Recent Files
- [ ] Status Bar (Wörter, Compile-Status, aktuelles Heading)
- **Ergebnis:** Navigierbare App mit Projekt-Support

### Phase E4: Terminal & Git (3–4 Tage)
- [ ] Terminal Panel (node-pty + xterm.js)
- [ ] Multiple Terminal Tabs
- [ ] Git Status Sidebar (simple-git)
- [ ] Git Commit/Push/Pull Buttons
- [ ] vswrite-cli im Terminal PATH
- **Ergebnis:** Claude Code und Git nutzbar

### Phase E5: Polish & Packaging (3–4 Tage)
- [ ] Native Menüs (macOS, Windows, Linux)
- [ ] Keyboard Shortcuts (Cmd+S, Cmd+N, Cmd+O, etc.)
- [ ] Auto-Update (electron-updater)
- [ ] App Icon & Branding
- [ ] macOS Notarization, Windows Code Signing
- [ ] DMG/EXE/AppImage Packaging
- [ ] Welcome Screen & Onboarding
- **Ergebnis:** Auslieferbare App

### Gesamt: ~16–21 Tage Entwicklungszeit

---

## Risiken & Mitigations

| Risiko | Wahrscheinlichkeit | Mitigation |
|--------|-------------------|-----------|
| node-pty Build-Probleme (native C++) | Mittel | electron-rebuild, prebuild-install, Fallback: shell-only ohne PTY |
| TipTap Rendering-Unterschiede (Electron Chromium vs. VS Code Webview) | Niedrig | Beide nutzen Chromium, gleiche Engine |
| Performance bei großen Docs (Full Re-Serialize) | Niedrig-Mittel | Debouncing (bereits vorhanden), ggf. incremental updates später |
| macOS Code Signing Kosten | Sicher | Apple Developer Account: 99$/Jahr |
| Windows Code Signing Kosten | Sicher | EV Certificate: ~200-400€/Jahr, oder Azure Trusted Signing |
| Auto-Update Server | Niedrig | GitHub Releases als Update-Server (kostenlos) |
| Electron Security (nodeIntegration) | Niedrig | contextBridge + Preload Pattern (Best Practice) |

---

## Kosten

| Posten | Jährlich |
|--------|---------|
| Apple Developer Account | 99$ (~90€) |
| Windows Code Signing (EV) | ~300€ |
| GitHub (Releases als Update-Server) | Kostenlos |
| **Gesamt** | ~400€/Jahr |

---

## Fazit

Die Electron-Portierung ist **realistisch und machbar** weil:

1. **73% des Codes ist bereits plattformunabhängig** — Shared + Webview + CLI
2. **Die IPC-Grenze ist sauber definiert** — 32 Message-Typen, Adapter-Pattern macht den Swap trivial
3. **Alle Node.js Dependencies funktionieren** — docx, pdf-parse, child_process (Typst), node-pty
4. **Der TipTap/Svelte/Vite Stack ist Electron-nativ** — kein Framework-Wechsel nötig
5. **Terminal + Git sind gelöste Probleme** — node-pty, xterm.js, simple-git sind ausgereift

Die VS Code Extension bleibt als kostenloses Produkt bestehen. Die Electron-App wird das Premium-Produkt mit eigener Marke.
