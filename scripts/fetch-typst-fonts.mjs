#!/usr/bin/env node
/**
 * Fetches the bundled OFL fonts and places them under
 * `resources/fonts/<family>/`, with each family's upstream `OFL.txt` license
 * sitting next to the .ttf files.
 *
 * VARIABLE where upstream offers it. This was static-only until Typst 0.15,
 * because 0.14.2 warned "variable fonts are not currently supported and may
 * render incorrectly" — a workaround for a limitation that no longer exists
 * (0.15.1 is silent and instances them correctly; verified). Static weights were
 * the wrong answer anyway: styleTypes.ts accepts nine named weights plus any
 * numeric, and the DEFAULT heading scheme uses `semibold` for h2-h4, so with
 * only 400 + 700 on disk every semibold heading in every new project silently
 * rendered as bold. 173 `semibold` and 40 `medium` requests across the
 * shipped presets did the same. One variable file per style covers the range.
 *
 * Spectral has NO upstream variable version, so it keeps static files and gains
 * the two weights the presets actually ask for (Medium, SemiBold + italics).
 *
 * Typst 0.15 also trims `Variable` / `Var` / `VF` family-name suffixes, which
 * is what lets IBM's `IBM Plex Sans Var-Roman.ttf` register as the family
 * "IBM Plex Sans" — the name our presets and style.json already reference.
 * On 0.14.2 it would have registered as "IBM Plex Sans Var" and matched nothing.
 *
 * Sources (variable unless noted):
 *  - IBM Plex Sans / Serif / Mono — IBM/plex `plex-*-variable` packages
 *  - Inter, JetBrains Mono, Crimson Pro — google/fonts OFL mirror
 *  - Spectral — google/fonts, STATIC (no variable build exists upstream)
 *
 * Idempotent, and it PRUNES: a file the manifest no longer names is deleted, so
 * switching a family from four statics to one variable file replaces them rather
 * than piling up beside them (Typst would otherwise register both under the same
 * family). Layout:
 *
 *   resources/fonts/
 *     Inter/
 *       Inter[opsz,wght].ttf  Inter-Italic[opsz,wght].ttf  OFL.txt
 *     Spectral/
 *       Spectral-Regular.ttf  Spectral-Medium.ttf  Spectral-SemiBold.ttf  …
 *
 * The Typst CLI scans this tree via `--font-path resources/fonts/`; each
 * font registers under its own family name (from the TTF name table) so
 * the user picks "Inter" / "IBM Plex Sans" / etc. exactly as if installed.
 */

