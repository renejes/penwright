/**
 * Preset library — main-process side.
 *
 * Scans the bundled `resources/presets/` directory (one real, compile-tested
 * project folder per preset) and materialises a chosen preset by copying its
 * folder verbatim — the WYSIWYG guarantee: what ships is what the user gets.
 * Generalises `projectManager.openSampleProject` (which is the same
 * copy → git-init → open flow for the single sample project).
 *
 * The gallery combines two kinds of starting point:
 *  • "Blank" cards — one per project type, backed by the thin `projectTemplates`
 *    entries and materialised by `projectManager.handleCreateProject`.
 *  • rich preset cards — the folders scanned here, materialised by
 *    `createFromPreset` below.
 */

import { app, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import simpleGit from 'simple-git';
import { appState } from './appState';
import { getLocale } from './persistenceManager';
import { resolveDict } from '../shared/i18n';
import { addBreadcrumb } from './crashReporter';
import {
  PROJECT_TYPES, localize, localizeList,
  type PresetManifest, type GalleryItem, type Locale,
} from '../shared/presetTypes';
import { openProject, ensureProjectInfrastructure } from './projectManager';

const IMAGE_MIME: Record<string, string> = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
};
/** Library-only files that must NOT land in the user's copied project. */
const LIBRARY_FILES = new Set(['preset.json', 'thumbnail.png', 'thumbnail.jpg', 'thumbnail.webp']);
const MAX_THUMB_BYTES = 1_500_000;

/**
 * Resolves the bundled `resources/presets/` directory. Production: under
 * `process.resourcesPath`; dev: walk up from `dist/main/` to the repo.
 */
function findBundledPresetsDir(): string | null {
  const candidates: string[] = [];
  if (process.resourcesPath) candidates.push(path.join(process.resourcesPath, 'presets'));
  candidates.push(path.resolve(__dirname, '..', '..', 'resources', 'presets'));
  candidates.push(path.resolve(process.cwd(), 'resources', 'presets'));
  for (const c of candidates) {
    if (fs.existsSync(c) && fs.statSync(c).isDirectory()) return c;
  }
  return null;
}

interface ScannedPreset {
  manifest: PresetManifest;
  dir: string;
}

/** Reads + validates one preset folder's `preset.json`. */
function readManifest(dir: string): PresetManifest | null {
  const p = path.join(dir, 'preset.json');
  try {
    if (!fs.existsSync(p)) return null;
    const m = JSON.parse(fs.readFileSync(p, 'utf-8')) as PresetManifest;
    if (!m || typeof m.id !== 'string' || typeof m.type !== 'string' || !m.label) return null;
    return m;
  } catch {
    return null;
  }
}

/** Scans every preset folder (skipping `_shared`, dotfiles, non-manifest dirs). */
function scanPresetDirs(): ScannedPreset[] {
  const root = findBundledPresetsDir();
  if (!root) return [];
  const out: ScannedPreset[] = [];
  let entries: fs.Dirent[];
  try { entries = fs.readdirSync(root, { withFileTypes: true }); } catch { return []; }
  for (const e of entries) {
    if (!e.isDirectory() || e.name.startsWith('_') || e.name.startsWith('.')) continue;
    const dir = path.join(root, e.name);
    const manifest = readManifest(dir);
    if (manifest) out.push({ manifest, dir });
  }
  return out;
}

/** A preset's thumbnail as a data: URI, or undefined when absent/too large. */
function thumbnailDataUri(dir: string): string | undefined {
  for (const name of ['thumbnail.png', 'thumbnail.jpg', 'thumbnail.webp']) {
    const p = path.join(dir, name);
    try {
      if (!fs.existsSync(p)) continue;
      const st = fs.statSync(p);
      if (!st.isFile() || st.size > MAX_THUMB_BYTES) continue;
      const mime = IMAGE_MIME[path.extname(name).toLowerCase()] ?? 'image/png';
      return `data:${mime};base64,${fs.readFileSync(p).toString('base64')}`;
    } catch { /* keep looking */ }
  }
  return undefined;
}

/**
 * Builds the full gallery for the New-Project dialog, resolved for the active
 * locale: a "Blank" card per project type, followed by that type's rich presets.
 * The renderer groups by `type` (order from PROJECT_TYPES) — presentation-only.
 */
