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
import { execFile } from 'child_process';
import { promisify } from 'util';
import { parseSettings, applySettings, generateSetBlocks, type DocumentSettings } from '../shared/settingsParser.js';
import { findRootFile } from '../shared/rootFinder.js';
import { styleTemplates } from '../shared/styleTemplates.js';
import { parseBibFile } from '../shared/bibParser.js';
import { resolveIncludes } from '../shared/mergeDocument.js';
import { splitIntoChapters, slugify } from '../shared/splitDocument.js';
import { templates as projectTemplates } from '../shared/projectTemplates.js';
import simpleGit from 'simple-git';

const execFileAsync = promisify(execFile);

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
  if (!state.licenseKey && process.env.VSWRITE_LICENSE_KEY) {
    state.licenseKey = process.env.VSWRITE_LICENSE_KEY;
  }

  // Fallback: env var
  if (!state.projectDir && process.env.VSWRITE_PROJECT_DIR) {
    state.projectDir = path.resolve(process.env.VSWRITE_PROJECT_DIR);
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

// ─── Server Setup ────────────────────────────────────

const server = new McpServer({
  name: 'vswrite',
  version: '0.5.0',
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
    const absPath = path.isAbsolute(filePath) ? filePath : path.join(state.projectDir, filePath);
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
  'Compiles the current Typst document. Returns compilation errors if any, or success with details. Automatically finds the root file for chapter-based projects.',
  {
    format: z.enum(['svg', 'pdf']).default('pdf').describe('Output format'),
    outputPath: z.string().optional().describe('Output file path (optional, defaults to temp file)'),
  },
  async ({ format, outputPath }) => {
    try {
      const { filePath } = readCurrentDocument();
      const rootFile = findRootFile(filePath);
      const dir = path.dirname(rootFile);
      const ext = format === 'pdf' ? 'pdf' : 'svg';
      const outPath = outputPath
        ? (path.isAbsolute(outputPath) ? outputPath : path.join(state.projectDir, outputPath))
        : path.join(dir, `.vswrite-compile-output.${ext}`);

      const args = ['compile', rootFile, outPath];
      if (format === 'svg') {
        args.push('--format', 'svg');
      }

      try {
        await execFileAsync('typst', args, { cwd: dir, timeout: 30000 });

        const stat = fs.statSync(outPath);
        const result: Record<string, unknown> = {
          success: true,
          format,
          outputPath: outPath,
          rootFile,
          sizeBytes: stat.size,
        };

        // Clean up temp file if no explicit output path
        if (!outputPath) {
          try { fs.unlinkSync(outPath); } catch {}
          delete result.outputPath;
        }

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (compileErr: unknown) {
        const stderr = (compileErr as { stderr?: string }).stderr || String(compileErr);
        const errors = parseCompileErrors(stderr);
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: false,
              rootFile,
              errors,
            }, null, 2),
          }],
        };
      }
    } catch (err) {
      return { content: [{ type: 'text' as const, text: `Error: ${err}` }], isError: true };
    }
  },
);

