/**
 * Project-wide Search & Replace.
 *
 * Walks every .typ (and optionally .bib) file in the project, looking for
 * the requested term. The currently open file's in-memory content is used
 * instead of the on-disk version so unsaved edits are searchable.
 *
 * Replace writes the result back to disk and records write provenance so the
 * chokidar watcher recognises its own writes by content.
 */

import * as fs from 'fs';
import { markSelfWrite } from '../shared/fileWrite';
import * as path from 'path';
import { appState } from './appState';
import { isPathWithin } from './pathSecurity';

const SEARCHED_EXTENSIONS_DEFAULT = new Set(['.typ']);
const SEARCHED_EXTENSIONS_WITH_BIB = new Set(['.typ', '.bib']);
const IGNORED_DIRS = new Set(['.git', '.penwright', 'node_modules', 'dist', 'build', 'assets', 'sources']);

/** Cap total returned matches so a degenerate query (e.g. " ") can't OOM the renderer. */
const MAX_TOTAL_MATCHES = 1000;
/** Cap context line length so long lines don't bloat the response. */
const MAX_CONTEXT_LEN = 240;

export interface SearchOptions {
  query: string;
  caseSensitive: boolean;
  wholeWord: boolean;
  regex: boolean;
  includeBib: boolean;
}

export interface SearchMatch {
  line: number;          // 1-based line number
  col: number;           // 1-based column
  matchText: string;
  lineText: string;
  matchStart: number;    // 0-based offset within lineText
  matchEnd: number;
}

export interface SearchFileResult {
  filePath: string;
  relPath: string;
  matches: SearchMatch[];
}

export interface SearchResults {
  files: SearchFileResult[];
  totalMatches: number;
  truncated: boolean;
  error?: string;
}

export interface ReplaceOptions extends SearchOptions {
  replacement: string;
}

export interface ReplaceResults {
  filesChanged: number;
  totalReplacements: number;
  error?: string;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildRegex(opts: SearchOptions): RegExp | { error: string } {
  let pattern: string;
  if (opts.regex) {
    pattern = opts.query;
  } else {
    pattern = escapeRegex(opts.query);
  }
  if (opts.wholeWord) {
    // `\b` is the boundary between a word and a non-word char, so it does
    // NOT fire when the query itself starts/ends with a non-word char like
    // `@` or `.` (the citation case `@citekey` produced 0 hits with `\b`).
    // Using lookarounds for "no word char on either side" works regardless
    // of what character the query starts/ends with.
    pattern = `(?<!\\w)(?:${pattern})(?!\\w)`;
  }
  const flags = opts.caseSensitive ? 'g' : 'gi';
  try {
    return new RegExp(pattern, flags);
  } catch (err) {
    return { error: String(err) };
  }
}

function walkProject(root: string, exts: Set<string>, depth = 0): string[] {
  if (depth > 6) return [];
  const result: string[] = [];
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
    if (entry.isDirectory()) {
      result.push(...walkProject(full, exts, depth + 1));
    } else if (exts.has(path.extname(entry.name).toLowerCase())) {
      result.push(full);
    }
  }
  return result;
}

function readSearchableFile(absPath: string): string | null {
  try {
    if (
      appState.currentFilePath &&
      path.resolve(absPath) === path.resolve(appState.currentFilePath) &&
      typeof appState.currentContent === 'string'
    ) {
      return appState.currentContent;
    }
    return fs.readFileSync(absPath, 'utf-8');
  } catch {
    return null;
  }
}

function clipContext(line: string, matchStart: number, matchEnd: number): {
  lineText: string;
  matchStart: number;
  matchEnd: number;
} {
  if (line.length <= MAX_CONTEXT_LEN) {
    return { lineText: line, matchStart, matchEnd };
  }
  // Center the match within the window.
  const half = Math.floor(MAX_CONTEXT_LEN / 2);
  const winStart = Math.max(0, matchStart - half);
  const winEnd = Math.min(line.length, winStart + MAX_CONTEXT_LEN);
  const adjustedStart = Math.max(0, winEnd - MAX_CONTEXT_LEN);
  const lineText = (adjustedStart > 0 ? '…' : '') + line.slice(adjustedStart, winEnd) + (winEnd < line.length ? '…' : '');
  const ellipsisOffset = adjustedStart > 0 ? 1 : 0;
  return {
    lineText,
    matchStart: matchStart - adjustedStart + ellipsisOffset,
    matchEnd: matchEnd - adjustedStart + ellipsisOffset,
  };
}

