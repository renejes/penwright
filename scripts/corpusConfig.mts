/**
 * Extra corpus roots, read from a git-ignored `penwright.corpus.json` at the
 * repo root.
 *
 * The round-trip bugs that reached a rendered PDF were found in REAL client
 * documents, not in the shipped presets — different conventions, no `style.json`,
 * hand-written `style.typ`, roots that are not called `main.typ`. Those projects
 * cannot go in the repo, and remembering to pass their paths on the command line
 * is the same as not checking them.
 *
 * So: name them once, locally, and every corpus suite picks them up.
 *
 *   penwright.corpus.json
 *   {
 *     "roots": [
 *       "~/Desktop/Marketing/FMM",
 *       "~/Desktop/Marketing/Ludwig Maier Mastering",
 *       "~/Desktop/LANGSAM"
 *     ]
 *   }
 *
 * Absent file → no extra roots, and the suites still cover `resources/`. A named
 * path that does not exist is reported rather than ignored: a corpus entry that
 * silently stopped being checked is how a gate rusts.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
export const CORPUS_CONFIG = path.join(REPO, 'penwright.corpus.json');

export interface ExtraRoots {
  roots: string[];
  /** Configured paths that are not on disk — printed, never swallowed. */
  missing: string[];
}

/**
 * `roots` from the config plus any non-flag CLI arguments, `~` expanded.
 * CLI paths win nothing special; they are simply added.
 */
export function extraCorpusRoots(argv: string[] = process.argv.slice(2)): ExtraRoots {
  const named: string[] = [];

  if (fs.existsSync(CORPUS_CONFIG)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(CORPUS_CONFIG, 'utf-8')) as { roots?: unknown };
      if (Array.isArray(parsed.roots)) {
        named.push(...parsed.roots.filter((r): r is string => typeof r === 'string'));
      }
    } catch (err) {
      // A malformed config is a mistake worth hearing about — quietly falling
      // back to "no extra roots" would look exactly like a green run.
      console.log(`  ⚠ ${path.basename(CORPUS_CONFIG)} is not readable JSON — ignoring it: ${err}`);
    }
  }

  named.push(...argv.filter(a => !a.startsWith('--')));

  const expanded = named.map(p => (p.startsWith('~') ? path.join(os.homedir(), p.slice(1)) : p));
  return {
    roots: expanded.filter(p => fs.existsSync(p)),
    missing: expanded.filter(p => !fs.existsSync(p)),
  };
}

/** One line per suite, so it is obvious what was and was not covered. */
export function reportExtraRoots({ roots, missing }: ExtraRoots): void {
  for (const r of roots) console.log(`   + ${r}`);
  for (const m of missing) console.log(`   ⚠ configured but not found: ${m}`);
}
