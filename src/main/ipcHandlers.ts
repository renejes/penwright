/**
 * IPC Handlers — extracted from index.ts
 * Central message router: switch-statement + dialog/filetree/includes handlers.
 */

import { ipcMain, dialog, shell, app, clipboard } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { execFileSync } from 'child_process';
import { parseSettings } from '../shared/settingsParser';
import { resolveIncludes } from '../shared/mergeDocument';
import { splitIntoChapters, slugify } from '../shared/splitDocument';
import { templates as projectTemplates } from '../shared/projectTemplates';
import { appState } from './appState';
import { resolveDict } from '../shared/i18n';
import { buildMenu } from './menuBuilder';
import { openFile, saveFile, saveFileAs, autoSave, updateTitle, publishSession, popAiSnapshot, getAiSnapshotsList, getAiSnapshotCount, closeProjectInteractive , applySpellcheckLanguage } from './fileManager';
import { isPathWithin } from './pathSecurity';
import { getTypstPath } from './typstPath';

/** Validates that a file path is within the current project directory (symlink-aware). */
function isPathWithinProject(filePath: string): boolean {
  const projectRoot = appState.projectDir || (appState.currentFilePath ? path.dirname(appState.currentFilePath) : null);
  return isPathWithin(filePath, projectRoot);
}
import { handleRequestCitations, getExportableSections, runFilteredExport, runWebExport, preflightPrintImages, type ExportConfig } from './importExport';
import { handleCreateProject, handlePickImage, handleDropImage, handleDropImagePath, handleRequestSettings, handleUpdateSettings, readDirTree, ensureProjectInfrastructure, openProject, openSampleProject, handleNewFolder, handleAddAssets, pickAssetPath } from './projectManager';
import { buildGallery, createFromPreset, saveProjectAsPreset, deleteUserPreset, listPresetStyles, getPresetStyle, renderPresetPreview } from './presetManager';
import {
  getPanelState,
  savePanelState,
  getRecentProjects,
  isOnboardingSeen,
  setOnboardingSeen,
  getLocale,
  setLocale,
  getPreviewMode,
  setPreviewMode,
  listProjectBackups,
  loadProjectBackup,
  getBackupConfig,
  setBackupConfig,
  getProjectPreferences,
  saveProjectPreferences,
  getProjectStyle,
  hasProjectStyle,
  saveSelectionPin,
  getSelectionPin,
  clearSelectionPin,
  getMcpSetupVersion,
  saveMcpSetupVersion,
  getMcpTarget,
  setMcpTarget,
  setUsageContext,
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
  detectStylePreambleConflicts,
  ensureSectionStyle,
  clearSectionStyle,
  getSectionStyleId,
} from '../shared/styleParser';
import { getSectionPreset } from '../shared/sectionPresets';
import { type ProjectStyle, type SectionStyle, sanitizeProjectStyle, sanitizeSection } from '../shared/styleTypes';
import { findRootFile } from '../shared/rootFinder';
import { planBibliography, BIB_HEADER } from '../shared/bibDiscovery';
import { noteDiskContent, noteDeleted } from '../shared/fileWrite';
import { safeApply, fsIO, type SafeApplyIO, type VerifyOutcome } from '../shared/safeApply';
import { publishSnapshotLimit } from '../shared/editHistory';
import { planAddChapter, resolveDocumentRoot, noDocumentRootMessage } from '../shared/chapterWrite';
import { readAgentActivity } from '../shared/sessionState';
import type { TypstCompiler } from './typstCompiler';
import {
  planStyleWrites,
  readProjectStyleWithCustom,
  resolveDesignRoot,
  styleTypDir,
  STYLE_TYP_BASENAME,
} from '../shared/styleWrite';
import { getCompiler } from './fileManager';
import {
  checkClaudeDesktopInstalled,
  setupMcpServer,
  openClaudeDesktop,
  isMcpSetupSupported,
  MCP_SETUP_VERSION,
  buildMcpEnv,
} from './mcpSetup';
import {
  ensureMcpTarget,
  probeMetaMcp,
  getMetaConfigPath,
  getClaudeCodeConfigPath,
  type McpTarget,
} from './mcpRegistration';
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
  addBreadcrumb,
  type RendererCrashPayload,
} from './crashReporter';
import { listProjectLabels } from './projectLabels';
import { listProjectMacros } from './projectMacros';
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
 * The project's **design home** — the root document global style is written
 * next to (style.typ sibling + the `#show: apply-style` import). Global design
 * must NEVER land in an open chapter (it would inject page setup + duplicate
 * the show rule and break compilation), so a conventional root document at the
 * project root wins over `findRootFile(openFile)`.
 *
 * This is the *display* variant: several callers want a string label. The
 * resolution itself comes from `resolveDesignRoot`, shared with the MCP
 * server, so both processes agree on where the design lives. The `main.typ`
 * tail is a label fallback only — no write path goes through it any more.
 * Writers use `planStyleWrites`, which returns null rather than naming a file
 * that doesn't exist (creating one would permanently move the design home).
 */
