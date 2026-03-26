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

let compiler: TypstCompiler | null = null;
let fileWatcher: FSWatcher | null = null;
let autoSaveTimer: NodeJS.Timeout | null = null;
let previewMode: 'svg' | 'pdf' = 'svg';

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

  try {
    appState.currentContent = fs.readFileSync(filePath, 'utf-8');
    appState.currentFilePath = filePath;
    if (!appState.projectDir) {
      appState.projectDir = path.dirname(filePath);
    }
    appState.isDirty = false;
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
    fs.writeFileSync(appState.currentFilePath, appState.currentContent, 'utf-8');
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

export function autoSave(): void {
  if (autoSaveTimer) clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(() => {
    if (appState.isDirty && appState.currentFilePath) {
      saveFile();
    }
  }, 1000);
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
    ],
  });

  fileWatcher.on('change', (changedPath: string) => {
    if (Date.now() - appState.lastSaveTimestamp < 2000) return;

    if (changedPath === appState.currentFilePath) {
      try {
        const diskContent = fs.readFileSync(changedPath, 'utf-8');
        if (diskContent !== appState.currentContent) {
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
      appState.mainWindow?.webContents.send('vswrite', { type: 'filetreeChanged' });
      if (changedPath.endsWith('.bib')) {
        import('./importExport').then(({ handleRequestCitations }) => {
          handleRequestCitations();
        });
      }
    }
  });

  fileWatcher.on('add', () => {
    appState.mainWindow?.webContents.send('vswrite', { type: 'filetreeChanged' });
  });

  fileWatcher.on('unlink', () => {
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
