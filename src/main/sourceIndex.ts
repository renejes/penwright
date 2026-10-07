/**
 * Turns the linked bibliography's PDFs into page text and keeps that text
 * under `.penwright/source-index/`. The PDF stays where it is. The index is
 * rebuilt only when the file's size or modification time changes.
 */

import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { parseBibFile, type BibEntry } from '../shared/bibParser';
import { locateCitationPdf } from '../shared/citationPdf';
import {
  queryTerms,
  readPaperPages,
  searchPaperTexts,
  type PageWindow,
  type PaperText,
  type SourceHit,
} from '../shared/sourceSearch';
import { findBibFiles } from '../shared/bibDiscovery';
import { readZoteroLink } from './zoteroLink';
import { zoteroAttachmentPdf } from './zoteroLocal';

interface StoredIndex {
  v: 1;
  path: string;
  mtimeMs: number;
  size: number;
  pageMode: PaperText['pageMode'];
  pages: PaperText['pages'];
}

export interface SourceSearchReport {
  library: string;
  papers: number;
  withPdf: number;
  terms: string[];
  missingCitekeys: string[];
  hits: SourceHit[];
}

export async function searchProjectSources(
  projectDir: string,
  query: string,
  opts: { citekeys?: string[]; limit?: number } = {},
): Promise<SourceSearchReport> {
  const { library, entries } = loadLibrary(projectDir);
  const wanted = opts.citekeys?.map(c => c.trim()).filter(Boolean);
  const papers = await loadPapers(projectDir, entries, wanted);
  const hits = searchPaperTexts(papers, query, opts.limit ?? 10);
  return {
    library,
    papers: papers.length,
    withPdf: papers.filter(p => p.pages.length > 0).length,
    terms: queryTerms(query),
    missingCitekeys: (wanted ?? []).filter(key => !entries.some(e => e.citekey === key)),
    hits,
  };
}

export async function readProjectSource(
  projectDir: string,
  citekey: string,
  pages?: string,
): Promise<PageWindow & { found: boolean; pdf: boolean }> {
  const { entries } = loadLibrary(projectDir);
  const entry = entries.find(e => e.citekey === citekey);
  if (!entry) {
    return {
      found: false,
      pdf: false,
      citekey,
      title: '',
      pageKind: 'file',
      note: `No entry ${citekey} in the linked bibliography.`,
      pages: [],
      truncated: false,
    };
  }
  const paper = await paperFromEntry(projectDir, entry);
  if (!paper.pages.length) {
    return {
      found: true,
      pdf: false,
      citekey,
      title: paper.title,
      pageKind: 'file',
      note: 'No readable PDF for this entry. The file is not in the bibliography path, the attachment folder, or sources/.',
      pages: [],
      truncated: false,
    };
  }
  return { found: true, pdf: true, ...readPaperPages(paper, pages) };
}

function loadLibrary(projectDir: string): { library: string; entries: BibEntry[] } {
  const zotero = path.join(projectDir, 'zotero.bib');
  if (fs.existsSync(zotero)) {
    return { library: 'zotero.bib', entries: parseBibFile(fs.readFileSync(zotero, 'utf-8')) };
  }
  const entries: BibEntry[] = [];
  const seen = new Set<string>();
  for (const file of findBibFiles(projectDir, null)) {
    for (const entry of parseBibFile(fs.readFileSync(file, 'utf-8'))) {
      if (seen.has(entry.citekey)) continue;
      seen.add(entry.citekey);
      entries.push(entry);
    }
  }
  return { library: 'project bib files', entries };
}

async function loadPapers(projectDir: string, entries: BibEntry[], citekeys?: string[]): Promise<PaperText[]> {
  const list = citekeys?.length
    ? citekeys.map(key => entries.find(e => e.citekey === key)).filter((e): e is BibEntry => !!e)
    : entries;
  const papers: PaperText[] = [];
  for (const entry of list) papers.push(await paperFromEntry(projectDir, entry));
  return papers;
}

