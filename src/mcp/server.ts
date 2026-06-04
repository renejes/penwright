/**
 * vswrite MCP Server
 *
 * Exposes vswrite-specific tools via the Model Context Protocol (MCP).
 * External AI desktop apps (Claude Desktop, Codex Desktop, etc.) can
 * connect to this server to read, edit, compile and manage Typst documents.
 *
 * Runs as a standalone CLI tool (no Electron required).
 * Communicates via stdio (JSON-RPC).
 *
 * Usage:
 *   node dist/mcp/server.js --project /path/to/project
 *   node dist/mcp/server.js --file /path/to/main.typ
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { parseSettings, applySettings, generateSetBlocks, type DocumentSettings } from '../shared/settingsParser.js';
import { findRootFile } from '../shared/rootFinder.js';
import { styleTemplates } from '../shared/styleTemplates.js';
import {
  sanitizeProjectStyle,
  DEFAULT_PROJECT_STYLE,
  COLOR_SLOTS,
  type ProjectStyle,
  type StyleColors,
  type SectionStyle,
} from '../shared/styleTypes.js';
import {
  generateStyleTypst,
  ensureStyleInclude,
  extractCustomBlock,
  ensureSectionStyle,
  clearSectionStyle,
  getSectionStyleId,
} from '../shared/styleParser.js';
import { SECTION_PRESETS, getSectionPreset } from '../shared/sectionPresets.js';
import { THEME_PRESETS } from '../shared/themePresets.js';
import { LAYOUT_PRESETS } from '../shared/layoutPresets.js';
import { PALETTE_PRESETS } from '../shared/palettePresets.js';
import {
  DESIGN_ELEMENTS,
  getDesignElement,
  renderDesignElement,
} from '../shared/designElements.js';
import { parseBibFile } from '../shared/bibParser.js';
import { resolveIncludes } from '../shared/mergeDocument.js';
import { splitIntoChapters, slugify } from '../shared/splitDocument.js';
import { templates as projectTemplates } from '../shared/projectTemplates.js';
import { listComments, createComment, updateComment, deleteComment } from '../main/commentManager.js';
import { listProjectLabels, type LabelType } from '../main/projectLabels.js';
import { searchProject, replaceInProject } from '../main/projectSearch.js';
import { findSourceForCitation } from '../main/citationSources.js';
import { markdownToTypst } from '../shared/markdownImporter.js';
import { serializeDocx, type RenderedSnippet } from '../shared/docxSerializer.js';
import { deserializeTypst } from '../editor/lib/deserializer.js';
import simpleGit from 'simple-git';

const execFileAsync = promisify(execFile);

/**
 * Builds the `typst compile` arg list, prepending `--package-path` and
 * `--font-path` when the host process exposes the corresponding env vars
 * (`TYPST_PACKAGE_PATH` and `TYPST_FONT_PATH`, both set by mcpSetup so
 * Claude Desktop's spawn environment carries the bundled directories).
 * When unset, Typst falls back to its default CDN-fetch / system fonts.
 */
function typstCompileArgs(extra: string[]): string[] {
  const args: string[] = ['compile'];
  const pkgPath = process.env.TYPST_PACKAGE_PATH;
  if (pkgPath) args.push('--package-path', pkgPath);
  const fontPath = process.env.TYPST_FONT_PATH;
  if (fontPath) args.push('--font-path', fontPath);
  return args.concat(extra);
}

/**
 * Resolves the path to the `typst` binary. Honours an explicit `TYPST_BIN`
 * env var first — used by the .mcpb bundle so the server invokes the
 * Typst binary that lives next to it inside the extension directory,
 * rather than relying on whatever `typst` happens to be in Claude
 * Desktop's spawn PATH (which is usually nothing useful). Falls back to
 * the bare `typst` name for the legacy wizard install path, which puts
 * vswrite's bundled binary into a PATH-discoverable location.
 */
function typstBinary(): string {
  return process.env.TYPST_BIN || 'typst';
}

/**
 * Renderer the DOCX serializer uses to rasterise display-math and SVG figures
 * (no native Word representation). Compiles each self-contained snippet to a
 * PNG with the bundled packages + fonts at 300 ppi; returns null on failure so
 * the serializer falls back to a text placeholder. The temp `.typ` lives in
 * baseDir so it sits inside the Typst root and SVG figures resolve.
 */
function createMcpSnippetRenderer(baseDir: string): (snippet: string) => Promise<RenderedSnippet | null> {
  return async (snippet: string) => {
    const stamp = `${process.pid}-${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const inFile = path.join(baseDir, `.vswrite-snip-${stamp}.typ`);
    const outFile = path.join(os.tmpdir(), `vswrite-snip-${stamp}.png`);
    try {
      fs.writeFileSync(inFile, snippet, 'utf-8');
      await execFileAsync(typstBinary(), typstCompileArgs(['--ppi', '300', '--root', baseDir, inFile, outFile]), { timeout: 30000 });
      const png = fs.readFileSync(outFile);
      if (png.length < 24 || png.readUInt32BE(0) !== 0x89504e47) return null;
      return { png, widthPx: png.readUInt32BE(16), heightPx: png.readUInt32BE(20), ppi: 300 };
    } catch {
      return null;
    } finally {
      try { fs.unlinkSync(inFile); } catch {}
      try { fs.unlinkSync(outFile); } catch {}
    }
  };
}

// ─── Style helpers (MCP-side mirror of the main process) ────────
// The MCP server is a separate process from the Electron app — it
// reads / writes the project's `.vswrite/style.json` directly, then
// regenerates `style.typ` and ensures `#include "style.typ"` is at the
// top of the root file. This keeps Claude's edits in lockstep with
// what the Design panel in vswrite would have written.

function styleJsonPath(projectDir: string): string {
  return path.join(projectDir, '.vswrite', 'style.json');
}

function readProjectStyle(projectDir: string): ProjectStyle {
  const file = styleJsonPath(projectDir);
  if (!fs.existsSync(file)) return sanitizeProjectStyle(DEFAULT_PROJECT_STYLE);
  try {
    return sanitizeProjectStyle(JSON.parse(fs.readFileSync(file, 'utf-8')));
  } catch {
    return sanitizeProjectStyle(DEFAULT_PROJECT_STYLE);
  }
}

/**
 * Writes style.json + regenerates style.typ + ensures the root file's
 * `#include "style.typ"`. Returns the sanitised style that was actually
 * persisted (after coercion / clamping) so the caller can report it.
 */
function writeProjectStyleAndRegenerate(projectDir: string, raw: unknown): ProjectStyle {
  const style = sanitizeProjectStyle(raw);
  const vswriteDir = path.dirname(styleJsonPath(projectDir));
  if (!fs.existsSync(vswriteDir)) fs.mkdirSync(vswriteDir, { recursive: true });
  fs.writeFileSync(styleJsonPath(projectDir), JSON.stringify(style, null, 2), 'utf-8');

  // Write style.typ next to the root file.
  const candidates = ['main.typ', 'document.typ', 'index.typ'];
  let rootFile: string | null = null;
  for (const name of candidates) {
    const p = path.join(projectDir, name);
    if (fs.existsSync(p)) { rootFile = p; break; }
  }
  if (!rootFile && state.currentFile && fs.existsSync(state.currentFile)) {
    rootFile = findRootFile(state.currentFile);
  }
  const projectRootDir = rootFile ? path.dirname(rootFile) : projectDir;
  fs.writeFileSync(path.join(projectRootDir, 'style.typ'), generateStyleTypst(style), 'utf-8');

  if (rootFile && fs.existsSync(rootFile)) {
    const before = fs.readFileSync(rootFile, 'utf-8');
    const after = ensureStyleInclude(before);
    if (after !== before) fs.writeFileSync(rootFile, after, 'utf-8');
  }

  return style;
}

/** Deep-merges `patch` into `base`. Used by vswrite_update_style. */
function deepMergeStyle(base: ProjectStyle, patch: unknown): ProjectStyle {
  if (typeof patch !== 'object' || patch === null) return base;
  const p = patch as Record<string, unknown>;
  return sanitizeProjectStyle({
    ...base,
    colors:   typeof p.colors   === 'object' && p.colors   !== null ? { ...base.colors,   ...(p.colors   as object) } : base.colors,
    fonts:    typeof p.fonts    === 'object' && p.fonts    !== null ? { ...base.fonts,    ...(p.fonts    as object) } : base.fonts,
    scale:    typeof p.scale    === 'object' && p.scale    !== null ? { ...base.scale,    ...(p.scale    as object) } : base.scale,
    layout:   typeof p.layout   === 'object' && p.layout   !== null ? { ...base.layout,   ...(p.layout   as object) } : base.layout,
    headings: typeof p.headings === 'object' && p.headings !== null
      ? {
          ...base.headings,
          ...(p.headings as object),
          // Per-level merge so a partial { h1: { color: 'accent' } } only
          // overrides h1.color instead of replacing the whole h1 record.
          h1: { ...base.headings.h1, ...((p.headings as Record<string, object>).h1 ?? {}) },
          h2: { ...base.headings.h2, ...((p.headings as Record<string, object>).h2 ?? {}) },
          h3: { ...base.headings.h3, ...((p.headings as Record<string, object>).h3 ?? {}) },
          h4: { ...base.headings.h4, ...((p.headings as Record<string, object>).h4 ?? {}) },
          h5: { ...base.headings.h5, ...((p.headings as Record<string, object>).h5 ?? {}) },
          h6: { ...base.headings.h6, ...((p.headings as Record<string, object>).h6 ?? {}) },
        }
      : base.headings,
    elements: typeof p.elements === 'object' && p.elements !== null
      ? {
          blockquote: { ...base.elements.blockquote, ...((p.elements as Record<string, object>).blockquote ?? {}) },
          codeBlock:  { ...base.elements.codeBlock,  ...((p.elements as Record<string, object>).codeBlock  ?? {}) },
          figure:     { ...base.elements.figure,     ...((p.elements as Record<string, object>).figure     ?? {}) },
          table:      { ...base.elements.table,      ...((p.elements as Record<string, object>).table      ?? {}) },
        }
      : base.elements,
    custom: typeof p.custom === 'object' && p.custom !== null ? { ...base.custom, ...(p.custom as object) } : base.custom,
  });
}

// ─── State ───────────────────────────────────────────

const POLAR_ORG_ID = 'a5a6573b-aacf-4501-a6c1-ebc15ef67b04';

interface ServerState {
  projectDir: string;
  currentFile: string | null;
  licenseKey: string | null;
  licenseValidated: boolean;
}

const state: ServerState = {
  projectDir: '',
  currentFile: null,
  licenseKey: null,
  licenseValidated: false,
};

// ─── Parse CLI args ──────────────────────────────────

function parseArgs(): void {
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--project' && args[i + 1]) {
      state.projectDir = path.resolve(args[++i]);
    } else if (args[i] === '--license-key' && args[i + 1]) {
      state.licenseKey = args[++i];
    } else if (args[i] === '--file' && args[i + 1]) {
      const filePath = path.resolve(args[++i]);
      state.currentFile = filePath;
      if (!state.projectDir) {
        state.projectDir = path.dirname(filePath);
      }
    }
  }

  // License key from env var
  if (!state.licenseKey && process.env.PENWRIGHT_LICENSE_KEY) {
    state.licenseKey = process.env.PENWRIGHT_LICENSE_KEY;
  }

  // Fallback: env var
  if (!state.projectDir && process.env.PENWRIGHT_PROJECT_DIR) {
    state.projectDir = path.resolve(process.env.PENWRIGHT_PROJECT_DIR);
  }

  // Fallback: cwd
  if (!state.projectDir) {
    state.projectDir = process.cwd();
  }

  // Auto-detect main .typ file
  if (!state.currentFile) {
    const candidates = ['main.typ', 'document.typ', 'index.typ'];
    for (const name of candidates) {
      const p = path.join(state.projectDir, name);
      if (fs.existsSync(p)) {
        state.currentFile = p;
        break;
      }
    }
    // Fallback: first .typ file in directory
    if (!state.currentFile) {
      try {
        const typFiles = fs.readdirSync(state.projectDir).filter(f => f.endsWith('.typ'));
        if (typFiles.length > 0) {
          state.currentFile = path.join(state.projectDir, typFiles[0]);
        }
      } catch {}
    }
  }
}

// ─── Helpers ─────────────────────────────────────────

function readCurrentDocument(): { content: string; filePath: string } {
  if (!state.currentFile || !fs.existsSync(state.currentFile)) {
    throw new Error('No document open. Use vswrite_open_file to open a .typ file first.');
  }
  return {
    content: fs.readFileSync(state.currentFile, 'utf-8'),
    filePath: state.currentFile,
  };
}

function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

/**
 * Resolves a user-supplied path (absolute or relative) against the project
 * directory and verifies the realpath does not escape the project root.
 * Throws on violation.
 */
function resolveInsideProject(userPath: string): string {
  if (!state.projectDir) {
    throw new Error('Project directory not set. Call vswrite_set_project first.');
  }
  const absPath = path.isAbsolute(userPath) ? userPath : path.join(state.projectDir, userPath);
  const resolvedRoot = safeRealpath(state.projectDir);
  const resolvedPath = safeRealpath(absPath);
  if (resolvedPath !== resolvedRoot && !resolvedPath.startsWith(resolvedRoot + path.sep)) {
    throw new Error(`Access denied: path "${userPath}" is outside the project directory.`);
  }
  return absPath;
}

