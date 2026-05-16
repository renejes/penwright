/**
 * Project Style — structured "design tokens" for a vswrite project.
 *
 * Persisted to `<project>/.vswrite/style.json` (the JSON model) and generated
 * out to `<project>/style.typ` (the Typst preamble). main.typ pulls the
 * preamble in via `#include "style.typ"` at the very top, so every chapter
 * inherits the rules.
 *
 * Phase A (Design Editor): exposes the core knobs — colors, fonts, scale,
 * layout, heading style. Phases B/C/D extend the shape with per-element
 * overrides, palettes, MCP-tool surface.
 *
 * Shared between main and renderer, so keep this file dependency-free.
 */

export const STYLE_SCHEMA_VERSION = '1' as const;

export interface StyleColors {
  /** Primary brand / accent color — used for headings by default. */
  primary: string;
  /** Secondary accent — used for links, highlights, callouts. */
  accent: string;
  /** Body text color. */
  text: string;
  /** Page background. */
  background: string;
  /** Muted text — captions, secondary info. */
  muted: string;
}

export interface StyleFonts {
  /** Body / paragraph font. */
  body: string;
  /** Heading font. */
  heading: string;
  /** Code / monospace font. */
  code: string;
}

export interface StyleScale {
  /** Base font size — Typst length (e.g. "11pt"). */
  base: string;
  /** Paragraph leading — Typst length (e.g. "0.65em"). */
  leading: string;
  /** Paragraph spacing between blocks — Typst length (e.g. "1.2em"). Empty = Typst default. */
  paragraphSpacing: string;
  /** First-line indent — Typst length (e.g. "1em"). Empty = no indent. */
  firstLineIndent: string;
}

export interface StyleLayout {
  /** Paper size — Typst paper string (e.g. "a4", "us-letter"). */
  paper: string;
  /** Page margin — Typst length (e.g. "2.5cm"). */
  margin: string;
  /** Column count, 1–3. */
  columns: number;
  /** Page-number pattern — Typst pattern like "1", "1 / 1", "i", "I", "— 1 —". Empty = none. */
  pageNumbering: string;
  /** Page-header markup placed inside `header: [...]`. Empty = no header. */
  pageHeader: string;
  /** Page-footer markup placed inside `footer: [...]`. Empty = no footer (page-number footer still works). */
  pageFooter: string;
  /**
   * Page background fill expression — Typst color value like `luma(252)` or
   * `rgb("#FFFFF0")`. Empty = use `colors.background`. Kept as raw Typst
   * expression rather than hex so users can pick e.g. `luma(245)` from a
   * dropdown without us round-tripping it through hex.
   */
  pageFill: string;
}

export interface StyleHeading {
  /** Typst length (e.g. "24pt"). */
  size: string;
  /** Typst weight: "regular" | "medium" | "semibold" | "bold" | numeric. */
  weight: string;
  /** Color slot name — one of the keys in `StyleColors`. */
  color: keyof StyleColors;
  /** Typst length (e.g. "2em") — space above the heading. */
  marginTop: string;
}

export interface StyleHeadings {
  h1: StyleHeading;
  h2: StyleHeading;
  /** Numbering pattern applied via `#set heading(numbering: "...")` — e.g. "1.1", "1.", "I.". Empty = unnumbered. */
  numbering: string;
}

/**
 * Free-form Typst code that the user (or an imported style template) wants
 * appended to the generated `style.typ`. This is the escape hatch for things
 * the structured schema can't express yet: custom `#show heading` blocks
 * with line decorations, `#import` of bundled packages, helper `#let`s,
 * page-break-after-h1 rules, etc.
 *
 * Lives BELOW the generated rules in style.typ, so it can override anything
 * the Designer set. Wraps in a clearly-marked block so style.typ stays
 * regenerable: re-running the generator only touches the generated section,
 * never the custom block.
 */
export interface StyleCustom {
  /** Typst source appended to style.typ after the generated rules. */
  preamble: string;
}

