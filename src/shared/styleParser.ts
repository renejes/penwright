/**
 * Style Parser — JSON ↔ Typst preamble.
 *
 * Forward direction (`generateStyleTypst`) is the load-bearing one: it takes
 * a `ProjectStyle` and emits the contents of `<project>/style.typ`. The file
 * is `#include`d from `main.typ`, so the `#set` and `#show` rules apply to
 * the whole document.
 *
 * Reverse direction (`detectStylePreambleConflicts`) is best-effort and only
 * used for the migration warning: it scans the top of a Typst file for
 * `#set text(...)`, `#set page(...)`, `#set par(...)` blocks that would
 * silently override style.typ's rules, and lists them for the user.
 *
 * Generation rules (kept simple on purpose for Phase A):
 *  - one `#set` per concern
 *  - colors exposed as a `style-colors` dict so future skills / MCP tools
 *    can reference the palette by name without re-parsing this file
 *  - explanatory header comment so users opening style.typ understand it
 */

import { HEADING_LEVELS, ProjectStyle, SectionStyle, StyleColors, StyleFonts } from './styleTypes';

/** Marker line at top of generated style.typ — used to detect ownership. */
export const STYLE_TYPST_MARKER = '// vswrite:generated-style — edit via Settings → Style';

/**
 * The two lines we inject at the top of a root .typ file to wire style.typ
 * in. `#import` brings `style-colors` (the palette dict) into scope so body
 * content can reference colors directly; `#show: apply-style` applies the
 * generated set/show rules to all subsequent content.
 *
 * Why this pattern instead of `#include`: in Typst, `#set` rules from an
 * `#include`d file do NOT propagate to the parent's scope — they apply only
 * to content inside the include. Wrapping the rules in a function and using
 * `#show: function` is the idiomatic way to make rules apply to the rest
 * of the document.
 */
export const STYLE_IMPORT_LINE = '#import "style.typ": *';
export const STYLE_APPLY_LINE  = '#show: apply-style';

/** Legacy include line — kept so ensureStyleInclude can migrate old projects. */
export const STYLE_INCLUDE_LINE_LEGACY = '#include "style.typ"';

/**
 * Fence markers that wrap the user-editable custom-code block inside
 * `style.typ`. We re-parse them on round-trip so manual edits to that
 * block survive a regeneration (Designer changes only touch the
 * generated section above the START fence).
 */
export const CUSTOM_BLOCK_START = '// ─── vswrite:custom — your free-form Typst goes here ───';
export const CUSTOM_BLOCK_END   = '// ─── vswrite:custom-end ───';

/**
 * Quotes a font name for Typst. Phase A keeps this single-string — Typst's
 * `text(font: ...)` accepts a tuple for explicit fallbacks (e.g.
 * `("Inter", "Helvetica")`), but CSS-style generic-family aliases like
 * "serif" / "sans-serif" do NOT exist in Typst and emit a warning, so we
 * deliberately don't synthesize them. Phase B will expose a multi-font
 * picker.
 */
