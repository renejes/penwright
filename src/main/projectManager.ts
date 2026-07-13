/**
 * Project Manager — extracted from index.ts
 * New Project, File Tree, Claude Skills, Image Handlers, Settings
 */

import { app, dialog, shell } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import simpleGit from 'simple-git';
import { templates as projectTemplates } from '../shared/projectTemplates';
import { parseSettings, applySettings } from '../shared/settingsParser';
import { findRootFile } from '../shared/rootFinder';
import { generateStyleTypst, ensureStyleInclude } from '../shared/styleParser';
import { DEFAULT_PROJECT_STYLE, sanitizeProjectStyle } from '../shared/styleTypes';
import { TYPST_SKILL, PENWRIGHT_SKILL, RESEARCH_SKILL, WRITING_STYLE_SKILL, DESIGN_SKILL } from '../shared/skillTemplates';
import { appState } from './appState';
import { addBreadcrumb } from './crashReporter';
import { getLocale } from './persistenceManager';
import { resolveDict } from '../shared/i18n';

const GITIGNORE_TEMPLATE = `# Penwright
.penwright/
.penwright-*
*.pdf

# OS
.DS_Store
Thumbs.db
`;

/**
 * Ensures a project has a Git repo + .gitignore + initial commit so that
 * "Version speichern" works immediately. Idempotent — safe to call on
 * existing projects.
 */
export async function ensureProjectInfrastructure(dir: string, initialMessage = 'Initial version'): Promise<void> {
  if (!fs.existsSync(dir)) return;

  // .gitignore — create or extend
  const gitignorePath = path.join(dir, '.gitignore');
  if (!fs.existsSync(gitignorePath)) {
    fs.writeFileSync(gitignorePath, GITIGNORE_TEMPLATE, 'utf-8');
  } else {
    const existing = fs.readFileSync(gitignorePath, 'utf-8');
    const lines = existing.split('\n').map(l => l.trim());
    const required = ['.penwright/', '.penwright-*', '*.pdf'];
    const missing = required.filter(req => !lines.includes(req));
    if (missing.length > 0) {
      const prefix = existing.length > 0 && !existing.endsWith('\n') ? '\n' : '';
      fs.writeFileSync(gitignorePath, existing + prefix + '\n# Penwright\n' + missing.join('\n') + '\n', 'utf-8');
    }
  }

  // .penwright/ skeleton
  const penwrightDir = path.join(dir, '.penwright');
  if (!fs.existsSync(penwrightDir)) fs.mkdirSync(penwrightDir, { recursive: true });
  const backupsDir = path.join(penwrightDir, 'backups');
  if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir, { recursive: true });
  const aiDir = path.join(penwrightDir, 'ai-snapshots');
  if (!fs.existsSync(aiDir)) fs.mkdirSync(aiDir, { recursive: true });

  // Every project gets a style.typ — it's the home of the document's "Look"
  // (opened via the visual Look designer). Files only here: we never touch the
  // root file on open, so an existing document's appearance can't change.
  ensureStyleFile(dir, false);

  // Git repo + initial commit (idempotent)
  try {
    const git = simpleGit(dir);
    const isRepo = await git.checkIsRepo();
    if (!isRepo) {
      await git.init();
      try { await git.raw(['symbolic-ref', 'HEAD', 'refs/heads/main']); } catch {}
      await git.add('-A');
      const status = await git.status();
      if (status.staged.length > 0 || status.created.length > 0) {
        await git.commit(initialMessage);
      }
    }
  } catch (err) {
    console.warn('[penwright] Failed to initialise git repo for project:', err);
  }
}

/**
 * Ensures the project has a `style.typ` (the document's Look) + a `.penwright/
 * style.json` (the design tokens). With `injectImport` it also wires the root
 * file to apply the style — only done for freshly-created projects; on open we
 * pass `false` so an existing document's look is never silently changed (the
 * default fonts already match the templates, so a new project is seamless).
 */