function safeRealpath(target: string): string {
  let current = path.resolve(target);
  try {
    return fs.realpathSync(current);
  } catch {
    const segments: string[] = [];
    while (true) {
      const parent = path.dirname(current);
      if (parent === current) return path.resolve(target);
      segments.unshift(path.basename(current));
      current = parent;
      try {
        const realParent = fs.realpathSync(current);
        return path.join(realParent, ...segments);
      } catch {}
    }
  }
}

// ─── Server Setup ────────────────────────────────────

const server = new McpServer({
  name: 'penwright',
  version: '0.9.0',
});

// ─── Prompts: Project Skills ─────────────────────────

const SKILL_PROMPTS: Array<{ name: string; description: string; skillDir: string }> = [
  {
    name: 'typst-reference',
    description: 'Comprehensive Typst language reference — syntax, formatting, math, layout, functions. Load this when working with Typst documents.',
    skillDir: 'typst',
  },
  {
    name: 'vswrite-conventions',
    description: 'vswrite project conventions — file structure, #include chapters, settings, image handling, bibliography setup.',
    skillDir: 'vswrite',
  },
  {
    name: 'research-workflow',
    description: 'Deep web research workflow — search for academic sources, synthesize findings, manage citations and bibliography.',
    skillDir: 'research',
  },
  {
    name: 'writing-style',
    description: "Prose conventions for academic / nonfiction writing — source discipline (never invent citations, never type BibTeX from memory, match the source's confidence, pre-submission audit), anti-AI-tells (em-dash inflation, three-list reflex, vague hedging, AI buzzwords), active prose principles, academic tense/hedging/citation conventions. Bilingual: English + German.",
    skillDir: 'writing-style',
  },
  {
    name: 'design-conventions',
    description: 'Visual design conventions for vswrite documents — five-slot color theory, typography pairing, heading hierarchy, layout patterns, modern 2026 aesthetics, accessibility & contrast rules, anti-patterns. Load when picking themes, applying palettes, composing layouts, or making "this should look like X" calls.',
    skillDir: 'design',
  },
];

for (const prompt of SKILL_PROMPTS) {
  server.prompt(
    prompt.name,
    prompt.description,
    () => {
      const skillPath = path.join(state.projectDir, '.claude', 'skills', prompt.skillDir, 'SKILL.md');
      let content: string;
      try {
        content = fs.readFileSync(skillPath, 'utf-8');
      } catch {
        content = `Skill "${prompt.name}" not found in this project. Create a new project with vswrite_create_project to get skills auto-deployed.`;
      }
      return { messages: [{ role: 'user', content: { type: 'text', text: content } }] };
    },
  );
}

// ─── Tool: vswrite_set_project ───────────────────────

server.tool(
  'vswrite_set_project',
  'Sets the active project directory. Call this first to tell vswrite which Typst project to work with. Automatically detects the main .typ file (main.typ, document.typ, or first .typ found).',
  { projectDir: z.string().describe('Absolute path to the Typst project directory') },
  async ({ projectDir }) => {
    const absDir = path.resolve(projectDir);
    if (!fs.existsSync(absDir)) {
      return { content: [{ type: 'text' as const, text: `Error: Directory not found: ${absDir}` }], isError: true };
    }
    state.projectDir = absDir;
    state.currentFile = null;

    // Auto-detect main .typ file
    const candidates = ['main.typ', 'document.typ', 'index.typ'];
    for (const name of candidates) {
      const p = path.join(absDir, name);
      if (fs.existsSync(p)) {
        state.currentFile = p;
        break;
      }
    }
    if (!state.currentFile) {
      try {
        const typFiles = fs.readdirSync(absDir).filter(f => f.endsWith('.typ'));
        if (typFiles.length > 0) {
          state.currentFile = path.join(absDir, typFiles[0]);
        }
      } catch {}
    }

    const mainFile = state.currentFile ? path.basename(state.currentFile) : '(no .typ file found)';
    return {
      content: [{
        type: 'text' as const,
        text: `Project set to ${absDir}\nMain file: ${mainFile}`,
      }],
    };
  },
);

// ─── Tool: vswrite_get_document ──────────────────────

server.tool(
  'vswrite_get_document',
  'Returns the current Typst document: content, file path, project directory, and word count. Use this to read the document before making changes.',
  async () => {
    try {
      const { content, filePath } = readCurrentDocument();
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            filePath,
            projectDir: state.projectDir,
            content,
            wordCount: wordCount(content),
          }, null, 2),
        }],
      };
    } catch (err) {
      return { content: [{ type: 'text' as const, text: `Error: ${err}` }], isError: true };
    }
  },
);

// ─── Tool: vswrite_open_file ─────────────────────────

server.tool(
  'vswrite_open_file',
  'Opens a .typ file as the current document. Provide an absolute path or a path relative to the project directory.',
  { filePath: z.string().describe('Path to the .typ file (absolute or relative to project)') },
  async ({ filePath }) => {
    try {
      const absPath = resolveInsideProject(filePath);
      if (!fs.existsSync(absPath)) {
        return { content: [{ type: 'text' as const, text: `Error: File not found: ${absPath}` }], isError: true };
      }
      state.currentFile = absPath;
      const content = fs.readFileSync(absPath, 'utf-8');
      return {
        content: [{
          type: 'text' as const,
          text: `Opened ${path.basename(absPath)} (${wordCount(content)} words)`,
        }],
      };
    } catch (err) {
      return { content: [{ type: 'text' as const, text: `Error: ${err instanceof Error ? err.message : String(err)}` }], isError: true };
    }
  },
);

// ─── Tool: vswrite_update_document ───────────────────

server.tool(
  'vswrite_update_document',
  'Replaces the content of the current Typst document and saves it to disk. Use vswrite_get_document first to read the current content, modify it, then send the complete new content here.',
  { content: z.string().describe('The complete new Typst document content') },
  async ({ content }) => {
    try {
      const { filePath } = readCurrentDocument();
      fs.writeFileSync(filePath, content, 'utf-8');
      return {
        content: [{
          type: 'text' as const,
          text: `Updated and saved ${path.basename(filePath)} (${wordCount(content)} words)`,
        }],
      };
    } catch (err) {
      return { content: [{ type: 'text' as const, text: `Error: ${err}` }], isError: true };
    }
  },
);

// ─── Tool: vswrite_compile ───────────────────────────

server.tool(
  'vswrite_compile',
  'Verify the current document compiles. Returns { success, rootFile, sizeBytes, errors[], warnings[] } — errors carry file + line. PDF artefact is discarded; use vswrite_export_pdf / _docx for real output.',
  async () => {
    try {
      const { filePath } = readCurrentDocument();
      const rootFile = findRootFile(filePath);
      const dir = path.dirname(rootFile);
      const tempPath = path.join(dir, '.vswrite-compile-output.pdf');

      try {
        const result = await execFileAsync(typstBinary(), typstCompileArgs([rootFile, tempPath]), { cwd: dir, timeout: 30000 });
        const stat = fs.statSync(tempPath);
        try { fs.unlinkSync(tempPath); } catch {}
        // Typst emits warnings on stderr even when the compile succeeds
        // (exit 0). Parse them out so the agent can choose to act on them.
        const warnings = parseCompileDiagnostics(result.stderr ?? '', 'warning');
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({ success: true, rootFile, sizeBytes: stat.size, errors: [], warnings }, null, 2),
          }],
        };
      } catch (compileErr: unknown) {
        try { fs.unlinkSync(tempPath); } catch {}
        const stderr = (compileErr as { stderr?: string }).stderr || String(compileErr);
        const errors = parseCompileDiagnostics(stderr, 'error');
        const warnings = parseCompileDiagnostics(stderr, 'warning');
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({ success: false, rootFile, errors, warnings }, null, 2),
          }],
        };
      }
    } catch (err) {
      return { content: [{ type: 'text' as const, text: `Error: ${err instanceof Error ? err.message : String(err)}` }], isError: true };
    }
  },
);

interface CompileDiagnostic {
  message: string;
  file?: string;
  line?: number;
}

/**
 * Parses Typst's stderr into structured `error:` or `warning:` entries.
 * Both severities use the same multi-line shape:
 *
 *   <kind>: <message>
 *     ┌─ /abs/path/to/chapters/03-foo.typ:60:0
 *      │
 *   60 │ <source line>
 *      │ ^^^^^^^
 *      │
 *      = hint: <suggested fix>
 *
 * We pair the diagnostic header with the next `┌─` line within a small
 * lookahead window to extract `(file, line)`. Any `= hint:` lines that
 * follow before the next diagnostic header get appended to the message
 * in parentheses so the agent sees both the diagnosis and Typst's own
 * suggested remediation in one shot.
 *
 * Pass `kind: 'error'` to grab fatal diagnostics, `'warning'` for the
 * advisory ones (unknown font family, deprecated function, …).
 */
function parseCompileDiagnostics(stderr: string, kind: 'error' | 'warning'): CompileDiagnostic[] {
  const out: CompileDiagnostic[] = [];
  const lines = stderr.split('\n');
  // Header regex: matches `error:` or `warning:` at start of line.
  const headerRe = new RegExp(`^${kind}:?\\s*(.+?)\\s*$`, 'i');
  // Generic "any diagnostic header" — used to detect the start of the
  // next block so we stop scanning for hints / location.
  const anyHeaderRe = /^(?:error|warning):?\s/i;

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(headerRe);
    if (!match) continue;

    const entry: CompileDiagnostic = { message: match[1] };

    // Location: look ahead within ~5 lines for the `┌─ path:line:col` marker.
    for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
      if (anyHeaderRe.test(lines[j])) break;
      const locMatch = lines[j].match(/┌─\s*(.+?):(\d+):\d+\s*$/);
      if (locMatch) {
        entry.file = locMatch[1];
        entry.line = parseInt(locMatch[2], 10);
        break;
      }
    }

    // Hints: scan up to the next diagnostic header (or 20 lines, safety cap).
    const hints: string[] = [];
    for (let j = i + 1; j < Math.min(i + 20, lines.length); j++) {
      if (anyHeaderRe.test(lines[j])) break;
      const hintMatch = lines[j].match(/^\s*=\s*hint:\s*(.+?)\s*$/);
      if (hintMatch) hints.push(hintMatch[1]);
    }
    if (hints.length > 0) entry.message += ` (hint: ${hints.join('; ')})`;

    out.push(entry);
  }
  return out;
}

// ─── Tool: vswrite_get_settings ──────────────────────

server.tool(
  'vswrite_get_settings',
  'Reads the document settings (#set blocks) from the current Typst file. Returns font, size, language, margins, page format, paragraph settings, heading numbering, and bibliography style.',
  async () => {
    try {
      const { content } = readCurrentDocument();
      const settings = parseSettings(content);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(settings, null, 2) }],
      };
    } catch (err) {
      return { content: [{ type: 'text' as const, text: `Error: ${err}` }], isError: true };
    }
  },
);

// ─── Tool: vswrite_update_settings ───────────────────

server.tool(
  'vswrite_update_settings',
  'Update document settings (lang + bibliographyStyle since Phase A — everything else lives in style.json via the Design tools). Only changed keys need to be passed.',
  {
    settings: z.record(z.string()).describe('Key-value pairs of settings to update'),
  },
  async ({ settings }) => {
    try {
      const { content, filePath } = readCurrentDocument();

      // Merge with existing settings
      const current = parseSettings(content);
      const merged = { ...current };
      for (const [key, value] of Object.entries(settings)) {
        if (key in merged) {
          (merged as Record<string, string>)[key] = value;
        }
      }

      const updated = applySettings(content, merged as DocumentSettings);
      fs.writeFileSync(filePath, updated, 'utf-8');

      return {
        content: [{
          type: 'text' as const,
          text: `Settings updated in ${path.basename(filePath)}:\n${generateSetBlocks(merged as DocumentSettings)}`,
        }],
      };
    } catch (err) {
      return { content: [{ type: 'text' as const, text: `Error: ${err}` }], isError: true };
    }
  },
);

// ─── Tool: vswrite_list_files ────────────────────────

server.tool(
  'vswrite_list_files',
  'Returns the project file tree. Shows all .typ, .bib, .md, .yaml, .json, .pdf and image files.',
  async () => {
    try {
      const tree = listDir(state.projectDir, 0);
      return {
        content: [{ type: 'text' as const, text: tree }],
      };
    } catch (err) {
      return { content: [{ type: 'text' as const, text: `Error: ${err}` }], isError: true };
    }
  },
);

const IGNORED_DIRS = new Set(['.git', 'node_modules', '.DS_Store', '__pycache__', '.venv', 'dist', 'build']);
const ALLOWED_EXTS = new Set(['.typ', '.bib', '.yaml', '.yml', '.toml', '.txt', '.md', '.png', '.jpg', '.jpeg', '.svg', '.gif', '.pdf', '.docx', '.csv', '.json', '.tex']);

function listDir(dir: string, depth: number): string {
  if (depth > 5) return '';
  const indent = '  '.repeat(depth);
  const entries = fs.readdirSync(dir, { withFileTypes: true })
    .filter(e => !e.name.startsWith('.') || e.name === '.claude')
    .filter(e => !IGNORED_DIRS.has(e.name))
    .sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) return -1;
      if (!a.isDirectory() && b.isDirectory()) return 1;
      return a.name.localeCompare(b.name);
    });

  const lines: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const sub = listDir(fullPath, depth + 1);
      if (sub) {
        lines.push(`${indent}${entry.name}/`);
        lines.push(sub);
      }
    } else {
      const ext = path.extname(entry.name).toLowerCase();
      if (ALLOWED_EXTS.has(ext)) {
        lines.push(`${indent}${entry.name}`);
      }
    }
  }
  return lines.join('\n');
}

// ─── Tool: vswrite_read_file ─────────────────────────

