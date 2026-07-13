/**
 * Theme presets — six full `ProjectStyle` snapshots that replace the seven
 * legacy `styleTemplates`. Where palette-presets in `palettePresets.ts` only
 * swap the five color slots, themes are entire design configurations
 * (colors + fonts + scale + layout + headings + elements + optional custom
 * preamble). Applying a theme overwrites the whole style.json in one shot.
 *
 * Each theme references bundled OFL fonts that ship with Penwright, so they
 * render the same regardless of what the user has installed system-wide.
 *
 * Stable `id`s — Phase C's `penwright_apply_theme` MCP tool references them
 * directly, so reordering or renaming is a breaking change.
 */

import type {
  ProjectStyle, StyleColors, StyleFonts, StyleScale, StyleLayout,
  StyleHeadings, StyleElements, StyleBlockquote, StyleCodeBlock,
  StyleFigure, StyleTable, StyleCustom,
} from './styleTypes';
import { sanitizeProjectStyle, DEFAULT_PROJECT_STYLE } from './styleTypes';

/** Deep-partial overlay for one theme — every leaf is optional. */
interface ThemeOverlay {
  colors?: Partial<StyleColors>;
  fonts?: Partial<StyleFonts>;
  scale?: Partial<StyleScale>;
  layout?: Partial<StyleLayout>;
  headings?: Partial<StyleHeadings>;
  elements?: {
    blockquote?: Partial<StyleBlockquote>;
    codeBlock?:  Partial<StyleCodeBlock>;
    figure?:     Partial<StyleFigure>;
    table?:      Partial<StyleTable>;
  };
  custom?: Partial<StyleCustom>;
}

export interface ThemePreset {
  id: string;
  name: string;
  description: string;
  /** What this theme is best at — used as the card subtitle. */
  bestFor: string;
  /** Full `ProjectStyle` snapshot — sanitised before export to catch typos. */
  style: ProjectStyle;
}

/** Builds a complete ProjectStyle from a deep-partial overlay over the defaults. */
function theme(overlay: ThemeOverlay): ProjectStyle {
  const D = DEFAULT_PROJECT_STYLE;
  // We can't naively spread overlay over D because sub-objects (colors,
  // fonts, scale, layout, headings, elements, custom) would replace whole
  // groups instead of being merged. So merge each branch explicitly.
  return sanitizeProjectStyle({
    version: '1',
    colors:   { ...D.colors,   ...(overlay.colors   ?? {}) },
    fonts:    { ...D.fonts,    ...(overlay.fonts    ?? {}) },
    scale:    { ...D.scale,    ...(overlay.scale    ?? {}) },
    layout:   { ...D.layout,   ...(overlay.layout   ?? {}) },
    headings: { ...D.headings, ...(overlay.headings ?? {}) },
    elements: {
      blockquote: { ...D.elements.blockquote, ...(overlay.elements?.blockquote ?? {}) },
      codeBlock:  { ...D.elements.codeBlock,  ...(overlay.elements?.codeBlock  ?? {}) },
      figure:     { ...D.elements.figure,     ...(overlay.elements?.figure     ?? {}) },
      table:      { ...D.elements.table,      ...(overlay.elements?.table      ?? {}) },
    },
    custom: { preamble: overlay.custom?.preamble ?? '' },
  });
}

