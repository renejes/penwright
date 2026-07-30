/**
 * Compile-stability over the projects we SHIP — the proof the text comparison
 * cannot give.
 *
 * `roundtrip-corpus-test` asks "did the source survive". That question has a
 * judgement call in it: the round trip is allowed to normalise whitespace and
 * argument formatting, so its `normalise()` decides what counts as the same
 * document, and every entry in its baseline is a difference nobody has yet
 * proven either way. `#opener(\n  a,\n  b,\n)` → `#opener(a, b)` LOOKS
 * harmless. So did `#align(center + horizon)` → `#align(center)`.
 *
 * This asks the only question that has no judgement in it: **does it still
 * render the same page.** Copy a shipped project to a temp dir, compile its
 * root, round-trip EVERY `.typ` in it the way opening and saving each file in
 * Penwright would, compile again, and compare the rendered pages pixel for
 * pixel.
 *
 * Whole project, not per chapter — so page numbering, the outline, and every
 * cross-reference between chapters are in scope. That is what a user renders.
 *
 * `compile-stability-test` is the same idea against a private magazine project
 * (per chapter, opt-in, needs a folder outside the repo). This one needs
 * nothing: the corpus is in `resources/`, so it runs on every machine, which is
 * the whole reason it exists.
 *
 * Run:  npx tsx scripts/compile-corpus-test.mts
 *       npx tsx scripts/compile-corpus-test.mts --keep   (leave failures on disk)
 *       npx tsx scripts/compile-corpus-test.mts magazine  (only matching names)
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { serializeTypst } from '../src/editor/lib/serializer.ts';
import { deserializeTypst } from '../src/editor/lib/deserializer.ts';
import { REPO, renderPages, resolveTypst, typstUsable } from './typstRender.mts';
import { extraCorpusRoots, reportExtraRoots } from './corpusConfig.mts';

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean, extra?: unknown): boolean {
  if (cond) { pass++; return true; }
  fail++;
  console.log(`  ✗ ${name}`, extra !== undefined ? JSON.stringify(extra) : '');
  return false;
}

const KEEP = process.argv.includes('--keep');
const filter = process.argv.slice(2).filter(a => !a.startsWith('--'));

// ─── The corpus: every shipped project with a root file ─────────────────────

const ROOT_NAMES = ['main.typ', 'document.typ', 'index.typ'];

/**
 * The project's root file, by name if it has a conventional one and otherwise by
 * elimination: the top-level `.typ` that no sibling pulls in.
 *
 * The second rule is not a nicety. Real hand-made projects have roots called
 * `Angebot.typ` and `Sichtbarkeitskonzept.typ`; only `style.typ` / `macros.typ`
 * are `#import`ed, so what nobody references IS the root. A harness that
 * insisted on `main.typ` would silently cover none of them — and those are the
 * documents where the round-trip bugs were found.
 */
function projectRoot(dir: string): string | null {
  for (const n of ROOT_NAMES) if (fs.existsSync(path.join(dir, n))) return n;

  let top: string[];
  try {
    top = fs.readdirSync(dir).filter(f => f.endsWith('.typ'));
  } catch { return null; }
  if (top.length === 0) return null;

  const referenced = new Set<string>();
  for (const f of top) {
    let src = '';
    try { src = fs.readFileSync(path.join(dir, f), 'utf-8'); } catch { continue; }
    for (const m of src.matchAll(/#(?:import|include)\s+"([^"]+)"/g)) {
      referenced.add(path.basename(m[1]));
    }
  }
  const candidates = top.filter(f => !referenced.has(f));
  // Exactly one unreferenced file is a root. Two or more is ambiguous, and
  // guessing would compile the wrong document and report on it confidently.
  return candidates.length === 1 ? candidates[0] : null;
}

/** Every directory at or under `root` (depth-limited) that resolves to a
 *  project. A configured corpus path is usually a FOLDER OF projects, not one. */
function discoverProjects(root: string, depth = 2): string[] {
  if (projectRoot(root)) return [root];
  if (depth === 0) return [];
  let entries: fs.Dirent[];
  try { entries = fs.readdirSync(root, { withFileTypes: true }); } catch { return []; }
  return entries
    .filter(e => e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules')
    .flatMap(e => discoverProjects(path.join(root, e.name), depth - 1));
}

const presetsDir = path.join(REPO, 'resources', 'presets');
// `[]`, not argv: here a positional argument is a NAME FILTER (`… magazine`),
// while in `roundtrip-corpus-test` it is an extra root. Extra roots for this
// suite come from penwright.corpus.json only, so the two meanings cannot collide.
const extra = extraCorpusRoots([]);
const projects = [
  ...fs.readdirSync(presetsDir, { withFileTypes: true })
    .filter(e => e.isDirectory())
    .map(e => path.join(presetsDir, e.name)),
  path.join(REPO, 'resources', 'sample-project'),
  // Real work named in penwright.corpus.json. The strongest proof this suite can
  // give is over the documents that actually matter to somebody.
  ...extra.roots.flatMap(r => discoverProjects(r)),
]
  // `_shared/` holds macro fragments, not a project — no root file, nothing to
  // compile. Filtering on the root file rather than the name means a new
  // fragment directory is skipped automatically instead of failing the suite.
  .filter(d => projectRoot(d) !== null)
  .filter(d => filter.length === 0 || filter.some(f => d.includes(f)))
  .sort();

const typst = resolveTypst();
console.log(`\n── Compile-stability over ${projects.length} shipped projects ──`);
console.log(`   typst: ${typst.label}`);
reportExtraRoots(extra);
if (projects.length === 0) {
  console.log('\n✗ No shipped project matched. The presets should always be there.\n');
  process.exit(1);
}

// Only the arm64-darwin binary is committed, so on another host this falls back
// to PATH — and if there is no Typst there either, EXIT 1.
//
// Not a warning-and-exit-0. `compile-stability-test` did that and the strongest
// test in the repo reported green on every machine but one, having compiled
// nothing. A skip that reads as a pass buys confidence it did not earn.
if (!typstUsable(typst.bin)) {
  const allowSkip = process.argv.includes('--allow-skip');
  console.log(
    `\n${allowSkip ? '⚠' : '✗'} no usable Typst (${typst.bin}).\n` +
    `  The bundled binary covers arm64-darwin; elsewhere put typst on PATH,\n` +
    `  or pass --allow-skip to accept that nothing was verified.\n`,
  );
  process.exit(allowSkip ? 0 : 1);
}

function collectTyp(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) collectTyp(p, out);
    else if (e.name.endsWith('.typ')) out.push(p);
  }
  return out;
}

