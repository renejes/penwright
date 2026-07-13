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
  Footer,
  FootnoteReferenceRun,
  HeadingLevel,
  ImageRun,
  LevelFormat,
  PageBreak,
  PageNumber,
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
import {
  type RefTarget,
  matchBracket,
  classifyRawBlock,
  splitDesignChunks,
  stripHeadingLabelContent,
  getPlainText,
  refWords,
  citationInner,
  cleanBibText,
  formatBibAuthors,
  mathSnippet,
  svgSnippet,
  buildExportModel,
} from './exportContext';

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
  /** Whether the style enables page numbering — drives the page-number footer. */
  pageNumbering: boolean;
  /** Photographer-credit caption parts (style.elements.figure). */
  creditSeparator: string;
  creditLabel: string;
}

/** A Typst snippet rendered to a raster image (math, SVG). */
export interface RenderedSnippet {
  png: Buffer;
  /** Native pixel dimensions of the PNG (as produced by the renderer's ppi). */
  widthPx: number;
  heightPx: number;
  /** ppi the renderer used — needed to map native px back to print size. */
  ppi: number;
}

export interface SerializeDocxOptions {
  /**
   * Renders a self-contained Typst snippet (e.g. `$ E = m c^2 $` or
   * `#image("/abs/path.svg", width: 8cm)`) to a PNG. Injected by the main
   * process / MCP server, both of which have the bundled `typst` binary;
   * `shared/` itself stays dependency-free. Returns null on failure → the
   * caller falls back to a readable text placeholder instead of leaking
   * raw Typst source into the document.
   */
  renderTypstSnippet?: (snippet: string) => Promise<RenderedSnippet | null>;
}

/**
 * Per-export context. Set once at the top of {@link serializeDocx} and read
 * by the conversion helpers. Module-scoped rather than threaded through every
 * signature because exports run sequentially in practice (one UI export or
 * one MCP export at a time); a re-entrant export would only risk benign
 * label/number mixups, never corruption.
 */
interface DocxCtx {
  baseDir: string;
  resolved: Resolved;
  bibEntries: BibEntry[];
  /** label → cross-reference target, built in the pre-pass. */
  labelMap: Map<string, RefTarget>;
  /** Typst-snippet → rendered raster, built in the pre-pass. */
  rendered: Map<string, RenderedSnippet>;
  /** Citation rendering style derived from the bibliography setting. */
  citationMode: 'author-year' | 'numeric';
  /** Ordered citekey list for numeric citation style. */
  numericOrder: string[];
  /** Monotonic counter handing each ordered list its own numbering instance. */
  orderedInstance: number;
  /** Render-pass running figure/table ordinals — number UNLABELLED figures
   *  too (readers expect "Figure N" regardless of cross-referencing). Walks
   *  in the same depth-first order as buildExportModel, so these stay in
   *  step with the labelMap numbers of labelled ones. */
  figureSeq: number;
  tableSeq: number;
}

let activeCtx: DocxCtx | null = null;

// ─── Public API ──────────────────────────────────────────────

/**
 * Convert a TipTap document AST to a DOCX buffer.
 */
export async function serializeDocx(
  doc: TipTapDoc,
  baseDir: string = '.',
  typstContent?: string,
  style: ProjectStyle | null = null,
  opts: SerializeDocxOptions = {},
): Promise<Buffer> {
  const settings = typstContent ? parseSettings(typstContent) : null;
  const resolved = resolveConfig(settings, style);

  const bibInfo = findBibliographyInfo(doc, typstContent, baseDir);

  // Pre-pass: assign cross-reference numbers, pre-render math / SVG to raster
  // images, and decide the citation style — all before the synchronous
  // conversion (which can then look everything up without awaiting).
  const ctx = await buildExportContext(doc, typstContent ?? '', baseDir, resolved, bibInfo.entries, opts);
  activeCtx = ctx;

  try {
    const children: (Paragraph | Table | TableOfContents)[] = [];
    const footnotes: Record<number, { children: Paragraph[] }> = {};
    let footnoteCounter = 1;
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
        children.push(...renderBibliography(bibInfo.entries, resolved.lang, ctx));
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
      children.push(...renderBibliography(bibInfo.entries, resolved.lang, ctx));
    }

    const document = new Document({
      features: { updateFields: true },
      styles: buildStyles(resolved),
      numbering: buildNumbering(resolved),
      sections: [{
        properties: buildPageProperties(resolved),
        ...(resolved.pageNumbering
          ? { footers: { default: buildPageNumberFooter(resolved) } }
          : {}),
        children,
      }],
      footnotes,
    });

    return Packer.toBuffer(document);
  } finally {
    activeCtx = null;
  }
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
    pageNumbering: !!(style?.layout.pageNumbering && style.layout.pageNumbering.trim()),
    creditSeparator: style?.elements.figure.creditSeparator ?? ' — ',
    creditLabel: style?.elements.figure.creditLabel ?? 'Photo: ',
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
      en: 'References',
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
    {
      // Multi-level ordered-list numbering. Each ordered list is attached with
      // a distinct `instance`, so separate lists restart at 1; nested lists
      // cycle decimal → lower-letter → lower-roman per depth.
      reference: 'ordered-list',
      levels: [0, 1, 2, 3, 4, 5].map((level) => ({
        level,
        format: [
          LevelFormat.DECIMAL, LevelFormat.LOWER_LETTER, LevelFormat.LOWER_ROMAN,
          LevelFormat.DECIMAL, LevelFormat.LOWER_LETTER, LevelFormat.LOWER_ROMAN,
        ][level],
        text: `%${level + 1}.`,
        alignment: AlignmentType.START,
        style: { paragraph: { indent: { left: 720 * (level + 1), hanging: 360 } } },
      })),
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

function renderBibliography(entries: BibEntry[], lang: string, ctx: DocxCtx): Paragraph[] {
  const paragraphs: Paragraph[] = [];

  paragraphs.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun({ text: label('bibliography', lang) })],
    }),
  );

  // Numeric style: number entries by first-citation order to match the
  // `[1]` in-text citations; uncited entries appended after.
  if (ctx.citationMode === 'numeric') {
    const ordered = [...ctx.numericOrder];
    for (const e of entries) if (!ordered.includes(e.citekey)) ordered.push(e.citekey);
    ordered.forEach((key, i) => {
      const entry = entries.find(e => e.citekey === key);
      if (!entry) return;
      paragraphs.push(new Paragraph({
        style: 'BibliographyEntry',
        children: [new TextRun({ text: `[${i + 1}] ` }), ...formatBibEntryRuns(entry)],
      }));
    });
    return paragraphs;
  }

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

