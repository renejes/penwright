/**
 * Citation Source Lookup.
 *
 * Maps a BibTeX citekey to a PDF in the project's `sources/` folder.
 * Convention: `sources/<citekey>.pdf` is the canonical match; suffixed
 * names like `<citekey>_supplement.pdf`, `<citekey>-arxiv.pdf` etc. are
 * accepted as fallback so users can keep multiple PDFs per source.
 *
 * Used by both the in-app citation hover-card and the MCP server.
 */

import * as fs from 'fs';
import * as path from 'path';
import { isPathWithin } from './pathSecurity';

const CITEKEY_PATTERN = /^[\w:.-]+$/;

/**
 * Locates a PDF in `<projectDir>/sources/` matching the given citekey.
 * Returns the absolute path on hit, `null` otherwise.
 *
 * Matching strategy:
 *   1. Exact `<citekey>.pdf` (case-insensitive) — preferred.
 *   2. First file starting with `<citekey>` followed by a separator
 *      (`_`, `-`, ` `, `.`).
 */
export function findSourceForCitation(projectDir: string, citekey: string): string | null {
  if (!projectDir) return null;
  if (typeof citekey !== 'string' || !citekey || !CITEKEY_PATTERN.test(citekey)) return null;

  const sourcesDir = path.join(projectDir, 'sources');
  if (!isPathWithin(sourcesDir, projectDir)) return null;
  if (!fs.existsSync(sourcesDir)) return null;

  try {
    const stat = fs.statSync(sourcesDir);
    if (!stat.isDirectory()) return null;
    const lower = citekey.toLowerCase();
    const entries = fs.readdirSync(sourcesDir);

    // Two-pass: prefer exact match, fall back to prefix match.
    let prefixMatch: string | null = null;
    for (const entry of entries) {
      const lc = entry.toLowerCase();
      if (!lc.endsWith('.pdf')) continue;
      const stem = lc.slice(0, -4);
      if (stem === lower) {
        const full = path.join(sourcesDir, entry);
        if (isPathWithin(full, projectDir)) return full;
      }
      if (
        !prefixMatch &&
        (stem.startsWith(lower + '_') ||
          stem.startsWith(lower + '-') ||
          stem.startsWith(lower + ' ') ||
          stem.startsWith(lower + '.'))
      ) {
        prefixMatch = entry;
      }
    }
    if (prefixMatch) {
      const full = path.join(sourcesDir, prefixMatch);
      if (isPathWithin(full, projectDir)) return full;
    }
  } catch (err) {
    console.warn('[penwright] findSourceForCitation failed:', err);
  }
  return null;
}
