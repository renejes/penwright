/**
 * The shape of a project's own building block, and the call that inserts one.
 *
 * Shared because BOTH processes need it and they must not drift: the main
 * process scans the definitions (`src/main/projectMacros.ts`), the renderer
 * inserts them from the slash menu and the ＋ dropdown, and the MCP server
 * offers them to the agent. Two copies of "how do I write this call" would
 * disagree the first time a signature has a surprise in it — which is the
 * failure this repo already paid for elsewhere, hence the shared-planner rule
 * in CLAUDE.md.
 *
 * Pure: no fs, no Electron. Everything that touches disk stays in main.
 */

export interface MacroParam {
  name: string;
  /** Verbatim Typst default (`""`, `4pt`, `none`). null for a positional param. */
  defaultValue: string | null;
  /** Takes a file path — the UI must offer a picker, not a text field. */
  isPath: boolean;
}

export interface ProjectMacro {
  name: string;
  params: MacroParam[];
  /** The positional parameter that receives a trailing `[…]` content block. */
  bodyParam: string | null;
  /** The `//` comment directly above the definition, or ''. */
  label: string;
  filePath: string;
  relPath: string;
  line: number;
  /**
   * True when this macro's own body contains the `image()` / `read()` /
   * `bibliography()` call that will consume a path argument.
   *
   * Load-bearing for `assetPlaceholder` and for the file picker: Typst resolves
   * a path relative to the file where that CALL is written, so when the answer
   * is yes, `filePath` is provably the right base. When it is no, the macro only
   * passes the value on and the real base may be a third file — the form says so
   * rather than writing a confident wrong path. Optional because a payload built
   * before this existed (or by a caller that cannot scan the body) must still
   * type-check; absent means "not established", not "no".
   */
  resolvesPathsHere?: boolean;
}

export interface ProjectMacroResults {
  macros: ProjectMacro[];
  truncated: boolean;
}

/**
 * Which positional parameter receives a trailing `[…]` content block.
 *
 * Read off 36 real call sites across five projects rather than guessed, because
 * the obvious rule is wrong: it is NOT "the last positional". `#note(body,
 * title: "…")` is called `#note(title: "…")[…]` — the body is the FIRST
 * parameter. What holds in every observed case is that the content goes to the
 * parameter NAMED for it, and the other positionals take strings:
 * `#modul("2.1", "Fachartikel")[…]`, `#summe("Stufe 1", "1.500 €")`, and
 * `#stat(value, label)` takes no body at all.
 */
export const BODY_PARAM = /^(body|content|inhalt|text|koerper|körper|children)$/i;

/**
 * A parameter that names a file rather than a word.
 *
 * `#aufmacher(path, …)` passes its argument straight to `image()`, so a word
 * placeholder is not a placeholder — it is a compile error ("file not found").
 * Found by compiling every generated call against the real corpus, which is the
 * only reason it is here. `designElements.isPathParam` is the same idea for the
 * shipped elements; this vocabulary is wider because these names are the
 * project author's, not ours.
 */
export const PATH_PARAM = /^(path|pfad|src|datei|file|bild|image|img|foto|photo)([A-Z0-9_-].*)?$/i;

/**
 * The placeholder path for a `path` parameter — reached from the DEFINING file.
 *
 * Typst resolves a path relative to the file where the `image()` call is
 * literally written, NOT relative to the file the call is written into. Proven
 * against the bundled 0.15.1: with `#let bildnachweis(b) = image(b)` in
 * `macros.typ` and the call in `chapters/c2.typ`, the value `"assets/x.png"`
 * compiles and `"../assets/x.png"` dies with
 *
 *     error: path "../assets/x.png" would escape the project root
 *       ┌─ macros.typ:1:32          ← the error points at the DEFINITION
 *
 * so a placeholder computed from the call site is a broken document, not a
 * cosmetic slip. Assets live at `<projectDir>/assets/` (one rule, see
 * `shared/assetPlacement.ts`), so the climb out of the definition's own folder
 * is all this needs.
 *
 * String arithmetic on a POSIX `relPath`, deliberately not `node:path` — this
 * module is dependency-free because it also runs in the renderer bundle.
 * A root-level `macros.typ` yields exactly the previous literal, which is what
 * keeps all 22 path macros in the corpus byte-identical.
 */
