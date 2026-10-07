/**
 * Zotero's local API on 127.0.0.1:23119. Used only when a bib entry has no
 * `file` field. A refused connection means Zotero is not running — the caller
 * keeps the .bib result.
 *
 * `GET /api/users/0/items?q=<citekey>&qmode=everything`, then the attachment's
 * `GET /items/<key>/file/view/url` (plain `file://` URL).
 */

import { fileURLToPath } from 'url';

const BASE = 'http://127.0.0.1:23119/api/users/0';

interface ZoteroItem {
  key?: string;
  data?: {
    itemType?: string;
    citationKey?: string;
    extra?: string;
    contentType?: string;
    filename?: string;
  };
}

export async function zoteroAttachmentPdf(citekey: string): Promise<string | null> {
  const items = await getJson<ZoteroItem[]>(
    `${BASE}/items?q=${encodeURIComponent(citekey)}&qmode=everything&format=json&limit=25`,
  );
  if (!items) return null;
  const hit = items.find((item) => zoteroCitekey(item) === citekey);
  if (!hit?.key) return null;

  const children = await getJson<ZoteroItem[]>(`${BASE}/items/${encodeURIComponent(hit.key)}/children?format=json`);
  const attachments = (children ?? []).filter(isPdfAttachment);
  if (hit.data?.itemType === 'attachment') attachments.unshift(hit);

  for (const att of attachments) {
    if (!att.key) continue;
    const loc = await attachmentFile(att.key);
    if (loc) return loc;
  }
  return null;
}

function zoteroCitekey(item: ZoteroItem): string {
  const direct = item.data?.citationKey?.trim();
  if (direct) return direct;
  const extra = item.data?.extra ?? '';
  const line = extra.split(/\r?\n/).find((l) => /^\s*citation key\s*:/i.test(l));
  return line ? line.replace(/^[^:]*:\s*/, '').trim() : '';
}

function isPdfAttachment(item: ZoteroItem): boolean {
  if (item.data?.itemType !== 'attachment') return false;
  const type = item.data.contentType ?? '';
  const name = item.data.filename ?? '';
  return type === 'application/pdf' || /\.pdf$/i.test(name);
}

async function attachmentFile(itemKey: string): Promise<string | null> {
  const text = await getText(`${BASE}/items/${encodeURIComponent(itemKey)}/file/view/url`);
  if (!text) return null;
  const trimmed = text.trim();
  if (trimmed.startsWith('file:')) {
    try { return fileURLToPath(trimmed); } catch { return null; }
  }
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed) as { url?: string };
      if (parsed.url?.startsWith('file:')) return fileURLToPath(parsed.url);
    } catch { return null; }
  }
  return null;
}

async function getJson<T>(url: string): Promise<T | null> {
  const text = await getText(url);
  if (!text) return null;
  try { return JSON.parse(text) as T; } catch { return null; }
}

async function getText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(1500) });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}
