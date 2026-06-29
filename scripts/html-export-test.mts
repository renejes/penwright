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
import { styleToCss } from '../src/shared/styleToCss.ts';
import { buildWebBundle, slugify, deriveTitle } from '../src/main/webExport.ts';
import { DEFAULT_PROJECT_STYLE, sanitizeProjectStyle } from '../src/shared/styleTypes.ts';
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

console.log('\n── Test 3: agnostic output modes (fragment vs standalone document) ──');
{
  const doc = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'hi' }] }] };

  const fragment = serializeHtml(doc as any, { slug: 'x', mode: 'fragment' });
  check('fragment starts with <article> (embeddable, no page shell)', fragment.trimStart().startsWith('<article class="pw-article"'));
  check('fragment has NO <!doctype>', !/<!doctype/i.test(fragment));

  const document = serializeHtml(doc as any, {
    slug: 'x',
    mode: 'document',
    meta: { title: 'My <Article>', description: 'A test & demo', locale: 'de', cover: 'assets/cover.jpg' },
  });
  check('document is a full HTML5 page', /^<!doctype html>/i.test(document.trimStart()));
  check('document carries lang from meta.locale', document.includes('<html lang="de">'));
  check('document <title> is HTML-escaped', document.includes('<title>My &lt;Article&gt;</title>'));
  check('document has description meta', document.includes('name="description" content="A test &amp; demo"'));
  check('document has Open Graph image (shareable)', document.includes('property="og:image" content="assets/cover.jpg"'));
  check('document still embeds the self-contained <article>', document.includes('<article class="pw-article" data-article="x">'));

  // Default mode is the embeddable fragment.
  const def = serializeHtml(doc as any, {});
  check('default mode is fragment', def.trimStart().startsWith('<article') && !/<!doctype/i.test(def));
}