server.tool(
  'vswrite_read_file',
  'Reads a file from the project. Returns content as text for text files. Provide an absolute path or a path relative to the project directory.',
  { filePath: z.string().describe('Path to the file (absolute or relative to project)') },
  async ({ filePath }) => {
    try {
      const absPath = resolveInsideProject(filePath);
      if (!fs.existsSync(absPath)) {
        return { content: [{ type: 'text' as const, text: `Error: File not found: ${absPath}` }], isError: true };
      }
      const content = fs.readFileSync(absPath, 'utf-8');
      return { content: [{ type: 'text' as const, text: content }] };
    } catch (err) {
      return { content: [{ type: 'text' as const, text: `Error: ${err instanceof Error ? err.message : String(err)}` }], isError: true };
    }
  },
);

// ─── Tool: vswrite_write_file ────────────────────────

server.tool(
  'vswrite_write_file',
  'Writes content to a file in the project. Creates parent directories if needed. Provide an absolute path or a path relative to the project directory.',
  {
    filePath: z.string().describe('Path to the file (absolute or relative to project)'),
    content: z.string().describe('File content to write'),
  },
  async ({ filePath, content }) => {
    try {
      const absPath = resolveInsideProject(filePath);
      const dir = path.dirname(absPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(absPath, content, 'utf-8');
      return {
        content: [{ type: 'text' as const, text: `Written ${path.basename(absPath)} (${content.length} bytes)` }],
      };
    } catch (err) {
      return { content: [{ type: 'text' as const, text: `Error: ${err instanceof Error ? err.message : String(err)}` }], isError: true };
    }
  },
);

// ─── Tool: vswrite_export_pdf ────────────────────────

server.tool(
  'vswrite_export_pdf',
  'Compile + export as PDF. Output path must be inside the project (convention: exports/<name>.pdf). Parent dirs auto-created.',
  { outputPath: z.string().describe('Path for the PDF output file, relative to the project (e.g. "exports/thesis.pdf"). Absolute paths must point inside the project directory.') },
  async ({ outputPath }) => {
    try {
      const { filePath } = readCurrentDocument();
      const rootFile = findRootFile(filePath);
      const dir = path.dirname(rootFile);
      const absOutput = resolveInsideProject(outputPath);

      // Auto-create the parent dir (e.g. exports/) so a fresh project doesn't error on first export.
      const outDir = path.dirname(absOutput);
      if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
      }

      await execFileAsync(typstBinary(), typstCompileArgs([rootFile, absOutput]), { cwd: dir, timeout: 30000 });
      const stat = fs.statSync(absOutput);

      return {
        content: [{
          type: 'text' as const,
          text: `PDF exported to ${absOutput} (${(stat.size / 1024).toFixed(1)} KB)`,
        }],
      };
    } catch (err: unknown) {
      const stderr = (err as { stderr?: string }).stderr || (err instanceof Error ? err.message : String(err));
      return { content: [{ type: 'text' as const, text: `Export failed:\n${stderr}` }], isError: true };
    }
  },
);

// ═══════════════════════════════════════════════════════
// Phase 3 Tools
// ═══════════════════════════════════════════════════════

// ─── Tool: vswrite_list_styles (migrated to themes) ───
//
// Historic tool name kept for API stability. The seven legacy
// preamble-string templates that lived here have been retired; this
// tool now returns the new structured `THEME_PRESETS`. The previous
// in-doc preamble-injection has been replaced by writing through
// `style.json`.

server.tool(
  'vswrite_list_styles',
  'Returns all available theme presets (id, name, description, best-for). Each theme is a complete ProjectStyle that the user can apply via vswrite_apply_style.',
  async () => {
    const themes = THEME_PRESETS.map(t => ({
      id: t.id,
      name: t.name,
      description: t.description,
      bestFor: t.bestFor,
    }));
    return { content: [{ type: 'text' as const, text: JSON.stringify(themes, null, 2) }] };
  },
);

// ─── Tool: vswrite_apply_style ───────────────────────
// Applies a built-in theme to the current project's style.json. Preserves
// the user's custom.preamble (their escape-hatch code).

server.tool(
  'vswrite_apply_style',
  'Apply a built-in theme preset. Overwrites colors/fonts/layout/headings/elements; preserves custom.preamble. Call vswrite_list_styles first.',
  { styleId: z.string().describe('Theme preset ID — see vswrite_list_styles for available IDs') },
  async ({ styleId }) => {
    if (!state.projectDir) {
      return { content: [{ type: 'text' as const, text: 'Error: No project set. Use vswrite_set_project first.' }], isError: true };
    }
    const t = THEME_PRESETS.find(x => x.id === styleId);
    if (!t) {
      const ids = THEME_PRESETS.map(x => x.id).join(', ');
      return { content: [{ type: 'text' as const, text: `Error: Unknown theme "${styleId}". Available: ${ids}` }], isError: true };
    }
    const current = readProjectStyle(state.projectDir);
    // Preserve project-specific data a theme doesn't carry: the custom-code
    // escape hatch and the per-chapter section styles (Phase E).
    const next = sanitizeProjectStyle({ ...t.style, sections: current.sections, custom: { preamble: current.custom?.preamble ?? '' } });
    writeProjectStyleAndRegenerate(state.projectDir, next);
    return { content: [{ type: 'text' as const, text: `Applied theme "${t.name}" — style.json + style.typ regenerated. Run vswrite_compile to verify.` }] };
  },
);

// ─── Tool: vswrite_get_style ─────────────────────────

server.tool(
  'vswrite_get_style',
  'Return the ProjectStyle JSON (colors / fonts / scale / layout / headings / elements / custom). Call before vswrite_update_style.',
  async () => {
    if (!state.projectDir) {
      return { content: [{ type: 'text' as const, text: 'Error: No project set. Use vswrite_set_project first.' }], isError: true };
    }
    const style = readProjectStyle(state.projectDir);
    return { content: [{ type: 'text' as const, text: JSON.stringify(style, null, 2) }] };
  },
);

// ─── Tool: vswrite_update_style ──────────────────────

server.tool(
  'vswrite_update_style',
  'Deep-merge a partial ProjectStyle into style.json. Per-leaf sanitiser: invalid hex / weight / range falls back to existing value (never errors).',
  {
    patch: z.unknown().describe('Partial ProjectStyle JSON object. Top-level keys: colors, fonts, scale, layout, headings, elements, custom.'),
  },
  async ({ patch }) => {
    if (!state.projectDir) {
      return { content: [{ type: 'text' as const, text: 'Error: No project set. Use vswrite_set_project first.' }], isError: true };
    }
    const current = readProjectStyle(state.projectDir);
    const merged = deepMergeStyle(current, patch);
    const written = writeProjectStyleAndRegenerate(state.projectDir, merged);
    return { content: [{ type: 'text' as const, text: `Style updated. Current state:\n${JSON.stringify(written, null, 2)}` }] };
  },
);

// ─── Tool: vswrite_list_fonts ────────────────────────

server.tool(
  'vswrite_list_fonts',
  'List the 7 bundled OFL fonts (family, category, description). Always available; reference in fonts.body / fonts.heading / fonts.code without system-install check.',
  async () => {
    // Resolve the bundled fonts manifest. TYPST_FONT_PATH points to the
    // resources/fonts directory in the running .app (set by mcpSetup) —
    // fall back to the repo path so the tool also works from a dev shell.
    const fontPathEnv = process.env.TYPST_FONT_PATH;
    const candidates: string[] = [];
    if (fontPathEnv) candidates.push(path.join(fontPathEnv, 'manifest.json'));
    candidates.push(path.resolve(process.cwd(), 'resources', 'fonts', 'manifest.json'));

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        try {
          const manifest = JSON.parse(fs.readFileSync(candidate, 'utf-8'));
          const fonts = (manifest.fonts ?? []).map((f: { family: string; category: string; description: string }) => ({
            family: f.family,
            category: f.category,
            description: f.description,
          }));
          return { content: [{ type: 'text' as const, text: JSON.stringify(fonts, null, 2) }] };
        } catch {}
      }
    }
    return { content: [{ type: 'text' as const, text: 'Error: bundled fonts manifest not found.' }], isError: true };
  },
);

// ─── Tool: vswrite_apply_palette ─────────────────────

server.tool(
  'vswrite_apply_palette',
  'Apply a 5-color palette via `presetId` or per-slot hex overrides (composable). Empty-args call returns available presets.',
  {
    presetId: z.string().optional().describe('Optional palette preset id (e.g. "modern-tech", "editorial", "earth-tones").'),
    primary:    z.string().optional().describe('Optional hex for the primary slot (e.g. "#0f172a"). Falls back to current value.'),
    accent:     z.string().optional().describe('Optional hex for the accent slot.'),
    text:       z.string().optional().describe('Optional hex for the body-text slot.'),
    background: z.string().optional().describe('Optional hex for the page-background slot.'),
    muted:      z.string().optional().describe('Optional hex for the muted slot.'),
  },
  async ({ presetId, primary, accent, text, background, muted }) => {
    if (!state.projectDir) {
      return { content: [{ type: 'text' as const, text: 'Error: No project set. Use vswrite_set_project first.' }], isError: true };
    }

    // No args at all → list available presets so Claude can discover them.
    if (!presetId && !primary && !accent && !text && !background && !muted) {
      const presets = PALETTE_PRESETS.map(p => ({ id: p.id, name: p.name, description: p.description, colors: p.colors }));
      return { content: [{ type: 'text' as const, text: `Pass either presetId or per-slot hex. Available presets:\n${JSON.stringify(presets, null, 2)}` }] };
    }

    const current = readProjectStyle(state.projectDir);
    let palette: Partial<StyleColors> = {};
    if (presetId) {
      const preset = PALETTE_PRESETS.find(p => p.id === presetId);
      if (!preset) {
        const ids = PALETTE_PRESETS.map(p => p.id).join(', ');
        return { content: [{ type: 'text' as const, text: `Error: Unknown palette "${presetId}". Available: ${ids}` }], isError: true };
      }
      palette = { ...preset.colors };
    }
    // Per-slot overrides — work in combination with a preset (or solo).
    if (primary)    palette.primary    = primary;
    if (accent)     palette.accent     = accent;
    if (text)       palette.text       = text;
    if (background) palette.background = background;
    if (muted)      palette.muted      = muted;

    const written = writeProjectStyleAndRegenerate(state.projectDir, {
      ...current,
      colors: { ...current.colors, ...palette },
    });
    return { content: [{ type: 'text' as const, text: `Palette applied. Resulting colors:\n${JSON.stringify(written.colors, null, 2)}` }] };
  },
);

// ─── Tool: vswrite_list_layouts ──────────────────────

server.tool(
  'vswrite_list_layouts',
  'Returns the built-in layout presets (id, name, description, best-for, paper, orientation, columns, base-size). Apply one via vswrite_apply_layout.',
  async () => {
    const layouts = LAYOUT_PRESETS.map(p => ({
      id: p.id,
      name: p.name,
      description: p.description,
      bestFor: p.bestFor,
      paper: p.layout.paper,
      orientation: p.layout.orientation,
      columns: p.layout.columns,
      baseSize: p.baseSize ?? null,
    }));
    return { content: [{ type: 'text' as const, text: JSON.stringify(layouts, null, 2) }] };
  },
);

// ─── Tool: vswrite_apply_layout ──────────────────────

server.tool(
  'vswrite_apply_layout',
  'Apply a layout preset (swaps layout.* + optionally scale.base). Theme + colors + fonts unchanged. Stacks with apply_style.',
  { layoutId: z.string().describe('Layout preset ID — see vswrite_list_layouts') },
  async ({ layoutId }) => {
    if (!state.projectDir) {
      return { content: [{ type: 'text' as const, text: 'Error: No project set. Use vswrite_set_project first.' }], isError: true };
    }
    const preset = LAYOUT_PRESETS.find(p => p.id === layoutId);
    if (!preset) {
      const ids = LAYOUT_PRESETS.map(p => p.id).join(', ');
      return { content: [{ type: 'text' as const, text: `Error: Unknown layout "${layoutId}". Available: ${ids}` }], isError: true };
    }
    const current = readProjectStyle(state.projectDir);
    const next = {
      ...current,
      layout: { ...preset.layout },
      scale: { ...current.scale, base: preset.baseSize ?? current.scale.base },
    };
    const written = writeProjectStyleAndRegenerate(state.projectDir, next);
    return { content: [{ type: 'text' as const, text: `Applied layout "${preset.name}" — ${written.layout.paper}/${written.layout.orientation}/${written.layout.columns}col, base ${written.scale.base}.` }] };
  },
);

// ─── Tool: vswrite_list_design_elements ──────────────

server.tool(
  'vswrite_list_design_elements',
  'List the 19 design elements (banner / sidebar / pull-quote × 3 / callout / hero / divider × 3 / drop-cap / article-opener / section-opener / gallery × 3 / image-overlay / stats-box / photo-caption-wrap / magazine-cover) with their params.',
  async () => {
    const list = DESIGN_ELEMENTS.map(e => ({
      id: e.id,
      name: e.name,
      description: e.description,
      params: e.params,
    }));
    return { content: [{ type: 'text' as const, text: JSON.stringify(list, null, 2) }] };
  },
);

// ─── Tool: vswrite_insert_design_element ─────────────

