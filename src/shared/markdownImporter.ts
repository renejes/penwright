/**
 * Converts Markdown / constrained MDX to Typst markup.
 *
 * Covers GFM plus the Easy Writing dialect: Pandoc citations `[@key]`,
 * Pandoc footnotes `[^id]`, self-closing `<Figure … />`, and pipe tables.
 * The conversion is a typesetting derivation — it must not flatten citations
 * into "(Author, Year)" or drop footnote / figure captions.
 */

import * as path from 'path';

export interface MarkdownToTypstOptions {
  /**
   * Absolute path of the Markdown/MDX file being converted. Together with
   * `outputFile`, image and Figure `src` values are rewritten so Typst
   * resolves them relative to the generated `.typ` (it does not use the
   * Markdown file as the base).
   */
  sourceFile?: string;
  /** Absolute path of the Typst file that will hold the converted markup. */
  outputFile?: string;
}

export function markdownToTypst(md: string, opts: MarkdownToTypstOptions = {}): string {
  const allLines = md.split('\n');
  const { lines, defs } = extractFootnoteDefs(stripFrontmatter(allLines));
  const ctx: ConvertCtx = { defs, opts };
  const output: string[] = [];
  let inCodeBlock = false;
  let codeBlockLang = '';
  let codeBlockLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.trim().startsWith('```')) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeBlockLang = line.trim().slice(3).trim();
        codeBlockLines = [];
      } else {
        const langLabel = codeBlockLang ? `\`\`\`${codeBlockLang}` : '```';
        output.push(langLabel);
        output.push(...codeBlockLines);
        output.push('```');
        inCodeBlock = false;
        codeBlockLang = '';
        codeBlockLines = [];
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockLines.push(line);
      continue;
    }

    if (isFootnoteDefLine(line)) {
      // Definitions were lifted in the first pass; skip the block including
      // indented continuations so they do not reappear as paragraphs.
      while (i + 1 < lines.length && isFootnoteContinuation(lines[i + 1])) i++;
      continue;
    }

    if (looksLikeTableRow(line) && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const tableLines = [line, lines[i + 1]];
      i += 2;
      while (i < lines.length && looksLikeTableRow(lines[i])) {
        tableLines.push(lines[i]);
        i++;
      }
      i--;
      output.push(convertGfmTable(tableLines, ctx));
      continue;
    }

    if (/<Figure\b/i.test(line)) {
      let collected = line;
      while (!/\/>/.test(collected) && i + 1 < lines.length) {
        i++;
        collected += '\n' + lines[i];
      }
      const figure = convertFigure(collected, ctx);
      if (figure) {
        output.push(figure);
        continue;
      }
      output.push(convertInline(collected, ctx));
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = '='.repeat(headingMatch[1].length);
      output.push(`${level} ${convertInline(headingMatch[2], ctx)}`);
      continue;
    }

    if (line.match(/^(---|\*\*\*|___)\s*$/)) {
      output.push('#line(length: 100%)');
      continue;
    }

    const ulMatch = line.match(/^(\s*)[-*+]\s+(.+)$/);
    if (ulMatch) {
      output.push(`${ulMatch[1]}- ${convertInline(ulMatch[2], ctx)}`);
      continue;
    }

    const olMatch = line.match(/^(\s*)\d+\.\s+(.+)$/);
    if (olMatch) {
      output.push(`${olMatch[1]}+ ${convertInline(olMatch[2], ctx)}`);
      continue;
    }

    const bqMatch = line.match(/^>\s*(.*)$/);
    if (bqMatch) {
      const text = convertInline(bqMatch[1], ctx);
      if (text) output.push(`#quote[${text}]`);
      continue;
    }

    const imgMatch = line.match(/^!\[([^\]]*)\]\(([^)]+)\)\s*$/);
    if (imgMatch) {
      output.push(emitImage(imgMatch[1], imgMatch[2], ctx));
      continue;
    }

    if (line.trim() === '') {
      output.push('');
      continue;
    }

    output.push(convertInline(line, ctx));
  }

  return output.join('\n');
}

/**
 * A file path as Typst will accept it: forward slashes only.
 *
 * Typst 0.15 made this a HARD ERROR — "path must not contain a backslash", at
 * parse time, whether or not the file exists. A Markdown file written on Windows
 * says `![Chart](images\chart.png)`, and we interpolated `src` verbatim, so the
 * import produced a document that would not compile at all. On 0.14.2 the same
 * path worked on Windows, so this is new breakage, not a latent bug.
 *
 * Only for paths. A `#link("…")` URL keeps its backslashes: it is not a path,
 * and Typst does not object.
 */