export const THEME_PRESETS: ThemePreset[] = [
  // ─── Classic Academic ─────────────────────────────────────
  {
    id: 'classic-academic',
    name: 'Classic Academic',
    description: 'Serif body with subtle navy headings, conservative spacing, 1.1 numbering.',
    bestFor: 'Term papers, theses, journal submissions',
    style: theme({
      colors: {
        primary:    '#1e293b',
        accent:     '#7c1d1d',
        text:       '#0f172a',
        background: '#ffffff',
        muted:      '#64748b',
      },
      fonts: {
        body:    'Crimson Pro',
        heading: 'IBM Plex Sans',
        code:    'IBM Plex Mono',
      },
      scale: {
        base:             '11pt',
        leading:          '0.65em',
        paragraphSpacing: '1.2em',
        firstLineIndent:  '1em',
      },
      layout: {
        paper:         'a4',
        margin:        '2.5cm',
        columns:       1,
        pageNumbering: '1',
        pageHeader:    '',
        pageFooter:    '',
        pageFill:      '',
      },
      headings: {
        h1: { size: '22pt', weight: 'bold',     color: 'primary', marginTop: '1.8em' },
        h2: { size: '16pt', weight: 'semibold', color: 'primary', marginTop: '1.4em' },
        h3: { size: '13pt', weight: 'semibold', color: 'primary', marginTop: '1.1em' },
        h4: { size: '12pt', weight: 'semibold', color: 'text',    marginTop: '1em'   },
        h5: { size: '11pt', weight: 'bold',     color: 'text',    marginTop: '0.9em' },
        h6: { size: '10pt', weight: 'bold',     color: 'muted',   marginTop: '0.8em' },
        numbering: '1.1',
      },
    }),
  },

  // ─── Modern Tech ──────────────────────────────────────────
  {
    id: 'modern-tech',
    name: 'Modern Tech',
    description: 'Inter everywhere, electric-blue accent, no first-line indent. Documentation-friendly.',
    bestFor: 'API docs, product specs, technical blog posts',
    style: theme({
      colors: {
        primary:    '#0f172a',
        accent:     '#3b82f6',
        text:       '#1e293b',
        background: '#ffffff',
        muted:      '#64748b',
      },
      fonts: {
        body:    'Inter',
        heading: 'Inter',
        code:    'JetBrains Mono',
      },
      scale: {
        base:             '11pt',
        leading:          '0.7em',
        paragraphSpacing: '1em',
        firstLineIndent:  '',
      },
      layout: {
        paper:         'a4',
        margin:        '2.5cm',
        columns:       1,
        pageNumbering: '1',
        pageHeader:    '',
        pageFooter:    '',
        pageFill:      '',
      },
      headings: {
        h1: { size: '26pt', weight: 'bold',     color: 'primary', marginTop: '2.2em' },
        h2: { size: '19pt', weight: 'semibold', color: 'primary', marginTop: '1.7em' },
        h3: { size: '15pt', weight: 'semibold', color: 'primary', marginTop: '1.3em' },
        h4: { size: '13pt', weight: 'semibold', color: 'text',    marginTop: '1.1em' },
        h5: { size: '11pt', weight: 'bold',     color: 'text',    marginTop: '1em'   },
        h6: { size: '10pt', weight: 'bold',     color: 'muted',   marginTop: '0.8em' },
        numbering: '',
      },
      elements: {
        codeBlock: { background: 'luma(245)', paddingX: '1.2em', paddingY: '0.8em', borderRadius: '6pt' },
      },
    }),
  },

  // ─── Editorial Magazine ───────────────────────────────────
  {
    id: 'editorial-magazine',
    name: 'Editorial Magazine',
    description: 'Spectral body on warm cream, terracotta accent. Large display H1, generous spacing.',
    bestFor: 'Long-form articles, newsletters, magazine spreads',
    style: theme({
      colors: {
        primary:    '#1f1c1a',
        accent:     '#b9542d',
        text:       '#2c2925',
        background: '#fbf7f1',
        muted:      '#8b8378',
      },
      fonts: {
        body:    'Spectral',
        heading: 'IBM Plex Sans',
        code:    'JetBrains Mono',
      },
      scale: {
        base:             '11pt',
        leading:          '0.75em',
        paragraphSpacing: '1.3em',
        firstLineIndent:  '',
      },
      layout: {
        paper:         'a4',
        margin:        '2.8cm',
        columns:       1,
        pageNumbering: '— 1 —',
        pageHeader:    '',
        pageFooter:    '',
        pageFill:      '',
      },
      headings: {
        h1: { size: '32pt', weight: 'bold',     color: 'primary', marginTop: '2.5em' },
        h2: { size: '20pt', weight: 'semibold', color: 'primary', marginTop: '1.8em' },
        h3: { size: '15pt', weight: 'semibold', color: 'accent',  marginTop: '1.3em' },
        h4: { size: '12pt', weight: 'semibold', color: 'text',    marginTop: '1.1em' },
        h5: { size: '11pt', weight: 'bold',     color: 'text',    marginTop: '1em'   },
        h6: { size: '10pt', weight: 'bold',     color: 'muted',   marginTop: '0.8em' },
        numbering: '',
      },
      elements: {
        blockquote: { borderColor: 'accent', borderWidth: '4pt', paddingLeft: '1.4em', textColor: 'primary', italic: true },
        figure:     { captionPosition: 'bottom', captionSize: '9pt', captionColor: 'muted', captionAlign: 'center', captionSeparator: ' — ' },
      },
    }),
  },

  // ─── Minimal ──────────────────────────────────────────────
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Inter only, single muted accent, generous margins. Lets the words breathe.',
    bestFor: 'Essays, manifestos, personal writing',
    style: theme({
      colors: {
        primary:    '#262626',
        accent:     '#737373',
        text:       '#262626',
        background: '#fafafa',
        muted:      '#a3a3a3',
      },
      fonts: {
        body:    'Inter',
        heading: 'Inter',
        code:    'JetBrains Mono',
      },
      scale: {
        base:             '10.5pt',
        leading:          '0.8em',
        paragraphSpacing: '1.4em',
        firstLineIndent:  '',
      },
      layout: {
        paper:         'a4',
        margin:        '3.2cm',
        columns:       1,
        pageNumbering: '1',
        pageHeader:    '',
        pageFooter:    '',
        pageFill:      '',
      },
      headings: {
        h1: { size: '20pt', weight: 'regular',  color: 'primary', marginTop: '2.5em' },
        h2: { size: '14pt', weight: 'medium',   color: 'primary', marginTop: '1.8em' },
        h3: { size: '12pt', weight: 'medium',   color: 'primary', marginTop: '1.3em' },
        h4: { size: '11pt', weight: 'semibold', color: 'text',    marginTop: '1.1em' },
        h5: { size: '10pt', weight: 'bold',     color: 'text',    marginTop: '1em'   },
        h6: { size: '10pt', weight: 'bold',     color: 'muted',   marginTop: '0.9em' },
        numbering: '',
      },
      elements: {
        blockquote: { borderColor: 'muted', borderWidth: '1pt', paddingLeft: '1.2em', textColor: 'muted', italic: false },
        codeBlock:  { background: '', paddingX: '0pt', paddingY: '0pt', borderRadius: '' },
      },
    }),
  },

  // ─── Marketing Brochure ───────────────────────────────────
  {
    id: 'marketing-brochure',
    name: 'Marketing Brochure',
    description: 'Bold saturated palette, IBM Plex Sans throughout, denser margins, two columns.',
    bestFor: 'Product brochures, marketing one-pagers, sales decks',
    style: theme({
      colors: {
        primary:    '#0c2340',
        accent:     '#f97316',
        text:       '#1c1917',
        background: '#ffffff',
        muted:      '#525252',
      },
      fonts: {
        body:    'IBM Plex Sans',
        heading: 'IBM Plex Sans',
        code:    'JetBrains Mono',
      },
      scale: {
        base:             '10.5pt',
        leading:          '0.7em',
        paragraphSpacing: '1em',
        firstLineIndent:  '',
      },
      layout: {
        paper:         'a4',
        margin:        '1.8cm',
        columns:       2,
        pageNumbering: '',
        pageHeader:    '',
        pageFooter:    '',
        pageFill:      '',
      },
      headings: {
        h1: { size: '24pt', weight: 'extrabold', color: 'primary', marginTop: '1.5em' },
        h2: { size: '17pt', weight: 'bold',      color: 'accent',  marginTop: '1.4em' },
        h3: { size: '13pt', weight: 'bold',      color: 'primary', marginTop: '1.1em' },
        h4: { size: '11pt', weight: 'bold',      color: 'text',    marginTop: '1em'   },
        h5: { size: '10pt', weight: 'bold',      color: 'text',    marginTop: '0.9em' },
        h6: { size: '10pt', weight: 'bold',      color: 'muted',   marginTop: '0.8em' },
        numbering: '',
      },
      elements: {
        blockquote: { borderColor: 'accent', borderWidth: '4pt', paddingLeft: '1.2em', textColor: 'primary', italic: false },
        table:      { headerBackground: 'primary', headerTextColor: 'background', alternateRowFill: true, borderColor: 'muted', cellPadding: '7pt' },
      },
    }),
  },

  // ─── Thesis ───────────────────────────────────────────────
  {
    id: 'thesis',
    name: 'Thesis',
    description: 'Crimson Pro throughout, full hierarchical numbering, binding-friendly inner margin.',
    bestFor: 'Doctoral theses, formal academic monographs',
    style: theme({
      colors: {
        primary:    '#0f172a',
        accent:     '#7c1d1d',
        text:       '#0a0a0a',
        background: '#ffffff',
        muted:      '#525252',
      },
      fonts: {
        body:    'Crimson Pro',
        heading: 'Crimson Pro',
        code:    'IBM Plex Mono',
      },
      scale: {
        base:             '11pt',
        leading:          '0.7em',
        paragraphSpacing: '1.2em',
        firstLineIndent:  '1em',
      },
      layout: {
        paper:         'a4',
        margin:        '2.8cm',
        columns:       1,
        pageNumbering: '1 / 1',
        pageHeader:    '',
        pageFooter:    '',
        pageFill:      '',
      },
      headings: {
        h1: { size: '22pt', weight: 'bold',     color: 'primary', marginTop: '2em'   },
        h2: { size: '17pt', weight: 'bold',     color: 'primary', marginTop: '1.6em' },
        h3: { size: '14pt', weight: 'semibold', color: 'primary', marginTop: '1.3em' },
        h4: { size: '12pt', weight: 'semibold', color: 'text',    marginTop: '1.1em' },
        h5: { size: '11pt', weight: 'bold',     color: 'text',    marginTop: '1em'   },
        h6: { size: '10pt', weight: 'bold',     color: 'muted',   marginTop: '0.9em' },
        numbering: '1.1',
      },
      elements: {
        figure: { captionPosition: 'bottom', captionSize: '9pt', captionColor: 'muted', captionAlign: 'left', captionSeparator: ': ' },
        table:  { headerBackground: 'muted', headerTextColor: 'background', alternateRowFill: false, borderColor: 'muted', cellPadding: '6pt' },
      },
    }),
  },
];

