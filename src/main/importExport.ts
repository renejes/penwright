/**
 * Import/Export Handlers — extracted from index.ts
 * PDF, DOCX, Markdown Import, Zotero, Style Templates, Citations
 */

import { dialog, shell } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { execFileSync, execFile } from 'child_process';
import { promisify } from 'util';

// Async variant for the snippet renderers: they run inside Promise.all —
// with execFileSync each compile blocked the whole main process and the
// "parallel" renders were strictly sequential.
const execFileAsync = promisify(execFile);
import { getTypstPath, getTypstFontPath, buildTypstCompileArgs } from './typstPath';
import { watch, type FSWatcher } from 'chokidar';
import { deserializeTypst } from './deserializer-bridge';
import { serializeDocx, type RenderedSnippet } from '../shared/docxSerializer';
import { markdownToTypst } from '../shared/markdownImporter';
import { styleTemplates } from '../shared/styleTemplates';
import { findRootFile } from '../shared/rootFinder';
import { resolveIncludes } from '../shared/mergeDocument';
import { parseBibFile } from '../shared/bibParser';
import { buildExportModel, parseBibDirective, mathSnippet } from '../shared/exportContext';
import { generateStyleTypst } from '../shared/styleParser';
import { buildPrintGeometryOverlay, injectAfterPrologue } from './printOverlay';
import { sanitizeProjectStyle, DEFAULT_PROJECT_STYLE } from '../shared/styleTypes';
import { appState } from './appState';
import { findBibFiles } from '../shared/bibDiscovery';
import { planPrintExport, TEMP_EXPORT_BASENAME, TEMP_STYLE_PRINT_BASENAME } from '../shared/printExportPlan';
import { stripPreamble } from './fileManager';
import { ensureClaudeSkills } from './projectManager';
import { saveZoteroBibPath, getProjectStyle, hasProjectStyle, getLocale } from './persistenceManager';
import { resolveDict } from '../shared/i18n';
import { buildWebBundle, buildWebSite, prepareWebDesign, slugify, deriveTitle, type WebDesign } from './webExport';
import { splitIntoArticles, isMagazineSite, deriveIssueTitle, deriveDocMeta } from '../shared/magazineSplit';
import type { ArticleMeta, HtmlExportContext } from '../shared/htmlSerializer';

let zoteroWatcher: FSWatcher | null = null;

export function getZoteroWatcher(): FSWatcher | null {
  return zoteroWatcher;
}

// ─── Export-Selection helpers ────────────────────────────
// Parses the project's root file for the structural building blocks the
// user can opt in / out of when exporting (chapters, bibliography). Used
// by the Export dialog and by the high-level export functions to build
// a filtered version of the root before compiling.

export interface ExportableChapter {
  /** Path as written in the #include (relative to the root). */
  includePath: string;
  /** Friendly title — first H1 of the included file, or the basename. */
  title: string;
}

/**
 * Print ("Für den Druck") options. When present on an ExportConfig (PDF only)
 * the export writes a temporary print-style.typ with an oversized page +
 * bleed-aware margins + (optional) crop marks, and compiles that. `bleed` and
 * `binding` are Typst lengths ("" disables). See styleParser print mode.
 */
export interface PrintExportConfig {
  bleed: string;
  cropMarks: boolean;
  facingPages: boolean;
  binding: string;
}

export interface ExportableSections {
  /** Whether the project consists of multiple chapters (#include lines). */
  multiChapter: boolean;
  rootFile: string;
  chapters: ExportableChapter[];
  hasBibliography: boolean;
  /** Persisted print defaults from style.json, to pre-fill the export dialog. */
  printDefaults: PrintExportConfig;
}

const INCLUDE_RE = /^#include\s+"([^"]+)"\s*$/gm;
const BIB_RE = /^#bibliography\(/m;

function chapterTitle(rootDir: string, includePath: string): string {
  const fullPath = path.resolve(rootDir, includePath);
  try {
    const content = fs.readFileSync(fullPath, 'utf-8');
    const headingMatch = content.match(/^=\s+(.+?)\s*$/m);
    if (headingMatch) return headingMatch[1].trim();
  } catch {}
  return path.basename(includePath, '.typ').replace(/^\d+[-_]?/, '').replace(/[-_]/g, ' ').trim() || includePath;
}

