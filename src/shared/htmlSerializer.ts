// TipTap JSON → self-contained semantic HTML serializer.
//
// Phase A foundation (web-export-feasibility-and-plan.md). Built on
// @tiptap/static-renderer's json/html-string entry — a PURE function (no DOM,
// no jsdom, no react at runtime) that turns ProseMirror JSON into an HTML
// string via explicit node/mark mappings, exactly mirroring docxSerializer's
// convertNode/convertInlineContent switch. shared/ stays dependency-light:
// the only import is the static renderer (pure JS, zero runtime deps).
//
// SCOPE (Phase A): standard prose nodes + marks + the existing inline atoms
// render faithfully. The CHARACTERISTIC magazine design — drop caps, columns,
// pull-quotes, callouts, margin notes — is NOT here yet: design constructs
// live in opaque `typstRawBlock` atoms and are emitted as placeholders until
//   • the token → CSS generator (styleToCss)            — Phase B
//   • the raw-block reparser (classifyRawBlock → HTML)  — Phase D
//   • the design AST nodes (the keystone)               — Phase C
// land. This module's job today is to PROVE the pipe and be the place those
// phases plug into.

import { renderJSONContentToString, serializeChildrenToHTMLString } from '@tiptap/static-renderer/json/html-string';
import { parseTypstGrid, type GridItem } from './typstGrid';

interface JSONNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: JSONNode[];
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  text?: string;
}

/**
 * Generic, framework-neutral article metadata — the only cross-consumer
 * contract. Maps onto most static-site / CMS conventions; the consumer decides
 * how to use it. The bundle writer (main process) also emits this as meta.json.
 */
export interface ArticleMeta {
  title?: string;
  description?: string;
  date?: string;
  tags?: string[];
  cover?: string;
  accent?: string;
  locale?: string;
  [key: string]: unknown;
}

export interface SerializeHtmlOptions {
  /** Slug for the `data-article` attribute (and the bundle dir). */
  slug?: string;
  /** Scoped CSS to inline at the top of the article. styleToCss fills this in Phase B. */
  scopedCss?: string;
  /**
   * Output mode — the agnostic model (web-export-feasibility-and-plan.md §7.2):
   *  - 'fragment' (default): just `<article class="pw-article">…</article>` plus
   *    its inline scoped <style>. Embed into ANY host (Astro `set:html`, a
   *    WordPress/Ghost HTML block, React `dangerouslySetInnerHTML`, …) with no
   *    CSS collision.
   *  - 'document': the same fragment wrapped in a full `<!doctype html>` page →
   *    opens standalone in any browser, hostable as a plain file.
   * (Assets-as-folder vs. data-URI-inline and the meta.json sidecar are the
   * bundle writer's job — see Phase B.3 — not this pure string serializer.)
   */
  mode?: 'fragment' | 'document';
  /** Metadata for the `<head>` in 'document' mode (and the bundle's meta.json). */
  meta?: ArticleMeta;
}

