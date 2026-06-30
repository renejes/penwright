/**
 * DOCX magazine-node test (Phase C keystone) — proves the magazine AST nodes
 * reach Word as real content, in particular that the silent `#columns` drop
 * (bug B1) is fixed: interview QUESTIONS nested in a two-column section now
 * survive (they used to be dropped → "answers without questions").
 *
 * Run: npx tsx scripts/docx-magazine-test.mts
 *
 * Serializes a magazine doc to .docx, unzips word/document.xml, and asserts the
 * expected text is present. No test runner; standalone (uses the system `unzip`).
 */
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { serializeDocx } from '../src/shared/docxSerializer.ts';
import { deserializeTypst } from '../src/editor/lib/deserializer.ts';

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean, extra?: unknown) {
  if (cond) { pass++; console.log('  ✓', name); }
  else { fail++; console.log('  ✗', name, extra !== undefined ? JSON.stringify(extra) : ''); }
}

const src = [
  '#opener(kicker: "Interview", title: "Die Leere ist kein Mangel", standfirst: "Henrike Sandberg über Muße.", byline: "Mara Lindqvist")',
  '#lead[Die Philosophin sitzt am Fenster.]',
  '// Kopf: links Kasten + erste Fragen, rechts das Porträt.',
  '#grid(',
  '  columns: (1fr, 0.78fr), column-gutter: 1.4em, align: top,',
  '  {',
  '    block(inset: (x: 1em, y: 0.85em), stroke: 0.6pt + style-colors.muted)[',
  '      #text(size: 0.74em, weight: "bold", fill: style-colors.accent)[#upper("Zur Person")]',
  '      #v(0.5em)',
  '      Henrike Sandberg, 61, lehrt Philosophie der Grid-Person.',
  '    ]',
  '',
  '    frage[Erste Gitterfrage im Kopf?]',
  '',
  '    [Antwort auf die erste Gitterfrage.]',
  '  },',
  '  {',
  '    image("assets/missing-portrait.png", width: 100%)',
  '    text(size: 0.8em, style: "italic")[Porträtlegende im Gitter.]',
  '    frage[Zweite Gitterfrage im Kopf?]',
  '    [Antwort auf die zweite Gitterfrage.]',
  '  },',
  ')',
  '#columns(2, gutter: 1.5em)[',
  '#frage[Frau Sandberg, Müßiggang gilt als Laster?]',
  '',
  'Weil wir zwei Dinge verwechseln. Faulheit ist Flucht.',
  '',
  '#frage[Sie berufen sich auf die Griechen?]',
  '',
  'Auf ihr schönstes Wort: scholē.',
  ']',
  '#pull(who: "Blaise Pascal")[Das ganze Unglück der Menschen.]',
  '#notiz(title: "Zur Person")[\nHenrike Sandberg, 61, lehrt Philosophie der Muße.\n]',
  '#bildtafel("assets/missing.png", caption: [Am Fenster.], title: "Das Netzwerk", [Es ist am aktivsten.])',
  '#interlude()',
  'Schluss.#randnotiz[Eine Randbemerkung.]',
].join('\n\n');

const main = async () => {
  console.log('\n── DOCX magazine nodes: serialize without throwing ──');
  const doc = deserializeTypst(src);
  // Sanity on the parse: the columns block must carry real question nodes.
  const cols = doc.content.find((n: any) => n.type === 'columns') as any;
  check('columns parsed with question children (B1 structure)',
    !!cols && cols.content.filter((c: any) => c.type === 'question').length === 2,
    cols?.content?.map((c: any) => c.type));

  let buf: Buffer | null = null;
  let threw = false;
  try {
    buf = await serializeDocx(doc as any, '/tmp');
  } catch (e) {
    threw = true;
    console.log('    threw:', (e as Error).message);
  }
  check('serializeDocx did not throw', !threw);
  check('produced a non-empty .docx buffer', !!buf && buf.length > 1000);

  if (buf) {
    const file = '/tmp/pw-magazine.docx';
    fs.writeFileSync(file, buf);
    const xml = execFileSync('unzip', ['-p', file, 'word/document.xml']).toString();

    console.log('\n── DOCX content checks (B1: nested macros survive) ──');
    check('opener title present', xml.includes('Die Leere ist kein Mangel'));
    check('opener kicker present', xml.includes('INTERVIEW'));
    check('opener byline present', xml.includes('Mara Lindqvist'));
    check('drop-cap prose present', xml.includes('Die Philosophin sitzt am Fenster'));
    // The B1 win: BOTH questions survive (were dropped before the keystone).
    check('B1: interview question #1 survives', xml.includes('Müßiggang gilt als Laster'));
    check('B1: interview question #2 survives', xml.includes('Sie berufen sich auf die Griechen'));
    check('column answer prose survives', xml.includes('Faulheit ist Flucht') && xml.includes('schönstes Wort'));
    check('pull-quote text present', xml.includes('Das ganze Unglück der Menschen'));
    check('pull-quote attribution present', xml.includes('Blaise Pascal'));
    check('callout title + body present', xml.includes('Zur Person') && xml.includes('lehrt Philosophie der Muße'));
    check('figure-panel caption + title + note present', xml.includes('Am Fenster') && xml.includes('DAS NETZWERK') && xml.includes('Es ist am aktivsten'));
    check('margin note rendered as a footnote ref', xml.includes('footnoteReference') || xml.includes('FootnoteRef'));
    // §7.4 generic #grid: the interview-head cells must survive in DOCX too.
    check('grid: "Zur Person" box survives', xml.includes('ZUR PERSON') && xml.includes('lehrt Philosophie der Grid-Person'));
    check('grid: both grid questions survive', xml.includes('Erste Gitterfrage') && xml.includes('Zweite Gitterfrage'));
    check('grid: both grid answers survive', xml.includes('erste Gitterfrage') && xml.includes('zweite Gitterfrage'));
    check('grid: portrait legend survives', xml.includes('Porträtlegende im Gitter'));
    console.log('    wrote', file, 'for inspection');
  }

  console.log(`\n──────────\n${pass} passed, ${fail} failed\n`);
  process.exit(fail > 0 ? 1 : 0);
};

main();
