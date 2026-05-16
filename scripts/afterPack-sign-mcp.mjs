#!/usr/bin/env node
/**
 * electron-builder afterPack hook — re-signs the bundled vswrite MCP
 * binary with JIT-specific entitlements that the main Electron app
 * doesn't need (and shouldn't get for security reasons).
 *
 * electron-builder signs every Mach-O it finds inside the .app with the
 * main `entitlements.mac.plist`. That works for Electron's binaries but
 * Bun-compiled executables also need `disable-library-validation`. We
 * apply the MCP-specific entitlements file via a fresh codesign pass.
 *
 * Skipped on non-macOS, on unsigned (dev) builds, and if the binary is
 * missing — keeps `npm run package:*` working on every platform.
 */

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

export default async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return;

  const identity = process.env.CSC_NAME || context.packager?.platformSpecificBuildOptions?.identity;
  if (!identity) {
    console.log('[afterPack-sign-mcp] no signing identity — skipping MCP re-sign (dev build).');
    return;
  }

  const appName = context.packager.appInfo.productFilename;
  const appPath = join(context.appOutDir, `${appName}.app`);
  const arch = context.arch === 1 ? 'aarch64-apple-darwin' : 'x86_64-apple-darwin'; // arch 1 = arm64
  const binary = join(appPath, 'Contents', 'Resources', 'mcp', 'bin', `vswrite-mcp-${arch}`);

  if (!existsSync(binary)) {
    console.warn(`[afterPack-sign-mcp] binary not found at ${binary} — skip.`);
    return;
  }

  const entitlements = join(context.packager.info.projectDir, 'build', 'entitlements.mac.mcp.plist');
  if (!existsSync(entitlements)) {
    console.error(`[afterPack-sign-mcp] missing entitlements file: ${entitlements}`);
    process.exit(1);
  }

  console.log(`[afterPack-sign-mcp] re-signing MCP binary with JIT entitlements`);
  console.log(`  binary:       ${binary}`);
  console.log(`  entitlements: ${entitlements}`);
  console.log(`  identity:     ${identity}`);

  const result = spawnSync('codesign', [
    '--force',
    '--sign', identity,
    '--options', 'runtime',
    '--entitlements', entitlements,
    '--timestamp',
    binary,
  ], { stdio: 'inherit' });

  if (result.status !== 0) {
    console.error('[afterPack-sign-mcp] codesign failed');
    process.exit(result.status ?? 1);
  }
  console.log('[afterPack-sign-mcp] ✓ MCP binary signed');
}