export function searchProject(opts: SearchOptions, projectDir?: string | null): SearchResults {
  const projectRoot = projectDir ?? appState.projectDir;
  if (!projectRoot) {
    return { files: [], totalMatches: 0, truncated: false, error: 'No project open.' };
  }
  if (!opts.query) {
    return { files: [], totalMatches: 0, truncated: false };
  }

  const re = buildRegex(opts);
  if ('error' in re) {
    return { files: [], totalMatches: 0, truncated: false, error: re.error };
  }

  const exts = opts.includeBib ? SEARCHED_EXTENSIONS_WITH_BIB : SEARCHED_EXTENSIONS_DEFAULT;
  const files = walkProject(projectRoot, exts).sort();

  const results: SearchFileResult[] = [];
  let total = 0;
  let truncated = false;

  outer: for (const absPath of files) {
    if (!isPathWithin(absPath, projectRoot)) continue;
    const content = readSearchableFile(absPath);
    if (content === null) continue;

    const lines = content.split('\n');
    const fileMatches: SearchMatch[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(line)) !== null) {
        if (m[0].length === 0) {
          re.lastIndex++;
          continue;
        }
        const clipped = clipContext(line, m.index, m.index + m[0].length);
        fileMatches.push({
          line: i + 1,
          col: m.index + 1,
          matchText: m[0],
          lineText: clipped.lineText,
          matchStart: clipped.matchStart,
          matchEnd: clipped.matchEnd,
        });
        total++;
        if (total >= MAX_TOTAL_MATCHES) {
          truncated = true;
          break;
        }
      }
      if (truncated) break;
    }

    if (fileMatches.length > 0) {
      results.push({
        filePath: absPath,
        relPath: path.relative(projectRoot, absPath),
        matches: fileMatches,
      });
    }
    if (truncated) break outer;
  }

  return { files: results, totalMatches: total, truncated };
}

export function replaceInProject(opts: ReplaceOptions, projectDir?: string | null): ReplaceResults {
  const projectRoot = projectDir ?? appState.projectDir;
  if (!projectRoot) return { filesChanged: 0, totalReplacements: 0, error: 'No project open.' };
  if (!opts.query) return { filesChanged: 0, totalReplacements: 0 };

  const re = buildRegex(opts);
  if ('error' in re) {
    return { filesChanged: 0, totalReplacements: 0, error: re.error };
  }

  const exts = opts.includeBib ? SEARCHED_EXTENSIONS_WITH_BIB : SEARCHED_EXTENSIONS_DEFAULT;
  const files = walkProject(projectRoot, exts);

  let filesChanged = 0;
  let totalReplacements = 0;

  for (const absPath of files) {
    if (!isPathWithin(absPath, projectRoot)) continue;
    const content = readSearchableFile(absPath);
    if (content === null) continue;

    re.lastIndex = 0;
    let count = 0;
    const replaced = content.replace(re, () => {
      count++;
      return opts.replacement;
    });
    if (count === 0 || replaced === content) continue;

    try {
      fs.writeFileSync(absPath, replaced, 'utf-8');
      markSelfWrite(absPath, replaced);
      filesChanged++;
      totalReplacements += count;

      // If we just rewrote the open file, reflect the change in memory and the editor.
      if (
        appState.currentFilePath &&
        path.resolve(absPath) === path.resolve(appState.currentFilePath)
      ) {
        appState.currentContent = replaced;
        appState.isDirty = false;
        appState.mainWindow?.webContents.send('penwright', { type: 'update', content: replaced });
        appState.mainWindow?.webContents.send('penwright', { type: 'saveStatus', saved: true });
      }
    } catch (err) {
      console.warn('[penwright] project replace failed for', absPath, err);
    }
  }

  if (filesChanged > 0) {
    appState.mainWindow?.webContents.send('penwright', { type: 'filetreeChanged' });
  }
  return { filesChanged, totalReplacements };
}
