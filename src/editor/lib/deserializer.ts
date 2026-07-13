/**
 * Typst → TipTap JSON Deserializer
 * Phase 2: Block-Level Hybrid Parser
 *
 * Splits the document into blocks (separated by blank lines).
 * Each block is classified as either:
 *   - Visual Block → parsed into TipTap nodes (WYSIWYG)
 *   - Raw Block    → wrapped in typstRawBlock node (code view, roundtrip-safe)
 */

import { isReferenceLabel, refTypeFromLabel } from '../../shared/refLabels';

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
  let inMath = false;

  for (const line of lines) {
    const wasNested =
      inCodeBlock || braceDepth > 0 || bracketDepth > 0 || parenDepth > 0;
    const wasInMath = inMath;

    // Track code block fences
    if (line.trim().startsWith('```')) {
      inCodeBlock = !inCodeBlock;
    }

    // Track nesting depth (only outside code blocks)
    if (!inCodeBlock) {
      for (let ci = 0; ci < line.length; ci++) {
        const char = line[ci];
        if (char === '{') braceDepth++;
        if (char === '}') braceDepth = Math.max(0, braceDepth - 1);
        if (char === '[') bracketDepth++;
        if (char === ']') bracketDepth = Math.max(0, bracketDepth - 1);
        if (char === '(') parenDepth++;
        if (char === ')') parenDepth = Math.max(0, parenDepth - 1);
        if (char === '$' && line[ci - 1] !== '\\') inMath = !inMath;
      }
    }

    const isNested =
      inCodeBlock || braceDepth > 0 || bracketDepth > 0 || parenDepth > 0;

    // A heading line is its own block in Typst — no blank line required.
    // Without this, consecutive `=== a` / `==== b` lines (or a heading
    // directly under a paragraph) glue into one paragraph and the heading
    // markers leak into the text. The math-parity guard keeps `= x` lines
    // inside a multi-line `$ … $` display equation untouched.
    if (/^={1,6}\s+\S/.test(line) && !wasNested && !isNested && !wasInMath) {
      if (current.length > 0) {
        blocks.push(current.join('\n'));
        current = [];
      }
      blocks.push(line);
      continue;
    }

    // Blank line outside nesting AND outside display math → block boundary.
    // A multi-line `$ … $` equation may contain blank lines for readability;
    // splitting there left an unbalanced-`$` head and re-parsed the tail as
    // prose (mirrors the wasInMath guard on the heading branch above).
    if (line.trim() === '' && !isNested && !inMath) {
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
    // Strip the single trailing newline that precedes the closing ``` fence —
    // it is the delimiter, not part of the code. Without this the serializer's
    // own `\n` before the fence accumulates one blank line per round-trip.
    const codeText = codeBlockMatch[2].replace(/\n$/, '');
    return {
      type: 'codeBlock',
      attrs: { language: codeBlockMatch[1] || null },
      content: codeText ? [{ type: 'text', text: codeText }] : undefined,
    };
  }

  // 2. Heading: = Title, == Title, etc.
  const headingMatch = block.match(/^(={1,6})\s+(.+)$/);
  if (headingMatch) {
    // A trailing Typst label (`= Title <sec:x>`) is element syntax, not
    // heading text. Split it into a `label` attr so it round-trips as a real
    // label instead of being escaped to `\<sec:x\>` on save (which silently
    // breaks the label and every `@sec:x` cross-reference into it). Guard
    // against an escaped literal `\<x\>`: the label name excludes `\`, and the
    // `<` must not be backslash-escaped.
    let headingText = headingMatch[2];
    let label: string | undefined;
    const labelMatch = headingText.match(/<([^<>\s\\]+)>\s*$/);
    const idx = labelMatch?.index ?? -1;
    if (labelMatch && idx >= 0 && headingText[idx - 1] !== '\\') {
      label = labelMatch[1];
      headingText = headingText.slice(0, idx).trimEnd();
    }
    const attrs: Record<string, unknown> = { level: headingMatch[1].length };
    if (label) attrs.label = label;
    return {
      type: 'heading',
      attrs,
      content: parseInline(headingText),
    };
  }

  // 3. & 4. List blocks ("- " bullets, "+ " ordered).
  //    Continuation lines that are indented (or empty) belong to the
  //    previous item — without this the deserializer rejected real
  //    multi-line list items and dumped them as raw text.
  const lines = block.split('\n');
  const listMarker = lines[0]?.match(/^([-+]) /)?.[1];
  if (listMarker && lines.every((l) => l.match(/^[-+] /) || /^\s/.test(l) || l === '')) {
    // Indentation-aware parse: indented `- `/`+ ` lines become NESTED lists
    // (the serializer's sinkListItem output), plain indented lines stay
    // continuation text of the previous item. Bails (null) on a root-level
    // marker switch — same as the old allMatchSameMarker guard.
    const parsed = parseNestedList(lines);
    if (parsed) return parsed;
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

  // 7. Image: #image("path") with optional alt: "…" and width: … args
  const imageAttrs = parseImageCall(block);
  if (imageAttrs) {
    return { type: 'image', attrs: imageAttrs };
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

  // 7.8. Magazine macros (Phase C keystone) → real AST nodes.
  //      MUST run BEFORE isRawBlock: these blocks start with `#opener` / `#frage`
  //      / … which the raw-block `#[a-zA-Z]` test would otherwise claim, and a
  //      leading `// penwright:node=…` marker would force them to typstRawBlock.
  const magazineNode = parseMagazineMacro(block);
  if (magazineNode) return magazineNode;

  // 7.9. A whole-block `#text(…)[…]` styling call carrying non-`fill` args
  //      (size / weight / style / font / tracking) → raw block (preserved
  //      verbatim). A `fill`-only span is faithfully a textColor paragraph, but
  //      multi-arg styling can't be represented as a single mark, so keep it 1:1
  //      instead of dropping the other args (which broke compile / changed the
  //      rendered page). Inline `#text(fill: …)[word]` inside prose is untouched.
  if (isWholeBlockStyledText(block)) {
    return { type: 'typstRawBlock', attrs: { content: block, blockType: classifyRawBlock(block) } };
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

  // 9. Default: paragraph with inline formatting (Typst trailing-`\` → hardBreak)
  return {
    type: 'paragraph',
    content: paragraphInline(lines),
  };
}

/**
 * Builds a paragraph's inline content. A line ending in a lone `\` is a Typst
 * forced line break (`linebreak()`) → a `hardBreak` node; every other newline
 * is a soft break → a single joining space. Without this, `A \` + newline + `B`
 * collapsed to `A  B` (the line break was silently lost, reflowing the text).
 */
function paragraphInline(lines: string[]): TipTapNode[] | undefined {
  const out: TipTapNode[] = [];
  let buf: string[] = [];
  const flush = () => {
    const text = buf.join(' ');
    if (text) out.push(...parseInline(text));
    buf = [];
  };
  for (const line of lines) {
    const m = line.match(/\\\s*$/);
    // A trailing `\` is a linebreak — but not an escaped literal `\\`.
    if (m && (m.index === 0 || line[m.index! - 1] !== '\\')) {
      buf.push(line.slice(0, m.index).replace(/\s+$/, ''));
      flush();
      out.push({ type: 'hardBreak' });
    } else {
      buf.push(line);
    }
  }
  flush();
  // A paragraph shouldn't end on a dangling break (keeps the round-trip a fixed point).
  while (out.length && out[out.length - 1].type === 'hardBreak') out.pop();
  return out.length > 0 ? out : undefined;
}

// ─── Raw Block Detection ─────────────────────────────────────

/**
 * Strips all known inline Typst constructs from text using balanced bracket parsing.
 * Returns only the "outer" text that is NOT inside known inline constructs.
 * This is used by isRawBlock to avoid false-positives from content inside
 * footnotes, highlights, links etc.
 */
/**
 * String-aware scan of a `#link(` call starting at `i` (index of the '#').
 * Tracks quoted strings so a ')' inside the URL doesn't end the call early.
 * Returns the raw args + the index after the closing ')', or null if
 * unbalanced.
 */
function scanLinkCall(text: string, i: number): { argsStr: string; end: number } | null {
  let j = i + 6; // after '#link('
  let depth = 1;
  let inStr = false;
  while (j < text.length && depth > 0) {
    const c = text[j];
    if (c === '"' && text[j - 1] !== '\\') inStr = !inStr;
    if (!inStr) {
      if (c === '(') depth++;
      else if (c === ')') depth--;
    }
    j++;
  }
  if (depth !== 0) return null;
  return { argsStr: text.slice(i + 6, j - 1), end: j };
}

/** Bodyless `#link("url")` is only accepted when the args are EXACTLY one
 *  quoted string — `#link(label("x"))` and friends stay plain/raw text. */
const BARE_LINK_ARGS = /^\s*"([^"]*)"\s*$/;

function stripKnownInlines(text: string): string {
  let result = '';
  let i = 0;

  while (i < text.length) {
    // Escaped chars (`\x`) are literal — drop them from the stripped output so a
    // prose block with a literal `\$` or `\#word` isn't misclassified as raw.
    if (text[i] === '\\') {
      i += 2;
      continue;
    }

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

    // Check #link("url")[text] — and the bodyless #link("url") form, which
    // parseInline turns into a real link node (so a prose paragraph with a
    // bare URL link must not be classified raw).
    if (!matched && text.startsWith('#link(', i)) {
      const call = scanLinkCall(text, i);
      if (call) {
        if (call.end < text.length && text[call.end] === '[') {
          const bc = extractInlineBrackets(text, call.end);
          if (bc) {
            i = bc.end;
            matched = true;
          }
        } else if (BARE_LINK_ARGS.test(call.argsStr)) {
          i = call.end;
          matched = true;
        }
      }
    }

    // Skip #raw("...") inline (args form) so it doesn't trigger a false raw
    // positive. The block form `#raw(...)[…]` is left alone (stays raw).
    if (!matched && text.startsWith('#raw(', i)) {
      let j = i + 5;
      let depth = 1;
      let inStr = false;
      while (j < text.length && depth > 0) {
        const c = text[j];
        if (c === '"' && text[j - 1] !== '\\') inStr = !inStr;
        if (!inStr) { if (c === '(') depth++; else if (c === ')') depth--; }
        j++;
      }
      if (depth === 0 && text[j] !== '[') {
        i = j;
        matched = true;
      }
    }

    // Skip @citekey / @label patterns (so they don't interfere with raw
    // block detection). Allow `:` and `.` so cross-refs like `@fig:results`
    // are also covered.
    if (!matched && text[i] === '@' && /[a-zA-Z]/.test(text[i + 1] || '')) {
      const citeMatch = text.slice(i).match(/^@[a-zA-Z][\w:.-]*/);
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

  // A comment line anywhere marks the block as raw (config / comment).
  for (const line of lines) {
    if (line.trim().startsWith('//')) return true;
  }

  // Strip known inline constructs across the WHOLE block before checking what
  // is left. Stripping per-line was wrong: an inline construct can span lines
  // (e.g. a multi-line `#footnote[…]` body), so each individual line looked
  // unbalanced and the whole paragraph was misclassified as raw code.
  const stripped = stripKnownInlines(lines.join('\n'));

  // Math mode in outer text only (not inside footnotes etc.)
  if (stripped.includes('$')) return true;

  // Any remaining # expression that we don't parse visually
  if (/#[a-zA-Z{(]/.test(stripped)) return true;

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
/**
 * Parses a standalone `#image("src", …)` call with the round-trippable named
 * args `alt: "…"` (any position) and `width: …`. Returns null when the call
 * carries anything else, so unknown args fall through to the raw-block path
 * instead of being dropped.
 */
function parseImageCall(src: string): { src: string; width: string | null; alt: string | null } | null {
  const m = src.match(
    /^#image\("([^"]+)"((?:\s*,\s*(?:alt:\s*"(?:[^"\\]|\\.)*"|width:\s*[^,)]+))*)\s*\)$/,
  );
  if (!m) return null;
  const tail = m[2] ?? '';
  const altMatch = tail.match(/alt:\s*"((?:[^"\\]|\\.)*)"/);
  const widthMatch = tail.match(/width:\s*([^,)]+)/);
  return {
    src: m[1],
    width: widthMatch ? widthMatch[1].trim() : null,
    alt: altMatch ? altMatch[1].replace(/\\(["\\])/g, '$1') : null,
  };
}

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
  const innerImageAttrs = parseImageCall(inner);
  if (innerImageAttrs) {
    return {
      type: 'image',
      attrs: { ...innerImageAttrs, align: alignment },
    };
  }

  // Special-case: a single heading inside the align block.
  const innerHeadingMatch = inner.match(/^(={1,6})\s+(.+)$/);
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
  // Bail on chunks we can't faithfully represent (a centered #figure /
  // #table / arbitrary macro, or a heading mixed into a multi-chunk block) —
  // parseInline would emit their raw source as literal prose, which the next
  // save re-escapes and thereby destroys the construct. Returning null lets
  // the whole block fall through to the verbatim raw-block path.
  for (const chunk of chunks) {
    if (isUnhandledAlignedChunk(chunk)) return null;
  }
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

/** True when a chunk inside #align[...] has no faithful WYSIWYG mapping. */
function isUnhandledAlignedChunk(chunk: string): boolean {
  // The two shapes chunkToAlignedNode handles explicitly.
  if (/^#text\(/.test(chunk) || /^#datetime\.today\(\)\.display\(/.test(chunk)) return false;
  // After stripping the known inline constructs, any leftover #macro( call
  // (e.g. #figure(, #table(, #image() or a heading marker means the chunk
  // would degrade to literal text.
  const stripped = stripKnownInlines(chunk);
  return /#[a-zA-Z][\w.-]*\(/.test(stripped) || /^=/.test(stripped.trim());
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
  const { cells: bodyCells, rest: trailing } = extractAllCells(remaining);

  // Trailing non-cell content (e.g. `align: center, fill: gray` AFTER the
  // cells) would be silently dropped and destroyed on the next save — bail
  // so the whole #table(...) round-trips as a verbatim raw block instead.
  if (trailing.trim() !== '') return null;

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
 * Extracts all [...] cell contents from remaining text. `rest` is whatever
 * follows the last cell — non-empty means unparsed params the caller must
 * not silently drop.
 */
function extractAllCells(text: string): { cells: string[]; rest: string } {
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

  return { cells, rest: text.slice(i) };
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
    // An escaped `\]` / `\[` is literal, not a delimiter — skip both chars so
    // the body isn't truncated at an escaped bracket. Content is kept verbatim
    // (these bodies are raw Typst that must round-trip including the escape).
    if (text[i] === '\\') { i += 2; continue; }
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
// ─── Nested list parsing ─────────────────────────────────────

interface ListItemAcc {
  text: string[];
  children: ListAcc[];
}
interface ListAcc {
  marker: '-' | '+';
  indent: number;
  items: ListItemAcc[];
}

/**
 * Parses list lines with indentation-based nesting. Returns null when the
 * shape isn't a single well-formed list (root-level marker switch) so the
 * caller can fall through to the other block parsers.
 */
function parseNestedList(lines: string[]): TipTapNode | null {
  let root: ListAcc | null = null;
  const stack: ListAcc[] = [];

  for (const line of lines) {
    const m = line.match(/^(\s*)([-+]) (.*)$/);
    if (m) {
      const indent = m[1].length;
      const marker = m[2] as '-' | '+';
      const rest = m[3];

      while (stack.length > 0 && indent < stack[stack.length - 1].indent) stack.pop();
      let top = stack[stack.length - 1];

      if (!top || indent > top.indent) {
        // Deeper level → new list attached to the last item of the current one.
        const list: ListAcc = { marker, indent, items: [] };
        if (top) {
          const parentItem = top.items[top.items.length - 1];
          if (!parentItem) return null; // nested marker before any parent item
          parentItem.children.push(list);
        } else if (root) {
          return null; // second root list in one block — not a single list
        } else {
          root = list;
        }
        stack.push(list);
        top = list;
      } else if (marker !== top.marker) {
        // Marker switch at the same level: at root that's not one list (bail,
        // matching the old guard); nested it starts a sibling list on the
        // same parent item.
        stack.pop();
        const parent = stack[stack.length - 1];
        if (!parent) return null;
        const parentItem = parent.items[parent.items.length - 1];
        if (!parentItem) return null;
        const list: ListAcc = { marker, indent, items: [] };
        parentItem.children.push(list);
        stack.push(list);
        top = list;
      }

      top.items.push({ text: [rest], children: [] });
    } else {
      // Continuation line → append to the deepest current item.
      const top = stack[stack.length - 1];
      const item = top?.items[top.items.length - 1];
      if (item) {
        const t = line.trim();
        if (t) item.text.push(t);
      }
    }
  }

  if (!root || root.items.length === 0) return null;

  const toNode = (list: ListAcc): TipTapNode => ({
    type: list.marker === '-' ? 'bulletList' : 'orderedList',
    content: list.items.map((it) => ({
      type: 'listItem',
      content: [
        { type: 'paragraph', content: parseInline(it.text.join(' ').trim()) },
        ...it.children.map(toNode),
      ],
    })),
  });
  return toNode(root);
}

type InlineSegType =
  | 'text'
  | 'footnote'
  | 'marginNote'
  | 'emphasis'
  | 'strong'
  | 'rawInline'
  | 'link'
  | 'citation'
  | 'reference'
  | 'textColor'
  | 'highlight'
  | 'underline'
  | 'superscript'
  | 'subscript'
  | 'smallcaps'
  | 'strike';

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
      case 'marginNote':
        result.push({ type: 'marginNote', attrs: { body: seg.content } });
        break;
      case 'emphasis':
        result.push(
          ...parseFormattedText(seg.content).map((n) => ({
            ...n,
            marks: [...(n.marks ?? []), { type: 'italic' }],
          })),
        );
        break;
      case 'strong':
        result.push(
          ...parseFormattedText(seg.content).map((n) => ({
            ...n,
            marks: [...(n.marks ?? []), { type: 'bold' }],
          })),
        );
        break;
      case 'rawInline':
        result.push({ type: 'text', text: seg.content, marks: [{ type: 'code' }] });
        break;
      case 'citation':
        result.push({ type: 'citation', attrs: { citekey: seg.content, label: seg.content } });
        break;
      case 'reference':
        result.push({
          type: 'reference',
          attrs: { label: seg.content, caption: '', refType: refTypeFromLabel(seg.content) },
        });
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
      case 'strike':
        result.push(
          ...parseFormattedText(seg.content).map((n) => ({
            ...n,
            marks: [...(n.marks ?? []), { type: 'strike' }],
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
  { prefix: '#randnotiz[', type: 'marginNote' as const },
  { prefix: '#emph[', type: 'emphasis' as const },
  { prefix: '#strong[', type: 'strong' as const },
  { prefix: '#underline[', type: 'underline' as const },
  { prefix: '#strike[', type: 'strike' as const },
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
    // Honor backslash escapes: a `\x` can never start an inline construct and
    // stays part of the surrounding text run (unescaped later in
    // parseFormattedText). Skip both characters.
    if (text[i] === '\\') {
      i += 2;
      continue;
    }

    let matched = false;

    // Check simple #func[content] patterns.
    // IMPORTANT: the preceding text run is pushed only AFTER extraction
    // succeeds — pushing on prefix-match alone re-emitted the same span at
    // loop end when extraction failed (duplicated text + leaked macro source).
    for (const sf of SIMPLE_INLINE) {
      if (text.startsWith(sf.prefix, i)) {
        const bracketContent = extractInlineBrackets(text, i + sf.prefix.length - 1);
        if (bracketContent) {
          if (i > textStart) {
            segments.push({ type: 'text', content: text.slice(textStart, i) });
          }
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
          const result = extractArgAndBracket(text, i + af.prefix.length, af.argKey);
          if (result) {
            if (i > textStart) {
              segments.push({ type: 'text', content: text.slice(textStart, i) });
            }
            segments.push({ type: af.type, content: result.content, args: result.argValue });
            i = result.end;
            textStart = i;
            matched = true;
          }
          break;
        }
      }
    }

    // Check #link("url")[text] — and the bodyless form #link("url"), which is
    // the standard bare-URL link (renders the URL as its own text). The scan
    // is string-aware so a ')' inside the URL doesn't end the call early.
    if (!matched && text.startsWith('#link(', i)) {
      const call = scanLinkCall(text, i);
      if (call) {
        const urlMatch = call.argsStr.match(/"([^"]*)"/);
        const href = urlMatch ? urlMatch[1] : call.argsStr.trim();
        if (call.end < text.length && text[call.end] === '[') {
          const bc = extractInlineBrackets(text, call.end);
          if (bc) {
            if (i > textStart) {
              segments.push({ type: 'text', content: text.slice(textStart, i) });
            }
            segments.push({ type: 'link', content: bc.content, args: href });
            i = bc.end;
            textStart = i;
            matched = true;
          }
        } else {
          // Bare form — only when the args are exactly one quoted string
          // (guard against #link(label("x")) etc.). Link text = the URL;
          // serializes back as #link("url")[url] — visually identical.
          const bare = BARE_LINK_ARGS.exec(call.argsStr);
          if (bare && bare[1]) {
            if (i > textStart) {
              segments.push({ type: 'text', content: text.slice(textStart, i) });
            }
            segments.push({ type: 'link', content: bare[1], args: bare[1] });
            i = call.end;
            textStart = i;
            matched = true;
          }
        }
      }
    }

    // Check #raw("code") inline pattern → code mark. The args form (string
    // argument, no trailing `[…]`); the block form `#raw(...)[…]` and fenced
    // ```code``` are handled at block level.
    if (!matched && text.startsWith('#raw(', i)) {
      let j = i + 5;
      let depth = 1;
      let inStr = false;
      while (j < text.length && depth > 0) {
        const c = text[j];
        if (c === '"' && text[j - 1] !== '\\') inStr = !inStr;
        if (!inStr) { if (c === '(') depth++; else if (c === ')') depth--; }
        j++;
      }
      if (depth === 0 && text[j] !== '[') {
        const argsStr = text.slice(i + 5, j - 1);
        const strMatch = argsStr.match(/"((?:[^"\\]|\\.)*)"/);
        if (strMatch) {
          if (i > textStart) {
            segments.push({ type: 'text', content: text.slice(textStart, i) });
          }
          segments.push({ type: 'rawInline', content: strMatch[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\') });
          i = j;
          textStart = i;
          matched = true;
        }
      }
    }

    // Check @label pattern. Same source syntax (`@something`) is used both
    // for citations (bib entry) and cross-references (label inside a .typ).
    // We heuristically separate them: a colon in the name OR a known label
    // prefix (`fig|tbl|eq|sec|chap` and friends) → reference; otherwise →
    // citation. The picker only ever emits prefixed labels, so the heuristic
    // matches our own writes round-trip.
    if (!matched && text[i] === '@' && /[a-zA-Z]/.test(text[i + 1] || '')) {
      // Only trigger at word boundary (start of string or after whitespace/punctuation)
      const prev = i > 0 ? text[i - 1] : ' ';
      if (/[\s([\-,;:!?]/.test(prev) || i === 0) {
        // Reference-style labels can carry colons and dots, so allow them in
        // the matched name. Trailing `.` / `:` are sentence punctuation, not
        // part of the name (`@key.` at sentence end) — Typst excludes them
        // too, so strip before classifying. The classifier below decides the
        // segment type.
        const refMatch = text.slice(i).match(/^@([a-zA-Z][\w:.-]*)/);
        if (refMatch) {
          if (i > textStart) {
            segments.push({ type: 'text', content: text.slice(textStart, i) });
          }
          const name = refMatch[1].replace(/[.:]+$/, '');
          if (isReferenceLabel(name)) {
            segments.push({ type: 'reference', content: name });
          } else {
            segments.push({ type: 'citation', content: name });
          }
          i += 1 + name.length;
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
    // Escaped `\]` / `\[` is literal — skip both chars (verbatim content), so an
    // inline `#footnote[…\]…]` / `#randnotiz[…\]…]` body isn't truncated at it.
    if (text[j] === '\\') { j += 2; continue; }
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

  // Extract the specific named arg via the nesting-aware parser (NOT a
  // `[^,)]+` regex, which truncated `fill: rgb(255, 0, 0)` at the first comma →
  // `rgb(255` → a broken `#text(fill: rgb(255)[…]` on re-serialize). If the key
  // is ABSENT this isn't the construct we map (e.g. `#text(weight: "bold")[…]`
  // has no `fill:`): return null so the caller leaves it intact → the block is
  // classified raw and round-trips verbatim, not mis-written as `#text(fill: )`.
  const { named } = parseTypstArgs(argsStr);
  const argValue = named[argKey];
  if (argValue === undefined) return null;

  // Expect '[' immediately after ')'
  if (j >= text.length || text[j] !== '[') return null;

  const bracketContent = extractInlineBrackets(text, j);
  if (!bracketContent) return null;

  return { argValue, content: bracketContent.content, end: bracketContent.end };
}

/**
 * Parses formatting marks (*bold*, _italic_, `code`) in a text segment, while
 * honoring backslash escapes. Only UNESCAPED `*` / `_` / `` ` `` act as
 * delimiters; a `\x` is the literal character x. Literal text and the inner
 * text of `*`/`_` marks are unescaped (`\x` → `x`); `code` spans are kept raw
 * (Typst raw text does not process escapes), mirroring the serializer.
 */
function parseFormattedText(text: string): TipTapNode[] {
  if (!text) return [];

  const result: TipTapNode[] = [];
  let buf = '';
  const flush = () => {
    if (buf) {
      result.push({ type: 'text', text: buf });
      buf = '';
    }
  };

  let i = 0;
  while (i < text.length) {
    const ch = text[i];

    // Escape → unescape into the literal buffer.
    if (ch === '\\' && i + 1 < text.length) {
      buf += text[i + 1];
      i += 2;
      continue;
    }

    if (ch === '*' || ch === '_' || ch === '`') {
      const close = findClosingDelim(text, i + 1, ch);
      // Require a non-empty body (matches the old `[^x]+` patterns).
      if (close > i + 1) {
        flush();
        const rawInner = text.slice(i + 1, close);
        if (ch === '`') {
          result.push({ type: 'text', text: rawInner, marks: [{ type: 'code' }] });
        } else {
          const markType = ch === '*' ? 'bold' : 'italic';
          result.push({
            type: 'text',
            text: unescapeLiteral(rawInner),
            marks: [{ type: markType }],
          });
        }
        i = close + 1;
        continue;
      }
    }

    buf += ch;
    i++;
  }
  flush();

  return result.length > 0 ? result : [{ type: 'text', text }];
}

/**
 * Finds the next closing delimiter at or after `from`. For `*`/`_` an escaped
 * delimiter (`\*`) is skipped; for `` ` `` (raw) the next backtick always closes
 * (Typst raw doesn't process escapes).
 */
function findClosingDelim(text: string, from: number, delim: string): number {
  const honorEscape = delim !== '`';
  for (let j = from; j < text.length; j++) {
    if (honorEscape && text[j] === '\\') {
      j++;
      continue;
    }
    if (text[j] === delim) return j;
  }
  return -1;
}

/** Unescapes `\x` → `x` across a literal string. */
function unescapeLiteral(text: string): string {
  let out = '';
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '\\' && i + 1 < text.length) {
      out += text[i + 1];
      i++;
    } else {
      out += text[i];
    }
  }
  return out;
}

// ─── Magazine macro recognition (Phase C keystone) ───────────────────────────
//
// The hand-written magazine macros become real AST nodes (typstMagazine.ts).
// Recognition is HYBRID: a leading `// penwright:node=…` marker (for
// Penwright-generated blocks) is tolerated + stripped, then dispatch is by macro
// NAME (the LANGSAM-convention; legacy chapters carry no marker). The serializer
// re-emits the exact macro call → the round-trip is compile-stable (identical
// PDF), not necessarily byte-identical (plan §6.2 / C9).
//
// Only the REFLOWABLE macros are converted; the print-only page-design macros
// (`#aufmacher`, `#doppelseite`, the cover) have no reflow analogue and stay raw
// blocks (handled by Phase E).

/** True when the whole block is a single `#text(args)[body]` styling call whose
 *  args carry a non-`fill` style property (size/weight/style/font/tracking/…) —
 *  a design block we can't represent as a single mark, so it stays raw/verbatim. */
function isWholeBlockStyledText(block: string): boolean {
  const t = block.trim();
  if (!/^#text\s*\(/.test(t)) return false;
  const open = t.indexOf('(');
  const a = matchTypstParens(t, open);
  if (!a) return false;
  let k = a.end;
  while (/\s/.test(t[k] ?? '')) k++;
  if (t[k] !== '[') return false;
  const b = extractBracketContent(t, k);
  if (!b || t.slice(b.end).trim() !== '') return false;
  return /\b(size|weight|style|font|tracking|spacing|baseline|features|stylistic-set|fallback)\s*:/.test(a.inner);
}

/** String-aware `(` … `)` matcher (code mode: `"…"` strings are skipped). */
function matchTypstParens(s: string, open: number): { inner: string; end: number } | null {
  if (s[open] !== '(') return null;
  let depth = 0;
  let inStr = false;
  for (let i = open; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (c === '\\') i++;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') { inStr = true; continue; }
    if (c === '(') depth++;
    else if (c === ')') {
      depth--;
      if (depth === 0) return { inner: s.slice(open + 1, i), end: i + 1 };
    }
  }
  return null;
}

/** Splits a Typst argument list on top-level commas (respecting "", [], (), {}). */
function splitTopLevelArgs(s: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let inStr = false;
  let start = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (c === '\\') i++;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === '(' || c === '[' || c === '{') depth++;
    else if (c === ')' || c === ']' || c === '}') depth = Math.max(0, depth - 1);
    else if (c === ',' && depth === 0) {
      parts.push(s.slice(start, i));
      start = i + 1;
    }
  }
  if (start <= s.length) parts.push(s.slice(start));
  return parts.map((p) => p.trim()).filter((p) => p.length > 0);
}

/** Parses a Typst call arg list into positional values + named values (raw slices). */
function parseTypstArgs(argStr: string): { positional: string[]; named: Record<string, string> } {
  const positional: string[] = [];
  const named: Record<string, string> = {};
  for (const part of splitTopLevelArgs(argStr)) {
    // Find a TOP-LEVEL `:` (a `key: value` separator), not one inside a value.
    let depth = 0;
    let inStr = false;
    let colon = -1;
    for (let i = 0; i < part.length; i++) {
      const c = part[i];
      if (inStr) {
        if (c === '\\') i++;
        else if (c === '"') inStr = false;
        continue;
      }
      if (c === '"') inStr = true;
      else if (c === '(' || c === '[' || c === '{') depth++;
      else if (c === ')' || c === ']' || c === '}') depth--;
      else if (c === ':' && depth === 0) { colon = i; break; }
    }
    const key = colon > 0 ? part.slice(0, colon).trim() : '';
    if (colon > 0 && /^[a-zA-Z][\w-]*$/.test(key)) {
      named[key] = part.slice(colon + 1).trim();
    } else {
      positional.push(part);
    }
  }
  return { positional, named };
}

/** Strips a surrounding `"…"` and unescapes `\"` / `\\`. Bare values pass through. */
function unquoteTypstString(s: string): string {
  const t = s.trim();
  if (t.length >= 2 && t[0] === '"' && t[t.length - 1] === '"') {
    return t.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  }
  return t;
}

/** Strips a surrounding `[…]` content bracket, returning the inner verbatim. */
function stripContentBrackets(s: string): string {
  const t = s.trim();
  if (t.length >= 2 && t[0] === '[' && t[t.length - 1] === ']') return t.slice(1, -1);
  return t;
}

/** Recursively parses a content-block body into child nodes (mirrors the
 *  top-level deserialize loop). Used for `#columns` / `#notiz` / `#bildtafel`
 *  bodies whose children must become real nodes (questions, paragraphs, …). */
function parseBlocks(inner: string): TipTapNode[] {
  const out: TipTapNode[] = [];
  for (const block of splitIntoBlocks(inner)) {
    const trimmed = block.trim();
    if (!trimmed) continue;
    try {
      const nodes = parseBlock(trimmed);
      if (Array.isArray(nodes)) out.push(...nodes);
      else if (nodes) out.push(nodes);
    } catch {
      out.push({ type: 'typstRawBlock', attrs: { content: trimmed, blockType: 'error' } });
    }
  }
  return out;
}

/** Matches a macro name at the start of `t` at a word boundary (so `#frage`
 *  matches `#frage[` but not `#fragefoo`). Returns the index past the name. */
function macroNameEnd(t: string, name: string): number {
  if (!t.startsWith('#' + name)) return -1;
  const after = t[name.length + 1];
  // next char must be `(`, `[`, whitespace, or end — i.e. a non-word char.
  if (after === undefined || /[([\s]/.test(after)) return name.length + 1;
  return -1;
}

/** `#name[body]` or `#name(args)[body]` spanning the whole block; null otherwise. */
function readMacroCall(
  t: string,
  nameEnd: number,
): { args: string; body: string | null } | null {
  let j = nameEnd;
  while (/\s/.test(t[j] ?? '')) j++;
  let args = '';
  if (t[j] === '(') {
    const a = matchTypstParens(t, j);
    if (!a) return null;
    args = a.inner;
    j = a.end;
    while (/\s/.test(t[j] ?? '')) j++;
  }
  let body: string | null = null;
  if (t[j] === '[') {
    const b = extractBracketContent(t, j);
    if (!b) return null;
    body = b.content;
    j = b.end;
  }
  // The macro must span the ENTIRE block — trailing content → not our node.
  if (t.slice(j).trim() !== '') return null;
  return { args, body };
}

/**
 * Recognises a reflowable magazine macro block and returns its AST node, or null
 * (→ the block falls through to isRawBlock / paragraph).
 */
function parseMagazineMacro(block: string): TipTapNode | null {
  // Tolerate (and drop) leading `// penwright:node=…` marker comment lines.
  let b = block;
  for (;;) {
    const m = b.match(/^[ \t]*\/\/[^\n]*\n/);
    if (m && /penwright:node=/.test(m[0])) b = b.slice(m[0].length);
    else break;
  }
  const t = b.trim();
  if (t[0] !== '#') return null;

  // interlude() — no args, no body.
  if (/^#interlude\s*\(\s*\)\s*$/.test(t)) return { type: 'interlude' };

  // opener(...) — all named string args; produces the outline H1 (title).
  let ne = macroNameEnd(t, 'opener');
  if (ne > 0) {
    const call = readMacroCall(t, ne);
    if (!call || call.body !== null) return null; // opener takes no body bracket
    const { named } = parseTypstArgs(call.args);
    const attrs: Record<string, unknown> = { title: named.title ? unquoteTypstString(named.title) : '' };
    if (named.kicker) attrs.kicker = unquoteTypstString(named.kicker);
    if (named.standfirst) attrs.standfirst = unquoteTypstString(named.standfirst);
    if (named.byline) attrs.byline = unquoteTypstString(named.byline);
    return { type: 'articleHeader', attrs };
  }

  // lead[body] → dropCap (editable inline prose).
  ne = macroNameEnd(t, 'lead');
  if (ne > 0) {
    const call = readMacroCall(t, ne);
    if (call && call.body !== null) return { type: 'dropCap', content: parseInline(call.body) };
    return null;
  }

  // frage[body] → question (editable inline prose).
  ne = macroNameEnd(t, 'frage');
  if (ne > 0) {
    const call = readMacroCall(t, ne);
    if (call && call.body !== null) return { type: 'question', content: parseInline(call.body) };
    return null;
  }

  // pull[body] / pull(who: "X")[body] → pullQuote.
  ne = macroNameEnd(t, 'pull');
  if (ne > 0) {
    const call = readMacroCall(t, ne);
    if (call && call.body !== null) {
      const { named } = parseTypstArgs(call.args);
      const attrs = named.who ? { who: unquoteTypstString(named.who) } : {};
      return { type: 'pullQuote', attrs, content: parseInline(call.body) };
    }
    return null;
  }

  // notiz[body] / notiz(title: "X")[body] → callout (multi-paragraph body).
  ne = macroNameEnd(t, 'notiz');
  if (ne > 0) {
    const call = readMacroCall(t, ne);
    if (call && call.body !== null) {
      const { named } = parseTypstArgs(call.args);
      const attrs = named.title ? { title: unquoteTypstString(named.title) } : {};
      const children = parseBlocks(call.body);
      return { type: 'callout', attrs, content: children.length ? children : [{ type: 'paragraph' }] };
    }
    return null;
  }

  // bildtafel("path", caption: [..], title: "..", [body]) → figurePanel.
  ne = macroNameEnd(t, 'bildtafel');
  if (ne > 0) {
    let j = ne;
    while (/\s/.test(t[j] ?? '')) j++;
    if (t[j] !== '(') return null;
    const a = matchTypstParens(t, j);
    if (!a || t.slice(a.end).trim() !== '') return null;
    const { positional, named } = parseTypstArgs(a.inner);
    const path = positional[0] ? unquoteTypstString(positional[0]) : '';
    const bodyRaw = positional[1] ?? '';
    const attrs: Record<string, unknown> = { path };
    if (named.caption) attrs.caption = stripContentBrackets(named.caption);
    if (named.title) attrs.title = unquoteTypstString(named.title);
    const children = parseBlocks(stripContentBrackets(bodyRaw));
    return { type: 'figurePanel', attrs, content: children.length ? children : [{ type: 'paragraph' }] };
  }

  // columns(n, gutter: g)[…] → columns (recursively-parsed block children).
  ne = macroNameEnd(t, 'columns');
  if (ne > 0) {
    let j = ne;
    while (/\s/.test(t[j] ?? '')) j++;
    if (t[j] !== '(') return null;
    const a = matchTypstParens(t, j);
    if (!a) return null;
    const { positional, named } = parseTypstArgs(a.inner);
    const cols = parseInt(positional[0] ?? '2', 10) || 2;
    const gutter = named.gutter ? named.gutter.trim() : '';
    j = a.end;
    while (/\s/.test(t[j] ?? '')) j++;
    if (t[j] !== '[') return null;
    const body = extractBracketContent(t, j);
    if (!body || t.slice(body.end).trim() !== '') return null;
    const children = parseBlocks(body.content);
    const attrs: Record<string, unknown> = { cols };
    if (gutter) attrs.gutter = gutter;
    return { type: 'columns', attrs, content: children.length ? children : [{ type: 'paragraph' }] };
  }

  return null;
}
