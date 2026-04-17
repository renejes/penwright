/**
 * File Manager — extracted from index.ts
 * File I/O, Auto-Save, Compiler Setup, File Watcher, Preamble Stripper
 */

import { dialog, ipcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { watch, type FSWatcher } from 'chokidar';
import { findRootFile } from '../shared/rootFinder';
import { parseSettings } from '../shared/settingsParser';
import { TypstCompiler } from './typstCompiler';
import { appState } from './appState';
import { checkLock, acquireLock, releaseLock } from './lockManager';
import { addRecentProject, saveLastProjectPath, saveBackup, clearBackup, checkForRecovery, readBackup } from './persistenceManager';

let compiler: TypstCompiler | null = null;
let fileWatcher: FSWatcher | null = null;
let autoSaveTimer: NodeJS.Timeout | null = null;
let previewMode: 'svg' | 'pdf' = 'svg';

// ─── AI Edit Snapshots ───────────────────────────────
// Ring buffer that captures editor state before each external file change,
// so the user can undo AI-driven edits (terminal / MCP).

const MAX_AI_SNAPSHOTS = 20;
const aiSnapshots: Array<{ filePath: string; content: string; timestamp: number }> = [];

function pushAiSnapshot(filePath: string, content: string): void {
  aiSnapshots.push({ filePath, content, timestamp: Date.now() });
  if (aiSnapshots.length > MAX_AI_SNAPSHOTS) aiSnapshots.shift();
  appState.mainWindow?.webContents.send('vswrite', {
    type: 'aiSnapshotCount',
    count: aiSnapshots.filter(s => s.filePath === appState.currentFilePath).length,
  });
}

export function popAiSnapshot(): boolean {
  // Find the most recent snapshot for the current file
  for (let i = aiSnapshots.length - 1; i >= 0; i--) {
    if (aiSnapshots[i].filePath === appState.currentFilePath) {
      const snapshot = aiSnapshots.splice(i, 1)[0];
      appState.currentContent = snapshot.content;
      appState.isDirty = true;
      updateTitle();
      // Write back to disk so the file watcher doesn't re-trigger
      if (appState.currentFilePath) {
        appState.lastSaveTimestamp = Date.now();
        fs.writeFileSync(appState.currentFilePath, snapshot.content, 'utf-8');
      }
      appState.mainWindow?.webContents.send('vswrite', {
        type: 'update',
        content: appState.currentContent,
      });
      appState.mainWindow?.webContents.send('vswrite', {
        type: 'aiSnapshotCount',
        count: aiSnapshots.filter(s => s.filePath === appState.currentFilePath).length,
      });
      if (previewMode === 'pdf') {
        compiler?.compilePdf();
      } else {
        compiler?.compile();
      }
      return true;
    }
  }
  return false;
}

// ─── File Operations ──────────────────────────────────

export async function openFile(filePath?: string): Promise<void> {
  if (!filePath) {
    const result = await dialog.showOpenDialog(appState.mainWindow!, {
      filters: [{ name: 'Typst Files', extensions: ['typ'] }],
      properties: ['openFile'],
    });
    if (result.canceled || result.filePaths.length === 0) return;
    filePath = result.filePaths[0];
  }

  // Check for file lock (shared folder collaboration)
  if (filePath.endsWith('.typ')) {
    const existingLock = checkLock(filePath);
    if (existingLock) {
      const result = await dialog.showMessageBox(appState.mainWindow!, {
        type: 'warning',
        buttons: ['Open Read-Only', 'Open Anyway', 'Cancel'],
        defaultId: 0,
        title: 'File is locked',
        message: `This file is being edited by ${existingLock.user} on ${existingLock.machine}.`,
        detail: 'Opening it simultaneously may cause conflicts if your project is in a shared folder (Dropbox, iCloud, etc.).',
      });
      if (result.response === 2) return; // Cancel
      if (result.response === 0) {
        // Read-only: open but don't acquire lock
      } else {
        // Open Anyway: acquire lock (override)
        acquireLock(filePath);
      }
    } else {
      acquireLock(filePath);
    }
  }

  try {
    appState.currentContent = await fs.promises.readFile(filePath, 'utf-8');
    appState.currentFilePath = filePath;
    if (!appState.projectDir) {
      appState.projectDir = path.dirname(filePath);
    }

    // Check for crash recovery backup
    const recovery = checkForRecovery(filePath);
    if (recovery) {
      const result = await dialog.showMessageBox(appState.mainWindow!, {
        type: 'question',
        buttons: ['Recover', 'Discard Backup'],
        defaultId: 0,
        title: 'Unsaved changes found',
        message: 'A backup with unsaved changes was found for this file.',
        detail: `Last backup: ${new Date(recovery.timestamp).toLocaleString()}\n\nWould you like to recover the backup?`,
      });
      if (result.response === 0) {
        appState.currentContent = readBackup(recovery.backupPath);
        appState.isDirty = true;
      } else {
        clearBackup(filePath);
      }
    }

    if (!appState.isDirty) {
      appState.isDirty = false;
    }
    updateTitle();

    appState.mainWindow?.webContents.send('vswrite', {
      type: 'documentBaseUri',
      uri: path.dirname(appState.currentFilePath),
    });

    appState.mainWindow?.webContents.send('vswrite', {
      type: 'update',
      content: appState.currentContent,
    });

    // Sync spellcheck language from document settings
    const settings = parseSettings(appState.currentContent);
    if (settings.lang) {
      const bcp47Map: Record<string, string> = {
        en: 'en-US', de: 'de-DE', fr: 'fr-FR', es: 'es-ES', it: 'it-IT',
        pt: 'pt-BR', nl: 'nl-NL', sv: 'sv-SE', da: 'da-DK', nb: 'nb-NO',
        fi: 'fi-FI', pl: 'pl-PL', ru: 'ru-RU',
      };
      const resolved = bcp47Map[settings.lang] || settings.lang;
      try {
        appState.mainWindow?.webContents.session.setSpellCheckerLanguages([resolved]);
      } catch (err) {
        console.warn('[vswrite] Spellcheck language not available:', resolved, err);
      }
    }

    setupCompiler();

    appState.mainWindow?.webContents.send('vswrite', {
      type: 'currentFile',
      path: appState.currentFilePath,
    });

    appState.mainWindow?.webContents.send('vswrite', { type: 'filetreeChanged' });

    // Auto-load citations (lazy import to avoid circular deps)
    const { handleRequestCitations } = await import('./importExport');
    handleRequestCitations();

    setupFileWatcher();

    // Persist for recent projects + auto-reopen
    addRecentProject(appState.currentFilePath, path.basename(appState.currentFilePath));
    saveLastProjectPath(appState.currentFilePath);
  } catch (err) {
    dialog.showErrorBox(
      'Could not open file',
      `${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export async function saveFile(): Promise<boolean> {
  if (!appState.currentFilePath) {
    return saveFileAs();
  }

  try {
    appState.lastSaveTimestamp = Date.now();
    await fs.promises.writeFile(appState.currentFilePath, appState.currentContent, 'utf-8');
    clearBackup(appState.currentFilePath);
    appState.isDirty = false;
    updateTitle();
    if (previewMode === 'pdf') {
      compiler?.compilePdf();
    } else {
      compiler?.compile();
    }
    appState.mainWindow?.webContents.send('vswrite', {
      type: 'saveStatus',
      saved: true,
      file: appState.currentFilePath,
    });
    return true;
  } catch (err) {
    dialog.showErrorBox(
      'Could not save file',
      `${err instanceof Error ? err.message : String(err)}`,
    );
    return false;
  }
}

export async function saveFileAs(): Promise<boolean> {
  const result = await dialog.showSaveDialog(appState.mainWindow!, {
    filters: [{ name: 'Typst Files', extensions: ['typ'] }],
    defaultPath: appState.currentFilePath || 'document.typ',
  });

  if (result.canceled || !result.filePath) return false;

  appState.currentFilePath = result.filePath;
  return saveFile();
}

export function newFile(): void {
  releaseLock();
  appState.currentFilePath = null;
  appState.currentContent = '';
  appState.isDirty = false;
  updateTitle();

  appState.mainWindow?.webContents.send('vswrite', {
    type: 'update',
    content: '',
  });
}

export function updateTitle(): void {
  if (!appState.mainWindow) return;
  const fileName = appState.currentFilePath ? path.basename(appState.currentFilePath) : 'Untitled';
  const dirtyMark = appState.isDirty ? ' •' : '';
  appState.mainWindow.setTitle(`${fileName}${dirtyMark} — vswrite`);
}

// ─── Typst Compiler ───────────────────────────────────

function setupCompiler(): void {
  compiler?.dispose();

  if (!appState.currentFilePath) return;

  const rootFile = findRootFile(appState.currentFilePath);
  const isChapter = rootFile !== appState.currentFilePath;

  compiler = new TypstCompiler(rootFile);

  compiler.on('compiled', (pages: string[]) => {
    let scrollToPage = 0;
    if (isChapter && appState.currentFilePath) {
      try {
        const rootContent = fs.readFileSync(rootFile, 'utf-8');
        const relPath = path.relative(path.dirname(rootFile), appState.currentFilePath).replace(/\\/g, '/');
        const lines = rootContent.split('\n');
        let includeIndex = 0;
        let totalIncludes = 0;
        for (const line of lines) {
          if (line.match(/^#include\s+"/)) {
            totalIncludes++;
            if (line.includes(relPath)) {
              includeIndex = totalIncludes;
            }
          }
        }
        if (totalIncludes > 0 && includeIndex > 0) {
          scrollToPage = Math.floor((includeIndex - 1) / totalIncludes * pages.length);
        }
      } catch {}
    }

    appState.mainWindow?.webContents.send('vswrite', {
      type: 'previewUpdate',
      pages,
      scrollToPage,
    });
  });

  compiler.on('compiledPdf', (pdfBuffer: Buffer) => {
    appState.mainWindow?.webContents.send('vswrite', {
      type: 'previewPdfUpdate',
      pdfData: pdfBuffer.toString('base64'),
    });
  });

  compiler.on('error', (diagnostics: { message: string }[]) => {
    const errorText = diagnostics.map(d => d.message).join('\n') || 'Compilation failed';
    appState.mainWindow?.webContents.send('vswrite', {
      type: 'compileError',
      error: errorText,
    });
  });

  if (previewMode === 'pdf') {
    compiler.compilePdf();
  } else {
    compiler.compile();
  }
}

export function getCompiler(): TypstCompiler | null {
  return compiler;
}

// ─── Preview Mode ─────────────────────────────────────

export function setupPreviewModeIPC(): void {
  ipcMain.on('preview:setMode', (_event, mode: 'svg' | 'pdf') => {
    previewMode = mode;
    if (!compiler) return;
    if (mode === 'pdf') {
      compiler.compilePdf();
    } else {
      compiler.compile();
    }
  });
}

export function getPreviewMode(): 'svg' | 'pdf' {
  return previewMode;
}

// ─── Auto-Save ────────────────────────────────────────

let backupTimer: NodeJS.Timeout | null = null;

export function autoSave(): void {
  if (autoSaveTimer) clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(() => {
    if (appState.isDirty && appState.currentFilePath) {
      saveFile();
    }
  }, 1000);

  // Save backup snapshot every 30 seconds (independent of auto-save)
  if (!backupTimer && appState.currentFilePath) {
    backupTimer = setTimeout(() => {
      backupTimer = null;
      if (appState.currentFilePath && appState.currentContent) {
        saveBackup(appState.currentFilePath, appState.currentContent);
      }
    }, 30000);
  }
}

// ─── File Watcher ─────────────────────────────────────

function setupFileWatcher(): void {
  stopFileWatcher();

  if (!appState.currentFilePath) return;

  const dir = appState.projectDir || path.dirname(appState.currentFilePath);

  fileWatcher = watch(dir, {
    ignoreInitial: true,
    depth: 3,
    ignored: [
      '**/node_modules/**',
      '**/.git/**',
      '**/.DS_Store',
      '**/.vswrite-preview*',
      '**/*.lock',
    ],
  });

  fileWatcher.on('change', async (changedPath: string) => {
    if (Date.now() - appState.lastSaveTimestamp < 3000) return;

    if (changedPath === appState.currentFilePath) {
      try {
        const diskContent = await fs.promises.readFile(changedPath, 'utf-8');
        if (diskContent !== appState.currentContent) {
          // Snapshot current content before applying external change (AI edit)
          pushAiSnapshot(changedPath, appState.currentContent);

          appState.currentContent = diskContent;
          appState.isDirty = false;
          updateTitle();
          appState.mainWindow?.webContents.send('vswrite', {
            type: 'update',
            content: appState.currentContent,
          });
          appState.mainWindow?.webContents.send('vswrite', {
            type: 'saveStatus',
            saved: true,
          });
          if (previewMode === 'pdf') {
            compiler?.compilePdf();
          } else {
            compiler?.compile();
          }
        }
      } catch {}
    }

    if (changedPath.endsWith('.typ') || changedPath.endsWith('.bib')) {
      // Don't refresh file tree for our own saves
      if (Date.now() - appState.lastSaveTimestamp >= 3000) {
        appState.mainWindow?.webContents.send('vswrite', { type: 'filetreeChanged' });
      }
      if (changedPath.endsWith('.bib')) {
        import('./importExport').then(({ handleRequestCitations }) => {
          handleRequestCitations();
        });
      }
    }
  });

  fileWatcher.on('add', (addedPath: string) => {
    if (Date.now() - appState.lastSaveTimestamp < 3000) return;
    if (addedPath.includes('.vswrite-preview')) return;
    appState.mainWindow?.webContents.send('vswrite', { type: 'filetreeChanged' });
  });

  fileWatcher.on('unlink', (removedPath: string) => {
    if (Date.now() - appState.lastSaveTimestamp < 3000) return;
    if (removedPath.includes('.vswrite-preview')) return;
    appState.mainWindow?.webContents.send('vswrite', { type: 'filetreeChanged' });
  });
}

export function stopFileWatcher(): void {
  if (fileWatcher) {
    fileWatcher.close();
    fileWatcher = null;
  }
}

export function disposeCompiler(): void {
  compiler?.dispose();
  compiler = null;
}

// ─── Preamble Stripper ────────────────────────────────

export function stripPreamble(content: string): string {
  const lines = content.split('\n');
  let i = 0;
  let braceDepth = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (braceDepth > 0) {
      for (const ch of line) {
        if (ch === '{') braceDepth++;
        if (ch === '}') braceDepth--;
      }
      i++;
      continue;
    }

    if (trimmed === '' || trimmed.startsWith('//')) {
      i++;
      continue;
    }

    if (trimmed.startsWith('#set ') || trimmed.startsWith('#show ') ||
        trimmed.startsWith('#import ') || trimmed.startsWith('#let ')) {
      for (const ch of line) {
        if (ch === '{') braceDepth++;
        if (ch === '}') braceDepth--;
      }
      i++;
      continue;
    }

    break;
  }

  return lines.slice(i).join('\n').trimStart();
}
