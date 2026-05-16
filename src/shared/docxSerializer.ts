/**
 * TipTap JSON → DOCX Serializer
 *
 * Converts a TipTap document (same AST the deserializer produces) into a
 * .docx file buffer using the `docx` npm package.
 *
 * Design: the output is driven by named Word paragraph styles — Heading 1-6,
 * Quote, Code Block, Bibliography Entry, Table Header — not inline formatting.
 * Consequences:
 *  - The document looks coherent when opened in Word/Pages/LibreOffice.
 *  - Users can re-style the whole document via Word's style panel without
 *    touching individual paragraphs.
 *  - TOC fields and outline navigation work because headings carry the
 *    proper `Heading1` styleId and outline levels.
 *
 * Page size, margins, body font, font size, line spacing and language are
 * derived from the Typst #set blocks in the source document, so an A4 thesis
 * with Libertinus 11pt exports as A4 with the requested font at 11pt
 * (falling back to Cambria if the font is not installed on the reader's
 * machine).
 */

import {
  AlignmentType,
  BorderStyle,
  Document,
  ExternalHyperlink,
  FootnoteReferenceRun,
  HeadingLevel,
  ImageRun,
  LevelFormat,
  PageBreak,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableOfContents,
  TableRow,
  TextRun,
  WidthType,
  type IRunOptions,
} from 'docx';
import * as fs from 'fs';
import * as path from 'path';
import { parseBibFile, type BibEntry } from './bibParser';
import { parseSettings, type DocumentSettings } from './settingsParser';
import { type ProjectStyle } from './styleTypes';

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

// ─── Derived document configuration ──────────────────────────

type NumberingLevelFormat =
  | typeof LevelFormat.DECIMAL
  | typeof LevelFormat.UPPER_LETTER
  | typeof LevelFormat.LOWER_LETTER
  | typeof LevelFormat.UPPER_ROMAN
  | typeof LevelFormat.LOWER_ROMAN;

interface Resolved {
  bodyFont: string;           // e.g. 'Cambria'
  bodySize: number;           // half-points, e.g. 22 = 11pt
  lineSpacing: number;        // 240ths, e.g. 360 = 1.5 line height
  justified: boolean;
  lang: string;               // ISO code, e.g. 'de-DE'
  pageWidthTwips: number;
  pageHeightTwips: number;
  margin: { top: number; right: number; bottom: number; left: number };
  hasHeadingNumbering: boolean;
  /** Per-level format for headings 1-6, parsed from Typst numbering pattern. */
  headingFormats: NumberingLevelFormat[];
}

// ─── Public API ──────────────────────────────────────────────

/**
 * Convert a TipTap document AST to a DOCX buffer.
 */
export async function serializeDocx(
  doc: TipTapDoc,
  baseDir: string = '.',
  typstContent?: string,
  style: ProjectStyle | null = null,
): Promise<Buffer> {
  const settings = typstContent ? parseSettings(typstContent) : null;
  const resolved = resolveConfig(settings, style);

  const children: (Paragraph | Table | TableOfContents)[] = [];
  const footnotes: Record<number, { children: Paragraph[] }> = {};
  let footnoteCounter = 1;

  const bibInfo = findBibliographyInfo(doc, typstContent, baseDir);
  let bibRendered = false;

  for (const node of doc.content ?? []) {
    // Replace #outline raw blocks with a localized TOC field.
    if (isOutlineBlock(node)) {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          children: [new TextRun({ text: label('toc', resolved.lang) })],
        }),
        new TableOfContents(label('toc', resolved.lang), {
          hyperlink: true,
          headingStyleRange: '1-3',
        }),
      );
      continue;
    }

    // Replace bibliography blocks with formatted entries.
    if (isBibliographyBlock(node) && bibInfo.entries.length > 0) {
      children.push(...renderBibliography(bibInfo.entries, resolved.lang));
      bibRendered = true;
      continue;
    }

    const result = convertNode(
      node,
      baseDir,
      footnotes,
      footnoteCounter,
      resolved.hasHeadingNumbering,
      bibInfo.entries,
    );
    children.push(...result.elements);
    footnoteCounter = result.nextFootnoteId;
  }

  if (bibInfo.entries.length > 0 && !bibRendered) {
    children.push(...renderBibliography(bibInfo.entries, resolved.lang));
  }

  const document = new Document({
    features: { updateFields: true },
    styles: buildStyles(resolved),
    numbering: buildNumbering(resolved),
    sections: [{ properties: buildPageProperties(resolved), children }],
    footnotes,
  });

  return Packer.toBuffer(document);
}

