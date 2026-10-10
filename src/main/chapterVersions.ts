/**
 * Chapter versions on disk. The planner lives in shared/; this file only
 * reads and writes, and keeps the open buffer in step with a swap.
 */

import { ipcMain } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import {
  collectVersions,
  sourceOfVersion,
  suggestVersionName,
  swapped,
  versionFileRel,
  type VersionDirEntry,
} from '../shared/chapterVersions';
import { noteDeleted } from '../shared/fileWrite';
import { appState } from './appState';
import { getCompiler, writeKnownBytes } from './fileManager';
import { isPathWithin } from './pathSecurity';

function projectDir(): string | null {
  return appState.projectDir;
}

function absInProject(rel: string): string | null {
  const dir = projectDir();
  if (!dir) return null;
  const abs = path.resolve(dir, rel);
  if (!isPathWithin(abs, dir)) return null;
  return abs;
}

function listDir(rel: string): Promise<VersionDirEntry[]> {
  const abs = absInProject(rel);
  if (!abs || !fs.existsSync(abs)) return Promise.resolve([]);
  let stat: fs.Stats;
  try {
    stat = fs.statSync(abs);
  } catch {
    return Promise.resolve([]);
  }
  if (!stat.isDirectory()) return Promise.resolve([]);
  const entries = fs.readdirSync(abs, { withFileTypes: true }).map((e) => ({
    name: e.name,
    path: `${rel}/${e.name}`.replace(/\/+/g, '/'),
    isDir: e.isDirectory(),
  }));
  return Promise.resolve(entries);
}

function namesIn(sourceRel: string): string[] {
  const folder = `versions/${sourceRel}`;
  const abs = absInProject(folder);
  if (!abs || !fs.existsSync(abs)) return [];
  try {
    return fs.readdirSync(abs).filter((n) => n.toLowerCase().endsWith('.typ'));
  } catch {
    return [];
  }
}

function changed(): void {
  appState.mainWindow?.webContents.send('penwright', { type: 'filetreeChanged' });
}

export function setupVersionIPC(): void {
  ipcMain.handle('versions:list', async () => {
    if (!projectDir()) return [];
    return collectVersions(listDir);
  });

  ipcMain.handle('versions:suggest', (_event, args: { sourceRel?: string }) => {
    const source = String(args?.sourceRel ?? '');
    if (!absInProject(source)) return '';
    return suggestVersionName(source, namesIn(source));
  });

  ipcMain.handle('versions:create', (_event, args: { sourceRel?: string; name?: string; content?: string }) => {
    const rel = versionFileRel(String(args?.sourceRel ?? ''), String(args?.name ?? ''));
    if (!rel) return { ok: false, error: 'name' };
    const abs = absInProject(rel);
    const sourceAbs = absInProject(String(args?.sourceRel ?? ''));
    if (!abs || !sourceAbs) return { ok: false, error: 'outside' };
    if (fs.existsSync(abs)) return { ok: false, error: 'exists' };
    const content = typeof args?.content === 'string' ? args.content : fs.readFileSync(sourceAbs, 'utf8');
    writeKnownBytes(abs, content);
    changed();
    return { ok: true, path: rel };
  });

  ipcMain.handle('versions:swap', (_event, args: { versionRel?: string; liveContent?: string; versionContent?: string }) => {
    const versionRel = String(args?.versionRel ?? '');
    const sourceRel = sourceOfVersion(versionRel);
    if (!sourceRel) return { ok: false, error: 'name' };
    const versionAbs = absInProject(versionRel);
    const sourceAbs = absInProject(sourceRel);
    if (!versionAbs || !sourceAbs) return { ok: false, error: 'outside' };
    if (!fs.existsSync(versionAbs) || !fs.existsSync(sourceAbs)) return { ok: false, error: 'missing' };
    const liveText = typeof args?.liveContent === 'string' ? args.liveContent : fs.readFileSync(sourceAbs, 'utf8');
    const versionText = typeof args?.versionContent === 'string' ? args.versionContent : fs.readFileSync(versionAbs, 'utf8');
    const next = swapped(liveText, versionText);
    writeKnownBytes(versionAbs, next.version);
    writeKnownBytes(sourceAbs, next.live);
    changed();
    getCompiler()?.compilePdf();
    return { ok: true };
  });

  ipcMain.handle('versions:rename', (_event, args: { versionRel?: string; name?: string }) => {
    const versionRel = String(args?.versionRel ?? '');
    const sourceRel = sourceOfVersion(versionRel);
    const nextRel = sourceRel ? versionFileRel(sourceRel, String(args?.name ?? '')) : null;
    if (!sourceRel || !nextRel) return { ok: false, error: 'name' };
    const from = absInProject(versionRel);
    const to = absInProject(nextRel);
    if (!from || !to) return { ok: false, error: 'outside' };
    if (!fs.existsSync(from)) return { ok: false, error: 'missing' };
    if (path.resolve(from) === path.resolve(to)) return { ok: true, path: versionRel };
    if (fs.existsSync(to)) return { ok: false, error: 'exists' };
    const content = fs.readFileSync(from, 'utf8');
    writeKnownBytes(to, content);
    noteDeleted(from);
    fs.unlinkSync(from);
    if (appState.currentFilePath && path.resolve(appState.currentFilePath) === path.resolve(from)) {
      appState.currentFilePath = to;
    }
    changed();
    return { ok: true, path: nextRel };
  });

  ipcMain.handle('versions:delete', (_event, args: { versionRel?: string }) => {
    const versionRel = String(args?.versionRel ?? '');
    if (!sourceOfVersion(versionRel)) return { ok: false, error: 'name' };
    const abs = absInProject(versionRel);
    if (!abs) return { ok: false, error: 'outside' };
    if (!fs.existsSync(abs)) return { ok: false, error: 'missing' };
    noteDeleted(abs);
    fs.unlinkSync(abs);
    changed();
    return { ok: true };
  });
}
