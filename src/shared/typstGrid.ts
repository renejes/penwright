// Generic `#grid(columns: …)[cell]…` reinterpreter (Phase C §7.4).
//
// The ad-hoc two-up layout scaffolding written per-chapter (e.g. the LANGSAM
// interview head: a "Zur Person" box + first Q&A on the left, portrait + Q&A on
// the right) is raw `#grid(...)` Typst — not a magazine macro. It MUST stay a
// verbatim raw block for PDF (so the compiled page is pixel-identical), but
// without this it is *dropped* from the web/Word export (the §7.4 gap).
//
// This pure parser extracts the renderable CONTENT of a `#grid` into a neutral
// structure the HTML and DOCX serializers render as a responsive stacked grid
// (content-complete, not pixel-faithful — the plan's explicit web answer). It
// is export-only: the editor + PDF still see the raw block unchanged.
//
// shared/ stays dependency-free: pure string work.

export interface GridItem {
  /** question = a `frage[…]`; box = a `block(...)[…]` framed note; image = a
   *  photo; caption = a styled `text(...)[…]` (photo caption); prose = plain
   *  content or any other content-bearing call we keep for its words. */
  kind: 'question' | 'box' | 'image' | 'caption' | 'prose';
  /** Markup body to render with the host serializer's inline-Typst handler. */
  body?: string;
  /** Accent title extracted from a box's `#text(...)[#upper("…")]`. */
  title?: string;
  /** Image path / width (kind === 'image'). */
  path?: string;
  width?: string;
}

export interface ParsedGrid {
  /** One item list per grid cell (in source order). */
  cells: GridItem[][];
}

// ─── bracket / brace / paren matchers ────────────────────────────────────────

function matchParen(s: string, open: number): { inner: string; end: number } | null {
  if (s[open] !== '(') return null;
  let depth = 0, inStr = false;
  for (let i = open; i < s.length; i++) {
    const c = s[i];
    // An escaped char (e.g. a markup `\"` inside a `[…]` cell) is never a
    // delimiter or a string toggle — skip it, or it would falsely open a string
    // and swallow the rest of the grid (dropping it entirely from the export).
    if (c === '\\') { i++; continue; }
    if (inStr) { if (c === '"') inStr = false; continue; }
    if (c === '"') { inStr = true; continue; }
    if (c === '(') depth++;
    else if (c === ')') { depth--; if (depth === 0) return { inner: s.slice(open + 1, i), end: i + 1 }; }
  }
  return null;
}

function matchPair(s: string, open: number, oc: string, cc: string): { inner: string; end: number } | null {
  if (s[open] !== oc) return null;
  let depth = 0;
  for (let i = open; i < s.length; i++) {
    if (s[i] === '\\') { i++; continue; }
    if (s[i] === oc) depth++;
    else if (s[i] === cc) { depth--; if (depth === 0) return { inner: s.slice(open + 1, i), end: i + 1 }; }
  }
  return null;
}
const matchBr = (s: string, o: number) => matchPair(s, o, '[', ']');
const matchBrace = (s: string, o: number) => matchPair(s, o, '{', '}');

/** Split a Typst arg list on top-level commas (respecting "", [], (), {}). */
function splitTopLevel(s: string): string[] {
  const parts: string[] = [];
  let depth = 0, inStr = false, start = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '\\') { i++; continue; } // escaped char — never a quote/delimiter
    if (inStr) { if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true;
    else if (c === '(' || c === '[' || c === '{') depth++;
    else if (c === ')' || c === ']' || c === '}') depth = Math.max(0, depth - 1);
    else if (c === ',' && depth === 0) { parts.push(s.slice(start, i)); start = i + 1; }
  }
  parts.push(s.slice(start));
  return parts.map((p) => p.trim()).filter(Boolean);
}

/** Index of a top-level `:` in `s`, or -1. */
function topColon(s: string): number {
  let depth = 0, inStr = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '\\') { i++; continue; } // escaped char — never a quote/delimiter
    if (inStr) { if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true;
    else if (c === '(' || c === '[' || c === '{') depth++;
    else if (c === ')' || c === ']' || c === '}') depth--;
    else if (c === ':' && depth === 0) return i;
  }
  return -1;
}

// ─── box-title extraction ────────────────────────────────────────────────────

/** A framed `block(...)[…]` body carries its accent title as
 *  `#text(...)[#upper("Zur Person")]`; pull it out + strip the title wrapper,
 *  `#set …` lines and `#v(…)` spacers, leaving the prose. */
