// Web-export bundle writer (Phase B.3).
//
// Turns a TipTap document + ProjectStyle into a self-contained, framework-
// agnostic bundle on disk:
//
//   <slug>/
//     index.html     # standalone <!doctype> page (open in any browser, host as a file)
//     fragment.html  # just <article> + scoped <style> (embed into any host)
//     meta.json      # generic metadata (the only cross-consumer contract)
//     assets/…       # referenced images, with <img src> rewritten to relative paths
//                    # (or, with inlineAssets, images become data: URIs and there is no folder)
//
// Deliberately ELECTRON-FREE (only fs/path + the shared serializers) so it can
// be unit-tested headlessly; importExport.ts owns the dialogs and wires it in.

import fs from 'node:fs';
import path from 'node:path';
import { serializeHtml, type ArticleMeta, type HtmlExportContext } from '../shared/htmlSerializer';
import { styleToCss } from '../shared/styleToCss';
import type { ProjectStyle } from '../shared/styleTypes';
import type { MagazineArticle } from '../shared/magazineSplit';

const MIME: Record<string, string> = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.avif': 'image/avif',
};

/** kebab-cases a title into a filesystem/URL-safe slug. */
export function slugify(s: string): string {
  return (s || 'article')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    .slice(0, 60).replace(/-+$/, '') || 'article'; // re-trim: the slice can cut just after a dash
}

/** First heading's text, used as a default article title. */
export function deriveTitle(doc: { content?: any[] }): string {
  for (const n of doc.content ?? []) {
    if (n.type === 'heading') {
      const text = (n.content ?? []).map((c: any) => c.text ?? '').join('').trim();
      if (text) return text;
    }
  }
  return 'Article';
}

export interface BuildWebBundleArgs {
  /** TipTap JSON document. */
  doc: any;
  style: ProjectStyle;
  meta: ArticleMeta;
  slug: string;
  /** The bundle directory to create and write into. */
  outDir: string;
  /** Project root — image `src`s are resolved relative to this. */
  rootDir: string;
  /** Inline every image as a data: URI (→ a single paste-able file, no assets/). */
  inlineAssets?: boolean;
  /** Resolved cross-refs / citations / footnotes / bibliography / math (Phase D). */
  context?: HtmlExportContext;
}

export interface WebBundleResult {
  dir: string;
  indexPath: string;
  fragmentPath: string;
  metaPath: string;
  /** Relative asset paths written under the bundle (empty when inlined). */
  assets: string[];
}

/**
 * Builds the bundle. Renders both output modes from the same content + tokens,
 * copies (or inlines) referenced images, and writes index.html / fragment.html
 * / meta.json.
 */
export function buildWebBundle(args: BuildWebBundleArgs): WebBundleResult {
  const css = styleToCss(args.style);
  const fragment = serializeHtml(args.doc, { slug: args.slug, scopedCss: css, mode: 'fragment', context: args.context });
  const document = serializeHtml(args.doc, { slug: args.slug, scopedCss: css, mode: 'document', meta: args.meta, context: args.context, pageBackground: args.style.colors.background });

  fs.mkdirSync(args.outDir, { recursive: true });

  const assets: string[] = [];
  const rewrite = makeAssetRewriter(args.rootDir, args.outDir, assets, !!args.inlineAssets);
  // Same rewriter closure for both → an image used in both files is copied once.
  const fragmentOut = rewrite(fragment);
  const documentOut = rewrite(document);

  const indexPath = path.join(args.outDir, 'index.html');
  const fragmentPath = path.join(args.outDir, 'fragment.html');
  const metaPath = path.join(args.outDir, 'meta.json');
  fs.writeFileSync(indexPath, documentOut, 'utf-8');
  fs.writeFileSync(fragmentPath, fragmentOut, 'utf-8');
  fs.writeFileSync(metaPath, JSON.stringify({ slug: args.slug, ...args.meta, assets }, null, 2), 'utf-8');

  return { dir: args.outDir, indexPath, fragmentPath, metaPath, assets };
}

