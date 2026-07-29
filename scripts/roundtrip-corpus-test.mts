/**
 * Round-trip every real .typ file we ship, and fail on anything lossy.
 *
 * `roundtrip-test.mts` checks hand-written snippets — constructs somebody
 * thought to test. This checks REAL DOCUMENTS: 150-odd files across 35 shipped
 * presets and the sample project. That difference is not academic. Four
 * content-destroying bugs lived in those exact files:
 *
 *   ~            Typst's non-breaking space, escaped to a visible `\~` —
 *                "Zahlbar bis 24.~August" in a client's payment terms.
 *   weak: true   dropped from `#pagebreak`, turning a collapsing break into a
 *                forced one — a possible blank page.
 *   center +     `#align(center + horizon)` reduced to `#align(center)`,
 *   horizon      flattening three title pages.
 *   `  == Foo`   an indented heading inside `#columns[…]` merged with the
 *                paragraph under it, so Typst rendered the WHOLE paragraph as
 *                the heading.
 *
 * Every one was found by running this over the corpus, not by reasoning about
 * the parser. None was caught by 85 unit round-trips.
 *
 * The bar is deliberately not byte-identity: the round trip is compile-stable
 * by design (plan §6.2) and normalises whitespace, indentation and block
 * spacing. So a difference has to be classified, and only SEMANTIC differences
 * fail. The allowlist below is the whole judgement — keep it small, and never
 * widen it to make a red test go green without understanding the diff.
 *
 * Run:  npx tsx scripts/roundtrip-corpus-test.mts
 *       npx tsx scripts/roundtrip-corpus-test.mts ~/Desktop/Marketing/FMM
 *       (extra paths are added to the corpus — point it at your real work)
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { deserializeTypst } from '../src/editor/lib/deserializer.ts';
import { serializeTypst } from '../src/editor/lib/serializer.ts';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean, extra?: string): void {
  if (cond) { pass++; return; }
  seenFailures.add(name);
  if (baseline.has(name)) { known++; return; }
  fail++;
  console.log(`  ✗ ${name}${extra ? `\n${extra}` : ''}`);
}
let known = 0;

// ─── The corpus ─────────────────────────────────────────────────────

const roots = [
  path.join(REPO, 'resources', 'presets'),
  path.join(REPO, 'resources', 'sample-project'),
  ...process.argv.slice(2).filter(a => !a.startsWith('--')).map(a => a.replace(/^~/, os.homedir())),
];

function collect(dir: string, out: string[] = []): string[] {
  let entries: fs.Dirent[];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    if (e.name.startsWith('.') || e.name === 'node_modules') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) collect(p, out);
    else if (e.name.endsWith('.typ')) out.push(p);
  }
  return out;
}

const files = roots.flatMap(r => collect(r));

// ─── What counts as "the same document" ─────────────────────────────

/**
 * Normalisations the round trip is ALLOWED to make, because Typst renders the
 * result identically:
 *
 *   - soft line wrapping inside a paragraph (Typst joins them with a space)
 *   - indentation inside a re-parsed container body
 *   - the number of blank lines between blocks
 *   - a heading becoming its own block
 *
 * Everything else — a changed character, a dropped argument, a marker that
 * moved — is a real difference and fails.
 */
function normalise(src: string): string {
  const units: string[] = [];
  let buf: string[] = [];
  const flush = () => {
    const t = buf.join(' ').replace(/\s+/g, ' ').trim();
    if (t) units.push(t);
    buf = [];
  };

  for (const raw of src.split('\n')) {
    const line = raw.trim();
    if (!line) { flush(); continue; }
    // A heading is its own unit whether or not a blank line precedes it —
    // Typst reads it that way, and the round trip normalises to that form.
    if (/^={1,6}\s+\S/.test(line)) { flush(); units.push(line.replace(/\s+/g, ' ')); continue; }
    buf.push(line);
  }
  flush();
  return units.join('\n');
}

/**
 * The characters and arguments whose LOSS is what this test exists to catch.
 * Compared separately from the text, because a whitespace normalisation can
 * hide a dropped `weak: true` inside an otherwise-equal block.
 */
