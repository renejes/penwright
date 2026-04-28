/**
 * Typst Compiler — spawns `typst compile` and emits the rendered PDF.
 * The renderer displays the PDF via pdf.js (viewport-virtualised, scales
 * cleanly to 100+ pages — the older SVG-page mode was removed in favour of
 * this for performance).
 */

import { execFile } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { EventEmitter } from 'events';
import { getTypstPath } from './typstPath';

export class TypstCompiler extends EventEmitter {
  private filePath: string;
  private pdfCompileTimer: NodeJS.Timeout | null = null;
  private compileDelay = 400;

  constructor(filePath: string) {
    super();
    this.filePath = filePath;
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
    if (this.pdfCompileTimer) {
      clearTimeout(this.pdfCompileTimer);
      this.pdfCompileTimer = null;
    }
  }
}
