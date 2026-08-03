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
import { sanitizeProjectStyle, type ProjectStyle } from '../shared/styleTypes';
import { inferStyleFromTypst, detectLeadStyle } from '../shared/styleInference';
import { isDesignAdopted } from '../shared/styleWrite';
import type { MagazineArticle } from '../shared/magazineSplit';
import { buildFontAssets, writeFontFiles, type FontAssets } from './webFonts';

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

// ─── Design resolution (tokens + fonts + macro semantics) ────────────────────

/** Everything the web export needs to know about the project's DESIGN, from
 *  whichever source the project actually has. */
export interface WebDesign {
  style: ProjectStyle;
  /** What the project's `#lead[…]` means (drop cap vs standfirst). */
  leadStyle: 'dropcap' | 'standfirst';
  /** Document language found in the style source — style.typ is `#import`ed,
   *  so the merged chapter content never carries its `#set text(lang: …)`. */
  langHint?: string;
  /** False when the design sets `#set figure(numbering: none)`. */
  figureNumbering: boolean;
  /** @font-face rules + font files for the families the style uses. */
  fonts: FontAssets;
  /** True when the tokens were INFERRED from a hand-written style.typ. */
  inferred: boolean;
}

const MAX_STYLE_SOURCE = 300 * 1024;

function readIfSmall(p: string): string | null {
  try {
    const st = fs.statSync(p);
    if (!st.isFile() || st.size > MAX_STYLE_SOURCE) return null;
    return fs.readFileSync(p, 'utf-8');
  } catch { return null; }
}

/** Reads the project's style/macro sources: `style.typ` + every root-contained
 *  `.typ` the merged document `#import`s (chapters say `../macros.typ` — the
 *  leading `../` is retried from the root, mirroring the asset rewriter). */
