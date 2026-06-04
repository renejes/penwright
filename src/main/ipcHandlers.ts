/**
 * IPC Handlers — extracted from index.ts
 * Central message router: switch-statement + dialog/filetree/includes handlers.
 */

import { ipcMain, dialog, shell, app, clipboard } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { parseSettings } from '../shared/settingsParser';
import { resolveIncludes } from '../shared/mergeDocument';
import { splitIntoChapters, slugify } from '../shared/splitDocument';
import { templates as projectTemplates } from '../shared/projectTemplates';
import { appState } from './appState';
import { openFile, saveFile, saveFileAs, autoSave, updateTitle, popAiSnapshot, closeProjectInteractive } from './fileManager';
import { isPathWithin } from './pathSecurity';

/** Validates that a file path is within the current project directory (symlink-aware). */
function isPathWithinProject(filePath: string): boolean {
  const projectRoot = appState.projectDir || (appState.currentFilePath ? path.dirname(appState.currentFilePath) : null);
  return isPathWithin(filePath, projectRoot);
}
import { handleExportPdf, handleExportDocx, handleImportMarkdown, handleImportStyleTemplate, handleLinkZotero, handleRequestCitations, applyStyleTemplate, getExportableSections, runFilteredExport, type ExportConfig } from './importExport';
import { handleCreateProject, handlePickImage, handleDropImage, handleDropImagePath, handleRequestSettings, handleUpdateSettings, readDirTree, ensureProjectInfrastructure, openProject, openSampleProject, handleNewFolder, handleAddAssets } from './projectManager';
import {
  getPanelState,
  savePanelState,
  getRecentProjects,
  isOnboardingSeen,
  setOnboardingSeen,
  getZoteroBibPath,
  listProjectBackups,
  loadProjectBackup,
  getBackupConfig,
  setBackupConfig,
  getProjectPreferences,
  saveProjectPreferences,
  getProjectStyle,
  saveProjectStyle,
  hasProjectStyle,
  getMcpSetupVersion,
  saveMcpSetupVersion,
  type PanelState,
  type BackupConfig,
  type ProjectPreferences,
} from './persistenceManager';
import {
  generateStyleTypst,
  ensureStyleInclude,
  detectStylePreambleConflicts,
  extractCustomBlock,
  ensureSectionStyle,
  clearSectionStyle,
  getSectionStyleId,
} from '../shared/styleParser';
import { getSectionPreset } from '../shared/sectionPresets';
import type { ProjectStyle } from '../shared/styleTypes';
import { findRootFile } from '../shared/rootFinder';
import { getCompiler } from './fileManager';
import {
  checkClaudeDesktopInstalled,
  setupMcpServer,
  openClaudeDesktop,
  MCP_SETUP_VERSION,
} from './mcpSetup';
import { activateLicense, validateLicense, deactivateLicense, getEntitlement } from './licenseManager';
import { getLicenseData } from './persistenceManager';
import { searchProject, replaceInProject, type SearchOptions, type ReplaceOptions } from './projectSearch';
import { findSourceForCitation } from './citationSources';
import {
  captureRendererCrash,
  getLatestUnshownReport,
  markLatestAsShown,
  deleteAllReports,
  getReportsDir,
  type RendererCrashPayload,
} from './crashReporter';
import { listProjectLabels } from './projectLabels';
import { listComments, createComment, updateComment, deleteComment, type CreateArgs, type UpdateArgs, type ListOptions } from './commentManager';

/** Direct Polar checkout for the Penwright license (one-time, €59). */
const PENWRIGHT_CHECKOUT_URL = 'https://buy.polar.sh/polar_cl_u6Fn7z0pPvGUX6pWvPJE4U9bWSBg80fiNdJw12vbJzm';

