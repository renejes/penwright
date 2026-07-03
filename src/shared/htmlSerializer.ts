// TipTap JSON → self-contained semantic HTML serializer.
//
// Built on @tiptap/static-renderer's json/html-string entry — a PURE function
// (no DOM, no jsdom, no react at runtime) that turns ProseMirror JSON into an
// HTML string via explicit node/mark mappings, mirroring docxSerializer's
// convertNode/convertInlineContent switch.
//
// ── Phase D (web-export-feasibility-and-plan.md §Phase D): inhaltliche Breite ──
// serializeHtml stays SYNC + PURE (no fs, no async, no Electron). The parts
// that need a Typst run (display-math → SVG) or a doc-wide pre-pass (cross-ref
// numbering, citation style, bibliography) are computed in the MAIN process and
// handed in as an `HtmlExportContext` (opts.context) — exactly the docxSerializer
// pattern (its async buildExportContext + injected renderTypstSnippet). This
// module only READS the finished maps. The shared, format-agnostic analysis
// (classifyRawBlock, refWords, citationInner, bib formatting, …) lives in
// `exportContext.ts`, the single source of truth shared with the DOCX export.

import { renderJSONContentToString, serializeChildrenToHTMLString } from '@tiptap/static-renderer/json/html-string';
import { parseTypstGrid, type GridItem } from './typstGrid';
import { parseHero, type HeroSpec } from './typstHero';
import {
  classifyRawBlock,
  splitDesignChunks,
  refWords,
  citationInner,
  cleanBibText,
  formatBibAuthors,
  bibLabel,
  renderEqNumber,
  type RawDesc,
  type RefTarget,
} from './exportContext';
import type { BibEntry } from './bibParser';

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

/**
 * The resolved, doc-wide export context built by the async pre-pass in the main
 * process (importExport.runWebExport): cross-reference numbers, citation style,
 * the loaded bibliography, and the display-math SVGs (rendered by the bundled
 * Typst). serializeHtml reads it synchronously — it never renders anything
 * itself. Absent → the serializer degrades to readable fallbacks (raw citekeys,
 * a text math fallback, no bibliography section).
 */
export interface HtmlExportContext {
  /** label → cross-reference target (figure/table/equation/heading numbers). */
  labelMap: Map<string, RefTarget>;
  citationMode: 'author-year' | 'numeric';
  numericOrder: string[];
  equationNumbering: boolean;
  /** Typst equation-number pattern (e.g. "(1)"). */
  eqPattern: string;
  /** Parsed bibliography entries (empty if the doc has no #bibliography). */
  bibEntries: BibEntry[];
  /** Optional title from `#bibliography(title:"…")` — overrides the default heading. */
  bibTitle?: string;
  /** Display-math `$…$` (RawDesc.tex) → rendered, sanitised inline SVG. */
  mathSvg: Map<string, string>;
  /** Document language (ISO short code) for the localized reference words. */
  lang: string;
  /**
   * What the project's `#lead[…]` macro means (styleInference.detectLeadStyle):
   * LANGSAM's lead is a droplet drop cap; other templates use `lead` for a
   * standfirst/Anreißer paragraph. Default 'dropcap'.
   */
  leadStyle?: 'dropcap' | 'standfirst';
  /**
   * False when the source sets `#set figure(numbering: none)` — captions then
   * render WITHOUT the "Figure N" / "Abbildung N" label, matching the PDF.
   * Default true.
   */
  figureNumbering?: boolean;
}