server.tool(
  'vswrite_insert_design_element',
  'Insert a design element (19 available — call vswrite_list_design_elements first) at an anchor. Auto-themes via style-colors / style-fonts.',
  {
    elementId: z.string().describe('Design element id — see vswrite_list_design_elements'),
    afterText: z.string().describe('Anchor text. Element is inserted on a new line after this match. Pass empty string to insert at the document end.'),
    occurrence: z.number().int().min(1).optional().default(1).describe('Which 1-based occurrence of `afterText` to target if it appears multiple times.'),
    params: z.record(z.string()).optional().describe('Element-specific values. e.g. { title: "Welcome", subtitle: "..." } for the Hero element. See vswrite_list_design_elements for each element\'s param list.'),
  },
  async ({ elementId, afterText, occurrence, params }) => {
    try {
      const element = getDesignElement(elementId);
      if (!element) {
        const ids = DESIGN_ELEMENTS.map(e => e.id).join(', ');
        return { content: [{ type: 'text' as const, text: `Error: Unknown element "${elementId}". Available: ${ids}` }], isError: true };
      }
      // Fail fast on missing required params so Claude can self-correct.
      const supplied = params ?? {};
      const missing = element.params.filter(p => p.required && !supplied[p.name] && !p.defaultValue);
      if (missing.length > 0) {
        return { content: [{ type: 'text' as const, text: `Error: Missing required params for "${elementId}": ${missing.map(m => m.name).join(', ')}` }], isError: true };
      }

      const snippet = renderDesignElement(element, supplied);
      const { content, filePath } = readCurrentDocument();

      let insertAt: number;
      if (afterText.length === 0) {
        insertAt = content.length;
      } else {
        // Find the Nth occurrence of `afterText` and insert at the end of
        // that line (mirrors the existing add_image / add_footnote helpers).
        let from = -1;
        for (let i = 0; i < occurrence; i++) {
          from = content.indexOf(afterText, from + 1);
          if (from === -1) {
            return { content: [{ type: 'text' as const, text: `Error: afterText not found at occurrence ${occurrence}. (Only ${i} match${i === 1 ? '' : 'es'} found.)` }], isError: true };
          }
        }
        const lineEnd = content.indexOf('\n', from);
        insertAt = lineEnd === -1 ? content.length : lineEnd;
      }

      const updated = content.slice(0, insertAt) + '\n\n' + snippet + '\n' + content.slice(insertAt);
      fs.writeFileSync(filePath, updated, 'utf-8');

      return {
        content: [{
          type: 'text' as const,
          text: `Inserted "${element.name}" into ${path.basename(filePath)} at offset ${insertAt}.`,
        }],
      };
    } catch (err) {
      return { content: [{ type: 'text' as const, text: `Error: ${err}` }], isError: true };
    }
  },
);

// ─── Tool: vswrite_generate_layout ───────────────────
//
// Composite high-level call. Given a natural-language design brief, this
// applies a sensible theme + layout combo plus a starter set of design
// elements (banner / hero / divider) at the top of the document. The
// matching heuristics live entirely in this tool — Claude can also
// orchestrate the individual tools (apply_style + apply_layout +
// insert_design_element) for finer control.

server.tool(
  'vswrite_generate_layout',
  'High-level NL composite: intent ("brochure" | "thesis" | "magazine" | "report" | …) → theme + layout + optional hero. Use as scaffolding before fine-tuning.',
  {
    intent: z.string().describe('What kind of document — "brochure", "thesis", "article", "report", "magazine", "essay", "spec". Free text; the tool maps to the closest preset combo.'),
    title: z.string().optional().describe('Optional title — when provided, the tool drops a Hero element at the start of the file.'),
    subtitle: z.string().optional().describe('Optional subtitle for the Hero.'),
  },
  async ({ intent, title, subtitle }) => {
    if (!state.projectDir) {
      return { content: [{ type: 'text' as const, text: 'Error: No project set. Use vswrite_set_project first.' }], isError: true };
    }

    // Intent → (theme, layout) mapping. Conservative: leans on the
    // built-in presets rather than synthesizing combinations from scratch.
    const it = intent.toLowerCase().trim();
    let themeId = 'modern-tech';
    let layoutId = 'a4-portrait-standard';
    let addHero = false;

    if (/brochure|sales|marketing|product/.test(it))      { themeId = 'marketing-brochure'; layoutId = 'magazine-2col';            addHero = true; }
    else if (/thesis|dissertation/.test(it))               { themeId = 'thesis';             layoutId = 'a4-portrait-standard';    }
    else if (/magazine|editorial|article|essay/.test(it))  { themeId = 'editorial-magazine'; layoutId = 'magazine-2col';            addHero = !!title; }
    else if (/report|whitepaper|business/.test(it))        { themeId = 'classic-academic';   layoutId = 'a4-portrait-standard';     }
    else if (/spec|api|docs|documentation|technical/.test(it)) { themeId = 'modern-tech';     layoutId = 'a4-portrait-standard';     }
    else if (/minimal|simple|essay|personal/.test(it))     { themeId = 'minimal';            layoutId = 'a4-portrait-standard';     }
    else if (/newsletter|news/.test(it))                   { themeId = 'editorial-magazine'; layoutId = 'newsletter-3col';          }
    else if (/poster|conference/.test(it))                 { themeId = 'modern-tech';        layoutId = 'a2-poster';                }
    else if (/booklet|programme|guide/.test(it))           { themeId = 'editorial-magazine'; layoutId = 'a5-booklet';               }
    else if (/slide|presentation|deck/.test(it))           { themeId = 'modern-tech';        layoutId = 'a4-landscape-presentation'; addHero = !!title; }

    const theme = THEME_PRESETS.find(t => t.id === themeId)!;
    const layout = LAYOUT_PRESETS.find(l => l.id === layoutId)!;
    const currentStyle = readProjectStyle(state.projectDir);
    const preservedCustom = currentStyle.custom?.preamble ?? '';
    writeProjectStyleAndRegenerate(state.projectDir, {
      ...theme.style,
      layout: { ...layout.layout },
      scale: { ...theme.style.scale, base: layout.baseSize ?? theme.style.scale.base },
      sections: currentStyle.sections,
      custom: { preamble: preservedCustom },
    });

    let heroInserted = false;
    if (addHero && title && state.currentFile) {
      try {
        const element = getDesignElement('hero')!;
        const snippet = renderDesignElement(element, { title, subtitle: subtitle ?? '' });
        const content = fs.readFileSync(state.currentFile, 'utf-8');
        // Insert at top, after any existing #include "style.typ" line.
        const includeLine = '#include "style.typ"';
        const idx = content.indexOf(includeLine);
        const insertAt = idx === -1
          ? 0
          : content.indexOf('\n', idx + includeLine.length) + 1;
        const updated = content.slice(0, insertAt) + '\n' + snippet + '\n' + content.slice(insertAt);
        fs.writeFileSync(state.currentFile, updated, 'utf-8');
        heroInserted = true;
      } catch (err) {
        // Non-fatal — the theme + layout still applied.
        console.warn('[mcp] hero insert failed:', err);
      }
    }

    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          intent,
          appliedTheme: { id: theme.id, name: theme.name },
          appliedLayout: { id: layout.id, name: layout.name },
          heroInserted,
          nextSteps: 'Inspect with vswrite_get_style, fine-tune with vswrite_update_style, or vswrite_compile to verify.',
        }, null, 2),
      }],
    };
  },
);

// ─── Section styles (Phase E — per-chapter magazine design) ──

function blankSection(id: string): SectionStyle {
  return { id, name: id, colors: {}, fonts: {}, scaleBase: '', scaleLeading: '', columns: 0, headings: {} };
}

/** Recursively lists `.typ` files in the project (skips .git / .vswrite). */
function walkTypFiles(dir: string, out: string[] = []): string[] {
  let entries: fs.Dirent[] = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    if (e.name.startsWith('.git') || e.name === '.vswrite' || e.name === 'node_modules') continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walkTypFiles(full, out);
    else if (e.name.endsWith('.typ')) out.push(full);
  }
  return out;
}

// ─── Tool: vswrite_list_section_styles ───────────────

server.tool(
  'vswrite_list_section_styles',
  'List per-chapter "section styles" (magazine rubrics). Returns the built-in presets, the variants already defined in this project, and which chapters currently use which variant. A section style restyles one chapter (accent / fonts / columns / headings) via a scoped #show — page geometry stays document-level.',
  {},
  async () => {
    if (!state.projectDir) {
      return { content: [{ type: 'text' as const, text: 'Error: No project set. Use vswrite_set_project first.' }], isError: true };
    }
    const style = readProjectStyle(state.projectDir);
    const presets = SECTION_PRESETS.map(p => ({ id: p.id, name: p.name, description: p.description }));
    const defined = style.sections.map(s => ({
      id: s.id, name: s.name, accent: s.colors.accent ?? null, columns: s.columns || null,
    }));
    const assignments: { file: string; styleId: string }[] = [];
    for (const f of walkTypFiles(state.projectDir)) {
      try {
        const id = getSectionStyleId(fs.readFileSync(f, 'utf-8'));
        if (id) assignments.push({ file: path.relative(state.projectDir, f), styleId: id });
      } catch { /* ignore unreadable */ }
    }
    return { content: [{ type: 'text' as const, text: JSON.stringify({ presets, defined, assignments }, null, 2) }] };
  },
);

// ─── Tool: vswrite_define_section_style ──────────────

server.tool(
  'vswrite_define_section_style',
  'Create or update a section style (a per-chapter design overlay). Start from a preset via fromPreset and/or pass explicit overrides; writes style.json + regenerates style.typ so the chapter opt-in resolves. Assign it afterwards with vswrite_apply_section_style.',
  {
    id: z.string().describe('Slug id (lowercase letters / digits / hyphens) — also the Typst function name, e.g. "feature".'),
    name: z.string().optional().describe('Display name. Defaults to the id.'),
    fromPreset: z.string().optional().describe('Built-in preset to start from: feature / interview / essay / photo-essay / department. Overrides below merge on top.'),
    accent: z.string().optional().describe('Accent colour hex, e.g. "#c2410c".'),
    primary: z.string().optional().describe('Primary colour hex.'),
    bodyFont: z.string().optional().describe('Body font family (one of the 7 bundled OFL fonts).'),
    headingFont: z.string().optional().describe('Heading font family.'),
    baseSize: z.string().optional().describe('Body size override e.g. "10pt"; "" = inherit.'),
    leading: z.string().optional().describe('Leading override e.g. "0.8em"; "" = inherit.'),
    columns: z.number().optional().describe('Column count 1–3; 0 = inherit. Changing columns starts a new page.'),
    h1Size: z.string().optional().describe('H1 size override, e.g. "34pt".'),
    h1Weight: z.string().optional().describe('H1 weight, e.g. "bold".'),
    h1Color: z.string().optional().describe('H1 colour slot: primary / accent / text / background / muted.'),
  },
  async (a) => {
    if (!state.projectDir) {
      return { content: [{ type: 'text' as const, text: 'Error: No project set. Use vswrite_set_project first.' }], isError: true };
    }
    const base: SectionStyle = (a.fromPreset ? getSectionPreset(a.fromPreset) : null) ?? blankSection(a.id);
    base.id = a.id;
    base.name = a.name ?? (base.name && base.name !== base.id ? base.name : a.id);
    if (a.accent) base.colors = { ...base.colors, accent: a.accent };
    if (a.primary) base.colors = { ...base.colors, primary: a.primary };
    if (a.bodyFont) base.fonts = { ...base.fonts, body: a.bodyFont };
    if (a.headingFont) base.fonts = { ...base.fonts, heading: a.headingFont };
    if (a.baseSize !== undefined) base.scaleBase = a.baseSize;
    if (a.leading !== undefined) base.scaleLeading = a.leading;
    if (a.columns !== undefined) base.columns = a.columns;
    if (a.h1Size || a.h1Weight || a.h1Color) {
      base.headings = {
        ...base.headings,
        h1: {
          ...(base.headings.h1 ?? {}),
          ...(a.h1Size ? { size: a.h1Size } : {}),
          ...(a.h1Weight ? { weight: a.h1Weight } : {}),
          ...(a.h1Color ? { color: a.h1Color as keyof StyleColors } : {}),
        },
      };
    }
    const style = readProjectStyle(state.projectDir);
    const sections = style.sections.filter(s => s.id !== a.id);
    sections.push(base);
    const written = writeProjectStyleAndRegenerate(state.projectDir, { ...style, sections });
    const saved = written.sections.find(s => s.id === a.id);
    if (!saved) {
      return { content: [{ type: 'text' as const, text: `Error: section id "${a.id}" was rejected by the sanitizer (must be lowercase letters/digits/hyphens, starting with a letter).` }], isError: true };
    }
    return { content: [{ type: 'text' as const, text: JSON.stringify({ defined: saved, note: `Assign it with vswrite_apply_section_style({ file, styleId: "${saved.id}" }).` }, null, 2) }] };
  },
);

// ─── Tool: vswrite_apply_section_style ───────────────

server.tool(
  'vswrite_apply_section_style',
  'Assign a section style to a chapter file (injects the scoped #show opt-in at the top). If styleId is a built-in preset not yet defined here, it is auto-defined first. Run vswrite_compile afterwards.',
  {
    file: z.string().describe('Chapter file, project-relative, e.g. "chapters/03-feature.typ".'),
    styleId: z.string().describe('Section style id — a defined variant or a built-in preset (feature / interview / essay / photo-essay / department).'),
  },
  async ({ file, styleId }) => {
    if (!state.projectDir) {
      return { content: [{ type: 'text' as const, text: 'Error: No project set. Use vswrite_set_project first.' }], isError: true };
    }
    const chapterAbs = resolveInsideProject(file);
    if (!fs.existsSync(chapterAbs)) {
      return { content: [{ type: 'text' as const, text: `Error: File not found: ${file}` }], isError: true };
    }
    let style = readProjectStyle(state.projectDir);
    if (!style.sections.some(s => s.id === styleId)) {
      const preset = getSectionPreset(styleId);
      if (!preset) {
        return { content: [{ type: 'text' as const, text: `Error: Unknown section style "${styleId}". Define it with vswrite_define_section_style, or use a preset: ${SECTION_PRESETS.map(p => p.id).join(', ')}.` }], isError: true };
      }
      style = writeProjectStyleAndRegenerate(state.projectDir, { ...style, sections: [...style.sections, preset] });
    }
    const rootDir = path.dirname(findRootFile(chapterAbs));
    const importPath = path.relative(path.dirname(chapterAbs), path.join(rootDir, 'style.typ')).split(path.sep).join('/');
    const src = fs.readFileSync(chapterAbs, 'utf-8');
    fs.writeFileSync(chapterAbs, ensureSectionStyle(src, styleId, importPath), 'utf-8');
    return { content: [{ type: 'text' as const, text: JSON.stringify({ file, styleId, importPath, note: 'Run vswrite_compile to verify.' }, null, 2) }] };
  },
);

