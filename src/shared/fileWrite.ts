/**
 * Disk-content records — how a process tells a change it already knows about
 * from one that is new to it.
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
 * disk what I already know about?". That is what this module answers, by
 * content hash.
 *
 * Note the wording. An earlier version called this "did I write it", and that
 * framing produced a real bug: after the watcher adopted somebody else's
 * change, the record still described OUR last write, so a later revert to that
 * exact content was classified as ours and swallowed — the very failure class
 * the module exists to remove. The record must describe **what we believe is
 * on disk**, whoever put it there. Every path that learns the disk state —
 * writing it, reading it on open, adopting a foreign change — updates it.
 *
 * Being content-based makes it self-correcting: byte-identical content really
 * is nothing to pick up, as long as the record is current. An entry stays
 * valid until the next change to that path, so a watcher that fires twice for
 * one write needs no bookkeeping.
 *
 * `writeFileAtomic` lives here too — see its own note for why the record is
 * written BEFORE the rename.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

/** path → hash of the content this process believes is there. */
const known = new Map<string, string>();

/** Paths this process deleted, kept until the watcher has seen them. */
const deleted = new Set<string>();

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

/**
 * Records `content` as the known state of `abs` — after writing it, after
 * reading it, or after adopting somebody else's change.
 */
export function noteDiskContent(abs: string, content: string | Buffer): void {
  if (known.size >= MAX_TRACKED) {
    // Drop the oldest insertion; Map preserves insertion order.
    const oldest = known.keys().next();
    if (!oldest.done) known.delete(oldest.value);
  }
  known.set(key(abs), hashContent(content));
}

/** Records that this process deleted `abs`. */
export function noteDeleted(abs: string): void {
  known.delete(key(abs));
  deleted.add(key(abs));
}

/**
 * True when `diskContent` is exactly the state we already have on record.
 *
 * Read the file and pass its bytes; never pass what you *think* is there —
 * the point is to compare against reality.
 */
export function isKnownContent(abs: string, diskContent: string | Buffer): boolean {
  const record = known.get(key(abs));
  return record !== undefined && record === hashContent(diskContent);
}

/** True when this process deleted `abs`. Consumes the record. */
export function wasDeletedByUs(abs: string): boolean {
  return deleted.delete(key(abs));
}

/** Forget everything. Called on project close so state can't leak across projects. */
export function forgetAll(): void {
  known.clear();
  deleted.clear();
}

/** True when we have any record of what `abs` holds. Unknown ≠ foreign. */
export function hasRecord(abs: string): boolean {
  return known.has(key(abs));
}

/**
 * Writes `abs` so a reader never sees it half-written.
 *
 * Two processes share this folder and both write it while the other may be
 * reading — the app's watcher fires on `change`, the MCP server reads whatever
 * is there, and Typst reads every file on every compile. A plain
 * `writeFileSync` truncates and then fills, so a read landing in between gets
 * a truncated document. Nobody has reported it; there was also nothing at all
 * standing in its way.
 *
 * Temp file in the SAME directory (rename is only atomic within a filesystem),
 * then `rename`, which is atomic on POSIX and on Windows for an existing
 * target.
 *
 * **The record is written before the rename, deliberately.** The watcher can
 * fire the instant the rename lands — before a statement after it would have
 * run — and a change with no record yet is classified as foreign, bounced into
 * the editor and snapshotted as if somebody else had made it. Recording first
 * costs nothing if the rename then fails: the entry describes what we believe
 * is on disk, and the next inspection corrects it.
 */
export function writeFileAtomic(abs: string, content: string | Buffer): void {
  const target = path.resolve(abs);
  const dir = path.dirname(target);
  fs.mkdirSync(dir, { recursive: true });

  // `.penwright-` prefix: both processes' watcher-ignore predicates already
  // skip it, so the temp file itself never surfaces as a project change.
  const tmp = path.join(dir, `.penwright-tmp-${process.pid}-${Date.now()}-${path.basename(target)}`);
  try {
    fs.writeFileSync(tmp, content as never);
    noteDiskContent(target, content);
    fs.renameSync(tmp, target);
  } catch (err) {
    try { fs.unlinkSync(tmp); } catch { /* never created */ }
    throw err;
  }
}

/**
 * Write a file and record the new state in one step. Every write to a watched
 * file should go through here — one that skips it is treated as a foreign
 * change and bounces back into the editor.
 */
export function writeFileTracked(abs: string, content: string | Buffer): void {
  writeFileAtomic(abs, content);
}

/**
 * Reads `abs` and reports whether it still holds what we have on record.
 *
 * `foreign` means somebody changed the file since we last saw it — the caller
 * is about to overwrite work it has never seen. A path we have NO record for
 * is not foreign: a file we only ever read, or a Save-As target the user
 * picked and confirmed, must not be reported as a collision.
 */
export function inspectBeforeWrite(abs: string): { foreign: boolean; content: string | null } {
  let content: string | null = null;
  try {
    content = fs.readFileSync(abs, 'utf-8');
  } catch {
    return { foreign: false, content: null };   // absent or unreadable — nothing to lose
  }
  return { foreign: hasRecord(abs) && !isKnownContent(abs, content), content };
}