export function ensureStyleFile(dir: string, injectImport: boolean): void {
  if (!fs.existsSync(dir)) return;

  let rootFile: string | null = null;
  for (const name of ['main.typ', 'document.typ', 'index.typ']) {
    const p = path.join(dir, name);
    if (fs.existsSync(p)) { rootFile = p; break; }
  }
  const rootDir = rootFile ? path.dirname(rootFile) : dir;
  const styleTypPath = path.join(rootDir, 'style.typ');
  const styleJsonPath = path.join(dir, '.penwright', 'style.json');

  // style.json (design tokens) — default if absent.
  let style;
  if (fs.existsSync(styleJsonPath)) {
    try { style = sanitizeProjectStyle(JSON.parse(fs.readFileSync(styleJsonPath, 'utf-8'))); }
    catch { style = sanitizeProjectStyle(DEFAULT_PROJECT_STYLE); }
  } else {
    style = sanitizeProjectStyle(DEFAULT_PROJECT_STYLE);
    try {
      fs.mkdirSync(path.dirname(styleJsonPath), { recursive: true });
      fs.writeFileSync(styleJsonPath, JSON.stringify(style, null, 2), 'utf-8');
    } catch {}
  }

  // style.typ — generate if absent.
  if (!fs.existsSync(styleTypPath)) {
    try { fs.writeFileSync(styleTypPath, generateStyleTypst(style), 'utf-8'); } catch {}
  }

  // Wire the root to apply it (new projects only).
  if (injectImport && rootFile && fs.existsSync(rootFile) && fs.existsSync(styleTypPath)) {
    try {
      const before = fs.readFileSync(rootFile, 'utf-8');
      const after = ensureStyleInclude(before);
      if (after !== before) fs.writeFileSync(rootFile, after, 'utf-8');
    } catch {}
  }
}

// ─── File Tree ────────────────────────────────────────

export interface FileEntry {
  name: string;
  path: string;
  isDir: boolean;
  children?: FileEntry[];
}

const IGNORED_DIRS = new Set(['.git', '.penwright', 'node_modules', '.DS_Store', '__pycache__', '.venv', 'dist', 'build']);
const ALLOWED_EXTENSIONS = new Set(['.typ', '.bib', '.yaml', '.yml', '.toml', '.txt', '.md', '.png', '.jpg', '.jpeg', '.svg', '.gif', '.pdf', '.docx', '.doc', '.csv', '.json', '.tex']);

export function readDirTree(dir: string, depth = 0): FileEntry[] {
  if (depth > 5) return [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const result: FileEntry[] = [];

    for (const entry of entries) {
      if (entry.name.startsWith('.') && entry.name !== '.' && entry.name !== '.claude') continue;
      if (IGNORED_DIRS.has(entry.name)) continue;

      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        // Show all directories — including empty ones — so the user can
        // see where to drop assets/sources/etc.
        const children = readDirTree(fullPath, depth + 1);
        result.push({ name: entry.name, path: fullPath, isDir: true, children });
      } else {
        const ext = path.extname(entry.name).toLowerCase();
        if (ALLOWED_EXTENSIONS.has(ext)) {
          result.push({ name: entry.name, path: fullPath, isDir: false });
        }
      }
    }

    result.sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    return result;
  } catch {
    return [];
  }
}

// ─── Project Creation ─────────────────────────────────

export async function handleCreateProject(templateId: string, projectName: string): Promise<void> {
  const md = resolveDict(getLocale()).mainDialogs;
  const result = await dialog.showOpenDialog(appState.mainWindow!, {
    properties: ['openDirectory', 'createDirectory'],
    title: md.chooseProjectLocationTitle,
    buttonLabel: md.createHere,
  });
  if (result.canceled || !result.filePaths[0]) return;

  const parentDir = result.filePaths[0];
  const dir = projectName ? path.join(parentDir, projectName) : parentDir;

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const template = projectTemplates.find(t => t.id === templateId);
  if (!template) return;

  for (const [filePath, content] of Object.entries(template.files)) {
    const fullPath = path.join(dir, filePath);
    const fileDir = path.dirname(fullPath);
    if (!fs.existsSync(fileDir)) {
      fs.mkdirSync(fileDir, { recursive: true });
    }
    if (!fs.existsSync(fullPath)) {
      fs.writeFileSync(fullPath, content, 'utf-8');
    }
  }

  // Standard project folders — created in every project so the file tree
  // always shows where assets and sources belong, even when empty.
  for (const sub of ['assets', 'sources']) {
    const p = path.join(dir, sub);
    if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
  }

  ensureClaudeSkills(dir);

  // Initialise Git repo, .gitignore, and the .penwright/ folder so the
  // "Versionen" UI works from the very first save.
  await ensureProjectInfrastructure(dir, `Initial version (${template.label})`);
  // New project: wire the root to apply style.typ from the start (default
  // fonts match the templates, so this is seamless) — the Look is designable
  // immediately.
  ensureStyleFile(dir, true);

  appState.projectDir = dir;
  const { openFile } = await import('./fileManager');
  openFile(path.join(dir, 'main.typ'));
  appState.mainWindow?.webContents.send('penwright', { type: 'filetreeChanged' });
}

