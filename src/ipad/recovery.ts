/**
 * Auto-backups and AI-edit snapshots for the iPad host.
 *
 * Same folders the Mac writes, so a Dropbox project round-trips:
 * `.penwright/backups/<stamp>/` plus `.meta.json`, and
 * `.penwright/ai-snapshots/<stamp>_<file>.json`. Chapter writes still go
 * through `saveRefusal` — only this module touches those two stores.
 * Locks and `.penwright/typeset` stay out.
 */

import type { ProjectFs } from './projectFs';

export interface BackupSnapshot {
  timestamp: string;
  timestampMs: number;
  fileCount: number;
  totalBytes: number;
}

export interface BackupConfig {
  intervalSec: number;
  maxCount: number;
  maxAiSnapshots: number;
}

export interface AiSnap {
  timestamp: number;
  filePath: string;
  bytes: number;
  diskName: string;
  content: string;
}

export const DEFAULT_BACKUP_CONFIG: BackupConfig = {
  intervalSec: 30,
  maxCount: 30,
  maxAiSnapshots: 20,
};

const BACKUP_ROOT = '.penwright/backups';
const SNAPSHOT_ROOT = '.penwright/ai-snapshots';
const SKIP_DIRS = new Set(['.git', '.penwright', 'node_modules', '.DS_Store', 'dist', 'build', 'assets', 'sources']);
const BACKUP_EXT = new Set(['.typ', '.bib']);

export function sanitizeBackupConfig(raw: Partial<BackupConfig> | null | undefined): BackupConfig {
  const interval = raw?.intervalSec;
  const maxCount = raw?.maxCount;
  const maxAi = raw?.maxAiSnapshots;
  return {
    intervalSec: typeof interval === 'number' && interval >= 5 ? Math.min(3600, Math.round(interval)) : DEFAULT_BACKUP_CONFIG.intervalSec,
    maxCount: typeof maxCount === 'number' && maxCount >= 1 ? Math.min(10000, Math.round(maxCount)) : DEFAULT_BACKUP_CONFIG.maxCount,
    maxAiSnapshots: typeof maxAi === 'number' && maxAi >= 1 ? Math.min(1000, Math.round(maxAi)) : DEFAULT_BACKUP_CONFIG.maxAiSnapshots,
  };
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** Same stamp the Mac writer uses: `2026-04-27_14-32-15`. */
export function formatBackupStamp(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
}

function extname(name: string): string {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i).toLowerCase() : '';
}

function safeProjectRel(rel: string): boolean {
  const parts = rel.split('/').filter(Boolean);
  if (parts.length === 0) return false;
  return parts.every((part) => part !== '..' && part !== '.' && !part.startsWith('.'));
}

async function removeTree(fs: ProjectFs, path: string): Promise<void> {
  try {
    await fs.removeDir(path);
    return;
  } catch {
    /* a provider that only deletes files still needs the walk below */
  }
  let entries: Awaited<ReturnType<ProjectFs['readDir']>> = [];
  try {
    entries = await fs.readDir(path);
  } catch {
    return;
  }
  for (const entry of entries) {
    const child = `${path}/${entry.name}`;
    if (entry.isDir) await removeTree(fs, child);
    else {
      try { await fs.remove(child); } catch { /* already gone */ }
    }
  }
  try { await fs.removeDir(path); } catch { /* the folder may already be gone */ }
}

async function collectBackupRels(fs: ProjectFs, dir: string, depth: number): Promise<string[]> {
  if (depth > 5) return [];
  let entries: Awaited<ReturnType<ProjectFs['readDir']>> = [];
  try {
    entries = await fs.readDir(dir);
  } catch {
    return [];
  }
  const out: string[] = [];
  for (const entry of entries) {
    if (!entry.name || entry.name.startsWith('.') || SKIP_DIRS.has(entry.name)) continue;
    const rel = dir ? `${dir}/${entry.name}` : entry.name;
    if (entry.isDir) out.push(...await collectBackupRels(fs, rel, depth + 1));
    else if (BACKUP_EXT.has(extname(entry.name))) out.push(rel);
  }
  return out;
}

