/**
 * Search and page-window reading over papers that are already text.
 *
 * The library is every entry in the linked bibliography, cited or not.
 * A hit is a place to look: citekey, page, and the paragraph around the
 * words. It is not a formatted citation.
 */

export interface IndexedPage {
  /** 1-based page in the file. */
  pdfPage: number;
  /** Printed label when the PDF has one, otherwise the file page number. */
  label: string;
  text: string;
}

export interface PaperText {
  citekey: string;
  title: string;
  abstract: string;
  author: string;
  year: string;
  /** `labels` when any printed label differs from the file page number. */
  pageMode: 'labels' | 'index';
  pages: IndexedPage[];
}

export interface SourceHit {
  citekey: string;
  author: string;
  year: string;
  title: string;
  where: 'title' | 'abstract' | 'page';
  /** Printed label or file page, whichever `pageKind` names. */
  page?: string;
  pdfPage?: number;
  pageKind?: 'label' | 'file';
  snippet: string;
}

export interface PageWindow {
  citekey: string;
  title: string;
  pageKind: 'label' | 'file';
  note: string;
  pages: { pdfPage: number; label: string; text: string }[];
  truncated: boolean;
}

const STOP = new Set([
  'the', 'and', 'for', 'was', 'are', 'with', 'from', 'that', 'this', 'what', 'which', 'about',
  'der', 'die', 'das', 'den', 'dem', 'des', 'ein', 'eine', 'einer', 'einem', 'und', 'oder',
  'ist', 'sind', 'sich', 'nicht', 'auch', 'wie', 'für', 'bei', 'aus', 'nach', 'dass', 'daß',
  'steht', 'quellen', 'quelle', 'paper', 'papers', 'über', 'uber', 'zum', 'zur', 'von', 'vom',
  'auf', 'mit', 'im', 'in', 'zu', 'an',
]);

const SNIPPET = 480;
const MAX_HITS = 10;
const MAX_PER_PAPER = 2;
export const READ_DEFAULT_PAGES = 2;
export const READ_MAX_PAGES = 8;
export const READ_MAX_CHARS = 30_000;

/** Words worth searching for. A hyphenated term stays one word. Glue words drop out. */
export function queryTerms(query: string): string[] {
  const parts = query.toLowerCase().split(/[^\p{L}\p{N}-]+/u).map(t => t.replace(/^-+|-+$/g, '')).filter(Boolean);
  const kept = parts.filter(t => t.length >= 3 && !STOP.has(t));
  const terms = (kept.length ? kept : parts.filter(t => t.length >= 2)).slice(0, 8);
  return [...new Set(terms)];
}

