/**
 * Penwright — Electron Main Process (Entry Point)
 *
 * Slim entry point: creates the window, wires up modules, manages lifecycle.
 * All logic is delegated to extracted modules.
 */

import { app, BrowserWindow, ipcMain, dialog, protocol, net, Menu } from 'electron';
import * as path from 'path';
import { appState } from './appState';
import { buildMenu } from './menuBuilder';
import { setupIPC } from './ipcHandlers';
import { setupGitIPC } from './gitManager';
import { openFile, saveFile, saveFileAs, closeProjectInteractive, stopFileWatcher, disposeCompiler } from './fileManager';
import { openProject } from './projectManager';
import { releaseLock } from './lockManager';
import { getWindowBounds, saveWindowBounds, getLocale, getMcpTarget, setMcpTarget } from './persistenceManager';
import { ensureMcpTarget, probeMetaMcp } from './mcpRegistration';
import { resolveDict } from '../shared/i18n';
import { handleExportPdf, handleExportDocx, handleImportMarkdown, handleLinkZotero, getZoteroWatcher } from './importExport';
import { isPathWithin } from './pathSecurity';
import { getTypstFontPath } from './typstPath';
import { setupCrashCapture, addBreadcrumb } from './crashReporter';

// Set up crash capture as the very first thing so even early-startup
// errors land in a report. This installs uncaughtException /
// unhandledRejection handlers and starts Electron's native crash dumper.
// Brand name — drives the macOS app menu and the "About" label in dev and prod.
app.setName('Penwright');

setupCrashCapture();

// ─── Window Creation ──────────────────────────────────