// ─── Resolve Typst settings → Word-ready configuration ───────

function resolveConfig(settings: DocumentSettings | null, style: ProjectStyle | null): Resolved {
  // After the Design-Editor consolidation, the typography + layout values
  // that used to live in `DocumentSettings` are part of `ProjectStyle` —
  // `style.json`, written by the Design panel. The DOCX serializer reads
  // both: `style` for design tokens, `settings` for document-content fields
  // (just `lang` at the moment). When a project has no style.json yet, the
  // serializer falls back to plain defaults.
  const bodyFont    = normalizeFont(style?.fonts.body);
  const bodySize    = parseFontSizeHalfPt(style?.scale.base, 22);          // 11pt default
  const lineSpacing = parseLeadingToLine240ths(style?.scale.leading, 360); // 1.5 default
  const { width, height } = parsePaperSize(style?.layout.paper);
  const margin = parseMargin(style?.layout.margin);
  const lang = normalizeLang(settings?.lang);
  const headingNumbering = style?.headings.numbering ?? '';

  return {
    bodyFont,
    bodySize,
    lineSpacing,
    justified: true, // academic convention — can be overridden per-paragraph
    lang,
    pageWidthTwips: width,
    pageHeightTwips: height,
    margin,
    hasHeadingNumbering: !!headingNumbering,
    headingFormats: parseTypstNumberingPattern(headingNumbering),
  };
}

/**
 * Extracts the format specifier for each heading level from a Typst
 * numbering pattern. Each of `1`, `A`, `a`, `I`, `i` in the pattern
 * represents one level. Non-specifier characters (separators like `.`)
 * are ignored — Word's multilevel numbering always uses a dot separator
 * in the current implementation. If fewer specifiers than levels are
 * supplied, the last one is reused for remaining levels — matches
 * Typst's own fallback behaviour.
 *
 * Examples:
 *   "1.1"   → [DECIMAL, DECIMAL, DECIMAL, DECIMAL, DECIMAL, DECIMAL]
 *   "A.1"   → [UPPER_LETTER, DECIMAL, DECIMAL, DECIMAL, DECIMAL, DECIMAL]
 *   "I.A.1" → [UPPER_ROMAN, UPPER_LETTER, DECIMAL, DECIMAL, DECIMAL, DECIMAL]
 */
function parseTypstNumberingPattern(pattern: string | undefined): NumberingLevelFormat[] {
  const specs: NumberingLevelFormat[] = [];
  for (const ch of (pattern ?? '')) {
    switch (ch) {
      case '1': specs.push(LevelFormat.DECIMAL); break;
      case 'A': specs.push(LevelFormat.UPPER_LETTER); break;
      case 'a': specs.push(LevelFormat.LOWER_LETTER); break;
      case 'I': specs.push(LevelFormat.UPPER_ROMAN); break;
      case 'i': specs.push(LevelFormat.LOWER_ROMAN); break;
    }
  }
  if (specs.length === 0) specs.push(LevelFormat.DECIMAL);
  while (specs.length < 6) specs.push(specs[specs.length - 1]);
  return specs.slice(0, 6);
}

function normalizeFont(font: string | undefined): string {
  // Keep user-supplied font as-is; Word will fall back gracefully if the
  // font is not installed on the reader's machine. If unset, use Cambria —
  // available by default on Windows and Mac and stylistically close to
  // Libertinus Serif (Typst's default academic font).
  const f = (font ?? '').trim();
  if (!f) return 'Cambria';
  return f;
}

