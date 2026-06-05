/**
 * Typst Compiler — spawns `typst compile` and emits the rendered PDF.
 * The renderer displays the PDF via pdf.js (viewport-virtualised, scales
 * cleanly to 100+ pages — the older SVG-page mode was removed in favour of
 * this for performance).
 */

import { execFile, type ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { EventEmitter } from 'events';
import { getTypstPath, buildTypstCompileArgs } from './typstPath';

export class TypstCompiler extends EventEmitter {
  private filePath: string;
  private pdfCompileTimer: NodeJS.Timeout | null = null;
  private compileDelay = 400;
  // The in-flight compile, plus a monotonic sequence so a slow compile that
  // finishes after a newer one started is dropped (no stale-PDF flash, no
  // pile-up of concurrent `typst` processes on a fast typist / large doc).
  private activeChild: ChildProcess | null = null;
  private compileSeq = 0;

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
    const outPath = path.join(dir, '.penwright-preview.pdf');

    // Supersede any in-flight compile: kill it and bump the sequence so its
    // (now stale) callback is ignored.
    const seq = ++this.compileSeq;
    if (this.activeChild) {
      this.activeChild.kill();
      this.activeChild = null;
    }

    // Use the bundled-package-aware args helper — appends `--package-path`
    // when the bundled Typst packages are available, so imports like
    // `@preview/showybox:2.0.4` resolve offline.
    this.activeChild = execFile(
      getTypstPath(),
      buildTypstCompileArgs([this.filePath, outPath]),
      { cwd: dir, timeout: 30000 },
      async (error, _stdout, stderr) => {
        // Drop results from a superseded run (killed or simply out of order).
        if (seq !== this.compileSeq) return;
        this.activeChild = null;

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

  /**
   * One-off compile used by the safe-apply engine to check whether a staged
   * design change still compiles — BEFORE it's committed. Uses its own temp
   * file and does NOT emit preview events or touch the debounced in-flight
   * compile. Resolves with the PDF on success (so the caller can show it
   * without a second compile) or the diagnostics on failure.
   */
  verify(): Promise<{ ok: true; pdf: Buffer } | { ok: false; errors: { message: string; line?: number }[] }> {
    return new Promise((resolve) => {
      const dir = path.dirname(this.filePath);
      const outPath = path.join(dir, '.penwright-verify.pdf');
      execFile(
        getTypstPath(),
        buildTypstCompileArgs([this.filePath, outPath]),
        { cwd: dir, timeout: 30000 },
        async (error, _stdout, stderr) => {
          if (error) {
            resolve({ ok: false, errors: this.parseErrors(stderr) });
            return;
          }
          try {
            const pdf = await fs.promises.readFile(outPath);
            fs.promises.unlink(outPath).catch(() => {});
            resolve({ ok: true, pdf });
          } catch {
            resolve({ ok: false, errors: [{ message: 'Compilation produced no output.' }] });
          }
        },
      );
    });
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
    // Bump the sequence so any in-flight callback is ignored, and kill it.
    this.compileSeq++;
    if (this.activeChild) {
      this.activeChild.kill();
      this.activeChild = null;
    }
  }
}