export interface SerializeHtmlOptions {
  /** Slug for the `data-article` attribute (and the bundle dir). */
  slug?: string;
  /** Scoped CSS to inline at the top of the article (styleToCss fills this). */
  scopedCss?: string;
  /**
   * Output mode — the agnostic model (web-export-feasibility-and-plan.md §7.2):
   *  - 'fragment' (default): just `<article class="pw-article">…</article>` plus
   *    its inline scoped <style>. Embed into ANY host (Astro `set:html`, a
   *    WordPress/Ghost HTML block, React `dangerouslySetInnerHTML`, …).
   *  - 'document': the same fragment wrapped in a full `<!doctype html>` page.
   */
  mode?: 'fragment' | 'document';
  /** Metadata for the `<head>` in 'document' mode (and the bundle's meta.json). */
  meta?: ArticleMeta;
  /** Resolved cross-refs / citations / footnotes / bibliography / math (Phase D). */
  context?: HtmlExportContext;
  /**
   * Page background for 'document' mode — fills the WHOLE standalone page (the
   * viewport behind the centered article), not just the article column. Only
   * applied in 'document' mode; 'fragment' mode never touches the host's page.
   */
  pageBackground?: string;
  /**
   * Section-style (Kapitel-Look) id this article opted into via
   * `#show: <id>-style` — adds `pw-section-<id>` to the article element so the
   * styleToCss overlay rules apply. Mini-site pages only (one page = one
   * chapter); a merged single page keeps the global look.
   */
  sectionId?: string;
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
 *  bare named color. Anything carrying `;`/`<`/`{`/quotes → null (omit the style). */
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

/** Known label prefixes (heuristic: a colon OR an exact prefix → cross-reference,
 *  else citation) — mirrors docxSerializer's renderAtRef. Used by the inline
 *  Typst parser when an `@name` appears inside a reparsed raw-block body. */
const REF_PREFIXES = /^(fig|tbl|eq|sec|chap|app|thm|lem|def|cor|prop|algo|lst|figure|table|equation|section|chapter|appendix)\b/i;

// ─── Per-export render context ───────────────────────────────
// Built once per serializeHtml call. The static renderer renders depth-first in
// document order, so footnote / figure / table / equation counters advance in
// reading order (matching the pre-pass numbering in exportContext).

interface RenderCtx {
  ctx?: HtmlExportContext;
  footnotes: { n: number; html: string }[];
  fnCounter: number;
  figureCounter: number;
  tableCounter: number;
  equationCounter: number;
  bibRendered: boolean;
}

/** Records a footnote, returns its in-text `<sup>` reference markup. */
function addFootnote(rc: RenderCtx, bodyHtml: string): string {
  const n = ++rc.fnCounter;
  rc.footnotes.push({ n, html: bodyHtml });
  return `<sup class="pw-fn" id="fnref-${n}"><a href="#fn-${n}">${n}</a></sup>`;
}

// ─── Inline string-bracket matcher (for the inline-Typst reparser) ──────────

/** Depth-aware bracket match — returns the inner slice + index past the close.
 *  String-aware: brackets inside `"…"` don't affect the depth count. */
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
 *  `(...)` arg group. `nameEnd` = index just past `#name`. null if no body. */
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
 *  not whitespace and which is not word-flanked on its outer side. -1 if none. */
function findEmphClose(src: string, from: number, delim: string): number {
  for (let i = from; i < src.length; i++) {
    if (src[i] === '\n') return -1;
    if (src[i] === delim && !/\s/.test(src[i - 1] ?? ' ') && !isWordChar(src[i + 1])) return i;
  }
  return -1;
}

/** Minimal inline-Typst → HTML for reparsed raw-block bodies: text + bold/italic/
 *  code + #emph/#strong/#raw/#link, plus `@cite`/`@ref` (resolved via the export
 *  context) and inline `#footnote[…]` (collected into the article's footnotes).
 *  Unknown `#fn()[…]` keeps its bracketed content (the web wants the words). */
function inlineTypstToHtml(src: string, rc?: RenderCtx): string {
  let i = 0, out = '', buf = '';
  const flush = () => { out += esc(buf); buf = ''; };
  while (i < src.length) {
    const ch = src[i];
    if (ch === '\\') {
      const next = src[i + 1];
      // Typst forced line break: `\` at end-of-line / before whitespace → <br>.
      if (next === undefined || /\s/.test(next)) { flush(); out += '<br>'; i += next === undefined ? 1 : 2; continue; }
      buf += next; i += 2; continue; // otherwise an escaped literal char
    }
    if (ch === '#') {
      const m = src.slice(i).match(/^#([a-zA-Z][\w.-]*)/);
      if (m) {
        const name = m[1];
        let j = i + 1 + name.length, args = '';
        if (src[j] === '(') { const a = matchBracket(src, j, '(', ')'); if (a) { args = a.inner; j = a.end; } }
        let inner: string | null = null;
        if (src[j] === '[') { const b = matchBracket(src, j, '[', ']'); if (b) { inner = b.inner; j = b.end; } }
        flush();
        out += inlineFunc(name, args, inner, rc);
        i = j;
        continue;
      }
    }
    if (ch === '@') {
      const m = src.slice(i).match(/^@([a-zA-Z][\w:.-]*)/);
      if (m) {
        flush();
        const name = m[1].replace(/[.:]+$/, ''); // trailing punctuation isn't part of the key
        if (rc) out += (name.includes(':') || REF_PREFIXES.test(name)) ? renderReferenceHtml(name, rc) : renderCitationGroupHtml([name], rc);
        else out += esc('@' + name);
        i += 1 + name.length;             // leave the trailing punctuation as text
        continue;
      }
    }
    if (ch === '*' || ch === '_') {
      // Typst boundary rule: open emphasis only when not word-flanked on the
      // inner side and the next char isn't whitespace (so `snake_case` / `5 * 3`
      // stay literal).
      if (!isWordChar(src[i - 1]) && src[i + 1] !== undefined && !/\s/.test(src[i + 1])) {
        const c = findEmphClose(src, i + 1, ch);
        if (c > i) { flush(); const tag = ch === '*' ? 'strong' : 'em'; out += `<${tag}>${inlineTypstToHtml(src.slice(i + 1, c), rc)}</${tag}>`; i = c + 1; continue; }
      }
    }
    if (ch === '`') { const c = src.indexOf('`', i + 1); if (c > i) { flush(); out += `<code>${esc(src.slice(i + 1, c))}</code>`; i = c + 1; continue; } }
    buf += ch; i++;
  }
  flush();
  return out;
}

const WEIGHT_NAMES: Record<string, string> = {
  thin: '100', extralight: '200', light: '300', regular: '400', normal: '400',
  medium: '500', semibold: '600', bold: '700', extrabold: '800', black: '900',
};

/** Maps a Typst color expression to a CSS color. `style-colors.<slot>` →
 *  `var(--pw-<slot>)` (re-themeable, the vars styleToCss defines); a literal
 *  hex/rgb passes through the safe-color filter; anything else → null. */
function mapTypstColor(expr: string): string | null {
  const slot = expr.match(/^style-colors\.([a-z]+)$/);
  if (slot && ['primary', 'accent', 'text', 'background', 'muted'].includes(slot[1])) return `var(--pw-${slot[1]})`;
  const rgb = expr.match(/^rgb\(\s*"([^"]+)"\s*\)$/);
  if (rgb) return safeCssColor(rgb[1]);
  return safeCssColor(expr);
}

/** Translates the visible bits of `#text(size:…, weight:…, style:…, fill:…)`
 *  args into an inline CSS `style=""` (re-themeable color, em/pt size, weight,
 *  italic). Returns '' if nothing visible. */
function typstTextStyle(args: string): string {
  const decls: string[] = [];
  const sizeM = args.match(/size:\s*([\d.]+)\s*(em|pt)\b/);
  if (sizeM) {
    const v = parseFloat(sizeM[1]);
    // pt → em relative to a magazine body of ~11pt; clamp so a hero size can't explode.
    const em = sizeM[2] === 'em' ? v : v / 11;
    if (isFinite(em) && em > 0) decls.push(`font-size:${Math.min(em, 6).toFixed(2)}em`);
  }
  const weightM = args.match(/weight:\s*"?([a-z]+|\d{3})"?/);
  if (weightM) { const w = WEIGHT_NAMES[weightM[1]] ?? (/^\d{3}$/.test(weightM[1]) ? weightM[1] : ''); if (w) decls.push(`font-weight:${w}`); }
  if (/style:\s*"italic"/.test(args)) decls.push('font-style:italic');
  const fillM = args.match(/fill:\s*([^,]+?)(?:,|$)/);
  if (fillM) { const c = mapTypstColor(fillM[1].trim()); if (c) decls.push(`color:${c}`); }
  const fontM = args.match(/font:\s*style-fonts\.(heading|body|code)\b/);
  if (fontM) decls.push(`font-family:var(--pw-font-${fontM[1]})`);
  return decls.join(';');
}

function inlineFunc(name: string, args: string, inner: string | null, rc?: RenderCtx): string {
  switch (name) {
    case 'emph': return inner !== null ? `<em>${inlineTypstToHtml(inner, rc)}</em>` : '';
    case 'strong': return inner !== null ? `<strong>${inlineTypstToHtml(inner, rc)}</strong>` : '';
    case 'super': return inner !== null ? `<sup>${inlineTypstToHtml(inner, rc)}</sup>` : '';
    case 'sub': return inner !== null ? `<sub>${inlineTypstToHtml(inner, rc)}</sub>` : '';
    case 'smallcaps': return inner !== null ? `<span style="font-variant:small-caps">${inlineTypstToHtml(inner, rc)}</span>` : '';
    case 'upper': { const m = args.match(/"((?:[^"\\]|\\.)*)"/); const txt = m ? m[1].replace(/\\"/g, '"') : (inner ?? ''); return `<span style="text-transform:uppercase">${inlineTypstToHtml(txt, rc)}</span>`; }
    case 'text': {
      // Carry the visible styling of `#text(size/weight/style/fill/font)[…]` so
      // title heroes / cover lines / pull-quotes keep their look on the web.
      if (inner === null) return '';
      const style = typstTextStyle(args);
      const body = inlineTypstToHtml(inner, rc);
      return style ? `<span style="${escAttr(style)}">${body}</span>` : body;
    }
    case 'raw': { const m = args.match(/"((?:[^"\\]|\\.)*)"/); return `<code>${esc(m ? m[1].replace(/\\"/g, '"') : (inner ?? ''))}</code>`; }
    case 'link': { const m = args.match(/"((?:[^"\\]|\\.)*)"/); const raw = m ? m[1].replace(/\\"/g, '"') : ''; const href = safeUrl(raw); const text = inner !== null ? inlineTypstToHtml(inner, rc) : esc(raw); return href ? `<a href="${escAttr(href)}">${text}</a>` : text; }
    case 'footnote': return inner !== null && rc ? addFootnote(rc, inlineTypstToHtml(inner, rc)) : '';
    case 'cite': { const m = args.match(/"?<?([a-zA-Z0-9_:.-]+)>?"?/); if (!m || !rc) return ''; const key = m[1].replace(/[.:]+$/, ''); return (key.includes(':') || REF_PREFIXES.test(key)) ? renderReferenceHtml(key, rc) : renderCitationGroupHtml([key], rc); }
    default: {
      if (inner !== null) return inlineTypstToHtml(inner, rc);
      // Unknown project macro with NO trailing body — its manuscript content
      // often sits in POSITIONAL content args: `#sumrow("Ziel", [Mehr …])`.
      // Dropping the call silently loses that text (the LM management-summary
      // rows vanished from the web). Render the bracketed content args; a
      // leading short positional string is the row's label → a bold prefix.
      return renderUnknownCallArgs(args, rc);
    }
  }
}