function parseFontSizeHalfPt(s: string | undefined, defaultHalfPt: number): number {
  if (!s) return defaultHalfPt;
  const m = s.trim().match(/^([\d.]+)\s*pt$/i);
  if (!m) return defaultHalfPt;
  const pt = parseFloat(m[1]);
  if (!isFinite(pt) || pt <= 0) return defaultHalfPt;
  return Math.round(pt * 2);
}

function parseLeadingToLine240ths(leading: string | undefined, fallback: number): number {
  if (!leading) return fallback;
  // Typst leading is em-relative. 0.65em ≈ single spacing, 1em ≈ 1.5,
  // 1.5em ≈ double. Map coarsely so the output looks reasonable.
  const m = leading.trim().match(/^([\d.]+)\s*em$/i);
  if (!m) return fallback;
  const em = parseFloat(m[1]);
  if (!isFinite(em) || em <= 0) return fallback;
  if (em <= 0.7) return 276;  // 1.15
  if (em <= 1.0) return 360;  // 1.5
  return 480;                  // 2.0
}

function parsePaperSize(paper: string | undefined): { width: number; height: number } {
  // Width/height in twips (1 inch = 1440 twips, 1 mm = 56.6929 twips)
  const p = (paper ?? '').toLowerCase().trim();
  switch (p) {
    case 'us-letter':
    case 'letter':
      return { width: 12240, height: 15840 };
    case 'us-legal':
    case 'legal':
      return { width: 12240, height: 20160 };
    case 'a5':
      return { width: 8391, height: 11906 };
    case 'a3':
      return { width: 16838, height: 23811 };
    case 'a4':
    default:
      return { width: 11906, height: 16838 };
  }
}

function parseMargin(margin: string | undefined): Resolved['margin'] {
  const defaultTwips = mmToTwips(25);
  if (!margin) {
    return {
      top: defaultTwips,
      right: defaultTwips,
      bottom: defaultTwips,
      left: defaultTwips,
    };
  }

  const trimmed = margin.trim();

  // Dictionary form — e.g. `(top: 2cm, bottom: 3cm, x: 2.5cm)`
  if (trimmed.startsWith('(')) {
    const inside = trimmed.slice(1, -1);
    const parts: Record<string, number> = {};
    for (const kv of inside.split(',')) {
      const [k, v] = kv.split(':').map(s => s.trim());
      if (k && v) parts[k] = lengthToTwips(v, defaultTwips);
    }
    const top = parts.top ?? parts.y ?? defaultTwips;
    const bottom = parts.bottom ?? parts.y ?? defaultTwips;
    const left = parts.left ?? parts.x ?? defaultTwips;
    const right = parts.right ?? parts.x ?? defaultTwips;
    return { top, bottom, left, right };
  }

  // Scalar form — same margin on all sides.
  const t = lengthToTwips(trimmed, defaultTwips);
  return { top: t, bottom: t, left: t, right: t };
}

function lengthToTwips(v: string, fallback: number): number {
  const s = v.trim();
  const m = s.match(/^([\d.]+)\s*([a-z%]+)$/i);
  if (!m) return fallback;
  const n = parseFloat(m[1]);
  if (!isFinite(n)) return fallback;
  const unit = m[2].toLowerCase();
  switch (unit) {
    case 'cm': return Math.round(n * 566.929);
    case 'mm': return Math.round(n * 56.6929);
    case 'in': return Math.round(n * 1440);
    case 'pt': return Math.round(n * 20);
    default: return fallback;
  }
}

function mmToTwips(mm: number): number {
  return Math.round(mm * 56.6929);
}

function normalizeLang(lang: string | undefined): string {
  const map: Record<string, string> = {
    en: 'en-US', de: 'de-DE', fr: 'fr-FR', es: 'es-ES', it: 'it-IT',
    pt: 'pt-BR', nl: 'nl-NL', sv: 'sv-SE', da: 'da-DK', nb: 'nb-NO',
    fi: 'fi-FI', pl: 'pl-PL', ru: 'ru-RU',
  };
  const l = (lang ?? '').toLowerCase().trim();
  if (!l) return 'en-US';
  return map[l] ?? l;
}

