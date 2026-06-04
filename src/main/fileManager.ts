/**
 * File Manager — extracted from index.ts
 * File I/O, Auto-Save, Compiler Setup, File Watcher, Preamble Stripper
 */

import { dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { watch, type FSWatcher } from 'chokidar';
import { findRootFile } from '../shared/rootFinder';
import { parseSettings } from '../shared/settingsParser';
import { TypstCompiler } from './typstCompiler';
import { appState } from './appState';
import { checkLock, acquireLock, releaseLock } from './lockManager';
import {
  addRecentProject,
  saveLastProjectPath,
  saveProjectBackup,
  pruneProjectBackups,
  checkForFileRecovery,
  getBackupConfig,
  aiSnapshotsDir,
} from './persistenceManager';
import { addBreadcrumb } from './crashReporter';

let compiler: TypstCompiler | null = null;
let fileWatcher: FSWatcher | null = null;
let autoSaveTimer: NodeJS.Timeout | null = null;

// ─── AI Edit Snapshots ───────────────────────────────
// Ring buffer that captures editor state before each external file change,
// so the user can undo AI-driven edits (terminal / MCP). Snapshots are also
// persisted to <projectDir>/.penwright/ai-snapshots/ so they survive app restarts.

interface AiSnapshot {
  filePath: string;
  content: string;
  timestamp: number;
  diskName?: string; // basename of the persisted JSON file, when persisted
}

const aiSnapshots: AiSnapshot[] = [];

function getMaxAiSnapshots(): number {
  try { return getBackupConfig().maxAiSnapshots; } catch { return 20; }
}

function aiSnapshotFileName(timestamp: number, filePath: string): string {
  const safe = path.basename(filePath).replace(/[^a-zA-Z0-9._-]/g, '_');
  return `${timestamp}_${safe}.json`;
}

function persistAiSnapshot(snap: AiSnapshot): string | undefined {
  if (!appState.projectDir) return undefined;
  try {
    const dir = aiSnapshotsDir(appState.projectDir);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const name = aiSnapshotFileName(snap.timestamp, snap.filePath);
    const target = path.join(dir, name);
    fs.writeFileSync(target, JSON.stringify({
      filePath: snap.filePath,
      content: snap.content,
      timestamp: snap.timestamp,
    }), 'utf-8');
    return name;
  } catch (err) {
    console.warn('[vswrite] Failed to persist AI snapshot:', err);
    return undefined;
  }
}

function deletePersistedAiSnapshot(diskName?: string): void {
  if (!diskName || !appState.projectDir) return;
  try {
    fs.unlinkSync(path.join(aiSnapshotsDir(appState.projectDir), diskName));
  } catch {}
}

/**
 * Loads AI snapshots from disk into the in-memory ring buffer.
 * Called when a project is opened so AI undo survives app restarts.
 */
export function loadAiSnapshotsFromDisk(projectDir: string): void {
  aiSnapshots.length = 0;
  const dir = aiSnapshotsDir(projectDir);
  if (!fs.existsSync(dir)) return;
  try {
    const entries = fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort();
    for (const name of entries) {
      try {
        const raw = fs.readFileSync(path.join(dir, name), 'utf-8');
        const parsed = JSON.parse(raw);
        if (typeof parsed.filePath === 'string' && typeof parsed.content === 'string' && typeof parsed.timestamp === 'number') {
          aiSnapshots.push({ filePath: parsed.filePath, content: parsed.content, timestamp: parsed.timestamp, diskName: name });
        }
      } catch {}
    }
  } catch {}
}

function pushAiSnapshot(filePath: string, content: string): void {
  const snap: AiSnapshot = { filePath, content, timestamp: Date.now() };
  snap.diskName = persistAiSnapshot(snap);
  aiSnapshots.push(snap);

  // Trim to max — drop oldest, including from disk
  const max = getMaxAiSnapshots();
  while (aiSnapshots.length > max) {
    const dropped = aiSnapshots.shift();
    if (dropped) deletePersistedAiSnapshot(dropped.diskName);
  }

  appState.mainWindow?.webContents.send('vswrite', {
    type: 'aiSnapshotCount',
    count: aiSnapshots.filter(s => s.filePath === appState.currentFilePath).length,
  });
}

export function popAiSnapshot(): boolean {
  for (let i = aiSnapshots.length - 1; i >= 0; i--) {
    if (aiSnapshots[i].filePath === appState.currentFilePath) {
      const snapshot = aiSnapshots.splice(i, 1)[0];
      deletePersistedAiSnapshot(snapshot.diskName);
      appState.currentContent = snapshot.content;
      appState.isDirty = true;
      updateTitle();
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
      compiler?.compilePdf();
      return true;
    }
  }
  return false;
}

export function getAiSnapshotCount(filePath?: string): number {
  if (!filePath) return aiSnapshots.length;
  return aiSnapshots.filter(s => s.filePath === filePath).length;
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

    // Check for crash recovery: if the latest project backup contains a
    // version of this file that differs from disk and is newer, offer to
    // restore it. The user can also browse the full backup history later
    // via the Project panel.
    if (appState.projectDir) {
      const recovery = checkForFileRecovery(appState.projectDir, filePath);
      if (recovery) {
        const result = await dialog.showMessageBox(appState.mainWindow!, {
          type: 'question',
          buttons: ['Recover', 'Discard Backup'],
          defaultId: 0,
          title: 'Unsaved changes found',
          message: 'A backup with unsaved changes was found for this file.',
          detail: `Last backup: ${new Date(recovery.snapshot.timestampMs).toLocaleString()}\n\nWould you like to recover the backup?`,
        });
        if (result.response === 0) {
          appState.currentContent = recovery.backupContent;
          appState.isDirty = true;
        }
      }

      // Restore AI-edit history for this project
      loadAiSnapshotsFromDisk(appState.projectDir);
      appState.mainWindow?.webContents.send('vswrite', {
        type: 'aiSnapshotCount',
        count: aiSnapshots.filter(s => s.filePath === filePath).length,
      });
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
    if (appState.projectDir) {
      addRecentProject(appState.projectDir, path.basename(appState.projectDir));
      saveLastProjectPath(appState.projectDir);
    }

    addBreadcrumb('file', `opened ${path.extname(appState.currentFilePath)}`);
  } catch (err) {
    addBreadcrumb('file', `open failed: ${err instanceof Error ? err.message : String(err)}`);
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
    appState.isDirty = false;
    updateTitle();
    compiler?.compilePdf();
    appState.mainWindow?.webContents.send('vswrite', {
      type: 'saveStatus',
      saved: true,
      file: appState.currentFilePath,
    });
    addBreadcrumb('file', `saved ${path.extname(appState.currentFilePath)} (${appState.currentContent.length} chars)`);
    return true;
  } catch (err) {
    addBreadcrumb('file', `save failed: ${err instanceof Error ? err.message : String(err)}`);
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

/**
 * Closes the currently open project: releases lock, stops watcher, disposes
 * compiler, clears in-memory state. The renderer is notified so it can
 * reset the editor and return to the StartScreen.
 *
 * If unsaved changes exist, the caller is responsible for prompting first
 * (see `closeProjectInteractive`).
 */
export function closeProject(): void {
  releaseLock();
  stopFileWatcher();
  disposeCompiler();
  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer);
    autoSaveTimer = null;
  }
  if (backupTimer) {
    clearTimeout(backupTimer);
    backupTimer = null;
  }

  appState.currentFilePath = null;
  appState.currentContent = '';
  appState.isDirty = false;
  appState.projectDir = null;
  appState.lastSaveTimestamp = 0;

  updateTitle();
  appState.mainWindow?.webContents.send('vswrite', { type: 'projectClosed' });
  addBreadcrumb('project', 'closed');
}

/**
 * Like `closeProject()`, but prompts to save unsaved changes first.
 * Returns true if the project was closed, false if the user cancelled.
 */
export async function closeProjectInteractive(): Promise<boolean> {
  if (appState.isDirty && appState.currentFilePath) {
    const result = await dialog.showMessageBox(appState.mainWindow!, {
      type: 'warning',
      buttons: ['Save', "Don't Save", 'Cancel'],
      defaultId: 0,
      message: 'You have unsaved changes.',
      detail: 'Do you want to save before closing the project?',
    });
    if (result.response === 2) return false;
    if (result.response === 0) await saveFile();
  }
  closeProject();
  return true;
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
  compiler = new TypstCompiler(rootFile);

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

  compiler.compilePdf();
}

export function getCompiler(): TypstCompiler | null {
  return compiler;
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

  // Schedule a project backup snapshot (interval is user-configurable).
  // Includes the in-memory edit so unsaved changes survive a crash.
  if (!backupTimer && appState.currentFilePath && appState.projectDir) {
    const intervalMs = Math.max(5, getBackupConfig().intervalSec) * 1000;
    backupTimer = setTimeout(() => {
      backupTimer = null;
      runProjectBackup();
    }, intervalMs);
  }
}

export function runProjectBackup(): void {
  if (!appState.projectDir || !appState.currentFilePath) return;
  try {
    const cfg = getBackupConfig();
    const snap = saveProjectBackup(appState.projectDir, {
      absPath: appState.currentFilePath,
      content: appState.currentContent,
    });
    if (snap) {
      pruneProjectBackups(appState.projectDir, cfg.maxCount);
      appState.mainWindow?.webContents.send('vswrite', {
        type: 'backupCreated',
        timestamp: snap.timestampMs,
        backupId: snap.timestamp,
      });
    }
  } catch (err) {
    console.warn('[vswrite] Project backup failed:', err);
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
      '**/.penwright/**',
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
          compiler?.compilePdf();
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
