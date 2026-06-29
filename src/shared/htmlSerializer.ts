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

/** Depth-aware bracket match — returns the inner slice + index past the close. */
function matchBracket(s: string, open: number, oc: string, cc: string): { inner: string; end: number } | null {
  if (s[open] !== oc) return null;
  let depth = 0;
  for (let i = open; i < s.length; i++) {
    if (s[i] === oc) depth++;
    else if (s[i] === cc) { depth--; if (depth === 0) return { inner: s.slice(open + 1, i), end: i + 1 }; }
  }
  return null;
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
    if (ch === '*') { const c = src.indexOf('*', i + 1); if (c > i) { flush(); out += `<strong>${inlineTypstToHtml(src.slice(i + 1, c))}</strong>`; i = c + 1; continue; } }
    if (ch === '_') { const c = src.indexOf('_', i + 1); if (c > i) { flush(); out += `<em>${inlineTypstToHtml(src.slice(i + 1, c))}</em>`; i = c + 1; continue; } }
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
    case 'link': { const m = args.match(/"([^"]+)"/); const href = m ? m[1] : ''; return `<a href="${escAttr(href)}">${inner !== null ? inlineTypstToHtml(inner) : esc(href)}</a>`; }
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

  const cm = t.match(/^#([a-z][a-z0-9]*)\s*(?:\(([^)]*)\))?\s*\[/);
  if (cm && CALLOUT_NAMES.has(cm[1])) {
    const name = cm[1];
    const titleM = (cm[2] ?? '').match(/title:\s*"((?:[^"\\]|\\.)*)"/);
    const b = matchBracket(t, t.indexOf('['), '[', ']');
    if (b) {
      const title = titleM ? `<p class="pw-callout-title">${esc(titleM[1].replace(/\\"/g, '"'))}</p>` : '';
      return `<aside class="pw-callout" data-tone="${escAttr(name)}">${title}${bodyToParagraphs(b.inner)}</aside>`;
    }
  }

  if (/^#(dropcap|lead)\b/.test(t)) {
    const open = t.indexOf('[');
    const b = open >= 0 ? matchBracket(t, open, '[', ']') : null;
    if (b) return `<p class="pw-dropcap">${inlineTypstToHtml(b.inner.replace(/\s+/g, ' ').trim())}</p>`;
  }

  return null;
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
      const src = escAttr(String(node.attrs?.src ?? ''));
      const w = node.attrs?.width ? ` style="width:${escAttr(String(node.attrs.width))}"` : '';
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
      const c = mark.attrs?.color ? ` style="background:${escAttr(String(mark.attrs.color))}"` : '';
      return `<mark${c}>${kids(children)}</mark>`;
    },
    textColor: ({ mark, children }: any) => {
      const c = mark.attrs?.color ? ` style="color:${escAttr(String(mark.attrs.color))}"` : '';
      return `<span${c}>${kids(children)}</span>`;
    },
    link: ({ mark, children }: any) => {
      const href = escAttr(String(mark.attrs?.href ?? ''));
      return `<a href="${href}">${kids(children)}</a>`;
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
  const style = opts.scopedCss
    ? `\n<style>\n${opts.scopedCss}\n</style>\n`
    : '\n<style>/* pw scoped styles — styleToCss lands in Phase B */</style>\n';
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
    meta.cover ? `<meta property="og:image" content="${escAttr(String(meta.cover))}">` : '',
  ].filter(Boolean).join('\n  ');
  return `<!doctype html>\n<html${lang}>\n<head>\n  ${head}\n</head>\n<body>\n${article}\n</body>\n</html>\n`;
}
