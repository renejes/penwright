/**
 * Shared, format-agnostic export analysis (the single source of truth for
 * cross-reference numbering, citation style, raw-block classification and the
 * Typst-snippet keys). Both the DOCX serializer and the web (HTML) export read
 * from here, so the two formats agree on "Figure 2.1", numeric-vs-author-year
 * citations, which raw blocks are math/figure/table/quote/design-text, and the
 * exact `mathSnippet`/`svgSnippet` strings handed to the Typst renderer.
 *
 * Pure: no fs, no async, no Electron. The async Typst rasterisation + image
 * resolution live in the callers (importExport / docxSerializer) keyed by the
 * snippet helpers below; `buildExportModel` returns the *plan* (labels +
 * ordered math blocks), never renders.
 */

import { parseTypstGrid, type ParsedGrid } from './typstGrid';
import type { BibEntry } from './bibParser';

// ─── Minimal AST node shape (structurally compatible with both serializers'
//     TipTapNode types — only the fields the analysis touches). ─────────────

export interface ExportNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: ExportNode[];
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  text?: string;
}

// ─── Cross-reference targets ─────────────────────────────────

/** A cross-reference target discovered in the pre-pass. */
export interface RefTarget {
  kind: 'figure' | 'table' | 'equation' | 'heading' | 'other';
  /** 1-based sequence number within its kind. */
  n: number;
  /** For equations/headings: the rendered number string, e.g. "(1)" / "2.1". */
  numberText?: string;
  /** Heading title text, for section references. */
  title?: string;
}

// ─── Heading-label helpers ───────────────────────────────────

export function getPlainText(nodes: ExportNode[]): string {
  return nodes.map((n) => n.text ?? '').join('');
}

/**
 * Headings arrive from the deserializer with their Typst label still embedded
 * in the text ("Introduction <sec:introduction>"). Extracts the label and the
 * clean title.
 */
export function splitHeadingLabel(node: ExportNode): { title: string; label?: string } {
  const text = getPlainText(node.content ?? []);
  const m = text.match(/\s*<([^<>\s]+)>\s*$/);
  if (!m) return { title: text.trim() };
  return { title: text.slice(0, m.index).trim(), label: m[1] };
}

/** Returns the heading's inline content with a trailing `<label>` removed. */
export function stripHeadingLabelContent(content: ExportNode[]): ExportNode[] {
  const out = content.map((n) => ({ ...n }));
  for (let i = out.length - 1; i >= 0; i--) {
    const n = out[i];
    if (n.type !== 'text') break;
    const t = n.text ?? '';
    const stripped = t.replace(/\s*<[^<>\s]+>\s*$/, '');
    if (stripped !== t) {
      if (stripped) { out[i] = { ...n, text: stripped }; }
      else { out.splice(i, 1); }
      break;
    }
    if (t.trim() !== '') break;
  }
  return out;
}

// ─── Localised reference words ───────────────────────────────

const REF_WORDS: Record<string, { figure: string; table: string; equation: string; section: string }> = {
  en: { figure: 'Figure',    table: 'Table',   equation: 'Equation',     section: 'Section'   },
  de: { figure: 'Abbildung', table: 'Tabelle', equation: 'Gleichung',    section: 'Abschnitt' },
  fr: { figure: 'Figure',    table: 'Tableau', equation: 'Équation',     section: 'Section'   },
  es: { figure: 'Figura',    table: 'Tabla',   equation: 'Ecuación',     section: 'Sección'  },
  it: { figure: 'Figura',    table: 'Tabella', equation: 'Equazione',    section: 'Sezione'  },
  pt: { figure: 'Figura',    table: 'Tabela',  equation: 'Equação',      section: 'Seção'    },
  nl: { figure: 'Figuur',    table: 'Tabel',   equation: 'Vergelijking', section: 'Sectie'   },
};
export function refWords(lang: string) {
  return REF_WORDS[lang.slice(0, 2).toLowerCase()] ?? REF_WORDS.en;
}

