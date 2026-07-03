// Best-effort design-token inference from a HAND-WRITTEN Typst style source.
//
// Penwright projects created in-app carry their design as structured tokens in
// `.penwright/style.json` — the web export reads those directly. But projects
// that arrive from OUTSIDE (the ai-magazine-designer pipeline, any hand-crafted
// Typst project) often have NO style.json: their whole look lives in a
// hand-written `style.typ` (`#let apply-style(body) = { set page(...) … }`).
// Exporting those with DEFAULT_PROJECT_STYLE produced the "design is not
// carried over" failure (white page, blue accent, serif fallback).
//
// This module SCRAPES the obvious, safely-translatable design signals out of
// that hand-written Typst — never executing it:
//
//   • `#let name = rgb("#hex")` color bindings (resolved when referenced)
//   • `#let name = "Font Name"` string bindings (font aliases like `sans`)
//   • `set page(fill: …)`                → colors.background
//   • `set text(font:…, size:…, fill:…, lang:…)` → fonts.body / scale.base /
//                                          colors.text / document language
//   • `set par(leading/spacing/first-line-indent/justify)` → scale.* + justify
//   • `show link: … fill: …`            → colors.accent
//   • `show heading.where(level: N): … text(size/weight/fill/font …)`
//                                        → headings.hN + fonts.heading
//
// The result is a Partial<ProjectStyle> the caller merges over the defaults via
// sanitizeProjectStyle. Heading colors map to the NEAREST palette slot (the
// token model stores slots, not raw hex). Pure string work — no fs, no async —
// so it is shared between main (runWebExport) and the headless test harness.

import type { ProjectStyle, StyleColors, StyleHeading } from './styleTypes';
import { matchBracket } from './exportContext';

/** Deep-partial token model — sanitizeProjectStyle fills every gap. */
export interface InferredTokens {
  colors?: Partial<StyleColors>;
  fonts?: Partial<ProjectStyle['fonts']>;
  scale?: Partial<ProjectStyle['scale']>;
  headings?: Partial<ProjectStyle['headings']>;
  custom?: { preamble: string };
}

export interface InferredStyle {
  /** Partial token model — pass through sanitizeProjectStyle to fill gaps. */
  style: InferredTokens;
  /** `set par(justify: true)` seen — styleToCss translates it to CSS. */
  justify: boolean;
  /** `set text(lang: "…")` seen in the style source (style.typ is #import'ed,
   *  so the merged chapter content never carries it). */
  lang?: string;
  /** True when anything at all was inferred (→ worth applying). */
  confident: boolean;
}

// ─── Small parsing helpers ───────────────────────────────────────────────────

/** All `#name(…)` argument lists in `src` (bracket-matched, multi-line). */
function findCalls(src: string, name: string): string[] {
  const out: string[] = [];
  const re = new RegExp(`(?:#set\\s+|#|\\bset\\s+)${name}\\s*\\(`, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const open = m.index + m[0].length - 1;
    const b = matchBracket(src, open, '(', ')');
    if (b) out.push(b.inner);
  }
  return out;
}

/** Reads a named arg's raw value expression from an arg list (depth-0 comma scan). */
function namedArg(args: string, key: string): string | undefined {
  const re = new RegExp(`(?:^|[,(\\s])${key}\\s*:`, 'g');
  const m = re.exec(args);
  if (!m) return undefined;
  let i = m.index + m[0].length;
  let depth = 0, inStr = false, start = i;
  for (; i < args.length; i++) {
    const ch = args[i];
    if (inStr) { if (ch === '\\') i++; else if (ch === '"') inStr = false; continue; }
    if (ch === '"') { inStr = true; continue; }
    if (ch === '(' || ch === '[' || ch === '{') depth++;
    else if (ch === ')' || ch === ']' || ch === '}') { if (depth === 0) break; depth--; }
    else if (ch === ',' && depth === 0) break;
  }
  const v = args.slice(start, i).trim();
  return v || undefined;
}

