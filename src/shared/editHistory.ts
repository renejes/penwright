/**
 * The undo net for machine edits — writable from both processes.
 *
 * `.penwright/ai-snapshots/` is what "Undo AI Edit" and the History hub read.
 * Until now only the app wrote to it, and only for the one file open in the
 * editor: everything the agent changed in any other file had no fallback at
 * all. On a project without Git — the magazine-pipeline case, and every
 * hand-crafted document — a multi-file rewrite was simply irreversible.
 *
 * The format is the one the app already persists, so entries written here
 * appear in the existing UI without translation:
 *
 *     { filePath, content, timestamp }   →  <ts>_<safe-basename>.json
 *
 * `content` is the state BEFORE the edit — that is what an undo restores.
 */

import * as fs from 'fs';
import * as path from 'path';

export interface EditSnapshot {
  filePath: string;
  content: string;
  timestamp: number;
}

export function aiSnapshotsDirFor(projectDir: string): string {
  return path.join(projectDir, '.penwright', 'ai-snapshots');
}

export function snapshotFileName(timestamp: number, filePath: string): string {
  const safe = path.basename(filePath).replace(/[^a-zA-Z0-9._-]/g, '_');
  return `${timestamp}_${safe}.json`;
}

/**
 * Preserves the current content of `absFile` before it is overwritten.
 *
 * Call this immediately BEFORE a mutating write, never after. A file that does
 * not exist yet needs no snapshot — there is nothing to lose — and returns
 * null. Best-effort throughout: failing to write a snapshot must not abort the
 * edit the user asked for, but it must also never be silently assumed to have
 * worked, so the caller gets the path back.
 */
export function snapshotBeforeWrite(projectDir: string, absFile: string): string | null {
  let content: string;
  try {
    if (!fs.existsSync(absFile)) return null;
    content = fs.readFileSync(absFile, 'utf-8');
  } catch {
    return null;
  }

  const snap: EditSnapshot = { filePath: absFile, content, timestamp: Date.now() };
  try {
    const dir = aiSnapshotsDirFor(projectDir);
    fs.mkdirSync(dir, { recursive: true });
    const target = path.join(dir, snapshotFileName(snap.timestamp, absFile));
    fs.writeFileSync(target, JSON.stringify(snap), 'utf-8');
    pruneSnapshots(dir, 40);
    return target;
  } catch {
    return null;
  }
}

/**
 * Keeps the directory bounded. The app applies the user's configured maximum
 * when it loads them; this is only a floor so an agent doing bulk work cannot
 * fill the folder without limit.
 */
function pruneSnapshots(dir: string, keep: number): void {
  try {
    const entries = fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort();
    for (const name of entries.slice(0, Math.max(0, entries.length - keep))) {
      try { fs.unlinkSync(path.join(dir, name)); } catch {}
    }
  } catch {}
}

/** Newest first. Used by readers that want to show what can be undone. */
export function listSnapshots(projectDir: string, absFile?: string): EditSnapshot[] {
  const dir = aiSnapshotsDirFor(projectDir);
  const out: EditSnapshot[] = [];
  try {
    for (const name of fs.readdirSync(dir).filter(f => f.endsWith('.json'))) {
      try {
        const s = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf-8')) as EditSnapshot;
        if (typeof s.filePath !== 'string' || typeof s.content !== 'string') continue;
        if (absFile && path.resolve(s.filePath) !== path.resolve(absFile)) continue;
        out.push(s);
      } catch {}
    }
  } catch {}
  return out.sort((a, b) => b.timestamp - a.timestamp);
}
