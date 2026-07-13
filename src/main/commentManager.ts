/**
 * Comment / Annotation Storage.
 *
 * Each comment lives as its own Markdown file inside `<project>/comments/`
 * so that the project folder stays self-explanatory: any file there is a
 * comment, readable in any text editor, diffable, copyable, editable from
 * outside Penwright.
 *
 * File format:
 *
 *     ---
 *     id: 2026-04-28-1432-a3f
 *     file: chapters/03-method.typ
 *     anchor: "five reference works"
 *     rangeStart: 42
 *     rangeEnd: 58
 *     author: René Jesser
 *     date: 2026-04-28T14:32:00.000Z
 *     resolved: false
 *     ---
 *
 *     Quelle ergänzen — vielleicht den Müller-Artikel?
 *
 * `anchor` is the verbatim text the comment was originally attached to and
 * is the source of truth for re-locating the highlight after the document
 * has been edited. The `rangeStart`/`rangeEnd` offsets are only used as a
 * search hint; if the anchor text has moved, we fall back to a global
 * `indexOf` and update the offsets on next save.
 *
 * Comments are NOT written into the .typ source — the source stays clean
 * and never compiles them into the PDF/DOCX output.
 */

import * as fs from 'fs';
import * as path from 'path';
import { appState } from './appState';
import { isPathWithin } from './pathSecurity';

export interface CommentMeta {
  id: string;
  file: string;          // POSIX-relative path inside the project
  anchor: string;        // Verbatim text the comment was attached to
  rangeStart: number;    // Char offset hint within `file` (best-effort)
  rangeEnd: number;
  author: string;
  date: string;          // ISO-8601
  resolved: boolean;
}

export interface CommentEntry extends CommentMeta {
  body: string;          // Markdown body (no frontmatter)
  filePath: string;      // Absolute path of the comment .md file
  orphaned?: boolean;    // True if anchor text could not be located
}

const COMMENTS_DIRNAME = 'comments';

export function commentsDir(projectDir: string): string {
  return path.join(projectDir, COMMENTS_DIRNAME);
}

