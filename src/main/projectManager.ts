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
import { writeActiveProject } from '../shared/sessionState';
import { resolveDesignRoot } from '../shared/styleWrite';
import { noteDiskContent } from '../shared/fileWrite';
import { scaffoldProject, ensureStyleFiles, ensureSkills } from '../shared/projectScaffold';
import { placeAsset, placeAssetFromPath, assetPathFrom, isInsideProject } from '../shared/assetPlacement';
import { generateStyleTypst } from '../shared/styleParser';
import { DEFAULT_PROJECT_STYLE, sanitizeProjectStyle } from '../shared/styleTypes';
import { TYPST_SKILL, PENWRIGHT_SKILL, RESEARCH_SKILL, WRITING_STYLE_SKILL, DESIGN_SKILL } from '../shared/skillTemplates';
import { appState } from './appState';
import { addBreadcrumb } from './crashReporter';
import { getLocale } from './persistenceManager';
import { resolveDict } from '../shared/i18n';
import { ensureGitIdentity } from '../shared/gitIdentity';

/**
 * The five project skills, in the shape `shared/projectScaffold` wants.
 * Deployed on every creation path — including the MCP ones, which used to
 * leave the next agent with no idea what the project's conventions were.
 */
export const SKILL_FILES = [
  { slug: 'typst', content: TYPST_SKILL },
  { slug: 'penwright', content: PENWRIGHT_SKILL },
  { slug: 'research', content: RESEARCH_SKILL },
  { slug: 'writing-style', content: WRITING_STYLE_SKILL },
  { slug: 'design', content: DESIGN_SKILL },
];

/** The two project-specific pieces `scaffoldProject` needs injected. */
export function styleScaffoldArgs(): {
  defaultStyleJson: string;
  renderStyleTyp: (styleJson: string) => string;
} {
  return {
    defaultStyleJson: JSON.stringify(sanitizeProjectStyle(DEFAULT_PROJECT_STYLE), null, 2),
    renderStyleTyp: (json) => {
      let style;
      try { style = sanitizeProjectStyle(JSON.parse(json)); }
      catch { style = sanitizeProjectStyle(DEFAULT_PROJECT_STYLE); }
      return generateStyleTypst(style);
    },
  };
}

/**
 * Ensures a project has a Git repo + .gitignore + `.penwright/` + a `style.typ`
 * so that "Version speichern" works immediately. Idempotent — safe to call on
 * existing projects.
 *
 * The defaults are the CONSERVATIVE ones, because this is reachable from
 * `git:ensureRepo` — i.e. from a plain "Save Version" on a folder the user
 * opened from outside Penwright. That must not start creating `assets/`,
 * `sources/` and `.claude/skills/` in someone's document folder as a side
 * effect of saving. The creation paths opt in explicitly.
 *
 * `wireRoot` is likewise off by default: silently injecting `#show: apply-style`
 * into a document somebody already made would change how it looks.
 */
export async function ensureProjectInfrastructure(
  dir: string,
  initialMessage = 'Initial version',
  opts: { wireRoot?: boolean; skills?: boolean; standardDirs?: boolean } = {},
): Promise<void> {
  const res = await scaffoldProject({
    dir,
    skills: opts.skills ? SKILL_FILES : [],
    standardDirs: opts.standardDirs ?? false,
    wireRoot: opts.wireRoot ?? false,
    initialCommitMessage: initialMessage,
    git: (d) => simpleGit(d),
    ensureIdentity: ensureGitIdentity,
    ...styleScaffoldArgs(),
  });
  for (const w of res.warnings) console.warn('[penwright]', w);
}

/**
 * Ensures the project has a `style.typ` (the document's Look) + a `.penwright/
 * style.json` (the design tokens). With `injectImport` it also wires the root
 * file to apply the style.
 *
 * A project whose design lives in an authored style.typ gets NOTHING from here
 * — the guard lives in `ensureStyleFiles`; see the note there about how a
 * default style.json used to disarm it.
 */
