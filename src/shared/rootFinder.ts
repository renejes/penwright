import * as fs from 'fs';
import * as path from 'path';

/**
 * Finds the root .typ file for a given Typst file by walking up
 * the #include chain. If the file is not included by any other
 * .typ file, it is considered the root itself.
 *
 * Searches the file's own directory and up to 3 ancestor directories
 * for .typ files that contain `#include "relative/path/to/file.typ"`.
 */
export function findRootFile(filePath: string): string {
  const absPath = path.resolve(filePath);
  return walkUpIncludes(absPath, new Set());
}

function walkUpIncludes(filePath: string, visited: Set<string>): string {
  if (visited.has(filePath)) return filePath; // circular reference guard
  visited.add(filePath);

  const fileDir = path.dirname(filePath);

  // Collect directories to search: own dir + up to 3 ancestors
  const dirsToSearch = [fileDir];
  let searchDir = fileDir;
  for (let i = 0; i < 3; i++) {
    const parent = path.dirname(searchDir);
    if (parent === searchDir) break; // filesystem root
    searchDir = parent;
    dirsToSearch.push(searchDir);
  }

  for (const dir of dirsToSearch) {
    const parent = findIncludingFile(filePath, dir, visited);
    if (parent) {
      // Found a parent — recursively check if IT is also included
      return walkUpIncludes(parent, visited);
    }
  }

  // No parent found — this file IS the root
  return filePath;
}

/**
 * Checks all .typ files in `dir` for one that includes `targetPath`.
 * Returns the absolute path of the including file, or null.
 */
function findIncludingFile(
  targetPath: string,
  dir: string,
  visited: Set<string>,
): string | null {
  try {
    const candidates = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.typ'))
      .map((f) => path.join(dir, f))
      .filter((f) => f !== targetPath && !visited.has(f));

    for (const candidate of candidates) {
      const content = fs.readFileSync(candidate, 'utf-8');
      // Compute what the #include path would look like from this candidate
      const relPath = path
        .relative(path.dirname(candidate), targetPath)
        .replace(/\\/g, '/'); // Typst always uses forward slashes

      if (content.includes(`#include "${relPath}"`)) {
        return candidate;
      }
    }
  } catch {
    // directory not readable, skip
  }
  return null;
}
