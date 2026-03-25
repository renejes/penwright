# vswrite Desktop — Refactoring Plan

> **Stand:** 2026-03-25
> Detaillierter Plan zum Aufteilen der beiden Monolith-Dateien.

---

## Warum Refactoring?

| Datei | Zeilen | Problem |
|-------|--------|---------|
| `src/main/index.ts` | 1.699 | 25 Sections, alles in einer Datei: IPC, File I/O, Compiler, Git, Zotero, Menü, Filetree, Terminal, etc. |
| `src/renderer/App.svelte` | 1.067 | Layout + State + 15 Funktionen + Message Handler + Resize Logic + Template |

Beide Dateien sind zu groß um sie schnell zu verstehen, und Änderungen in einem Bereich (z.B. Git) erfordern Scrollen durch unrelated Code (z.B. Bild-Handler).

---

## Teil 1: Main Process aufteilen

### Aktuelle Struktur (src/main/index.ts — 1.699 Zeilen)

```
index.ts
├── State (Zeile 26)
├── Window Creation (38)
├── File Operations (109) — openFile, saveFile, saveFileAs, newFile
├── Typst Compiler (218) — setupCompiler
├── IPC Handlers (276) — 29 case-Statements im switch
│   ├── File Tree Handlers (591)
│   ├── Text File Handlers (652)
│   └── Includes Handlers (662)
├── Git Handlers (707) — setupGitIPC, 8 handlers
├── Auto-Save (786)
├── Export Handlers (799) — PDF, DOCX
├── New File / Project (874)
├── Zotero Integration (940)
├── Markdown Import (1009)
├── Image Handlers (1057)
├── Citations (1125)
├── Custom Style Templates (1169)
├── Preamble Stripper (1227)
├── Settings Handlers (1279)
├── Application Menu (1302)
├── File Tree (1428) — readDirTree
├── Claude Code Skills (1477)
├── Terminal (1564) — setupTerminal
├── File Watcher (1585)
└── App Lifecycle (1657)
```

### Neue Struktur (7 Dateien)

```
src/main/
├── index.ts            (~200 Zeilen) — App lifecycle, state, window creation
├── ipcHandlers.ts      (~350 Zeilen) — Switch-Statement, Message routing
├── fileManager.ts      (~250 Zeilen) — openFile, saveFile, newFile, autoSave, fileWatcher
├── menuBuilder.ts      (~150 Zeilen) — Application menu
├── gitManager.ts       (~100 Zeilen) — Git IPC handlers (aus setupGitIPC)
├── importExport.ts     (~200 Zeilen) — PDF, DOCX, Markdown, Zotero, Style Templates
├── projectManager.ts   (~200 Zeilen) — New Project, File Tree, Skills, Citations
├── typstCompiler.ts    (87 Zeilen)   — unverändert
├── terminalManager.ts  (78 Zeilen)   — unverändert
├── preload-entry.ts    (62 Zeilen)   — unverändert
└── deserializer-bridge.ts (6 Zeilen) — unverändert
```

### Aufteilung im Detail

#### index.ts (~200 Zeilen) — Bleibt als Entry Point
```typescript
// Enthält nur:
- Imports aller Module
- State-Variablen (mainWindow, currentFilePath, currentContent, etc.)
- createWindow()
- app.whenReady() Lifecycle
- app.on('window-all-closed') / app.on('open-file')
- State-Getter/Setter die andere Module brauchen
```

**Wichtig:** State wird als exportiertes Objekt bereitgestellt:
```typescript
export const appState = {
  get mainWindow() { return mainWindow; },
  get currentFilePath() { return currentFilePath; },
  set currentFilePath(v) { currentFilePath = v; },
  get currentContent() { return currentContent; },
  set currentContent(v) { currentContent = v; },
  // etc.
};
```

#### ipcHandlers.ts (~350 Zeilen) — Message Router
```typescript
// Enthält:
- setupIPC() Funktion
- Der große switch-Statement (alle 29 cases)
- Ruft Funktionen aus den anderen Modulen auf
- Dialog-Handler (openFile, saveFile, saveFileAs)
- Text File Handler (read, write)
- Includes Handler (validate, open, add)
```

#### fileManager.ts (~250 Zeilen)
```typescript
// Enthält:
- openFile()
- saveFile() / saveFileAs()
- newFile()
- autoSave() + Timer
- updateTitle()
- setupFileWatcher() / stopFileWatcher()
- stripPreamble()
```

#### menuBuilder.ts (~150 Zeilen)
```typescript
// Enthält:
- buildMenu() — komplett
- Alle Menu-Klick-Handler als Referenzen zu anderen Modulen
```

#### gitManager.ts (~100 Zeilen)
```typescript
// Enthält:
- setupGitIPC() — alle 8 git:* Handler
- getGitDir() Helper
```

#### importExport.ts (~200 Zeilen)
```typescript
// Enthält:
- handleExportPdf()
- handleExportDocx()
- handleImportMarkdown()
- handleImportStyleTemplate()
- handleLinkZotero() + zoteroWatcher
```

#### projectManager.ts (~200 Zeilen)
```typescript
// Enthält:
- handleCreateProject()
- readDirTree() + FileEntry Interface
- handleRequestCitations()
- handlePickImage() / handleDropImage() / handleDropImagePath()
- ensureClaudeSkills()
- handleRequestSettings() / handleUpdateSettings()
```

### Migrations-Strategie

**Schritt für Schritt, nicht alles auf einmal:**