export function getExportableSections(): ExportableSections | null {
  if (!appState.currentFilePath) return null;
  const rootFile = findRootFile(appState.currentFilePath);
  if (!fs.existsSync(rootFile)) return null;

  const rootContent = fs.readFileSync(rootFile, 'utf-8');
  const rootDir = path.dirname(rootFile);

  const chapters: ExportableChapter[] = [];
  for (const match of rootContent.matchAll(INCLUDE_RE)) {
    const includePath = match[1];
    chapters.push({ includePath, title: chapterTitle(rootDir, includePath) });
  }

  const style = appState.projectDir ? getProjectStyle(appState.projectDir) : null;
  return {
    multiChapter: chapters.length > 0,
    rootFile,
    chapters,
    hasBibliography: BIB_RE.test(rootContent),
    printDefaults: {
      bleed:       style?.layout.bleed ?? '',
      cropMarks:   style?.layout.cropMarks ?? false,
      facingPages: style?.layout.facingPages ?? false,
      binding:     style?.layout.binding ?? '',
    },
  };
}

/**
 * Returns a copy of the root file's source with unselected #include
 * lines and (optionally) the #bibliography line removed.
 *
 * If `selectedIncludes` is null, all includes are kept.
 */
function buildFilteredRoot(rootContent: string, selectedIncludes: string[] | null, includeBibliography: boolean): string {
  let out = rootContent;

  if (selectedIncludes !== null) {
    const selected = new Set(selectedIncludes);
    out = out.replace(INCLUDE_RE, (line, includePath: string) => {
      return selected.has(includePath) ? line : `// removed: ${includePath}`;
    });
  }

  if (!includeBibliography) {
    out = out.replace(/^#bibliography\([^)]*\).*$/gm, line => `// removed: ${line.trim()}`);
  }

  return out;
}


/**
 * Writes a filtered copy of the root file alongside the original and
 * returns the path. Caller must clean up via `cleanupExportTemp()`.
 */
function writeExportTemp(rootFile: string, selectedIncludes: string[] | null, includeBibliography: boolean): string {
  const rootContent = fs.readFileSync(rootFile, 'utf-8');
  const filtered = buildFilteredRoot(rootContent, selectedIncludes, includeBibliography);
  const tempPath = path.join(path.dirname(rootFile), TEMP_EXPORT_BASENAME);
  fs.writeFileSync(tempPath, filtered, 'utf-8');
  return tempPath;
}

function cleanupExportTemp(rootDir: string): void {
  try { fs.unlinkSync(path.join(rootDir, TEMP_EXPORT_BASENAME)); } catch {}
}

/** Reads PNG width/height from the IHDR header (big-endian). */
function pngDimensions(buf: Buffer): { width: number; height: number } | null {
  if (buf.length >= 24 && buf.readUInt32BE(0) === 0x89504e47) {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  return null;
}

// ─── Print export ("Für den Druck") ──────────────────────
// A separate, export-only transform (no safe-apply): write a temp print
// style.typ (oversized page + bleed + crop marks) and a temp root whose style
// import is repointed at it, compile that, then delete both. The real
// style.typ / project is never touched.


/**
 * Stages the print-export temp files next to the root and returns the temp
 * root + a cleanup that removes both temp files. Reuses the chapter /
 * bibliography filter so a print export can also pick chapters.
 */
function writePrintExportTemp(rootFile: string, config: ExportConfig): { tempRoot: string; cleanup: () => void } {
  const original = fs.readFileSync(rootFile, 'utf-8');
  const rootContent = buildFilteredRoot(original, config.selectedIncludes, config.includeBibliography);

  // The branch between a token project and a hand-designed one lives in
  // shared/printExportPlan.ts, so penwright_export_print takes the same one —
  // it used to always regenerate style.typ, which swapped an author's design
  // for Penwright's defaults.
  const plan = planPrintExport({
    rootFile,
    rootContent,
    originalRoot: original,
    print: config.print!,
    style: appState.projectDir && hasProjectStyle(appState.projectDir)
      ? getProjectStyle(appState.projectDir)
      : null,
    buildOverlay: buildPrintGeometryOverlay,
    injectOverlay: injectAfterPrologue,
  });

  for (const w of plan.writes) fs.writeFileSync(w.abs, w.content, 'utf-8');
  for (const warning of plan.warnings) console.warn('[penwright] print export:', warning);

  return {
    tempRoot: plan.tempRoot,
    cleanup: () => {
      for (const w of plan.writes) {
        try { fs.unlinkSync(w.abs); } catch {}
      }
    },
  };
}

// Print-overlay helpers for hand-designed projects live in printOverlay.ts
// (electron-free, like webExport/webFonts, so the proof scripts can drive
// them directly against real projects).

/** Reads JPEG width/height from the first SOFn frame marker (big-endian). */
function jpegDimensions(buf: Buffer): { width: number; height: number } | null {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let off = 2;
  while (off + 9 < buf.length) {
    if (buf[off] !== 0xff) { off++; continue; }
    const marker = buf[off + 1];
    // SOF0–SOF15 carry the frame size; skip DHT(c4)/JPG(c8)/DAC(cc).
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: buf.readUInt16BE(off + 5), width: buf.readUInt16BE(off + 7) };
    }
    if (off + 3 >= buf.length) break;
    off += 2 + buf.readUInt16BE(off + 2);
  }
  return null;
}

