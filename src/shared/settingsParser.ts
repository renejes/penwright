/**
 * Parses and generates Typst #set blocks for document settings.
 *
 * **Scope after the Design-Editor consolidation (Session 22):** this module
 * now only manages settings that aren't part of the Design panel's
 * `style.json` flow. The structured typography / layout knobs (font, size,
 * paper, margin, columns, leading, paragraph-spacing, first-line-indent,
 * heading-numbering, page-numbering / header / footer / fill) live in the
 * Design panel and are written into `<project>/style.typ` via the
 * styleParser. Document Settings keeps:
 *
 *   - `lang`           — spell-check + Typst hyphenation language tag
 *   - `bibliographyStyle` — citation style passed to `#bibliography(style: ...)`
 *
 * Both are document-specific (not project-wide design tokens), so they
 * belong inline in `main.typ` rather than in `style.typ`. The legacy
 * applyStyleTemplate / styleTemplates path (used by the MCP tools) still
 * round-trips the wider field set, so the parser keeps reading those too;
 * the active UI just no longer surfaces them.
 */

export interface DocumentSettings {
  /** Document language tag — drives Typst hyphenation + Electron spell-check. */
  lang: string;
  /** Citation style for `#bibliography(style: "...")`. */
  bibliographyStyle: string;
}

export const DEFAULT_SETTINGS: DocumentSettings = {
  lang: '',
  bibliographyStyle: '',
};

/**
 * Parse #set blocks from Typst source text and extract document settings.
 *
 * Only `lang` (from `#set text(...)`) and the bibliography style (from
 * `#bibliography(..., style: "...")`) are read into the current schema.
 * Other historic fields (font, size, page, par, heading) are now managed
 * by the Design panel via `style.json` / `style.typ`, so we don't bother
 * round-tripping them through this parser anymore — manual edits in those
 * blocks are out of scope here.
 */
export function parseSettings(text: string): DocumentSettings {
  const settings: DocumentSettings = { ...DEFAULT_SETTINGS };

  // Match #set text(...) — may span multiple lines. We only pull `lang` now.
  const textMatch = text.match(/#set\s+text\s*\(([^)]*)\)/);
  if (textMatch) {
    settings.lang = extractStringArg(textMatch[1], 'lang') || '';
  }

  // Match #bibliography(..., style: "...")
  const bibStyleMatch = text.match(/#bibliography\s*\([^)]*style\s*:\s*"([^"]*)"[^)]*\)/);
  if (bibStyleMatch) {
    settings.bibliographyStyle = bibStyleMatch[1];
  }

  return settings;
}

/**
 * Generate #set block lines from settings. Only non-empty values are
 * included. Currently this produces at most a single `#set text(lang: "...")`
 * line — heading / paragraph / page styling moved to the Design panel.
 */
export function generateSetBlocks(settings: DocumentSettings): string {
  const lines: string[] = [];
  if (settings.lang) {
    lines.push(`#set text(lang: "${settings.lang}")`);
  }
  return lines.join('\n');
}

/**
 * Update #set blocks in an existing document. After consolidation this only
 * touches the inline `#set text(lang: …)` line — everything else has moved
 * to the Design panel's `style.typ` pipeline. We deliberately do NOT strip
 * `#set page` / `#set par` / `#set heading` blocks anymore so legacy
 * documents and the legacy `applyStyleTemplate` MCP path don't lose their
 * styling when the user opens Document Settings.
 */
export function applySettings(
  text: string,
  settings: DocumentSettings,
): string {
  const newBlocks = generateSetBlocks(settings);

  let result = text;
  // Drop any existing `#set text(...)` line so we can re-emit a clean
  // single-arg version. We can do this with a flat regex because text()
  // doesn't accept bracket args.
  result = result.replace(/^#set\s+text\s*\([^)]*\)\s*\n?/gm, '');
  result = result.replace(/^\n+/, '');

  if (newBlocks) {
    result = newBlocks + '\n\n' + result;
  }

  // Update bibliography style if set
  if (settings.bibliographyStyle) {
    // Check if #bibliography exists in the result
    const bibRegex = /#bibliography\s*\(/;
    if (bibRegex.test(result)) {
      // Remove existing style parameter if present
      result = result.replace(
        /(#bibliography\s*\([^)]*?)(?:,\s*style\s*:\s*"[^"]*")([^)]*\))/,
        '$1$2',
      );
      // Add style parameter before closing paren
      result = result.replace(
        /(#bibliography\s*\()([^)]*?)(\s*\))/,
        (_, open, args, close) => {
          const trimmedArgs = args.trimEnd();
          const separator = trimmedArgs.endsWith(',') || !trimmedArgs ? '' : ',';
          return `${open}${trimmedArgs}${separator} style: "${settings.bibliographyStyle}"${close}`;
        },
      );
    }
  } else {
    // Remove style parameter if bibliographyStyle is empty
    result = result.replace(
      /(#bibliography\s*\([^)]*?),\s*style\s*:\s*"[^"]*"([^)]*\))/,
      '$1$2',
    );
  }

  return result;
}

// --- Helpers ---

function extractStringArg(args: string, key: string): string | null {
  const regex = new RegExp(`${key}\\s*:\\s*"([^"]*)"`, 'i');
  const match = args.match(regex);
  return match ? match[1] : null;
}
