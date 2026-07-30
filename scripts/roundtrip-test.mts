/**
 * Round-trip regression test for the Typst serializer/deserializer escaping.
 *
 * Run: npx tsx scripts/roundtrip-test.mts
 *
 * Guards the escaping fix (literal *, _, `, #, @, $, <, >, ~, [, ], \ in prose
 * must compile verbatim AND survive close/open) and the code-block newline fix.
 * There is no test runner configured; this is a standalone script.
 */
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { serializeTypst } from '../src/editor/lib/serializer.ts';
import { deserializeTypst } from '../src/editor/lib/deserializer.ts';
import { markdownToTypst } from '../src/shared/markdownImporter.ts';
import { DESIGN_ELEMENTS, renderDesignElement } from '../src/shared/designElements.ts';

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean, extra?: unknown) {
  if (cond) {
    pass++;
    console.log('  ✓', name);
  } else {
    fail++;
    console.log('  ✗', name, extra !== undefined ? JSON.stringify(extra) : '');
  }
}

const para = (content: any[]) => ({ type: 'doc', content: [{ type: 'paragraph', content }] });
const textNode = (text: string, marks?: any[]) =>
  marks ? { type: 'text', text, marks } : { type: 'text', text };

/** Collapse a parsed paragraph into a comparable [{text,marks}] array. */
function richOf(doc: any): { text: string; marks: string[] }[] {
  const pnodes = doc.content?.[0]?.content ?? [];
  const out: { text: string; marks: string[] }[] = [];
  for (const n of pnodes) {
    if (n.type !== 'text') {
      out.push({
        text: `<${n.type}:${n.attrs?.citekey ?? n.attrs?.label ?? n.attrs?.content ?? ''}>`,
        marks: [],
      });
      continue;
    }
    const marks = (n.marks ?? []).map((m: any) => m.type).sort();
    const prev = out[out.length - 1];
    if (prev && JSON.stringify(prev.marks) === JSON.stringify(marks)) prev.text += n.text;
    else out.push({ text: n.text, marks });
  }
  return out;
}
const plainText = (doc: any): string => richOf(doc).map((r) => r.text).join('');

console.log('\n── Test A: plain text with ALL specials round-trips to plain text ──');
{
  const T =
    'Use *bold* and _it_ and `tick` and #hash and @bar and 50$ and a<b>c and d~e and [x] and back\\slash and C# and price $5';
  const ser = serializeTypst(para([textNode(T)]));
  const de = deserializeTypst(ser);
  const rich = richOf(de);
  check('round-trips to identical text', plainText(de) === T, { got: plainText(de), want: T });
  check('stays a single plain run (no marks, no citation)', rich.length === 1 && rich[0].marks.length === 0, rich);
  check('did NOT become a raw block', de.content[0].type === 'paragraph', de.content[0].type);
}

console.log('\n── Test B: real markup still round-trips ──');
{
  const doc = para([
    textNode('plain '),
    textNode('boldX', [{ type: 'bold' }]),
    textNode(' '),
    textNode('italX', [{ type: 'italic' }]),
    textNode(' '),
    textNode('codeX', [{ type: 'code' }]),
    textNode(' end'),
  ]);
  const rich = richOf(deserializeTypst(serializeTypst(doc)));
  check('bold preserved', rich.some((r) => r.text === 'boldX' && r.marks.includes('bold')), rich);
  check('italic preserved', rich.some((r) => r.text === 'italX' && r.marks.includes('italic')), rich);
  check('code preserved', rich.some((r) => r.text === 'codeX' && r.marks.includes('code')), rich);
}

console.log('\n── Test C: bold text containing a literal asterisk ──');
{
  const rich = richOf(deserializeTypst(serializeTypst(para([textNode('a*b', [{ type: 'bold' }])]))));
  check('bold body is exactly "a*b"', rich.length === 1 && rich[0].text === 'a*b' && rich[0].marks.includes('bold'), rich);
}

console.log('\n── Test D: code mark with markup chars (in a sentence) stays literal ──');
{
  const doc = para([textNode('Use '), textNode('a*b_c', [{ type: 'code' }]), textNode(' now')]);
  const rich = richOf(deserializeTypst(serializeTypst(doc)));
  check('code body preserved', rich.some((r) => r.text === 'a*b_c' && r.marks.includes('code')), rich);
}

console.log('\n── Test E: paragraph starting with a block marker stays a paragraph ──');
{
  for (const T of ['- not a list', '= not a heading', '+ not enum', '1. not enum', '/ not a term']) {
    const de = deserializeTypst(serializeTypst(para([textNode(T)])));
    check(`"${T}" → paragraph + identical text`, de.content[0].type === 'paragraph' && plainText(de) === T, {
      got: plainText(de),
      type: de.content[0].type,
    });
  }
}

console.log('\n── Test F: literal $ and #word do NOT flip block to raw ──');
{
  const T = 'The price is $5 and the tag is #important to note.';
  const de = deserializeTypst(serializeTypst(para([textNode(T)])));
  check('stays paragraph (not raw block)', de.content[0].type === 'paragraph', de.content[0].type);
  check('text identical', plainText(de) === T, { got: plainText(de) });
}

console.log('\n── Test G: code block does not accumulate newlines ──');
{
  const cb = '```python\nprint("hi")\n```';
  const cs1 = serializeTypst(deserializeTypst(cb) as any);
  const cs2 = serializeTypst(deserializeTypst(cs1) as any);
  check('idempotent code block', cs1 === cs2 && cs1 === cb, { cb, cs1, cs2 });
}

