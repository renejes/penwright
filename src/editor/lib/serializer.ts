// TipTap JSON → Typst Serializer (Phase 2: with typstRawBlock passthrough)

import type { Node as PMNode } from '@tiptap/pm/model';
import { reconcileTableParams } from '../../shared/tableParams';

interface TipTapNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TipTapNode[];
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  text?: string;
}

export function serializeTypst(doc: TipTapNode): string {
  if (!doc.content) return '';
  try {
    return joinBlocks(doc.content.map((node) => serializeNode(node)), doc.content);
  } catch (err) {
    console.error('[penwright] Serializer error:', err);
    return '';
  }
}

/**
 * Joins top-level blocks with a blank line — except a list that HUGS the
 * paragraph above it, which takes a single newline.
 *
 * That is not cosmetic. In Typst a list directly under its intro line renders
 * TIGHTER than one separated by a blank line, so emitting `\n\n` everywhere
 * would move every attached list on the page. The flag rides on the list node
 * (`attached`), set by the deserializer's block splitter and declared in the
 * schema by `ListAttachment` — without that declaration ProseMirror drops it
 * and the next save flattens the distinction.
 */
function joinBlocks(parts: string[], nodes: readonly TipTapNode[]): string {
  let out = '';
  for (let i = 0; i < parts.length; i++) {
    if (i > 0) out += nodes[i]?.attrs?.attached ? '\n' : '\n\n';
    out += parts[i];
  }
  return out;
}

/**
 * Incremental variant of `serializeTypst` for use inside the editor.
 *
 * ProseMirror document nodes are immutable: when the user edits paragraph
 * #47, only that paragraph's node reference changes — all other top-level
 * blocks keep the same object identity. We cache the serialized output per
 * block keyed by the PMNode itself, so unchanged blocks are reused verbatim
 * on the next call.
 *
 * For a 100-page document with ~2000 blocks, typing a single character
 * drops serialization from ~150 ms (serialize every block) to ~1 ms
 * (serialize one block + hash-map lookups for the rest).
 *
 * The cache is a WeakMap, so dropped blocks are garbage-collected
 * automatically — no memory leak.
 */
const blockCache: WeakMap<PMNode, string> = new WeakMap();

export function serializeTypstCached(pmDoc: PMNode): string {
  try {
    const parts: string[] = [];
    const nodes: TipTapNode[] = [];
    pmDoc.forEach((block) => {
      let cached = blockCache.get(block);
      if (cached === undefined) {
        cached = serializeNode(block.toJSON() as TipTapNode);
        blockCache.set(block, cached);
      }
      parts.push(cached);
      // Only the attrs are needed for the join, so this stays cheap — the
      // serialized TEXT is still what the cache holds.
      nodes.push({ type: block.type.name, attrs: block.attrs });
    });
    return joinBlocks(parts, nodes);
  } catch (err) {
    console.error('[penwright] Serializer error:', err);
    return '';
  }
}