1. **State-Objekt erstellen** — `appState` in index.ts exportieren
2. **menuBuilder.ts** extrahieren (am einfachsten, keine Abhängigkeiten)
3. **gitManager.ts** extrahieren
4. **importExport.ts** extrahieren
5. **projectManager.ts** extrahieren
6. **fileManager.ts** extrahieren
7. **ipcHandlers.ts** extrahieren (zuletzt, weil es alles andere aufruft)
8. **index.ts** aufräumen

**Nach jedem Schritt:** Build + Start Test. Kein Big-Bang Refactoring.

---

## Teil 2: App.svelte aufteilen

### Aktuelle Struktur (src/renderer/App.svelte — 1.067 Zeilen)

```
App.svelte
├── Script (Zeile 1-460)
│   ├── Imports (1-22)
│   ├── Editor State (29-35)
│   ├── UI State (36-47)
│   ├── Panel State (48-56)
│   ├── Preview State (57-62)
│   ├── Tab / File State (63-108)
│   ├── Resize State (120-130)
│   ├── vscodeBridge (132-138)
│   ├── onMount (135-190) — Editor init, IPC listener, Drag & Drop
│   ├── Editor Functions (191-237) — scrollCursorToCenter, sendUpdate, settings, etc.
│   ├── handleGlobalKeydown (238-265)
│   ├── handleMessage (266-380) — alle ExtensionMessage Handler
│   ├── File/Tab Functions (386-410) — handleFileOpen, contextMenu
│   ├── scrollToHeading (410-430)
│   ├── Resize Handlers (433-455)
│   └── onDestroy (455-460)
├── Template (462-710) — 250 Zeilen HTML
└── Style (712-1067) — 355 Zeilen CSS
```

### Neue Struktur

```
src/renderer/
├── App.svelte           (~400 Zeilen) — Template + lokale Styles
├── appState.svelte.ts   (~80 Zeilen)  — Alle $state/$derived in einem Svelte Modul
├── messageHandler.ts    (~120 Zeilen) — handleMessage Funktion
├── tabManager.ts        (~50 Zeilen)  — openTab, closeTab, switchToTab
├── resizeManager.ts     (~40 Zeilen)  — Resize-Handler
├── main.ts              (9 Zeilen)    — unverändert
└── components/          — unverändert (schon gut aufgeteilt)
```

### Aufteilung im Detail

#### appState.svelte.ts (~80 Zeilen)
```typescript
// Svelte 5 Modul mit reaktivem State
// Alle $state Variablen die von mehreren Funktionen gebraucht werden

export const editorState = $state({
  editor: null as Editor | null,
  editorVersion: 0,
  currentFile: '',
  currentContent: '',
  isSaved: true,
  lastSaveTime: '',
});

export const panelState = $state({
  showSidebar: true,
  showPreview: false,
  showTerminal: false,
  sidebarTab: 'files' as 'files' | 'outline' | 'includes' | 'git',
  sidebarWidth: 220,
  previewWidth: 400,
  terminalHeight: 200,
});

export const uiState = $state({
  showShortcuts: false,
  showSettings: false,
  showSearch: false,
  showQuickSettings: false,
  focusMode: false,
  typewriterMode: false,
  showWelcome: false,
  showNewProjectDialog: false,
});
// etc.
```

**Hinweis:** Svelte 5 erlaubt `.svelte.ts` Dateien für reaktiven State außerhalb von Components.

#### messageHandler.ts (~120 Zeilen)
```typescript
// Die handleMessage Funktion, extrahiert aus App.svelte
// Importiert appState und ruft die nötigen Funktionen auf
export function handleMessage(message: ExtensionMessage): void { ... }
```

#### tabManager.ts (~50 Zeilen)
```typescript
export function openTab(...) { ... }
export function closeTab(...) { ... }
export function switchToTab(...) { ... }
```

### Migrations-Strategie

1. **appState.svelte.ts** erstellen, State-Variablen verschieben
2. **messageHandler.ts** extrahieren
3. **tabManager.ts** + **resizeManager.ts** extrahieren
4. **App.svelte** aufräumen — nur Template + lokale Wiring

**Nach jedem Schritt:** Build + Start Test.

---

## Reihenfolge der Durchführung

| Schritt | Datei | Was | Risiko |
|---------|-------|-----|--------|
| 1 | `menuBuilder.ts` | Menü aus index.ts extrahieren | Niedrig |
| 2 | `gitManager.ts` | Git Handler extrahieren | Niedrig |
| 3 | `importExport.ts` | Export/Import Funktionen extrahieren | Niedrig |
| 4 | `projectManager.ts` | Projekt/Tree/Citations extrahieren | Mittel |
| 5 | `fileManager.ts` | File I/O + Watcher extrahieren | Mittel |
| 6 | `ipcHandlers.ts` | Switch-Statement extrahieren | Hoch |
| 7 | `appState.svelte.ts` | Renderer State extrahieren | Mittel |
| 8 | `messageHandler.ts` | Message Handler extrahieren | Mittel |
| 9 | Finale Aufräumung | Imports, unused Code, Types | Niedrig |

**Geschätzte Zeit:** ~2-3 Stunden für alles, wenn schrittweise.

---

## Regeln beim Refactoring

1. **Keine Feature-Änderungen** — nur Code verschieben
2. **Build + Start nach jedem Schritt** — kein Big-Bang
3. **Gleiche Funktionsnamen beibehalten** — keine Umbenennungen
4. **State-Sharing über Getter/Setter** — kein globaler State
5. **Circular Dependencies vermeiden** — klare Abhängigkeitsrichtung:
   ```
   index.ts → ipcHandlers → fileManager, projectManager, etc.
   ```
6. **Types in eigener Datei** wenn sie von mehreren Modulen gebraucht werden