console.log('\n── Test H: real sample chapters reach a fixed point (no accumulation) ──');
{
  const dir = fileURLToPath(new URL('../resources/sample-project/chapters', import.meta.url));
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.typ'))) {
    const src = fs.readFileSync(`${dir}/${f}`, 'utf8');
    const s1 = serializeTypst(deserializeTypst(src) as any);
    const s2 = serializeTypst(deserializeTypst(s1) as any);
    const s3 = serializeTypst(deserializeTypst(s2) as any);
    const rawCount = (doc: any) => doc.content.filter((n: any) => n.type === 'typstRawBlock').length;
    check(`${f}: fixed point after settling (s2===s3)`, s2 === s3, { len2: s2.length, len3: s3.length });
    check(`${f}: raw-block count stable`, rawCount(deserializeTypst(s1)) === rawCount(deserializeTypst(s2)));
  }
}

console.log('\n── Test I: heading labels round-trip unescaped (cross-refs survive) ──');
{
  // `= Title <sec:x>` must keep its label, not become `= Title \<sec:x\>`
  // (which would break the label and every @sec:x reference into it).
  const src = '= Design Showcase <sec:design-showcase>';
  const de = deserializeTypst(src);
  const h = de.content[0];
  check('heading parsed at level 1', h.type === 'heading' && h.attrs?.level === 1, h);
  check('label captured as attr', h.attrs?.label === 'sec:design-showcase', h.attrs);
  check('heading text excludes the label', plainText(de) === 'Design Showcase', plainText(de));
  check('re-serializes byte-identical (label NOT escaped)', serializeTypst(de as any) === src, {
    got: serializeTypst(de as any),
    want: src,
  });

  // Subheading label too.
  const src2 = '== Methods <sec:methods>';
  check('subheading label round-trips', serializeTypst(deserializeTypst(src2) as any) === src2, {
    got: serializeTypst(deserializeTypst(src2) as any),
    want: src2,
  });

  // A heading with NO label is unchanged.
  const src3 = '= Plain Heading';
  check('label-less heading unchanged', serializeTypst(deserializeTypst(src3) as any) === src3, {
    got: serializeTypst(deserializeTypst(src3) as any),
    want: src3,
  });

  // An escaped literal `\<x\>` at the end is NOT mistaken for a label.
  const src4 = '= Heading ending with \\<notalabel\\>';
  check('escaped <…> stays a literal (not a label)', serializeTypst(deserializeTypst(src4) as any) === src4, {
    got: serializeTypst(deserializeTypst(src4) as any),
    want: src4,
  });
}