/**
 * Author–year reference entry, loosely APA-shaped:
 * Authors (Year). Title. Venue, Volume(Issue), Pages. DOI/URL.
 */
function formatBibEntryRuns(entry: BibEntry): TextRun[] {
  const parts: TextRun[] = [];

  if (entry.author) {
    parts.push(new TextRun({ text: formatBibAuthors(entry.author) }));
  }
  if (entry.year) {
    parts.push(new TextRun({ text: ` (${entry.year}).` }));
  }
  if (entry.title) {
    parts.push(new TextRun({ text: ` ${cleanBibText(entry.title)}.` }));
  }
  const venue = entry.fields['journal'] || entry.fields['booktitle'] || entry.fields['publisher'] || '';
  if (venue) {
    parts.push(new TextRun({ text: ` ` }));
    parts.push(new TextRun({ text: cleanBibText(venue), italics: true }));
  }
  const vol = entry.fields['volume'];
  const num = entry.fields['number'];
  if (vol) parts.push(new TextRun({ text: `, ${cleanBibText(vol)}${num ? `(${cleanBibText(num)})` : ''}` }));
  const pages = entry.fields['pages'];
  if (pages) parts.push(new TextRun({ text: `, ${cleanBibText(pages)}` }));
  if (venue || vol || pages) parts.push(new TextRun({ text: '.' }));
  const doi = entry.fields['doi'];
  const url = entry.fields['url'];
  const link = doi ? `https://doi.org/${doi.replace(/^https?:\/\/doi\.org\//, '')}` : url;
  if (link) {
    parts.push(new TextRun({ text: ' ' }));
    parts.push(new TextRun({ text: link, color: '444444' }));
  }

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
        stripHeadingLabelContent(node.content ?? []),
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
      // A paragraph that is nothing but a stray `#func(...)` design call
      // (emitted as plain text when the deserializer splits a multi-line
      // design block) carries no manuscript content — drop it.
      const plain = getPlainText(node.content ?? []).trim();
      if (/^#[a-zA-Z][\w.-]*\([^]*\)$/.test(plain)) break;

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

    case 'bulletList':
    case 'orderedList': {
      const ordered = node.type === 'orderedList';
      // Each ordered list gets its own numbering instance so a second list
      // restarts at 1 instead of continuing the first list's counter.
      const instance = ordered && activeCtx ? activeCtx.orderedInstance++ : 0;
      const r = convertList(node, ordered, 0, instance, baseDir, footnotes, footnoteId, bibEntries);
      elements.push(...r.elements);
      footnoteId = r.nextFootnoteId;
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
      // Figures, display-math, #quote, callouts and prose-with-inline-calls
      // are recognised and rendered as proper Word content; pure layout/design
      // code is dropped rather than leaked as monospace. See renderRawBlock.
      const r = renderRawBlock(node, baseDir, footnotes, footnoteId);
      elements.push(...r.elements);
      footnoteId = r.nextFootnoteId;
      break;
    }

    case 'bibliography': {
      // Handled in the main loop — skip here.
      break;
    }

    // ─── Magazine AST nodes (Phase C keystone) ─────────────────────────────
    // These render as real Word content instead of being dropped/placeholdered.
    // For `#columns` this is the B1 fix: the column flow (incl. nested #frage
    // questions) is structured content that reaches Word, no longer a raw block.
    case 'articleHeader': {
      const a = node.attrs ?? {};
      if (a.kicker) {
        elements.push(new Paragraph({
          spacing: { after: 60 },
          children: [new TextRun({ text: String(a.kicker).toUpperCase(), bold: true, size: 18, color: '777777' })],
        }));
      }
      // The opener title is the outline-visible H1 (Word TOC + nav), matching
      // the PDF outline — unnumbered (articles aren't auto-numbered).
      elements.push(new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun({ text: String(a.title ?? '') })],
      }));
      if (a.standfirst) {
        elements.push(new Paragraph({
          spacing: { before: 60, after: 60 },
          children: [new TextRun({ text: String(a.standfirst), italics: true, color: '666666', size: Math.round((activeCtx?.resolved.bodySize ?? 22) * 1.15) })],
        }));
      }
      if (a.byline) {
        elements.push(new Paragraph({
          spacing: { after: 160 },
          children: [new TextRun({ text: String(a.byline), color: '777777', size: 18 })],
        }));
      }
      break;
    }

    case 'dropCap': {
      const runs = convertInlineContent(node.content ?? [], baseDir, footnotes, footnoteId, bibEntries);
      footnoteId = runs.nextFootnoteId;
      elements.push(new Paragraph({ children: runs.children }));
      break;
    }

    case 'question': {
      // The interview question — bold (matches the accent #frage styling).
      const boldContent = (node.content ?? []).map((n) =>
        n.type === 'text' ? { ...n, marks: [...(n.marks ?? []), { type: 'bold' }] } : n);
      const runs = convertInlineContent(boldContent, baseDir, footnotes, footnoteId, bibEntries);
      footnoteId = runs.nextFootnoteId;
      elements.push(new Paragraph({ spacing: { before: 120, after: 40 }, children: runs.children }));
      break;
    }

    case 'pullQuote': {
      const runs = convertInlineContent(node.content ?? [], baseDir, footnotes, footnoteId, bibEntries);
      footnoteId = runs.nextFootnoteId;
      elements.push(new Paragraph({ style: 'Quote', alignment: AlignmentType.CENTER, children: runs.children }));
      const who = node.attrs?.who as string | undefined;
      if (who) {
        elements.push(new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 120 },
          children: [new TextRun({ text: `— ${who}`, color: '777777', size: 18 })],
        }));
      }
      break;
    }

    case 'callout': {
      // Shaded, left-bordered box (mirrors renderCallout) over block children.
      const title = node.attrs?.title as string | undefined;
      const fill = 'F4F5F7';
      const accent = '6B7280';
      const boxPara = (children: TextRun[], spacing: Record<string, number>) =>
        new Paragraph({
          shading: { type: ShadingType.SOLID, color: fill },
          border: { left: { style: BorderStyle.SINGLE, size: 18, color: accent, space: 10 } },
          spacing: { line: 260, ...spacing },
          children,
        });
      if (title) elements.push(boxPara([new TextRun({ text: title, bold: true, color: accent })], { before: 120, after: 0 }));
      const kids = node.content ?? [];
      kids.forEach((child, i) => {
        const last = i === kids.length - 1;
        if (child.type === 'paragraph') {
          const runs = convertInlineContent(child.content ?? [], baseDir, footnotes, footnoteId, bibEntries);
          footnoteId = runs.nextFootnoteId;
          elements.push(boxPara(runs.children as TextRun[], { before: 0, after: last ? 120 : 0 }));
        } else {
          const r = convertNode(child, baseDir, footnotes, footnoteId, hasNumbering, bibEntries);
          elements.push(...r.elements);
          footnoteId = r.nextFootnoteId;
        }
      });
      break;
    }

    case 'figurePanel': {
      const a = node.attrs ?? {};
      const fn: FnState = { footnotes, id: footnoteId };
      if (a.path) elements.push(buildImageParagraph(resolveImagePath(baseDir, String(a.path)), null, 'center'));
      if (a.caption) {
        const capRuns = parseInlineTypst(String(a.caption), { italics: true, color: '666666', size: Math.max(18, (activeCtx?.resolved.bodySize ?? 22) - 2) }, fn);
        elements.push(new Paragraph({ style: 'Caption', alignment: AlignmentType.CENTER, children: capRuns.length ? capRuns : [new TextRun({ text: String(a.caption), italics: true })] }));
      }
      footnoteId = fn.id;
      if (a.title) elements.push(new Paragraph({ spacing: { before: 80 }, children: [new TextRun({ text: String(a.title).toUpperCase(), bold: true, color: '6B7280', size: 18 })] }));
      for (const child of node.content ?? []) {
        const r = convertNode(child, baseDir, footnotes, footnoteId, hasNumbering, bibEntries);
        elements.push(...r.elements);
        footnoteId = r.nextFootnoteId;
      }
      break;
    }

    case 'interlude': {
      elements.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 160, after: 160 },
        children: [new TextRun({ text: '* * *', color: '999999' })],
      }));
      break;
    }

    case 'columns': {
      // Linear flow (Word multicol via section breaks is fragile; the silent
      // drop is what mattered). The nested questions/prose now reach Word.
      for (const child of node.content ?? []) {
        const r = convertNode(child, baseDir, footnotes, footnoteId, hasNumbering, bibEntries);
        elements.push(...r.elements);
        footnoteId = r.nextFootnoteId;
      }
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

  for (let idx = 0; idx < nodes.length; idx++) {
    const node = nodes[idx];

    // Adjacent citations (separated only by whitespace) collapse into one
    // parenthetical group, like Typst renders `@a @b @c`.
    if (node.type === 'citation') {
      const keys = [(node.attrs?.citekey as string) ?? ''];
      let j = idx + 1;
      while (j < nodes.length) {
        const nx = nodes[j];
        if (nx.type === 'text' && (nx.text ?? '').trim() === '' && nodes[j + 1]?.type === 'citation') { j++; continue; }
        if (nx.type === 'citation') { keys.push((nx.attrs?.citekey as string) ?? ''); j++; continue; }
        break;
      }
      children.push(...renderCitationGroup(keys.filter(Boolean), bibEntries));
      idx = j - 1;
      continue;
    }

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
      // Parse the footnote body for inline markup + nested citations instead
      // of dumping it as one plain run.
      const fn: FnState = { footnotes, id: footnoteId };
      const bodyRuns = parseInlineTypst(noteContent, { size: 20 }, fn);
      footnoteId = fn.id;
      footnotes[currentId] = {
        children: [
          new Paragraph({
            children: bodyRuns.length ? bodyRuns : [new TextRun({ text: noteContent, size: 20 })],
          }),
        ],
      };
      children.push(new FootnoteReferenceRun(currentId));
    } else if (node.type === 'marginNote') {
      // A margin note has no Word analogue → render it as a footnote (a side
      // annotation), so its content survives instead of being dropped.
      const noteContent = (node.attrs?.body as string) ?? '';
      const currentId = footnoteId++;
      const fn: FnState = { footnotes, id: footnoteId };
      const bodyRuns = parseInlineTypst(noteContent, { size: 20 }, fn);
      footnoteId = fn.id;
      footnotes[currentId] = {
        children: [new Paragraph({ children: bodyRuns.length ? bodyRuns : [new TextRun({ text: noteContent, size: 20 })] })],
      };
      children.push(new FootnoteReferenceRun(currentId));
    } else if (node.type === 'reference') {
      // Cross-reference pill — was silently dropped before. Resolve to the
      // numbered target ("Figure 1") via the pre-pass label map.
      children.push(...renderReference((node.attrs?.label as string) ?? '', (node.attrs?.refType as string) ?? ''));
    } else if (node.type === 'hardBreak') {
      children.push(new TextRun({ text: '', break: 1 }));
    }
  }

  return { children, nextFootnoteId: footnoteId };
}