export interface ProjectStyle {
  version: typeof STYLE_SCHEMA_VERSION;
  colors: StyleColors;
  fonts: StyleFonts;
  scale: StyleScale;
  layout: StyleLayout;
  headings: StyleHeadings;
  custom: StyleCustom;
}

export const DEFAULT_PROJECT_STYLE: ProjectStyle = {
  version: STYLE_SCHEMA_VERSION,
  colors: {
    primary: '#0f172a',
    accent: '#3b82f6',
    text: '#1a1a1a',
    background: '#ffffff',
    muted: '#6b7280',
  },
  fonts: {
    body: 'New Computer Modern',
    heading: 'New Computer Modern',
    code: 'DejaVu Sans Mono',
  },
  scale: {
    base: '11pt',
    leading: '0.65em',
    paragraphSpacing: '',
    firstLineIndent: '',
  },
  layout: {
    paper: 'a4',
    margin: '2.5cm',
    columns: 1,
    pageNumbering: '',
    pageHeader: '',
    pageFooter: '',
    pageFill: '',
  },
  headings: {
    h1: { size: '24pt', weight: 'bold',     color: 'primary', marginTop: '2em'   },
    h2: { size: '18pt', weight: 'semibold', color: 'primary', marginTop: '1.6em' },
    numbering: '',
  },
  custom: { preamble: '' },
};

/** Strict color-slot validator — Phase C MCP tools rely on this. */
export const COLOR_SLOTS: ReadonlyArray<keyof StyleColors> =
  ['primary', 'accent', 'text', 'background', 'muted'] as const;

const HEX = /^#[0-9a-f]{3}([0-9a-f]{3})?$/i;
const TYPST_LEN = /^-?\d+(\.\d+)?(pt|mm|cm|in|em|fr|%)$/;
const PAPER = /^[a-z0-9-]+$/i;
const WEIGHT = /^(thin|extralight|light|regular|medium|semibold|bold|extrabold|black|\d{3})$/;

function pickColor(raw: unknown, fallback: string): string {
  if (typeof raw === 'string' && HEX.test(raw.trim())) return raw.trim().toLowerCase();
  return fallback;
}

function pickFont(raw: unknown, fallback: string): string {
  if (typeof raw === 'string' && raw.trim().length > 0 && raw.length < 100) return raw.trim();
  return fallback;
}

function pickLen(raw: unknown, fallback: string): string {
  if (typeof raw === 'string' && TYPST_LEN.test(raw.trim())) return raw.trim();
  return fallback;
}

function pickPaper(raw: unknown, fallback: string): string {
  if (typeof raw === 'string' && PAPER.test(raw.trim()) && raw.length < 32) return raw.trim().toLowerCase();
  return fallback;
}

function pickWeight(raw: unknown, fallback: string): string {
  if (typeof raw === 'string' && WEIGHT.test(raw.trim())) return raw.trim();
  return fallback;
}

/**
 * Length-or-empty: same as pickLen but allows an empty string explicitly.
 * Used for optional layout/scale fields where "" means "Typst default —
 * don't emit a #set arg at all". Anything else must validate as a length.
 */
function pickLenOrEmpty(raw: unknown, fallback: string): string {
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (trimmed === '') return '';
    if (TYPST_LEN.test(trimmed)) return trimmed;
  }
  return fallback;
}

/**
 * Free-form short string (~200 char cap). Used for things like page-numbering
 * patterns and header/footer markup where we trust the user to write valid
 * Typst. We don't sanitize the contents because the user can already paste
 * arbitrary Typst into the custom-code section — this is just a length cap
 * to keep style.json reasonable.
 */
function pickFreeString(raw: unknown, fallback: string, maxLen = 200): string {
  if (typeof raw === 'string' && raw.length <= maxLen) return raw;
  return fallback;
}

function pickColorSlot(raw: unknown, fallback: keyof StyleColors): keyof StyleColors {
  if (typeof raw === 'string' && (COLOR_SLOTS as readonly string[]).includes(raw)) {
    return raw as keyof StyleColors;
  }
  return fallback;
}

