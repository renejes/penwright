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
  getStyleJsonPath,
  saveSelectionPin,
  getSelectionPin,
  clearSelectionPin,
  getMcpSetupVersion,
  saveMcpSetupVersion,
  type PanelState,
  type BackupConfig,
  type ProjectPreferences,
} from './persistenceManager';
import { THEME_PRESETS } from '../shared/themePresets';
import {
  SELECTION_PIN_VERSION,
  type SelectionPin,
  type SelectionAnchorInput,
} from '../shared/selectionTypes';
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
import { type ProjectStyle, type SectionStyle, sanitizeProjectStyle, sanitizeSection } from '../shared/styleTypes';
import { findRootFile } from '../shared/rootFinder';
import { getCompiler } from './fileManager';
import {
  checkClaudeDesktopInstalled,
  setupMcpServer,
  openClaudeDesktop,
  isMcpSetupSupported,
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

// ─── Selection-pin design snapshot (helpers) ─────────────────────
// Used when pinning a selection ("Design with AI") to capture the
// document's current look so Claude designs the spot in harmony.

/**
 * Best-effort match of the current style against a built-in theme. Compares
 * the five colour slots + body/heading fonts; returns the theme id or null
 * if the look has been customised away from any preset.
 */
function matchThemeId(style: ProjectStyle): string | null {
  for (const t of THEME_PRESETS) {
    const c = t.style.colors, f = t.style.fonts;
    if (
      c.primary === style.colors.primary && c.accent === style.colors.accent &&
      c.text === style.colors.text && c.background === style.colors.background &&
      c.muted === style.colors.muted &&
      f.body === style.fonts.body && f.heading === style.fonts.heading
    ) return t.id;
  }
  return null;
}

/**
 * Coarse, best-effort scan for design constructs already present in a file —
 * so Claude can avoid introducing a clashing third variant. Each signature
 * targets the generated `designElements.ts` template or a distinctive Typst
 * construct; a miss is harmless (Claude still gets palette/fonts/layout). Not
 * meant to be exhaustive.
 */
function scanUsedDesignSignals(content: string): string[] {
  const signals: Array<{ tag: string; re: RegExp }> = [
    { tag: 'columns',       re: /#columns\s*\(/ },
    { tag: 'margin-note',   re: /margin-note\s*\(/ },
    { tag: 'wrapped-photo', re: /wrap-content\s*\(/ },
    { tag: 'drop-cap',      re: /drop-?cap|dropcap/i },
    { tag: 'pull-quote',    re: /length:\s*25%,\s*stroke:\s*1pt\s*\+\s*style-colors\.accent/ },
    { tag: 'divider',       re: /stroke:\s*0\.5pt\s*\+\s*style-colors\.muted/ },
    { tag: 'callout',       re: /stroke:\s*\(left:\s*4pt\s*\+\s*style-colors\.accent\)/ },
    { tag: 'sidebar',       re: /stroke:\s*\(left:\s*3pt\s*\+\s*style-colors\.accent\)/ },
    { tag: 'banner',        re: /width:\s*100%,\s*fill:\s*style-colors\.primary/ },
    { tag: 'hero',          re: /size:\s*2\.8em,\s*weight:\s*"bold",\s*fill:\s*style-colors\.primary/ },
  ];
  return signals.filter(s => s.re.test(content)).map(s => s.tag);
}

/**
 * Resolves the project's **design home** — the root document that global
 * style is written next to (style.typ sibling + the `#show: apply-style`
 * import). Global design must NEVER be written into an open chapter file (it
 * would inject page setup + duplicate the show rule and break compilation), so
 * we prefer a conventional root document at the project root over
 * `findRootFile(openFile)`. Mirrors the MCP server's candidate resolution.
 *
 * Order: main.typ / document.typ / index.typ at the project root → else walk
 * up the include chain from the open file → else `<project>/main.typ`.
 */
function resolveStyleRootFile(): string {
  const dir = appState.projectDir;
  if (!dir) return path.join(appState.currentFilePath ? path.dirname(appState.currentFilePath) : '', 'main.typ');
  for (const name of ['main.typ', 'document.typ', 'index.typ']) {
    const candidate = path.join(dir, name);
    if (fs.existsSync(candidate)) return candidate;
  }
  if (appState.currentFilePath) return findRootFile(appState.currentFilePath);
  return path.join(dir, 'main.typ');
}

// ─── Safe-apply engine ("every design change is a safe experiment") ──────
// Design mutations (global style, per-chapter looks) are staged, then the
// document is compiled to verify it still works BEFORE the change is
// committed. If a change would break a previously-working document, it's
// rolled back and the last-good look stays on screen — the document is never
// left in a non-compiling state by a design action, and every applied change
// can be undone via the design-undo stack.

interface DesignUndoEntry {
  label: string;
  files: { abs: string; old: string | null }[];   // old === null → file didn't exist
}
const designUndoStack: DesignUndoEntry[] = [];
const DESIGN_UNDO_MAX = 25;

function pushDesignUndo(label: string, files: { abs: string; old: string | null }[]): void {
  designUndoStack.push({ label, files });
  if (designUndoStack.length > DESIGN_UNDO_MAX) designUndoStack.shift();
}

/** If `abs` is the currently-open file, push the new content into the editor. */
function syncOpenBuffer(abs: string, content: string): void {
  if (appState.currentFilePath && path.resolve(abs) === path.resolve(appState.currentFilePath)) {
    appState.currentContent = content;
    appState.isDirty = false;
    updateTitle();
    appState.mainWindow?.webContents.send('penwright', { type: 'update', content });
  }
}

/**
 * Write the given files, verify the document still compiles, then commit
 * (emit the fresh preview + record an undo entry) or roll back (restore the
 * previous files; the last-good preview stays). When the document was already
 * failing to compile, the change is committed without a verify (a design
 * action shouldn't be blamed for a pre-existing content error).
 */
async function safeApplyDesign(
  writes: { abs: string; content: string }[],
  label: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const olds = writes.map((w) => ({
    abs: w.abs,
    old: fs.existsSync(w.abs) ? fs.readFileSync(w.abs, 'utf-8') : null,
  }));

  // Stage the new contents.
  appState.lastSaveTimestamp = Date.now();
  for (const w of writes) {
    fs.mkdirSync(path.dirname(w.abs), { recursive: true });
    fs.writeFileSync(w.abs, w.content, 'utf-8');
  }

  const compiler = getCompiler();

  // Can't (or needn't) verify: no compiler yet, or the doc was already broken
  // → commit and let the normal compile run.
  if (!compiler || !appState.lastCompileOk) {
    for (const w of writes) syncOpenBuffer(w.abs, w.content);
    pushDesignUndo(label, olds);
    compiler?.compilePdf();
    appState.mainWindow?.webContents.send('penwright', { type: 'filetreeChanged' });
    return { ok: true };
  }

  const result = await compiler.verify();
  if (result.ok) {
    for (const w of writes) syncOpenBuffer(w.abs, w.content);
    pushDesignUndo(label, olds);
    appState.lastCompileOk = true;
    appState.mainWindow?.webContents.send('penwright', {
      type: 'previewPdfUpdate',
      pdfData: result.pdf.toString('base64'),
    });
    appState.mainWindow?.webContents.send('penwright', { type: 'filetreeChanged' });
    return { ok: true };
  }

  // Roll back to the previous (working) state. Preview is untouched, so the
  // last-good look stays visible.
  appState.lastSaveTimestamp = Date.now();
  for (const o of olds) {
    if (o.old === null) {
      try { fs.unlinkSync(o.abs); } catch {}
    } else {
      try { fs.writeFileSync(o.abs, o.old, 'utf-8'); } catch {}
      syncOpenBuffer(o.abs, o.old);
    }
  }
  const error = result.errors.map((e) => e.message).join('\n') || 'Compilation failed';
  return { ok: false, error };
}

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
        // The user guide ships in-app (HandbookViewer); open it instead of an
        // external URL. (The old vswrite.netlify.app domain is dead + a hijack
        // risk, and contradicts the in-app-handbook design.)
        appState.mainWindow?.webContents.send('penwright', { type: 'showHandbook' });
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
  ipcMain.handle('persist:setOnboardingSeen', (_event, seen: boolean) => { setOnboardingSeen(!!seen); return { ok: true }; });
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
    supported: isMcpSetupSupported(),
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
        const rootFile = resolveStyleRootFile();
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
      // The design home — shown in the Design panel so the user knows global
      // style always targets this file, never the open chapter.
      rootFile: path.basename(resolveStyleRootFile()),
    };
  });

  ipcMain.handle('style:save', async (_event, raw: unknown) => {
    if (!appState.projectDir) return { ok: false as const, error: 'No project open.' };

    const clean = sanitizeProjectStyle(raw);

    // style.typ lands next to the project's design home (root document).
    // resolveStyleRootFile() guarantees we never target an open chapter.
    const rootFile = resolveStyleRootFile();
    const projectRootDir = fs.existsSync(rootFile) ? path.dirname(rootFile) : appState.projectDir;

    // Batch the three files so a failed compile rolls ALL of them back together
    // (incl. style.json, so the Design panel reflects what's actually applied).
    const writes: { abs: string; content: string }[] = [
      { abs: getStyleJsonPath(appState.projectDir), content: JSON.stringify(clean, null, 2) },
      { abs: path.join(projectRootDir, 'style.typ'), content: generateStyleTypst(clean) },
    ];

    // Ensure the root file pulls style.typ in (one-time). Surface conflicting
    // top-level #set rules so the renderer can warn — but still do the include.
    const conflicts: string[] = [];
    if (fs.existsSync(rootFile)) {
      try {
        const before = fs.readFileSync(rootFile, 'utf-8');
        conflicts.push(...detectStylePreambleConflicts(before));
        const after = ensureStyleInclude(before);
        if (after !== before) writes.push({ abs: rootFile, content: after });
      } catch (err) {
        return { ok: false as const, error: err instanceof Error ? err.message : String(err) };
      }
    }

    const res = await safeApplyDesign(writes, 'Design geändert');
    if (!res.ok) return { ok: false as const, error: res.error, kept: true as const };
    return { ok: true as const, style: clean, conflicts };
  });

  // ─── Section styles (Phase E — per-chapter design) ───
  // Variant definitions live in style.json (saved via style:save, which
  // regenerates style.typ with one `#let <id>-style` per variant). These
  // handlers manage the per-chapter opt-in: which variant a chapter uses, and
  // injecting / clearing the scoped `#show` at the top of a chapter file.

  function regenerateStyleTyp(style: ProjectStyle): void {
    if (!appState.projectDir) return;
    const rootFile = resolveStyleRootFile();
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
    const rootFile = resolveStyleRootFile();
    const rootDir = fs.existsSync(rootFile) ? path.dirname(rootFile) : appState.projectDir!;
    return path.relative(path.dirname(chapterAbs), path.join(rootDir, 'style.typ')).split(path.sep).join('/');
  }

  ipcMain.handle('section:get', (_event, relPath: string) => {
    const abs = resolveChapter(relPath);
    if (!abs) return null;
    try { return getSectionStyleId(fs.readFileSync(abs, 'utf-8')); } catch { return null; }
  });

  // Context for the "chapter look" control: is the given file a real content
  // chapter (a .typ pulled in via `#include` by the document), and which look
  // does it use? `#import`ed modules (macros.typ / style.typ) are NOT chapters
  // — findRootFile only walks `#include` edges, so a file it can climb out of
  // is genuinely included content; one that's its own root is not.
  ipcMain.handle('section:context', (_event, filePath: string) => {
    if (!appState.projectDir) return { isChapter: false, styleId: null };
    const abs = path.resolve(appState.projectDir, filePath);
    if (!isPathWithin(abs, appState.projectDir) || !fs.existsSync(abs) || !abs.endsWith('.typ')) {
      return { isChapter: false, styleId: null };
    }
    if (path.basename(abs) === 'style.typ') return { isChapter: false, styleId: null };
    const isChapter = path.resolve(findRootFile(abs)) !== abs;
    let styleId: string | null = null;
    try { styleId = getSectionStyleId(fs.readFileSync(abs, 'utf-8')); } catch { /* none */ }
    return { isChapter, styleId };
  });

  // Full definition of a rubric (for the chapter-look editor): the project's
  // defined variant if present, else the built-in preset.
  ipcMain.handle('section:getStyle', (_event, styleId: string) => {
    if (!appState.projectDir || !styleId) return null;
    const style = getProjectStyle(appState.projectDir);
    return style.sections.find(s => s.id === styleId) ?? getSectionPreset(styleId) ?? null;
  });

  // Save an edited rubric. `scope: 'all'` updates the shared rubric (every
  // chapter using it re-themes); `scope: 'this'` forks a chapter-unique copy
  // and assigns it to just this chapter. Both go through safe-apply.
  ipcMain.handle('section:saveStyle', async (_event, args: { chapterPath: string; styleId: string; style: unknown; scope: 'all' | 'this' }) => {
    if (!appState.projectDir) return { ok: false as const, error: 'No project open.' };
    const projectDir = appState.projectDir;
    const edited = sanitizeSection(args.style);
    if (!edited) return { ok: false as const, error: 'Invalid section style.' };

    const current = getProjectStyle(projectDir);
    const sections: SectionStyle[] = [...current.sections];
    let finalId = args.styleId;
    let chapterAbs: string | null = null;

    if (args.scope === 'all') {
      edited.id = args.styleId;
      const idx = sections.findIndex(s => s.id === args.styleId);
      if (idx >= 0) sections[idx] = edited; else sections.push(edited);
    } else {
      // Fork into a chapter-unique rubric.
      const chapterName = path.basename(args.chapterPath, '.typ');
      let forkId = `${args.styleId}-${chapterName}`.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
      if (!forkId) forkId = `${args.styleId}-x`;
      let n = 2;
      while (sections.some(s => s.id === forkId)) forkId = `${args.styleId}-${n++}`;
      edited.id = forkId;
      edited.name = `${edited.name} (${chapterName})`;
      sections.push(edited);
      finalId = forkId;
      chapterAbs = resolveChapter(args.chapterPath);
      if (!chapterAbs) return { ok: false as const, error: 'Chapter not found.' };
    }

    const newStyle = sanitizeProjectStyle({ ...current, sections });
    const rootFile = resolveStyleRootFile();
    const projectRootDir = fs.existsSync(rootFile) ? path.dirname(rootFile) : projectDir;
    const writes: { abs: string; content: string }[] = [
      { abs: getStyleJsonPath(projectDir), content: JSON.stringify(newStyle, null, 2) },
      { abs: path.join(projectRootDir, 'style.typ'), content: generateStyleTypst(newStyle) },
    ];
    if (chapterAbs) {
      try {
        const src = fs.readFileSync(chapterAbs, 'utf-8');
        writes.push({ abs: chapterAbs, content: ensureSectionStyle(src, finalId, chapterImportPath(chapterAbs)) });
      } catch (err) {
        return { ok: false as const, error: err instanceof Error ? err.message : String(err) };
      }
    }

    const res = await safeApplyDesign(writes, 'Kapitel-Look angepasst');
    if (!res.ok) return { ok: false as const, error: res.error, kept: true as const };
    return { ok: true as const, styleId: finalId };
  });

  ipcMain.handle('section:apply', async (_event, relPath: string, styleId: string) => {
    if (!appState.projectDir) return { ok: false as const, error: 'No project open.' };
    const abs = resolveChapter(relPath);
    if (!abs) return { ok: false as const, error: 'Chapter not found.' };
    // Ensure the variant is defined + style.typ regenerated so the import
    // resolves. Section presets are well-formed, so this structured write
    // doesn't go through safe-apply; the risky part is the chapter injection.
    const style = getProjectStyle(appState.projectDir);
    if (!style.sections.some(s => s.id === styleId)) {
      const preset = getSectionPreset(styleId);
      if (!preset) return { ok: false as const, error: `Unknown section style "${styleId}".` };
      style.sections.push(preset);
      const saved = saveProjectStyle(appState.projectDir, style);
      regenerateStyleTyp(saved);
    }
    let injected: string;
    try {
      injected = ensureSectionStyle(fs.readFileSync(abs, 'utf-8'), styleId, chapterImportPath(abs));
    } catch (err) {
      return { ok: false as const, error: err instanceof Error ? err.message : String(err) };
    }
    // Verify the chapter still compiles with the look applied; roll back if not.
    const res = await safeApplyDesign([{ abs, content: injected }], `Kapitel-Look: ${styleId}`);
    if (!res.ok) return { ok: false as const, error: res.error, kept: true as const };
    return { ok: true as const };
  });

  ipcMain.handle('section:clear', async (_event, relPath: string) => {
    if (!appState.projectDir) return { ok: false as const, error: 'No project open.' };
    const abs = resolveChapter(relPath);
    if (!abs) return { ok: false as const, error: 'Chapter not found.' };
    let cleared: string;
    try {
      cleared = clearSectionStyle(fs.readFileSync(abs, 'utf-8'));
    } catch (err) {
      return { ok: false as const, error: err instanceof Error ? err.message : String(err) };
    }
    const res = await safeApplyDesign([{ abs, content: cleared }], 'Kapitel-Look entfernt');
    if (!res.ok) return { ok: false as const, error: res.error, kept: true as const };
    return { ok: true as const };
  });

  // ─── Design undo ───
  // Pops the last design change off the safe-apply stack and restores the
  // files it touched, then recompiles. Lets the user fearlessly try looks.
  // Absolute path of the document's style.typ (the global Look file). Opened
  // by the "Look" status control to show the visual designer.
  ipcMain.handle('project:lookFile', () => {
    if (!appState.projectDir) return null;
    const rootFile = resolveStyleRootFile();
    const dir = fs.existsSync(rootFile) ? path.dirname(rootFile) : appState.projectDir;
    return path.join(dir, 'style.typ');
  });

  ipcMain.handle('design:canUndo', () => ({
    canUndo: designUndoStack.length > 0,
    label: designUndoStack[designUndoStack.length - 1]?.label ?? null,
  }));

  ipcMain.handle('design:undo', () => {
    const entry = designUndoStack.pop();
    if (!entry) return { ok: false as const, error: 'Nothing to undo.' };
    appState.lastSaveTimestamp = Date.now();
    for (const f of entry.files) {
      try {
        if (f.old === null) {
          if (fs.existsSync(f.abs)) fs.unlinkSync(f.abs);
        } else {
          fs.mkdirSync(path.dirname(f.abs), { recursive: true });
          fs.writeFileSync(f.abs, f.old, 'utf-8');
          syncOpenBuffer(f.abs, f.old);
        }
      } catch { /* best-effort per file */ }
    }
    getCompiler()?.compilePdf();
    appState.mainWindow?.webContents.send('penwright', { type: 'filetreeChanged' });
    return { ok: true as const, label: entry.label, remaining: designUndoStack.length };
  });

  // ─── Selection pin ("Design after writing") ───
  // The renderer captures the selection anchor (text + occurrence + node type)
  // from the editor; main assembles the design snapshot (theme / palette /
  // fonts / layout / section style / used elements) and writes the full pin to
  // `.penwright/selection.json`, which the MCP `penwright_get_selection` reads.

  ipcMain.handle('selection:pin', (_event, input: SelectionAnchorInput) => {
    if (!appState.projectDir) return { ok: false as const, error: 'No project open.' };
    const projectDir = appState.projectDir;
    const abs = path.resolve(projectDir, input.file);
    if (!isPathWithin(abs, projectDir)) return { ok: false as const, error: 'File outside project.' };

    // Prefer the live editor buffer if the pinned file is the open one;
    // otherwise read from disk (best-effort — only used for the snapshot).
    let content = '';
    if (appState.currentFilePath && path.resolve(appState.currentFilePath) === abs) {
      content = appState.currentContent ?? '';
    } else {
      try { content = fs.readFileSync(abs, 'utf-8'); } catch { content = ''; }
    }

    const style = getProjectStyle(projectDir);
    const pin: SelectionPin = {
      version: SELECTION_PIN_VERSION,
      pinnedAt: Date.now(),
      file: input.file.replace(/\\/g, '/'),
      selectionText: input.selectionText,
      anchorText: input.anchorText,
      occurrence: input.occurrence,
      nodeType: input.nodeType,
      context: {
        theme: matchThemeId(style),
        palette: { ...style.colors },
        fonts: { body: style.fonts.body, heading: style.fonts.heading, code: style.fonts.code },
        layout: { paper: style.layout.paper, orientation: style.layout.orientation, columns: style.layout.columns },
        sectionStyle: getSectionStyleId(content),
        usedElements: scanUsedDesignSignals(content),
      },
    };
    saveSelectionPin(projectDir, pin);
    return { ok: true as const, pin };
  });

  ipcMain.handle('selection:get', () => {
    if (!appState.projectDir) return null;
    return getSelectionPin(appState.projectDir);
  });

  ipcMain.handle('selection:clear', () => {
    if (!appState.projectDir) return { ok: false as const };
    clearSelectionPin(appState.projectDir);
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
