/**
 * Write provenance — how a process tells its own writes apart from someone
 * else's.
 *
 * The file watcher used to answer that question with a clock: ignore every
 * change that arrives within 3 s of *any* save we made. That is wrong in both
 * directions. It is too broad — the stamp was global, so a save to chapter 1
 * silenced a foreign write to chapter 7 — and it never caught up: a discarded
 * event was gone, not deferred. In practice the AI would write a file while
 * the user was typing, the event fell inside the window, and the next autosave
 * put the stale in-memory buffer back over it. No editor update, no snapshot,
 * no recompile, nothing to undo. The AI had reported success.
 *
 * The honest question is not "how long ago did I write?" but "is what is on
 * disk what I put there?". That is what this module answers, by content hash.
 *
 * Being content-based makes it self-correcting: if a foreign write happens to
 * produce byte-identical content, ignoring it is harmless — there is nothing
 * to pick up. And an entry stays valid until the next write to that path, so
 * a watcher that fires twice for one write is handled without bookkeeping.
 *
 * Deliberately NOT included: atomic temp+rename writes. They change which
 * events a watcher emits (`unlink`+`add` instead of `change` on some
 * platforms) and belong in their own change with their own verification.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

/** path → hash of the content this process last wrote there. */
const selfWrites = new Map<string, string>();

/** Paths this process deleted, kept until the watcher has seen them. */
const selfDeletes = new Set<string>();

/**
 * Bound so a long session with bulk operations (project-wide replace, version
 * restore) cannot grow the map without limit. Far above any real project's
 * file count, so eviction never happens in normal use.
 */
const MAX_TRACKED = 4000;

function key(abs: string): string {
  return path.resolve(abs);
}

export function hashContent(content: string | Buffer): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

/** Records that this process just wrote `content` to `abs`. */
export function markSelfWrite(abs: string, content: string | Buffer): void {
  if (selfWrites.size >= MAX_TRACKED) {
    // Drop the oldest insertion; Map preserves insertion order.
    const oldest = selfWrites.keys().next();
    if (!oldest.done) selfWrites.delete(oldest.value);
  }
  selfWrites.set(key(abs), hashContent(content));
}

/** Records that this process deleted `abs`. */
export function markSelfDelete(abs: string): void {
  selfWrites.delete(key(abs));
  selfDeletes.add(key(abs));
}

/**
 * True when `diskContent` is exactly what this process last wrote to `abs`.
 *
 * Read the file and pass its bytes; do not pass what you *think* is there.
 * The point is to compare against reality.
 */
export function isSelfWrite(abs: string, diskContent: string | Buffer): boolean {
  const known = selfWrites.get(key(abs));
  return known !== undefined && known === hashContent(diskContent);
}

/** True when this process deleted `abs`. Consumes the record. */
export function isSelfDelete(abs: string): boolean {
  return selfDeletes.delete(key(abs));
}

/** Forget any record for `abs` — e.g. when a project closes. */
export function forgetPath(abs: string): void {
  selfWrites.delete(key(abs));
  selfDeletes.delete(key(abs));
}

/** Forget everything. Called on project close so state can't leak across projects. */
export function forgetAll(): void {
  selfWrites.clear();
  selfDeletes.clear();
}

/**
 * Write a file and record its provenance in one step. Every write a process
 * makes to a watched file should go through here — a write that skips it will
 * be treated as a foreign change and bounce back into the editor.
 */
export function writeFileTracked(abs: string, content: string | Buffer): void {
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content as never);
  markSelfWrite(abs, content);
}

/**
 * Reads `abs` and reports whether it still holds what this process last wrote.
 *
 * `foreign` means somebody else changed the file since — the caller is about
 * to overwrite work it has never seen. Returns `null` content when the file is
 * gone or unreadable.
 */
export function inspectBeforeWrite(abs: string): { foreign: boolean; content: string | null } {
  let content: string | null = null;
  try {
    content = fs.readFileSync(abs, 'utf-8');
  } catch {
    return { foreign: false, content: null };   // absent or binary — nothing to lose
  }
  return { foreign: !isSelfWrite(abs, content), content };
}