export function typstPath(p: string): string {
  return p.replace(/\\/g, '/');
}

/**
 * Rewrite a Markdown-relative path so it is valid from `outputFile`.
 * URLs and empty strings are left alone.
 */
export function rewriteAssetPath(src: string, opts: MarkdownToTypstOptions): string {
  const normalised = typstPath(src.trim());
  if (!normalised) return normalised;
  if (/^[a-z][a-z0-9+.-]*:/i.test(normalised)) return normalised;
  if (!opts.sourceFile || !opts.outputFile) return normalised;
  const abs = path.resolve(path.dirname(opts.sourceFile), normalised);
  return typstPath(path.relative(path.dirname(opts.outputFile), abs));
}

// ─── internals ───────────────────────────────────────────────

interface ConvertCtx {
  defs: Map<string, string>;
  opts: MarkdownToTypstOptions;
}

function stripFrontmatter(lines: string[]): string[] {
  if (lines[0]?.trim() !== '---') return lines;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') return lines.slice(i + 1);
  }
  return lines;
}

const FOOTNOTE_DEF_RE = /^\[\^([^\]]+)\]:\s?(.*)$/;

function isFootnoteDefLine(line: string): boolean {
  return FOOTNOTE_DEF_RE.test(line);
}

function isFootnoteContinuation(line: string): boolean {
  if (line.trim() === '') return true;
  return /^\s{4,}|\t/.test(line) && !isFootnoteDefLine(line);
}

/**
 * Lift Pandoc footnote definitions (`[^id]: …`) out of the body so the
 * Typst derivation inlines `#footnote[…]` at each marker and never emits
 * the definition block as prose. IDs are the author's; we do not renumber.
 */
function extractFootnoteDefs(lines: string[]): { lines: string[]; defs: Map<string, string> } {
  const defs = new Map<string, string>();
  const kept: string[] = [];
  let inCode = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().startsWith('```')) {
      inCode = !inCode;
      kept.push(line);
      continue;
    }
    if (inCode) {
      kept.push(line);
      continue;
    }
    const m = line.match(FOOTNOTE_DEF_RE);
    if (!m) {
      kept.push(line);
      continue;
    }
    const parts = [m[2] ?? ''];
    while (i + 1 < lines.length && isFootnoteContinuation(lines[i + 1])) {
      i++;
      const cont = lines[i];
      if (cont.trim() === '') {
        parts.push('');
      } else {
        parts.push(cont.replace(/^\s{4,}|\t/, '').trimStart());
      }
    }
    defs.set(m[1], parts.join('\n').trim());
  }
  return { lines: kept, defs };
}

function looksLikeTableRow(line: string): boolean {
  const t = line.trim();
  if (!t.includes('|')) return false;
  if (isFootnoteDefLine(t)) return false;
  return t.startsWith('|') || /\|/.test(t);
}

function isTableSeparator(line: string): boolean {
  const t = line.trim();
  if (!t.includes('|')) return false;
  const cells = splitTableRow(t);
  if (cells.length === 0) return false;
  return cells.every((c) => /^:?-{3,}:?$/.test(c.trim()));
}

function splitTableRow(line: string): string[] {
  let t = line.trim();
  if (t.startsWith('|')) t = t.slice(1);
  if (t.endsWith('|')) t = t.slice(0, -1);
  const cells: string[] = [];
  let cur = '';
  let escaped = false;
  for (const ch of t) {
    if (escaped) {
      cur += ch;
      escaped = false;
      continue;
    }
    if (ch === '\\') {
      escaped = true;
      continue;
    }
    if (ch === '|') {
      cells.push(cur.trim());
      cur = '';
      continue;
    }
    cur += ch;
  }
  cells.push(cur.trim());
  return cells;
}

function convertGfmTable(tableLines: string[], ctx: ConvertCtx): string {
  const header = splitTableRow(tableLines[0] ?? '');
  const rows = tableLines.slice(2).map(splitTableRow);
  const cols = Math.max(header.length, ...rows.map((r) => r.length), 1);
  const pad = (cells: string[]): string[] => {
    const out = cells.slice();
    while (out.length < cols) out.push('');
    return out.slice(0, cols);
  };
  const cell = (raw: string) => `[${escapeMarkup(convertInline(raw, ctx))}]`;
  const headerCells = pad(header).map(cell).join('');
  const body = rows.map((r) => pad(r).map(cell).join(', '));
  return [
    '#table(',
    `  columns: ${cols},`,
    `  table.header${headerCells},`,
    ...body.map((r) => `  ${r},`),
    ')',
  ].join('\n');
}