/**
 * Render a citation as `(Author et al., Year)` when the entry is known,
 * otherwise fall back to `[citekey]`. Produces readable inline cites instead
 * of the opaque `[smith2024]` placeholder users were seeing before.
 */
function renderCitation(citekey: string, entries: BibEntry[]): TextRun[] {
  if (activeCtx?.citationMode === 'numeric') {
    const idx = activeCtx.numericOrder.indexOf(citekey);
    return [new TextRun({ text: `[${idx >= 0 ? idx + 1 : '?'}]` })];
  }
  const inner = citationInner(citekey, entries);
  if (!inner) {
    return [new TextRun({ text: `[${citekey}]`, color: '666666' })];
  }
  return [new TextRun({ text: `(${inner})` })];
}

/**
 * Renders a group of adjacent citations as one parenthetical —
 * `(Bender et al., 2021; Chen et al., 2021)` — matching how Typst collapses
 * `@a @b` into a single cite group. Numeric mode → `[1, 2]`.
 */
function renderCitationGroup(citekeys: string[], entries: BibEntry[]): TextRun[] {
  if (citekeys.length === 1) return renderCitation(citekeys[0], entries);
  if (activeCtx?.citationMode === 'numeric') {
    const nums = citekeys.map(k => {
      const idx = activeCtx!.numericOrder.indexOf(k);
      return idx >= 0 ? String(idx + 1) : '?';
    });
    return [new TextRun({ text: `[${nums.join(', ')}]` })];
  }
  const parts = citekeys.map(k => citationInner(k, entries) ?? k);
  return [new TextRun({ text: `(${parts.join('; ')})` })];
}