console.log('\n── Test J: magazine macros → AST nodes round-trip (Phase C keystone) ──');
{
  const ser = (src: string) => serializeTypst(deserializeTypst(src) as any);
  const idempotent = (src: string) => {
    const s1 = ser(src);
    const s2 = ser(s1);
    return { ok: s1 === s2, s1, s2 };
  };
  const node0 = (src: string) => deserializeTypst(src).content[0] as any;

  // opener → articleHeader (single-line form is byte-identical to our emit).
  {
    const src = '#opener(kicker: "Reportage", title: "Der untätige Geist", standfirst: "Über die Stille.", byline: "Von Mara Lindqvist")';
    const n = node0(src);
    check('opener → articleHeader', n.type === 'articleHeader', n.type);
    check('opener attrs captured', n.attrs?.kicker === 'Reportage' && n.attrs?.title === 'Der untätige Geist' && n.attrs?.byline === 'Von Mara Lindqvist', n.attrs);
    check('opener byte-identical round-trip', ser(src) === src, { got: ser(src) });
  }
  // opener with only kicker+title (editorial form).
  {
    const src = '#opener(kicker: "Von der Redaktion", title: "Editorial")';
    check('short opener byte-identical', ser(src) === src, { got: ser(src) });
  }

  // lead → dropCap (editable inline content).
  {
    const src = '#lead[Wir haben verlernt, nichts zu tun.]';
    const n = node0(src);
    check('lead → dropCap with inline content', n.type === 'dropCap' && n.content?.[0]?.text === 'Wir haben verlernt, nichts zu tun.', n);
    check('lead byte-identical round-trip', ser(src) === src, { got: ser(src) });
  }

  // pull (with + without who) → pullQuote.
  {
    const a = '#pull(who: "Blaise Pascal")[Das ganze Unglück der Menschen.]';
    const na = node0(a);
    check('pull(who) → pullQuote + who attr', na.type === 'pullQuote' && na.attrs?.who === 'Blaise Pascal', na);
    check('pull(who) byte-identical', ser(a) === a, { got: ser(a) });
    const b = '#pull[Nicht das viele Tun erschöpft.]';
    check('pull (no who) byte-identical', ser(b) === b, { got: ser(b) });
  }

  // frage → question.
  {
    const src = '#frage[Frau Sandberg, Müßiggang gilt als Laster?]';
    const n = node0(src);
    check('frage → question', n.type === 'question', n.type);
    check('frage byte-identical', ser(src) === src, { got: ser(src) });
  }

  // notiz(title) with multi-paragraph + bold body → callout.
  {
    const src = '#notiz(title: "Drei Räume der Muße")[\n*Die Bank* — ein Ort.\n\n*Das Fenster* — der Ausblick.\n]';
    const n = node0(src);
    check('notiz → callout + title', n.type === 'callout' && n.attrs?.title === 'Drei Räume der Muße', n);
    check('notiz body = two paragraphs', n.content?.length === 2 && n.content[0].type === 'paragraph', n.content?.map((c: any) => c.type));
    check('notiz bold preserved in body', n.content?.[0]?.content?.some((r: any) => (r.marks ?? []).some((m: any) => m.type === 'bold')), n.content?.[0]);
    const r = idempotent(src);
    check('notiz idempotent round-trip', r.ok, { s1: r.s1, s2: r.s2 });
  }

  // bildtafel(path, caption, title, body) → figurePanel.
  {
    const src = '#bildtafel("assets/feature.png", caption: [Eine Stunde am Fenster.], title: "Das Ruhezustandsnetzwerk", [Es ist am aktivsten, wenn wir nichts vorhaben.])';
    const n = node0(src);
    check('bildtafel → figurePanel', n.type === 'figurePanel', n.type);
    check('bildtafel attrs', n.attrs?.path === 'assets/feature.png' && n.attrs?.caption === 'Eine Stunde am Fenster.' && n.attrs?.title === 'Das Ruhezustandsnetzwerk', n.attrs);
    check('bildtafel body parsed', n.content?.[0]?.type === 'paragraph', n.content);
    const r = idempotent(src);
    check('bildtafel idempotent round-trip', r.ok, { s1: r.s1, s2: r.s2 });
  }

  // #columns(n, gutter)[ #frage + prose ] → columns with REAL child nodes.
  // This is the B1 fix: nested questions survive as nodes (not dropped).
  {
    const src = '#columns(2, gutter: 1.5em)[\n#frage[Apropos Telefon?]\n\nDas Telefon ist eine Maschine.\n]';
    const n = node0(src);
    check('columns → columns node', n.type === 'columns' && n.attrs?.cols === 2 && n.attrs?.gutter === '1.5em', n.attrs);
    check('columns child[0] = question (B1 fix)', n.content?.[0]?.type === 'question', n.content?.map((c: any) => c.type));
    check('columns child[1] = paragraph', n.content?.[1]?.type === 'paragraph', n.content?.map((c: any) => c.type));
    const r = idempotent(src);
    check('columns idempotent round-trip', r.ok, { s1: r.s1, s2: r.s2 });
  }

  // interlude() → interlude.
  {
    const src = '#interlude()';
    check('interlude → interlude byte-identical', node0(src).type === 'interlude' && ser(src) === src, { got: ser(src) });
  }

  // randnotiz → marginNote (INLINE, mid-sentence — like footnote).
  {
    const src = 'Bei den Griechen war sie das höchste Gut.#randnotiz[Josef Pieper: Muße ist die Wurzel der Kultur.]';
    const n = node0(src);
    check('randnotiz stays a paragraph (inline)', n.type === 'paragraph', n.type);
    check('randnotiz → inline marginNote node', n.content?.some((c: any) => c.type === 'marginNote'), n.content?.map((c: any) => c.type));
    check('randnotiz byte-identical', ser(src) === src, { got: ser(src) });
  }

  // A composite chapter (opener + lead + prose + pull) reaches a fixed point.
  {
    const src = [
      '#opener(kicker: "Essay", title: "Lob des Müßiggangs")',
      '#lead[Der Müßiggang hat einen schlechten Ruf.]',
      'Es lohnt sich, dem Wort nachzugehen.',
      '#pull[Es gibt eine Klarheit, die nur kommt, wenn man aufhört.]',
      '#interlude()',
      'Also tun wir weniger.',
    ].join('\n\n');
    const r = idempotent(src);
    check('composite chapter idempotent', r.ok, { s1: r.s1, s2: r.s2 });
    const doc = deserializeTypst(ser(src));
    const types = doc.content.map((c: any) => c.type);
    check('composite has NO leftover raw blocks for macros', !types.includes('typstRawBlock'), types);
  }
}

console.log('\n── Test K: Typst forced line breaks (trailing \\) round-trip as hardBreaks ──');
{
  const ser = (src: string) => serializeTypst(deserializeTypst(src) as any);
  // A trailing `\` is a Typst linebreak; must survive as a hardBreak, not collapse.
  const src = 'Texte: Mara Lindqvist. \\\nIm Gespräch: Henrike Sandberg. \\\nGestaltung: Penwright.';
  const de = deserializeTypst(src);
  const p = de.content[0] as any;
  check('paragraph keeps 2 hardBreak nodes', p.type === 'paragraph' && p.content.filter((n: any) => n.type === 'hardBreak').length === 2, p.content?.map((c: any) => c.type));
  check('forced line breaks round-trip (idempotent)', ser(src) === ser(ser(src)), { s1: ser(src), s2: ser(ser(src)) });
  check('round-trip still contains the \\ linebreaks', /\\\n/.test(ser(src)), ser(src));
  // A literal escaped backslash at line end is NOT a linebreak.
  const lit = deserializeTypst('ends with a backslash \\\\\nnext line') as any;
  check('escaped \\\\ not treated as a linebreak', !(lit.content[0].content ?? []).some((n: any) => n.type === 'hardBreak'), lit.content[0].content?.map((c: any) => c.type));
}

