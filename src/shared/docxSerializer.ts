/**
 * TipTap JSON → DOCX Serializer
 *
 * Converts a TipTap document (same AST the deserializer produces)
 * into a .docx file buffer using the `docx` npm package.
 *
 * Exported content: headings (numbered), paragraphs, bold/italic/underline/strike,
 * bullet & ordered lists, tables, images, links, footnotes, page breaks,
 * table of contents, bibliography.
 * Raw blocks (math, code) are rendered as grey monospace text.
 * Config blocks (#set, #show) are skipped.
 */

import {
  Document,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  LevelFormat,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  ImageRun,
  ExternalHyperlink,
  PageBreak,
  Packer,
  FootnoteReferenceRun,
  ShadingType,
  TableOfContents,
  type IRunOptions,
  type ISectionOptions,
  type ILevelsOptions,
} from 'docx';
import * as fs from 'fs';
import * as path from 'path';
import { parseBibFile, type BibEntry } from './bibParser';
import { parseSettings } from './settingsParser';

// ─── Types (mirrors deserializer output) ─────────────────────

interface TipTapNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TipTapNode[];
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  text?: string;
}

interface TipTapDoc {
  type: 'doc';
  content: TipTapNode[];
}

// ─── Public API ──────────────────────────────────────────────

/**
 * Convert a TipTap document AST to a DOCX buffer.
 * @param doc - TipTap document JSON (from deserializer)
 * @param baseDir - Directory for resolving relative image paths and .bib files
 * @param typstContent - Original Typst content (for extracting settings like heading numbering)
 * @returns Promise<Buffer> - The .docx file contents
 */
export async function serializeDocx(
  doc: TipTapDoc,
  baseDir: string = '.',
  typstContent?: string,
): Promise<Buffer> {
  const children: (Paragraph | Table | TableOfContents)[] = [];
  const footnotes: Record<number, { children: Paragraph[] }> = {};
  let footnoteCounter = 1;

  // Parse settings from Typst content to determine numbering format
  const settings = typstContent ? parseSettings(typstContent) : null;
  const hasNumbering = !!settings?.headingNumbering;

  // Track heading counters for manual numbering prefix
  const headingCounters = [0, 0, 0, 0, 0, 0];

  // Find bibliography info from the raw AST
  const bibInfo = findBibliographyInfo(doc, typstContent, baseDir);

  let bibRendered = false;

  for (const node of doc.content ?? []) {
    // Replace #outline raw blocks with a Word TOC field
    if (isOutlineBlock(node)) {
      children.push(
        new TableOfContents('Inhaltsverzeichnis', {
          hyperlink: true,
          headingStyleRange: '1-3',
        }),
      );
      continue;
    }

    // Replace bibliography blocks with formatted entries
    if (isBibliographyBlock(node) && bibInfo.entries.length > 0) {
      children.push(...renderBibliography(bibInfo.entries));
      bibRendered = true;
      continue;
    }

    const result = convertNode(
      node,
      baseDir,
      footnotes,
      footnoteCounter,
      hasNumbering,
      headingCounters,
    );
    children.push(...result.elements);
    footnoteCounter = result.nextFootnoteId;
  }

  // If bibliography wasn't rendered yet but we have entries, append at end
  if (bibInfo.entries.length > 0 && !bibRendered) {
    children.push(...renderBibliography(bibInfo.entries));
  }

  const doc_options: ISectionOptions = {
    properties: {},
    children,
  };

  const document = new Document({
    features: { updateFields: true },
    sections: [doc_options],
    footnotes,
    numbering: {
      config: [
        {
          reference: 'default-numbering',
          levels: [
            {
              level: 0,
              format: LevelFormat.DECIMAL,
              text: '%1.',
              alignment: AlignmentType.START,
            },
          ],
        },
      ],
    },
    styles: {
      default: {
        document: {
          run: {
            size: 24, // 12pt
            font: 'Calibri',
          },
          paragraph: {
            spacing: { after: 200, line: 276 }, // 1.15 line spacing
          },
        },
      },
    },
  });

  return await Packer.toBuffer(document);
}