function pickInt(raw: unknown, min: number, max: number, fallback: number): number {
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function sanitizeHeading(raw: unknown, fallback: StyleHeading): StyleHeading {
  const r = (raw ?? {}) as Partial<StyleHeading>;
  return {
    size:      pickLen(r.size, fallback.size),
    weight:    pickWeight(r.weight, fallback.weight),
    color:     pickColorSlot(r.color, fallback.color),
    marginTop: pickLen(r.marginTop, fallback.marginTop),
  };
}

const MAX_CUSTOM_PREAMBLE_LEN = 64 * 1024;

function sanitizeCustom(raw: unknown): StyleCustom {
  const r = (raw ?? {}) as Partial<StyleCustom>;
  let preamble = typeof r.preamble === 'string' ? r.preamble : '';
  if (preamble.length > MAX_CUSTOM_PREAMBLE_LEN) preamble = preamble.slice(0, MAX_CUSTOM_PREAMBLE_LEN);
  return { preamble };
}

/**
 * Coerces an arbitrary JSON value into a valid ProjectStyle.
 * Missing or invalid fields fall back to defaults. Always returns a fresh
 * object — safe for callers to mutate.
 */
export function sanitizeProjectStyle(raw: unknown): ProjectStyle {
  const r = (raw ?? {}) as Partial<ProjectStyle>;
  const colors = (r.colors ?? {}) as Partial<StyleColors>;
  const fonts  = (r.fonts  ?? {}) as Partial<StyleFonts>;
  const scale  = (r.scale  ?? {}) as Partial<StyleScale>;
  const layout = (r.layout ?? {}) as Partial<StyleLayout>;
  const headings = (r.headings ?? {}) as Partial<StyleHeadings>;
  const D = DEFAULT_PROJECT_STYLE;

  return {
    version: STYLE_SCHEMA_VERSION,
    colors: {
      primary:    pickColor(colors.primary,    D.colors.primary),
      accent:     pickColor(colors.accent,     D.colors.accent),
      text:       pickColor(colors.text,       D.colors.text),
      background: pickColor(colors.background, D.colors.background),
      muted:      pickColor(colors.muted,      D.colors.muted),
    },
    fonts: {
      body:    pickFont(fonts.body,    D.fonts.body),
      heading: pickFont(fonts.heading, D.fonts.heading),
      code:    pickFont(fonts.code,    D.fonts.code),
    },
    scale: {
      base:             pickLen(scale.base, D.scale.base),
      leading:          pickLen(scale.leading, D.scale.leading),
      paragraphSpacing: pickLenOrEmpty(scale.paragraphSpacing, D.scale.paragraphSpacing),
      firstLineIndent:  pickLenOrEmpty(scale.firstLineIndent, D.scale.firstLineIndent),
    },
    layout: {
      paper:         pickPaper(layout.paper, D.layout.paper),
      margin:        pickLen(layout.margin, D.layout.margin),
      columns:       pickInt(layout.columns, 1, 3, D.layout.columns),
      pageNumbering: pickFreeString(layout.pageNumbering, D.layout.pageNumbering, 32),
      pageHeader:    pickFreeString(layout.pageHeader, D.layout.pageHeader),
      pageFooter:    pickFreeString(layout.pageFooter, D.layout.pageFooter),
      pageFill:      pickFreeString(layout.pageFill, D.layout.pageFill, 100),
    },
    headings: {
      h1:        sanitizeHeading(headings.h1, D.headings.h1),
      h2:        sanitizeHeading(headings.h2, D.headings.h2),
      numbering: pickFreeString(headings.numbering, D.headings.numbering, 32),
    },
    custom: sanitizeCustom(r.custom),
  };
}

export function cloneProjectStyle(s: ProjectStyle): ProjectStyle {
  return sanitizeProjectStyle(JSON.parse(JSON.stringify(s)));
}
