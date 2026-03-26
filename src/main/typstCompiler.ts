/**
 * Typst Compiler — spawns `typst compile` and emits SVG pages.
 * Ported from the VS Code extension, stripped of vscode.* dependencies.
 */

import { execFile } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { EventEmitter } from 'events';

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
      'typst',
      ['compile', this.filePath, outPattern, '--format', 'svg'],
      { cwd: dir, timeout: 30000 },
      (error, _stdout, stderr) => {
        if (error) {
          // Parse diagnostics from stderr
          const diagnostics = this.parseErrors(stderr);
          this.emit('error', diagnostics);
          return;
        }

        // Collect SVG pages — typst zero-pads page numbers for multi-page docs
        // (e.g. preview-1.svg for single page, preview-01.svg for multi-page)
        const pages: string[] = [];
        try {
          const files = fs.readdirSync(dir)
            .filter(f => f.startsWith('.vswrite-preview-') && f.endsWith('.svg'))
            .sort();
          for (const file of files) {
            const svgPath = path.join(dir, file);
            pages.push(fs.readFileSync(svgPath, 'utf-8'));
            try { fs.unlinkSync(svgPath); } catch {}
          }
        } catch {}

        if (pages.length > 0) {
          this.emit('compiled', pages);
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
      'typst',
      ['compile', this.filePath, outPath],
      { cwd: dir, timeout: 30000 },
      (error, _stdout, stderr) => {
        if (error) {
          const diagnostics = this.parseErrors(stderr);
          this.emit('error', diagnostics);
          return;
        }

        try {
          const pdfBuffer = fs.readFileSync(outPath);
          this.emit('compiledPdf', pdfBuffer);
          try { fs.unlinkSync(outPath); } catch {}
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