import { spawnSync } from 'node:child_process';
import { mkdirSync, existsSync, statSync, writeFileSync, renameSync, rmSync, readdirSync } from 'node:fs';
import { join, resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const TARGET = join(ROOT, 'resources', 'fonts');

/**
 * Bundle manifest. One source pattern: `files: [{ url, name }]`, fetched
 * directly. (A ZIP-extraction path existed for Inter's release archive; Inter's
 * variable files are on google/fonts, so it is gone.)
 *
 * Every family also has a `license: { url, name }` for the upstream OFL
 * file. Bundle license headlines flow into `manifest.json` so the
 * Acknowledgments dialog can render the credit list without re-walking
 * the directory.
 */
/** google/fonts OFL mirror — canonical for the families whose upstream repo has
 *  no variable build of its own. `[` and `]` must be percent-encoded in the URL. */
const GF = 'https://raw.githubusercontent.com/google/fonts/main/ofl';
/** IBM's own packages. `plex-*-variable` are separate from `plex-*`, and are the
 *  only source of a variable IBM Plex Serif / Mono — google/fonts has statics only. */
const PLEX = 'https://raw.githubusercontent.com/IBM/plex/master/packages';

const FONTS = [
  {
    family: 'Inter',
    googleId: 'inter',
    category: 'sans',
    description: 'Variable sans-serif by Rasmus Andersson. Modern, readable, screen-friendly.',
    files: [
      { url: `${GF}/inter/Inter%5Bopsz,wght%5D.ttf`,        name: 'Inter[opsz,wght].ttf' },
      { url: `${GF}/inter/Inter-Italic%5Bopsz,wght%5D.ttf`, name: 'Inter-Italic[opsz,wght].ttf' },
    ],
    axes: 'wght 100-900, opsz 14-32',
    license: { url: 'https://raw.githubusercontent.com/rsms/inter/master/LICENSE.txt', name: 'OFL.txt' },
  },
  {
    family: 'IBM Plex Sans',
    googleId: 'ibmplexsans',
    category: 'sans',
    description: 'IBM\'s corporate humanist sans. Balanced, neutral, broadly compatible.',
    // IBM's own variable package, not google/fonts: the three Plex families then
    // come from one source, and google/fonts has no variable Serif or Mono at all.
    files: [
      { url: `${PLEX}/plex-sans-variable/fonts/complete/ttf/IBM%20Plex%20Sans%20Var-Roman.ttf`,  name: 'IBM Plex Sans Var-Roman.ttf' },
      { url: `${PLEX}/plex-sans-variable/fonts/complete/ttf/IBM%20Plex%20Sans%20Var-Italic.ttf`, name: 'IBM Plex Sans Var-Italic.ttf' },
    ],
    axes: 'wght 100-700, wdth 85-100',
    license: { url: `${PLEX}/plex-sans-variable/fonts/complete/ttf/license.txt`, name: 'OFL.txt' },
  },
  {
    family: 'IBM Plex Serif',
    googleId: 'ibmplexserif',
    category: 'serif',
    description: 'Slab serif counterpart to IBM Plex Sans. Workhorse for body copy.',
    files: [
      { url: `${PLEX}/plex-serif-variable/fonts/complete/ttf/IBM%20Plex%20Serif%20Var-Roman.ttf`,  name: 'IBM Plex Serif Var-Roman.ttf' },
      { url: `${PLEX}/plex-serif-variable/fonts/complete/ttf/IBM%20Plex%20Serif%20Var-Italic.ttf`, name: 'IBM Plex Serif Var-Italic.ttf' },
    ],
    axes: 'wght 100-700',
    license: { url: `${PLEX}/plex-serif-variable/fonts/complete/ttf/license.txt`, name: 'OFL.txt' },
  },
  {
    family: 'IBM Plex Mono',
    googleId: 'ibmplexmono',
    category: 'mono',
    description: 'Monospace member of the IBM Plex family. Distinctive, clean code rendering.',
    files: [
      { url: `${PLEX}/plex-mono-variable/fonts/complete/ttf/IBM%20Plex%20Mono%20Var-Roman.ttf`,  name: 'IBM Plex Mono Var-Roman.ttf' },
      { url: `${PLEX}/plex-mono-variable/fonts/complete/ttf/IBM%20Plex%20Mono%20Var-Italic.ttf`, name: 'IBM Plex Mono Var-Italic.ttf' },
    ],
    axes: 'wght 100-700',
    license: { url: `${PLEX}/plex-mono-variable/fonts/complete/ttf/license.txt`, name: 'OFL.txt' },
  },
  {
    family: 'JetBrains Mono',
    googleId: 'jetbrainsmono',
    category: 'mono',
    description: 'Monospace by JetBrains. Designed for source code with strong ligatures.',
    files: [
      { url: `${GF}/jetbrainsmono/JetBrainsMono%5Bwght%5D.ttf`,        name: 'JetBrainsMono[wght].ttf' },
      { url: `${GF}/jetbrainsmono/JetBrainsMono-Italic%5Bwght%5D.ttf`, name: 'JetBrainsMono-Italic[wght].ttf' },
    ],
    axes: 'wght 100-800',
    license: { url: 'https://raw.githubusercontent.com/JetBrains/JetBrainsMono/master/OFL.txt', name: 'OFL.txt' },
  },
  {
    family: 'Crimson Pro',
    googleId: 'crimsonpro',
    category: 'serif',
    description: 'Old-style serif. Elegant for long-form reading.',
    files: [
      { url: `${GF}/crimsonpro/CrimsonPro%5Bwght%5D.ttf`,        name: 'CrimsonPro[wght].ttf' },
      { url: `${GF}/crimsonpro/CrimsonPro-Italic%5Bwght%5D.ttf`, name: 'CrimsonPro-Italic[wght].ttf' },
    ],
    axes: 'wght 200-900',
    license: { url: `${GF}/crimsonpro/OFL.txt`, name: 'OFL.txt' },
  },
  {
    family: 'Spectral',
    googleId: 'spectral',
    category: 'serif',
    description: 'Transitional serif by Production Type. Versatile editorial workhorse.',
    // The one family with NO upstream variable version (checked: neither
    // google/fonts nor Production Type ships one). So: static, plus the two
    // weights the presets ask for — Spectral carries 24 `semibold` and one
    // `medium` request, more than any other family.
    files: [
      'Spectral-Regular.ttf',  'Spectral-Italic.ttf',
      'Spectral-Medium.ttf',   'Spectral-MediumItalic.ttf',
      'Spectral-SemiBold.ttf', 'Spectral-SemiBoldItalic.ttf',
      'Spectral-Bold.ttf',     'Spectral-BoldItalic.ttf',
    ].map(f => ({ url: `${GF}/spectral/${f}`, name: f })),
    axes: 'static: 400 / 500 / 600 / 700 + italics',
    license: { url: `${GF}/spectral/OFL.txt`, name: 'OFL.txt' },
  },
];

function downloadTo(url, target) {
  // --fail = HTTP errors → nonzero exit; -L = follow redirects; --silent = quiet.
  // We use a temp filename + atomic rename so a half-downloaded file doesn't
  // count as "present" on the next idempotent rerun.
  const tmpTarget = target + '.partial';
  rmSync(tmpTarget, { force: true });
  const result = spawnSync('curl', ['--fail', '--silent', '--location', '-o', tmpTarget, url], { encoding: 'utf-8' });
  if (result.status !== 0) {
    rmSync(tmpTarget, { force: true });
    throw new Error(`curl ${url} -> ${target} failed: status ${result.status} ${result.stderr ?? ''}`);
  }
  if (!existsSync(tmpTarget) || statSync(tmpTarget).size < 1024) {
    rmSync(tmpTarget, { force: true });
    throw new Error(`downloaded ${url} is empty or implausibly small (< 1 KB)`);
  }
  renameSync(tmpTarget, target);
}

mkdirSync(TARGET, { recursive: true });

let okCount = 0;
let skippedCount = 0;
let prunedCount = 0;
const errors = [];

for (const font of FONTS) {
  const familyDir = join(TARGET, font.family.replace(/\s+/g, ''));
  mkdirSync(familyDir, { recursive: true });

  // ─── License ───
  const licensePath = join(familyDir, font.license.name);
  if (!existsSync(licensePath)) {
    try {
      downloadTo(font.license.url, licensePath);
      console.log(`[fetch-fonts] ↓ ${font.family} ${font.license.name}`);
    } catch (err) {
      errors.push(`${font.family} ${font.license.name}: ${err.message}`);
      continue;
    }
  }

  // ─── Prune ───
  // Every font file the manifest no longer names is deleted. Without this the
  // static weights stay next to the new variable file, Typst registers BOTH
  // under the same family, and the bundle silently doubles — the switch to
  // variable would have added ~5 MB instead of replacing it.
  const keep = new Set([font.license.name, ...font.files.map(f => f.name)]);
  for (const existing of readdirSync(familyDir)) {
    if (keep.has(existing)) continue;
    if (!/\.(ttf|otf|woff2?)$/i.test(existing)) continue;
    rmSync(join(familyDir, existing), { force: true });
    console.log(`[fetch-fonts] − ${font.family} ${existing} (superseded)`);
    prunedCount++;
  }

  // ─── Font files: direct download ───
  if (font.files) {
    for (const f of font.files) {
      const target = join(familyDir, f.name);
      if (existsSync(target) && statSync(target).size > 1024) {
        skippedCount++;
        continue;
      }
      try {
        downloadTo(f.url, target);
        console.log(`[fetch-fonts] ↓ ${font.family} ${f.name}`);
        okCount++;
      } catch (err) {
        errors.push(`${font.family} ${f.name}: ${err.message}`);
      }
    }
  }

}

// Manifest mirrors the typst-packages flow — audit step + acknowledgments
// dialog read this to render the in-app credit + bundled-license summary.
const manifestPath = join(TARGET, 'manifest.json');
writeFileSync(manifestPath, JSON.stringify({
  generatedAt: new Date().toISOString(),
  fonts: FONTS.map(f => ({
    family: f.family,
    category: f.category,
    description: f.description,
    files: f.files.map(x => x.name),
    axes: f.axes,
    license: 'OFL-1.1',
    source: f.files[0].url.replace(/\/[^/]+$/, ''),
  })),
}, null, 2) + '\n', 'utf-8');

console.log('---');
console.log(`[fetch-fonts] downloaded: ${okCount}, skipped (already-present): ${skippedCount}, pruned: ${prunedCount}, errors: ${errors.length}`);
if (errors.length > 0) {
  for (const e of errors) console.error(`  ✗ ${e}`);
  process.exit(1);
}