// ─── Images ──────────────────────────────────────────────────

function convertImage(node: TipTapNode, baseDir: string): Paragraph | null {
  const src = (node.attrs?.src as string) ?? '';
  if (!src) return null;
  // Delegates to the shared builder, which handles raster files directly and
  // SVGs via the pre-rendered raster map.
  return buildImageParagraph(
    resolveImagePath(baseDir, src),
    (node.attrs?.width as string) ?? null,
    (node.attrs?.align as string) ?? null,
  );
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

function getBlockContent(node: TipTapNode): TipTapNode[] {
  if (!node.content) return [];
  const inlineNodes: TipTapNode[] = [];
  for (const child of node.content) {
    if (child.content) inlineNodes.push(...child.content);
  }
  return inlineNodes;
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


/** baseDir-relative POSIX path for use inside a Typst snippet. */
function toTypstRel(baseDir: string, absPath: string): string {
  return path.relative(baseDir, absPath).split(path.sep).join('/');
}

/**
 * Resolves an image src against the project root. `resolveIncludes` merges
 * chapters in place without rewriting their image paths, so a figure in
 * `chapters/03-…typ` still says `image("../assets/x.svg")`. Relative to the
 * root that `../` points outside the project — so when the direct resolution
 * misses, strip the leading `../` segments and resolve from the root instead.
 */
function resolveImagePath(baseDir: string, src: string): string {
  const direct = path.resolve(baseDir, src);
  if (fs.existsSync(direct)) return direct;
  const climbed = path.resolve(baseDir, src.replace(/^(\.\.[\\/])+/, ''));
  if (fs.existsSync(climbed)) return climbed;
  return direct;
}

// ─── Pre-pass: numbering, raster pre-render, citation style ───

async function buildExportContext(
  doc: TipTapDoc,
  typstContent: string,
  baseDir: string,
  resolved: Resolved,
  bibEntries: BibEntry[],
  opts: SerializeDocxOptions,
): Promise<DocxCtx> {
  const rendered = new Map<string, RenderedSnippet>();

  // Numbering / citation style / label map come from the SHARED depth-first
  // pre-pass (exportContext.buildExportModel) — the render pass below descends
  // into the magazine container nodes (columns/callout/figurePanel), so the
  // counting pass must recurse identically or nested figures/tables/math lose
  // their numbers and `@fig:…` targets. Never re-implement this walk here:
  // a local flat copy is exactly how DOCX and HTML drifted apart before.
  const model = buildExportModel(doc, typstContent);
  const { labelMap, citationMode, numericOrder } = model;

  // DOCX-specific raster plan: display-math (from the shared model) plus SVG
  // images, which Word can't embed natively. The SVG scan mirrors the render
  // pass's depth-first descent.
  const renderQueue: string[] = [];
  if (opts.renderTypstSnippet) {
    for (const mb of model.mathBlocks) renderQueue.push(mathSnippet(mb.tex));
    const scanSvgs = (node: TipTapNode) => {
      if (node.type === 'typstRawBlock') {
        const content = (node.attrs?.content as string) ?? '';
        const blockType = (node.attrs?.blockType as string) ?? '';
        const desc = classifyRawBlock(content, blockType);
        if (desc.kind === 'figure' && desc.variant === 'image' && desc.imagePath) {
          const abs = resolveImagePath(baseDir, desc.imagePath);
          if (abs.toLowerCase().endsWith('.svg')) renderQueue.push(svgSnippet(toTypstRel(baseDir, abs)));
        }
      } else if (node.type === 'image' || node.type === 'figurePanel') {
        // figurePanel carries its image in attrs.path (rendered via
        // buildImageParagraph, which reads the raster map for SVGs).
        const src = String(node.attrs?.src ?? node.attrs?.path ?? '');
        if (src.toLowerCase().endsWith('.svg')) {
          renderQueue.push(svgSnippet(toTypstRel(baseDir, resolveImagePath(baseDir, src))));
        }
      }
      for (const c of node.content ?? []) scanSvgs(c);
    };
    for (const node of doc.content ?? []) scanSvgs(node);

    const unique = [...new Set(renderQueue)];
    const results = await Promise.all(
      unique.map((s) => opts.renderTypstSnippet!(s).catch(() => null)),
    );
    unique.forEach((s, i) => { const r = results[i]; if (r) rendered.set(s, r); });
  }

  return {
    baseDir, resolved, bibEntries, labelMap, rendered,
    citationMode, numericOrder, orderedInstance: 1,
    figureSeq: 0, tableSeq: 0,
  };
}

// ─── Rendering rasterised snippets ───────────────────────────

function embedRaster(r: RenderedSnippet, maxWidthPx: number, align: (typeof AlignmentType)[keyof typeof AlignmentType]): Paragraph {
  let w = Math.max(1, Math.round(r.widthPx * 96 / r.ppi));
  let h = Math.max(1, Math.round(r.heightPx * 96 / r.ppi));
  if (w > maxWidthPx) { const s = maxWidthPx / w; w = maxWidthPx; h = Math.max(1, Math.round(h * s)); }
  return new Paragraph({
    alignment: align,
    spacing: { before: 80, after: 120 },
    children: [new ImageRun({ data: r.png, transformation: { width: w, height: h }, type: 'png' })],
  });
}

function widthAttrToPx(widthAttr: string | null | undefined): number | null {
  if (!widthAttr) return null;
  const pct = widthAttr.match(/^(\d+)%$/); if (pct) return Math.round((parseInt(pct[1]) / 100) * 600);
  const cm = widthAttr.match(/^([\d.]+)cm$/); if (cm) return Math.round(parseFloat(cm[1]) * 37.8);
  const mm = widthAttr.match(/^([\d.]+)mm$/); if (mm) return Math.round(parseFloat(mm[1]) * 3.78);
  const pt = widthAttr.match(/^([\d.]+)pt$/); if (pt) return Math.round(parseFloat(pt[1]) * 1.33);
  const inch = widthAttr.match(/^([\d.]+)in$/); if (inch) return Math.round(parseFloat(inch[1]) * 96);
  return null;
}

/** Builds an image paragraph from an absolute path — handles raster files
 *  directly and SVGs via the pre-rendered raster map. */
function buildImageParagraph(absPath: string, widthAttr: string | null, align: string | null): Paragraph {
  const alignment = mapAlignment(align ?? 'center') ?? AlignmentType.CENTER;
  if (absPath.toLowerCase().endsWith('.svg')) {
    const r = activeCtx?.rendered.get(svgSnippet(toTypstRel(activeCtx?.baseDir ?? path.dirname(absPath), absPath)));
    if (r) return embedRaster(r, widthAttrToPx(widthAttr) ?? 450, alignment);
    return new Paragraph({ alignment, children: [new TextRun({ text: `[SVG: ${path.basename(absPath)}]`, italics: true, color: '999999' })] });
  }
  if (!fs.existsSync(absPath)) {
    return new Paragraph({ alignment, children: [new TextRun({ text: `[Image: ${path.basename(absPath)}]`, italics: true, color: '999999' })] });
  }
  try {
    const buf = fs.readFileSync(absPath);
    const ext = path.extname(absPath).toLowerCase();
    const dim = readImageDimensions(buf, ext);
    const widthPx = widthAttrToPx(widthAttr) ?? 450;
    const aspect = dim ? dim.height / dim.width : 0.75;
    return new Paragraph({
      alignment,
      spacing: { before: 80, after: 80 },
      children: [new ImageRun({ data: buf, transformation: { width: widthPx, height: Math.round(widthPx * aspect) }, type: extToImageType(ext) })],
    });
  } catch {
    return new Paragraph({ alignment, children: [new TextRun({ text: `[Image: ${path.basename(absPath)} — unreadable]`, italics: true, color: '999999' })] });
  }
}

// ─── Raw-block dispatcher ────────────────────────────────────

function renderRawBlock(
  node: TipTapNode,
  baseDir: string,
  footnotes: Record<number, { children: Paragraph[] }>,
  footnoteId: number,
): { elements: (Paragraph | Table)[]; nextFootnoteId: number } {
  const content = (node.attrs?.content as string) ?? '';
  const blockType = (node.attrs?.blockType as string) ?? '';
  const desc = classifyRawBlock(content, blockType);
  const lang = activeCtx?.resolved.lang ?? 'en';
  const words = refWords(lang);
  const fn: FnState = { footnotes, id: footnoteId };

  switch (desc.kind) {
    case 'skip':
      return { elements: [], nextFootnoteId: footnoteId };

    case 'heading': {
      const hl = headingLevelMap[desc.level] ?? HeadingLevel.HEADING_1;
      return { elements: [new Paragraph({ heading: hl, children: [new TextRun({ text: desc.text })] })], nextFootnoteId: footnoteId };
    }

    case 'math': {
      const r = activeCtx?.rendered.get(mathSnippet(desc.tex));
      const numberText = desc.label ? activeCtx?.labelMap.get(desc.label)?.numberText : undefined;
      if (r) {
        let w = Math.max(1, Math.round(r.widthPx * 96 / r.ppi));
        let h = Math.max(1, Math.round(r.heightPx * 96 / r.ppi));
        if (w > 600) { const s = 600 / w; w = 600; h = Math.max(1, Math.round(h * s)); }
        const kids: (ImageRun | TextRun)[] = [new ImageRun({ data: r.png, transformation: { width: w, height: h }, type: 'png' })];
        if (numberText) kids.push(new TextRun({ text: `    ${numberText}` }));
        return { elements: [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 80, after: 120 }, children: kids })], nextFootnoteId: footnoteId };
      }
      const tex = desc.tex.replace(/^\$\s*|\s*\$$/g, '');
      return {
        elements: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: tex, italics: true }), ...(numberText ? [new TextRun({ text: `    ${numberText}` })] : [])],
        })],
        nextFootnoteId: footnoteId,
      };
    }

    case 'figure': {
      const els: (Paragraph | Table)[] = [];
      const target = desc.label ? activeCtx?.labelMap.get(desc.label) : undefined;
      const isTable = desc.variant === 'table';
      const numWord = isTable ? words.table : words.figure;
      // Unlabelled figures/tables get the running ordinal — the pre-pass only
      // stores numbers for LABELLED blocks, but a caption without a numeral
      // ("Figure: A river at dawn") reads as a defect.
      const seq = activeCtx ? (isTable ? ++activeCtx.tableSeq : ++activeCtx.figureSeq) : '';
      const num = target?.n ?? seq;
      const captionSrc = desc.caption
        ? desc.caption + (desc.credit ? `${activeCtx?.resolved.creditSeparator ?? ' — '}${activeCtx?.resolved.creditLabel ?? 'Photo: '}${desc.credit}` : '')
        : undefined;
      const captionRuns = captionSrc
        ? parseInlineTypst(captionSrc, { italics: true, size: Math.max(18, (activeCtx?.resolved.bodySize ?? 22) - 2), color: '666666' }, fn)
        : [];
      const captionPara = new Paragraph({
        style: 'Caption',
        children: [new TextRun({ text: `${numWord} ${num}`.trim() + (captionRuns.length ? ': ' : ''), bold: true, size: Math.max(18, (activeCtx?.resolved.bodySize ?? 22) - 2), color: '666666' }), ...captionRuns],
      });
      if (isTable) {
        els.push(parseTypstTable(desc.tableSrc, fn));
        els.push(captionPara);
      } else {
        if (desc.imagePath) els.push(buildImageParagraph(resolveImagePath(baseDir, desc.imagePath), desc.width ?? null, 'center'));
        els.push(captionPara);
      }
      return { elements: els, nextFootnoteId: fn.id };
    }

    case 'quote': {
      const runs = parseInlineTypst(desc.body, {}, fn);
      return { elements: [new Paragraph({ style: 'Quote', children: runs })], nextFootnoteId: fn.id };
    }

    case 'callout': {
      const els = renderCallout(desc.variant, desc.title, desc.body, fn);
      return { elements: els, nextFootnoteId: fn.id };
    }

    case 'prose': {
      // Standalone `#v(…)` spacer lines separate logical paragraphs (the
      // article-opener pattern: kicker / headline / standfirst / byline).
      const els = renderTextChunks(splitDesignChunks(desc.content), null, fn);
      return { elements: els, nextFootnoteId: fn.id };
    }

    case 'designText': {
      const els = renderTextChunks(desc.chunks, desc.alignment, fn);
      return { elements: els, nextFootnoteId: fn.id };
    }

    case 'grid': {
      // Stack the cells linearly (Word has no fragile 2-up; the words are what
      // matter — this rescues the interview head from being dropped).
      const els: (Paragraph | Table)[] = [];
      for (const cellItems of desc.parsed.cells) {
        for (const it of cellItems) {
          switch (it.kind) {
            case 'question': {
              const runs = parseInlineTypst((it.body ?? '').replace(/\s+/g, ' ').trim(), { bold: true }, fn);
              els.push(new Paragraph({ spacing: { before: 120, after: 40 }, children: runs.length ? runs : [] }));
              break;
            }
            case 'box':
              els.push(...renderCallout('note', it.title, (it.body ?? '').trim(), fn));
              break;
            case 'image':
              if (it.path) els.push(buildImageParagraph(resolveImagePath(baseDir, it.path), it.width ?? null, 'center'));
              break;
            case 'caption': {
              const runs = parseInlineTypst((it.body ?? '').replace(/\s+/g, ' ').trim(), { italics: true, color: '666666', size: Math.max(18, (activeCtx?.resolved.bodySize ?? 22) - 2) }, fn);
              if (runs.length) els.push(new Paragraph({ style: 'Caption', children: runs }));
              break;
            }
            default:
              els.push(...renderTextChunks(splitDesignChunks(it.body ?? ''), null, fn));
              break;
          }
        }
      }
      return { elements: els, nextFootnoteId: fn.id };
    }
  }
}