const BIB_LABEL: Record<string, string> = {
  en: 'References', de: 'Literaturverzeichnis', fr: 'Bibliographie',
  es: 'Bibliografía', it: 'Bibliografia', pt: 'Bibliografia', nl: 'Bibliografie',
};
/** Localised default heading for the bibliography section. */
export function bibLabel(lang: string): string {
  return BIB_LABEL[lang.slice(0, 2).toLowerCase()] ?? BIB_LABEL.en;
}

// ─── Citation style ──────────────────────────────────────────

/** Known numeric (citation-number) bibliography styles. Everything else → author-year. */
export const NUMERIC_BIB_STYLES = new Set([
  'ieee', 'vancouver', 'numeric', 'american-physics-society', 'nature',
  'american-medical-association', 'american-chemical-society', 'institute-of-physics-numeric',
  'springer-basic', 'elsevier-vancouver', 'iso-690-numeric',
]);

/**
 * Inner text of an author-year citation: "Bender et al., 2021" /
 * "Smith, 2020". Returns null when the citekey has no bib entry.
 */
export function citationInner(citekey: string, entries: BibEntry[]): string | null {
  const entry = entries.find((e) => e.citekey === citekey);
  if (!entry) return null;
  const author = entry.author || '';
  const surname = author.split(',')[0].split('&')[0].split(' and ')[0].trim() || citekey;
  const multi = / and |&|\bothers\b|et al\./.test(author.slice(surname.length));
  const name = multi ? `${surname} et al.` : surname;
  return entry.year ? `${name}, ${entry.year}` : name;
}

// ─── Bibliography text formatting ────────────────────────────

/** BibTeX `--` page/number ranges → en-dash; strip protective braces. */
export function cleanBibText(s: string): string {
  return s.replace(/--/g, '–').replace(/[{}]/g, '');
}

/** "A, B. and C, D. and others" → "A, B., C, D., et al." */
export function formatBibAuthors(author: string): string {
  const names = author.split(/\s+and\s+/).map((n) => cleanBibText(n.trim())).filter(Boolean);
  return names.map((n) => (/^others$/i.test(n) ? 'et al.' : n)).join(', ');
}

// ─── Snippet keys (must be identical in pre-pass and render pass) ──

export function mathSnippet(tex: string): string {
  return `#set page(width: auto, height: auto, margin: (x: 2pt, y: 3pt), fill: white)\n#set text(size: 11pt)\n${tex}\n`;
}
/** SVG path must be baseDir-relative: Typst treats a leading `/` as
 *  root-relative (not filesystem-absolute), and the renderer compiles with
 *  `--root baseDir`. */
