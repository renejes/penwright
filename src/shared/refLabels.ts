/**
 * Reference-label vocabulary — the SINGLE source for deciding whether an
 * `@name` is a cross-reference (label) or a bib citation, and for mapping a
 * label to its coarse type. Consumed by the editor deserializer, the DOCX and
 * HTML serializers, and the project-labels scanner; the rule used to exist as
 * three already-divergent copies (a Set with exact-match semantics in the
 * editor vs. a `\b`-boundary regex with fewer prefixes in the exports —
 * `fig-intro` was a citation in the editor but a reference in Word/HTML).
 *
 * Pure: no fs / electron / imports — safe for every bundle (renderer, main,
 * MCP binary).
 */

export const REFERENCE_PREFIXES = new Set([
  'fig', 'figure',
  'tbl', 'table', 'tab',
  'eq', 'eqn', 'equation',
  'sec', 'section',
  'chap', 'chapter',
  'app', 'appendix',
  'thm', 'theorem',
  'lem', 'lemma',
  'def', 'definition',
  'cor', 'corollary',
  'prop', 'proposition',
  'algo', 'alg', 'algorithm',
  'lst', 'listing',
]);

/**
 * Heuristic: does this `@name` look like a Typst label (cross-reference)
 * rather than a bib citekey? Citekeys are conventionally bare slugs like
 * `chen2021codex`; labels are typically prefixed with `fig:`, `tbl:`,
 * `sec:` etc. Anything containing a colon or exactly matching a known label
 * word is treated as a reference. (Exact match, not prefix-boundary — a
 * citekey like `fig-etal2020` stays a citation.)
 */
export function isReferenceLabel(name: string): boolean {
  const colonIdx = name.indexOf(':');
  if (colonIdx > 0) return true;
  return REFERENCE_PREFIXES.has(name.toLowerCase());
}

export type RefLabelType = 'figure' | 'table' | 'equation' | 'heading' | 'other';

/** Maps a label name to a coarse type used for icons / picker grouping. */
export function refTypeFromLabel(name: string): RefLabelType {
  const colonIdx = name.indexOf(':');
  const prefix = (colonIdx > 0 ? name.slice(0, colonIdx) : name).toLowerCase();
  if (prefix === 'fig' || prefix === 'figure') return 'figure';
  if (prefix === 'tbl' || prefix === 'table' || prefix === 'tab') return 'table';
  if (prefix === 'eq' || prefix === 'eqn' || prefix === 'equation') return 'equation';
  if (prefix === 'sec' || prefix === 'section' || prefix === 'chap' || prefix === 'chapter') return 'heading';
  return 'other';
}