export interface BuildWebSiteArgs {
  /** Articles from splitIntoArticles (one is the cover → index.html). */
  articles: MagazineArticle[];
  style: ProjectStyle;
  /** Issue-level metadata (title / locale) for the index page + meta.json. */
  meta: ArticleMeta;
  outDir: string;
  rootDir: string;
  /** Shared, issue-wide resolved context (cross-refs / citations / math). */
  context?: HtmlExportContext;
  inlineAssets?: boolean;
}

export interface WebSiteResult {
  dir: string;
  indexPath: string;
  /** Relative filenames written (index.html + one per article). */
  pages: string[];
  assets: string[];
}

/**
 * Builds a magazine MINI-SITE: an issue index (cover + table of contents) plus
 * one self-contained HTML page per article, each with up/prev/next navigation —
 * the web-native model where every article has its own URL. Cross-refs /
 * citations / math share the issue-wide `context`; footnotes are collected
 * per-page (each article serialized independently). Assets are deduped across
 * all pages by a single shared rewriter.
 */
export function buildWebSite(args: BuildWebSiteArgs): WebSiteResult {
  const css = styleToCss(args.style);
  const bg = args.style.colors.background;
  const locale = args.meta.locale;

  // Assign unique filenames. The cover → index.html; the rest → <slug>.html.
  const used = new Set<string>(['index.html']);
  const reading = args.articles.filter((a) => !a.isCover);
  const fileOf = new Map<MagazineArticle, string>();
  for (const a of args.articles) {
    if (a.isCover) { fileOf.set(a, 'index.html'); continue; }
    let f = `${a.slug}.html`;
    if (used.has(f)) { let i = 2; while (used.has(`${a.slug}-${i}.html`)) i++; f = `${a.slug}-${i}.html`; }
    used.add(f); fileOf.set(a, f);
  }

  const tocItems = reading.map((a) => ({ href: fileOf.get(a)!, title: a.title, kicker: a.kicker, byline: a.byline }));

  const pages: { filename: string; html: string }[] = [];

  // Index page: the cover (if any) + the table of contents.
  const cover = args.articles.find((a) => a.isCover);
  const indexBlocks: any[] = cover
    ? [...cover.blocks]
    : [{ type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: String(args.meta.title ?? 'Contents') }] }];
  indexBlocks.push({ type: 'magazineToc', attrs: { items: tocItems } });
  pages.push({
    filename: 'index.html',
    html: serializeHtml({ type: 'doc', content: indexBlocks } as any, {
      slug: 'index', scopedCss: css, mode: 'document', meta: args.meta, context: args.context, pageBackground: bg,
    }),
  });

  // One page per reading article, with navigation.
  reading.forEach((a, i) => {
    const prev = reading[i - 1];
    const next = reading[i + 1];
    const topNav = { type: 'magazineNav', attrs: { upHref: 'index.html', upLabel: '‹ ' + String(args.meta.title ?? 'Contents') } };
    const botNav = {
      type: 'magazineNav',
      attrs: {
        upHref: 'index.html', upLabel: '‹ ' + String(args.meta.title ?? 'Contents'),
        prevHref: prev ? fileOf.get(prev) : undefined, prevTitle: prev?.title,
        nextHref: next ? fileOf.get(next) : undefined, nextTitle: next?.title,
      },
    };
    const subDoc = { type: 'doc', content: [topNav, ...a.blocks, botNav] };
    pages.push({
      filename: fileOf.get(a)!,
      html: serializeHtml(subDoc as any, {
        slug: a.slug, scopedCss: css, mode: 'document',
        meta: { title: a.title, locale }, context: args.context, pageBackground: bg,
      }),
    });
  });

  fs.mkdirSync(args.outDir, { recursive: true });
  const assets: string[] = [];
  const rewrite = makeAssetRewriter(args.rootDir, args.outDir, assets, !!args.inlineAssets);
  for (const p of pages) fs.writeFileSync(path.join(args.outDir, p.filename), rewrite(p.html), 'utf-8');

  const metaPath = path.join(args.outDir, 'meta.json');
  fs.writeFileSync(metaPath, JSON.stringify({
    ...args.meta,
    kind: 'magazine',
    articles: reading.map((a) => ({ slug: a.slug, file: fileOf.get(a), title: a.title, kicker: a.kicker, byline: a.byline })),
    assets,
  }, null, 2), 'utf-8');

  return { dir: args.outDir, indexPath: path.join(args.outDir, 'index.html'), pages: pages.map((p) => p.filename), assets };
}

