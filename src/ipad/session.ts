/**
 * iPad writing session. Reads and writes project files and never serializes
 * Typst. The editor's serializer is the only writer of chapter bytes — `edit`
 * stores that string unchanged. Recovery is the one exception: auto-backups
 * and AI snapshots live in `.penwright/backups` and `.penwright/ai-snapshots`,
 * the same folders the Mac uses. Locks and `.penwright/typeset` stay refused.
 */

import { parseBibFile } from '../shared/bibParser';
import { refTypeFromLabel } from '../shared/refLabels';
import {
  sourceOfVersion,
  suggestVersionName,
  swapped,
  versionFileRel,
  type VersionGroup,
} from '../shared/chapterVersions';
import { commentId, parseComment, serializeComment, type CommentFile } from './commentFiles';
import type { ProjectFs, TreeEntry } from './projectFs';
import {
  applyBackup,
  createBackup,
  listAiSnapshots,
  listBackups,
  publishSnapshotLimit,
  undoLastAi,
  type BackupSnapshot,
} from './recovery';
import {
  appendInclude,
  bibReadOrder,
  bytesForDisk,
  chooseInitialTyp,
  documentLang,
  entryKind,
  joinRel,
  MAC_ONLY_HINT,
  relativeBetween,
  safeAssetName,
  saveRefusal,
} from './writingSurface';

export interface HostMessage {
  type: string;
  [key: string]: unknown;
}

export type OpenResult = 'editor' | 'textviewer' | 'pdfviewer' | 'mac-only';

const TEXT_EXT = /\.(bib|txt|md|mdx|yaml|yml|toml|json|csv|tex)$/i;
const MAC_ONLY_EXT = /\.(docx|doc)$/i;

