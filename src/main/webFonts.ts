// Web-export font embedding (@font-face) — the single biggest "design is not
// carried over" fix: styleToCss only names the font families, so on any
// machine without Spectral / Crimson Pro / Inter Tight installed the export
// silently fell back to Georgia/system-ui. This module finds the actual font
// FILES for the families a style uses and embeds them into the bundle:
//
//   sources (in priority order):
//     1. the project's own fonts/ directory (recursive — e.g. fonts/static/),
//        the same files the PDF is set in,
//     2. the bundled OFL families under resources/fonts/<Family>/.
//
// Every matched file becomes an `assets/fonts/<file>` copy + an @font-face
// rule (or a data: URI with `inline`). OFL fonts are explicitly embeddable;
// project-local fonts were placed there by the author. System-installed
// fonts we cannot locate stay name-only (the existing fallback stacks).
//
// Deliberately ELECTRON-FREE (fs/path only) so the headless test harness and
// proof script exercise the identical code path; importExport wires in the
// real directories.

import fs from 'node:fs';
import path from 'node:path';

const FONT_EXT: Record<string, string> = {
  '.woff2': 'woff2', '.woff': 'woff', '.ttf': 'truetype', '.otf': 'opentype',
};
const FONT_MIME: Record<string, string> = {
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.otf': 'font/otf',
};

const WEIGHT_TOKENS: [RegExp, number][] = [
  [/extralight|ultralight/i, 200],
  [/extrabold|ultrabold/i, 800],
  [/semibold|demibold|demi/i, 600],
  [/thin|hairline/i, 100],
  [/light/i, 300],
  [/medium/i, 500],
  [/bold/i, 700],
  [/black|heavy/i, 900],
  [/regular|normal|book|text/i, 400],
];

export interface FontFile {
  /** Absolute source path on disk. */
  src: string;
  /** Target filename under assets/fonts/. */
  name: string;
  family: string;
  weight: number;
  italic: boolean;
}

export interface FontAssets {
  /** @font-face rules (un-scoped at-rules; prepend to the article CSS). */
  css: string;
  /** Files to copy into `<bundle>/assets/fonts/` (empty when inlined). */
  files: FontFile[];
}

/** Normalizes a family name for matching: "Inter Tight" ≙ "InterTight". */
function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

/** Splits a font file's basename into family part + variant part. */
function parseFileName(base: string): { fam: string; variant: string } {
  const dash = base.indexOf('-');
  if (dash > 0) return { fam: base.slice(0, dash), variant: base.slice(dash + 1) };
  return { fam: base, variant: '' };
}

function variantWeight(variant: string): number {
  for (const [re, w] of WEIGHT_TOKENS) if (re.test(variant)) return w;
  return 400;
}

/**
 * The font's `wght` axis range when it is a VARIABLE font, else null — read from
 * the file's `fvar` table, not guessed from its name.
 *
 * This matters because the bundle is now variable: one `Inter[opsz,wght].ttf`
 * covers 100–900. Named by filename it looks like a single face, and the old code
 * deliberately DEPRIORITISED such files ("variable-font umbrella TTFs whose full
 * axis we can't address") — which would have published web pages with one weight
 * where the PDF has nine. CSS can express the range (`font-weight: 100 900`), so
 * a variable file should win over statics rather than lose to them.
 *
 * Only the sfnt container is parsed (.ttf/.otf); a .woff/.woff2 is compressed and
 * returns null, falling back to the filename path.
 */
function variableWeightRange(file: string): { min: number; max: number } | null {
  const ext = path.extname(file).toLowerCase();
  if (ext !== '.ttf' && ext !== '.otf') return null;
  let b: Buffer;
  try { b = fs.readFileSync(file); } catch { return null; }
  if (b.length < 12) return null;

  const numTables = b.readUInt16BE(4);
  let fvar = -1;
  for (let i = 0; i < numTables; i++) {
    const rec = 12 + i * 16;
    if (rec + 16 > b.length) return null;
    if (b.toString('ascii', rec, rec + 4) === 'fvar') { fvar = b.readUInt32BE(rec + 8); break; }
  }
  if (fvar < 0 || fvar + 16 > b.length) return null;

  const axesOffset = fvar + b.readUInt16BE(fvar + 4);
  const axisCount = b.readUInt16BE(fvar + 8);
  const axisSize = b.readUInt16BE(fvar + 10);
  for (let i = 0; i < axisCount; i++) {
    const a = axesOffset + i * axisSize;
    if (a + 12 > b.length) return null;
    if (b.toString('ascii', a, a + 4) !== 'wght') continue;
    // min / default / max are Fixed 16.16.
    const min = Math.round(b.readInt32BE(a + 4) / 65536);
    const max = Math.round(b.readInt32BE(a + 12) / 65536);
    if (min > 0 && max > min) return { min, max };
    return null;
  }
  return null;
}

/** Recursively lists font files under a directory (bounded depth). */
function listFontFiles(dir: string, depth = 0): string[] {
  if (depth > 3) return [];
  let entries: fs.Dirent[];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return []; }
  const out: string[] = [];
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...listFontFiles(p, depth + 1));
    else if (FONT_EXT[path.extname(e.name).toLowerCase()]) out.push(p);
  }
  return out;
}