function createWindow(): void {
  const bounds = getWindowBounds();
  appState.mainWindow = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    minWidth: 800,
    minHeight: 500,
    title: 'Penwright',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    trafficLightPosition: { x: 15, y: 15 },
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload-entry.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (process.env['ELECTRON_RENDERER_URL']) {
    appState.mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    appState.mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  if (bounds.isMaximized) {
    appState.mainWindow.maximize();
  }

  appState.mainWindow.on('close', async (e) => {
    // Save window bounds before closing
    if (appState.mainWindow) {
      const isMaximized = appState.mainWindow.isMaximized();
      const windowBounds = appState.mainWindow.getBounds();
      saveWindowBounds({
        x: windowBounds.x,
        y: windowBounds.y,
        width: windowBounds.width,
        height: windowBounds.height,
        isMaximized,
      });
    }
    if (appState.isDirty) {
      e.preventDefault();
      const md = resolveDict(getLocale()).mainDialogs;
      const result = await dialog.showMessageBox(appState.mainWindow!, {
        type: 'warning',
        buttons: [md.save, md.dontSave, md.cancel],
        defaultId: 0,
        message: md.unsavedChangesMessage,
        detail: md.unsavedChangesQuitDetail,
      });
      if (result.response === 0) {
        await saveFile();
        appState.mainWindow?.destroy();
      } else if (result.response === 1) {
        appState.mainWindow?.destroy();
      }
    }
  });

  appState.mainWindow.on('closed', () => {
    appState.mainWindow = null;
    releaseLock();
    disposeCompiler();
  });

  appState.mainWindow.webContents.on('will-navigate', (e) => {
    e.preventDefault();
  });

  appState.mainWindow.webContents.setWindowOpenHandler(() => {
    return { action: 'deny' };
  });

  // ─── Spellcheck Setup ───────────────────────────
  appState.mainWindow.webContents.session.setSpellCheckerLanguages(['en-US']);

  appState.mainWindow.webContents.on('context-menu', (_event, params) => {
    const menuItems: Electron.MenuItemConstructorOptions[] = [];

    // Spelling suggestions
    if (params.misspelledWord) {
      for (const suggestion of params.dictionarySuggestions.slice(0, 5)) {
        menuItems.push({
          label: suggestion,
          click: () => appState.mainWindow?.webContents.replaceMisspelling(suggestion),
        });
      }
      if (params.dictionarySuggestions.length === 0) {
        menuItems.push({ label: 'No suggestions', enabled: false });
      }
      menuItems.push({ type: 'separator' });
      menuItems.push({
        label: 'Add to Dictionary',
        click: () => appState.mainWindow?.webContents.session.addWordToSpellCheckerDictionary(params.misspelledWord),
      });
      menuItems.push({ type: 'separator' });
    }

    // "Design after writing" — pin the selection and hand it to Claude.
    // Only meaningful when there's a selection; the renderer captures the
    // anchor + design snapshot and flips the sidebar to the Design tab.
    if (params.selectionText && params.selectionText.trim().length > 0) {
      menuItems.push({
        label: '✨ Design with AI',
        click: () => appState.mainWindow?.webContents.send('penwright', { type: 'designSelection' }),
      });
      menuItems.push({ type: 'separator' });
    }

    // Standard edit actions
    menuItems.push(
      { label: 'Cut', role: 'cut', enabled: params.editFlags.canCut },
      { label: 'Copy', role: 'copy', enabled: params.editFlags.canCopy },
      { label: 'Paste', role: 'paste', enabled: params.editFlags.canPaste },
    );

    if (menuItems.length > 0) {
      Menu.buildFromTemplate(menuItems).popup();
    }
  });

  // Set initial title
  const fileName = appState.currentFilePath ? path.basename(appState.currentFilePath) : 'Untitled';
  appState.mainWindow.setTitle(`${fileName} — Penwright`);
}

// ─── MCP registration on boot ─────────────────────────

/**
 * Re-establish the chosen MCP registration target every launch, idempotently.
 *
 *   - `--mcp-target=meta|claude` CLI flag overrides + persists the choice.
 *   - A persisted target is re-applied (register it, deregister the other).
 *   - With no choice yet, a sensible default is applied (Meta-MCP if reachable,
 *     else Claude Code) WITHOUT persisting — leaving `null` so the connection
 *     dialog still offers the explicit choice on first run.
 *
 * Fire-and-forget: never blocks startup, never throws into the lifecycle.
 */
async function initMcpRegistration(): Promise<void> {
  try {
    const flag = process.argv.find((a) => a.startsWith('--mcp-target='));
    if (flag) {
      const value = flag.slice('--mcp-target='.length);
      if (value === 'meta' || value === 'claude') setMcpTarget(value);
    }
    const persisted = getMcpTarget();
    const effective = persisted ?? ((await probeMetaMcp()) ? 'meta' : 'claude');
    const res = await ensureMcpTarget(effective);
    addBreadcrumb('mcp', `boot ensure ${effective}: ok=${res.ok}${res.meta.error ? ` meta=${res.meta.error}` : ''}`);
  } catch (err) {
    console.warn('[penwright] MCP registration init failed:', err);
  }
}

// ─── Wire up appState callbacks ───────────────────────

appState.openFile = openFile;
appState.saveFile = saveFile;
appState.saveFileAs = saveFileAs;
appState.closeProject = closeProjectInteractive;
appState.openProject = async () => { await openProject(); };
appState.handleExportPdf = handleExportPdf;
appState.handleExportDocx = handleExportDocx;
appState.handleImportMarkdown = handleImportMarkdown;
appState.handleLinkZotero = handleLinkZotero;

// ─── App Lifecycle ────────────────────────────────────

app.whenReady().then(() => {
  // Register protocol handler for local asset files (images etc.)
  protocol.handle('penwright-asset', (request) => {
    const filePath = decodeURIComponent(request.url.replace('penwright-asset://', ''));

    // Only allow files within the current project directory (symlink-aware)
    const projectRoot = appState.projectDir || (appState.currentFilePath ? path.dirname(appState.currentFilePath) : null);
    if (!projectRoot || !isPathWithin(filePath, projectRoot)) {
      return new Response('Forbidden', { status: 403 });
    }

    return net.fetch(`file://${path.resolve(filePath)}`);
  });

  // ─── Bundled fonts protocol ─────────────────────────
  // `penwright-font://<Family>/<file>.ttf` resolves to the bundled OFL fonts
  // shipped under resources/fonts/. The Design panel @font-face-loads them
  // for live preview without copying the binary across the IPC boundary.
  // Path validation: the request must resolve inside the bundled font
  // directory; anything else is forbidden so a compromised renderer can't
  // read arbitrary files via this protocol.
  protocol.handle('penwright-font', (request) => {
    const requested = decodeURIComponent(request.url.replace('penwright-font://', ''));
    const fontRoot = getTypstFontPath();
    if (!fontRoot) return new Response('Not configured', { status: 404 });
    const resolved = path.resolve(fontRoot, requested);
    if (!resolved.startsWith(fontRoot + path.sep) && resolved !== fontRoot) {
      return new Response('Forbidden', { status: 403 });
    }
    return net.fetch(`file://${resolved}`);
  });

  buildMenu(appState);
  setupIPC();
  createWindow();
  setupGitIPC();
  addBreadcrumb('lifecycle', 'window created');

  // Register this app's MCP server with the chosen host (Meta-MCP or Claude
  // Code), idempotently. Runs in the background so it never delays the UI.
  void initMcpRegistration();

  // Open project from command-line arg if a .typ file path was passed
  // (e.g. "Open With Penwright" from Finder). The parent folder becomes the
  // project. We deliberately do NOT auto-reopen the last project on startup —
  // the app always starts at the StartScreen.
  const fileArg = process.argv.find((arg) => arg.endsWith('.typ'));
  if (fileArg) {
    const absPath = path.resolve(fileArg);
    appState.projectDir = path.dirname(absPath);
    openFile(absPath);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  releaseLock();
  stopFileWatcher();
  getZoteroWatcher()?.close();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// macOS: open file via Finder double-click — treat parent folder as project.
app.on('open-file', (_event, filePath) => {
  if (!appState.mainWindow) return;
  appState.projectDir = path.dirname(filePath);
  openFile(filePath);
});
