// ProjectStyle design tokens → scoped CSS for the web export.
//
// The CSS mirror of styleParser's emitCoreRules: the SAME token model
// (colors / fonts / scale / headings / elements), retargeted from Typst
// `#set`/`#show` rules to CSS custom properties + element rules, all scoped
// under `.pw-article` so the article never collides with a host site's CSS.
//
// Deliberate print → web translations (the plan's "translate, don't copy"):
//  • paper size / margins  → a READING MEASURE (max-width in ch), not a page.
//  • base font size (pt)   → a comfortable web reading size; headings keep
//                            their RELATIVE scale (ratio to the base) so the
//                            design's proportions survive while staying legible.
//  • Typst `leading`       → CSS line-height (≈ 1 + leading-in-em).
//  • color slots           → `--pw-*` custom properties (a host MAY override
//                            them to harmonize; it needn't).
//
// Explicitly NOT emitted (print-only, no responsive web equivalent — skipped,
// not faked): layout.paper/orientation/margin/columns, pageNumbering/Header/
// Footer/Fill, bleed/cropMarks/facingPages/binding, and custom.preamble
// (arbitrary Typst — cannot run on the web).
//
// shared/ stays dependency-free: this is pure string work.

import type { ProjectStyle, StyleColors } from './styleTypes';

export interface StyleToCssOptions {
  /**
   * Scoping strategy. 'prefix' (default, the robust floor) prefixes every rule
   * with `.pw-article`. 'scope' wraps the rules in `@scope (.pw-article) { … }`
   * (cleaner, but only Baseline-Newly-Available — see the plan §1.2 C7).
   */
  scope?: 'prefix' | 'scope';
  /** Web reading base font size in rem (the body size). Default 1.125 (≈18px). */
  baseRem?: number;
}

/** Typst font-weight keyword → CSS numeric weight. Numeric input passes through. */
const WEIGHT: Record<string, string> = {
  thin: '100', extralight: '200', light: '300', regular: '400', normal: '400',
  medium: '500', semibold: '600', bold: '700', extrabold: '800', black: '900',
};
function cssWeight(w: string): string {
  const t = (w || '').trim().toLowerCase();
  if (/^\d+$/.test(t)) return t;
  return WEIGHT[t] ?? '400';
}

/** Parses a Typst length into a number + unit, or null (e.g. for `fr`). */
function parseLen(s: string): { value: number; unit: string } | null {
  const m = (s || '').trim().match(/^(-?\d+(?:\.\d+)?)(pt|mm|cm|in|em|%)$/);
  if (!m) return null; // fr / unitless / empty → no web equivalent
  return { value: parseFloat(m[1]), unit: m[2] };
}

/** A Typst length as a multiple of the base font size (em), or null. */
function lenToEm(s: string, basePt: number): number | null {
  const p = parseLen(s);
  if (!p) return null;
  switch (p.unit) {
    case 'em': return p.value;
    case 'pt': return p.value / basePt;
    case 'mm': return (p.value * 72 / 25.4) / basePt;
    case 'cm': return (p.value * 72 / 2.54) / basePt;
    case 'in': return (p.value * 72) / basePt;
    case '%': return p.value / 100;
    default: return null;
  }
}

const round = (n: number, d = 3) => Number(n.toFixed(d));

/** Base font size in pt from `scale.base` (defaults to 11 if not in pt/em). */
function basePt(style: ProjectStyle): number {
  const p = parseLen(style.scale.base);
  if (p?.unit === 'pt') return p.value;
  return 11;
}

/** A web-safe font stack: the configured name + a generic that matches its
 *  apparent classification (cheap heuristic; faithful enough for a fallback).
 *  The name is stripped of CSS/HTML metacharacters and always quoted, so a
 *  hostile style.json font value (e.g. `x}</style><script>…`) can never break
 *  out of the inline <style> block (it would otherwise be interpolated raw). */