/** Best-effort pixel dimensions from a PNG/JPEG header (no dependency). */
function imageDimensions(absPath: string): { width: number; height: number } | null {
  try {
    const fd = fs.openSync(absPath, 'r');
    const buf = Buffer.alloc(65536);
    const read = fs.readSync(fd, buf, 0, buf.length, 0);
    fs.closeSync(fd);
    const slice = buf.subarray(0, read);
    return pngDimensions(slice) ?? jpegDimensions(slice);
  } catch {
    return null;
  }
}

const IMAGE_REF_RE = /image\(\s*"([^"]+)"/g;
/** Below this edge length a raster image is unlikely to hit 300 dpi at A4 width. */
const MIN_PRINT_EDGE_PX = 1500;

/**
 * Heuristic dpi pre-flight: scans the in-scope .typ files for `image("…")`
 * references and flags raster images that are likely too low-res for print
 * (< ~1500 px on the short edge). Vector/unreadable images are skipped — the
 * placement size is compile-time, so this is a coarse warning, not exact dpi.
 * Returns "relpath — W×H px" lines; empty = nothing to warn about.
 */
export function preflightPrintImages(config: ExportConfig): string[] {
  if (!appState.currentFilePath) return [];
  const rootFile = findRootFile(appState.currentFilePath);
  const rootDir = path.dirname(rootFile);

  const files = new Set<string>([rootFile]);
  let rootContent = '';
  try { rootContent = fs.readFileSync(rootFile, 'utf-8'); } catch { return []; }
  for (const m of rootContent.matchAll(INCLUDE_RE)) {
    const inc = m[1];
    if (config.selectedIncludes === null || config.selectedIncludes.includes(inc)) {
      files.add(path.resolve(rootDir, inc));
    }
  }

  const warnings: string[] = [];
  const seen = new Set<string>();
  for (const f of files) {
    let content: string;
    try { content = fs.readFileSync(f, 'utf-8'); } catch { continue; }
    for (const m of content.matchAll(IMAGE_REF_RE)) {
      const rel = m[1];
      if (seen.has(rel)) continue;
      seen.add(rel);
      const dim = imageDimensions(path.resolve(path.dirname(f), rel));
      if (!dim) continue;
      if (Math.min(dim.width, dim.height) < MIN_PRINT_EDGE_PX) {
        warnings.push(`${rel} — ${dim.width}×${dim.height} px`);
      }
    }
  }
  return warnings;
}

/**
 * Builds the Typst-snippet renderer the DOCX serializer uses to rasterise
 * display-math and SVG figures (which have no native Word representation).
 * Compiles each self-contained snippet to a PNG with the bundled packages +
 * fonts at 300 ppi. Returns null on failure so the serializer falls back to a
 * readable text placeholder instead of leaking raw source.
 */