export function assetPlaceholder(relPath: string, asset = 'assets/bild.jpg'): string {
  // The MCP hands `buildMacroCall` a macro with `filePath` stripped off; if a
  // caller ever drops `relPath` too, a thrown `.split` would take a tool answer
  // down with it. Falling back to the root-level form is the old behaviour.
  if (!relPath) return asset;
  const depth = relPath.split('/').filter(s => s && s !== '.').length - 1;
  return depth > 0 ? '../'.repeat(depth) + asset : asset;
}

/**
 * The Typst call to insert for a macro — the shape its own signature asks for.
 *
 * Named parameters are omitted: they have defaults, and emitting them all would
 * hand a non-Typst user a wall of `credit: none, breite: 44%` to delete. The
 * body parameter becomes a trailing `[…]` because that is how every call site in
 * the corpus writes it; the remaining positionals become quoted placeholders.
 *
 * `values` fills parameters the caller does want set — verbatim Typst, so a
 * string argument arrives already quoted. `bodyPlaceholder` is passed in rather
 * than hardcoded so the renderer can localise it.
 */
export function buildMacroCall(
  macro: ProjectMacro,
  values: Record<string, string> = {},
  bodyPlaceholder = 'Inhalt',
): string {
  const args: string[] = [];
  for (const p of macro.params) {
    if (p.name === macro.bodyParam) continue;
    if (p.defaultValue === null) {
      const v = values[p.name];
      args.push(
        v !== undefined
          ? v
          : p.isPath
            ? `"${assetPlaceholder(macro.relPath)}"`
            : `"${p.name}"`,
      );
    } else if (values[p.name] !== undefined) {
      args.push(`${p.name}: ${values[p.name]}`);
    }
  }
  if (!macro.bodyParam) return `#${macro.name}(${args.join(', ')})`;
  const call = args.length ? `#${macro.name}(${args.join(', ')})` : `#${macro.name}`;
  return `${call}[\n  ${values[macro.bodyParam] ?? bodyPlaceholder}\n]`;
}