function label(key: 'toc' | 'bibliography', lang: string): string {
  const table: Record<string, Record<string, string>> = {
    toc: {
      en: 'Table of Contents',
      de: 'Inhaltsverzeichnis',
      fr: 'Table des matières',
      es: 'Índice',
      it: 'Indice',
      pt: 'Sumário',
      nl: 'Inhoudsopgave',
    },
    bibliography: {
      en: 'Bibliography',
      de: 'Literaturverzeichnis',
      fr: 'Bibliographie',
      es: 'Bibliografía',
      it: 'Bibliografia',
      pt: 'Bibliografia',
      nl: 'Bibliografie',
    },
  };
  const short = lang.slice(0, 2).toLowerCase();
  return table[key][short] ?? table[key].en;
}

// ─── Styles ──────────────────────────────────────────────────

/**
 * Centralised paragraph and run styling. Headings, block quotes, code
 * blocks, bibliography entries and table headers all reference IDs defined
 * here, so Word/LibreOffice render a coherent document and the user can
 * restyle the entire document from the styles panel.
 */
function buildStyles(r: Resolved) {
  return {
    default: {
      document: {
        run: {
          size: r.bodySize,
          font: r.bodyFont,
          language: { value: r.lang },
        },
        paragraph: {
          spacing: { after: 120, line: r.lineSpacing },
          alignment: r.justified ? AlignmentType.JUSTIFIED : AlignmentType.LEFT,
        },
      },
      heading1: {
        run: { size: Math.round(r.bodySize * 1.8), bold: true, font: r.bodyFont },
        paragraph: {
          spacing: { before: 480, after: 240, line: 276 },
          outlineLevel: 0,
          keepNext: true,
          keepLines: true,
          alignment: AlignmentType.LEFT,
        },
      },
      heading2: {
        run: { size: Math.round(r.bodySize * 1.45), bold: true, font: r.bodyFont },
        paragraph: {
          spacing: { before: 360, after: 180, line: 276 },
          outlineLevel: 1,
          keepNext: true,
          keepLines: true,
          alignment: AlignmentType.LEFT,
        },
      },
      heading3: {
        run: { size: Math.round(r.bodySize * 1.2), bold: true, font: r.bodyFont },
        paragraph: {
          spacing: { before: 240, after: 120, line: 276 },
          outlineLevel: 2,
          keepNext: true,
          keepLines: true,
          alignment: AlignmentType.LEFT,
        },
      },
      heading4: {
        run: { size: r.bodySize, bold: true, italics: true, font: r.bodyFont },
        paragraph: {
          spacing: { before: 200, after: 100, line: 276 },
          outlineLevel: 3,
          keepNext: true,
          keepLines: true,
          alignment: AlignmentType.LEFT,
        },
      },
      heading5: {
        run: { size: r.bodySize, bold: true, font: r.bodyFont },
        paragraph: {
          spacing: { before: 160, after: 80, line: 276 },
          outlineLevel: 4,
          keepNext: true,
          keepLines: true,
          alignment: AlignmentType.LEFT,
        },
      },
      heading6: {
        run: { size: r.bodySize, italics: true, font: r.bodyFont },
        paragraph: {
          spacing: { before: 120, after: 80, line: 276 },
          outlineLevel: 5,
          keepNext: true,
          keepLines: true,
          alignment: AlignmentType.LEFT,
        },
      },
    },
    paragraphStyles: [
      {
        id: 'Quote',
        name: 'Quote',
        basedOn: 'Normal',
        next: 'Normal',
        quickFormat: true,
        run: { italics: true, color: '444444', font: r.bodyFont, size: r.bodySize },
        paragraph: {
          indent: { left: 720 },
          spacing: { before: 160, after: 160, line: r.lineSpacing },
          border: {
            left: { style: BorderStyle.SINGLE, size: 12, color: 'BBBBBB', space: 12 },
          },
          alignment: AlignmentType.LEFT,
        },
      },
      {
        id: 'CodeBlock',
        name: 'Code Block',
        basedOn: 'Normal',
        next: 'Normal',
        run: { font: 'Consolas', size: Math.max(18, r.bodySize - 2), color: '333333' },
        paragraph: {
          spacing: { before: 120, after: 120, line: 260 },
          shading: { type: ShadingType.SOLID, color: 'F3F3F3' },
          alignment: AlignmentType.LEFT,
          border: {
            left: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC', space: 8 },
          },
        },
      },
      {
        id: 'BibliographyEntry',
        name: 'Bibliography Entry',
        basedOn: 'Normal',
        next: 'BibliographyEntry',
        run: { size: r.bodySize, font: r.bodyFont },
        paragraph: {
          indent: { left: 720, hanging: 720 },
          spacing: { after: 120, line: 276 },
          alignment: AlignmentType.LEFT,
        },
      },
      {
        id: 'TableHeader',
        name: 'Table Header',
        basedOn: 'Normal',
        next: 'Normal',
        run: { bold: true, size: r.bodySize, font: r.bodyFont },
        paragraph: {
          spacing: { before: 40, after: 40, line: 260 },
          alignment: AlignmentType.LEFT,
        },
      },
      {
        id: 'TableCell',
        name: 'Table Cell',
        basedOn: 'Normal',
        next: 'Normal',
        run: { size: r.bodySize, font: r.bodyFont },
        paragraph: {
          spacing: { before: 40, after: 40, line: 260 },
          alignment: AlignmentType.LEFT,
        },
      },
      {
        id: 'Caption',
        name: 'Caption',
        basedOn: 'Normal',
        next: 'Normal',
        run: { italics: true, size: Math.max(18, r.bodySize - 2), color: '666666', font: r.bodyFont },
        paragraph: {
          spacing: { before: 80, after: 200, line: 240 },
          alignment: AlignmentType.CENTER,
        },
      },
    ],
  };
}

