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

export interface SerializeHtmlOptions {
  /** Slug used for the `data-article` attribute (and, later, the bundle dir). */
  slug?: string;
  /** Scoped CSS to inline at the top of the article. styleToCss fills this in Phase B. */
  scopedCss?: string;
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
    // Opaque Typst design/layout. The raw-block reparser (Phase D) and the
    // design AST nodes (Phase C) turn these into real drop caps / columns /
    // pull-quotes / callouts. Until then, emit a non-visible placeholder
    // rather than leaking macro source into the page.
    typstRawBlock: ({ node }: any) =>
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
  return `<article class="pw-article"${slug}>${style}${body}</article>`;
}
