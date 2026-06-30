// Splits a merged magazine document into its individual articles (the web
// "mini-site" model: one HTML page per article + an issue index).
//
// resolveIncludes() delimits every #include'd chapter in the merged source with
// a marker comment — `// ─── 02-feature.typ ───` — which the deserializer keeps
// as a config raw block. Those markers are the reliable article boundaries: we
// group the flat block sequence between them into per-article block lists, and
// pull each article's display title / kicker / byline from its opener so the
// index can build a table of contents.
//
// Pure (no fs/async). Returns null when the document isn't a multi-article
// magazine (the caller then falls back to the single-page bundle).

interface JSONNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: JSONNode[];
  text?: string;
}

export interface MagazineArticle {
  /** Chapter base name without the leading number, e.g. "feature". */
  name: string;
  /** URL/file slug (the cover becomes `index`). */
  slug: string;
  /** Display title (from the opener / first heading / hero, else the name). */
  title: string;
  /** Optional kicker + byline (from an `articleHeader` opener) for the TOC. */
  kicker?: string;
  byline?: string;
  /** The issue cover / title page → becomes index.html, not a regular page. */
  isCover: boolean;
  blocks: JSONNode[];
}

/** `// ─── 02-feature.typ ───` → { order: 2, name: "feature" }. Matched per
 *  LINE (the `m` flag), because resolveIncludes' marker can land in the same
 *  comment block as a preceding `// …` note from main.typ (then the block does
 *  not START with the marker). The block is comment-only either way, so finding
 *  the marker on any line is enough to treat it as a boundary. */
function chapterMarker(node: JSONNode): { order: number; name: string } | null {
  if (node.type !== 'typstRawBlock') return null;
  const c = String(node.attrs?.content ?? '');
  const m = c.match(/^\s*\/\/\s*[─-]+\s*(\d+)-([a-zA-Z0-9_-]+)\.typ\s*[─-]*\s*$/m);
  return m ? { order: parseInt(m[1], 10), name: m[2].toLowerCase() } : null;
}

function plainText(node: JSONNode): string {
  return (node.content ?? []).map((c) => c.text ?? '').join('').trim();
}

/** Removes a trailing Typst `<label>` from a heading title. */
function stripLabel(s: string): string {
  return s.replace(/\s*<[^<>\s]+>\s*$/, '').trim();
}

/** kebab-cases a name into a file/URL-safe slug. */
function slugify(s: string): string {
  return (s || 'article')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    .slice(0, 60).replace(/-+$/, '') || 'article';
}

/** First `#heading(...)[Title]` inside a raw block (hero / cover opener). */
function rawHeading(content: string): string | undefined {
  const m = content.match(/#heading\b[^[]*\[([^\]]+)\]/);
  return m ? stripLabel(m[1].trim()) : undefined;
}

function deriveArticle(name: string, order: number, blocks: JSONNode[], isCover: boolean): MagazineArticle {
  let title: string | undefined;
  let kicker: string | undefined;
  let byline: string | undefined;
  for (const n of blocks) {
    if (n.type === 'articleHeader') {
      title ??= n.attrs?.title ? String(n.attrs.title) : undefined;
      kicker ??= n.attrs?.kicker ? String(n.attrs.kicker) : undefined;
      byline ??= n.attrs?.byline ? String(n.attrs.byline) : undefined;
      if (title) break;
    } else if (n.type === 'heading') {
      const t = stripLabel(plainText(n));
      if (t) { title ??= t; break; }
    } else if (n.type === 'typstRawBlock') {
      const h = rawHeading(String(n.attrs?.content ?? ''));
      if (h) { title ??= h; break; }
    }
  }
  const display = title || name.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  return { name, slug: isCover ? 'index' : slugify(name), title: display, kicker, byline, isCover, blocks };
}

/** True if a block group is the issue cover (a manual `#page[…]` title page). */
function looksLikeCover(name: string, blocks: JSONNode[]): boolean {
  if (/cover|titel/i.test(name)) return true;
  return blocks.some((n) => n.type === 'typstRawBlock' && /^#page\b/.test(String(n.attrs?.content ?? '').trim()));
}

/**
 * Groups a merged magazine doc into per-article block lists. Returns null when
 * there are fewer than 2 chapter markers (→ not a mini-site; use the single-page
 * bundle). Blocks before the first marker (main.typ front matter) join the first
 * article.
 */
export function splitIntoArticles(doc: { content?: JSONNode[] }): MagazineArticle[] | null {
  const content = doc.content ?? [];
  const groups: { order: number; name: string; blocks: JSONNode[] }[] = [];
  const pre: JSONNode[] = [];
  let cur: { order: number; name: string; blocks: JSONNode[] } | null = null;

  for (const n of content) {
    const marker = chapterMarker(n);
    if (marker) { cur = { ...marker, blocks: [] }; groups.push(cur); continue; }
    if (cur) cur.blocks.push(n); else pre.push(n);
  }

  if (groups.length < 2) return null;
  if (pre.length) groups[0].blocks.unshift(...pre);

  return groups.map((g, i) => deriveArticle(g.name, g.order, g.blocks, looksLikeCover(g.name, g.blocks) && (i === 0 || /cover|titel/i.test(g.name))));
}

/**
 * Whether the document should export as a magazine mini-site rather than a
 * single page: at least two chapters AND a magazine signal (a cover, or ≥2
 * `articleHeader` openers) — so a multi-chapter THESIS (headings, no openers,
 * one shared bibliography) still exports as one continuous page.
 */
export function isMagazineSite(articles: MagazineArticle[] | null, doc: { content?: JSONNode[] }): articles is MagazineArticle[] {
  if (!articles || articles.length < 2) return false;
  const openers = (doc.content ?? []).filter((n) => n.type === 'articleHeader').length;
  const hasCover = articles.some((a) => a.isCover);
  return hasCover || openers >= 2;
}