// ─── Open Project ────────────────────────────────────
// Project = folder with at least one .typ file. The folder is the project's
// identity; everything else is derived. If a project is currently open,
// we tear it down cleanly first.

function findEntryFile(dir: string): string | null {
  // Prefer main.typ, then any .typ in the project root
  const mainPath = path.join(dir, 'main.typ');
  if (fs.existsSync(mainPath)) return mainPath;
  try {
    const candidate = fs.readdirSync(dir).find(f => f.endsWith('.typ'));
    return candidate ? path.join(dir, candidate) : null;
  } catch {
    return null;
  }
}

/**
 * One-shot migration for the `.vswrite/` → `.penwright/` rename (Penwright
 * rebrand). If a project still carries the legacy folder and has no
 * `.penwright/` yet, rename it in place so backups / style / preferences
 * survive. Safe: never overwrites an existing `.penwright/`, best-effort.
 */
function migrateLegacyProjectDir(dir: string): void {
  try {
    const legacy = path.join(dir, '.vswrite');
    const current = path.join(dir, '.penwright');
    if (fs.existsSync(legacy) && !fs.existsSync(current)) {
      fs.renameSync(legacy, current);
      addBreadcrumb('project', 'migrated .vswrite -> .penwright');
    }
  } catch (err) {
    console.warn('[penwright] legacy .vswrite migration failed:', err);
  }
}

/**
 * Opens a project from a folder. If `projectDir` is omitted, shows a
 * folder-picker dialog. Returns the project dir if loaded, otherwise null.
 */
export async function openProject(projectDir?: string): Promise<string | null> {
  const md = resolveDict(getLocale()).mainDialogs;
  if (!projectDir) {
    const result = await dialog.showOpenDialog(appState.mainWindow!, {
      properties: ['openDirectory'],
      title: md.openProjectTitle,
      buttonLabel: md.openProjectTitle,
    });
    if (result.canceled || !result.filePaths[0]) return null;
    projectDir = result.filePaths[0];
  }

  if (!fs.existsSync(projectDir) || !fs.statSync(projectDir).isDirectory()) {
    await dialog.showMessageBox(appState.mainWindow!, {
      type: 'error',
      message: md.folderNotFound,
      detail: md.folderNotFoundDetail(projectDir),
    });
    return null;
  }

  // Carry over a legacy `.vswrite/` folder from before the Penwright rename,
  // before anything reads `.penwright/` (preferences, style, backups).
  migrateLegacyProjectDir(projectDir);

  // Tear down any currently-open project (with save prompt if dirty)
  const { closeProjectInteractive, openFile } = await import('./fileManager');
  if (appState.projectDir) {
    const closed = await closeProjectInteractive();
    if (!closed) return null;
  }

  appState.projectDir = projectDir;

  const entry = findEntryFile(projectDir);
  if (entry) {
    await openFile(entry);
  } else {
    // Empty folder — still treat it as the project so the file tree shows
    appState.mainWindow?.webContents.send('penwright', { type: 'filetreeChanged' });
    appState.mainWindow?.webContents.send('penwright', { type: 'projectOpened', dir: projectDir });
  }

  addBreadcrumb('project', `opened ${entry ? '(with entry file)' : '(empty)'}`);
  return projectDir;
}

// ─── Sample Project ──────────────────────────────────

/**
 * Resolves the bundled sample-project directory. In production this lives
 * under `process.resourcesPath/sample-project/`; in development we walk
 * up from `__dirname` to find `resources/sample-project/`.
 */
