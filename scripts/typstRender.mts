/**
 * The one place a test script resolves Typst and renders pages to compare them.
 *
 * Two suites need it (`compile-corpus-test`, `compile-stability-test`) and the
 * resolution rule is not obvious: the BUNDLED binary is the one we ship, so a
 * test that quietly fell back to whatever `typst` is on PATH would be measuring
 * a different compiler than the user gets, and `--package-path` / `--font-path`
 * have to point into `resources/` or the bundled packages and fonts do not
 * resolve. Two copies of that rule is two copies to drift.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const REPO = path.resolve(fileURLToPath(new URL('..', import.meta.url)));

/** The bundled binary for this host, else `typst` from PATH. */
export function resolveTypst(): { bin: string; bundled: boolean; label: string } {
  const arch = process.arch === 'arm64' ? 'arm64' : 'x64';
  const platform = process.platform === 'win32' ? 'win' : process.platform === 'linux' ? 'linux' : 'darwin';
  const ext = platform === 'win' ? '.exe' : '';
  const bundled = path.join(REPO, 'resources', 'bin', `typst-${arch}-${platform}${ext}`);
  if (fs.existsSync(bundled)) return { bin: bundled, bundled: true, label: `bundled ${path.basename(bundled)}` };
  return { bin: 'typst', bundled: false, label: 'system PATH' };
}

/** Whether this binary actually runs — the callers refuse to report a pass
 *  without a compiler rather than skipping quietly. */
export function typstUsable(bin: string): boolean {
  const r = spawnSync(bin, ['--version'], { stdio: ['ignore', 'ignore', 'ignore'] });
  return r.status === 0;
}

/** `--package-path` / `--font-path` for the bundled resources, when present. */
export function bundledResourceArgs(): string[] {
  const pkg = path.join(REPO, 'resources', 'typst-packages');
  const font = path.join(REPO, 'resources', 'fonts');
  return [
    ...(fs.existsSync(pkg) ? ['--package-path', pkg] : []),
    ...(fs.existsSync(font) ? ['--font-path', font] : []),
  ];
}

export interface Render {
  /** One sha256 per rendered page, in page order. Empty when the compile failed. */
  hashes: string[];
  /** Typst's stderr — captured on SUCCESS too, because "unknown label" is a
   *  WARNING: a lost cross-reference still renders a page. */
  stderr: string;
  ok: boolean;
}

/**
 * Compiles `srcFile` to per-page PNGs in a throwaway dir and returns one hash
 * per page.
 *
 * Hashes, not kept images: the question is "identical or not", and ten pages of
 * PNG times two compiles times thirty-four projects is a lot of bytes to hold
 * for an answer one bit wide. `{0p}` (zero-padded), not `{p}` — with `{p}` a
 * ten-page document sorts p-1, p-10, p-2 and page N stops being page N.
 */
export function renderPages(
  bin: string,
  srcFile: string,
  opts: { root: string; ppi?: number; tag?: string; extraArgs?: string[] },
): Render {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), `pw-render-${opts.tag ?? 'x'}-`));
  try {
    const r = spawnSync(
      bin,
      [
        'compile',
        ...bundledResourceArgs(),
        '--root', opts.root,
        ...(opts.extraArgs ?? []),
        '--format', 'png',
        '--ppi', String(opts.ppi ?? 120),
        srcFile,
        path.join(outDir, 'p-{0p}.png'),
      ],
      { stdio: ['ignore', 'ignore', 'pipe'], encoding: 'utf-8' },
    );
    const stderr = r.stderr ?? '';
    if (r.status !== 0) return { hashes: [], stderr, ok: false };

    const pages = fs.readdirSync(outDir).filter(f => f.endsWith('.png')).sort();
    const hashes = pages.map(p =>
      crypto.createHash('sha256').update(fs.readFileSync(path.join(outDir, p))).digest('hex'),
    );
    return { hashes, stderr, ok: true };
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
}