/**
 * Renders design/prose chunks as paragraphs. Chunks whose produced runs carry
 * no real words (pure layout tails — a lone `]`, `#line()` dividers, `* * *`
 * ornaments) are dropped instead of leaking as empty paragraphs.
 */
function renderTextChunks(chunks: string[], alignment: string | null, fn: FnState): Paragraph[] {
  const out: Paragraph[] = [];
  const align = alignment ? mapAlignment(alignment) : undefined;
  for (const chunk of chunks) {
    // Collapse source-indentation newlines — Word paragraphs reflow anyway.
    const src = chunk.replace(/\s+/g, ' ').trim();
    const collect: string[] = [];
    const runs = parseInlineTypst(src, {}, fn, collect);
    const visible = collect.join('').replace(/[^\p{L}\p{N}]+/gu, '');
    if (visible.length < 2) continue;
    out.push(new Paragraph({
      children: runs,
      ...(align ? { alignment: align } : {}),
    }));
  }
  return out;
}

/** Renders a gentle-clues callout as a shaded, left-bordered single-cell box. */
function renderCallout(variant: string, title: string | undefined, body: string, fn: FnState): Paragraph[] {
  const accent: Record<string, string> = {
    info: '2563EB', tip: '16A34A', success: '16A34A', warning: 'D97706',
    error: 'DC2626', note: '6B7280', memo: '7C3AED', important: 'DC2626',
    question: '0891B2', task: '4F46E5', conclusion: '059669', abstract: '6B7280', example: '6B7280',
  };
  const color = accent[variant] ?? '6B7280';
  const fill = 'F4F5F7';
  const out: Paragraph[] = [];
  const heading = title ?? variant.charAt(0).toUpperCase() + variant.slice(1);
  out.push(new Paragraph({
    shading: { type: ShadingType.SOLID, color: fill },
    border: { left: { style: BorderStyle.SINGLE, size: 18, color, space: 10 } },
    spacing: { before: 120, after: 0, line: 260 },
    children: [new TextRun({ text: heading, bold: true, color })],
  }));
  const bodyRuns = parseInlineTypst(body, {}, fn);
  out.push(new Paragraph({
    shading: { type: ShadingType.SOLID, color: fill },
    border: { left: { style: BorderStyle.SINGLE, size: 18, color, space: 10 } },
    spacing: { before: 0, after: 120, line: 260 },
    children: bodyRuns.length ? bodyRuns : [new TextRun({ text: body })],
  }));
  return out;
}