export function setupIPC(): void {
  // Renderer sends edited content
  ipcMain.on('penwright', (_event, msg: { type: string; [key: string]: unknown }) => {
    switch (msg.type) {
      case 'ready': {
        if (appState.currentFilePath) {
          appState.mainWindow?.webContents.send('penwright', {
            type: 'documentBaseUri',
            uri: path.dirname(appState.currentFilePath),
          });
          appState.mainWindow?.webContents.send('penwright', {
            type: 'currentFile',
            path: appState.currentFilePath,
          });
        }
        if (appState.currentContent) {
          appState.mainWindow?.webContents.send('penwright', {
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
          appState.mainWindow?.webContents.send('penwright', { type: 'saveStatus', saved: false });
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
        appState.mainWindow?.webContents.send('penwright', {
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
            appState.mainWindow?.webContents.send('penwright', { type: 'update', content: appState.currentContent });
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
            appState.mainWindow?.webContents.send('penwright', { type: 'update', content: appState.currentContent });
            appState.mainWindow?.webContents.send('penwright', { type: 'filetreeChanged' });
          } catch (err) {
            dialog.showErrorBox('Split failed', String(err));
          }
        }
        break;
      }

      case 'setWordGoal': {
        const goal = msg.goal as number;
        const wordCount = appState.currentContent.split(/\s+/).filter(Boolean).length;
        appState.mainWindow?.webContents.send('penwright', { type: 'wordGoal', goal, current: wordCount });
        break;
      }

      case 'quickSettings': {
        // QuickSettings (toolbar popover) now writes scale.base / scale.leading
        // into style.json — the same target as the Design panel — so the two
        // surfaces don't fight each other. `lang` still goes through the
        // Document-Settings inline path because it stays in main.typ.
        const qs = msg as unknown as { fontSize: string; leading: string; lang: string };
        if (appState.projectDir) {
          const current = getProjectStyle(appState.projectDir);
          if (qs.fontSize) current.scale.base = qs.fontSize;
          if (qs.leading) current.scale.leading = qs.leading;
          const saved = saveProjectStyle(appState.projectDir, current);
          // Regenerate style.typ + recompile, mirroring the style:save path.
          const rootFile = appState.currentFilePath
            ? findRootFile(appState.currentFilePath)
            : path.join(appState.projectDir, 'main.typ');
          const projectRootDir = fs.existsSync(rootFile) ? path.dirname(rootFile) : appState.projectDir;
          try {
            appState.lastSaveTimestamp = Date.now();
            fs.writeFileSync(path.join(projectRootDir, 'style.typ'), generateStyleTypst(saved), 'utf-8');
            if (fs.existsSync(rootFile)) {
              const before = fs.readFileSync(rootFile, 'utf-8');
              const after = ensureStyleInclude(before);
              if (after !== before) {
                appState.lastSaveTimestamp = Date.now();
                fs.writeFileSync(rootFile, after, 'utf-8');
                if (appState.currentFilePath && path.resolve(rootFile) === path.resolve(appState.currentFilePath)) {
                  appState.currentContent = after;
                  appState.isDirty = false;
                  updateTitle();
                  appState.mainWindow?.webContents.send('penwright', { type: 'update', content: appState.currentContent });
                }
              }
            }
            getCompiler()?.compilePdf();
          } catch (err) {
            console.warn('[penwright] quickSettings style write failed:', err);
          }
        }
        if (qs.lang) {
          handleUpdateSettings({ lang: qs.lang });
        }
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
            appState.mainWindow?.webContents.send('penwright', { type: 'update', content: appState.currentContent });
          }
          appState.mainWindow?.webContents.send('penwright', { type: 'filetreeChanged' });
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
          appState.mainWindow?.webContents.send('penwright', { type: 'filetreeChanged' });
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
        const undone = popAiSnapshot();
        if (!undone) {
          appState.mainWindow?.webContents.send('penwright', {
            type: 'notification',
            message: 'No AI edits to undo.',
          });
        }
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
        console.error('[penwright] Deserialize error in renderer:', error);
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
      const { getTypstPath } = require('./typstPath');
      require('child_process').execFileSync(getTypstPath(), ['--version'], { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  });

  ipcMain.handle('app:getBundleLicenses', () => {
    // Reads the audit-generated `bundle-licenses.json` from extraResources
    // (prod) or the repo path (dev). Powers the Acknowledgments dialog.
    const candidates: string[] = [];
    if (app.isPackaged) {
      candidates.push(path.join(process.resourcesPath, 'typst-packages', 'bundle-licenses.json'));
    }
    candidates.push(path.resolve(__dirname, '..', '..', 'resources', 'typst-packages', 'bundle-licenses.json'));
    for (const c of candidates) {
      try {
        if (fs.existsSync(c)) {
          return JSON.parse(fs.readFileSync(c, 'utf-8'));
        }
      } catch {}
    }
    return { error: 'bundle-licenses.json not found — run `npm run audit:packages` to regenerate.' };
  });

  ipcMain.handle('app:getAbout', () => {
    return {
      version: app.getVersion(),
      electron: process.versions.electron,
      chrome: process.versions.chrome,
      node: process.versions.node,
      platform: process.platform,
      arch: process.arch,
    };
  });

  // Route renderer-initiated external-link clicks through shell.openExternal.
  // We reject anything that isn't an https:// URL so a compromised renderer
  // can't launch `file://` or custom protocol handlers on the host.
  ipcMain.handle('app:openExternal', (_event, url: string) => {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:') return false;
      shell.openExternal(url);
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
    if (!isPathWithinProject(filePath)) return;

    if (filePath.endsWith('.typ')) {
      openFile(filePath);
      return 'editor';
    }

    if (filePath.match(/\.(bib|txt|md|yaml|yml|toml|json|csv|tex)$/i)) {
      appState.mainWindow?.webContents.send('penwright', {
        type: 'openTextFile',
        path: filePath,
      });
      return 'textviewer';
    }

    if (filePath.match(/\.pdf$/i)) {
      appState.mainWindow?.webContents.send('penwright', {
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
        appState.mainWindow?.webContents.send('penwright', { type: 'filetreeChanged' });
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
      appState.mainWindow?.webContents.send('penwright', { type: 'filetreeChanged' });
    }
  });

  // ─── Text File Handlers ─────────────────────────
  ipcMain.handle('textfile:read', async (_event, filePath: string) => {
    if (!isPathWithinProject(filePath)) {
      throw new Error('Access denied: path is outside the project directory.');
    }
    return fs.promises.readFile(filePath, 'utf-8');
  });

  ipcMain.handle('textfile:readBinary', async (_event, filePath: string) => {
    if (!isPathWithinProject(filePath)) {
      throw new Error('Access denied: path is outside the project directory.');
    }
    const buf = await fs.promises.readFile(filePath);
    return buf.toString('base64');
  });

  ipcMain.handle('textfile:write', async (_event, filePath: string, content: string) => {
    if (!isPathWithinProject(filePath)) {
      throw new Error('Access denied: path is outside the project directory.');
    }
    await fs.promises.writeFile(filePath, content, 'utf-8');
    appState.mainWindow?.webContents.send('penwright', { type: 'filetreeChanged' });
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
    if (!isPathWithinProject(absPath)) return;
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
      console.warn('[penwright] Spellcheck language not available:', resolved, err);
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
    appState.mainWindow?.webContents.send('penwright', { type: 'update', content: appState.currentContent });
    appState.mainWindow?.webContents.send('penwright', { type: 'filetreeChanged' });
  });

  // ─── Persistence Handlers ─────────────────────
  ipcMain.handle('persist:getPanelState', () => getPanelState());
  ipcMain.handle('persist:savePanelState', (_event, state: PanelState) => savePanelState(state));
  ipcMain.handle('persist:getRecentProjects', () => getRecentProjects());
  ipcMain.handle('persist:isOnboardingSeen', () => isOnboardingSeen());
  ipcMain.handle('persist:getZoteroBibPath', () => getZoteroBibPath());

  // ─── MCP Setup (Claude Desktop integration) ───
  ipcMain.handle('mcp:checkClaudeDesktop', () => checkClaudeDesktopInstalled());
  ipcMain.handle('mcp:setup', async () => {
    const result = await setupMcpServer();
    saveMcpSetupVersion(MCP_SETUP_VERSION);
    return result;
  });
  ipcMain.handle('mcp:openClaude', async () => {
    await openClaudeDesktop();
    return { ok: true };
  });
  ipcMain.handle('mcp:getSetupStatus', () => ({
    current: MCP_SETUP_VERSION,
    installed: getMcpSetupVersion(),
    needsSetup: getMcpSetupVersion() !== MCP_SETUP_VERSION,
    supported: process.platform === 'darwin',
  }));
  ipcMain.handle('mcp:skipSetup', () => {
    // User dismissed the wizard — stash the current version so we don't
    // nag again until the next bump.
    saveMcpSetupVersion(MCP_SETUP_VERSION);
    return { ok: true };
  });

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

  // Local entitlement (licensed / trial / expired) — the single source of
  // truth for gating in the renderer. Resolves synchronously from stored data.
  ipcMain.handle('license:getEntitlement', () => getEntitlement());

  ipcMain.handle('license:openCheckout', () => {
    shell.openExternal(PENWRIGHT_CHECKOUT_URL);
  });

  // ─── Project Backups & Info ────────────────────
  ipcMain.handle('project:listBackups', () => {
    if (!appState.projectDir) return [];
    return listProjectBackups(appState.projectDir);
  });

  ipcMain.handle('project:loadBackup', (_event, timestamp: string) => {
    if (!appState.projectDir) return [];
    if (!/^[\w-]+$/.test(timestamp)) throw new Error('Invalid backup id.');
    return loadProjectBackup(appState.projectDir, timestamp);
  });

  /**
   * Loads a backup snapshot into the working tree: writes each file from
   * the backup back to disk inside the project. Caller is expected to
   * surface a confirmation dialog beforehand.
   */
  ipcMain.handle('project:applyBackup', async (_event, timestamp: string) => {
    if (!appState.projectDir) throw new Error('No project open.');
    if (!/^[\w-]+$/.test(timestamp)) throw new Error('Invalid backup id.');

    const files = loadProjectBackup(appState.projectDir, timestamp);
    if (files.length === 0) return { ok: false, restored: 0 };

    let restored = 0;
    for (const f of files) {
      const target = path.join(appState.projectDir, f.relPath);
      if (!isPathWithinProject(target)) continue;
      try {
        fs.mkdirSync(path.dirname(target), { recursive: true });
        appState.lastSaveTimestamp = Date.now();
        fs.writeFileSync(target, f.content, 'utf-8');
        restored++;

        // If we just overwrote the currently-open file, refresh the editor
        if (appState.currentFilePath && path.resolve(target) === path.resolve(appState.currentFilePath)) {
          appState.currentContent = f.content;
          appState.isDirty = false;
          updateTitle();
          appState.mainWindow?.webContents.send('penwright', { type: 'update', content: appState.currentContent });
        }
      } catch (err) {
        console.warn('[penwright] Could not restore backup file:', f.relPath, err);
      }
    }

    appState.mainWindow?.webContents.send('penwright', { type: 'filetreeChanged' });
    return { ok: true, restored };
  });

  ipcMain.handle('project:openBackupFolder', () => {
    if (!appState.projectDir) return { ok: false };
    const dir = path.join(appState.projectDir, '.penwright', 'backups');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    shell.openPath(dir);
    return { ok: true };
  });

  ipcMain.handle('project:getBackupConfig', () => getBackupConfig());

  ipcMain.handle('project:setBackupConfig', (_event, config: BackupConfig) => {
    setBackupConfig(config);
    return getBackupConfig();
  });

  // Looks for a PDF in `<project>/sources/` whose filename starts with the
  // citekey (case-insensitive), tolerating common separators between citekey
  // and trailing tokens. Returns absolute path or null. Used by the citation
  // hover card to surface a "Open PDF" button when the source is bundled.
  ipcMain.handle('project:findSourceForCitation', (_event, citekey: string) => {
    return findSourceForCitation(appState.projectDir ?? '', citekey);
  });

  ipcMain.handle('project:showInFinder', () => {
    const target = appState.projectDir || (appState.currentFilePath ? path.dirname(appState.currentFilePath) : null);
    if (!target) return { ok: false };
    shell.openPath(target);
    return { ok: true };
  });

  ipcMain.handle('project:getInfo', () => {
    return {
      projectDir: appState.projectDir,
      currentFilePath: appState.currentFilePath,
      projectName: appState.projectDir ? path.basename(appState.projectDir) : null,
    };
  });

  ipcMain.handle('project:getPreferences', () => {
    if (!appState.projectDir) return null;
    return getProjectPreferences(appState.projectDir);
  });

  ipcMain.handle('project:setPreferences', (_event, prefs: ProjectPreferences) => {
    if (!appState.projectDir) return { ok: false };
    saveProjectPreferences(appState.projectDir, prefs);
    return { ok: true };
  });

  // ─── Style (Design Editor — Phase A) ───────────
  // The "style" knobs (colors, fonts, scale, layout, headings) live in
  // `<project>/.penwright/style.json`; the generated Typst preamble lives in
  // `<project>/style.typ` and is `#include`d from the root file. The
  // renderer's Settings dialog reads via `style:get` and writes via
  // `style:save`; the latter regenerates style.typ, ensures the root file
  // pulls it in, and kicks off a recompile so the live preview updates.

  ipcMain.handle('style:get', () => {
    if (!appState.projectDir) return null;
    const style = getProjectStyle(appState.projectDir);

    // If a `style.typ` exists on disk with manual edits inside the fenced
    // custom block but `style.json.custom.preamble` is empty (e.g. someone
    // hand-edited style.typ between sessions), pull the on-disk version in
    // so the Designer doesn't silently overwrite it on next save.
    if (!style.custom?.preamble) {
      try {
        const rootFile = appState.currentFilePath
          ? findRootFile(appState.currentFilePath)
          : path.join(appState.projectDir, 'main.typ');
        const styleTyp = path.join(
          fs.existsSync(rootFile) ? path.dirname(rootFile) : appState.projectDir,
          'style.typ',
        );
        if (fs.existsSync(styleTyp)) {
          const onDisk = fs.readFileSync(styleTyp, 'utf-8');
          const extracted = extractCustomBlock(onDisk);
          if (extracted && extracted.trim().length > 0) {
            style.custom = { preamble: extracted };
          }
        }
      } catch {}
    }

    return {
      style,
      initialized: hasProjectStyle(appState.projectDir),
    };
  });

  ipcMain.handle('style:save', (_event, raw: unknown) => {
    if (!appState.projectDir) return { ok: false as const, error: 'No project open.' };

    const style = saveProjectStyle(appState.projectDir, raw);

    // 1. Write style.typ next to the root file (sibling of main.typ).
    const rootFile = appState.currentFilePath
      ? findRootFile(appState.currentFilePath)
      : path.join(appState.projectDir, 'main.typ');
    const projectRootDir = fs.existsSync(rootFile) ? path.dirname(rootFile) : appState.projectDir;
    const styleTypPath = path.join(projectRootDir, 'style.typ');

    appState.lastSaveTimestamp = Date.now();
    try {
      fs.writeFileSync(styleTypPath, generateStyleTypst(style), 'utf-8');
    } catch (err) {
      return { ok: false as const, error: err instanceof Error ? err.message : String(err) };
    }

    // 2. Ensure the root file pulls style.typ in. If we can detect conflicting
    // top-level #set rules, surface them so the renderer can warn — but still
    // do the include (Typst's later-wins rule keeps user code working).
    const conflicts: string[] = [];
    if (fs.existsSync(rootFile)) {
      try {
        const before = fs.readFileSync(rootFile, 'utf-8');
        conflicts.push(...detectStylePreambleConflicts(before));
        const after = ensureStyleInclude(before);
        if (after !== before) {
          appState.lastSaveTimestamp = Date.now();
          fs.writeFileSync(rootFile, after, 'utf-8');
          // If we just modified the open buffer, sync the editor state.
          if (appState.currentFilePath && path.resolve(rootFile) === path.resolve(appState.currentFilePath)) {
            appState.currentContent = after;
            appState.isDirty = false;
            updateTitle();
            appState.mainWindow?.webContents.send('penwright', { type: 'update', content: appState.currentContent });
          }
        }
      } catch (err) {
        return { ok: false as const, error: err instanceof Error ? err.message : String(err) };
      }
    }

    // 3. Recompile so the live preview reflects the change.
    getCompiler()?.compilePdf();

    appState.mainWindow?.webContents.send('penwright', { type: 'filetreeChanged' });
    return { ok: true as const, style, conflicts };
  });

  // ─── Section styles (Phase E — per-chapter design) ───
  // Variant definitions live in style.json (saved via style:save, which
  // regenerates style.typ with one `#let <id>-style` per variant). These
  // handlers manage the per-chapter opt-in: which variant a chapter uses, and
  // injecting / clearing the scoped `#show` at the top of a chapter file.

  function regenerateStyleTyp(style: ProjectStyle): void {
    if (!appState.projectDir) return;
    const rootFile = appState.currentFilePath ? findRootFile(appState.currentFilePath) : path.join(appState.projectDir, 'main.typ');
    const projectRootDir = fs.existsSync(rootFile) ? path.dirname(rootFile) : appState.projectDir;
    appState.lastSaveTimestamp = Date.now();
    fs.writeFileSync(path.join(projectRootDir, 'style.typ'), generateStyleTypst(style), 'utf-8');
    if (fs.existsSync(rootFile)) {
      const before = fs.readFileSync(rootFile, 'utf-8');
      const after = ensureStyleInclude(before);
      if (after !== before) {
        appState.lastSaveTimestamp = Date.now();
        fs.writeFileSync(rootFile, after, 'utf-8');
        if (appState.currentFilePath && path.resolve(rootFile) === path.resolve(appState.currentFilePath)) {
          appState.currentContent = after;
          appState.isDirty = false;
          updateTitle();
          appState.mainWindow?.webContents.send('penwright', { type: 'update', content: after });
        }
      }
    }
  }

  function resolveChapter(relPath: string): string | null {
    if (!appState.projectDir) return null;
    const abs = path.resolve(appState.projectDir, relPath);
    if (!isPathWithin(abs, appState.projectDir) || !fs.existsSync(abs)) return null;
    return abs;
  }

  function chapterImportPath(chapterAbs: string): string {
    const rootFile = appState.currentFilePath ? findRootFile(appState.currentFilePath) : path.join(appState.projectDir!, 'main.typ');
    const rootDir = fs.existsSync(rootFile) ? path.dirname(rootFile) : appState.projectDir!;
    return path.relative(path.dirname(chapterAbs), path.join(rootDir, 'style.typ')).split(path.sep).join('/');
  }

  /** Writes a chapter file, syncing the open editor buffer + recompiling. */
  function writeChapterSynced(chapterAbs: string, content: string): void {
    appState.lastSaveTimestamp = Date.now();
    fs.writeFileSync(chapterAbs, content, 'utf-8');
    if (appState.currentFilePath && path.resolve(chapterAbs) === path.resolve(appState.currentFilePath)) {
      appState.currentContent = content;
      appState.isDirty = false;
      updateTitle();
      appState.mainWindow?.webContents.send('penwright', { type: 'update', content });
    }
    getCompiler()?.compilePdf();
  }

  ipcMain.handle('section:get', (_event, relPath: string) => {
    const abs = resolveChapter(relPath);
    if (!abs) return null;
    try { return getSectionStyleId(fs.readFileSync(abs, 'utf-8')); } catch { return null; }
  });

  ipcMain.handle('section:apply', (_event, relPath: string, styleId: string) => {
    if (!appState.projectDir) return { ok: false as const, error: 'No project open.' };
    const abs = resolveChapter(relPath);
    if (!abs) return { ok: false as const, error: 'Chapter not found.' };
    // Ensure the variant is defined + style.typ regenerated so the import resolves.
    const style = getProjectStyle(appState.projectDir);
    if (!style.sections.some(s => s.id === styleId)) {
      const preset = getSectionPreset(styleId);
      if (!preset) return { ok: false as const, error: `Unknown section style "${styleId}".` };
      style.sections.push(preset);
      const saved = saveProjectStyle(appState.projectDir, style);
      regenerateStyleTyp(saved);
    }
    try {
      const src = fs.readFileSync(abs, 'utf-8');
      writeChapterSynced(abs, ensureSectionStyle(src, styleId, chapterImportPath(abs)));
    } catch (err) {
      return { ok: false as const, error: err instanceof Error ? err.message : String(err) };
    }
    return { ok: true as const };
  });

  ipcMain.handle('section:clear', (_event, relPath: string) => {
    if (!appState.projectDir) return { ok: false as const, error: 'No project open.' };
    const abs = resolveChapter(relPath);
    if (!abs) return { ok: false as const, error: 'Chapter not found.' };
    try {
      const src = fs.readFileSync(abs, 'utf-8');
      writeChapterSynced(abs, clearSectionStyle(src));
    } catch (err) {
      return { ok: false as const, error: err instanceof Error ? err.message : String(err) };
    }
    return { ok: true as const };
  });

  ipcMain.handle('project:open', async (_event, projectDir?: string) => {
    const result = await openProject(projectDir);
    return { ok: !!result, projectDir: result };
  });

  ipcMain.handle('project:openSample', async () => {
    const result = await openSampleProject();
    return { ok: !!result, projectDir: result };
  });

  ipcMain.handle('project:close', async () => {
    const closed = await closeProjectInteractive();
    return { ok: closed };
  });

  ipcMain.handle('project:newFolder', async (_event, args: { parentRelPath?: string; name: string }) => {
    return handleNewFolder(args.parentRelPath ?? '', args.name);
  });

  ipcMain.handle('project:addAssets', async () => {
    return handleAddAssets();
  });

  ipcMain.handle('export:getSections', () => {
    return getExportableSections();
  });

  ipcMain.handle('export:run', async (_event, config: ExportConfig) => {
    const written = await runFilteredExport(config);
    return { ok: !!written, path: written };
  });

  // ─── Project-wide Search & Replace ──────────────
  ipcMain.handle('project:search', (_event, opts: SearchOptions) => {
    return searchProject(opts);
  });

  ipcMain.handle('project:replaceAll', (_event, opts: ReplaceOptions) => {
    return replaceInProject(opts);
  });

  ipcMain.handle('project:listLabels', () => {
    return listProjectLabels();
  });

  // ─── Comments / Annotations ─────────────────────
  ipcMain.handle('comments:list', (_event, opts?: ListOptions) => {
    if (!appState.projectDir) return [];
    return listComments(appState.projectDir, opts ?? {});
  });

  ipcMain.handle('comments:create', (_event, args: CreateArgs) => {
    if (!appState.projectDir) return null;
    const created = createComment(appState.projectDir, args);
    if (created) {
      appState.mainWindow?.webContents.send('penwright', { type: 'filetreeChanged' });
    }
    return created;
  });

  ipcMain.handle('comments:update', (_event, id: string, patch: UpdateArgs) => {
    if (!appState.projectDir) return null;
    return updateComment(appState.projectDir, id, patch);
  });

  ipcMain.handle('comments:delete', (_event, id: string) => {
    if (!appState.projectDir) return false;
    const ok = deleteComment(appState.projectDir, id);
    if (ok) {
      appState.mainWindow?.webContents.send('penwright', { type: 'filetreeChanged' });
    }
    return ok;
  });

  // Ensure repo + .gitignore + .penwright/ for projects opened that pre-date this version.
  ipcMain.handle('git:ensureRepo', async () => {
    if (!appState.projectDir) return { initialized: false };
    await ensureProjectInfrastructure(appState.projectDir, 'First version');
    return { initialized: true };
  });

  // ─── Crash Reports ─────────────────────────────
  // Renderer-side error handlers POST their crash payload here.
  ipcMain.handle('crash:report', (_event, payload: RendererCrashPayload) => {
    const written = captureRendererCrash(payload);
    return { ok: !!written };
  });

  // Returns the latest crash report not yet shown to the user, or null.
  ipcMain.handle('crash:getLatest', () => {
    return getLatestUnshownReport();
  });

  // Updates the "last shown" marker so the dialog won't reappear next boot.
  ipcMain.handle('crash:markShown', () => {
    markLatestAsShown();
    return { ok: true };
  });

  ipcMain.handle('crash:deleteAll', () => {
    deleteAllReports();
    return { ok: true };
  });

  ipcMain.handle('crash:openFolder', () => {
    shell.openPath(getReportsDir());
    return { ok: true };
  });

  // Copies the report to the clipboard via main (avoids navigator.clipboard
  // permission noise in the renderer).
  ipcMain.handle('crash:copyToClipboard', (_event, content: string) => {
    if (typeof content !== 'string') return { ok: false };
    clipboard.writeText(content);
    return { ok: true };
  });

  // Opens the OS default mail client with the report pre-filled. Body is
  // truncated for mailto length safety; the user can attach the full file
  // separately if they want.
  ipcMain.handle('crash:openMail', (_event, content: string) => {
    const subject = encodeURIComponent('Penwright Crash Report');
    const truncated = content.length > 1500
      ? content.slice(0, 1500) + '\n\n... (gekuerzt — vollstaendiger Bericht im crash-reports/-Ordner)'
      : content;
    const url = `mailto:feedback@penwright.online?subject=${subject}&body=${encodeURIComponent(truncated)}`;
    shell.openExternal(url);
    return { ok: true };
  });
}
