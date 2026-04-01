/**
 * Resolves the path to the bundled typst binary.
 * In development: uses system PATH.
 * In production: uses the binary bundled in app resources.
 */

import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

let resolvedPath: string | null = null;

export function getTypstPath(): string {
  if (resolvedPath) return resolvedPath;

  // In production, use the bundled binary
  if (app.isPackaged) {
    const platform = process.platform;
    const arch = process.arch;
    const binaryName = `typst-${arch}-${platform}`;
    const bundledPath = path.join(process.resourcesPath, 'bin', binaryName);

    if (fs.existsSync(bundledPath)) {
      resolvedPath = bundledPath;
      return resolvedPath;
    }

    // Fallback: try without arch suffix
    const simplePath = path.join(process.resourcesPath, 'bin', 'typst');
    if (fs.existsSync(simplePath)) {
      resolvedPath = simplePath;
      return resolvedPath;
    }
  }

  // Development: use system typst
  resolvedPath = 'typst';
  return resolvedPath;
}
