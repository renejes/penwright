/**
 * Easy Writing MDX projects — detect, typeset, never rewrite the manuscript.
 *
 * Easy Writing's "Export → MDX → Projekt kopieren" drops a folder with
 * `project.yaml` + `.mdx` chapters + optional `references.bib`. That folder
 * IS the manuscript. Penwright opens it as a project, derives Typst for
 * typesetting, and styles via `style.typ`. The `.mdx` (citations, footnotes,
 * figures, wording) is not a second truth we flatten or citeproc back into.
 */

import * as fs from 'fs';
import * as path from 'path';
import { markdownToTypst } from './markdownImporter';
import { writeFileAtomic } from './fileWrite';
import {
  STYLE_APPLY_LINE,
  STYLE_IMPORT_LINE,
  generateStyleTypst,
} from './styleParser';
import { DEFAULT_PROJECT_STYLE, sanitizeProjectStyle } from './styleTypes';
import {
  ensurePenwrightSkeleton,
  ensureStyleFiles,
  planGitignore,
} from './projectScaffold';

export const PROJECT_YAML = 'project.yaml';
export const MDX_ROOT_MARKER = '// penwright:mdx-root — generated from project.yaml; manuscript is the .mdx';
export const MDX_CHAPTERS_START = '// ─── penwright:mdx-chapters ───';
export const MDX_CHAPTERS_END = '// ─── penwright:mdx-chapters-end ───';
export const MDX_BIB_START = '// ─── penwright:mdx-bibliography ───';
export const MDX_BIB_END = '// ─── penwright:mdx-bibliography-end ───';
export const TYPESET_DIR = path.join('.penwright', 'typeset');

/** Easy Writing CSL ids → Typst bibliography style names. */
export const CSL_TO_TYPST: Record<string, string> = {
  apa: 'apa',
  'chicago-author-date': 'chicago-author-date',
  'chicago-note': 'chicago-notes',
  'harvard-cite-them-right': 'harvard-cite-them-right',
  vancouver: 'vancouver',
};

export interface EasyWritingManifest {
  schema: number | null;
  type: string;
  title: string;
  lang: string;
  /** Project-relative chapter paths, in the order `project.yaml` lists them. */
  chapters: string[];
  bibliography: string | null;
  csl: string | null;
}

export interface AdoptEasyWritingResult {
  adopted: boolean;
  rootFile: string | null;
  manifest: EasyWritingManifest | null;
  typesetFiles: string[];
  warnings: string[];
}

export function projectYamlPath(dir: string): string {
  return path.join(dir, PROJECT_YAML);
}

export function isEasyWritingProject(dir: string): boolean {
  return readEasyWritingManifest(dir) !== null;
}

export function readEasyWritingManifest(dir: string): EasyWritingManifest | null {
  const yamlPath = projectYamlPath(dir);
  let raw: string;
  try {
    if (!fs.existsSync(yamlPath) || !fs.statSync(yamlPath).isFile()) return null;
    raw = fs.readFileSync(yamlPath, 'utf-8');
  } catch {
    return null;
  }
  const parsed = parseProjectYaml(raw);
  if (!parsed) return null;

  const chapters = parsed.chapters.filter((rel) => {
    const abs = path.join(dir, rel);
    try { return fs.existsSync(abs) && fs.statSync(abs).isFile(); }
    catch { return false; }
  });

  if (chapters.length === 0) {
    const fallback = ['index.mdx', 'index.md']
      .map((name) => name)
      .find((name) => fs.existsSync(path.join(dir, name)));
    if (fallback) chapters.push(fallback);
  }

  if (chapters.length === 0) return null;

  return { ...parsed, chapters };
}

/**
 * Parse the Easy Writing `project.yaml` subset. Unknown keys are ignored
 * here because we never write the file back — they survive on disk.
 */