/** Warnings that matter: a lost label still renders, so pixels alone miss it. */
const WARN = /unknown label|unknown variable|error:/i;
function newWarnings(before: string, after: string): string[] {
  const seen = new Set(before.split('\n').map(l => l.trim()));
  return after.split('\n').map(l => l.trim())
    .filter(l => l && WARN.test(l) && !seen.has(l));
}

let drifted = 0;

for (const dir of projects) {
  const name = path.basename(dir);
  const rootName = projectRoot(dir)!;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), `pw-cc-${name}-`));
  const work = path.join(tmp, name);
  let keptFor = '';

  try {
    fs.cpSync(dir, work, { recursive: true });
    const rootFile = path.join(work, rootName);

    const before = renderPages(typst.bin, rootFile, { root: work, tag: `o-${name}` });
    if (!check(`${name}: ships compiling`, before.ok, before.stderr.slice(0, 300))) continue;

    // Open and save every .typ, the way a user working through the project would.
    // style.typ and macros.typ included: they are .typ files in the file tree and
    // nothing stops the user opening one.
    const files = collectTyp(work);
    let threw = '';
    for (const f of files) {
      const src = fs.readFileSync(f, 'utf-8');
      if (!src.trim()) continue;
      try {
        fs.writeFileSync(f, serializeTypst(deserializeTypst(src) as never));
      } catch (err) {
        threw = `${path.relative(work, f)}: ${err}`;
        break;
      }
    }
    if (!check(`${name}: round-trips ${files.length} file(s) without throwing`, !threw, threw)) continue;

    const after = renderPages(typst.bin, rootFile, { root: work, tag: `r-${name}` });
    if (!check(`${name}: still compiles after round-trip`, after.ok, after.stderr.slice(0, 500))) {
      keptFor = 'compile';
      continue;
    }

    const samePages = check(
      `${name}: same page count`,
      before.hashes.length === after.hashes.length,
      { was: before.hashes.length, now: after.hashes.length },
    );
    const identical = samePages && before.hashes.every((h, i) => h === after.hashes[i]);
    if (!check(
      `${name}: renders pixel-identical (${before.hashes.length} page(s))`,
      identical,
      identical ? undefined : { changedPages: before.hashes.map((h, i) => h === after.hashes[i] ? null : i + 1).filter(Boolean) },
    )) {
      keptFor = 'pixels';
      drifted++;
    }

    // A dropped label is a warning, not an error — the page still renders, so
    // the pixel check can pass while every `@fig:x` into that chapter has quietly
    // become a question mark.
    const gained = newWarnings(before.stderr, after.stderr);
    check(`${name}: no new label/variable warnings`, gained.length === 0, gained.slice(0, 4));
  } finally {
    if (KEEP && keptFor) {
      console.log(`      kept for inspection (${keptFor}): ${work}`);
    } else {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  }
}

console.log(`\n──────────\n${pass} passed, ${fail} failed`);
if (drifted > 0) {
  console.log(
    `\n${drifted} project(s) render DIFFERENTLY after a round trip. That is a user-visible\n` +
    `change to a document we ship, and no amount of source-text normalisation makes\n` +
    `it invisible. Re-run with --keep <name> and diff the two renders.\n`,
  );
}
console.log();
process.exit(fail > 0 ? 1 : 0);