function fontLiteral(name: string): string {
  const safe = name.replace(/"/g, '\\"');
  return `"${safe}"`;
}

/**
 * Escapes a value for safe inclusion in a Typst double-quoted string —
 * just the bare minimum (`"` and `\` need backslash-escapes). The sanitizer
 * caps these inputs at short lengths, so we don't need to deal with newlines.
 */
function escapeQuotedString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/**
 * Converts an arbitrary hex color (#rgb or #rrggbb, case-insensitive) into
 * a Typst rgb literal. Falls back to white on parse failure — the schema
 * sanitizer already restricts inputs to hex, so this is defensive.
 */
/**
 * Replaces `{chapter}` / `{section}` placeholders in header/footer
 * markup strings with calls to the `chapter-name()` / `section-name()`
 * helpers emitted at module level in `style.typ`. Anything else passes
 * through unchanged — users can still write raw Typst markup in the
 * header (`#h(1fr)`, `#counter(page).display()`, etc.) and mix in the
 * placeholders wherever they want the running-head info.
 *
 * Why placeholders and not raw `#chapter-name()` calls in the input:
 * keeps the DesignPanel's free-text input UX-friendly. The user types
 * `{chapter} · ISSUE 1` and doesn't need to know Typst's `#` syntax
 * for function calls inside `[...]` markup.
 */
function substituteRunningHeadPlaceholders(markup: string): string {
  return markup
    .replace(/\{chapter\}/g, '#chapter-name()')
    .replace(/\{section\}/g, '#section-name()');
}

function colorLiteral(hex: string): string {
  const m = hex.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return 'rgb("#ffffff")';
  let value = m[1];
  if (value.length === 3) {
    value = value.split('').map(c => c + c).join('');
  }
  return `rgb("#${value.toLowerCase()}")`;
}

interface RuleCtx {
  /** Resolves a colour slot to a Typst expression. */
  color: (slot: keyof StyleColors) => string;
  /** Resolves a font slot to a Typst expression (always a literal). */
  font: (slot: keyof StyleFonts) => string;
  /** Section scope skips document-level concerns (heading numbering). */
  forSection: boolean;
}

/**
 * Emits the typography / heading / block-element rules shared by the document
 * `apply-style` and each per-chapter section style. Page geometry and running
 * heads are NOT emitted here — they stay document-level. `ctx.color` resolves a
 * slot to either the module-level `style-colors` dict (document scope, so a
 * palette swap re-themes) or an inlined literal (section scope, from the merged
 * overlay). Lines are pre-indented two spaces to sit inside the `{ … }` body.
 */
function emitCoreRules(style: ProjectStyle, ctx: RuleCtx): string[] {
  const out: string[] = [];
  const push = (s: string = '') => out.push(s);

  push(`  set text(font: ${ctx.font('body')}, size: ${style.scale.base}, fill: ${ctx.color('text')})`);

  const parProps: string[] = [`leading: ${style.scale.leading}`];
  if (style.scale.paragraphSpacing.trim()) parProps.push(`spacing: ${style.scale.paragraphSpacing.trim()}`);
  if (style.scale.firstLineIndent.trim()) parProps.push(`first-line-indent: ${style.scale.firstLineIndent.trim()}`);
  push(`  set par(${parProps.join(', ')})`);

  push(`  show raw: set text(font: ${ctx.font('code')})`);
  push();

  if (!ctx.forSection && style.headings.numbering.trim()) {
    push(`  set heading(numbering: "${escapeQuotedString(style.headings.numbering)}")`);
  }

  HEADING_LEVELS.forEach((levelName, idx) => {
    const level = idx + 1;
    const h = style.headings[levelName];
    push(`  show heading.where(level: ${level}): set text(font: ${ctx.font('heading')}, size: ${h.size}, weight: "${h.weight}", fill: ${ctx.color(h.color)})`);
    push(`  show heading.where(level: ${level}): it => block(above: ${h.marginTop}, it)`);
  });
  push();

  const e = style.elements;
  {
    const b = e.blockquote;
    const italicStyle = b.italic ? `, style: "italic"` : '';
    push(`  show quote.where(block: true): it => block(stroke: (left: ${b.borderWidth} + ${ctx.color(b.borderColor)}), inset: (left: ${b.paddingLeft}, top: 0.4em, bottom: 0.4em), text(fill: ${ctx.color(b.textColor)}${italicStyle}, it.body))`);
  }
  {
    const c = e.codeBlock;
    const fillProp = c.background.trim() ? `, fill: ${c.background.trim()}` : '';
    const radiusProp = c.borderRadius.trim() ? `, radius: ${c.borderRadius.trim()}` : '';
    const insetProp = (c.paddingX.trim() || c.paddingY.trim())
      ? `, inset: (x: ${c.paddingX.trim() || '0pt'}, y: ${c.paddingY.trim() || '0pt'})`
      : '';
    push(`  show raw.where(block: true): it => block(width: 100%${fillProp}${radiusProp}${insetProp}, it)`);
  }
  {
    const f = e.figure;
    const sepLiteral = `"${escapeQuotedString(f.captionSeparator)}"`;
    push(`  set figure.caption(position: ${f.captionPosition}, separator: ${sepLiteral})`);
    push(`  show figure.caption: it => align(${f.captionAlign}, text(size: ${f.captionSize}, fill: ${ctx.color(f.captionColor)}, it))`);
  }
  {
    const t = e.table;
    const stroke = `0.5pt + ${ctx.color(t.borderColor)}`;
    if (t.alternateRowFill) {
      push(`  set table(stroke: ${stroke}, inset: ${t.cellPadding}, fill: (col, row) => if row == 0 { ${ctx.color(t.headerBackground)} } else if calc.rem(row, 2) == 0 { ${ctx.color('muted')}.lighten(85%) } else { none })`);
    } else {
      push(`  set table(stroke: ${stroke}, inset: ${t.cellPadding}, fill: (col, row) => if row == 0 { ${ctx.color(t.headerBackground)} } else { none })`);
    }
    push(`  show table.cell.where(y: 0): it => text(fill: ${ctx.color(t.headerTextColor)}, weight: "bold", it.body)`);
  }
  push();

  return out;
}

/**
 * Deep-merges a section overlay onto the base style, producing a full
 * ProjectStyle whose values feed {@link emitCoreRules} for that section's
 * `#let <id>-style(body)` function. Only the overridable knobs are applied;
 * page geometry / running heads / custom code stay as the base.
 */
export function mergeSectionStyle(base: ProjectStyle, s: SectionStyle): ProjectStyle {
  const m: ProjectStyle = JSON.parse(JSON.stringify(base));
  Object.assign(m.colors, s.colors);
  Object.assign(m.fonts, s.fonts);
  if (s.scaleBase) m.scale.base = s.scaleBase;
  if (s.scaleLeading) m.scale.leading = s.scaleLeading;
  if (s.columns >= 1) m.layout.columns = s.columns;
  for (const lvl of HEADING_LEVELS) {
    const ov = s.headings[lvl];
    if (!ov) continue;
    if (ov.size !== undefined) m.headings[lvl].size = ov.size;
    if (ov.weight !== undefined) m.headings[lvl].weight = ov.weight;
    if (ov.color !== undefined) m.headings[lvl].color = ov.color;
    if (ov.marginTop !== undefined) m.headings[lvl].marginTop = ov.marginTop;
  }
  return m;
}

export function generateStyleTypst(style: ProjectStyle): string {
  // Module-level lines (palette + apply-style function definition).
  const lines: string[] = [];
  const push = (s: string = '') => lines.push(s);

  push(STYLE_TYPST_MARKER);
  push('//');
  push('// Generated by vswrite. Values live in `.vswrite/style.json` and can');
  push('// be edited via the Design sidebar tab. Manual edits to the fenced');
  push('// `vswrite:custom` block at the bottom of `apply-style` are preserved');
  push('// across regenerations.');
  push('//');
  push('// Usage from main.typ:');
  push('//   #import "style.typ": *');
  push('//   #show: apply-style');
  push('//');
  push('// `#import` brings `style-colors` into scope so body content can');
  push('// reference the palette directly; `#show: apply-style` applies all');
  push('// the generated set/show rules to the rest of the document.');
  push();

  // ─── Palette (module level so importers can use it directly) ───
  push('#let style-colors = (');
  push(`  primary:    ${colorLiteral(style.colors.primary)},`);
  push(`  accent:     ${colorLiteral(style.colors.accent)},`);
  push(`  text:       ${colorLiteral(style.colors.text)},`);
  push(`  background: ${colorLiteral(style.colors.background)},`);
  push(`  muted:      ${colorLiteral(style.colors.muted)},`);
  push(')');
  push();

  // ─── Font slots (module level — design elements reference these so
  // they pick up the project's typography without baking font names in) ──
  push('#let style-fonts = (');
  push(`  body:    ${fontLiteral(style.fonts.body)},`);
  push(`  heading: ${fontLiteral(style.fonts.heading)},`);
  push(`  code:    ${fontLiteral(style.fonts.code)},`);
  push(')');
  push();

  // ─── figure-caption-credit helper (module level so chapter files that
  // #import it via "style.typ" can use it). Concatenates a caption with
  // a styled photographer / source credit. Uses the configured separator
  // + label so renaming "Photo:" to "By " is a one-line style edit.
  {
    const f = style.elements.figure;
    push(`#let _credit-sep   = "${escapeQuotedString(f.creditSeparator)}"`);
    push(`#let _credit-label = "${escapeQuotedString(f.creditLabel)}"`);
    push('#let figure-caption-credit(caption, credit) = [#caption#text(style: "italic", fill: style-colors.' + f.captionColor + ')[#_credit-sep#_credit-label#credit]]');
    push();
  }

  // ─── chapter-name() / section-name() helpers for per-chapter
  // running heads. Header / footer markup-strings can use
  // `{chapter}` / `{section}` and the generator substitutes them
  // with these calls. Implementation pattern: query all top-level
  // headings, filter to ones on or before the current page, take
  // the last one. Returns the heading's body or an empty content
  // block if there's no heading yet on this page or any prior page.
  push('#let chapter-name() = context {');
  push('  let here-loc = here()');
  push('  let chapters = query(heading.where(level: 1)).filter(it => it.location().page() <= here-loc.page())');
  push('  if chapters.len() > 0 { chapters.last().body } else { [] }');
  push('}');
  push('#let section-name() = context {');
  push('  let here-loc = here()');
  push('  let sections = query(heading.where(level: 2)).filter(it => it.location().page() <= here-loc.page())');
  push('  if sections.len() > 0 { sections.last().body } else { [] }');
  push('}');
  push();

  // ─── apply-style(body) — wraps the document with all the rules ──
  // In Typst, #set rules from an #include'd file do NOT propagate to the
  // includer's scope. The idiomatic way to apply a set of rules across a
  // whole document is `#show: apply-style` where apply-style is a function
  // that emits the rules and then renders `body`.
  push('#let apply-style(body) = {');

  const body: string[] = [];
  const bpush = (s: string = '') => body.push(s);

  // ─── Page ───
  const pageProps: string[] = [
    `paper: "${style.layout.paper}"`,
    `margin: ${style.layout.margin}`,
  ];
  if (style.layout.orientation === 'landscape') pageProps.push(`flipped: true`);
  if (style.layout.columns > 1) pageProps.push(`columns: ${style.layout.columns}`);
  if (style.layout.pageFill.trim()) {
    pageProps.push(`fill: ${style.layout.pageFill.trim()}`);
  } else {
    pageProps.push(`fill: style-colors.background`);
  }
  if (style.layout.pageNumbering.trim()) {
    pageProps.push(`numbering: "${escapeQuotedString(style.layout.pageNumbering)}"`);
  }
  if (style.layout.pageHeader.trim()) {
    pageProps.push(`header: [${substituteRunningHeadPlaceholders(style.layout.pageHeader)}]`);
  }
  if (style.layout.pageFooter.trim()) {
    pageProps.push(`footer: [${substituteRunningHeadPlaceholders(style.layout.pageFooter)}]`);
  }
  bpush(`  set page(${pageProps.join(', ')})`);

  // ─── Typography / headings / block elements ───
  // Document scope: colours reference the module-level `style-colors` dict so
  // a palette swap re-themes; fonts are inlined literals (as before).
  body.push(...emitCoreRules(style, {
    color: (slot) => `style-colors.${slot}`,
    font: (slot) => fontLiteral(style.fonts[slot]),
    forSection: false,
  }));

  // ─── Custom additions (escape-hatch) ─────────────────
  // Always emit the fenced block — even when empty — so future regenerations
  // can locate and preserve the user's manual additions in-place. Inside the
  // function body, `#` is not used (we're already in script mode).
  bpush(`  ${CUSTOM_BLOCK_START}`);
  if (style.custom?.preamble && style.custom.preamble.trim().length > 0) {
    // Strip leading `#` from `#set` / `#show` / `#import` etc. — inside the
    // function body we are in script mode, where # is reserved for content.
    // Lines that don't start with `#` (markup blocks, comments) pass through.
    const cleaned = style.custom.preamble
      .replace(/\r\n/g, '\n')
      .trimEnd()
      .split('\n')
      .map(line => {
        // Indent each line for readability inside apply-style.
        const indented = line.replace(/^/, '  ');
        // Strip a leading `#` ONLY for the script-mode keywords. Leave
        // `#import` lines alone so they still produce module references.
        return indented.replace(/^( +)#(set|show|let)\b/, '$1$2');
      })
      .join('\n');
    bpush(cleaned);
  }
  bpush(`  ${CUSTOM_BLOCK_END}`);
  bpush();

  // Finally render the body the user passed into apply-style.
  bpush(`  body`);

  lines.push(...body);
  push('}');
  push();

  // ─── Per-chapter section styles (Phase E) ───
  // Each is a module-level `#let <id>-style(body)` a chapter opts into via
  // `#import "../style.typ": <id>-style` + `#show: <id>-style`. The overlay is
  // merged onto the base and emitted with literal colours/fonts so the
  // override actually takes effect (a section rule can't reference
  // `style-colors`, which still holds the base palette).
  for (const section of style.sections) {
    const merged = mergeSectionStyle(style, section);
    push(`// Section style "${section.name}" — opt in from a chapter file with:`);
    push(`//   #import "../style.typ": ${section.id}-style`);
    push(`//   #show: ${section.id}-style`);
    push(`#let ${section.id}-style(body) = {`);
    if (section.columns >= 1) {
      push(`  set page(columns: ${section.columns})`);
    }
    for (const l of emitCoreRules(merged, {
      color: (slot) => colorLiteral(merged.colors[slot]),
      font: (slot) => fontLiteral(merged.fonts[slot]),
      forSection: true,
    })) {
      push(l);
    }
    push(`  body`);
    push('}');
    push();
  }

  return lines.join('\n');
}

/**
 * Extracts the user-editable custom-code block from an existing style.typ.
 * Returns the raw content between CUSTOM_BLOCK_START and CUSTOM_BLOCK_END,
 * or null if the file doesn't have the fence markers (older style.typ
 * versions, or a hand-written one).
 */
export function extractCustomBlock(styleTypstSource: string): string | null {
  const startIdx = styleTypstSource.indexOf(CUSTOM_BLOCK_START);
  if (startIdx === -1) return null;
  const endIdx = styleTypstSource.indexOf(CUSTOM_BLOCK_END, startIdx);
  if (endIdx === -1) return null;
  const sliced = styleTypstSource.slice(startIdx + CUSTOM_BLOCK_START.length, endIdx);
  // Strip leading + trailing newlines but preserve internal whitespace.
  return sliced.replace(/^\n+/, '').replace(/\n+$/, '');
}

/**
 * Scans the start of a Typst document for `#set text|page|par(...)` calls
 * that would override the rules from `style.typ`. Returns a list of human-
 * readable findings used by the migration warning dialog.
 *
 * Heuristic only: we stop scanning at the first non-preamble line (heading,
 * content) to avoid flagging legitimate inline rules inside the body.
 */
export function detectStylePreambleConflicts(rootFileContents: string): string[] {
  if (rootFileContents.includes(STYLE_APPLY_LINE) || rootFileContents.includes(STYLE_INCLUDE_LINE_LEGACY)) return [];

  const findings: string[] = [];
  const lines = rootFileContents.split(/\r?\n/);
  let braceDepth = 0;
  let i = 0;

  while (i < lines.length) {
    const raw = lines[i];
    const line = raw.trim();

    if (braceDepth > 0) {
      for (const ch of raw) {
        if (ch === '{' || ch === '(' || ch === '[') braceDepth++;
        if (ch === '}' || ch === ')' || ch === ']') braceDepth--;
      }
      i++;
      continue;
    }

    if (line === '' || line.startsWith('//')) { i++; continue; }

    if (
      line.startsWith('#set text(') ||
      line.startsWith('#set page(') ||
      line.startsWith('#set par(') ||
      line.startsWith('#set heading(') ||
      line.startsWith('#show heading')
    ) {
      findings.push(line.length > 80 ? line.slice(0, 77) + '…' : line);
      for (const ch of raw) {
        if (ch === '{' || ch === '(' || ch === '[') braceDepth++;
        if (ch === '}' || ch === ')' || ch === ']') braceDepth--;
      }
      i++;
      continue;
    }

    // Other preamble lines (#import / #let) — skip without flagging.
    if (line.startsWith('#import ') || line.startsWith('#let ') || line.startsWith('#set ') || line.startsWith('#show ')) {
      i++;
      continue;
    }

    // Reached body content — stop.
    break;
  }

  return findings;
}

/**
 * Returns root-file contents with `#import "style.typ": *` plus
 * `#show: apply-style` ensured at the top. If the apply line already
 * exists, returns the input unchanged.
 *
 * Migrates legacy projects that still have `#include "style.typ"` — that
 * line is replaced (in place) with the two-line import + show pair, so
 * users who opened a project pre-fix get it auto-upgraded on the next
 * style save.
 *
 * Skipped lines at the very top:
 *  - shebang-style comments (`// …`) — left alone, the lines go below them
 *  - blank lines — same
 */
export function ensureStyleInclude(rootFileContents: string): string {
  if (rootFileContents.includes(STYLE_APPLY_LINE)) return rootFileContents;

  // Migration path: if the legacy include line is present, swap it for the
  // import + show pair so existing projects fix themselves on next save.
  if (rootFileContents.includes(STYLE_INCLUDE_LINE_LEGACY)) {
    return rootFileContents.replace(
      STYLE_INCLUDE_LINE_LEGACY,
      `${STYLE_IMPORT_LINE}\n${STYLE_APPLY_LINE}`,
    );
  }

  const lines = rootFileContents.split(/\r?\n/);
  let insertAt = 0;
  while (insertAt < lines.length) {
    const t = lines[insertAt].trim();
    if (t === '' || t.startsWith('//')) { insertAt++; continue; }
    break;
  }

  const before = lines.slice(0, insertAt);
  const after = lines.slice(insertAt);
  const prefix = before.length > 0 && before[before.length - 1] !== '' ? [...before, ''] : before;
  const suffix = after.length > 0 && after[0] !== '' ? ['', ...after] : after;
  return [...prefix, STYLE_IMPORT_LINE, STYLE_APPLY_LINE, ...suffix].join('\n');
}
