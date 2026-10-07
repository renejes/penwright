/**
 * Citation PDF lookup.
 *
 * Without a Zotero link this is the old `sources/<citekey>.pdf` search.
 * With a link: the bib entry's `file` field, then a PDF in the chosen
 * attachment folder whose name starts with the citekey, then — only when
 * that entry has no `file` field and Zotero is running — the local API,
 * and `sources/` last.
 *
 * Paths outside the project are remembered so the PDF tab can read them.
 * They are never written into the project unless the link says copy-on-open,
 * and that copy happens in {@link openCitationPdf}, not in the lookup.
 */

import * as fs from 'fs';
import * as path from 'path';
import { locateCitationPdf, type ZoteroPdfMode } from '../shared/citationPdf';
import { isPathWithin } from './pathSecurity';
import { readZoteroLink } from './zoteroLink';
import { zoteroAttachmentPdf } from './zoteroLocal';

export interface CitationSourceHit {
  path: string | null;
  /** A Zotero link is configured, so the UI must not send the reader to sources/. */
  linked: boolean;
  inProject: boolean;
}

const notedOutside = new Set<string>();

/** A PDF the lookup resolved outside the project. The renderer may read this path and no other. */
export function noteCitationPdf(filePath: string): void {
  notedOutside.add(path.resolve(filePath));
}

export function isNotedCitationPdf(filePath: string): boolean {
  if (!filePath) return false;
  return notedOutside.has(path.resolve(filePath));
}

export async function findSourceForCitation(projectDir: string, citekey: string): Promise<CitationSourceHit> {
  const empty: CitationSourceHit = { path: null, linked: false, inProject: false };
  if (!projectDir || !citekey) return empty;

  const link = resolveLink(projectDir);
  const linked = link !== null;
  const bibText = linked ? readBib(path.join(projectDir, 'zotero.bib')) : null;
  const located = await locateCitationPdf({
    citekey,
    projectDir,
    linked,
    attachmentDir: link?.attachmentDir ?? null,
    bibText,
    io: diskIo(),
    queryZotero: linked ? zoteroAttachmentPdf : undefined,
  });
  if (!located) return { path: null, linked, inProject: false };

  const inProject = isPathWithin(located.path, projectDir);
  if (!inProject) noteCitationPdf(located.path);
  return { path: located.path, linked, inProject };
}

/**
 * The path the Open PDF button should open. In copy mode an outside file is
 * copied once to `sources/<citekey>.pdf` and that copy is returned. Linked
 * mode returns the outside path and writes nothing.
 */
export async function openCitationPdf(projectDir: string, citekey: string): Promise<string | null> {
  const hit = await findSourceForCitation(projectDir, citekey);
  if (!hit.path) return null;
  const link = resolveLink(projectDir);
  if (link?.pdfMode === 'copy' && !hit.inProject) {
    const dest = copyIntoSources(projectDir, citekey, hit.path);
    if (dest) return dest;
  }
  if (!hit.inProject) noteCitationPdf(hit.path);
  return hit.path;
}

/**
 * A project is linked when `.penwright/zotero.json` says so, or when an older
 * session already left a `zotero.bib` and no mode file (those stay linked,
 * with no attachment folder).
 */
function resolveLink(projectDir: string): { pdfMode: ZoteroPdfMode; attachmentDir: string | null } | null {
  const saved = readZoteroLink(projectDir);
  if (saved) return saved;
  if (fs.existsSync(path.join(projectDir, 'zotero.bib'))) {
    return { pdfMode: 'linked', attachmentDir: null };
  }
  return null;
}

function readBib(filePath: string): string | null {
  try { return fs.readFileSync(filePath, 'utf-8'); } catch { return null; }
}

function diskIo() {
  return {
    exists(filePath: string): boolean {
      try { return fs.statSync(filePath).isFile(); } catch { return false; }
    },
    listPdfNames(dir: string): string[] {
      try {
        return fs.readdirSync(dir).filter((name) => name.toLowerCase().endsWith('.pdf'));
      } catch {
        return [];
      }
    },
  };
}

function copyIntoSources(projectDir: string, citekey: string, src: string): string | null {
  const safe = citekey.replace(/[/\\:]/g, '_');
  const dest = path.join(projectDir, 'sources', `${safe}.pdf`);
  if (!isPathWithin(dest, projectDir)) return null;
  if (!fs.existsSync(src)) return null;
  try {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(src, dest);
    }
    return dest;
  } catch (err) {
    console.warn('[penwright] citation PDF copy failed:', err);
    return null;
  }
}
