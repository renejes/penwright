#!/usr/bin/env node
/**
 * electron-builder afterPack hook — pre-signs the bundled native binaries
 * that ship inside Contents/Resources (the Bun-compiled MCP server and the
 * Typst CLI) so they notarize cleanly.
 *
 * Lifecycle note (verified against app-builder-lib 26): afterPack runs
 * **before** electron-builder's own code-sign pass (emitAfterPack →
 * doSignAfterPack). So this hook is *insurance*, not the primary signer:
 *   - Primary path: electron-builder's deep sign signs every nested Mach-O
 *     (incl. these extraResources) with `build/entitlements.mac.plist`, which
 *     now includes `disable-library-validation` — enough for the Bun binary.
 *   - Insurance path: if a given electron-builder version does NOT sign nested
 *     extraResources, the signatures applied here survive (the app is sealed
 *     afterwards, so they stay consistent) and notarization still passes.
 *
 * Either way the binaries end up signed + hardened + timestamped. We glob the
 * files instead of guessing the build arch (the old `context.arch === 1`
 * mapping was inverted and would have signed the wrong triple).
 *
 * Skipped on non-macOS and on unsigned (dev) builds.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

function signOne(binary, identity, entitlements) {
  const args = ['--force', '--sign', identity, '--options', 'runtime', '--timestamp'];
  if (entitlements) args.push('--entitlements', entitlements);
  args.push(binary);
  const result = spawnSync('codesign', args, { stdio: 'inherit' });
  if (result.status !== 0) {
    console.error(`[afterPack-sign] codesign failed for ${binary}`);
    process.exit(result.status ?? 1);
  }
  console.log(`[afterPack-sign] ✓ ${binary}`);
}

/** Absolute paths of files in `dir` whose name starts with `prefix`. */
function binariesIn(dir, prefix) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.startsWith(prefix))
    .map((f) => join(dir, f));
}

export default async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return;

  const identity = process.env.CSC_NAME || context.packager?.platformSpecificBuildOptions?.identity;
  if (!identity) {
    console.log('[afterPack-sign] no signing identity — skipping native-binary re-sign (dev build).');
    return;
  }

  const appName = context.packager.appInfo.productFilename;
  const appPath = join(context.appOutDir, `${appName}.app`);
  const resources = join(appPath, 'Contents', 'Resources');
  const projectDir = context.packager.info.projectDir;

  // The Bun MCP binary keeps least-privilege JIT entitlements where this hook
  // is the surviving signature; the Typst CLI needs no entitlements at all.
  const mcpEntitlements = join(projectDir, 'build', 'entitlements.mac.mcp.plist');
  const mcpEnt = existsSync(mcpEntitlements) ? mcpEntitlements : undefined;

  const mcpBinaries = binariesIn(join(resources, 'mcp', 'bin'), 'penwright-mcp-');
  const typstBinaries = binariesIn(join(resources, 'bin'), 'typst-');

  if (mcpBinaries.length === 0 && typstBinaries.length === 0) {
    console.warn('[afterPack-sign] no MCP / Typst binaries found under Resources — nothing to sign.');
    return;
  }

  console.log(`[afterPack-sign] identity: ${identity}`);
  for (const bin of mcpBinaries) signOne(bin, identity, mcpEnt);
  for (const bin of typstBinaries) signOne(bin, identity, undefined);
}
