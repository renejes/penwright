/**
 * The auto-backup store, readable by both processes.
 *
 * `<project>/.penwright/backups/<timestamp>/` is the app's crash net: a flat
 * copy of the project's text files every few minutes, plus a `.meta.json`. Only
 * the app could read it — the reader lived in `persistenceManager`, which
 * imports electron-store and therefore cannot be loaded by the MCP binary at
 * all.
 *
 * That is the one asymmetry the parity principle names outright and forbids:
 * the agent could WRITE into the folder (nothing stopped it) but could not LOOK
 * at it. A process that can damage a store it cannot inspect is the worst
 * shape of all — and "the AI cannot see the backups" was the last unfixed item
 * on the P2 axis (`history/VER-03`).
 *
 * So the reading half moves here, electron-free, and both sides use it. The
 * WRITING half deliberately stays in the app: backups are produced by a timer
 * the app owns, and an agent has no business adding entries to a store the
 * user's recovery depends on. `guardWrite` refuses writes into it.
 */

import * as fs from 'fs';
import * as path from 'path';

export interface BackupSnapshot {
  /** Folder name, and the id every other call takes. */
  timestamp: string;
  timestampMs: number;
  fileCount: number;
  totalBytes: number;
}

export interface BackupFile {
  /** POSIX path relative to the project root. */
  relPath: string;
  content: string;
}

export function backupsDirFor(projectDir: string): string {
  return path.join(projectDir, '.penwright', 'backups');
}

/** `2026-07-29T14-32-05` → epoch ms. Falls back to 0 on an unparseable name. */
export function parseBackupTimestamp(name: string): number {
  // The folder name is ISO with `:` replaced by `-`, so the time part has to be
  // put back before Date can read it.
  const m = name.match(/^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})/);
  if (!m) return 0;
  const ms = Date.parse(`${m[1]}T${m[2]}:${m[3]}:${m[4]}`);
  return Number.isFinite(ms) ? ms : 0;
}

/** All snapshots, newest first. */
export function listBackups(projectDir: string): BackupSnapshot[] {
  const dir = backupsDirFor(projectDir);
  const out: BackupSnapshot[] = [];
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    let timestampMs = parseBackupTimestamp(entry.name);
    let fileCount = 0;
    let totalBytes = 0;
    try {
      const meta = JSON.parse(fs.readFileSync(path.join(dir, entry.name, '.meta.json'), 'utf-8'));
      if (typeof meta.timestampMs === 'number') timestampMs = meta.timestampMs;
      if (Array.isArray(meta.files)) fileCount = meta.files.length;
      if (typeof meta.totalBytes === 'number') totalBytes = meta.totalBytes;
    } catch {
      /* no meta — the folder name still dates it */
    }
    out.push({ timestamp: entry.name, timestampMs, fileCount, totalBytes });
  }
  return out.sort((a, b) => b.timestampMs - a.timestampMs);
}

/** Every file in one snapshot, contents included. */
export function loadBackup(projectDir: string, timestamp: string): BackupFile[] {
  const dir = path.join(backupsDirFor(projectDir), timestamp);
  const out: BackupFile[] = [];
  if (!fs.existsSync(dir)) return out;

  const walk = (sub: string, relBase: string): void => {
    let entries: fs.Dirent[];
    try { entries = fs.readdirSync(sub, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (entry.name === '.meta.json') continue;
      const full = path.join(sub, entry.name);
      const relPath = relBase ? `${relBase}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(full, relPath);
      else {
        try { out.push({ relPath, content: fs.readFileSync(full, 'utf-8') }); } catch { /* skip */ }
      }
    }
  };
  walk(dir, '');
  return out;
}

/** One file out of one snapshot, or null. */
export function readBackupFile(projectDir: string, timestamp: string, relPath: string): string | null {
  const dir = path.join(backupsDirFor(projectDir), timestamp);
  const abs = path.resolve(dir, relPath);
  // The relPath comes from a caller; keep it inside the snapshot.
  if (abs !== path.resolve(dir) && !abs.startsWith(path.resolve(dir) + path.sep)) return null;
  try { return fs.readFileSync(abs, 'utf-8'); } catch { return null; }
}

/**
 * True when `abs` is inside a store the app manages and nobody else should
 * write: the backups and the snapshot ring.
 *
 * Not a security boundary — it is a correctness one. Both stores have their own
 * pruning, their own naming and their own readers; a foreign write into either
 * corrupts a net the user's recovery depends on, and it would be invisible
 * because neither store is in the file tree.
 */
export function isManagedStore(abs: string): boolean {
  return /(^|[\\/])\.penwright[\\/](backups|ai-snapshots)([\\/]|$)/.test(path.resolve(abs));
}