/**
 * Returns a stateful `(html) => html` rewriter for `<img src>`: leaves
 * data:/http(s)/absolute sources untouched; for a real project-relative image,
 * either copies it into `<outDir>/assets/` (deduping basename collisions) and
 * rewrites the src to `assets/<name>`, or — with `inline` — embeds it as a
 * data: URI. A source resolving to no file is left as-is (a visible broken
 * link, never a crash).
 */
function makeAssetRewriter(rootDir: string, outDir: string, assets: string[], inline: boolean) {
  const mapped = new Map<string, string>(); // abs source → replacement src
  const usedNames = new Set<string>();
  const assetsDir = path.join(outDir, 'assets');

  const resolveOne = (src: string): string => {
    if (!src || /^(data:|https?:|\/\/|file:|[a-z]:[\\/]|\/)/i.test(src)) return src;
    // Containment + type allowlist: never copy/inline a file OUTSIDE the project
    // root (path traversal like `../../etc/passwd`) and only ever touch real
    // image files — anything else is left as the original src (a visible broken
    // link), never read into the shareable bundle.
    //
    // resolveIncludes merges chapters in place without rewriting image paths, so
    // a chapter figure still says `image("../assets/x.png")`. The direct resolve
    // then points OUTSIDE the root; retry by stripping leading `../` and
    // resolving from the root (mirrors docxSerializer.resolveImagePath) — still
    // only ever landing on an IN-ROOT file, so the traversal guard holds.
    let abs: string | null = null;
    for (const c of [path.resolve(rootDir, src), path.resolve(rootDir, src.replace(/^(\.\.[\\/])+/, ''))]) {
      const rel = path.relative(rootDir, c);
      const inside = rel !== '' && rel !== '..' && !rel.startsWith('..' + path.sep) && !path.isAbsolute(rel);
      if (inside && MIME[path.extname(c).toLowerCase()] && fs.existsSync(c) && fs.statSync(c).isFile()) { abs = c; break; }
    }
    if (!abs) return src;
    if (mapped.has(abs)) return mapped.get(abs)!;

    let replacement: string;
    if (inline) {
      const ext = path.extname(abs).toLowerCase();
      const mime = MIME[ext] ?? 'application/octet-stream';
      replacement = `data:${mime};base64,${fs.readFileSync(abs).toString('base64')}`;
    } else {
      let name = path.basename(abs);
      if (usedNames.has(name)) {
        const ext = path.extname(name), stem = name.slice(0, -ext.length || undefined);
        let i = 1;
        while (usedNames.has(`${stem}-${i}${ext}`)) i++;
        name = `${stem}-${i}${ext}`;
      }
      usedNames.add(name);
      fs.mkdirSync(assetsDir, { recursive: true });
      fs.copyFileSync(abs, path.join(assetsDir, name));
      const rel = `assets/${name}`;
      assets.push(rel);
      replacement = rel;
    }
    mapped.set(abs, replacement);
    return replacement;
  };

  return (html: string): string =>
    html.replace(/(<img\b[^>]*?\bsrc=")([^"]*)(")/g, (_m, pre, src, post) => pre + resolveOne(src) + post);
}
