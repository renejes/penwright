/**
 * vswrite Desktop — Electron Main Process
 *
 * Manages windows, file I/O, Typst compilation, and IPC with the renderer.
 */

import { app, BrowserWindow, ipcMain, dialog, Menu, shell } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { deserializeTypst } from './deserializer-bridge';
import { TypstCompiler } from './typstCompiler';

// ─── State ────────────────────────────────────────────

let mainWindow: BrowserWindow | null = null;
let currentFilePath: string | null = null;
let currentContent: string = '';
let isDirty: boolean = false;
let compiler: TypstCompiler | null = null;

// ─── Window Creation ──────────────────────────────────

function createWindow(): void {
  mainWindow = new BrowserWindow({
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

  // Load renderer — electron-vite sets ELECTRON_RENDERER_URL in dev mode
  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('close', async (e) => {
    if (isDirty) {
      e.preventDefault();
      const result = await dialog.showMessageBox(mainWindow!, {
        type: 'warning',
        buttons: ['Save', "Don't Save", 'Cancel'],
        defaultId: 0,
        message: 'You have unsaved changes.',
        detail: 'Do you want to save before closing?',
      });
      if (result.response === 0) {
        await saveFile();
        mainWindow?.destroy();
      } else if (result.response === 1) {
        mainWindow?.destroy();
      }
      // Cancel — do nothing
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    compiler?.dispose();
    compiler = null;
  });

  updateTitle();
}

function updateTitle(): void {
  if (!mainWindow) return;
  const fileName = currentFilePath ? path.basename(currentFilePath) : 'Untitled';
  const dirtyMark = isDirty ? ' •' : '';
  mainWindow.setTitle(`${fileName}${dirtyMark} — vswrite`);
}

// ─── File Operations ──────────────────────────────────

async function openFile(filePath?: string): Promise<void> {
  if (!filePath) {
    const result = await dialog.showOpenDialog(mainWindow!, {
      filters: [{ name: 'Typst Files', extensions: ['typ'] }],
      properties: ['openFile'],
    });
    if (result.canceled || result.filePaths.length === 0) return;
    filePath = result.filePaths[0];
  }

  try {
    currentContent = fs.readFileSync(filePath, 'utf-8');
    currentFilePath = filePath;
    isDirty = false;
    updateTitle();

    // Send content to renderer
    const doc = deserializeTypst(currentContent);
    mainWindow?.webContents.send('vswrite', {
      type: 'update',
      content: currentContent,
    });

    // Start compiler for this file
    setupCompiler();

    // Send base directory for image resolution
    mainWindow?.webContents.send('vswrite', {
      type: 'documentBaseUri',
      uri: path.dirname(currentFilePath),
    });
  } catch (err) {
    dialog.showErrorBox(
      'Could not open file',
      `${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

async function saveFile(): Promise<boolean> {
  if (!currentFilePath) {
    return saveFileAs();
  }

  try {
    fs.writeFileSync(currentFilePath, currentContent, 'utf-8');
    isDirty = false;
    updateTitle();
    compiler?.compile();
    return true;
  } catch (err) {
    dialog.showErrorBox(
      'Could not save file',
      `${err instanceof Error ? err.message : String(err)}`,
    );
    return false;
  }
}

async function saveFileAs(): Promise<boolean> {
  const result = await dialog.showSaveDialog(mainWindow!, {
    filters: [{ name: 'Typst Files', extensions: ['typ'] }],
    defaultPath: currentFilePath || 'document.typ',
  });

  if (result.canceled || !result.filePath) return false;

  currentFilePath = result.filePath;
  return saveFile();
}

function newFile(): void {
  currentFilePath = null;
  currentContent = '';
  isDirty = false;
  updateTitle();

  mainWindow?.webContents.send('vswrite', {
    type: 'update',
    content: '',
  });
}

// ─── Typst Compiler ───────────────────────────────────

function setupCompiler(): void {
  compiler?.dispose();

  if (!currentFilePath) return;

  compiler = new TypstCompiler(currentFilePath);

  compiler.on('compiled', (pages: string[]) => {
    mainWindow?.webContents.send('vswrite', {
      type: 'previewUpdate',
      pages,
    });
  });

  compiler.on('error', (diagnostics: unknown[]) => {
    mainWindow?.webContents.send('vswrite', {
      type: 'compileError',
      diagnostics,
    });
  });

  compiler.compile();
}

// ─── IPC Handlers ─────────────────────────────────────

function setupIPC(): void {
  // Renderer sends edited content
  ipcMain.on('vswrite', (_event, msg: { type: string; [key: string]: unknown }) => {
    switch (msg.type) {
      case 'ready': {
        // Renderer is ready — send current content if we have a file
        if (currentContent) {
          mainWindow?.webContents.send('vswrite', {
            type: 'update',
            content: currentContent,
          });
          if (currentFilePath) {
            mainWindow?.webContents.send('vswrite', {
              type: 'documentBaseUri',
              uri: path.dirname(currentFilePath),
            });
          }
        }
        break;
      }

      case 'edit': {
        const content = msg.content as string;
        if (content !== currentContent) {
          currentContent = content;
          isDirty = true;
          updateTitle();
          // Auto-save after short delay
          autoSave();
        }
        break;
      }

      case 'exportPdf': {
        handleExportPdf();
        break;
      }

      case 'exportDocx': {
        handleExportDocx();
        break;
      }

      case 'requestSettings': {
        handleRequestSettings();
        break;
      }

      case 'updateSettings': {
        handleUpdateSettings(msg.settings as Record<string, string>);
        break;
      }

      case 'openUserGuide': {
        // TODO: Open user guide
        break;
      }

      case 'dismissWelcome': {
        // TODO: Persist with electron-store
        break;
      }
    }
  });

  // Dialog handlers
  ipcMain.handle('dialog:openFile', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      filters: [{ name: 'Typst Files', extensions: ['typ'] }],
      properties: ['openFile'],
    });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle('dialog:saveFile', async (_event, defaultName: string) => {
    const result = await dialog.showSaveDialog(mainWindow!, {
      defaultPath: defaultName,
      filters: [{ name: 'Typst Files', extensions: ['typ'] }],
    });
    return result.canceled ? null : result.filePath;
  });

  ipcMain.handle('dialog:saveFileAs', async (_event, defaultName: string, filters: unknown) => {
    const result = await dialog.showSaveDialog(mainWindow!, {
      defaultPath: defaultName,
      filters: filters as Electron.FileFilter[],
    });
    return result.canceled ? null : result.filePath;
  });

  ipcMain.handle('app:getPlatform', () => process.platform);
}

// ─── Auto-Save ────────────────────────────────────────

let autoSaveTimer: NodeJS.Timeout | null = null;

function autoSave(): void {
  if (autoSaveTimer) clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(() => {
    if (isDirty && currentFilePath) {
      saveFile();
    }
  }, 1000);
}

// ─── Export Handlers ──────────────────────────────────

async function handleExportPdf(): Promise<void> {
  if (!currentFilePath) {
    dialog.showErrorBox('Export failed', 'Please save the file first.');
    return;
  }

  // Ensure latest content is saved
  await saveFile();

  const defaultPath = currentFilePath.replace(/\.typ$/, '.pdf');
  const result = await dialog.showSaveDialog(mainWindow!, {
    defaultPath,
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
  });

  if (result.canceled || !result.filePath) return;

  const { execSync } = require('child_process');
  try {
    execSync(`typst compile "${currentFilePath}" "${result.filePath}"`);
    const choice = await dialog.showMessageBox(mainWindow!, {
      type: 'info',
      buttons: ['Open PDF', 'OK'],
      message: `PDF exported to ${path.basename(result.filePath)}`,
    });
    if (choice.response === 0) {
      shell.openPath(result.filePath);
    }
  } catch (err) {
    dialog.showErrorBox(
      'PDF export failed',
      `${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

async function handleExportDocx(): Promise<void> {
  if (!currentFilePath) {
    dialog.showErrorBox('Export failed', 'Please save the file first.');
    return;
  }

  await saveFile();

  const defaultPath = currentFilePath.replace(/\.typ$/, '.docx');
  const result = await dialog.showSaveDialog(mainWindow!, {
    defaultPath,
    filters: [{ name: 'Word Document', extensions: ['docx'] }],
  });

  if (result.canceled || !result.filePath) return;

  try {
    const { serializeDocx } = await import('../shared/docxSerializer');
    const doc = deserializeTypst(currentContent);
    const docDir = path.dirname(currentFilePath);
    const buffer = await serializeDocx(doc, docDir, currentContent);
    fs.writeFileSync(result.filePath, buffer);

    const choice = await dialog.showMessageBox(mainWindow!, {
      type: 'info',
      buttons: ['Open DOCX', 'OK'],
      message: `DOCX exported to ${path.basename(result.filePath)}`,
    });
    if (choice.response === 0) {
      shell.openPath(result.filePath);
    }
  } catch (err) {
    dialog.showErrorBox(
      'DOCX export failed',
      `${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

// ─── Settings Handlers ────────────────────────────────

function handleRequestSettings(): void {
  const { parseSettings } = require('../shared/settingsParser');
  const settings = parseSettings(currentContent);
  mainWindow?.webContents.send('vswrite', {
    type: 'settingsData',
    settings,
  });
}

function handleUpdateSettings(settings: Record<string, string>): void {
  const { applySettings } = require('../shared/settingsParser');
  currentContent = applySettings(currentContent, settings);
  isDirty = true;
  updateTitle();
  autoSave();

  // Send updated content to renderer
  mainWindow?.webContents.send('vswrite', {
    type: 'update',
    content: currentContent,
  });
}

// ─── Application Menu ─────────────────────────────────

function buildMenu(): void {
  const isMac = process.platform === 'darwin';

  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' as const },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const },
            ],
          },
        ]
      : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'New',
          accelerator: 'CmdOrCtrl+N',
          click: () => newFile(),
        },
        {
          label: 'Open…',
          accelerator: 'CmdOrCtrl+O',
          click: () => openFile(),
        },
        { type: 'separator' },
        {
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          click: () => saveFile(),
        },
        {
          label: 'Save As…',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => saveFileAs(),
        },
        { type: 'separator' },
        {
          label: 'Export as PDF…',
          click: () => handleExportPdf(),
        },
        {
          label: 'Export as DOCX…',
          click: () => handleExportDocx(),
        },
        { type: 'separator' },
        isMac ? { role: 'close' as const } : { role: 'quit' as const },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'User Guide',
          click: () => {
            shell.openExternal('https://github.com/renejes/vswrite');
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// ─── App Lifecycle ────────────────────────────────────

app.whenReady().then(() => {
  buildMenu();
  setupIPC();
  createWindow();

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
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// macOS: open file via Finder double-click
app.on('open-file', (_event, filePath) => {
  if (mainWindow) {
    openFile(filePath);
  }
});
