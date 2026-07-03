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

// ─── Generic title-page macro calls (`#cover(title: …, subtitle: …)`) ───────

/** Built-in / known macro names that must NEVER be mistaken for a cover call. */
const NOT_A_COVER = /^(figure|table|image|text|grid|block|align|box|quote|cite|link|footnote|heading|page|columns|bibliography|outline|set|show|let|import|include|stack|place|pad|rect|line|circle|square|v|h)$/;

/** Named args whose values are title-page content, in display order. */
const COVER_ARG_KEYS = ['title', 'subtitle', 'claim', 'tagline', 'author', 'byline', 'date', 'meta'] as const;

/** Reads a named arg's value from an arg list: `key: [content]` or `key: "str"`. */
function namedContent(args: string, key: string): string | undefined {
  const re = new RegExp(`(?:^|[,(\\s])${key}\\s*:\\s*`);
  const m = re.exec(args);
  if (!m) return undefined;
  const at = m.index + m[0].length;
  if (args[at] === '[') { const b = matchBracket(args, at, '[', ']'); return b ? b.inner.trim() : undefined; }
  const s = args.slice(at).match(/^"((?:[^"\\]|\\.)*)"/);
  return s ? s[1].replace(/\\"/g, '"') : undefined;
}

/**
 * Recognises a hand-written TITLE-PAGE macro call — `#cover(title: […], …)`,
 * `#titelseite(…)`, any `#<name>(… title: …)` whose definition we can't see —
 * and synthesizes a hero body from its content args, so the document title
 * survives to the web instead of the whole call being skipped as config.
 * Fires only when the block IS the call (no trailing content) and the args
 * carry a `title:` — a figure caption's `title:` can't reach here (excluded
 * by name), prose never parses as a single call.
 */
export function parseCoverCall(content: string): { body: string; title?: string } | null {
  const t = stripLeadingNoise(content);
  const nameM = t.match(/^#([a-zA-Z][\w-]*)/);
  if (!nameM || NOT_A_COVER.test(nameM[1])) return null;
  const looksLikeCoverName = /cover|titel|title/i.test(nameM[1]);
  const c = readCall(t, nameM[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (!c || c.body !== undefined) return null; // body-carrying macros are handled elsewhere
  const title = namedContent(c.args, 'title');
  if (!title || (!looksLikeCoverName && !namedContent(c.args, 'subtitle') && !namedContent(c.args, 'claim'))) return null;
  const lines: string[] = [`#heading(level: 1)[${title}]`];
  for (const key of COVER_ARG_KEYS) {
    if (key === 'title') continue;
    const v = namedContent(c.args, key);
    if (v) lines.push(v);
  }
  return { body: lines.join('\n\n'), title: title.replace(/\\\s*/g, ' ').replace(/\s+/g, ' ').trim() };
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
  // A hand-written title-page macro call (`#cover(title: …, subtitle: …)`) —
  // without this the whole call is skipped and the document TITLE vanishes.
  const cover = parseCoverCall(content);
  if (cover) return { kind: 'cover', body: cover.body };
  return null;
}