/** Content preservation for unknown `#macro(…)` calls (no trailing `[body]`):
 *  renders every positional `[content]` arg, prefixed by a first positional
 *  short-string arg as a label. Named string args (ids, paths, keys) are
 *  config, not content — never rendered. Returns '' when nothing qualifies. */
function renderUnknownCallArgs(args: string, rc?: RenderCtx): string {
  const parts: string[] = [];
  let label: string | undefined;
  let i = 0, argStart = 0, depth = 0, inStr = false, named = false, first = true;
  const consume = (raw: string, isNamed: boolean, isFirst: boolean) => {
    const t = raw.trim();
    if (!t) return;
    if (isNamed) return; // named args are configuration
    if (t.startsWith('[')) {
      const b = matchBracket(t, 0, '[', ']');
      if (b && b.inner.trim()) parts.push(inlineTypstToHtml(b.inner.replace(/\s+/g, ' ').trim(), rc));
      return;
    }
    const s = t.match(/^"((?:[^"\\]|\\.)*)"$/);
    if (s && isFirst && s[1].length >= 2 && s[1].length <= 60) label = s[1].replace(/\\"/g, '"');
  };
  for (; i < args.length; i++) {
    const ch = args[i];
    if (inStr) { if (ch === '\\') i++; else if (ch === '"') inStr = false; continue; }
    if (ch === '"') { inStr = true; continue; }
    if (ch === '(' || ch === '[' || ch === '{') depth++;
    else if (ch === ')' || ch === ']' || ch === '}') depth--;
    else if (ch === ':' && depth === 0) named = true;
    else if (ch === ',' && depth === 0) {
      consume(args.slice(argStart, i), named, first);
      argStart = i + 1; named = false; first = false;
    }
  }
  consume(args.slice(argStart), named, first);
  if (!parts.length) {
    // A LONE positional string can itself be the content (`#kicker("Management-
    // Summary")`) — render it when it reads like prose, not like an identifier/
    // path (`counter("lmm-chapter")`, `image("x.png")` must stay invisible).
    if (label && (label.includes(' ') || label.length >= 12) && !/[\\/]/.test(label) && !/\.[a-z0-9]{2,4}$/i.test(label)) {
      return esc(label);
    }
    return '';
  }
  const prefix = label ? `<strong>${esc(label)}</strong> — ` : '';
  return prefix + parts.join(' ');
}

/** Splits a reparsed block body into <p>s at blank lines. */
function bodyToParagraphs(body: string, rc?: RenderCtx): string {
  return body.trim().split(/\n\s*\n/)
    .map((p) => `<p>${inlineTypstToHtml(p.replace(/\s+/g, ' ').trim(), rc)}</p>`)
    .filter((p) => p !== '<p></p>')
    .join('');
}

/** True if the visible (de-tagged) text of a rendered chunk carries < 2 letters
 *  or digits — a pure layout tail (lone `]`, `#line()` divider, `* * *`). */
function isInvisibleChunk(html: string): boolean {
  const visible = html.replace(/<[^>]*>/g, '').replace(/&[a-z]+;/g, 'x').replace(/[^\p{L}\p{N}]+/gu, '');
  return visible.length < 2;
}

/** Renders design / prose chunks as styled <p>s (dropping content-free tails).
 *  A chunk that produced a real ANCHOR side effect (a footnote ref, citation, or
 *  cross-reference — inlineTypstToHtml already recorded the footnote into
 *  rc.footnotes) is kept even when its visible text is < 2 chars, so the
 *  in-text marker isn't dropped while its endnote/anchor lingers (orphan + dead
 *  back-link). */
function renderChunksHtml(chunks: string[], alignment: string | null, rc?: RenderCtx): string {
  const align = alignment && alignment !== 'left' ? ` style="text-align:${alignment}"` : '';
  return chunks.map((chunk) => {
    const html = inlineTypstToHtml(chunk.replace(/\s+/g, ' ').trim(), rc);
    const hasAnchor = /id="fnref-|class="pw-(cite|ref)"/.test(html);
    return (!isInvisibleChunk(html) || hasAnchor) ? `<p${align}>${html}</p>` : '';
  }).filter(Boolean).join('');
}

