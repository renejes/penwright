/**
 * Built-in section-style presets (Phase E) — magazine "rubric" starting points.
 *
 * Each is a `SectionStyle` overlay applied to a single chapter via a scoped
 * `#show: <id>-style`. They vary the knobs an overlay can touch — accent
 * colour, fonts, column count, base size / leading, heading treatment — while
 * page geometry and running heads stay document-level. Fonts are drawn from
 * the seven bundled OFL families so output stays offline-ready.
 *
 * These are intentionally tasteful defaults, not the final word: an agent (or
 * the Design panel) tweaks them via `define_section_style` and assigns them
 * per chapter via `apply_section_style`.
 */

import type { SectionStyle } from './styleTypes';

export interface SectionPreset extends SectionStyle {
  description: string;
}

export const SECTION_PRESETS: SectionPreset[] = [
  {
    id: 'feature',
    name: 'Feature',
    description: 'The headline article — a large display headline in an accent colour, serif body, single column. Use for the magazine\'s main story.',
    colors: { accent: '#c2410c' },
    fonts: { body: 'Spectral', heading: 'Spectral' },
    scaleBase: '',
    scaleLeading: '0.72em',
    columns: 1,
    headings: {
      h1: { size: '34pt', weight: 'bold', color: 'accent', marginTop: '0.2em' },
      h2: { size: '18pt', weight: 'semibold', color: 'primary' },
    },
  },
  {
    id: 'interview',
    name: 'Interview',
    description: 'Q&A / conversation layout — two columns, a clean sans body and a teal accent. Pairs well with bold question lead-ins.',
    colors: { accent: '#0e7490' },
    fonts: { body: 'IBM Plex Sans', heading: 'IBM Plex Sans' },
    scaleBase: '10pt',
    scaleLeading: '',
    columns: 2,
    headings: {
      h1: { size: '24pt', weight: 'bold', color: 'accent' },
      h2: { size: '13pt', weight: 'bold', color: 'accent' },
    },
  },
  {
    id: 'essay',
    name: 'Essay',
    description: 'Long-form literary reading — single column, Crimson Pro serif, generous leading, an understated heading in the text colour.',
    colors: { accent: '#6b7280' },
    fonts: { body: 'Crimson Pro', heading: 'Crimson Pro' },
    scaleBase: '',
    scaleLeading: '0.85em',
    columns: 1,
    headings: {
      h1: { size: '26pt', weight: 'medium', color: 'text', marginTop: '0.4em' },
      h2: { size: '15pt', weight: 'semibold', color: 'text' },
    },
  },
  {
    id: 'photo-essay',
    name: 'Photo Essay',
    description: 'Image-led spread — minimal, large Inter display headline, single column to let full-width images breathe.',
    colors: { accent: '#18181b' },
    fonts: { body: 'Inter', heading: 'Inter' },
    scaleBase: '',
    scaleLeading: '',
    columns: 1,
    headings: {
      h1: { size: '40pt', weight: 'bold', color: 'primary', marginTop: '0.2em' },
      h2: { size: '14pt', weight: 'semibold', color: 'muted' },
    },
  },
  {
    id: 'department',
    name: 'Department',
    description: 'Dense recurring section (news, briefs, reviews) — three compact columns, small type, a crimson accent on tight headings.',
    colors: { accent: '#be123c' },
    fonts: { body: 'IBM Plex Sans', heading: 'IBM Plex Sans' },
    scaleBase: '9pt',
    scaleLeading: '',
    columns: 3,
    headings: {
      h1: { size: '16pt', weight: 'bold', color: 'accent', marginTop: '0.2em' },
      h2: { size: '11pt', weight: 'bold', color: 'accent' },
    },
  },
];

/** Returns a fresh `SectionStyle` (no description) for the named preset, or null. */
export function getSectionPreset(id: string): SectionStyle | null {
  const p = SECTION_PRESETS.find((x) => x.id === id);
  if (!p) return null;
  const { description: _description, ...style } = p;
  return JSON.parse(JSON.stringify(style));
}