function findBundledSampleDir(): string | null {
  const candidates: string[] = [];

  // Production: bundled via electron-builder extraResources
  if (process.resourcesPath) {
    candidates.push(path.join(process.resourcesPath, 'sample-project'));
  }

  // Development: repo path. __dirname is dist/main/, walk up to repo root.
  candidates.push(path.resolve(__dirname, '..', '..', 'resources', 'sample-project'));
  candidates.push(path.resolve(process.cwd(), 'resources', 'sample-project'));

  for (const c of candidates) {
    if (fs.existsSync(c) && fs.statSync(c).isDirectory()) return c;
  }
  return null;
}

/**
 * Recursive copy with no symlink following — keeps things simple and
 * predictable for a vendored asset directory we control.
 */
function copyDirRecursive(src: string, dest: string): void {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(s, d);
    } else if (entry.isFile()) {
      fs.copyFileSync(s, d);
    }
  }
}

/**
 * Picks a target directory for the sample copy. Strategy: ask the user
 * where to put the new folder via a save-dialog, default base is the
 * platform's Documents folder, default name is `penwright-sample-thesis`,
 * with `-2`, `-3` suffixes if the name is already taken.
 */
async function pickSampleTargetDir(): Promise<string | null> {
  if (!appState.mainWindow) return null;

  const documents = app.getPath('documents');
  let baseName = 'penwright-sample-thesis';
  let candidate = path.join(documents, baseName);
  let counter = 2;
  while (fs.existsSync(candidate)) {
    candidate = path.join(documents, `${baseName}-${counter}`);
    counter++;
  }

  const md = resolveDict(getLocale()).mainDialogs;
  const result = await dialog.showSaveDialog(appState.mainWindow, {
    title: md.sampleProjectTargetTitle,
    defaultPath: candidate,
    buttonLabel: md.sampleProjectCreateHere,
    properties: ['createDirectory'],
  });
  if (result.canceled || !result.filePath) return null;
  return result.filePath;
}

/**
 * Copies the bundled sample project into a user-chosen location, runs
 * `git init` plus an initial "Sample 0.7.0 - initial state" version so
 * the Verlauf is non-empty on first open, then opens the project.
 *
 * Why copy: the bundled folder lives inside the .app bundle on macOS
 * and is read-only / wiped on app update. The user gets a real working
 * copy in their own Documents folder.
 */
export async function openSampleProject(): Promise<string | null> {
  const md = resolveDict(getLocale()).mainDialogs;
  const bundled = findBundledSampleDir();
  if (!bundled) {
    if (appState.mainWindow) {
      await dialog.showMessageBox(appState.mainWindow, {
        type: 'error',
        message: md.sampleProjectNotFound,
        detail: md.sampleProjectNotFoundDetail,
      });
    }
    return null;
  }

  // Tear down any currently-open project before we copy + open.
  const { closeProjectInteractive } = await import('./fileManager');
  if (appState.projectDir) {
    const closed = await closeProjectInteractive();
    if (!closed) return null;
  }

  const targetDir = await pickSampleTargetDir();
  if (!targetDir) return null;

  try {
    copyDirRecursive(bundled, targetDir);
  } catch (err) {
    if (appState.mainWindow) {
      await dialog.showMessageBox(appState.mainWindow, {
        type: 'error',
        message: md.sampleProjectCreateFailed,
        detail: err instanceof Error ? err.message : String(err),
      });
    }
    return null;
  }

  // Initialize Git + first version so the Verlauf shows one entry from
  // the start. Errors here are non-fatal — the project still opens.
  try {
    const git = simpleGit(targetDir);
    await git.init();
    try { await git.raw(['symbolic-ref', 'HEAD', 'refs/heads/main']); } catch {}
    // .gitignore for Penwright-local state — match what ensureProjectInfrastructure does.
    const gitignorePath = path.join(targetDir, '.gitignore');
    if (!fs.existsSync(gitignorePath)) {
      fs.writeFileSync(gitignorePath, '# Penwright\n.penwright/\n.penwright-*\n*.pdf\n\n# OS\n.DS_Store\nThumbs.db\n', 'utf-8');
    }
    await git.add('-A');
    await git.commit('Sample 0.7.0 — initial state');
  } catch (err) {
    console.warn('[penwright] sample-project git init failed (non-fatal):', err);
  }

  return openProject(targetDir);
}

// ─── Folder Creation ─────────────────────────────────