function ensureCommentsDir(projectDir: string): string {
  const dir = commentsDir(projectDir);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** Generates a sortable, friendly id like "2026-04-28-1432-a3f". */
export function generateCommentId(now: Date = new Date()): string {
  const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
  const rand = Math.random().toString(36).slice(2, 5);
  return `${stamp}-${rand}`;
}

// ─── YAML-ish Frontmatter ────────────────────────────────
// We parse a minimal subset — string/number/boolean — so we don't need a
// dependency. All values are written quoted on the way out.

function escapeYamlString(s: string): string {
  // Escape backslashes and double quotes, then wrap in quotes.
  return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`;
}

function unescapeYamlString(s: string): string {
  // Single left-to-right pass: an escaped backslash is consumed atomically,
  // so `\\` followed by `n` can never be re-read as a `\n` escape (the old
  // sequential .replace() chain corrupted anchors containing `\` + 'n').
  return s.replace(/\\(\\|"|n)/g, (_m, c: string) => (c === 'n' ? '\n' : c));
}

function parseScalar(raw: string): string | number | boolean {
  const v = raw.trim();
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  if (v.startsWith('"') && v.endsWith('"')) return unescapeYamlString(v.slice(1, -1));
  if (v.startsWith("'") && v.endsWith("'")) return v.slice(1, -1);
  return v;
}

interface ParsedFile {
  meta: Record<string, string | number | boolean>;
  body: string;
}

function parseFile(content: string): ParsedFile {
  if (!content.startsWith('---')) {
    return { meta: {}, body: content };
  }
  const end = content.indexOf('\n---', 3);
  if (end < 0) return { meta: {}, body: content };

  const front = content.slice(3, end).replace(/^\n/, '');
  const body = content.slice(end + 4).replace(/^\n/, '');

  const meta: Record<string, string | number | boolean> = {};
  for (const line of front.split('\n')) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const colon = line.indexOf(':');
    if (colon < 0) continue;
    const key = line.slice(0, colon).trim();
    const value = line.slice(colon + 1).trim();
    if (!key) continue;
    meta[key] = parseScalar(value);
  }
  return { meta, body };
}

function serializeFile(meta: CommentMeta, body: string): string {
  const lines = [
    '---',
    `id: ${escapeYamlString(meta.id)}`,
    `file: ${escapeYamlString(meta.file)}`,
    `anchor: ${escapeYamlString(meta.anchor)}`,
    `rangeStart: ${meta.rangeStart}`,
    `rangeEnd: ${meta.rangeEnd}`,
    `author: ${escapeYamlString(meta.author)}`,
    `date: ${escapeYamlString(meta.date)}`,
    `resolved: ${meta.resolved ? 'true' : 'false'}`,
    '---',
    '',
    body.trimEnd(),
    '',
  ];
  return lines.join('\n');
}

// ─── Reanchoring ────────────────────────────────────────

/**
 * Locates `anchor` inside the on-disk content of the comment's target file.
 * Uses `rangeStart` as a hint and falls back to a global search.
 * Returns the new `[start, end]` offsets, or `null` if not found.
 */
function relocateAnchor(
  fileContent: string,
  anchor: string,
  rangeHint: number,
): [number, number] | null {
  if (!anchor) return null;
  // Direct hit at the hinted location.
  if (
    rangeHint >= 0 &&
    rangeHint + anchor.length <= fileContent.length &&
    fileContent.slice(rangeHint, rangeHint + anchor.length) === anchor
  ) {
    return [rangeHint, rangeHint + anchor.length];
  }
  // Search forward from the hint, then from the start.
  let idx = fileContent.indexOf(anchor, Math.max(0, rangeHint - 200));
  if (idx < 0) idx = fileContent.indexOf(anchor);
  if (idx < 0) return null;
  return [idx, idx + anchor.length];
}

function readTargetFile(projectDir: string, relPath: string): string | null {
  const abs = path.join(projectDir, relPath);
  if (!isPathWithin(abs, projectDir)) return null;
  // Prefer in-memory content for the currently open file.
  if (
    appState.currentFilePath &&
    path.resolve(abs) === path.resolve(appState.currentFilePath) &&
    typeof appState.currentContent === 'string'
  ) {
    return appState.currentContent;
  }
  try {
    return fs.readFileSync(abs, 'utf-8');
  } catch {
    return null;
  }
}

function metaFromParsed(parsed: ParsedFile, fallbackId: string): CommentMeta | null {
  const m = parsed.meta;
  const id = typeof m.id === 'string' ? m.id : fallbackId;
  const file = typeof m.file === 'string' ? m.file : '';
  if (!file) return null;
  return {
    id,
    file,
    anchor: typeof m.anchor === 'string' ? m.anchor : '',
    rangeStart: typeof m.rangeStart === 'number' ? m.rangeStart : 0,
    rangeEnd: typeof m.rangeEnd === 'number' ? m.rangeEnd : 0,
    author: typeof m.author === 'string' ? m.author : '',
    date: typeof m.date === 'string' ? m.date : new Date().toISOString(),
    resolved: m.resolved === true,
  };
}

function loadComment(projectDir: string, filePath: string): CommentEntry | null {
  let raw: string;
  try {
    raw = fs.readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
  const parsed = parseFile(raw);
  const fallbackId = path.basename(filePath, '.md');
  const meta = metaFromParsed(parsed, fallbackId);
  if (!meta) return null;

  const targetContent = readTargetFile(projectDir, meta.file);
  let orphaned = false;
  let rangeStart = meta.rangeStart;
  let rangeEnd = meta.rangeEnd;
  if (targetContent !== null) {
    const located = relocateAnchor(targetContent, meta.anchor, meta.rangeStart);
    if (located) {
      [rangeStart, rangeEnd] = located;
    } else {
      orphaned = true;
    }
  }

  return {
    ...meta,
    rangeStart,
    rangeEnd,
    body: parsed.body,
    filePath,
    orphaned,
  };
}

// ─── Public API ──────────────────────────────────────────

export interface ListOptions {
  /** If set, restrict to comments anchored to this project-relative file. */
  forFile?: string;
  /** If false, hide resolved comments. */
  includeResolved?: boolean;
}

export function listComments(projectDir: string, opts: ListOptions = {}): CommentEntry[] {
  const dir = commentsDir(projectDir);
  if (!fs.existsSync(dir)) return [];

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const result: CommentEntry[] = [];
  for (const e of entries) {
    if (!e.isFile()) continue;
    if (!e.name.endsWith('.md')) continue;
    const full = path.join(dir, e.name);
    if (!isPathWithin(full, projectDir)) continue;
    const c = loadComment(projectDir, full);
    if (!c) continue;
    if (opts.forFile && c.file !== opts.forFile) continue;
    if (opts.includeResolved === false && c.resolved) continue;
    result.push(c);
  }
  // Newest first.
  result.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return result;
}

export interface CreateArgs {
  file: string;          // POSIX-relative path
  anchor: string;
  rangeStart: number;
  rangeEnd: number;
  body?: string;
  author?: string;
}

export function createComment(projectDir: string, args: CreateArgs): CommentEntry | null {
  if (!projectDir) return null;
  if (!args.file || !args.anchor) return null;

  ensureCommentsDir(projectDir);

  const id = generateCommentId();
  const meta: CommentMeta = {
    id,
    file: args.file.replace(/\\/g, '/'),
    anchor: args.anchor,
    rangeStart: Math.max(0, Math.floor(args.rangeStart)),
    rangeEnd: Math.max(args.rangeStart, Math.floor(args.rangeEnd)),
    author: args.author?.trim() || 'Unknown',
    date: new Date().toISOString(),
    resolved: false,
  };
  const body = args.body ?? '';
  const target = path.join(commentsDir(projectDir), `${id}.md`);
  if (!isPathWithin(target, projectDir)) return null;

  fs.writeFileSync(target, serializeFile(meta, body), 'utf-8');
  return { ...meta, body, filePath: target };
}

export interface UpdateArgs {
  body?: string;
  resolved?: boolean;
  anchor?: string;
  rangeStart?: number;
  rangeEnd?: number;
}

function findCommentPath(projectDir: string, id: string): string | null {
  if (!/^[\w.-]+$/.test(id)) return null;
  const direct = path.join(commentsDir(projectDir), `${id}.md`);
  if (fs.existsSync(direct) && isPathWithin(direct, projectDir)) return direct;
  // Fall back to scanning, in case the user renamed the file.
  if (!fs.existsSync(commentsDir(projectDir))) return null;
  for (const e of fs.readdirSync(commentsDir(projectDir))) {
    if (!e.endsWith('.md')) continue;
    const full = path.join(commentsDir(projectDir), e);
    if (!isPathWithin(full, projectDir)) continue;
    try {
      const parsed = parseFile(fs.readFileSync(full, 'utf-8'));
      if (parsed.meta.id === id) return full;
    } catch {}
  }
  return null;
}

export function updateComment(projectDir: string, id: string, patch: UpdateArgs): CommentEntry | null {
  const filePath = findCommentPath(projectDir, id);
  if (!filePath) return null;

  const raw = fs.readFileSync(filePath, 'utf-8');
  const parsed = parseFile(raw);
  const meta = metaFromParsed(parsed, id);
  if (!meta) return null;

  const next: CommentMeta = {
    ...meta,
    anchor: patch.anchor !== undefined ? patch.anchor : meta.anchor,
    rangeStart: patch.rangeStart !== undefined ? patch.rangeStart : meta.rangeStart,
    rangeEnd: patch.rangeEnd !== undefined ? patch.rangeEnd : meta.rangeEnd,
    resolved: patch.resolved !== undefined ? patch.resolved : meta.resolved,
  };
  const body = patch.body !== undefined ? patch.body : parsed.body;

  fs.writeFileSync(filePath, serializeFile(next, body), 'utf-8');
  return { ...next, body, filePath };
}

export function deleteComment(projectDir: string, id: string): boolean {
  const filePath = findCommentPath(projectDir, id);
  if (!filePath) return false;
  try {
    fs.unlinkSync(filePath);
    return true;
  } catch {
    return false;
  }
}
