/**
 * A project tree for the local agent. Reads come from disk. Writes and
 * deletes stay in memory until `applyDraft` copies a finished run back.
 * `.git` is never written.
 */
import { readdirSync, readFileSync, realpathSync, statSync, mkdirSync, writeFileSync, unlinkSync, existsSync } from 'fs';
import { dirname, join, relative, resolve, sep } from 'path';
import { FileNotFoundError, InvalidGrepPatternError, WriteFailedError } from '@cursor/sdk';
import type { DirEntry, FSGrepQuery, FSGrepResult, FileInfo, FileSystem, GlobOptions, ListOptions } from '@cursor/sdk';

export interface DraftChange {
  /** Project-relative posix path, no leading slash. */
  path: string;
  kind: 'write' | 'delete';
  contents?: Buffer;
}

const SKIP_DIR = new Set(['.git', 'node_modules', '.penwright']);

export function createDraftFileSystem(root: string): { fs: FileSystem; changes: () => DraftChange[] } {
  const base = resolve(root);
  const overlay = new Map<string, Buffer | null>();

  const fs: FileSystem = {
    list: (prefix, options) => iterable(listEntries(base, overlay, prefix, options)),
    stat: async (path) => statPath(base, overlay, path),
    glob: (pattern, dir, options) => iterable(globEntries(base, overlay, pattern, dir, options)),
    read: async (path) => readPath(base, overlay, path),
    grep: (query) => iterable(grepEntries(base, overlay, query)),
    write: async (path, contents) => {
      const posix = mustFile(path);
      if (posix.split('/').some(part => SKIP_DIR.has(part))) {
        throw new WriteFailedError(posix, `write failed: ${posix}`);
      }
      overlay.set(posix, Buffer.isBuffer(contents) ? contents : Buffer.from(typeof contents === 'string' ? contents : contents));
    },
    delete: async (path) => {
      const posix = mustFile(path);
      if (statPath(base, overlay, posix).kind !== 'file') throw new FileNotFoundError(posix, `not found: ${posix}`);
      overlay.set(posix, null);
    },
  };

  return {
    fs,
    changes: () => {
      const out: DraftChange[] = [];
      for (const [path, contents] of overlay) {
        if (contents === null) out.push({ path: path.slice(1), kind: 'delete' });
        else out.push({ path: path.slice(1), kind: 'write', contents });
      }
      return out;
    },
  };
}

export function applyDraft(root: string, changes: readonly DraftChange[]): number {
  const base = realBase(root);
  let applied = 0;
  for (const change of changes) {
    const target = contained(base, change.path);
    if (!target) continue;
    if (change.kind === 'delete') {
      if (existsSync(target)) unlinkSync(target);
      applied += 1;
      continue;
    }
    if (!change.contents) continue;
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, change.contents);
    applied += 1;
  }
  return applied;
}

function iterable<T>(items: T[]): AsyncIterable<T> {
  return {
    async *[Symbol.asyncIterator]() {
      for (const item of items) yield item;
    },
  };
}

function normalize(input?: string): string | null {
  const raw = (input ?? '/').replace(/\\/g, '/');
  if (raw === '' || raw === '/') return '/';
  const parts: string[] = [];
  for (const part of raw.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') return null;
    parts.push(part);
  }
  return parts.length ? `/${parts.join('/')}` : '/';
}

function mustFile(input?: string): string {
  const posix = normalize(input);
  if (!posix || posix === '/') throw new WriteFailedError(posix ?? '/', `write failed: ${posix ?? '/'}`);
  return posix;
}

function realBase(base: string): string {
  try {
    return realpathSync(base);
  } catch {
    return resolve(base);
  }
}

function contained(base: string, relPosix: string): string | null {
  if (!relPosix || relPosix.split('/').some(part => part === '..' || SKIP_DIR.has(part))) return null;
  const root = realBase(base);
  const target = resolve(root, ...relPosix.split('/'));
  const rel = relative(root, target);
  if (!rel || rel.startsWith('..') || rel.split(sep).includes('..')) return null;
  return target;
}

function hostPath(base: string, posix: string): string | null {
  if (posix === '/') return base;
  return contained(base, posix.slice(1));
}

function diskFiles(base: string): string[] {
  const out: string[] = [];
  const walk = (dir: string, prefix: string) => {
    let names: string[] = [];
    try {
      names = readdirSync(dir);
    } catch {
      return;
    }
    for (const name of names) {
      if (SKIP_DIR.has(name)) continue;
      const abs = join(dir, name);
      const posix = `${prefix}/${name}`;
      let st;
      try {
        st = statSync(abs);
      } catch {
        continue;
      }
      if (st.isDirectory()) walk(abs, posix);
      else if (st.isFile()) out.push(posix);
    }
  };
  walk(base, '');
  return out;
}

function allFiles(base: string, overlay: Map<string, Buffer | null>): string[] {
  const set = new Set(diskFiles(base));
  for (const [path, contents] of overlay) {
    if (contents === null) set.delete(path);
    else set.add(path);
  }
  return [...set].sort();
}

