/**
 * IPC Handlers — extracted from index.ts
 * Central message router: switch-statement + dialog/filetree/includes handlers.
 */

import { ipcMain, dialog, shell } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { parseSettings } from '../shared/settingsParser';
import { resolveIncludes } from '../shared/mergeDocument';
import { splitIntoChapters, slugify } from '../shared/splitDocument';
import { templates as projectTemplates } from '../shared/projectTemplates';
import { appState } from './appState';
import { openFile, saveFile, saveFileAs, newFile, autoSave, updateTitle } from './fileManager';
import { handleExportPdf, handleExportDocx, handleImportMarkdown, handleImportStyleTemplate, handleLinkZotero, handleRequestCitations, applyStyleTemplate } from './importExport';
import { handleCreateProject, handleNewFile, handlePickImage, handleDropImage, handleDropImagePath, handleRequestSettings, handleUpdateSettings, readDirTree } from './projectManager';
import { getPanelState, savePanelState, getRecentProjects, isOnboardingSeen, setOnboardingSeen, getZoteroBibPath, type PanelState } from './persistenceManager';
import { activateLicense, validateLicense, deactivateLicense } from './licenseManager';
import { getLicenseData } from './persistenceManager';

export function setupIPC(): void {
  // Renderer sends edited content
  ipcMain.on('vswrite', (_event, msg: { type: string; [key: string]: unknown }) => {
    switch (msg.type) {
      case 'ready': {
        if (appState.currentFilePath) {
          appState.mainWindow?.webContents.send('vswrite', {
            type: 'documentBaseUri',
            uri: path.dirname(appState.currentFilePath),
          });
          appState.mainWindow?.webContents.send('vswrite', {
            type: 'currentFile',
            path: appState.currentFilePath,
          });
        }
        if (appState.currentContent) {
          appState.mainWindow?.webContents.send('vswrite', {
            type: 'update',
            content: appState.currentContent,
          });
        }
        setTimeout(() => {
          if (appState.currentFilePath) {
            handleRequestCitations();
          }
        }, 500);
        break;
      }

      case 'edit': {
        const content = msg.content as string;
        if (content !== appState.currentContent) {
          appState.currentContent = content;
          appState.isDirty = true;
          updateTitle();
          appState.mainWindow?.webContents.send('vswrite', { type: 'saveStatus', saved: false });
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

      case 'openSource': {
        if (appState.currentFilePath) {
          shell.showItemInFolder(appState.currentFilePath);
        }
        break;
      }

      case 'newProject': {
        appState.mainWindow?.webContents.send('vswrite', {
          type: 'showNewProjectDialog',
          templates: projectTemplates.map(t => ({ id: t.id, label: t.label, description: t.description })),
        });
        break;
      }

      case 'createProject': {
        const templateId = msg.templateId as string;
        const projectName = msg.projectName as string;
        handleCreateProject(templateId, projectName);
        break;
      }

      case 'newFile': {
        handleNewFile();
        break;
      }

      case 'importMarkdown': {
        handleImportMarkdown();
        break;
      }

      case 'mergeDocument': {
        if (appState.currentFilePath) {
          try {
            const merged = resolveIncludes(appState.currentFilePath);
            appState.currentContent = merged;
            appState.isDirty = true;
            updateTitle();
            appState.mainWindow?.webContents.send('vswrite', { type: 'update', content: appState.currentContent });
          } catch (err) {
            dialog.showErrorBox('Merge failed', String(err));
          }
        }
        break;
      }

      case 'pickImage': {
        handlePickImage();
        break;
      }

      case 'dropImage': {
        handleDropImage(msg.name as string, msg.data as string);
        break;
      }

      case 'dropImagePath': {
        handleDropImagePath(msg.path as string);
        break;
      }

      case 'splitDocument': {
        if (appState.currentFilePath && appState.currentContent) {
          try {
            const { config, chapters } = splitIntoChapters(appState.currentContent);
            const dir = path.dirname(appState.currentFilePath);
            const chaptersDir = path.join(dir, 'chapters');
            if (!fs.existsSync(chaptersDir)) fs.mkdirSync(chaptersDir, { recursive: true });

            const includeLines: string[] = [];
            chapters.forEach((ch, i) => {
              const slug = slugify(ch.title, i);
              const chapterPath = path.join(chaptersDir, `${slug}.typ`);
              fs.writeFileSync(chapterPath, ch.content, 'utf-8');
              includeLines.push(`#include "chapters/${slug}.typ"`);
            });

            appState.currentContent = config + '\n\n' + includeLines.join('\n') + '\n';
            appState.isDirty = true;
            updateTitle();
            autoSave();
            appState.mainWindow?.webContents.send('vswrite', { type: 'update', content: appState.currentContent });
            appState.mainWindow?.webContents.send('vswrite', { type: 'filetreeChanged' });
          } catch (err) {
            dialog.showErrorBox('Split failed', String(err));
          }
        }
        break;
      }

      case 'setWordGoal': {
        const goal = msg.goal as number;
        const wordCount = appState.currentContent.split(/\s+/).filter(Boolean).length;
        appState.mainWindow?.webContents.send('vswrite', { type: 'wordGoal', goal, current: wordCount });
        break;
      }

      case 'quickSettings': {
        const qs = msg as unknown as { fontSize: string; leading: string; lang: string };
        const qsSettings = parseSettings(appState.currentContent);
        if (qs.fontSize) qsSettings.fontSize = qs.fontSize;
        if (qs.leading) qsSettings.leading = qs.leading;
        if (qs.lang) qsSettings.lang = qs.lang;
        handleUpdateSettings(qsSettings as unknown as Record<string, string>);
        break;
      }

      case 'applyStyle': {
        applyStyleTemplate(msg.styleId as string);
        break;
      }

      case 'requestCitations': {
        handleRequestCitations();
        break;
      }

      case 'ensureBibliography': {
        if (appState.currentFilePath) {
          const dir = path.dirname(appState.currentFilePath);
          const bibPath = path.join(dir, 'references.bib');
          if (!fs.existsSync(bibPath)) {
            fs.writeFileSync(bibPath, '// Bibliography\n', 'utf-8');
          }
          if (!appState.currentContent.includes('#bibliography')) {
            appState.currentContent += '\n\n#bibliography("references.bib")\n';
            appState.isDirty = true;
            updateTitle();
            autoSave();
            appState.mainWindow?.webContents.send('vswrite', { type: 'update', content: appState.currentContent });
          }
          appState.mainWindow?.webContents.send('vswrite', { type: 'filetreeChanged' });
        }
        break;
      }

      case 'linkZotero': {
        handleLinkZotero();
        break;
      }

      case 'importSources': {
        if (appState.currentFilePath) {
          const sourcesDir = path.join(path.dirname(appState.currentFilePath), 'sources');
          if (!fs.existsSync(sourcesDir)) fs.mkdirSync(sourcesDir, { recursive: true });
          shell.openPath(sourcesDir);
          appState.mainWindow?.webContents.send('vswrite', { type: 'filetreeChanged' });
        }
        break;
      }

      case 'addCitationManually': {
        if (appState.currentFilePath) {
          const bibPath = path.join(path.dirname(appState.currentFilePath), 'references.bib');
          if (fs.existsSync(bibPath)) {
            shell.openPath(bibPath);
          }
        }
        break;
      }

      case 'importStyleTemplate': {
        handleImportStyleTemplate();
        break;
      }

      case 'undoLastAiEdit': {
        break;
      }

      case 'openUserGuide': {
        shell.openExternal('https://vswrite.netlify.app/de/docs');
        break;
      }

      case 'dismissWelcome': {
        const dontShowAgain = msg.dontShowAgain as boolean;
        if (dontShowAgain) {
          setOnboardingSeen(true);
        }
        break;
      }

      case 'deserializeError': {
        const error = msg.error as string;
        console.error('[vswrite] Deserialize error in renderer:', error);
        break;
      }
    }
  });

  // Dialog handlers
  ipcMain.handle('dialog:openFile', async () => {
    const result = await dialog.showOpenDialog(appState.mainWindow!, {
      filters: [{ name: 'Typst Files', extensions: ['typ'] }],
      properties: ['openFile'],
    });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle('dialog:saveFile', async (_event, defaultName: string) => {
    const result = await dialog.showSaveDialog(appState.mainWindow!, {
      defaultPath: defaultName,
      filters: [{ name: 'Typst Files', extensions: ['typ'] }],
    });
    return result.canceled ? null : result.filePath;
  });

  ipcMain.handle('dialog:saveFileAs', async (_event, defaultName: string, filters: unknown) => {
    const result = await dialog.showSaveDialog(appState.mainWindow!, {
      defaultPath: defaultName,
      filters: filters as Electron.FileFilter[],
    });
    return result.canceled ? null : result.filePath;
  });

  ipcMain.handle('app:getPlatform', () => process.platform);

  ipcMain.handle('app:checkTypst', () => {
    try {
      require('child_process').execSync('typst --version', { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  });

  // ─── File Tree Handlers ────────────────────────
  ipcMain.handle('filetree:list', () => {
    const dir = appState.projectDir || (appState.currentFilePath ? path.dirname(appState.currentFilePath) : null);
    if (!dir) return { dir: '', entries: [], hasParent: false };
    const hasParent = path.dirname(dir) !== dir;
    return { dir, entries: readDirTree(dir), hasParent };
  });

  ipcMain.handle('filetree:open', (_event, filePath: string) => {
    if (!filePath) return;

    if (filePath.endsWith('.typ')) {
      openFile(filePath);
      return 'editor';
    }

    if (filePath.match(/\.(bib|txt|md|yaml|yml|toml|json|csv|tex)$/i)) {
      appState.mainWindow?.webContents.send('vswrite', {
        type: 'openTextFile',
        path: filePath,
      });
      return 'textviewer';
    }

    if (filePath.match(/\.pdf$/i)) {
      appState.mainWindow?.webContents.send('vswrite', {
        type: 'openPdfFile',
        path: filePath,
      });
      return 'pdfviewer';
    }

    if (filePath.match(/\.(png|jpg|jpeg|svg|gif|bmp|webp|docx|doc)$/i)) {
      shell.openPath(filePath);
      return 'external';
    }
  });

  ipcMain.handle('filetree:navigateUp', () => {
    const dir = appState.projectDir || (appState.currentFilePath ? path.dirname(appState.currentFilePath) : null);
    if (dir) {
      const parent = path.dirname(dir);
      if (parent !== dir) {
        appState.projectDir = parent;
        appState.mainWindow?.webContents.send('vswrite', { type: 'filetreeChanged' });
        return { dir: parent, entries: readDirTree(parent), hasParent: path.dirname(parent) !== parent };
      }
    }
    return null;
  });

  ipcMain.handle('filetree:openFolder', async () => {
    const result = await dialog.showOpenDialog(appState.mainWindow!, {
      properties: ['openDirectory'],
    });
    if (!result.canceled && result.filePaths[0]) {
      appState.projectDir = result.filePaths[0];
      const typFiles = fs.readdirSync(appState.projectDir).filter(f => f.endsWith('.typ'));
      if (typFiles.length > 0) {
        openFile(path.join(appState.projectDir, typFiles[0]));
      }
      appState.mainWindow?.webContents.send('vswrite', { type: 'filetreeChanged' });
    }
  });

  // ─── Text File Handlers ─────────────────────────
  ipcMain.handle('textfile:read', (_event, filePath: string) => {
    return fs.readFileSync(filePath, 'utf-8');
  });

  ipcMain.handle('textfile:readBinary', (_event, filePath: string) => {
    return fs.readFileSync(filePath).toString('base64');
  });

  ipcMain.handle('textfile:write', (_event, filePath: string, content: string) => {
    fs.writeFileSync(filePath, content, 'utf-8');
    appState.mainWindow?.webContents.send('vswrite', { type: 'filetreeChanged' });
  });

  // ─── Includes Handlers ──────────────────────────
  ipcMain.handle('includes:validate', (_event, paths: string[]) => {
    if (!appState.currentFilePath) return paths.map(() => false);
    const dir = path.dirname(appState.currentFilePath);
    return paths.map(p => fs.existsSync(path.join(dir, p)));
  });

  ipcMain.handle('includes:open', (_event, relPath: string) => {
    if (!appState.currentFilePath) return;
    const absPath = path.join(path.dirname(appState.currentFilePath), relPath);
    if (fs.existsSync(absPath) && absPath.endsWith('.typ')) {
      openFile(absPath);
    }
  });

  // ─── Spellcheck Handler ─────────────────────────
  ipcMain.handle('spellcheck:setLanguage', (_event, lang: string) => {
    const bcp47Map: Record<string, string> = {
      en: 'en-US', de: 'de-DE', fr: 'fr-FR', es: 'es-ES', it: 'it-IT',
      pt: 'pt-BR', nl: 'nl-NL', sv: 'sv-SE', da: 'da-DK', nb: 'nb-NO',
      fi: 'fi-FI', pl: 'pl-PL', ru: 'ru-RU',
    };
    const resolved = bcp47Map[lang] || lang;
    try {
      appState.mainWindow?.webContents.session.setSpellCheckerLanguages([resolved]);
    } catch (err) {
      console.warn('[vswrite] Spellcheck language not available:', resolved, err);
    }
  });

  ipcMain.handle('includes:add', async () => {
    if (!appState.currentFilePath) return;
    const dir = path.dirname(appState.currentFilePath);
    const chaptersDir = path.join(dir, 'chapters');

    const result = await dialog.showSaveDialog(appState.mainWindow!, {
      defaultPath: path.join(chaptersDir, 'new-chapter.typ'),
      filters: [{ name: 'Typst Files', extensions: ['typ'] }],
    });

    if (result.canceled || !result.filePath) return;

    if (!fs.existsSync(result.filePath)) {
      const name = path.basename(result.filePath, '.typ').replace(/-/g, ' ');
      const title = name.charAt(0).toUpperCase() + name.slice(1);
      fs.writeFileSync(result.filePath, `= ${title}\n\n`, 'utf-8');
    }

    const relPath = path.relative(dir, result.filePath).replace(/\\/g, '/');
    appState.currentContent += `\n#include "${relPath}"\n`;
    appState.isDirty = true;
    updateTitle();
    autoSave();
    appState.mainWindow?.webContents.send('vswrite', { type: 'update', content: appState.currentContent });
    appState.mainWindow?.webContents.send('vswrite', { type: 'filetreeChanged' });
  });

  // ─── Persistence Handlers ─────────────────────
  ipcMain.handle('persist:getPanelState', () => getPanelState());
  ipcMain.handle('persist:savePanelState', (_event, state: PanelState) => savePanelState(state));
  ipcMain.handle('persist:getRecentProjects', () => getRecentProjects());
  ipcMain.handle('persist:isOnboardingSeen', () => isOnboardingSeen());
  ipcMain.handle('persist:getZoteroBibPath', () => getZoteroBibPath());

  // ─── License Handlers ──────────────────────────
  ipcMain.handle('license:activate', async (_event, key: string) => {
    try {
      return await activateLicense(key);
    } catch (err) {
      const msg = String(err);
      let userMessage = 'Activation failed. Please check your license key.';
      if (msg.includes('ResourceNotFound') || msg.includes('Not found')) {
        userMessage = 'Invalid license key. Please check and try again.';
      } else if (msg.includes('activation limit') || msg.includes('LimitExceeded')) {
        userMessage = 'Device limit reached. Deactivate another device first or contact support.';
      } else if (msg.includes('fetch') || msg.includes('ENOTFOUND')) {
        userMessage = 'No internet connection. Please check your network and try again.';
      }
      return { status: 'none', tier: null, key: null, error: userMessage };
    }
  });

  ipcMain.handle('license:validate', async () => {
    return await validateLicense();
  });

  ipcMain.handle('license:deactivate', async () => {
    await deactivateLicense();
    return { status: 'none', tier: null, key: null };
  });

  ipcMain.handle('license:getStatus', () => {
    const data = getLicenseData();
    return {
      status: data.licenseStatus || 'none',
      tier: data.licenseTier,
      key: data.licenseKey,
    };
  });

  ipcMain.handle('license:openCheckout', () => {
    shell.openExternal('https://vswrite.com/pricing');
  });
}