export function ensureStyleFile(dir: string, injectImport: boolean): void {
  ensureStyleFiles({ dir, wireRoot: injectImport, ...styleScaffoldArgs() });
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

  // Standard folders, .gitignore, .penwright/, skills, style.typ, Git repo and
  // the first commit — one call, the same one `penwright_create_project` makes.
  // `wireRoot: true` because this project is being created: the root gets
  // `#import "style.typ": *` from the start, so the Look is designable
  // immediately (the default fonts match the templates, so it is seamless).
  await ensureProjectInfrastructure(dir, `Initial version (${template.label})`, {
    wireRoot: true, skills: true, standardDirs: true,
  });

  appState.projectDir = dir;
  writeActiveProject(dir);
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
  writeActiveProject(projectDir);

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

  // Git + first version so the Verlauf shows one entry from the start, plus
  // the skills and the .penwright/ skeleton — through the same scaffold every
  // other creation path uses. `wireRoot: false`: the sample ships its own
  // finished design and must not be restyled on the way in.
  // The sample ships its own finished design and folder layout: skills yes,
  // extra folders no, and definitely no restyling on the way in.
  await ensureProjectInfrastructure(targetDir, 'Sample — initial state', { skills: true });

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

  const added: string[] = [];
  for (const src of result.filePaths) {
    try {
      added.push(placeAssetFromPath(appState.projectDir, src).rel);
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

  if (appState.currentFilePath) insertImageIntoDocument(result.filePaths[0]);
}

/**
 * The project directory an image belongs to. Falls back to the open file's
 * folder for the (rare) case of a loose file opened without a project.
 */
function assetProjectDir(): string | null {
  if (appState.projectDir) return appState.projectDir;
  return appState.currentFilePath ? path.dirname(appState.currentFilePath) : null;
}

/**
 * Copies an image into the project and tells the renderer to insert it.
 *
 * Every image entering the app goes through here, so all three entry points
 * (picker, dropped file, dropped path) place the file identically and quote a
 * path Typst can resolve from the file being edited.
 */
function insertImageIntoDocument(srcAbs: string, data?: Buffer): void {
  const projectDir = assetProjectDir();
  if (!projectDir || !appState.currentFilePath) return;
  try {
    const placed = data
      ? placeAsset(projectDir, path.basename(srcAbs), data)
      : placeAssetFromPath(projectDir, srcAbs);
    appState.mainWindow?.webContents.send('penwright', {
      type: 'insertImage',
      src: assetPathFrom(appState.currentFilePath, placed.abs),
    });
    if (!placed.reused) {
      appState.mainWindow?.webContents.send('penwright', { type: 'filetreeChanged' });
    }
  } catch (err) {
    console.error('[penwright] Failed to place image:', err);
  }
}

export function handleDropImage(name: string, dataBase64: string): void {
  if (!appState.currentFilePath) return;
  // `name` comes from the renderer (a dropped File's name); `placeAsset`
  // strips any directory component so a crafted `../…` cannot escape assets/.
  const buffer = Buffer.from(dataBase64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
  insertImageIntoDocument(name, buffer);
}

export function handleDropImagePath(imagePath: string): void {
  if (!appState.currentFilePath) return;
  const cleanPath = imagePath.replace('file://', '');
  const projectDir = assetProjectDir();
  if (!projectDir) return;

  // Already inside the project — reference it where it is rather than making
  // a second copy under assets/.
  const rootDir = path.dirname(findRootFile(appState.currentFilePath));
  if (isInsideProject(projectDir, cleanPath) || isInsideProject(rootDir, cleanPath)) {
    appState.mainWindow?.webContents.send('penwright', {
      type: 'insertImage',
      src: assetPathFrom(appState.currentFilePath, cleanPath),
    });
    return;
  }

  insertImageIntoDocument(cleanPath);
}

// ─── Settings Handlers ────────────────────────────────

/**
 * The file document settings belong to: the project's root.
 *
 * `lang` and `bibliographyStyle` are `#set` rules that govern the DOCUMENT.
 * Both handlers used to read and write `appState.currentContent` — the file in
 * the editor — so choosing a language while a chapter was open put
 * `#set text(lang: "de")` into that chapter alone, where it governs only the
 * chapter, while the root kept its old value. The MCP side resolves the root
 * (`readRootDocument`), so the two processes then disagreed about which file
 * "the document settings" even lives in, and could produce two conflicting
 * `#set text(lang:)` rules in one document with neither aware of the other.
 *
 * Null is not fatal here — a loose file opened without a project is still
 * editable, and its own buffer is the honest target.
 */
function settingsTarget(): { file: string | null; content: string } {
  if (appState.projectDir) {
    const root = resolveDesignRoot(appState.projectDir, appState.currentFilePath);
    if (root && fs.existsSync(root)) {
      // The open buffer wins when it IS the root — it may hold unsaved edits
      // that the file on disk does not.
      if (appState.currentFilePath && path.resolve(root) === path.resolve(appState.currentFilePath)) {
        return { file: root, content: appState.currentContent };
      }
      try { return { file: root, content: fs.readFileSync(root, 'utf-8') }; } catch { /* fall through */ }
    }
  }
  return { file: appState.currentFilePath, content: appState.currentContent };
}

export function handleRequestSettings(): void {
  const settings = parseSettings(settingsTarget().content);
  appState.mainWindow?.webContents.send('penwright', {
    type: 'settingsData',
    settings,
  });
}

export function handleUpdateSettings(settings: Record<string, string>): void {
  const target = settingsTarget();
  const updated = applySettings(
    target.content,
    settings as unknown as import('../shared/settingsParser').DocumentSettings,
  );

  const isOpenFile = !!appState.currentFilePath && !!target.file &&
    path.resolve(target.file) === path.resolve(appState.currentFilePath);

  if (isOpenFile) {
    appState.currentContent = updated;
    appState.isDirty = true;
    import('./fileManager').then(({ updateTitle, autoSave }) => {
      updateTitle();
      autoSave();
    });
    appState.mainWindow?.webContents.send('penwright', {
      type: 'update',
      content: appState.currentContent,
    });
    return;
  }

  // The root is not the file on screen: write it directly and record the write
  // so the watcher does not bounce it back as a foreign change.
  if (!target.file) return;
  try {
    fs.writeFileSync(target.file, updated, 'utf-8');
    noteDiskContent(target.file, updated);
    appState.mainWindow?.webContents.send('penwright', { type: 'filetreeChanged' });
  } catch (err) {
    console.warn('[penwright] Could not write document settings to the root file:', err);
  }
}

// ─── Claude Code Skills ──────────────────────────────

/**
 * Deploys the project's Claude Code skill set to `<dir>/.claude/skills/`.
 *
 * Per-skill behaviour: writes SKILL.md only if missing, so user edits to a
 * deployed skill are preserved across project re-opens. To force-update the
 * canonical content, the user (or the agent) deletes the file first.
 *
 * The skill content lives in `src/shared/skillTemplates.ts`; the deployment
 * itself lives in `shared/projectScaffold` so the MCP creation paths — which
 * used to skip skills entirely — get exactly the same files.
 */
export function ensureClaudeSkills(dir: string): void {
  ensureSkills(dir, SKILL_FILES);
}
