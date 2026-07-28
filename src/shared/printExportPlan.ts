/**
 * Staging a print-ready export, for both project shapes.
 *
 * There are two, and the difference matters more than it looks:
 *
 *   (a) A Design-Editor project — `.penwright/style.json` exists, so
 *       `style.typ` is GENERATED from those tokens. Regenerating it in print
 *       mode and repointing the import is lossless: nothing is lost because
 *       nothing there was authored by hand.
 *
 *   (b) A hand-designed project — no `style.json`. The whole look lives in a
 *       `style.typ` Penwright never wrote, usually with `#let` macros the
 *       content calls. Repointing the import here swaps the author's design
 *       for Penwright's DEFAULTS: either the compile dies on `unknown
 *       variable: cover`, or a generic-looking PDF goes to the print shop.
 *
 * The app knew this and branched. The MCP tool did not — it always took path
 * (a). Same class as the style-write divergence: one decision, two
 * implementations, one of them missing half the story.
 *
 * Pure planning, like `planStyleWrites`: this computes file contents and
 * returns them. Whoever calls it does the writing and the cleanup.
 */

import * as path from 'path';
import { generateStyleTypst } from './styleParser';
import { sanitizeProjectStyle, type ProjectStyle } from './styleTypes';

export const TEMP_EXPORT_BASENAME = '.penwright-export-temp.typ';
export const TEMP_STYLE_PRINT_BASENAME = '.penwright-style-print.typ';

export interface PrintSettings {
  bleed?: string;
  cropMarks?: boolean;
  facingPages?: boolean;
  binding?: string;
}

export interface PrintExportPlan {
  /** Absolute path of the temp root to compile. */
  tempRoot: string;
  /** Everything to write, in order. Delete all of these afterwards. */
  writes: { abs: string; content: string }[];
  /** Which branch was taken — worth reporting, since the results differ. */
  mode: 'tokens' | 'overlay';
  /**
   * Set when the caller asked for something this branch cannot deliver.
   * `buildPrintGeometryOverlay` only implements bleed and crop marks, so a
   * hand-designed project silently ignored facingPages and binding — the tool
   * reported success and produced a PDF without the gutter.
   */
  warnings: string[];
}

/**
 * @param rootContent  the (possibly chapter-filtered) root source to compile
 * @param originalRoot the root file's content as it is on disk — the branch
 *                     detection reads the ORIGINAL, because a filtered copy
 *                     may have had its import line rewritten already
 * @param buildOverlay injected so this module stays free of the overlay's
 *                     implementation; pass `buildPrintGeometryOverlay`
 * @param injectOverlay injected for the same reason; pass `injectAfterPrologue`
 */
export function planPrintExport(args: {
  rootFile: string;
  rootContent: string;
  originalRoot: string;
  print: PrintSettings;
  /** The project's design tokens, or null when it has no style.json. */
  style: ProjectStyle | null;
  buildOverlay: (rootFile: string, rootContent: string, print: { bleed?: string; cropMarks?: boolean }) => string | null;
  injectOverlay: (content: string, overlay: string) => string;
}): PrintExportPlan {
  const rootDir = path.dirname(args.rootFile);
  const tempRoot = path.join(rootDir, TEMP_EXPORT_BASENAME);
  const warnings: string[] = [];

  // (a) Tokens exist → regenerate style.typ in print mode, repoint the import.
  if (args.style) {
    const printStyle = sanitizeProjectStyle({
      ...args.style,
      layout: {
        ...args.style.layout,
        bleed: args.print.bleed,
        cropMarks: args.print.cropMarks,
        facingPages: args.print.facingPages,
        binding: args.print.binding,
      },
    });
    const stylePrintPath = path.join(rootDir, TEMP_STYLE_PRINT_BASENAME);

    const hadStyleImport = /#import\s+"style\.typ"/.test(args.originalRoot);
    let content = args.rootContent.replace(/#import\s+"style\.typ"/g, `#import "${TEMP_STYLE_PRINT_BASENAME}"`);
    if (!hadStyleImport && !content.includes('#show: apply-style')) {
      content = `#import "${TEMP_STYLE_PRINT_BASENAME}": *\n#show: apply-style\n\n${content}`;
    }

    return {
      tempRoot,
      mode: 'tokens',
      warnings,
      writes: [
        { abs: stylePrintPath, content: generateStyleTypst(printStyle, { print: true }) },
        { abs: tempRoot, content },
      ],
    };
  }

  // (b) Hand-designed → geometry overlay only, the design is untouched.
  const overlay = args.buildOverlay(args.rootFile, args.originalRoot, {
    bleed: args.print.bleed,
    cropMarks: args.print.cropMarks,
  });

  // Say what the overlay cannot do instead of reporting a success it did not
  // deliver. The overlay implements bleed and crop marks; a binding gutter
  // needs the token path.
  if (args.print.facingPages || (args.print.binding ?? '').trim()) {
    warnings.push(
      'facing pages / binding gutter are not applied to a hand-designed project — ' +
      'the geometry overlay only adds bleed and crop marks. Set up the design in ' +
      'Penwright (style.json) if you need a gutter.',
    );
  }
  if (!overlay && (args.print.bleed ?? '').trim()) {
    warnings.push('Could not read the document page setup, so no bleed was added.');
  }

  return {
    tempRoot,
    mode: 'overlay',
    warnings,
    writes: [{ abs: tempRoot, content: overlay ? args.injectOverlay(args.rootContent, overlay) : args.rootContent }],
  };
}