export function buildGallery(locale: Locale = getLocale() as Locale): GalleryItem[] {
  const items: GalleryItem[] = [];

  // Blank starters — one per type that names a thin template.
  for (const t of PROJECT_TYPES) {
    if (!t.blankTemplateId) continue;
    items.push({
      key: `template:${t.blankTemplateId}`,
      kind: 'template',
      id: t.blankTemplateId,
      type: t.id,
      label: locale === 'de' ? 'Leeres Projekt' : 'Blank',
      tagline: localize(t.description, locale),
      highlights: [],
      icon: t.icon,
    });
  }

  // Rich presets — scanned folders.
  const scanned = scanPresetDirs().sort((a, b) => (a.manifest.order ?? 100) - (b.manifest.order ?? 100));
  for (const { manifest, dir } of scanned) {
    const type = PROJECT_TYPES.find((t) => t.id === manifest.type);
    items.push({
      key: `preset:${manifest.id}`,
      kind: 'preset',
      id: manifest.id,
      type: manifest.type,
      label: localize(manifest.label, locale),
      tagline: localize(manifest.tagline, locale),
      highlights: localizeList(manifest.highlights, locale),
      thumbnail: thumbnailDataUri(dir),
      icon: type?.icon ?? '✨',
    });
  }

  return items;
}

/** Recursive copy, skipping library-only files at the TOP level + never .git. */
function copyPresetDir(src: string, dest: string, top = true): void {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (entry.name === '.git') continue;
    if (top && LIBRARY_FILES.has(entry.name)) continue;
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyPresetDir(s, d, false);
    else if (entry.isFile()) fs.copyFileSync(s, d);
  }
}

/** Picks a target directory for the copy (Documents/<suggested>, deduped). */
async function pickPresetTargetDir(suggested: string): Promise<string | null> {
  if (!appState.mainWindow) return null;
  const documents = app.getPath('documents');
  const base = suggested.replace(/[^a-z0-9-]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'penwright-project';
  let candidate = path.join(documents, base);
  let counter = 2;
  while (fs.existsSync(candidate)) { candidate = path.join(documents, `${base}-${counter}`); counter++; }

  const md = resolveDict(getLocale()).mainDialogs;
  const result = await dialog.showSaveDialog(appState.mainWindow, {
    title: md.chooseProjectLocationTitle,
    defaultPath: candidate,
    buttonLabel: md.createHere,
    properties: ['createDirectory'],
  });
  if (result.canceled || !result.filePath) return null;
  return result.filePath;
}

/**
 * Materialises a rich preset: copies its folder to a user-chosen location,
 * initialises Git + the .penwright skeleton + a first version, then opens it
 * (landing on the manifest's `openFile` so the user starts on writable content,
 * not a cover). Returns the project dir, or null if cancelled/failed.
 */
export async function createFromPreset(presetId: string): Promise<string | null> {
  const md = resolveDict(getLocale()).mainDialogs;
  const found = scanPresetDirs().find((s) => s.manifest.id === presetId);
  if (!found) {
    if (appState.mainWindow) {
      await dialog.showMessageBox(appState.mainWindow, {
        type: 'error', message: md.sampleProjectNotFound, detail: presetId,
      });
    }
    return null;
  }
  const { manifest, dir } = found;

  // Tear down any currently-open project before copying + opening.
  const { closeProjectInteractive } = await import('./fileManager');
  if (appState.projectDir) {
    const closed = await closeProjectInteractive();
    if (!closed) return null;
  }

  const target = await pickPresetTargetDir(manifest.id);
  if (!target) return null;

  try {
    copyPresetDir(dir, target);
  } catch (err) {
    if (appState.mainWindow) {
      await dialog.showMessageBox(appState.mainWindow, {
        type: 'error', message: md.sampleProjectCreateFailed,
        detail: err instanceof Error ? err.message : String(err),
      });
    }
    return null;
  }

  // Git + .penwright skeleton + first commit (idempotent; the preset ships its
  // own style.json/style.typ, which ensureProjectInfrastructure leaves intact).
  await ensureProjectInfrastructure(target, `New from preset — ${localize(manifest.label, 'en')}`);
  addBreadcrumb('project', `created from preset ${manifest.id}`);

  const opened = await openProject(target);
  if (!opened) return null;

  // Land on the writable opening chapter (e.g. the editorial), not the cover.
  const openRel = manifest.openFile;
  if (openRel) {
    const openAbs = path.join(target, openRel);
    if (fs.existsSync(openAbs) && path.resolve(openAbs).startsWith(path.resolve(target) + path.sep)) {
      const { openFile } = await import('./fileManager');
      await openFile(openAbs);
    }
  }
  return opened;
}