function hasTerm(hay: string, term: string): boolean {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|[^\\p{L}\\p{N}])${escaped}(?:$|[^\\p{L}\\p{N}])`, 'iu').test(hay);
}

export function parsePageSpec(spec: string): { start: number; end: number } | null {
  const s = spec.trim().replace(/\s+/g, '');
  const m = s.match(/^(\d+)(?:[-–—](\d+))?$/);
  if (!m) return null;
  let start = parseInt(m[1], 10);
  let end = m[2] ? parseInt(m[2], 10) : start;
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 1 || end < 1) return null;
  if (end < start) [start, end] = [end, start];
  return { start, end };
}

export function searchPaperTexts(papers: PaperText[], query: string, limit = MAX_HITS): SourceHit[] {
  const terms = queryTerms(query);
  if (!terms.length) return [];
  const cap = Math.max(1, Math.min(limit, MAX_HITS));
  const found: SourceHit[] = [];

  for (const paper of papers) {
    const meta = metaHit(paper, terms);
    if (meta) found.push(meta);
    const pages = paper.pages
      .map(page => pageHit(paper, page, terms))
      .filter((h): h is SourceHit => !!h)
      .sort((a, b) => score(b, terms) - score(a, terms) || (a.pdfPage ?? 0) - (b.pdfPage ?? 0));
    found.push(...pages.slice(0, MAX_PER_PAPER));
  }

  found.sort((a, b) => {
    const byScore = score(b, terms) - score(a, terms);
    if (byScore) return byScore;
    if (a.where === 'page' && b.where !== 'page') return -1;
    if (b.where === 'page' && a.where !== 'page') return 1;
    return a.citekey.localeCompare(b.citekey);
  });

  const perPaper = new Map<string, number>();
  const out: SourceHit[] = [];
  for (const hit of found) {
    const n = perPaper.get(hit.citekey) ?? 0;
    if (n >= MAX_PER_PAPER) continue;
    perPaper.set(hit.citekey, n + 1);
    out.push(hit);
    if (out.length >= cap) break;
  }
  return out;
}

export function readPaperPages(paper: PaperText, spec?: string): PageWindow {
  const ordered = [...paper.pages].sort((a, b) => a.pdfPage - b.pdfPage);
  let chosen: IndexedPage[];
  let pageKind: 'label' | 'file';
  let note: string;
  let truncated = false;

  if (!spec?.trim()) {
    chosen = ordered.slice(0, READ_DEFAULT_PAGES);
    pageKind = paper.pageMode === 'labels' ? 'label' : 'file';
    note = pageKind === 'label'
      ? 'First pages, numbered by the PDF’s printed labels.'
      : 'First pages of the file. This PDF has no printed page labels, so a citation page S. n may not be this file page.';
  } else {
    const range = parsePageSpec(spec);
    if (!range) {
      return {
        citekey: paper.citekey,
        title: paper.title,
        pageKind: 'file',
        note: `Could not read “${spec.trim()}” as a page or range like 12 or 12-14.`,
        pages: [],
        truncated: false,
      };
    }
    const byLabel = ordered.filter(p => {
      const n = Number(p.label);
      return p.label === String(n) && n >= range.start && n <= range.end;
    });
    if (paper.pageMode === 'labels' && byLabel.length) {
      chosen = byLabel;
      pageKind = 'label';
      note = 'These page numbers are the PDF’s printed labels, not necessarily the file’s page count.';
    } else {
      chosen = ordered.filter(p => p.pdfPage >= range.start && p.pdfPage <= range.end);
      pageKind = 'file';
      note = paper.pageMode === 'labels'
        ? 'No printed label matched that range, so these are file page numbers.'
        : 'File page numbers. This PDF has no printed page labels, so S. n in a citation may differ.';
    }
    if (chosen.length > READ_MAX_PAGES) {
      chosen = chosen.slice(0, READ_MAX_PAGES);
      truncated = true;
      note += ` Only the first ${READ_MAX_PAGES} pages of the requested range are included.`;
    }
  }

  let used = 0;
  const pages: PageWindow['pages'] = [];
  for (const page of chosen) {
    if (used >= READ_MAX_CHARS) { truncated = true; break; }
    const room = READ_MAX_CHARS - used;
    const text = page.text.length > room ? page.text.slice(0, room) : page.text;
    if (text.length < page.text.length) truncated = true;
    used += text.length;
    pages.push({ pdfPage: page.pdfPage, label: page.label, text });
  }

  return { citekey: paper.citekey, title: paper.title, pageKind, note, pages, truncated };
}

function metaHit(paper: PaperText, terms: string[]): SourceHit | null {
  const title = paper.title.toLowerCase();
  const abstract = paper.abstract.toLowerCase();
  const inTitle = terms.filter(t => hasTerm(title, t));
  const inAbstract = terms.filter(t => hasTerm(abstract, t));
  if (inTitle.length >= inAbstract.length && inTitle.length) {
    return base(paper, 'title', undefined, undefined, paper.title);
  }
  if (inAbstract.length) {
    return base(paper, 'abstract', undefined, undefined, snippetAround(paper.abstract, terms));
  }
  return null;
}

function pageHit(paper: PaperText, page: IndexedPage, terms: string[]): SourceHit | null {
  const hay = page.text.toLowerCase();
  if (!terms.some(t => hasTerm(hay, t))) return null;
  const kind = paper.pageMode === 'labels' ? 'label' : 'file';
  const hit = base(paper, 'page', page.label, page.pdfPage, snippetAround(page.text, terms));
  hit.pageKind = kind;
  return hit;
}

function base(
  paper: PaperText,
  where: SourceHit['where'],
  page: string | undefined,
  pdfPage: number | undefined,
  snippet: string,
): SourceHit {
  return {
    citekey: paper.citekey,
    author: paper.author,
    year: paper.year,
    title: paper.title,
    where,
    ...(page !== undefined ? { page, pdfPage } : {}),
    snippet: snippet.replace(/\s+/g, ' ').trim(),
  };
}

function score(hit: SourceHit, terms: string[]): number {
  const hay = hit.snippet.toLowerCase();
  const n = terms.filter(t => hasTerm(hay, t)).length;
  return n + (hit.where === 'page' ? 0.25 : 0);
}

/** A short passage around the terms, not the single matching word. */
export function snippetAround(text: string, terms: string[]): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  if (!flat) return '';
  const lower = flat.toLowerCase();
  let bestAt = -1;
  let best = -1;
  for (let i = 0; i < lower.length; i++) {
    let n = 0;
    const window = lower.slice(i, i + SNIPPET);
    for (const term of terms) if (hasTerm(window, term)) n++;
    if (n > best) { best = n; bestAt = i; }
  }
  if (bestAt < 0) bestAt = 0;
  let start = Math.max(0, bestAt - 80);
  let end = Math.min(flat.length, start + SNIPPET);
  if (start > 0) {
    const sp = flat.indexOf(' ', start);
    if (sp !== -1 && sp < start + 40) start = sp + 1;
  }
  if (end < flat.length) {
    const sp = flat.lastIndexOf(' ', end);
    if (sp > start + 40) end = sp;
  }
  const slice = flat.slice(start, end).trim();
  const prefix = start > 0 ? '… ' : '';
  const suffix = end < flat.length ? ' …' : '';
  return prefix + slice + suffix;
}