// ─── Bibliography ────────────────────────────────────────────

interface BibInfo {
  entries: BibEntry[];
  foundInAst: boolean;
}

function findBibliographyInfo(
  doc: TipTapDoc,
  typstContent?: string,
  baseDir: string = '.',
): BibInfo {
  let bibPath = '';
  let foundInAst = false;

  // Look for bibliography node or raw block containing #bibliography in AST
  for (const node of doc.content ?? []) {
    if (node.type === 'bibliography') {
      foundInAst = true;
      const content = (node.attrs?.content as string) ?? '';
      const match = content.match(/#bibliography\("([^"]+)"/);
      if (match) {
        bibPath = match[1];
      }
    } else if (node.type === 'typstRawBlock') {
      const content = (node.attrs?.content as string) ?? '';
      if (content.includes('#bibliography(')) {
        foundInAst = true;
        const match = content.match(/#bibliography\("([^"]+)"/);
        if (match) {
          bibPath = match[1];
        }
      }
    }
  }

  // Also check raw blocks and typst content for bibliography reference
  if (!bibPath && typstContent) {
    const match = typstContent.match(/#bibliography\("([^"]+)"/);
    if (match) {
      bibPath = match[1];
    }
  }

  if (!bibPath) {
    return { entries: [], foundInAst };
  }

  return { entries: loadBibEntries(bibPath, baseDir), foundInAst };
}

function loadBibEntries(bibPath: string, baseDir: string): BibEntry[] {
  try {
    const resolved = path.resolve(baseDir, bibPath);
    if (fs.existsSync(resolved)) {
      return parseBibFile(fs.readFileSync(resolved, 'utf-8'));
    }
  } catch {}
  return [];
}

function renderBibliography(entries: BibEntry[]): Paragraph[] {
  const paragraphs: Paragraph[] = [];

  // Header
  paragraphs.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun({ text: 'Literaturverzeichnis' })],
      spacing: { before: 400, after: 200 },
    }),
  );

  // Sort entries alphabetically by author
  const sorted = [...entries].sort((a, b) =>
    a.author.localeCompare(b.author),
  );

  for (const entry of sorted) {
    const parts: TextRun[] = [];

    // Author (bold)
    if (entry.author) {
      parts.push(new TextRun({ text: entry.author, bold: true }));
    }

    // Year
    if (entry.year) {
      parts.push(new TextRun({ text: ` (${entry.year})` }));
    }

    // Title (italic)
    if (entry.title) {
      parts.push(new TextRun({ text: `: ${entry.title}`, italics: true }));
    }

    // Publisher / journal
    const publisher = entry.fields['publisher'] || entry.fields['journal'] || '';
    if (publisher) {
      parts.push(new TextRun({ text: `. ${publisher}` }));
    }

    parts.push(new TextRun({ text: '.' }));

    paragraphs.push(
      new Paragraph({
        children: parts,
        indent: { left: 720, hanging: 720 }, // Hanging indent
        spacing: { after: 120 },
      }),
    );
  }

  return paragraphs;
}

// ─── Node Conversion ─────────────────────────────────────────

interface ConvertResult {
  elements: (Paragraph | Table)[];
  nextFootnoteId: number;
}