/** `rgb("#aabbcc")` / `rgb(255, 0, 0)` / `luma(240)` / bare `#hex` → CSS hex. */
function colorExprToHex(expr: string): string | undefined {
  const t = expr.trim();
  const str = t.match(/^rgb\(\s*"(#?[0-9a-fA-F]{3,8})"\s*\)$/);
  if (str) return str[1].startsWith('#') ? str[1] : `#${str[1]}`;
  const nums = t.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/);
  if (nums) {
    const h = (n: string) => Math.min(255, parseInt(n)).toString(16).padStart(2, '0');
    return `#${h(nums[1])}${h(nums[2])}${h(nums[3])}`;
  }
  const luma = t.match(/^luma\(\s*(\d+)(?:\s*%)?\s*\)$/);
  if (luma) {
    const v = Math.min(255, parseInt(luma[1])).toString(16).padStart(2, '0');
    return `#${v}${v}${v}`;
  }
  if (/^#[0-9a-fA-F]{3,8}$/.test(t)) return t;
  return undefined;
}

/** Typst length literal (pt/em/…): pass through validated, else undefined. */
function lenLit(expr: string | undefined): string | undefined {
  const t = (expr ?? '').trim();
  return /^-?\d+(\.\d+)?(pt|mm|cm|in|em|%)$/.test(t) ? t : undefined;
}

function hexToRgb(hex: string): [number, number, number] | null {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (h.length < 6) return null;
  const n = parseInt(h.slice(0, 6), 16);
  if (Number.isNaN(n)) return null;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function colorDistance(a: string, b: string): number {
  const ra = hexToRgb(a), rb = hexToRgb(b);
  if (!ra || !rb) return Infinity;
  return (ra[0] - rb[0]) ** 2 + (ra[1] - rb[1]) ** 2 + (ra[2] - rb[2]) ** 2;
}

/** Blends two hex colors 50/50 (fallback "muted" between text + background). */
function blendHex(a: string, b: string): string | undefined {
  const ra = hexToRgb(a), rb = hexToRgb(b);
  if (!ra || !rb) return undefined;
  const h = (i: number) => Math.round((ra[i] + rb[i]) / 2).toString(16).padStart(2, '0');
  return `#${h(0)}${h(1)}${h(2)}`;
}

// ─── Binding tables (`#let name = rgb(…)` / `#let name = "Font"`) ───────────

function collectBindings(src: string): { colors: Map<string, string>; strings: Map<string, string> } {
  const colors = new Map<string, string>();
  const strings = new Map<string, string>();
  const re = /#let\s+([a-zA-Z_][\w-]*)\s*=\s*([^\n]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const name = m[1];
    const rhs = m[2].trim();
    const hex = colorExprToHex(rhs.replace(/\/\/.*$/, '').trim());
    if (hex) { colors.set(name, hex); continue; }
    const str = rhs.match(/^"((?:[^"\\]|\\.)*)"\s*(\/\/.*)?$/);
    if (str) strings.set(name, str[1].replace(/\\"/g, '"'));
  }
  return { colors, strings };
}

/** Resolves a color expression, following one level of variable indirection. */
function resolveColor(expr: string | undefined, bindings: Map<string, string>): string | undefined {
  if (!expr) return undefined;
  const t = expr.trim();
  const direct = colorExprToHex(t);
  if (direct) return direct;
  const viaVar = bindings.get(t);
  if (viaVar) return viaVar;
  // `style-colors.slot` (a generated palette dict) — not a hand-written style;
  // leave unresolved (those projects have a style.json anyway).
  return undefined;
}

/** Resolves a font expression: string literal, variable, or tuple → first name. */
function resolveFont(expr: string | undefined, strings: Map<string, string>): string | undefined {
  if (!expr) return undefined;
  const t = expr.trim();
  const lit = t.match(/^"((?:[^"\\]|\\.)*)"/);
  if (lit) return lit[1].replace(/\\"/g, '"');
  const tuple = t.match(/^\(\s*"((?:[^"\\]|\\.)*)"/);
  if (tuple) return tuple[1].replace(/\\"/g, '"');
  return strings.get(t);
}

/** Weight expression → token string ("600" / "bold" / …). */
function resolveWeight(expr: string | undefined): string | undefined {
  const t = (expr ?? '').trim();
  if (/^\d{3}$/.test(t)) return t;
  const named = t.match(/^"([a-z]+)"$/);
  if (named) return named[1];
  return undefined;
}

// ─── Heading show-rules ──────────────────────────────────────────────────────

/**
 * For `show heading.where(level: N): …`, extract the `text(…)` call that
 * actually styles the heading body (the one whose call site references `it` /
 * `it.body`) and read size / weight / fill / font from its args.
 */
