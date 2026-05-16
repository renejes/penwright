#!/usr/bin/env node
/**
 * Fetches the bundled OFL fonts and places them under
 * `resources/fonts/<family>/`, with each family's upstream `OFL.txt` license
 * sitting next to the .ttf files.
 *
 * Static-only: Typst 0.14.2 warns ("variable fonts are not currently
 * supported and may render incorrectly") on variable .ttf files, even
 * though it does render them. We bundle the static weights to keep the
 * compiler logs clean for end users.
 *
 * Sources:
 *  - IBM Plex Sans / Serif / Mono — upstream IBM/plex repo (raw GitHub URLs)
 *  - JetBrains Mono                — upstream JetBrains/JetBrainsMono repo
 *  - Crimson Pro                   — upstream Fonthausen/CrimsonPro repo
 *  - Spectral                      — google/fonts mirror (canonical static .ttf)
 *  - Inter                         — official release ZIP (no individual
 *                                    static .ttf URL exists upstream, so we
 *                                    download the v4.1 release archive and
 *                                    extract the four core weights)
 *
 * Idempotent: rerun to refresh. Each file's existence is checked before
 * downloading; rerunning is fast and quiet. Layout:
 *
 *   resources/fonts/
 *     Inter/
 *       Inter-Regular.otf  Inter-Italic.otf  Inter-Bold.otf  Inter-BoldItalic.otf
 *       OFL.txt
 *     IBMPlexSans/
 *       IBMPlexSans-Regular.ttf  ...
 *
 * The Typst CLI scans this tree via `--font-path resources/fonts/`; each
 * font registers under its own family name (from the TTF name table) so
 * the user picks "Inter" / "IBM Plex Sans" / etc. exactly as if installed.
 */