function convertNode(
  node: TipTapNode,
  baseDir: string,
  footnotes: Record<number, { children: Paragraph[] }>,
  footnoteId: number,
  hasNumbering: boolean,
  headingCounters: number[],
): ConvertResult {
  const elements: (Paragraph | Table)[] = [];

  switch (node.type) {
    case 'heading': {
      const level = (node.attrs?.level as number) ?? 1;
      const headingLevel = headingLevelMap[level] ?? HeadingLevel.HEADING_1;
      const runs = convertInlineContent(
        node.content ?? [],
        baseDir,
        footnotes,
        footnoteId,
      );
      footnoteId = runs.nextFootnoteId;
      const alignment = mapAlignment(node.attrs?.textAlign as string);

      // Build heading with numbering prefix
      const headingChildren: (TextRun | ExternalHyperlink | ImageRun | FootnoteReferenceRun)[] = [];
      if (hasNumbering) {
        const numberPrefix = incrementHeadingCounter(headingCounters, level);
        headingChildren.push(
          new TextRun({ text: numberPrefix + ' ' }),
        );
      }
      headingChildren.push(...runs.children);

      elements.push(
        new Paragraph({
          heading: headingLevel,
          children: headingChildren,
          ...(alignment ? { alignment } : {}),
        }),
      );
      break;
    }

    case 'paragraph': {
      const runs = convertInlineContent(
        node.content ?? [],
        baseDir,
        footnotes,
        footnoteId,
      );
      footnoteId = runs.nextFootnoteId;
      const alignment = mapAlignment(node.attrs?.textAlign as string);
      elements.push(
        new Paragraph({
          children: runs.children,
          ...(alignment ? { alignment } : {}),
        }),
      );
      break;
    }

    case 'bulletList': {
      for (const item of node.content ?? []) {
        const runs = convertInlineContent(
          getListItemContent(item),
          baseDir,
          footnotes,
          footnoteId,
        );
        footnoteId = runs.nextFootnoteId;
        elements.push(
          new Paragraph({
            bullet: { level: 0 },
            children: runs.children,
          }),
        );
      }
      break;
    }

    case 'orderedList': {
      for (const item of node.content ?? []) {
        const runs = convertInlineContent(
          getListItemContent(item),
          baseDir,
          footnotes,
          footnoteId,
        );
        footnoteId = runs.nextFootnoteId;
        elements.push(
          new Paragraph({
            numbering: { reference: 'default-numbering', level: 0 },
            children: runs.children,
          }),
        );
      }
      break;
    }

    case 'blockquote': {
      const runs = convertInlineContent(
        getBlockContent(node),
        baseDir,
        footnotes,
        footnoteId,
      );
      footnoteId = runs.nextFootnoteId;
      elements.push(
        new Paragraph({
          children: runs.children,
          indent: { left: 720 }, // 0.5 inch
          spacing: { before: 120, after: 120 },
          border: {
            left: { style: BorderStyle.SINGLE, size: 6, color: '999999' },
          },
        }),
      );
      break;
    }

    case 'codeBlock': {
      const text = getPlainText(node.content ?? []);
      elements.push(
        new Paragraph({
          children: [
            new TextRun({
              text,
              font: 'Courier New',
              size: 20, // 10pt
            }),
          ],
          shading: { type: ShadingType.SOLID, color: 'F0F0F0' },
          spacing: { before: 120, after: 120 },
        }),
      );
      break;
    }

    case 'horizontalRule': {
      elements.push(
        new Paragraph({
          border: {
            bottom: {
              style: BorderStyle.SINGLE,
              size: 6,
              color: '999999',
            },
          },
          spacing: { before: 120, after: 120 },
        }),
      );
      break;
    }

    case 'image': {
      const imgParagraph = convertImage(node, baseDir);
      if (imgParagraph) {
        elements.push(imgParagraph);
      }
      break;
    }

    case 'table': {
      const table = convertTable(node, baseDir, footnotes, footnoteId);
      elements.push(table.table);
      footnoteId = table.nextFootnoteId;
      break;
    }

    case 'pagebreak': {
      elements.push(
        new Paragraph({
          children: [new PageBreak()],
        }),
      );
      break;
    }

    case 'typstRawBlock': {
      const rawContent = (node.attrs?.content as string) ?? '';
      const blockType = (node.attrs?.blockType as string) ?? '';

      // Skip configuration blocks — they are Typst styling with no DOCX equivalent
      if (isConfigBlock(rawContent, blockType)) {
        break;
      }

      // Render remaining raw blocks (math, code) as grey monospace text
      const rawLines = rawContent.split('\n');
      for (const line of rawLines) {
        elements.push(
          new Paragraph({
            children: [
              new TextRun({
                text: line,
                font: 'Courier New',
                size: 18, // 9pt
                color: '666666',
              }),
            ],
            shading: { type: ShadingType.SOLID, color: 'F5F5F5' },
          }),
        );
      }
      break;
    }

    case 'bibliography': {
      // Handled in the main loop — skip here
      break;
    }

    default: {
      // Fallback: try to extract text
      if (node.content) {
        const runs = convertInlineContent(
          node.content,
          baseDir,
          footnotes,
          footnoteId,
        );
        footnoteId = runs.nextFootnoteId;
        elements.push(new Paragraph({ children: runs.children }));
      }
      break;
    }
  }

  return { elements, nextFootnoteId: footnoteId };
}