console.log('\n── Test L: adversarial-review fixes (escaped brackets + nested arg values) ──');
{
  const ser = (src: string) => serializeTypst(deserializeTypst(src) as any);
  const idem = (src: string) => ser(src) === ser(ser(src));
  const node0 = (src: string) => deserializeTypst(src).content[0] as any;
  const inlineOf = (src: string, type: string) =>
    (node0(src).content ?? []).find((c: any) => c.type === type);

  // An escaped `\]` inside a footnote / margin-note body must survive (was
  // truncated before — extractInlineBrackets wasn't escape-aware).
  {
    const src = 'Text #footnote[see point \\] here] end.';
    check('footnote with escaped \\] keeps full body', inlineOf(src, 'footnote')?.attrs?.content === 'see point \\] here', inlineOf(src, 'footnote')?.attrs);
    check('footnote with escaped \\] idempotent', idem(src), { s1: ser(src) });
  }
  {
    const src = 'X #randnotiz[note \\] kept] Y.';
    check('marginNote with escaped \\] keeps full body', inlineOf(src, 'marginNote')?.attrs?.body === 'note \\] kept', inlineOf(src, 'marginNote')?.attrs);
  }
  // Balanced nested brackets in a raw body must NOT be over-skipped.
  {
    const src = 'A #footnote[has #emph[x] ok] B.';
    check('footnote balanced nested brackets intact', inlineOf(src, 'footnote')?.attrs?.content === 'has #emph[x] ok', inlineOf(src, 'footnote')?.attrs);
  }
  // A function-valued inline color (rgb/hsl) must not truncate at the comma
  // (extractArgAndBracket used a `[^,)]+` regex → `rgb(255` → broken Typst).
  {
    const src = 'A #text(fill: rgb(255, 0, 0))[red] B.';
    const tc = (node0(src).content ?? []).find((c: any) => (c.marks ?? []).some((m: any) => m.type === 'textColor'));
    const col = tc?.marks?.find((m: any) => m.type === 'textColor')?.attrs?.color;
    check('rgb() inline color preserved (no comma truncation)', col === 'rgb(255, 0, 0)', { col });
    check('rgb() inline color idempotent', idem(src), { s1: ser(src) });
  }
}

// ─── Typst characters that mean something (found in real client work) ───────
//
// Both of these were found in René's own client offers, in the rendered PDF —
// not by a test. They are the shape of bug that only shows up on real
// documents: the round trip stays plausible, compiles fine, and quietly
// changes what the reader sees.
{
  const ser = (src: string) => serializeTypst(deserializeTypst(src) as any).trim();

  // `~` in Typst is a NON-BREAKING SPACE, not a tilde. The serializer escaped
  // it to `\~`, which renders as a visible tilde: "Zahlbar bis 24.~August"
  // became "24.~August" in a client's payment terms.
  for (const src of [
    'Zahlbar bis 24.~August 2026.',
    'Ein Preis von 1.200~€ netto.',
    'Prof.~Dr.~Müller',
  ]) {
    check(`nbsp survives: ${src.slice(0, 28)}…`, ser(src) === src, { got: ser(src) });
  }

  // …and the inverse must still hold: an ESCAPED tilde is a real tilde and has
  // to stay escaped, or it would silently turn into a space.
  check('escaped tilde stays a tilde', ser('Ein \\~ Zeichen.') === 'Ein \\~ Zeichen.', { got: ser('Ein \\~ Zeichen.') });
  check('both in one line', ser('24.~August und \\~tilde') === '24.~August und \\~tilde', { got: ser('24.~August und \\~tilde') });

  // `#pagebreak(weak: true)` collapses when the page is already fresh;
  // `#pagebreak()` never does. Dropping `weak` turns a tidy break into a
  // forced one — potentially a blank page. `to: "even"` is how the
  // double-truck spread aligns to a left-hand page.
  for (const src of ['#pagebreak()', '#pagebreak(weak: true)', '#pagebreak(to: "even")']) {
    check(`pagebreak args survive: ${src}`, ser(src) === src, { got: ser(src) });
  }
  check(
    'pagebreak args survive between paragraphs',
    ser('Davor.\n\n#pagebreak(weak: true)\n\nDanach.') === 'Davor.\n\n#pagebreak(weak: true)\n\nDanach.',
    { got: ser('Davor.\n\n#pagebreak(weak: true)\n\nDanach.') },
  );
}

