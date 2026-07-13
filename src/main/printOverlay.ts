/**
 * Print-export geometry overlay for HAND-DESIGNED projects (electron-free —
 * importable from test/proof scripts, like webExport/webFonts).
 *
 * Projects without `.penwright/style.json` keep their whole look in a
 * hand-written style.typ / inline #set rules. The token pipeline can't
 * regenerate that (repointing the import used to replace the author's design
 * with Penwright defaults) — instead the design stays 100% untouched and a
 * single export-only `#set page(...)` overlay enlarges the physical page by
 * the bleed, compensates the margins (content keeps its position relative to
 * the TRIM box) and hangs the crop marks in the page foreground.
 *
 * Known, accepted limitations: facing-pages/binding are skipped for hand
 * designs, and sections that re-set their own margins mid-document sit
 * relative to the physical page (off by one bleed width).
 */

import * as path from 'path';
import * as fs from 'fs';
import { PAPER_MM } from '../shared/styleParser';

export interface PrintOverlayConfig {
  bleed?: string;
  cropMarks?: boolean;
}

/** The root + its first-level relative .typ imports (style.typ, macros.typ, …). */
export function collectHandStyleSources(rootFile: string, rootContent: string): string[] {
  const sources = [rootContent];
  const rootDir = path.dirname(rootFile);
  const re = /#import\s+"([^"]+\.typ)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(rootContent))) {
    if (m[1].startsWith('@') || path.isAbsolute(m[1])) continue; // package or absolute
    const p = path.resolve(rootDir, m[1]);
    if (!p.startsWith(rootDir + path.sep)) continue;
    try { sources.push(fs.readFileSync(p, 'utf-8')); } catch { /* ignore */ }
  }
  return sources;
}

/** Balanced-paren arg scan (strings honoured) starting at the '(' index. */
function matchParenArgs(src: string, openIdx: number): { inner: string; end: number } | null {
  let depth = 1, inStr = false, j = openIdx + 1;
  while (j < src.length && depth > 0) {
    const c = src[j];
    if (inStr) {
      if (c === '\\') j++;
      else if (c === '"') inStr = false;
    } else if (c === '"') inStr = true;
    else if (c === '(') depth++;
    else if (c === ')') depth--;
    j++;
  }
  if (depth !== 0) return null;
  return { inner: src.slice(openIdx + 1, j - 1), end: j };
}

/** Splits on `sep` at paren/bracket depth 0 (strings honoured). */
function splitTopLevel(s: string, sep: string): string[] {
  const parts: string[] = [];
  let depth = 0, inStr = false, cur = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      cur += c;
      if (c === '\\') { cur += s[i + 1] ?? ''; i++; }
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') { inStr = true; cur += c; continue; }
    if (c === '(' || c === '[' || c === '{') depth++;
    if (c === ')' || c === ']' || c === '}') depth--;
    if (c === sep && depth === 0) { parts.push(cur); cur = ''; continue; }
    cur += c;
  }
  if (cur.trim()) parts.push(cur);
  return parts;
}

/** Value of a top-level `key: …` arg inside a set-page args string. */
function topLevelArg(args: string, key: string): string | undefined {
  for (const part of splitTopLevel(args, ',')) {
    const ci = part.indexOf(':');
    if (ci === -1) continue;
    if (part.slice(0, ci).trim() === key) return part.slice(ci + 1).trim();
  }
  return undefined;
}

/**
 * Page geometry from the hand-written sources: size (paper or width+height)
 * from the FIRST size-bearing `set page(...)`, margin from the LAST
 * margin-bearing one. The margin must be the last because hand styles layer
 * their set rules (LANGSAM: `margin: 3.4cm` in the base setup, then the
 * asymmetric editorial Satzspiegel `(left: 3.4cm, right: 5.2cm, …)` in the
 * custom block) — taking the first would both change the design's margins
 * AND collapse to a uniform margin, which Typst normalises back to a scalar
 * (breaking packages like `drafting` that call `page.margin.keys()`).
 */
export function extractHandPageSetup(sources: string[]): {
  paper?: string; widthExpr?: string; heightExpr?: string; margin?: string;
} {
  let paper: string | undefined;
  let widthExpr: string | undefined;
  let heightExpr: string | undefined;
  let margin: string | undefined;
  for (const src of sources) {
    let idx = 0;
    for (;;) {
      const at = src.indexOf('set page(', idx);
      if (at === -1) break;
      const args = matchParenArgs(src, at + 'set page('.length - 1);
      if (!args) break;
      const p = /paper\s*:\s*"([^"]+)"/.exec(args.inner)?.[1];
      const w = topLevelArg(args.inner, 'width');
      const h = topLevelArg(args.inner, 'height');
      const m = topLevelArg(args.inner, 'margin');
      if (!paper && !(widthExpr && heightExpr)) {
        if (p) paper = p;
        if (w && h) { widthExpr = w; heightExpr = h; }
      }
      if (m) margin = m; // last one wins — matches Typst's set-rule layering
      idx = args.end;
    }
  }
  return { paper, widthExpr, heightExpr, margin };
}