// ─── Heading Numbering ───────────────────────────────────────

/**
 * Increment heading counter and return numbering string (e.g. "1.2.3").
 * Resets sub-counters when a higher-level heading appears.
 */
function incrementHeadingCounter(
  counters: number[],
  level: number,
): string {
  const idx = level - 1;
  counters[idx]++;

  // Reset all sub-level counters
  for (let i = idx + 1; i < counters.length; i++) {
    counters[i] = 0;
  }

  // Build numbering string up to current level
  return counters
    .slice(0, level)
    .join('.');
}

// ─── Outline Detection ───────────────────────────────────────

function isOutlineBlock(node: TipTapNode): boolean {
  if (node.type !== 'typstRawBlock') return false;
  const content = ((node.attrs?.content as string) ?? '').trim();
  return /^#outline\b/.test(content);
}

function isBibliographyBlock(node: TipTapNode): boolean {
  if (node.type === 'bibliography') return true;
  if (node.type !== 'typstRawBlock') return false;
  const content = ((node.attrs?.content as string) ?? '').trim();
  return /^#bibliography\b/.test(content) || content.includes('#bibliography(');
}

// ─── Inline Content ──────────────────────────────────────────

interface InlineResult {
  children: (TextRun | ExternalHyperlink | ImageRun | FootnoteReferenceRun)[];
  nextFootnoteId: number;
}

function convertInlineContent(
  nodes: TipTapNode[],
  baseDir: string,
  footnotes: Record<number, { children: Paragraph[] }>,
  footnoteId: number,
): InlineResult {
  const children: (TextRun | ExternalHyperlink | ImageRun | FootnoteReferenceRun)[] = [];

  for (const node of nodes) {
    if (node.type === 'text') {
      const text = node.text ?? '';
      const marks = node.marks ?? [];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const runOptions: any = { text } as IRunOptions;

      // Apply marks
      let isLink = false;
      for (const mark of marks) {
        switch (mark.type) {
          case 'bold':
            runOptions.bold = true;
            break;
          case 'italic':
            runOptions.italics = true;
            break;
          case 'underline':
            runOptions.underline = {};
            break;
          case 'strike':
            runOptions.strike = true;
            break;
          case 'code':
            runOptions.font = 'Courier New';
            runOptions.size = 20;
            break;
          case 'superscript':
            runOptions.superScript = true;
            break;
          case 'subscript':
            runOptions.subScript = true;
            break;
          case 'smallcaps':
            runOptions.smallCaps = true;
            break;
          case 'textColor':
            runOptions.color = colorToHex(mark.attrs?.color as string);
            break;
          case 'highlight':
            runOptions.shading = {
              type: ShadingType.SOLID,
              color: colorToHex(mark.attrs?.color as string) || 'FFFF00',
            };
            break;
          case 'link': {
            const href = (mark.attrs?.href as string) ?? '';
            children.push(
              new ExternalHyperlink({
                link: href,
                children: [
                  new TextRun({
                    text,
                    style: 'Hyperlink',
                  }),
                ],
              }),
            );
            isLink = true;
            break;
          }
        }
      }

      if (!isLink) {
        children.push(new TextRun(runOptions));
      }
    } else if (node.type === 'footnote') {
      const noteContent = (node.attrs?.content as string) ?? '';
      const currentId = footnoteId++;
      footnotes[currentId] = {
        children: [
          new Paragraph({
            children: [new TextRun({ text: noteContent, size: 20 })],
          }),
        ],
      };
      children.push(new FootnoteReferenceRun(currentId));
    } else if (node.type === 'citation') {
      const citekey = (node.attrs?.citekey as string) ?? '';
      children.push(
        new TextRun({
          text: `[${citekey}]`,
          italics: true,
          color: '666666',
        }),
      );
    } else if (node.type === 'hardBreak') {
      children.push(new TextRun({ text: '', break: 1 }));
    }
  }

  return { children, nextFootnoteId: footnoteId };
}