export async function createBackup(
  fs: ProjectFs,
  live: { rel: string; content: string } | null,
  maxCount: number,
  now = new Date(),
): Promise<BackupSnapshot | null> {
  const rels = new Set(await collectBackupRels(fs, '', 0));
  if (live && safeProjectRel(live.rel) && BACKUP_EXT.has(extname(live.rel.split('/').pop() ?? ''))) {
    rels.add(live.rel);
  }
  if (rels.size === 0) return null;

  let stamp = formatBackupStamp(now);
  let n = 2;
  while (await fs.exists(`${BACKUP_ROOT}/${stamp}`)) {
    stamp = `${formatBackupStamp(now)}-${n}`;
    n += 1;
  }
  const root = `${BACKUP_ROOT}/${stamp}`;
  const files: string[] = [];
  let totalBytes = 0;
  for (const rel of rels) {
    if (!safeProjectRel(rel)) continue;
    let content: string;
    if (live && rel === live.rel) content = live.content;
    else {
      try { content = await fs.readText(rel); } catch { continue; }
    }
    try {
      await fs.writeText(`${root}/${rel}`, content);
      files.push(rel);
      totalBytes += new TextEncoder().encode(content).length;
    } catch {
      /* one unreadable file does not drop the rest of the snapshot */
    }
  }
  if (files.length === 0) {
    await removeTree(fs, root);
    return null;
  }
  const snapshot: BackupSnapshot = {
    timestamp: stamp,
    timestampMs: now.getTime(),
    fileCount: files.length,
    totalBytes,
  };
  await fs.writeText(`${root}/.meta.json`, JSON.stringify({
    timestamp: stamp,
    timestampMs: snapshot.timestampMs,
    files,
    totalBytes,
  }));
  await pruneBackups(fs, maxCount);
  return snapshot;
}

export async function listBackups(fs: ProjectFs): Promise<BackupSnapshot[]> {
  let entries: Awaited<ReturnType<ProjectFs['readDir']>> = [];
  try {
    entries = await fs.readDir(BACKUP_ROOT);
  } catch {
    return [];
  }
  const out: BackupSnapshot[] = [];
  for (const entry of entries) {
    if (!entry.isDir || entry.name.startsWith('.')) continue;
    if (!/^[\w-]+$/.test(entry.name)) continue;
    let timestampMs = 0;
    let fileCount = 0;
    let totalBytes = 0;
    try {
      const meta = JSON.parse(await fs.readText(`${BACKUP_ROOT}/${entry.name}/.meta.json`)) as {
        timestampMs?: number;
        files?: unknown[];
        totalBytes?: number;
      };
      if (typeof meta.timestampMs === 'number') timestampMs = meta.timestampMs;
      if (Array.isArray(meta.files)) fileCount = meta.files.length;
      if (typeof meta.totalBytes === 'number') totalBytes = meta.totalBytes;
    } catch {
      timestampMs = 0;
    }
    out.push({ timestamp: entry.name, timestampMs, fileCount, totalBytes });
  }
  return out.sort((a, b) => b.timestampMs - a.timestampMs || (a.timestamp < b.timestamp ? 1 : -1));
}

async function backupFiles(fs: ProjectFs, stamp: string): Promise<Array<{ rel: string; content: string }>> {
  const root = `${BACKUP_ROOT}/${stamp}`;
  const out: Array<{ rel: string; content: string }> = [];
  const walk = async (dir: string, relBase: string): Promise<void> => {
    let entries: Awaited<ReturnType<ProjectFs['readDir']>> = [];
    try { entries = await fs.readDir(dir); } catch { return; }
    for (const entry of entries) {
      if (!entry.name || entry.name.startsWith('.')) continue;
      const child = `${dir}/${entry.name}`;
      const rel = relBase ? `${relBase}/${entry.name}` : entry.name;
      if (!safeProjectRel(rel)) continue;
      if (entry.isDir) await walk(child, rel);
      else {
        try { out.push({ rel, content: await fs.readText(child) }); } catch { /* skip */ }
      }
    }
  };
  await walk(root, '');
  return out;
}

export async function applyBackup(
  fs: ProjectFs,
  stamp: string,
): Promise<{ ok: boolean; restored: number; files: Array<{ rel: string; content: string }> }> {
  if (!/^[\w-]+$/.test(stamp)) return { ok: false, restored: 0, files: [] };
  const files = await backupFiles(fs, stamp);
  if (files.length === 0) return { ok: false, restored: 0, files: [] };
  let restored = 0;
  const written: Array<{ rel: string; content: string }> = [];
  for (const file of files) {
    try {
      await fs.writeText(file.rel, file.content);
      written.push(file);
      restored += 1;
    } catch {
      /* keep going; the caller reports a short count */
    }
  }
  return { ok: restored > 0, restored, files: written };
}