function listEntries(base: string, overlay: Map<string, Buffer | null>, prefix?: string, options?: ListOptions): DirEntry[] {
  const root = normalize(prefix) ?? '/';
  const depth = options?.maxDepth;
  if (depth !== undefined && depth < 1) return [];
  const files = allFiles(base, overlay).filter(path => root === '/' || path === root || path.startsWith(`${root}/`));
  const entries: DirEntry[] = [];
  const seen = new Set<string>();
  for (const path of files) {
    if (root !== '/' && path === root) continue;
    const rest = root === '/' ? path.slice(1) : path.slice(root.length + 1);
    const segments = rest.split('/');
    let shown = path;
    let kind: 'file' | 'directory' = 'file';
    if (depth !== undefined && segments.length > depth) {
      const ancestor = segments.slice(0, depth).join('/');
      shown = root === '/' ? `/${ancestor}` : `${root}/${ancestor}`;
      kind = 'directory';
    }
    if (seen.has(shown)) continue;
    seen.add(shown);
    const size = kind === 'file' ? fileSize(base, overlay, shown) : undefined;
    entries.push({ path: shown, kind, size });
  }
  entries.sort((a, b) => a.path.localeCompare(b.path));
  const limit = options?.limit ?? entries.length;
  return entries.slice(0, Math.max(0, limit));
}

function fileSize(base: string, overlay: Map<string, Buffer | null>, posix: string): number | undefined {
  const over = overlay.get(posix);
  if (over) return over.length;
  const host = hostPath(base, posix);
  if (!host) return undefined;
  try {
    return statSync(host).size;
  } catch {
    return undefined;
  }
}

function statPath(base: string, overlay: Map<string, Buffer | null>, input?: string): FileInfo {
  const posix = normalize(input);
  if (!posix) return { kind: 'missing' };
  if (posix === '/') return { kind: 'directory' };
  const over = overlay.get(posix);
  if (over === null) return { kind: 'missing' };
  if (over) return { kind: 'file' };
  const files = allFiles(base, overlay);
  if (files.includes(posix)) return { kind: 'file' };
  if (files.some(path => path.startsWith(`${posix}/`))) return { kind: 'directory' };
  const host = hostPath(base, posix);
  if (!host) return { kind: 'missing' };
  try {
    const st = statSync(host);
    if (st.isFile()) return { kind: 'file' };
    if (st.isDirectory()) return { kind: 'directory' };
  } catch {
    /* missing */
  }
  return { kind: 'missing' };
}

function globToRegExp(pattern: string): RegExp | null {
  let src = '^';
  for (let i = 0; i < pattern.length; i += 1) {
    const ch = pattern[i];
    if (ch === '*') {
      if (pattern[i + 1] === '*') {
        src += '.*';
        i += 1;
        if (pattern[i + 1] === '/') i += 1;
      } else src += '[^/]*';
    } else if (ch === '?') src += '[^/]';
    else src += ch.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  try {
    return new RegExp(`${src}$`);
  } catch {
    return null;
  }
}

function globEntries(base: string, overlay: Map<string, Buffer | null>, pattern: string, dir?: string, options?: GlobOptions): DirEntry[] {
  const root = normalize(dir) ?? '/';
  const re = globToRegExp(pattern);
  if (!re) return [];
  const matches = allFiles(base, overlay).filter(path => {
    if (!(root === '/' || path.startsWith(`${root}/`))) return false;
    const rel = root === '/' ? path.slice(1) : path.slice(root.length + 1);
    return re.test(rel);
  });
  const entries = matches.sort().map(path => ({ path, kind: 'file' as const, size: fileSize(base, overlay, path) }));
  const limit = options?.limit ?? entries.length;
  return entries.slice(0, Math.max(0, limit));
}

function readPath(base: string, overlay: Map<string, Buffer | null>, input?: string): string | Uint8Array {
  const posix = normalize(input);
  if (!posix || posix === '/') throw new FileNotFoundError(posix ?? '/', `not found: ${posix ?? '/'}`);
  const over = overlay.get(posix);
  if (over === null || statPath(base, overlay, posix).kind !== 'file') {
    throw new FileNotFoundError(posix, `not found: ${posix}`);
  }
  const buf = over ?? readDisk(base, posix);
  if (!buf) throw new FileNotFoundError(posix, `not found: ${posix}`);
  if (buf.includes(0)) return new Uint8Array(buf);
  return buf.toString('utf8');
}

function readDisk(base: string, posix: string): Buffer | null {
  const host = hostPath(base, posix);
  if (!host) return null;
  try {
    const real = realpathSync(host);
    const rel = relative(realBase(base), real);
    if (rel.startsWith('..') || rel.split(sep).includes('..')) return null;
    return readFileSync(real);
  } catch {
    return null;
  }
}

function grepEntries(base: string, overlay: Map<string, Buffer | null>, query: FSGrepQuery): FSGrepResult[] {
  let re: RegExp;
  try {
    re = new RegExp(query.pattern, query.caseInsensitive ? 'i' : '');
  } catch {
    throw new InvalidGrepPatternError(query.pattern, query.path ?? '/', `invalid grep pattern: ${query.pattern}`);
  }
  const root = normalize(query.path) ?? '/';
  const hits: FSGrepResult[] = [];
  for (const path of allFiles(base, overlay)) {
    if (!(root === '/' || path === root || path.startsWith(`${root}/`))) continue;
    let text: string;
    try {
      const data = readPath(base, overlay, path);
      if (typeof data !== 'string') continue;
      text = data;
    } catch {
      continue;
    }
    const lines = text.split(/\r?\n/);
    lines.forEach((line, index) => {
      if (!re.test(line)) return;
      re.lastIndex = 0;
      hits.push({ path, lineNumber: index + 1, line });
    });
    if (query.maxResults !== undefined && hits.length >= query.maxResults) return hits.slice(0, query.maxResults);
  }
  return hits;
}