/** Parses a Typst `table(...)` body (the inner of the call) into a Word table. */
function parseTypstTable(tableSrc: string, fn: FnState): Table {
  // Column count from `columns: (...)` or `columns: N`.
  let cols = 1;
  const colMatch = tableSrc.match(/columns:\s*(\([^)]*\)|\d+)/);
  if (colMatch) {
    const v = colMatch[1];
    if (v.startsWith('(')) cols = v.slice(1, -1).split(',').filter((s) => s.trim()).length;
    else cols = parseInt(v) || 1;
  }
  // Collect top-level [ ... ] cell groups.
  const cells: string[] = [];
  for (let i = 0; i < tableSrc.length; i++) {
    if (tableSrc[i] === '[') {
      const m = matchBracket(tableSrc, i, '[', ']');
      if (m) { cells.push(m.inner.trim()); i = m.end - 1; }
    }
  }
  if (cols < 1) cols = 1;
  const rows: TableRow[] = [];
  for (let r = 0; r < cells.length; r += cols) {
    const rowCells = cells.slice(r, r + cols);
    const isHeader = r === 0;
    rows.push(new TableRow({
      children: rowCells.map((cell) => {
        // Strip a single *bold* wrapper used for header cells.
        const stripped = cell.replace(/^\*(.*)\*$/s, '$1');
        const runs = parseInlineTypst(stripped, {}, fn);
        return new TableCell({
          children: [new Paragraph({ style: isHeader ? 'TableHeader' : 'TableCell', children: runs.length ? runs : [new TextRun({ text: '' })] })],
          shading: isHeader ? { type: ShadingType.SOLID, color: 'E8E8E8' } : undefined,
        });
      }),
    }));
  }
  return new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } });
}

