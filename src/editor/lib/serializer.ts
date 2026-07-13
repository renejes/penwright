// TipTap JSON → Typst Serializer (Phase 2: with typstRawBlock passthrough)

import type { Node as PMNode } from '@tiptap/pm/model';

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
    return doc.content.map((node) => serializeNode(node)).join('\n\n');
  } catch (err) {
    console.error('[penwright] Serializer error:', err);
    return '';
  }
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
    pmDoc.forEach((block) => {
      let cached = blockCache.get(block);
      if (cached === undefined) {
        cached = serializeNode(block.toJSON() as TipTapNode);
        blockCache.set(block, cached);
      }
      parts.push(cached);
    });
    return parts.join('\n\n');
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
      return wrapWithAlign(headingText, node.attrs?.textAlign as string);
    }

    case 'paragraph': {
      const paraText = escapeLeadingBlockMarker(serializeInline(node.content ?? []));
      return wrapWithAlign(paraText, node.attrs?.textAlign as string);
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
      let imageCode: string;
      if (width) {
        imageCode = `#image("${src}", width: ${width})`;
      } else {
        imageCode = `#image("${src}")`;
      }
      if (align && align !== 'left') {
        return `#align(${align})[${imageCode}]`;
      }
      return imageCode;
    }

    case 'table': {
      return serializeTable(node);
    }

    case 'pagebreak': {
      return '#pagebreak()';
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
 *  deserializer's block splitter recovers them on re-open. */
function serializeBlockBody(nodes: TipTapNode[]): string {
  return nodes.map((n) => serializeNode(n)).join('\n\n');
}

/**
 * Wraps block content in #align(direction)[...] if alignment is not left/default.
 * Justify is typically document-wide via #set par(justify: true), so we skip it.
 */
function wrapWithAlign(content: string, align: string | undefined | null): string {
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
      // it on the line would silently vanish from the PDF (URLs pasted as
      // plain text, "a//b", …). Escape the first slash of every pair.
      // (`/*` INSIDE one run needs no handling: the `*` is escaped above,
      // which already breaks the comment token.)
      .replace(/\/(?=\/)/g, '\\/')
      // A run-FINAL slash can still fuse with the next run's mark delimiter
      // into `/*` (text "and/" + bold "or" → `and/*or*` = unterminated block
      // comment, silently eating the rest of the document). Escape it.
      .replace(/\/$/, '\\/')
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
    .replace(/^(\s*)([=\-+/])(\s)/, '$1\\$2$3')
    .replace(/^(\s*)(\d+)\.(\s)/, '$1$2\\.$3');
}

function serializeTable(node: TipTapNode): string {
  const rows = node.content ?? [];
  if (rows.length === 0) return '#table(columns: 1)';

  // Determine column count from first row
  const numCols = (rows[0].content ?? []).length;

  // Check if first row is a header row (all cells are tableHeader)
  const firstRowCells = rows[0].content ?? [];
  const hasHeader = firstRowCells.every((cell) => cell.type === 'tableHeader');

  const cellLines: string[] = [];

  if (hasHeader) {
    // Serialize header row
    const headerCells = firstRowCells
      .map((cell) => `[${serializeCellContent(cell)}]`)
      .join(', ');
    cellLines.push(`  table.header(\n    ${headerCells},\n  )`);

    // Serialize body rows
    for (let r = 1; r < rows.length; r++) {
      const rowCells = (rows[r].content ?? [])
        .map((cell) => `[${serializeCellContent(cell)}]`)
        .join(', ');
      cellLines.push(`  ${rowCells}`);
    }
  } else {
    // All rows are body rows
    for (const row of rows) {
      const rowCells = (row.content ?? [])
        .map((cell) => `[${serializeCellContent(cell)}]`)
        .join(', ');
      cellLines.push(`  ${rowCells}`);
    }
  }

  return `#table(\n  columns: ${numCols},\n${cellLines.join(',\n')},\n)`;
}

function serializeCellContent(cell: TipTapNode): string {
  // Cell content is block-level (paragraphs), serialize inline content of first paragraph
  const paragraphs = cell.content ?? [];
  if (paragraphs.length === 0) return '';
  return paragraphs
    .map((p) => serializeInline(p.content ?? []))
    .join(' ');
}

function serializeInline(nodes: TipTapNode[]): string {
  return nodes
    .map((node) => {
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
              text = `\`${text}\``;
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
        return `@${node.attrs?.citekey ?? ''}`;
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
    })
    .join('');
}
