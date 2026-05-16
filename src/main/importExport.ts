/**
 * Import/Export Handlers — extracted from index.ts
 * PDF, DOCX, Markdown Import, Zotero, Style Templates, Citations
 */

import { dialog, shell } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { execFileSync } from 'child_process';
import { getTypstPath, buildTypstCompileArgs } from './typstPath';
import { watch, type FSWatcher } from 'chokidar';
import { deserializeTypst } from './deserializer-bridge';
import { serializeDocx } from '../shared/docxSerializer';
import { markdownToTypst } from '../shared/markdownImporter';
import { styleTemplates } from '../shared/styleTemplates';
import { findRootFile } from '../shared/rootFinder';
import { resolveIncludes } from '../shared/mergeDocument';
import { parseBibFile } from '../shared/bibParser';
import { appState } from './appState';
import { stripPreamble } from './fileManager';
import { ensureClaudeSkills } from './projectManager';
import { saveZoteroBibPath } from './persistenceManager';

let zoteroWatcher: FSWatcher | null = null;

export function getZoteroWatcher(): FSWatcher | null {
  return zoteroWatcher;
}

// ─── Export-Selection helpers ────────────────────────────
// Parses the project's root file for the structural building blocks the
// user can opt in / out of when exporting (chapters, bibliography). Used
// by the Export dialog and by the high-level export functions to build
// a filtered version of the root before compiling.

export interface ExportableChapter {
  /** Path as written in the #include (relative to the root). */
  includePath: string;
  /** Friendly title — first H1 of the included file, or the basename. */
  title: string;
}

export interface ExportableSections {
  /** Whether the project consists of multiple chapters (#include lines). */
  multiChapter: boolean;
  rootFile: string;
  chapters: ExportableChapter[];
  hasBibliography: boolean;
}

const INCLUDE_RE = /^#include\s+"([^"]+)"\s*$/gm;
const BIB_RE = /^#bibliography\(/m;

function chapterTitle(rootDir: string, includePath: string): string {
  const fullPath = path.resolve(rootDir, includePath);
  try {
    const content = fs.readFileSync(fullPath, 'utf-8');
    const headingMatch = content.match(/^=\s+(.+?)\s*$/m);
    if (headingMatch) return headingMatch[1].trim();
  } catch {}
  return path.basename(includePath, '.typ').replace(/^\d+[-_]?/, '').replace(/[-_]/g, ' ').trim() || includePath;
}

export function getExportableSections(): ExportableSections | null {
  if (!appState.currentFilePath) return null;
  const rootFile = findRootFile(appState.currentFilePath);
  if (!fs.existsSync(rootFile)) return null;

  const rootContent = fs.readFileSync(rootFile, 'utf-8');
  const rootDir = path.dirname(rootFile);

  const chapters: ExportableChapter[] = [];
  for (const match of rootContent.matchAll(INCLUDE_RE)) {
    const includePath = match[1];
    chapters.push({ includePath, title: chapterTitle(rootDir, includePath) });
  }

  return {
    multiChapter: chapters.length > 0,
    rootFile,
    chapters,
    hasBibliography: BIB_RE.test(rootContent),
  };
}

/**
 * Returns a copy of the root file's source with unselected #include
 * lines and (optionally) the #bibliography line removed.
 *
 * If `selectedIncludes` is null, all includes are kept.
 */