// ─── Tool: vswrite_clear_section_style ───────────────

server.tool(
  'vswrite_clear_section_style',
  'Remove the section-style opt-in from a chapter file (reverts it to the document default look). The variant stays defined in style.json for reuse.',
  { file: z.string().describe('Chapter file, project-relative.') },
  async ({ file }) => {
    if (!state.projectDir) {
      return { content: [{ type: 'text' as const, text: 'Error: No project set. Use vswrite_set_project first.' }], isError: true };
    }
    const chapterAbs = resolveInsideProject(file);
    if (!fs.existsSync(chapterAbs)) {
      return { content: [{ type: 'text' as const, text: `Error: File not found: ${file}` }], isError: true };
    }
    const src = fs.readFileSync(chapterAbs, 'utf-8');
    const had = getSectionStyleId(src);
    fs.writeFileSync(chapterAbs, clearSectionStyle(src), 'utf-8');
    return { content: [{ type: 'text' as const, text: JSON.stringify({ file, cleared: had ?? null }, null, 2) }] };
  },
);

// ─── Tool: vswrite_get_chapters ──────────────────────

server.tool(
  'vswrite_get_chapters',
  'Returns the #include chapter structure of the current document. Shows which files are included, in what order, and whether they exist on disk.',
  async () => {
    try {
      const { content, filePath } = readCurrentDocument();
      const dir = path.dirname(filePath);
      const includes: { index: number; path: string; exists: boolean; title: string }[] = [];

      const lines = content.split('\n');
      let idx = 0;
      for (const line of lines) {
        const match = line.match(/^#include\s+"([^"]+)"/);
        if (match) {
          const relPath = match[1];
          const absPath = path.join(dir, relPath);
          let title = relPath;
          if (fs.existsSync(absPath)) {
            const chContent = fs.readFileSync(absPath, 'utf-8');
            const headingMatch = chContent.match(/^=\s+(.+)$/m);
            if (headingMatch) title = headingMatch[1].trim();
          }
          includes.push({ index: idx, path: relPath, exists: fs.existsSync(absPath), title });
          idx++;
        }
      }

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({ rootFile: filePath, chapters: includes }, null, 2),
        }],
      };
    } catch (err) {
      return { content: [{ type: 'text' as const, text: `Error: ${err}` }], isError: true };
    }
  },
);

// ─── Tool: vswrite_reorder_chapters ──────────────────

server.tool(
  'vswrite_reorder_chapters',
  'Reorders the #include statements in the current document. Provide the new order as an array of chapter paths (relative to project). The #include lines will be rearranged to match.',
  { order: z.array(z.string()).describe('Array of chapter paths in the desired order, e.g. ["chapters/intro.typ", "chapters/methods.typ"]') },
  async ({ order }) => {
    try {
      const { content, filePath } = readCurrentDocument();
      const lines = content.split('\n');
      const includeLines: string[] = [];
      const otherLines: string[] = [];

      for (const line of lines) {
        if (line.match(/^#include\s+"/)) {
          includeLines.push(line);
        } else {
          otherLines.push(line);
        }
      }

      // Rebuild include lines in new order
      const newIncludes: string[] = [];
      for (const chPath of order) {
        const found = includeLines.find(l => l.includes(`"${chPath}"`));
        if (found) {
          newIncludes.push(found);
        } else {
          newIncludes.push(`#include "${chPath}"`);
        }
      }

      // Find where includes were and replace them
      const result: string[] = [];
      let includesInserted = false;
      for (const line of lines) {
        if (line.match(/^#include\s+"/)) {
          if (!includesInserted) {
            result.push(...newIncludes);
            includesInserted = true;
          }
        } else {
          result.push(line);
        }
      }

      const updated = result.join('\n');
      fs.writeFileSync(filePath, updated, 'utf-8');

      return {
        content: [{ type: 'text' as const, text: `Reordered ${newIncludes.length} chapters in ${path.basename(filePath)}` }],
      };
    } catch (err) {
      return { content: [{ type: 'text' as const, text: `Error: ${err}` }], isError: true };
    }
  },
);

// ─── Tool: vswrite_add_chapter ───────────────────────

server.tool(
  'vswrite_add_chapter',
  'Creates a new chapter file and adds an #include statement to the current document. The chapter file is created in chapters/ with a heading.',
  {
    title: z.string().describe('Chapter title (e.g. "Methodology")'),
    position: z.number().optional().describe('Position in include list (0-based). Omit to append at end.'),
  },
  async ({ title, position }) => {
    try {
      const { content, filePath } = readCurrentDocument();
      const dir = path.dirname(filePath);
      const chaptersDir = path.join(dir, 'chapters');
      if (!fs.existsSync(chaptersDir)) {
        fs.mkdirSync(chaptersDir, { recursive: true });
      }

      // Generate filename
      const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'chapter';
      const chapterPath = path.join(chaptersDir, `${slug}.typ`);
      const relPath = `chapters/${slug}.typ`;

      // Create chapter file
      if (!fs.existsSync(chapterPath)) {
        fs.writeFileSync(chapterPath, `= ${title}\n\n`, 'utf-8');
      }

      // Add #include to document
      const lines = content.split('\n');
      const includeLine = `#include "${relPath}"`;

      if (position !== undefined) {
        // Insert at specific position among includes
        let includeCount = 0;
        let insertIdx = lines.length;
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].match(/^#include\s+"/)) {
            if (includeCount === position) {
              insertIdx = i;
              break;
            }
            includeCount++;
          }
        }
        lines.splice(insertIdx, 0, includeLine);
      } else {
        // Append after last include, or at end
        let lastIncludeIdx = -1;
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].match(/^#include\s+"/)) lastIncludeIdx = i;
        }
        if (lastIncludeIdx >= 0) {
          lines.splice(lastIncludeIdx + 1, 0, includeLine);
        } else {
          lines.push(includeLine);
        }
      }

      fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');

      return {
        content: [{ type: 'text' as const, text: `Created chapter "${title}" → ${relPath}` }],
      };
    } catch (err) {
      return { content: [{ type: 'text' as const, text: `Error: ${err}` }], isError: true };
    }
  },
);

// ─── Tool: vswrite_remove_chapter ────────────────────

server.tool(
  'vswrite_remove_chapter',
  'Removes an #include statement from the current document. Does NOT delete the chapter file itself.',
  { chapterPath: z.string().describe('Relative path of the chapter to remove (e.g. "chapters/intro.typ")') },
  async ({ chapterPath }) => {
    try {
      const { content, filePath } = readCurrentDocument();
      const lines = content.split('\n');
      const filtered = lines.filter(l => !l.includes(`"${chapterPath}"`));

      if (filtered.length === lines.length) {
        return { content: [{ type: 'text' as const, text: `No #include found for "${chapterPath}"` }], isError: true };
      }

      fs.writeFileSync(filePath, filtered.join('\n'), 'utf-8');

      return {
        content: [{ type: 'text' as const, text: `Removed #include "${chapterPath}" from ${path.basename(filePath)}` }],
      };
    } catch (err) {
      return { content: [{ type: 'text' as const, text: `Error: ${err}` }], isError: true };
    }
  },
);

// ─── Tool: vswrite_merge_document ────────────────────

server.tool(
  'vswrite_merge_document',
  'Resolves all #include statements recursively and returns the complete merged document as a single string. Does NOT modify files — read-only operation.',
  async () => {
    try {
      const { filePath } = readCurrentDocument();
      const merged = resolveIncludes(filePath);
      return {
        content: [{ type: 'text' as const, text: merged }],
      };
    } catch (err) {
      return { content: [{ type: 'text' as const, text: `Error: ${err}` }], isError: true };
    }
  },
);

// ─── Tool: vswrite_split_document ────────────────────

server.tool(
  'vswrite_split_document',
  'Splits the current document at = Heading 1 boundaries into separate chapter files. Creates chapters/ directory, writes individual .typ files, and replaces document body with #include statements.',
  async () => {
    try {
      const { content, filePath } = readCurrentDocument();
      const { config, chapters } = splitIntoChapters(content);

      if (chapters.length === 0) {
        return { content: [{ type: 'text' as const, text: 'No = Heading 1 boundaries found to split.' }] };
      }

      const dir = path.dirname(filePath);
      const chaptersDir = path.join(dir, 'chapters');
      if (!fs.existsSync(chaptersDir)) fs.mkdirSync(chaptersDir, { recursive: true });

      const includeLines: string[] = [];
      for (let i = 0; i < chapters.length; i++) {
        const ch = chapters[i];
        const slug = slugify(ch.title, i);
        const chapterPath = path.join(chaptersDir, `${slug}.typ`);
        fs.writeFileSync(chapterPath, ch.content, 'utf-8');
        includeLines.push(`#include "chapters/${slug}.typ"`);
      }

      const updated = config + '\n\n' + includeLines.join('\n') + '\n';
      fs.writeFileSync(filePath, updated, 'utf-8');

      return {
        content: [{
          type: 'text' as const,
          text: `Split into ${chapters.length} chapters:\n${includeLines.join('\n')}`,
        }],
      };
    } catch (err) {
      return { content: [{ type: 'text' as const, text: `Error: ${err}` }], isError: true };
    }
  },
);

// ─── Tool: vswrite_get_citations ─────────────────────

server.tool(
  'vswrite_get_citations',
  'Returns all citation entries from .bib files in the project. Each entry includes citekey, type, title, author, year, and all BibTeX fields.',
  async () => {
    try {
      const dir = state.projectDir;
      const bibFiles = fs.readdirSync(dir).filter(f => f.endsWith('.bib'));
      const allEntries: { file: string; entries: ReturnType<typeof parseBibFile> }[] = [];

      for (const bibFile of bibFiles) {
        const content = fs.readFileSync(path.join(dir, bibFile), 'utf-8');
        const entries = parseBibFile(content);
        allEntries.push({ file: bibFile, entries });
      }

      if (allEntries.length === 0) {
        return { content: [{ type: 'text' as const, text: 'No .bib files found in project directory.' }] };
      }

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(allEntries, null, 2) }],
      };
    } catch (err) {
      return { content: [{ type: 'text' as const, text: `Error: ${err}` }], isError: true };
    }
  },
);

// ─── Tool: vswrite_add_citation ──────────────────────

server.tool(
  'vswrite_add_citation',
  'Adds a new BibTeX entry to the project bibliography. Creates references.bib if it does not exist. Also ensures the document has a #bibliography statement.',
  {
    bibtex: z.string().describe('Complete BibTeX entry (e.g. @article{key, author={...}, title={...}, year={2024}})'),
    bibFile: z.string().optional().describe('Target .bib file (default: "references.bib")'),
  },
  async ({ bibtex, bibFile }) => {
    try {
      const targetFile = bibFile || 'references.bib';
      const bibPath = resolveInsideProject(targetFile);

      // Create .bib file if needed
      if (!fs.existsSync(bibPath)) {
        fs.writeFileSync(bibPath, '// Bibliography\n\n', 'utf-8');
      }

      // Append the entry
      let existing = fs.readFileSync(bibPath, 'utf-8');
      if (!existing.endsWith('\n')) existing += '\n';
      existing += '\n' + bibtex.trim() + '\n';
      fs.writeFileSync(bibPath, existing, 'utf-8');

      // Ensure #bibliography in document
      if (state.currentFile) {
        const docContent = fs.readFileSync(state.currentFile, 'utf-8');
        if (!docContent.includes('#bibliography')) {
          const updated = docContent.trimEnd() + `\n\n#bibliography("${targetFile}")\n`;
          fs.writeFileSync(state.currentFile, updated, 'utf-8');
        }
      }

      // Parse to get the citekey for confirmation
      const entries = parseBibFile(bibtex);
      const key = entries.length > 0 ? entries[0].citekey : '(unknown)';

      return {
        content: [{ type: 'text' as const, text: `Added citation @${key} to ${targetFile}` }],
      };
    } catch (err) {
      return { content: [{ type: 'text' as const, text: `Error: ${err}` }], isError: true };
    }
  },
);

// ─── Tool: vswrite_ensure_bibliography ───────────────

server.tool(
  'vswrite_ensure_bibliography',
  'Ensures the project has a references.bib file and the current document contains a #bibliography statement. Creates both if missing.',
  async () => {
    try {
      const dir = state.projectDir;
      const bibPath = path.join(dir, 'references.bib');
      const created: string[] = [];

      if (!fs.existsSync(bibPath)) {
        fs.writeFileSync(bibPath, '// Bibliography\n\n', 'utf-8');
        created.push('references.bib');
      }

      if (state.currentFile) {
        const content = fs.readFileSync(state.currentFile, 'utf-8');
        if (!content.includes('#bibliography')) {
          const updated = content.trimEnd() + '\n\n#bibliography("references.bib")\n';
          fs.writeFileSync(state.currentFile, updated, 'utf-8');
          created.push('#bibliography statement');
        }
      }

      if (created.length === 0) {
        return { content: [{ type: 'text' as const, text: 'Bibliography already set up.' }] };
      }
      return {
        content: [{ type: 'text' as const, text: `Created: ${created.join(', ')}` }],
      };
    } catch (err) {
      return { content: [{ type: 'text' as const, text: `Error: ${err}` }], isError: true };
    }
  },
);