// ─── One stray delimiter must not swallow the rest of the file ──────────────
//
// The block splitter finds block boundaries by counting `{}` `[]` `()` and
// toggling on `$`, over every character of every line. It knew nothing about
// strings, comments, or which MODE it was in — and in Typst those delimiters
// only group in CODE mode, which `#` opens. In markup a paren is a paren.
//
// So one unclosed `(` in prose — a smiley — left the counter at depth 1 for the
// rest of the file, no blank line split anything again, and everything after it
// merged into a single paragraph:
//
//   Ein Smiley :-( im Text.        →  Ein Smiley :-( im Text. = Überschrift
//                                     Zweiter Absatz.
//   = Überschrift
//
//   Zweiter Absatz.
//
// The heading is not just moved, it is DESTROYED: mid-paragraph `=` is literal
// text to Typst, so it renders as an "=" in the body and never comes back. A `$`
// in a string did the same thing more quietly — the whole document became one
// uneditable raw block.
{
  const ser = (src: string) => serializeTypst(deserializeTypst(src) as any).trim();
  const types = (src: string) => ((deserializeTypst(src) as any).content ?? []).map((n: any) => n.type);
  const TAIL = '\n\n= Überschrift\n\nZweiter Absatz.';

  // …and the same must hold AFTER an inline macro on the line. `#` opens code
  // mode, but the macro's own brackets close again — everything after them is
  // markup once more. Leaving code mode on for the rest of the line meant
  // `Ein #emph[Wort] und dann (offen` swallowed the next heading exactly as the
  // no-macro case did, for `(`, `[` and `{` alike, and idempotently: the damage
  // survives every later save.
  for (const [name, head] of [
    ['( after #emph', 'Ein #emph[Wort] und dann (offen'],
    ['[ after #emph', 'Ein #emph[Wort] und dann [offen'],
    ['{ after #emph', 'Ein #emph[Wort] und dann {offen'],
    ['( after #footnote', 'Text #footnote[note] und (offen'],
    ['( after #link', 'Siehe #link("https://x.dev")[hier] und (offen'],
  ] as [string, string][]) {
    const src = head + TAIL;
    check(`${name}: the following heading survives`, types(src).includes('heading'), types(src));
  }

  for (const [name, head, expect] of [
    ['unclosed ( in prose (a smiley)', 'Ein Smiley :-( im Text.', undefined],
    ['unclosed ( in prose (a typo)', 'Der Wert (siehe unten', undefined],
    // A literal `[` in prose is escaped to `\[`, which Typst renders as `[` —
    // pre-existing, correct, and checked against the compiler. What matters here
    // is that the heading after it survives.
    ['unclosed [ in prose', 'Die Quelle [4 sagt etwas.', 'Die Quelle \\[4 sagt etwas.'],
    ['unclosed ( in a line comment', '// TODO: die ( hier noch aufräumen', undefined],
    ['unclosed [ in a string binding', '#let opener = "Kapitel ["', undefined],
    ['a $ inside a string', '#let s = "ein $ Zeichen"', undefined],
    ['a { in a line comment', '// vgl. { offen', undefined],
  ] as [string, string, string | undefined][]) {
    const src = head + TAIL;
    const want = (expect ?? head) + TAIL;
    check(`${name}: the following heading survives`, types(src).includes('heading'), types(src));
    check(`${name}: round-trips`, ser(src) === want, { got: ser(src) });
  }

  // …while the reason the counting exists must keep working: a blank line inside
  // a multi-line construct is not a block boundary.
  for (const [name, src] of [
    ['multi-line #footnote with a blank line', 'Text mit #footnote[\n\n  mehrzeilig\n] und weiter.\n\nZweiter Absatz.'],
    ['multi-line #figure with a blank line', '#figure(\n  rect(),\n\n  caption: [Eine Abbildung],\n)\n\nZweiter Absatz.'],
    ['display math with a blank line', '$ x = y\n\n  + z $\n\nZweiter Absatz.'],
  ] as [string, string][]) {
    check(`${name} stays one block`, types(src).length === 2, types(src));
  }
}

// ─── Comments: the scanner knew them, the classifier did not ────────────────
//
// `splitIntoBlocks` tracks line and block comments; `isRawBlock` only ever
// tested `line.trim().startsWith('//')`. The gap destroyed documents both ways:
//
//   /* eine Notiz */    fell through to prose, the escape pass escaped the `*`,
//                       and the SAVED DOCUMENT NO LONGER COMPILED — Typst says
//                       "unclosed delimiter". Original compiles, round trip
//                       does not; verified against the bundled binary.
//   Text // Kommentar   the `/` was escaped to `\/`, so the comment came back as
//                       VISIBLE TEXT in the PDF. Its natural host is a
//                       style.typ — which fileManager opens like any .typ.
//
// A comment now keeps its block verbatim. Measured cost on real documents: zero
// — the paragraph and raw-block counts over the 153 shipped files and 45 client
// files are byte-identical before and after.
{
  const ser = (src: string) => serializeTypst(deserializeTypst(src) as any).trim();
  const types = (src: string) => ((deserializeTypst(src) as any).content ?? []).map((n: any) => n.type);

  for (const [name, src] of [
    ['block comment in prose', '/* eine Notiz */\n\nEin Absatz.'],
    ['nested block comment', '/* a /* b */ c */\n\nEin Absatz.'],
    ['mid-line // comment', 'Text // ein Kommentar'],
  ] as [string, string][]) {
    check(`comment survives verbatim: ${name}`, ser(src) === src.trim(), { got: ser(src) });
    check(`…and is kept as a raw block: ${name}`, types(src)[0] === 'typstRawBlock', types(src));
  }

  // The exemption that keeps this from being its own bug: a URL contains `//`
  // and is NOT a comment. Demoting every paragraph with a link to a code block
  // would trade one defect for a worse one.
  for (const [name, src] of [
    ['prose with a URL', 'Siehe https://x.dev/a für Details.'],
    ['list item with a URL', '- Quelle — https://blog.example.com/x/'],
  ] as [string, string][]) {
    check(`URL is not mistaken for a comment: ${name}`, types(src)[0] !== 'typstRawBlock', types(src));
    check(`…and round-trips: ${name}`, ser(src) === src.trim(), { got: ser(src) });
  }
}

