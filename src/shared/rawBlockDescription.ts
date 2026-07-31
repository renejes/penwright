/**
 * What IS this raw block? — one human sentence for every one of them.
 *
 * The editor used to label every block it could not place with the same word,
 * "typst": a page setup, a vertical spacer, an imported stylesheet and a
 * paragraph of prose all looked identical, and the only way to tell them apart
 * was to read the code. That is the opposite of what this app is for.
 *
 * A form cannot fix that — measured over 1337 real blocks, 79 % hold nothing a
 * form could edit (462 comments, 184 imports/settings, 408 that are not one
 * whole call), and of the rest the largest group is `#v(0.4em)`, pure spacing,
 * where a field is strictly worse than the line it replaces. A NAME can fix it,
 * and reaches all of them.
 *
 * The vocabulary is taken from what the corpus actually contains, in order of
 * frequency, not from what Typst offers:
 *   462 comment · 184 config · 60 #v · 30 #grid · 21 #text · 13 #block
 *    11 #align · 9 #figure · 6 #table · 3 #colbreak · 2 #wrap-content
 *
 * Pure and i18n-free by construction: it returns a KIND, and the caller renders
 * it in the user's language. A shared module cannot reach the rune store, and a
 * label baked in English here would be a label nobody could translate.
 */

import { parseMacroCall } from './macroCall';

export type RawBlockKind =
  | 'include'
  | 'comment'
  | 'math'
  | 'import'
  | 'setting'
  | 'rule'
  | 'pageSetup'
  | 'binding'
  | 'spacing'
  | 'pagebreak'
  | 'colbreak'
  | 'line'
  | 'call'
  | 'text'
  | 'code';

export interface RawBlockDescription {
  kind: RawBlockKind;
  /** For `spacing`: the amount, verbatim (`0.4em`). For `call`: the name. */
  detail?: string;
}

/** The call at the head of the block, or null when it does not open with one. */
function headName(content: string): string | null {
  const m = content.trimStart().match(/^#([\p{L}_][\p{L}\p{N}_-]*)/u);
  return m ? m[1] : null;
}

/** Every line stripped of comments, so "what else is in here" can be asked. */
function withoutComments(content: string): string {
  return content
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split('\n')
    .map(l => {
      const i = l.indexOf('//');
      return i === -1 ? l : l.slice(0, i);
    })
    .join('\n');
}

/**
 * A block that is EXACTLY one `#v(…)` and nothing else — the 60-instance case
 * that dominates the noise in a real document. Returns the amount so the editor
 * can show a gap instead of a box.
 *
 * "Exactly" is meant strictly, because the gap view HIDES everything else. A
 * `#v(1em)` carrying an inline block comment with the author's note about
 * raising it later was accepted, the gap swallowed the note, and the first edit
 * deleted it. So a block containing a comment of any kind is not a bare spacer,
 * and what remains must be a single `#v(<one positional>)` and nothing more.
 */
export function bareSpacer(content: string): string | null {
  if (content !== withoutComments(content)) return null;   // a comment is content
  const parsed = parseMacroCall(content);
  if (!parsed || parsed.name !== 'v') return null;
  if (parsed.bodyStart !== null) return null;
  if (parsed.args.length !== 1 || parsed.args[0].name !== null) return null;
  const amount = parsed.args[0].raw.trim();
  return amount === '' ? null : amount;
}

/**
 * Describes a raw block in one word the reader can act on.
 *
 * Read off the WHOLE block, not its first token. A block is usually a compound —
 * `#pagebreak()` followed by an `#include`, a `//` comment introducing a `#let`,
 * a `#v()` in front of a paragraph of prose — and naming it after whatever comes
 * first was wrong for about a third of the corpus. Worse, it was wrong in the
 * dangerous direction: a block labelled "page break" that actually carries a
 * chapter include invites a deletion that removes the chapter.
 *
 * So the order below is by CONSEQUENCE, not by position: what would the reader
 * most regret not knowing about this block?
 */
export function describeRawBlock(content: string, blockType: string): RawBlockDescription {
  if (blockType === 'math') return { kind: 'math' };

  const bare = withoutComments(content);
  const code = bare.trim();

  // Nothing but comments — the only case where "note to self" is the whole truth.
  if (code === '') return { kind: 'comment' };

  // The two that carry the document's structure, wherever they sit in the block.
  if (/(^|\n)\s*#include\b/.test(bare)) return { kind: 'include' };
  if (/(^|\n)\s*#let\b/.test(bare)) return { kind: 'binding' };

  // The deserializer already decided this one carries prose the reader sees
  // (`classifyRawBlock`), and that beats naming it after a leading `#v()`.
  if (blockType === 'text') return { kind: 'text' };

  const first = code.split('\n')[0];
  if (/^#import\b/.test(first)) return { kind: 'import' };
  if (/^#set\b/.test(first)) return { kind: 'setting' };
  if (/^#show\b/.test(first)) return { kind: 'rule' };
  if (/^#page\b/.test(first)) return { kind: 'pageSetup' };

  const spacer = bareSpacer(content);
  if (spacer !== null) return { kind: 'spacing', detail: spacer };

  // Only a block that is exactly ONE call may be named after it. A compound —
  // `#v(0.6em) #text[…]` — is named after its head otherwise, which pointed the
  // reader at the spacer and not at the paragraph.
  const parsed = parseMacroCall(content);
  if (parsed) {
    if (parsed.name === 'pagebreak') return { kind: 'pagebreak' };
    if (parsed.name === 'colbreak') return { kind: 'colbreak' };
    if (parsed.name === 'line') return { kind: 'line' };
    return { kind: 'call', detail: parsed.name };
  }

  // A term list (`/ Begriff: Erklärung`) is body copy kept verbatim, not code.
  if (/(^|\n)\s*\/\s+\S/.test(bare)) return { kind: 'text' };
  // No `#` at all outside comments — prose the splitter could not place.
  if (!/#/.test(bare)) return { kind: 'text' };
  if (headName(content) === null) return { kind: 'text' };

  return { kind: 'code' };
}
