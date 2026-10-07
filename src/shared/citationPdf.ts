/**
 * Where a citation's PDF lives, and how a typed page becomes `@key[S. 12]`.
 *
 * The .bib stays the bibliography. A linked Zotero export may point at a PDF
 * that lives outside the project (Dropbox, a linked-attachment folder). That
 * path is opened, not copied, unless the project chose copy-on-open. A project
 * with no Zotero link still looks only in `sources/`.
 */

import * as path from 'path';
import { parseBibFile } from './bibParser';

export type ZoteroPdfMode = 'linked' | 'copy';

export interface CitationPdfIo {
  exists(filePath: string): boolean;
  /** PDF file names in a directory. Empty when the directory is missing. */
  listPdfNames(dir: string): string[];
}

export interface LocateCitationPdfInput {
  citekey: string;
  projectDir: string;
  /** False: behave as before this link existed — `sources/` only. */
  linked: boolean;
  attachmentDir: string | null;
  bibText: string | null;
  io: CitationPdfIo;
  /**
   * Asked only when the bib entry has no `file` field and Zotero's local API
   * might be up. Return an absolute PDF path, or null.
   */
  queryZotero?: (citekey: string) => Promise<string | null>;
}

export interface LocatedCitationPdf {
  path: string;
  via: 'file' | 'attachment' | 'zotero' | 'sources';
}

const CITEKEY_PATTERN = /^[\w:.-]+$/;

/** `12` → `S. 12`, `12-14` → `S. 12–14`. Empty stays empty. `f.` / `ff.` are dropped. */
export function formatCitationPage(raw: string): string | null {
  let s = raw.trim();
  if (!s) return null;
  s = s.replace(/\s+f{1,2}\.?\s*$/i, '').trim();
  s = s.replace(/^(?:S\.|pp?\.)\s*/i, '').trim();
  s = s.replace(/\s*[-–—]\s*/g, '–');
  if (!/^\d+(?:–\d+)?$/.test(s)) return null;
  return `S. ${s}`;
}

/** What the page field shows for a supplement already stored on the citation. */
export function pageFieldFromSupplement(supplement: string): string {
  return supplement.replace(/^S\.\s*/i, '').trim();
}

/**
 * Better BibTeX `file` values. Each chunk is `description:path:mime` or
 * `:path:mime`; colons and semicolons in the path are escaped.
 * PDF chunks only, in order.
 */
export function bibFilePdfPaths(fileField: string): string[] {
  const out: string[] = [];
  for (const chunk of splitUnescaped(fileField, ';')) {
    const segs = splitUnescaped(chunk, ':');
    const mime = segs[segs.length - 1] ?? '';
    const isPdf = /pdf/i.test(mime) || /\.pdf$/i.test(segs[segs.length - 2] ?? '') || /\.pdf$/i.test(chunk);
    if (!isPdf) continue;
    const pathSeg = segs.length >= 3 ? segs[segs.length - 2] : segs.filter(Boolean).pop();
    const filePath = (pathSeg ?? '').trim();
    if (filePath && /\.pdf$/i.test(filePath)) out.push(filePath);
  }
  return out;
}

export function pdfNameMatchesCitekey(fileName: string, citekey: string): boolean {
  const lc = fileName.toLowerCase();
  if (!lc.endsWith('.pdf')) return false;
  const stem = lc.slice(0, -4);
  const key = citekey.toLowerCase();
  return stem === key
    || stem.startsWith(key + '_')
    || stem.startsWith(key + '-')
    || stem.startsWith(key + ' ')
    || stem.startsWith(key + '.');
}

export async function locateCitationPdf(input: LocateCitationPdfInput): Promise<LocatedCitationPdf | null> {
  const { citekey, projectDir, io } = input;
  if (!projectDir || !citekey || !CITEKEY_PATTERN.test(citekey)) return null;

  if (input.linked) {
    const fromFile = firstExisting(bibPdfCandidates(input.bibText, citekey), io);
    if (fromFile) return { path: fromFile, via: 'file' };

    const fromFolder = attachmentHit(input.attachmentDir, citekey, io);
    if (fromFolder) return { path: fromFolder, via: 'attachment' };

    if (!entryHasFileField(input.bibText, citekey) && input.queryZotero) {
      try {
        const fromApi = await input.queryZotero(citekey);
        if (fromApi && io.exists(fromApi)) return { path: fromApi, via: 'zotero' };
      } catch {
        // Zotero not running, or the local API refused. The .bib result stands.
      }
    }
  }

  const fromSources = sourcesHit(projectDir, citekey, io);
  if (fromSources) return { path: fromSources, via: 'sources' };
  return null;
}

function bibPdfCandidates(bibText: string | null, citekey: string): string[] {
  if (!bibText) return [];
  const entry = parseBibFile(bibText).find((e) => e.citekey === citekey);
  const field = entry?.fields['file'];
  if (!field?.trim()) return [];
  return bibFilePdfPaths(field);
}

function entryHasFileField(bibText: string | null, citekey: string): boolean {
  if (!bibText) return false;
  const entry = parseBibFile(bibText).find((e) => e.citekey === citekey);
  return !!entry?.fields['file']?.trim();
}

function attachmentHit(dir: string | null, citekey: string, io: CitationPdfIo): string | null {
  if (!dir) return null;
  const names = io.listPdfNames(dir);
  const exact = names.find((n) => n.toLowerCase() === `${citekey.toLowerCase()}.pdf`);
  const prefixed = exact ?? names.find((n) => pdfNameMatchesCitekey(n, citekey));
  if (!prefixed) return null;
  const full = path.join(dir, prefixed);
  return io.exists(full) ? full : null;
}

function sourcesHit(projectDir: string, citekey: string, io: CitationPdfIo): string | null {
  return attachmentHit(path.join(projectDir, 'sources'), citekey, io);
}

function firstExisting(paths: string[], io: CitationPdfIo): string | null {
  for (const p of paths) {
    if (p && io.exists(p)) return p;
  }
  return null;
}

function splitUnescaped(s: string, sep: ';' | ':'): string[] {
  const out: string[] = [];
  let cur = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '\\' && i + 1 < s.length) {
      cur += s[i + 1];
      i++;
      continue;
    }
    if (ch === sep) {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}
