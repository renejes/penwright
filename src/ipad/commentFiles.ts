/**
 * The comment file format from commentManager, without Node's fs.
 * One Markdown file per comment in `comments/`, never inside the .typ source.
 */

export interface CommentFile {
  id: string;
  file: string;
  anchor: string;
  rangeStart: number;
  rangeEnd: number;
  author: string;
  date: string;
  resolved: boolean;
  body: string;
  filePath: string;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function commentId(now: Date = new Date()): string {
  const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
  const rand = Math.random().toString(36).slice(2, 5);
  return `${stamp}-${rand}`;
}

function escapeYaml(s: string): string {
  return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`;
}

function unescapeYaml(s: string): string {
  return s.replace(/\\(\\|"|n)/g, (_m, c: string) => (c === 'n' ? '\n' : c));
}

function parseScalar(raw: string): string | number | boolean {
  const v = raw.trim();
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  if (v.startsWith('"') && v.endsWith('"')) return unescapeYaml(v.slice(1, -1));
  if (v.startsWith("'") && v.endsWith("'")) return v.slice(1, -1);
  return v;
}

export function serializeComment(meta: Omit<CommentFile, 'body' | 'filePath'>, body: string): string {
  return [
    '---',
    `id: ${escapeYaml(meta.id)}`,
    `file: ${escapeYaml(meta.file)}`,
    `anchor: ${escapeYaml(meta.anchor)}`,
    `rangeStart: ${meta.rangeStart}`,
    `rangeEnd: ${meta.rangeEnd}`,
    `author: ${escapeYaml(meta.author)}`,
    `date: ${escapeYaml(meta.date)}`,
    `resolved: ${meta.resolved ? 'true' : 'false'}`,
    '---',
    '',
    body.trimEnd(),
    '',
  ].join('\n');
}

export function parseComment(content: string, filePath: string): CommentFile | null {
  if (!content.startsWith('---')) return null;
  const end = content.indexOf('\n---', 3);
  if (end < 0) return null;
  const front = content.slice(3, end).replace(/^\n/, '');
  const body = content.slice(end + 4).replace(/^\n/, '');
  const meta: Record<string, string | number | boolean> = {};
  for (const line of front.split('\n')) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const colon = line.indexOf(':');
    if (colon < 0) continue;
    const key = line.slice(0, colon).trim();
    if (!key) continue;
    meta[key] = parseScalar(line.slice(colon + 1));
  }
  if (typeof meta.id !== 'string' || typeof meta.file !== 'string') return null;
  return {
    id: meta.id,
    file: meta.file,
    anchor: typeof meta.anchor === 'string' ? meta.anchor : '',
    rangeStart: typeof meta.rangeStart === 'number' ? meta.rangeStart : 0,
    rangeEnd: typeof meta.rangeEnd === 'number' ? meta.rangeEnd : 0,
    author: typeof meta.author === 'string' ? meta.author : '',
    date: typeof meta.date === 'string' ? meta.date : '',
    resolved: meta.resolved === true,
    body: body.replace(/\n$/, ''),
    filePath,
  };
}