/**
 * Creates a new folder inside the current project. Pass `parentRelPath`
 * to nest it (e.g. "assets/diagrams"); pass an empty string to create at
 * the project root.
 */
export async function handleNewFolder(parentRelPath: string, name: string): Promise<{ ok: boolean; error?: string }> {
  const md = resolveDict(getLocale()).mainDialogs;
  if (!appState.projectDir) return { ok: false, error: md.noProjectOpen };
  const cleanName = name.trim();
  if (!cleanName) return { ok: false, error: md.folderNameEmpty };
  if (/[/\\:*?"<>|]/.test(cleanName) || cleanName.startsWith('.')) {
    return { ok: false, error: md.folderNameInvalid };
  }

  const target = path.join(appState.projectDir, parentRelPath || '', cleanName);
  // Stay within the project — symlink-safe via realpath check downstream isn't
  // needed here because we control the components, but we double-check the
  // resolved path doesn't escape via ".." segments.
  const projectAbs = path.resolve(appState.projectDir);
  const targetAbs = path.resolve(target);
  if (!targetAbs.startsWith(projectAbs + path.sep) && targetAbs !== projectAbs) {
    return { ok: false, error: md.folderOutside };
  }
  if (fs.existsSync(targetAbs)) {
    return { ok: false, error: md.folderExists };
  }

  try {
    fs.mkdirSync(targetAbs, { recursive: true });
    appState.mainWindow?.webContents.send('penwright', { type: 'filetreeChanged' });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ─── Asset Import ────────────────────────────────────

/**
 * Opens a file picker, copies the selected files into the project's
 * `assets/` folder. Returns the list of relative paths created.
 */
export async function handleAddAssets(): Promise<{ added: string[]; error?: string }> {
  const md = resolveDict(getLocale()).mainDialogs;
  if (!appState.projectDir) return { added: [], error: md.noProjectOpen };

  const result = await dialog.showOpenDialog(appState.mainWindow!, {
    title: md.addAssetsTitle,
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: md.filterCommonAssets, extensions: ['png', 'jpg', 'jpeg', 'svg', 'gif', 'webp', 'pdf', 'csv', 'json', 'bib'] },
      { name: md.filterAllFiles, extensions: ['*'] },
    ],
  });
  if (result.canceled || result.filePaths.length === 0) return { added: [] };

  const assetsDir = path.join(appState.projectDir, 'assets');
  if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });

  const added: string[] = [];
  for (const src of result.filePaths) {
    const baseName = path.basename(src);
    let dest = path.join(assetsDir, baseName);
    // If the name already exists, append " (1)" / " (2)" etc.
    if (fs.existsSync(dest)) {
      const ext = path.extname(baseName);
      const stem = baseName.slice(0, baseName.length - ext.length);
      let n = 1;
      while (fs.existsSync(dest)) {
        dest = path.join(assetsDir, `${stem} (${n})${ext}`);
        n++;
      }
    }
    try {
      fs.copyFileSync(src, dest);
      added.push(path.relative(appState.projectDir, dest).replace(/\\/g, '/'));
    } catch (err) {
      console.warn('[penwright] Failed to copy asset:', src, err);
    }
  }

  if (added.length > 0) {
    appState.mainWindow?.webContents.send('penwright', { type: 'filetreeChanged' });
  }
  return { added };
}

// ─── Image Handlers ──────────────────────────────────

export async function handlePickImage(): Promise<void> {
  const md = resolveDict(getLocale()).mainDialogs;
  const result = await dialog.showOpenDialog(appState.mainWindow!, {
    filters: [{ name: md.filterImages, extensions: ['png', 'jpg', 'jpeg', 'svg', 'gif'] }],
    properties: ['openFile'],
  });
  if (result.canceled || !result.filePaths[0]) return;

  const imagePath = result.filePaths[0];
  if (appState.currentFilePath) {
    const docDir = path.dirname(appState.currentFilePath);
    const assetsDir = path.join(docDir, 'assets');
    if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });

    const destPath = path.join(assetsDir, path.basename(imagePath));
    fs.copyFileSync(imagePath, destPath);

    const relPath = 'assets/' + path.basename(imagePath);
    appState.mainWindow?.webContents.send('penwright', { type: 'insertImage', src: relPath });
    appState.mainWindow?.webContents.send('penwright', { type: 'filetreeChanged' });
  }
}