// ─── Constructs found only by running over real client documents ────────────
//
// The three below were invisible to 100-odd hand-written round-trips and to the
// shipped presets. They turned up the moment the corpus was pointed at
// ~/Desktop/Marketing — four live client documents, and the pixel gate put
// numbers on it: 19 of 47 pages of one Sichtbarkeitskonzept rendered
// differently after a single open-and-save.
{
  const ser = (src: string) => serializeTypst(deserializeTypst(src) as any).trim();
  const types = (src: string) => ((deserializeTypst(src) as any).content ?? []).map((n: any) => n.type);

  // 1. TERM LISTS. `/ term: definition` sets the term in bold beside its
  //    definition. There is no term node in the schema, so the block fell
  //    through to the paragraph path and the serializer escaped the marker to
  //    `\/ ` — a literal slash, and the term formatting gone. Kept verbatim now.
  const terms = '/ Gutes Bildmaterial.: Der wichtigste Rohstoff.\n/ Zweiter Begriff: Und dessen Erklärung.';
  check('term list survives', ser(terms) === terms, { got: ser(terms) });
  check('term list is not claimed as prose', JSON.stringify(types(terms)) === JSON.stringify(['typstRawBlock']), types(terms));

  // 2. A BARE URL IS A LINK. Typst auto-detects `http(s)://…` in markup and
  //    renders it clickable — and styled, if the project has a `show link:`
  //    rule, which these documents do. Escaping the `//` (needed elsewhere,
  //    because `//` really does start a comment) broke the detection, so every
  //    URL in a research appendix lost its colour, its underline AND its link
  //    annotation. Verified against the bundled compiler, both ways.
  for (const src of [
    'See https://buffer.com/resources/instagram-algorithms/ for details.',
    '- Later - rank signals - https://later.com/blog/how-instagram-algorithm-works/',
    'Ohne Slash: https://www.socialinsider.io/social-media-benchmarks/instagram',
  ]) {
    check(`bare URL survives unescaped: ${src.slice(0, 34)}…`, ser(src) === src, { got: ser(src) });
  }

  // …and the escape must still fire for a `//` the USER TYPED, or it becomes a
  // comment and the rest of the line vanishes from the PDF.
  //
  // Direction matters, and an earlier version of this check had it backwards: it
  // fed `Entweder und/oder // beides.` through the DESERIALIZER, where that `//`
  // is a comment in the source and escaping it makes it visible — enshrining the
  // very bug the comment handling above fixes. The escape belongs to the
  // TipTap→Typst direction, so build the node and serialize it.
  const typed = serializeTypst({
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Entweder und/oder // beides.' }] }],
  } as any).trim();
  check('a // typed by the user is escaped', typed === 'Entweder und/oder \\// beides.', { got: typed });
  check('…and comes back as the same literal text', ((deserializeTypst(typed) as any).content?.[0]?.content ?? []).map((n: any) => n.text).join('') === 'Entweder und/oder // beides.', {
    got: ((deserializeTypst(typed) as any).content?.[0]?.content ?? []).map((n: any) => n.text).join(''),
  });

  // 3. A `#text(…)` styling call followed directly by a list. The block splitter
  //    refused to split after any line starting with `#`, so the two merged and
  //    the call's font, size and weight were dropped on the way through.
  const labelled = '#text(font: body-font, size: 8.5pt, weight: 600, fill: olive)[ZENTRALE QUELLEN]\n- Mallorca Magazin\n- Zweite Quelle';
  check('#text label + attached list keeps all its args', ser(labelled) === labelled, { got: ser(labelled) });

  // The binding case the `#` guard was there for in the first place must still
  // hold: a leading `+` continuing an expression is the addition operator.
  const binding = '#let total = base\n  + extra\n#total';
  check('a #let continuation is still not a list', ser(binding) === binding, { got: ser(binding) });

  // Dropping the blanket run-final-slash escape means the BETWEEN-runs hazard is
  // now decided where the neighbour is visible. Both directions matter: `and/`
  // beside bold `or` really does fuse into `/*` and eat the rest of the
  // document, and `a/` beside plain `b` really does not need escaping.
  const runs = (content: any[]) => serializeTypst({ type: 'doc', content: [{ type: 'paragraph', content }] } as any).trim();
  const T = (text: string, mark?: string) => mark ? { type: 'text', text, marks: [{ type: mark }] } : { type: 'text', text };
  for (const [name, content, want] of [
    ['/ before bold fuses → escaped', [T('and/'), T('or', 'bold'), T(' rest')], 'and\\/*or* rest'],
    ['/ before another / → escaped', [T('a/'), T('/b')], 'a\\//b'],
    ['/ before italic cannot fuse → left alone', [T('and/'), T('or', 'italic')], 'and/_or_'],
    ['/ before a plain word → left alone', [T('a/'), T('b')], 'a/b'],
    ['/ at the very end → left alone', [T('see https://x.dev/y/')], 'see https://x.dev/y/'],
  ] as [string, any[], string][]) {
    check(name, runs(content) === want, { got: runs(content), want });
  }
}