// ─── Inline Typst markup parser (→ docx runs) ────────────────

interface FnState {
  footnotes: Record<number, { children: Paragraph[] }>;
  id: number;
}

type InlineRun = TextRun | ExternalHyperlink | FootnoteReferenceRun;

/**
 * Parses a fragment of Typst markup into Word runs. Recovers the inline
 * constructs that the deserializer currently leaves embedded in raw blocks:
 * `#emph[…]`, `#strong[…]`, `#raw("…")`, inline `#footnote[…]`,
 * `#link("…")[…]`, `#text(…)[…]`, `#super/#sub[…]`, `@citekey`, `@label`,
 * plus `*bold*` / `_italic_` / `` `code` `` markup. Unknown `#fn(…)[…]`
 * design calls are dropped (their bracket content is discarded) so design
 * noise never leaks as text.
 */
function parseInlineTypst(text: string, base: IRunOptions, fn: FnState, collect?: string[]): InlineRun[] {
  const runs: InlineRun[] = [];
  let buf = '';
  const flush = () => { if (buf) { runs.push(new TextRun({ ...base, text: buf })); collect?.push(buf); buf = ''; } };

  let i = 0;
  while (i < text.length) {
    const ch = text[i];

    if (ch === '\\' && i + 1 < text.length) { buf += text[i + 1]; i += 2; continue; }

    if (ch === '#') {
      const m = text.slice(i).match(/^#([a-zA-Z][a-zA-Z0-9.-]*)/);
      if (m) {
        const name = m[1];
        let j = i + 1 + name.length;
        let args = '';
        if (text[j] === '(') { const mb = matchBracket(text, j, '(', ')'); if (mb) { args = mb.inner; j = mb.end; } }
        let inner: string | null = null;
        if (text[j] === '[') { const mb = matchBracket(text, j, '[', ']'); if (mb) { inner = mb.inner; j = mb.end; } }
        flush();
        const produced = handleInlineFunc(name, args, inner, base, fn, collect);
        if (produced) runs.push(...produced);
        i = j;
        continue;
      }
    }

    if (ch === '@') {
      const m = text.slice(i).match(/^@([a-zA-Z][\w:.-]*)/);
      if (m) {
        // Trailing `.`/`:` is sentence punctuation, not part of the name
        // (matches Typst's own parsing).
        const name = m[1].replace(/[.:]+$/, '');
        flush();
        runs.push(...renderAtRef(name));
        collect?.push(name);
        i += 1 + name.length;
        continue;
      }
    }

    if (ch === '*') {
      const close = findMarkupClose(text, i + 1, '*');
      if (close > i) { flush(); runs.push(...parseInlineTypst(text.slice(i + 1, close), { ...base, bold: true }, fn, collect)); i = close + 1; continue; }
    }
    if (ch === '_') {
      const close = findMarkupClose(text, i + 1, '_');
      if (close > i) { flush(); runs.push(...parseInlineTypst(text.slice(i + 1, close), { ...base, italics: true }, fn, collect)); i = close + 1; continue; }
    }
    if (ch === '`') {
      const close = text.indexOf('`', i + 1);
      if (close > i) { const code = text.slice(i + 1, close); flush(); runs.push(new TextRun({ ...base, text: code, font: 'Consolas' })); collect?.push(code); i = close + 1; continue; }
    }

    buf += ch;
    i++;
  }
  flush();
  return runs;
}

/** Finds the index of a closing markup delimiter that sits at a word boundary. */
function findMarkupClose(text: string, from: number, delim: string): number {
  for (let i = from; i < text.length; i++) {
    if (text[i] === delim) return i;
    if (text[i] === '\n') return -1;
  }
  return -1;
}

function handleInlineFunc(name: string, args: string, inner: string | null, base: IRunOptions, fn: FnState, collect?: string[]): InlineRun[] | null {
  switch (name) {
    case 'emph':
      return inner !== null ? parseInlineTypst(inner, { ...base, italics: true }, fn, collect) : null;
    case 'strong':
      return inner !== null ? parseInlineTypst(inner, { ...base, bold: true }, fn, collect) : null;
    case 'text': {
      if (inner === null) return null;
      // Carry visible styling so title heroes / pull-quotes keep their
      // weight and (relative) size in Word: `#text(size: 2.2em,
      // weight: "bold", style: "italic")[…]`. Colors are skipped — they
      // reference style-colors.* slots we can't resolve here.
      const styled: IRunOptions = { ...base };
      const sizeM = args.match(/size:\s*([\d.]+)\s*(em|pt)\b/);
      if (sizeM) {
        const v = parseFloat(sizeM[1]);
        const bodySize = activeCtx?.resolved.bodySize ?? 22;
        const half = sizeM[2] === 'em' ? Math.round(bodySize * v) : Math.round(v * 2);
        if (isFinite(half) && half > 0) (styled as { size?: number }).size = half;
      }
      if (/weight:\s*"(bold|semibold|extrabold|black)"/.test(args)) (styled as { bold?: boolean }).bold = true;
      if (/style:\s*"italic"/.test(args)) (styled as { italics?: boolean }).italics = true;
      return parseInlineTypst(inner, styled, fn, collect);
    }
    case 'smallcaps':
    case 'underline':
      return inner !== null ? parseInlineTypst(inner, base, fn, collect) : null;
    case 'align':
    case 'block':
    case 'box':
    case 'quote':
    case 'dropcap':
      // Inline containers — keep their visible content (alignment/framing
      // can't be represented mid-paragraph).
      return inner !== null ? parseInlineTypst(inner, base, fn, collect) : null;
    case 'super':
      return inner !== null ? parseInlineTypst(inner, { ...base, superScript: true }, fn, collect) : null;
    case 'sub':
      return inner !== null ? parseInlineTypst(inner, { ...base, subScript: true }, fn, collect) : null;
    case 'raw': {
      const m = args.match(/"((?:[^"\\]|\\.)*)"/);
      const code = m ? m[1].replace(/\\"/g, '"') : (inner ?? '');
      collect?.push(code);
      return [new TextRun({ ...base, text: code, font: 'Consolas' })];
    }
    case 'footnote': {
      if (inner === null) return null;
      const currentId = fn.id++;
      const bodyRuns = parseInlineTypst(inner, { size: 20 }, fn);
      fn.footnotes[currentId] = { children: [new Paragraph({ children: bodyRuns.length ? bodyRuns : [new TextRun({ text: inner, size: 20 })] })] };
      return [new FootnoteReferenceRun(currentId)];
    }
    case 'link': {
      const m = args.match(/"([^"]+)"/);
      const href = m ? m[1] : '';
      const label = inner ?? href;
      collect?.push(label);
      return [new ExternalHyperlink({ link: href, children: [new TextRun({ text: label, style: 'Hyperlink' })] })];
    }
    case 'cite': {
      const m = args.match(/"?<?([a-zA-Z0-9_:.-]+)>?"?/);
      if (!m) return null;
      collect?.push(m[1]);
      return renderAtRef(m[1].replace(/[.:]+$/, ''));
    }
    default:
      // Unknown function. If it carries bracket content (e.g. a user macro like
      // #frage[…] / #lead[…] nested in a raw block the keystone didn't convert —
      // the interview's ad-hoc #grid head), KEEP that content: the web/Word
      // export wants the words, not a silent drop (the B1 safety net — the
      // primary fix is turning these into AST nodes; this catches the remainder).
      // Pure no-content layout calls (inner === null) still drop.
      return inner !== null ? parseInlineTypst(inner, base, fn, collect) : null;
  }
}