/**
 * `margin + bleed` for scalar and dict margins; `auto` entries stay as-is.
 * ALWAYS emits a dict — a scalar becomes the equivalent four-side dict.
 * Packages introspect `page.margin` and assume the dict shape (the bundled
 * `drafting` calls `page.margin.keys()`, which throws on a relative length),
 * so a scalar overlay margin broke every project using margin notes.
 */
export function addBleedToMargin(marginExpr: string, bleed: string): string {
  const t = marginExpr.trim();
  const comp = (v: string) => (v.trim() === 'auto' ? v.trim() : `(${v.trim()} + ${bleed})`);
  if (t.startsWith('(') && t.includes(':')) {
    const entries = splitTopLevel(t.slice(1, -1), ',').map((p) => {
      const ci = p.indexOf(':');
      if (ci === -1) return p.trim();
      return `${p.slice(0, ci).trim()}: ${comp(p.slice(ci + 1))}`;
    });
    return `(${entries.join(', ')})`;
  }
  const v = comp(t);
  return `(top: ${v}, bottom: ${v}, left: ${v}, right: ${v})`;
}

export function buildPrintGeometryOverlay(
  rootFile: string,
  rootContent: string,
  print: PrintOverlayConfig,
): string | null {
  const bleed = (print.bleed ?? '').trim();
  if (!bleed) return null; // no bleed → the design's own geometry is already right

  const setup = extractHandPageSetup(collectHandStyleSources(rootFile, rootContent));
  let wExpr: string, hExpr: string;
  if (setup.widthExpr && setup.heightExpr) {
    wExpr = `(${setup.widthExpr}) + 2 * ${bleed}`;
    hExpr = `(${setup.heightExpr}) + 2 * ${bleed}`;
  } else {
    const dims = PAPER_MM[setup.paper ?? 'a4'] ?? PAPER_MM['a4'];
    wExpr = `${dims[0]}mm + 2 * ${bleed}`;
    hExpr = `${dims[1]}mm + 2 * ${bleed}`;
  }
  // No explicit margin found → 2.5cm approximates Typst's A4 auto margin.
  const margin = addBleedToMargin(setup.margin ?? '2.5cm', bleed);

  const lines: string[] = [
    '',
    '// ── Penwright print overlay (export-only, temp file) ──',
    '// Oversized page = trim + 2×bleed; margins compensated so content keeps its',
    '// position relative to the trim box. The hand-written design above is untouched.',
  ];
  if (print.cropMarks) {
    lines.push('#let _pw-crop-marks(b) = context {');
    lines.push('  set line(stroke: 0.3pt + black)');
    lines.push('  place(top + left, dx: b, line(end: (0pt, b)))');
    lines.push('  place(top + left, dy: b, line(end: (b, 0pt)))');
    lines.push('  place(top + right, dx: -b, line(end: (0pt, b)))');
    lines.push('  place(top + right, dy: b, line(end: (-b, 0pt)))');
    lines.push('  place(bottom + left, dx: b, line(end: (0pt, -b)))');
    lines.push('  place(bottom + left, dy: -b, line(end: (b, 0pt)))');
    lines.push('  place(bottom + right, dx: -b, line(end: (0pt, -b)))');
    lines.push('  place(bottom + right, dy: -b, line(end: (-b, 0pt)))');
    lines.push('}');
  }
  const props = [`width: (${wExpr})`, `height: (${hExpr})`, `margin: ${margin}`];
  if (print.cropMarks) props.push(`foreground: _pw-crop-marks(${bleed})`);
  lines.push(`#set page(${props.join(', ')})`);
  lines.push('');
  return lines.join('\n');
}

/**
 * Inserts the overlay after the document's directive prologue (imports, show
 * rules, top-level sets/lets, comments) so it wins over the design's own page
 * setup but precedes the first content. Multi-line directives are consumed via
 * bracket-depth tracking.
 */
export function injectAfterPrologue(content: string, overlay: string): string {
  const lines = content.split('\n');
  let i = 0;
  let depth = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();
    if (depth > 0) {
      // Inside a multi-line directive — consume until balanced.
      for (const c of line) {
        if (c === '(' || c === '[' || c === '{') depth++;
        else if (c === ')' || c === ']' || c === '}') depth--;
      }
      i++;
      continue;
    }
    if (trimmed === '' || trimmed.startsWith('//')) { i++; continue; }
    if (/^#(import|show|set|let)\b/.test(trimmed)) {
      for (const c of line) {
        if (c === '(' || c === '[' || c === '{') depth++;
        else if (c === ')' || c === ']' || c === '}') depth--;
      }
      if (depth < 0) depth = 0;
      i++;
      continue;
    }
    break;
  }
  lines.splice(i, 0, overlay);
  return lines.join('\n');
}
