/**
 * Phase D real end-to-end proof (NOT a CI test — a manual eyeball harness).
 *
 *   npx tsx scripts/web-export-proof.mts
 *
 * Replicates main's runWebExport headlessly (no Electron): resolveIncludes →
 * deserialize → buildHtmlExportContext (rendering display-math to SVG with the
 * BUNDLED Typst binary) → buildWebBundle. Exports the sample project (academic:
 * math + cross-refs + citations + bibliography) and, if present, the real
 * LANGSAM magazine. Writes self-contained bundles under /tmp for browser review.
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
import { buildWebBundle, slugify, deriveTitle } from '../src/main/webExport.ts';
import { sanitizeProjectStyle, DEFAULT_PROJECT_STYLE } from '../src/shared/styleTypes.ts';
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

function loadStyle(rootDir: string) {
  try {
    const p = path.join(rootDir, '.penwright/style.json');
    if (fs.existsSync(p)) return sanitizeProjectStyle(JSON.parse(fs.readFileSync(p, 'utf-8')));
  } catch {}
  return DEFAULT_PROJECT_STYLE;
}

function buildContext(doc: any, merged: string, rootDir: string): HtmlExportContext {
  const model = buildExportModel(doc, merged);
  let bibEntries: ReturnType<typeof parseBibFile> = [];
  const bibDir = parseBibDirective(merged);
  if (bibDir?.path) {
    const abs = path.resolve(rootDir, bibDir.path);
    if (fs.existsSync(abs)) bibEntries = parseBibFile(fs.readFileSync(abs, 'utf-8'));
  }
  const langM = merged.match(/#set\s+text\([^)]*lang:\s*"([a-zA-Z-]+)"/);
  const lang = (langM ? langM[1] : 'en').slice(0, 2).toLowerCase() || 'en';
  const mathSvg = new Map<string, string>();
  const uniqueTex = [...new Set(model.mathBlocks.map((m) => m.tex))];
  let rendered = 0;
  for (const tex of uniqueTex) { const s = renderSvg(mathSnippet(tex), rootDir); if (s) { mathSvg.set(tex, s); rendered++; } }
  console.log(`    math blocks: ${uniqueTex.length} unique, ${rendered} rendered to SVG`);
  return { ...model, bibEntries, bibTitle: bibDir?.title, mathSvg, lang };
}

function exportProject(label: string, rootFile: string, outDir: string) {
  console.log(`\n── ${label} ──\n    root: ${rootFile}`);
  if (!fs.existsSync(rootFile)) { console.log('    (skipped — not found)'); return; }
  const rootDir = path.dirname(rootFile);
  const merged = resolveIncludes(rootFile);
  const doc = deserializeTypst(merged);
  const style = loadStyle(rootDir);
  const title = deriveTitle(doc as any);
  const slug = slugify(title);
  const ctx = buildContext(doc, merged, rootDir);
  fs.rmSync(outDir, { recursive: true, force: true });
  const bundle = buildWebBundle({ doc, style, meta: { title, locale: ctx.lang }, slug, outDir, rootDir, context: ctx });
  const html = fs.readFileSync(bundle.indexPath, 'utf-8');
  // Quick content audit.
  const counts = {
    placeholders: (html.match(/pw:typst-raw|pw:unhandled|Phase D/g) ?? []).length,
    figures: (html.match(/<figure class="pw-figure"/g) ?? []).length,
    tableFigs: (html.match(/<figure class="pw-table-figure"/g) ?? []).length,
    math: (html.match(/<figure class="pw-math"/g) ?? []).length,
    mathSvg: (html.match(/class="pw-math-svg"/g) ?? []).length,
    cites: (html.match(/class="pw-cite"/g) ?? []).length,
    refs: (html.match(/class="pw-ref"/g) ?? []).length,
    footnotes: html.includes('class="pw-footnotes"') ? (html.match(/<li id="fn-/g) ?? []).length : 0,
    bib: html.includes('pw-bibliography') ? (html.match(/class="pw-bib-entry"/g) ?? []).length : 0,
    openers: (html.match(/class="pw-opener"/g) ?? []).length,
    pulls: (html.match(/class="pw-pull"/g) ?? []).length,
    columns: (html.match(/class="pw-columns"/g) ?? []).length,
    grids: (html.match(/class="pw-grid"/g) ?? []).length,
  };
  console.log(`    title: "${title}"  ·  ${(html.length / 1024).toFixed(0)} KB  ·  assets: ${bundle.assets.length}`);
  console.log('   ', JSON.stringify(counts));
  console.log(`    → open: ${bundle.indexPath}`);
  if (counts.placeholders > 0) console.log(`    ⚠ ${counts.placeholders} leftover placeholders!`);
}

exportProject('Sample project (academic)', path.join(repo, 'resources/sample-project/main.typ'), '/tmp/pw-web-sample');
const langsam = path.join(os.homedir(), 'Desktop/LANGSAM/main.typ');
exportProject('LANGSAM (magazine)', langsam, '/tmp/pw-web-langsam');
console.log('');