function createTypstSnippetRenderer(baseDir: string): (snippet: string) => Promise<RenderedSnippet | null> {
  return async (snippet: string) => {
    const stamp = `${process.pid}-${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    // The input must live inside the Typst root, and SVG figures are referenced
    // by a baseDir-relative path — so write the temp file into baseDir (same
    // pattern the filtered-export temp file already uses) with `--root baseDir`.
    const inFile = path.join(baseDir, `.penwright-snip-${stamp}.typ`);
    const outFile = path.join(os.tmpdir(), `penwright-snip-${stamp}.png`);
    try {
      fs.writeFileSync(inFile, snippet, 'utf-8');
      await execFileAsync(getTypstPath(), buildTypstCompileArgs(['--ppi', '300', '--root', baseDir, inFile, outFile]));
      const png = fs.readFileSync(outFile);
      const dim = pngDimensions(png);
      if (!dim) return null;
      return { png, widthPx: dim.width, heightPx: dim.height, ppi: 300 };
    } catch {
      return null;
    } finally {
      try { fs.unlinkSync(inFile); } catch {}
      try { fs.unlinkSync(outFile); } catch {}
    }
  };
}

/**
 * Renders a self-contained Typst snippet (display math) to an SVG STRING for
 * the web export — sharp, scalable, themeable, no KaTeX dependency (plan §C8).
 * Mirrors {@link createTypstSnippetRenderer} but compiles with `--format svg`
 * and reads the text output. Returns null on failure → the HTML serializer
 * falls back to a readable inline-TeX placeholder.
 */
function createTypstSvgRenderer(baseDir: string): (snippet: string) => Promise<string | null> {
  return async (snippet: string) => {
    const stamp = `${process.pid}-${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const inFile = path.join(baseDir, `.penwright-svg-${stamp}.typ`);
    const outFile = path.join(os.tmpdir(), `penwright-svg-${stamp}.svg`);
    try {
      fs.writeFileSync(inFile, snippet, 'utf-8');
      await execFileAsync(getTypstPath(), buildTypstCompileArgs(['--format', 'svg', '--root', baseDir, inFile, outFile]));
      return fs.readFileSync(outFile, 'utf-8');
    } catch {
      return null;
    } finally {
      try { fs.unlinkSync(inFile); } catch {}
      try { fs.unlinkSync(outFile); } catch {}
    }
  };
}

/**
 * Builds the resolved {@link HtmlExportContext} for the web export: the
 * cross-reference numbering + citation style (shared pre-pass), the loaded
 * bibliography, and the display-math rendered to SVG by the bundled Typst.
 * The async/Typst/fs work lives here (main); the serializer stays pure.
 */
async function buildHtmlExportContext(doc: unknown, mergedContent: string, rootDir: string, design?: WebDesign): Promise<HtmlExportContext> {
  const model = buildExportModel(doc as { content?: unknown[] } as never, mergedContent);

  // Bibliography: resolve the #bibliography("path") against the project root.
  let bibEntries: ReturnType<typeof parseBibFile> = [];
  const bibDir = parseBibDirective(mergedContent);
  if (bibDir?.path) {
    try {
      const abs = path.resolve(rootDir, bibDir.path);
      if (fs.existsSync(abs)) bibEntries = parseBibFile(fs.readFileSync(abs, 'utf-8'));
    } catch { /* leave empty */ }
  }

  // Document language for the localized reference words ("Figure"/"Abbildung"):
  // merged content → the style source (`lang:` usually lives in the #import'ed
  // style.typ, which never reaches the merged content) → the UI locale.
  const langM = mergedContent.match(/#set\s+text\([^)]*lang:\s*"([a-zA-Z-]+)"/);
  const lang = ((langM ? langM[1] : design?.langHint) ?? getLocale()).slice(0, 2).toLowerCase() || 'en';

  // Render each unique display-math block to an SVG via the bundled Typst.
  const mathSvg = new Map<string, string>();
  const render = createTypstSvgRenderer(rootDir);
  const uniqueTex = [...new Set(model.mathBlocks.map((m) => m.tex))];
  const svgs = await Promise.all(uniqueTex.map((tex) => render(mathSnippet(tex)).catch(() => null)));
  uniqueTex.forEach((tex, i) => { const s = svgs[i]; if (s) mathSvg.set(tex, s); });

  return {
    labelMap: model.labelMap,
    citationMode: model.citationMode,
    numericOrder: model.numericOrder,
    equationNumbering: model.equationNumbering,
    eqPattern: model.eqPattern,
    bibEntries,
    bibTitle: bibDir?.title,
    mathSvg,
    lang,
    leadStyle: design?.leadStyle,
    figureNumbering: design?.figureNumbering,
  };
}

export interface ExportConfig {
  format: 'pdf' | 'docx';
  /** null → everything; otherwise list of include paths to keep. */
  selectedIncludes: string[] | null;
  includeBibliography: boolean;
  /**
   * Present when the user chose "Für den Druck" (print) mode — PDF only.
   * Routes through the print-export transform (oversized page + bleed + marks).
   */
  print?: PrintExportConfig;
}

/**
 * Performs an export with optional chapter selection. Returns the
 * absolute output path on success, or null if the user cancelled the
 * Save dialog.
 */
export async function runFilteredExport(config: ExportConfig): Promise<string | null> {
  const md = resolveDict(getLocale()).mainDialogs;
  if (!appState.currentFilePath) {
    dialog.showErrorBox(md.exportFailedTitle, md.openProjectFirst);
    return null;
  }

  const { saveFile } = await import('./fileManager');
  await saveFile();

  const rootFile = findRootFile(appState.currentFilePath);
  const rootDir = path.dirname(rootFile);
  const ext = config.format === 'pdf' ? 'pdf' : 'docx';
  const filterName = config.format === 'pdf' ? md.filterPdf : md.filterWordDocument;
  const defaultPath = rootFile.replace(/\.typ$/, `.${ext}`);
  const result = await dialog.showSaveDialog(appState.mainWindow!, {
    defaultPath,
    filters: [{ name: filterName, extensions: [ext] }],
  });
  if (result.canceled || !result.filePath) return null;

  // Print export (PDF only): stage a temp print-style + temp root and compile
  // that. Otherwise the regular filtered/whole-document path. Either way the
  // chosen `cleanup` runs in `finally`.
  const isPrint = config.format === 'pdf' && !!config.print;
  let sourceFile: string;
  let cleanup: () => void = () => {};
  if (isPrint) {
    const staged = writePrintExportTemp(rootFile, config);
    sourceFile = staged.tempRoot;
    cleanup = staged.cleanup;
  } else {
    const useFilter = config.selectedIncludes !== null || !config.includeBibliography;
    sourceFile = useFilter ? writeExportTemp(rootFile, config.selectedIncludes, config.includeBibliography) : rootFile;
    if (useFilter) cleanup = () => cleanupExportTemp(rootDir);
  }

  appState.mainWindow?.webContents.send('penwright', { type: 'exportStatus', exporting: true, format: config.format });
  try {
    if (config.format === 'pdf') {
      execFileSync(getTypstPath(), buildTypstCompileArgs([sourceFile, result.filePath]));
    } else {
      // DOCX: resolve includes manually, then run the serializer on the merged content.
      const mergedContent = resolveIncludes(sourceFile);
      const doc = deserializeTypst(mergedContent);
      // The DOCX serializer needs the design tokens (font, size, leading,
      // paper, margin, heading-numbering) which now live in style.json —
      // not in the merged Typst content. Pull them up here so the
      // serializer's resolveConfig can blend both sources.
      const style = appState.projectDir ? getProjectStyle(appState.projectDir) : null;
      const buffer = await serializeDocx(doc, rootDir, mergedContent, style, {
        renderTypstSnippet: createTypstSnippetRenderer(rootDir),
      });
      fs.writeFileSync(result.filePath, buffer);
    }
    appState.mainWindow?.webContents.send('penwright', { type: 'exportStatus', exporting: false, format: config.format });

    const choice = await dialog.showMessageBox(appState.mainWindow!, {
      type: 'info',
      buttons: [config.format === 'pdf' ? md.openPdf : md.openDocx, md.ok],
      message: md.exportedTo(config.format.toUpperCase(), path.basename(result.filePath)),
    });
    if (choice.response === 0) shell.openPath(result.filePath);
    return result.filePath;
  } catch (err) {
    appState.mainWindow?.webContents.send('penwright', { type: 'exportStatus', exporting: false, format: config.format });
    dialog.showErrorBox(
      md.exportFailedFmt(config.format.toUpperCase()),
      `${err instanceof Error ? err.message : String(err)}`,
    );
    return null;
  } finally {
    cleanup();
  }
}

/**
 * Menu-driven export entry point. For multi-chapter projects we hand off
 * to the renderer-side selection dialog; single-file projects skip
 * straight to the file-save dialog and export everything.
 */
async function startExport(format: 'pdf' | 'docx'): Promise<void> {
  if (!appState.currentFilePath) {
    const md = resolveDict(getLocale()).mainDialogs;
    dialog.showErrorBox(md.exportFailedTitle, md.openProjectFirst);
    return;
  }

  const sections = getExportableSections();
  // PDF always goes through the dialog so the "Für den Druck" (print) options
  // are reachable even for a single-file project; DOCX only needs the dialog
  // when there are chapters to pick from.
  if (sections && (sections.multiChapter || format === 'pdf')) {
    appState.mainWindow?.webContents.send('penwright', {
      type: 'showExportDialog',
      format,
      sections,
    });
    return;
  }

  // Single-file DOCX — just export everything directly.
  await runFilteredExport({ format, selectedIncludes: null, includeBibliography: true });
}

export function handleExportPdf(): Promise<void> {
  return startExport('pdf');
}

export function handleExportDocx(): Promise<void> {
  return startExport('docx');
}

/**
 * Web (HTML) export — writes a self-contained, framework-agnostic bundle
 * (`<slug>/index.html` + `fragment.html` + `meta.json` + `assets/`) via the
 * electron-free {@link buildWebBundle}. Mirrors the DOCX path
 * (resolveIncludes → deserialize → serialize) but the output is a directory,
 * so it uses a folder save dialog instead of a file one.
 */
export async function runWebExport(config: {
  selectedIncludes: string[] | null;
  includeBibliography: boolean;
  inlineAssets?: boolean;
  /** Page split: 'auto' (magazine → mini-site, else one page), or forced. */
  split?: 'auto' | 'single' | 'site';
}): Promise<string | null> {
  const md = resolveDict(getLocale()).mainDialogs;
  if (!appState.currentFilePath) {
    dialog.showErrorBox(md.exportFailedTitle, md.openProjectFirst);
    return null;
  }

  const { saveFile } = await import('./fileManager');
  await saveFile();

  const rootFile = findRootFile(appState.currentFilePath);
  const rootDir = path.dirname(rootFile);

  const useFilter = config.selectedIncludes !== null || !config.includeBibliography;
  const sourceFile = useFilter
    ? writeExportTemp(rootFile, config.selectedIncludes, config.includeBibliography)
    : rootFile;

  try {
    const mergedContent = resolveIncludes(sourceFile);
    const doc = deserializeTypst(mergedContent);

    // Resolve the project's DESIGN: style.json tokens when they exist, else
    // tokens INFERRED from the hand-written style.typ/macros (styleInference)
    // — plus the @font-face files for the winning families, so the export
    // looks right on machines that don't have the fonts installed.
    const styleOverride = appState.projectDir && hasProjectStyle(appState.projectDir)
      ? getProjectStyle(appState.projectDir)
      : null;
    const design = prepareWebDesign({
      rootDir,
      mergedContent,
      styleOverride,
      bundledFontsDir: getTypstFontPath(),
      inlineAssets: config.inlineAssets,
    });

    // The issue/document title: the cover masthead (`LANGSAM`, a `#cover(title:
    // …)`) beats the first body heading.
    const title = deriveIssueTitle(doc as { content?: unknown[] } as never)
      ?? deriveTitle(doc as { content?: unknown[] });
    const slug = slugify(title);

    const result = await dialog.showSaveDialog(appState.mainWindow!, {
      defaultPath: path.join(rootDir, slug),
    });
    if (result.canceled || !result.filePath) return null;

    appState.mainWindow?.webContents.send('penwright', { type: 'exportStatus', exporting: true, format: 'web' });
    // Pre-pass (async, in main): resolve cross-refs / citations / bibliography +
    // render display-math to SVG with the bundled Typst, so serializeHtml (pure)
    // only reads finished maps. The article language drives <html lang> + words.
    const context = await buildHtmlExportContext(doc, mergedContent, rootDir, design);
    // Frontmatter: a description (standfirst / first paragraph) + cover image
    // → <head> description/og:* and meta.json (single page; the mini-site
    // derives them per article).
    const docMeta = deriveDocMeta(doc as { content?: unknown[] } as never);
    // Base issue/document metadata. kicker/byline are the FIRST opener's — they
    // describe a single ARTICLE, not the whole issue, so they are attached ONLY
    // on the single-page bundle path below. The mini-site derives kicker/byline
    // per article itself; injecting the doc-level pair into the issue meta.json
    // would mis-attribute the first article's eyebrow to the whole magazine
    // (web-export-contract.md §2 — the magazine shape has no top-level kicker).
    const meta: ArticleMeta = { title, locale: context.lang, description: docMeta.description, cover: docMeta.cover };

    // Page split: 'auto' → a multi-article magazine (a cover or ≥2 openers)
    // becomes a mini-site, everything else one self-contained page. The export
    // dialog can force either ('site' needs ≥2 chapters to split at).
    const articles = splitIntoArticles(doc as { content?: unknown[] } as never);
    const split = config.split ?? 'auto';
    const wantSite = split === 'site' ? !!articles
      : split === 'single' ? false
      : isMagazineSite(articles, doc as { content?: unknown[] } as never);
    let dir: string, indexPath: string;
    if (wantSite && articles) {
      const site = buildWebSite({ articles, style: design.style, meta, outDir: result.filePath, rootDir, context, inlineAssets: config.inlineAssets, fonts: design.fonts });
      dir = site.dir; indexPath = site.indexPath;
    } else {
      const bundle = buildWebBundle({ doc, style: design.style, meta: { ...meta, kicker: docMeta.kicker, byline: docMeta.byline }, slug, outDir: result.filePath, rootDir, inlineAssets: config.inlineAssets, context, fonts: design.fonts });
      dir = bundle.dir; indexPath = bundle.indexPath;
    }
    appState.mainWindow?.webContents.send('penwright', { type: 'exportStatus', exporting: false, format: 'web' });

    await dialog.showMessageBox(appState.mainWindow!, {
      type: 'info',
      buttons: [md.ok],
      message: md.exportedTo('HTML', path.basename(dir)),
    });
    shell.showItemInFolder(indexPath);
    return dir;
  } catch (err) {
    appState.mainWindow?.webContents.send('penwright', { type: 'exportStatus', exporting: false, format: 'web' });
    dialog.showErrorBox(md.exportFailedFmt('HTML'), `${err instanceof Error ? err.message : String(err)}`);
    return null;
  } finally {
    if (useFilter) cleanupExportTemp(rootDir);
  }
}

export function handleExportWeb(): Promise<void> {
  // Multi-chapter projects go through the export dialog (chapter selection +
  // the single-page ↔ chapter-pages split toggle); single-file projects have
  // nothing to choose — export directly.
  const sections = getExportableSections();
  if (sections && sections.multiChapter) {
    appState.mainWindow?.webContents.send('penwright', {
      type: 'showExportDialog',
      format: 'web',
      sections,
    });
    return Promise.resolve();
  }
  return runWebExport({ selectedIncludes: null, includeBibliography: true }).then(() => {});
}

export async function handleImportMarkdown(): Promise<void> {
  const md = resolveDict(getLocale()).mainDialogs;
  const result = await dialog.showOpenDialog(appState.mainWindow!, {
    filters: [{ name: md.filterMarkdownFiles, extensions: ['md', 'markdown', 'txt'] }],
    properties: ['openFile'],
    title: md.importMarkdownTitle,
  });
  if (result.canceled || !result.filePaths[0]) return;

  const mdPath = result.filePaths[0];
  try {
    const mdContent = fs.readFileSync(mdPath, 'utf-8');
    const typstContent = markdownToTypst(mdContent);

    const preamble = `#set text(font: "Georgia", size: 11pt)
#set page(paper: "a4", margin: 2.5cm)
#set par(justify: true, leading: 0.65em)
#set heading(numbering: "1.1")

`;
    const fullContent = preamble + typstContent;

    const defaultName = path.basename(mdPath).replace(/\.(md|markdown|txt)$/i, '.typ');
    const saveResult = await dialog.showSaveDialog(appState.mainWindow!, {
      defaultPath: appState.currentFilePath
        ? path.join(path.dirname(appState.currentFilePath), defaultName)
        : defaultName,
      filters: [{ name: md.filterTypstFiles, extensions: ['typ'] }],
    });
    if (saveResult.canceled || !saveResult.filePath) return;

    fs.writeFileSync(saveResult.filePath, fullContent, 'utf-8');
    ensureClaudeSkills(path.dirname(saveResult.filePath));
    const { openFile } = await import('./fileManager');
    openFile(saveResult.filePath);

    dialog.showMessageBox(appState.mainWindow!, {
      type: 'info',
      message: md.importedAsTypst(path.basename(mdPath)),
      detail: md.importedMarkdownDetail,
    });
  } catch (err) {
    dialog.showErrorBox(md.importFailedTitle, String(err));
  }
}

export async function handleImportStyleTemplate(): Promise<void> {
  const md = resolveDict(getLocale()).mainDialogs;
  const result = await dialog.showOpenDialog(appState.mainWindow!, {
    filters: [{ name: md.filterTypstFiles, extensions: ['typ'] }],
    properties: ['openFile'],
    title: md.importStyleTemplateTitle,
  });
  if (result.canceled || !result.filePaths[0]) return;

  const filePath = result.filePaths[0];
  try {
    const fileContent = fs.readFileSync(filePath, 'utf-8').trim();
    const bodyStart = stripPreamble(fileContent);
    const preamblePart = bodyStart
      ? fileContent.substring(0, fileContent.length - bodyStart.length).trim()
      : fileContent;

    if (!preamblePart) {
      dialog.showErrorBox(md.importFailedTitle, md.noStyleRules);
      return;
    }

    const name = path.basename(filePath, '.typ');
    const label = name.charAt(0).toUpperCase() + name.slice(1).replace(/[-_]/g, ' ');

    if (appState.currentContent) {
      const { autoSave, updateTitle } = await import('./fileManager');
      const body = stripPreamble(appState.currentContent);
      appState.currentContent = preamblePart + '\n\n' + body;
      appState.isDirty = true;
      updateTitle();
      autoSave();
      appState.mainWindow?.webContents.send('penwright', { type: 'update', content: appState.currentContent });
    }

    if (appState.projectDir || appState.currentFilePath) {
      const templateDir = path.join(appState.projectDir || path.dirname(appState.currentFilePath!), '.claude', 'style-templates');
      if (!fs.existsSync(templateDir)) {
        fs.mkdirSync(templateDir, { recursive: true });
      }
      fs.copyFileSync(filePath, path.join(templateDir, path.basename(filePath)));
      appState.mainWindow?.webContents.send('penwright', { type: 'filetreeChanged' });
    }

    dialog.showMessageBox(appState.mainWindow!, {
      type: 'info',
      message: md.styleImportedApplied(label),
      detail: md.styleImportedDetail,
    });
  } catch (err) {
    dialog.showErrorBox(md.importFailedTitle, String(err));
  }
}

export async function handleLinkZotero(): Promise<void> {
  const md = resolveDict(getLocale()).mainDialogs;
  const result = await dialog.showOpenDialog(appState.mainWindow!, {
    filters: [{ name: md.filterBibtexFiles, extensions: ['bib'] }],
    properties: ['openFile'],
    title: md.selectZoteroExportTitle,
    message: md.selectZoteroExportMessage,
  });
  if (result.canceled || !result.filePaths[0]) return;

  const zoteroBibPath = result.filePaths[0];

  if (!appState.currentFilePath) {
    dialog.showErrorBox(md.noProjectOpenTitle, md.openProjectFirst);
    return;
  }

  const dir = appState.projectDir || path.dirname(appState.currentFilePath);
  const destPath = path.join(dir, 'zotero.bib');

  try {
    fs.copyFileSync(zoteroBibPath, destPath);

    const rootFile = findRootFile(appState.currentFilePath);
    let rootContent = fs.readFileSync(rootFile, 'utf-8');
    if (!rootContent.includes('zotero.bib')) {
      if (rootContent.includes('#bibliography')) {
        // Typst doesn't support multiple bibliography files natively
      } else {
        rootContent += '\n\n#bibliography("zotero.bib")\n';
        fs.writeFileSync(rootFile, rootContent, 'utf-8');
      }
    }

    saveZoteroBibPath(zoteroBibPath);

    if (zoteroWatcher) {
      zoteroWatcher.close();
    }
    zoteroWatcher = watch(zoteroBibPath, { ignoreInitial: true });
    zoteroWatcher.on('change', () => {
      try {
        fs.copyFileSync(zoteroBibPath, destPath);
        handleRequestCitations();
        appState.mainWindow?.webContents.send('penwright', { type: 'filetreeChanged' });
      } catch {}
    });

    handleRequestCitations();
    appState.mainWindow?.webContents.send('penwright', { type: 'filetreeChanged' });

    dialog.showMessageBox(appState.mainWindow!, {
      type: 'info',
      message: md.zoteroLinkedTitle,
      detail: md.zoteroLinkedDetail(path.basename(zoteroBibPath)),
    });
  } catch (err) {
    dialog.showErrorBox(md.zoteroLinkFailedTitle, String(err));
  }
}

export function handleRequestCitations(): void {
  if (!appState.currentFilePath) return;

  // Shared with penwright_get_citations, so a .bib one side finds is never
  // invisible to the other — that mismatch is what produced duplicate
  // bibliographies.
  const bibFilePaths = findBibFiles(
    appState.projectDir || path.dirname(appState.currentFilePath),
    appState.currentFilePath,
  );

  const allEntries: Array<{ citekey: string; author: string; title: string; year: string; type: string }> = [];

  for (const bibFile of bibFilePaths) {
    try {
      const content = fs.readFileSync(bibFile, 'utf-8');
      const entries = parseBibFile(content);
      for (const entry of entries) {
        allEntries.push({
          citekey: entry.citekey,
          author: entry.fields.author || '',
          title: entry.fields.title || '',
          year: entry.fields.year || entry.fields.date || '',
          type: entry.type,
        });
      }
    } catch {}
  }

  appState.mainWindow?.webContents.send('penwright', { type: 'citationData', entries: allEntries });
}

export function applyStyleTemplate(styleId: string): void {
  const template = styleTemplates.find(s => s.id === styleId);
  if (!template || !appState.currentContent || !appState.currentFilePath) return;

  // Style preambles only belong in the project's root file. If the user
  // applies a style while a chapter is active, the new preamble would be
  // prepended to the chapter source — silently corrupting it. Refuse and
  // tell the user to switch to the root file.
  const rootFile = findRootFile(appState.currentFilePath);
  if (rootFile !== appState.currentFilePath) {
    const md = resolveDict(getLocale()).mainDialogs;
    dialog.showMessageBox(appState.mainWindow!, {
      type: 'info',
      buttons: [md.ok],
      defaultId: 0,
      title: md.styleCannotChangeHereTitle,
      message: md.styleBelongsInRoot(path.basename(rootFile)),
      detail: md.styleBelongsInRootDetail,
    });
    return;
  }

  const body = stripPreamble(appState.currentContent);
  appState.currentContent = template.preamble + '\n\n' + body;
  appState.isDirty = true;
  import('./fileManager').then(({ updateTitle, autoSave }) => {
    updateTitle();
    autoSave();
  });
  appState.mainWindow?.webContents.send('penwright', { type: 'update', content: appState.currentContent });
}
