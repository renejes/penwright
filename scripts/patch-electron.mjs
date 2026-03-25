/**
 * Patch node_modules/electron/index.js to correctly export the Electron API
 * when running inside the Electron runtime (not just the binary path).
 *
 * Problem: The npm `electron` package's index.js always returns the path to
 * the Electron binary. But when our bundled code runs INSIDE Electron and does
 * require('electron'), Node resolves to this npm wrapper instead of Electron's
 * built-in module.
 *
 * Fix: Replace index.js with a version that detects the Electron runtime context
 * and re-exports the built-in API module.
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const electronIndex = path.join(__dirname, '../node_modules/electron/index.js');

const patchedContent = `
const fs = require('fs');
const path = require('path');

// Check if we're running inside the Electron runtime
if (process.versions.electron) {
  // Re-export Electron's built-in API module
  // Access via the internal module registry that Electron sets up
  try {
    const electronModule = process.electronBinding
      ? require('electron/main')
      : null;
    if (electronModule) {
      module.exports = electronModule;
    }
  } catch {
    // Fallback: return the binary path (original behavior)
    module.exports = getElectronPath();
  }
} else {
  // Running in plain Node.js (npm/npx context) — return binary path
  module.exports = getElectronPath();
}

function getElectronPath() {
  const pathFile = path.join(__dirname, 'path.txt');
  let executablePath;
  if (fs.existsSync(pathFile)) {
    executablePath = fs.readFileSync(pathFile, 'utf-8');
  }
  if (process.env.ELECTRON_OVERRIDE_DIST_PATH) {
    return path.join(process.env.ELECTRON_OVERRIDE_DIST_PATH, executablePath || 'electron');
  }
  if (executablePath) {
    return path.join(__dirname, 'dist', executablePath);
  } else {
    throw new Error('Electron failed to install correctly');
  }
}
`.trim();

fs.writeFileSync(electronIndex, patchedContent);
console.log('✓ Patched node_modules/electron/index.js for runtime API access');
