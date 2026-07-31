/**
 * Project-wide macro scanner — the catalogue of building blocks a project
 * defines for itself.
 *
 * The 24 shipped design elements are a fixed list we wrote. A real project —
 * and above all a project an AI has designed — invents its own: `#modul`,
 * `#box-choice`, `#herohead`, `#sumrow`. Today those are invisible to every
 * insertion surface in the app, so a building block the AI built for this very
 * document cannot be inserted from the UI at all.
 *
 * The catalogue is DERIVED, not declared. A `#let` with a parameter list is a
 * building block; its signature is the form. Requiring the AI to register
 * anything would leave the catalogue empty on every project that already
 * exists — `#modul` and `#box-choice` sit undeclared in a client project right
 * now. A `//` comment directly above the definition becomes the label if one
 * happens to be there, and that is the whole of the opt-in.
 *
 * ── Visibility is PER FILE, and that is load-bearing ────────────────────────
 *
 * Proven against the bundled compiler: `#import "macros.typ": *` in the ROOT
 * does not reach an `#include`d chapter — the chapter gets
 * `error: unknown variable`. A project-wide catalogue would therefore offer a
 * chapter every macro in the project and NONE of them would compile there.
 *
 * Star imports DO re-export transitively (also measured): a chapter importing
 * `../style.typ` sees what `style.typ` itself star-imported. So visibility
 * follows the import graph rather than a single hop.
 */

import * as fs from 'fs';
import * as path from 'path';
import { appState } from './appState';
import { isPathWithin } from './pathSecurity';
import {
  matchTypstDelim,
  splitTypstList,
  BODY_PARAM,
  PATH_PARAM,
  type MacroParam,
  type ProjectMacro,
  type ProjectMacroResults,
} from '../shared/macroCall';

export type { MacroParam, ProjectMacro, ProjectMacroResults };
export { buildMacroCall, macroSignature } from '../shared/macroCall';

const IGNORED_DIRS = new Set([
  '.git', '.penwright', 'node_modules', 'dist', 'build', 'assets', 'sources', 'comments',
]);

const MAX_MACROS = 500;
const MAX_IMPORT_DEPTH = 6;

/**
 * Entry points that are applied with `#show:`, not inserted. Offering
 * `apply-style` as an insertable block would put a second document-wide show
 * rule in the middle of a chapter — the exact corruption `resolveStyleRootFile`
 * exists to prevent.
 */
const NOT_INSERTABLE = /^(apply-style|.*-style)$/;

function walkTypFiles(root: string, projectRoot: string, depth = 0): string[] {
  if (depth > 6) return [];
  const out: string[] = [];
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(root, { withFileTypes: true });
  } catch {
    return [];
  }
  for (const entry of entries) {
    if (IGNORED_DIRS.has(entry.name)) continue;
    if (entry.name.startsWith('.')) continue;
    const full = path.join(root, entry.name);
    // A symlink can point anywhere. `isPathWithin` is realpath-based, so it is
    // the only check that catches one — and without it a `link.typ` pointing
    // outside the project had its `#let`s listed in the insert menu and returned
    // by the MCP tool, comment and all. CLAUDE.md requires this of every
    // file-touching path; the walk is one.
    if (!isPathWithin(full, projectRoot)) continue;
    if (entry.isDirectory()) out.push(...walkTypFiles(full, projectRoot, depth + 1));
    else if (entry.name.toLowerCase().endsWith('.typ')) out.push(full);
  }
  return out;
}

function readContent(absPath: string): string | null {
  try {
    if (
      appState.currentFilePath &&
      path.resolve(absPath) === path.resolve(appState.currentFilePath)
    ) {
      return appState.currentContent;
    }
    return fs.readFileSync(absPath, 'utf-8');
  } catch {
    return null;
  }
}

/**
 * The parameters of a `#let name(…)` signature.
 *
 * Uses the SHARED mode-aware splitter rather than a second hand-written one.
 * The local `readParenGroup`/`splitTopLevel` pair did not know about comments,
 * so `#let modul(nr, // die laufende Nummer\n titel, body)` reported the
 * parameters as `nr, body` — `titel` silently deleted — and every call the
 * catalogue then offered was missing an argument. Two scanners for one job is
 * how that happens; `deserializer.ts` grew seven of them before this repo
 * stopped counting.
 */
