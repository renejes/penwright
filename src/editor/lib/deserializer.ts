/**
 * Typst → TipTap JSON Deserializer
 * Phase 2: Block-Level Hybrid Parser
 *
 * Splits the document into blocks (separated by blank lines).
 * Each block is classified as either:
 *   - Visual Block → parsed into TipTap nodes (WYSIWYG)
 *   - Raw Block    → wrapped in typstRawBlock node (code view, roundtrip-safe)
 */

interface TipTapDoc {
  type: 'doc';
  content: TipTapNode[];
}

interface TipTapNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TipTapNode[];
  marks?: TipTapMark[];
  text?: string;
}

interface TipTapMark {
  type: string;
  attrs?: Record<string, unknown>;
}

// ─── Public API ──────────────────────────────────────────────

export function deserializeTypst(typst: string): TipTapDoc {
  if (!typst.trim()) {
    return { type: 'doc', content: [{ type: 'paragraph' }] };
  }

  const blocks = splitIntoBlocks(typst);
  const content: TipTapNode[] = [];

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;

    try {
      const nodes = parseBlock(trimmed);
      if (Array.isArray(nodes)) {
        content.push(...nodes);
      } else if (nodes) {
        content.push(nodes);
      }
    } catch (err) {
      // Partial parse: failed block becomes raw block to prevent data loss
      console.error('[vswrite] Block parse error:', err);
      content.push({
        type: 'typstRawBlock',
        attrs: { content: trimmed, blockType: 'error' },
      });
    }
  }

  if (content.length === 0) {
    content.push({ type: 'paragraph' });
  }

  return { type: 'doc', content };
}

// ─── Block Splitter ──────────────────────────────────────────

/**
 * Splits Typst text into blocks at blank lines.
 * Respects code blocks (```) and nested braces/brackets/parens
 * so that blank lines inside these constructs don't create splits.
 */
function splitIntoBlocks(text: string): string[] {
  const lines = text.split('\n');
  const blocks: string[] = [];
  let current: string[] = [];
  let inCodeBlock = false;
  let braceDepth = 0;
  let bracketDepth = 0;
  let parenDepth = 0;

  for (const line of lines) {
    // Track code block fences
    if (line.trim().startsWith('```')) {
      inCodeBlock = !inCodeBlock;
    }

    // Track nesting depth (only outside code blocks)
    if (!inCodeBlock) {
      for (const char of line) {
        if (char === '{') braceDepth++;
        if (char === '}') braceDepth = Math.max(0, braceDepth - 1);
        if (char === '[') bracketDepth++;
        if (char === ']') bracketDepth = Math.max(0, bracketDepth - 1);
        if (char === '(') parenDepth++;
        if (char === ')') parenDepth = Math.max(0, parenDepth - 1);
      }
    }

    const isNested =
      inCodeBlock || braceDepth > 0 || bracketDepth > 0 || parenDepth > 0;

    if (line.trim() === '' && !isNested) {
      // Blank line outside nesting → block boundary
      if (current.length > 0) {
        blocks.push(current.join('\n'));
        current = [];
      }
    } else {
      current.push(line);
    }
  }

  if (current.length > 0) {
    blocks.push(current.join('\n'));
  }

  return blocks;
}

// ─── Block Parser ────────────────────────────────────────────