function serializeNode(node: TipTapNode): string {
  switch (node.type) {
    case 'heading': {
      const level = (node.attrs?.level as number) ?? 1;
      const prefix = '='.repeat(level);
      const text = serializeInline(node.content ?? []);
      // A Typst label (`<sec:x>`) is emitted from the attr, NOT through the
      // text run, so it stays unescaped — escaping it to `\<sec:x\>` would
      // destroy the label and every `@sec:x` cross-reference into it.
      const label = node.attrs?.label as string | undefined;
      const labelSuffix = label ? ` <${label}>` : '';
      const headingText = `${prefix} ${text}${labelSuffix}`;
      return wrapWithAlign(headingText, node.attrs?.textAlign as string, node.attrs?.alignSpec as string);
    }

    case 'paragraph': {
      const paraText = escapeLeadingBlockMarker(serializeInline(node.content ?? []));
      return wrapWithAlign(paraText, node.attrs?.textAlign as string, node.attrs?.alignSpec as string);
    }

    case 'bulletList': {
      return (node.content ?? [])
        .map((item) => serializeListItem(item, '-', 0))
        .join('\n');
    }

    case 'orderedList': {
      return (node.content ?? [])
        .map((item) => serializeListItem(item, '+', 0))
        .join('\n');
    }

    case 'blockquote': {
      const text = (node.content ?? [])
        .map((child) => serializeInline(child.content ?? []))
        .join('\n');
      return `#quote[${text}]`;
    }

    case 'codeBlock': {
      const lang = (node.attrs?.language as string) ?? '';
      // Code is literal: never escape or apply marks inside a code block.
      const text = (node.content ?? []).map((n) => n.text ?? '').join('');
      return '```' + lang + '\n' + text + '\n```';
    }

    case 'horizontalRule': {
      return '#line(length: 100%)';
    }

    case 'image': {
      const src = (node.attrs?.src as string) ?? '';
      const width = node.attrs?.width as string | null;
      const align = node.attrs?.align as string | null;
      const alt = (node.attrs?.alt as string | null) || null;
      // alt is a real Typst #image param (accessibility) — it used to be
      // silently dropped on save even though the image dialog writes it.
      const args = [`"${src}"`];
      if (alt) args.push(`alt: ${typstStr(alt)}`);
      if (width) args.push(`width: ${width}`);
      const imageCode = `#image(${args.join(', ')})`;
      if (align && align !== 'left') {
        return `#align(${align})[${imageCode}]`;
      }
      return imageCode;
    }

    case 'table': {
      return serializeTable(node);
    }

    case 'pagebreak': {
      // Round-trip the arguments. Emitting a bare `#pagebreak()` turned
      // `weak: true` into a forced break (a possible blank page) and dropped
      // `to: "even"` (the spread's left-page alignment) — both silently, in
      // documents that had been laid out deliberately.
      const args = typeof node.attrs?.args === 'string' ? node.attrs.args.trim() : '';
      return args ? `#pagebreak(${args})` : '#pagebreak()';
    }

    // Bibliography: passthrough — original #bibliography(...) preserved
    case 'bibliography': {
      return (node.attrs?.content as string) ?? '#bibliography("references.bib")';
    }

    // Raw block: passthrough — original Typst code is preserved 1:1
    case 'typstRawBlock': {
      return (node.attrs?.content as string) ?? '';
    }

    // ─── Magazine nodes (Phase C keystone) ─────────────────────────────────
    // Each re-emits the exact `#macro(…)` call so the round-trip compiles to an
    // identical PDF (compile-stability, not byte-identity — plan §6.2).
    case 'articleHeader': {
      const a = node.attrs ?? {};
      const parts: string[] = [];
      if (a.kicker) parts.push(`kicker: ${typstStr(a.kicker as string)}`);
      parts.push(`title: ${typstStr((a.title as string) ?? '')}`);
      if (a.standfirst) parts.push(`standfirst: ${typstStr(a.standfirst as string)}`);
      if (a.byline) parts.push(`byline: ${typstStr(a.byline as string)}`);
      return `#opener(${parts.join(', ')})`;
    }

    case 'interlude': {
      return '#interlude()';
    }

    case 'dropCap': {
      return `#lead[${serializeInline(node.content ?? [])}]`;
    }

    case 'question': {
      return `#frage[${serializeInline(node.content ?? [])}]`;
    }

    case 'pullQuote': {
      const who = node.attrs?.who as string | undefined;
      const args = who ? `(who: ${typstStr(who)})` : '';
      return `#pull${args}[${serializeInline(node.content ?? [])}]`;
    }

    case 'callout': {
      const title = node.attrs?.title as string | undefined;
      const args = title ? `(title: ${typstStr(title)})` : '';
      return `#notiz${args}[\n${serializeBlockBody(node.content ?? [])}\n]`;
    }

    case 'figurePanel': {
      const a = node.attrs ?? {};
      const parts: string[] = [typstStr((a.path as string) ?? '')];
      if (a.caption) parts.push(`caption: [${a.caption as string}]`);
      if (a.title) parts.push(`title: ${typstStr(a.title as string)}`);
      parts.push(`[\n${serializeBlockBody(node.content ?? [])}\n]`);
      return `#bildtafel(${parts.join(', ')})`;
    }

    case 'columns': {
      const cols = (node.attrs?.cols as number) ?? 2;
      const gutter = node.attrs?.gutter as string | undefined;
      const args = gutter ? `${cols}, gutter: ${gutter}` : `${cols}`;
      return `#columns(${args})[\n${serializeBlockBody(node.content ?? [])}\n]`;
    }

    default:
      return serializeInline(node.content ?? []);
  }
}

