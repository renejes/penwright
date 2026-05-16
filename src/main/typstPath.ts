/**
 * Resolves the path to the typst binary.
 * - Production: prefers the bundled binary in app resources.
 * - Development / fallback: probes common system locations because the
 *   PATH inherited by a macOS GUI app does NOT include /opt/homebrew/bin
 *   or /usr/local/bin by default — so a plain `typst` lookup fails even
 *   when the user has it installed via Homebrew.
 */

import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { execFileSync } from 'child_process';

let resolvedPath: string | null = null;

const COMMON_TYPST_LOCATIONS = [
  '/opt/homebrew/bin/typst',     // macOS Apple-Silicon Homebrew
  '/usr/local/bin/typst',        // macOS Intel Homebrew + Linux /usr/local
  '/usr/bin/typst',              // Linux package managers
  '/snap/bin/typst',             // Linux snap
  `${process.env.HOME ?? ''}/.cargo/bin/typst`, // cargo install typst-cli
  `${process.env.HOME ?? ''}/.local/bin/typst`,
];

function isExecutableFile(p: string): boolean {
  try {
    const stat = fs.statSync(p);
    return stat.isFile();
  } catch {
    return false;
  }
}

export function getTypstPath(): string {
  if (resolvedPath) return resolvedPath;

  // 1. Bundled binary (production)
  if (app.isPackaged) {
    const binaryName = `typst-${process.arch}-${process.platform}`;
    const bundledPath = path.join(process.resourcesPath, 'bin', binaryName);
    if (isExecutableFile(bundledPath)) {
      resolvedPath = bundledPath;
      return resolvedPath;
    }
    const simplePath = path.join(process.resourcesPath, 'bin', 'typst');
    if (isExecutableFile(simplePath)) {
      resolvedPath = simplePath;
      return resolvedPath;
    }
  }

  // 2. Common install locations
  for (const candidate of COMMON_TYPST_LOCATIONS) {
    if (isExecutableFile(candidate)) {
      resolvedPath = candidate;
      return resolvedPath;
    }
  }

  // 3. Ask the shell — uses /bin/sh which on macOS sources /etc/paths
  //    and picks up the user's actual installed typst even if PATH is empty.
  try {
    const found = execFileSync('/bin/sh', ['-lc', 'command -v typst'], {
      encoding: 'utf-8',
      timeout: 1500,
    }).trim();
    if (found && isExecutableFile(found)) {
      resolvedPath = found;
      return resolvedPath;
    }
  } catch {}

  // 4. Last resort: bare name (may still work if PATH is set)
  resolvedPath = 'typst';
  return resolvedPath;
}

/**
 * Absolute path to the directory that holds the bundled Typst packages.
 *
 * Layout: `<this>/preview/<name>/<version>/`. Passed to the typst CLI as
 * `compile --package-path <this>` so users don't need internet on first
 * compile of a document that uses any of the bundled packages.
 *
 * Production: `<.app>/Contents/Resources/typst-packages/`
 * Development: `<repo>/resources/typst-packages/` (after running
 *   `node scripts/fetch-typst-packages.mjs` once)
 */
let resolvedPackagePath: string | null = null;
export function getTypstPackagePath(): string | null {
  if (resolvedPackagePath !== null) return resolvedPackagePath || null;

  const candidates: string[] = [];
  if (app.isPackaged) {
    candidates.push(path.join(process.resourcesPath, 'typst-packages'));
  } else {
    // Dev: walk up from dist/main/ to the repo root.
    candidates.push(path.resolve(__dirname, '..', '..', 'resources', 'typst-packages'));
  }

  for (const candidate of candidates) {
    try {
      if (fs.statSync(candidate).isDirectory()) {
        resolvedPackagePath = candidate;
        return candidate;
      }
    } catch {}
  }

  resolvedPackagePath = '';
  return null;
}

/**
 * Builds the typst CLI args list for a `compile` invocation, prepending
 * `--package-path` when a bundled package directory is available. All
 * callers should use this helper so the package-path is consistent
 * (typstCompiler, importExport, ad-hoc compile sites).
 */
export function buildTypstCompileArgs(extraArgs: string[]): string[] {
  const args: string[] = ['compile'];
  const pkgPath = getTypstPackagePath();
  if (pkgPath) args.push('--package-path', pkgPath);
  return args.concat(extraArgs);
}
