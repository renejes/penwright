/**
 * Phase D/E real end-to-end proof (NOT a CI test — a manual eyeball harness).
 *
 *   npx tsx scripts/web-export-proof.mts [extra-root.typ ...]
 *
 * Replicates main's runWebExport headlessly (no Electron): resolveIncludes →
 * deserialize → prepareWebDesign (style.json tokens OR inference from the
 * hand-written style.typ + @font-face embedding) → buildHtmlExportContext
 * (rendering display-math to SVG with the BUNDLED Typst binary) → mini-site
 * routing (isMagazineSite → buildWebSite, else buildWebBundle) — the SAME
 * modules and routing as importExport.runWebExport. Exports the sample project
 * (academic: math + cross-refs + citations + bibliography), the real LANGSAM
 * magazine if present, and any extra project root files passed as CLI args.
 * Writes self-contained bundles under /tmp for browser review.
 */
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { resolveIncludes } from '../src/shared/mergeDocument.ts';
import { deserializeTypst } from '../src/editor/lib/deserializer.ts';
import { buildExportModel, parseBibDirective, mathSnippet } from '../src/shared/exportContext.ts';
import { parseBibFile } from '../src/shared/bibParser.ts';
import { buildWebBundle, buildWebSite, prepareWebDesign, slugify, deriveTitle, type WebDesign } from '../src/main/webExport.ts';
import { splitIntoArticles, isMagazineSite, deriveIssueTitle, deriveDocMeta } from '../src/shared/magazineSplit.ts';
import type { HtmlExportContext } from '../src/shared/htmlSerializer.ts';

const repo = fileURLToPath(new URL('..', import.meta.url));
const TYPST = path.join(repo, 'resources/bin/typst-arm64-darwin');
const PKG = path.join(repo, 'resources/typst-packages');
const FONTS = path.join(repo, 'resources/fonts');

function renderSvg(snippet: string, rootDir: string): string | null {
  const stamp = `${process.pid}-${Date.now()}-${Math.round(Math.random() * 1e9)}`;
  const inFile = path.join(rootDir, `.pw-proof-${stamp}.typ`);
  const outFile = path.join(os.tmpdir(), `pw-proof-${stamp}.svg`);
  try {
    fs.writeFileSync(inFile, snippet, 'utf-8');
    execFileSync(TYPST, ['compile', '--package-path', PKG, '--font-path', FONTS, '--format', 'svg', '--root', rootDir, inFile, outFile], { stdio: 'ignore' });
    return fs.readFileSync(outFile, 'utf-8');
  } catch { return null; }
  finally { try { fs.unlinkSync(inFile); } catch {} try { fs.unlinkSync(outFile); } catch {} }
}

