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
import { bibFilePdfPaths, pdfNameMatchesCitekey } from './zoteroPdfMatch';

export { bibFilePdfPaths, pdfNameMatchesCitekey };

export { formatCitationPage, pageFieldFromSupplement } from './citationPage';

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

