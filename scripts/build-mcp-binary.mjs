#!/usr/bin/env node
/**
 * Compile the vswrite MCP server into a standalone executable via
 * `bun build --compile`. Output goes to `dist/mcp/bin/penwright-mcp-<triple>`
 * — naming mirrors what `electron-builder`'s extraResources picks up.
 *
 * Why a standalone binary instead of `node server.mjs`?
 *   - Claude Desktop's spawn environment has no PATH/Node hint; relying on
 *     system Node makes it flaky.
 *   - The binary is decoupled from the running vswrite app. Quitting the
 *     app does not affect the MCP child Claude already spawned, and the
 *     order of launching the two apps no longer matters.
 *
 * Usage:
 *   node scripts/build-mcp-binary.mjs                  # host arch only
 *   node scripts/build-mcp-binary.mjs --all            # both darwin arches
 *   node scripts/build-mcp-binary.mjs --win            # windows x64 (.exe)
 *   node scripts/build-mcp-binary.mjs --all-platforms  # darwin arm64+x64 + win x64
 *
 * Bun can cross-compile to the Windows target from macOS, so `--win` works
 * on the dev machine. Requires Bun to be installed (https://bun.sh).
 */

import { spawnSync } from 'node:child_process';
import { mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const ENTRY = join(ROOT, 'src', 'mcp', 'server.ts');
const OUT_DIR = join(ROOT, 'dist', 'mcp', 'bin');

mkdirSync(OUT_DIR, { recursive: true });

const TARGETS_DARWIN = [
  { bunTarget: 'bun-darwin-arm64', triple: 'aarch64-apple-darwin', ext: '' },
  { bunTarget: 'bun-darwin-x64', triple: 'x86_64-apple-darwin', ext: '' },
];
const TARGETS_WIN = [
  { bunTarget: 'bun-windows-x64', triple: 'x86_64-pc-windows-msvc', ext: '.exe' },
];

const argv = process.argv.slice(2);
const wantAll = argv.includes('--all');                    // both darwin (mac packaging)
const wantWin = argv.includes('--win');                    // windows x64 only
const wantAllPlatforms = argv.includes('--all-platforms'); // darwin + windows
const isArm = process.arch === 'arm64';
const hostTarget = isArm ? TARGETS_DARWIN[0] : TARGETS_DARWIN[1];

let targets;
if (wantAllPlatforms) targets = [...TARGETS_DARWIN, ...TARGETS_WIN];
else if (wantWin) targets = TARGETS_WIN;
else if (wantAll) targets = TARGETS_DARWIN;
else targets = [hostTarget];

// Resolve bun. Prefer PATH, but fall back to the common install location so
// CI / packaging scripts don't need shell setup.
function findBun() {
  const which = spawnSync('which', ['bun'], { encoding: 'utf-8' });
  if (which.status === 0 && which.stdout.trim()) return which.stdout.trim();
  const home = process.env.HOME ?? '';
  const candidates = [join(home, '.bun', 'bin', 'bun'), '/opt/homebrew/bin/bun', '/usr/local/bin/bun'];
  for (const c of candidates) if (existsSync(c)) return c;
  return null;
}

const BUN = findBun();
if (!BUN) {
  console.error('[build-mcp-binary] bun not found. Install from https://bun.sh and rerun.');
  process.exit(1);
}

for (const target of targets) {
  const outFile = join(OUT_DIR, `penwright-mcp-${target.triple}${target.ext ?? ''}`);
  console.log(`[build-mcp-binary] ${target.bunTarget} → ${outFile}`);

  const proc = spawnSync(BUN, [
    'build',
    ENTRY,
    '--compile',
    '--minify',
    `--target=${target.bunTarget}`,
    '--outfile',
    outFile,
  ], {
    cwd: ROOT,
    stdio: 'inherit',
  });

  if (proc.status !== 0) {
    console.error(`[build-mcp-binary] bun build failed for ${target.bunTarget}`);
    process.exit(proc.status ?? 1);
  }
}

// Drop a "penwright-mcp" alias pointing at the host build so dev/test scripts
// can invoke it without the triple suffix. Only when we actually built the
// host (darwin) target — a windows-only build has nothing to alias.
if (targets.some(t => t.triple === hostTarget.triple)) {
  const aliasSrc = join(OUT_DIR, `penwright-mcp-${hostTarget.triple}`);
  const aliasDst = join(OUT_DIR, 'penwright-mcp');
  copyFileSync(aliasSrc, aliasDst);
  console.log(`[build-mcp-binary] alias dist/mcp/bin/penwright-mcp → penwright-mcp-${hostTarget.triple}`);
}