import { spawnSync } from 'node:child_process';
import { mkdirSync, existsSync, statSync, writeFileSync, renameSync, rmSync } from 'node:fs';
import { join, resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const TARGET = join(ROOT, 'resources', 'fonts');

/**
 * Bundle manifest. Two source patterns:
 *
 *  - `files: [{ url, name }]` — fetch each .ttf/.otf directly.
 *  - `zip: { url, files: [{ pathInZip, name }] }` — download a ZIP, extract
 *    listed files.
 *
 * Every family also has a `license: { url, name }` for the upstream OFL
 * file. Bundle license headlines flow into `manifest.json` so the
 * Acknowledgments dialog can render the credit list without re-walking
 * the directory.
 */
const FONTS = [
  {
    family: 'Inter',
    googleId: 'inter',
    category: 'sans',
    description: 'Variable sans-serif by Rasmus Andersson. Modern, readable, screen-friendly.',
    zip: {
      url: 'https://github.com/rsms/inter/releases/download/v4.1/Inter-4.1.zip',
      files: [
        // The 4.1 release zip puts static TTFs under `extras/ttf/`. We
        // pick TTF over OTF — both work for Typst, but TTFs are ~30 %
        // smaller per file in this release.
        { pathInZip: 'extras/ttf/Inter-Regular.ttf',     name: 'Inter-Regular.ttf' },
        { pathInZip: 'extras/ttf/Inter-Italic.ttf',      name: 'Inter-Italic.ttf' },
        { pathInZip: 'extras/ttf/Inter-Bold.ttf',        name: 'Inter-Bold.ttf' },
        { pathInZip: 'extras/ttf/Inter-BoldItalic.ttf',  name: 'Inter-BoldItalic.ttf' },
      ],
    },
    license: {
      url: 'https://raw.githubusercontent.com/rsms/inter/master/LICENSE.txt',
      name: 'OFL.txt',
    },
  },
  {
    family: 'IBM Plex Sans',
    googleId: 'ibmplexsans',
    category: 'sans',
    description: 'IBM\'s corporate humanist sans. Balanced, neutral, broadly compatible.',
    files: [
      'IBMPlexSans-Regular.ttf', 'IBMPlexSans-Italic.ttf',
      'IBMPlexSans-Bold.ttf',    'IBMPlexSans-BoldItalic.ttf',
    ].map(f => ({
      url: `https://raw.githubusercontent.com/IBM/plex/master/packages/plex-sans/fonts/complete/ttf/${f}`,
      name: f,
    })),
    license: {
      // The TTF folder ships its own license.txt; we rename to OFL.txt for
      // consistency with the other families.
      url: 'https://raw.githubusercontent.com/IBM/plex/master/packages/plex-sans/fonts/complete/ttf/license.txt',
      name: 'OFL.txt',
    },
  },
  {
    family: 'IBM Plex Serif',
    googleId: 'ibmplexserif',
    category: 'serif',
    description: 'Slab serif counterpart to IBM Plex Sans. Workhorse for body copy.',
    files: [
      'IBMPlexSerif-Regular.ttf', 'IBMPlexSerif-Italic.ttf',
      'IBMPlexSerif-Bold.ttf',    'IBMPlexSerif-BoldItalic.ttf',
    ].map(f => ({
      url: `https://raw.githubusercontent.com/IBM/plex/master/packages/plex-serif/fonts/complete/ttf/${f}`,
      name: f,
    })),
    license: {
      url: 'https://raw.githubusercontent.com/IBM/plex/master/packages/plex-serif/fonts/complete/ttf/license.txt',
      name: 'OFL.txt',
    },
  },
  {
    family: 'IBM Plex Mono',
    googleId: 'ibmplexmono',
    category: 'mono',
    description: 'Monospace member of the IBM Plex family. Distinctive, clean code rendering.',
    files: [
      'IBMPlexMono-Regular.ttf', 'IBMPlexMono-Italic.ttf',
      'IBMPlexMono-Bold.ttf',    'IBMPlexMono-BoldItalic.ttf',
    ].map(f => ({
      url: `https://raw.githubusercontent.com/IBM/plex/master/packages/plex-mono/fonts/complete/ttf/${f}`,
      name: f,
    })),
    license: {
      url: 'https://raw.githubusercontent.com/IBM/plex/master/packages/plex-mono/fonts/complete/ttf/license.txt',
      name: 'OFL.txt',
    },
  },
  {
    family: 'JetBrains Mono',
    googleId: 'jetbrainsmono',
    category: 'mono',
    description: 'Monospace by JetBrains. Designed for source code with strong ligatures.',
    files: [
      'JetBrainsMono-Regular.ttf', 'JetBrainsMono-Italic.ttf',
      'JetBrainsMono-Bold.ttf',    'JetBrainsMono-BoldItalic.ttf',
    ].map(f => ({
      url: `https://raw.githubusercontent.com/JetBrains/JetBrainsMono/master/fonts/ttf/${f}`,
      name: f,
    })),
    license: {
      url: 'https://raw.githubusercontent.com/JetBrains/JetBrainsMono/master/OFL.txt',
      name: 'OFL.txt',
    },
  },
  {
    family: 'Crimson Pro',
    googleId: 'crimsonpro',
    category: 'serif',
    description: 'Old-style serif. Elegant for long-form reading.',
    files: [
      'CrimsonPro-Regular.ttf', 'CrimsonPro-Italic.ttf',
      'CrimsonPro-Bold.ttf',    'CrimsonPro-BoldItalic.ttf',
    ].map(f => ({
      url: `https://raw.githubusercontent.com/Fonthausen/CrimsonPro/master/fonts/ttf/${f}`,
      name: f,
    })),
    license: {
      url: 'https://raw.githubusercontent.com/Fonthausen/CrimsonPro/master/OFL.txt',
      name: 'OFL.txt',
    },
  },
  {
    family: 'Spectral',
    googleId: 'spectral',
    category: 'serif',
    description: 'Transitional serif by Production Type. Versatile editorial workhorse.',
    files: [
      'Spectral-Regular.ttf', 'Spectral-Italic.ttf',
      'Spectral-Bold.ttf',    'Spectral-BoldItalic.ttf',
    ].map(f => ({
      url: `https://raw.githubusercontent.com/google/fonts/main/ofl/spectral/${f}`,
      name: f,
    })),
    license: {
      url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/spectral/OFL.txt',
      name: 'OFL.txt',
    },
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

function extractFromZip(zipPath, pathInZip, outPath) {
  // unzip -p prints a single file from a zip to stdout. The pathInZip can
  // contain spaces — passing as a single argv element avoids any shell
  // quoting headaches. Output redirected to disk via shell-less spawnSync.
  const result = spawnSync('unzip', ['-p', zipPath, pathInZip], { encoding: 'buffer' });
  if (result.status !== 0 || !result.stdout || result.stdout.length < 1024) {
    throw new Error(`unzip ${zipPath} ${pathInZip} failed: status ${result.status} (${result.stdout?.length ?? 0} bytes)`);
  }
  writeFileSync(outPath, result.stdout);
}

mkdirSync(TARGET, { recursive: true });

let okCount = 0;
let skippedCount = 0;
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

  // ─── Font files: ZIP extraction ───
  if (font.zip) {
    // Quick check: are all targets already present?
    const allPresent = font.zip.files.every(f => {
      const t = join(familyDir, f.name);
      return existsSync(t) && statSync(t).size > 1024;
    });
    if (allPresent) {
      skippedCount += font.zip.files.length;
      continue;
    }

    const zipPath = join(tmpdir(), `vswrite-font-${font.family.replace(/\s+/g, '')}-${Date.now()}.zip`);
    try {
      downloadTo(font.zip.url, zipPath);
      console.log(`[fetch-fonts] ↓ ${font.family} (zip ${statSync(zipPath).size} bytes)`);
      for (const f of font.zip.files) {
        const target = join(familyDir, f.name);
        if (existsSync(target) && statSync(target).size > 1024) {
          skippedCount++;
          continue;
        }
        try {
          extractFromZip(zipPath, f.pathInZip, target);
          console.log(`[fetch-fonts]   → ${f.name}`);
          okCount++;
        } catch (err) {
          errors.push(`${font.family} ${f.name}: ${err.message}`);
        }
      }
    } catch (err) {
      errors.push(`${font.family} zip: ${err.message}`);
    } finally {
      rmSync(zipPath, { force: true });
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
    files: f.files ? f.files.map(x => x.name) : f.zip.files.map(x => x.name),
    license: 'OFL-1.1',
    source: f.zip ? f.zip.url : `https://github.com/google/fonts/tree/main/ofl/${f.googleId}`,
  })),
}, null, 2) + '\n', 'utf-8');

console.log('---');
console.log(`[fetch-fonts] downloaded: ${okCount}, skipped (already-present): ${skippedCount}, errors: ${errors.length}`);
if (errors.length > 0) {
  for (const e of errors) console.error(`  ✗ ${e}`);
  process.exit(1);
}
