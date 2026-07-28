/**
 * Which paths the project watcher must not report.
 *
 * Extracted and pure so it can be tested against the real chokidar, because
 * the previous form was silently dead: chokidar 4 removed glob support, and a
 * STRING in `ignored` is compared with `===` against the full path
 * (node_modules/chokidar/index.js, `createPattern`). Every `'**\/…'` pattern we
 * passed therefore matched nothing — `.git/`, `node_modules/` and the whole of
 * `.penwright/` were being watched all along. Nothing surfaced it because the
 * old 3-second time guard swallowed most of the noise; once that guard was
 * replaced, every auto-backup snapshot (a directory full of `.typ` copies)
 * started triggering a full recompile.
 *
 * A predicate is the supported form in chokidar 4, and it additionally stops
 * the traversal — `.git/objects` is never even walked.
 *
 * Paths arrive with forward slashes on every platform (chokidar normalises
 * before calling the matcher), so this must not use `path.sep`.
 */

/** Normalises to the form the predicate compares against. */
function unix(p: string): string {
  return p.replace(/\\/g, '/');
}

/** The watch root, normalised once by the caller. */
export function normalizeWatchRoot(dir: string): string {
  return unix(dir).replace(/\/+$/, '');
}

export function isIgnoredWatchPath(watchRoot: string, p: string): boolean {
  const u = unix(p);
  const base = u.slice(u.lastIndexOf('/') + 1);

  if (base === '.DS_Store') return true;
  // Preview PDF, export temp root, print style, math/SVG snippet renders.
  if (base.startsWith('.penwright-')) return true;
  if (u.endsWith('.lock')) return true;

  if (!u.startsWith(watchRoot + '/')) return false;
  const rel = u.slice(watchRoot.length + 1);

  if (rel === '.git' || rel.startsWith('.git/')) return true;
  if (rel === 'node_modules' || rel.startsWith('node_modules/')) return true;

  // Only the noisy parts of .penwright/. style.json and selection.json MUST
  // still fire — a design change made outside the app is invisible otherwise,
  // and that invisibility is what let the Design panel overwrite it.
  if (rel === '.penwright/backups' || rel.startsWith('.penwright/backups/')) return true;
  if (rel === '.penwright/ai-snapshots' || rel.startsWith('.penwright/ai-snapshots/')) return true;

  return false;
}