/** Heuristic: known label prefixes / a colon → cross-reference; else citation. */
const REF_PREFIXES = /^(fig|tbl|eq|sec|chap|app|thm|lem|def|cor|prop|algo|lst|figure|table|equation|section|chapter|appendix)\b/i;
function renderAtRef(name: string): InlineRun[] {
  if (name.includes(':') || REF_PREFIXES.test(name)) {
    const refType = name.split(':')[0];
    return renderReference(name, refType);
  }
  return renderCitation(name, activeCtx?.bibEntries ?? []);
}

// ─── Cross-reference resolution ──────────────────────────────

function renderReference(label: string, _refType: string): TextRun[] {
  const ctx = activeCtx;
  const w = refWords(ctx?.resolved.lang ?? 'en');
  const t = ctx?.labelMap.get(label);
  if (t) {
    if (t.kind === 'equation') return [new TextRun({ text: t.numberText ?? `(${t.n})` })];
    if (t.kind === 'heading') return [new TextRun({ text: `${w.section} ${t.numberText ?? t.n}`.trim() })];
    const word = t.kind === 'figure' ? w.figure : t.kind === 'table' ? w.table : '';
    return [new TextRun({ text: `${word} ${t.n}`.trim() })];
  }
  // Unknown label → readable fallback (strip the prefix).
  const bare = label.includes(':') ? label.split(':').slice(1).join(':') : label;
  return [new TextRun({ text: bare })];
}

// ─── Page-number footer ──────────────────────────────────────

function buildPageNumberFooter(r: Resolved): Footer {
  return new Footer({
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ children: [PageNumber.CURRENT], size: r.bodySize, font: r.bodyFont })],
    })],
  });
}

/**
 * Recursively converts a bullet / ordered list. Preserves nesting depth
 * (mapped to Word list levels) and, for ordered lists, the per-list numbering
 * instance so separate lists restart at 1 and nested lists cycle their format.
 */
function convertList(
  node: TipTapNode,
  ordered: boolean,
  level: number,
  instance: number,
  baseDir: string,
  footnotes: Record<number, { children: Paragraph[] }>,
  footnoteId: number,
  bibEntries: BibEntry[],
): { elements: Paragraph[]; nextFootnoteId: number } {
  const out: Paragraph[] = [];
  for (const item of node.content ?? []) {
    for (const child of item.content ?? []) {
      if (child.type === 'bulletList' || child.type === 'orderedList') {
        const nestedOrdered = child.type === 'orderedList';
        const nestedInstance = nestedOrdered && activeCtx ? activeCtx.orderedInstance++ : instance;
        const r = convertList(child, nestedOrdered, level + 1, nestedInstance, baseDir, footnotes, footnoteId, bibEntries);
        out.push(...r.elements);
        footnoteId = r.nextFootnoteId;
      } else {
        const runs = convertInlineContent(child.content ?? [], baseDir, footnotes, footnoteId, bibEntries);
        footnoteId = runs.nextFootnoteId;
        out.push(new Paragraph({
          ...(ordered
            ? { numbering: { reference: 'ordered-list', level, instance } }
            : { bullet: { level } }),
          children: runs.children,
        }));
      }
    }
  }
  return { elements: out, nextFootnoteId: footnoteId };
}
