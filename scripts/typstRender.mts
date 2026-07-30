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
import zlib from 'node:zlib';
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

/**
 * `--package-path` / `--font-path` for the bundled resources, plus
 * `--ignore-system-fonts` — set `PW_SYSTEM_FONTS=1` to allow them.
 *
 * The app deliberately does NOT ignore system fonts (a user who installs a font
 * should be able to use it), but a TEST must not measure the developer's font
 * folder. It did: comparing Typst 0.14.2 with 0.15.1 reported six pages of
 * "reflow" that were entirely local — `~/Library/Fonts` holds a Crimson Pro
 * VARIABLE font, 0.15 can instance it at `weight: "medium"` and 0.14.2 could
 * not, so it fell back to the bundled Regular. Isolated, those pages are
 * byte-identical between the two compilers.
 *
 * Isolating costs nothing in coverage: every shipped preset was checked to be
 * font-self-contained (no "unknown font family" with system fonts off), so this
 * measures our bundled design and gives the same answer on every machine.
 */
export function bundledResourceArgs(): string[] {
  const pkg = path.join(REPO, 'resources', 'typst-packages');
  const font = path.join(REPO, 'resources', 'fonts');
  return [
    ...(fs.existsSync(pkg) ? ['--package-path', pkg] : []),
    ...(fs.existsSync(font) ? ['--font-path', font] : []),
    ...(process.env.PW_SYSTEM_FONTS === '1' ? [] : ['--ignore-system-fonts']),
  ];
}

/**
 * Hashes a PNG's DECODED PIXELS, not its file bytes.
 *
 * Hashing the file is a trap, and it sprang: Typst 0.15 ships "space-optimized
 * output by default", so the same page re-encoded from 397 KB to 181 KB with
 * byte-identical pixels. A file hash reported all 39 corpus projects as
 * "renders differently" on every page — 100% false positives, and exactly the
 * shape of alarm that gets a real finding waved away next time.
 *
 * Inflate the IDAT and undo PNG's per-scanline filtering, which is where an
 * encoder is free to choose differently for identical output. Node's zlib only,
 * so this stays dependency-free and works on every platform (`sips` would not).
 *
 * Typst writes 8-bit RGBA, non-interlaced; anything else is rejected loudly
 * rather than silently mis-hashed.
 */
export function pngPixelHash(file: string): string {
  const b = fs.readFileSync(file);
  if (b.length < 33 || b.toString('ascii', 1, 4) !== 'PNG') throw new Error(`${file}: not a PNG`);

  const width = b.readUInt32BE(16);
  const height = b.readUInt32BE(20);
  const [depth, colorType, , , interlace] = [b[24], b[25], b[26], b[27], b[28]];
  if (depth !== 8 || colorType !== 6 || interlace !== 0) {
    throw new Error(`${file}: expected 8-bit RGBA non-interlaced, got depth=${depth} colorType=${colorType} interlace=${interlace}`);
  }
  const bpp = 4;

  const idat: Buffer[] = [];
  for (let i = 8; i < b.length; ) {
    const len = b.readUInt32BE(i);
    const type = b.toString('ascii', i + 4, i + 8);
    if (type === 'IDAT') idat.push(b.subarray(i + 8, i + 8 + len));
    else if (type === 'IEND') break;
    i += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));

  const stride = width * bpp;
  const out = Buffer.alloc(height * stride);
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
    const cur = out.subarray(y * stride, (y + 1) * stride);
    line.copy(cur);
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0;
      const up = prev[x];
      const ul = x >= bpp ? prev[x - bpp] : 0;
      switch (filter) {
        case 0: break;                                              // None
        case 1: cur[x] = (cur[x] + a) & 0xff; break;                // Sub
        case 2: cur[x] = (cur[x] + up) & 0xff; break;               // Up
        case 3: cur[x] = (cur[x] + ((a + up) >> 1)) & 0xff; break;   // Average
        case 4: {                                                   // Paeth
          const p = a + up - ul;
          const pa = Math.abs(p - a), pb = Math.abs(p - up), pc = Math.abs(p - ul);
          cur[x] = (cur[x] + (pa <= pb && pa <= pc ? a : pb <= pc ? up : ul)) & 0xff;
          break;
        }
        default: throw new Error(`${file}: unknown PNG filter ${filter} on row ${y}`);
      }
    }
    prev = cur;
  }
  return crypto.createHash('sha256').update(`${width}x${height}:`).update(out).digest('hex');
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
 * Compiles `srcFile` to per-page PNGs in a throwaway dir and returns one
 * DECODED-PIXEL hash per page (see `pngPixelHash` for why not the file bytes).
 *
 * Hashes, not kept images: the question is "identical or not", and ten pages of
 * PNG times two compiles times thirty-nine projects is a lot of bytes to hold
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
    const hashes = pages.map(p => pngPixelHash(path.join(outDir, p)));
    return { hashes, stderr, ok: true };
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
}