function parseCompileErrors(stderr: string): { message: string; line?: number }[] {
  const errors: { message: string; line?: number }[] = [];
  for (const line of stderr.split('\n')) {
    const match = line.match(/error:?\s*(.*)/i);
    if (match) {
      const lineMatch = line.match(/:(\d+):/);
      errors.push({
        message: match[1],
        line: lineMatch ? parseInt(lineMatch[1]) : undefined,
      });
    }
  }
  return errors;
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
  'Updates document settings (#set blocks) in the current Typst file. Only include settings you want to change — unset fields keep their current value. Valid keys: font, fontSize, lang, paper, margin, pageNumbering, pageHeader, pageFooter, columns, pageFill, leading, spacing, firstLineIndent, headingNumbering, bibliographyStyle.',
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
    const absPath = path.isAbsolute(filePath) ? filePath : path.join(state.projectDir, filePath);
    if (!fs.existsSync(absPath)) {
      return { content: [{ type: 'text' as const, text: `Error: File not found: ${absPath}` }], isError: true };
    }
    try {
      const content = fs.readFileSync(absPath, 'utf-8');
      return { content: [{ type: 'text' as const, text: content }] };
    } catch {
      return { content: [{ type: 'text' as const, text: `Error: Cannot read file as text: ${absPath}` }], isError: true };
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
    const absPath = path.isAbsolute(filePath) ? filePath : path.join(state.projectDir, filePath);
    try {
      const dir = path.dirname(absPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(absPath, content, 'utf-8');
      return {
        content: [{ type: 'text' as const, text: `Written ${path.basename(absPath)} (${content.length} bytes)` }],
      };
    } catch (err) {
      return { content: [{ type: 'text' as const, text: `Error: ${err}` }], isError: true };
    }
  },
);

// ─── Tool: vswrite_export_pdf ────────────────────────

server.tool(
  'vswrite_export_pdf',
  'Compiles the current Typst document and exports it as PDF. Returns the output path on success.',
  { outputPath: z.string().describe('Absolute path for the PDF output file') },
  async ({ outputPath }) => {
    try {
      const { filePath } = readCurrentDocument();
      const rootFile = findRootFile(filePath);
      const dir = path.dirname(rootFile);
      const absOutput = path.isAbsolute(outputPath) ? outputPath : path.join(state.projectDir, outputPath);

      await execFileAsync('typst', ['compile', rootFile, absOutput], { cwd: dir, timeout: 30000 });
      const stat = fs.statSync(absOutput);

      return {
        content: [{
          type: 'text' as const,
          text: `PDF exported to ${absOutput} (${(stat.size / 1024).toFixed(1)} KB)`,
        }],
      };
    } catch (err: unknown) {
      const stderr = (err as { stderr?: string }).stderr || String(err);
      return { content: [{ type: 'text' as const, text: `Export failed:\n${stderr}` }], isError: true };
    }
  },
);

// ═══════════════════════════════════════════════════════
// Phase 3 Tools
// ═══════════════════════════════════════════════════════

// ─── Tool: vswrite_list_styles ───────────────────────

server.tool(
  'vswrite_list_styles',
  'Returns all available style templates with id, label, and description.',
  async () => {
    const styles = styleTemplates.map(t => ({ id: t.id, label: t.label, description: t.description }));
    return { content: [{ type: 'text' as const, text: JSON.stringify(styles, null, 2) }] };
  },
);

// ─── Tool: vswrite_apply_style ───────────────────────

server.tool(
  'vswrite_apply_style',
  'Applies a predefined style template to the current document. Replaces the existing #set/#show preamble. Use vswrite_list_styles to see available styles.',
  { styleId: z.string().describe('Style template ID (e.g. "classic", "modern", "minimal")') },
  async ({ styleId }) => {
    try {
      const template = styleTemplates.find(t => t.id === styleId);
      if (!template) {
        const ids = styleTemplates.map(t => t.id).join(', ');
        return { content: [{ type: 'text' as const, text: `Error: Unknown style "${styleId}". Available: ${ids}` }], isError: true };
      }
      const { content, filePath } = readCurrentDocument();

      // Remove existing preamble (#set, #show, #import, #let lines at the top)
      const lines = content.split('\n');
      let bodyStart = 0;
      for (let i = 0; i < lines.length; i++) {
        const trimmed = lines[i].trim();
        if (trimmed === '' || trimmed.startsWith('//') || trimmed.startsWith('#set ') ||
            trimmed.startsWith('#show ') || trimmed.startsWith('#import ') || trimmed.startsWith('#let ')) {
          bodyStart = i + 1;
        } else {
          break;
        }
      }
      const body = lines.slice(bodyStart).join('\n').trimStart();
      const updated = template.preamble + '\n\n' + body;
      fs.writeFileSync(filePath, updated, 'utf-8');

      return {
        content: [{ type: 'text' as const, text: `Applied style "${template.label}" to ${path.basename(filePath)}` }],
      };
    } catch (err) {
      return { content: [{ type: 'text' as const, text: `Error: ${err}` }], isError: true };
    }
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
      const dir = state.projectDir;
      const targetFile = bibFile || 'references.bib';
      const bibPath = path.join(dir, targetFile);

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
  'Creates a new Typst project from a template. Available templates: document, thesis, paper, letter, book. Creates the project directory with all template files.',
  {
    templateId: z.enum(['document', 'thesis', 'paper', 'letter', 'book']).describe('Template ID'),
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
      'Provide your key via --license-key VSWRITE_PRO_xxx or VSWRITE_LICENSE_KEY env var.\n' +
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
