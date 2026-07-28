/**
 * Where the bibliography lives, and where a new one belongs.
 *
 * Both processes answered these two questions differently, and both answers
 * were wrong in their own way:
 *
 *   Finding: the app searched three directories (project, root, open file),
 *   the MCP server only the project root. A .bib the app happily read was
 *   invisible to the agent, which then concluded there was none and created
 *   a second one.
 *
 *   Creating: the app put `references.bib` next to the OPEN file and wrote
 *   `#bibliography("references.bib")` into that same file — with a chapter
 *   open that yields `chapters/references.bib`, consistent in itself but
 *   invisible to everything else. The MCP put the file at the project root
 *   but wrote the `#bibliography` call into whatever file was current, so the
 *   relative path did not resolve and the document stopped compiling. Typst
 *   resolves such paths relative to the file containing the call.
 *
 * One rule, stated once: the bibliography belongs next to the design root, and
 * the `#bibliography` call belongs IN the root — never in a chapter. That is
 * the same rule `applyStyleTemplate` already enforces for style preambles, for
 * the same reason: an included file is not the document.
 */

import * as fs from 'fs';
import * as path from 'path';
import { resolveDesignRoot } from './styleWrite';

/** Mirrors projectSearch's ignore list so both walk the same project. */
const IGNORED_DIRS = new Set([
  '.git', '.penwright', 'node_modules', 'assets', 'exports', 'comments', '.claude',
]);

const MAX_DEPTH = 3;

/**
 * Every `.bib` in the project, nearest first.
 *
 * Searched: the project root, the design root's directory, the open file's
 * directory, and a bounded walk of the rest — so a `bib/` or `sources/` folder
 * is found too, which neither side managed before.
 */
export function findBibFiles(projectDir: string, currentFile: string | null): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  const addFrom = (dir: string): void => {
    let names: string[];
    try {
      names = fs.readdirSync(dir).filter(f => f.endsWith('.bib'));
    } catch {
      return;
    }
    for (const n of names.sort()) {
      const abs = path.join(dir, n);
      if (seen.has(abs)) continue;
      seen.add(abs);
      out.push(abs);
    }
  };

  // Nearest first: the places a human would look.
  addFrom(projectDir);
  const root = resolveDesignRoot(projectDir, currentFile);
  if (root) addFrom(path.dirname(root));
  if (currentFile) addFrom(path.dirname(currentFile));

  // Then the rest of the project, bounded.
  const walk = (dir: string, depth: number): void => {
    if (depth > MAX_DEPTH) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      if (e.name.startsWith('.') || IGNORED_DIRS.has(e.name)) continue;
      const sub = path.join(dir, e.name);
      addFrom(sub);
      walk(sub, depth + 1);
    }
  };
  walk(projectDir, 1);

  return out;
}

/** The directories `findBibFiles` looked at — so "none found" can be explained. */
export function bibSearchRoots(projectDir: string, currentFile: string | null): string[] {
  const root = resolveDesignRoot(projectDir, currentFile);
  return [...new Set([
    projectDir,
    ...(root ? [path.dirname(root)] : []),
    ...(currentFile ? [path.dirname(currentFile)] : []),
  ])];
}

export interface BibliographyPlan {
  /** Absolute path of the .bib to create or append to. */
  bibFile: string;
  /** True when it does not exist yet and has to be created with a header. */
  create: boolean;
  /**
   * The file that carries the `#bibliography(...)` call — always the root.
   * Null when the project has no resolvable root; the caller must then refuse
   * rather than write the call into a chapter.
   */
  callSite: string | null;
  /** The path string to put inside `#bibliography("…")`, relative to callSite. */
  callPath: string;
  /** True when callSite already contains a `#bibliography` call. */
  alreadyReferenced: boolean;
}

/**
 * Decides where a bibliography goes for this project.
 *
 * Prefers an existing `.bib` over creating another one — the most common cause
 * of a duplicate was one side not finding what the other had made.
 */
export function planBibliography(args: {
  projectDir: string;
  currentFile: string | null;
  /** Explicit target, e.g. from a tool argument. Relative to the project. */
  bibFileName?: string;
}): BibliographyPlan {
  const { projectDir, currentFile } = args;
  const root = resolveDesignRoot(projectDir, currentFile);
  const homeDir = root ? path.dirname(root) : projectDir;

  let bibFile: string;
  if (args.bibFileName) {
    bibFile = path.isAbsolute(args.bibFileName)
      ? args.bibFileName
      : path.join(projectDir, args.bibFileName);
  } else {
    const existing = findBibFiles(projectDir, currentFile);
    bibFile = existing[0] ?? path.join(homeDir, 'references.bib');
  }

  let alreadyReferenced = false;
  if (root) {
    try {
      alreadyReferenced = /#bibliography\s*\(/.test(fs.readFileSync(root, 'utf-8'));
    } catch { /* unreadable root — treat as not referenced */ }
  }

  return {
    bibFile,
    create: !fs.existsSync(bibFile),
    callSite: root,
    // Relative to the file that contains the call, because that is how Typst
    // resolves it — a project-relative string breaks as soon as the root is
    // not at the project root.
    callPath: path.relative(root ? path.dirname(root) : projectDir, bibFile)
      .split(path.sep).join('/'),
    alreadyReferenced,
  };
}

/** The header a freshly created .bib gets. One wording, both processes. */
export const BIB_HEADER = '// Bibliography\n\n';