// ─── Tool: vswrite_create_project ────────────────────

server.tool(
  'vswrite_create_project',
  'Create a new Typst project from a template (document | thesis | paper | letter | book | magazine).',
  {
    templateId: z.enum(['document', 'thesis', 'paper', 'letter', 'book', 'magazine']).describe('Template ID'),
    projectName: z.string().describe('Project name (becomes the folder name)'),
    parentDir: z.string().describe('Parent directory where the project folder will be created'),
  },
  async ({ templateId, projectName, parentDir }) => {
    try {
      const template = projectTemplates.find(t => t.id === templateId);
      if (!template) {
        return { content: [{ type: 'text' as const, text: `Error: Unknown template "${templateId}"` }], isError: true };
      }

      const absParent = path.isAbsolute(parentDir) ? parentDir : path.join(state.projectDir, parentDir);
      const projectDir = path.join(absParent, projectName);

      if (fs.existsSync(projectDir)) {
        return { content: [{ type: 'text' as const, text: `Error: Directory already exists: ${projectDir}` }], isError: true };
      }

      fs.mkdirSync(projectDir, { recursive: true });
      fs.mkdirSync(path.join(projectDir, 'assets'), { recursive: true });

      for (const [relPath, content] of Object.entries(template.files)) {
        const filePath = path.join(projectDir, relPath);
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(filePath, content, 'utf-8');
      }

      // Switch to new project
      state.projectDir = projectDir;
      state.currentFile = path.join(projectDir, 'main.typ');

      return {
        content: [{
          type: 'text' as const,
          text: `Created project "${projectName}" (${template.label}) at ${projectDir}\nFiles: ${Object.keys(template.files).join(', ')}`,
        }],
      };
    } catch (err) {
      return { content: [{ type: 'text' as const, text: `Error: ${err}` }], isError: true };
    }
  },
);

// ═══════════════════════════════════════════════════════
// Versions — high-level project history (mirrors the
// "Versionen" UI in ProjectPanel). All operations are
// local; nothing is ever pushed to a remote.
// ═══════════════════════════════════════════════════════

const GITIGNORE_REQUIRED_LINES = ['.vswrite/', '*.pdf'];

async function ensureGitRepo(dir: string): Promise<void> {
  const git = simpleGit(dir);
  const isRepo = await git.checkIsRepo();
  if (!isRepo) {
    await git.init();
    // Default to "main" — older Git versions still default to "master".
    try { await git.raw(['symbolic-ref', 'HEAD', 'refs/heads/main']); } catch {}
  }
  // Make sure .gitignore covers vswrite-local state so we don't accidentally
  // commit auto-backups or generated PDFs.
  const gitignorePath = path.join(dir, '.gitignore');
  let existing = '';
  if (fs.existsSync(gitignorePath)) {
    existing = fs.readFileSync(gitignorePath, 'utf-8');
  }
  const lines = existing.split('\n').map(l => l.trim());
  const missing = GITIGNORE_REQUIRED_LINES.filter(req => !lines.includes(req));
  if (missing.length === 0) return;
  const prefix = existing.length > 0 && !existing.endsWith('\n') ? '\n' : '';
  const addition = (existing.length === 0 ? '# vswrite\n' : prefix + '\n# vswrite\n') + missing.join('\n') + '\n';
  fs.writeFileSync(gitignorePath, existing + addition, 'utf-8');
}

interface DiffFileEntry {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  patch: string;
}

function parseUnifiedDiff(diff: string): DiffFileEntry[] {
  const result: DiffFileEntry[] = [];
  const fileChunks = diff.split(/^diff --git /m).slice(1);
  for (const chunk of fileChunks) {
    const lines = chunk.split('\n');
    const headerMatch = lines[0].match(/a\/(.+) b\/(.+)/);
    if (!headerMatch) continue;
    const filePath = headerMatch[2];
    let status: DiffFileEntry['status'] = 'modified';
    if (lines.some(l => l.startsWith('new file mode'))) status = 'added';
    else if (lines.some(l => l.startsWith('deleted file mode'))) status = 'deleted';
    else if (lines.some(l => l.startsWith('rename from'))) status = 'renamed';
    const hunkStart = lines.findIndex(l => l.startsWith('@@'));
    const patch = hunkStart >= 0 ? lines.slice(hunkStart).join('\n') : '';
    result.push({ path: filePath, status, patch });
  }
  return result;
}

function validateProjectRelPaths(files: string[]): string[] {
  const out: string[] = [];
  for (const f of files) {
    const abs = resolveInsideProject(f);
    out.push(path.relative(state.projectDir, abs));
  }
  return out;
}

// ─── Tool: vswrite_save_version ──────────────────────

server.tool(
  'vswrite_save_version',
  'Save a named version (Git commit, local-only). Auto-inits repo if missing. Returns { sha: null, skipped: true } if no changes.',
  {
    message: z.string().describe('Version description, e.g. "Chapter 3 first draft" or "Before supervisor feedback"'),
    files: z.array(z.string()).optional().describe('Restrict to these project-relative paths. Omit to include all changes.'),
  },
  async ({ message, files }) => {
    try {
      if (!state.projectDir) {
        return { content: [{ type: 'text' as const, text: 'Error: No project set. Call vswrite_set_project first.' }], isError: true };
      }
      await ensureGitRepo(state.projectDir);
      const git = simpleGit(state.projectDir);

      if (files && files.length > 0) {
        await git.add(validateProjectRelPaths(files));
      } else {
        await git.add('-A');
      }

      const status = await git.status();
      if (
        status.staged.length === 0 &&
        status.created.length === 0 &&
        status.deleted.length === 0 &&
        status.renamed.length === 0
      ) {
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({ sha: null, skipped: true, reason: 'No changes to save.' }, null, 2),
          }],
        };
      }

      const result = await git.commit(message || 'Untitled version');
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            sha: result.commit,
            message,
            changes: result.summary.changes,
            insertions: result.summary.insertions,
            deletions: result.summary.deletions,
          }, null, 2),
        }],
      };
    } catch (err) {
      return { content: [{ type: 'text' as const, text: `Error: ${err instanceof Error ? err.message : String(err)}` }], isError: true };
    }
  },
);

// ─── Tool: vswrite_list_versions ─────────────────────

server.tool(
  'vswrite_list_versions',
  'List version history (newest first, max 200). Returns { sha, message, date, author, isAuto }; isAuto = vswrite auto-versions.',
  async () => {
    try {
      if (!state.projectDir) {
        return { content: [{ type: 'text' as const, text: 'Error: No project set. Call vswrite_set_project first.' }], isError: true };
      }
      const git = simpleGit(state.projectDir);
      const isRepo = await git.checkIsRepo();
      if (!isRepo) {
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({ versions: [], note: 'No Git repo yet — call vswrite_save_version to create the first version.' }, null, 2),
          }],
        };
      }
      const log = await git.log({ '--max-count': 200 });
      const versions = log.all.map(c => ({
        sha: c.hash,
        message: c.message,
        date: c.date,
        author: c.author_name,
        isAuto: c.message.startsWith('[auto]'),
      }));
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(versions, null, 2) }],
      };
    } catch (err) {
      return { content: [{ type: 'text' as const, text: `Error: ${err instanceof Error ? err.message : String(err)}` }], isError: true };
    }
  },
);

// ─── Tool: vswrite_show_version ──────────────────────

server.tool(
  'vswrite_show_version',
  'Returns the per-file diff for a specific version. Each file entry: { path, status, patch } where status is "added" | "modified" | "deleted" | "renamed" and patch contains the unified diff hunks.',
  { sha: z.string().describe('Version id (full or abbreviated Git SHA, 4-40 hex characters) — get this from vswrite_list_versions') },
  async ({ sha }) => {
    try {
      if (!state.projectDir) {
        return { content: [{ type: 'text' as const, text: 'Error: No project set. Call vswrite_set_project first.' }], isError: true };
      }
      if (!/^[0-9a-f]{4,40}$/i.test(sha)) {
        return { content: [{ type: 'text' as const, text: `Error: Invalid version id "${sha}". Expected 4-40 hex characters.` }], isError: true };
      }
      const git = simpleGit(state.projectDir);
      const raw = await git.raw(['show', '--no-color', '--format=', sha]);
      const files = parseUnifiedDiff(raw);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ sha, files }, null, 2) }],
      };
    } catch (err) {
      return { content: [{ type: 'text' as const, text: `Error: ${err instanceof Error ? err.message : String(err)}` }], isError: true };
    }
  },
);

// ─── Tool: vswrite_restore_version ───────────────────

server.tool(
  'vswrite_restore_version',
  'Restore files from a historical version. **Destructive — call vswrite_save_version first** to preserve current state.',
  {
    sha: z.string().describe('Version id (Git SHA, 4-40 hex chars) — get this from vswrite_list_versions'),
    files: z.array(z.string()).optional().describe('Restrict restore to these project-relative paths. Omit to restore everything from that version.'),
  },
  async ({ sha, files }) => {
    try {
      if (!state.projectDir) {
        return { content: [{ type: 'text' as const, text: 'Error: No project set. Call vswrite_set_project first.' }], isError: true };
      }
      if (!/^[0-9a-f]{4,40}$/i.test(sha)) {
        return { content: [{ type: 'text' as const, text: `Error: Invalid version id "${sha}". Expected 4-40 hex characters.` }], isError: true };
      }
      const git = simpleGit(state.projectDir);

      if (files && files.length > 0) {
        const validated = validateProjectRelPaths(files);
        await git.raw(['checkout', sha, '--', ...validated]);
      } else {
        await git.raw(['checkout', sha, '--', '.']);
      }

      return {
        content: [{
          type: 'text' as const,
          text: `Restored ${files && files.length > 0 ? `${files.length} file(s)` : 'all files'} from version ${sha.slice(0, 7)}.`,
        }],
      };
    } catch (err) {
      return { content: [{ type: 'text' as const, text: `Error: ${err instanceof Error ? err.message : String(err)}` }], isError: true };
    }
  },
);

// ─── Tool: vswrite_git_status ────────────────────────

server.tool(
  'vswrite_git_status',
  'Returns git status of the project: branch name, ahead/behind counts, and list of changed files.',
  async () => {
    try {
      const git = simpleGit(state.projectDir);
      const status = await git.status();
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            branch: status.current,
            ahead: status.ahead,
            behind: status.behind,
            isClean: status.isClean(),
            files: status.files.map(f => ({ path: f.path, status: f.working_dir + f.index })),
          }, null, 2),
        }],
      };
    } catch (err) {
      return { content: [{ type: 'text' as const, text: `Error: ${err}` }], isError: true };
    }
  },
);

// ─── Tool: vswrite_git_commit ────────────────────────

server.tool(
  'vswrite_git_commit',
  'Stages all changes and creates a git commit with the given message.',
  {
    message: z.string().describe('Commit message'),
    stageAll: z.boolean().default(true).describe('Stage all changes before committing'),
  },
  async ({ message, stageAll }) => {
    try {
      const git = simpleGit(state.projectDir);
      if (stageAll) {
        await git.add('-A');
      }
      const result = await git.commit(message);
      return {
        content: [{
          type: 'text' as const,
          text: `Committed: ${result.summary.changes} changes, ${result.summary.insertions} insertions, ${result.summary.deletions} deletions\nHash: ${result.commit}`,
        }],
      };
    } catch (err) {
      return { content: [{ type: 'text' as const, text: `Error: ${err}` }], isError: true };
    }
  },
);

// ─── Tool: vswrite_git_push ──────────────────────────

server.tool(
  'vswrite_git_push',
  'Pushes committed changes to the remote repository.',
  async () => {
    try {
      const git = simpleGit(state.projectDir);
      await git.push();
      return {
        content: [{ type: 'text' as const, text: 'Pushed to remote.' }],
      };
    } catch (err) {
      return { content: [{ type: 'text' as const, text: `Error: ${err}` }], isError: true };
    }
  },
);

// ═══════════════════════════════════════════════════════
// Writer Features — Comments, Cross-References, Footnotes
// (mirrors the Sessions 12-15 features in the renderer)
// ═══════════════════════════════════════════════════════

/**
 * Locates `anchor` in `content` and returns the offset of the requested
 * occurrence. Used by add_comment / insert_reference / add_footnote so
 * agents can specify "the place where this exact text appears" without
 * having to compute offsets themselves.
 */
function findAnchorOffset(
  content: string,
  anchor: string,
  occurrence: number | undefined,
  label: string = 'anchor',
): { offset: number } | { error: string } {
  if (!anchor) {
    return { error: `${label} cannot be empty.` };
  }
  const occurrences: number[] = [];
  let idx = 0;
  while ((idx = content.indexOf(anchor, idx)) !== -1) {
    occurrences.push(idx);
    idx += anchor.length;
  }
  if (occurrences.length === 0) {
    const preview = anchor.length > 60 ? anchor.slice(0, 60) + '…' : anchor;
    return { error: `${label} "${preview}" not found in file.` };
  }
  if (occurrences.length > 1 && occurrence === undefined) {
    return {
      error: `${label} appears ${occurrences.length} times in the file. Specify "occurrence" (1-${occurrences.length}) to disambiguate.`,
    };
  }
  const occIdx = (occurrence ?? 1) - 1;
  if (occIdx < 0 || occIdx >= occurrences.length) {
    return { error: `Invalid occurrence ${occurrence}. Valid range: 1-${occurrences.length}.` };
  }
  return { offset: occurrences[occIdx] };
}

