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
 * default (~/Desktop/LANGSAM). FAILS if absent — pass --allow-skip to accept
 * that nothing was verified. `compile-corpus-test` is the variant that needs
 * nothing outside the repo and therefore runs everywhere.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { serializeTypst } from '../src/editor/lib/serializer.ts';
import { deserializeTypst } from '../src/editor/lib/deserializer.ts';
import { renderPages, resolveTypst } from './typstRender.mts';

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean, extra?: unknown) {
  if (cond) { pass++; console.log('  ✓', name); }
  else { fail++; console.log('  ✗', name, extra !== undefined ? JSON.stringify(extra) : ''); }
}

const LANGSAM = process.env.LANGSAM_DIR || path.join(os.homedir(), 'Desktop', 'LANGSAM');

if (!fs.existsSync(path.join(LANGSAM, 'macros.typ'))) {
  // Exit 1, not 0.
  //
  // This used to exit 0 with a warning, which means the strongest test in the
  // repo reported GREEN on every machine except one — having compiled nothing
  // and compared nothing. A skip that looks like a pass is worse than no test:
  // it buys confidence it did not earn. Two round-trip bugs sat in real client
  // documents for months behind exactly this.
  //
  // Set LANGSAM_DIR to a real magazine project, or pass --allow-skip if you
  // are deliberately running without one (CI on a fresh checkout).
  const allowSkip = process.argv.includes('--allow-skip');
  console.log(
    `\n${allowSkip ? '⚠' : '✗'} compile-stability needs a real magazine project and found none at ${LANGSAM}.\n` +
    `  Set LANGSAM_DIR=/path/to/project, or pass --allow-skip to accept that nothing was verified.\n` +
    `  npm run test:compile:corpus does the same over the SHIPPED projects and always runs.\n`,
  );
  process.exit(allowSkip ? 0 : 1);
}

// Binary + bundled package/font paths come from the shared helper, so this and
// `compile-corpus-test` cannot end up measuring two different compilers.
const typst = resolveTypst();

/** Compile `srcFile` to per-page PNGs; one hash per page. Throws on failure. */
function compileToPngs(srcFile: string, tag: string): { hashes: string[]; stderr: string } {
  const r = renderPages(typst.bin, srcFile, { root: LANGSAM, ppi: 120, tag });
  if (!r.ok) throw new Error(`compile failed: ${r.stderr}`);
  return { hashes: r.hashes, stderr: r.stderr };
}

// Chapters that exercise the magazine macros (skip 00-cover: pure raw page layout).
const CHAPTERS = ['01-editorial', '02-feature', '03-interview', '04-architektur', '05-essay', '06-kolophon'];

console.log('\n── Compile-stability: original vs. round-tripped LANGSAM chapters ──');
console.log(`   typst: ${typst.label}`);

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