export function parseProjectYaml(text: string): EasyWritingManifest | null {
  const top: Record<string, string> = {};
  const lists: Record<string, string[]> = {};
  const nested: Record<string, Record<string, string>> = {};
  let section: string | null = null;

  for (const raw of text.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    if (/^\s*#/.test(raw) || raw.trim() === '') continue;
    const indent = raw.length - raw.trimStart().length;
    const t = raw.trim();
    const kv = t.match(/^([A-Za-z_][\w-]*)\s*:\s*(.*)$/);
    const listItem = t.match(/^- (.*)$/);

    if (indent === 0) {
      if (!kv) continue;
      section = kv[1];
      if (kv[2] === '') {
        lists[section] = lists[section] ?? [];
        nested[section] = nested[section] ?? {};
      } else {
        top[section] = unquote(kv[2]);
        section = null;
      }
      continue;
    }
    if (!section) continue;
    if (listItem) {
      lists[section].push(unquote(listItem[1]));
      continue;
    }
    if (kv) nested[section][kv[1]] = unquote(kv[2]);
  }

  const type = (top.type || top.kind || '').trim();
  const title = (top.title || '').trim();
  const lang = (top.lang || '').trim();
  const schemaRaw = top.schema;
  const schema = schemaRaw && /^\d+$/.test(schemaRaw) ? Number(schemaRaw) : null;

  const citation = nested.citation ?? {};
  const bibliography = (citation.bibliography || top.bibliography || '').trim() || null;
  const csl = (citation.csl || top.csl || '').trim() || null;
  const chapters = (lists.chapters ?? [])
    .map((rel) => rel.replace(/\\/g, '/').trim())
    .filter(Boolean);

  const looksLike = chapters.length > 0
    || type === 'paper'
    || type === 'blog'
    || schema === 1;
  if (!looksLike && !title) return null;

  return {
    schema,
    type: type || (chapters.length > 1 ? 'paper' : 'blog'),
    title,
    lang,
    chapters,
    bibliography,
    csl,
  };
}

/**
 * Derive Typst from the MDX manuscript and write a Penwright root.
 *
 * Never writes `.mdx`, `project.yaml`, or the `.bib`. Regenerates the
 * typeset chapters from MDX every call (MDX wins). `main.typ` regions
 * outside the chapter/bibliography markers are preserved so a design
 * prelude (hero, etc.) survives a re-open.
 */
export function adoptEasyWritingProject(dir: string): AdoptEasyWritingResult {
  const warnings: string[] = [];
  const manifest = readEasyWritingManifest(dir);
  if (!manifest) {
    return { adopted: false, rootFile: null, manifest: null, typesetFiles: [], warnings };
  }

  ensurePenwrightSkeleton(dir);
  const ignore = planGitignore(dir);
  if (ignore) {
    try { writeFileAtomic(ignore.abs, ignore.content); }
    catch { warnings.push('Could not write .gitignore.'); }
  }

  const typesetFiles: string[] = [];
  const includeRels: string[] = [];

  for (const rel of manifest.chapters) {
    const sourceAbs = path.join(dir, rel);
    const typesetRel = typesetRelFor(rel);
    const outputAbs = path.join(dir, typesetRel);
    let source: string;
    try {
      source = fs.readFileSync(sourceAbs, 'utf-8');
    } catch (err) {
      warnings.push(`Could not read ${rel}: ${err instanceof Error ? err.message : String(err)}`);
      continue;
    }
    const typst = markdownToTypst(source, { sourceFile: sourceAbs, outputFile: outputAbs });
    try {
      writeFileAtomic(outputAbs, typst.endsWith('\n') ? typst : typst + '\n');
      typesetFiles.push(typesetRel);
      includeRels.push(typesetRel.replace(/\\/g, '/'));
    } catch (err) {
      warnings.push(`Could not write ${typesetRel}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const rootAbs = path.join(dir, 'main.typ');
  let existing: string | null = null;
  try {
    if (fs.existsSync(rootAbs)) existing = fs.readFileSync(rootAbs, 'utf-8');
  } catch { /* treat as missing */ }

  const nextRoot = buildMdxRoot(existing, {
    lang: manifest.lang,
    includes: includeRels,
    bibliography: resolveBibliographyRel(dir, manifest.bibliography),
    csl: manifest.csl,
  });
  try {
    writeFileAtomic(rootAbs, nextRoot);
  } catch (err) {
    warnings.push(`Could not write main.typ: ${err instanceof Error ? err.message : String(err)}`);
  }

  ensureStyleFiles({
    dir,
    wireRoot: true,
    defaultStyleJson: JSON.stringify(sanitizeProjectStyle(DEFAULT_PROJECT_STYLE), null, 2),
    renderStyleTyp: (json) => {
      try { return generateStyleTypst(sanitizeProjectStyle(JSON.parse(json))); }
      catch { return generateStyleTypst(sanitizeProjectStyle(DEFAULT_PROJECT_STYLE)); }
    },
  });

  return {
    adopted: true,
    rootFile: fs.existsSync(rootAbs) ? rootAbs : null,
    manifest,
    typesetFiles,
    warnings,
  };
}

/** Project-relative POSIX path of the derived Typst file for a manuscript chapter. */
export function typesetRelFor(chapterRel: string): string {
  const posix = chapterRel.replace(/\\/g, '/');
  const swapped = posix.replace(/\.(mdx|md)$/i, '.typ');
  return path.posix.join(TYPESET_DIR.replace(/\\/g, '/'), swapped);
}

export function isEasyWritingManuscriptFile(projectDir: string, abs: string): boolean {
  if (!projectDir) return false;
  const root = path.resolve(projectDir);
  const target = path.resolve(abs);
  const rel = path.relative(root, target);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return false;
  const posix = rel.split(path.sep).join('/');
  const base = path.basename(posix).toLowerCase();
  if (base === PROJECT_YAML || base === 'project.dic') return true;
  return posix.toLowerCase().endsWith('.mdx');
}

/** Derived chapter `.typ` under `.penwright/typeset/` — regenerated from MDX. */
export function isEasyWritingTypesetChapter(projectDir: string, abs: string): boolean {
  if (!projectDir) return false;
  const root = path.resolve(projectDir);
  const target = path.resolve(abs);
  const rel = path.relative(root, target).split(path.sep).join('/');
  const prefix = TYPESET_DIR.replace(/\\/g, '/') + '/';
  return rel.startsWith(prefix) && rel.toLowerCase().endsWith('.typ');
}

export function manuscriptWriteMessage(relPath: string): string {
  return (
    `"${relPath}" is the Easy Writing manuscript. Penwright typesets it and does not rewrite it. ` +
    `Change the wording in Easy Writing. Style this document with the design tools ` +
    `(penwright_update_style, apply_palette, apply_layout) — never flatten [@citekey] into author-year prose.`
  );
}

export function typesetChapterWriteMessage(relPath: string): string {
  return (
    `"${relPath}" is regenerated from the Easy Writing .mdx on every open. ` +
    `Do not insert design elements or rewrite prose there — they would vanish. ` +
    `Put layout in style.typ (design tools) or in main.typ outside the mdx-chapters markers.`
  );
}

export function typstBibliographyStyle(csl: string | null): string {
  if (!csl) return 'apa';
  const key = csl.trim().toLowerCase();
  return CSL_TO_TYPST[key] ?? csl.trim();
}

function resolveBibliographyRel(dir: string, fromYaml: string | null): string | null {
  const candidates = [
    fromYaml,
    'references.bib',
  ].filter((x): x is string => !!x);
  for (const rel of candidates) {
    const abs = path.join(dir, rel);
    try {
      if (fs.existsSync(abs) && fs.statSync(abs).isFile()) {
        return rel.replace(/\\/g, '/');
      }
    } catch { /* skip */ }
  }
  return fromYaml ? fromYaml.replace(/\\/g, '/') : null;
}

function buildMdxRoot(
  existing: string | null,
  spec: { lang: string; includes: string[]; bibliography: string | null; csl: string | null },
): string {
  const chaptersBlock = [
    MDX_CHAPTERS_START,
    ...spec.includes.map((rel) => `#include "${rel}"`),
    MDX_CHAPTERS_END,
  ].join('\n');

  const bibStyle = typstBibliographyStyle(spec.csl);
  const bibBlock = spec.bibliography
    ? [
        MDX_BIB_START,
        `#bibliography("${spec.bibliography}", style: "${escapeQuoted(bibStyle)}")`,
        MDX_BIB_END,
      ].join('\n')
    : '';

  if (existing && existing.includes(MDX_ROOT_MARKER)) {
    let next = replaceRegion(existing, MDX_CHAPTERS_START, MDX_CHAPTERS_END, chaptersBlock);
    next = spec.bibliography
      ? replaceRegion(next, MDX_BIB_START, MDX_BIB_END, bibBlock)
      : next;
    if (spec.lang) next = upsertLang(next, spec.lang);
    return ensureTrailingNewline(next);
  }

  const langLine = emitLang(spec.lang);
  const parts = [
    MDX_ROOT_MARKER,
    STYLE_IMPORT_LINE,
    STYLE_APPLY_LINE,
    ...(langLine ? [langLine] : []),
    '',
    chaptersBlock,
    ...(bibBlock ? ['', bibBlock] : []),
    '',
  ];
  return parts.join('\n');
}

function replaceRegion(src: string, start: string, end: string, replacement: string): string {
  const a = src.indexOf(start);
  const b = src.indexOf(end);
  if (a >= 0 && b > a) {
    return src.slice(0, a) + replacement + src.slice(b + end.length);
  }
  if (a < 0 && b < 0) {
    return src.trimEnd() + '\n\n' + replacement + '\n';
  }
  return src;
}

function emitLang(lang: string): string {
  const parsed = parseLangTag(lang);
  if (!parsed) return '';
  if (parsed.region) return `#set text(lang: "${parsed.lang}", region: "${parsed.region}")`;
  return `#set text(lang: "${parsed.lang}")`;
}

function upsertLang(src: string, lang: string): string {
  const line = emitLang(lang);
  if (!line) return src;
  if (/#set\s+text\s*\([^)]*lang\s*:/.test(src)) {
    return src.replace(/#set\s+text\s*\([^)]*\)/, line);
  }
  const apply = src.indexOf(STYLE_APPLY_LINE);
  if (apply >= 0) {
    const insertAt = apply + STYLE_APPLY_LINE.length;
    return src.slice(0, insertAt) + '\n' + line + src.slice(insertAt);
  }
  return src;
}

function parseLangTag(tag: string): { lang: string; region: string | null } | null {
  const t = tag.trim();
  if (!t) return null;
  const m = t.match(/^([A-Za-z]{2,3})(?:[_-]([A-Za-z]{2}))?$/);
  if (!m) return { lang: t.toLowerCase(), region: null };
  return {
    lang: m[1].toLowerCase(),
    region: m[2] ? m[2].toLowerCase() : null,
  };
}

function ensureTrailingNewline(s: string): string {
  return s.endsWith('\n') ? s : s + '\n';
}

function escapeQuoted(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function unquote(raw: string): string {
  const v = raw.trim();
  if ((v.startsWith('"') && v.endsWith('"') && v.length >= 2)
    || (v.startsWith("'") && v.endsWith("'") && v.length >= 2)) {
    return v.slice(1, -1);
  }
  return v;
}