function convertFigure(block: string, ctx: ConvertCtx): string | null {
  const m = block.match(/<Figure\b([^>]*)\/>/is);
  if (!m) return null;
  const attrs = parseJsxAttrs(m[1] ?? '');
  const src = rewriteAssetPath(attrs.src ?? '', ctx.opts);
  if (!src) return null;
  const alt = attrs.alt ?? '';
  const caption = attrs.caption ?? '';
  const altPart = alt ? `, alt: "${escapeQuoted(alt)}"` : '';
  const captionPart = caption
    ? `, caption: [${escapeMarkup(convertInline(caption, ctx))}]`
    : '';
  return `#figure(image("${escapeQuoted(src)}"${altPart})${captionPart})`;
}

function parseJsxAttrs(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /([A-Za-z_][\w-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw))) {
    out[m[1]] = m[2] ?? m[3] ?? '';
  }
  return out;
}

function emitImage(alt: string, rawSrc: string, ctx: ConvertCtx): string {
  const src = rewriteAssetPath(rawSrc, ctx.opts);
  if (alt) return `#image("${escapeQuoted(src)}", alt: "${escapeQuoted(alt)}")`;
  return `#image("${escapeQuoted(src)}")`;
}

function convertInline(text: string, ctx: ConvertCtx): string {
  const CODE_OPEN = '\u0000C\u0000';
  const CODE_CLOSE = '\u0000/C\u0000';
  const codeSpans: string[] = [];
  text = text.replace(/`([^`]+)`/g, (_m, code: string) => {
    codeSpans.push(code);
    return `${CODE_OPEN}${codeSpans.length - 1}${CODE_CLOSE}`;
  });

  // Pandoc citations BEFORE links: `[@key]` is not `[text](url)`, but a
  // locator form `[@key, p. 12]` would otherwise be tempting to misread.
  // Never citeproc — the key (and locator) stay as Typst `@key` / `@key[…]`.
  text = text.replace(/\[@([^\]]+)\]/g, (_m, inner: string) => convertCitationGroup(inner));

  // Footnote markers. A missing definition stays as the original `[^id]`
  // rather than inventing a body — dropping the id would be silent data loss.
  text = text.replace(/\[\^([^\]]+)\]/g, (whole, id: string) => {
    const body = ctx.defs.get(id);
    if (body === undefined) return whole;
    return `#footnote[${escapeMarkup(convertInline(body, { ...ctx, defs: new Map() }))}]`;
  });

  text = text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_m, alt, rawSrc) => emitImage(alt, rawSrc, ctx));

  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '#link("$2")[$1]');

  const BOLD_OPEN = '\u0000B\u0000';
  const BOLD_CLOSE = '\u0000/B\u0000';

  text = text.replace(/\*\*\*(.+?)\*\*\*/g, `${BOLD_OPEN}_$1_${BOLD_CLOSE}`);
  text = text.replace(/___(.+?)___/g, `${BOLD_OPEN}_$1_${BOLD_CLOSE}`);
  text = text.replace(/\*\*(.+?)\*\*/g, `${BOLD_OPEN}$1${BOLD_CLOSE}`);
  text = text.replace(/__(.+?)__/g, `${BOLD_OPEN}$1${BOLD_CLOSE}`);
  text = text.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '_$1_');
  text = text.split(BOLD_OPEN).join('*').split(BOLD_CLOSE).join('*');

  text = text.replace(/~~(.+?)~~/g, '#strike[$1]');

  text = text.replace(new RegExp(`${CODE_OPEN}(\\d+)${CODE_CLOSE}`, 'g'), (_m, idx) => {
    return `\`${codeSpans[Number(idx)] ?? ''}\``;
  });

  return text;
}

/**
 * One Pandoc citation group: `key`, `key, locator`, or `a; @b, p. 2`.
 * Each item becomes Typst `@key` or `@key[locator]` — never author-year prose.
 */
function convertCitationGroup(inner: string): string {
  const parts = inner.split(';').map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0) return `[@${inner}]`;
  return parts.map((part) => {
    const stripped = part.replace(/^@/, '');
    const comma = stripped.indexOf(',');
    const key = (comma >= 0 ? stripped.slice(0, comma) : stripped).trim();
    const loc = comma >= 0 ? stripped.slice(comma + 1).trim() : '';
    if (!key) return `[@${part}]`;
    return loc ? `@${key}[${loc}]` : `@${key}`;
  }).join(' ');
}

function escapeQuoted(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function escapeMarkup(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\]/g, '\\]');
}