/** Quotes + escapes a string for a Typst string argument (`"…"`). */
function typstStr(s: string): string {
  return `"${(s ?? '').replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

/** Serializes a content-node's block children, blank-line separated, so the
 *  deserializer's block splitter recovers them on re-open. Attached lists hug
 *  the paragraph above them here too — the splitter re-parses these bodies with
 *  the same rules. */
function serializeBlockBody(nodes: TipTapNode[]): string {
  return joinBlocks(nodes.map((n) => serializeNode(n)), nodes);
}

/**
 * Wraps block content in #align(direction)[...] if alignment is not left/default.
 * Justify is typically document-wide via #set par(justify: true), so we skip it.
 */
/**
 * `spec` is the original `#align(…)` argument when it carried more than the
 * horizontal alignment — `center + horizon` centres vertically too, and
 * re-emitting the reduced `center` silently flattened three shipped title
 * pages. The editor only ever edits the horizontal part, so the spec is
 * passed through untouched when present.
 */
function wrapWithAlign(content: string, align: string | undefined | null, spec?: string | null): string {
  if (spec) return `#align(${spec})[${content}]`;
  if (!align || align === 'left' || align === 'justify') {
    return content;
  }
  return `#align(${align})[${content}]`;
}

/**
 * Backslash-escapes Typst markup-significant characters in a plain text run so
 * that literal `*`, `#`, `@`, `$`, … typed by the user compile verbatim and do
 * NOT get re-parsed as markup/citations/code on the next open.
 *
 * Backslash itself is in the class, so it is escaped in the same single pass
 * (a literal `\` becomes `\\`) — there is no double-escaping. The deserializer
 * is the exact inverse: it skips escaped characters when scanning for inline
 * constructs and unescapes `\x` → `x` when building text nodes.
 *
 * NOTE: mark delimiters (`*…*`, `_…_`, …) are added by the caller AFTER this,
 * so they stay live; only the user's inner text is escaped. Code blocks and
 * raw/bibliography passthrough bypass this (they are literal Typst).
 */
/**
 * Serializes one listItem, recursing into nested bullet/ordered lists
 * (reachable via Tab / sinkListItem). Nested lists become indented `- `/`+ `
 * lines — Typst's nesting syntax; they used to be silently DROPPED because
 * serializeInline knows no block node types. Continuation paragraphs are
 * indented two spaces past the marker so they stay part of the item.
 */
function serializeListItem(item: TipTapNode, marker: '-' | '+', depth: number): string {
  const indent = '  '.repeat(depth);
  const inlineParts: string[] = [];
  const nestedParts: string[] = [];
  for (const child of item.content ?? []) {
    if (child.type === 'bulletList' || child.type === 'orderedList') {
      const childMarker = child.type === 'bulletList' ? '-' : '+';
      nestedParts.push(
        (child.content ?? [])
          .map((sub) => serializeListItem(sub, childMarker, depth + 1))
          .join('\n'),
      );
    } else {
      inlineParts.push(serializeInline(child.content ?? []));
    }
  }
  const first = `${indent}${marker} ${inlineParts.join(`\n${indent}  `)}`;
  return nestedParts.length ? [first, ...nestedParts].join('\n') : first;
}

function escapeTypstText(text: string): string {
  return (
    text
      .replace(/[\\`*_#@$<>~[\]]/g, (ch) => '\\' + ch)
      // `//` starts a Typst line comment even mid-sentence — everything after
      // it on the line would silently vanish from the PDF ("a//b", …). Escape
      // the first slash of every pair.
      // (`/*` INSIDE one run needs no handling: the `*` is escaped above,
      // which already breaks the comment token.)
      //
      // EXCEPT after `http:` / `https:`. Typst auto-detects a bare URL in markup
      // and renders it as a real link — clickable, and coloured/underlined by the
      // project's `show link:` rule. Escaping that `//` broke the detection, so
      // every URL in a research appendix came back as plain black text with a
      // dead annotation. Two client documents were full of them.
      .replace(/(?<!\bhttps?:)\/(?=\/)/g, '\\/')
      // A real non-breaking space becomes Typst's `~` shorthand. LAST, so the
      // escape pass above cannot turn it into `\~` — which is a visible tilde
      // and was exactly the corruption this pairs with: the deserializer now
      // maps source `~` to U+00A0 and `\~` to a literal tilde, and this line
      // maps them back.
      .replace(/\u00A0/g, '~')
  );
}

/**
 * A paragraph whose visible text starts with a Typst block marker (`= ` heading,
 * `- `/`+ ` list, `/ ` term list, or `1. ` enum) would be re-parsed as that
 * block on the next open. Escape only the leading marker; mid-line dashes etc.
 * stay untouched.
 */
function escapeLeadingBlockMarker(text: string): string {
  return text
    // `={1,6}`, not a single `=`: a paragraph starting `== Foo` was left alone
    // (the old pattern needed whitespace right after ONE `=`), so on the next
    // open Typst read it as a level-2 heading and swallowed the paragraph.
    .replace(/^(\s*)(={1,6})(\s)/, '$1\\$2$3')
    .replace(/^(\s*)([\-+/])(\s)/, '$1\\$2$3')
    .replace(/^(\s*)(\d+)\.(\s)/, '$1$2\\.$3');
}

/**
 * Writes a table back, keeping the author's own parameters verbatim.
 *
 * `attrs.params` holds the source text of everything the `#table(...)` declared
 * — `columns:`, and whatever `align:` / `fill:` / `stroke:` / `inset:` came with
 * it — carried through the round trip untouched by `parseTable`. Re-emitting it
 * rather than synthesising `columns: N` is what lets a hand-styled table be
 * cell-editable without this code understanding, or destroying, its styling.
 *
 * The one thing that MUST be rewritten is the column count, and only when the
 * user actually changed the table's shape. A stale `columns:` does not fail
 * loudly — Typst silently reflows the table (verified against 0.15.1), so a
 * column added through the gear menu would quietly scramble every row.
 */
function serializeTable(node: TipTapNode): string {
  const rows = node.content ?? [];
  if (rows.length === 0) return '#table(columns: 1)';

  const numCols = (rows[0].content ?? []).length;
  const firstRowCells = rows[0].content ?? [];
  const hasHeader = firstRowCells.length > 0 && firstRowCells.every((cell) => cell.type === 'tableHeader');

  const cellLines: string[] = [];
  let startRow = 0;
  if (hasHeader) {
    // Keep the form the author wrote. The two render identically
    // (pixel-compared), so rewriting one into the other would churn eight client
    // files on every save and buy nothing.
    if (node.attrs?.headerForm === 'bracket') {
      cellLines.push(`  table.header${firstRowCells.map(serializeTableCell).join('')}`);
    } else {
      cellLines.push(`  table.header(\n    ${firstRowCells.map(serializeTableCell).join(', ')},\n  )`);
    }
    startRow = 1;
  }
  for (let r = startRow; r < rows.length; r++) {
    cellLines.push(`  ${(rows[r].content ?? []).map(serializeTableCell).join(', ')}`);
  }

  const params = typeof node.attrs?.params === 'string' ? node.attrs.params : '';
  const head = params ? reconcileTableParams(params, numCols) : `columns: ${numCols}`;
  return `#table(\n  ${head},\n${cellLines.join(',\n')},\n)`;
}

/**
 * One cell, in the form it was written in.
 *
 * A cell that came from a `"string"` goes back as a string — but ONLY while it
 * is still plain text. The moment it carries a mark or a node (the user made a
 * word bold, added a footnote), a string could not express it, so it becomes a
 * content block. That is the round-trip rule applied per cell: emit the form
 * that can actually give the content back.
 */
function serializeTableCell(cell: TipTapNode): string {
  const inner = serializeCellContent(cell);
  if (cell.attrs?.literal === true && isPlainTextCell(cell)) {
    return `"${plainCellText(cell).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  }
  return `[${inner}]`;
}

/** A cell holding nothing but unmarked text — the only thing a string can hold. */
function isPlainTextCell(cell: TipTapNode): boolean {
  const blocks = cell.content ?? [];
  if (blocks.length > 1) return false;
  if (blocks.length === 0) return true;
  if (blocks[0].type !== 'paragraph') return false;
  return (blocks[0].content ?? []).every((n) => n.type === 'text' && !(n.marks ?? []).length);
}

function plainCellText(cell: TipTapNode): string {
  const para = (cell.content ?? [])[0];
  return ((para?.content ?? []).map((n) => n.text ?? '').join(''));
}

/**
 * Returns the parameter text with `columns:` made to agree with `numCols`, and
 * every other character untouched.
 *
 * A tuple keeps the widths the author chose and grows or shrinks at the end
 * (`auto` for a new column, which is Typst's own default); an integer is just
 * the number. When the count already agrees — the overwhelmingly common case,
 * since editing a cell does not change the shape — the text is returned
 * unchanged and the round trip is byte-exact.
 */
function serializeCellContent(cell: TipTapNode): string {
  // Cell content is block-level (paragraphs), serialize inline content of first paragraph
  const paragraphs = cell.content ?? [];
  if (paragraphs.length === 0) return '';
  return paragraphs
    .map((p) => serializeInline(p.content ?? []))
    .join(' ');
}

/**
 * Serializes inline nodes, then repairs the one hazard that only exists BETWEEN
 * two of them: a run ending in `/` next to a run opening with `*` or `/` fuses
 * into `/*` or `//` — an unterminated block comment that eats the rest of the
 * document, or a line comment that eats the rest of the line. (Text "and/" plus
 * bold "or" → `and/*or*`.)
 *
 * `escapeTypstText` used to escape EVERY run-final slash for this, which cannot
 * see whether a neighbour exists — so it also escaped the trailing slash of a
 * URL at the end of a sentence, and that `\/` truncated the auto-detected link.
 * Deciding it here, where the neighbour is known, escapes only what can fuse.
 */
/**
 * Serializes inline nodes back to Typst. Exported so the DESERIALIZER can check
 * its own work: a table cell is only claimed as editable when parsing it and
 * writing it back reproduces the source (see `cellRoundTrips`). Without that
 * check, `parseInline` silently drops what it does not model — a `\\` linebreak,
 * and the `size:` out of `#text(size: 8.5pt, fill: mute)[…]` — which the pixel
 * gate caught as a whole extra page in a client offer.
 */
export function serializeInlineNodes(nodes: TipTapNode[]): string {
  return serializeInline(nodes);
}

function serializeInline(nodes: TipTapNode[]): string {
  const parts = nodes.map((node) => serializeInlineNode(node));
  for (let i = 0; i < parts.length - 1; i++) {
    if (parts[i].endsWith('/') && /^[*/]/.test(parts[i + 1])) {
      parts[i] = `${parts[i].slice(0, -1)}\\/`;
    }
  }
  return parts.join('');
}

/** One inline node → its Typst text. Cross-node repair happens in the caller. */
function serializeInlineNode(node: TipTapNode): string {
  if (node.type === 'text') {
    const marks = node.marks ?? [];
    // Code marks become Typst raw spans (`…`), which are literal and do NOT
    // process backslash escapes — so leave their text un-escaped.
    const isCode = marks.some((m) => m.type === 'code');
    let text = isCode ? (node.text ?? '') : escapeTypstText(node.text ?? '');

    // Apply marks inside-out
    for (const mark of marks) {
      switch (mark.type) {
        case 'bold':
          text = `*${text}*`;
          break;
        case 'italic':
          text = `_${text}_`;
          break;
        case 'code':
          // A Typst raw span is delimited by single backticks and has no
          // escape mechanism, so content containing a backtick cannot be
          // written that way — `` `\`code\`` `` reads back as an EMPTY raw
          // span, plain text, and a second empty one: monospace and
          // backticks both gone. `#raw("…")` is the string form and takes
          // anything (the deserializer already parses it back to a code
          // mark). An empty span needs it too: `` `` `` is not a raw span
          // at all, just two literal backticks.
          text = text === '' || text.includes('`') ? `#raw(${typstStr(text)})` : `\`${text}\``;
          break;
        case 'strike':
          // Typst has no `~…~` strikethrough — `~` is the non-breaking
          // space shorthand. #strike[…] is the real thing (and what the
          // Markdown importer already emits).
          text = `#strike[${text}]`;
          break;
        case 'link':
          // Quote+escape the href so a `"` or `\` in the URL can't break the
          // string (matches the deserializer, which reads a quoted string).
          text = `#link(${typstStr(String(mark.attrs?.href ?? ''))})[${text}]`;
          break;
        case 'textColor':
          text = `#text(fill: ${mark.attrs?.color ?? 'black'})[${text}]`;
          break;
        case 'highlight':
          text = `#highlight(fill: ${mark.attrs?.color ?? 'yellow'})[${text}]`;
          break;
        case 'underline':
          text = `#underline[${text}]`;
          break;
        case 'superscript':
          text = `#super[${text}]`;
          break;
        case 'subscript':
          text = `#sub[${text}]`;
          break;
        case 'smallcaps':
          text = `#smallcaps[${text}]`;
          break;
      }
    }

    return text;
  }

  if (node.type === 'footnote') {
    return `#footnote[${node.attrs?.content ?? ''}]`;
  }

  if (node.type === 'marginNote') {
    return `#randnotiz[${node.attrs?.body ?? ''}]`;
  }

  if (node.type === 'citation') {
    const key = node.attrs?.citekey ?? '';
    const supplement = node.attrs?.supplement;
    return supplement ? `@${key}[${supplement}]` : `@${key}`;
  }

  if (node.type === 'reference') {
    return `@${node.attrs?.label ?? ''}`;
  }

  if (node.type === 'hardBreak') {
    // A Typst forced line break is a trailing `\`, NOT a bare newline (which
    // is only a soft break = space). Emitting `\n` lost the break on compile.
    return ' \\\n';
  }

  return '';
}