/** A one-line signature for a menu row: `#modul(nr, titel)[…]`. */
export function macroSignature(macro: ProjectMacro): string {
  const args = macro.params
    .filter(p => p.name !== macro.bodyParam)
    .map(p => (p.defaultValue === null ? p.name : `${p.name}: …`));
  return `#${macro.name}${args.length ? `(${args.join(', ')})` : ''}${macro.bodyParam ? '[…]' : '()'}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Taking a call APART — the other half of building one.
//
// It lives in this file on purpose. A parser that reads `#note(title: "x")[…]`
// and a builder that writes it are one contract; in two files they drift, and
// the drift shows up as a user's argument quietly moving to the wrong slot.
//
// Everything below works in OFFSET RANGES into the original text and never
// regenerates the call. "Offset" is meant literally: these are JS string indices
// (UTF-16 code units), the same units `slice` takes, NOT UTF-8 byte offsets —
// the corpus is German, so the two differ on almost every real call and mixing
// them would corrupt every argument after the first umlaut. Nothing here ever
// converts between the two; the ranges go straight back into `slice`.
//
// The design: an edit replaces one span and
// every other byte survives — the author's line breaks, their trailing commas,
// their comments inside the argument list, and above all the values nobody
// touched. `#datetime.today()` in an argument must still be `#datetime.today()`
// afterwards, not the day it was edited (CLAUDE.md, the round-trip rule).
//
// Shapes measured over 506 real call sites before any of this was written:
//   170  bare `#name[body]`, no parentheses at all   ← the most common by far
//    88  multi-line argument lists
//    72  `#name(args)[body]`
//    41  a content block `[…]` AS an argument value (`caption: [Eine …]`)
//    38  trailing comma before the `)`
//    26  a string containing brackets, parens or `#`
//    17  an array of content blocks (`("Titel", ([a], [b]))`)
// ─────────────────────────────────────────────────────────────────────────────

/** How an argument's value is written, which decides how a form may edit it. */
export type ArgKind = 'string' | 'content' | 'expr';

export interface MacroArg {
  /** Named argument's name, or null when positional. */
  name: string | null;
  /** Offset range of the whole argument, `name: value` included. For deletion. */
  fullStart: number;
  fullEnd: number;
  /** Offset range of the VALUE. For replacement. */
  start: number;
  end: number;
  /** The value verbatim, delimiters included. */
  raw: string;
  kind: ArgKind;
  /**
   * Offset range of the value's TEXT, without its `"` or `[]`. A form edits this;
   * for an `expr` it equals the value range, and such a field is advanced-only
   * because its content is code, not prose.
   */
  innerStart: number;
  innerEnd: number;
}

export interface ParsedMacroCall {
  name: string;
  /** Offset range of the whole call inside the block. */
  start: number;
  end: number;
  args: MacroArg[];
  /** Offset range of the argument list's inside, or null when there are no parens. */
  argListStart: number | null;
  argListEnd: number | null;
  /** Offset range of the trailing `[…]` body's inside, or null. */
  bodyStart: number | null;
  bodyEnd: number | null;
}

const IDENT = /^[\p{L}_][\p{L}\p{N}_-]*/u;

/**
 * Typst's two modes, again — the same asymmetry the block splitter tracks, and
 * for the same reason. Inside a `[…]` content block we are in MARKUP, where only
 * `[` and `]` group: a `(` is a parenthesis and a `"` is a quotation mark. Inside
 * `(…)` or `{…}` we are in CODE, where all six group and `"` opens a string.
 *
 * Counting delimiters uniformly is the bug this codebase has now paid for three
 * times. Here it surfaced the moment the form wrote an ordinary sentence into a
 * body — `#note[Ein neuer Wert (mit Klammer]` was declared unparseable, so the
 * form locked itself out of the block it had just edited. Caught by running the
 * form over the real corpus rather than over fixtures.
 */
const isMarkupFrame = (frame: string | undefined): boolean => frame === '[';

/**
 * Skips a comment starting at `i`; returns the index to continue from, or -1
 * when it never closes, or null when this is not a comment at all.
 *
 * `//` IS a comment in markup as well as in code — measured, because it decides
 * whether a body parses: `#g[A // B]` fails to compile with "unclosed
 * delimiter", the comment having eaten the closing `]`.
 *
 * The exemption is exactly `http://` and `https://`, and nothing else. Also
 * measured, one scheme at a time: `ftp://`, `mailto://` and a bare `://` are all
 * comments, matching Typst's auto-link detection. Without the exemption a bare
 * URL in a caption swallows the rest of the argument list, and one client
 * chapter is full of them.
 */
function skipComment(text: string, i: number, limit: number, markup: boolean): number | -1 | null {
  if (text[i] !== '/') return null;
  if (text[i + 1] === '/') {
    if (markup && (text.startsWith('https:', i - 6) || text.startsWith('http:', i - 5))) return null;
    const nl = text.indexOf('\n', i);
    return nl === -1 || nl > limit ? -1 : nl;
  }
  if (text[i + 1] === '*') {
    const close = text.indexOf('*/', i + 2);
    return close === -1 || close > limit ? -1 : close + 1;
  }
  return null;
}

/**
 * Walks from an opening delimiter to its match, mode-aware, skipping strings and
 * comments. Returns the index OF the closer, or -1 when it never closes — a
 * half-typed call, where the honest answer is "no form", not a guess.
 */
function matchDelim(text: string, open: number): number {
  const stack: string[] = [text[open]];
  let inStr = false;
  for (let i = open + 1; i < text.length; i++) {
    const c = text[i];
    const markup = isMarkupFrame(stack[stack.length - 1]);

    if (inStr) {
      if (c === '\\') i++;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '\\') { i++; continue; }          // `\[` in markup, `\"` in code
    // A comment is a comment in both modes.
    const afterComment = skipComment(text, i, text.length, markup);
    if (afterComment === -1) return -1;
    if (afterComment !== null) { i = afterComment; continue; }
    if (!markup && c === '"') { inStr = true; continue; }

    if (c === '[') { stack.push('['); continue; }
    if (c === ']') {
      if (!markup) return -1;                    // a `]` closing a `(` is broken
      stack.pop();
      if (!stack.length) return i;
      continue;
    }
    if (markup) continue;                        // `(` `)` `{` `}` are literal here
    if (c === '(' || c === '{') { stack.push(c); continue; }
    if (c === ')' || c === '}') {
      const want = c === ')' ? '(' : '{';
      if (stack[stack.length - 1] !== want) return -1;
      stack.pop();
      if (!stack.length) return i;
    }
  }
  return -1;
}

/**
 * Tightens a range so it excludes leading and trailing whitespace AND comments.
 *
 * A comment is not part of the value. Leaving it inside the argument's range put
 * `// Nummer und Titel` in front of `"2.1"` in the form field, and replacing that
 * field wrote the comment away and produced `error: expected comma`. Keeping it
 * in the gap BETWEEN arguments means a splice never touches it — which is the
 * whole promise of editing by range.
 */
function tightenRange(text: string, from: number, to: number): { start: number; end: number } {
  let s = from;
  let e = to;
  for (;;) {
    while (s < e && /\s/.test(text[s])) s++;
    if (text[s] === '/' && text[s + 1] === '/') {
      const nl = text.indexOf('\n', s);
      s = nl === -1 || nl > e ? e : nl;
      continue;
    }
    if (text[s] === '/' && text[s + 1] === '*') {
      const close = text.indexOf('*/', s + 2);
      s = close === -1 || close + 2 > e ? e : close + 2;
      continue;
    }
    break;
  }
  // Trailing comments, of both kinds — `pfad /* der Pfad */` is as real as
  // `nr, // die Nummer`, and only trimming the line kind left the block kind
  // inside the value, where it matched no identifier and cost a parameter.
  for (;;) {
    while (e > s && /\s/.test(text[e - 1])) e--;
    if (e - 2 >= s && text.startsWith('*/', e - 2)) {
      const open = text.lastIndexOf('/*', e - 2);
      if (open >= s) { e = open; continue; }
    }
    const lastNl = text.lastIndexOf('\n', e);
    const from = lastNl >= s ? lastNl : s;
    const slash = text.indexOf('//', from);
    if (slash !== -1 && slash >= s && slash < e) { e = slash; continue; }
    break;
  }
  return { start: s, end: Math.max(s, e) };
}

/**
 * Splits an argument list on TOP-LEVEL commas, returning ranges into `text`.
 *
 * Starts in CODE mode — it is called with the inside of a `(…)`. A nested `[…]`
 * switches to markup, so a comma or paren inside a caption cannot split the
 * list: `caption: [Kosten (ca. 30%), gerundet]` is one argument.
 */
function splitArgs(text: string, from: number, to: number): { start: number; end: number }[] {
  const parts: { start: number; end: number }[] = [];
  const stack: string[] = [];
  let inStr = false;
  let start = from;
  for (let i = from; i < to; i++) {
    const c = text[i];
    const markup = isMarkupFrame(stack[stack.length - 1]);

    if (inStr) {
      if (c === '\\') i++;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '\\') { i++; continue; }
    const afterComment = skipComment(text, i, to, markup);
    if (afterComment === -1) { i = to; continue; }
    if (afterComment !== null) { i = afterComment; continue; }
    if (!markup && c === '"') { inStr = true; continue; }

    if (c === '[') { stack.push('['); continue; }
    if (c === ']') { if (markup) stack.pop(); continue; }
    if (markup) continue;
    if (c === '(' || c === '{') { stack.push(c); continue; }
    if (c === ')' || c === '}') { stack.pop(); continue; }
    if (c === ',' && stack.length === 0) { parts.push({ start, end: i }); start = i + 1; }
  }
  parts.push({ start, end: to });
  // A trailing comma leaves an empty last part — 38 call sites have one.
  return parts.filter(p => text.slice(p.start, p.end).trim() !== '');
}

function classify(raw: string): ArgKind {
  if (raw.startsWith('"') && raw.endsWith('"') && raw.length >= 2) return 'string';
  if (raw.startsWith('[') && raw.endsWith(']')) return 'content';
  return 'expr';
}

/**
 * Reads one macro call out of a raw block.
 *
 * Returns null — meaning "show the raw textarea, not a form" — whenever the
 * block is anything other than exactly one call: leading prose, a second call
 * after it, an unclosed delimiter. Being conservative here is the point. A form
 * that appears on a block it does not fully understand is a form that will
 * eventually splice into the wrong span, and this codebase has already paid for
 * that class of mistake in the deserializer twice.
 */
export function parseMacroCall(content: string): ParsedMacroCall | null {
  const lead = content.length - content.trimStart().length;
  const text = content;
  if (text[lead] !== '#') return null;

  const identMatch = text.slice(lead + 1).match(IDENT);
  if (!identMatch) return null;
  const name = identMatch[0];
  let cursor = lead + 1 + name.length;

  // A field access or method chain (`#datetime.today()`) is not a macro call we
  // can present as a form; its meaning is in the chain, not in arguments.
  if (text[cursor] === '.') return null;

  const args: MacroArg[] = [];
  let argListStart: number | null = null;
  let argListEnd: number | null = null;

  if (text[cursor] === '(') {
    const close = matchDelim(text, cursor);
    if (close === -1) return null;
    argListStart = cursor + 1;
    argListEnd = close;
    for (const part of splitArgs(text, argListStart, argListEnd)) {
      // Trim whitespace AND comments, keeping the real offsets.
      const tight = tightenRange(text, part.start, part.end);
      const s = tight.start;
      const e = tight.end;
      if (s >= e) continue;                  // the part held nothing but a comment

      let argName: string | null = null;
      let valueStart = s;
      const head = text.slice(s, e).match(IDENT);
      if (head) {
        // `name:` only counts when the colon follows the identifier directly —
        // `#stat("4:2", label)` must not be read as a named argument.
        let k = s + head[0].length;
        while (k < e && /\s/.test(text[k])) k++;
        if (text[k] === ':') {
          argName = head[0];
          k++;
          while (k < e && /\s/.test(text[k])) k++;
          valueStart = k;
        }
      }

      const raw = text.slice(valueStart, e);
      const kind = classify(raw);
      const inner = kind === 'expr'
        ? { start: valueStart, end: e }
        : { start: valueStart + 1, end: e - 1 };
      args.push({
        name: argName,
        fullStart: s,
        fullEnd: e,
        start: valueStart,
        end: e,
        raw,
        kind,
        innerStart: inner.start,
        innerEnd: inner.end,
      });
    }
    cursor = close + 1;
  }

  let bodyStart: number | null = null;
  let bodyEnd: number | null = null;
  if (text[cursor] === '[') {
    const close = matchDelim(text, cursor);
    if (close === -1) return null;
    bodyStart = cursor + 1;
    bodyEnd = close;
    cursor = close + 1;
  }

  // Nothing may follow. `#kicker[a] #kicker[b]` in one block, or a call with
  // prose after it, is not a single editable instance.
  if (text.slice(cursor).trim() !== '') return null;
  // `#name` alone, with neither parens nor a body, is a value reference.
  if (argListStart === null && bodyStart === null) return null;

  return { name, start: lead, end: cursor, args, argListStart, argListEnd, bodyStart, bodyEnd };
}

/** Replaces one offset range. Every other character of the call survives. */
export function spliceRange(content: string, start: number, end: number, value: string): string {
  return content.slice(0, start) + value + content.slice(end);
}

/**
 * The index of the delimiter matching the one at `open`, or -1 when it never
 * closes. Mode-aware and comment-aware, exported so nobody writes a fourth one.
 */
export function matchTypstDelim(text: string, open: number): number {
  return matchDelim(text, open);
}

/**
 * Splits a parenthesised Typst list literal — `(auto, 1fr, auto)` — into its
 * top-level elements, or null when `raw` is not one.
 *
 * The same mode-aware scanner as an argument list, because it is one: a table's
 * `columns:` tuple may hold `(auto, 1fr)`, and an `align:` tuple may hold
 * `(left + top, right + top)`. A trailing comma is normal and does not add an
 * element — except in the one-element form `(1fr,)`, where Typst requires it
 * and which is therefore a list of ONE, not of zero.
 */
export function splitTypstList(raw: string): { start: number; end: number }[] | null {
  const t = raw.trim();
  if (!t.startsWith('(') || !t.endsWith(')')) return null;
  if (matchDelim(t, 0) !== t.length - 1) return null;      // `(a)(b)` is not one list
  const offset = raw.indexOf('(');
  // Tightened, because every caller wants the VALUE, not the gap around it: a
  // `#let modul(nr, // die laufende Nummer\n titel, …)` otherwise handed back
  // `// die laufende Nummer\n  titel`, which matched no identifier and silently
  // dropped the parameter — and with it an argument from every call the
  // catalogue offered.
  return splitArgs(t, 1, t.length - 1)
    .map(p => tightenRange(t, p.start, p.end))
    .filter(p => p.end > p.start)
    .map(p => ({ start: p.start + offset, end: p.end + offset }));
}

/**
 * Is this parenthesised literal a DICTIONARY rather than an array?
 *
 * `(x: 8pt, y: 4pt)` and `(auto, 1fr)` are both "a paren with commas in it", and
 * telling them apart matters: a dictionary's entries are NOT positional, so
 * resizing one the way a per-column array is resized duplicates a key and Typst
 * refuses the document outright — `error: duplicate key: x`, verified against
 * 0.15.1. `inset:` and `stroke:` accept both forms, so this is not hypothetical.
 *
 * The signal is a bare `ident:` at the start of every top-level entry. A colon
 * inside a string (`("a:b", "c")`) or inside a nested call does not count,
 * because the entry does not START with an identifier followed by one.
 */
export function isTypstDictLiteral(raw: string): boolean {
  const parts = splitTypstList(raw);
  if (!parts || parts.length === 0) return false;
  return parts.every(p => /^[\p{L}_][\p{L}\p{N}_-]*\s*:/u.test(raw.slice(p.start, p.end).trim()));
}

/**
 * Reads the run of content blocks that begins at `from`: `[A][B][C]` → three.
 *
 * Adjacency is required, as everywhere else in Typst — `[A] [B]` is one block
 * followed by separate markup. Returns an empty array when `text[from]` is not
 * `[`, and null when a block never closes.
 */
export function extractAdjacentBlocks(
  text: string,
  from: number,
): { innerStart: number; innerEnd: number; end: number }[] | null {
  const out: { innerStart: number; innerEnd: number; end: number }[] = [];
  let i = from;
  while (text[i] === '[') {
    const close = matchDelim(text, i);
    if (close === -1) return null;
    out.push({ innerStart: i + 1, innerEnd: close, end: close + 1 });
    i = close + 1;
  }
  return out;
}

/**
 * Escapes text so it survives inside a `"…"` argument.
 */
export function escapeTypstString(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/**
 * The inverse of `escapeTypstString` — and it has to exist, because a form field
 * shows TEXT while the source holds an ESCAPED string.
 *
 * Without it `readMacroField` handed the field the raw slice `Er sagte \\"ja\\"`,
 * `writeMacroField` escaped that again on the way back, and every open-and-edit
 * cycle doubled every backslash: one round `\\\\"`, two rounds `\\\\\\\\"`, three
 * rounds unreadable. Read and write must be inverses or the field is a shredder.
 */
export function unescapeTypstString(text: string): string {
  return text.replace(/\\(["\\])/g, '$1');
}

/**
 * Escapes text so it survives inside a `[…]` content block.
 *
 * Only UNBALANCED brackets are escaped. Escaping every `[` would destroy the
 * nested content blocks and markup that real captions contain
 * (`caption: [Eine Stunde — #emph[scheinbar] nichts]`); escaping none would let
 * a single `]` typed into a form field terminate the argument early and take
 * the rest of the call with it. Balanced pairs are exactly what Typst itself
 * accepts, so they pass through.
 */
export function escapeTypstContent(text: string): string {
  const out = text.split('');
  const open: number[] = [];
  for (let i = 0; i < out.length; i++) {
    if (out[i] === '\\') { i++; continue; }
    if (out[i] === '[') open.push(i);
    else if (out[i] === ']') {
      if (open.length) open.pop();
      else out[i] = '\\]';
    }
  }
  for (const i of open) out[i] = '\\[';
  return out.join('');
}

/** Wraps a form field's plain text back into the form the argument had. */
export function encodeArgValue(kind: ArgKind, text: string): string {
  if (kind === 'string') return `"${escapeTypstString(text)}"`;
  if (kind === 'content') return `[${escapeTypstContent(text)}]`;
  return text;                                   // an expression is code; verbatim
}

/**
 * Sets a NAMED argument that may or may not already be present.
 *
 * Present → its value range is spliced. Absent → it is inserted before the
 * closing paren, or an argument list is created after the macro name. Passing
 * `null` removes the argument entirely, which is how a form field returns a
 * parameter to the default its `#let` declares.
 *
 * Returns the new content, or null when the call cannot take the edit.
 */
export function setNamedArg(
  content: string,
  parsed: ParsedMacroCall,
  argName: string,
  value: string | null,
): string | null {
  const existing = parsed.args.find(a => a.name === argName);

  if (existing) {
    if (value === null) {
      // Remove the argument AND one adjoining separator — including the space
      // after it, or `#note(title: "a", kind: "b")` loses the argument and keeps
      // the gap: `#note( kind: "b")`.
      let s = existing.fullStart;
      let e = existing.fullEnd;
      const after = content.slice(e).match(/^\s*,\s*/);
      if (after) e += after[0].length;
      else {
        const before = content.slice(0, s).match(/,\s*$/);
        if (before) s -= before[0].length;
      }
      return spliceRange(content, s, e, '');
    }
    return spliceRange(content, existing.start, existing.end, value);
  }

  if (value === null) return content;            // absent already — nothing to do

  if (parsed.argListStart !== null && parsed.argListEnd !== null) {
    // Insert after the LAST argument, not before the closing paren. On the
    // 38 multi-line lists that end with a trailing comma and a newline, inserting
    // at the paren puts the new argument on the closing line
    // (`  title: "A",\n sub: "B")`); after the last argument it lands where a
    // human would have typed it and the author's trailing comma and line break
    // both survive.
    const last = parsed.args[parsed.args.length - 1];
    if (!last) {
      return spliceRange(content, parsed.argListStart, parsed.argListStart, `${argName}: ${value}`);
    }
    return spliceRange(content, last.fullEnd, last.fullEnd, `, ${argName}: ${value}`);
  }

  // No argument list at all — the 170-call `#name[body]` shape. Create one.
  const at = parsed.start + 1 + parsed.name.length;
  return spliceRange(content, at, at, `(${argName}: ${value})`);
}

/** Sets a POSITIONAL argument by index, splicing its value range. */
export function setPositionalArg(
  content: string,
  parsed: ParsedMacroCall,
  index: number,
  value: string,
): string | null {
  const positionals = parsed.args.filter(a => a.name === null);
  const target = positionals[index];
  if (!target) return null;
  return spliceRange(content, target.start, target.end, value);
}

/** Replaces the trailing `[…]` body's text. */
export function setBody(content: string, parsed: ParsedMacroCall, text: string): string | null {
  if (parsed.bodyStart === null || parsed.bodyEnd === null) return null;
  return spliceRange(content, parsed.bodyStart, parsed.bodyEnd, escapeTypstContent(text));
}

// ─────────────────────────────────────────────────────────────────────────────
// The FORM over a call: which fields exist, what each shows, what an edit does.
//
// Pure and here rather than in the node view, so the test suite can drive the
// exact code the UI runs — against every real call site in the corpus, and
// through the compiler. A form whose logic only exists inside a TipTap node
// view is a form nothing can check.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Is this raw block one editable instance of a project building block?
 *
 * **This is the single, swappable recognition function** the handover's §3
 * "Bauprinzip" asks for: today a scanner over the block's own text, tomorrow a
 * CST query, and nothing else in the codebase needs to change when it is
 * swapped. Every surface that asks "does this get a form?" must come through
 * here rather than pattern-matching the content itself — the seven scattered
 * bracket scanners in `deserializer.ts` are what that alternative looks like
 * after a year.
 *
 * `macros` is the catalogue VISIBLE in the file being edited, not the whole
 * project: a macro the file cannot import could not compile here, so offering a
 * form for it would be offering an edit that breaks the document.
 */
export function findMacroForBlock(
  content: string,
  macros: ProjectMacro[],
): { macro: ProjectMacro; parsed: ParsedMacroCall } | null {
  const parsed = parseMacroCall(content);
  if (!parsed) return null;
  const macro = macros.find(m => m.name === parsed.name);
  return macro ? { macro, parsed } : null;
}

export interface MacroFormField {
  /** `pos:<n>` · `named:<name>` · `body`. Identifies a SPAN, never a value. */
  key: string;
  /** The parameter's own name, for the caller to label with. */
  paramName: string;
  kind: ArgKind;
  isPath: boolean;
  /** False when the call omits it and the `#let` default applies. */
  present: boolean;
  isBody: boolean;
}

/** Which shape a named parameter's value should take, read off its default. */
function kindOfDefault(defaultValue: string | null): ArgKind {
  if (defaultValue === null) return 'string';
  const d = defaultValue.trim();
  if (d.startsWith('"')) return 'string';
  if (d.startsWith('[')) return 'content';
  return 'expr';
}

/**
 * The fields for one call, in the order the macro declares them.
 *
 * A parameter the call does NOT currently pass still gets a field, empty,
 * meaning "the default from the `#let`". That is the difference between a form
 * over a call and a form over a signature: the user can discover a parameter
 * they never knew existed, which for an AI-invented block is the only way they
 * ever would.
 */
export function macroFormFields(macro: ProjectMacro, content: string): MacroFormField[] {
  const parsed = parseMacroCall(content);
  if (!parsed) return [];
  const out: MacroFormField[] = [];

  const positionals = parsed.args.filter(a => a.name === null);
  const declaredPositionals = macro.params.filter(p => p.defaultValue === null && p.name !== macro.bodyParam);
  positionals.forEach((arg, i) => {
    const declared = declaredPositionals[i];
    out.push({
      key: `pos:${i}`,
      paramName: declared?.name ?? String(i + 1),
      kind: declared?.isPath ? 'string' : arg.kind,
      isPath: declared?.isPath ?? false,
      present: true,
      isBody: false,
    });
  });

  for (const p of macro.params) {
    if (p.defaultValue === null) continue;                 // positional, above
    if (p.name === macro.bodyParam) continue;
    const present = parsed.args.find(a => a.name === p.name);
    out.push({
      key: `named:${p.name}`,
      paramName: p.name,
      // A path is ALWAYS a Typst string, whatever the default looks like. A
      // `bild: none` default made this an `expr` field, so the file picker wrote
      // `bild: assets/feature.png` unquoted and the whole document failed with
      // `unknown variable: assets` — with nothing on screen saying the button
      // had caused it.
      kind: p.isPath ? 'string' : (present ? present.kind : kindOfDefault(p.defaultValue)),
      isPath: p.isPath,
      present: Boolean(present),
      isBody: false,
    });
  }

  if (parsed.bodyStart !== null) {
    out.push({
      key: 'body',
      paramName: macro.bodyParam ?? 'body',
      kind: 'content',
      isPath: false,
      present: true,
      isBody: true,
    });
  }
  return out;
}

/** What a field should display, read straight out of the current content. */
export function readMacroField(content: string, key: string): string {
  const parsed = parseMacroCall(content);
  if (!parsed) return '';
  if (key === 'body') {
    return parsed.bodyStart === null ? '' : content.slice(parsed.bodyStart, parsed.bodyEnd as number);
  }
  const arg = key.startsWith('pos:')
    ? parsed.args.filter(a => a.name === null)[Number(key.slice(4))]
    : parsed.args.find(a => a.name === key.slice(6));
  if (!arg) return '';
  const text = content.slice(arg.innerStart, arg.innerEnd);
  // A string argument holds ESCAPED source; the field shows text. `content` and
  // `expr` need no counterpart — `escapeTypstContent` only ever touches an
  // unbalanced bracket and skips one that is already escaped, and an `expr`
  // field is code, shown and written verbatim.
  return arg.kind === 'string' ? unescapeTypstString(text) : text;
}

/**
 * Applies one field edit, or returns null when it cannot be applied — in which
 * case the caller must write NOTHING. Half-applying an edit would leave a call
 * the parser can no longer read, and the user with no way back to the form.
 *
 * Re-parses `content` every time on purpose: the previous edit moved every byte
 * range after it, so a cached range splices into the wrong span from the second
 * keystroke onward.
 */
export function writeMacroField(
  content: string,
  key: string,
  kind: ArgKind,
  text: string,
): string | null {
  const parsed = parseMacroCall(content);
  if (!parsed) return null;
  if (key === 'body') return setBody(content, parsed, text);
  if (key.startsWith('pos:')) {
    // A positional has no default to fall back to, so "empty" has no meaning for
    // an expression: writing it produced `#modul(, "Fachartikel")`, which Typst
    // refuses outright (`unexpected comma`). A string or a content block CAN be
    // empty — `""` and `[]` are both valid — so only the code case is refused.
    if (kind === 'expr' && text.trim() === '') return null;
    return setPositionalArg(content, parsed, Number(key.slice(4)), encodeArgValue(kind, text));
  }
  const name = key.slice(6);
  // Empty means "use the default the #let declares", which is a REMOVAL — not
  // an empty string, which would override the default with nothing.
  if (text.trim() === '') return setNamedArg(content, parsed, name, null);
  return setNamedArg(content, parsed, name, encodeArgValue(kind, text));
}