// ─── Cross-references / citations (resolved via the export context) ──────────

function renderReferenceHtml(label: string, rc: RenderCtx): string {
  const ctx = rc.ctx;
  const w = refWords(ctx?.lang ?? 'en');
  const t = ctx?.labelMap.get(label);
  let text: string;
  if (t) {
    if (t.kind === 'equation') text = t.numberText ?? `(${t.n})`;
    else if (t.kind === 'heading') text = `${w.section} ${t.numberText ?? t.n}`.trim();
    else { const word = t.kind === 'figure' ? w.figure : t.kind === 'table' ? w.table : ''; text = `${word} ${t.n}`.trim(); }
  } else {
    // Unknown label → readable fallback (strip the prefix).
    text = label.includes(':') ? label.split(':').slice(1).join(':') : label;
  }
  return `<a class="pw-ref" href="#${escAttr(label)}">${esc(text)}</a>`;
}

/** One citekey → `<a href="#cite-KEY">Author, Year</a>` (linked if the entry is
 *  known; a styled span otherwise so a typo stays visible, never a dead link). */
function citeAnchor(key: string, inner: string, ctx: HtmlExportContext): string {
  const known = ctx.bibEntries.some((e) => e.citekey === key);
  return known
    ? `<a class="pw-cite" href="#cite-${escAttr(key)}">${esc(inner)}</a>`
    : `<span class="pw-cite pw-cite-missing">${esc(inner)}</span>`;
}

/** Renders a (possibly multi-key) citation group — `(Bender et al., 2021; Smith,
 *  2020)` author-year or `[1, 2]` numeric — matching how Typst collapses `@a @b`.
 *  Without a context: raw `[citekey]` links (graceful degradation). */
function renderCitationGroupHtml(keys: string[], rc: RenderCtx): string {
  const ctx = rc.ctx;
  if (!ctx) return keys.map((k) => `<a class="pw-cite" href="#cite-${escAttr(k)}">[${esc(k)}]</a>`).join(' ');
  if (ctx.citationMode === 'numeric') {
    const parts = keys.map((k) => { const idx = ctx.numericOrder.indexOf(k); return citeAnchor(k, idx >= 0 ? String(idx + 1) : '?', ctx); });
    return `[${parts.join(', ')}]`;
  }
  const parts = keys.map((k) => citeAnchor(k, citationInner(k, ctx.bibEntries) ?? k, ctx));
  return `(${parts.join('; ')})`;
}

// ─── Footnotes + bibliography sections (appended after the body) ─────────────

function renderFootnotesSection(rc: RenderCtx): string {
  const items = rc.footnotes
    .map((f) => `<li id="fn-${f.n}">${f.html} <a class="pw-fn-back" href="#fnref-${f.n}" aria-label="Back to text">↩</a></li>`)
    .join('');
  return `<section class="pw-footnotes" role="doc-endnotes"><hr class="pw-footnotes-rule"><ol>${items}</ol></section>`;
}

/** APA-shaped reference entry — mirrors docxSerializer.formatBibEntryRuns. */
function formatBibEntryHtml(entry: BibEntry, prefix = ''): string {
  let s = '';
  if (prefix) s += esc(prefix);
  if (entry.author) s += esc(formatBibAuthors(entry.author));
  if (entry.year) s += esc(` (${entry.year}).`);
  if (entry.title) s += esc(` ${cleanBibText(entry.title)}.`);
  const venue = entry.fields['journal'] || entry.fields['booktitle'] || entry.fields['publisher'] || '';
  if (venue) s += ` <em>${esc(cleanBibText(venue))}</em>`;
  const vol = entry.fields['volume'];
  const num = entry.fields['number'];
  if (vol) s += esc(`, ${cleanBibText(vol)}${num ? `(${cleanBibText(num)})` : ''}`);
  const pages = entry.fields['pages'];
  if (pages) s += esc(`, ${cleanBibText(pages)}`);
  if (venue || vol || pages) s += '.';
  const doi = entry.fields['doi'];
  const url = entry.fields['url'];
  const link = doi ? `https://doi.org/${doi.replace(/^https?:\/\/doi\.org\//, '')}` : url;
  if (link) { const safe = safeUrl(link); s += safe ? ` <a class="pw-bib-link" href="${escAttr(safe)}">${esc(link)}</a>` : ` ${esc(link)}`; }
  return `<p class="pw-bib-entry" id="cite-${escAttr(entry.citekey)}">${s}</p>`;
}

/** Renders the bibliography section (`<section class="pw-bibliography">`).
 *  author-year → alphabetical; numeric → first-citation order with `[n]`. */
function renderBibliographyHtml(rc: RenderCtx): string {
  const ctx = rc.ctx;
  if (!ctx || !ctx.bibEntries.length) return '';
  rc.bibRendered = true;
  const heading = (ctx.bibTitle && ctx.bibTitle.trim()) || bibLabel(ctx.lang);
  let body = '';
  if (ctx.citationMode === 'numeric') {
    const ordered = [...ctx.numericOrder];
    for (const e of ctx.bibEntries) if (!ordered.includes(e.citekey)) ordered.push(e.citekey);
    ordered.forEach((key, i) => { const e = ctx.bibEntries.find((x) => x.citekey === key); if (e) body += formatBibEntryHtml(e, `[${i + 1}] `); });
  } else {
    const sorted = [...ctx.bibEntries].sort((a, b) => (a.author || '').localeCompare(b.author || ''));
    for (const e of sorted) body += formatBibEntryHtml(e);
  }
  return `<section class="pw-bibliography" id="pw-bibliography"><h2 class="pw-bibliography-title">${esc(heading)}</h2>${body}</section>`;
}

// ─── Display math (rendered to SVG by the main-process pre-pass) ─────────────

/**
 * Hardens a Typst-rendered SVG for INLINE embedding into the published article
 * (it executes in the page origin, not sandboxed in an <img>). The SVG is built
 * from author-controlled math source, so even though Typst itself is trusted,
 * a math block like `$ #link("javascript:…")[x] $` makes Typst emit an
 * `<a href="javascript:…">` that would be a live click-XSS. We therefore:
 *  - drop the XML prolog / DOCTYPE,
 *  - drop <script> and <foreignObject> (the latter can embed arbitrary HTML),
 *  - drop every `on*=` event-handler attribute,
 *  - neutralise href / xlink:href whose scheme is dangerous (reusing safeUrl),
 *    while KEEPING `#fragment` refs — Typst glyph reuse relies on
 *    `<use href="#glyph">`, so a blanket href strip would break the math.
 */
