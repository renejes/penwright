#!/usr/bin/env node
/**
 * Audits the bundled Typst packages under resources/typst-packages/ and:
 *   - Verifies every package has a LICENSE file
 *   - Classifies the license by signature-string matching against the
 *     full LICENSE text
 *   - Cross-checks against the declared license in typst.toml
 *   - Fails the build if any package is on the deny-list (GPL/AGPL/
 *     proprietary) or if the declared license disagrees with what the
 *     LICENSE file actually says
 *   - Generates THIRD_PARTY_LICENSES.md at the repo root (committed)
 *   - Generates resources/bundle-licenses.json for the in-app
 *     Acknowledgments dialog
 *
 * Runs automatically as part of `npm run package:mac` (chained in
 * package.json scripts). Can also be invoked standalone:
 *
 *   node scripts/audit-bundled-deps.mjs
 *
 * Exit codes:
 *   0  audit passed
 *   1  audit failed (deny-list hit, missing LICENSE, declaration
 *      mismatch, etc.)
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const PACKAGES_DIR = join(ROOT, 'resources', 'typst-packages', 'preview');

// ── Whitelist & deny-list ────────────────────────────────────────────
// "id" is the canonical SPDX-ish identifier we use across the audit
// surfaces (THIRD_PARTY_LICENSES.md, in-app dialog). "fingerprints" are
// substrings we expect to find in the LICENSE file's full text — order
// matters: more specific fingerprints first.

const LICENSE_DEFINITIONS = [
  {
    id: 'MIT',
    fingerprints: ['Permission is hereby granted, free of charge', 'THE SOFTWARE IS PROVIDED "AS IS"'],
    bundleable: true,
  },
  {
    id: 'Apache-2.0',
    fingerprints: ['Apache License', 'Version 2.0, January 2004'],
    bundleable: true,
  },
  {
    id: 'BSD-3-Clause',
    fingerprints: ['Redistributions of source code', 'Neither the name of the copyright holder'],
    bundleable: true,
  },
  {
    id: 'BSD-2-Clause',
    fingerprints: ['Redistribution and use in source and binary forms', 'list of conditions and the following disclaimer'],
    bundleable: true,
  },
  {
    id: 'ISC',
    fingerprints: ['Permission to use, copy, modify, and/or distribute this software'],
    bundleable: true,
  },
  {
    id: 'MPL-2.0',
    fingerprints: ['Mozilla Public License Version 2.0'],
    bundleable: true,
  },
  {
    id: 'LGPL-3.0',
    fingerprints: ['GNU LESSER GENERAL PUBLIC LICENSE', 'Version 3'],
    bundleable: true,
    notes: 'OK for unmodified library use; source remains accessible by design.',
  },
  {
    id: 'OFL-1.1',
    fingerprints: ['SIL OPEN FONT LICENSE Version 1.1'],
    bundleable: true,
  },
  {
    id: 'Unlicense',
    fingerprints: ['This is free and unencumbered software released into the public domain'],
    bundleable: true,
  },
  {
    id: 'CC0-1.0',
    fingerprints: ['CC0 1.0 Universal'],
    bundleable: true,
  },
  // Deny-list
  {
    id: 'GPL-3.0',
    fingerprints: ['GNU GENERAL PUBLIC LICENSE', 'Version 3'],
    bundleable: false,
  },
  {
    id: 'GPL-2.0',
    fingerprints: ['GNU GENERAL PUBLIC LICENSE', 'Version 2'],
    bundleable: false,
  },
  {
    id: 'AGPL-3.0',
    fingerprints: ['GNU AFFERO GENERAL PUBLIC LICENSE', 'Version 3'],
    bundleable: false,
  },
];

function classifyLicense(text) {
  // Strip trailing whitespace lines so fingerprints don't get fooled.
  const compact = text.replace(/\s+/g, ' ');
  for (const def of LICENSE_DEFINITIONS) {
    if (def.fingerprints.every(fp => compact.includes(fp))) return def;
  }
  return null;
}

function declaredLicenseFromToml(tomlText) {
  // Naive but reliable — typst.toml is small. Pattern:
  //   license = "MIT"
  //   license = "MIT OR Apache-2.0"
  const m = tomlText.match(/^license\s*=\s*"([^"]+)"/m);
  if (!m) return null;
  return m[1];
}

function declaredMatchesClassified(declared, classified) {
  if (!declared || !classified) return false;
  // Dual licenses ("MIT OR Apache-2.0") match if any segment matches.
  const segments = declared.split(/\s+OR\s+/i).map(s => s.trim());
  return segments.some(s =>
    s === classified.id ||
    s.startsWith(classified.id + '-') ||
    classified.id.startsWith(s + '-') ||
    s === classified.id.replace(/-\d+(\.\d+)*$/, ''),
  );
}

// ── Walk the bundle ───────────────────────────────────────────────────

if (!existsSync(PACKAGES_DIR)) {
  console.error(`[audit] ${PACKAGES_DIR} not found — run \`node scripts/fetch-typst-packages.mjs\` first.`);
  process.exit(1);
}

const findings = [];
const errors = [];

for (const name of readdirSync(PACKAGES_DIR).sort()) {
  const nameDir = join(PACKAGES_DIR, name);
  if (!statSync(nameDir).isDirectory()) continue;

  for (const version of readdirSync(nameDir).sort()) {
    const versionDir = join(nameDir, version);
    if (!statSync(versionDir).isDirectory()) continue;

    const tomlPath = join(versionDir, 'typst.toml');
    const licensePath = join(versionDir, 'LICENSE');

    if (!existsSync(tomlPath)) {
      errors.push(`${name}@${version}: missing typst.toml`);
      continue;
    }
    if (!existsSync(licensePath)) {
      errors.push(`${name}@${version}: missing LICENSE file`);
      continue;
    }

    const tomlText = readFileSync(tomlPath, 'utf-8');
    const licenseText = readFileSync(licensePath, 'utf-8');

    const declared = declaredLicenseFromToml(tomlText);
    const classified = classifyLicense(licenseText);
    const authorMatch = tomlText.match(/^authors\s*=\s*\[\s*"([^"]+)"/m);
    const repoMatch = tomlText.match(/^repository\s*=\s*"([^"]+)"/m);
    const descMatch = tomlText.match(/^description\s*=\s*"([^"]+)"/m);

    if (!classified) {
      errors.push(`${name}@${version}: LICENSE could not be classified (declared as "${declared}"). Update LICENSE_DEFINITIONS or replace the LICENSE with a recognised form.`);
      continue;
    }
    if (!classified.bundleable) {
      errors.push(`${name}@${version}: license ${classified.id} is on the deny-list (copyleft incompatible with commercial bundling). Remove from fetch-typst-packages.mjs and use lazy-fetch instead.`);
      continue;
    }
    if (!declaredMatchesClassified(declared, classified)) {
      errors.push(`${name}@${version}: typst.toml declares "${declared}" but LICENSE text matches ${classified.id}. Investigate which is correct.`);
      continue;
    }

    findings.push({
      name,
      version,
      license: classified.id,
      licenseNotes: classified.notes ?? null,
      author: authorMatch ? authorMatch[1] : '',
      repository: repoMatch ? repoMatch[1] : '',
      description: descMatch ? descMatch[1] : '',
      licensePath: `resources/typst-packages/preview/${name}/${version}/LICENSE`,
    });
  }
}

// ── Emit outputs ──────────────────────────────────────────────────────

if (errors.length > 0) {
  console.error('[audit] FAILED:');
  for (const e of errors) console.error(`  ✗ ${e}`);
  process.exit(1);
}

// 1) THIRD_PARTY_LICENSES.md at repo root.
const markdown = [
  '# Third-Party Licenses — Bundled Typst Packages',
  '',
  '> Auto-generated by `scripts/audit-bundled-deps.mjs`. Do not edit by hand —',
  '> changes are overwritten on the next `package:mac` run. Modify the audit',
  '> script\'s `LICENSE_DEFINITIONS` if a new license needs to be recognised,',
  '> or update `scripts/fetch-typst-packages.mjs` to add or remove a package.',
  '',
  `Total packages: **${findings.length}** (bundled with vswrite Desktop, lazy-fetched packages not included).`,
  '',
  '| Package | Version | License | Author | Repository |',
  '|---|---|---|---|---|',
  ...findings.map(f =>
    `| \`${f.name}\` | ${f.version} | ${f.license} | ${f.author.replace(/\|/g, '\\|')} | ${f.repository ? `[link](${f.repository})` : '—'} |`,
  ),
  '',
  '## Per-Package License Texts',
  '',
  ...findings.flatMap(f => {
    const text = readFileSync(join(ROOT, f.licensePath), 'utf-8').trim();
    return [
      `### ${f.name}@${f.version}`,
      '',
      f.description ? `_${f.description}_` : '',
      f.description ? '' : null,
      f.licenseNotes ? `> ${f.licenseNotes}` : null,
      f.licenseNotes ? '' : null,
      '```',
      text,
      '```',
      '',
    ].filter(line => line !== null);
  }),
].join('\n') + '\n';

writeFileSync(join(ROOT, 'THIRD_PARTY_LICENSES.md'), markdown, 'utf-8');

// 2) resources/bundle-licenses.json for the in-app Acknowledgments dialog.
const jsonOut = {
  generatedAt: new Date().toISOString(),
  totalPackages: findings.length,
  packages: findings.map(f => ({
    name: f.name,
    version: f.version,
    license: f.license,
    licenseNotes: f.licenseNotes,
    author: f.author,
    repository: f.repository,
    description: f.description,
    licenseText: readFileSync(join(ROOT, f.licensePath), 'utf-8').trim(),
  })),
};
writeFileSync(
  join(ROOT, 'resources', 'typst-packages', 'bundle-licenses.json'),
  JSON.stringify(jsonOut, null, 2) + '\n',
  'utf-8',
);

const byLicense = findings.reduce((acc, f) => {
  acc[f.license] = (acc[f.license] || 0) + 1;
  return acc;
}, {});
console.log(`[audit] ✓ ${findings.length} packages, all licenses bundleable`);
for (const [lic, n] of Object.entries(byLicense).sort()) {
  console.log(`  - ${lic}: ${n}`);
}
console.log(`[audit] wrote THIRD_PARTY_LICENSES.md`);
console.log(`[audit] wrote resources/typst-packages/bundle-licenses.json`);
