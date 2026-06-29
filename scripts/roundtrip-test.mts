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

console.log(`\n──────────\n${pass} passed, ${fail} failed\n`);
process.exit(fail > 0 ? 1 : 0);