function extractBox(body: string): { title?: string; rest: string } {
  const upperM = body.match(/#upper\(\s*"((?:[^"\\]|\\.)*)"\s*\)/);
  const title = upperM ? upperM[1].replace(/\\"/g, '"').toUpperCase() : undefined;
  const rest = body
    .replace(/#text\s*\([^)]*\)\s*\[\s*#upper\([^)]*\)\s*\]/g, '')
    .replace(/#upper\s*\([^)]*\)/g, '')
    .replace(/#set\b[^\n]*/g, '')
    .replace(/#v\s*\([^)]*\)/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return { title, rest };
}

// ─── cell parsing ────────────────────────────────────────────────────────────

function pushCall(items: GridItem[], name: string, args: string, body: string | null) {
  switch (name) {
    case 'frage':
      if (body !== null) items.push({ kind: 'question', body });
      break;
    case 'block': {
      if (body !== null) { const { title, rest } = extractBox(body); items.push({ kind: 'box', title, body: rest }); }
      break;
    }
    case 'notiz':
      if (body !== null) items.push({ kind: 'box', body });
      break;
    case 'image': {
      // Escape-aware string match (a filename may contain an escaped `\"`); the
      // plain `[^"]+` truncated at it → a broken/dropped image path.
      const p = args.match(/"((?:[^"\\]|\\.)*)"/);
      const w = args.match(/width:\s*([^,)\s]+)/);
      if (p) items.push({ kind: 'image', path: p[1].replace(/\\"/g, '"'), width: w ? w[1] : undefined });
      break;
    }
    case 'text':
      if (body !== null) items.push({ kind: 'caption', body });
      break;
    case 'lead':
    case 'pull':
      if (body !== null) items.push({ kind: 'prose', body });
      break;
    case 'v':
    case 'set':
    case 'line':
    case 'colbreak':
    case 'align':
      break; // pure layout — no content
    default:
      if (body !== null) items.push({ kind: 'prose', body });
      break;
  }
}

/** Parse a code-mode `{ … }` cell: a sequence of bare `name(args)?[body]` calls
 *  and bare `[content]` blocks, skipping spacers/`set`. */
function parseCodeCell(src: string): GridItem[] {
  const items: GridItem[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === '[') {
      const m = matchBr(src, i);
      if (m) { if (m.inner.trim()) items.push({ kind: 'prose', body: m.inner }); i = m.end; continue; }
      i++; continue;
    }
    const idm = src.slice(i).match(/^[a-zA-Z][\w.-]*/);
    if (idm) {
      const name = idm[0];
      let j = i + name.length;
      while (/\s/.test(src[j] ?? '')) j++;
      let args = '';
      if (src[j] === '(') { const a = matchParen(src, j); if (a) { args = a.inner; j = a.end; } }
      while (/\s/.test(src[j] ?? '')) j++;
      let body: string | null = null;
      if (src[j] === '[') { const b = matchBr(src, j); if (b) { body = b.inner; j = b.end; } }
      pushCall(items, name, args, body);
      i = j > i ? j : i + name.length;
      continue;
    }
    i++;
  }
  return items;
}

/** Parse a markup-mode `[ … ]` cell: split into blocks, classify `#frage`/etc. */
function parseMarkupCell(src: string): GridItem[] {
  const items: GridItem[] = [];
  for (const block of src.split(/\n\s*\n/)) {
    const t = block.trim();
    if (!t) continue;
    const fr = t.match(/^#frage\s*\[/);
    if (fr) { const b = matchBr(t, t.indexOf('[')); if (b) { items.push({ kind: 'question', body: b.inner }); continue; } }
    items.push({ kind: 'prose', body: t });
  }
  return items;
}

/**
 * Parses a raw `#grid(...)` block (the block's full source, leading `//`
 * comments tolerated) into per-cell content. Returns null if it isn't a grid
 * or has no extractable cells.
 */
export function parseTypstGrid(blockSource: string): ParsedGrid | null {
  // Strip leading comment lines (e.g. the LANGSAM "// Kopf: …" above the grid).
  let s = blockSource.trim();
  while (s.startsWith('//')) {
    const nl = s.indexOf('\n');
    if (nl < 0) return null;
    s = s.slice(nl + 1).trim();
  }
  const m = s.match(/^#grid\s*\(/);
  if (!m) return null;
  const open = s.indexOf('(');
  const inner = matchParen(s, open);
  if (!inner) return null;

  const cells: GridItem[][] = [];
  const addCell = (t: string) => {
    if (t[0] === '{') { const b = matchBrace(t, 0); if (b) cells.push(parseCodeCell(b.inner)); }
    else if (t[0] === '[') { const b = matchBr(t, 0); if (b) cells.push(parseMarkupCell(b.inner)); }
    // A positional FUNCTION-call cell, e.g. `text(size: 1em)[Reportage]` (the
    // LANGSAM cover form) — parse it with the code-cell item parser.
    else if (/^[a-zA-Z]/.test(t)) { const items = parseCodeCell(t); if (items.length) cells.push(items); }
  };
  for (const part of splitTopLevel(inner.inner)) {
    const colon = topColon(part);
    if (colon > 0 && /^[a-zA-Z][\w-]*$/.test(part.slice(0, colon).trim())) continue; // named arg (columns/gutter/align/…)
    addCell(part.trim());
  }

  // Trailing content-block cells AFTER the `)`, i.e. `#grid(columns: 2)[A][B]`
  // (Typst allows positional content args after the paren group).
  let after = s.slice(inner.end);
  for (;;) {
    const t = after.replace(/^\s+/, '');
    if (t[0] === '[') { const b = matchBr(t, 0); if (b) { cells.push(parseMarkupCell(b.inner)); after = t.slice(b.end); continue; } }
    if (t[0] === '{') { const b = matchBrace(t, 0); if (b) { cells.push(parseCodeCell(b.inner)); after = t.slice(b.end); continue; } }
    break;
  }

  const nonEmpty = cells.filter((c) => c.length > 0);
  return nonEmpty.length ? { cells: nonEmpty } : null;
}
