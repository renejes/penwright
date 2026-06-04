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
      const headingText = `${prefix} ${text}`;
      return wrapWithAlign(headingText, node.attrs?.textAlign as string);
    }

    case 'paragraph': {
      const paraText = serializeInline(node.content ?? []);
      return wrapWithAlign(paraText, node.attrs?.textAlign as string);
    }

    case 'bulletList': {
      return (node.content ?? [])
        .map((item) => {
          const text = (item.content ?? [])
            .map((child) => serializeInline(child.content ?? []))
            .join('\n');
          return `- ${text}`;
        })
        .join('\n');
    }

    case 'orderedList': {
      return (node.content ?? [])
        .map((item) => {
          const text = (item.content ?? [])
            .map((child) => serializeInline(child.content ?? []))
            .join('\n');
          return `+ ${text}`;
        })
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
      const text = serializeInline(node.content ?? []);
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

    default:
      return serializeInline(node.content ?? []);
  }
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
        let text = node.text ?? '';
        const marks = node.marks ?? [];

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
              text = `~${text}~`;
              break;
            case 'link':
              text = `#link("${mark.attrs?.href ?? ''}")[${text}]`;
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

      if (node.type === 'citation') {
        return `@${node.attrs?.citekey ?? ''}`;
      }

      if (node.type === 'reference') {
        return `@${node.attrs?.label ?? ''}`;
      }

      if (node.type === 'hardBreak') {
        return '\n';
      }

      return '';
    })
    .join('');
}
