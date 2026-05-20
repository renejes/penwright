#!/usr/bin/env node
/**
 * Build an `.mcpb` bundle (Anthropic's portable MCP-server format) that
 * Claude Desktop can install with drag-and-drop.
 *
 * Assembles a staging directory with this layout:
 *
 *   dist/mcpb-staging/
 *   ├── manifest.json                    # copied from src/mcp/manifest.template.json
 *   ├── icon.png                         # optional, falls back to vswrite-logo.svg's PNG sibling
 *   └── server/
 *       ├── bin/vswrite-mcp              # Bun-compiled host-arch MCP binary
 *       ├── typst/typst                  # vswrite's bundled Typst binary (arm64 today)
 *       ├── typst-packages/              # bundled Typst @preview/* packages (24 dirs)
 *       └── fonts/                       # bundled OFL font families (7 dirs)
 *
 * Then runs `mcpb pack` to produce `dist/mcpb/vswrite-<version>.mcpb`.
 *
 * Pre-reqs:
 *   - `npm run build:mcp-binary` has produced the Bun binary in
 *     dist/mcp/bin/vswrite-mcp-<triple>
 *   - `npm run fetch:packages` + `npm run fetch:fonts` have populated
 *     resources/typst-packages/ and resources/fonts/
 *
 * Usage:
 *   node scripts/build-mcpb.mjs                    # host arch
 *
 * Code-signing: this script does NOT codesign the binaries inside the
 * bundle. Both binaries currently ship adhoc-signed which is fine for
 * local dev install. For distribution outside your own machine, sign
 * BOTH binaries with your Apple Developer ID + appropriate entitlements
 * (the Bun binary needs JIT entitlements; see build/entitlements.mac.mcp.plist)
 * BEFORE running this script.
 */

import { spawnSync } from 'node:child_process';
import { mkdirSync, copyFileSync, existsSync, readFileSync, writeFileSync, rmSync, cpSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const STAGING = join(ROOT, 'dist', 'mcpb-staging');
const OUT_DIR = join(ROOT, 'dist', 'mcpb');

// ─── Resolve inputs ─────────────────────────────────

const triple = process.arch === 'arm64' ? 'aarch64-apple-darwin' : 'x86_64-apple-darwin';
const BUN_BINARY = join(ROOT, 'dist', 'mcp', 'bin', `vswrite-mcp-${triple}`);
const TYPST_BINARY = join(ROOT, 'resources', 'bin', `typst-${process.arch}-darwin`);
const TYPST_PACKAGES = join(ROOT, 'resources', 'typst-packages');
const FONTS = join(ROOT, 'resources', 'fonts');
const MANIFEST_TEMPLATE = join(ROOT, 'src', 'mcp', 'manifest.template.json');

function abortIfMissing(label, p) {
  if (!existsSync(p)) {
    console.error(`[build-mcpb] missing ${label}: ${p}`);
    console.error('[build-mcpb] run the appropriate prep script first (build:mcp-binary / fetch:packages / fetch:fonts).');
    process.exit(1);
  }
}

abortIfMissing('Bun MCP binary', BUN_BINARY);
abortIfMissing('Typst binary',   TYPST_BINARY);
abortIfMissing('Typst packages dir', TYPST_PACKAGES);
abortIfMissing('Fonts dir',          FONTS);
abortIfMissing('Manifest template',  MANIFEST_TEMPLATE);

// ─── Clean + (re)create staging ─────────────────────

rmSync(STAGING, { recursive: true, force: true });
mkdirSync(STAGING, { recursive: true });
mkdirSync(join(STAGING, 'server', 'bin'), { recursive: true });
mkdirSync(join(STAGING, 'server', 'typst'), { recursive: true });

console.log(`[build-mcpb] staging at ${STAGING}`);

// Copy MCP binary, drop the triple suffix so the manifest's entry_point
// is the same across arches.
copyFileSync(BUN_BINARY, join(STAGING, 'server', 'bin', 'vswrite-mcp'));

// Copy Typst binary. Same renaming — manifest says `typst/typst` regardless
// of host arch.
copyFileSync(TYPST_BINARY, join(STAGING, 'server', 'typst', 'typst'));

// Copy packages + fonts. cpSync recursive preserves the tree.
cpSync(TYPST_PACKAGES, join(STAGING, 'server', 'typst-packages'), { recursive: true });
cpSync(FONTS,           join(STAGING, 'server', 'fonts'),          { recursive: true });

// Manifest: copy verbatim. We could template-substitute version etc.
// later; for now the template IS the manifest.
copyFileSync(MANIFEST_TEMPLATE, join(STAGING, 'manifest.json'));

// ─── Validate manifest before packing ───────────────

console.log(`[build-mcpb] validating manifest`);
const validate = spawnSync('npx', ['mcpb', 'validate', join(STAGING, 'manifest.json')], {
  cwd: ROOT,
  stdio: 'inherit',
});
if (validate.status !== 0) {
  console.error('[build-mcpb] manifest validation failed.');
  process.exit(validate.status ?? 1);
}

// ─── Pack ───────────────────────────────────────────

mkdirSync(OUT_DIR, { recursive: true });

const manifest = JSON.parse(readFileSync(join(STAGING, 'manifest.json'), 'utf-8'));
const outFile = join(OUT_DIR, `vswrite-${manifest.version}.mcpb`);

console.log(`[build-mcpb] packing → ${outFile}`);
const pack = spawnSync('npx', ['mcpb', 'pack', STAGING, outFile], {
  cwd: ROOT,
  stdio: 'inherit',
});
if (pack.status !== 0) {
  console.error('[build-mcpb] pack failed.');
  process.exit(pack.status ?? 1);
}

// ─── Report ─────────────────────────────────────────

const sizeBytes = statSync(outFile).size;
const sizeMb = (sizeBytes / 1024 / 1024).toFixed(1);
console.log(`[build-mcpb] ✓ ${outFile}  (${sizeMb} MB)`);

// Drop a stable alias pointing at the versioned file — handy for
// scripted installs ("the latest .mcpb").
const aliasFile = join(OUT_DIR, 'vswrite.mcpb');
copyFileSync(outFile, aliasFile);
console.log(`[build-mcpb] alias dist/mcpb/vswrite.mcpb → vswrite-${manifest.version}.mcpb`);

console.log('');
console.log('[build-mcpb] next: open Claude Desktop → Settings → Extensions, drag in the .mcpb file.');
