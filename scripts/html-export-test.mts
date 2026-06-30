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
import { serializeHtml, type HtmlExportContext } from '../src/shared/htmlSerializer.ts';
import { styleToCss } from '../src/shared/styleToCss.ts';
import { buildWebBundle, buildWebSite, slugify, deriveTitle } from '../src/main/webExport.ts';
import { splitIntoArticles, isMagazineSite } from '../src/shared/magazineSplit.ts';
import { DEFAULT_PROJECT_STYLE, sanitizeProjectStyle } from '../src/shared/styleTypes.ts';
import { deserializeTypst } from '../src/editor/lib/deserializer.ts';
import { buildExportModel, parseBibDirective } from '../src/shared/exportContext.ts';
import { parseBibFile } from '../src/shared/bibParser.ts';

/** Builds an HtmlExportContext the way main's buildHtmlExportContext does, but
 *  with a stub math renderer (no Typst in the test harness). */
function makeContext(src: string, bib = '', mathStub = true, lang = 'en'): HtmlExportContext {
  const doc = deserializeTypst(src);
  const model = buildExportModel(doc as any, src);
  const mathSvg = new Map<string, string>();
  if (mathStub) for (const m of model.mathBlocks) mathSvg.set(m.tex, '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="14"><text>math</text></svg>');
  const bibTitle = src.match(/#bibliography\([^)]*title:\s*"([^"]*)"/)?.[1];
  return { ...model, bibEntries: bib ? parseBibFile(bib) : [], bibTitle, mathSvg, lang };
}

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
  check('document still embeds the self-contained <article>', /<article class="pw-article"[^>]* data-article="x">/.test(document));
  check('article carries lang from meta.locale (hyphenation)', document.includes('<article class="pw-article" lang="de"'));

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

console.log('\n── Test 8: magazine AST nodes → semantic, themeable HTML (Phase C) ──');
{
  const html = (src: string) => serializeHtml(deserializeTypst(src) as any);
  const css = styleToCss(DEFAULT_PROJECT_STYLE);

  // opener → <header class="pw-opener"> with kicker / h1 / standfirst / byline.
  {
    const h = html('#opener(kicker: "Reportage", title: "Der untätige Geist", standfirst: "Über die Stille.", byline: "Von Mara Lindqvist")');
    check('opener → <header class="pw-opener">', h.includes('<header class="pw-opener">'));
    check('opener kicker + h1 + standfirst + byline', h.includes('pw-opener-kicker">Reportage') && h.includes('<h1 class="pw-opener-title">Der untätige Geist</h1>') && h.includes('pw-opener-standfirst">Über die Stille.') && h.includes('pw-opener-byline">Von Mara Lindqvist'));
    check('opener no leaked placeholder', !h.includes('pw:typst-raw') && !h.includes('pw:unhandled'));
  }

  // lead → drop cap (reuses the Phase-B .pw-dropcap CSS).
  check('lead → <p class="pw-dropcap">', html('#lead[Der Müßiggang hat einen schlechten Ruf.]').includes('<p class="pw-dropcap">Der Müßiggang hat einen schlechten Ruf.</p>'));

  // pull (+ who) → blockquote with body + cite.
  {
    const h = html('#pull(who: "Blaise Pascal")[Das ganze Unglück der Menschen.]');
    check('pull → <blockquote class="pw-pull"> + body + cite', h.includes('<blockquote class="pw-pull"><p class="pw-pull-body">Das ganze Unglück der Menschen.</p>') && h.includes('<cite class="pw-pull-who">Blaise Pascal</cite>'));
  }

  // frage → <p class="pw-question">.
  check('frage → <p class="pw-question">', html('#frage[Frau Sandberg?]').includes('<p class="pw-question">Frau Sandberg?</p>'));

  // notiz → <aside class="pw-callout"> with title + multi-paragraph body.
  {
    const h = html('#notiz(title: "Drei Räume")[\nErster Absatz.\n\nZweiter Absatz.\n]');
    check('notiz → callout + title + 2 paragraphs', h.includes('<aside class="pw-callout">') && h.includes('<p class="pw-callout-title">Drei Räume</p>') && (h.match(/<p>/g) ?? []).length >= 2);
  }

  // bildtafel → <figure class="pw-figure-panel"> with img + caption + note.
  {
    const h = html('#bildtafel("assets/feature.png", caption: [Eine Stunde.], title: "Das Netzwerk", [Es ist aktiv.])');
    check('bildtafel → figure-panel with img/caption/title/note', h.includes('<figure class="pw-figure-panel">') && h.includes('<img class="pw-fp-img" src="assets/feature.png"') && h.includes('pw-fp-caption">Eine Stunde.') && h.includes('pw-fp-title">Das Netzwerk') && h.includes('Es ist aktiv.'));
  }

  // #columns → multicol div using --pw-cols (responsive-collapsible), with the
  // nested #frage surviving as a real <p class="pw-question"> (the B1 win).
  {
    const h = html('#columns(2, gutter: 1.5em)[\n#frage[Apropos Telefon?]\n\nDas Telefon ist eine Maschine.\n]');
    check('columns → multicol div w/ --pw-cols + --pw-gap', h.includes('class="pw-columns"') && h.includes('--pw-cols:2') && h.includes('--pw-gap:1.5em'));
    check('columns: nested question survives as HTML (B1 web win)', h.includes('<p class="pw-question">Apropos Telefon?</p>') && h.includes('Das Telefon ist eine Maschine.'));
  }

  // interlude → quiet divider.
  check('interlude → <hr class="pw-interlude">', html('#interlude()').includes('<hr class="pw-interlude">'));

  // randnotiz (inline) → side note <aside>.
  check('randnotiz → inline <aside class="pw-margin-note">', html('Bei den Griechen.#randnotiz[Josef Pieper: Wurzel der Kultur.]').includes('<aside class="pw-margin-note">Josef Pieper: Wurzel der Kultur.</aside>'));

  // CSS rules for the new elements are emitted + scoped.
  check('CSS: .pw-opener / .pw-pull / .pw-question scoped', css.includes('.pw-article .pw-opener {') && css.includes('.pw-article .pw-pull {') && css.includes('.pw-article .pw-question {'));
  check('CSS: .pw-figure-panel grid + responsive @media', css.includes('.pw-article .pw-figure-panel {') && /@media[^{]*\{\s*\.pw-article \.pw-figure-panel/.test(css));
  check('CSS: .pw-columns uses var(--pw-cols) + collapses @media', css.includes('column-count: var(--pw-cols') && /@media[^{]*\{\s*\.pw-article \.pw-columns \{ column-count: 1/.test(css));
  check('CSS: .pw-margin-note + .pw-interlude emitted', css.includes('.pw-article .pw-margin-note {') && css.includes('.pw-article .pw-interlude {'));

  // The full feature chapter (opener + lead + prose + bildtafel + pull +
  // interlude) renders with NO leftover macro placeholders.
  const feature = [
    '#opener(kicker: "Reportage", title: "Der untätige Geist", byline: "Von Mara Lindqvist")',
    '#lead[Eva Holm sitzt am Fenster und tut nichts.]',
    'Was wie Leerlauf aussieht, ist keiner.',
    '#bildtafel("assets/feature.png", caption: [Eine Stunde am Fenster.], title: "Das Ruhezustandsnetzwerk", [Es ist am aktivsten, wenn wir nichts vorhaben.])',
    '#pull[Nicht das viele Tun erschöpft den Kopf.]',
    '#interlude()',
    'Am späten Nachmittag steht Eva Holm auf.',
  ].join('\n\n');
  const fh = serializeHtml(deserializeTypst(feature) as any, { scopedCss: css, mode: 'document', meta: { title: 'Der untätige Geist', locale: 'de' } });
  check('full feature chapter: no leftover macro placeholders', !fh.includes('pw:typst-raw') && !fh.includes('pw:unhandled'));
  check('full feature chapter: all 6 magazine constructs present', fh.includes('pw-opener') && fh.includes('pw-dropcap') && fh.includes('pw-figure-panel') && fh.includes('pw-pull') && fh.includes('pw-interlude'));
  fs.writeFileSync('/tmp/pw-feature.html', fh);
  console.log('    wrote /tmp/pw-feature.html for eyeballing');
}

console.log('\n── Test 9: generic #grid two-up reinterpreted to a responsive grid (§7.4) ──');
{
  const css = styleToCss(DEFAULT_PROJECT_STYLE);
  const src = [
    '// Kopf: links Kasten + erste Fragen, rechts das Porträt.',
    '#grid(',
    '  columns: (1fr, 0.78fr), column-gutter: 1.4em, align: top,',
    '  {',
    '    block(inset: (x: 1em, y: 0.85em), stroke: 0.6pt + style-colors.muted)[',
    '      #set par(justify: false)',
    '      #text(size: 0.74em, weight: "bold", fill: style-colors.accent)[#upper("Zur Person")]',
    '      #v(0.5em)',
    '      #set text(size: 0.88em)',
    '      Henrike Sandberg, 61, lehrt Philosophie der Muße.',
    '    ]',
    '',
    '    frage[Frau Sandberg, Müßiggang gilt als Laster?]',
    '',
    '    [Weil wir zwei Dinge verwechseln. Faulheit ist Flucht.]',
    '  },',
    '  {',
    '    image("../assets/portrait.png", width: 100%)',
    '    v(0.45em)',
    '    text(size: 0.8em, style: "italic", fill: style-colors.muted)[Henrike in ihrem Arbeitszimmer.]',
    '    v(0.7em)',
    '    frage[Viele halten das Nichtstun keine fünf Minuten aus?]',
    '    [Weil sich Leere wie Langeweile anfühlt.]',
    '  },',
    ')',
  ].join('\n');
  const h = serializeHtml(deserializeTypst(src) as any, { scopedCss: css });
  check('grid → <div class="pw-grid"> with 2 cells', h.includes('class="pw-grid"') && (h.match(/class="pw-grid-cell"/g) ?? []).length === 2);
  check('grid: "Zur Person" box survives (title + prose)', h.includes('>ZUR PERSON</p>') && h.includes('lehrt Philosophie der Muße'));
  check('grid: both questions survive', h.includes('Müßiggang gilt als Laster') && h.includes('keine fünf Minuten aus'));
  check('grid: both answers survive', h.includes('Faulheit ist Flucht') && h.includes('wie Langeweile anfühlt'));
  check('grid: portrait image + caption survive', h.includes('<img class="pw-fp-img" src="../assets/portrait.png"') && h.includes('Arbeitszimmer'));
  check('grid: no leftover macro placeholder', !h.includes('pw:typst-raw') && !h.includes('pw:unhandled'));
  check('CSS: .pw-grid responsive (repeat + collapse @media)', css.includes('grid-template-columns: repeat(var(--pw-grid-cols') && /@media[^{]*\{\s*\.pw-article \.pw-grid \{ grid-template-columns: 1fr/.test(css));

  // Adversarial-review robustness fixes (typstGrid):
  // (a) an escaped quote in a cell must NOT drop the whole grid.
  const esc = serializeHtml(deserializeTypst('#grid(columns: 2, { block[ #text[a \\" b] body ] frage[Q?] }, { [Answer] })') as any);
  check('grid: escaped quote in cell does not drop the grid', esc.includes('class="pw-grid"') && esc.includes('Answer'));
  // (b) positional function-call cells (LANGSAM cover form) survive.
  const pos = serializeHtml(deserializeTypst('#grid(columns: 2, text(size: 0.85em)[Reportage], text(size: 0.85em)[Essay])') as any);
  check('grid: positional text() cells survive', pos.includes('class="pw-grid"') && pos.includes('Reportage') && pos.includes('Essay'));
  // (c) content cells AFTER the paren survive.
  const ap = serializeHtml(deserializeTypst('#grid(columns: 2)[Left side][Right side]') as any);
  check('grid: after-paren [cells] survive', ap.includes('class="pw-grid"') && ap.includes('Left side') && ap.includes('Right side'));
}

console.log('\n── Test 10: Phase D — cross-refs / citations / footnotes / bibliography / math resolved via context ──');
{
  const BIB =
    '@article{bender2021, author={Bender, E. and Gebru, T. and others}, title={On Parrots}, year={2021}, journal={FAccT}, doi={10.1/x}}\n' +
    '@inproceedings{chen2021, author={Chen, M. and others}, title={Codex}, year={2021}, booktitle={NeurIPS}}\n' +
    '@book{smith2020, author={Smith, J.}, title={A Book}, year={2020}, publisher={MIT}}';
  const src = [
    '#set math.equation(numbering: "(1)")',
    '= Methods <sec:methods>',
    '',
    'As shown in @fig:flow and @eq:loss, models learn.',
    '',
    'Recent work @bender2021 @chen2021 surveys this.',
    '',
    'A claim#footnote[A note with _emphasis_.] needs support @smith2020.',
    '',
    '#figure(image("assets/flow.png"), caption: [The pipeline.]) <fig:flow>',
    '',
    '$ cal(L) = - sum log p $ <eq:loss>',
    '',
    '#bibliography("references.bib", style: "apa", title: "References")',
  ].join('\n');
  const ctx = makeContext(src, BIB);
  const h = serializeHtml(deserializeTypst(src) as any, { context: ctx, scopedCss: styleToCss(DEFAULT_PROJECT_STYLE) });

  // cross-references resolved to numbered targets + linked to the in-page id.
  check('reference @fig:flow → "Figure 1" linked', h.includes('<a class="pw-ref" href="#fig:flow">Figure 1</a>'));
  check('reference @eq:loss → "(1)" linked', h.includes('<a class="pw-ref" href="#eq:loss">(1)</a>'));
  check('reference @sec is resolvable (heading id present)', h.includes('<h1 id="sec:methods">'));
  // adjacent citations collapse into one author-year group, each linked.
  check('adjacent citations grouped (Bender et al., 2021; Chen et al., 2021)',
    h.includes('(<a class="pw-cite" href="#cite-bender2021">Bender et al., 2021</a>; <a class="pw-cite" href="#cite-chen2021">Chen et al., 2021</a>)'));
  // single citation resolved.
  check('single citation @smith2020 → (Smith, 2020) linked', h.includes('<a class="pw-cite" href="#cite-smith2020">Smith, 2020</a>'));
  // footnote: in-text ref + collected endnote with backlink.
  check('footnote → numbered <sup> ref', h.includes('<sup class="pw-fn" id="fnref-1"><a href="#fn-1">1</a></sup>'));
  check('footnotes section with body + backlink', h.includes('<section class="pw-footnotes"') && h.includes('<li id="fn-1">A note with <em>emphasis</em>.') && h.includes('href="#fnref-1"'));
  // figure: numbered, id = label, caption rendered.
  check('figure → numbered <figure id="fig:flow"> + caption', h.includes('<figure class="pw-figure" id="fig:flow">') && h.includes('<img src="assets/flow.png"') && h.includes('Figure 1</span>: The pipeline.'));
  // math: inline SVG + equation number + id.
  check('math → <figure class="pw-math" id="eq:loss"> with inline <svg> + eqno', h.includes('<figure class="pw-math" id="eq:loss">') && h.includes('<svg') && h.includes('<span class="pw-eqno">(1)</span>'));
  check('math SVG xml prolog/doctype stripped (none injected here, but sanitizer ran)', !h.includes('<?xml') && !h.includes('<!DOCTYPE'));
  // bibliography section, alphabetical, anchored ids.
  check('bibliography section with custom title', h.includes('<section class="pw-bibliography" id="pw-bibliography">') && h.includes('>References</h2>'));
  check('bib entries anchored by citekey', h.includes('id="cite-bender2021"') && h.includes('id="cite-chen2021"') && h.includes('id="cite-smith2020"'));
  check('bib entry APA-shaped (et al., year, italic venue, doi link)', h.includes('Bender, E., Gebru, T., et al. (2021).') && h.includes('<em>FAccT</em>') && h.includes('href="https://doi.org/10.1/x"'));
  check('bib alphabetical (Bender before Smith)', h.indexOf('cite-bender2021') < h.indexOf('cite-smith2020'));
  check('no leftover macro placeholders', !h.includes('pw:typst-raw') && !h.includes('pw:unhandled') && !h.includes('Phase D'));
  fs.writeFileSync('/tmp/pw-phase-d.html', `<!doctype html><meta charset=utf-8>\n${h}\n`);
  console.log('    wrote /tmp/pw-phase-d.html for eyeballing');
}

console.log('\n── Test 11: numeric citation style → [1, 2] + numbered bibliography ──');
{
  const BIB = '@article{a2021, author={Alpha, A.}, title={A}, year={2021}}\n@article{b2020, author={Beta, B.}, title={B}, year={2020}}';
  const src = [
    'First @b2020 then both @a2021 @b2020.',
    '',
    '#bibliography("r.bib", style: "ieee")',
  ].join('\n');
  const ctx = makeContext(src, BIB);
  const h = serializeHtml(deserializeTypst(src) as any, { context: ctx });
  check('numeric mode detected (ieee)', ctx.citationMode === 'numeric');
  check('numeric order is first-citation order (b2020=1, a2021=2)', ctx.numericOrder[0] === 'b2020' && ctx.numericOrder[1] === 'a2021');
  check('single numeric citation → [1]', h.includes('[<a class="pw-cite" href="#cite-b2020">1</a>]'));
  check('grouped numeric citations → [2, 1]', h.includes('[<a class="pw-cite" href="#cite-a2021">2</a>, <a class="pw-cite" href="#cite-b2020">1</a>]'));
  check('bibliography numbered by citation order', h.includes('id="cite-b2020">[1] ') && h.includes('id="cite-a2021">[2] '));
  check('numeric bib default title "References"', h.includes('>References</h2>'));
}

console.log('\n── Test 12: table figure + block quote → real HTML ──');
{
  const src = [
    '#figure(table(columns: 2, [*Method*], [*Score*], [Baseline], [0.71], [Ours], [0.88]), caption: [Results.]) <tbl:res>',
    '',
    '#quote(block: true)[The unexamined life is not worth living.]',
  ].join('\n');
  const ctx = makeContext(src);
  const h = serializeHtml(deserializeTypst(src) as any, { context: ctx });
  check('table figure → <figure class="pw-table-figure" id="tbl:res">', h.includes('<figure class="pw-table-figure" id="tbl:res">'));
  check('table header cells (bold stripped) + body cells', h.includes('<th>Method</th><th>Score</th>') && h.includes('<td>Baseline</td><td>0.71</td>'));
  check('table caption "Table 1: Results."', h.includes('Table 1</span>: Results.'));
  check('block quote → <blockquote>', h.includes('<blockquote><p>The unexamined life is not worth living.</p></blockquote>'));
}

console.log('\n── Test 13: graceful degradation without a context (no Typst pre-pass) ──');
{
  const mathDoc = deserializeTypst('$ E = m c^2 $');
  const h = serializeHtml(mathDoc as any, {});
  check('math without context → readable inline-TeX fallback (no SVG)', h.includes('<span class="pw-math-tex">') && !h.includes('<svg'));
  const refDoc = deserializeTypst('See @fig:x and cite @smith2020.');
  const hr = serializeHtml(refDoc as any, {});
  check('reference without context → bare label fallback', hr.includes('<a class="pw-ref" href="#fig:x">x</a>'));
  check('citation without context → [citekey] fallback', hr.includes('href="#cite-smith2020">[smith2020]</a>'));
  check('no bibliography section emitted without entries', !h.includes('pw-bibliography') && !hr.includes('pw-bibliography'));
  // styleToCss emits the Phase-D element rules, scoped.
  const css = styleToCss(DEFAULT_PROJECT_STYLE);
  check('CSS: .pw-math / .pw-footnotes / .pw-bibliography scoped', css.includes('.pw-article .pw-math {') && css.includes('.pw-article .pw-footnotes {') && css.includes('.pw-article .pw-bibliography {'));
  check('CSS: .pw-math svg capped to max-width', /\.pw-article \.pw-math-svg svg \{[^}]*max-width: 100%/.test(css));
}

console.log('\n── Test 14: a real sample chapter (math + cross-refs + citations) renders fully ──');
{
  const file = fileURLToPath(new URL('../resources/sample-project/chapters/03-ai-as-assistant.typ', import.meta.url));
  const src = fs.readFileSync(file, 'utf8');
  const ctx = makeContext(src, '@article{bender2021parrots, author={Bender, E. and others}, title={Parrots}, year={2021}}\n@article{liu2023chatgpt, author={Liu, P. and others}, title={ChatGPT}, year={2023}}');
  const h = serializeHtml(deserializeTypst(src) as any, { context: ctx, scopedCss: styleToCss(DEFAULT_PROJECT_STYLE) });
  check('sample chapter renders without placeholders', !h.includes('pw:typst-raw') && !h.includes('pw:unhandled'));
  check('sample chapter: figure present', h.includes('<figure class="pw-figure"') && h.includes('Figure 1'));
  check('sample chapter: display math rendered (svg stub)', h.includes('<figure class="pw-math"') && h.includes('<svg'));
  check('sample chapter: @eq:mle reference resolved (not raw)', !h.includes('>eq:mle<') && h.includes('class="pw-ref"'));
  check('sample chapter: citations rendered as author-year', h.includes('class="pw-cite"'));
}

console.log('\n── Test 15: adversarial-review fixes (nested-figure numbering, SVG XSS, section refs, footnote chunk, bib title) ──');
{
  // #1/#3/#4 — a figure + display-math NESTED in #columns must be counted by the
  // pre-pass (so caption numbers match cross-refs, and nested math gets an SVG).
  const nestedSrc = [
    '#set math.equation(numbering: "(1)")',
    '',
    '#columns(2)[',
    '#figure(image("a.png"), caption: [Inside.]) <fig:a>',
    '',
    '$ a^2 + b^2 = c^2 $ <eq:in>',
    ']',
    '',
    '#figure(image("b.png"), caption: [Outside.]) <fig:b>',
    '',
    'See @fig:a, @fig:b and @eq:in.',
  ].join('\n');
  const nctx = makeContext(nestedSrc);
  check('pre-pass counts the NESTED figure (fig:a=1, fig:b=2)', nctx.labelMap.get('fig:a')?.n === 1 && nctx.labelMap.get('fig:b')?.n === 2);
  check('pre-pass registers the NESTED equation label', nctx.labelMap.has('eq:in'));
  check('pre-pass collected the NESTED math block for SVG render', nctx.mathSvg.has('$ a^2 + b^2 = c^2 $'));
  const nh = serializeHtml(deserializeTypst(nestedSrc) as any, { context: nctx });
  check('nested figure caption "Figure 1" inside columns', /class="pw-columns"[\s\S]*Figure 1<\/span>: Inside\./.test(nh));
  check('top-level figure caption "Figure 2"', nh.includes('Figure 2</span>: Outside.'));
  check('cross-refs match captions (no desync): @fig:a→1, @fig:b→2', nh.includes('href="#fig:a">Figure 1</a>') && nh.includes('href="#fig:b">Figure 2</a>'));
  check('nested display-math rendered as SVG (not text fallback)', (nh.match(/class="pw-math-svg"/g) ?? []).length === 1 && !nh.includes('pw-math-tex'));

  // #2 — a hostile (author-controlled) math SVG must be neutralised when inlined.
  const evilCtx = makeContext('$ x $');
  evilCtx.mathSvg.set('$ x $', '<svg xmlns="http://www.w3.org/2000/svg"><a href="javascript:alert(1)" onclick="steal()"><text>x</text></a><use href="#glyph-g1"/><foreignObject><div><script>bad()</script></div></foreignObject></svg>');
  const eh = serializeHtml(deserializeTypst('$ x $') as any, { context: evilCtx });
  check('SVG: javascript: href neutralised', !eh.includes('javascript:'));
  check('SVG: on*-handler stripped', !/\bonclick\b/.test(eh));
  check('SVG: <foreignObject> + nested <script> stripped', !eh.includes('<foreignObject') && !eh.includes('bad()'));
  check('SVG: glyph #fragment <use> ref preserved', eh.includes('href="#glyph-g1"'));

  // #5 — a design chunk that is ONLY a footnote keeps its in-text marker (no orphan).
  const fnDoc = { type: 'doc', content: [{ type: 'typstRawBlock', attrs: { content: '#block[\n#footnote[Lone note.]\n]', blockType: 'raw' } }] };
  const fh = serializeHtml(fnDoc as any, { context: makeContext('') });
  check('lone-footnote chunk keeps its <sup> marker', fh.includes('id="fnref-1"'));
  check('lone-footnote endnote present with live backlink target', fh.includes('id="fn-1">Lone note.') && fh.includes('href="#fnref-1"'));

  // #6 — bib title survives a ')' inside the path.
  const dir = parseBibDirective('#bibliography("refs (2020).bib", title: "Quellen")');
  check('bib title preserved despite ) in path', dir?.title === 'Quellen' && dir?.path === 'refs (2020).bib');

  // #7 — section cross-references resolve (heading label lives in attrs.label).
  const secSrc = '= Intro <sec:intro>\n\n== Sub <sec:sub>\n\nSee @sec:intro and @sec:sub.';
  const sctx = makeContext(secSrc);
  check('pre-pass registers heading labels from attrs.label', sctx.labelMap.get('sec:intro')?.numberText === '1' && sctx.labelMap.get('sec:sub')?.numberText === '1.1');
  const sh = serializeHtml(deserializeTypst(secSrc) as any, { context: sctx });
  check('@sec:intro → "Section 1" linked', sh.includes('<a class="pw-ref" href="#sec:intro">Section 1</a>'));
  check('@sec:sub → "Section 1.1" linked', sh.includes('<a class="pw-ref" href="#sec:sub">Section 1.1</a>'));
}

console.log('\n── Test 16: Phase E heroes (cover / aufmacher / spread) + justify + #text styling ──');
{
  const raw = (content: string, blockType = 'raw') => ({ type: 'doc', content: [{ type: 'typstRawBlock', attrs: { content, blockType } }] });

  // #aufmacher (comment-led, blockType 'comment' — the real LANGSAM shape) →
  // a full-width hero image + the opener text (kicker / H1 / standfirst).
  const auf = [
    '// Aufmacher-Doppelseite: das breite Bild läuft über die Doppelseite.',
    '#aufmacher(',
    '  "assets/spread.png",',
    '  credit: "Foto: Platzhalter",',
    ')[',
    '  #text(size: 0.82em, weight: "bold", tracking: 0.2em, fill: style-colors.accent)[#upper("Feature")]',
    '  #v(0.9em)',
    '  #heading(level: 1, outlined: true, numbering: none)[Die Architektur der Muße]',
    '  #v(0.6em)',
    '  #text(size: 1.18em, style: "italic", fill: style-colors.muted)[Müßiggang braucht einen Ort.]',
    ']',
  ].join('\n');
  const ah = serializeHtml(raw(auf, 'comment') as any, { context: makeContext('') });
  check('aufmacher → <header class="pw-hero pw-hero-aufmacher"> with the spread image', ah.includes('class="pw-hero pw-hero-aufmacher"') && ah.includes('<img class="pw-hero-img" src="assets/spread.png"'));
  check('aufmacher credit kept', ah.includes('class="pw-hero-credit">Foto: Platzhalter'));
  check('aufmacher H1 is a real heading (outline title)', ah.includes('<h1 class="pw-hero-title">Die Architektur der Muße</h1>'));
  check('aufmacher kicker keeps uppercase + accent color via #text/#upper', /pw-hero-line[^>]*>.*text-transform:uppercase.*Feature/i.test(ah) && ah.includes('color:var(--pw-accent)'));
  check('aufmacher standfirst keeps italic', ah.includes('font-style:italic') && ah.includes('Müßiggang braucht einen Ort.'));
  check('aufmacher no leaked macro/comment', !ah.includes('#aufmacher') && !ah.includes('Aufmacher-Doppelseite') && !ah.includes('pw:typst-raw'));

  // #page(...)[…] cover (blockType 'config' — would otherwise be skipped) →
  // a centered title hero; `\` forced breaks become <br>.
  const cover = [
    '#page(header: none, margin: (x: 3cm))[',
    '  #text(font: style-fonts.heading, size: 46pt, weight: "medium", fill: style-colors.text)[LANGSAM]',
    '  #v(0.55em)',
    '  #text(size: 0.92em, fill: style-colors.muted)[MAGAZIN FÜR MUSSE]',
    '  #v(2.4fr)',
    '  #text(size: 42pt, fill: style-colors.text)[',
    '    Die Kunst,\\',
    '    nichts zu tun',
    '  ]',
    ']',
  ].join('\n');
  const ch = serializeHtml(raw(cover, 'config') as any, { context: makeContext('') });
  check('cover → <header class="pw-cover"> (NOT skipped despite blockType config)', ch.includes('<header class="pw-cover">'));
  check('cover magazine title rendered big via #text size', /font-size:4\.\d+em[^>]*>LANGSAM|LANGSAM/.test(ch) && ch.includes('LANGSAM'));
  check('cover forced break \\\\ → <br>', ch.includes('Die Kunst,<br>') || ch.includes('Die Kunst,</span>') || /Die Kunst,\s*<br>/.test(ch));
  check('cover no leaked #page/#text/#set/comment source', !ch.includes('#page') && !ch.includes('#text') && !ch.includes('par(justify') && !ch.includes('// ') && !ch.includes('pw:typst-raw'));

  // #doppelseite → full-width spread figure.
  const sp = serializeHtml(raw('#doppelseite("assets/wide.png", title: "Kapitel", credit: "Foto: Y")') as any, { context: makeContext('') });
  check('doppelseite → <figure class="pw-hero pw-hero-spread"> + img + credit', sp.includes('class="pw-hero pw-hero-spread"') && sp.includes('src="assets/wide.png"') && sp.includes('Foto: Y'));

  // Blocksatz: justify in custom.preamble → translated to CSS (not dropped).
  const justifyStyle = { ...DEFAULT_PROJECT_STYLE, custom: { ...(DEFAULT_PROJECT_STYLE as any).custom, preamble: '#set page(margin: (left: 3cm))\n#set par(justify: true)' } };
  const jcss = styleToCss(justifyStyle as any);
  check('justify from preamble → text-align:justify + hyphens (article)', /\.pw-article \{[^}]*text-align: justify/.test(jcss) && jcss.includes('hyphens: auto'));
  check('justify NOT emitted when preamble lacks it', !/text-align: justify/.test(styleToCss(DEFAULT_PROJECT_STYLE)));

  // #text(...) styling: size (em), weight, italic, themeable fill.
  const ts = serializeHtml(raw('#block[#text(size: 2em, weight: "bold", style: "italic", fill: style-colors.accent)[Hero]]') as any);
  check('#text → styled <span> (size/weight/italic/var-color)', /font-size:2\.00em/.test(ts) && ts.includes('font-weight:700') && ts.includes('font-style:italic') && ts.includes('color:var(--pw-accent)') && ts.includes('>Hero</span>'));

  // Whole-page background in document mode (fills the viewport behind the column);
  // fragment mode never restyles a host's <body>.
  const docBg = serializeHtml(raw('Hi') as any, { mode: 'document', meta: { title: 'T' }, pageBackground: '#eef0ec' });
  check('document mode: whole page gets the magazine background', docBg.includes('<style>html{background:#eef0ec') && docBg.includes('body{margin:0}'));
  check('hostile/invalid pageBackground is dropped (no page <style>)', !serializeHtml(raw('Hi') as any, { mode: 'document', pageBackground: 'red;}</style><script>x' as any }).includes('<script>'));
  const frag = serializeHtml(raw('Hi') as any, { mode: 'fragment', pageBackground: '#eef0ec' });
  check('fragment mode: never restyles the host page (no html/body bg)', !frag.includes('html{background') && !frag.includes('body{margin'));
  check('article has a padding gutter (text never touches the edge)', styleToCss(DEFAULT_PROJECT_STYLE).includes('padding: 2.5rem 1.25rem') && styleToCss(DEFAULT_PROJECT_STYLE).includes('box-sizing: border-box'));
}

console.log('\n── Test 17: magazine mini-site (split → index + per-article pages + nav + shared assets) ──');
{
  const src = [
    '// ─── 00-cover.typ ───',
    '',
    '#page(margin: (x: 3cm))[',
    '  #text(font: style-fonts.heading, size: 40pt, fill: style-colors.text)[TESTMAG]',
    '  #text(size: 0.9em, fill: style-colors.muted)[EIN PROBEHEFT]',
    ']',
    '',
    '// ─── 01-editorial.typ ───',
    '',
    '#opener(kicker: "Editorial", title: "Vom Anfang", byline: "Von A. Autor")',
    '',
    'Erster Absatz des Editorials.',
    '',
    '// ─── 02-feature.typ ───',
    '',
    '#opener(kicker: "Reportage", title: "Die große Geschichte", byline: "Von B. Autor")',
    '',
    'Die Reportage verweist auf @fig:x.',
    '',
    '#figure(image("assets/x.png"), caption: [Ein Bild.]) <fig:x>',
  ].join('\n');
  const doc = deserializeTypst(src);

  // split
  const articles = splitIntoArticles(doc as any)!;
  check('split → 3 articles (cover + 2)', !!articles && articles.length === 3);
  check('cover detected + slug "index"', articles[0].isCover && articles[0].slug === 'index');
  check('article titles + kickers from openers', articles[1].title === 'Vom Anfang' && articles[1].kicker === 'Editorial' && articles[2].title === 'Die große Geschichte');
  check('isMagazineSite true (cover + openers)', isMagazineSite(articles, doc as any));
  check('isMagazineSite false for a plain multi-heading doc', !isMagazineSite(splitIntoArticles(deserializeTypst('= A\n\nx\n\n= B\n\ny') as any), deserializeTypst('= A\n\nx\n\n= B\n\ny') as any));

  // build the site
  const root = '/tmp/pw-site-root', out = '/tmp/pw-site-out';
  for (const d of [root, out]) fs.rmSync(d, { recursive: true, force: true });
  fs.mkdirSync(`${root}/assets`, { recursive: true });
  fs.writeFileSync(`${root}/assets/x.png`, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64'));
  const r = buildWebSite({ articles, style: DEFAULT_PROJECT_STYLE, meta: { title: 'TESTMAG', locale: 'de' }, outDir: out, rootDir: root, context: makeContext(src) });

  check('index.html + 2 article pages written', fs.existsSync(`${out}/index.html`) && fs.existsSync(`${out}/editorial.html`) && fs.existsSync(`${out}/feature.html`) && r.pages.length === 3);
  const idx = fs.readFileSync(`${out}/index.html`, 'utf8');
  check('index = cover hero + TOC', idx.includes('<header class="pw-cover">') && idx.includes('class="pw-toc"') && idx.includes('>TESTMAG<'));
  check('TOC links both articles with kicker + title', idx.includes('href="editorial.html"') && idx.includes('>Editorial</span>') && idx.includes('href="feature.html"') && idx.includes('>Die große Geschichte</span>'));

  const feat = fs.readFileSync(`${out}/feature.html`, 'utf8');
  check('article page is a standalone document w/ the opener', /^<!doctype html>/i.test(feat.trimStart()) && feat.includes('class="pw-opener"') && feat.includes('Die große Geschichte'));
  check('article nav: up to index + prev to editorial', feat.includes('class="pw-nav-up" href="index.html"') && feat.includes('class="pw-nav-prev" href="editorial.html"'));
  check('editorial nav: next to feature, no prev', (() => { const e = fs.readFileSync(`${out}/editorial.html`, 'utf8'); return e.includes('class="pw-nav-next" href="feature.html"') && !e.includes('class="pw-nav-prev"'); })());
  check('within-article cross-ref resolves on its own page (@fig:x → Figure 1 + target)', feat.includes('href="#fig:x">Figure 1</a>') && feat.includes('id="fig:x"'));
  check('shared asset copied once', fs.existsSync(`${out}/assets/x.png`) && r.assets.filter((a) => a === 'assets/x.png').length === 1);
  check('meta.json is a magazine issue w/ article list', (() => { const m = JSON.parse(fs.readFileSync(`${out}/meta.json`, 'utf8')); return m.kind === 'magazine' && m.articles.length === 2 && m.articles[0].file === 'editorial.html'; })());
  check('CSS: .pw-toc + .pw-nav scoped', styleToCss(DEFAULT_PROJECT_STYLE).includes('.pw-article .pw-toc {') && styleToCss(DEFAULT_PROJECT_STYLE).includes('.pw-article .pw-nav {'));

  for (const d of [root, out]) fs.rmSync(d, { recursive: true, force: true });
}

console.log(`\n──────────\n${pass} passed, ${fail} failed\n`);
process.exit(fail > 0 ? 1 : 0);
