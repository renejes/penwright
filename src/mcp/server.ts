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

const execFileAsync = promisify(execFile);

// ─── State ───────────────────────────────────────────

interface ServerState {
  projectDir: string;
  currentFile: string | null;
}

const state: ServerState = {
  projectDir: '',
  currentFile: null,
};

// ─── Parse CLI args ──────────────────────────────────

function parseArgs(): void {
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--project' && args[i + 1]) {
      state.projectDir = path.resolve(args[++i]);
    } else if (args[i] === '--file' && args[i + 1]) {
      const filePath = path.resolve(args[++i]);
      state.currentFile = filePath;
      if (!state.projectDir) {
        state.projectDir = path.dirname(filePath);
      }
    }
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
  version: '0.4.0',
});

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

// ─── Start Server ────────────────────────────────────

async function main() {
  parseArgs();

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error('vswrite MCP server failed to start:', err);
  process.exit(1);
});