console.log('\n── Test 4: styleToCss — tokens → scoped CSS (no global leak) ──');
{
  const css = styleToCss(DEFAULT_PROJECT_STYLE);
  check('exposes color custom properties on the root', css.includes('.pw-article {') && css.includes('--pw-accent:'));
  check('font + measure on root', css.includes('--pw-font-body:') && css.includes('max-width: 70ch'));
  check('headings ratio-scaled with em + token color', /\.pw-article h1 \{[^}]*font-size: [\d.]+em/.test(css) && /\.pw-article h1 \{[^}]*color: var\(--pw-/.test(css));
  check('blockquote uses border-inline-start + token color', /\.pw-article blockquote \{[^}]*border-inline-start/.test(css));
  // The scoping-leak guard: every comma-separated selector must carry the prefix.
  check('comma selectors fully scoped (th, td)', css.includes('.pw-article th, .pw-article td {'));
  check('helper classes fully scoped (.pw-cite, .pw-ref)', css.includes('.pw-article .pw-cite, .pw-article .pw-ref'));
  check('no bare global "td {" leaked', !/(^|[^-\w]),?\s*td\s*\{/m.test(css.replace(/\.pw-article td/g, '')));
  // Print-only fields must NOT appear.
  check('no print-only paper/bleed in CSS', !/bleed|crop|a4|us-letter/i.test(css));

  const styled = serializeHtml(deserializeTypst('= Title\n\nHello world.') as any, { scopedCss: css });
  check('rendered article inlines the scoped CSS', styled.includes('<style>') && styled.includes('--pw-accent'));
}

console.log('\n── Test 5: design elements (drop cap + callout) reparsed to real HTML ──');
{
  const dc = serializeHtml(deserializeTypst('#dropcap(height: 3, fill: style-colors.primary)[This is the opener with a *bold* word.]') as any);
  check('drop cap → <p class="pw-dropcap">', dc.includes('<p class="pw-dropcap">'));
  check('drop-cap body + inline markup survive', dc.includes('This is the opener with a <strong>bold</strong> word.'));

  const co = serializeHtml(deserializeTypst('#warning(title: "Careful")[\n  *Heavy* callout use looks amateurish.\n]') as any);
  check('callout → <aside class="pw-callout" data-tone="warning">', co.includes('<aside class="pw-callout" data-tone="warning">'));
  check('callout title rendered', co.includes('<p class="pw-callout-title">Careful</p>'));
  check('callout body survives', co.includes('<strong>Heavy</strong> callout use looks amateurish.'));

  const css = styleToCss(DEFAULT_PROJECT_STYLE);
  check('CSS: initial-letter + permanent Firefox float fallback', css.includes('initial-letter: 3') && css.includes('@supports not (initial-letter: 3) {'));
  check('CSS: @supports passed through unprefixed (not broken)', !css.includes('.pw-article @supports'));
  check('CSS: callout box uses color-mix tint', css.includes('.pw-article .pw-callout {') && css.includes('color-mix(in srgb, var(--pw-accent)'));

  // The real shipped showcase uses #dropcap + #info/#tip/#warning/#memo.
  const showcase = fs.readFileSync(fileURLToPath(new URL('../resources/sample-project/chapters/07-design-showcase.typ', import.meta.url)), 'utf8');
  const sc = serializeHtml(deserializeTypst(showcase) as any, { scopedCss: css, mode: 'document', meta: { title: 'Design Showcase', locale: 'en' } });
  check('real showcase: drop cap reparsed', sc.includes('<p class="pw-dropcap">'));
  check('real showcase: ≥3 callouts reparsed', (sc.match(/<aside class="pw-callout"/g) ?? []).length >= 3);
  check('real showcase: a callout body phrase survives', sc.includes('amateurish'));
  fs.writeFileSync('/tmp/pw-showcase.html', sc);
  console.log('    wrote /tmp/pw-showcase.html for eyeballing');
}

console.log('\n── Test 6: web bundle writer (index + fragment + meta + assets) ──');
{
  const root = '/tmp/pw-bundle-root';
  const out = '/tmp/pw-bundle-out';
  const out2 = '/tmp/pw-bundle-inline';
  for (const d of [root, out, out2]) fs.rmSync(d, { recursive: true, force: true });
  fs.mkdirSync(`${root}/assets`, { recursive: true });
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
  fs.writeFileSync(`${root}/assets/pix.png`, png);

  const doc = { type: 'doc', content: [
    { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Bundle Test' }] },
    { type: 'paragraph', content: [{ type: 'text', text: 'Body.' }] },
    { type: 'image', attrs: { src: 'assets/pix.png' } },
  ] };

  const r = buildWebBundle({ doc: doc as any, style: DEFAULT_PROJECT_STYLE, meta: { title: 'Bundle Test', locale: 'en' }, slug: 'bundle-test', outDir: out, rootDir: root });
  check('index.html written as a standalone document', fs.existsSync(r.indexPath) && /^<!doctype html>/i.test(fs.readFileSync(r.indexPath, 'utf8')));
  check('fragment.html written as an <article> fragment', fs.existsSync(r.fragmentPath) && fs.readFileSync(r.fragmentPath, 'utf8').trimStart().startsWith('<article'));
  check('meta.json written + parses with slug + assets', (() => { const m = JSON.parse(fs.readFileSync(r.metaPath, 'utf8')); return m.slug === 'bundle-test' && Array.isArray(m.assets); })());
  check('image copied into assets/', fs.existsSync(`${out}/assets/pix.png`) && r.assets.includes('assets/pix.png'));
  check('img src rewritten to relative assets path', fs.readFileSync(r.indexPath, 'utf8').includes('<img src="assets/pix.png"'));

  const r2 = buildWebBundle({ doc: doc as any, style: DEFAULT_PROJECT_STYLE, meta: { title: 'X' }, slug: 'x', outDir: out2, rootDir: root, inlineAssets: true });
  check('inline mode: img becomes a data: URI', fs.readFileSync(r2.indexPath, 'utf8').includes('<img src="data:image/png;base64,'));
  check('inline mode: nothing copied to assets', r2.assets.length === 0 && !fs.existsSync(`${out2}/assets`));

  check('slugify kebab-cases', slugify('Hello World 123!') === 'hello-world-123');
  check('deriveTitle reads the first heading', deriveTitle(doc as any) === 'Bundle Test');

  for (const d of [root, out, out2]) fs.rmSync(d, { recursive: true, force: true });
}

console.log('\n── Test 7: security + correctness regression guards (Phase A/B review fixes) ──');
{
  const rawBlock = (content: string) => ({ type: 'doc', content: [{ type: 'typstRawBlock', attrs: { content, blockType: 'raw' } }] });

  // (a) Hostile style.json tokens must NOT break out of the inline <style>.
  const hostile = sanitizeProjectStyle({
    ...DEFAULT_PROJECT_STYLE,
    fonts: { ...DEFAULT_PROJECT_STYLE.fonts, body: '</style><script>alert(1)</script>' },
    elements: {
      ...DEFAULT_PROJECT_STYLE.elements,
      codeBlock: { ...DEFAULT_PROJECT_STYLE.elements.codeBlock, background: '#fff}</style><script>alert(2)</script>' },
    },
  } as any);
  const hcss = styleToCss(hostile);
  check('font/codeBlock tokens cannot inject </style> or <script>', !hcss.includes('</style>') && !hcss.includes('<script>'));
  check('rendered <style> has no live <script>', !/<script\b/i.test(serializeHtml({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x' }] }] } as any, { scopedCss: hcss })));

  // (b) Dangerous URL schemes neutralized; safe ones kept.
  const linkDoc = (href: string) => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'here', marks: [{ type: 'link', attrs: { href } }] }] }] });
  check('javascript: link dropped, text kept', (() => { const h = serializeHtml(linkDoc('javascript:alert(1)') as any); return !h.includes('javascript:') && h.includes('here'); })());
  check('data:text/html link dropped', !serializeHtml(linkDoc('data:text/html,<b>x</b>') as any).includes('data:text/html'));
  check('https link preserved', serializeHtml(linkDoc('https://example.com/a') as any).includes('href="https://example.com/a"'));
  check('inline #link javascript: in callout dropped', (() => { const h = serializeHtml(rawBlock('#info[See #link("javascript:alert(1)")[x] now.]') as any); return !h.includes('javascript:') && h.includes('now'); })());

  // (c) Callout with ')' in its title still renders (no silent total content loss).
  const ct = serializeHtml(rawBlock('#warning(title: "Be careful (really)")[\n Body text here. \n]') as any);
  check('callout with ) in title renders body', ct.includes('class="pw-callout"') && ct.includes('Body text here') && ct.includes('Be careful (really)'));

  // (d) Drop cap with '[' inside args extracts the real body, not an arg bracket.
  check('dropcap with [ in args keeps real body', serializeHtml(rawBlock('#dropcap(foo: (a: [x]))[The real body here.]') as any).includes('<p class="pw-dropcap">The real body here.'));

  // (e) Unbalanced underscores do not cross word boundaries.
  const em = serializeHtml(rawBlock('#info[Set my_var and your_var to zero.]') as any);
  check('snake_case stays literal (no spurious <em>)', !em.includes('<em>') && em.includes('my_var'));

  // (f) CSS-property injection via textColor/highlight is dropped.
  const ov = serializeHtml({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x', marks: [{ type: 'textColor', attrs: { color: 'red;position:fixed;inset:0' } }] }] }] } as any);
  check('textColor overlay payload dropped', !ov.includes('position:fixed'));

  // (g) Global img cap is emitted.
  const css = styleToCss(DEFAULT_PROJECT_STYLE);
  check('styleToCss emits a global img max-width', /\.pw-article img \{[^}]*max-width: 100%/.test(css));

  // (h) Asset rewriter blocks ../ traversal, absolute paths, and non-image files.
  const troot = '/tmp/pw-trav-root', tout = '/tmp/pw-trav-out';
  for (const d of [troot, tout]) fs.rmSync(d, { recursive: true, force: true });
  fs.mkdirSync(troot, { recursive: true });
  const evilPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
  fs.writeFileSync('/tmp/pw-trav-evil.png', evilPng);       // valid image, OUTSIDE root
  fs.writeFileSync(`${troot}/secret.txt`, 'SECRETDATA');     // inside root, NOT an image
  const travDoc = { type: 'doc', content: [
    { type: 'image', attrs: { src: '../pw-trav-evil.png' } },   // ../ traversal (image ext)
    { type: 'image', attrs: { src: '/tmp/pw-trav-evil.png' } }, // absolute
    { type: 'image', attrs: { src: 'secret.txt' } },            // in-root non-image
  ] };
  const tr = buildWebBundle({ doc: travDoc as any, style: DEFAULT_PROJECT_STYLE, meta: { title: 't' }, slug: 't', outDir: tout, rootDir: troot });
  const thtml = fs.readFileSync(tr.indexPath, 'utf8');
  check('no out-of-root / non-image file copied', tr.assets.length === 0 && !fs.existsSync(`${tout}/assets`));
  check('no secret/out-of-root bytes leaked into bundle', !thtml.includes('SECRETDATA') && !thtml.includes('data:image'));
  for (const d of [troot, tout]) fs.rmSync(d, { recursive: true, force: true });
  fs.rmSync('/tmp/pw-trav-evil.png', { force: true });
}

console.log(`\n──────────\n${pass} passed, ${fail} failed\n`);
process.exit(fail > 0 ? 1 : 0);
