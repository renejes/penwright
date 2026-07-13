/**
 * Preset library — electron-free core (scan + copy) shared by BOTH the Electron
 * main process (presetManager) and the standalone MCP server (Bun binary), so an
 * AI agent can create a project from a bundled preset the same way the in-app
 * gallery does. fs/path only — no Electron, no Node-Electron APIs.
 */
import fs from 'node:fs';
import path from 'node:path';
import type { PresetManifest } from './presetTypes';

/** Library-only files that must NOT be copied into the user's new project. */
const LIBRARY_FILES = new Set(['preset.json', 'thumbnail.png', 'thumbnail.jpg', 'thumbnail.jpeg', 'thumbnail.webp']);

export interface ScannedPreset {
  manifest: PresetManifest;
  dir: string;
}

/** Reads + validates one preset folder's `preset.json`. */
export function readPresetManifest(dir: string): PresetManifest | null {
  try {
    const m = JSON.parse(fs.readFileSync(path.join(dir, 'preset.json'), 'utf-8')) as PresetManifest;
    if (!m || typeof m.id !== 'string' || typeof m.type !== 'string' || !m.label) return null;
    return m;
  } catch {
    return null;
  }
}

/** Scans one preset root, skipping `_shared`, dotfiles + non-manifest folders. */
export function scanPresetsDir(root: string): ScannedPreset[] {
  const out: ScannedPreset[] = [];
  let entries: fs.Dirent[];
  try { entries = fs.readdirSync(root, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    if (!e.isDirectory() || e.name.startsWith('_') || e.name.startsWith('.')) continue;
    const dir = path.join(root, e.name);
    const manifest = readPresetManifest(dir);
    if (manifest) out.push({ manifest, dir });
  }
  return out;
}

/**
 * Copies a preset folder into a new project dir VERBATIM, minus the library-only
 * files (preset.json / thumbnail) and any `.git`. This is the WYSIWYG guarantee:
 * what ships is what the user/agent gets.
 */
export function copyPresetFolder(src: string, dest: string, top = true): void {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (entry.name === '.git') continue;
    if (top && LIBRARY_FILES.has(entry.name)) continue;
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyPresetFolder(s, d, false);
    else if (entry.isFile()) fs.copyFileSync(s, d);
  }
}
