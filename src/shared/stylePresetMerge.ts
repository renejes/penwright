/**
 * Applying a preset without losing what the preset does not know about.
 *
 * A theme or layout preset is a partial picture. It carries colours, fonts,
 * geometry — but not the per-chapter section styles the author defined, not
 * their hand-written Typst escape hatch, and not the prepress setup. Spread it
 * over the current style and the sanitizer fills those absent fields with
 * defaults: sections vanish, `custom.preamble` empties, and bleed / crop marks
 * / facing pages / binding silently reset.
 *
 * That had already been found and fixed once — in the Design panel, with a
 * comment saying so. The same rule was never applied to the MCP tools:
 * `apply_style` preserved correctly, `apply_layout` and `generate_layout` did
 * not. Three implementations of one rule, two of them wrong.
 *
 * `facingPages` and `binding` are NOT export-only, which is why this matters
 * beyond the print dialog: `generateStyleTypst` emits them into the live page
 * geometry, so losing them changes the margins of the document on screen.
 *
 * So: one merge, stated once, used by every path that applies a preset.
 */

import type { ProjectStyle, StyleLayout, StyleScale } from './styleTypes';

/**
 * Fields that belong to the project, not to any preset. A preset may override
 * them deliberately (only the print layout preset does), but never by omission.
 */
export function mergeLayout(current: StyleLayout, incoming: Partial<StyleLayout>): StyleLayout {
  return {
    ...(incoming as StyleLayout),
    bleed: incoming.bleed ?? current.bleed ?? '',
    cropMarks: incoming.cropMarks ?? current.cropMarks ?? false,
    facingPages: incoming.facingPages ?? current.facingPages ?? false,
    binding: incoming.binding ?? current.binding ?? '',
  };
}

/**
 * Applies a full theme: everything the theme defines, but the project's own
 * section styles, custom preamble and prepress setup survive.
 */
export function mergeThemePreset(current: ProjectStyle, theme: Partial<ProjectStyle>): ProjectStyle {
  return {
    ...current,
    ...theme,
    layout: mergeLayout(current.layout, theme.layout ?? current.layout),
    // Neither belongs to a theme; both are the author's own work.
    sections: current.sections,
    custom: current.custom,
  } as ProjectStyle;
}

/**
 * Applies a layout preset: geometry only. Everything else — colours, fonts,
 * headings, sections, custom code — is untouched.
 */
export function mergeLayoutPreset(
  current: ProjectStyle,
  preset: { layout: Partial<StyleLayout>; baseSize?: StyleScale['base'] },
): ProjectStyle {
  return {
    ...current,
    layout: mergeLayout(current.layout, preset.layout),
    scale: preset.baseSize ? { ...current.scale, base: preset.baseSize } : current.scale,
  };
}
