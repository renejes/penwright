/**
 * One answer to "which file IS the document?", and one implementation of the
 * three operations that depend on it.
 *
 * The parity audit found the same defect three times over, in three places,
 * each fixed on its own and each fixed differently: **the app asks "which file
 * is open?" where the MCP asks "which file is the root?"**. Document settings
 * landed in a chapter. `add_chapter` appended an `#include` to whatever the
 * user happened to be reading, making the new chapter invisible to
 * `get_chapters` and to the export dialog while still compiling — silent drift.
 * Two of the six MCP chapter tools were left on the wrong helper because a plan
 * deferred them to a phase that was later cancelled.
 *
 * Point-fixing that a fourth time would have been the wrong shape. The question
 * belongs in one place:
 *
 *   resolveDocumentRoot()  — which file is the document
 *   parseChapters()        — what chapters does it have
 *   planAddChapter()       — add one
 *   planRemoveChapter()    — unlink one
 *   planReorderChapters()  — reorder them
 *
 * The `plan*` functions are pure: they return the writes and touch nothing.
 * The app stages them (so the open buffer stays in step); the MCP writes them
 * through its guard. Same target file, same bytes, from either side.
 *
 * Every planner returns a discriminated result rather than throwing, because
 * "there is nothing to reorder" is an ANSWER, not an exception — and reporting
 * a structural change that did not happen is exactly what `reorder_chapters`
 * used to do.
 */

import * as fs from 'fs';
import * as path from 'path';
import { findRootFile, findRootFileIn } from './rootFinder';

/** A single `#include "…"` in the document, with the line it sits on. */
export interface ChapterEntry {
  /** Path exactly as written in the source, e.g. "chapters/01-intro.typ". */
  relPath: string;
  /** 0-based line index in the root file. */
  line: number;
  /** The full source line, preserved verbatim on reorder. */
  raw: string;
}

export interface DocumentWrite {
  abs: string;
  content: string;
}

/**
 * The file a document-level operation belongs to.
 *
 * Two stages, and `null` is a hard answer rather than a fallback:
 *   1. a root-looking file at the project's top level
 *   2. the root of the current file's `#include` chain
 *
 * **Never invent `<dir>/main.typ`.** Writing to a fabricated path creates a
 * file that then WINS stage 1 against the project's real root — `Angebot.typ`,
 * `Sichtbarkeitskonzept.typ` — and moves the document's home permanently.
 * `findRootFileIn` returns null for any root not named main/document/index,
 * which is the normal case for a hand-made project, so stage 2 carries real
 * weight and stage 1 must not be faked to avoid reaching it.
 */
export function resolveDocumentRoot(projectDir: string | null, currentFile: string | null): string | null {
  if (projectDir) {
    const candidate = findRootFileIn(projectDir);
    if (candidate && fs.existsSync(candidate)) return candidate;
  }
  if (currentFile && fs.existsSync(currentFile)) {
    const climbed = findRootFile(currentFile);
    if (climbed && fs.existsSync(climbed)) return climbed;
  }
  return null;
}

/** Human-readable reason, so both sides refuse in the same words. */
export function noDocumentRootMessage(projectDir: string | null): string {
  const name = projectDir ? path.basename(projectDir) : 'this folder';
  return (
    `Could not identify the root document of ${name}. A root is a .typ file at the project's top level ` +
    `that the others are #included from. Open one first — this operation changes the document as a ` +
    `whole and must not guess which file that is.`
  );
}

/**
 * Matches a real include line and nothing else.
 *
 * Anchored deliberately. `remove_chapter` used to test `line.includes('"' +
 * path + '"')`, which deleted any line merely MENTIONING the path — a comment,
 * an `#figure(image("…"))`, a sentence quoting the filename — while reporting
 * that a chapter had been unlinked.
 */
const INCLUDE_RE = /^\s*#include\s+"([^"]+)"\s*$/;

export function parseChapters(rootContent: string): ChapterEntry[] {
  const out: ChapterEntry[] = [];
  const lines = rootContent.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(INCLUDE_RE);
    if (m) out.push({ relPath: m[1], line: i, raw: lines[i] });
  }
  return out;
}

export type PlanResult<T> =
  | ({ ok: true } & T)
  | { ok: false; reason: string };

/** POSIX-separated path from the root's directory to `abs`. */
export function relativeToRoot(rootFile: string, abs: string): string {
  return path.relative(path.dirname(rootFile), abs).split(path.sep).join('/');
}

/** `chapters/03-my-title.typ` from a human title, with the usual slug rules. */
export function chapterFileName(title: string): string {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'chapter';
  return `${slug}.typ`;
}

