/**
 * One chapter, one folder of named versions, on the Mac and on the iPad.
 *
 * `versions/<chapter path>/<name>.typ` is a normal folder. Dropbox copies it.
 * Nothing here touches Git. A version is only the bytes of that one file.
 *
 * "Make main" swaps the two texts. The version keeps its name and afterwards
 * holds what the chapter used to say. The chapter file holds what the version
 * used to say.
 */

export interface ChapterVersion {
  name: string;
  /** Path inside the project, e.g. `versions/chapters/01.typ/Name.typ`. */
  path: string;
}

export interface VersionGroup {
  /** The living chapter, e.g. `chapters/01.typ`. */
  source: string;
  versions: ChapterVersion[];
}

export interface VersionDirEntry {
  name: string;
  path: string;
  isDir: boolean;
}

const DATE = (now: Date) => {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}_${m}_${d}`;
};

/** File name without a path and without a trailing `.typ`. Empty is a refusal. */
export function sanitizeVersionName(raw: string): string | null {
  let cleaned = raw.trim().replace(/[\\/]/g, '').replace(/^\.+/, '');
  cleaned = cleaned.replace(/\.typ$/i, '').trim();
  if (!cleaned || cleaned === '.' || cleaned === '..') return null;
  if (cleaned.length > 120) return null;
  if (/[\u0000-\u001f]/.test(cleaned)) return null;
  return cleaned;
}

/**
 * Suggested name for the open chapter: `Dateiname_V1_Year_Month_Day`.
 * The next free `V` number is used when that name is already taken.
 */
export function suggestVersionName(sourceRel: string, existing: string[], now = new Date()): string {
  const file = sourceRel.split('/').pop() || 'datei';
  const base = file.replace(/\.(typ|typst)$/i, '') || 'datei';
  const stamp = DATE(now);
  const taken = new Set(existing.map((n) => n.replace(/\.typ$/i, '')));
  let n = 1;
  let name = `${base}_V${n}_${stamp}`;
  while (taken.has(name)) {
    n += 1;
    name = `${base}_V${n}_${stamp}`;
  }
  return name;
}

/** `versions/<chapter>/<name>.typ`. Refuses paths that leave the chapter folder. */
export function versionFileRel(sourceRel: string, name: string): string | null {
  const safe = sanitizeVersionName(name);
  const source = sourceRel.replace(/\\/g, '/').replace(/^\.\//, '');
  if (!safe || !source || source.startsWith('/') || source.split('/').includes('..')) return null;
  if (source === 'versions' || source.startsWith('versions/')) return null;
  if (!source.endsWith('.typ') && !source.endsWith('.typst')) return null;
  return `versions/${source}/${safe}.typ`;
}

/** `versions/chapters/01.typ/Name.typ` → `chapters/01.typ`. */
export function sourceOfVersion(versionRel: string): string | null {
  const norm = versionRel.replace(/\\/g, '/').replace(/^\.\//, '');
  if (!norm.startsWith('versions/')) return null;
  const rest = norm.slice('versions/'.length);
  const slash = rest.lastIndexOf('/');
  if (slash <= 0) return null;
  const source = rest.slice(0, slash);
  if (source.split('/').includes('..')) return null;
  if (!source.endsWith('.typ') && !source.endsWith('.typst')) return null;
  return source;
}

/** The two texts exchange places. */
export function swapped(live: string, version: string): { live: string; version: string } {
  return { live: version, version: live };
}

/**
 * Walk `versions/`. A folder whose path ends in `.typ` holds that chapter's
 * versions. iPad directory listings mark `main.typ` folders as files, so a
 * dotted name is probed with a second listing.
 */
export async function collectVersions(
  listDir: (rel: string) => Promise<VersionDirEntry[]>,
): Promise<VersionGroup[]> {
  const groups: VersionGroup[] = [];

  async function walk(rel: string): Promise<void> {
    let entries: VersionDirEntry[];
    try {
      entries = await listDir(rel);
    } catch {
      return;
    }
    const from = rel === 'versions' ? '' : rel.startsWith('versions/') ? rel.slice('versions/'.length) : '';
    if (from.endsWith('.typ') || from.endsWith('.typst')) {
      const versions = entries
        .filter((e) => !e.isDir && e.name.toLowerCase().endsWith('.typ') && !e.name.startsWith('.'))
        .map((e) => ({
          name: e.name.replace(/\.typ$/i, ''),
          path: `${rel}/${e.name}`.replace(/\/+/g, '/'),
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
      if (versions.length > 0) groups.push({ source: from, versions });
      return;
    }
    for (const entry of entries) {
      if (!entry.name || entry.name.startsWith('.')) continue;
      const child = `${rel}/${entry.name}`.replace(/\/+/g, '/');
      if (entry.isDir) {
        await walk(child);
        continue;
      }
      const dotted = entry.name.endsWith('.typ') || entry.name.endsWith('.typst');
      if (!dotted) continue;
      let kids: VersionDirEntry[] = [];
      try {
        kids = await listDir(child);
      } catch {
        kids = [];
      }
      if (kids.length > 0) await walk(child);
    }
  }

  await walk('versions');
  groups.sort((a, b) => a.source.localeCompare(b.source));
  return groups;
}