function sanitizeSvg(svg: string): string {
  return svg
    .replace(/<\?xml[\s\S]*?\?>/gi, '')
    .replace(/<!DOCTYPE[\s\S]*?>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, '')
    .replace(/<foreignObject\b[^>]*\/>/gi, '')
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s/>]+)/gi, '')
    .replace(/\s(xlink:href|href)\s*=\s*("[^"]*"|'[^']*')/gi, (m, _attr, val) =>
      safeUrl(val.slice(1, -1)) === '' ? '' : m)
    .trim();
}

function renderMathHtml(desc: Extract<RawDesc, { kind: 'math' }>, rc: RenderCtx): string {
  const id = desc.label ? ` id="${escAttr(desc.label)}"` : '';
  let eqno = '';
  if (rc.ctx?.equationNumbering) {
    rc.equationCounter++;
    eqno = `<span class="pw-eqno">${esc(renderEqNumber(rc.ctx.eqPattern, rc.equationCounter))}</span>`;
  }
  const svg = rc.ctx?.mathSvg.get(desc.tex);
  if (svg) return `<figure class="pw-math"${id}><div class="pw-math-svg" role="img">${sanitizeSvg(svg)}</div>${eqno}</figure>`;
  // Fallback: readable inline TeX (no Typst available / render failed).
  const tex = desc.tex.replace(/^\$\s*|\s*\$$/g, '').trim();
  return `<figure class="pw-math"${id}><span class="pw-math-tex">${esc(tex)}</span>${eqno}</figure>`;
}

// ─── Raw-block rendering (full Phase-D port of classifyRawBlock kinds) ───────

/** Parses a Typst `table(...)` body (the inner of the call) into an HTML table. */
function typstTableToHtml(tableSrc: string, rc?: RenderCtx): string {
  let cols = 1;
  const colMatch = tableSrc.match(/columns:\s*(\([^)]*\)|\d+)/);
  if (colMatch) {
    const v = colMatch[1];
    if (v.startsWith('(')) cols = v.slice(1, -1).split(',').filter((s) => s.trim()).length;
    else cols = parseInt(v) || 1;
  }
  if (cols < 1) cols = 1;
  const cells: string[] = [];
  for (let i = 0; i < tableSrc.length; i++) {
    if (tableSrc[i] === '[') {
      const m = matchBracket(tableSrc, i, '[', ']');
      if (m) { cells.push(m.inner.trim()); i = m.end - 1; }
    }
  }
  let rows = '';
  for (let r = 0; r < cells.length; r += cols) {
    const rowCells = cells.slice(r, r + cols);
    const isHeader = r === 0;
    const tag = isHeader ? 'th' : 'td';
    rows += `<tr>${rowCells.map((c) => `<${tag}>${inlineTypstToHtml(c.replace(/^\*([\s\S]*)\*$/, '$1'), rc)}</${tag}>`).join('')}</tr>`;
  }
  return `<table>${rows}</table>`;
}

/** Caption text + optional photographer credit. */
function captionHtml(desc: Extract<RawDesc, { kind: 'figure' }>, rc?: RenderCtx): string {
  if (!desc.caption && !desc.credit) return '';
  let cap = desc.caption ? inlineTypstToHtml(desc.caption, rc) : '';
  if (desc.credit) cap += `<span class="pw-credit"> — ${esc(desc.credit)}</span>`;
  return cap;
}

/** Numbered "Figure N: …" figcaption — or, with `#set figure(numbering: none)`
 *  in the source (ctx.figureNumbering === false), just the caption like the
 *  PDF (no label at all; no figcaption when there is no caption either). */
function figcaptionHtml(word: string, n: number, cap: string, rc: RenderCtx): string {
  if (rc.ctx?.figureNumbering === false) {
    return cap ? `<figcaption>${cap}</figcaption>` : '';
  }
  return `<figcaption><span class="pw-fig-label">${esc(word)} ${n}</span>${cap ? ': ' + cap : ''}</figcaption>`;
}

function renderImageFigureHtml(desc: Extract<RawDesc, { kind: 'figure'; variant: 'image' }>, rc: RenderCtx): string {
  rc.figureCounter++;
  const id = desc.label ? ` id="${escAttr(desc.label)}"` : '';
  const w = refWords(rc.ctx?.lang ?? 'en');
  const len = safeCssLen(desc.width ?? undefined);
  const style = len ? ` style="width:${len}"` : '';
  const img = desc.imagePath ? `<img src="${escAttr(safeImgSrc(desc.imagePath))}" alt=""${style}>` : '';
  const figcap = figcaptionHtml(w.figure, rc.figureCounter, captionHtml(desc, rc), rc);
  return `<figure class="pw-figure"${id}>${img}${figcap}</figure>`;
}

function renderTableFigureHtml(desc: Extract<RawDesc, { kind: 'figure'; variant: 'table' }>, rc: RenderCtx): string {
  rc.tableCounter++;
  const id = desc.label ? ` id="${escAttr(desc.label)}"` : '';
  const w = refWords(rc.ctx?.lang ?? 'en');
  const figcap = figcaptionHtml(w.table, rc.tableCounter, captionHtml(desc, rc), rc);
  return `<figure class="pw-table-figure"${id}>${typstTableToHtml(desc.tableSrc, rc)}${figcap}</figure>`;
}

/** True if a raw-block content is a `#bibliography(...)` directive. */
function isBibliographyContent(t: string): boolean {
  return /^#bibliography\b/.test(t) || t.includes('#bibliography(');
}

// ─── Print-only HERO reinterpretation (cover / aufmacher / doppelseite) ──────

/** Splits a trailing `<label>` off a heading body. */
function splitLabel(s: string): { clean: string; label?: string } {
  const m = s.match(/\s*<([^<>\s]+)>\s*$/);
  return m ? { clean: s.slice(0, m.index), label: m[1] } : { clean: s };
}

/** A standalone `#v(…)` spacer's web height in em: pt/em/cm translated
 *  relative to an ~11pt body, page-filling `fr` units → a fixed breathing gap.
 *  Clamped so a print-page spacer can't blow up the web hero. */