export function collectStyleSources(rootDir: string, mergedContent: string): string[] {
  const seen = new Set<string>();
  const sources: string[] = [];
  const tryAdd = (rel: string) => {
    if (/^@/.test(rel)) return; // package imports have no local file
    const clean = rel.replace(/^(\.\.[\\/])+/, '');
    for (const cand of [path.resolve(rootDir, rel), path.resolve(rootDir, clean)]) {
      const relCheck = path.relative(rootDir, cand);
      if (relCheck === '' || relCheck.startsWith('..' + path.sep) || relCheck === '..' || path.isAbsolute(relCheck)) continue;
      if (seen.has(cand)) return;
      const content = readIfSmall(cand);
      if (content !== null) { seen.add(cand); sources.push(content); return; }
    }
  };
  tryAdd('style.typ');
  for (const m of mergedContent.matchAll(/#import\s+"([^"]+\.typ)"/g)) tryAdd(m[1]);
  return sources;
}

/**
 * Resolves the project's design for the web export:
 *  1. `.penwright/style.json` tokens when the project has them (the Design
 *     Editor is the source of truth),
 *  2. otherwise INFERRED tokens scraped from the hand-written style.typ /
 *     macro files (styleInference) — the ai-magazine-designer / hand-crafted
 *     project shape that previously exported with the default look,
 *  3. plus the font files (@font-face) for whichever families won.
 */
export function prepareWebDesign(args: {
  rootDir: string;
  mergedContent: string;
  /** Pre-loaded style.json tokens (main passes getProjectStyle); when absent
   *  the rootDir's .penwright/style.json is read directly (headless path). */
  styleOverride?: ProjectStyle | null;
  /** The bundled OFL fonts directory (resources/fonts), if available. */
  bundledFontsDir?: string | null;
  inlineAssets?: boolean;
}): WebDesign {
  const { rootDir, mergedContent } = args;
  const sources = collectStyleSources(rootDir, mergedContent);

  let style: ProjectStyle | null = args.styleOverride ?? null;
  let inferred = false;
  // The fallback asks the guard ITSELF rather than trusting the caller to have
  // asked. `runWebExport` passes `null` for a hand-written project — and this
  // read handed the same style.json straight back, so the decision never
  // reached the output: measured end-to-end into `index.html`, an authored
  // Montserrat/Playfair look came out as the defaults in a stray style.json.
  // A flag would have been forgotten too: `scripts/web-export-proof.mts` calls
  // this with no override at all.
  if (!style && isDesignAdopted(rootDir)) {
    try {
      const p = path.join(rootDir, '.penwright', 'style.json');
      if (fs.existsSync(p)) style = sanitizeProjectStyle(JSON.parse(fs.readFileSync(p, 'utf-8')));
    } catch { /* fall through to inference */ }
  }
  if (!style) {
    const inf = inferStyleFromTypst(sources);
    style = sanitizeProjectStyle(inf.confident ? inf.style : {});
    inferred = inf.confident;
  }
  // The document language usually lives in the (#import'ed) style source —
  // token projects too (generateStyleTypst emits `lang:` into style.typ).
  const langM = sources.join('\n').match(/\blang:\s*"([a-zA-Z-]+)"/);
  const langHint = langM ? langM[1].slice(0, 2).toLowerCase() : undefined;

  const leadStyle = detectLeadStyle(sources);
  const designText = `${mergedContent}\n${style.custom?.preamble ?? ''}\n${sources.join('\n')}`;
  const figureNumbering = !/#set\s+figure\([^)]*numbering:\s*none/.test(designText);

  // Families: the document fonts + any section-style (Kapitel-Look) overrides,
  // so an opted-in chapter's font renders on machines without it installed.
  const sectionFonts = (style.sections ?? []).flatMap((s) => [s.fonts?.body, s.fonts?.heading, s.fonts?.code]);
  const families = [...new Set([style.fonts.body, style.fonts.heading, style.fonts.code, ...sectionFonts].filter((f): f is string => !!f))];
  const fonts = buildFontAssets({
    families,
    fontDirs: [path.join(rootDir, 'fonts'), path.join(rootDir, 'assets', 'fonts'), args.bundledFontsDir],
    inline: args.inlineAssets,
  });

  return { style, leadStyle, langHint, figureNumbering, fonts, inferred };
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
  /** @font-face rules + font files to embed (webFonts.buildFontAssets). */
  fonts?: FontAssets;
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
  // @font-face at-rules FIRST, then the scoped token CSS that references them.
  const css = [args.fonts?.css, styleToCss(args.style)].filter(Boolean).join('\n');
  const fragment = serializeHtml(args.doc, { slug: args.slug, scopedCss: css, mode: 'fragment', context: args.context });
  const document = serializeHtml(args.doc, { slug: args.slug, scopedCss: css, mode: 'document', meta: args.meta, context: args.context, pageBackground: args.style.colors.background });

  fs.mkdirSync(args.outDir, { recursive: true });

  const assets: string[] = [];
  assets.push(...writeFontFiles(args.outDir, args.fonts?.files ?? []));
  const rw = makeAssetRewriter(args.rootDir, args.outDir, assets, !!args.inlineAssets);
  // Same rewriter closure for both → an image used in both files is copied once.
  const fragmentOut = rw.rewrite(fragment);
  const documentOut = rw.rewrite(document);

  const indexPath = path.join(args.outDir, 'index.html');
  const fragmentPath = path.join(args.outDir, 'fragment.html');
  const metaPath = path.join(args.outDir, 'meta.json');
  fs.writeFileSync(indexPath, documentOut, 'utf-8');
  fs.writeFileSync(fragmentPath, fragmentOut, 'utf-8');
  // meta.json cover → the copied bundle asset (same mapping as the HTML).
  const meta = { ...args.meta };
  if (typeof meta.cover === 'string' && meta.cover) meta.cover = rw.resolve(meta.cover);
  // `kind` is the reliable article-vs-magazine discriminator a consumer keys on
  // (web-export-contract.md §2). Single bundle → 'article'; the mini-site writer
  // sets 'magazine'. Placed after the spread so it is always authoritative.
  fs.writeFileSync(metaPath, JSON.stringify({ slug: args.slug, ...meta, kind: 'article', assets }, null, 2), 'utf-8');

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
  /** @font-face rules + font files to embed (webFonts.buildFontAssets). */
  fonts?: FontAssets;
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
  // @font-face at-rules FIRST, then the scoped token CSS that references them.
  const css = [args.fonts?.css, styleToCss(args.style)].filter(Boolean).join('\n');
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

  // One page per reading article, with navigation. Each page carries its
  // frontmatter (description/cover → <head> + og:*) and its section-style
  // class (Kapitel-Look) when the chapter opted in via `#show: <id>-style`.
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
        meta: { title: a.title, locale, description: a.description, cover: a.cover },
        context: args.context, pageBackground: bg, sectionId: a.sectionId,
      }),
    });
  });

  fs.mkdirSync(args.outDir, { recursive: true });
  const assets: string[] = [];
  assets.push(...writeFontFiles(args.outDir, args.fonts?.files ?? []));
  const rw = makeAssetRewriter(args.rootDir, args.outDir, assets, !!args.inlineAssets);
  for (const p of pages) fs.writeFileSync(path.join(args.outDir, p.filename), rw.rewrite(p.html), 'utf-8');

  const metaPath = path.join(args.outDir, 'meta.json');
  fs.writeFileSync(metaPath, JSON.stringify({
    ...args.meta,
    kind: 'magazine',
    articles: reading.map((a) => ({
      slug: a.slug,
      file: fileOf.get(a),
      title: a.title,
      kicker: a.kicker,
      byline: a.byline,
      description: a.description,
      // meta.json cover → the copied bundle asset (same mapping as the HTML).
      cover: a.cover ? rw.resolve(a.cover) : undefined,
      section: a.sectionId,
    })),
    assets,
  }, null, 2), 'utf-8');

  return { dir: args.outDir, indexPath: path.join(args.outDir, 'index.html'), pages: pages.map((p) => p.filename), assets };
}

/**
 * Returns a stateful rewriter for image sources: leaves data:/http(s)/absolute
 * sources untouched; for a real project-relative image, either copies it into
 * `<outDir>/assets/` (deduping basename collisions) and rewrites the src to
 * `assets/<name>`, or — with `inline` — embeds it as a data: URI. A source
 * resolving to no file is left as-is (a visible broken link, never a crash).
 * Rewrites `<img src>` AND the `og:image` head meta; `resolve` maps a single
 * source (the meta.json cover fields) through the same copy/dedup state.
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

  const rewrite = (html: string): string =>
    html
      .replace(/(<img\b[^>]*?\bsrc=")([^"]*)(")/g, (_m, pre, src, post) => pre + resolveOne(src) + post)
      .replace(/(<meta property="og:image" content=")([^"]*)(")/g, (_m, pre, src, post) => pre + resolveOne(src) + post);
  return { rewrite, resolve: resolveOne };
}