export function svgSnippet(relPath: string): string {
  const p = relPath.replace(/\\/g, '/').replace(/"/g, '\\"');
  return `#set page(width: auto, height: auto, margin: 0pt, fill: white)\n#image("${p}")\n`;
}

/** Renders a Typst equation-number pattern like "(1)" with the counter value. */
export function renderEqNumber(pattern: string, n: number): string {
  return pattern.replace(/1/, String(n));
}

export function collectCitekeysInOrder(node: ExportNode, out: string[]): void {
  if (node.type === 'citation') {
    const key = (node.attrs?.citekey as string) ?? '';
    if (key && !out.includes(key)) out.push(key);
  }
  for (const c of node.content ?? []) collectCitekeysInOrder(c, out);
}

// ═══════════════════════════════════════════════════════════════
//  Raw-block intelligence
//
//  The deserializer leaves figures, display-math, #quote, gentle-clues
//  callouts and any prose paragraph that contains an inline Typst call
//  (#emph / #footnote / #raw / …) as `typstRawBlock` nodes. The functions
//  below recognise the meaningful ones so each export format can render
//  proper content, and *classify* pure layout/design code as `skip`.
// ═══════════════════════════════════════════════════════════════

/**
 * Balanced-bracket extraction. `s[openIdx]` must be `open`; returns the inner
 * content (exclusive of the brackets) and the index just past the matching
 * close, honouring nesting. Returns null on imbalance.
 */
export function matchBracket(s: string, openIdx: number, open: string, close: string): { inner: string; end: number } | null {
  if (s[openIdx] !== open) return null;
  let depth = 0;
  let inStr = false;
  for (let i = openIdx; i < s.length; i++) {
    const ch = s[i];
    if (ch === '"' && s[i - 1] !== '\\') inStr = !inStr;
    if (inStr) continue;
    if (ch === open) depth++;
    else if (ch === close) { depth--; if (depth === 0) return { inner: s.slice(openIdx + 1, i), end: i + 1 }; }
  }
  return null;
}

export type RawDesc =
  | { kind: 'math'; tex: string; label?: string }
  | { kind: 'heading'; level: number; text: string }
  | { kind: 'figure'; variant: 'image'; imagePath?: string; width?: string | null; caption?: string; credit?: string; label?: string }
  | { kind: 'figure'; variant: 'table'; tableSrc: string; caption?: string; credit?: string; label?: string }
  | { kind: 'quote'; body: string }
  | { kind: 'callout'; variant: string; title?: string; body: string }
  | { kind: 'prose'; content: string }
  /** A design container (#align / #block / #dropcap / #wrap-content) whose
   *  visible text is worth keeping — chunks become individual paragraphs. */
  | { kind: 'designText'; alignment: string | null; chunks: string[] }
  | { kind: 'grid'; parsed: ParsedGrid }
  | { kind: 'skip' };

const CALLOUT_NAMES = new Set([
  'info', 'tip', 'warning', 'note', 'memo', 'success', 'error', 'task',
  'question', 'conclusion', 'important', 'abstract', 'example',
]);

/** Leading layout/design functions that carry no manuscript content.
 *  `#align` / `#block` / `#dropcap` / `#wrap-content` / `#columns` are NOT in
 *  this list — they are containers whose visible text (title pages, pull-quotes,
 *  drop-cap paragraphs, wrapped prose, multi-column sections) must survive. */
const SKIP_LEADERS = /^#(grid|stack|place|box|rect|line|image|colbreak|pad|move|scale|rotate|polygon|path|square|circle|ellipse|diagram|cetz|fletcher|highlight|stroke|raw)\b|^#[vh]\(/;

/** A line that is pure vertical/horizontal spacing (or empty). */
const SPACER_LINE = /^\s*(#[vh]\([^)]*\))?\s*$/;

export function extractTrailingLabel(s: string): string | undefined {
  const m = s.trim().match(/<([^>\s]+)>\s*$/);
  return m ? m[1] : undefined;
}

/**
 * Splits a design-container body into paragraph chunks at blank lines and
 * standalone `#v(…)` spacer lines — depth-aware, so blank lines inside a
 * nested `#text[…]` bracket don't split.
 */
export function splitDesignChunks(src: string): string[] {
  const chunks: string[] = [];
  let cur: string[] = [];
  let depth = 0;
  let inStr = false;
  for (const line of src.split('\n')) {
    if (depth === 0 && SPACER_LINE.test(line)) {
      if (cur.length) { chunks.push(cur.join('\n').trim()); cur = []; }
      continue;
    }
    cur.push(line);
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"' && line[i - 1] !== '\\') inStr = !inStr;
      if (inStr) continue;
      if (ch === '[' || ch === '(' || ch === '{') depth++;
      else if (ch === ']' || ch === ')' || ch === '}') depth = Math.max(0, depth - 1);
    }
    inStr = false;
  }
  if (cur.length) chunks.push(cur.join('\n').trim());
  return chunks.filter(Boolean);
}

/**
 * Parses `#name(args)[body]` (args optional) that spans the entire string.
 * Returns null if the shape doesn't match or trailing content follows.
 */
function parseContainer(trimmed: string, name: string): { args: string; body: string } | null {
  const m = trimmed.match(new RegExp(`^#${name}\\s*`));
  if (!m) return null;
  let pos = m[0].length;
  let args = '';
  if (trimmed[pos] === '(') {
    const a = matchBracket(trimmed, pos, '(', ')');
    if (!a) return null;
    args = a.inner;
    pos = a.end;
    while (/\s/.test(trimmed[pos] ?? '')) pos++;
  }
  if (trimmed[pos] !== '[') return null;
  const b = matchBracket(trimmed, pos, '[', ']');
  if (!b || trimmed.slice(b.end).trim() !== '') return null;
  return { args, body: b.inner };
}

/** Strips leading/trailing spacer-only lines so a `#v(2em)` prefix doesn't
 *  hide the real content (title heroes, pull-quotes) from classification. */
function stripSpacerLines(content: string): string {
  const lines = content.split('\n');
  let a = 0, b = lines.length;
  while (a < b && SPACER_LINE.test(lines[a])) a++;
  while (b > a && SPACER_LINE.test(lines[b - 1])) b--;
  return lines.slice(a, b).join('\n').trim();
}

export function isConfigBlock(content: string, blockType: string): boolean {
  if (blockType === 'config') return true;
  const trimmed = content.trim();
  if (/^#(set|show|import)\s/.test(trimmed)) return true;
  if (trimmed.startsWith('#show ')) return true;
  if (/^\/\/\s*─/.test(trimmed)) return true;
  // All lines are comments or preamble directives → no manuscript content.
  if (trimmed.split('\n').every((line) => {
    const t = line.trim();
    return t === '' || t.startsWith('//') || /^#(set|show|import|let)\b/.test(t);
  })) return true;
  if (/^#outline\b/.test(trimmed)) return true;
  if (trimmed === '#pagebreak()') return true;
  return false;
}

export function classifyRawBlock(content: string, blockType: string): RawDesc {
  if (isConfigBlock(content, blockType)) return { kind: 'skip' };
  const trimmed = stripSpacerLines(content.trim());
  if (!trimmed) return { kind: 'skip' };

  // Generic #grid(...) two-up (§7.4) — reinterpret the cells as stacked content.
  // MUST precede the SKIP_LEADERS `#grid` drop; parseTypstGrid tolerates a
  // leading `// …` comment (the LANGSAM interview head) + returns null otherwise.
  const grid = parseTypstGrid(content);
  if (grid) return { kind: 'grid', parsed: grid };

  // Display math — must be *only* `$ … $` (optionally + a trailing label).
  if (/^\$[\s\S]*\$\s*(<[^>]+>)?\s*$/.test(trimmed)) {
    const label = extractTrailingLabel(trimmed);
    const tex = trimmed.replace(/<[^>\s]+>\s*$/, '').trim();
    return { kind: 'math', tex, label };
  }

  // #heading(...)[Text] — e.g. an unnumbered "Abstract".
  if (trimmed.startsWith('#heading')) {
    const lvlMatch = trimmed.match(/level:\s*(\d+)/);
    const level = lvlMatch ? parseInt(lvlMatch[1]) : 1;
    const br = trimmed.indexOf('[');
    const inner = br >= 0 ? matchBracket(trimmed, br, '[', ']') : null;
    return { kind: 'heading', level, text: inner ? inner.inner.trim() : trimmed.replace(/^#heading[^[]*\[?/, '').replace(/\]$/, '') };
  }

  // #figure(...) — image figure or table figure.
  if (trimmed.startsWith('#figure')) {
    const open = trimmed.indexOf('(');
    const fig = open >= 0 ? matchBracket(trimmed, open, '(', ')') : null;
    const inner = fig ? fig.inner : trimmed;
    const label = extractTrailingLabel(trimmed.slice(fig ? fig.end : 0)) ?? extractTrailingLabel(trimmed);
    // caption: [ ... ]  |  caption: "…"  |  caption: figure-caption-credit("…", "…")
    let caption: string | undefined;
    let credit: string | undefined;
    const capIdx = inner.search(/caption:\s*\[/);
    if (capIdx >= 0) {
      const br = inner.indexOf('[', capIdx);
      const cap = matchBracket(inner, br, '[', ']');
      if (cap) caption = cap.inner.trim();
    } else {
      const creditIdx = inner.search(/caption:\s*figure-caption-credit\s*\(/);
      if (creditIdx >= 0) {
        const pOpen = inner.indexOf('(', inner.indexOf('figure-caption-credit', creditIdx));
        const args = matchBracket(inner, pOpen, '(', ')');
        const strs = args ? [...args.inner.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1].replace(/\\"/g, '"')) : [];
        if (strs[0]) caption = strs[0];
        if (strs[1]) credit = strs[1];
      } else {
        const strCap = inner.match(/caption:\s*"((?:[^"\\]|\\.)*)"/);
        if (strCap) caption = strCap[1].replace(/\\"/g, '"');
      }
    }
    if (/\btable\s*\(/.test(inner) && !/\bimage\s*\(/.test(inner.slice(0, inner.search(/\btable\s*\(/)))) {
      const tIdx = inner.search(/\btable\s*\(/);
      const tOpen = inner.indexOf('(', tIdx);
      const tbl = matchBracket(inner, tOpen, '(', ')');
      return { kind: 'figure', variant: 'table', tableSrc: tbl ? tbl.inner : inner, caption, credit, label };
    }
    const imgMatch = inner.match(/image\(\s*"([^"]+)"/);
    const widthMatch = inner.match(/image\([^)]*width:\s*([^,)\s]+)/);
    return { kind: 'figure', variant: 'image', imagePath: imgMatch ? imgMatch[1] : undefined, width: widthMatch ? widthMatch[1] : null, caption, credit, label };
  }

  // #quote(block: true)[ ... ]
  if (/^#quote\s*\(/.test(trimmed)) {
    const br = trimmed.indexOf('[');
    const inner = br >= 0 ? matchBracket(trimmed, br, '[', ']') : null;
    if (inner) return { kind: 'quote', body: inner.inner.trim() };
  }

  // gentle-clues callouts — #info[...] / #warning(title: "x")[...] / …
  // Bracket-aware (matchBracket is string-aware), so a `)` inside the title or a
  // `[` inside the args no longer drops the callout / grabs the wrong body.
  const calloutNameM = trimmed.match(/^#([a-z]+)/);
  if (calloutNameM && CALLOUT_NAMES.has(calloutNameM[1])) {
    let j = calloutNameM[0].length;
    while (/\s/.test(trimmed[j] ?? '')) j++;
    let argStr = '';
    if (trimmed[j] === '(') { const a = matchBracket(trimmed, j, '(', ')'); if (a) { argStr = a.inner; j = a.end; } }
    while (/\s/.test(trimmed[j] ?? '')) j++;
    if (trimmed[j] === '[') {
      const inner = matchBracket(trimmed, j, '[', ']');
      const titleM = argStr.match(/title:\s*"((?:[^"\\]|\\.)*)"/);
      return { kind: 'callout', variant: calloutNameM[1], title: titleM ? titleM[1].replace(/\\"/g, '"') : undefined, body: inner ? inner.inner.trim() : '' };
    }
  }

  // Design containers whose visible text must survive (title heroes,
  // pull-quotes, drop-cap paragraphs, wrap-it prose).

  // #align(spec)[ … ] spanning the whole block → aligned text chunks.
  const alignC = parseContainer(trimmed, 'align');
  if (alignC) {
    const alignment = /\bright\b/.test(alignC.args) ? 'right' : /\bleft\b/.test(alignC.args) ? 'left' : 'center';
    return { kind: 'designText', alignment, chunks: splitDesignChunks(alignC.body) };
  }

  // #block(args)[ … ] / #dropcap(args)[ … ] / #columns(n)[ … ] → unaligned chunks.
  for (const name of ['block', 'dropcap', 'columns']) {
    if (new RegExp(`^#${name}\\b`).test(trimmed)) {
      const c = parseContainer(trimmed, name);
      if (c) return { kind: 'designText', alignment: null, chunks: splitDesignChunks(c.body) };
      return { kind: 'skip' };
    }
  }

  // #wrap-content(float, [body]) → the bracketed content args hold the prose.
  if (/^#wrap-content\s*\(/.test(trimmed)) {
    const args = matchBracket(trimmed, trimmed.indexOf('('), '(', ')');
    if (args) {
      const chunks: string[] = [];
      for (let i = 0; i < args.inner.length; i++) {
        if (args.inner[i] === '[') {
          const m = matchBracket(args.inner, i, '[', ']');
          if (m) { chunks.push(...splitDesignChunks(m.inner)); i = m.end - 1; }
        } else if (args.inner[i] === '(') {
          const m = matchBracket(args.inner, i, '(', ')');
          if (m) i = m.end - 1;
        }
      }
      if (chunks.length) return { kind: 'designText', alignment: null, chunks };
    }
    return { kind: 'skip' };
  }

  // Pure layout/design code → drop silently (never leak as monospace).
  if (SKIP_LEADERS.test(trimmed)) return { kind: 'skip' };

  // Everything else is prose (possibly with inline Typst calls).
  return { kind: 'prose', content };
}

// ─── Bibliography directive ──────────────────────────────────

/** Pulls the `#bibliography("path", style:"…", title:"…")` arguments from the
 *  document source (the caller resolves the path + reads the file). */
export function parseBibDirective(typstContent: string): { path?: string; title?: string } | null {
  if (!/#bibliography\s*\(/.test(typstContent)) return null;
  const pathM = typstContent.match(/#bibliography\(\s*"([^"]+)"/);
  // Lazy `[\s\S]*?` (not `[^)]*`) so a ')' inside the quoted path — e.g.
  // "refs (2020).bib" — doesn't halt the scan before reaching `title:`.
  const titleM = typstContent.match(/#bibliography\([\s\S]*?title:\s*"([^"]*)"/);
  return { path: pathM ? pathM[1] : undefined, title: titleM ? titleM[1] : undefined };
}

/** True if the node is a `#bibliography(...)` raw block or the dedicated node. */
export function isBibliographyNode(node: ExportNode): boolean {
  if (node.type === 'bibliography') return true;
  if (node.type !== 'typstRawBlock') return false;
  const content = ((node.attrs?.content as string) ?? '').trim();
  return /^#bibliography\b/.test(content) || content.includes('#bibliography(');
}

/** True if the node is a `#outline()` raw block (web has no page-based TOC). */
export function isOutlineNode(node: ExportNode): boolean {
  if (node.type !== 'typstRawBlock') return false;
  return /^#outline\b/.test(((node.attrs?.content as string) ?? '').trim());
}

// ─── Pre-pass: cross-reference numbering + citation style ─────

export interface ExportModel {
  /** label → cross-reference target (figure/table/equation/heading numbers). */
  labelMap: Map<string, RefTarget>;
  citationMode: 'author-year' | 'numeric';
  /** Ordered citekey list for numeric citation style. */
  numericOrder: string[];
  /** Whether the source enables display-equation numbering. */
  equationNumbering: boolean;
  /** The equation-number pattern (e.g. "(1)"). */
  eqPattern: string;
  /** Display-math blocks in document order (the Typst→raster render plan). */
  mathBlocks: { tex: string; label?: string }[];
}

/**
 * Format-agnostic pre-pass: walks the document, assigns figure/table/equation/
 * heading numbers, decides the citation style, and lists the display-math
 * blocks. Mirrors the numbering loop the DOCX serializer's buildExportContext
 * runs, so both formats resolve `@fig:x` / `@sec:y` / `@key` identically.
 */
export function buildExportModel(doc: { content?: ExportNode[] }, typstContent: string): ExportModel {
  const labelMap = new Map<string, RefTarget>();

  const eqNumMatch = typstContent.match(/#set\s+math\.equation\([^)]*numbering\s*:\s*"([^"]*)"/);
  const equationNumbering = !!eqNumMatch;
  const eqPattern = eqNumMatch ? eqNumMatch[1] : '(1)';

  const bibStyleMatch = typstContent.match(/#bibliography\([^)]*style:\s*"([^"]+)"/);
  const citationMode: 'author-year' | 'numeric' =
    bibStyleMatch && NUMERIC_BIB_STYLES.has(bibStyleMatch[1].toLowerCase()) ? 'numeric' : 'author-year';

  let figureN = 0, tableN = 0, equationN = 0;
  const headingCounters = [0, 0, 0, 0, 0, 0];
  const mathBlocks: { tex: string; label?: string }[] = [];

  // Depth-first PRE-ORDER walk — the SAME traversal the renderers descend in
  // (a content node renders its children before its next sibling). Figures /
  // tables / display-math nested inside the magazine container nodes
  // (#columns / #notiz / #bildtafel re-parse their bodies into child nodes —
  // the B1 fix) are deserialized into NESTED typstRawBlocks, so the numbering
  // pass MUST recurse to count them; otherwise the rendered caption counters
  // (which descend) drift out of step with this labelMap, and a nested
  // `<fig:x>` would have no cross-reference target / no rendered math SVG.
  const visit = (node: ExportNode) => {
    if (node.type === 'heading') {
      const level = Math.min(6, Math.max(1, (node.attrs?.level as number) ?? 1));
      headingCounters[level - 1]++;
      for (let l = level; l < 6; l++) headingCounters[l] = 0;
      const split = splitHeadingLabel(node);
      // The deserializer moves a trailing `<label>` into attrs.label and strips
      // it from the text (B2), so prefer that; fall back to a text-embedded
      // label for documents/headings that still carry it inline.
      const headingLabel = (node.attrs?.label as string | undefined) ?? split.label;
      if (headingLabel) {
        labelMap.set(headingLabel, {
          kind: 'heading',
          n: headingCounters[0],
          numberText: headingCounters.slice(0, level).join('.'),
          title: split.title,
        });
      }
    } else if (node.type === 'typstRawBlock') {
      const content = (node.attrs?.content as string) ?? '';
      const blockType = (node.attrs?.blockType as string) ?? '';
      const desc = classifyRawBlock(content, blockType);
      if (desc.kind === 'math') {
        if (equationNumbering) equationN++;
        const numberText = equationNumbering ? renderEqNumber(eqPattern, equationN) : undefined;
        if (desc.label) labelMap.set(desc.label, { kind: 'equation', n: equationN, numberText });
        mathBlocks.push({ tex: desc.tex, label: desc.label });
      } else if (desc.kind === 'figure' && desc.variant === 'image') {
        figureN++;
        if (desc.label) labelMap.set(desc.label, { kind: 'figure', n: figureN });
      } else if (desc.kind === 'figure' && desc.variant === 'table') {
        tableN++;
        if (desc.label) labelMap.set(desc.label, { kind: 'table', n: tableN });
      }
    }
    for (const c of node.content ?? []) visit(c);
  };
  for (const node of doc.content ?? []) visit(node);

  const numericOrder: string[] = [];
  if (citationMode === 'numeric') collectCitekeysInOrder(doc as ExportNode, numericOrder);

  return { labelMap, citationMode, numericOrder, equationNumbering, eqPattern, mathBlocks };
}