function headingRules(src: string): Map<number, { size?: string; weight?: string; fill?: string; font?: string }> {
  const out = new Map<number, { size?: string; weight?: string; fill?: string; font?: string }>();
  const re = /show\s+heading\.where\(\s*level:\s*(\d)\s*\)\s*:/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const level = parseInt(m[1]);
    // The rule extends to the next `show `/`#let ` at line start (or +1200 chars).
    const tail = src.slice(m.index + m[0].length);
    const endM = tail.search(/\n\s*(?:#?show\s|#let\s)/);
    const rule = tail.slice(0, endM > 0 ? endM : 1200);
    // Every `text(` call inside; prefer the one that renders `it.body` / `it)`.
    let best: string | undefined;
    const tre = /\btext\s*\(/g;
    let t: RegExpExecArray | null;
    while ((t = tre.exec(rule))) {
      const open = t.index + t[0].length - 1;
      const b = matchBracket(rule, open, '(', ')');
      if (!b) continue;
      if (/\bit\b/.test(b.inner)) { best = b.inner; break; }
      best ??= b.inner;
    }
    if (!best) continue;
    out.set(level, {
      size: lenLit(namedArg(best, 'size')),
      weight: resolveWeight(namedArg(best, 'weight')),
      fill: namedArg(best, 'fill'),
      font: namedArg(best, 'font'),
    });
  }
  return out;
}

/** Maps an inferred hex to the nearest palette SLOT (the token model stores
 *  slots for heading colors, not raw hex). Background is excluded — a heading
 *  is never intentionally page-colored. */
function nearestSlot(hex: string, palette: StyleColors): keyof StyleColors {
  const slots: (keyof StyleColors)[] = ['text', 'primary', 'accent', 'muted'];
  let best: keyof StyleColors = 'text';
  let bestD = Infinity;
  for (const s of slots) {
    const d = colorDistance(hex, palette[s]);
    if (d < bestD) { bestD = d; best = s; }
  }
  return best;
}

// ─── The main inference ──────────────────────────────────────────────────────

/**
 * Infers a Partial<ProjectStyle> from hand-written Typst style sources
 * (style.typ + macro files + the root preamble, concatenated by the caller).
 * Only used when the project has NO `.penwright/style.json` — structured
 * tokens always win over scraping.
 */
export function inferStyleFromTypst(sources: string[]): InferredStyle {
  const src = sources.join('\n\n');
  const { colors: colorVars, strings: stringVars } = collectBindings(src);

  const style: InferredStyle['style'] = {};
  let confident = false;
  let justify = false;
  let lang: string | undefined;

  // --- body text: the `set text(…)` with a size (the document-level one) -----
  const textCalls = findCalls(src, 'text').filter((a) => /(^|[,(\s])size\s*:/.test(a) && /(^|[,(\s])font\s*:/.test(a));
  // Prefer the longest arg list — the apply-style one carries font+size+fill+lang.
  textCalls.sort((a, b) => b.length - a.length);
  const bodyArgs = textCalls[0];
  const fonts: Partial<ProjectStyle['fonts']> = {};
  const scale: Partial<ProjectStyle['scale']> = {};
  const cols: Partial<StyleColors> = {};
  if (bodyArgs) {
    const f = resolveFont(namedArg(bodyArgs, 'font'), stringVars);
    if (f) { fonts.body = f; confident = true; }
    const size = lenLit(namedArg(bodyArgs, 'size'));
    if (size) { scale.base = size; confident = true; }
    const fill = resolveColor(namedArg(bodyArgs, 'fill'), colorVars);
    if (fill) { cols.text = fill; confident = true; }
  }
  const langM = src.match(/\blang:\s*"([a-zA-Z-]+)"/);
  if (langM) lang = langM[1].slice(0, 2).toLowerCase();

  // --- page background --------------------------------------------------------
  for (const pageArgs of findCalls(src, 'page')) {
    const fill = resolveColor(namedArg(pageArgs, 'fill'), colorVars);
    if (fill) { cols.background = fill; confident = true; break; }
  }

  // --- paragraph rhythm --------------------------------------------------------
  const parCalls = findCalls(src, 'par').filter((a) => /leading|justify|spacing|first-line-indent/.test(a));
  parCalls.sort((a, b) => b.length - a.length);
  const parArgs = parCalls[0];
  if (parArgs) {
    const leading = lenLit(namedArg(parArgs, 'leading'));
    if (leading) { scale.leading = leading; confident = true; }
    const spacing = lenLit(namedArg(parArgs, 'spacing'));
    if (spacing) scale.paragraphSpacing = spacing;
    const indent = lenLit(namedArg(parArgs, 'first-line-indent'));
    if (indent) scale.firstLineIndent = indent;
    if (/justify\s*:\s*true/.test(parArgs)) justify = true;
  }

  // --- accent: the link color is the most reliable hand-written accent signal --
  const linkRule = src.match(/show\s+link\s*:[^\n]*/);
  if (linkRule) {
    const fill = resolveColor(namedArg(linkRule[0], 'fill') ?? linkRule[0].match(/fill:\s*([\w-]+)/)?.[1], colorVars);
    if (fill) { cols.accent = fill; confident = true; }
  }

  // --- muted: a binding named like muted/gray/meta, else text↔background blend -
  let muted: string | undefined;
  for (const [name, hex] of colorVars) {
    if (/mut|grey|gray|subtle|meta|caption|graphite/i.test(name)) { muted = hex; break; }
  }
  if (!muted && cols.text && cols.background) muted = blendHex(cols.text, cols.background);
  if (muted) cols.muted = muted;
  if (cols.text) cols.primary = cols.text; // hand-written styles rarely split these

  // Build the palette we map heading slots against (inferred over defaults).
  const palette: StyleColors = {
    primary: cols.primary ?? '#0f172a',
    accent: cols.accent ?? '#3b82f6',
    text: cols.text ?? '#1a1a1a',
    background: cols.background ?? '#ffffff',
    muted: cols.muted ?? '#6b7280',
  };

  // --- headings ----------------------------------------------------------------
  const rules = headingRules(src);
  const headings: Partial<Record<'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6', StyleHeading>> = {};
  for (const [level, r] of rules) {
    if (level < 1 || level > 6) continue;
    const fill = resolveColor(r.fill, colorVars);
    const h: StyleHeading = {
      size: r.size ?? '',
      weight: r.weight ?? 'bold',
      color: fill ? nearestSlot(fill, palette) : 'text',
      marginTop: '',
    };
    headings[`h${level}` as 'h1'] = h;
    const hf = resolveFont(r.font, stringVars);
    if (hf && !fonts.heading) fonts.heading = hf;
    confident = true;
  }
  // Generic `show heading: set text(font: …)` (no .where) → heading font.
  if (!fonts.heading) {
    const generic = src.match(/show\s+heading\s*:\s*set\s+text\(([^)]*)\)/);
    if (generic) {
      const hf = resolveFont(namedArg(generic[1], 'font'), stringVars);
      if (hf) fonts.heading = hf;
    }
  }
  // A sans body with no explicit heading font → headings share the body font
  // (hand-written styles set the heading look per show-rule text() call).
  if (!fonts.heading && fonts.body && rules.size > 0) fonts.heading = fonts.body;

  if (Object.keys(cols).length) style.colors = cols;
  if (Object.keys(fonts).length) style.fonts = fonts;
  if (Object.keys(scale).length) style.scale = scale;
  if (Object.keys(headings).length) style.headings = headings;
  if (justify) style.custom = { preamble: '#set par(justify: true)' };

  return { style, justify, lang, confident };
}

// ─── `#lead` semantics ───────────────────────────────────────────────────────

/**
 * Decides what a project's `#lead[…]` macro MEANS. LANGSAM's `lead` is a real
 * drop cap (droplet's `dropcap`); other templates use `lead` for a standfirst /
 * Anreißer paragraph (bigger, lighter — NO sunken initial). The deserializer
 * maps `#lead` to the dropCap node by NAME, so the export needs the project's
 * own definition to render it faithfully.
 *
 * Default (no definition found) stays 'dropcap' — the LANGSAM-family behavior.
 */
export function detectLeadStyle(sources: string[]): 'dropcap' | 'standfirst' {
  const src = sources.join('\n\n');
  const m = src.match(/#let\s+lead\s*\(/);
  if (!m) return 'dropcap';
  // The binding body: from the definition to the next top-level `#let` (or EOF).
  const tail = src.slice(m.index! + m[0].length);
  const endM = tail.search(/\n#let\s/);
  const body = tail.slice(0, endM > 0 ? endM : 800);
  return /\bdropcap\b/.test(body) ? 'dropcap' : 'standfirst';
}