function buildPageProperties(r: Resolved) {
  return {
    page: {
      size: {
        width: r.pageWidthTwips,
        height: r.pageHeightTwips,
      },
      margin: {
        top: r.margin.top,
        right: r.margin.right,
        bottom: r.margin.bottom,
        left: r.margin.left,
      },
    },
  };
}

function buildNumbering(r: Resolved) {
  const config: Array<{
    reference: string;
    levels: Array<{
      level: number;
      format: NumberingLevelFormat;
      text: string;
      alignment: (typeof AlignmentType)[keyof typeof AlignmentType];
      style?: { paragraph?: { indent?: { left?: number; hanging?: number } } };
    }>;
  }> = [
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
  ];

  // Live Word multilevel numbering for Headings. Each level reuses the
  // higher-level counters to produce "1", "1.1", "1.1.1" etc. Word
  // re-numbers automatically when the user inserts, deletes or reorders
  // headings — which was the whole point of moving away from manual
  // text prefixes.
  if (r.hasHeadingNumbering) {
    config.push({
      reference: 'headings-numbering',
      levels: [0, 1, 2, 3, 4, 5].map((level) => ({
        level,
        format: r.headingFormats[level],
        text: headingLevelText(level),
        alignment: AlignmentType.START,
        // Hang the heading text with a modest indent so the number sits
        // slightly left of the text and doesn't collide with it.
        style: {
          paragraph: {
            indent: { left: 0, hanging: 360 },
          },
        },
      })),
    });
  }

  return { config };
}

