/**
 * The undo net for machine edits — writable AND readable from both processes.
 *
 * `.penwright/ai-snapshots/` is what "Undo AI Edit" and the History hub read.
 * Until Session 41 only the app wrote to it, and only for the one file open in
 * the editor: everything the agent changed in any other file had no fallback at
 * all. On a project without Git — the magazine-pipeline case, and every
 * hand-crafted document — a multi-file rewrite was simply irreversible.
 *
 * `snapshotBeforeWrite` closed the writing half. This module now owns the
 * reading half too, because the app kept its own in-memory ring buffer beside
 * the folder: a second truth that only ever held what *the app itself* had
 * snapshotted. Everything the agent preserved sat on disk, correctly, and was
 * invisible in the very UI built to surface it — `listSnapshots` had zero
 * production callers.
 *
 * So the folder is the truth now, for both sides. The format is unchanged, so
 * entries written before this appear without migration:
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

/** A listing entry: everything but the (potentially large) content. */
export interface SnapshotRef {
  filePath: string;
  timestamp: number;
  /** Basename of the JSON file on disk. */
  diskName: string;
  bytes: number;
}

/**
 * Fallback retention when the project carries no limit of its own — which is
 * the case for every write made while the app has never opened the project.
 */
export const DEFAULT_SNAPSHOT_LIMIT = 40;

const LIMIT_FILE = '.limit';

export function aiSnapshotsDirFor(projectDir: string): string {
  return path.join(projectDir, '.penwright', 'ai-snapshots');
}

export function snapshotFileName(timestamp: number, filePath: string): string {
  const safe = path.basename(filePath).replace(/[^a-zA-Z0-9._-]/g, '_');
  return `${timestamp}_${safe}.json`;
}

// ─── Retention: one number, agreed across the process boundary ───────
//
// There used to be two: the app pruned to the user's configured maximum
// (electron-store, default 20) and this module to a hard 40. Whichever process
// wrote last imposed its own, so an agent's bulk edit could evict entries the
// app had promised to keep, and the user's setting silently meant nothing.
//
// The user's setting is the real contract, so the app publishes it into the
// project and both sides read it from there — the same one-way channel
// `session.json` uses, for the same reason: the MCP server cannot see
// electron-store, and a value it guessed would be a second truth again.

/** Called by the app whenever the configured maximum is known or changes. */
export function publishSnapshotLimit(projectDir: string, limit: number): void {
  const value = Math.max(1, Math.min(1000, Math.round(limit)));
  try {
    const dir = aiSnapshotsDirFor(projectDir);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, LIMIT_FILE), String(value), 'utf-8');
  } catch {
    // Retention is a convenience; failing to publish it must not block a save.
  }
}

export function snapshotLimit(projectDir: string): number {
  try {
    const raw = fs.readFileSync(path.join(aiSnapshotsDirFor(projectDir), LIMIT_FILE), 'utf-8');
    const n = Number(raw.trim());
    if (Number.isFinite(n) && n >= 1) return Math.min(1000, Math.round(n));
  } catch {
    /* never published */
  }
  return DEFAULT_SNAPSHOT_LIMIT;
}

// ─── Writing ─────────────────────────────────────────────────────────

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
  return recordSnapshot(projectDir, absFile, content);
}

/**
 * Records an explicit "this is what would otherwise be lost" state.
 *
 * Separate from `snapshotBeforeWrite` because the app's case is not the disk
 * content: when a foreign write lands on the file being edited, what has to be
 * preserved is the *editor buffer*, which never reached the disk at all.
 */
export function recordSnapshot(
  projectDir: string,
  absFile: string,
  content: string,
): string | null {
  const snap: EditSnapshot = { filePath: path.resolve(absFile), content, timestamp: Date.now() };
  try {
    const dir = aiSnapshotsDirFor(projectDir);
    fs.mkdirSync(dir, { recursive: true });
    const target = path.join(dir, snapshotFileName(snap.timestamp, absFile));
    fs.writeFileSync(target, JSON.stringify(snap), 'utf-8');
    pruneSnapshots(projectDir, snapshotLimit(projectDir));
    return target;
  } catch {
    return null;
  }
}

/** Keeps the folder bounded, oldest first. */
export function pruneSnapshots(projectDir: string, keep: number): void {
  const dir = aiSnapshotsDirFor(projectDir);
  try {
    const entries = fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort();
    for (const name of entries.slice(0, Math.max(0, entries.length - keep))) {
      try { fs.unlinkSync(path.join(dir, name)); } catch { /* already gone */ }
    }
  } catch {
    /* no folder yet */
  }
}

// ─── Reading ─────────────────────────────────────────────────────────

function readAll(projectDir: string): { ref: SnapshotRef; snap: EditSnapshot }[] {
  const dir = aiSnapshotsDirFor(projectDir);
  const out: { ref: SnapshotRef; snap: EditSnapshot }[] = [];
  let names: string[];
  try {
    names = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
  } catch {
    return out;
  }
  for (const name of names) {
    try {
      const raw = fs.readFileSync(path.join(dir, name), 'utf-8');
      const s = JSON.parse(raw) as EditSnapshot;
      if (typeof s.filePath !== 'string' || typeof s.content !== 'string') continue;
      if (typeof s.timestamp !== 'number') continue;
      out.push({
        ref: { filePath: s.filePath, timestamp: s.timestamp, diskName: name, bytes: raw.length },
        snap: s,
      });
    } catch {
      /* corrupt entry — skip it rather than break the whole list */
    }
  }
  return out.sort((a, b) => b.snap.timestamp - a.snap.timestamp);
}

function sameFile(a: string, b: string): boolean {
  return path.resolve(a) === path.resolve(b);
}

/** Newest first. `absFile` narrows to one file. */
export function listSnapshots(projectDir: string, absFile?: string): EditSnapshot[] {
  return readAll(projectDir)
    .filter(e => !absFile || sameFile(e.snap.filePath, absFile))
    .map(e => e.snap);
}

/** Newest first, without the content — what a listing UI needs. */
export function listSnapshotRefs(projectDir: string, absFile?: string): SnapshotRef[] {
  return readAll(projectDir)
    .filter(e => !absFile || sameFile(e.snap.filePath, absFile))
    .map(e => e.ref);
}

export function countSnapshots(projectDir: string, absFile?: string): number {
  return listSnapshotRefs(projectDir, absFile).length;
}

/**
 * Takes the newest snapshot off the stack and returns it — the caller decides
 * how to restore it (the app pushes it into the editor buffer as well as the
 * file; the MCP server just writes the file).
 *
 * With no `absFile` it pops the newest across the whole project, which is what
 * "undo the last thing the agent did" means when the agent touched five files.
 * The entry is removed from disk only once the caller's restore has succeeded,
 * via the returned `commit()` — an undo that failed halfway must not also have
 * consumed its own way back.
 */
export function takeLastSnapshot(
  projectDir: string,
  absFile?: string,
): { snapshot: EditSnapshot; commit: () => void } | null {
  const entry = readAll(projectDir).find(e => !absFile || sameFile(e.snap.filePath, absFile));
  if (!entry) return null;
  const diskPath = path.join(aiSnapshotsDirFor(projectDir), entry.ref.diskName);
  return {
    snapshot: entry.snap,
    commit: () => {
      try { fs.unlinkSync(diskPath); } catch { /* already gone */ }
    },
  };
}