// ─── Tool: vswrite_list_comments ─────────────────────

server.tool(
  'vswrite_list_comments',
  'List comments in the project (lives as .md files in comments/, never compiled). Returns { id, file, anchor, body, resolved, orphaned } per entry; orphaned = anchor text was edited away.',
  {
    file: z.string().optional().describe('Project-relative path to filter by (e.g. "chapters/03-method.typ"). Omit for all files.'),
    includeResolved: z.boolean().optional().describe('Include resolved comments. Default: false.'),
  },
  async ({ file, includeResolved }) => {
    try {
      if (!state.projectDir) {
        return { content: [{ type: 'text' as const, text: 'Error: No project set. Call vswrite_set_project first.' }], isError: true };
      }
      const comments = listComments(state.projectDir, {
        forFile: file,
        includeResolved: includeResolved ?? false,
      });
      // Strip absolute filePath from output — agents only need project-relative info.
      const slim = comments.map(({ filePath: _filePath, ...rest }) => rest);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(slim, null, 2) }],
      };
    } catch (err) {
      return { content: [{ type: 'text' as const, text: `Error: ${err instanceof Error ? err.message : String(err)}` }], isError: true };
    }
  },
);

// ─── Tool: vswrite_add_comment ───────────────────────

server.tool(
  'vswrite_add_comment',
  'Create a comment anchored to a verbatim text snippet (whitespace-exact, single-paragraph). Renders as yellow highlight in vswrite; never compiled.',
  {
    file: z.string().describe('Project-relative path of the file to anchor the comment to (e.g. "chapters/01-introduction.typ")'),
    anchor: z.string().describe('Exact verbatim text in the file the comment is attached to. Whitespace-sensitive. Should be specific enough to be unique within the file.'),
    body: z.string().describe('Comment body (Markdown allowed: lists, links, code).'),
    occurrence: z.number().int().min(1).optional().describe('1-based index of the anchor occurrence to use, if it appears multiple times.'),
    author: z.string().optional().describe('Comment author. Default: "MCP Agent".'),
  },
  async ({ file, anchor, body, occurrence, author }) => {
    try {
      if (!state.projectDir) {
        return { content: [{ type: 'text' as const, text: 'Error: No project set. Call vswrite_set_project first.' }], isError: true };
      }
      const absFile = resolveInsideProject(file);
      if (!fs.existsSync(absFile)) {
        return { content: [{ type: 'text' as const, text: `Error: File not found: ${file}` }], isError: true };
      }

      const content = fs.readFileSync(absFile, 'utf-8');
      const located = findAnchorOffset(content, anchor, occurrence, 'Anchor');
      if ('error' in located) {
        return { content: [{ type: 'text' as const, text: `Error: ${located.error}` }], isError: true };
      }

      const relPath = path.relative(state.projectDir, absFile).replace(/\\/g, '/');
      const created = createComment(state.projectDir, {
        file: relPath,
        anchor,
        rangeStart: located.offset,
        rangeEnd: located.offset + anchor.length,
        body,
        author: author ?? 'MCP Agent',
      });
      if (!created) {
        return { content: [{ type: 'text' as const, text: 'Error: Failed to create comment.' }], isError: true };
      }
      const { filePath: _filePath, ...slim } = created;
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(slim, null, 2) }],
      };
    } catch (err) {
      return { content: [{ type: 'text' as const, text: `Error: ${err instanceof Error ? err.message : String(err)}` }], isError: true };
    }
  },
);

// ─── Tool: vswrite_resolve_comment ───────────────────

server.tool(
  'vswrite_resolve_comment',
  'Marks a comment as resolved (or unresolved). Resolved comments are hidden from the comments panel by default but remain in the project until explicitly deleted.',
  {
    id: z.string().describe('Comment id (e.g. "2026-04-28-1432-a3f")'),
    resolved: z.boolean().optional().describe('Resolution state. Default: true.'),
  },
  async ({ id, resolved }) => {
    try {
      if (!state.projectDir) {
        return { content: [{ type: 'text' as const, text: 'Error: No project set. Call vswrite_set_project first.' }], isError: true };
      }
      const updated = updateComment(state.projectDir, id, { resolved: resolved ?? true });
      if (!updated) {
        return { content: [{ type: 'text' as const, text: `Error: Comment "${id}" not found.` }], isError: true };
      }
      return {
        content: [{ type: 'text' as const, text: `Comment ${id} marked as ${updated.resolved ? 'resolved' : 'open'}.` }],
      };
    } catch (err) {
      return { content: [{ type: 'text' as const, text: `Error: ${err instanceof Error ? err.message : String(err)}` }], isError: true };
    }
  },
);

// ─── Tool: vswrite_delete_comment ────────────────────

server.tool(
  'vswrite_delete_comment',
  'Permanently deletes a comment (removes its .md file from comments/). Use vswrite_resolve_comment instead if you only want to hide it.',
  { id: z.string().describe('Comment id') },
  async ({ id }) => {
    try {
      if (!state.projectDir) {
        return { content: [{ type: 'text' as const, text: 'Error: No project set. Call vswrite_set_project first.' }], isError: true };
      }
      const ok = deleteComment(state.projectDir, id);
      if (!ok) {
        return { content: [{ type: 'text' as const, text: `Error: Comment "${id}" not found.` }], isError: true };
      }
      return { content: [{ type: 'text' as const, text: `Comment ${id} deleted.` }] };
    } catch (err) {
      return { content: [{ type: 'text' as const, text: `Error: ${err instanceof Error ? err.message : String(err)}` }], isError: true };
    }
  },
);

// ─── Tool: vswrite_list_labels ───────────────────────

server.tool(
  'vswrite_list_labels',
  'List all <label>s in the project, classified by type (figure / table / equation / heading / other) from prefix. Call before insert_reference to avoid guessing. Capped at 2000.',
  {
    type: z.enum(['figure', 'table', 'equation', 'heading', 'other']).optional().describe('Filter by label type. Omit for all types.'),
  },
  async ({ type }) => {
    try {
      if (!state.projectDir) {
        return { content: [{ type: 'text' as const, text: 'Error: No project set. Call vswrite_set_project first.' }], isError: true };
      }
      const result = listProjectLabels(state.projectDir);
      const filtered = type ? result.labels.filter(l => l.type === (type as LabelType)) : result.labels;
      // Strip absolute filePath — relPath is what agents need.
      const slim = filtered.map(({ filePath: _filePath, ...rest }) => rest);
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({ labels: slim, truncated: result.truncated }, null, 2),
        }],
      };
    } catch (err) {
      return { content: [{ type: 'text' as const, text: `Error: ${err instanceof Error ? err.message : String(err)}` }], isError: true };
    }
  },
);

// ─── Tool: vswrite_insert_reference ──────────────────

server.tool(
  'vswrite_insert_reference',
  'Insert a Typst cross-reference (@label) at an anchor. Validates label exists (call vswrite_list_labels first); auto-inserts a leading space if needed so Typst doesn\'t glue it to the previous word.',
  {
    file: z.string().describe('Project-relative path of the file (e.g. "chapters/05-discussion.typ")'),
    afterText: z.string().describe('Verbatim text after which "@label" is inserted. Whitespace-sensitive.'),
    label: z.string().describe('Label name without "@" or angle brackets, e.g. "fig:scaling". Must exist in the project — see vswrite_list_labels.'),
    occurrence: z.number().int().min(1).optional().describe('1-based occurrence of afterText if it appears multiple times.'),
  },
  async ({ file, afterText, label, occurrence }) => {
    try {
      if (!state.projectDir) {
        return { content: [{ type: 'text' as const, text: 'Error: No project set. Call vswrite_set_project first.' }], isError: true };
      }
      const absFile = resolveInsideProject(file);
      if (!fs.existsSync(absFile)) {
        return { content: [{ type: 'text' as const, text: `Error: File not found: ${file}` }], isError: true };
      }

      // Validate the label exists. Suggest similar labels on miss.
      const all = listProjectLabels(state.projectDir);
      const exists = all.labels.find(l => l.label === label);
      if (!exists) {
        const lower = label.toLowerCase();
        const suggestions = all.labels
          .map(l => l.label)
          .filter(l => l.toLowerCase().includes(lower) || lower.includes(l.toLowerCase()))
          .slice(0, 5);
        const hint = suggestions.length > 0 ? `\nSimilar labels: ${suggestions.join(', ')}` : '';
        return {
          content: [{
            type: 'text' as const,
            text: `Error: Label "${label}" not found in project.${hint}\nUse vswrite_list_labels to see all labels.`,
          }],
          isError: true,
        };
      }

      const content = fs.readFileSync(absFile, 'utf-8');
      const located = findAnchorOffset(content, afterText, occurrence, 'afterText');
      if ('error' in located) {
        return { content: [{ type: 'text' as const, text: `Error: ${located.error}` }], isError: true };
      }
      const insertPos = located.offset + afterText.length;

      // Auto-prepend a space if the preceding char is alphanumeric — Typst would
      // otherwise parse "word@label" as a single content unit and not as a ref.
      const prevChar = insertPos > 0 ? content[insertPos - 1] : '';
      const needsSpace = /[\p{L}\p{N}]/u.test(prevChar);
      const refText = (needsSpace ? ' ' : '') + `@${label}`;
      const updated = content.slice(0, insertPos) + refText + content.slice(insertPos);

      fs.writeFileSync(absFile, updated, 'utf-8');

      return {
        content: [{
          type: 'text' as const,
          text: `Inserted "${refText}" into ${file} at offset ${insertPos}. Run vswrite_compile to verify the cross-reference resolves.`,
        }],
      };
    } catch (err) {
      return { content: [{ type: 'text' as const, text: `Error: ${err instanceof Error ? err.message : String(err)}` }], isError: true };
    }
  },
);

// ─── Tool: vswrite_add_footnote ──────────────────────

server.tool(
  'vswrite_add_footnote',
  'Insert a Typst footnote (#footnote[<body>]) at an anchor. Body may contain inline Typst (italic, citations); brackets must balance.',
  {
    file: z.string().describe('Project-relative path of the file (e.g. "chapters/03-method.typ")'),
    afterText: z.string().describe('Verbatim text after which the footnote is inserted. Whitespace-sensitive. Convention: place directly after the punctuation or word that the footnote applies to.'),
    body: z.string().describe('Footnote body (Typst markup allowed)'),
    occurrence: z.number().int().min(1).optional().describe('1-based occurrence of afterText if it appears multiple times.'),
  },
  async ({ file, afterText, body, occurrence }) => {
    try {
      if (!state.projectDir) {
        return { content: [{ type: 'text' as const, text: 'Error: No project set. Call vswrite_set_project first.' }], isError: true };
      }
      const absFile = resolveInsideProject(file);
      if (!fs.existsSync(absFile)) {
        return { content: [{ type: 'text' as const, text: `Error: File not found: ${file}` }], isError: true };
      }

      // Bracket-balance check on the body — unbalanced [...] would break the Typst parse.
      let depth = 0;
      for (let i = 0; i < body.length; i++) {
        const ch = body[i];
        // Skip escaped brackets
        if (ch === '\\' && i + 1 < body.length) { i++; continue; }
        if (ch === '[') depth++;
        else if (ch === ']') depth--;
        if (depth < 0) {
          return {
            content: [{ type: 'text' as const, text: 'Error: Footnote body has an unmatched "]". Brackets must be balanced — escape with "\\[" / "\\]" if a literal bracket is needed.' }],
            isError: true,
          };
        }
      }
      if (depth !== 0) {
        return {
          content: [{ type: 'text' as const, text: `Error: Footnote body has ${depth} unmatched "[". Brackets must be balanced.` }],
          isError: true,
        };
      }

      const content = fs.readFileSync(absFile, 'utf-8');
      const located = findAnchorOffset(content, afterText, occurrence, 'afterText');
      if ('error' in located) {
        return { content: [{ type: 'text' as const, text: `Error: ${located.error}` }], isError: true };
      }
      const insertPos = located.offset + afterText.length;
      const footnoteText = `#footnote[${body}]`;
      const updated = content.slice(0, insertPos) + footnoteText + content.slice(insertPos);

      fs.writeFileSync(absFile, updated, 'utf-8');

      return {
        content: [{
          type: 'text' as const,
          text: `Inserted footnote into ${file} at offset ${insertPos}.`,
        }],
      };
    } catch (err) {
      return { content: [{ type: 'text' as const, text: `Error: ${err instanceof Error ? err.message : String(err)}` }], isError: true };
    }
  },
);

// ═══════════════════════════════════════════════════════
// Discovery — project-wide search & source lookup
// ═══════════════════════════════════════════════════════

// ─── Tool: vswrite_search_project ────────────────────