function significantTokens(src: string): string[] {
  const out: string[] = [];
  // Non-breaking spaces, escaped or not — the two must not swap.
  for (const m of src.matchAll(/\\?~/g)) out.push(m[0]);
  // Every macro call's full argument list.
  for (const m of src.matchAll(/#(pagebreak|align|colbreak|v|h)\(([^)]*)\)/g)) out.push(`${m[1]}(${m[2].replace(/\s+/g, ' ').trim()})`);
  // Heading levels and their order.
  for (const m of src.matchAll(/^\s*(={1,6})\s/gm)) out.push(m[1]);
  return out;
}

console.log(`\n── Round-trip corpus: ${files.length} real .typ files ──`);
if (files.length === 0) {
  console.log('\n✗ No files found. The bundled presets should always be there.\n');
  process.exit(1);
}

/**
 * Files that ALREADY lose something today, with the check that fails.
 *
 * Not an excuse list — a ratchet. Anything not in here fails the build, so a
 * new regression cannot slip in; and an entry that starts PASSING also fails,
 * so the list can only ever shrink. It exists because four fixes in one
 * afternoon does not make seventeen files correct, and shipping a permanently
 * red test would just teach everyone to ignore it.
 *
 * Every line here is a real defect a user could see. Regenerate with
 * `--write-baseline` after fixing one.
 */
const BASELINE_FILE = path.join(REPO, 'scripts', 'roundtrip-corpus-baseline.json');
const writeBaseline = process.argv.includes('--write-baseline');
let baseline = new Set<string>();
try { baseline = new Set(JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf-8')) as string[]); } catch { /* first run */ }
const seenFailures = new Set<string>();

const offenders = new Map<string, number>();

for (const file of files) {
  const rel = path.relative(REPO, file);
  let src: string;
  try { src = fs.readFileSync(file, 'utf-8'); } catch { continue; }
  if (!src.trim()) continue;

  let back: string;
  try {
    back = serializeTypst(deserializeTypst(src) as never);
  } catch (err) {
    check(`${rel}: round-trips without throwing`, false, `      ${err}`);
    continue;
  }

  // 1. Nothing meaningful may change.
  const a = normalise(src);
  const b = normalise(back);
  if (a !== b) {
    const la = a.split('\n');
    const lb = b.split('\n');
    let detail = '';
    for (let i = 0; i < Math.max(la.length, lb.length); i++) {
      if (la[i] !== lb[i]) {
        detail = `      - ${JSON.stringify((la[i] ?? '').slice(0, 110))}\n      + ${JSON.stringify((lb[i] ?? '').slice(0, 110))}`;
        break;
      }
    }
    check(`${rel}: content survives`, false, detail);
    offenders.set(rel, (offenders.get(rel) ?? 0) + 1);
  } else {
    check(`${rel}: content survives`, true);
  }

  // 2. …and neither may the load-bearing tokens, even where the text matches.
  const ta = significantTokens(src).join('|');
  const tb = significantTokens(back).join('|');
  check(
    `${rel}: nbsp / macro args / heading levels survive`,
    ta === tb,
    ta === tb ? undefined : `      - ${ta.slice(0, 160)}\n      + ${tb.slice(0, 160)}`,
  );

  // 3. A second pass must change nothing further. A round trip that keeps
  //    drifting is one that eats a document over a week of editing.
  const twice = serializeTypst(deserializeTypst(back) as never);
  check(`${rel}: is idempotent`, normalise(twice) === b);
}

if (writeBaseline) {
  fs.writeFileSync(BASELINE_FILE, JSON.stringify([...seenFailures].sort(), null, 2) + '\n');
  console.log(`\nWrote ${seenFailures.size} known failures to ${path.relative(REPO, BASELINE_FILE)}.\n`);
  process.exit(0);
}

// An entry that no longer fails must leave the list, or the ratchet rusts.
const fixed = [...baseline].filter(b => !seenFailures.has(b));

console.log(`\n──────────\n${pass} passed, ${fail} NEW failure(s), ${known} known`);
if (fail > 0) {
  console.log(
    `\n${offenders.size} file(s) newly lost content. These are REAL documents — a failure here\n` +
    `is something a user would see in their PDF. Fix the serializer/deserializer;\n` +
    `only widen normalise() when you can say why the difference is invisible.\n`,
  );
}
if (fixed.length > 0) {
  console.log(
    `\n${fixed.length} baseline entr(ies) now PASS — remove them so the list keeps shrinking:\n` +
    fixed.map(f => `  ${f}`).join('\n') +
    `\n\nRun with --write-baseline to regenerate.\n`,
  );
}
if (known > 0 && fail === 0 && fixed.length === 0) {
  console.log(`\n${known} known losses remain (scripts/roundtrip-corpus-baseline.json) — real defects, not yet fixed.\n`);
}
process.exit(fail > 0 || fixed.length > 0 ? 1 : 0);
