/**
 * Preset library build/verify — compiles every bundled preset with the bundled
 * Typst (offline-ready check) and renders each preset's page-1 thumbnail.png for
 * the New-Project gallery. Fails (exit 1) if any preset does not compile.
 *
 *   node scripts/presets-build.mjs           # compile + thumbnail every preset
 *   node scripts/presets-build.mjs --check   # compile only (no thumbnail write)
 *
 * A preset is any `resources/presets/<id>/` folder with a valid preset.json.
 * `_shared/` and dotfiles are skipped. Meant to run as part of packaging so a
 * broken preset can never ship.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const repo = fileURLToPath(new URL('..', import.meta.url));
const presetsDir = path.join(repo, 'resources', 'presets');
const PKG = path.join(repo, 'resources', 'typst-packages');
const FONTS = path.join(repo, 'resources', 'fonts');
const checkOnly = process.argv.includes('--check');

function typstBin() {
  const arch = process.arch === 'arm64' ? 'arm64' : 'x64';
  const plat = process.platform === 'darwin' ? 'darwin' : process.platform === 'win32' ? 'windows' : 'linux';
  const binDir = path.join(repo, 'resources', 'bin');
  for (const c of [`typst-${arch}-${plat}`, `typst-${arch}-${plat}.exe`]) {
    const p = path.join(binDir, c);
    if (fs.existsSync(p)) return p;
  }
  const any = (fs.existsSync(binDir) ? fs.readdirSync(binDir) : []).find((f) => f.startsWith('typst-'));
  return any ? path.join(binDir, any) : 'typst';
}
const TYPST = typstBin();

function typst(extra) {
  execFileSync(TYPST, ['compile', '--package-path', PKG, '--font-path', FONTS, ...extra], { stdio: 'pipe' });
}

function readManifest(dir) {
  try {
    const m = JSON.parse(fs.readFileSync(path.join(dir, 'preset.json'), 'utf8'));
    if (!m || typeof m.id !== 'string' || typeof m.type !== 'string' || !m.label) return null;
    return m;
  } catch { return null; }
}

const dirs = (fs.existsSync(presetsDir) ? fs.readdirSync(presetsDir, { withFileTypes: true }) : [])
  .filter((e) => e.isDirectory() && !e.name.startsWith('_') && !e.name.startsWith('.'))
  .map((e) => path.join(presetsDir, e.name))
  .sort();

if (!dirs.length) { console.log('No presets found under resources/presets/.'); process.exit(0); }

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pw-presets-'));
let pass = 0, fail = 0;

for (const dir of dirs) {
  const name = path.basename(dir);
  const m = readManifest(dir);
  if (!m) { console.log('  ✗', name, '— missing/invalid preset.json'); fail++; continue; }
  const root = path.join(dir, m.root || 'main.typ');
  if (!fs.existsSync(root)) { console.log('  ✗', name, `— root file missing (${m.root || 'main.typ'})`); fail++; continue; }
  try {
    typst(['--root', dir, root, path.join(tmp, `${name}.pdf`)]);
    if (!checkOnly) {
      typst(['--root', dir, '--pages', '1', '--ppi', '96', '--format', 'png', root, path.join(dir, 'thumbnail.png')]);
    }
    console.log('  ✓', name, `· ${m.type}${checkOnly ? '' : ' · thumbnail'}`);
    pass++;
  } catch (e) {
    console.log('  ✗', name, '— compile failed:');
    const msg = String(e.stderr || e.stdout || e.message || '').trim().split('\n').slice(0, 8).join('\n');
    console.log(msg.replace(/^/gm, '      '));
    fail++;
  }
}

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\n${pass} ok, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