export interface AddChapterArgs {
  rootFile: string;
  rootContent: string;
  /** Absolute path of the chapter file. Callers that only have a title use
   *  `chapterFileName` against `<rootDir>/chapters/`. */
  chapterAbs: string;
  /** Body for a chapter file that does not exist yet. */
  initialContent?: string;
  /** 0-based position among the existing includes. Appended when omitted. */
  position?: number;
}

/**
 * Adds a chapter: creates the file if missing, and puts the `#include` in the
 * ROOT — never in whatever file is open.
 */
export function planAddChapter(args: AddChapterArgs): PlanResult<{
  writes: DocumentWrite[];
  relPath: string;
  created: boolean;
}> {
  const relPath = relativeToRoot(args.rootFile, args.chapterAbs);
  if (relPath.startsWith('..')) {
    return { ok: false, reason: `${relPath} is outside the document's directory; Typst cannot #include it.` };
  }

  const existing = parseChapters(args.rootContent);
  if (existing.some(c => c.relPath === relPath)) {
    return { ok: false, reason: `${relPath} is already included in ${path.basename(args.rootFile)}.` };
  }

  const writes: DocumentWrite[] = [];
  const created = !fs.existsSync(args.chapterAbs);
  if (created) {
    writes.push({ abs: args.chapterAbs, content: args.initialContent ?? '' });
  }

  const lines = args.rootContent.split('\n');
  const includeLine = `#include "${relPath}"`;

  if (existing.length === 0) {
    // No includes yet: append, keeping exactly one trailing newline.
    const body = args.rootContent.replace(/\s*$/, '');
    writes.push({ abs: args.rootFile, content: `${body}\n\n${includeLine}\n` });
  } else {
    const at = args.position !== undefined && args.position >= 0 && args.position < existing.length
      ? existing[args.position].line
      : existing[existing.length - 1].line + 1;
    lines.splice(at, 0, includeLine);
    writes.push({ abs: args.rootFile, content: lines.join('\n') });
  }

  return { ok: true, writes, relPath, created };
}

/**
 * Removes a chapter's `#include` from the root. Never deletes the chapter file
 * — the text stays on disk and can be included again.
 */
export function planRemoveChapter(args: {
  rootFile: string;
  rootContent: string;
  relPath: string;
}): PlanResult<{ writes: DocumentWrite[] }> {
  const chapters = parseChapters(args.rootContent);
  const target = chapters.find(c => c.relPath === args.relPath);
  if (!target) {
    const known = chapters.map(c => c.relPath).join(', ') || 'none';
    return { ok: false, reason: `No #include for "${args.relPath}" in ${path.basename(args.rootFile)}. Included: ${known}.` };
  }
  const lines = args.rootContent.split('\n');
  lines.splice(target.line, 1);
  return { ok: true, writes: [{ abs: args.rootFile, content: lines.join('\n') }] };
}

/**
 * Reorders the `#include` lines to match `order`.
 *
 * Two rules that were learned the hard way:
 *   - Chapters the caller did not mention are NEVER dropped. A partial order
 *     ("move one to the front") used to delete every unlisted include.
 *   - A document with no includes is refused, not silently rewritten. The old
 *     version found nothing, changed nothing, wrote the file anyway and
 *     announced "Reordered 5 chapters".
 */
export function planReorderChapters(args: {
  rootFile: string;
  rootContent: string;
  order: string[];
}): PlanResult<{ writes: DocumentWrite[]; order: string[] }> {
  const chapters = parseChapters(args.rootContent);
  if (chapters.length === 0) {
    return {
      ok: false,
      reason: `${path.basename(args.rootFile)} contains no #include lines, so there is no chapter order to change. This may be a single-file document.`,
    };
  }

  const unknown = args.order.filter(p => !chapters.some(c => c.relPath === p));
  if (unknown.length > 0) {
    return {
      ok: false,
      reason: `Not included in ${path.basename(args.rootFile)}: ${unknown.join(', ')}. Included: ${chapters.map(c => c.relPath).join(', ')}.`,
    };
  }

  const byPath = new Map(chapters.map(c => [c.relPath, c]));
  const ordered: ChapterEntry[] = [];
  for (const p of args.order) {
    const c = byPath.get(p);
    if (c && !ordered.includes(c)) ordered.push(c);
  }
  // Unlisted chapters keep their original relative order, after the ordered ones.
  for (const c of chapters) if (!ordered.includes(c)) ordered.push(c);

  const lines = args.rootContent.split('\n');
  // Write the reordered raw lines back into the SAME line slots, so anything
  // interleaved between includes (comments, spacing, `#pagebreak()`) stays put.
  const slots = chapters.map(c => c.line);
  for (let i = 0; i < slots.length; i++) lines[slots[i]] = ordered[i].raw;

  return { ok: true, writes: [{ abs: args.rootFile, content: lines.join('\n') }], order: ordered.map(c => c.relPath) };
}