function spacerEm(line: string): number | null {
  const m = line.match(/^\s*#v\(\s*(-?\d+(?:\.\d+)?)\s*(pt|em|mm|cm|in|fr)\s*[,)]/);
  if (!m) return null;
  const v = parseFloat(m[1]);
  const em = m[2] === 'em' ? v
    : m[2] === 'pt' ? v / 11
    : m[2] === 'mm' ? (v * 72 / 25.4) / 11
    : m[2] === 'cm' ? (v * 72 / 2.54) / 11
    : m[2] === 'in' ? (v * 72) / 11
    : 2.2 * Math.min(v, 2); // fr → page-filling → a generous fixed gap
  return Math.min(Math.max(em, 0), 5);
}

/** Like splitDesignChunks, but keeps the `#v(…)` spacer HEIGHT between chunks —
 *  the cover's vertical rhythm (masthead ↕ kicker ↕ title) would otherwise
 *  collapse into a crushed stack. */
function splitHeroChunks(src: string): { gapEm: number; chunk: string }[] {
  const out: { gapEm: number; chunk: string }[] = [];
  let cur: string[] = [];
  let depth = 0;
  let pendingGap = 0;
  const flush = () => {
    if (cur.length) { out.push({ gapEm: pendingGap, chunk: cur.join('\n').trim() }); cur = []; pendingGap = 0; }
  };
  for (const line of src.split('\n')) {
    if (depth === 0 && (/^\s*$/.test(line) || /^\s*#v\(/.test(line) || /^\s*#h\(/.test(line))) {
      flush();
      const g = spacerEm(line);
      if (g !== null) pendingGap += g;
      continue;
    }
    cur.push(line);
    let inStr = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inStr) { if (ch === '\\') i++; else if (ch === '"') inStr = false; continue; }
      if (ch === '"') { inStr = true; continue; }
      if (ch === '[' || ch === '(' || ch === '{') depth++;
      else if (ch === ']' || ch === ')' || ch === '}') depth = Math.max(0, depth - 1);
    }
  }
  flush();
  return out.filter((c) => c.chunk);
}

/** Renders an opener/title-page body: `#heading[…]` → a real `<hN>` (so it stays
 *  the outline title), a footer `#grid(…)` → the responsive grid, everything
 *  else → a styled hero line (the `#text(…)` runs carry their look via inlineFunc).
 *  `#v(…)` spacers between lines become proportional margins, so the cover
 *  keeps the PDF's vertical rhythm. */