function buildContext(doc: any, merged: string, rootDir: string, design: WebDesign): HtmlExportContext {
  const model = buildExportModel(doc, merged);
  let bibEntries: ReturnType<typeof parseBibFile> = [];
  const bibDir = parseBibDirective(merged);
  if (bibDir?.path) {
    const abs = path.resolve(rootDir, bibDir.path);
    if (fs.existsSync(abs)) bibEntries = parseBibFile(fs.readFileSync(abs, 'utf-8'));
  }
  const langM = merged.match(/#set\s+text\([^)]*lang:\s*"([a-zA-Z-]+)"/);
  const lang = ((langM ? langM[1] : design.langHint) ?? 'en').slice(0, 2).toLowerCase() || 'en';
  const mathSvg = new Map<string, string>();
  const uniqueTex = [...new Set(model.mathBlocks.map((m) => m.tex))];
  let rendered = 0;
  for (const tex of uniqueTex) { const s = renderSvg(mathSnippet(tex), rootDir); if (s) { mathSvg.set(tex, s); rendered++; } }
  console.log(`    math blocks: ${uniqueTex.length} unique, ${rendered} rendered to SVG`);
  return {
    ...model, bibEntries, bibTitle: bibDir?.title, mathSvg, lang,
    leadStyle: design.leadStyle, figureNumbering: design.figureNumbering,
  };
}

function auditHtml(html: string) {
  return {
    placeholders: (html.match(/pw:typst-raw|pw:unhandled|Phase D/g) ?? []).length,
    figures: (html.match(/<figure class="pw-figure"/g) ?? []).length,
    tableFigs: (html.match(/<figure class="pw-table-figure"/g) ?? []).length,
    math: (html.match(/<figure class="pw-math"/g) ?? []).length,
    cites: (html.match(/class="pw-cite"/g) ?? []).length,
    refs: (html.match(/class="pw-ref"/g) ?? []).length,
    footnotes: html.includes('class="pw-footnotes"') ? (html.match(/<li id="fn-/g) ?? []).length : 0,
    bib: html.includes('pw-bibliography') ? (html.match(/class="pw-bib-entry"/g) ?? []).length : 0,
    openers: (html.match(/class="pw-opener"/g) ?? []).length,
    pulls: (html.match(/class="pw-pull"/g) ?? []).length,
    columns: (html.match(/class="pw-columns"/g) ?? []).length,
    grids: (html.match(/class="pw-grid"/g) ?? []).length,
    fontFaces: (html.match(/@font-face/g) ?? []).length,
    sections: (html.match(/pw-section-[a-z]/g) ?? []).length,
    ogDesc: (html.match(/og:description/g) ?? []).length,
    comments: (html.match(/\/\/ [A-ZÄÖÜa-z]/g) ?? []).length, // leaked Typst comments
  };
}

function exportProject(label: string, rootFile: string, outDir: string) {
  console.log(`\n── ${label} ──\n    root: ${rootFile}`);
  if (!fs.existsSync(rootFile)) { console.log('    (skipped — not found)'); return; }
  const rootDir = path.dirname(rootFile);
  const merged = resolveIncludes(rootFile);
  const doc = deserializeTypst(merged);
  const design = prepareWebDesign({ rootDir, mergedContent: merged, bundledFontsDir: FONTS });
  console.log(`    design: ${design.inferred ? 'INFERRED from style.typ' : 'style.json tokens'} · lead=${design.leadStyle} · figNum=${design.figureNumbering} · fonts: ${design.fonts.files.length} files [${[...new Set(design.fonts.files.map(f => f.family))].join(', ')}]`);
  const title = deriveIssueTitle(doc as any) ?? deriveTitle(doc as any);
  const slug = slugify(title);
  const ctx = buildContext(doc, merged, rootDir, design);
  fs.rmSync(outDir, { recursive: true, force: true });

  // The SAME routing as importExport.runWebExport: magazine → mini-site.
  const docMeta = deriveDocMeta(doc as any);
  const meta = { title, locale: ctx.lang, description: docMeta.description, cover: docMeta.cover };
  const articles = splitIntoArticles(doc as any);
  if (isMagazineSite(articles, doc as any)) {
    const site = buildWebSite({ articles, style: design.style, meta, outDir, rootDir, context: ctx, fonts: design.fonts });
    const indexHtml = fs.readFileSync(site.indexPath, 'utf-8');
    let total = { ...auditHtml(indexHtml) };
    for (const p of site.pages.slice(1)) {
      const a = auditHtml(fs.readFileSync(path.join(outDir, p), 'utf-8'));
      for (const k of Object.keys(total) as (keyof typeof total)[]) total[k] += a[k];
    }
    console.log(`    MINI-SITE "${title}" · ${site.pages.length} pages · assets: ${site.assets.length}`);
    console.log('   ', JSON.stringify(total));
    console.log(`    → open: ${site.indexPath}`);
    if (total.placeholders > 0) console.log(`    ⚠ ${total.placeholders} leftover placeholders!`);
    return;
  }

  const bundle = buildWebBundle({ doc, style: design.style, meta, slug, outDir, rootDir, context: ctx, fonts: design.fonts });
  const html = fs.readFileSync(bundle.indexPath, 'utf-8');
  const counts = auditHtml(html);
  console.log(`    SINGLE PAGE · title: "${title}"  ·  ${(html.length / 1024).toFixed(0)} KB  ·  assets: ${bundle.assets.length}`);
  console.log('   ', JSON.stringify(counts));
  console.log(`    → open: ${bundle.indexPath}`);
  if (counts.placeholders > 0) console.log(`    ⚠ ${counts.placeholders} leftover placeholders!`);
}

exportProject('Sample project (academic)', path.join(repo, 'resources/sample-project/main.typ'), '/tmp/pw-web-sample');
const langsam = path.join(os.homedir(), 'Desktop/LANGSAM/main.typ');
exportProject('LANGSAM (magazine)', langsam, '/tmp/pw-web-langsam');
for (const extra of process.argv.slice(2)) {
  const abs = path.resolve(extra);
  exportProject(path.basename(abs), abs, path.join('/tmp', 'pw-web-' + slugify(path.basename(path.dirname(abs)))));
}
console.log('');
