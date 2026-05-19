/**
 * Layout presets — quick layout-only swaps. Each preset writes a fixed set
 * of `style.layout` (and sometimes `scale.base`) values; everything else —
 * colors, fonts, headings, elements, custom code — is left untouched.
 *
 * Different from themes: a theme is a full ProjectStyle overwrite. A layout
 * preset is a thin "switch this document to A2 poster geometry" affordance.
 * Users typically apply a theme first, then a layout preset on top.
 *
 * Stable `id`s — Phase C's `vswrite_apply_layout` MCP tool references them
 * directly.
 */

import type { StyleLayout } from './styleTypes';

export interface LayoutPreset {
  id: string;
  name: string;
  description: string;
  bestFor: string;
  layout: StyleLayout;
  /** Optional base font-size override — large papers usually want bigger type. */
  baseSize?: string;
}

export const LAYOUT_PRESETS: LayoutPreset[] = [
  {
    id: 'a4-portrait-standard',
    name: 'A4 Portrait, Standard',
    description: 'The reset button. Single-column A4 with 2.5 cm margins.',
    bestFor: 'Default for body text, articles, reports',
    layout: {
      paper: 'a4',
      orientation: 'portrait',
      margin: '2.5cm',
      columns: 1,
      pageNumbering: '1',
      pageHeader: '',
      pageFooter: '',
      pageFill: '',
    },
  },
  {
    id: 'a4-landscape-presentation',
    name: 'A4 Landscape',
    description: 'Widescreen single-column A4 — works as slide-handout or wide-figure spread.',
    bestFor: 'Slide decks, wide figures, landscape spreads',
    layout: {
      paper: 'a4',
      orientation: 'landscape',
      margin: '2cm',
      columns: 1,
      pageNumbering: '1',
      pageHeader: '',
      pageFooter: '',
      pageFill: '',
    },
  },
  {
    id: 'magazine-2col',
    name: 'Magazine 2-Column',
    description: 'A4 portrait, two columns, tighter margins. Pairs well with Editorial Magazine theme.',
    bestFor: 'Newsletters, multi-article spreads',
    layout: {
      paper: 'a4',
      orientation: 'portrait',
      margin: '2cm',
      columns: 2,
      pageNumbering: '— 1 —',
      pageHeader: '',
      pageFooter: '',
      pageFill: '',
    },
  },
  {
    id: 'newsletter-3col',
    name: 'Newsletter 3-Column',
    description: 'A4 portrait, three narrow columns, dense layout. Classic newspaper feel.',
    bestFor: 'In-house newsletters, dense reports',
    layout: {
      paper: 'a4',
      orientation: 'portrait',
      margin: '1.8cm',
      columns: 3,
      pageNumbering: '',
      pageHeader: '',
      pageFooter: '',
      pageFill: '',
    },
    baseSize: '9.5pt',
  },
  {
    id: 'a5-booklet',
    name: 'A5 Booklet',
    description: 'Smaller A5 page with proportional margins. Print as bound booklet.',
    bestFor: 'Pocket guides, programme booklets, novellas',
    layout: {
      paper: 'a5',
      orientation: 'portrait',
      margin: '1.8cm',
      columns: 1,
      pageNumbering: '1',
      pageHeader: '',
      pageFooter: '',
      pageFill: '',
    },
    baseSize: '10pt',
  },
  {
    id: 'magazine-editorial',
    name: 'Magazine Editorial',
    description: 'A4 portrait, 2 columns, with an editorial header strip that prints the section / issue label across every page next to a short accent rule. Pairs naturally with the Editorial Magazine theme and the Magazine Cover element.',
    bestFor: 'Editorial magazines, long-form features, design publications',
    layout: {
      paper: 'a4',
      orientation: 'portrait',
      margin: '2.2cm',
      columns: 2,
      pageNumbering: '1',
      pageHeader: '#text(size: 0.85em, tracking: 0.1em, fill: style-colors.muted)[NEUES LERNEN  ·  ISSUE 1] #h(1fr) #line(length: 1.5cm, stroke: 0.5pt + style-colors.accent)',
      pageFooter: '',
      pageFill: '',
    },
    baseSize: '10.5pt',
  },
  {
    id: 'a2-poster',
    name: 'A2 Poster',
    description: 'Large A2 portrait with generous margins. Body type scales up to 14 pt.',
    bestFor: 'Conference posters, large-format display',
    layout: {
      paper: 'a2',
      orientation: 'portrait',
      margin: '4cm',
      columns: 1,
      pageNumbering: '',
      pageHeader: '',
      pageFooter: '',
      pageFill: '',
    },
    baseSize: '14pt',
  },
];

/** Returns a deep copy of the named preset's layout, or null. */
export function getLayout(id: string): { layout: StyleLayout; baseSize?: string } | null {
  const p = LAYOUT_PRESETS.find(x => x.id === id);
  return p ? { layout: { ...p.layout }, baseSize: p.baseSize } : null;
}