function parseParams(inner: string): MacroParam[] {
  const out: MacroParam[] = [];
  const parts = splitTypstList(`(${inner})`);
  if (!parts) return out;
  for (const range of parts) {
    const part = `(${inner})`.slice(range.start, range.end).trim();
    if (!part || part.startsWith('..')) continue;           // argument sink
    const named = part.match(/^([\p{L}_][\p{L}\p{N}_-]*)\s*:\s*([\s\S]+)$/u);
    if (named) {
      out.push({ name: named[1], defaultValue: named[2].trim(), isPath: PATH_PARAM.test(named[1]) });
      continue;
    }
    const positional = part.match(/^([\p{L}_][\p{L}\p{N}_-]*)$/u);
    if (positional) {
      out.push({ name: positional[1], defaultValue: null, isPath: PATH_PARAM.test(positional[1]) });
    }
  }
  return out;
}

/**
 * The `//` comment block directly above a definition becomes its label.
 *
 * These comments are written for a human reading the source, so they carry the
 * source's decoration: `// ── Titelseite ─────────────` is a section rule with a
 * name in it, and the first sentence is the description — the rest is detail
 * that would not fit a menu row anyway.
 */
function labelAbove(lines: string[], defLineIdx: number): string {
  const collected: string[] = [];
  for (let i = defLineIdx - 1; i >= 0; i--) {
    const t = lines[i].trim();
    if (t === '' || !t.startsWith('//')) break;
    const text = t.replace(/^\/+\s?/, '').replace(/^[─—–\-=*_·.\s]+|[─—–\-=*_·.\s]+$/g, '').trim();
    if (!text) break;                       // a pure rule ends the block
    collected.unshift(text);
  }
  const joined = collected.join(' ').replace(/\s+/g, ' ').trim();
  // First sentence, and never a word cut in half.
  const sentence = joined.match(/^[^.!?]{3,}?[.!?](?=\s|$)/)?.[0] ?? joined;
  if (sentence.length <= 90) return sentence;
  const cut = sentence.slice(0, 90);
  return `${cut.slice(0, cut.lastIndexOf(' ')) || cut}…`;
}

interface ImportEdge {
  /** Absolute path of the imported file. */
  target: string;
  /** '*' for a star import, otherwise the explicitly named bindings. */
  names: '*' | Set<string>;
}

interface MacroIndex {
  defs: Map<string, ProjectMacro[]>;
  imports: Map<string, ImportEdge[]>;
}

const IMPORT_RE = /^#import\s+"([^"]+)"\s*(?::\s*([^\n]*))?/;

/** Parses one file's module-level `#let` functions and `#import` edges. */
function indexFile(filePath: string, root: string, content: string): {
  macros: ProjectMacro[];
  imports: ImportEdge[];
} {
  const lines = content.split('\n');
  const macros: ProjectMacro[] = [];
  const imports: ImportEdge[] = [];
  const relPath = path.relative(root, filePath).replace(/\\/g, '/');
  const dir = path.dirname(filePath);

  // Offsets so a definition's parameter list can be read across lines.
  const lineStart: number[] = [];
  let acc = 0;
  for (const l of lines) { lineStart.push(acc); acc += l.length + 1; }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const imp = line.match(IMPORT_RE);
    if (imp) {
      const spec = imp[1];
      // Only project-local files; `@preview/…` packages are not ours to offer.
      if (!spec.startsWith('@')) {
        const target = path.resolve(dir, spec);
        // `#import "../../elsewhere.typ"` resolves fine on disk and would pull a
        // file from outside the project into the catalogue.
        if (!isPathWithin(target, root)) continue;
        const namesPart = (imp[2] ?? '').trim();
        if (namesPart === '*') imports.push({ target, names: '*' });
        else if (namesPart) {
          const names = new Set(
            namesPart.split(',').map(s => s.trim().split(/\s+as\s+/)[0].trim()).filter(Boolean),
          );
          if (names.size) imports.push({ target, names });
        }
      }
      continue;
    }

    // Module level only: a `#let` indented inside a function body is not
    // exported, so it must not reach the catalogue.
    const def = line.match(/^#let\s+([\p{L}_][\p{L}\p{N}_-]*)\s*\(/u);
    if (!def) continue;
    const name = def[1];
    if (name.startsWith('_') || NOT_INSERTABLE.test(name)) continue;

    const openAt = lineStart[i] + line.indexOf('(', def[0].length - 1);
    const close = matchTypstDelim(content, openAt);
    if (close === -1) continue;             // a signature still being typed

    const params = parseParams(content.slice(openAt + 1, close));
    const body = params.find(p => p.defaultValue === null && BODY_PARAM.test(p.name));
    macros.push({
      name,
      params,
      bodyParam: body ? body.name : null,
      label: labelAbove(lines, i),
      filePath,
      relPath,
      line: i + 1,
    });
  }

  return { macros, imports };
}