// ─── A list that hugs the paragraph above it ────────────────────────────────
//
// In Typst a line beginning `- ` or `+ ` STARTS A LIST. It ends the paragraph
// above it whether or not a blank line separates them. The block splitter only
// split on blank lines, so the list lines were appended to the running
// paragraph and the whole thing came back as one run-on line:
//
//   There are three groups:        →  There are three groups: - Researchers
//   - Researchers                     - Authors - Anyone curious
//   - Authors
//   - Anyone curious
//
// An entire bullet list, gone, from source any user would call ordinary. Found
// by compiling the sample project rather than by reading its source: the text
// comparison called that file clean.
//
// The blank line is NOT decoration either — Typst renders an attached list
// tighter than a separated one (verified against the bundled compiler), so the
// list node carries whether it hugged, and the serializer re-emits that.
{
  const ser = (src: string) => serializeTypst(deserializeTypst(src) as any).trim();
  const types = (src: string) => ((deserializeTypst(src) as any).content ?? []).map((n: any) => n.type);

  const attached = 'There are three groups:\n- Researchers\n- Authors\n- Anyone curious';
  check('attached bullet list stays a list', JSON.stringify(types(attached)) === JSON.stringify(['paragraph', 'bulletList']), types(attached));
  check('attached bullet list round-trips byte-identically', ser(attached) === attached, { got: ser(attached) });

  const attachedEnum = 'The steps are:\n+ First\n+ Second';
  check('attached ordered list stays a list', JSON.stringify(types(attachedEnum)) === JSON.stringify(['paragraph', 'orderedList']), types(attachedEnum));
  check('attached ordered list round-trips byte-identically', ser(attachedEnum) === attachedEnum, { got: ser(attachedEnum) });

  // The separated form must keep its blank line — the two are different pages.
  const separated = 'There are three groups:\n\n- Researchers\n- Authors';
  check('separated list keeps its blank line', ser(separated) === separated, { got: ser(separated) });

  // The real line from the sample project: a `+` the author meant as "plus",
  // which Typst reads as an enum marker because it begins a line.
  const credit = 'A helper concatenates a caption using `sep`\n+ `label`. Defaults to `" — "`.';
  check('line-initial + is preserved as the enum Typst reads', ser(credit) === credit, { got: ser(credit) });

  // A `+` continuing a code expression is an OPERATOR, not a list marker. The
  // block is code and must stay verbatim.
  const codeCont = '#let total = base\n  + extra\n#total';
  check('a + continuing a #let expression is untouched', ser(codeCont) === codeCont, { got: ser(codeCont) });

  // Multi-line items and nesting must survive the new split. A wrapped item is
  // re-emitted on one line — a soft line break inside an item is a space to
  // Typst, so it renders identically (checked against the bundled compiler, not
  // assumed). The NESTING and the item count are what must not move.
  const nested = 'Intro:\n- first item\n  continued on the next line\n- second\n  - nested\n- third';
  check(
    'attached list with continuation + nesting round-trips',
    ser(nested) === 'Intro:\n- first item continued on the next line\n- second\n  - nested\n- third',
    { got: ser(nested) },
  );

  // Two lists in a row, only the first attached.
  const mixed = 'Alpha:\n- a\n\nBeta:\n- b';
  check('two attached lists in one document', ser(mixed) === mixed, { got: ser(mixed) });
}

// ─── A raw span whose content contains a backtick ───────────────────────────
//
// A Typst raw span is delimited by single backticks and has NO escape
// mechanism, so text containing a backtick cannot be written that way. The
// serializer wrote it anyway: the sample project's `#raw("\`code\`")` came back
// as ``code``, which Typst reads as an empty raw span + plain text + another
// empty one — the monospace and the backticks both gone from the page.
//
// It was also the corpus's only NON-IDEMPOTENT file: the second save escaped
// the wreckage and dragged the NEXT code span on the line into it
// (`elements.codeBlock` → `elements.codeBlock\`). A document that keeps
// drifting is the one that gets eaten over a week of editing.
{
  const ser = (src: string) => serializeTypst(deserializeTypst(src) as any).trim();
  const idem = (src: string) => ser(ser(src)) === ser(src);

  const withTicks = '#raw("`code`")';
  check('backticked raw span survives', ser(withTicks) === withTicks, { got: ser(withTicks) });
  check('backticked raw span is idempotent', idem(withTicks), { once: ser(withTicks), twice: ser(ser(withTicks)) });

  // The real line from resources/sample-project/chapters/07-design-showcase.typ:
  // the neighbouring plain raw span must come out untouched.
  const line = 'Inline #raw("`code`") looks like this: `let x = 42`.';
  check('neighbouring raw span not dragged in', ser(line) === line, { got: ser(line) });
  check('…and that line is idempotent', idem(line), { once: ser(line), twice: ser(ser(line)) });

  // The backtick-free form must NOT grow a #raw(…) wrapper — that would churn
  // every code span in every document.
  check('plain raw span keeps the short form', ser('a `b` c') === 'a `b` c', { got: ser('a `b` c') });
}

