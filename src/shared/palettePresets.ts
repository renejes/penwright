/**
 * Curated palette presets for the Design panel's "Apply preset" buttons.
 *
 * Each preset maps directly onto `StyleColors` — the five semantic slots
 * (primary, accent, text, background, muted). The palettes are intentionally
 * conservative: text + background always pass WCAG AA contrast (4.5:1) for
 * body copy, primary + background pass 4.5:1 for headings, accent + background
 * pass 3:1 for large/decorative use.
 *
 * Adding a preset: drop a new entry into the array. Each preset's id is
 * stable (we never reorder by it) so Phase C MCP tools can reference presets
 * by id without breaking on a future reshuffle.
 */

import type { StyleColors } from './styleTypes';

export interface PalettePreset {
  id: string;
  name: string;
  description: string;
  colors: StyleColors;
}

export const PALETTE_PRESETS: PalettePreset[] = [
  {
    id: 'modern-tech',
    name: 'Modern Tech',
    description: 'Slate primary, electric-blue accent. Default vswrite vibe.',
    colors: {
      primary:    '#0f172a',
      accent:     '#3b82f6',
      text:       '#1a1a1a',
      background: '#ffffff',
      muted:      '#6b7280',
    },
  },
  {
    id: 'editorial',
    name: 'Editorial',
    description: 'Warm off-white, deep charcoal headings, terracotta accent.',
    colors: {
      primary:    '#1f1c1a',
      accent:     '#b9542d',
      text:       '#2c2925',
      background: '#fbf7f1',
      muted:      '#8b8378',
    },
  },
  {
    id: 'earth-tones',
    name: 'Earth Tones',
    description: 'Olive primary on cream, rust accent. Calm, grounded.',
    colors: {
      primary:    '#3d4a2a',
      accent:     '#9d4e2a',
      text:       '#2d2a24',
      background: '#f5f1e8',
      muted:      '#7a7468',
    },
  },
  {
    id: 'high-contrast',
    name: 'High Contrast',
    description: 'Pure black on pure white, cobalt accent. Accessibility-first.',
    colors: {
      primary:    '#000000',
      accent:     '#1d4ed8',
      text:       '#0a0a0a',
      background: '#ffffff',
      muted:      '#525252',
    },
  },
  {
    id: 'minimal-mono',
    name: 'Minimal Mono',
    description: 'Greys all the way down. One restrained accent.',
    colors: {
      primary:    '#1f1f1f',
      accent:     '#1f1f1f',
      text:       '#262626',
      background: '#fafafa',
      muted:      '#737373',
    },
  },
  {
    id: 'forest-deep',
    name: 'Forest Deep',
    description: 'Deep green primary, amber accent. Editorial / outdoorsy.',
    colors: {
      primary:    '#1f3a2e',
      accent:     '#d97706',
      text:       '#1a1a1a',
      background: '#fcfaf6',
      muted:      '#6b7268',
    },
  },
  {
    id: 'sunset-warm',
    name: 'Sunset Warm',
    description: 'Aubergine primary, coral accent. Bold, marketing-friendly.',
    colors: {
      primary:    '#4c1d4f',
      accent:     '#f97316',
      text:       '#1c1917',
      background: '#fef9f5',
      muted:      '#78716c',
    },
  },
  {
    id: 'ocean-classic',
    name: 'Ocean Classic',
    description: 'Navy primary, teal accent. Corporate, conservative.',
    colors: {
      primary:    '#0c2340',
      accent:     '#0d9488',
      text:       '#0c1e2e',
      background: '#f8fafc',
      muted:      '#64748b',
    },
  },
];
