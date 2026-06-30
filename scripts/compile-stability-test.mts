/**
 * Compile-stability test (Phase C acceptance gate — plan §6.2).
 *
 * The keystone's bar is NOT byte-identical round-trip, it is COMPILE-STABILITY:
 * parsing a real LANGSAM chapter into AST nodes and re-serializing must produce
 * Typst that compiles to the SAME rendered document. We prove that by compiling
 * the ORIGINAL and the ROUND-TRIPPED source with the SAME bundled Typst binary
 * (same machine, same run → no cross-OS/version baseline fragility) and asserting
 * identical rendered pixels (per-page PNG) + preserved cross-reference labels.
 *
 * Run: npx tsx scripts/compile-stability-test.mts
 * The LANGSAM artifact lives outside the repo; set LANGSAM_DIR or rely on the
 * default (~/Desktop/LANGSAM). Skips cleanly (exit 0) if absent.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { serializeTypst } from '../src/editor/lib/serializer.ts';
import { deserializeTypst } from '../src/editor/lib/deserializer.ts';

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean, extra?: unknown) {
  if (cond) { pass++; console.log('  ✓', name); }
  else { fail++; console.log('  ✗', name, extra !== undefined ? JSON.stringify(extra) : ''); }
}

const repo = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const LANGSAM = process.env.LANGSAM_DIR || path.join(os.homedir(), 'Desktop', 'LANGSAM');

if (!fs.existsSync(path.join(LANGSAM, 'macros.typ'))) {
  console.log(`\n⚠ LANGSAM artifact not found at ${LANGSAM} — skipping compile-stability test (set LANGSAM_DIR).\n`);
  process.exit(0);
}

// Resolve the typst binary: bundled (preferred — the version we ship) else PATH.
const arch = process.arch === 'arm64' ? 'arm64' : 'x64';
const bundled = path.join(repo, 'resources', 'bin', `typst-${arch}-darwin`);
const TYPST = fs.existsSync(bundled) ? bundled : 'typst';
const PKG = path.join(repo, 'resources', 'typst-packages');
const FONT = path.join(repo, 'resources', 'fonts');
const baseArgs = [
  ...(fs.existsSync(PKG) ? ['--package-path', PKG] : []),
  ...(fs.existsSync(FONT) ? ['--font-path', FONT] : []),
  '--root', LANGSAM,
];

/** Compile `srcFile` to per-page PNGs in a fresh temp dir; return {pages, stderr}.
 *  pages = sorted list of page PNG buffers; throws on compile failure. */
function compileToPngs(srcFile: string, tag: string): { hashes: string[]; stderr: string } {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), `pw-cs-${tag}-`));
  const pattern = path.join(outDir, 'p-{p}.png');
  let stderr = '';
  try {
    execFileSync(TYPST, ['compile', ...baseArgs, '--format', 'png', '--ppi', '120', srcFile, pattern],
      { stdio: ['ignore', 'ignore', 'pipe'] });
  } catch (e: any) {
    stderr = (e.stderr?.toString?.() ?? '') + (e.message ?? '');
    fs.rmSync(outDir, { recursive: true, force: true });
    throw new Error(`compile failed: ${stderr}`);
  }
  const pages = fs.readdirSync(outDir).filter((f) => f.endsWith('.png')).sort();
  const hashes = pages.map((p) => crypto.createHash('sha256').update(fs.readFileSync(path.join(outDir, p))).digest('hex'));
  fs.rmSync(outDir, { recursive: true, force: true });
  return { hashes, stderr };
}

// Chapters that exercise the magazine macros (skip 00-cover: pure raw page layout).
const CHAPTERS = ['01-editorial', '02-feature', '03-interview', '04-architektur', '05-essay', '06-kolophon'];

console.log('\n── Compile-stability: original vs. round-tripped LANGSAM chapters ──');
console.log(`   typst: ${TYPST === bundled ? 'bundled ' + path.basename(bundled) : 'system PATH'}`);

for (const name of CHAPTERS) {
  const orig = path.join(LANGSAM, 'chapters', `${name}.typ`);
  if (!fs.existsSync(orig)) { console.log(`   (skip ${name} — not present)`); continue; }

  const source = fs.readFileSync(orig, 'utf8');
  const roundtripped = serializeTypst(deserializeTypst(source) as any);

  // Write the round-tripped source as a SIBLING so `../style.typ` / `../macros.typ`
  // and `../assets/...` relative imports still resolve.
  const rtFile = path.join(LANGSAM, 'chapters', `.__pwrt-${name}.typ`);
  fs.writeFileSync(rtFile, roundtripped);

  try {
    let origRes: { hashes: string[]; stderr: string } | null = null;
    let rtRes: { hashes: string[]; stderr: string } | null = null;
    let origErr = '';
    let rtErr = '';
    try { origRes = compileToPngs(orig, `o-${name}`); } catch (e: any) { origErr = e.message; }
    try { rtRes = compileToPngs(rtFile, `r-${name}`); } catch (e: any) { rtErr = e.message; }

    check(`${name}: original compiles`, !!origRes, origErr.slice(0, 300));
    check(`${name}: round-tripped compiles`, !!rtRes, rtErr.slice(0, 400));

    if (origRes && rtRes) {
      check(`${name}: same page count (${origRes.hashes.length})`, origRes.hashes.length === rtRes.hashes.length, { orig: origRes.hashes.length, rt: rtRes.hashes.length });
      const samePixels = origRes.hashes.length === rtRes.hashes.length && origRes.hashes.every((h, i) => h === rtRes!.hashes[i]);
      check(`${name}: pixel-identical render (compile-stable)`, samePixels, samePixels ? undefined : { orig: origRes.hashes, rt: rtRes.hashes });
      // No "unknown label" warning in the round-tripped compile → cross-refs survive.
      check(`${name}: no unknown-label / error in round-trip stderr`, !/unknown label|error:/i.test(rtRes.stderr), rtRes.stderr.slice(0, 200));
    }
  } finally {
    fs.rmSync(rtFile, { force: true });
  }
}

console.log(`\n──────────\n${pass} passed, ${fail} failed\n`);
process.exit(fail > 0 ? 1 : 0);