function buildIndex(root: string): MacroIndex {
  const defs = new Map<string, ProjectMacro[]>();
  const imports = new Map<string, ImportEdge[]>();
  for (const filePath of walkTypFiles(root, root)) {
    const content = readContent(filePath);
    if (!content) continue;
    const r = indexFile(filePath, root, content);
    defs.set(path.resolve(filePath), r.macros);
    imports.set(path.resolve(filePath), r.imports);
  }
  return { defs, imports };
}

/**
 * The macros callable in `targetFile`: everything it defines itself, plus what
 * it imports, transitively through star imports.
 *
 * A named import narrows what its module contributes — and keeps narrowing
 * through that module's own imports, which is what `#import "style.typ": modul`
 * means when `modul` actually lives in `macros.typ`.
 */
export function visibleIn(index: MacroIndex, targetFile: string): ProjectMacro[] {
  const out: ProjectMacro[] = [];
  const seenKeys = new Set<string>();
  const seenMacros = new Set<string>();

  const visit = (file: string, allowed: Set<string> | null, depth: number): void => {
    const abs = path.resolve(file);
    const key = `${abs} ${allowed ? [...allowed].sort().join(',') : '*'}`;
    if (depth > MAX_IMPORT_DEPTH || seenKeys.has(key)) return;
    seenKeys.add(key);

    for (const m of index.defs.get(abs) ?? []) {
      if (allowed && !allowed.has(m.name)) continue;
      const id = `${m.name} ${m.filePath}`;
      if (seenMacros.has(id)) continue;
      seenMacros.add(id);
      out.push(m);
    }

    for (const edge of index.imports.get(abs) ?? []) {
      const next = edge.names === '*'
        ? allowed
        : allowed
          ? new Set([...edge.names].filter(n => allowed.has(n)))
          : edge.names;
      if (next && next.size === 0) continue;
      visit(edge.target, next, depth + 1);
    }
  };

  visit(targetFile, null, 0);
  return out;
}

/**
 * The building blocks this project defines.
 *
 * With `targetFile`, only what is actually callable there — which is what any
 * insertion surface must offer, because the alternative is offering macros that
 * do not compile at the cursor. Without it, everything in the project, for
 * discovery ("what did the AI build for this document?").
 */
export function listProjectMacros(
  projectDir?: string | null,
  targetFile?: string | null,
): ProjectMacroResults {
  const root = projectDir ?? appState.projectDir;
  if (!root || !isPathWithin(root, root)) return { macros: [], truncated: false };

  const index = buildIndex(root);

  let macros: ProjectMacro[];
  if (targetFile) {
    // A targetFile outside the project used to fall through to the
    // whole-project branch, which answered a question nobody asked with more
    // than was requested. Out of bounds is an empty answer, not a wider one.
    macros = isPathWithin(targetFile, root) ? visibleIn(index, targetFile) : [];
  } else {
    macros = [];
    const seen = new Set<string>();
    for (const list of index.defs.values()) {
      for (const m of list) {
        const id = `${m.name} ${m.filePath}`;
        if (seen.has(id)) continue;
        seen.add(id);
        macros.push(m);
      }
    }
  }

  macros.sort((a, b) => a.name.localeCompare(b.name));
  const truncated = macros.length > MAX_MACROS;
  return { macros: truncated ? macros.slice(0, MAX_MACROS) : macros, truncated };
}

/** Exposed for the tests and for callers that want to reuse one index. */
export function buildMacroIndex(root: string): MacroIndex {
  return buildIndex(root);
}

