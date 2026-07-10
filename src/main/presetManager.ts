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
import { execFileSync } from 'node:child_process';
import * as path from 'path';
import * as fs from 'fs';
import simpleGit from 'simple-git';
import { appState } from './appState';
import { getLocale } from './persistenceManager';
import { resolveDict } from '../shared/i18n';
import { addBreadcrumb } from './crashReporter';
import { getTypstPath, buildTypstCompileArgs } from './typstPath';
import {
  PROJECT_TYPES, localize, localizeList,
  type PresetManifest, type GalleryItem, type Locale, type SavePresetInput,
} from '../shared/presetTypes';
import { sanitizeProjectStyle, type ProjectStyle } from '../shared/styleTypes';
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

/**
 * The WRITABLE user preset library — where "Save as preset" stores the user's
 * own reusable starting points. Lives in userData so it survives app updates
 * (the bundled library inside the .app is read-only). Created on first use.
 */
export function userPresetsDir(): string {
  return path.join(app.getPath('userData'), 'presets');
}

/** All preset roots, in gallery order (bundled first, then the user's own). */
function presetRoots(): { dir: string; origin: 'bundled' | 'user' }[] {
  const roots: { dir: string; origin: 'bundled' | 'user' }[] = [];
  const bundled = findBundledPresetsDir();
  if (bundled) roots.push({ dir: bundled, origin: 'bundled' });
  roots.push({ dir: userPresetsDir(), origin: 'user' });
  return roots;
}