// ─── Images ──────────────────────────────────────────────────

function convertImage(node: TipTapNode, baseDir: string): Paragraph | null {
  const src = (node.attrs?.src as string) ?? '';
  const widthAttr = node.attrs?.width as string | null;
  const align = node.attrs?.align as string | null;

  // Resolve image path
  const imgPath = path.resolve(baseDir, src);
  if (!fs.existsSync(imgPath)) {
    return new Paragraph({
      children: [
        new TextRun({
          text: `[Image: ${src}]`,
          italics: true,
          color: '999999',
        }),
      ],
    });
  }

  try {
    const imgBuffer = fs.readFileSync(imgPath);
    const ext = path.extname(imgPath).toLowerCase();

    let widthPx = 400;
    if (widthAttr) {
      const pct = widthAttr.match(/^(\d+)%$/);
      if (pct) {
        widthPx = Math.round((parseInt(pct[1]) / 100) * 600);
      }
      const cm = widthAttr.match(/^([\d.]+)cm$/);
      if (cm) {
        widthPx = Math.round(parseFloat(cm[1]) * 37.8);
      }
      const pt = widthAttr.match(/^([\d.]+)pt$/);
      if (pt) {
        widthPx = Math.round(parseFloat(pt[1]) * 1.33);
      }
    }

    const heightPx = Math.round(widthPx * 0.75);
    const alignment = mapAlignment(align ?? 'left');

    return new Paragraph({
      children: [
        new ImageRun({
          data: imgBuffer,
          transformation: { width: widthPx, height: heightPx },
          type: extToImageType(ext),
        }),
      ],
      ...(alignment ? { alignment } : {}),
    });
  } catch {
    return new Paragraph({
      children: [
        new TextRun({
          text: `[Image: ${src} — could not read]`,
          italics: true,
          color: '999999',
        }),
      ],
    });
  }
}

function extToImageType(ext: string): 'jpg' | 'png' | 'gif' | 'bmp' {
  switch (ext) {
    case '.jpg':
    case '.jpeg':
      return 'jpg';
    case '.gif':
      return 'gif';
    case '.bmp':
      return 'bmp';
    default:
      return 'png';
  }
}

// ─── Tables ──────────────────────────────────────────────────

