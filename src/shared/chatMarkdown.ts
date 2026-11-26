/**
 * Chat markdown, parsed to a small tree the renderer paints itself.
 * No HTML string, so a model reply cannot inject markup.
 */

export type MdInline =
  | { kind: 'text'; text: string }
  | { kind: 'strong'; text: string }
  | { kind: 'em'; text: string }
  | { kind: 'code'; text: string }
  | { kind: 'link'; text: string; href: string };

export type MdBlock =
  | { kind: 'heading'; level: 1 | 2 | 3 | 4; inlines: MdInline[] }
  | { kind: 'paragraph'; lines: MdInline[][] }
  | { kind: 'code'; text: string }
  | { kind: 'list'; ordered: boolean; items: MdInline[][] }
  | { kind: 'quote'; lines: MdInline[][] }
  | { kind: 'rule' }
  | { kind: 'table'; headers: MdInline[][]; rows: MdInline[][][] };

function isSafeHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function parseChatInlines(text: string): MdInline[] {
  const parts: MdInline[] = [];
  const re = /(\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|\*\*[^*]+\*\*|\*[^*\n]+\*|`[^`\n]+`)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    if (match.index > last) parts.push({ kind: 'text', text: text.slice(last, match.index) });
    const token = match[0];
    if (token.startsWith('[') && match[2] && match[3] && isSafeHttpUrl(match[3])) {
      parts.push({ kind: 'link', text: match[2], href: match[3] });
    } else if (token.startsWith('**')) {
      parts.push({ kind: 'strong', text: token.slice(2, -2) });
    } else if (token.startsWith('*')) {
      parts.push({ kind: 'em', text: token.slice(1, -1) });
    } else if (token.startsWith('`')) {
      parts.push({ kind: 'code', text: token.slice(1, -1) });
    } else {
      parts.push({ kind: 'text', text: token });
    }
    last = match.index + token.length;
  }
  if (last < text.length) parts.push({ kind: 'text', text: text.slice(last) });
  return parts;
}

function isTableSeparator(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed.includes('|')) return false;
  const cells = trimmed.replace(/^\|/, '').replace(/\|$/, '').split('|');
  return cells.length > 0 && cells.every(cell => /^\s*:?-{3,}:?\s*$/.test(cell));
}

function splitTableRow(line: string): MdInline[][] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map(cell => parseChatInlines(cell.trim()));
}

function isBlockStart(line: string, next: string | undefined): boolean {
  const cur = line.trim();
  if (!cur) return true;
  if (cur.startsWith('```')) return true;
  if (/^#{1,4}\s+/.test(cur)) return true;
  if (/^(-{3,}|\*{3,}|_{3,})$/.test(cur)) return true;
  if (/^[-*+]\s+/.test(cur)) return true;
  if (/^\d+\.\s+/.test(cur)) return true;
  if (cur.startsWith('>')) return true;
  if (cur.includes('|') && next !== undefined && isTableSeparator(next)) return true;
  return false;
}

export function parseChatMarkdown(source: string): MdBlock[] {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const blocks: MdBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i] ?? '';
    const trimmed = line.trim();
    if (!trimmed) {
      i += 1;
      continue;
    }

    if (trimmed.startsWith('```')) {
      const code: string[] = [];
      i += 1;
      while (i < lines.length && !(lines[i] ?? '').trim().startsWith('```')) {
        code.push(lines[i] ?? '');
        i += 1;
      }
      if (i < lines.length) i += 1;
      blocks.push({ kind: 'code', text: code.join('\n') });
      continue;
    }

    const heading = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (heading?.[1] && heading[2]) {
      const level = heading[1].length as 1 | 2 | 3 | 4;
      blocks.push({ kind: 'heading', level, inlines: parseChatInlines(heading[2]) });
      i += 1;
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      blocks.push({ kind: 'rule' });
      i += 1;
      continue;
    }

    if (trimmed.includes('|') && i + 1 < lines.length && isTableSeparator(lines[i + 1] ?? '')) {
      const headers = splitTableRow(line);
      i += 2;
      const rows: MdInline[][][] = [];
      while (i < lines.length && (lines[i] ?? '').trim().includes('|') && (lines[i] ?? '').trim() !== '') {
        rows.push(splitTableRow(lines[i] ?? ''));
        i += 1;
      }
      blocks.push({ kind: 'table', headers, rows });
      continue;
    }

    if (trimmed.startsWith('>')) {
      const quote: MdInline[][] = [];
      while (i < lines.length && (lines[i] ?? '').trim().startsWith('>')) {
        quote.push(parseChatInlines((lines[i] ?? '').trim().replace(/^>\s?/, '')));
        i += 1;
      }
      blocks.push({ kind: 'quote', lines: quote });
      continue;
    }

    if (/^[-*+]\s+/.test(trimmed)) {
      const items: MdInline[][] = [];
      while (i < lines.length && /^[-*+]\s+/.test((lines[i] ?? '').trim())) {
        items.push(parseChatInlines((lines[i] ?? '').trim().replace(/^[-*+]\s+/, '')));
        i += 1;
      }
      blocks.push({ kind: 'list', ordered: false, items });
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      const items: MdInline[][] = [];
      while (i < lines.length && /^\d+\.\s+/.test((lines[i] ?? '').trim())) {
        items.push(parseChatInlines((lines[i] ?? '').trim().replace(/^\d+\.\s+/, '')));
        i += 1;
      }
      blocks.push({ kind: 'list', ordered: true, items });
      continue;
    }

    const para: MdInline[][] = [];
    while (i < lines.length && !isBlockStart(lines[i] ?? '', lines[i + 1])) {
      para.push(parseChatInlines(lines[i] ?? ''));
      i += 1;
    }
    if (para.length) blocks.push({ kind: 'paragraph', lines: para });
  }

  return blocks;
}
