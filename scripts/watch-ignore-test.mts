/**
 * Watcher ignore test — run against the REAL chokidar, not against assumptions.
 *
 * This exists because the previous ignore list was dead code and nobody noticed:
 * chokidar 4 removed glob support, so `'**\/.git/**'` was compared with `===`
 * against the full path and never matched. `.git/`, `node_modules/` and the
 * whole of `.penwright/` were being watched all along. The old time-based guard
 * hid the noise; the moment it was replaced, every auto-backup snapshot — a
 * directory full of `.typ` copies — triggered a full Typst recompile, twice a
 * minute, while the user was typing.
 *
 * So: assert the actual events chokidar emits, with the actual predicate.
 *
 * Run: npx tsx scripts/watch-ignore-test.mts
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { watch } from 'chokidar';

import { isIgnoredWatchPath, normalizeWatchRoot } from '../src/shared/watchIgnore.ts';

let failures = 0;
function check(name: string, cond: boolean, detail = ''): void {
  if (cond) console.log(`  ✓ ${name}`);
  else { failures++; console.log(`  ✗ ${name}${detail ? `\n      ${detail}` : ''}`); }
}

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pw-watch-'));
const rootUnix = normalizeWatchRoot(root);
const w = (rel: string, body = 'x') => {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, body);
  return abs;
};

console.log('\nPredicate');
const MUST_IGNORE = [
  '.git/HEAD',
  '.git/objects/ab/cdef',
  'node_modules/pkg/index.js',
  '.penwright/backups/2026-01-01/main.typ',
  '.penwright/ai-snapshots/s.json',
  '.DS_Store',
  '.penwright-preview.pdf',
  '.penwright-export-temp.typ',
  'chapters/.penwright-snippet.svg',
  'a.lock',
];
const MUST_FIRE = [
  'main.typ',
  'chapters/01-intro.typ',
  'chapters/deep/nested/assets/fig.png',
  'comments/2026-01-01-1200-abc.md',
  'references.bib',
  '.penwright/style.json',
  '.penwright/selection.json',
  '.penwright/preferences.json',
];
for (const rel of MUST_IGNORE) {
  check(`ignores ${rel}`, isIgnoredWatchPath(rootUnix, path.join(root, rel)));
}
for (const rel of MUST_FIRE) {
  check(`watches ${rel}`, !isIgnoredWatchPath(rootUnix, path.join(root, rel)));
}

console.log('\nAgainst the installed chokidar');
{
  // Pre-create the tree, then watch with ignoreInitial so only our later
  // writes produce events — the same configuration fileManager uses.
  [...MUST_IGNORE, ...MUST_FIRE].forEach(r => w(r, 'seed'));

  const seen: string[] = [];
  const watcher = watch(root, {
    ignoreInitial: true,
    depth: 6,
    ignored: (p: string) => isIgnoredWatchPath(rootUnix, p),
  });

  await new Promise<void>(r => watcher.on('ready', () => r()));
  watcher.on('all', (_e, p) => { seen.push(path.relative(root, p).split(path.sep).join('/')); });

  // Touch every path, then wait for the events we EXPECT rather than for a
  // fixed number of milliseconds — and re-touch whatever has not arrived.
  //
  // The flat `setTimeout(1200)` this replaces made the gate flaky: under load
  // macOS coalesces or drops the notification for the deepest path
  // (chapters/deep/nested/assets/fig.png) and `npm test` went red for no
  // reason. A build gate that fails at random gets re-run until it is green,
  // which is the same thing as switching it off.
  //
  // Re-touching does not weaken the claim. What is under test is whether our
  // predicate FILTERS a path; one lost FSEvent is no evidence of filtering, and
  // seeing the event on a later write proves the path is watched just as well.
  // The ignored paths are re-touched too, so they get more chances to leak, not
  // fewer.
  for (let round = 0; round < 12 && MUST_FIRE.some(rel => !seen.includes(rel)); round++) {
    [...MUST_IGNORE, ...MUST_FIRE].forEach(r => w(r, `changed-${round}`));
    await new Promise(r => setTimeout(r, 400));
  }
  // …then settle, so a path that must stay SILENT has had its chance to speak.
  await new Promise(r => setTimeout(r, 800));
  await watcher.close();

  for (const rel of MUST_IGNORE) {
    check(`no event for ${rel}`, !seen.includes(rel), `saw: ${seen.filter(s => s === rel).join(', ')}`);
  }
  const missed = MUST_FIRE.filter(rel => !seen.includes(rel));
  check(
    'every watched path produced an event',
    missed.length === 0,
    missed.length ? `missing: ${missed.join(', ')}` : '',
  );

  // The concrete regression: a backup run copies the whole project into
  // .penwright/backups/<ts>/. Not one of those may reach the watcher.
  check(
    'a full backup snapshot is silent',
    !seen.some(s => s.startsWith('.penwright/backups/')),
    `saw: ${seen.filter(s => s.startsWith('.penwright/backups/')).join(', ')}`,
  );
}

fs.rmSync(root, { recursive: true, force: true });
console.log(failures === 0 ? '\nAll checks passed.\n' : `\n${failures} check(s) FAILED.\n`);
process.exit(failures === 0 ? 0 : 1);