interface ScannedPreset {
  manifest: PresetManifest;
  dir: string;
  origin: 'bundled' | 'user';
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

/** Scans every preset folder across all roots (skipping `_shared`, dotfiles,
 *  non-manifest dirs). A user preset id shadows a bundled one of the same id. */
function scanPresetDirs(): ScannedPreset[] {
  const out: ScannedPreset[] = [];
  const seen = new Set<string>();
  for (const { dir: root, origin } of presetRoots()) {
    let entries: fs.Dirent[];
    try { entries = fs.readdirSync(root, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      if (!e.isDirectory() || e.name.startsWith('_') || e.name.startsWith('.')) continue;
      const dir = path.join(root, e.name);
      const manifest = readManifest(dir);
      if (!manifest || seen.has(manifest.id)) continue;
      seen.add(manifest.id);
      out.push({ manifest, dir, origin });
    }
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

  // Rich presets — scanned folders (bundled + the user's own).
  const scanned = scanPresetDirs().sort((a, b) => (a.manifest.order ?? 100) - (b.manifest.order ?? 100));
  for (const { manifest, dir, origin } of scanned) {
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
      origin,
    });
  }

  return items;
}

// ─── Import design FROM a preset (into the open project) ─────────────────────

/** Lists presets that ship a design (`.penwright/style.json`) — the sources a
 *  user can import a look / palette / layout / rubrics FROM, in the Design panel. */
export function listPresetStyles(locale: Locale = getLocale() as Locale): { id: string; label: string; type: string; sections: number }[] {
  const out: { id: string; label: string; type: string; sections: number }[] = [];
  for (const { manifest, dir } of scanPresetDirs()) {
    const p = path.join(dir, '.penwright', 'style.json');
    if (!fs.existsSync(p)) continue;
    let sections = 0;
    try { sections = (JSON.parse(fs.readFileSync(p, 'utf-8')).sections?.length as number) ?? 0; } catch { /* ignore */ }
    out.push({ id: manifest.id, label: localize(manifest.label, locale), type: manifest.type, sections });
  }
  return out;
}

/** The sanitized ProjectStyle a preset ships, or null. The renderer merges the
 *  chosen scope into the open project's style and saves through the normal
 *  safe-apply path (compile-verify-or-rollback) — no new apply code. */
export function getPresetStyle(presetId: string): ProjectStyle | null {
  const found = scanPresetDirs().find((s) => s.manifest.id === presetId);
  if (!found) return null;
  const p = path.join(found.dir, '.penwright', 'style.json');
  try { return sanitizeProjectStyle(JSON.parse(fs.readFileSync(p, 'utf-8'))); }
  catch { return null; }
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
export async function createFromPreset(presetId: string, suggestedName?: string): Promise<string | null> {
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

  const target = await pickPresetTargetDir((suggestedName && suggestedName.trim()) || manifest.id);
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

// ─── Save the current project as a reusable user preset ──────────────────────

/** kebab-case slug for a preset id from a human label. */
function slugify(s: string): string {
  return (s || '')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    .slice(0, 48).replace(/-+$/, '') || 'preset';
}

/** Directories never carried into a saved preset (regenerated on create, or
 *  machine-/history-specific). `.penwright` is special-cased to keep only
 *  style.json (the design tokens); backups/ai-snapshots/preferences are dropped. */
const SAVE_SKIP_DIRS = new Set(['.git', 'node_modules', 'dist', 'build', '.claude']);

/** Copies an open project into a preset folder, stripping git/build/history and
 *  keeping only `.penwright/style.json` from the project-local state. */
function copyProjectToPreset(src: string, dest: string): void {
  fs.mkdirSync(dest, { recursive: true });
  const walk = (s: string, d: string) => {
    for (const e of fs.readdirSync(s, { withFileTypes: true })) {
      const name = e.name;
      if (name === '.DS_Store' || name === 'preset.json' || /^thumbnail\.(png|jpe?g|webp)$/i.test(name)) continue;
      if (e.isDirectory()) {
        if (SAVE_SKIP_DIRS.has(name)) continue;
        if (name === '.penwright') {
          const styleJson = path.join(s, name, 'style.json');
          if (fs.existsSync(styleJson)) {
            fs.mkdirSync(path.join(d, name), { recursive: true });
            fs.copyFileSync(styleJson, path.join(d, name, 'style.json'));
          }
          continue;
        }
        fs.mkdirSync(path.join(d, name), { recursive: true });
        walk(path.join(s, name), path.join(d, name));
      } else if (e.isFile() && !name.toLowerCase().endsWith('.pdf')) {
        fs.copyFileSync(path.join(s, name), path.join(d, name));
      }
    }
  };
  walk(src, dest);
}

/** Finds the root .typ file inside a preset/project dir. */
function findRootFileIn(dir: string): string | null {
  for (const n of ['main.typ', 'document.typ', 'index.typ']) {
    const p = path.join(dir, n);
    if (fs.existsSync(p)) return p;
  }
  try { const f = fs.readdirSync(dir).find((x) => x.endsWith('.typ')); return f ? path.join(dir, f) : null; }
  catch { return null; }
}

/** Renders page 1 of a project to a PNG thumbnail with the bundled Typst.
 *  Best-effort — a render failure just leaves the card with its type glyph. */
function renderThumbnail(projectDir: string, rootAbs: string, outPng: string): boolean {
  try {
    execFileSync(
      getTypstPath(),
      buildTypstCompileArgs(['--root', projectDir, '--pages', '1', '--ppi', '96', '--format', 'png', rootAbs, outPng]),
      { stdio: 'ignore', timeout: 90_000 },
    );
    return fs.existsSync(outPng);
  } catch {
    return false;
  }
}

/**
 * Saves the CURRENTLY OPEN project as a reusable user preset in the writable
 * userData library: copies it (minus git/build/history, keeping style.json),
 * renders a page-1 thumbnail, and writes a `preset.json`. The saved preset then
 * appears in the New-Project gallery under its type, alongside the bundled ones.
 */
export async function saveProjectAsPreset(input: SavePresetInput): Promise<{ ok: boolean; id?: string; error?: string }> {
  const src = appState.projectDir;
  if (!src || !fs.existsSync(src)) return { ok: false, error: 'no-project' };
  const label = (input.label || '').trim();
  if (!label) return { ok: false, error: 'no-label' };
  const type = PROJECT_TYPES.some((t) => t.id === input.type) ? input.type : 'document';

  const root = userPresetsDir();
  fs.mkdirSync(root, { recursive: true });
  const base = slugify(label);
  let id = base, i = 2;
  while (fs.existsSync(path.join(root, id))) { id = `${base}-${i}`; i++; }
  const dest = path.join(root, id);

  try {
    copyProjectToPreset(src, dest);
  } catch (err) {
    try { fs.rmSync(dest, { recursive: true, force: true }); } catch { /* ignore */ }
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }

  const rootAbs = findRootFileIn(dest);
  if (rootAbs) renderThumbnail(dest, rootAbs, path.join(dest, 'thumbnail.png'));

  const tag = input.tagline?.trim() || '';
  const manifest: PresetManifest = {
    id, type,
    label: { en: label, de: label },
    tagline: { en: tag, de: tag },
    root: rootAbs ? path.basename(rootAbs) : 'main.typ',
    order: 50,
  };
  fs.writeFileSync(path.join(dest, 'preset.json'), JSON.stringify(manifest, null, 2), 'utf-8');
  addBreadcrumb('project', `saved project as preset ${id}`);
  return { ok: true, id };
}

/** Deletes a USER preset (never a bundled one). Guards the userData root. */
export function deleteUserPreset(id: string): { ok: boolean } {
  const root = userPresetsDir();
  const dir = path.join(root, id);
  const inside = path.resolve(dir).startsWith(path.resolve(root) + path.sep);
  if (!inside || !fs.existsSync(dir)) return { ok: false };
  try { fs.rmSync(dir, { recursive: true, force: true }); return { ok: true }; }
  catch { return { ok: false }; }
}
