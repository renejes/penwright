/**
 * The writing surface the iPad host is allowed to touch.
 *
 * Measured from the open editor: it sends `edit` (serializer output, already
 * debounced), `ready`, and occasionally `requestCitations` / `pickImage`.
 * The shell around it calls `filetree:list` / `filetree:open` and
 * `project:open`. Citations are pushed back as `citationData` after a `.bib`
 * read — the renderer never sends `requestCitations` itself; the Mac host
 * pushes on open. This module is the policy those calls share. It does not
 * serialize Typst.
 */

/** Short hint shown on controls that stay visible and do nothing on iPad. */
export const MAC_ONLY_HINT = 'Nur am Mac';

const ROOT_TYP = ['main.typ', 'document.typ', 'index.typ'];

const IGNORED_DIRS = new Set([
  '.git', '.penwright', 'penwright', 'node_modules', '.DS_Store', '__pycache__', '.venv', 'dist', 'build', 'versions',
]);

const SHOWN_EXTENSIONS = new Set([
  '.typ', '.bib', '.yaml', '.yml', '.toml', '.txt', '.md', '.mdx',
  '.png', '.jpg', '.jpeg', '.svg', '.gif', '.pdf', '.docx', '.doc', '.csv', '.json', '.tex',
]);

export type SaveRefusal = 'dotpath' | 'typeset';

/**
 * The iPad host writes the open chapter and nothing derived.
 * Dot paths are refused outright: Dropbox on iOS turns dot-folders into junk,
 * and a lock must not be one of them. `.penwright/typeset` is the Mac's
 * Easy Writing derivation — the iPad never writes it.
 */
export function saveRefusal(relPath: string): SaveRefusal | null {
  const norm = relPath.replace(/\\/g, '/').replace(/^\.\//, '');
  if (!norm || norm.startsWith('/') || norm.includes('\0')) return 'dotpath';
  const segments = norm.split('/').filter(Boolean);
  const derived = segments.indexOf('.penwright');
  if (derived >= 0 && segments[derived + 1] === 'typeset') return 'typeset';
  if (segments.some((s) => s === '..' || s.startsWith('.'))) return 'dotpath';
  return null;
}

/** Identity. The bytes on disk are the serializer's string, not a second pass. */
export function bytesForDisk(serialized: string): string {
  return serialized;
}

export function chooseInitialTyp(rels: string[]): string | null {
  // style.typ is the design file. Opening it on the iPad is a no-op, so it must
  // not win over a chapter or the start screen never leaves.
  const typ = rels.filter((p) => {
    if (!p.endsWith('.typ') || saveRefusal(p)) return false;
    const base = p.split('/').pop();
    return base !== 'style.typ';
  });
  const base = (p: string) => p.split('/').pop() ?? p;
  const root = typ.filter((p) => !p.includes('/'));
  for (const name of ROOT_TYP) {
    const hit = root.find((p) => base(p) === name);
    if (hit) return hit;
  }
  root.sort();
  if (root.length > 0) return root[0];
  typ.sort();
  return typ[0] ?? null;
}

export function extensionOf(name: string): string {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i).toLowerCase() : '';
}

/**
 * How a directory entry is walked.
 * A known extension is always a file — a provider that flags `style.typ` as a
 * folder would otherwise hide every real chapter. A name without an extension
 * is probed: it is a folder when listing it succeeds.
 */
export function entryKind(name: string): 'skip' | 'file' | 'probe' {
  if (!name || name.startsWith('.') || IGNORED_DIRS.has(name)) return 'skip';
  if (SHOWN_EXTENSIONS.has(extensionOf(name))) return 'file';
  return 'probe';
}

export function shownInTree(name: string, isDir: boolean): boolean {
  if (!name || name.startsWith('.')) return false;
  if (isDir) return !IGNORED_DIRS.has(name);
  return SHOWN_EXTENSIONS.has(extensionOf(name));
}

/** Path of `toFile` as Typst should write it from inside `fromFile`. */
export function relativeBetween(fromFile: string, toFile: string): string {
  const fromDir = fromFile.split('/').slice(0, -1);
  const to = toFile.split('/');
  let i = 0;
  while (i < fromDir.length && i < to.length && fromDir[i] === to[i]) i++;
  const ups = new Array(fromDir.length - i).fill('..');
  const rest = to.slice(i);
  return [...ups, ...rest].join('/') || to[to.length - 1] || toFile;
}

/** Join a chapter directory and an image src. Null when it would leave the project. */
export function joinRel(baseDir: string, src: string): string | null {
  if (!src || /^[a-z][a-z0-9+.-]*:/i.test(src)) return null;
  const raw = `${baseDir}/${src}`.replace(/\\/g, '/');
  const parts: string[] = [];
  for (const p of raw.split('/')) {
    if (!p || p === '.') continue;
    if (p === '..') {
      if (parts.length === 0) return null;
      parts.pop();
      continue;
    }
    parts.push(p);
  }
  const rel = parts.join('/');
  if (!rel || saveRefusal(rel)) return null;
  return rel;
}

export function safeAssetName(name: string): string | null {
  const base = name.split(/[/\\]/).pop() ?? '';
  if (!base || base.startsWith('.') || base.includes('..')) return null;
  if (!/\.(png|jpe?g|gif|svg|webp)$/i.test(base)) return null;
  return base;
}

/**
 * `.bib` files to read for `@` completion. `references.bib` and `zotero.bib`
 * come first when they exist; every other bibliography in the same folders
 * follows. Paths that fail `saveRefusal` are skipped so a dot-folder cannot
 * become a citation source the host then writes back.
 */
export function bibReadOrder(rels: string[]): string[] {
  const bibs = rels.filter((p) => p.endsWith('.bib') && !saveRefusal(p));
  const rank = (p: string): number => {
    const base = p.split('/').pop();
    if (base === 'references.bib') return 0;
    if (base === 'zotero.bib') return 1;
    return 2;
  };
  return [...bibs].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}

const LANG_RE = /#set\s+text\([^)]*lang:\s*"([^"]+)"/;

export function documentLang(content: string): string | null {
  const m = content.match(LANG_RE);
  return m?.[1] ?? null;
}

export function appendInclude(rootContent: string, relPath: string): string {
  const lines = rootContent.split('\n');
  const existing: { relPath: string; line: number }[] = [];
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^#include\s+"([^"]+)"/);
    if (match) existing.push({ relPath: match[1], line: i });
  }
  if (existing.some((c) => c.relPath === relPath)) return rootContent;
  const includeLine = `#include "${relPath}"`;
  if (existing.length === 0) {
    const body = rootContent.replace(/\s*$/, '');
    return `${body}\n\n${includeLine}\n`;
  }
  const at = existing[existing.length - 1].line + 1;
  lines.splice(at, 0, includeLine);
  return lines.join('\n');
}
