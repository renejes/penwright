/**
 * Smoke test for the HTML serializer (Phase A foundation of the web export).
 *
 * Run: npx tsx scripts/html-export-test.mts
 *
 * Proves @tiptap/static-renderer renders Penwright's JSON to self-contained
 * semantic HTML server-side (no DOM/jsdom/react) and that a real sample chapter
 * round-trips through deserialize → serializeHtml without throwing or leaking
 * raw macro source. There is no test runner configured; this is standalone.
 */
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { serializeHtml } from '../src/shared/htmlSerializer.ts';
import { deserializeTypst } from '../src/editor/lib/deserializer.ts';

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean, extra?: unknown) {
  if (cond) { pass++; console.log('  ✓', name); }
  else { fail++; console.log('  ✗', name, extra !== undefined ? JSON.stringify(extra) : ''); }
}

console.log('\n── Test 1: trivial doc → semantic HTML, server-side, no DOM ──');
{
  const doc = {
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 2, label: 'sec:intro' }, content: [{ type: 'text', text: 'Hello <there> & co' }] },
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'plain ' },
          { type: 'text', text: 'bold', marks: [{ type: 'bold' }] },
          { type: 'text', text: ' & ' },
          { type: 'text', text: 'code()', marks: [{ type: 'code' }] },
          { type: 'text', text: ' then ' },
          { type: 'citation', attrs: { citekey: 'smith2021' } },
        ],
      },
      { type: 'image', attrs: { src: 'assets/fig.png' } },
    ],
  };
  const html = serializeHtml(doc as any, { slug: 'demo' });
  check('wrapped in <article class="pw-article" data-article="demo">', html.includes('<article class="pw-article" data-article="demo">'));
  check('inlines a scoped <style> block', html.includes('<style>'));
  check('heading label → id (in-page cross-ref target)', html.includes('<h2 id="sec:intro">'));
  check('heading text HTML-escaped', html.includes('Hello &lt;there&gt; &amp; co'));
  check('bold mark → <strong>', html.includes('<strong>bold</strong>'));
  check('code mark → <code>', html.includes('<code>code()</code>'));
  check('citation atom rendered', html.includes('class="pw-cite"') && html.includes('smith2021'));
  check('image atom → <img>', html.includes('<img src="assets/fig.png"'));
  check('no raw "<there>" leaked unescaped', !html.includes('<there>'));
}

console.log('\n── Test 2: a real sample chapter renders without throwing / leaking ──');
{
  const file = fileURLToPath(new URL('../resources/sample-project/chapters/01-introduction.typ', import.meta.url));
  const src = fs.readFileSync(file, 'utf8');
  let html = '';
  let threw = false;
  try { html = serializeHtml(deserializeTypst(src) as any, { slug: 'introduction' }); }
  catch (e) { threw = true; console.log('    threw:', (e as Error).message); }
  check('serializeHtml did not throw', !threw);
  check('produced a non-trivial article', html.length > 200);
  check('no unmapped-node leaked', !html.includes('pw:unhandled-node'));
  // Standard prose (headings/paragraphs) must reach the page as real elements.
  check('contains at least one heading', /<h[1-6]/.test(html));
  check('contains at least one paragraph', html.includes('<p>'));
  fs.writeFileSync('/tmp/pw-introduction.html', `<!doctype html><meta charset="utf-8">\n${html}\n`);
  console.log('    wrote /tmp/pw-introduction.html for eyeballing');
}

console.log(`\n──────────\n${pass} passed, ${fail} failed\n`);
process.exit(fail > 0 ? 1 : 0);
