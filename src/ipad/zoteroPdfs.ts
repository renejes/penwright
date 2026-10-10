/**
 * PDFs in the folder the user picked for linked Zotero attachments.
 * The bytes stay in that folder. This only lists names.
 */

import type { ProjectFs } from './projectFs';

const LINKED_PREFIX = 'zotero-pdf/';

export function linkedPdfPath(rel: string): string {
  return `${LINKED_PREFIX}${rel}`;
}

export function linkedPdfRel(path: string): string | null {
  if (!path.startsWith(LINKED_PREFIX)) return null;
  const rel = path.slice(LINKED_PREFIX.length);
  if (!isSafePdfRel(rel)) return null;
  return rel;
}

export function isSafePdfRel(rel: string): boolean {
  if (!rel || rel.startsWith('/') || rel.includes('\\') || !rel.toLowerCase().endsWith('.pdf')) return false;
  return rel.split('/').every((part) => part && part !== '.' && part !== '..');
}

export async function collectPdfRels(fs: ProjectFs, dir = '', depth = 0): Promise<string[]> {
  if (depth > 6) return [];
  let entries: Awaited<ReturnType<ProjectFs['readDir']>> = [];
  try {
    entries = await fs.readDir(dir);
  } catch {
    return [];
  }
  const out: string[] = [];
  for (const entry of entries) {
    if (!entry.name || entry.name.startsWith('.')) continue;
    const rel = dir ? `${dir}/${entry.name}` : entry.name;
    if (entry.isDir) out.push(...await collectPdfRels(fs, rel, depth + 1));
    else if (entry.name.toLowerCase().endsWith('.pdf')) out.push(rel);
  }
  return out;
}