function buildFilteredRoot(rootContent: string, selectedIncludes: string[] | null, includeBibliography: boolean): string {
  let out = rootContent;

  if (selectedIncludes !== null) {
    const selected = new Set(selectedIncludes);
    out = out.replace(INCLUDE_RE, (line, includePath: string) => {
      return selected.has(includePath) ? line : `// removed: ${includePath}`;
    });
  }

  if (!includeBibliography) {
    out = out.replace(/^#bibliography\([^)]*\).*$/gm, line => `// removed: ${line.trim()}`);
  }

  return out;
}

const TEMP_EXPORT_BASENAME = '.vswrite-export-temp.typ';

/**
 * Writes a filtered copy of the root file alongside the original and
 * returns the path. Caller must clean up via `cleanupExportTemp()`.
 */
function writeExportTemp(rootFile: string, selectedIncludes: string[] | null, includeBibliography: boolean): string {
  const rootContent = fs.readFileSync(rootFile, 'utf-8');
  const filtered = buildFilteredRoot(rootContent, selectedIncludes, includeBibliography);
  const tempPath = path.join(path.dirname(rootFile), TEMP_EXPORT_BASENAME);
  fs.writeFileSync(tempPath, filtered, 'utf-8');
  return tempPath;
}

function cleanupExportTemp(rootDir: string): void {
  try { fs.unlinkSync(path.join(rootDir, TEMP_EXPORT_BASENAME)); } catch {}
}

export interface ExportConfig {
  format: 'pdf' | 'docx';
  /** null → everything; otherwise list of include paths to keep. */
  selectedIncludes: string[] | null;
  includeBibliography: boolean;
}

/**
 * Performs an export with optional chapter selection. Returns the
 * absolute output path on success, or null if the user cancelled the
 * Save dialog.
 */
export async function runFilteredExport(config: ExportConfig): Promise<string | null> {
  if (!appState.currentFilePath) {
    dialog.showErrorBox('Export failed', 'Please open a project first.');
    return null;
  }

  const { saveFile } = await import('./fileManager');
  await saveFile();

  const rootFile = findRootFile(appState.currentFilePath);
  const rootDir = path.dirname(rootFile);
  const ext = config.format === 'pdf' ? 'pdf' : 'docx';
  const filterName = config.format === 'pdf' ? 'PDF' : 'Word Document';
  const defaultPath = rootFile.replace(/\.typ$/, `.${ext}`);
  const result = await dialog.showSaveDialog(appState.mainWindow!, {
    defaultPath,
    filters: [{ name: filterName, extensions: [ext] }],
  });
  if (result.canceled || !result.filePath) return null;

  const useFilter = config.selectedIncludes !== null || !config.includeBibliography;
  const sourceFile = useFilter ? writeExportTemp(rootFile, config.selectedIncludes, config.includeBibliography) : rootFile;

  appState.mainWindow?.webContents.send('vswrite', { type: 'exportStatus', exporting: true, format: config.format });
  try {
    if (config.format === 'pdf') {
      execFileSync(getTypstPath(), buildTypstCompileArgs([sourceFile, result.filePath]));
    } else {
      // DOCX: resolve includes manually, then run the serializer on the merged content.
      const mergedContent = resolveIncludes(sourceFile);
      const doc = deserializeTypst(mergedContent);
      const buffer = await serializeDocx(doc, rootDir, mergedContent);
      fs.writeFileSync(result.filePath, buffer);
    }
    appState.mainWindow?.webContents.send('vswrite', { type: 'exportStatus', exporting: false, format: config.format });

    const choice = await dialog.showMessageBox(appState.mainWindow!, {
      type: 'info',
      buttons: [config.format === 'pdf' ? 'Open PDF' : 'Open DOCX', 'OK'],
      message: `${config.format.toUpperCase()} exported to ${path.basename(result.filePath)}`,
    });
    if (choice.response === 0) shell.openPath(result.filePath);
    return result.filePath;
  } catch (err) {
    appState.mainWindow?.webContents.send('vswrite', { type: 'exportStatus', exporting: false, format: config.format });
    dialog.showErrorBox(
      `${config.format.toUpperCase()} export failed`,
      `${err instanceof Error ? err.message : String(err)}`,
    );
    return null;
  } finally {
    if (useFilter) cleanupExportTemp(rootDir);
  }
}

/**
 * Menu-driven export entry point. For multi-chapter projects we hand off
 * to the renderer-side selection dialog; single-file projects skip
 * straight to the file-save dialog and export everything.
 */
async function startExport(format: 'pdf' | 'docx'): Promise<void> {
  if (!appState.currentFilePath) {
    dialog.showErrorBox('Export failed', 'Please open a project first.');
    return;
  }

  const sections = getExportableSections();
  if (sections && sections.multiChapter) {
    appState.mainWindow?.webContents.send('vswrite', {
      type: 'showExportDialog',
      format,
      sections,
    });
    return;
  }

  // Single-file project — just export everything directly.
  await runFilteredExport({ format, selectedIncludes: null, includeBibliography: true });
}

export function handleExportPdf(): Promise<void> {
  return startExport('pdf');
}

export function handleExportDocx(): Promise<void> {
  return startExport('docx');
}

export async function handleImportMarkdown(): Promise<void> {
  const result = await dialog.showOpenDialog(appState.mainWindow!, {
    filters: [{ name: 'Markdown Files', extensions: ['md', 'markdown', 'txt'] }],
    properties: ['openFile'],
    title: 'Import Markdown File',
  });
  if (result.canceled || !result.filePaths[0]) return;

  const mdPath = result.filePaths[0];
  try {
    const mdContent = fs.readFileSync(mdPath, 'utf-8');
    const typstContent = markdownToTypst(mdContent);

    const preamble = `#set text(font: "Georgia", size: 11pt)
#set page(paper: "a4", margin: 2.5cm)
#set par(justify: true, leading: 0.65em)
#set heading(numbering: "1.1")

`;
    const fullContent = preamble + typstContent;

    const defaultName = path.basename(mdPath).replace(/\.(md|markdown|txt)$/i, '.typ');
    const saveResult = await dialog.showSaveDialog(appState.mainWindow!, {
      defaultPath: appState.currentFilePath
        ? path.join(path.dirname(appState.currentFilePath), defaultName)
        : defaultName,
      filters: [{ name: 'Typst Files', extensions: ['typ'] }],
    });
    if (saveResult.canceled || !saveResult.filePath) return;

    fs.writeFileSync(saveResult.filePath, fullContent, 'utf-8');
    ensureClaudeSkills(path.dirname(saveResult.filePath));
    const { openFile } = await import('./fileManager');
    openFile(saveResult.filePath);

    dialog.showMessageBox(appState.mainWindow!, {
      type: 'info',
      message: `Imported "${path.basename(mdPath)}" as Typst.`,
      detail: 'Review the converted file — some complex Markdown constructs may need manual adjustment.',
    });
  } catch (err) {
    dialog.showErrorBox('Import failed', String(err));
  }
}

export async function handleImportStyleTemplate(): Promise<void> {
  const result = await dialog.showOpenDialog(appState.mainWindow!, {
    filters: [{ name: 'Typst Files', extensions: ['typ'] }],
    properties: ['openFile'],
    title: 'Import Style Template',
  });
  if (result.canceled || !result.filePaths[0]) return;

  const filePath = result.filePaths[0];
  try {
    const fileContent = fs.readFileSync(filePath, 'utf-8').trim();
    const bodyStart = stripPreamble(fileContent);
    const preamblePart = bodyStart
      ? fileContent.substring(0, fileContent.length - bodyStart.length).trim()
      : fileContent;

    if (!preamblePart) {
      dialog.showErrorBox('Import failed', 'No style rules (#set, #show) found in the file.');
      return;
    }

    const name = path.basename(filePath, '.typ');
    const label = name.charAt(0).toUpperCase() + name.slice(1).replace(/[-_]/g, ' ');

    if (appState.currentContent) {
      const { autoSave, updateTitle } = await import('./fileManager');
      const body = stripPreamble(appState.currentContent);
      appState.currentContent = preamblePart + '\n\n' + body;
      appState.isDirty = true;
      updateTitle();
      autoSave();
      appState.mainWindow?.webContents.send('vswrite', { type: 'update', content: appState.currentContent });
    }

    if (appState.projectDir || appState.currentFilePath) {
      const templateDir = path.join(appState.projectDir || path.dirname(appState.currentFilePath!), '.claude', 'style-templates');
      if (!fs.existsSync(templateDir)) {
        fs.mkdirSync(templateDir, { recursive: true });
      }
      fs.copyFileSync(filePath, path.join(templateDir, path.basename(filePath)));
      appState.mainWindow?.webContents.send('vswrite', { type: 'filetreeChanged' });
    }

    dialog.showMessageBox(appState.mainWindow!, {
      type: 'info',
      message: `Style "${label}" imported and applied.`,
      detail: 'The template was saved in .claude/style-templates/ for future use.',
    });
  } catch (err) {
    dialog.showErrorBox('Import failed', String(err));
  }
}

export async function handleLinkZotero(): Promise<void> {
  const result = await dialog.showOpenDialog(appState.mainWindow!, {
    filters: [{ name: 'BibTeX Files', extensions: ['bib'] }],
    properties: ['openFile'],
    title: 'Select Zotero Better BibTeX auto-export file',
    message: 'Select the .bib file that Zotero Better BibTeX keeps updated',
  });
  if (result.canceled || !result.filePaths[0]) return;

  const zoteroBibPath = result.filePaths[0];

  if (!appState.currentFilePath) {
    dialog.showErrorBox('No project open', 'Please open a project first.');
    return;
  }

  const dir = appState.projectDir || path.dirname(appState.currentFilePath);
  const destPath = path.join(dir, 'zotero.bib');

  try {
    fs.copyFileSync(zoteroBibPath, destPath);

    const rootFile = findRootFile(appState.currentFilePath);
    let rootContent = fs.readFileSync(rootFile, 'utf-8');
    if (!rootContent.includes('zotero.bib')) {
      if (rootContent.includes('#bibliography')) {
        // Typst doesn't support multiple bibliography files natively
      } else {
        rootContent += '\n\n#bibliography("zotero.bib")\n';
        fs.writeFileSync(rootFile, rootContent, 'utf-8');
      }
    }

    saveZoteroBibPath(zoteroBibPath);

    if (zoteroWatcher) {
      zoteroWatcher.close();
    }
    zoteroWatcher = watch(zoteroBibPath, { ignoreInitial: true });
    zoteroWatcher.on('change', () => {
      try {
        fs.copyFileSync(zoteroBibPath, destPath);
        handleRequestCitations();
        appState.mainWindow?.webContents.send('vswrite', { type: 'filetreeChanged' });
      } catch {}
    });

    handleRequestCitations();
    appState.mainWindow?.webContents.send('vswrite', { type: 'filetreeChanged' });

    dialog.showMessageBox(appState.mainWindow!, {
      type: 'info',
      message: 'Zotero library linked!',
      detail: `"${path.basename(zoteroBibPath)}" copied to project as zotero.bib.\nChanges in Zotero will be synced automatically while the app is running.`,
    });
  } catch (err) {
    dialog.showErrorBox('Zotero link failed', String(err));
  }
}

export function handleRequestCitations(): void {
  if (!appState.currentFilePath) return;

  const searchDir = appState.projectDir || path.dirname(appState.currentFilePath);
  const rootFile = findRootFile(appState.currentFilePath);
  const rootDir = path.dirname(rootFile);

  const dirsToSearch = new Set([searchDir, rootDir, path.dirname(appState.currentFilePath)]);
  const bibFilePaths: string[] = [];

  for (const dir of dirsToSearch) {
    try {
      const files = fs.readdirSync(dir).filter(f => f.endsWith('.bib'));
      for (const f of files) {
        const fullPath = path.join(dir, f);
        if (!bibFilePaths.includes(fullPath)) bibFilePaths.push(fullPath);
      }
    } catch {}
  }

  const allEntries: Array<{ citekey: string; author: string; title: string; year: string; type: string }> = [];

  for (const bibFile of bibFilePaths) {
    try {
      const content = fs.readFileSync(bibFile, 'utf-8');
      const entries = parseBibFile(content);
      for (const entry of entries) {
        allEntries.push({
          citekey: entry.citekey,
          author: entry.fields.author || '',
          title: entry.fields.title || '',
          year: entry.fields.year || entry.fields.date || '',
          type: entry.type,
        });
      }
    } catch {}
  }

  appState.mainWindow?.webContents.send('vswrite', { type: 'citationData', entries: allEntries });
}

export function applyStyleTemplate(styleId: string): void {
  const template = styleTemplates.find(s => s.id === styleId);
  if (!template || !appState.currentContent || !appState.currentFilePath) return;

  // Style preambles only belong in the project's root file. If the user
  // applies a style while a chapter is active, the new preamble would be
  // prepended to the chapter source — silently corrupting it. Refuse and
  // tell the user to switch to the root file.
  const rootFile = findRootFile(appState.currentFilePath);
  if (rootFile !== appState.currentFilePath) {
    dialog.showMessageBox(appState.mainWindow!, {
      type: 'info',
      buttons: ['OK'],
      defaultId: 0,
      title: 'Stil kann hier nicht geändert werden',
      message: `Stile gehören in die Hauptdatei (${path.basename(rootFile)}).`,
      detail: 'Wechsle erst zur Hauptdatei und wende den Stil dort an. Sonst würde der Stil-Vorspann an den Anfang dieses Kapitels gehängt und die Datei kaputtmachen.',
    });
    return;
  }

  const body = stripPreamble(appState.currentContent);
  appState.currentContent = template.preamble + '\n\n' + body;
  appState.isDirty = true;
  import('./fileManager').then(({ updateTitle, autoSave }) => {
    updateTitle();
    autoSave();
  });
  appState.mainWindow?.webContents.send('vswrite', { type: 'update', content: appState.currentContent });
}