server.tool(
  'vswrite_search_project',
  'Search across .typ files (optionally .bib) with regex / case / whole-word options; returns matches grouped by file. Whole-word uses lookarounds so it works for @citekey backlinks. Capped at 1000 hits.',
  {
    query: z.string().describe('Search term. Plain text by default; set regex=true for a regular expression.'),
    caseSensitive: z.boolean().optional().describe('Match case. Default: false.'),
    wholeWord: z.boolean().optional().describe('Match whole words only (uses lookarounds, not \\b). Default: false.'),
    regex: z.boolean().optional().describe('Treat query as a regular expression. Default: false.'),
    includeBib: z.boolean().optional().describe('Search .bib files too. Default: false (only .typ).'),
  },
  async ({ query, caseSensitive, wholeWord, regex, includeBib }) => {
    try {
      if (!state.projectDir) {
        return { content: [{ type: 'text' as const, text: 'Error: No project set. Call vswrite_set_project first.' }], isError: true };
      }
      const result = searchProject({
        query,
        caseSensitive: caseSensitive ?? false,
        wholeWord: wholeWord ?? false,
        regex: regex ?? false,
        includeBib: includeBib ?? false,
      }, state.projectDir);
      // Strip absolute filePath, agents work in project-relative terms.
      const slim = {
        ...result,
        files: result.files.map(({ filePath: _filePath, ...rest }) => rest),
      };
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(slim, null, 2) }],
      };
    } catch (err) {
      return { content: [{ type: 'text' as const, text: `Error: ${err instanceof Error ? err.message : String(err)}` }], isError: true };
    }
  },
);

// ─── Tool: vswrite_replace_in_project ────────────────

server.tool(
  'vswrite_replace_in_project',
  'Replace all matches of a query across project files. **Destructive — call vswrite_save_version first.** Returns { filesChanged, totalReplacements }.',
  {
    query: z.string().describe('Search term'),
    replacement: z.string().describe('Replacement text. For regex mode, $1, $2 etc. backreferences are honored.'),
    caseSensitive: z.boolean().optional().describe('Default: false.'),
    wholeWord: z.boolean().optional().describe('Default: false.'),
    regex: z.boolean().optional().describe('Default: false.'),
    includeBib: z.boolean().optional().describe('Default: false.'),
  },
  async ({ query, replacement, caseSensitive, wholeWord, regex, includeBib }) => {
    try {
      if (!state.projectDir) {
        return { content: [{ type: 'text' as const, text: 'Error: No project set. Call vswrite_set_project first.' }], isError: true };
      }
      const result = replaceInProject({
        query,
        replacement,
        caseSensitive: caseSensitive ?? false,
        wholeWord: wholeWord ?? false,
        regex: regex ?? false,
        includeBib: includeBib ?? false,
      }, state.projectDir);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    } catch (err) {
      return { content: [{ type: 'text' as const, text: `Error: ${err instanceof Error ? err.message : String(err)}` }], isError: true };
    }
  },
);

// ─── Tool: vswrite_find_source_for_citation ──────────

server.tool(
  'vswrite_find_source_for_citation',
  'Find a PDF in sources/ matching a BibTeX citekey. Exact `<citekey>.pdf` preferred, suffix variants accepted. Returns project-relative path or null.',
  { citekey: z.string().describe('BibTeX citation key (e.g. "chen2021codex")') },
  async ({ citekey }) => {
    try {
      if (!state.projectDir) {
        return { content: [{ type: 'text' as const, text: 'Error: No project set. Call vswrite_set_project first.' }], isError: true };
      }
      const abs = findSourceForCitation(state.projectDir, citekey);
      if (!abs) {
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ found: false, citekey }, null, 2) }],
        };
      }
      const rel = path.relative(state.projectDir, abs).replace(/\\/g, '/');
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({ found: true, citekey, relPath: rel }, null, 2),
        }],
      };
    } catch (err) {
      return { content: [{ type: 'text' as const, text: `Error: ${err instanceof Error ? err.message : String(err)}` }], isError: true };
    }
  },
);

// ═══════════════════════════════════════════════════════
// Import / Export & Asset Management
// ═══════════════════════════════════════════════════════

// ─── Tool: vswrite_export_docx ───────────────────────

server.tool(
  'vswrite_export_docx',
  'Export the current document as DOCX with real Word styles + live multilevel numbering. Multi-chapter projects are merged. Output path must be inside the project (convention: exports/<name>.docx).',
  { outputPath: z.string().describe('Path for the DOCX output, relative to the project (e.g. "exports/thesis.docx")') },
  async ({ outputPath }) => {
    try {
      const { filePath } = readCurrentDocument();
      const rootFile = findRootFile(filePath);
      const rootDir = path.dirname(rootFile);
      const absOutput = resolveInsideProject(outputPath);

      const outDir = path.dirname(absOutput);
      if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
      }

      const mergedContent = resolveIncludes(rootFile);
      const doc = deserializeTypst(mergedContent);
      const style = readProjectStyle(rootDir);
      const buffer = await serializeDocx(doc, rootDir, mergedContent, style, {
        renderTypstSnippet: createMcpSnippetRenderer(rootDir),
      });
      fs.writeFileSync(absOutput, buffer);

      const stat = fs.statSync(absOutput);
      return {
        content: [{
          type: 'text' as const,
          text: `DOCX exported to ${absOutput} (${(stat.size / 1024).toFixed(1)} KB)`,
        }],
      };
    } catch (err) {
      return { content: [{ type: 'text' as const, text: `Export failed: ${err instanceof Error ? err.message : String(err)}` }], isError: true };
    }
  },
);

// ─── Tool: vswrite_import_markdown ───────────────────

server.tool(
  'vswrite_import_markdown',
  'Convert Markdown to Typst and write to a project file. Provide inline `markdown` OR a `srcPath` (.md file). Errors if destPath exists unless `overwrite: true`.',
  {
    markdown: z.string().optional().describe('Inline Markdown text. Mutually exclusive with srcPath.'),
    srcPath: z.string().optional().describe('Path to a .md / .markdown / .txt file to import. May be inside or outside the project (read-only). Mutually exclusive with markdown.'),
    destPath: z.string().describe('Project-relative path for the new .typ file (e.g. "chapters/06-related.typ")'),
    overwrite: z.boolean().optional().describe('Overwrite destPath if it already exists. Default: false.'),
  },
  async ({ markdown, srcPath, destPath, overwrite }) => {
    try {
      if (!state.projectDir) {
        return { content: [{ type: 'text' as const, text: 'Error: No project set. Call vswrite_set_project first.' }], isError: true };
      }
      if ((markdown === undefined) === (srcPath === undefined)) {
        return { content: [{ type: 'text' as const, text: 'Error: Provide exactly one of `markdown` or `srcPath`.' }], isError: true };
      }

      let mdContent: string;
      if (srcPath !== undefined) {
        const absSrc = path.isAbsolute(srcPath) ? srcPath : path.join(state.projectDir, srcPath);
        if (!fs.existsSync(absSrc)) {
          return { content: [{ type: 'text' as const, text: `Error: Source file not found: ${srcPath}` }], isError: true };
        }
        mdContent = fs.readFileSync(absSrc, 'utf-8');
      } else {
        mdContent = markdown!;
      }

      const absDest = resolveInsideProject(destPath);
      if (fs.existsSync(absDest) && !overwrite) {
        return { content: [{ type: 'text' as const, text: `Error: Destination already exists: ${destPath}. Set overwrite=true to replace it.` }], isError: true };
      }

      const typstContent = markdownToTypst(mdContent);

      const destDir = path.dirname(absDest);
      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }
      fs.writeFileSync(absDest, typstContent, 'utf-8');

      return {
        content: [{
          type: 'text' as const,
          text: `Imported Markdown to ${destPath} (${typstContent.length} characters). Review the output — complex Markdown constructs may need manual adjustment.`,
        }],
      };
    } catch (err) {
      return { content: [{ type: 'text' as const, text: `Error: ${err instanceof Error ? err.message : String(err)}` }], isError: true };
    }
  },
);

// ─── Tool: vswrite_add_image ─────────────────────────

server.tool(
  'vswrite_add_image',
  'Import image into assets/ (content-hash dedup), build a Typst snippet (optionally wrapped in #figure with caption + label), and optionally insert at an anchor in one round-trip.',
  {
    srcPath: z.string().describe('Absolute or project-relative path to the source image file (PNG, JPG, SVG, …)'),
    width: z.string().optional().describe('Typst width spec, e.g. "80%", "8cm", "300pt". Default: "100%".'),
    alt: z.string().optional().describe('Alt text for accessibility / hover.'),
    caption: z.string().optional().describe('Wraps the image in #figure(...) with this caption. Required if you want the figure cross-referenceable.'),
    label: z.string().optional().describe('Typst label like "fig:my-chart". Only used together with caption. Use the "fig:" prefix so vswrite picks it up as a figure reference.'),
    file: z.string().optional().describe('Project-relative file to insert the snippet into. If set, afterText is required.'),
    afterText: z.string().optional().describe('Anchor text for inline insertion. Required when `file` is set.'),
    occurrence: z.number().int().min(1).optional().describe('1-based occurrence of afterText.'),
  },
  async ({ srcPath, width, alt, caption, label, file, afterText, occurrence }) => {
    try {
      if (!state.projectDir) {
        return { content: [{ type: 'text' as const, text: 'Error: No project set. Call vswrite_set_project first.' }], isError: true };
      }
      if (file !== undefined && afterText === undefined) {
        return { content: [{ type: 'text' as const, text: 'Error: When `file` is set, `afterText` is required for the anchor.' }], isError: true };
      }
      if (label && !caption) {
        return { content: [{ type: 'text' as const, text: 'Error: `label` requires `caption` (Typst labels must attach to a #figure block).' }], isError: true };
      }

      const absSrc = path.isAbsolute(srcPath) ? srcPath : path.join(state.projectDir, srcPath);
      if (!fs.existsSync(absSrc)) {
        return { content: [{ type: 'text' as const, text: `Error: Source image not found: ${srcPath}` }], isError: true };
      }
      if (!fs.statSync(absSrc).isFile()) {
        return { content: [{ type: 'text' as const, text: `Error: Source path is not a file: ${srcPath}` }], isError: true };
      }

      // Place asset with content-based deduplication.
      const assetsDir = path.join(state.projectDir, 'assets');
      if (!fs.existsSync(assetsDir)) {
        fs.mkdirSync(assetsDir, { recursive: true });
      }
      const ext = path.extname(absSrc);
      const stem = path.basename(absSrc, ext);
      const srcBuf = fs.readFileSync(absSrc);
      let assetName = `${stem}${ext}`;
      let assetAbs = path.join(assetsDir, assetName);
      let counter = 2;
      while (fs.existsSync(assetAbs)) {
        const existing = fs.readFileSync(assetAbs);
        if (existing.equals(srcBuf)) break; // same content — reuse
        assetName = `${stem}-${counter}${ext}`;
        assetAbs = path.join(assetsDir, assetName);
        counter++;
      }
      if (!fs.existsSync(assetAbs)) {
        fs.writeFileSync(assetAbs, srcBuf);
      }
      const assetRel = `assets/${assetName}`;

      // Build the Typst snippet.
      const widthSpec = width ?? '100%';
      const altPart = alt ? `, alt: "${alt.replace(/"/g, '\\"')}"` : '';
      const imageCall = `image("${assetRel}", width: ${widthSpec}${altPart})`;
      let snippet: string;
      if (caption) {
        const captionEsc = caption.replace(/\\/g, '\\\\').replace(/]/g, '\\]');
        const labelPart = label ? ` <${label}>` : '';
        snippet = `#figure(${imageCall}, caption: [${captionEsc}])${labelPart}`;
      } else {
        snippet = `#${imageCall}`;
      }

      // Optional inline insert.
      if (file && afterText) {
        const absFile = resolveInsideProject(file);
        if (!fs.existsSync(absFile)) {
          return { content: [{ type: 'text' as const, text: `Error: File not found: ${file}` }], isError: true };
        }
        const content = fs.readFileSync(absFile, 'utf-8');
        const located = findAnchorOffset(content, afterText, occurrence, 'afterText');
        if ('error' in located) {
          return { content: [{ type: 'text' as const, text: `Error: ${located.error}` }], isError: true };
        }
        const insertPos = located.offset + afterText.length;
        // Figures are block-level — wrap with blank lines so they don't glue onto surrounding paragraphs.
        const updated = content.slice(0, insertPos) + '\n\n' + snippet + '\n\n' + content.slice(insertPos);
        fs.writeFileSync(absFile, updated, 'utf-8');
        return {
          content: [{
            type: 'text' as const,
            text: `Asset placed at ${assetRel}. Inserted figure into ${file} at offset ${insertPos}.`,
          }],
        };
      }

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            assetPath: assetRel,
            snippet,
            note: 'Pass {file, afterText} on the next call for inline insertion, or use vswrite_update_document / vswrite_write_file manually.',
          }, null, 2),
        }],
      };
    } catch (err) {
      return { content: [{ type: 'text' as const, text: `Error: ${err instanceof Error ? err.message : String(err)}` }], isError: true };
    }
  },
);

// ─── License Validation ─────────────────────────────

async function validateProLicense(): Promise<boolean> {
  if (!state.licenseKey) return false;
  if (!state.licenseKey.startsWith('VSWRITE_PRO')) return false;

  try {
    const response = await fetch('https://api.polar.sh/v1/customer-portal/license-keys/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key: state.licenseKey,
        organization_id: POLAR_ORG_ID,
      }),
    });
    if (!response.ok) return false;
    const data = await response.json() as { status: string };
    return data.status === 'granted';
  } catch {
    // Offline — allow if key has Pro prefix (trust locally)
    return true;
  }
}

// ─── Start Server ────────────────────────────────────

async function main() {
  parseArgs();

  // Validate Pro license for MCP access
  state.licenseValidated = await validateProLicense();
  if (!state.licenseValidated) {
    console.error(
      'vswrite MCP Server requires a Pro license.\n' +
      'Provide your key via --license-key VSWRITE_PRO_xxx or PENWRIGHT_LICENSE_KEY env var.\n' +
      'Get a Pro license at https://vswrite.com/pricing'
    );
    process.exit(1);
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error('vswrite MCP server failed to start:', err);
  process.exit(1);
});