/** HTML-escapes a text run (the static renderer does NOT auto-escape text). */
function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Escapes a value destined for a double-quoted HTML attribute. */
function escAttr(s: string): string {
  return esc(s).replace(/"/g, '&quot;');
}

// ─── URL / CSS-value sanitizers (the output is published HTML, embedded into
// arbitrary host sites — so href/src schemes and inline-style values from a
// (possibly untrusted, externally-authored) document must be neutralised). ───

/**
 * Neutralises dangerous URL schemes for an `href`. Allows http(s)/mailto/tel/ftp,
 * in-page `#fragments`, and relative/absolute paths; `javascript:`/`data:text/html`/
 * `vbscript:`/etc. → '' (drop). Control + whitespace chars are stripped before the
 * scheme test so `java\tscript:` / `java\nscript:` can't slip through.
 */
function safeUrl(raw: unknown): string {
  const u = String(raw ?? '').trim();
  const probe = u.replace(/[\x00-\x20]+/g, '').toLowerCase();
  if (/^(https?:|mailto:|tel:|ftp:)/.test(probe)) return u;   // safe explicit scheme
  if (/^[#/]/.test(u) || /^\.{1,2}\//.test(u)) return u;      // fragment / relative / absolute path
  if (/^[a-z][a-z0-9+.-]*:/.test(probe)) return '';           // any other scheme → drop
  return u;                                                   // schemeless relative (e.g. assets/x.png)
}

/** Like {@link safeUrl} but additionally permits `data:image/*` (for inlined assets). */
function safeImgSrc(raw: unknown): string {
  const u = String(raw ?? '').trim();
  if (/^data:image\//i.test(u.replace(/\s+/g, ''))) return u;
  return safeUrl(u);
}

/** A CSS color safe to drop into an inline `style=`: hex / rgb()/hsl()/color-mix() /
 *  bare named color. Anything carrying `;`/`<`/`{`/quotes (declaration- or
 *  tag-breakout) → null (omit the style). */
function safeCssColor(raw: unknown): string | null {
  const s = String(raw ?? '').trim();
  if (/^#[0-9a-fA-F]{3,8}$/.test(s)) return s;
  if (/^(rgb|rgba|hsl|hsla|color-mix)\([^;<>{}"']*\)$/i.test(s)) return s;
  if (/^[a-zA-Z]{1,30}$/.test(s)) return s; // named color
  return null;
}

/** A CSS length/percentage safe for an inline `style="width:…"`, else null. */
function safeCssLen(raw: unknown): string | null {
  const s = String(raw ?? '').trim();
  return /^\d+(\.\d+)?(px|em|rem|%|ch|vw|vh|pt|cm|mm|in)$/.test(s) ? s : null;
}

const kids = serializeChildrenToHTMLString;

// ─── Raw-block reparser (Phase B slice: drop cap + callout) ────────────────
// The characteristic design lives in opaque `typstRawBlock` atoms. The full
// reparser (math / ad-hoc #figure / leftover layout) + the design AST nodes
// (the keystone) are Phase C/D; here we recognise the two slice elements and
// emit real, themeable HTML, falling back to a placeholder for the rest.

const CALLOUT_NAMES = new Set([
  'info', 'tip', 'warning', 'note', 'memo', 'success', 'error', 'task',
  'question', 'conclusion', 'important', 'abstract', 'example',
]);

/** Depth-aware bracket match — returns the inner slice + index past the close.
 *  String-aware: brackets inside `"…"` (e.g. a `)` in a `title:"a (b)"` arg or a
 *  link URL) don't affect the depth count. */
function matchBracket(s: string, open: number, oc: string, cc: string): { inner: string; end: number } | null {
  if (s[open] !== oc) return null;
  let depth = 0, inStr = false;
  for (let i = open; i < s.length; i++) {
    const c = s[i];
    if (inStr) { if (c === '\\') i++; else if (c === '"') inStr = false; continue; }
    if (c === '"') { inStr = true; continue; }
    if (c === oc) depth++;
    else if (c === cc) { depth--; if (depth === 0) return { inner: s.slice(open + 1, i), end: i + 1 }; }
  }
  return null;
}

/** For `#name(...)?[body]`, returns `{ args, body }` skipping the optional
 *  `(...)` arg group so a `[` or `)` inside args doesn't get mistaken for the
 *  body bracket. `nameEnd` = index just past `#name`. null if no body bracket. */
function macroBody(t: string, nameEnd: number): { args: string; body: string } | null {
  let j = nameEnd;
  while (/\s/.test(t[j] ?? '')) j++;
  let args = '';
  if (t[j] === '(') { const a = matchBracket(t, j, '(', ')'); if (!a) return null; args = a.inner; j = a.end; }
  while (/\s/.test(t[j] ?? '')) j++;
  if (t[j] !== '[') return null;
  const b = matchBracket(t, j, '[', ']');
  return b ? { args, body: b.inner } : null;
}

const isWordChar = (c: string | undefined) => !!c && /\w/.test(c);

/** Finds a closing emphasis delimiter on the same line whose preceding char is
 *  not whitespace and which is not word-flanked on its outer side (Typst's
 *  boundary rule). -1 if none qualifies. */
function findEmphClose(src: string, from: number, delim: string): number {
  for (let i = from; i < src.length; i++) {
    if (src[i] === '\n') return -1;
    if (src[i] === delim && !/\s/.test(src[i - 1] ?? ' ') && !isWordChar(src[i + 1])) return i;
  }
  return -1;
}

/** Minimal inline-Typst → HTML for reparsed bodies (text + bold/italic/code +
 *  #emph/#strong/#raw/#link; unknown #fn() preserves its bracketed content —
 *  the web wants the words, not a drop). A subset of the Phase-D full port. */
function inlineTypstToHtml(src: string): string {
  let i = 0, out = '', buf = '';
  const flush = () => { out += esc(buf); buf = ''; };
  while (i < src.length) {
    const ch = src[i];
    if (ch === '\\' && i + 1 < src.length) { buf += src[i + 1]; i += 2; continue; }
    if (ch === '#') {
      const m = src.slice(i).match(/^#([a-zA-Z][\w.-]*)/);
      if (m) {
        const name = m[1];
        let j = i + 1 + name.length, args = '';
        if (src[j] === '(') { const a = matchBracket(src, j, '(', ')'); if (a) { args = a.inner; j = a.end; } }
        let inner: string | null = null;
        if (src[j] === '[') { const b = matchBracket(src, j, '[', ']'); if (b) { inner = b.inner; j = b.end; } }
        flush();
        out += inlineFunc(name, args, inner);
        i = j;
        continue;
      }
    }
    if (ch === '*' || ch === '_') {
      // Typst boundary rule: open emphasis only when the delimiter isn't
      // word-flanked on its inner side and the next char isn't whitespace — so
      // `snake_case` / `my_var` and `5 * 3` stay literal, not cross-word markup.
      if (!isWordChar(src[i - 1]) && src[i + 1] !== undefined && !/\s/.test(src[i + 1])) {
        const c = findEmphClose(src, i + 1, ch);
        if (c > i) { flush(); const tag = ch === '*' ? 'strong' : 'em'; out += `<${tag}>${inlineTypstToHtml(src.slice(i + 1, c))}</${tag}>`; i = c + 1; continue; }
      }
    }
    if (ch === '`') { const c = src.indexOf('`', i + 1); if (c > i) { flush(); out += `<code>${esc(src.slice(i + 1, c))}</code>`; i = c + 1; continue; } }
    buf += ch; i++;
  }
  flush();
  return out;
}

function inlineFunc(name: string, args: string, inner: string | null): string {
  switch (name) {
    case 'emph': return inner !== null ? `<em>${inlineTypstToHtml(inner)}</em>` : '';
    case 'strong': return inner !== null ? `<strong>${inlineTypstToHtml(inner)}</strong>` : '';
    case 'raw': { const m = args.match(/"((?:[^"\\]|\\.)*)"/); return `<code>${esc(m ? m[1].replace(/\\"/g, '"') : (inner ?? ''))}</code>`; }
    case 'link': { const m = args.match(/"([^"]+)"/); const raw = m ? m[1] : ''; const href = safeUrl(raw); const text = inner !== null ? inlineTypstToHtml(inner) : esc(raw); return href ? `<a href="${escAttr(href)}">${text}</a>` : text; }
    case 'footnote': return ''; // footnotes inside a reparsed body are dropped in the slice
    default: return inner !== null ? inlineTypstToHtml(inner) : '';
  }
}

/** Splits a reparsed block body into <p>s at blank lines. */
function bodyToParagraphs(body: string): string {
  return body.trim().split(/\n\s*\n/)
    .map((p) => `<p>${inlineTypstToHtml(p.replace(/\s+/g, ' ').trim())}</p>`)
    .filter((p) => p !== '<p></p>')
    .join('');
}

/**
 * Recognises the Phase-B design elements inside a raw block and emits real
 * `.pw-callout` / `.pw-dropcap` HTML; returns null for everything else (→ the
 * placeholder). gentle-clues callouts (`#info[…]`, `#warning(title:"x")[…]`)
 * and drop caps (`#dropcap(…)[…]`, plus the LANGSAM `#lead[…]` alias).
 */
function reparseRawBlock(content: string): string | null {
  const t = content.trim();

  // gentle-clues callout: #info[…] / #warning(title:"x")[…]. macroBody skips the
  // `(…)` arg group, so a `)` in the title or a `[` in the args no longer drops
  // the whole callout / grabs the wrong body bracket.
  const nameM = t.match(/^#([a-z][a-z0-9]*)/);
  if (nameM && CALLOUT_NAMES.has(nameM[1])) {
    const mb = macroBody(t, nameM[0].length);
    if (mb) {
      const titleM = mb.args.match(/title:\s*"((?:[^"\\]|\\.)*)"/);
      const title = titleM ? `<p class="pw-callout-title">${esc(titleM[1].replace(/\\"/g, '"'))}</p>` : '';
      return `<aside class="pw-callout" data-tone="${escAttr(nameM[1])}">${title}${bodyToParagraphs(mb.body)}</aside>`;
    }
  }

  // drop cap: #dropcap(…)[…] (droplet) and the LANGSAM #lead[…] alias.
  const dcM = t.match(/^#(dropcap|lead)\b/);
  if (dcM) {
    const mb = macroBody(t, dcM[0].length);
    if (mb) return `<p class="pw-dropcap">${inlineTypstToHtml(mb.body.replace(/\s+/g, ' ').trim())}</p>`;
  }

  // Generic #grid(...) two-up (interview head etc., §7.4): reinterpret the cells
  // as a responsive stacked grid (content-complete). The grid stays a raw block
  // for PDF; this is the web view of it.
  const grid = parseTypstGrid(content);
  if (grid) return renderGridHtml(grid);

  return null;
}

/** Renders a parsed `#grid` as a responsive `.pw-grid` of `.pw-grid-cell`s. */
function renderGridHtml(grid: { cells: GridItem[][] }): string {
  const cell = (items: GridItem[]) =>
    `<div class="pw-grid-cell">${items.map(renderGridItem).join('')}</div>`;
  return `<div class="pw-grid" style="--pw-grid-cols:${grid.cells.length}">${grid.cells.map(cell).join('')}</div>`;
}

function renderGridItem(it: GridItem): string {
  switch (it.kind) {
    case 'question':
      return `<p class="pw-question">${inlineTypstToHtml((it.body ?? '').replace(/\s+/g, ' ').trim())}</p>`;
    case 'box': {
      const title = it.title ? `<p class="pw-callout-title">${esc(it.title)}</p>` : '';
      return `<aside class="pw-callout">${title}${bodyToParagraphs(it.body ?? '')}</aside>`;
    }
    case 'image':
      return it.path ? `<img class="pw-fp-img" src="${escAttr(safeImgSrc(it.path))}" alt="">` : '';
    case 'caption':
      return `<p class="pw-fp-caption">${inlineTypstToHtml((it.body ?? '').replace(/\s+/g, ' ').trim())}</p>`;
    default:
      return bodyToParagraphs(it.body ?? '');
  }
}

const renderBody = renderJSONContentToString({
  nodeMapping: {
    doc: ({ children }: any) => kids(children),

    paragraph: ({ children }: any) => `<p>${kids(children)}</p>`,

    heading: ({ node, children }: any) => {
      const level = Math.min(Math.max(Number(node.attrs?.level) || 1, 1), 6);
      // A Typst label (`<sec:x>`) becomes the heading's HTML id so in-page
      // cross-references resolve — the web analogue of the Typst label.
      const label = node.attrs?.label ? ` id="${escAttr(String(node.attrs.label))}"` : '';
      return `<h${level}${label}>${kids(children)}</h${level}>`;
    },

    text: ({ node }: any) => esc(node.text ?? ''),
    hardBreak: () => '<br>',

    bulletList: ({ children }: any) => `<ul>${kids(children)}</ul>`,
    orderedList: ({ children }: any) => `<ol>${kids(children)}</ol>`,
    listItem: ({ children }: any) => `<li>${kids(children)}</li>`,

    blockquote: ({ children }: any) => `<blockquote>${kids(children)}</blockquote>`,
    codeBlock: ({ node, children }: any) => {
      const lang = node.attrs?.language ? ` class="language-${escAttr(String(node.attrs.language))}"` : '';
      return `<pre><code${lang}>${kids(children)}</code></pre>`;
    },
    horizontalRule: () => '<hr>',

    image: ({ node }: any) => {
      const src = escAttr(safeImgSrc(node.attrs?.src));
      const len = safeCssLen(node.attrs?.width);
      const w = len ? ` style="width:${len}"` : '';
      return `<img src="${src}" alt=""${w}>`;
    },

    table: ({ children }: any) => `<table>${kids(children)}</table>`,
    tableRow: ({ children }: any) => `<tr>${kids(children)}</tr>`,
    tableCell: ({ children }: any) => `<td>${kids(children)}</td>`,
    tableHeader: ({ children }: any) => `<th>${kids(children)}</th>`,

    // Inline atoms -----------------------------------------------------------
    citation: ({ node }: any) => {
      const key = String(node.attrs?.citekey ?? '');
      return `<a class="pw-cite" href="#cite-${escAttr(key)}">[${esc(key)}]</a>`;
    },
    reference: ({ node }: any) => {
      const label = String(node.attrs?.label ?? '');
      return `<a class="pw-ref" href="#${escAttr(label)}">${esc(label)}</a>`;
    },
    footnote: ({ node }: any) =>
      `<sup class="pw-fn" title="${escAttr(String(node.attrs?.content ?? ''))}">*</sup>`,

    // Magazine AST nodes (Phase C keystone) — real, themeable semantic HTML.
    // These replace the opaque-raw-block placeholders for the load-bearing
    // magazine constructs (opener / lead / pull / frage / notiz / bildtafel /
    // randnotiz + #columns). Styled by styleToCss's `.pw-*` rules.
    articleHeader: ({ node }: any) => {
      const a = node.attrs ?? {};
      const id = a.label ? ` id="${escAttr(String(a.label))}"` : '';
      const parts = ['<header class="pw-opener">'];
      if (a.kicker) parts.push(`<p class="pw-opener-kicker">${esc(String(a.kicker))}</p>`);
      parts.push(`<h1 class="pw-opener-title"${id}>${esc(String(a.title ?? ''))}</h1>`);
      if (a.standfirst) parts.push(`<p class="pw-opener-standfirst">${esc(String(a.standfirst))}</p>`);
      if (a.byline) parts.push(`<p class="pw-opener-byline">${esc(String(a.byline))}</p>`);
      parts.push('</header>');
      return parts.join('');
    },
    dropCap: ({ children }: any) => `<p class="pw-dropcap">${kids(children)}</p>`,
    question: ({ children }: any) => `<p class="pw-question">${kids(children)}</p>`,
    pullQuote: ({ node, children }: any) => {
      const who = node.attrs?.who ? `<cite class="pw-pull-who">${esc(String(node.attrs.who))}</cite>` : '';
      return `<blockquote class="pw-pull"><p class="pw-pull-body">${kids(children)}</p>${who}</blockquote>`;
    },
    callout: ({ node, children }: any) => {
      const title = node.attrs?.title ? `<p class="pw-callout-title">${esc(String(node.attrs.title))}</p>` : '';
      return `<aside class="pw-callout">${title}${kids(children)}</aside>`;
    },
    figurePanel: ({ node, children }: any) => {
      const a = node.attrs ?? {};
      const src = a.path ? `<img class="pw-fp-img" src="${escAttr(safeImgSrc(a.path))}" alt="">` : '';
      const cap = a.caption ? `<figcaption class="pw-fp-caption">${inlineTypstToHtml(String(a.caption))}</figcaption>` : '';
      const title = a.title ? `<p class="pw-fp-title">${esc(String(a.title))}</p>` : '';
      return `<figure class="pw-figure-panel"><div class="pw-fp-media">${src}${cap}</div><aside class="pw-fp-note">${title}${kids(children)}</aside></figure>`;
    },
    interlude: () => '<hr class="pw-interlude">',
    columns: ({ node, children }: any) => {
      const cols = Math.min(Math.max(Number(node.attrs?.cols) || 2, 1), 6);
      const gap = safeCssLen(node.attrs?.gutter);
      // Custom props (not direct column-count) so the responsive @media rule in
      // styleToCss can collapse to a single column on narrow screens — an inline
      // `column-count` would win over any stylesheet rule.
      const style = ` style="--pw-cols:${cols}${gap ? `;--pw-gap:${gap}` : ''}"`;
      return `<div class="pw-columns"${style}>${kids(children)}</div>`;
    },
    // marginNote is an inline atom (raw-string body) — reparse its body to HTML.
    marginNote: ({ node }: any) =>
      `<aside class="pw-margin-note">${inlineTypstToHtml(String(node.attrs?.body ?? ''))}</aside>`,

    // Block atoms — placeholders until the later phases fill them in ----------
    // Web has no page break; drop it from the reading flow.
    pagebreak: () => '',
    // The bibliography is rendered by the pre-pass in a later phase.
    bibliography: () => '<!-- pw:bibliography (Phase D) -->',
    // Opaque Typst design/layout. The Phase-B reparser handles drop caps +
    // callouts; the rest become real HTML via the full raw-block reparser
    // (Phase D) and the design AST nodes (Phase C). Until then, unrecognised
    // blocks emit a non-visible placeholder rather than leaking macro source.
    typstRawBlock: ({ node }: any) =>
      reparseRawBlock(String(node.attrs?.content ?? '')) ??
      `<!-- pw:typst-raw blockType=${escAttr(String(node.attrs?.blockType ?? 'raw'))} (Phase C/D) -->`,
  },
  markMapping: {
    bold: ({ children }: any) => `<strong>${kids(children)}</strong>`,
    italic: ({ children }: any) => `<em>${kids(children)}</em>`,
    code: ({ children }: any) => `<code>${kids(children)}</code>`,
    strike: ({ children }: any) => `<s>${kids(children)}</s>`,
    underline: ({ children }: any) => `<u>${kids(children)}</u>`,
    superscript: ({ children }: any) => `<sup>${kids(children)}</sup>`,
    subscript: ({ children }: any) => `<sub>${kids(children)}</sub>`,
    smallcaps: ({ children }: any) => `<span style="font-variant:small-caps">${kids(children)}</span>`,
    highlight: ({ mark, children }: any) => {
      const col = safeCssColor(mark.attrs?.color);
      const c = col ? ` style="background:${col}"` : '';
      return `<mark${c}>${kids(children)}</mark>`;
    },
    textColor: ({ mark, children }: any) => {
      const col = safeCssColor(mark.attrs?.color);
      const c = col ? ` style="color:${col}"` : '';
      return `<span${c}>${kids(children)}</span>`;
    },
    link: ({ mark, children }: any) => {
      const href = safeUrl(mark.attrs?.href);
      return href ? `<a href="${escAttr(href)}">${kids(children)}</a>` : kids(children);
    },
  },
  // Never throw on an unmapped construct: degrade to its visible children
  // (marks) or an HTML comment (nodes), so a single new node type can't break
  // a whole export.
  unhandledNode: ({ node }: any) => `<!-- pw:unhandled-node ${esc(String(node?.type ?? 'unknown'))} -->`,
  unhandledMark: ({ children }: any) => kids(children),
});

/**
 * Serializes a TipTap document to a self-contained, semantic HTML article:
 * `<article class="pw-article">` wrapping an inline scoped `<style>` and the
 * rendered body. Standalone-valid (opens in any browser) and embeddable (the
 * scoped style never collides with a host site). styleToCss (Phase B) supplies
 * the real CSS; for now the style block is a placeholder.
 */
export function serializeHtml(doc: JSONNode, opts: SerializeHtmlOptions = {}): string {
  const body = renderBody({ content: doc as any });
  const slug = opts.slug ? ` data-article="${escAttr(opts.slug)}"` : '';
  // Defense-in-depth: styleToCss already validates its token inputs, but never
  // let a literal close-style tag in the CSS break out of the <style> element.
  const css = (opts.scopedCss ?? '').replace(/<\/(style)/gi, '<\\/$1');
  const style = css ? `\n<style>\n${css}\n</style>\n` : '\n<style></style>\n';
  const article = `<article class="pw-article"${slug}>${style}${body}</article>`;
  return opts.mode === 'document' ? wrapDocument(article, opts.meta) : article;
}

/**
 * Wraps a self-contained article in a minimal, valid HTML5 page so it opens
 * standalone in any browser and can be hosted as a plain file. The article's
 * own scoped <style> still does all the styling — this only adds the page
 * shell + <head> metadata (incl. Open Graph tags for shareable links).
 */
function wrapDocument(article: string, meta: ArticleMeta = {}): string {
  const lang = meta.locale ? ` lang="${escAttr(String(meta.locale))}"` : '';
  const head = [
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    meta.title ? `<title>${esc(String(meta.title))}</title>` : '',
    meta.description ? `<meta name="description" content="${escAttr(String(meta.description))}">` : '',
    meta.title ? `<meta property="og:title" content="${escAttr(String(meta.title))}">` : '',
    meta.description ? `<meta property="og:description" content="${escAttr(String(meta.description))}">` : '',
    meta.cover && safeUrl(meta.cover) ? `<meta property="og:image" content="${escAttr(safeUrl(meta.cover))}">` : '',
  ].filter(Boolean).join('\n  ');
  return `<!doctype html>\n<html${lang}>\n<head>\n  ${head}\n</head>\n<body>\n${article}\n</body>\n</html>\n`;
}
