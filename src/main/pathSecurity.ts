/**
 * Path Security — centralised path-traversal / symlink-escape checks.
 *
 * `path.normalize` alone is insufficient: a symlink inside the project can
 * point outside, so every file I/O handler must resolve the real path
 * before comparing against the project root.
 *
 * For not-yet-existing paths (new files), we resolve the deepest ancestor
 * that does exist and compose the remaining segments.
 */

import * as fs from 'fs';
import * as path from 'path';

/** Resolves symlinks where possible, falling back to the deepest existing ancestor. */
function safeRealpath(target: string): string {
  let current = path.resolve(target);
  try {
    return fs.realpathSync(current);
  } catch {
    // Path (or ancestor) doesn't exist yet: walk up until we find one that does.
    const segments: string[] = [];
    while (true) {
      const parent = path.dirname(current);
      if (parent === current) return path.resolve(target); // reached filesystem root
      segments.unshift(path.basename(current));
      current = parent;
      try {
        const realParent = fs.realpathSync(current);
        return path.join(realParent, ...segments);
      } catch {}
    }
  }
}

/**
 * Validates that `filePath` (after symlink resolution) is inside `rootDir`
 * (also symlink-resolved).
 */
export function isPathWithin(filePath: string, rootDir: string | null | undefined): boolean {
  if (!rootDir) return false;
  const resolvedRoot = safeRealpath(rootDir);
  const resolvedPath = safeRealpath(filePath);
  if (resolvedPath === resolvedRoot) return true;
  return resolvedPath.startsWith(resolvedRoot + path.sep);
}