/** A family name safe inside a quoted CSS string. */
function safeFamily(name: string): string {
  return name.replace(/["'<>;{}()\\]/g, '').trim().slice(0, 60);
}

/**
 * Finds font files for the given families across the source directories and
 * builds their @font-face CSS. Project directories take priority over the
 * bundled families (the PDF was set in the project's own files); within a
 * family a VARIABLE file wins — it spans every weight, which CSS states as a
 * range — then explicitly-named statics (…-SemiBold), then variant-less files.
 */
export function buildFontAssets(opts: {
  families: string[];
  /** Directories to scan, in priority order (project fonts/, bundled fonts). */
  fontDirs: (string | null | undefined)[];
  /** Embed as data: URIs instead of copied files (single-file bundles). */
  inline?: boolean;
  /** Max files per family (safety valve against giant super-families). */
  maxPerFamily?: number;
}): FontAssets {
  const wanted = new Map<string, string>(); // norm(family) → display name
  for (const f of opts.families) {
    const clean = safeFamily(f);
    if (clean) wanted.set(norm(clean), clean);
  }
  if (!wanted.size) return { css: '', files: [] };

  const candidates: string[] = [];
  for (const dir of opts.fontDirs) {
    if (dir) candidates.push(...listFontFiles(dir));
  }

  // norm(family) → key → { file, weight css }. A VARIABLE file is keyed per
  // STYLE (`var/n`, `var/i`) because it covers every weight of that style, and it
  // is taken first so the statics of the same style are then redundant.
  interface Pick { file: string; weight: string; italic: boolean; }
  const picked = new Map<string, Map<string, Pick>>();

  const described = candidates.map((file) => {
    const base = path.basename(file, path.extname(file));
    const { fam, variant } = parseFileName(base);
    return { file, fam, variant, range: variableWeightRange(file) };
  });
  // Variable first, then explicitly-named statics, then variant-less files.
  described.sort((a, b) => {
    const rank = (x: typeof a) => (x.range ? 0 : x.variant ? 1 : 2);
    return rank(a) - rank(b);
  });

  const hasVariable = new Set<string>(); // `${famKey}/${'n'|'i'}`
  for (const { file, fam, variant, range } of described) {
    // Match on the filename's family part, or on the parent directory name
    // (bundled layout: resources/fonts/CrimsonPro/CrimsonPro-Bold.ttf).
    const famKeys = [norm(fam), norm(path.basename(path.dirname(file)))];
    const hit = famKeys.find((k) => wanted.has(k));
    if (!hit) continue;
    // "Var-Italic" / "-Italic" / "Italic[wght]" all mark the italic cut.
    const italic = /italic|oblique/i.test(variant) || /italic|oblique/i.test(fam);
    const style = italic ? 'i' : 'n';
    let fam2 = picked.get(hit);
    if (!fam2) { fam2 = new Map(); picked.set(hit, fam2); }

    if (range) {
      const key = `var/${style}`;
      if (!fam2.has(key)) {
        fam2.set(key, { file, weight: `${range.min} ${range.max}`, italic });
        hasVariable.add(`${hit}/${style}`);
      }
      continue;
    }
    // A static face is skipped when a variable file already covers this style —
    // it would only re-declare one weight the range already spans.
    if (hasVariable.has(`${hit}/${style}`)) continue;
    const key = `${variantWeight(variant)}/${style}`;
    if (!fam2.has(key)) fam2.set(key, { file, weight: String(variantWeight(variant)), italic });
  }

  const css: string[] = [];
  const files: FontFile[] = [];
  const usedNames = new Set<string>();
  const maxPer = opts.maxPerFamily ?? 8;

  for (const [famKey, variants] of picked) {
    const family = wanted.get(famKey)!;
    let n = 0;
    for (const { file, weight, italic } of variants.values()) {
      if (n >= maxPer) break;
      n++;
      const ext = path.extname(file).toLowerCase();
      let url: string;
      // Brackets and spaces are legal on disk but not in a URL, and
      // `Inter[opsz,wght].ttf` / `IBM Plex Sans Var-Roman.ttf` are the upstream
      // names, kept as-is in the bundle so provenance stays obvious.
      // `ext` is lower-cased for the format lookup; strip with the real one.
      const rawExt = path.extname(file);
      let name = path.basename(file, rawExt).replace(/[[\]\s,]+/g, '-').replace(/-+$/, '') + rawExt;
      if (opts.inline) {
        url = `data:${FONT_MIME[ext] ?? 'font/ttf'};base64,${fs.readFileSync(file).toString('base64')}`;
      } else {
        if (usedNames.has(name)) {
          const stem = name.slice(0, -ext.length);
          let k = 1;
          while (usedNames.has(`${stem}-${k}${ext}`)) k++;
          name = `${stem}-${k}${ext}`;
        }
        usedNames.add(name);
        files.push({ src: file, name, family, weight: parseInt(weight), italic });
        url = `assets/fonts/${name}`;
      }
      css.push(
        `@font-face {\n  font-family: "${safeFamily(family)}";\n  src: url("${url}") format("${FONT_EXT[ext] ?? 'truetype'}");\n  font-weight: ${weight};\n  font-style: ${italic ? 'italic' : 'normal'};\n  font-display: swap;\n}`,
      );
    }
  }

  return { css: css.join('\n'), files };
}

/** Copies the picked font files into `<outDir>/assets/fonts/`. Returns the
 *  relative paths written (for meta.json's asset list). */
export function writeFontFiles(outDir: string, files: FontFile[]): string[] {
  if (!files.length) return [];
  const dir = path.join(outDir, 'assets', 'fonts');
  fs.mkdirSync(dir, { recursive: true });
  const rels: string[] = [];
  for (const f of files) {
    try {
      fs.copyFileSync(f.src, path.join(dir, f.name));
      rels.push(`assets/fonts/${f.name}`);
    } catch { /* a missing/unreadable font file must never fail the export */ }
  }
  return rels;
}