function resolveStyleRootFile(): string {
  const dir = appState.projectDir;
  if (!dir) return path.join(appState.currentFilePath ? path.dirname(appState.currentFilePath) : '', 'main.typ');
  return resolveDesignRoot(dir, appState.currentFilePath) ?? path.join(dir, 'main.typ');
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

/**
 * Drops every pending design undo.
 *
 * The stack holds byte snapshots taken before OUR design writes. It knows
 * nothing about writes from the MCP server, so once the agent has changed the
 * design, an entry says "restore the bytes from before the human's last
 * palette" — and applying it overwrites the agent's whole layout while the
 * button still reads "Farbpalette" and reports success. On a project without
 * Git that is unrecoverable: the restore records its own write as ours, so the
 * watcher never snapshots what it replaced.
 *
 * Called when the design changes underneath us and when a project closes (the
 * entries hold absolute paths into a project nobody has open any more).
 */
export function clearDesignUndo(): void {
  designUndoStack.length = 0;
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
 * Filesystem access for the safe-apply engine, with this process's provenance
 * bookkeeping attached.
 *
 * The `noteDiskContent` / `noteDeleted` calls are load-bearing on both the
 * staging and the rollback path: without them the watcher counts our own write
 * as foreign, triggers the very recompile a rollback promises not to, and
 * leaves a stale record that later swallows an identical write coming from the
 * MCP server.
 */
const appSafeApplyIO: SafeApplyIO = {
  read: fsIO.read,
  write(abs, content) {
    fsIO.write(abs, content);
    noteDiskContent(abs, content);
  },
  remove(abs) {
    if (!fs.existsSync(abs)) return;
    // Deliberately unguarded: if the unlink fails, the throw propagates and
    // safeApply reports `restored: false`. Swallowing it would run
    // `noteDeleted` on a file that is still there, leaving a record claiming
    // the opposite of the truth — the same class of stale-record bug that
    // c5f22cd fixed on the rollback-write path.
    fs.unlinkSync(abs);
    noteDeleted(abs);
  },
};

/**
 * Write the given files, verify the document still compiles, then commit
 * (emit the fresh preview + record an undo entry) or roll back (restore the
 * previous files; the last-good preview stays). When the document was already
 * failing to compile, the change is committed without a verify (a design
 * action shouldn't be blamed for a pre-existing content error).
 *
 * The staging / verify / rollback mechanic itself lives in `shared/safeApply`
 * so the MCP server runs the identical sequence against the identical files.
 * What stays here is what only this process can do: push the new bytes into
 * the open editor buffer, record a design-undo entry, and show the PDF the
 * verify already produced.
 */
async function safeApplyDesign(
  writes: { abs: string; content: string }[],
  label: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const compiler = getCompiler();

  const res = await safeApply({
    writes,
    io: appSafeApplyIO,
    // No compiler yet → nothing to verify with; commit and let the normal
    // compile run.
    verify: compiler ? () => verifyWith(compiler) : null,
    baseline: !appState.lastCompileOk,
  });

  if (!res.ok) {
    // Rolled back already; the preview was never touched, so the last-good
    // look is still on screen. Only the editor buffer needs reverting.
    for (const p of res.prior) if (p.old !== null) syncOpenBuffer(p.abs, p.old);
    return { ok: false, error: res.error };
  }

  for (const w of writes) syncOpenBuffer(w.abs, w.content);
  pushDesignUndo(label, res.prior);

  if (res.verified && res.pdf) {
    appState.lastCompileOk = true;
    appState.mainWindow?.webContents.send('penwright', {
      type: 'previewPdfUpdate',
      pdfData: res.pdf.toString('base64'),
    });
  } else {
    compiler?.compilePdf();
  }
  appState.mainWindow?.webContents.send('penwright', { type: 'filetreeChanged' });
  return { ok: true };
}

/** Adapts `TypstCompiler.verify()` to the shared engine's outcome shape. */
async function verifyWith(compiler: TypstCompiler): Promise<VerifyOutcome> {
  const r = await compiler.verify();
  return r.ok ? { ok: true, pdf: r.pdf } : { ok: false, errors: r.errors.map((e) => e.message) };
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
          const wasClean = !appState.isDirty;
          appState.currentContent = content;
          appState.isDirty = true;
          updateTitle();
          // Only on the clean→dirty transition, not per keystroke: the agent
          // needs to know the buffer diverges from disk, not how often.
          if (wasClean) publishSession();
          appState.mainWindow?.webContents.send('penwright', { type: 'saveStatus', saved: false });
          autoSave();
        }
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

      case 'mergeDocument': {
        if (appState.currentFilePath) {
          try {
            const merged = resolveIncludes(appState.currentFilePath);
            appState.currentContent = merged;
            appState.isDirty = true;
            updateTitle();
            appState.mainWindow?.webContents.send('penwright', { type: 'update', content: appState.currentContent });
          } catch (err) {
            dialog.showErrorBox(resolveDict(getLocale()).mainDialogs.mergeFailedTitle, String(err));
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
            dialog.showErrorBox(resolveDict(getLocale()).mainDialogs.splitFailedTitle, String(err));
          }
        }
        break;
      }

      case 'requestCitations': {
        handleRequestCitations();
        break;
      }

      case 'ensureBibliography': {
        if (appState.projectDir) {
          // One rule for both processes: the .bib sits next to the design root
          // and the #bibliography call goes IN the root. Putting it next to the
          // open file produced chapters/references.bib — consistent in itself,
          // invisible to everything else; writing the call into a chapter made
          // the relative path unresolvable and broke the compile.
          const plan = planBibliography({
            projectDir: appState.projectDir,
            currentFile: appState.currentFilePath,
          });
          if (!plan.callSite) {
            dialog.showErrorBox(
              resolveDict(getLocale()).mainDialogs.couldNotSaveFile,
              'No root document found — cannot place a bibliography without one.',
            );
            break;
          }
          if (plan.create) {
            fs.writeFileSync(plan.bibFile, BIB_HEADER, 'utf-8');
            noteDiskContent(plan.bibFile, BIB_HEADER);
          }
          if (!plan.alreadyReferenced) {
            const call = `\n\n#bibliography("${plan.callPath}")\n`;
            if (path.resolve(plan.callSite) === path.resolve(appState.currentFilePath ?? '')) {
              appState.currentContent += call;
              appState.isDirty = true;
              updateTitle();
              autoSave();
              appState.mainWindow?.webContents.send('penwright', { type: 'update', content: appState.currentContent });
            } else {
              // The root is not the open file — write it there directly rather
              // than into whatever chapter happens to be on screen.
              try {
                const updated = fs.readFileSync(plan.callSite, 'utf-8') + call;
                fs.writeFileSync(plan.callSite, updated, 'utf-8');
                noteDiskContent(plan.callSite, updated);
              } catch (err) {
                dialog.showErrorBox(resolveDict(getLocale()).mainDialogs.couldNotSaveFile, String(err));
              }
            }
          }
          handleRequestCitations();
          appState.mainWindow?.webContents.send('penwright', { type: 'filetreeChanged' });
        }
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

      case 'undoLastAiEdit': {
        const undone = popAiSnapshot();
        if (!undone) {
          appState.mainWindow?.webContents.send('penwright', {
            type: 'notification',
            message: resolveDict(getLocale()).mainDialogs.noAiEditsToUndo,
          });
        }
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
      filters: [{ name: resolveDict(getLocale()).mainDialogs.filterTypstFiles, extensions: ['typ'] }],
      properties: ['openFile'],
    });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle('dialog:saveFile', async (_event, defaultName: string) => {
    const result = await dialog.showSaveDialog(appState.mainWindow!, {
      defaultPath: defaultName,
      filters: [{ name: resolveDict(getLocale()).mainDialogs.filterTypstFiles, extensions: ['typ'] }],
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
      // NOTE: `getTypstPath` must be a static import (above), NOT a runtime
      // `require('./typstPath')` — electron-vite bundles the whole main process
      // into a single `dist/main/index.js`, so a relative `require` at runtime
      // throws "Cannot find module" and this handler would always return false.
      execFileSync(getTypstPath(), ['--version'], { stdio: 'ignore' });
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
        publishSession();
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
      publishSession();
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
    applySpellcheckLanguage(lang);
  });

  /**
   * Add a chapter to the DOCUMENT.
   *
   * This used to derive everything from the open file: the dialog defaulted to
   * `<openFile>/chapters/` (so `chapters/chapters/` when a chapter was open)
   * and — the part that mattered — appended the `#include` to
   * `appState.currentContent`, i.e. into the chapter itself. Typst nests
   * includes happily, so it compiled; the new chapter simply became invisible
   * to `penwright_get_chapters`, to the export dialog's chapter list, and to
   * both reorder paths. Silent drift, and the mirror image of the bug the MCP
   * side had.
   *
   * Now: one planner, the same one the MCP calls, writing the root.
   */
  ipcMain.handle('includes:add', async () => {
    const md = resolveDict(getLocale()).mainDialogs;
    const rootFile = resolveDocumentRoot(appState.projectDir, appState.currentFilePath);
    if (!rootFile) {
      await dialog.showMessageBox(appState.mainWindow!, {
        type: 'warning',
        message: md.noProjectOpen,
        detail: noDocumentRootMessage(appState.projectDir),
      });
      return;
    }
    const rootDir = path.dirname(rootFile);

    const result = await dialog.showSaveDialog(appState.mainWindow!, {
      defaultPath: path.join(rootDir, 'chapters', 'new-chapter.typ'),
      filters: [{ name: md.filterTypstFiles, extensions: ['typ'] }],
    });
    if (result.canceled || !result.filePath) return;

    const name = path.basename(result.filePath, '.typ').replace(/-/g, ' ');
    const title = name.charAt(0).toUpperCase() + name.slice(1);

    let rootContent: string;
    try {
      // The open buffer wins when it IS the root — it may hold unsaved edits.
      rootContent = appState.currentFilePath && path.resolve(appState.currentFilePath) === path.resolve(rootFile)
        ? appState.currentContent
        : fs.readFileSync(rootFile, 'utf-8');
    } catch (err) {
      console.warn('[penwright] Could not read the root document:', err);
      return;
    }

    const plan = planAddChapter({
      rootFile,
      rootContent,
      chapterAbs: result.filePath,
      initialContent: `= ${title}\n\n`,
    });
    if (!plan.ok) {
      await dialog.showMessageBox(appState.mainWindow!, {
        type: 'warning', message: md.noProjectOpen, detail: plan.reason,
      });
      return;
    }

    fs.mkdirSync(path.dirname(result.filePath), { recursive: true });
    for (const w of plan.writes) {
      if (appState.currentFilePath && path.resolve(w.abs) === path.resolve(appState.currentFilePath)) {
        // The root IS on screen: go through the buffer so the editor shows it.
        appState.currentContent = w.content;
        appState.isDirty = true;
        updateTitle();
        autoSave();
        appState.mainWindow?.webContents.send('penwright', { type: 'update', content: w.content });
      } else {
        fs.writeFileSync(w.abs, w.content, 'utf-8');
        noteDiskContent(w.abs, w.content);
      }
    }
    appState.mainWindow?.webContents.send('penwright', { type: 'filetreeChanged' });
  });

  // ─── Persistence Handlers ─────────────────────
  ipcMain.handle('persist:getPanelState', () => getPanelState());
  ipcMain.handle('persist:savePanelState', (_event, state: PanelState) => savePanelState(state));
  ipcMain.handle('persist:getRecentProjects', () => getRecentProjects());
  ipcMain.handle('persist:isOnboardingSeen', () => isOnboardingSeen());
  ipcMain.handle('persist:setOnboardingSeen', (_event, seen: boolean) => { setOnboardingSeen(!!seen); return { ok: true }; });

  // ─── UI Locale ───
  ipcMain.handle('app:getLocale', () => getLocale());
  ipcMain.handle('app:setLocale', (_event, locale: string) => {
    setLocale(locale);
    // Rebuild the native menu so its labels switch language immediately.
    buildMenu(appState);
    return { ok: true };
  });

  // ─── Preview mode (auto / manual) + manual recompile ───
  ipcMain.handle('persist:getPreviewMode', () => getPreviewMode());
  ipcMain.handle('persist:setPreviewMode', (_event, mode: string) => {
    setPreviewMode(mode);
    return { ok: true };
  });
  ipcMain.handle('preview:compile', () => {
    getCompiler()?.compilePdf();
    return { ok: true };
  });

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

  // ─── MCP Registration target (Meta-MCP vs Claude Code) ───
  // Where this app registers ITSELF as an MCP server. Exactly one of the two
  // hosts is active; see mcpRegistration.ts.
  ipcMain.handle('mcp:getConnectionStatus', async () => {
    const target = getMcpTarget();
    const metaReachable = await probeMetaMcp();
    const defaultTarget: McpTarget = metaReachable ? 'meta' : 'claude';
    const { access } = buildMcpEnv();
    return {
      target,                                  // null until the user/default decides
      effectiveTarget: target ?? defaultTarget,
      defaultTarget,
      metaReachable,
      access,                                  // 'personal' | 'commercial' — informational only
      supported: true,                         // Meta-MCP + Claude Code work on all platforms
      metaConfigPath: getMetaConfigPath(),
      claudeConfigPath: getClaudeCodeConfigPath(),
    };
  });
  ipcMain.handle('mcp:setTarget', async (_event, target: string) => {
    if (target !== 'meta' && target !== 'claude') {
      throw new Error(`Invalid MCP target: ${target}`);
    }
    setMcpTarget(target);
    addBreadcrumb('mcp', `setTarget ${target}`);
    return await ensureMcpTarget(target);
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

  // Local licence state (personal / commercial) — the single source of truth
  // for the status-bar label and the dismissible notice. It gates NOTHING:
  // the app is complete and free for personal use, forever.
  ipcMain.handle('license:getEntitlement', () => getEntitlement());

  // The one-time "how do you use Penwright?" answer. Changeable any time from
  // the licence dialog; `null` re-opens the question on next launch.
  ipcMain.handle('license:setUsage', (_event, usage: string) => {
    setUsageContext(usage === 'personal' || usage === 'commercial' ? usage : null);
    return getEntitlement();
  });

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
        fs.writeFileSync(target, f.content, 'utf-8');
        noteDiskContent(target, f.content);
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
    const saved = getBackupConfig();
    // Republish so an agent writing snapshots prunes to the number the user
    // just picked, rather than to its own fallback.
    if (appState.projectDir) publishSnapshotLimit(appState.projectDir, saved.maxAiSnapshots);
    return saved;
  });

  // AI-edit snapshots — listing + "undo last", for the WHOLE project.
  //
  // Both used to be scoped to the open file, reading an in-memory buffer that
  // only ever held what the app itself had snapshotted. Everything the agent
  // preserved in `.penwright/ai-snapshots/` — which is every file it touched
  // that the user was not looking at — was invisible here, in the one place
  // built to show it. The net now reads from the folder both processes write.
  // The return leg of the state channel: what the MCP server says it is
  // touching. Read-only and advisory — the app shows it and changes nothing
  // about its own behaviour. A stale or crashed agent's record simply ages out
  // (readAgentActivity checks liveness and freshness), because letting an
  // agent's claim influence the app is exactly the failure this channel is
  // shaped to avoid.
  ipcMain.handle('agent:activity', () => {
    if (!appState.projectDir) return null;
    return readAgentActivity(appState.projectDir);
  });

  ipcMain.handle('ai:list', (_event, filePath?: string) => {
    return getAiSnapshotsList(filePath);
  });

  ipcMain.handle('ai:undoLast', (_event, filePath?: string) => {
    const undone = popAiSnapshot(filePath);
    return { undone, count: getAiSnapshotCount(filePath) };
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
    // Shared with the MCP server's penwright_get_style: same tokens, same
    // backfill of a hand-edited custom block, so neither side can silently
    // drop what the other would have preserved.
    const style = readProjectStyleWithCustom(appState.projectDir, appState.currentFilePath);

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

    // One planner for both processes: it resolves the design home, computes
    // style.json + style.typ (+ the root's #import when it changes), and
    // refuses outright when the project carries a hand-written style.typ.
    const plan = planStyleWrites({
      projectDir: appState.projectDir,
      currentFile: appState.currentFilePath,
      style: raw,
    });
    if (!plan.ok) {
      return {
        ok: false as const,
        // The path RELATIVE TO THE PROJECT, not the basename. The guard now
        // answers for the whole project, so the file that stopped this may sit
        // in a folder the user is not looking at — "a hand-written style.typ"
        // then names nothing they can act on.
        error: resolveDict(getLocale()).mainDialogs.handwrittenStyleRefused(
          appState.projectDir ? path.relative(appState.projectDir, plan.styleTypPath) : plan.styleTypPath,
        ),
        kept: true as const,
      };
    }

    // Surface conflicting top-level #set rules so the renderer can warn —
    // the include itself is already part of the plan.
    const conflicts: string[] = [];
    if (plan.rootFile && fs.existsSync(plan.rootFile)) {
      try {
        conflicts.push(...detectStylePreambleConflicts(fs.readFileSync(plan.rootFile, 'utf-8')));
      } catch { /* unreadable root — the writes still stand on their own */ }
    }

    const res = await safeApplyDesign(plan.writes, resolveDict(getLocale()).mainDialogs.undoLabelDesignChanged);
    if (!res.ok) return { ok: false as const, error: res.error, kept: true as const };
    return { ok: true as const, style: plan.style, conflicts };
  });

  // ─── Section styles (Phase E — per-chapter design) ───
  // Variant definitions live in style.json (saved via style:save, which
  // regenerates style.typ with one `#let <id>-style` per variant). These
  // handlers manage the per-chapter opt-in: which variant a chapter uses, and
  // injecting / clearing the scoped `#show` at the top of a chapter file.

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

    // Backfilling read: this style is written straight back out below, so a
    // hand-edited custom block in style.typ must come along or it is dropped.
    const current = readProjectStyleWithCustom(projectDir, appState.currentFilePath);
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

    const plan = planStyleWrites({
      projectDir,
      currentFile: appState.currentFilePath,
      style: { ...current, sections },
    });
    if (!plan.ok) {
      return {
        ok: false as const,
        // The path RELATIVE TO THE PROJECT, not the basename. The guard now
        // answers for the whole project, so the file that stopped this may sit
        // in a folder the user is not looking at — "a hand-written style.typ"
        // then names nothing they can act on.
        error: resolveDict(getLocale()).mainDialogs.handwrittenStyleRefused(
          appState.projectDir ? path.relative(appState.projectDir, plan.styleTypPath) : plan.styleTypPath,
        ),
        kept: true as const,
      };
    }
    const writes = [...plan.writes];
    if (chapterAbs) {
      try {
        const src = fs.readFileSync(chapterAbs, 'utf-8');
        writes.push({ abs: chapterAbs, content: ensureSectionStyle(src, finalId, chapterImportPath(chapterAbs)) });
      } catch (err) {
        return { ok: false as const, error: err instanceof Error ? err.message : String(err) };
      }
    }

    const res = await safeApplyDesign(writes, resolveDict(getLocale()).mainDialogs.undoLabelChapterLook);
    if (!res.ok) return { ok: false as const, error: res.error, kept: true as const };
    return { ok: true as const, styleId: finalId };
  });

  ipcMain.handle('section:apply', async (_event, relPath: string, styleId: string) => {
    if (!appState.projectDir) return { ok: false as const, error: 'No project open.' };
    const abs = resolveChapter(relPath);
    if (!abs) return { ok: false as const, error: 'Chapter not found.' };
    const writes: { abs: string; content: string }[] = [];

    // Define the variant if the project doesn't carry it yet. These writes are
    // staged TOGETHER with the chapter injection. They used to run before it,
    // outside safe-apply — so a failed verify rolled back only the chapter and
    // left behind a regenerated style.typ plus a freshly created style.json.
    // On a project whose design lives in a hand-written style.typ that was
    // total, unrecoverable loss behind a "not applied" message.
    const style = readProjectStyleWithCustom(appState.projectDir, appState.currentFilePath);
    if (!style.sections.some(s => s.id === styleId)) {
      const preset = getSectionPreset(styleId);
      if (!preset) return { ok: false as const, error: `Unknown section style "${styleId}".` };
      const plan = planStyleWrites({
        projectDir: appState.projectDir,
        currentFile: appState.currentFilePath,
        style: { ...style, sections: [...style.sections, preset] },
      });
      if (!plan.ok) {
        return {
          ok: false as const,
          // The path RELATIVE TO THE PROJECT, not the basename. The guard now
        // answers for the whole project, so the file that stopped this may sit
        // in a folder the user is not looking at — "a hand-written style.typ"
        // then names nothing they can act on.
        error: resolveDict(getLocale()).mainDialogs.handwrittenStyleRefused(
          appState.projectDir ? path.relative(appState.projectDir, plan.styleTypPath) : plan.styleTypPath,
        ),
          kept: true as const,
        };
      }
      writes.push(...plan.writes);
    }

    try {
      writes.push({
        abs,
        content: ensureSectionStyle(fs.readFileSync(abs, 'utf-8'), styleId, chapterImportPath(abs)),
      });
    } catch (err) {
      return { ok: false as const, error: err instanceof Error ? err.message : String(err) };
    }

    // Verify the document still compiles with the look applied; roll back ALL
    // of it if not — style.json included, which safe-apply unlinks when it
    // didn't exist before.
    const res = await safeApplyDesign(writes, resolveDict(getLocale()).mainDialogs.undoLabelChapterLookSet(styleId));
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
    const res = await safeApplyDesign([{ abs, content: cleared }], resolveDict(getLocale()).mainDialogs.undoLabelChapterLookRemoved);
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
    // Same resolution the writers use, so the Look editor always opens the
    // file a design change would actually touch.
    const rootFile = resolveDesignRoot(appState.projectDir, appState.currentFilePath);
    return path.join(styleTypDir(appState.projectDir, rootFile), STYLE_TYP_BASENAME);
  });

  ipcMain.handle('design:canUndo', () => ({
    canUndo: designUndoStack.length > 0,
    label: designUndoStack[designUndoStack.length - 1]?.label ?? null,
  }));

  ipcMain.handle('design:undo', () => {
    const entry = designUndoStack.pop();
    if (!entry) return { ok: false as const, error: 'Nothing to undo.' };
    for (const f of entry.files) {
      try {
        if (f.old === null) {
          if (fs.existsSync(f.abs)) { fs.unlinkSync(f.abs); noteDeleted(f.abs); }
        } else {
          fs.mkdirSync(path.dirname(f.abs), { recursive: true });
          fs.writeFileSync(f.abs, f.old, 'utf-8');
          noteDiskContent(f.abs, f.old);
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

  // Preset library: the New-Project gallery + create-from-preset (rich, bundled
  // project folders copied verbatim). Blank starters still go through
  // 'createProject' (handleCreateProject) above.
  ipcMain.handle('preset:gallery', () => {
    return buildGallery();
  });

  ipcMain.handle('preset:create', async (_event, presetId: string, suggestedName?: string) => {
    const result = await createFromPreset(presetId, suggestedName);
    return { ok: !!result, projectDir: result };
  });

  // Save the currently-open project as a reusable USER preset (writable library).
  ipcMain.handle('preset:save', async (_event, input: { label: string; type: string; tagline?: string }) => {
    return saveProjectAsPreset(input);
  });

  ipcMain.handle('preset:delete', (_event, presetId: string) => {
    return deleteUserPreset(presetId);
  });

  // Import a design/palette/layout/rubrics FROM a preset into the open project.
  // The renderer merges the chosen scope and saves via the normal safe-apply path.
  ipcMain.handle('preset:styles', () => listPresetStyles());
  ipcMain.handle('preset:getStyle', (_event, presetId: string) => ({ style: getPresetStyle(presetId) }));

  // Render the first pages of a preset to PNG data-URIs for the gallery preview.
  ipcMain.handle('preset:preview', (_event, presetId: string) => renderPresetPreview(presetId));

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

  ipcMain.handle('export:run', async (_event, config: Omit<ExportConfig, 'format'> & { format: 'pdf' | 'docx' | 'web'; split?: 'auto' | 'single' | 'site'; inlineAssets?: boolean }) => {
    // Web (HTML) routes to the bundle/mini-site writer; PDF/DOCX compile/serialize.
    if (config.format === 'web') {
      const written = await runWebExport({
        selectedIncludes: config.selectedIncludes,
        includeBibliography: config.includeBibliography,
        split: config.split,
        inlineAssets: config.inlineAssets,
      });
      return { ok: !!written, path: written };
    }
    const written = await runFilteredExport({ ...config, format: config.format });
    return { ok: !!written, path: written };
  });

  // dpi pre-flight for the print export — coarse low-resolution-image warning.
  ipcMain.handle('export:preflightImages', (_event, config: ExportConfig) => {
    try {
      return { warnings: preflightPrintImages(config) };
    } catch {
      return { warnings: [] as string[] };
    }
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

  // Picks an asset and RETURNS its path, for a building block's `path` field.
  // Same placement rule as every other image entry point.
  ipcMain.handle('project:pickAsset', (_event, opts?: { targetFile?: string | null }) => {
    return pickAssetPath(opts?.targetFile ?? null);
  });

  // The building blocks THIS project defines. Scoped to the open file by
  // default, because a macro is only callable where it is imported — offering
  // the whole project in a chapter offers macros that cannot compile there.
  ipcMain.handle('project:listMacros', (_event, opts?: { targetFile?: string | null }) => {
    const target = opts?.targetFile ?? appState.currentFilePath ?? null;
    return listProjectMacros(appState.projectDir, target);
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