/** Produces "%1", "%1.%2", "%1.%2.%3", ... for level index 0..5. */
function headingLevelText(level: number): string {
  const parts: string[] = [];
  for (let i = 1; i <= level + 1; i++) parts.push(`%${i}`);
  return parts.join('.');
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

  for (const node of doc.content ?? []) {
    if (node.type === 'bibliography') {
      foundInAst = true;
      const content = (node.attrs?.content as string) ?? '';
      const match = content.match(/#bibliography\("([^"]+)"/);
      if (match) bibPath = match[1];
    } else if (node.type === 'typstRawBlock') {
      const content = (node.attrs?.content as string) ?? '';
      if (content.includes('#bibliography(')) {
        foundInAst = true;
        const match = content.match(/#bibliography\("([^"]+)"/);
        if (match) bibPath = match[1];
      }
    }
  }

  if (!bibPath && typstContent) {
    const match = typstContent.match(/#bibliography\("([^"]+)"/);
    if (match) bibPath = match[1];
  }

  if (!bibPath) return { entries: [], foundInAst };
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

function renderBibliography(entries: BibEntry[], lang: string): Paragraph[] {
  const paragraphs: Paragraph[] = [];

  paragraphs.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun({ text: label('bibliography', lang) })],
    }),
  );

  const sorted = [...entries].sort((a, b) =>
    (a.author || '').localeCompare(b.author || ''),
  );

  for (const entry of sorted) {
    paragraphs.push(
      new Paragraph({
        style: 'BibliographyEntry',
        children: formatBibEntryRuns(entry),
      }),
    );
  }

  return paragraphs;
}

function formatBibEntryRuns(entry: BibEntry): TextRun[] {
  const parts: TextRun[] = [];

  if (entry.author) {
    parts.push(new TextRun({ text: entry.author }));
  }
  if (entry.year) {
    parts.push(new TextRun({ text: ` (${entry.year})` }));
  }
  if (entry.title) {
    parts.push(new TextRun({ text: `: ` }));
    parts.push(new TextRun({ text: entry.title, italics: true }));
  }
  const publisher = entry.fields['publisher'] || entry.fields['journal'] || '';
  if (publisher) {
    parts.push(new TextRun({ text: `. ${publisher}` }));
  }
  const vol = entry.fields['volume'];
  if (vol) parts.push(new TextRun({ text: ` ${vol}` }));
  const pages = entry.fields['pages'];
  if (pages) parts.push(new TextRun({ text: `, S. ${pages}` }));
  parts.push(new TextRun({ text: '.' }));

  return parts;
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
  bibEntries: BibEntry[],
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
        bibEntries,
      );
      footnoteId = runs.nextFootnoteId;
      const alignment = mapAlignment(node.attrs?.textAlign as string);

      elements.push(
        new Paragraph({
          heading: headingLevel,
          children: runs.children,
          // Attach Word's multilevel numbering to the paragraph instead of
          // pre-pending the number as literal text — this way Word
          // re-numbers automatically when a heading is inserted, moved
          // or deleted after export.
          ...(hasNumbering
            ? { numbering: { reference: 'headings-numbering', level: level - 1 } }
            : {}),
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
        bibEntries,
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
          bibEntries,
        );
        footnoteId = runs.nextFootnoteId;
        elements.push(new Paragraph({ bullet: { level: 0 }, children: runs.children }));
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
          bibEntries,
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
        bibEntries,
      );
      footnoteId = runs.nextFootnoteId;
      elements.push(new Paragraph({ style: 'Quote', children: runs.children }));
      break;
    }

    case 'codeBlock': {
      const text = getPlainText(node.content ?? []);
      for (const line of text.split('\n')) {
        elements.push(
          new Paragraph({
            style: 'CodeBlock',
            children: [new TextRun({ text: line })],
          }),
        );
      }
      break;
    }

    case 'horizontalRule': {
      elements.push(
        new Paragraph({
          border: {
            bottom: { style: BorderStyle.SINGLE, size: 6, color: '999999' },
          },
          spacing: { before: 120, after: 120 },
        }),
      );
      break;
    }

    case 'image': {
      const imgParagraph = convertImage(node, baseDir);
      if (imgParagraph) elements.push(imgParagraph);
      break;
    }

    case 'table': {
      const table = convertTable(node, baseDir, footnotes, footnoteId, bibEntries);
      elements.push(table.table);
      footnoteId = table.nextFootnoteId;
      break;
    }

    case 'pagebreak': {
      elements.push(new Paragraph({ children: [new PageBreak()] }));
      break;
    }

    case 'typstRawBlock': {
      const rawContent = (node.attrs?.content as string) ?? '';
      const blockType = (node.attrs?.blockType as string) ?? '';

      // Skip configuration blocks — no Word equivalent.
      if (isConfigBlock(rawContent, blockType)) break;

      for (const line of rawContent.split('\n')) {
        elements.push(
          new Paragraph({
            style: 'CodeBlock',
            children: [new TextRun({ text: line })],
          }),
        );
      }
      break;
    }

    case 'bibliography': {
      // Handled in the main loop — skip here.
      break;
    }

    default: {
      if (node.content) {
        const runs = convertInlineContent(
          node.content,
          baseDir,
          footnotes,
          footnoteId,
          bibEntries,
        );
        footnoteId = runs.nextFootnoteId;
        elements.push(new Paragraph({ children: runs.children }));
      }
      break;
    }
  }

  return { elements, nextFootnoteId: footnoteId };
}

