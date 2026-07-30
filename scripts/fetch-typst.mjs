/**
 * Fetch the Typst compiler binaries we BUNDLE into the app.
 *
 * The missing sibling of `fetch-typst-packages.mjs` and `fetch-typst-fonts.mjs`.
 * Those already provision the bundled packages and fonts; the compiler itself was
 * placed in `resources/bin/` by hand, which had two consequences:
 *
 *  - Only `typst-arm64-darwin` was ever there. `extraResources` bundles whatever
 *    matches `typst-*`, and `getTypstPath()` looks for
 *    `typst-<arch>-<platform>` inside the packaged app — so a Windows or Linux
 *    or Intel-Mac build shipped NO compiler, fell through to probing the user's
 *    machine, and told a clean install "Typst not found". The promise that Typst
 *    is bundled and needs no user installation held on Apple Silicon only.
 *
 *  - The version was written down nowhere. You had to run `--version` on the
 *    committed file to learn what we ship.
 *
 * TYPST_VERSION below is now that single source of truth.
 *
 * Usage:
 *   node scripts/fetch-typst.mjs            # this host's arch+platform
 *   node scripts/fetch-typst.mjs --mac      # both macOS arches
 *   node scripts/fetch-typst.mjs --win
 *   node scripts/fetch-typst.mjs --linux
 *   node scripts/fetch-typst.mjs --all      # everything we can ship
 *   node scripts/fetch-typst.mjs --check    # verify what is present, download nothing
 *   node scripts/fetch-typst.mjs --force    # re-download even if present
 */
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** The Typst version Penwright ships. Bump here, then run and re-run the gates. */
const TYPST_VERSION = '0.15.1';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BIN_DIR = path.join(REPO, 'resources', 'bin');

/**
 * Our filename ← upstream release asset. The left side must match
 * `typst-${process.arch}-${process.platform}${exe}` exactly, because that is
 * what `src/main/typstPath.ts` looks for inside the packaged app. Getting a name
 * wrong here is silent: the app simply falls back to the user's system Typst.
 */
const TARGETS = [
  { file: 'typst-arm64-darwin',      asset: 'typst-aarch64-apple-darwin.tar.xz',        group: 'mac' },
  { file: 'typst-x64-darwin',        asset: 'typst-x86_64-apple-darwin.tar.xz',         group: 'mac' },
  { file: 'typst-x64-win32.exe',     asset: 'typst-x86_64-pc-windows-msvc.zip',         group: 'win' },
  { file: 'typst-arm64-win32.exe',   asset: 'typst-aarch64-pc-windows-msvc.zip',        group: 'win' },
  { file: 'typst-x64-linux',         asset: 'typst-x86_64-unknown-linux-musl.tar.xz',   group: 'linux' },
  { file: 'typst-arm64-linux',       asset: 'typst-aarch64-unknown-linux-musl.tar.xz',  group: 'linux' },
];

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const FORCE = has('--force');
const CHECK = has('--check');

function hostFile() {
  const exe = process.platform === 'win32' ? '.exe' : '';
  return `typst-${process.arch}-${process.platform}${exe}`;
}

function selected() {
  if (has('--all')) return TARGETS;
  const groups = ['mac', 'win', 'linux'].filter((g) => has(`--${g}`));
  if (groups.length) return TARGETS.filter((t) => groups.includes(t.group));
  const want = hostFile();
  const t = TARGETS.find((x) => x.file === want);
  if (!t) {
    console.error(`✗ no Typst release target for this host (${process.arch}-${process.platform}).`);
    console.error(`  Expected one of: ${TARGETS.map((x) => x.file).join(', ')}`);
    process.exit(1);
  }
  return [t];
}

/** The version a binary reports, or null when it cannot be run on this host. */
function reportedVersion(file) {
  const r = spawnSync(file, ['--version'], { encoding: 'utf-8' });
  if (r.status !== 0) return null;
  return (r.stdout || '').trim().split(/\s+/)[1] ?? null;
}

function download(target) {
  const url = `https://github.com/typst/typst/releases/download/v${TYPST_VERSION}/${target.asset}`;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pw-typst-'));
  try {
    const archive = path.join(tmp, target.asset);
    execFileSync('curl', ['-fsSL', '-o', archive, url], { stdio: ['ignore', 'ignore', 'inherit'] });

    if (target.asset.endsWith('.zip')) execFileSync('unzip', ['-q', archive, '-d', tmp]);
    else execFileSync('tar', ['-xJf', archive, '-C', tmp]);

    // The archives unpack to <stem>/typst[.exe]; find it rather than assume.
    const exeName = target.file.endsWith('.exe') ? 'typst.exe' : 'typst';
    const found = [];
    const walk = (d) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) walk(p);
        else if (e.name === exeName) found.push(p);
      }
    };
    walk(tmp);
    if (found.length !== 1) throw new Error(`expected exactly one ${exeName} in the archive, found ${found.length}`);

    fs.mkdirSync(BIN_DIR, { recursive: true });
    const dest = path.join(BIN_DIR, target.file);
    // The committed binaries are mode 555; make the destination writable first
    // or the copy fails on a re-fetch.
    if (fs.existsSync(dest)) fs.chmodSync(dest, 0o755);
    fs.copyFileSync(found[0], dest);
    fs.chmodSync(dest, 0o555);
    return dest;
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

const targets = selected();
console.log(`\nTypst ${TYPST_VERSION} → resources/bin/  (${targets.length} target(s))\n`);

let failed = 0;
let mismatched = 0;

for (const t of targets) {
  const dest = path.join(BIN_DIR, t.file);
  const isHost = t.file === hostFile();
  const present = fs.existsSync(dest);
  const version = present && isHost ? reportedVersion(dest) : null;

  if (CHECK) {
    if (!present) { console.log(`  ✗ ${t.file.padEnd(24)} MISSING`); failed++; }
    else if (isHost && version !== TYPST_VERSION) { console.log(`  ✗ ${t.file.padEnd(24)} reports ${version ?? '?'} , want ${TYPST_VERSION}`); mismatched++; }
    else console.log(`  ✓ ${t.file.padEnd(24)} present${version ? ` (${version})` : ''}`);
    continue;
  }

  if (present && !FORCE && (!isHost || version === TYPST_VERSION)) {
    console.log(`  = ${t.file.padEnd(24)} already ${version ?? 'present'}`);
    continue;
  }

  try {
    download(t);
    const after = isHost ? reportedVersion(dest) : null;
    if (isHost && after !== TYPST_VERSION) {
      console.log(`  ✗ ${t.file.padEnd(24)} downloaded but reports ${after ?? '?'}`);
      mismatched++;
    } else {
      const size = (fs.statSync(dest).size / 1048576).toFixed(0);
      console.log(`  ↓ ${t.file.padEnd(24)} ${after ?? 'ok'} (${size} MB)`);
    }
  } catch (err) {
    console.log(`  ✗ ${t.file.padEnd(24)} ${err.message}`);
    failed++;
  }
}

if (failed || mismatched) {
  console.log(`\n${failed} failed, ${mismatched} version mismatch — the app would fall back to the user's system Typst.\n`);
  process.exit(1);
}
console.log();
