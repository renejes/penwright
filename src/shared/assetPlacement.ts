/**
 * One rule for "an image enters this project".
 *
 * There were four, three of them in the app alone:
 *
 *   handleAddAssets      <project>/assets   name collision → "photo (1).png"
 *   handlePickImage      <openFile>/assets  copyFileSync, no existence check
 *   handleDropImage      <openFile>/assets  writeFileSync, no existence check
 *   penwright_add_image  <project>/assets   content dedup, "photo-2.png"
 *
 * Two of them **silently destroyed** an existing image: drop a second
 * `photo.png` and the first one is gone, along with every figure in the
 * document that pointed at it. Nothing warned, nothing could be undone.
 *
 * Two of them also put the folder next to the open FILE, so a chapter got its
 * own `chapters/assets/` — the same picture landed in a different place
 * depending on which chapter happened to be on screen.
 *
 * The MCP variant was the correct one, so it is the one that survives:
 *
 *   1. Assets live in `<projectDir>/assets/`. One folder, wherever you are.
 *   2. Same name AND same bytes → reuse the file already there. Importing the
 *      same picture twice does not produce two copies.
 *   3. Same name, different bytes → `photo-2.png`. Never an overwrite.
 *   4. The path written into the document is relative to the file that holds
 *      the `image("…")` CALL, because that is the file Typst resolves against.
 *      A project-relative path inside `chapters/c1.typ` sends Typst looking for
 *      `chapters/assets/…` and stops the whole document compiling — the bug
 *      `c744ce5` fixed on the MCP side and that the app never had a rule for.
 *
 *      "The file that holds the call" is not always the file being edited, and
 *      reading rule 4 as "the open file" cost a second document. Two cases:
 *
 *        - an image NODE, or a design-element snippet: the `image()` lands in
 *          the target file, so the base is that file. `assetPathFrom(openFile,…)`
 *        - a MACRO ARGUMENT: the value travels to an `image()` inside the
 *          macro, so the base is the macro's defining file. Measured against
 *          0.15.1 — `#let bildnachweis(b) = image(b)` in `macros.typ`, called
 *          from `chapters/c2.typ`: `"assets/x.png"` compiles, `"../assets/x.png"`
 *          dies with `would escape the project root`, and the error points at
 *          `macros.typ`. `assetPathFrom(macro.filePath, …)`
 *
 *      A macro that only passes the value further on resolves against a THIRD
 *      file; `ProjectMacro.resolvesPathsHere` says which case applies.
 */

import * as fs from 'fs';
import * as path from 'path';

export interface PlacedAsset {
  /** Absolute path of the file in the project. */
  abs: string;
  /** Project-relative POSIX path — for reporting and the file tree. */
  rel: string;
  /** Basename as stored (may carry a `-2` suffix). */
  name: string;
  /** True when identical content was already present and got reused. */
  reused: boolean;
}

export function assetsDirFor(projectDir: string): string {
  return path.join(projectDir, 'assets');
}

/**
 * Strips any directory component from a caller-supplied name.
 *
 * Load-bearing for the drop handler, where the name comes from the renderer:
 * a crafted `../../x` would otherwise escape `assets/` and write anywhere the
 * app can reach.
 */
export function safeAssetName(name: string): string | null {
  const base = path.basename(name);
  if (!base || base === '.' || base === '..') return null;
  return base;
}

/** Places `data` under `<projectDir>/assets/`, deduplicating by content. */
export function placeAsset(projectDir: string, fileName: string, data: Buffer): PlacedAsset {
  const safe = safeAssetName(fileName);
  if (!safe) throw new Error(`Refusing to store an asset named "${fileName}".`);

  const dir = assetsDirFor(projectDir);
  fs.mkdirSync(dir, { recursive: true });

  const ext = path.extname(safe);
  const stem = safe.slice(0, safe.length - ext.length) || 'asset';

  let name = safe;
  let abs = path.join(dir, name);
  let counter = 2;
  let reused = false;

  while (fs.existsSync(abs)) {
    let existing: Buffer | null = null;
    try { existing = fs.readFileSync(abs); } catch { existing = null; }
    if (existing && existing.equals(data)) {
      reused = true;
      break;
    }
    name = `${stem}-${counter}${ext}`;
    abs = path.join(dir, name);
    counter++;
  }

  if (!reused) fs.writeFileSync(abs, data);

  return {
    abs,
    name,
    reused,
    rel: path.relative(projectDir, abs).split(path.sep).join('/'),
  };
}

/** Same, reading the bytes from an existing file. */
export function placeAssetFromPath(projectDir: string, srcPath: string): PlacedAsset {
  const stat = fs.statSync(srcPath);
  if (!stat.isFile()) throw new Error(`Not a file: ${srcPath}`);
  return placeAsset(projectDir, path.basename(srcPath), fs.readFileSync(srcPath));
}

/**
 * The path to write into `targetFile` so Typst finds the asset.
 *
 * Always relative to the containing file, never to the project — see rule 4.
 */
export function assetPathFrom(targetFile: string, assetAbs: string): string {
  return path.relative(path.dirname(targetFile), assetAbs).split(path.sep).join('/');
}

/**
 * True when `absPath` already lives inside the project, so it can be
 * referenced where it is instead of being copied in.
 */
export function isInsideProject(projectDir: string, absPath: string): boolean {
  const root = path.resolve(projectDir);
  const p = path.resolve(absPath);
  return p === root || p.startsWith(root + path.sep);
}