// ─── #align[…] bodies: what the WYSIWYG unwrap is allowed to claim ──────────
//
// `parseAlignedBlock` turns a title page into headings and paragraphs so the
// text is editable and reaches DOCX. That is right for the shapes it can
// re-emit — and destructive for everything else, because the discarded
// arguments never come back. Found on the shipped `book-*` title pages and the
// sample project:
//
//   #text(size: 54pt, fill: …, font: …)  →  `= Title`     size, colour, font gone
//   #v(0.5em)                            →  (nothing)     the spacer gone
//   center + horizon                     →  center        vertical centring gone
//   #datetime.today().display(…)         →  "7/30/2026"   a LIVE date frozen into
//                                                         a literal, in the wrong
//                                                         format, on first save
//
// The rule: a body the node graph cannot re-emit keeps the whole block
// verbatim (the `typstGrid` / `typstHero` pattern). Verbatim still exports —
// the DOCX and HTML serializers read design text out of raw blocks.
{
  const ser = (src: string) => serializeTypst(deserializeTypst(src) as any).trim();
  const verbatim = (name: string, src: string) =>
    check(`align body kept verbatim: ${name}`, ser(src) === src.trim(), { got: ser(src) });

  verbatim('styled title page (book-novel)', [
    '#align(center + horizon)[',
    '  #text(size: 28pt, weight: "bold")[Book Title]',
    '  #v(1em)',
    '  #text(size: 14pt)[Author Name]',
    ']',
  ].join('\n'));

  verbatim('themed title page (book-kids)', [
    '#align(center + horizon)[',
    '  #text(size: 54pt, weight: "bold", fill: style-colors.accent, font: style-fonts.heading)[The Big Adventure]',
    '  #v(0.5em)',
    '  #text(size: 1.5em, weight: "bold", fill: style-colors.primary)[A picture book · by You]',
    ']',
  ].join('\n'));

  verbatim('live date (sample project)', [
    '#align(center)[',
    '  vswrite Sample Project',
    '',
    '  #v(0.3em)',
    '',
    '  #datetime.today().display("[month repr:long] [day], [year]")',
    ']',
  ].join('\n'));

  verbatim('a bare #v spacer between two prose chunks', [
    '#align(center)[',
    '  Erste Zeile',
    '  #v(0.3em)',
    '  Zweite Zeile',
    ']',
  ].join('\n'));

  // A frozen date is the one loss that is not even deterministic — it depends
  // on the day the user pressed save. Assert the absence directly, so a future
  // "helpful" re-render of the date cannot pass by round-tripping.
  check(
    'live date is never rendered into the document',
    !/\d{1,4}[/.]\d{1,2}[/.]\d{1,4}/.test(ser('#align(center)[#datetime.today().display("[year]")]')),
    { got: ser('#align(center)[#datetime.today().display("[year]")]') },
  );

  // …and the shapes the unwrap DOES represent must keep working, or this fix
  // has just turned every centred line in the corpus into a code block.
  const wysiwyg = (name: string, src: string, wantType: string) => {
    const doc = deserializeTypst(src) as any;
    const type = doc.content?.[0]?.type;
    check(`align body stays WYSIWYG (${name}): ${wantType}`, type === wantType, { got: type });
    check(`align body round-trips (${name})`, ser(src) === src.trim(), { got: ser(src) });
  };
  wysiwyg('heading', '#align(center)[= Titel]', 'heading');
  wysiwyg('heading + vertical spec', '#align(center + horizon)[= Titel]', 'heading');
  wysiwyg('prose', '#align(center)[Ein zentrierter Satz.]', 'paragraph');
  wysiwyg('prose + vertical spec', '#align(center + horizon)[Ein Satz.]', 'paragraph');
  wysiwyg('image', '#align(center)[#image("a.png", width: 50%)]', 'image');

  // `weight: "bold"` is the ONE style arg a paragraph can give back, and it
  // comes back as `*…*`. Not byte-identical, but the same bytes out of Typst —
  // the documented compile-stable normalisation (plan §6.2).
  check(
    'bold-only span normalises to *…* and nothing else',
    ser('#align(center)[#text(weight: "bold")[Fett]]') === '#align(center)[*Fett*]',
    { got: ser('#align(center)[#text(weight: "bold")[Fett]]') },
  );
}


// ─── Typst 0.15: a backslash in a path is a HARD ERROR ──────────────────────
//
// "File paths (e.g. in imports or image function calls) may not contain
// backslashes anymore" — at PARSE time, whether or not the file exists, so the
// whole document stops compiling. Verified against both bundled binaries: 0.14.2
// resolves `images\chart.png` fine, 0.15.1 says "path must not contain a
// backslash". On Windows that path is what a Markdown file and a dropped asset
// actually look like, so this is new breakage rather than a latent bug.
{
  const md = markdownToTypst('![Chart](images\\chart.png)\n\nSee ![x](assets\\a.png) inline.');
  check('markdown import: block image path uses forward slashes', !/#image\("[^"]*\\\\/.test(md) && md.includes('#image("images/chart.png"'), { got: md.split('\n')[0] });
  check('markdown import: inline image path too', md.includes('#image("assets/a.png"'), { got: md });

  // A #link URL is NOT a path — Typst does not object, and rewriting it would
  // corrupt the target.
  const link = markdownToTypst('See [docs](https://x.dev/a\\b) here.');
  check('markdown import: a link URL keeps its backslash', link.includes('a\\b'), { got: link });

  // Every image param of every design element, including the ones a conditional
  // block pre-renders before the placeholder loop runs.
  let offenders: string[] = [];
  for (const el of DESIGN_ELEMENTS) {
    const params: Record<string, string> = {};
    for (const p of el.params) if (/^image([A-Z0-9].*)?$/.test(p.name)) params[p.name] = 'assets\\hero.jpg';
    if (Object.keys(params).length === 0) continue;
    const out = renderDesignElement(el, params);
    if (out.includes('assets\\hero.jpg')) offenders.push(el.id);
  }
  check('design elements: no image param emits a backslash path', offenders.length === 0, offenders);
}

console.log(`\n──────────\n${pass} passed, ${fail} failed\n`);
process.exit(fail > 0 ? 1 : 0);