function fontStack(name: string, kind: 'body' | 'heading' | 'code'): string {
  const generic = kind === 'code'
    ? 'ui-monospace, "Cascadia Code", Menlo, Consolas, monospace'
    : /(sans|inter|helvetica|arial|roboto|grotesk|segoe|system|plex sans|figtree|work)/i.test(name)
      ? 'system-ui, sans-serif'
      : 'Georgia, "Times New Roman", serif';
  const safe = (name || '').replace(/["'<>;{}()\\]/g, '').trim().slice(0, 60);
  return safe ? `"${safe}", ${generic}` : generic;
}

/** color slot → the CSS custom-property reference. */
const cvar = (slot: keyof StyleColors) => `var(--pw-${slot})`;

/**
 * Generates the scoped CSS for the article's inline `<style>` block.
 * Returns a CSS string (no `<style>` wrapper — serializeHtml adds that).
 */
export function styleToCss(style: ProjectStyle, opts: StyleToCssOptions = {}): string {
  const baseRem = opts.baseRem ?? 1.125;
  const bpt = basePt(style);
  const out: string[] = [];

  // --- root: custom properties + base typography ---------------------------
  const c = style.colors;
  const f = style.fonts;
  const rootDecls: string[] = [
    `--pw-primary: ${c.primary}`,
    `--pw-accent: ${c.accent}`,
    `--pw-text: ${c.text}`,
    `--pw-background: ${c.background}`,
    `--pw-muted: ${c.muted}`,
    `--pw-font-body: ${fontStack(f.body, 'body')}`,
    `--pw-font-heading: ${fontStack(f.heading, 'heading')}`,
    `--pw-font-code: ${fontStack(f.code, 'code')}`,
    `color: var(--pw-text)`,
    `background: var(--pw-background)`,
    `font-family: var(--pw-font-body)`,
    `font-size: ${baseRem}rem`,
    `box-sizing: border-box`,
    `max-width: 70ch`,
    `margin-inline: auto`,
    // Breathing room + a side gutter so text never touches the screen edge on
    // mobile; with box-sizing the measure stays 70ch.
    `padding: 2.5rem 1.25rem`,
  ];
  const leadingEm = lenToEm(style.scale.leading, bpt);
  if (leadingEm !== null) rootDecls.push(`line-height: ${round(Math.min(Math.max(1 + leadingEm, 1.2), 2.2), 2)}`);
  // custom.preamble is free-form Typst and is NOT executed on the web (plan C4),
  // but a few declarations have a safe, 1:1 CSS translation — pick those out
  // instead of dropping the whole block. Justified body is the editorial signal
  // most magazines set here (e.g. `#set par(justify: true)`); translate it +
  // enable hyphenation (the article carries `lang` so hyphens: auto works).
  const preamble = style.custom?.preamble ?? '';
  if (/\bpar\(\s*[^)]*justify:\s*true/.test(preamble)) {
    rootDecls.push('text-align: justify', 'hyphens: auto', '-webkit-hyphens: auto');
  }
  out.push(`{\n  ${rootDecls.join(';\n  ')};\n}`);

  // --- paragraphs ----------------------------------------------------------
  const pDecls: string[] = [];
  const spacingEm = lenToEm(style.scale.paragraphSpacing, bpt);
  if (spacingEm !== null) pDecls.push(`margin: 0 0 ${round(spacingEm)}em`);
  const indentEm = lenToEm(style.scale.firstLineIndent, bpt);
  if (indentEm !== null && indentEm > 0) pDecls.push(`text-indent: ${round(indentEm)}em`);
  if (pDecls.length) out.push(`p {\n  ${pDecls.join(';\n  ')};\n}`);

  // --- headings (ratio-scaled to preserve the design's proportions) --------
  const levels = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'] as const;
  levels.forEach((lvl) => {
    const h = style.headings[lvl];
    const sizeEm = lenToEm(h.size, bpt);
    const decls = [
      `font-family: var(--pw-font-heading)`,
      `font-weight: ${cssWeight(h.weight)}`,
      `color: ${cvar(h.color)}`,
    ];
    if (sizeEm !== null) decls.push(`font-size: ${round(sizeEm, 2)}em`);
    const topEm = lenToEm(h.marginTop, bpt);
    if (topEm !== null) decls.push(`margin-top: ${round(topEm)}em`);
    decls.push('line-height: 1.15');
    out.push(`${lvl} {\n  ${decls.join(';\n  ')};\n}`);
  });

  // --- block elements (HTML can be more faithful than DOCX) ----------------
  const e = style.elements;
  {
    const b = e.blockquote;
    const decls = [
      `border-inline-start: ${b.borderWidth} solid ${cvar(b.borderColor)}`,
      `padding-inline-start: ${b.paddingLeft}`,
      `margin-inline: 0`,
      `color: ${cvar(b.textColor)}`,
    ];
    if (b.italic) decls.push('font-style: italic');
    out.push(`blockquote {\n  ${decls.join(';\n  ')};\n}`);
  }
  {
    const cb = e.codeBlock;
    const decls = [`font-family: var(--pw-font-code)`, `overflow: auto`];
    // Typst color expressions like luma(245) have no CSS form; only pass a
    // raw hex/rgb/CSS color through, else fall back to a subtle tint.
    // Validate the FULL value (not just the prefix) so a token like
    // `#fff}</style>…` from a hostile style.json can't ride into the <style>.
    const bg = cb.background.trim();
    const safeBg = /^#[0-9a-fA-F]{3,8}$/.test(bg) || /^(rgb|rgba|hsl|hsla)\([0-9.,%\s/]*\)$/i.test(bg);
    decls.push(`background: ${safeBg ? bg : 'color-mix(in srgb, var(--pw-muted) 12%, transparent)'}`);
    if (cb.borderRadius.trim()) decls.push(`border-radius: ${cb.borderRadius.trim()}`);
    const px = cb.paddingX.trim() || '1em';
    const py = cb.paddingY.trim() || '0.6em';
    decls.push(`padding: ${py} ${px}`);
    out.push(`pre {\n  ${decls.join(';\n  ')};\n}`);
    out.push(`code { font-family: var(--pw-font-code); }`);
  }
  {
    const fig = e.figure;
    // Global image cap so a full-res photo never overflows the reading measure
    // (whether or not it's wrapped in a <figure>).
    out.push(`img { max-width: 100%; height: auto; }`);
    out.push(`figure { margin-inline: 0; }`);
    const sizeEm = lenToEm(fig.captionSize, bpt);
    const capDecls = [
      `color: ${cvar(fig.captionColor)}`,
      `text-align: ${fig.captionAlign}`,
    ];
    if (sizeEm !== null) capDecls.push(`font-size: ${round(sizeEm, 2)}em`);
    capDecls.push(fig.captionPosition === 'top' ? 'margin-bottom: 0.5em' : 'margin-top: 0.5em');
    out.push(`figcaption {\n  ${capDecls.join(';\n  ')};\n}`);
  }
  {
    const t = e.table;
    out.push(`table {\n  border-collapse: collapse;\n  width: 100%;\n}`);
    out.push(`th, td {\n  border: 0.5px solid ${cvar(t.borderColor)};\n  padding: ${t.cellPadding};\n}`);
    out.push(`th {\n  background: ${cvar(t.headerBackground)};\n  color: ${cvar(t.headerTextColor)};\n  font-weight: 700;\n  text-align: start;\n}`);
    if (t.alternateRowFill) {
      out.push(`tbody tr:nth-child(even) td {\n  background: color-mix(in srgb, var(--pw-muted) 12%, transparent);\n}`);
    }
  }

  // --- helper element classes the serializer emits -------------------------
  out.push(`a { color: var(--pw-accent); }`);
  out.push(`.pw-cite, .pw-ref { color: var(--pw-accent); text-decoration: none; }`);
  out.push(`hr {\n  border: none;\n  border-top: 1px solid color-mix(in srgb, var(--pw-muted) 50%, transparent);\n  margin: 2em auto;\n  width: 6em;\n}`);

  // --- design elements (Phase B slice: drop cap + callout) -----------------
  // Drop cap: native initial-letter (Chrome + Safari, -webkit- for older
  // Safari) sinks the first letter; Firefox has NO initial-letter support at
  // any version (plan §1.2 C5), so the ::first-letter{float} fallback under
  // @supports is permanent, not temporary.
  out.push(`.pw-dropcap::first-letter {\n  -webkit-initial-letter: 3;\n  initial-letter: 3;\n  color: var(--pw-accent);\n  font-family: var(--pw-font-heading);\n  font-weight: 700;\n  margin-inline-end: 0.08em;\n}`);
  out.push(`@supports not (initial-letter: 3) {\n  .pw-article .pw-dropcap::first-letter {\n    float: left;\n    font-family: var(--pw-font-heading);\n    font-weight: 700;\n    color: var(--pw-accent);\n    font-size: 3.4em;\n    line-height: 0.78;\n    padding-inline-end: 0.08em;\n  }\n}`);
  // Callout: token-tinted accent box (color-mix is Baseline-Widely-Available —
  // the most faithful part, no fallback needed). data-tone is preserved for
  // future per-tone theming; the slice tints all tones with the accent.
  out.push(`.pw-callout {\n  border-inline-start: 4px solid var(--pw-accent);\n  background: color-mix(in srgb, var(--pw-accent) 8%, transparent);\n  padding: 0.9em 1.1em;\n  margin: 1.3em 0;\n  border-radius: 4px;\n}`);
  out.push(`.pw-callout > :first-child { margin-top: 0; }`);
  out.push(`.pw-callout > :last-child { margin-bottom: 0; }`);
  out.push(`.pw-callout-title {\n  font-weight: 700;\n  color: var(--pw-accent);\n  font-family: var(--pw-font-heading);\n  margin: 0 0 0.3em;\n}`);

  // --- magazine AST nodes (Phase C keystone) -------------------------------
  // The load-bearing macros, retargeted to CSS that preserves the magazine's
  // character while reflowing responsively (the plan's "translate, don't copy").

  // articleHeader (← opener): kicker / title (H1) / standfirst / byline.
  out.push(`.pw-opener { margin: 0 0 2em; }`);
  out.push(`.pw-opener-kicker {\n  font-family: var(--pw-font-heading);\n  font-weight: 700;\n  font-size: 0.8em;\n  letter-spacing: 0.2em;\n  text-transform: uppercase;\n  color: var(--pw-accent);\n  margin: 0 0 0.7em;\n}`);
  out.push(`.pw-opener-title { margin: 0; }`);
  out.push(`.pw-opener-standfirst {\n  font-family: var(--pw-font-heading);\n  font-style: italic;\n  font-size: 1.3em;\n  line-height: 1.35;\n  color: var(--pw-muted);\n  text-indent: 0;\n  margin: 0.5em 0 0;\n}`);
  out.push(`.pw-opener-byline {\n  font-size: 0.82em;\n  letter-spacing: 0.06em;\n  color: var(--pw-muted);\n  text-indent: 0;\n  margin: 0.85em 0 0;\n}`);

  // pullQuote (← pull): large centered italic accent quote + short rule + cite.
  out.push(`.pw-pull {\n  margin: 1.6em 0;\n  text-align: center;\n  border: none;\n  padding: 0;\n}`);
  out.push(`.pw-pull-body {\n  font-family: var(--pw-font-heading);\n  font-style: italic;\n  font-size: 1.5em;\n  line-height: 1.3;\n  color: var(--pw-accent);\n  text-indent: 0;\n  margin: 0;\n}`);
  out.push(`.pw-pull-body::after {\n  content: "";\n  display: block;\n  width: 1.1em;\n  border-top: 1px solid var(--pw-accent);\n  margin: 0.6em auto 0;\n}`);
  out.push(`.pw-pull-who {\n  display: block;\n  font-style: normal;\n  font-size: 0.82em;\n  letter-spacing: 0.08em;\n  color: var(--pw-muted);\n  margin-top: 0.55em;\n}`);

  // question (← frage): bold accent question, tighter to its answer.
  out.push(`.pw-question {\n  font-family: var(--pw-font-heading);\n  font-weight: 700;\n  color: var(--pw-accent);\n  text-indent: 0;\n  margin: 1em 0 0.3em;\n}`);

  // figurePanel (← bildtafel): photo + framed note, side-by-side, stacks narrow.
  out.push(`.pw-figure-panel {\n  display: grid;\n  grid-template-columns: 1.45fr 1fr;\n  gap: 1.1em;\n  align-items: start;\n  margin: 1.4em 0;\n}`);
  out.push(`.pw-fp-media { margin: 0; }`);
  out.push(`.pw-fp-caption {\n  font-size: 0.8em;\n  font-style: italic;\n  color: var(--pw-muted);\n  margin-top: 0.45em;\n}`);
  out.push(`.pw-fp-note {\n  border: 1px solid color-mix(in srgb, var(--pw-muted) 35%, transparent);\n  padding: 0.9em 1em;\n  font-size: 0.9em;\n}`);
  out.push(`.pw-fp-note > :first-child { margin-top: 0; }`);
  out.push(`.pw-fp-note > :last-child { margin-bottom: 0; }`);
  out.push(`.pw-fp-title {\n  font-family: var(--pw-font-heading);\n  font-weight: 700;\n  font-size: 0.8em;\n  letter-spacing: 0.1em;\n  text-transform: uppercase;\n  color: var(--pw-accent);\n  margin: 0 0 0.5em;\n}`);
  out.push(`@media (max-width: 38rem) {\n  .pw-article .pw-figure-panel { grid-template-columns: 1fr; }\n}`);

  // marginNote (← randnotiz): the editorial margin column. Mobile-first it is a
  // quiet inline block; on wide screens it floats out into the OUTER margin
  // (negative margin into the centered measure's whitespace) — the web analogue
  // of the magazine's wide outer margin where the notes live.
  out.push(`.pw-margin-note {\n  display: block;\n  margin: 0.7em 0;\n  padding-top: 0.35em;\n  border-top: 1px solid var(--pw-accent);\n  font-size: 0.82em;\n  line-height: 1.45;\n  color: var(--pw-muted);\n  text-indent: 0;\n  text-align: start;\n}`);
  out.push(`@media (min-width: 72rem) {\n  .pw-article .pw-margin-note {\n    float: right;\n    clear: right;\n    width: 12rem;\n    margin: 0.1em 0 0.8em 0;\n    margin-right: -14rem;\n  }\n}`);

  // interlude (← interlude()): a quiet centered divider (≠ the full-width hr).
  out.push(`.pw-interlude {\n  border: none;\n  border-top: 1px solid var(--pw-accent);\n  width: 1.4em;\n  margin: 2em auto;\n}`);

  // columns (← #columns): multicol, collapsing to one column on narrow screens.
  out.push(`.pw-columns {\n  column-count: var(--pw-cols, 2);\n  column-gap: var(--pw-gap, 1.5em);\n}`);
  out.push(`.pw-columns > * { break-inside: avoid-column; }`);
  out.push(`@media (max-width: 40rem) {\n  .pw-article .pw-columns { column-count: 1; }\n}`);

  // grid (← generic #grid two-up, §7.4): a side-by-side cell layout that stacks
  // to a single column on narrow screens (content-complete, not pixel-faithful).
  out.push(`.pw-grid {\n  display: grid;\n  grid-template-columns: repeat(var(--pw-grid-cols, 2), 1fr);\n  gap: 1.4em;\n  align-items: start;\n  margin: 1.4em 0;\n}`);
  out.push(`.pw-grid-cell > :first-child { margin-top: 0; }`);
  out.push(`@media (max-width: 44rem) {\n  .pw-article .pw-grid { grid-template-columns: 1fr; }\n}`);

  // --- academic content (Phase D: figures / math / footnotes / bibliography) ---

  // numbered figure + table (← #figure(...) / #figure(table(...))).
  out.push(`.pw-figure, .pw-table-figure { margin: 1.6em 0; text-align: center; }`);
  out.push(`.pw-fig-label { font-weight: 700; color: ${cvar('text')}; }`);
  out.push(`.pw-credit {\n  font-style: normal;\n  color: ${cvar('muted')};\n}`);

  // display math (← `$ … $` rendered to inline SVG by the Typst pre-pass).
  out.push(`.pw-math {\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  gap: 1.2em;\n  margin: 1.3em 0;\n  text-indent: 0;\n}`);
  out.push(`.pw-math-svg { display: inline-flex; }`);
  out.push(`.pw-math-svg svg { max-width: 100%; height: auto; }`);
  out.push(`.pw-math-tex {\n  font-family: var(--pw-font-code);\n  font-style: italic;\n  white-space: pre-wrap;\n}`);
  out.push(`.pw-eqno { color: ${cvar('muted')}; font-variant-numeric: tabular-nums; }`);

  // in-text footnote reference + the endnotes section.
  out.push(`.pw-fn { line-height: 0; }`);
  out.push(`.pw-fn a { text-decoration: none; }`);
  out.push(`.pw-cite-missing { color: ${cvar('muted')}; }`);
  out.push(`.pw-footnotes {\n  margin-top: 2.5em;\n  font-size: 0.85em;\n  color: ${cvar('muted')};\n}`);
  out.push(`.pw-footnotes-rule {\n  border: none;\n  border-top: 1px solid color-mix(in srgb, var(--pw-muted) 40%, transparent);\n  width: 8em;\n  margin: 0 0 1em;\n}`);
  out.push(`.pw-footnotes ol { padding-inline-start: 1.4em; }`);
  out.push(`.pw-footnotes li { margin: 0.3em 0; }`);
  out.push(`.pw-fn-back { text-decoration: none; margin-inline-start: 0.3em; }`);

  // bibliography / references section.
  out.push(`.pw-bibliography { margin-top: 2.5em; }`);
  out.push(`.pw-bibliography-title { font-family: var(--pw-font-heading); }`);
  out.push(`.pw-bib-entry {\n  padding-inline-start: 1.6em;\n  text-indent: -1.6em;\n  margin: 0 0 0.6em;\n  font-size: 0.92em;\n}`);
  out.push(`.pw-bib-link { word-break: break-word; }`);

  // --- print-only HERO reinterpretation (Phase E: cover / aufmacher / spread) --
  // The visually dominant magazine pieces, translated to web heroes (full-width
  // image + opener text / a centered title page) — never a literal print spread.
  out.push(`.pw-hero { margin: 0 0 2.4em; }`);
  out.push(`.pw-hero-img {\n  display: block;\n  width: 100%;\n  height: auto;\n  border-radius: 2px;\n}`);
  out.push(`.pw-hero-media { margin: 0; }`);
  out.push(`.pw-hero-credit {\n  font-size: 0.76em;\n  color: var(--pw-muted);\n  text-align: end;\n  text-indent: 0;\n  margin: 0.5em 0 0;\n}`);
  out.push(`.pw-hero-aufmacher .pw-hero-text { margin-top: 1.5em; }`);
  out.push(`.pw-hero-title {\n  font-family: var(--pw-font-heading);\n  text-indent: 0;\n  margin: 0.15em 0;\n}`);
  out.push(`.pw-hero-line {\n  text-indent: 0;\n  text-align: inherit;\n  margin: 0.35em 0;\n  line-height: 1.25;\n}`);
  out.push(`.pw-hero-spread-title { font-style: italic; color: var(--pw-text); }`);
  // cover / title page: centered, set apart with a rule.
  out.push(`.pw-cover {\n  text-align: center;\n  margin: 0 0 3em;\n  padding-bottom: 2em;\n  border-bottom: 1px solid color-mix(in srgb, var(--pw-muted) 45%, transparent);\n}`);
  out.push(`.pw-cover .pw-hero-line { text-align: center; margin: 0.5em auto; }`);
  out.push(`.pw-cover .pw-hero-title { text-align: center; }`);
  out.push(`.pw-cover .pw-grid { justify-items: center; margin-top: 1.6em; font-size: 0.85em; }`);

  // --- mini-site: issue table of contents + per-article navigation ----------
  out.push(`.pw-toc { margin: 2.5em 0 0; text-align: start; }`);
  out.push(`.pw-toc-list { list-style: none; padding: 0; margin: 0; }`);
  out.push(`.pw-toc-item { border-top: 1px solid color-mix(in srgb, var(--pw-muted) 35%, transparent); }`);
  out.push(`.pw-toc-item:last-child { border-bottom: 1px solid color-mix(in srgb, var(--pw-muted) 35%, transparent); }`);
  out.push(`.pw-toc-item a {\n  display: block;\n  padding: 0.85em 0;\n  text-decoration: none;\n  color: var(--pw-text);\n}`);
  out.push(`.pw-toc-kicker {\n  display: block;\n  font-family: var(--pw-font-heading);\n  font-size: 0.72em;\n  letter-spacing: 0.18em;\n  text-transform: uppercase;\n  color: var(--pw-accent);\n}`);
  out.push(`.pw-toc-title {\n  display: block;\n  font-family: var(--pw-font-heading);\n  font-size: 1.3em;\n  line-height: 1.2;\n  margin-top: 0.12em;\n}`);
  out.push(`.pw-toc-byline {\n  display: block;\n  font-size: 0.82em;\n  color: var(--pw-muted);\n  margin-top: 0.2em;\n}`);
  out.push(`.pw-toc-item a:hover .pw-toc-title { color: var(--pw-accent); }`);

  out.push(`.pw-nav {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 1em 1.5em;\n  align-items: baseline;\n  font-size: 0.85em;\n  text-indent: 0;\n}`);
  out.push(`.pw-nav:first-child {\n  margin: 0 0 2.5em;\n  padding-bottom: 0.7em;\n  border-bottom: 1px solid color-mix(in srgb, var(--pw-muted) 30%, transparent);\n}`);
  out.push(`.pw-nav:last-child {\n  margin: 3em 0 0;\n  padding-top: 1em;\n  border-top: 1px solid color-mix(in srgb, var(--pw-muted) 30%, transparent);\n}`);
  out.push(`.pw-nav a { text-decoration: none; color: var(--pw-accent); }`);
  out.push(`.pw-nav-up { font-family: var(--pw-font-heading); font-weight: 600; }`);
  out.push(`.pw-nav-prev { margin-inline-start: auto; }`);
  out.push(`.pw-nav-next { text-align: end; }`);
  out.push(`.pw-nav-dir { color: var(--pw-muted); }`);

  // --- scope every rule under .pw-article ----------------------------------
  return scopeRules(out, opts.scope ?? 'prefix');
}

/**
 * Scopes every rule to `.pw-article`. In 'prefix' mode (the universal floor)
 * each selector in a rule's (possibly comma-separated) selector list is
 * prefixed, so `th, td { … }` → `.pw-article th, .pw-article td { … }` (no
 * `td` leaking globally); the bare `{ … }` root block → `.pw-article { … }`.
 * In 'scope' mode the rules are emitted as-is inside `@scope (.pw-article)`,
 * which scopes the bare selectors itself (Baseline-Newly-Available — opt-in).
 */
function scopeRules(rules: string[], mode: 'prefix' | 'scope'): string {
  if (mode === 'scope') return `@scope (.pw-article) {\n${rules.join('\n')}\n}`;
  return rules.map(prefixRule).join('\n');
}

function prefixRule(rule: string): string {
  // At-rules (e.g. @supports) carry their own already-scoped inner selectors.
  if (rule.trimStart().startsWith('@')) return rule;
  const braceIdx = rule.indexOf('{');
  const selector = rule.slice(0, braceIdx).trim();
  const body = rule.slice(braceIdx);
  if (selector === '') return `.pw-article ${body}`; // root declarations block
  // Split on TOP-LEVEL commas only, so a comma inside :is(a, b) / [x="a,b"] /
  // a quoted string isn't mistaken for a selector-list separator.
  const scoped = splitTopLevel(selector).map((s) => `.pw-article ${s.trim()}`).join(', ');
  return `${scoped} ${body}`;
}

/** Splits a selector on commas that sit outside (), [], and quotes. */
function splitTopLevel(selector: string): string[] {
  const parts: string[] = [];
  let depth = 0, quote = '', start = 0;
  for (let i = 0; i < selector.length; i++) {
    const ch = selector[i];
    if (quote) { if (ch === quote) quote = ''; continue; }
    if (ch === '"' || ch === "'") quote = ch;
    else if (ch === '(' || ch === '[') depth++;
    else if (ch === ')' || ch === ']') depth--;
    else if (ch === ',' && depth === 0) { parts.push(selector.slice(start, i)); start = i + 1; }
  }
  parts.push(selector.slice(start));
  return parts;
}
