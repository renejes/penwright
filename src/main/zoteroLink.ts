/**
 * Per-project Zotero link. The .bib copy stays `zotero.bib` in the project.
 * This file only records how PDFs are found: left where Zotero stores them,
 * or copied into `sources/` the moment one is opened.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { ZoteroPdfMode } from '../shared/citationPdf';

export interface ZoteroLink {
  sourceBibPath: string;
  pdfMode: ZoteroPdfMode;
  attachmentDir: string | null;
}

export function zoteroLinkPath(projectDir: string): string {
  return path.join(projectDir, '.penwright', 'zotero.json');
}

export function readZoteroLink(projectDir: string): ZoteroLink | null {
  try {
    const raw = fs.readFileSync(zoteroLinkPath(projectDir), 'utf-8');
    const parsed = JSON.parse(raw) as Partial<ZoteroLink>;
    if (parsed.pdfMode !== 'linked' && parsed.pdfMode !== 'copy') return null;
    return {
      sourceBibPath: typeof parsed.sourceBibPath === 'string' ? parsed.sourceBibPath : '',
      pdfMode: parsed.pdfMode,
      attachmentDir: typeof parsed.attachmentDir === 'string' && parsed.attachmentDir ? parsed.attachmentDir : null,
    };
  } catch {
    return null;
  }
}

export function writeZoteroLink(projectDir: string, link: ZoteroLink): void {
  const dest = zoteroLinkPath(projectDir);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, JSON.stringify(link, null, 2) + '\n', 'utf-8');
}
