/**
 * Which file in a linked PDF folder belongs to a citekey.
 *
 * The Mac opens the absolute path stored in the bib. On the iPad that path
 * points at another machine, so the match is the file name inside the folder
 * the user picked. Nothing here copies a PDF.
 */

import { parseBibFile } from './bibParser';

const CITEKEY_PATTERN = /^[\w:.-]+$/;

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

export type LinkedPdfHit =
  | { where: 'attachment'; rel: string }
  | { where: 'sources'; rel: string };

/**
 * `attachmentRels` and `sourceRels` are paths relative to their own folder
 * root. A Mac path in the bib contributes only its file name.
 */
export function locateIpadCitationPdf(
  citekey: string,
  bibText: string | null,
  attachmentRels: string[],
  sourceRels: string[],
): LinkedPdfHit | null {
  if (!citekey || !CITEKEY_PATTERN.test(citekey)) return null;
  const hints = fileHints(bibText, citekey);
  for (const hint of hints) {
    const rel = pickNamed(baseName(hint), attachmentRels, hint);
    if (rel) return { where: 'attachment', rel };
  }
  const byKey = attachmentRels.find((rel) => pdfNameMatchesCitekey(baseName(rel), citekey));
  if (byKey) return { where: 'attachment', rel: byKey };
  const inSources = sourceRels.find((rel) => pdfNameMatchesCitekey(baseName(rel), citekey));
  if (inSources) return { where: 'sources', rel: inSources };
  return null;
}

function fileHints(bibText: string | null, citekey: string): string[] {
  if (!bibText) return [];
  const entry = parseBibFile(bibText).find((item) => item.citekey === citekey);
  const field = entry?.fields['file'];
  if (!field?.trim()) return [];
  return bibFilePdfPaths(field);
}

function baseName(filePath: string): string {
  const norm = filePath.replace(/\\/g, '/');
  return norm.split('/').filter(Boolean).pop() ?? norm;
}

function pickNamed(name: string, rels: string[], hint: string): string | null {
  const want = name.toLowerCase();
  const hits = rels.filter((rel) => baseName(rel).toLowerCase() === want);
  if (hits.length === 0) return null;
  const hintNorm = hint.replace(/\\/g, '/').toLowerCase();
  hits.sort((a, b) => suffixScore(hintNorm, b) - suffixScore(hintNorm, a));
  return hits[0];
}

function suffixScore(hint: string, rel: string): number {
  const norm = rel.replace(/\\/g, '/').toLowerCase();
  if (hint.endsWith(norm)) return norm.length;
  if (hint.endsWith('/' + baseName(rel).toLowerCase())) return 1;
  return 0;
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
