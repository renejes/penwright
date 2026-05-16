#!/usr/bin/env node
/**
 * Fetches the bundled Typst packages from the official CDN
 * (packages.typst.org) and places them under
 * `resources/typst-packages/preview/<name>/<version>/`.
 *
 * Idempotent: rerun to refresh. Each package is extracted into its own
 * versioned directory, matching Typst's expected on-disk layout (so a
 * downstream `--package-path` flag finds them without further glue).
 *
 * Source: https://packages.typst.org/preview/<name>-<version>.tar.gz
 * Layout:
 *   resources/typst-packages/
 *     preview/
 *       <name>/
 *         <version>/
 *           typst.toml
 *           LICENSE
 *           lib.typ
 *           ...
 *
 * Bundle list is authoritative here; updating versions = update the
 * PACKAGES array below + rerun. The audit script
 * (scripts/audit-bundled-deps.mjs) reads the resulting layout and
 * cross-checks licenses against the whitelist.
 */

import { spawnSync } from 'node:child_process';
import { mkdirSync, existsSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const TARGET = join(ROOT, 'resources', 'typst-packages', 'preview');

/**
 * Bundled-package manifest. Format: `{ name, version, license, notes }`.
 *
 * License values are advisory — `audit-bundled-deps.mjs` re-checks by
 * reading the actual LICENSE file. Updating versions: bump here, rerun,
 * commit the diff in resources/typst-packages/. The build script
 * `build:fetch-packages` chains this in front of `package:mac`.
 */
const PACKAGES = [
  // ── User-facing bundle (13) ────────────────────────────────
  // Layout / page-flow
  { name: 'wrap-it', version: '0.1.1', license: 'Unlicense', tier: 'primary' },
  { name: 'meander', version: '0.4.2', license: 'MIT', tier: 'primary' },
  // Graphics / diagrams / charts
  { name: 'cetz', version: '0.5.2', license: 'LGPL-3.0-or-later', tier: 'primary' },
  { name: 'fletcher', version: '0.5.8', license: 'MIT', tier: 'primary', notes: 'requires older cetz 0.3.4' },
  { name: 'lilaq', version: '0.6.0', license: 'MIT', tier: 'primary' },
  // Editorial / decoration
  { name: 'drafting', version: '0.2.2', license: 'Unlicense', tier: 'primary' },
  { name: 'droplet', version: '0.3.1', license: 'MIT', tier: 'primary' },
  { name: 'codly', version: '1.3.0', license: 'MIT', tier: 'primary' },
  { name: 'showybox', version: '2.0.4', license: 'MIT', tier: 'primary' },
  { name: 'gentle-clues', version: '1.3.1', license: 'MIT', tier: 'primary' },
  // Academic helpers
  { name: 'glossarium', version: '0.5.10', license: 'MIT', tier: 'primary' },
  { name: 'subpar', version: '0.2.2', license: 'MIT', tier: 'primary' },
  { name: 'lovelace', version: '0.3.1', license: 'MIT', tier: 'primary' },

  // ── Transitive dependencies (auto-discovered from source) ──
  // Required by cetz 0.5.2
  {
    name: 'oxifmt', version: '1.0.0', license: 'MIT', tier: 'transitive',
    notes: 'required by cetz; upstream tarball ships only "MIT OR Apache-2.0" placeholder',
    licenseFetch: 'https://raw.githubusercontent.com/PgBiel/typst-oxifmt/master/LICENSE-MIT',
  },
  // Required by fletcher 0.5.8 — fletcher hasn't been updated to cetz 0.5
  // yet, so we ship both cetz versions side-by-side. Typst handles this fine
  // (the resolver picks the version requested by each import).
  { name: 'cetz', version: '0.3.4', license: 'LGPL-3.0-or-later', tier: 'transitive', notes: 'required by fletcher' },
  // Required by gentle-clues
  { name: 'linguify', version: '0.5.0', license: 'MIT', tier: 'transitive', notes: 'required by gentle-clues' },
  // Required by lilaq — note both komet versions because lilaq's source
  // imports 0.1.0 from some plotting functions and 0.2.0 from others.
  {
    name: 'elembic', version: '1.1.1', license: 'MIT', tier: 'transitive',
    notes: 'required by lilaq; upstream tarball ships only "MIT OR Apache-2.0" placeholder',
    licenseFetch: 'https://raw.githubusercontent.com/PgBiel/elembic/main/LICENSE-MIT',
  },
  { name: 'komet', version: '0.1.0', license: 'MIT', tier: 'transitive', notes: 'required by lilaq (violin/contour)' },
  { name: 'komet', version: '0.2.0', license: 'MIT', tier: 'transitive', notes: 'required by lilaq (boxplot)' },
  { name: 'suiji', version: '0.5.1', license: 'MIT', tier: 'transitive', notes: 'required by lilaq' },
  {
    name: 'tiptoe', version: '0.4.0', license: 'MIT', tier: 'transitive',
    notes: 'required by lilaq',
    // Upstream tarball is missing the LICENSE file (it lives at LICENSE.txt
    // in the GitHub repo but didn't get included in the published package).
    // Backfill from raw.githubusercontent so the audit step is happy.
    licenseFetch: 'https://raw.githubusercontent.com/Mc-Zen/tiptoe/main/LICENSE.txt',
  },
  { name: 'zero', version: '0.6.1', license: 'MIT', tier: 'transitive', notes: 'required by lilaq' },
  // Required by meander
  { name: 'hy-dro-gen', version: '0.1.1', license: 'MIT', tier: 'transitive', notes: 'required by meander' },
  // Recommended companion to codly (language icons + colors). Not strictly
  // required, but codly's main feature (language tags) needs it.
  { name: 'codly-languages', version: '0.1.7', license: 'MIT', tier: 'transitive', notes: 'companion to codly' },
];

mkdirSync(TARGET, { recursive: true });

let okCount = 0;
let skippedCount = 0;
const errors = [];

for (const pkg of PACKAGES) {
  const pkgDir = join(TARGET, pkg.name, pkg.version);
  const alreadyPresent = existsSync(join(pkgDir, 'typst.toml'));

  if (alreadyPresent) {
    console.log(`[fetch-packages] ✓ ${pkg.name}@${pkg.version} already present`);
    skippedCount++;
  } else {
    const url = `https://packages.typst.org/preview/${pkg.name}-${pkg.version}.tar.gz`;
    console.log(`[fetch-packages] ↓ ${pkg.name}@${pkg.version} (${pkg.license})`);

    // Wipe partial extract on retry.
    rmSync(pkgDir, { recursive: true, force: true });
    mkdirSync(pkgDir, { recursive: true });

  // Pipe curl → tar so we never materialise the tarball on disk.
  const curl = spawnSync('curl', ['--fail', '--silent', '--location', url], {
    cwd: pkgDir,
    encoding: 'buffer',
  });
  if (curl.status !== 0) {
    errors.push(`${pkg.name}@${pkg.version}: curl failed (status ${curl.status})`);
    rmSync(pkgDir, { recursive: true, force: true });
    continue;
  }
  const tar = spawnSync('tar', ['-xz', '-C', pkgDir], {
    input: curl.stdout,
    cwd: pkgDir,
  });
  if (tar.status !== 0) {
    errors.push(`${pkg.name}@${pkg.version}: tar extraction failed`);
    rmSync(pkgDir, { recursive: true, force: true });
    continue;
  }

    if (!existsSync(join(pkgDir, 'typst.toml'))) {
      errors.push(`${pkg.name}@${pkg.version}: no typst.toml after extract`);
      rmSync(pkgDir, { recursive: true, force: true });
      continue;
    }
    okCount++;
  }

  // LICENSE backfill — runs on every iteration (including for
  // already-present packages) so that re-runs heal placeholder LICENSEs.
  // Some upstream tarballs ship without their LICENSE file or with a
  // stub like "MIT OR Apache-2.0" sans actual text. When a
  // `licenseFetch` override is provided, always pull the canonical
  // version from the package's GitHub — this is treated as the
  // authoritative source. The audit script enforces real-text LICENSE
  // presence as a hard requirement after this step.
  if (pkg.licenseFetch) {
    const license = spawnSync('curl', ['--fail', '--silent', '--location', pkg.licenseFetch], {
      encoding: 'buffer',
    });
    if (license.status === 0 && license.stdout.length > 0) {
      writeFileSync(join(pkgDir, 'LICENSE'), license.stdout);
    }
  }
}

// Write the manifest alongside the packages so the audit + acknowledgments
// pipeline (and any human auditor) can see the intended bundle list
// without re-parsing the directory tree.
const manifestPath = join(ROOT, 'resources', 'typst-packages', 'manifest.json');
writeFileSync(manifestPath, JSON.stringify({
  generatedAt: new Date().toISOString(),
  packages: PACKAGES,
}, null, 2) + '\n', 'utf-8');

console.log('---');
console.log(`[fetch-packages] downloaded: ${okCount}, skipped (already-present): ${skippedCount}, errors: ${errors.length}`);
if (errors.length > 0) {
  for (const e of errors) console.error(`  ✗ ${e}`);
  process.exit(1);
}
