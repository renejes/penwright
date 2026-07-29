/**
 * File Manager — extracted from index.ts
 * File I/O, Auto-Save, Compiler Setup, File Watcher, Preamble Stripper
 */

import { dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { watch, type FSWatcher } from 'chokidar';
import { findRootFile } from '../shared/rootFinder';
import { isIgnoredWatchPath, normalizeWatchRoot } from '../shared/watchIgnore';
import { writeSession, clearSession, writeActiveProject } from '../shared/sessionState';
import {
  noteDiskContent,
  isKnownContent,
  wasDeletedByUs,
  inspectBeforeWrite,
  forgetAll,
  writeFileAtomic,
} from '../shared/fileWrite';
import {
  recordSnapshot,
  takeLastSnapshot,
  listSnapshotRefs,
  countSnapshots,
  publishSnapshotLimit,
} from '../shared/editHistory';
import { parseSettings } from '../shared/settingsParser';
import { TypstCompiler } from './typstCompiler';
import { appState } from './appState';
import { checkLock, acquireLock, releaseLock } from '../shared/lockFile';
import {
  addRecentProject,
  saveProjectBackup,
  pruneProjectBackups,
  checkForFileRecovery,
  getBackupConfig,
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
// Captures what an external write is about to replace, so the user can undo
// AI-driven edits (terminal / MCP). The store is the project folder itself —
// `<projectDir>/.penwright/ai-snapshots/`, owned by `shared/editHistory` and
// written by BOTH processes.
//
// This file used to keep an in-memory ring buffer beside it. That buffer was a
// second truth, and a lossy one: it only ever contained what the app had
// snapshotted itself, so every file the agent rescued was invisible to the very
// UI built to surface it. The folder is now read directly — a handful of small
// JSON files, on user-initiated actions only.

/** Tells the shared store what retention the user configured. */
function publishConfiguredLimit(projectDir: string): void {
  let max = 20;
  try { max = getBackupConfig().maxAiSnapshots; } catch { /* defaults */ }
  publishSnapshotLimit(projectDir, max);
}

function pushAiSnapshot(filePath: string, content: string): void {
  if (!appState.projectDir) return;
  recordSnapshot(appState.projectDir, filePath, content);
  sendAiSnapshotCount();
}

function sendAiSnapshotCount(): void {
  appState.mainWindow?.webContents.send('penwright', {
    type: 'aiSnapshotCount',
    count: getAiSnapshotCount(appState.currentFilePath ?? undefined),
  });
}

/**
 * Steps one AI edit back.
 *
 * `filePath` targets a specific file; omitted, it undoes the newest edit in the
 * project regardless of which file it touched — which is what "undo the last
 * thing the agent did" has to mean once the agent can rewrite five chapters in
 * one turn. The old version could only ever reach the file open in the editor,
 * so a multi-file rewrite had a net that could not be pulled.
 */
export function popAiSnapshot(filePath?: string): boolean {
  if (!appState.projectDir) return false;
  const taken = takeLastSnapshot(appState.projectDir, filePath);
  if (!taken) return false;

  const target = taken.snapshot.filePath;
  try {
    fs.writeFileSync(target, taken.snapshot.content, 'utf-8');
    noteDiskContent(target, taken.snapshot.content);
  } catch (err) {
    // Leave the entry in place: an undo that failed must not consume its own
    // way back.
    console.warn('[penwright] Undo AI edit failed to write:', err);
    return false;
  }
  taken.commit();

  if (appState.currentFilePath && path.resolve(target) === path.resolve(appState.currentFilePath)) {
    appState.currentContent = taken.snapshot.content;
    appState.isDirty = true;
    updateTitle();
    appState.mainWindow?.webContents.send('penwright', {
      type: 'update',
      content: appState.currentContent,
    });
  } else {
    // Another file moved — the tree is unchanged but the preview is not.
    appState.mainWindow?.webContents.send('penwright', { type: 'filetreeChanged' });
  }
  sendAiSnapshotCount();
  compiler?.compilePdf();
  return true;
}

export function getAiSnapshotCount(filePath?: string): number {
  if (!appState.projectDir) return 0;
  return countSnapshots(appState.projectDir, filePath);
}

/**
 * Listing for the History & Restore hub — newest first, without contents.
 *
 * Deliberately NOT filtered to the open file: the whole point is that edits to
 * the other twelve chapters are visible too.
 */
export function getAiSnapshotsList(filePath?: string): { timestamp: number; filePath: string; bytes: number }[] {
  if (!appState.projectDir) return [];
  return listSnapshotRefs(appState.projectDir, filePath).map(r => ({
    timestamp: r.timestamp,
    filePath: r.filePath,
    bytes: r.bytes,
  }));
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
      noteDiskContent(appState.currentFilePath, appState.currentContent);
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
    // What we just read IS the disk state. Without this record the very first
    // autosave of every opened file reports a phantom collision and pushes a
    // bogus entry onto the AI-undo stack — one click on "Undo AI Edit" would
    // then throw away the whole session's work.
    noteDiskContent(filePath, appState.currentContent);
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

      // Tell the shared store how many entries the user wants kept, so an
      // agent writing while the app is open prunes to the same number.
      publishConfiguredLimit(appState.projectDir);
      sendAiSnapshotCount();
    }

    // A freshly opened file is clean — dirty only if backup recovery replaced
    // the buffer (the recovered content isn't on disk yet).
    appState.isDirty = recovered;
    updateTitle();
    // Only here: currentFilePath and isDirty both hold their final value. It
    // used to run before the assignment above, so session.json named the
    // PREVIOUSLY open file and the agent aimed one file behind the user.
    publishSession();

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

    // Atomic: the MCP server and every Typst compile read these files while we
    // write them, and a truncate-then-fill hands a reader half a document.
    writeFileAtomic(appState.currentFilePath, appState.currentContent);
    appState.isDirty = false;
    updateTitle();
    publishSession();
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
  // Captured before the state is torn down — the session file lives inside the
  // project we are about to forget.
  const closingProjectDir = appState.projectDir;
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
  // Same reason, for the design undo: its entries hold absolute paths into the
  // project being closed. Left in place, the Design panel of the NEXT project
  // offers to undo a change made in the previous one, and pressing it writes
  // into a project the user has closed.
  import('./ipcHandlers').then(({ clearDesignUndo }) => clearDesignUndo());
  if (closingProjectDir) clearSession(closingProjectDir);
  writeActiveProject(null);

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

/**
 * Publishes what the app is doing so the MCP server can read it — which file
 * is open and whether it has unsaved edits. Called on every transition that
 * changes either. Cheap and best-effort: sessionState swallows write errors,
 * and the watcher ignores the file, so this never feeds back into the app.
 */
export function publishSession(): void {
  if (!appState.projectDir) return;
  // Two records: which project at all (global, outside any project — that is
  // the part a reader cannot look up), and which file inside it.
  writeActiveProject(appState.projectDir);
  writeSession({
    projectDir: appState.projectDir,
    currentFile: appState.currentFilePath,
    isDirty: appState.isDirty,
    lastCompileOk: appState.lastCompileOk,
  });
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
    const changed = !appState.lastCompileOk;
    appState.lastCompileOk = true;
    // Republish so the agent can tell a break it caused from one that was
    // already there — see SessionState.lastCompileOk.
    if (changed) publishSession();
    appState.mainWindow?.webContents.send('penwright', {
      type: 'previewPdfUpdate',
      pdfData: pdfBuffer.toString('base64'),
    });
  });

  compiler.on('error', (diagnostics: { message: string }[]) => {
    const changed = appState.lastCompileOk;
    appState.lastCompileOk = false;
    if (changed) publishSession();
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

  // Extracted to shared/watchIgnore.ts so it can be tested against the real
  // chokidar — the previous glob array was silently dead under chokidar 4.
  const watchRoot = normalizeWatchRoot(dir);

  fileWatcher = watch(dir, {
    ignoreInitial: true,
    // 3 was too shallow for real projects — a figure under
    // chapters/section/assets/ or a preset's nested folder never fired.
    depth: 6,
    ignored: (p: string) => isIgnoredWatchPath(watchRoot, p),
    // Wait for the file to stop changing before reporting it. Without this a
    // slow or chunked write — a large asset dropped in, a Dropbox/iCloud sync
    // landing a file in pieces — fires `change` mid-write, and everything
    // downstream reads a truncated document: the editor adopts half a chapter,
    // the compiler reports a syntax error at the cut. 200 ms is below the
    // threshold of noticing and far above a local write.
    awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 50 },
  });

  fileWatcher.on('change', async (changedPath: string) => {
    // The same cheap guard add/unlink have — and it has to run before the read.
    if (path.basename(changedPath).startsWith('.penwright-')) return;

    // Nothing downstream reacts to a path that is neither text, nor compiled
    // input, nor the open file. Don't read it just to hash it.
    const relevant =
      affectsCompiledOutput(changedPath) ||
      /\.(typ|bib|md|json|toml|txt|csl)$/i.test(changedPath) ||
      changedPath === appState.currentFilePath;
    if (!relevant) return;

    let disk: Buffer;
    try {
      disk = await fs.promises.readFile(changedPath);
    } catch {
      return;   // vanished between event and read
    }
    // Provenance, not a stopwatch: ignore only what WE put there.
    if (isKnownContent(changedPath, disk)) return;

    const isText = isTextLike(changedPath);
    const diskContent = isText ? disk.toString('utf-8') : null;

    // The design tokens changed underneath us — tell the renderer so the
    // Design panel reloads instead of overwriting this with its mount-time
    // snapshot on the next slider move.
    if (appState.projectDir &&
        path.resolve(changedPath) === path.resolve(appState.projectDir, '.penwright', 'style.json')) {
      // Someone else — the agent — now owns the design. Our undo entries
      // describe a state that no longer leads anywhere sensible: applying one
      // would restore the bytes from before OUR last change and wipe theirs,
      // under a button still labelled with our change.
      import('./ipcHandlers').then(({ clearDesignUndo }) => clearDesignUndo());
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
        publishSession();
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

    // No scheduleFiletreeRefresh here: readDirTree lists names, not contents,
    // so a pure content change can never alter the tree. Adding/removing files
    // does, and that is handled in the add/unlink handlers.
    if (isText) {
      if (changedPath.endsWith('.bib')) {
        import('./importExport').then(({ handleRequestCitations }) => {
          handleRequestCitations();
        });
      }
    }

    // The record answers "what do I know is in this file?", not "what did I
    // write?". Without this update, a later revert to our previously written
    // content would be classified as ours and swallowed — the exact failure
    // class this module exists to remove.
    noteDiskContent(changedPath, disk);
  });

  // add/unlink carry no content to compare, and a stale tree is cheap to fix
  // while an invisible new chapter is not — so these always refresh. The
  // debounce keeps a bulk operation (restore, preset copy) to one refresh.
  fileWatcher.on('add', (addedPath: string) => {
    if (path.basename(addedPath).startsWith('.penwright-')) return;
    // An atomic write (temp + rename) surfaces as `add` on some platforms
    // rather than `change`. Content we already have on record is not news —
    // without this, every atomic save would refresh the tree and recompile a
    // second time.
    if (isTextLike(addedPath)) {
      try {
        if (isKnownContent(addedPath, fs.readFileSync(addedPath))) return;
      } catch { /* vanished again — fall through to the refresh */ }
    }
    scheduleFiletreeRefresh();
    if (affectsCompiledOutput(addedPath)) scheduleRecompile();
  });

  fileWatcher.on('unlink', (removedPath: string) => {
    if (path.basename(removedPath).startsWith('.penwright-')) return;
    const ours = wasDeletedByUs(removedPath);
    scheduleFiletreeRefresh();
    if (ours) return;   // our own delete needs no recompile — we triggered one
    if (affectsCompiledOutput(removedPath)) scheduleRecompile();
  });
}

/** Text we track the content of — the same set on every watcher branch. */
function isTextLike(p: string): boolean {
  return /\.(typ|bib|md|json|toml|txt|csl)$/i.test(p);
}

/** Files whose content ends up in the compiled PDF. */
function affectsCompiledOutput(p: string): boolean {
  // A backup snapshot is a .typ, but it never reaches the compiled document.
  if (p.replace(/\\/g, '/').includes('/.penwright/')) return false;
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
