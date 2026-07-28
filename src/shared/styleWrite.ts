/**
 * Style write planning — the SINGLE source for "where does the design live
 * and which bytes go where", shared by the Electron app and the MCP server.
 *
 * Before this module the two processes each had their own copy of the same
 * logic (`ipcHandlers.resolveStyleRootFile` + the `style:save` writes array
 * vs. `mcp/server.resolveDesignRootFile` + `writeProjectStyleAndRegenerate`).
 * They could — and did — disagree: the app fabricated a non-existent
 * `<dir>/main.typ` as its last resort while the MCP side returned null, and
 * only the app round-tripped a hand-edited custom block. Two writers, one
 * file, no shared guard.
 *
 * Everything here is electron-free and side-effect-free: `planStyleWrites`
 * only *computes* the writes. Whoever calls it decides how to apply them —
 * the app stages them through `safeApplyDesign` (compile-verify + rollback),
 * the MCP server writes them directly. That keeps the "what" identical even
 * while the "how" still differs.
 */

import * as fs from 'fs';
import * as path from 'path';
import { findRootFile, findRootFileIn } from './rootFinder';
import {
  STYLE_TYPST_MARKER,
  extractCustomBlock,
  ensureStyleInclude,
  generateStyleTypst,
} from './styleParser';
import { DEFAULT_PROJECT_STYLE, sanitizeProjectStyle, type ProjectStyle } from './styleTypes';

export const STYLE_TYP_BASENAME = 'style.typ';

/** `<project>/.penwright/style.json` — the design tokens. */
export function styleJsonPath(projectDir: string): string {
  return path.join(projectDir, '.penwright', 'style.json');
}

/**
 * The file document-wide design belongs to: a project-root candidate first
 * (so global style never lands in an open chapter), then the root of the
 * current file's `#include` chain.
 *
 * Returns `null` when neither resolves — deliberately. The previous app-side
 * version returned `<dir>/main.typ` here, a path that need not exist; writing
 * to it would create a `main.typ` that then *wins* `findRootFileIn` against
 * the project's real root (e.g. `Angebot.typ`) and permanently moves the
 * design home. Callers must handle null instead.
 */
export function resolveDesignRoot(projectDir: string, currentFile: string | null): string | null {
  const candidate = findRootFileIn(projectDir);
  if (candidate) return candidate;
  if (currentFile && fs.existsSync(currentFile)) return findRootFile(currentFile);
  return null;
}

/** Directory `style.typ` lives in: next to the design root, else the project. */
export function styleTypDir(projectDir: string, rootFile: string | null): string {
  return rootFile && fs.existsSync(rootFile) ? path.dirname(rootFile) : projectDir;
}

/**
 * True when a `style.typ` exists that Penwright did not generate.
 *
 * Generated files carry `STYLE_TYPST_MARKER` on line 1. Anything else is the
 * author's own design system — typically a hand-written file defining macros
 * (`#let cover(…)`, `#let insight(…)`) that the document calls. Regenerating
 * over it destroys both the look and every macro the content depends on.
 */
export function isHandwrittenStyle(styleTypSource: string | null): boolean {
  if (styleTypSource === null) return false;
  return styleTypSource.split('\n')[0].trim() !== STYLE_TYPST_MARKER;
}

/** Reads `style.typ` from disk, or null if absent/unreadable. */
function readStyleTyp(styleTypPath: string): string | null {
  try {
    return fs.existsSync(styleTypPath) ? fs.readFileSync(styleTypPath, 'utf-8') : null;
  } catch {
    return null;
  }
}

/**
 * The project's design tokens, with the fenced custom block backfilled from
 * `style.typ` when `style.json` doesn't carry it (someone hand-edited the
 * generated file between sessions). Without the backfill the next save would
 * silently drop those edits.
 */
export function readProjectStyleWithCustom(
  projectDir: string,
  currentFile: string | null,
): ProjectStyle {
  let style: ProjectStyle;
  const jsonPath = styleJsonPath(projectDir);
  try {
    style = fs.existsSync(jsonPath)
      ? sanitizeProjectStyle(JSON.parse(fs.readFileSync(jsonPath, 'utf-8')))
      : sanitizeProjectStyle(DEFAULT_PROJECT_STYLE);
  } catch {
    style = sanitizeProjectStyle(DEFAULT_PROJECT_STYLE);
  }

  if (!style.custom?.preamble) {
    const rootFile = resolveDesignRoot(projectDir, currentFile);
    const onDisk = readStyleTyp(path.join(styleTypDir(projectDir, rootFile), STYLE_TYP_BASENAME));
    if (onDisk !== null && !isHandwrittenStyle(onDisk)) {
      const extracted = extractCustomBlock(onDisk);
      if (extracted && extracted.trim().length > 0) style.custom = { preamble: extracted };
    }
  }

  return style;
}

export interface StyleWrite {
  abs: string;
  content: string;
}

export type StyleWritePlan =
  | {
      ok: true;
      /** style.json, style.typ, and (only when it changes) the root file. */
      writes: StyleWrite[];
      /** The sanitised style that these writes persist. */
      style: ProjectStyle;
      rootFile: string | null;
      styleTypPath: string;
    }
  | {
      ok: false;
      reason: 'handwritten-style';
      styleTypPath: string;
    };

/**
 * Computes every file write a design change implies — nothing is touched here.
 *
 * Refuses (`ok: false`) when the project carries a hand-written `style.typ`
 * and has no `style.json` beside it. That combination is unambiguous: the
 * author's design lives entirely in a file Penwright never wrote, and this
 * project has never been through the Design editor. Overwriting it is
 * unrecoverable in the common case (such projects usually have no Git and no
 * backups). Projects Penwright generated are unaffected — their `style.typ`
 * carries the marker.
 */
export function planStyleWrites(args: {
  projectDir: string;
  currentFile: string | null;
  style: unknown;
}): StyleWritePlan {
  const style = sanitizeProjectStyle(args.style);
  const rootFile = resolveDesignRoot(args.projectDir, args.currentFile);
  const styleTypPath = path.join(styleTypDir(args.projectDir, rootFile), STYLE_TYP_BASENAME);

  const onDisk = readStyleTyp(styleTypPath);
  if (isHandwrittenStyle(onDisk) && !fs.existsSync(styleJsonPath(args.projectDir))) {
    return { ok: false, reason: 'handwritten-style', styleTypPath };
  }

  const writes: StyleWrite[] = [
    { abs: styleJsonPath(args.projectDir), content: JSON.stringify(style, null, 2) },
    { abs: styleTypPath, content: generateStyleTypst(style) },
  ];

  if (rootFile && fs.existsSync(rootFile)) {
    try {
      const before = fs.readFileSync(rootFile, 'utf-8');
      const after = ensureStyleInclude(before);
      if (after !== before) writes.push({ abs: rootFile, content: after });
    } catch {
      // Root unreadable — style.json + style.typ still stand on their own.
    }
  }

  return { ok: true, writes, style, rootFile, styleTypPath };
}

/**
 * Human-readable reason for a refused plan. Kept here so the app and the MCP
 * server say the same thing; the app localises around it, the server ships
 * the English form to the agent.
 */
export function handwrittenStyleMessage(styleTypPath: string): string {
  return (
    `This project has a hand-written ${path.basename(styleTypPath)} that Penwright did not generate, ` +
    `and no .penwright/style.json beside it. Refusing to overwrite it — regenerating would destroy ` +
    `the author's design system (colours, fonts, and any #let macros the document calls). ` +
    `To manage this project's design with Penwright, rename ${path.basename(styleTypPath)} first.`
  );
}
