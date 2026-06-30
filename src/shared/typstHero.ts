// Print-only HERO constructs → web reinterpretation (Phase E, export-only).
//
// The load-bearing *visual* magazine pieces are hand-written page-layout macros
// that have no AST node (turning them into nodes would re-emit a normalised form
// and break compile-stability — same reasoning as typstGrid.ts). They stay
// verbatim `typstRawBlock`s in the editor + PDF; this pure parser reinterprets
// them FOR EXPORT ONLY, so the web view shows a full-width hero / title page
// instead of dropping the construct (a `#page[…]` cover) or leaking it as prose
// (an `#aufmacher(…)` comment-led block).
//
//   • #aufmacher(path, breite?, credit?)[<opener>]  → hero image + opener text
//   • #doppelseite(path, title?, credit?)           → full-width spread image
//   • #page(…)[<title-page text>]                   → a title/cover hero
//
// "Translate, don't copy" (web-export-feasibility-and-plan.md §Phase E): a print
// double-page spread becomes ONE full-width responsive hero — never a literal
// two-page / `#place` layout.

import { matchBracket } from './exportContext';

export type HeroSpec =
  | { kind: 'aufmacher'; image?: string; credit?: string; body: string }
  | { kind: 'spread'; image?: string; title?: string; credit?: string }
  | { kind: 'cover'; body: string };

/** Strips leading full-line `//` comments + `#import`/`#set` preamble lines so a
 *  comment- or import-led block (the LANGSAM `#aufmacher` sits behind a `//`
 *  note) still exposes the construct that follows. */
function stripLeadingNoise(content: string): string {
  const lines = content.split('\n');
  let i = 0;
  while (i < lines.length) {
    const t = lines[i].trim();
    if (t === '' || t.startsWith('//') || /^#(import|set)\b/.test(t)) { i++; continue; }
    break;
  }
  return lines.slice(i).join('\n').trim();
}

/** First positional string arg + a named string arg, from a `(...)` arg list. */
function firstString(args: string): string | undefined {
  const m = args.match(/^\s*"((?:[^"\\]|\\.)*)"/);
  return m ? m[1].replace(/\\"/g, '"') : undefined;
}
function namedString(args: string, key: string): string | undefined {
  const m = args.match(new RegExp(`${key}\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`));
  return m ? m[1].replace(/\\"/g, '"') : undefined;
}

/** Reads `#name(args)?[body]?` at the start of `t`. */
function readCall(t: string, name: string): { args: string; body?: string } | null {
  const m = t.match(new RegExp(`^#${name}\\b\\s*`));
  if (!m) return null;
  let j = m[0].length;
  let args = '';
  if (t[j] === '(') { const a = matchBracket(t, j, '(', ')'); if (!a) return null; args = a.inner; j = a.end; }
  while (/\s/.test(t[j] ?? '')) j++;
  let body: string | undefined;
  if (t[j] === '[') { const b = matchBracket(t, j, '[', ']'); if (b) body = b.inner; }
  return { args, body };
}

/**
 * Recognises a print-only hero construct in a raw block (after stripping a
 * leading comment/import preamble). Returns null for everything else.
 */
export function parseHero(content: string): HeroSpec | null {
  const t = stripLeadingNoise(content);

  if (/^#aufmacher\b/.test(t)) {
    const c = readCall(t, 'aufmacher');
    if (c) return { kind: 'aufmacher', image: firstString(c.args), credit: namedString(c.args, 'credit'), body: c.body ?? '' };
  }
  if (/^#doppelseite\b/.test(t)) {
    const c = readCall(t, 'doppelseite');
    if (c) return { kind: 'spread', image: firstString(c.args), title: namedString(c.args, 'title'), credit: namedString(c.args, 'credit') };
  }
  // A top-level `#page(…)[…]` is a manual page-layout override — on the web the
  // only thing that survives is its visible text, so treat it as a title hero.
  if (/^#page\b/.test(t)) {
    const c = readCall(t, 'page');
    if (c && c.body !== undefined && c.body.trim()) return { kind: 'cover', body: c.body };
  }
  return null;
}
