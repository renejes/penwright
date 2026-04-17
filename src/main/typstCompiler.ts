/**
 * Typst Compiler — spawns `typst compile` and emits SVG pages.
 * Ported from the VS Code extension, stripped of vscode.* dependencies.
 */

import { execFile } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { EventEmitter } from 'events';
import { getTypstPath } from './typstPath';

export class TypstCompiler extends EventEmitter {
  private filePath: string;
  private compileTimer: NodeJS.Timeout | null = null;
  private pdfCompileTimer: NodeJS.Timeout | null = null;
  private compileDelay = 400;

  constructor(filePath: string) {
    super();
    this.filePath = filePath;
  }

  compile(): void {
    if (this.compileTimer) clearTimeout(this.compileTimer);
    this.compileTimer = setTimeout(() => this.doCompile(), this.compileDelay);
  }

  private doCompile(): void {
    const dir = path.dirname(this.filePath);
    const outPattern = path.join(dir, '.vswrite-preview-{n}.svg');

    execFile(
      getTypstPath(),
      ['compile', this.filePath, outPattern, '--format', 'svg'],
      { cwd: dir, timeout: 30000 },
      async (error, _stdout, stderr) => {
        if (error) {
          // Parse diagnostics from stderr
          const diagnostics = this.parseErrors(stderr);
          this.emit('error', diagnostics);
          return;
        }

        // Collect SVG pages asynchronously in parallel — typst zero-pads
        // page numbers for multi-page docs (preview-01.svg, preview-02.svg, …).
        // Reading + deleting each page with fs.promises keeps the main
        // process event loop responsive for 100+ page documents.
        try {
          const entries = await fs.promises.readdir(dir);
          const files = entries
            .filter(f => f.startsWith('.vswrite-preview-') && f.endsWith('.svg'))
            .sort();

          const pages = await Promise.all(files.map(async (file) => {
            const svgPath = path.join(dir, file);
            const content = await fs.promises.readFile(svgPath, 'utf-8');
            fs.promises.unlink(svgPath).catch(() => {});
            return content;
          }));

          if (pages.length > 0) {
            this.emit('compiled', pages);
          }
        } catch {
          // Swallow — if the directory vanished mid-read, skip this cycle.
        }
      },
    );
  }

  compilePdf(): void {
    if (this.pdfCompileTimer) clearTimeout(this.pdfCompileTimer);
    this.pdfCompileTimer = setTimeout(() => this.doCompilePdf(), this.compileDelay);
  }

  private doCompilePdf(): void {
    const dir = path.dirname(this.filePath);
    const outPath = path.join(dir, '.vswrite-preview.pdf');

    execFile(
      getTypstPath(),
      ['compile', this.filePath, outPath],
      { cwd: dir, timeout: 30000 },
      async (error, _stdout, stderr) => {
        if (error) {
          const diagnostics = this.parseErrors(stderr);
          this.emit('error', diagnostics);
          return;
        }

        try {
          const pdfBuffer = await fs.promises.readFile(outPath);
          this.emit('compiledPdf', pdfBuffer);
          fs.promises.unlink(outPath).catch(() => {});
        } catch {}
      },
    );
  }

  private parseErrors(stderr: string): { message: string; line?: number }[] {
    const diagnostics: { message: string; line?: number }[] = [];
    const lines = stderr.split('\n');

    for (const line of lines) {
      const match = line.match(/error:?\s*(.*)/i);
      if (match) {
        const lineMatch = line.match(/:(\d+):/);
        diagnostics.push({
          message: match[1],
          line: lineMatch ? parseInt(lineMatch[1]) : undefined,
        });
      }
    }

    return diagnostics;
  }

  dispose(): void {
    if (this.compileTimer) {
      clearTimeout(this.compileTimer);
      this.compileTimer = null;
    }
    if (this.pdfCompileTimer) {
      clearTimeout(this.pdfCompileTimer);
      this.pdfCompileTimer = null;
    }
  }
}
