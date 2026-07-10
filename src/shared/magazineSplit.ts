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

import { parseHero, parseCoverCall } from './typstHero';
import { matchBracket } from './exportContext';

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
  /** False for the synthetic cover built from root front matter (a report's
   *  `#cover(…)` title page) — it makes a nice index when the user FORCES the
   *  site split, but is not a magazine signal for the auto heuristic. */
  fromMarker: boolean;
  /** Section-style (Kapitel-Look) the chapter opted into via `#show: <id>-style`. */
  sectionId?: string;
  /** Frontmatter: a short summary (standfirst / first paragraph) for
   *  `<meta description>` / og:description + meta.json. */
  description?: string;
  /** Frontmatter: the article's first image (project-relative source path —
   *  the bundle writer rewrites it to the copied asset). */
  cover?: string;
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

// ─── Frontmatter derivation (description / cover image / section opt-in) ────

/** Word-boundary truncation for meta descriptions. */
function summarize(s: string, max = 180): string | undefined {
  const t = s.replace(/\s+/g, ' ').trim();
  if (!t) return undefined;
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  return cut.slice(0, Math.max(cut.lastIndexOf(' '), 60)).trimEnd() + '…';
}

/** `#show: <id>-style` — the chapter's section-style (Kapitel-Look) opt-in. */
function sectionOptIn(blocks: JSONNode[]): string | undefined {
  for (const n of blocks) {
    if (n.type !== 'typstRawBlock') continue;
    const m = String(n.attrs?.content ?? '').match(/#show\s*:\s*([a-z][a-z0-9-]*)-style\b/);
    if (m) return m[1];
  }
  return undefined;
}

/** First real image in a block list (image node / figurePanel / hero image /
 *  a raw `image("…")`) — the article's cover candidate. */
function firstImage(blocks: JSONNode[]): string | undefined {
  for (const n of blocks) {
    if (n.type === 'image' && n.attrs?.src) return String(n.attrs.src);
    if (n.type === 'figurePanel' && n.attrs?.path) return String(n.attrs.path);
    if (n.type === 'typstRawBlock') {
      const c = String(n.attrs?.content ?? '');
      const hero = parseHero(c);
      if (hero && hero.kind !== 'cover' && hero.image) return hero.image;
      const m = c.match(/\bimage\(\s*"([^"]+)"/);
      if (m) return m[1];
    }
    if (Array.isArray(n.content)) {
      const nested = firstImage(n.content);
      if (nested) return nested;
    }
  }
  return undefined;
}

/** First substantial paragraph/drop-cap text — the description fallback when
 *  there is no opener standfirst. */
function firstParagraphText(blocks: JSONNode[]): string | undefined {
  for (const n of blocks) {
    if (n.type === 'paragraph' || n.type === 'dropCap') {
      const t = plainText(n);
      if (t.length >= 40) return t;
    }
  }
  return undefined;
}

function deriveArticle(name: string, order: number, blocks: JSONNode[], isCover: boolean, fromMarker = true): MagazineArticle {
  let title: string | undefined;
  let kicker: string | undefined;
  let byline: string | undefined;
  let standfirst: string | undefined;
  for (const n of blocks) {
    if (n.type === 'articleHeader') {
      title ??= n.attrs?.title ? String(n.attrs.title) : undefined;
      kicker ??= n.attrs?.kicker ? String(n.attrs.kicker) : undefined;
      byline ??= n.attrs?.byline ? String(n.attrs.byline) : undefined;
      standfirst ??= n.attrs?.standfirst ? String(n.attrs.standfirst) : undefined;
      if (title) break;
    } else if (n.type === 'heading') {
      const t = stripLabel(plainText(n));
      if (t) { title ??= t; break; }
    } else if (n.type === 'typstRawBlock') {
      const h = rawHeading(String(n.attrs?.content ?? ''));
      if (h) { title ??= h; break; }
    }
  }
  // Chapters styled without a real `=` heading (a front-matter page whose
  // title is a big `#text(size: 22pt)[…]`) → the largest short #text run.
  if (!title) {
    for (const n of blocks) {
      if (n.type !== 'typstRawBlock') continue;
      const t = mastheadText(String(n.attrs?.content ?? ''));
      if (t) { title = t; break; }
    }
  }
  const display = title || name.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  return {
    name,
    slug: isCover ? 'index' : slugify(name),
    title: display,
    kicker,
    byline,
    isCover,
    fromMarker,
    sectionId: sectionOptIn(blocks),
    description: summarize(standfirst ?? firstParagraphText(blocks) ?? ''),
    cover: firstImage(blocks),
    blocks,
  };
}

/**
 * Frontmatter for a SINGLE-PAGE export (no article split): a description
 * (standfirst / first substantial paragraph) + a cover image candidate.
 */
export function deriveDocMeta(doc: { content?: JSONNode[] }): { description?: string; cover?: string; kicker?: string; byline?: string } {
  const blocks = doc.content ?? [];
  let standfirst: string | undefined;
  let kicker: string | undefined;
  let byline: string | undefined;
  for (const n of blocks) {
    if (n.type === 'articleHeader') {
      standfirst ??= n.attrs?.standfirst ? String(n.attrs.standfirst) : undefined;
      kicker ??= n.attrs?.kicker ? String(n.attrs.kicker) : undefined;
      byline ??= n.attrs?.byline ? String(n.attrs.byline) : undefined;
      break;
    }
  }
  return {
    description: summarize(standfirst ?? firstParagraphText(blocks) ?? ''),
    cover: firstImage(blocks),
    kicker,
    byline,
  };
}

/** True if a raw block is a title-page construct (`#page[…]` / `#cover(…)`). */
function isCoverBlock(n: JSONNode): boolean {
  if (n.type !== 'typstRawBlock') return false;
  const c = String(n.attrs?.content ?? '');
  if (/^#page\b/.test(c.trim())) return true;
  return parseHero(c)?.kind === 'cover';
}

/** True if a block group is the issue cover (a manual `#page[…]` title page). */
function looksLikeCover(name: string, blocks: JSONNode[]): boolean {
  if (/cover|titel/i.test(name)) return true;
  return blocks.some(isCoverBlock);
}

// ─── Issue title (the mini-site's nav label + index <title>) ─────────────────

/** The masthead of a `#page[…]` cover: the LARGEST short `#text(size: NNpt)[…]`
 *  run (the issue name is set bigger than everything else on the title page). */
function mastheadText(content: string): string | undefined {
  let best: { size: number; text: string } | undefined;
  const re = /#text\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content))) {
    const open = m.index + m[0].length - 1;
    const args = matchBracket(content, open, '(', ')');
    if (!args) continue;
    let j = args.end;
    while (/\s/.test(content[j] ?? '')) j++;
    if (content[j] !== '[') continue;
    const body = matchBracket(content, j, '[', ']');
    if (!body) continue;
    const sizeM = args.inner.match(/size:\s*(\d+(?:\.\d+)?)\s*pt/);
    if (!sizeM) continue;
    const size = parseFloat(sizeM[1]);
    const text = body.inner.replace(/\\\s*/g, ' ').replace(/\s+/g, ' ').trim();
    if (size >= 18 && text.length >= 2 && text.length <= 48 && (!best || size > best.size)) {
      best = { size, text };
    }
  }
  return best?.text;
}

/**
 * Derives the ISSUE title from the document's cover — the mini-site's nav
 * label ("‹ LANGSAM") and index <title>. Returns undefined when there is no
 * recognisable cover (callers fall back to the first heading).
 */
export function deriveIssueTitle(doc: { content?: JSONNode[] }): string | undefined {
  for (const n of doc.content ?? []) {
    if (n.type !== 'typstRawBlock') continue;
    const c = String(n.attrs?.content ?? '');
    const cc = parseCoverCall(c);
    if (cc?.title) return cc.title;
    if (parseHero(c)?.kind === 'cover') {
      const t = mastheadText(c);
      if (t) return t;
    }
  }
  return undefined;
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

  // Front matter before the first chapter marker: when it carries its own
  // title page (a root-level `#cover(…)` / `#page[…]` — the report/concept
  // shape), it becomes the issue cover article rather than being glued onto
  // the first chapter; plain front matter still joins the first chapter.
  const articles: MagazineArticle[] = [];
  if (pre.length && pre.some(isCoverBlock)) {
    articles.push(deriveArticle('cover', 0, pre, true, false));
  } else if (pre.length) {
    groups[0].blocks.unshift(...pre);
  }

  articles.push(...groups.map((g, i) => deriveArticle(g.name, g.order, g.blocks, looksLikeCover(g.name, g.blocks) && (i === 0 || /cover|titel/i.test(g.name)))));
  return articles;
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
  // Only a cover CHAPTER (00-cover.typ) is a magazine signal — a report's
  // root-level `#cover(…)` title page (the synthetic pre-block cover) is not;
  // reports stay a single continuous page unless the user forces the split.
  const hasCover = articles.some((a) => a.isCover && a.fromMarker);
  return hasCover || openers >= 2;
}
