/**
 * vswrite Desktop — Electron Main Process (Entry Point)
 *
 * Slim entry point: creates the window, wires up modules, manages lifecycle.
 * All logic is delegated to extracted modules.
 */

import { app, BrowserWindow, ipcMain, dialog, protocol, net, Menu } from 'electron';
import * as path from 'path';
import { appState } from './appState';
import { TerminalManager } from './terminalManager';
import { buildMenu } from './menuBuilder';
import { setupIPC } from './ipcHandlers';
import { setupGitIPC } from './gitManager';
import { openFile, saveFile, saveFileAs, newFile, stopFileWatcher, disposeCompiler, setupPreviewModeIPC } from './fileManager';
import { handleExportPdf, handleExportDocx, handleImportMarkdown, handleLinkZotero, getZoteroWatcher } from './importExport';

// ─── Window Creation ──────────────────────────────────

function createWindow(): void {
  appState.mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 500,
    title: 'vswrite',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    trafficLightPosition: { x: 15, y: 15 },
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload-entry.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (process.env['ELECTRON_RENDERER_URL']) {
    appState.mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    appState.mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  appState.mainWindow.on('close', async (e) => {
    if (appState.isDirty) {
      e.preventDefault();
      const result = await dialog.showMessageBox(appState.mainWindow!, {
        type: 'warning',
        buttons: ['Save', "Don't Save", 'Cancel'],
        defaultId: 0,
        message: 'You have unsaved changes.',
        detail: 'Do you want to save before closing?',
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
  appState.mainWindow.setTitle(`${fileName} — vswrite`);
}

// ─── Terminal Setup ───────────────────────────────────

function setupTerminal(): void {
  if (!appState.mainWindow) return;

  appState.terminal = new TerminalManager(appState.mainWindow);

  ipcMain.on('terminal:input', (_event, data: string) => {
    appState.terminal?.write(data);
  });

  ipcMain.on('terminal:resize', (_event, size: { cols: number; rows: number }) => {
    appState.terminal?.resize(size.cols, size.rows);
  });

  ipcMain.on('terminal:create', () => {
    const cwd = appState.projectDir || (appState.currentFilePath ? path.dirname(appState.currentFilePath) : process.env.HOME || '/');
    appState.terminal?.spawn(cwd);
  });
}

// ─── Wire up appState callbacks ───────────────────────

appState.newFile = newFile;
appState.openFile = openFile;
appState.saveFile = saveFile;
appState.saveFileAs = saveFileAs;
appState.handleExportPdf = handleExportPdf;
appState.handleExportDocx = handleExportDocx;
appState.handleImportMarkdown = handleImportMarkdown;
appState.handleLinkZotero = handleLinkZotero;

// ─── App Lifecycle ────────────────────────────────────

app.whenReady().then(() => {
  // Register protocol handler for local asset files (images etc.)
  protocol.handle('vswrite-asset', (request) => {
    const filePath = decodeURIComponent(request.url.replace('vswrite-asset://', ''));
    return net.fetch(`file://${filePath}`);
  });

  buildMenu(appState);
  setupIPC();
  setupPreviewModeIPC();
  createWindow();
  setupTerminal();
  setupGitIPC();

  // Open file from command line args
  const fileArg = process.argv.find((arg) => arg.endsWith('.typ'));
  if (fileArg) {
    openFile(path.resolve(fileArg));
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  appState.terminal?.dispose();
  stopFileWatcher();
  getZoteroWatcher()?.close();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// macOS: open file via Finder double-click
app.on('open-file', (_event, filePath) => {
  if (appState.mainWindow) {
    openFile(filePath);
  }
});