async function paperFromEntry(projectDir: string, entry: BibEntry): Promise<PaperText> {
  const base: PaperText = {
    citekey: entry.citekey,
    title: entry.title || '',
    abstract: entry.fields['abstract'] || '',
    author: entry.author || '',
    year: entry.year || '',
    pageMode: 'index',
    pages: [],
  };
  const pdf = await resolvePdf(projectDir, entry.citekey);
  if (!pdf) return base;
  const indexed = await indexedPages(projectDir, pdf);
  if (!indexed) return base;
  return { ...base, pageMode: indexed.pageMode, pages: indexed.pages };
}

async function resolvePdf(projectDir: string, citekey: string): Promise<string | null> {
  const link = readZoteroLink(projectDir);
  const linked = link !== null || fs.existsSync(path.join(projectDir, 'zotero.bib'));
  const bibPath = path.join(projectDir, 'zotero.bib');
  const bibText = fs.existsSync(bibPath) ? fs.readFileSync(bibPath, 'utf-8') : null;
  const located = await locateCitationPdf({
    citekey,
    projectDir,
    linked,
    attachmentDir: link?.attachmentDir ?? null,
    bibText,
    io: {
      exists(filePath: string): boolean {
        try { return fs.statSync(filePath).isFile(); } catch { return false; }
      },
      listPdfNames(dir: string): string[] {
        try { return fs.readdirSync(dir).filter(n => n.toLowerCase().endsWith('.pdf')); }
        catch { return []; }
      },
    },
    queryZotero: linked ? zoteroAttachmentPdf : undefined,
  });
  return located?.path ?? null;
}

async function indexedPages(projectDir: string, pdfPath: string): Promise<Pick<StoredIndex, 'pageMode' | 'pages'> | null> {
  let stat: fs.Stats;
  try { stat = fs.statSync(pdfPath); } catch { return null; }
  const file = indexFile(projectDir, pdfPath);
  const cached = readIndex(file);
  if (cached && cached.path === pdfPath && cached.mtimeMs === stat.mtimeMs && cached.size === stat.size) {
    return cached;
  }
  let extracted: Pick<StoredIndex, 'pageMode' | 'pages'>;
  try {
    extracted = await extractPdf(pdfPath);
  } catch (err) {
    console.warn('[penwright] source PDF text failed:', err);
    return null;
  }
  const stored: StoredIndex = {
    v: 1,
    path: pdfPath,
    mtimeMs: stat.mtimeMs,
    size: stat.size,
    ...extracted,
  };
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(stored));
    fs.renameSync(tmp, file);
  } catch {
    // The search still works from memory when the project folder rejects the cache.
  }
  return extracted;
}

function indexFile(projectDir: string, pdfPath: string): string {
  const hash = createHash('sha256').update(path.resolve(pdfPath)).digest('hex').slice(0, 16);
  return path.join(projectDir, '.penwright', 'source-index', `${hash}.json`);
}

function readIndex(file: string): StoredIndex | null {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf-8')) as StoredIndex;
    if (parsed.v !== 1 || !Array.isArray(parsed.pages)) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function extractPdf(pdfPath: string): Promise<Pick<StoredIndex, 'pageMode' | 'pages'>> {
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const doc = await getDocument({ data, isEvalSupported: false, verbosity: 0 }).promise;
  try {
    const labels = await doc.getPageLabels();
    const pages: StoredIndex['pages'] = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const content = await page.getTextContent();
      let text = '';
      for (const item of content.items) {
        if (!item || typeof item !== 'object' || !('str' in item)) continue;
        text += item.str;
        text += item.hasEOL ? '\n' : ' ';
      }
      text = text.replace(/[ \t]+\n/g, '\n').replace(/[ \t]{2,}/g, ' ').trim();
      if (text.length > 200_000) text = text.slice(0, 200_000);
      const label = labels?.[n - 1]?.trim() || String(n);
      pages.push({ pdfPage: n, label, text });
    }
    const pageMode = pages.some(p => p.label !== String(p.pdfPage)) ? 'labels' : 'index';
    return { pageMode, pages };
  } finally {
    await doc.destroy();
  }
}
