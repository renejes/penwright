/**
 * File Manager — extracted from index.ts
 * File I/O, Auto-Save, Compiler Setup, File Watcher, Preamble Stripper
 */

import { dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { watch, type FSWatcher } from 'chokidar';
import { findRootFile } from '../shared/rootFinder';
import {
  markSelfWrite,
  isSelfWrite,
  isSelfDelete,
  inspectBeforeWrite,
  forgetAll,
} from '../shared/fileWrite';
import { parseSettings } from '../shared/settingsParser';
import { TypstCompiler } from './typstCompiler';
import { appState } from './appState';
import { checkLock, acquireLock, releaseLock } from './lockManager';
import {
  addRecentProject,
  saveProjectBackup,
  pruneProjectBackups,
  checkForFileRecovery,
  getBackupConfig,
  aiSnapshotsDir,
  getSelectionPin,
  clearSelectionPin,
  getLocale,
  getPreviewMode,
} from './persistenceManager';
import { addBreadcrumb } from './crashReporter';
import { resolveDict } from '../shared/i18n';

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
    console.warn('[penwright] Failed to persist AI snapshot:', err);
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

  appState.mainWindow?.webContents.send('penwright', {
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
        fs.writeFileSync(appState.currentFilePath, snapshot.content, 'utf-8');
        markSelfWrite(appState.currentFilePath, snapshot.content);
      }
      appState.mainWindow?.webContents.send('penwright', {
        type: 'update',
        content: appState.currentContent,
      });
      appState.mainWindow?.webContents.send('penwright', {
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

// Lightweight listing (no content) for the History & Restore hub — newest first.
export function getAiSnapshotsList(filePath?: string): { timestamp: number; filePath: string }[] {
  const list = filePath ? aiSnapshots.filter(s => s.filePath === filePath) : aiSnapshots;
  return list
    .map(s => ({ timestamp: s.timestamp, filePath: s.filePath }))
    .sort((a, b) => b.timestamp - a.timestamp);
}

/**
 * Applies a document language to Electron's spell checker. The Typst `lang`
 * tag is a bare ISO code; Chromium wants a full BCP-47 dictionary tag. ONE
 * map for both callers (openFile and the spellcheck:setLanguage IPC) — the
 * two inline copies used to drift.
 */
export function applySpellcheckLanguage(lang: string): void {
  if (!lang) return;
  const bcp47Map: Record<string, string> = {
    en: 'en-US', de: 'de-DE', fr: 'fr-FR', es: 'es-ES', it: 'it-IT',
    pt: 'pt-BR', nl: 'nl-NL', sv: 'sv-SE', da: 'da-DK', nb: 'nb-NO',
    fi: 'fi-FI', pl: 'pl-PL', ru: 'ru-RU',
  };
  const resolved = bcp47Map[lang] || lang;
  try {
    appState.mainWindow?.webContents.session.setSpellCheckerLanguages([resolved]);
  } catch (err) {
    console.warn('[penwright] Spellcheck language not available:', resolved, err);
  }
}

// ─── File Operations ──────────────────────────────────

export async function openFile(filePath?: string): Promise<void> {
  const md = resolveDict(getLocale()).mainDialogs;
  if (!filePath) {
    const result = await dialog.showOpenDialog(appState.mainWindow!, {
      filters: [{ name: md.filterTypstFiles, extensions: ['typ'] }],
      properties: ['openFile'],
    });
    if (result.canceled || result.filePaths.length === 0) return;
    filePath = result.filePaths[0];
  }

  // Flush the pending debounced auto-save BEFORE the buffer is replaced —
  // otherwise the still-armed timer fires after the switch and writes the NEW
  // file's content to the NEW path, silently losing the previous file's last
  // <1s of edits. Also covers re-opening the same file (disk read would
  // otherwise clobber unsaved in-memory edits).
  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer);
    autoSaveTimer = null;
  }
  if (appState.isDirty && appState.currentFilePath) {
    try {
      await fs.promises.writeFile(appState.currentFilePath, appState.currentContent, 'utf-8');
      markSelfWrite(appState.currentFilePath, appState.currentContent);
      appState.isDirty = false;
      addBreadcrumb('file', `flush-saved ${path.extname(appState.currentFilePath)} before open`);
    } catch (err) {
      // Never proceed silently: switching now would replace the buffer and
      // lose the unsaved edits. Surface the error and abort the switch —
      // the dirty buffer (and dirty flag) stay intact.
      addBreadcrumb('file', `flush-save failed: ${err instanceof Error ? err.message : String(err)}`);
      dialog.showErrorBox(
        md.couldNotSaveFile,
        `${appState.currentFilePath}: ${err instanceof Error ? err.message : String(err)}`,
      );
      return;
    }
  }

  // Check for file lock (shared folder collaboration)
  if (filePath.endsWith('.typ')) {
    const existingLock = checkLock(filePath);
    if (existingLock) {
      const result = await dialog.showMessageBox(appState.mainWindow!, {
        type: 'warning',
        buttons: [md.openReadOnly, md.openAnyway, md.cancel],
        defaultId: 0,
        title: md.fileLockedTitle,
        message: md.fileLockedMessage(existingLock.user, existingLock.machine),
        detail: md.fileLockedDetail,
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
    let recovered = false;
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
          buttons: [md.recover, md.discardBackup],
          defaultId: 0,
          title: md.unsavedChangesFoundTitle,
          message: md.unsavedChangesFoundMessage,
          detail: md.unsavedChangesFoundDetail(new Date(recovery.snapshot.timestampMs).toLocaleString()),
        });
        if (result.response === 0) {
          appState.currentContent = recovery.backupContent;
          recovered = true;
        }
      }

      // Restore AI-edit history for this project
      loadAiSnapshotsFromDisk(appState.projectDir);
      appState.mainWindow?.webContents.send('penwright', {
        type: 'aiSnapshotCount',
        count: aiSnapshots.filter(s => s.filePath === filePath).length,
      });
    }

    // A freshly opened file is clean — dirty only if backup recovery replaced
    // the buffer (the recovered content isn't on disk yet).
    appState.isDirty = recovered;
    updateTitle();

    appState.mainWindow?.webContents.send('penwright', {
      type: 'documentBaseUri',
      uri: path.dirname(appState.currentFilePath),
    });

    appState.mainWindow?.webContents.send('penwright', {
      type: 'update',
      content: appState.currentContent,
    });

    // Sync spellcheck language from document settings
    const settings = parseSettings(appState.currentContent);
    if (settings.lang) applySpellcheckLanguage(settings.lang);

    setupCompiler();

    appState.mainWindow?.webContents.send('penwright', {
      type: 'currentFile',
      path: appState.currentFilePath,
    });

    appState.mainWindow?.webContents.send('penwright', { type: 'filetreeChanged' });

    // Auto-load citations (lazy import to avoid circular deps)
    const { handleRequestCitations } = await import('./importExport');
    handleRequestCitations();

    setupFileWatcher();

    // Persist for the recent-projects list (the app never auto-reopens).
    if (appState.projectDir) {
      addRecentProject(appState.projectDir, path.basename(appState.projectDir));
    }

    addBreadcrumb('file', `opened ${path.extname(appState.currentFilePath)}`);
  } catch (err) {
    addBreadcrumb('file', `open failed: ${err instanceof Error ? err.message : String(err)}`);
    dialog.showErrorBox(
      md.couldNotOpenFile,
      `${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export async function saveFile(): Promise<boolean> {
  if (!appState.currentFilePath) {
    return saveFileAs();
  }

  try {
    // Last line of defence against a lost update. Normally the watcher has
    // already pulled a foreign change into the buffer, so this never fires —
    // it catches the race where the event is still in flight. We do NOT refuse
    // the save (that would throw away what the user just typed); we preserve
    // the foreign version as a snapshot so "Undo AI Edit" can bring it back,
    // and say so.
    const before = inspectBeforeWrite(appState.currentFilePath);
    if (before.foreign && before.content !== null && before.content !== appState.currentContent) {
      pushAiSnapshot(appState.currentFilePath, before.content);
      appState.mainWindow?.webContents.send('penwright', {
        type: 'externalWriteOverwritten',
        file: appState.currentFilePath,
      });
      addBreadcrumb('file', `save overwrote a foreign change in ${path.basename(appState.currentFilePath)} (snapshotted)`);
    }

    await fs.promises.writeFile(appState.currentFilePath, appState.currentContent, 'utf-8');
    markSelfWrite(appState.currentFilePath, appState.currentContent);
    appState.isDirty = false;
    updateTitle();
    // Recompile the live preview only in 'auto' mode. In 'manual' mode the file
    // is still saved, but the preview waits for an explicit Refresh
    // (preview:compile) — cheaper on long documents while you're just writing.
    if (getPreviewMode() === 'auto') compiler?.compilePdf();
    appState.mainWindow?.webContents.send('penwright', {
      type: 'saveStatus',
      saved: true,
      file: appState.currentFilePath,
    });
    addBreadcrumb('file', `saved ${path.extname(appState.currentFilePath)} (${appState.currentContent.length} chars)`);
    return true;
  } catch (err) {
    addBreadcrumb('file', `save failed: ${err instanceof Error ? err.message : String(err)}`);
    const md = resolveDict(getLocale()).mainDialogs;
    dialog.showErrorBox(
      md.couldNotSaveFile,
      `${err instanceof Error ? err.message : String(err)}`,
    );
    return false;
  }
}

export async function saveFileAs(): Promise<boolean> {
  const md = resolveDict(getLocale()).mainDialogs;
  const result = await dialog.showSaveDialog(appState.mainWindow!, {
    filters: [{ name: md.filterTypstFiles, extensions: ['typ'] }],
    defaultPath: appState.currentFilePath || 'document.typ',
  });

  if (result.canceled || !result.filePath) return false;

  appState.currentFilePath = result.filePath;
  const ok = await saveFile();
  if (ok) {
    // The compiler was built against findRootFile(oldPath) and the watcher
    // against the old directory — rebuild both so the live preview compiles
    // the NEW location instead of the previous document.
    setupCompiler();
    setupFileWatcher();
    appState.mainWindow?.webContents.send('penwright', {
      type: 'currentFile',
      path: appState.currentFilePath,
    });
  }
  return ok;
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
  // Write provenance is per-project state — a path in the next project must
  // never be mistaken for one we wrote in this one.
  forgetAll();

  updateTitle();
  appState.mainWindow?.webContents.send('penwright', { type: 'projectClosed' });
  addBreadcrumb('project', 'closed');
}

/**
 * Like `closeProject()`, but prompts to save unsaved changes first.
 * Returns true if the project was closed, false if the user cancelled.
 */
export async function closeProjectInteractive(): Promise<boolean> {
  if (appState.isDirty && appState.currentFilePath) {
    const md = resolveDict(getLocale()).mainDialogs;
    const result = await dialog.showMessageBox(appState.mainWindow!, {
      type: 'warning',
      buttons: [md.save, md.dontSave, md.cancel],
      defaultId: 0,
      message: md.unsavedChangesMessage,
      detail: md.unsavedChangesDetail,
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
  appState.mainWindow.setTitle(`${fileName}${dirtyMark} — Penwright`);
}

// ─── Typst Compiler ───────────────────────────────────

function setupCompiler(): void {
  compiler?.dispose();

  if (!appState.currentFilePath) return;

  const rootFile = findRootFile(appState.currentFilePath);
  compiler = new TypstCompiler(rootFile);

  compiler.on('compiledPdf', (pdfBuffer: Buffer) => {
    appState.lastCompileOk = true;
    appState.mainWindow?.webContents.send('penwright', {
      type: 'previewPdfUpdate',
      pdfData: pdfBuffer.toString('base64'),
    });
  });

  compiler.on('error', (diagnostics: { message: string }[]) => {
    appState.lastCompileOk = false;
    const errorText = diagnostics.map(d => d.message).join('\n') || 'Compilation failed';
    appState.mainWindow?.webContents.send('penwright', {
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
      void runProjectBackup();   // async, fire-and-forget — never blocks the loop
    }, intervalMs);
  }
}

export async function runProjectBackup(): Promise<void> {
  if (!appState.projectDir || !appState.currentFilePath) return;
  try {
    const cfg = getBackupConfig();
    const snap = await saveProjectBackup(appState.projectDir, {
      absPath: appState.currentFilePath,
      content: appState.currentContent,
    });
    if (snap) {
      pruneProjectBackups(appState.projectDir, cfg.maxCount);
      appState.mainWindow?.webContents.send('penwright', {
        type: 'backupCreated',
        timestamp: snap.timestampMs,
        backupId: snap.timestamp,
      });
    }
  } catch (err) {
    console.warn('[penwright] Project backup failed:', err);
  }
}

// ─── File Watcher ─────────────────────────────────────

function setupFileWatcher(): void {
  stopFileWatcher();

  if (!appState.currentFilePath) return;

  const dir = appState.projectDir || path.dirname(appState.currentFilePath);

  fileWatcher = watch(dir, {
    ignoreInitial: true,
    // 3 was too shallow for real projects — a figure under
    // chapters/section/assets/ or a preset's nested folder never fired.
    depth: 6,
    ignored: [
      '**/node_modules/**',
      '**/.git/**',
      // Only the noisy parts of .penwright/ are ignored. style.json and
      // selection.json used to be swallowed with them, which is why a design
      // change made through the MCP server produced no event at all: the
      // preview kept the old look and the Design panel later wrote its stale
      // snapshot back over it.
      '**/.penwright/backups/**',
      '**/.penwright/ai-snapshots/**',
      '**/.DS_Store',
      // ALL .penwright-* temp files: preview, export temp root, print style,
      // math/SVG snippet renders — not just the preview PDF. Export temps
      // used to trigger spurious filetreeChanged / sidebar flicker.
      '**/.penwright-*',
      '**/*.lock',
    ],
  });

  fileWatcher.on('change', async (changedPath: string) => {
    let disk: Buffer;
    try {
      disk = await fs.promises.readFile(changedPath);
    } catch {
      return;   // vanished between event and read
    }
    // Provenance, not a stopwatch: ignore only what WE put there.
    if (isSelfWrite(changedPath, disk)) return;

    const isText = /\.(typ|bib|md|json|toml|txt|csl)$/i.test(changedPath);
    const diskContent = isText ? disk.toString('utf-8') : null;

    // The design tokens changed underneath us — tell the renderer so the
    // Design panel reloads instead of overwriting this with its mount-time
    // snapshot on the next slider move.
    if (path.basename(changedPath) === 'style.json') {
      appState.mainWindow?.webContents.send('penwright', { type: 'designChangedExternally' });
    }

    // "Design after writing": if the externally-changed file is the one with a
    // pinned selection, Claude has likely applied the design. Clear the pin and
    // tell the renderer to toast + refresh the Design hub card.
    try {
      if (appState.projectDir) {
        const pin = getSelectionPin(appState.projectDir);
        if (pin && path.resolve(changedPath) === path.resolve(appState.projectDir, pin.file)) {
          clearSelectionPin(appState.projectDir);
          appState.mainWindow?.webContents.send('penwright', { type: 'selectionApplied', file: pin.file });
        }
      }
    } catch {}

    if (changedPath === appState.currentFilePath && diskContent !== null) {
      if (diskContent !== appState.currentContent) {
        // Snapshot what we're replacing so the user can step back to it.
        pushAiSnapshot(changedPath, appState.currentContent);

        appState.currentContent = diskContent;
        appState.isDirty = false;
        updateTitle();
        appState.mainWindow?.webContents.send('penwright', {
          type: 'update',
          content: appState.currentContent,
        });
        appState.mainWindow?.webContents.send('penwright', {
          type: 'saveStatus',
          saved: true,
        });
      }
    }

    // Recompile for anything that can change the rendered document, not just
    // the open file. A foreign edit to another chapter, to style.typ or to the
    // bibliography used to leave the preview showing a PDF that no longer
    // matched the sources — and the user would judge the AI's work by it.
    if (affectsCompiledOutput(changedPath)) scheduleRecompile();

    if (isText) {
      scheduleFiletreeRefresh();
      if (changedPath.endsWith('.bib')) {
        import('./importExport').then(({ handleRequestCitations }) => {
          handleRequestCitations();
        });
      }
    }
  });

  // add/unlink carry no content to compare, and a stale tree is cheap to fix
  // while an invisible new chapter is not — so these always refresh. The
  // debounce keeps a bulk operation (restore, preset copy) to one refresh.
  fileWatcher.on('add', (addedPath: string) => {
    if (path.basename(addedPath).startsWith('.penwright-')) return;
    scheduleFiletreeRefresh();
    if (affectsCompiledOutput(addedPath)) scheduleRecompile();
  });

  fileWatcher.on('unlink', (removedPath: string) => {
    if (path.basename(removedPath).startsWith('.penwright-')) return;
    isSelfDelete(removedPath);   // consume the record either way
    scheduleFiletreeRefresh();
    if (affectsCompiledOutput(removedPath)) scheduleRecompile();
  });
}

/** Files whose content ends up in the compiled PDF. */
function affectsCompiledOutput(p: string): boolean {
  return /\.(typ|bib)$/i.test(p) || /\.(png|jpe?g|gif|svg|webp)$/i.test(p);
}

// Bulk operations (version restore, project-wide replace, preset copy) emit one
// event per file. Coalesce so the renderer rebuilds its tree once and Typst runs
// once, instead of dozens of times.
let filetreeTimer: NodeJS.Timeout | null = null;
function scheduleFiletreeRefresh(): void {
  if (filetreeTimer) clearTimeout(filetreeTimer);
  filetreeTimer = setTimeout(() => {
    filetreeTimer = null;
    appState.mainWindow?.webContents.send('penwright', { type: 'filetreeChanged' });
  }, 150);
}

let recompileTimer: NodeJS.Timeout | null = null;
function scheduleRecompile(): void {
  if (recompileTimer) clearTimeout(recompileTimer);
  recompileTimer = setTimeout(() => {
    recompileTimer = null;
    compiler?.compilePdf();
  }, 250);
}

export function stopFileWatcher(): void {
  if (fileWatcher) {
    fileWatcher.close();
    fileWatcher = null;
  }
  // Pending coalesced work must not fire into the next project — a refresh
  // would target a tree that no longer exists, a recompile a disposed compiler.
  if (filetreeTimer) { clearTimeout(filetreeTimer); filetreeTimer = null; }
  if (recompileTimer) { clearTimeout(recompileTimer); recompileTimer = null; }
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