function renderHeroBody(body: string, rc: RenderCtx): string {
  // Drop full-line config directives + comments (`#set par(…)`, `// …`) so they
  // don't leak as visible text — a `#set par(…)` with no bracket body would
  // otherwise spill its ` par(…)` tail into the page.
  const clean = body.split('\n')
    .filter((l) => !/^\s*(#(set|show|import|let)\b|\/\/)/.test(l))
    .join('\n');
  return splitHeroChunks(clean).map(({ gapEm, chunk }) => {
    const t = chunk.trim();
    const gap = gapEm > 0.05 ? ` style="margin-top:${gapEm.toFixed(2)}em"` : '';
    if (/^#heading\b/.test(t)) {
      const lvlM = t.match(/level:\s*(\d+)/);
      const lvl = Math.min(Math.max(lvlM ? parseInt(lvlM[1]) : 1, 1), 6);
      const br = t.indexOf('[');
      const inner = br >= 0 ? matchBracket(t, br, '[', ']') : null;
      const { clean, label } = splitLabel(inner ? inner.inner : '');
      const id = label ? ` id="${escAttr(label)}"` : '';
      return `<h${lvl} class="pw-hero-title"${id}${gap}>${inlineTypstToHtml(clean.trim(), rc)}</h${lvl}>`;
    }
    const grid = parseTypstGrid(chunk);
    if (grid) return renderGridHtml(grid, rc);
    const html = inlineTypstToHtml(t.replace(/[ \t]*\n[ \t]*/g, ' ').trim(), rc);
    return isInvisibleChunk(html) ? '' : `<p class="pw-hero-line"${gap}>${html}</p>`;
  }).filter(Boolean).join('');
}

function renderHero(spec: HeroSpec, rc: RenderCtx): string {
  if (spec.kind === 'spread') {
    const img = spec.image ? `<img class="pw-hero-img" src="${escAttr(safeImgSrc(spec.image))}" alt="">` : '';
    const cap = (spec.title || spec.credit)
      ? `<figcaption class="pw-hero-credit">${spec.title ? `<span class="pw-hero-spread-title">${esc(spec.title)}</span> ` : ''}${spec.credit ? esc(spec.credit) : ''}</figcaption>`
      : '';
    return `<figure class="pw-hero pw-hero-spread">${img}${cap}</figure>`;
  }
  if (spec.kind === 'cover') {
    return `<header class="pw-cover">${renderHeroBody(spec.body, rc)}</header>`;
  }
  // aufmacher: full-width hero image + the opener text beneath/over it.
  const img = spec.image ? `<img class="pw-hero-img" src="${escAttr(safeImgSrc(spec.image))}" alt="">` : '';
  const credit = spec.credit ? `<p class="pw-hero-credit">${esc(spec.credit)}</p>` : '';
  return `<header class="pw-hero pw-hero-aufmacher"><div class="pw-hero-media">${img}${credit}</div><div class="pw-hero-text">${renderHeroBody(spec.body, rc)}</div></header>`;
}

/**
 * Renders a `typstRawBlock` to real HTML. The bibliography/outline directives
 * and drop caps are special-cased; everything else goes through the shared
 * classifyRawBlock so math / figures / tables / quotes / callouts / design-text
 * / prose / grid all become proper elements (no more placeholder comments).
 */
function renderRawBlockHtml(content: string, blockType: string, rc: RenderCtx): string {
  const t = content.trim();
  if (isBibliographyContent(t)) return renderBibliographyHtml(rc);
  if (/^#outline\b/.test(t)) return ''; // page-based TOC — no web equivalent

  // Print-only HERO constructs (cover / aufmacher / doppelseite) → web hero.
  // MUST run before classifyRawBlock: the cover arrives blockType='config'
  // (→ would be skipped) and the aufmacher is comment-led (→ would leak as prose).
  const hero = parseHero(content);
  if (hero) return renderHero(hero, rc);

  // Drop cap (droplet #dropcap / the LANGSAM #lead alias) keeps its styling.
  // `#lead` only means "drop cap" when the project defines it that way — other
  // templates use `lead` for a standfirst/Anreißer paragraph (ctx.leadStyle).
  const dcM = t.match(/^#(dropcap|lead)\b/);
  if (dcM) {
    const mb = macroBody(t, dcM[0].length);
    if (mb) {
      const cls = dcM[1] === 'lead' && rc.ctx?.leadStyle === 'standfirst' ? 'pw-standfirst' : 'pw-dropcap';
      return `<p class="${cls}">${inlineTypstToHtml(mb.body.replace(/\s+/g, ' ').trim(), rc)}</p>`;
    }
  }

  const desc = classifyRawBlock(content, blockType);
  switch (desc.kind) {
    case 'skip': return '';
    case 'math': return renderMathHtml(desc, rc);
    case 'figure': return desc.variant === 'table' ? renderTableFigureHtml(desc, rc) : renderImageFigureHtml(desc, rc);
    case 'quote': return `<blockquote>${bodyToParagraphs(desc.body, rc)}</blockquote>`;
    case 'callout': {
      const title = desc.title ? `<p class="pw-callout-title">${esc(desc.title)}</p>` : '';
      return `<aside class="pw-callout" data-tone="${escAttr(desc.variant)}">${title}${bodyToParagraphs(desc.body, rc)}</aside>`;
    }
    case 'heading': { const lvl = Math.min(Math.max(desc.level, 1), 6); return `<h${lvl}>${esc(desc.text)}</h${lvl}>`; }
    case 'prose': return renderChunksHtml(splitDesignChunks(desc.content), null, rc);
    case 'designText': return renderChunksHtml(desc.chunks, desc.alignment, rc);
    case 'grid': return renderGridHtml(desc.parsed, rc);
  }
}

/** Renders a parsed `#grid` as a responsive `.pw-grid` of `.pw-grid-cell`s. */
function renderGridHtml(grid: { cells: GridItem[][] }, rc?: RenderCtx): string {
  const cell = (items: GridItem[]) =>
    `<div class="pw-grid-cell">${items.map((it) => renderGridItem(it, rc)).join('')}</div>`;
  return `<div class="pw-grid" style="--pw-grid-cols:${grid.cells.length}">${grid.cells.map(cell).join('')}</div>`;
}

function renderGridItem(it: GridItem, rc?: RenderCtx): string {
  switch (it.kind) {
    case 'question':
      return `<p class="pw-question">${inlineTypstToHtml((it.body ?? '').replace(/\s+/g, ' ').trim(), rc)}</p>`;
    case 'box': {
      const title = it.title ? `<p class="pw-callout-title">${esc(it.title)}</p>` : '';
      return `<aside class="pw-callout">${title}${bodyToParagraphs(it.body ?? '', rc)}</aside>`;
    }
    case 'image':
      return it.path ? `<img class="pw-fp-img" src="${escAttr(safeImgSrc(it.path))}" alt="">` : '';
    case 'caption':
      return `<p class="pw-fp-caption">${inlineTypstToHtml((it.body ?? '').replace(/\s+/g, ' ').trim(), rc)}</p>`;
    default:
      return bodyToParagraphs(it.body ?? '', rc);
  }
}

// ─── Citation collapsing (the static renderer maps one node at a time, so we
//     pre-merge adjacent `citation` nodes into a single `citationGroup`). ─────

/** Returns a copy of the doc where runs of adjacent citation nodes (separated
 *  only by whitespace text) are merged into one `citationGroup` node, mirroring
 *  Typst's `@a @b` → `(A; B)` rendering. */
function collapseCitations(node: JSONNode): JSONNode {
  if (!Array.isArray(node.content)) return node;
  const src = node.content;
  const out: JSONNode[] = [];
  for (let i = 0; i < src.length; i++) {
    const n = src[i];
    if (n.type === 'citation') {
      const keys = [(n.attrs?.citekey as string) ?? ''];
      let j = i + 1;
      while (j < src.length) {
        const nx = src[j];
        if (nx.type === 'text' && (nx.text ?? '').trim() === '' && src[j + 1]?.type === 'citation') { j++; continue; }
        if (nx.type === 'citation') { keys.push((nx.attrs?.citekey as string) ?? ''); j++; continue; }
        break;
      }
      if (keys.length > 1) { out.push({ type: 'citationGroup', attrs: { citekeys: keys.filter(Boolean) } }); i = j - 1; continue; }
      out.push(n);
      continue;
    }
    out.push(collapseCitations(n));
  }
  return { ...node, content: out };
}

// ─── The renderer (built per-call so the node mappings close over RenderCtx) ──

function buildRenderer(rc: RenderCtx) {
  return renderJSONContentToString({
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

      // Inline atoms — resolved via the export context (Phase D) ----------------
      citation: ({ node }: any) => renderCitationGroupHtml([String(node.attrs?.citekey ?? '')], rc),
      citationGroup: ({ node }: any) => renderCitationGroupHtml((node.attrs?.citekeys as string[]) ?? [], rc),
      reference: ({ node }: any) => renderReferenceHtml(String(node.attrs?.label ?? ''), rc),
      footnote: ({ node }: any) => addFootnote(rc, inlineTypstToHtml(String(node.attrs?.content ?? ''), rc)),

      // Magazine AST nodes (Phase C keystone) — real, themeable semantic HTML.
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
      // The deserializer maps `#lead[…]` to dropCap by NAME; whether that means
      // a real drop cap or a standfirst paragraph is the project's definition
      // (ctx.leadStyle — see styleInference.detectLeadStyle).
      dropCap: ({ children }: any) =>
        `<p class="${rc.ctx?.leadStyle === 'standfirst' ? 'pw-standfirst' : 'pw-dropcap'}">${kids(children)}</p>`,
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
        const cap = a.caption ? `<figcaption class="pw-fp-caption">${inlineTypstToHtml(String(a.caption), rc)}</figcaption>` : '';
        const title = a.title ? `<p class="pw-fp-title">${esc(String(a.title))}</p>` : '';
        return `<figure class="pw-figure-panel"><div class="pw-fp-media">${src}${cap}</div><aside class="pw-fp-note">${title}${kids(children)}</aside></figure>`;
      },
      interlude: () => '<hr class="pw-interlude">',
      columns: ({ node, children }: any) => {
        const cols = Math.min(Math.max(Number(node.attrs?.cols) || 2, 1), 6);
        const gap = safeCssLen(node.attrs?.gutter);
        const style = ` style="--pw-cols:${cols}${gap ? `;--pw-gap:${gap}` : ''}"`;
        return `<div class="pw-columns"${style}>${kids(children)}</div>`;
      },
      // marginNote is an inline atom (raw-string body) — reparse its body.
      marginNote: ({ node }: any) =>
        `<aside class="pw-margin-note">${inlineTypstToHtml(String(node.attrs?.body ?? ''), rc)}</aside>`,

      // Block atoms ------------------------------------------------------------
      pagebreak: () => '', // web has no page break
      bibliography: () => renderBibliographyHtml(rc),
      typstRawBlock: ({ node }: any) =>
        renderRawBlockHtml(String(node.attrs?.content ?? ''), String(node.attrs?.blockType ?? 'raw'), rc),

      // Synthetic nodes injected by the magazine mini-site builder (webExport):
      // an issue table of contents + per-article prev/next navigation. They
      // render through the normal pipeline so they sit inside the reading measure
      // and inherit the scoped styling.
      magazineToc: ({ node }: any) => {
        const items = (node.attrs?.items as any[]) ?? [];
        const lis = items.map((it) =>
          `<li class="pw-toc-item"><a href="${escAttr(String(it.href ?? ''))}">` +
          (it.kicker ? `<span class="pw-toc-kicker">${esc(String(it.kicker))}</span>` : '') +
          `<span class="pw-toc-title">${esc(String(it.title ?? ''))}</span>` +
          (it.byline ? `<span class="pw-toc-byline">${esc(String(it.byline))}</span>` : '') +
          `</a></li>`).join('');
        return `<nav class="pw-toc" aria-label="Contents"><ol class="pw-toc-list">${lis}</ol></nav>`;
      },
      magazineNav: ({ node }: any) => {
        const a = node.attrs ?? {};
        const parts: string[] = [];
        if (a.upHref) parts.push(`<a class="pw-nav-up" href="${escAttr(String(a.upHref))}">${esc(String(a.upLabel ?? 'Contents'))}</a>`);
        if (a.prevHref) parts.push(`<a class="pw-nav-prev" href="${escAttr(String(a.prevHref))}"><span class="pw-nav-dir">‹</span> ${esc(String(a.prevTitle ?? ''))}</a>`);
        if (a.nextHref) parts.push(`<a class="pw-nav-next" href="${escAttr(String(a.nextHref))}">${esc(String(a.nextTitle ?? ''))} <span class="pw-nav-dir">›</span></a>`);
        return parts.length ? `<nav class="pw-nav">${parts.join('')}</nav>` : '';
      },
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
}

/**
 * Serializes a TipTap document to a self-contained, semantic HTML article:
 * `<article class="pw-article">` wrapping an inline scoped `<style>` and the
 * rendered body (+ a footnotes section and bibliography). Standalone-valid
 * (opens in any browser) and embeddable (the scoped style never collides with a
 * host site). With `opts.context` (the main-process pre-pass), cross-references,
 * citations, footnotes, bibliography and display-math all resolve; without it,
 * each degrades to a readable fallback.
 */
export function serializeHtml(doc: JSONNode, opts: SerializeHtmlOptions = {}): string {
  const rc: RenderCtx = {
    ctx: opts.context,
    footnotes: [], fnCounter: 0, figureCounter: 0, tableCounter: 0, equationCounter: 0,
    bibRendered: false,
  };
  const collapsed = collapseCitations(doc);
  let body = buildRenderer(rc)({ content: collapsed as any });
  if (rc.footnotes.length) body += renderFootnotesSection(rc);
  // A document with a bibliography but no explicit `#bibliography(...)` block
  // (rare) still gets a references section, appended at the end.
  if (rc.ctx?.bibEntries?.length && !rc.bibRendered) body += renderBibliographyHtml(rc);

  const slug = opts.slug ? ` data-article="${escAttr(opts.slug)}"` : '';
  // lang on the article enables `hyphens: auto` (justified body) + correct
  // language semantics even in fragment mode (no surrounding <html lang>).
  const langCode = opts.context?.lang || (opts.meta?.locale ? String(opts.meta.locale).slice(0, 2) : '');
  const langAttr = langCode ? ` lang="${escAttr(langCode)}"` : '';
  // Section-style (Kapitel-Look) class — must satisfy the identifier rule so
  // it can't smuggle attributes/classes into the markup.
  const sec = opts.sectionId && /^[a-z][a-z0-9-]{0,40}$/.test(opts.sectionId) ? ` pw-section-${opts.sectionId}` : '';
  // Defense-in-depth: styleToCss already validates its token inputs, but never
  // let a literal close-style tag in the CSS break out of the <style> element.
  const css = (opts.scopedCss ?? '').replace(/<\/(style)/gi, '<\\/$1');
  const style = css ? `\n<style>\n${css}\n</style>\n` : '\n<style></style>\n';
  const article = `<article class="pw-article${sec}"${langAttr}${slug}>${style}${body}</article>`;
  return opts.mode === 'document' ? wrapDocument(article, opts.meta, opts.pageBackground) : article;
}

/**
 * Wraps a self-contained article in a minimal, valid HTML5 page so it opens
 * standalone in any browser and can be hosted as a plain file.
 */
function wrapDocument(article: string, meta: ArticleMeta = {}, pageBackground?: string): string {
  const lang = meta.locale ? ` lang="${escAttr(String(meta.locale))}"` : '';
  // Fill the WHOLE standalone page with the magazine background (the article's
  // own scoped CSS only colours its 70ch column) so the cream/ink page extends
  // edge-to-edge behind the centered article. Only in this standalone shell —
  // the embeddable fragment never restyles a host's <body>.
  const bg = safeCssColor(pageBackground);
  const pageStyle = bg ? `\n  <style>html{background:${bg};-webkit-text-size-adjust:100%}body{margin:0}</style>` : '';
  const head = [
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    meta.title ? `<title>${esc(String(meta.title))}</title>` : '',
    meta.description ? `<meta name="description" content="${escAttr(String(meta.description))}">` : '',
    meta.title ? `<meta property="og:title" content="${escAttr(String(meta.title))}">` : '',
    meta.description ? `<meta property="og:description" content="${escAttr(String(meta.description))}">` : '',
    meta.cover && safeUrl(meta.cover) ? `<meta property="og:image" content="${escAttr(safeUrl(meta.cover))}">` : '',
  ].filter(Boolean).join('\n  ');
  return `<!doctype html>\n<html${lang}>\n<head>\n  ${head}${pageStyle}\n</head>\n<body>\n${article}\n</body>\n</html>\n`;
}