/** Base64 the desktop PDF viewer already expects from `textfile:readBinary`. */
export function bytesToBase64(bytes: Uint8Array): string {
  const chunk = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export class IpadProject {
  currentRel: string | null = null;
  currentContent = '';
  folderName = '';

  constructor(
    private readonly fs: ProjectFs,
    private readonly emit: (msg: HostMessage) => void,
  ) {}

  async activate(name: string, prefer?: string): Promise<void> {
    this.folderName = name;
    this.emit({ type: 'projectOpened', name });
    let rels: string[] = [];
    let listError = '';
    try {
      rels = await this.collectFiles('');
    } catch (err) {
      listError = err instanceof Error ? err.message : String(err);
    }
    rels = await this.withMainTyp(rels);
    const preferred = prefer && rels.includes(prefer) ? prefer : chooseInitialTyp(rels);
    const order = preferred
      ? [preferred, ...rels.filter((p) => p.endsWith('.typ') && p !== preferred && !saveRefusal(p) && !p.endsWith('/style.typ') && p !== 'style.typ')]
      : [];
    let lastError = '';
    for (const rel of order) {
      try {
        const result = await this.openRel(rel);
        if (result === 'editor') return;
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
      }
    }
    this.emit({ type: 'filetreeChanged' });
    const saw = rels.filter((p) => !p.endsWith('/style.typ') && p !== 'style.typ').slice(0, 8);
    const onlyStyle = rels.some((p) => p === 'style.typ' || p.endsWith('/style.typ'));
    if (lastError) {
      this.emit({ type: 'hostNotice', message: lastError });
    } else if (order.length === 0) {
      this.emit({
        type: 'hostNotice',
        message: listError
          ? listError
          : onlyStyle
            ? 'style.typ ist nur die Gestaltung. In diesem Ordner liegt daneben keine Kapiteldatei.'
            : saw.length
              ? `Keine Kapiteldatei zum Öffnen. Gesehen: ${saw.join(', ')}`
              : 'In diesem Ordner liegt keine Kapiteldatei (.typ).',
      });
    }
  }

  async listTree(): Promise<{ dir: string; entries: TreeEntry[]; hasParent: boolean }> {
    let entries: TreeEntry[] = [];
    try {
      entries = await this.buildTree('');
    } catch {
      entries = [];
    }
    if (!entries.some((e) => e.name === 'main.typ' && !e.isDir)) {
      try {
        await this.fs.readText('main.typ');
        entries = [{ name: 'main.typ', path: 'main.typ', isDir: false }, ...entries];
      } catch {
        /* this project has no main.typ */
      }
    }
    return { dir: this.folderName, entries, hasParent: false };
  }

  /**
   * Same gesture as the desktop Chapters tab: `chapters/new-chapter.typ`
   * plus an `#include` in the document root, never in the open chapter.
   */
  async addChapter(): Promise<{ ok: boolean; error?: string }> {
    const root = await this.rootRel();
    if (!root) return { ok: false, error: 'Kein Dokument gefunden.' };
    const rootContent = this.currentRel === root
      ? this.currentContent
      : await this.fs.readText(root);
    let rel = 'chapters/new-chapter.typ';
    let n = 2;
    while (await this.fs.exists(rel)) {
      rel = `chapters/new-chapter-${n}.typ`;
      n += 1;
    }
    const stem = rel.split('/').pop()!.replace(/\.typ$/i, '').replace(/-/g, ' ');
    const title = stem.charAt(0).toUpperCase() + stem.slice(1);
    const nextRoot = appendInclude(rootContent, rel);
    await this.fs.writeText(rel, `= ${title}\n\n`);
    await this.fs.writeText(root, nextRoot);
    if (this.currentRel === root) {
      this.currentContent = nextRoot;
      this.emit({ type: 'update', content: nextRoot });
    }
    this.emit({ type: 'filetreeChanged' });
    return { ok: true };
  }

  async validateIncludes(paths: string[]): Promise<boolean[]> {
    const base = this.currentRel?.includes('/')
      ? this.currentRel.slice(0, this.currentRel.lastIndexOf('/'))
      : '';
    const out: boolean[] = [];
    for (const rel of paths) {
      const joined = joinRel(base, rel);
      out.push(joined ? await this.fs.exists(joined).catch(() => false) : false);
    }
    return out;
  }

  async openInclude(rel: string): Promise<OpenResult | undefined> {
    const base = this.currentRel?.includes('/')
      ? this.currentRel.slice(0, this.currentRel.lastIndexOf('/'))
      : '';
    const joined = joinRel(base, rel);
    if (!joined) return 'mac-only';
    return this.openRel(joined);
  }

  async listComments(opts: { forFile?: string; includeResolved?: boolean }): Promise<CommentFile[]> {
    let names: string[] = [];
    try {
      const items = await this.fs.readDir('comments');
      names = items.filter((i) => i.name.endsWith('.md')).map((i) => i.name);
    } catch {
      return [];
    }
    const out: CommentFile[] = [];
    for (const name of names) {
      try {
        const text = await this.fs.readText(`comments/${name}`);
        const parsed = parseComment(text, `comments/${name}`);
        if (!parsed) continue;
        if (opts.forFile && parsed.file !== opts.forFile) continue;
        if (opts.includeResolved === false && parsed.resolved) continue;
        out.push(parsed);
      } catch { /* skip a broken file */ }
    }
    out.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    return out;
  }

  async createComment(args: {
    file?: string;
    anchor?: string;
    rangeStart?: number;
    rangeEnd?: number;
    body?: string;
    author?: string;
  }): Promise<CommentFile | null> {
    if (!args.file || !args.anchor) return null;
    const id = commentId();
    const meta = {
      id,
      file: args.file.replace(/\\/g, '/'),
      anchor: args.anchor,
      rangeStart: Math.max(0, Math.floor(args.rangeStart ?? 0)),
      rangeEnd: Math.max(args.rangeStart ?? 0, Math.floor(args.rangeEnd ?? 0)),
      author: args.author?.trim() || 'Unknown',
      date: new Date().toISOString(),
      resolved: false,
    };
    const body = args.body ?? '';
    const filePath = `comments/${id}.md`;
    await this.fs.writeText(filePath, serializeComment(meta, body));
    return { ...meta, body, filePath };
  }

  async updateComment(id: string, patch: { body?: string; resolved?: boolean }): Promise<CommentFile | null> {
    const existing = (await this.listComments({})).find((c) => c.id === id);
    if (!existing) return null;
    const next = {
      ...existing,
      resolved: patch.resolved !== undefined ? patch.resolved : existing.resolved,
    };
    const body = patch.body !== undefined ? patch.body : existing.body;
    await this.fs.writeText(existing.filePath, serializeComment(next, body));
    return { ...next, body };
  }

  async deleteComment(id: string): Promise<boolean> {
    const existing = (await this.listComments({})).find((c) => c.id === id);
    if (!existing) return false;
    try {
      await this.fs.remove(existing.filePath);
      return true;
    } catch {
      return false;
    }
  }

  private async rootRel(): Promise<string | null> {
    for (const name of ['main.typ', 'document.typ', 'index.typ']) {
      if (await this.fs.exists(name)) return name;
    }
    if (this.currentRel?.endsWith('.typ') && !this.currentRel.endsWith('style.typ')) return this.currentRel;
    return null;
  }

  private async withMainTyp(rels: string[]): Promise<string[]> {
    if (rels.includes('main.typ')) return rels;
    try {
      await this.fs.readText('main.typ');
      return ['main.typ', ...rels];
    } catch {
      return rels;
    }
  }

  async openRel(rel: string): Promise<OpenResult | undefined> {
    const refusal = saveRefusal(rel);
    if (refusal) return 'mac-only';
    const base = rel.split('/').pop() ?? rel;
    if (base === 'style.typ') {
      this.emit({
        type: 'hostNotice',
        message: 'style.typ ist die Gestaltung und bleibt auf dem iPad unangetastet. Die Kapitel kannst du hier bearbeiten.',
      });
      return 'mac-only';
    }
    if (base.toLowerCase().endsWith('.pdf')) {
      this.emit({ type: 'openPdfFile', path: rel });
      return 'pdfviewer';
    }
    if (MAC_ONLY_EXT.test(base)) return 'mac-only';

    if (rel.endsWith('.typ')) {
      const content = await this.fs.readText(rel);
      this.currentRel = rel;
      this.currentContent = content;
      const dir = rel.includes('/') ? rel.slice(0, rel.lastIndexOf('/')) : '';
      this.emit({ type: 'documentBaseUri', uri: dir });
      this.emit({ type: 'update', content });
      const lang = documentLang(content);
      if (lang) this.emit({ type: 'documentLang', lang });
      this.emit({ type: 'currentFile', path: rel });
      this.emit({ type: 'filetreeChanged' });
      await this.pushCitations();
      return 'editor';
    }

    if (TEXT_EXT.test(base)) {
      this.emit({ type: 'openTextFile', path: rel });
      return 'textviewer';
    }
    return 'mac-only';
  }

  /** Store serializer output. Refuses derived and dot paths. Does not re-serialize. */
  async edit(content: string): Promise<void> {
    if (!this.currentRel) return;
    if (saveRefusal(this.currentRel)) return;
    const bytes = bytesForDisk(content);
    if (bytes === this.currentContent) return;
    await this.fs.writeText(this.currentRel, bytes);
    this.currentContent = bytes;
    this.emit({ type: 'saveStatus', saved: true });
  }

  async writeTextFile(rel: string, content: string): Promise<void> {
    if (saveRefusal(rel)) throw new Error(MAC_ONLY_HINT);
    await this.fs.writeText(rel, content);
    this.emit({ type: 'filetreeChanged' });
  }

  async readBinaryFile(rel: string): Promise<string> {
    if (saveRefusal(rel)) throw new Error(MAC_ONLY_HINT);
    return bytesToBase64(await this.fs.readBytes(rel));
  }

  async readTextFile(rel: string): Promise<string> {
    if (saveRefusal(rel)) throw new Error(MAC_ONLY_HINT);
    return this.fs.readText(rel);
  }

  async readOptional(rel: string): Promise<string | null> {
    if (saveRefusal(rel)) return null;
    try {
      return await this.fs.readText(rel);
    } catch {
      return null;
    }
  }

  async listSourcePdfs(): Promise<string[]> {
    try {
      const items = await this.fs.readDir('sources');
      return items
        .filter((item) => !item.isDir && item.name.toLowerCase().endsWith('.pdf'))
        .map((item) => `sources/${item.name}`);
    } catch {
      return [];
    }
  }

  async mkdir(name: string): Promise<{ ok: boolean; error?: string }> {
    const clean = name.trim();
    if (!clean || clean.startsWith('.') || clean.includes('/') || clean.includes('\\')) {
      return { ok: false, error: MAC_ONLY_HINT };
    }
    await this.fs.mkdir(clean);
    this.emit({ type: 'filetreeChanged' });
    return { ok: true };
  }

  async placeImage(fileName: string, data: Uint8Array): Promise<string | null> {
    if (!this.currentRel) return null;
    const safe = safeAssetName(fileName);
    if (!safe) return null;
    let dest = `assets/${safe}`;
    if (await this.fs.exists(dest)) {
      const dot = safe.lastIndexOf('.');
      const stem = safe.slice(0, dot);
      const ext = safe.slice(dot);
      let n = 2;
      while (await this.fs.exists(`assets/${stem}-${n}${ext}`)) n++;
      dest = `assets/${stem}-${n}${ext}`;
    }
    try {
      await this.fs.mkdir('assets');
    } catch {
      /* the folder is already there */
    }
    await this.fs.writeBytes(dest, data);
    this.emit({ type: 'filetreeChanged' });
    const src = relativeBetween(this.currentRel, dest);
    this.emit({ type: 'insertImage', src });
    return src;
  }

  async readImage(src: string, baseDir: string): Promise<Uint8Array | null> {
    const rel = joinRel(baseDir, src);
    if (!rel) return null;
    try {
      return await this.fs.readBytes(rel);
    } catch {
      return null;
    }
  }

  async pushCitations(): Promise<void> {
    const rels = await this.collectFiles('');
    const chapterDir = this.currentRel?.includes('/')
      ? this.currentRel.slice(0, this.currentRel.lastIndexOf('/'))
      : '';
    const nearby = rels.filter((p) => {
      const dir = p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '';
      return dir === '' || dir === chapterDir;
    });
    const entries: Array<{ citekey: string; author: string; title: string; year: string; type: string }> = [];
    for (const bib of bibReadOrder(nearby)) {
      try {
        const text = await this.fs.readText(bib);
        for (const entry of parseBibFile(text)) {
          entries.push({
            citekey: entry.citekey,
            author: entry.author || entry.fields.author || '',
            title: entry.title || entry.fields.title || '',
            year: entry.year || entry.fields.year || entry.fields.date || '',
            type: entry.type,
          });
        }
      } catch {
        /* a missing bibliography is an empty completion list */
      }
    }
    this.emit({ type: 'citationData', entries });
  }

  async handle(msg: HostMessage): Promise<void> {
    switch (msg.type) {
      case 'ready':
        if (this.currentRel) await this.openRel(this.currentRel);
        break;
      case 'edit':
        await this.edit(typeof msg.content === 'string' ? msg.content : '');
        break;
      case 'requestCitations':
        await this.pushCitations();
        break;
      case 'deserializeError':
        console.error('[penwright] Deserialize error in renderer:', msg.error);
        break;
      case 'dropImagePath': {
        const raw = typeof msg.path === 'string' ? msg.path : '';
        if (this.currentRel && raw && !saveRefusal(raw)) {
          this.emit({ type: 'insertImage', src: relativeBetween(this.currentRel, raw) });
        }
        break;
      }
      default:
        break;
    }
  }

  /** Labels for the reference picker. Same shape the Mac scanner returns. */
  async listLabels(): Promise<{ labels: Array<{ label: string; type: string; caption: string; filePath: string; relPath: string; line: number }>; truncated: boolean }> {
    const labels: Array<{ label: string; type: string; caption: string; filePath: string; relPath: string; line: number }> = [];
    const re = /<([a-zA-Z][\w:.-]*)>/g;
    for (const rel of await this.collectFiles('')) {
      if (!rel.endsWith('.typ') || rel.startsWith('versions/')) continue;
      let text = '';
      try {
        text = rel === this.currentRel ? this.currentContent : await this.fs.readText(rel);
      } catch {
        continue;
      }
      const lines = text.split('\n');
      for (let i = 0; i < lines.length; i++) {
        re.lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = re.exec(lines[i]))) {
          labels.push({
            label: match[1],
            type: refTypeFromLabel(match[1]),
            caption: match[1],
            filePath: rel,
            relPath: rel,
            line: i + 1,
          });
          if (labels.length >= 2000) return { labels, truncated: true };
        }
      }
    }
    return { labels, truncated: false };
  }

  async listVersions(): Promise<VersionGroup[]> {
    const files = await this.versionFiles('versions');
    const grouped = new Map<string, VersionGroup['versions']>();
    for (const file of files) {
      const source = sourceOfVersion(file);
      const base = file.split('/').pop() ?? '';
      if (!source || !base.toLowerCase().endsWith('.typ')) continue;
      const versions = grouped.get(source) ?? [];
      versions.push({ name: base.replace(/\.typ$/i, ''), path: file });
      grouped.set(source, versions);
    }
    return [...grouped.entries()]
      .map(([source, versions]) => ({
        source,
        versions: versions.sort((a, b) => a.name.localeCompare(b.name)),
      }))
      .sort((a, b) => a.source.localeCompare(b.source));
  }

  /**
   * Every version file under `versions/`. A folder named `main.typ` is the
   * chapter, not a file — the dot rule used for the rest of the project does
   * not apply here.
   */
  private async versionFiles(dir: string): Promise<string[]> {
    let entries: Array<{ name: string; path: string }> = [];
    try {
      entries = await this.fs.readDir(dir);
    } catch {
      return [];
    }
    const rest = dir === 'versions' ? '' : dir.startsWith('versions/') ? dir.slice('versions/'.length) : dir;
    const insideChapter = rest.endsWith('.typ') || rest.endsWith('.typst');
    const out: string[] = [];
    for (const entry of entries) {
      if (!entry.name || entry.name.startsWith('.')) continue;
      const child = `${dir}/${entry.name}`.replace(/\/+/g, '/');
      if (insideChapter) {
        if (entry.name.toLowerCase().endsWith('.typ')) out.push(child);
        continue;
      }
      const folder = !entry.name.includes('.') || entry.name.endsWith('.typ') || entry.name.endsWith('.typst');
      if (folder) out.push(...await this.versionFiles(child));
    }
    return out;
  }

  async suggestVersion(sourceRel: string): Promise<string> {
    const folder = `versions/${sourceRel}`;
    let names: string[] = [];
    try {
      names = (await this.fs.readDir(folder))
        .filter((e) => e.name.toLowerCase().endsWith('.typ'))
        .map((e) => e.name);
    } catch {
      names = [];
    }
    return suggestVersionName(sourceRel, names);
  }

  async createVersion(sourceRel: string, name: string, content: string): Promise<{ ok: boolean; path?: string; error?: string }> {
    const rel = versionFileRel(sourceRel, name);
    if (!rel) return { ok: false, error: 'name' };
    if (await this.fs.exists(rel)) return { ok: false, error: 'exists' };
    await this.fs.writeText(rel, content);
    this.emit({ type: 'filetreeChanged' });
    return { ok: true, path: rel };
  }

  async swapVersion(
    versionRel: string,
    liveContent?: string,
    versionContent?: string,
  ): Promise<{ ok: boolean; error?: string }> {
    const source = sourceOfVersion(versionRel);
    if (!source) return { ok: false, error: 'name' };
    let versionText: string;
    let liveText: string;
    try {
      versionText = versionContent ?? await this.fs.readText(versionRel);
      liveText = liveContent ?? await this.fs.readText(source);
    } catch {
      return { ok: false, error: 'missing' };
    }
    const next = swapped(liveText, versionText);
    await this.fs.writeText(versionRel, next.version);
    await this.fs.writeText(source, next.live);
    if (this.currentRel === source) {
      this.currentContent = next.live;
      this.emit({ type: 'update', content: next.live });
    } else if (this.currentRel === versionRel) {
      this.currentContent = next.version;
      this.emit({ type: 'update', content: next.version });
    }
    this.emit({ type: 'filetreeChanged' });
    return { ok: true };
  }

  async renameVersion(versionRel: string, name: string): Promise<{ ok: boolean; path?: string; error?: string }> {
    const source = sourceOfVersion(versionRel);
    const next = source ? versionFileRel(source, name) : null;
    if (!source || !next) return { ok: false, error: 'name' };
    if (next === versionRel) return { ok: true, path: versionRel };
    if (await this.fs.exists(next)) return { ok: false, error: 'exists' };
    let content: string;
    try {
      content = await this.fs.readText(versionRel);
    } catch {
      return { ok: false, error: 'missing' };
    }
    await this.fs.writeText(next, content);
    await this.fs.remove(versionRel);
    if (this.currentRel === versionRel) this.currentRel = next;
    this.emit({ type: 'filetreeChanged' });
    return { ok: true, path: next };
  }

  async createProjectBackup(maxCount: number): Promise<BackupSnapshot | null> {
    const live = this.currentRel
      ? { rel: this.currentRel, content: this.currentContent }
      : null;
    return createBackup(this.fs, live, maxCount);
  }

  async projectBackups(): Promise<BackupSnapshot[]> {
    return listBackups(this.fs);
  }

  async restoreBackup(stamp: string): Promise<{ ok: boolean; restored: number }> {
    const result = await applyBackup(this.fs, stamp);
    const open = result.files.find((file) => file.rel === this.currentRel);
    if (open) {
      this.currentContent = open.content;
      this.emit({ type: 'update', content: open.content });
    }
    if (result.restored > 0) this.emit({ type: 'filetreeChanged' });
    return { ok: result.ok, restored: result.restored };
  }

  async aiSnapshots(): Promise<Array<{ timestamp: number; filePath: string; bytes: number }>> {
    return listAiSnapshots(this.fs);
  }

  async undoAiSnapshot(): Promise<{ undone: boolean; count: number }> {
    const result = await undoLastAi(this.fs, this.folderName);
    if (result.undone && result.rel && result.content !== null) {
      if (this.currentRel === result.rel) {
        this.currentContent = result.content;
        this.emit({ type: 'update', content: result.content });
      }
      this.emit({ type: 'filetreeChanged' });
    }
    return { undone: result.undone, count: result.count };
  }

  async publishAiLimit(limit: number): Promise<void> {
    await publishSnapshotLimit(this.fs, limit);
  }

  async deleteVersion(versionRel: string): Promise<{ ok: boolean; error?: string }> {
    if (!sourceOfVersion(versionRel)) return { ok: false, error: 'name' };
    try {
      await this.fs.remove(versionRel);
    } catch {
      return { ok: false, error: 'missing' };
    }
    this.emit({ type: 'filetreeChanged' });
    return { ok: true };
  }

  private async list(dir: string): Promise<Array<{ name: string; rel: string; kind: 'dir' | 'file' }>> {
    const items = await this.fs.readDir(dir);
    const out: Array<{ name: string; rel: string; kind: 'dir' | 'file' }> = [];
    for (const item of items) {
      const kind = entryKind(item.name);
      if (kind === 'skip') continue;
      const rel = dir ? `${dir}/${item.name}` : item.name;
      if (kind === 'file') {
        out.push({ name: item.name, rel, kind: 'file' });
        continue;
      }
      try {
        await this.fs.readDir(rel);
        out.push({ name: item.name, rel, kind: 'dir' });
      } catch {
        /* not a folder, and not a file we can open */
      }
    }
    return out;
  }

  private async collectFiles(dir: string, depth = 0): Promise<string[]> {
    if (depth > 5) return [];
    const out: string[] = [];
    for (const item of await this.list(dir)) {
      if (item.kind === 'dir') out.push(...await this.collectFiles(item.rel, depth + 1));
      else out.push(item.rel);
    }
    return out;
  }

  private async buildTree(dir: string, depth = 0): Promise<TreeEntry[]> {
    if (depth > 5) return [];
    const result: TreeEntry[] = [];
    for (const item of await this.list(dir)) {
      if (item.kind === 'dir') {
        result.push({
          name: item.name,
          path: item.rel,
          isDir: true,
          children: await this.buildTree(item.rel, depth + 1),
        });
      } else {
        result.push({ name: item.name, path: item.rel, isDir: false });
      }
    }
    result.sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    return result;
  }
}