function convertTable(
  node: TipTapNode,
  baseDir: string,
  footnotes: Record<number, { children: Paragraph[] }>,
  footnoteId: number,
): { table: Table; nextFootnoteId: number } {
  const rows = node.content ?? [];
  const tableRows: TableRow[] = [];

  for (const row of rows) {
    const cells: TableCell[] = [];
    for (const cell of row.content ?? []) {
      const isHeader = cell.type === 'tableHeader';
      const cellContent = getBlockContent(cell);
      const runs = convertInlineContent(
        cellContent,
        baseDir,
        footnotes,
        footnoteId,
      );
      footnoteId = runs.nextFootnoteId;

      cells.push(
        new TableCell({
          children: [
            new Paragraph({
              children: runs.children.map((child) => {
                if (isHeader && child instanceof TextRun) {
                  return new TextRun({
                    text: (child as unknown as { options?: { text?: string } }).options?.text ?? '',
                    bold: true,
                  });
                }
                return child;
              }),
            }),
          ],
          shading: isHeader
            ? { type: ShadingType.SOLID, color: 'E8E8E8' }
            : undefined,
        }),
      );
    }

    tableRows.push(new TableRow({ children: cells }));
  }

  return {
    table: new Table({
      rows: tableRows,
      width: { size: 100, type: WidthType.PERCENTAGE },
    }),
    nextFootnoteId: footnoteId,
  };
}

// ─── Helpers ─────────────────────────────────────────────────

const headingLevelMap: Record<number, (typeof HeadingLevel)[keyof typeof HeadingLevel]> = {
  1: HeadingLevel.HEADING_1,
  2: HeadingLevel.HEADING_2,
  3: HeadingLevel.HEADING_3,
  4: HeadingLevel.HEADING_4,
  5: HeadingLevel.HEADING_5,
  6: HeadingLevel.HEADING_6,
};

function mapAlignment(align: string | undefined | null): (typeof AlignmentType)[keyof typeof AlignmentType] | undefined {
  switch (align) {
    case 'center':
      return AlignmentType.CENTER;
    case 'right':
      return AlignmentType.RIGHT;
    case 'justify':
      return AlignmentType.JUSTIFIED;
    default:
      return undefined;
  }
}

function getListItemContent(item: TipTapNode): TipTapNode[] {
  if (!item.content) return [];
  const inlineNodes: TipTapNode[] = [];
  for (const child of item.content) {
    if (child.content) {
      inlineNodes.push(...child.content);
    }
  }
  return inlineNodes;
}

function getBlockContent(node: TipTapNode): TipTapNode[] {
  if (!node.content) return [];
  const inlineNodes: TipTapNode[] = [];
  for (const child of node.content) {
    if (child.content) {
      inlineNodes.push(...child.content);
    }
  }
  return inlineNodes;
}

function getPlainText(nodes: TipTapNode[]): string {
  return nodes.map((n) => n.text ?? '').join('');
}

/**
 * Check if a raw block is a configuration/preamble block that should be
 * skipped in DOCX export (no DOCX equivalent).
 */
function isConfigBlock(content: string, blockType: string): boolean {
  if (blockType === 'config') return true;

  const trimmed = content.trim();

  if (/^#(set|show|import)\s/.test(trimmed)) return true;
  if (trimmed.startsWith('#show ')) return true;
  if (/^\/\/\s*─/.test(trimmed)) return true;
  if (trimmed.split('\n').every((line) => line.trim().startsWith('//') || line.trim() === '')) return true;
  if (/^#outline\b/.test(trimmed)) return true;
  if (trimmed === '#pagebreak()') return true;

  return false;
}

function colorToHex(color: string | undefined): string {
  if (!color) return '000000';

  const typstMatch = color.match(/^rgb\("([^"]+)"\)$/);
  if (typstMatch) {
    color = typstMatch[1];
  }

  if (color.startsWith('#')) {
    const hex = color.slice(1);
    if (hex.length === 3) {
      return hex
        .split('')
        .map((c) => c + c)
        .join('');
    }
    return hex.slice(0, 6);
  }

  const namedColors: Record<string, string> = {
    black: '000000',
    white: 'FFFFFF',
    red: 'FF0000',
    green: '00FF00',
    blue: '0000FF',
    yellow: 'FFFF00',
    gray: '808080',
    grey: '808080',
    orange: 'FFA500',
    purple: '800080',
    pink: 'FFC0CB',
  };

  if (namedColors[color.toLowerCase()]) {
    return namedColors[color.toLowerCase()];
  }

  return '000000';
}