export function handleDropImage(name: string, dataBase64: string): void {
  if (!appState.currentFilePath) return;
  const docDir = path.dirname(appState.currentFilePath);
  const assetsDir = path.join(docDir, 'assets');
  if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });

  // SECURITY: `name` comes from the renderer (a dropped File's name). Strip any
  // directory component so a crafted `../…` can't escape `assets/` and overwrite
  // arbitrary files (path-traversal write). basename pins the file to assetsDir.
  const safeName = path.basename(name);
  if (!safeName || safeName === '.' || safeName === '..') return;

  const destPath = path.join(assetsDir, safeName);
  const buffer = Buffer.from(dataBase64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
  fs.writeFileSync(destPath, buffer);

  const relPath = 'assets/' + safeName;
  appState.mainWindow?.webContents.send('penwright', { type: 'insertImage', src: relPath });
  appState.mainWindow?.webContents.send('penwright', { type: 'filetreeChanged' });
}

export function handleDropImagePath(imagePath: string): void {
  if (!appState.currentFilePath) return;
  const cleanPath = imagePath.replace('file://', '');
  const docDir = appState.projectDir || path.dirname(appState.currentFilePath);
  const rootDir = path.dirname(findRootFile(appState.currentFilePath));

  if (cleanPath.startsWith(docDir) || cleanPath.startsWith(rootDir)) {
    const relPath = path.relative(path.dirname(appState.currentFilePath), cleanPath).replace(/\\/g, '/');
    appState.mainWindow?.webContents.send('penwright', { type: 'insertImage', src: relPath });
    return;
  }

  const assetsDir = path.join(docDir, 'assets');
  if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });

  const destPath = path.join(assetsDir, path.basename(cleanPath));
  try {
    fs.copyFileSync(cleanPath, destPath);
    const relPath = 'assets/' + path.basename(cleanPath);
    appState.mainWindow?.webContents.send('penwright', { type: 'insertImage', src: relPath });
    appState.mainWindow?.webContents.send('penwright', { type: 'filetreeChanged' });
  } catch (err) {
    console.error('[penwright] Failed to copy image:', err);
  }
}

// ─── Settings Handlers ────────────────────────────────

export function handleRequestSettings(): void {
  const settings = parseSettings(appState.currentContent);
  appState.mainWindow?.webContents.send('penwright', {
    type: 'settingsData',
    settings,
  });
}

export function handleUpdateSettings(settings: Record<string, string>): void {
  appState.currentContent = applySettings(appState.currentContent, settings as unknown as import('../shared/settingsParser').DocumentSettings);
  appState.isDirty = true;
  import('./fileManager').then(({ updateTitle, autoSave }) => {
    updateTitle();
    autoSave();
  });

  appState.mainWindow?.webContents.send('penwright', {
    type: 'update',
    content: appState.currentContent,
  });
}

// ─── Claude Code Skills ──────────────────────────────

const SKILL_FILES: Array<{ slug: string; content: string }> = [
  { slug: 'typst', content: TYPST_SKILL },
  { slug: 'penwright', content: PENWRIGHT_SKILL },
  { slug: 'research', content: RESEARCH_SKILL },
  { slug: 'writing-style', content: WRITING_STYLE_SKILL },
  { slug: 'design', content: DESIGN_SKILL },
];

/**
 * Deploys the project's Claude Code skill set to `<dir>/.claude/skills/`.
 *
 * Per-skill behaviour: writes SKILL.md only if missing, so user edits to a
 * deployed skill are preserved across project re-opens. To force-update the
 * canonical content, the user (or the agent) deletes the file first.
 *
 * The skill content lives in `src/shared/skillTemplates.ts` and is shared
 * between this in-app deployment and the MCP server's prompt loader.
 */
export function ensureClaudeSkills(dir: string): void {
  const skillsDir = path.join(dir, '.claude', 'skills');
  fs.mkdirSync(skillsDir, { recursive: true });

  for (const skill of SKILL_FILES) {
    const subDir = path.join(skillsDir, skill.slug);
    fs.mkdirSync(subDir, { recursive: true });
    const target = path.join(subDir, 'SKILL.md');
    if (!fs.existsSync(target)) {
      fs.writeFileSync(target, skill.content, 'utf-8');
    }
  }
}