function parseBlock(block: string): TipTapNode | TipTapNode[] | null {
  // 1. Code block: ```...```
  const codeBlockMatch = block.match(/^```(\w*)\n?([\s\S]*?)```$/);
  if (codeBlockMatch) {
    return {
      type: 'codeBlock',
      attrs: { language: codeBlockMatch[1] || null },
      content: codeBlockMatch[2]
        ? [{ type: 'text', text: codeBlockMatch[2] }]
        : undefined,
    };
  }

  // 2. Heading: = Title, == Title, etc.
  const headingMatch = block.match(/^(={1,4})\s+(.+)$/);
  if (headingMatch) {
    return {
      type: 'heading',
      attrs: { level: headingMatch[1].length },
      content: parseInline(headingMatch[2]),
    };
  }

  // 3. & 4. List blocks ("- " bullets, "+ " ordered).
  //    Continuation lines that are indented (or empty) belong to the
  //    previous item — without this the deserializer rejected real
  //    multi-line list items and dumped them as raw text.
  const lines = block.split('\n');
  const listMarker = lines[0]?.match(/^([-+]) /)?.[1];
  if (listMarker && lines.every((l) => l.match(/^[-+] /) || /^\s/.test(l) || l === '')) {
    const allMatchSameMarker = lines.every((l) => {
      const m = l.match(/^([-+]) /);
      return !m || m[1] === listMarker;
    });
    if (allMatchSameMarker) {
      const items: string[] = [];
      let buf: string[] = [];
      for (const line of lines) {
        if (line.match(/^[-+] /)) {
          if (buf.length > 0) items.push(buf.join(' ').trim());
          buf = [line.replace(/^[-+] /, '')];
        } else {
          buf.push(line.trim());
        }
      }
      if (buf.length > 0) items.push(buf.join(' ').trim());

      return {
        type: listMarker === '-' ? 'bulletList' : 'orderedList',
        content: items.map((text) => ({
          type: 'listItem',
          content: [
            {
              type: 'paragraph',
              content: parseInline(text),
            },
          ],
        })),
      };
    }
  }

  // 5. Blockquote: #quote[text]
  const quoteMatch = block.match(/^#quote\[([\s\S]+)\]$/);
  if (quoteMatch) {
    return {
      type: 'blockquote',
      content: [
        {
          type: 'paragraph',
          content: parseInline(quoteMatch[1]),
        },
      ],
    };
  }

  // 6. Horizontal rule
  if (block.match(/^#line\(length:\s*100%\)$/)) {
    return { type: 'horizontalRule' };
  }

  // 6.5. Aligned block: #align(<spec>)[<inner>]
  //      <spec> may be a combined alignment like `center + horizon` —
  //      we accept anything inside the parens and pull `center`/`right`/`left`
  //      out of it, defaulting to center. Inner content with multiple
  //      `#text(...)[…]` and `#v(...)` runs (typical title pages and
  //      abstract headings) is broken into a series of styled paragraphs
  //      so the visible text survives the DOCX export instead of being
  //      dumped as a code block.
  const alignNode = parseAlignedBlock(block);
  if (alignNode) return alignNode;

  // 7. Image: #image("path") or #image("path", width: 80%)
  const imageMatch = block.match(/^#image\("([^"]+)"(?:\s*,\s*width:\s*([^)]+))?\)$/);
  if (imageMatch) {
    return {
      type: 'image',
      attrs: {
        src: imageMatch[1],
        width: imageMatch[2]?.trim() || null,
      },
    };
  }

  // 7.5. Table: #table(columns: N, [...], ...)
  const tableNode = parseTable(block);
  if (tableNode) {
    return tableNode;
  }

  // 7.6. Pagebreak: #pagebreak()
  if (block.trimStart().startsWith('#pagebreak')) {
    return { type: 'pagebreak' };
  }

  // 7.7. Bibliography: #bibliography(...)
  if (block.trimStart().startsWith('#bibliography(')) {
    return {
      type: 'bibliography',
      attrs: { content: block },
    };
  }

  // 8. Raw block check — if block contains code we can't render as WYSIWYG
  if (isRawBlock(block)) {
    return {
      type: 'typstRawBlock',
      attrs: {
        content: block,
        blockType: classifyRawBlock(block),
      },
    };
  }

  // 9. Default: paragraph with inline formatting
  const text = lines.join(' ');
  const inlineContent = parseInline(text);
  return {
    type: 'paragraph',
    content: inlineContent.length > 0 ? inlineContent : undefined,
  };
}

// ─── Raw Block Detection ─────────────────────────────────────

/**
 * Strips all known inline Typst constructs from text using balanced bracket parsing.
 * Returns only the "outer" text that is NOT inside known inline constructs.
 * This is used by isRawBlock to avoid false-positives from content inside
 * footnotes, highlights, links etc.
 */
function stripKnownInlines(text: string): string {
  let result = '';
  let i = 0;

  while (i < text.length) {
    let matched = false;

    // Check simple #func[content] patterns
    for (const sf of SIMPLE_INLINE) {
      if (text.startsWith(sf.prefix, i)) {
        const bc = extractInlineBrackets(text, i + sf.prefix.length - 1);
        if (bc) {
          i = bc.end;
          matched = true;
        }
        break;
      }
    }

    // Check #func(args)[content] patterns
    if (!matched) {
      for (const af of ARG_INLINE) {
        if (text.startsWith(af.prefix, i)) {
          const r = extractArgAndBracket(text, i + af.prefix.length, af.argKey);
          if (r) {
            i = r.end;
            matched = true;
          }
          break;
        }
      }
    }

    // Check #link("url")[text] pattern
    if (!matched && text.startsWith('#link(', i)) {
      let j = i + 6;
      let depth = 1;
      while (j < text.length && depth > 0) {
        if (text[j] === '(') depth++;
        if (text[j] === ')') depth--;
        j++;
      }
      if (depth === 0 && j < text.length && text[j] === '[') {
        const bc = extractInlineBrackets(text, j);
        if (bc) {
          i = bc.end;
          matched = true;
        }
      }
    }

    // Skip @citekey patterns (so they don't interfere with raw block detection)
    if (!matched && text[i] === '@' && /[a-zA-Z]/.test(text[i + 1] || '')) {
      const citeMatch = text.slice(i).match(/^@[a-zA-Z][\w-]*/);
      if (citeMatch) {
        i += citeMatch[0].length;
        matched = true;
      }
    }

    if (!matched) {
      result += text[i];
      i++;
    }
  }

  return result;
}

/**
 * Determines if a block contains Typst code that can't be
 * rendered as WYSIWYG. Safety first: if in doubt, it's raw.
 */
function isRawBlock(block: string): boolean {
  const lines = block.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Comment line
    if (trimmed.startsWith('//')) return true;

    // Strip known inline constructs (with balanced bracket parsing)
    // so that content inside #footnote[...], #text(...)[...], etc.
    // doesn't trigger false positives
    const stripped = stripKnownInlines(trimmed);

    // Math mode in outer text only (not inside footnotes etc.)
    if (stripped.includes('$')) return true;

    // Any remaining # expression that we don't parse visually
    if (/#[a-zA-Z{(]/.test(stripped)) return true;
  }

  return false;
}

/**
 * Classifies a raw block for UI styling purposes.
 */
function classifyRawBlock(block: string): string {
  const firstLine = block.split('\n')[0].trim();

  if (block.includes('$')) return 'math';
  if (firstLine.startsWith('//')) return 'comment';

  if (/^#(set|show|page|import|include)\b/.test(firstLine)) return 'config';
  if (/^#(let|for|if|while|return)\b/.test(firstLine)) return 'code';

  return 'unknown';
}

// ─── Table Parser ───────────────────────────────────────────

/**
 * Parses an `#align(spec)[…]` block. Returns null if the block isn't
 * an align construct or the brackets aren't balanced. The inner content
 * is split into paragraphs (separated by `#v(…)` markers or blank lines)
 * and each paragraph is best-effort un-wrapped from typical wrappers
 * (`#text(…)[X]`, `#datetime.today().display(…)`, plain text). Bold +
 * large `#text` becomes a heading.
 *
 * This is intentionally pragmatic — perfect Typst interpretation is out
 * of scope for the deserializer, but we want title pages and abstract
 * headings to survive DOCX export as actual visible text.
 */
function parseAlignedBlock(block: string): TipTapNode | TipTapNode[] | null {
  const headerMatch = block.match(/^#align\(([^)]+)\)\[/);
  if (!headerMatch) return null;

  const bracketStart = block.indexOf('[', headerMatch[0].length - 1);
  if (bracketStart < 0) return null;

  // Walk balanced brackets to find the matching closing `]`.
  let depth = 0;
  let end = -1;
  for (let i = bracketStart; i < block.length; i++) {
    if (block[i] === '[') depth++;
    else if (block[i] === ']') {
      depth--;
      if (depth === 0) { end = i; break; }
    }
  }
  if (end < 0 || end !== block.length - 1) return null;

  const spec = headerMatch[1].trim();
  const inner = block.slice(bracketStart + 1, end).trim();

  const alignment: 'center' | 'right' | 'left' = /\bright\b/.test(spec)
    ? 'right'
    : /\bleft\b/.test(spec)
      ? 'left'
      : 'center';

  // Special-case: a single image inside the align block.
  const innerImageMatch = inner.match(/^#image\("([^"]+)"(?:\s*,\s*width:\s*([^)]+))?\)$/);
  if (innerImageMatch) {
    return {
      type: 'image',
      attrs: {
        src: innerImageMatch[1],
        width: innerImageMatch[2]?.trim() || null,
        align: alignment,
      },
    };
  }

  // Special-case: a single heading inside the align block.
  const innerHeadingMatch = inner.match(/^(={1,4})\s+(.+)$/);
  if (innerHeadingMatch) {
    return {
      type: 'heading',
      attrs: { level: innerHeadingMatch[1].length, textAlign: alignment },
      content: parseInline(innerHeadingMatch[2]),
    };
  }

  // General case: split into chunks separated by `#v(…)` or blank lines,
  // then convert each chunk into a paragraph (or heading for big bold text).
  const chunks = splitAlignedChunks(inner);
  const nodes: TipTapNode[] = [];
  for (const chunk of chunks) {
    const node = chunkToAlignedNode(chunk, alignment);
    if (node) nodes.push(node);
  }
  if (nodes.length === 0) {
    nodes.push({ type: 'paragraph', attrs: { textAlign: alignment } });
  }
  return nodes;
}

/** Splits the inside of an aligned block into logical chunks. */
function splitAlignedChunks(inner: string): string[] {
  // Replace #v(…) calls with a synthetic separator, then split on blank
  // lines. The separator ensures vertical-spacing markers also break
  // chunks — they're the most common way users separate title elements.
  const SEP = ' VBREAK ';
  const withSep = inner.replace(/#v\([^)]+\)/g, `\n${SEP}\n`);
  const chunks = withSep.split(/\n\s*\n/).map(c => c.trim()).filter(c => c && c !== SEP);
  return chunks;
}

/** Converts one chunk inside an aligned block into a TipTap node. */
function chunkToAlignedNode(chunk: string, alignment: 'center' | 'right' | 'left'): TipTapNode | null {
  // #text(size: 22pt, weight: "bold")[Title] → centered Heading 1
  // #text(size: 14pt)[Subtitle]              → centered paragraph (kept bold if weight present)
  const textMatch = chunk.match(/^#text\((.*?)\)\[([\s\S]+)\]$/);
  if (textMatch) {
    const args = textMatch[1];
    const innerText = textMatch[2].trim();
    const sizeMatch = args.match(/size:\s*(\d+(?:\.\d+)?)\s*pt/);
    const isBold = /weight:\s*"bold"/.test(args);
    const size = sizeMatch ? parseFloat(sizeMatch[1]) : 11;

    // Heading-sized bold text → emit as Heading 1 so DOCX picks up Title style.
    if (isBold && size >= 18) {
      return {
        type: 'heading',
        attrs: { level: 1, textAlign: alignment },
        content: parseInline(innerText),
      };
    }

    // Otherwise: paragraph. Apply bold mark inline if `weight: "bold"`.
    const inline = parseInline(innerText);
    const marked = isBold
      ? inline.map(n => n.type === 'text' ? { ...n, marks: [...(n.marks || []), { type: 'bold' }] } : n)
      : inline;
    return {
      type: 'paragraph',
      attrs: { textAlign: alignment },
      content: marked.length > 0 ? marked : undefined,
    };
  }

  // #datetime.today().display("…") → today's date as plain text.
  if (/^#datetime\.today\(\)\.display\(/.test(chunk)) {
    const today = new Date().toLocaleDateString();
    return {
      type: 'paragraph',
      attrs: { textAlign: alignment },
      content: [{ type: 'text', text: today }],
    };
  }

  // Plain text or other inline-formatted line.
  const inline = parseInline(chunk);
  if (inline.length === 0) return null;
  return {
    type: 'paragraph',
    attrs: { textAlign: alignment },
    content: inline,
  };
}

/**
 * Parses a Typst #table(...) block into TipTap table nodes.
 * Supports: #table(columns: N, [cell], ...) with optional table.header(...)
 * Returns null for complex tables (unknown params, non-integer columns) → falls back to raw block.
 */
function parseTable(block: string): TipTapNode | null {
  // Must start with #table( and end with )
  if (!block.startsWith('#table(')) return null;

  // Find the matching closing paren (the block splitter ensures balanced parens)
  if (block[block.length - 1] !== ')') return null;

  const inner = block.slice(7, -1).trim();

  // Extract columns: N (only simple integer supported)
  const colMatch = inner.match(/^columns:\s*(\d+)\s*,/);
  if (!colMatch) return null;

  const numCols = parseInt(colMatch[1]);
  if (numCols < 1 || numCols > 20) return null;

  let remaining = inner.slice(colMatch[0].length).trim();

  // Check for unsupported parameters before the first cell
  // Supported: table.header(...) or [cell]
  // Unsupported: align:, stroke:, fill:, gutter:, inset:, rows: etc.
  if (remaining.length > 0 && remaining[0] !== '[' && !remaining.startsWith('table.header(')) {
    // Check if there's an unsupported param before cells
    if (/^[a-z]/.test(remaining)) return null;
  }

  // Parse header if present
  let headerCells: string[] | null = null;
  if (remaining.startsWith('table.header(')) {
    remaining = remaining.slice('table.header('.length);
    const headerResult = extractCellsUntilParen(remaining);
    if (!headerResult) return null;
    headerCells = headerResult.cells;
    remaining = headerResult.rest.replace(/^[\s,]*/, '');
  }

  // Parse body cells
  const bodyCells = extractAllCells(remaining);

  // Validate cell counts
  if (headerCells && headerCells.length !== numCols) return null;
  if (bodyCells.length % numCols !== 0) return null;

  // Build TipTap table structure
  const rows: TipTapNode[] = [];

  if (headerCells) {
    rows.push({
      type: 'tableRow',
      content: headerCells.map((cell) => ({
        type: 'tableHeader',
        attrs: { colspan: 1, rowspan: 1, colwidth: null },
        content: [{ type: 'paragraph', content: parseInline(cell.trim()) }],
      })),
    });
  }

  for (let i = 0; i < bodyCells.length; i += numCols) {
    rows.push({
      type: 'tableRow',
      content: bodyCells.slice(i, i + numCols).map((cell) => ({
        type: 'tableCell',
        attrs: { colspan: 1, rowspan: 1, colwidth: null },
        content: [{ type: 'paragraph', content: parseInline(cell.trim()) }],
      })),
    });
  }

  if (rows.length === 0) return null;

  return { type: 'table', content: rows };
}

/**
 * Extracts [...] cell contents from text until a closing paren ) is found.
 * Used for table.header(...) parsing.
 */
function extractCellsUntilParen(text: string): { cells: string[]; rest: string } | null {
  const cells: string[] = [];
  let i = 0;

  while (i < text.length) {
    // Skip whitespace and commas
    while (i < text.length && /[\s,]/.test(text[i])) i++;
    if (i >= text.length) return null;

    if (text[i] === ')') {
      // End of header section
      return { cells, rest: text.slice(i + 1) };
    }

    if (text[i] === '[') {
      const result = extractBracketContent(text, i);
      if (!result) return null;
      cells.push(result.content);
      i = result.end;
    } else {
      // Unexpected character → can't parse
      return null;
    }
  }

  return null; // No closing paren found
}

/**
 * Extracts all [...] cell contents from remaining text.
 */
function extractAllCells(text: string): string[] {
  const cells: string[] = [];
  let i = 0;

  while (i < text.length) {
    // Skip whitespace and commas
    while (i < text.length && /[\s,]/.test(text[i])) i++;
    if (i >= text.length) break;

    if (text[i] === '[') {
      const result = extractBracketContent(text, i);
      if (!result) break;
      cells.push(result.content);
      i = result.end;
    } else {
      // Non-cell content (e.g., trailing comma or unknown param) → stop
      break;
    }
  }

  return cells;
}

/**
 * Extracts the content inside [...] starting at position i, handling nested brackets.
 * Returns the content string and the position after the closing bracket.
 */
function extractBracketContent(text: string, start: number): { content: string; end: number } | null {
  if (text[start] !== '[') return null;

  let depth = 1;
  let i = start + 1;

  while (i < text.length && depth > 0) {
    if (text[i] === '[') depth++;
    if (text[i] === ']') depth--;
    i++;
  }

  if (depth !== 0) return null;

  return { content: text.slice(start + 1, i - 1), end: i };
}

// ─── Inline Parser ───────────────────────────────────────────

/**
 * Parses inline Typst formatting into TipTap text nodes with marks.
 * First extracts inline constructs (#footnote[...]), then applies formatting.
 */
type InlineSegType =
  | 'text'
  | 'footnote'
  | 'link'
  | 'citation'
  | 'textColor'
  | 'highlight'
  | 'underline'
  | 'superscript'
  | 'subscript'
  | 'smallcaps';

interface InlineSegment {
  type: InlineSegType;
  content: string;
  args?: string;
}

function parseInline(text: string): TipTapNode[] {
  if (!text) return [];

  const segments = splitInlineConstructs(text);
  const result: TipTapNode[] = [];

  for (const seg of segments) {
    switch (seg.type) {
      case 'footnote':
        result.push({ type: 'footnote', attrs: { content: seg.content } });
        break;
      case 'citation':
        result.push({ type: 'citation', attrs: { citekey: seg.content, label: seg.content } });
        break;
      case 'link':
        result.push(
          ...parseFormattedText(seg.content).map((n) => ({
            ...n,
            marks: [...(n.marks ?? []), { type: 'link', attrs: { href: seg.args } }],
          })),
        );
        break;
      case 'textColor':
        result.push(
          ...parseFormattedText(seg.content).map((n) => ({
            ...n,
            marks: [...(n.marks ?? []), { type: 'textColor', attrs: { color: seg.args } }],
          })),
        );
        break;
      case 'highlight':
        result.push(
          ...parseFormattedText(seg.content).map((n) => ({
            ...n,
            marks: [...(n.marks ?? []), { type: 'highlight', attrs: { color: seg.args } }],
          })),
        );
        break;
      case 'underline':
        result.push(
          ...parseFormattedText(seg.content).map((n) => ({
            ...n,
            marks: [...(n.marks ?? []), { type: 'underline' }],
          })),
        );
        break;
      case 'superscript':
        result.push(
          ...parseFormattedText(seg.content).map((n) => ({
            ...n,
            marks: [...(n.marks ?? []), { type: 'superscript' }],
          })),
        );
        break;
      case 'subscript':
        result.push(
          ...parseFormattedText(seg.content).map((n) => ({
            ...n,
            marks: [...(n.marks ?? []), { type: 'subscript' }],
          })),
        );
        break;
      case 'smallcaps':
        result.push(
          ...parseFormattedText(seg.content).map((n) => ({
            ...n,
            marks: [...(n.marks ?? []), { type: 'smallcaps' }],
          })),
        );
        break;
      default:
        result.push(...parseFormattedText(seg.content));
    }
  }

  return result.length > 0 ? result : [{ type: 'text', text }];
}

/** Simple inline constructs: #func[content] */
const SIMPLE_INLINE = [
  { prefix: '#footnote[', type: 'footnote' as const },
  { prefix: '#underline[', type: 'underline' as const },
  { prefix: '#super[', type: 'superscript' as const },
  { prefix: '#sub[', type: 'subscript' as const },
  { prefix: '#smallcaps[', type: 'smallcaps' as const },
];

/** Inline constructs with args: #func(args)[content] */
const ARG_INLINE = [
  { prefix: '#text(', type: 'textColor' as const, argKey: 'fill' },
  { prefix: '#highlight(', type: 'highlight' as const, argKey: 'fill' },
];

function splitInlineConstructs(text: string): InlineSegment[] {
  const segments: InlineSegment[] = [];
  let i = 0;
  let textStart = 0;

  while (i < text.length) {
    let matched = false;

    // Check simple #func[content] patterns
    for (const sf of SIMPLE_INLINE) {
      if (text.startsWith(sf.prefix, i)) {
        if (i > textStart) {
          segments.push({ type: 'text', content: text.slice(textStart, i) });
        }
        const bracketContent = extractInlineBrackets(text, i + sf.prefix.length - 1);
        if (bracketContent) {
          segments.push({ type: sf.type, content: bracketContent.content });
          i = bracketContent.end;
          textStart = i;
          matched = true;
        }
        break;
      }
    }

    // Check #func(args)[content] patterns
    if (!matched) {
      for (const af of ARG_INLINE) {
        if (text.startsWith(af.prefix, i)) {
          if (i > textStart) {
            segments.push({ type: 'text', content: text.slice(textStart, i) });
          }
          const result = extractArgAndBracket(text, i + af.prefix.length, af.argKey);
          if (result) {
            segments.push({ type: af.type, content: result.content, args: result.argValue });
            i = result.end;
            textStart = i;
            matched = true;
          }
          break;
        }
      }
    }

    // Check #link("url")[text] pattern
    if (!matched && text.startsWith('#link(', i)) {
      if (i > textStart) {
        segments.push({ type: 'text', content: text.slice(textStart, i) });
      }
      // Extract the URL from #link("url")
      let j = i + 6; // after '#link('
      let depth = 1;
      while (j < text.length && depth > 0) {
        if (text[j] === '(') depth++;
        if (text[j] === ')') depth--;
        j++;
      }
      if (depth === 0 && j < text.length && text[j] === '[') {
        const argsStr = text.slice(i + 6, j - 1); // content between ( and )
        const urlMatch = argsStr.match(/"([^"]*)"/);
        const href = urlMatch ? urlMatch[1] : argsStr.trim();
        const bc = extractInlineBrackets(text, j);
        if (bc) {
          segments.push({ type: 'link', content: bc.content, args: href });
          i = bc.end;
          textStart = i;
          matched = true;
        }
      }
    }

    // Check @citekey pattern (Typst citation)
    if (!matched && text[i] === '@' && /[a-zA-Z]/.test(text[i + 1] || '')) {
      // Only trigger at word boundary (start of string or after whitespace/punctuation)
      const prev = i > 0 ? text[i - 1] : ' ';
      if (/[\s([\-,;:!?]/.test(prev) || i === 0) {
        const citeMatch = text.slice(i).match(/^@([a-zA-Z][\w-]*)/);
        if (citeMatch) {
          if (i > textStart) {
            segments.push({ type: 'text', content: text.slice(textStart, i) });
          }
          segments.push({ type: 'citation', content: citeMatch[1] });
          i += citeMatch[0].length;
          textStart = i;
          matched = true;
        }
      }
    }

    if (!matched) {
      i++;
    }
  }

  if (textStart < text.length) {
    segments.push({ type: 'text', content: text.slice(textStart) });
  }

  return segments.length > 0 ? segments : [{ type: 'text', content: text }];
}

/** Extract balanced [...] content starting at the '[' position. */
function extractInlineBrackets(
  text: string,
  start: number,
): { content: string; end: number } | null {
  if (text[start] !== '[') return null;
  let depth = 1;
  let j = start + 1;
  while (j < text.length && depth > 0) {
    if (text[j] === '[') depth++;
    if (text[j] === ']') depth--;
    j++;
  }
  if (depth !== 0) return null;
  return { content: text.slice(start + 1, j - 1), end: j };
}

/**
 * Extract (args)[content] — parses the arg value for a specific key,
 * then the bracket content after the closing paren.
 */
function extractArgAndBracket(
  text: string,
  argsStart: number,
  argKey: string,
): { argValue: string; content: string; end: number } | null {
  // Find closing paren
  let depth = 1;
  let j = argsStart;
  while (j < text.length && depth > 0) {
    if (text[j] === '(') depth++;
    if (text[j] === ')') depth--;
    j++;
  }
  if (depth !== 0) return null;

  const argsStr = text.slice(argsStart, j - 1);

  // Extract the specific arg value
  const argMatch = argsStr.match(new RegExp(`${argKey}\\s*:\\s*([^,)]+)`));
  const argValue = argMatch ? argMatch[1].trim() : '';

  // Expect '[' immediately after ')'
  if (j >= text.length || text[j] !== '[') return null;

  const bracketContent = extractInlineBrackets(text, j);
  if (!bracketContent) return null;

  return { argValue, content: bracketContent.content, end: bracketContent.end };
}

/**
 * Parses formatting marks (*bold*, _italic_, `code`) in a text segment.
 */
function parseFormattedText(text: string): TipTapNode[] {
  if (!text) return [];

  const result: TipTapNode[] = [];
  const pattern = /(\*([^*]+)\*)|(_([^_]+)_)|(`([^`]+)`)/g;
  let lastIndex = 0;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      result.push({ type: 'text', text: text.slice(lastIndex, match.index) });
    }

    if (match[2] !== undefined) {
      result.push({
        type: 'text',
        text: match[2],
        marks: [{ type: 'bold' }],
      });
    } else if (match[4] !== undefined) {
      result.push({
        type: 'text',
        text: match[4],
        marks: [{ type: 'italic' }],
      });
    } else if (match[6] !== undefined) {
      result.push({
        type: 'text',
        text: match[6],
        marks: [{ type: 'code' }],
      });
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    result.push({ type: 'text', text: text.slice(lastIndex) });
  }

  return result.length > 0 ? result : [{ type: 'text', text }];
}