async function pruneBackups(fs: ProjectFs, maxCount: number): Promise<void> {
  const all = await listBackups(fs);
  for (const snap of all.slice(Math.max(1, maxCount))) {
    await removeTree(fs, `${BACKUP_ROOT}/${snap.timestamp}`);
  }
}

function snapshotName(timestamp: number, rel: string): string {
  const base = (rel.split('/').pop() ?? 'file').replace(/[^a-zA-Z0-9._-]/g, '_');
  return `${timestamp}_${base}.json`;
}

export async function publishSnapshotLimit(fs: ProjectFs, limit: number): Promise<void> {
  const value = Math.max(1, Math.min(1000, Math.round(limit)));
  try {
    await fs.writeText(`${SNAPSHOT_ROOT}/.limit`, String(value));
  } catch {
    /* retention is a convenience */
  }
}

async function readSnapshots(fs: ProjectFs): Promise<AiSnap[]> {
  let entries: Awaited<ReturnType<ProjectFs['readDir']>> = [];
  try {
    entries = await fs.readDir(SNAPSHOT_ROOT);
  } catch {
    return [];
  }
  const out: AiSnap[] = [];
  for (const entry of entries) {
    if (entry.isDir || !entry.name.endsWith('.json')) continue;
    try {
      const raw = await fs.readText(`${SNAPSHOT_ROOT}/${entry.name}`);
      const parsed = JSON.parse(raw) as { filePath?: unknown; content?: unknown; timestamp?: unknown };
      if (typeof parsed.filePath !== 'string' || typeof parsed.content !== 'string') continue;
      if (typeof parsed.timestamp !== 'number') continue;
      out.push({
        timestamp: parsed.timestamp,
        filePath: parsed.filePath,
        bytes: raw.length,
        diskName: entry.name,
        content: parsed.content,
      });
    } catch {
      /* a broken entry stays on disk and out of the list */
    }
  }
  return out.sort((a, b) => b.timestamp - a.timestamp);
}

export async function listAiSnapshots(fs: ProjectFs): Promise<Array<{ timestamp: number; filePath: string; bytes: number }>> {
  return (await readSnapshots(fs)).map(({ timestamp, filePath, bytes }) => ({ timestamp, filePath, bytes }));
}

/**
 * Absolute Mac paths become a project-relative path. The longest suffix that
 * exists in this folder wins; otherwise the part after the project folder name.
 */
export async function snapshotTarget(
  fs: ProjectFs,
  filePath: string,
  folderName: string,
): Promise<string | null> {
  const parts = filePath.replace(/\\/g, '/').split('/').filter(Boolean);
  if (parts[0]?.includes(':')) parts.shift();
  for (let i = 0; i < parts.length; i++) {
    const rel = parts.slice(i).join('/');
    if (!safeProjectRel(rel)) continue;
    if (await fs.exists(rel)) return rel;
  }
  const index = folderName ? parts.lastIndexOf(folderName) : -1;
  if (index >= 0 && index < parts.length - 1) {
    const rel = parts.slice(index + 1).join('/');
    if (safeProjectRel(rel)) return rel;
  }
  return null;
}

export async function undoLastAi(
  fs: ProjectFs,
  folderName: string,
): Promise<{ undone: boolean; rel: string | null; content: string | null; count: number }> {
  const snaps = await readSnapshots(fs);
  const newest = snaps[0];
  if (!newest) return { undone: false, rel: null, content: null, count: 0 };
  const rel = await snapshotTarget(fs, newest.filePath, folderName);
  if (!rel) return { undone: false, rel: null, content: null, count: snaps.length };
  try {
    await fs.writeText(rel, newest.content);
  } catch {
    return { undone: false, rel: null, content: null, count: snaps.length };
  }
  try { await fs.remove(`${SNAPSHOT_ROOT}/${newest.diskName}`); } catch { /* the file is already back */ }
  const count = (await readSnapshots(fs)).length;
  return { undone: true, rel, content: newest.content, count };
}

/** Named like the Mac store, so a test can see the two writers agree. */
export function aiSnapshotDiskName(timestamp: number, rel: string): string {
  return snapshotName(timestamp, rel);
}
