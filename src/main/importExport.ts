/**
 * Import/Export Handlers — extracted from index.ts
 * PDF, DOCX, Markdown Import, Zotero, Style Templates, Citations
 */

import { dialog, shell } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { execFileSync } from 'child_process';
import { getTypstPath } from './typstPath';
import { watch, type FSWatcher } from 'chokidar';
import { deserializeTypst } from './deserializer-bridge';
import { serializeDocx } from '../shared/docxSerializer';
import { markdownToTypst } from '../shared/markdownImporter';
import { styleTemplates } from '../shared/styleTemplates';
import { findRootFile } from '../shared/rootFinder';
import { parseBibFile } from '../shared/bibParser';
import { appState } from './appState';
import { stripPreamble } from './fileManager';
import { ensureClaudeSkills } from './projectManager';
import { saveZoteroBibPath } from './persistenceManager';

let zoteroWatcher: FSWatcher | null = null;

export function getZoteroWatcher(): FSWatcher | null {
  return zoteroWatcher;
}

export async function handleExportPdf(): Promise<void> {
  if (!appState.currentFilePath) {
    dialog.showErrorBox('Export failed', 'Please save the file first.');
    return;
  }

  const { saveFile } = await import('./fileManager');
  await saveFile();

  const defaultPath = appState.currentFilePath.replace(/\.typ$/, '.pdf');
  const result = await dialog.showSaveDialog(appState.mainWindow!, {
    defaultPath,
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
  });

  if (result.canceled || !result.filePath) return;

  appState.mainWindow?.webContents.send('vswrite', { type: 'exportStatus', exporting: true, format: 'pdf' });
  try {
    execFileSync(getTypstPath(), ['compile', appState.currentFilePath, result.filePath]);
    appState.mainWindow?.webContents.send('vswrite', { type: 'exportStatus', exporting: false, format: 'pdf' });
    const choice = await dialog.showMessageBox(appState.mainWindow!, {
      type: 'info',
      buttons: ['Open PDF', 'OK'],
      message: `PDF exported to ${path.basename(result.filePath)}`,
    });
    if (choice.response === 0) {
      shell.openPath(result.filePath);
    }
  } catch (err) {
    appState.mainWindow?.webContents.send('vswrite', { type: 'exportStatus', exporting: false, format: 'pdf' });
    dialog.showErrorBox(
      'PDF export failed',
      `${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export async function handleExportDocx(): Promise<void> {
  if (!appState.currentFilePath) {
    dialog.showErrorBox('Export failed', 'Please save the file first.');
    return;
  }

  const { saveFile } = await import('./fileManager');
  await saveFile();

  const defaultPath = appState.currentFilePath.replace(/\.typ$/, '.docx');
  const result = await dialog.showSaveDialog(appState.mainWindow!, {
    defaultPath,
    filters: [{ name: 'Word Document', extensions: ['docx'] }],
  });

  if (result.canceled || !result.filePath) return;

  appState.mainWindow?.webContents.send('vswrite', { type: 'exportStatus', exporting: true, format: 'docx' });
  try {
    const doc = deserializeTypst(appState.currentContent);
    const docDir = path.dirname(appState.currentFilePath);
    const buffer = await serializeDocx(doc, docDir, appState.currentContent);
    fs.writeFileSync(result.filePath, buffer);

    appState.mainWindow?.webContents.send('vswrite', { type: 'exportStatus', exporting: false, format: 'docx' });
    const choice = await dialog.showMessageBox(appState.mainWindow!, {
      type: 'info',
      buttons: ['Open DOCX', 'OK'],
      message: `DOCX exported to ${path.basename(result.filePath)}`,
    });
    if (choice.response === 0) {
      shell.openPath(result.filePath);
    }
  } catch (err) {
    appState.mainWindow?.webContents.send('vswrite', { type: 'exportStatus', exporting: false, format: 'docx' });
    dialog.showErrorBox(
      'DOCX export failed',
      `${err instanceof Error ? err.message : String(err)}`,
    );
  }
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
  if (template && appState.currentContent) {
    const body = stripPreamble(appState.currentContent);
    appState.currentContent = template.preamble + '\n\n' + body;
    appState.isDirty = true;
    import('./fileManager').then(({ updateTitle, autoSave }) => {
      updateTitle();
      autoSave();
    });
    appState.mainWindow?.webContents.send('vswrite', { type: 'update', content: appState.currentContent });
  }
}