// ─── Outline / Bibliography Detection ────────────────────────

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
  bibEntries: BibEntry[],
): InlineResult {
  const children: (TextRun | ExternalHyperlink | ImageRun | FootnoteReferenceRun)[] = [];

  for (const node of nodes) {
    if (node.type === 'text') {
      const text = node.text ?? '';
      const marks = node.marks ?? [];

      const runOptions: IRunOptions = { text };
      let isLink = false;

      for (const mark of marks) {
        switch (mark.type) {
          case 'bold':
            (runOptions as { bold?: boolean }).bold = true;
            break;
          case 'italic':
            (runOptions as { italics?: boolean }).italics = true;
            break;
          case 'underline':
            (runOptions as { underline?: object }).underline = {};
            break;
          case 'strike':
            (runOptions as { strike?: boolean }).strike = true;
            break;
          case 'code':
            (runOptions as { font?: string; size?: number }).font = 'Consolas';
            (runOptions as { size?: number }).size = 20;
            break;
          case 'superscript':
            (runOptions as { superScript?: boolean }).superScript = true;
            break;
          case 'subscript':
            (runOptions as { subScript?: boolean }).subScript = true;
            break;
          case 'smallcaps':
            (runOptions as { smallCaps?: boolean }).smallCaps = true;
            break;
          case 'textColor':
            (runOptions as { color?: string }).color = colorToHex(mark.attrs?.color as string);
            break;
          case 'highlight':
            (runOptions as { shading?: object }).shading = {
              type: ShadingType.SOLID,
              color: colorToHex(mark.attrs?.color as string) || 'FFFF00',
            };
            break;
          case 'link': {
            const href = (mark.attrs?.href as string) ?? '';
            children.push(
              new ExternalHyperlink({
                link: href,
                children: [new TextRun({ text, style: 'Hyperlink' })],
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
      children.push(...renderCitation(citekey, bibEntries));
    } else if (node.type === 'hardBreak') {
      children.push(new TextRun({ text: '', break: 1 }));
    }
  }

  return { children, nextFootnoteId: footnoteId };
}

/**
 * Render a citation as `(Author Year)` when the entry is known, otherwise
 * fall back to `[citekey]`. Produces readable inline cites instead of the
 * opaque `[smith2024]` placeholder users were seeing before.
 */
function renderCitation(citekey: string, entries: BibEntry[]): TextRun[] {
  const entry = entries.find(e => e.citekey === citekey);
  if (!entry) {
    return [new TextRun({ text: `[${citekey}]`, color: '666666' })];
  }
  const surname = (entry.author || '').split(',')[0].split('&')[0].trim() || citekey;
  const year = entry.year ? ` ${entry.year}` : '';
  return [new TextRun({ text: `(${surname}${year})` })];
}

// ─── Images ──────────────────────────────────────────────────

function convertImage(node: TipTapNode, baseDir: string): Paragraph | null {
  const src = (node.attrs?.src as string) ?? '';
  const widthAttr = node.attrs?.width as string | null;
  const align = node.attrs?.align as string | null;

  const imgPath = path.resolve(baseDir, src);
  if (!fs.existsSync(imgPath)) {
    return new Paragraph({
      children: [
        new TextRun({ text: `[Image: ${src}]`, italics: true, color: '999999' }),
      ],
    });
  }

  try {
    const imgBuffer = fs.readFileSync(imgPath);
    const ext = path.extname(imgPath).toLowerCase();
    const dimensions = readImageDimensions(imgBuffer, ext);

    // Target width in px. Default: 75% of a 600-px text column (~5.9in @ 96dpi).
    let widthPx = 450;
    if (widthAttr) {
      const pct = widthAttr.match(/^(\d+)%$/);
      if (pct) widthPx = Math.round((parseInt(pct[1]) / 100) * 600);
      const cm = widthAttr.match(/^([\d.]+)cm$/);
      if (cm) widthPx = Math.round(parseFloat(cm[1]) * 37.8);
      const pt = widthAttr.match(/^([\d.]+)pt$/);
      if (pt) widthPx = Math.round(parseFloat(pt[1]) * 1.33);
      const inch = widthAttr.match(/^([\d.]+)in$/);
      if (inch) widthPx = Math.round(parseFloat(inch[1]) * 96);
    }

    // Derive height from actual image aspect ratio — previously hardcoded
    // to 0.75× width, which squashed wide figures and stretched portraits.
    const aspect = dimensions
      ? dimensions.height / dimensions.width
      : 0.75;
    const heightPx = Math.round(widthPx * aspect);
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
        new TextRun({ text: `[Image: ${src} — could not read]`, italics: true, color: '999999' }),
      ],
    });
  }
}

/**
 * Read image width/height from the file header without bringing in a
 * dependency like `image-size`. Supports PNG and JPEG, which cover
 * virtually everything users drop into the editor.
 */
function readImageDimensions(buf: Buffer, ext: string): { width: number; height: number } | null {
  try {
    if (ext === '.png' && buf.length >= 24 && buf.readUInt32BE(0) === 0x89504e47) {
      return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
    }
    if (ext === '.jpg' || ext === '.jpeg') {
      let i = 2;
      while (i < buf.length) {
        if (buf[i] !== 0xff) return null;
        const marker = buf[i + 1];
        // SOF markers hold the dimensions.
        if ((marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) ||
            (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf)) {
          return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
        }
        i += 2 + buf.readUInt16BE(i + 2);
      }
    }
  } catch {}
  return null;
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
  bibEntries: BibEntry[],
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
        bibEntries,
      );
      footnoteId = runs.nextFootnoteId;

      // Use a named paragraph style for headers/cells so inline marks
      // (italic, color, links) are preserved — previously the bold was
      // added by rebuilding each TextRun from its `.text` property, which
      // silently stripped every other mark.
      cells.push(
        new TableCell({
          children: [
            new Paragraph({
              style: isHeader ? 'TableHeader' : 'TableCell',
              children: runs.children,
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
    if (child.content) inlineNodes.push(...child.content);
  }
  return inlineNodes;
}

function getBlockContent(node: TipTapNode): TipTapNode[] {
  if (!node.content) return [];
  const inlineNodes: TipTapNode[] = [];
  for (const child of node.content) {
    if (child.content) inlineNodes.push(...child.content);
  }
  return inlineNodes;
}

function getPlainText(nodes: TipTapNode[]): string {
  return nodes.map((n) => n.text ?? '').join('');
}

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
  if (typstMatch) color = typstMatch[1];
  if (color.startsWith('#')) {
    const hex = color.slice(1);
    if (hex.length === 3) return hex.split('').map((c) => c + c).join('');
    return hex.slice(0, 6);
  }
  const namedColors: Record<string, string> = {
    black: '000000', white: 'FFFFFF', red: 'FF0000', green: '00FF00',
    blue: '0000FF', yellow: 'FFFF00', gray: '808080', grey: '808080',
    orange: 'FFA500', purple: '800080', pink: 'FFC0CB',
  };
  if (namedColors[color.toLowerCase()]) return namedColors[color.toLowerCase()];
  return '000000';
}
