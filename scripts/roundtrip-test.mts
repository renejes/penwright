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

console.log(`\n──────────\n${pass} passed, ${fail} failed\n`);
process.exit(fail > 0 ? 1 : 0);
