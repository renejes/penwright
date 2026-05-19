/**
 * MCP-Setup: registers a standalone vswrite MCP server binary in Claude
 * Desktop's config so users don't have to edit JSON by hand.
 *
 * Synova-style runtime model:
 *   - The MCP server is a Bun-compiled single-file native binary (built via
 *     `scripts/build-mcp-binary.mjs` → `dist/mcp/bin/vswrite-mcp-<triple>`).
 *   - At setup, we COPY the binary out of the .app bundle into a stable
 *     user-writable location: `~/Library/Application Support/vswrite/mcp-server/vswrite-mcp`.
 *   - Claude Desktop spawns that copy directly. No Node required. The
 *     process is fully decoupled from the vswrite app — quitting vswrite
 *     does not affect the MCP child, and the order of launching the two
 *     apps no longer matters.
 *
 * macOS-only for now; Windows + Linux can extend the platform branches
 * later (different config paths + binary triples).
 */

import { app, shell } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { getLicenseData } from './persistenceManager';
import { getTypstPackagePath, getTypstFontPath } from './typstPath';

/**
 * Bump when the bundled MCP binary or the config schema changes. Persisted
 * setup version in electron-store is compared against this; mismatch =>
 * the wizard prompts again so updates re-install the binary.
 */
export const MCP_SETUP_VERSION = '0.7.1';

/** Key used in Claude Desktop's `mcpServers` map. */
const MCP_SERVER_KEY = 'vswrite';

export interface ClaudeCheck {
  installed: boolean;
  pathsChecked: string[];
}

export interface SetupResult {
  binaryPath: string;
  configPath: string;
  alreadyConfigured: boolean;
  /** Other mcpServers entries we kept untouched. */
  preservedServers: string[];
  /** Path to the pre-modification backup, or null if no prior config existed. */
  backupPath: string | null;
}

// ─── Path resolution ────────────────────────────────

function darwinTriple(): string {
  return process.arch === 'arm64' ? 'aarch64-apple-darwin' : 'x86_64-apple-darwin';
}

/**
 * Absolute path to the bundled MCP binary inside the .app (prod) or
 * the dev build output (dev). The setup step copies this OUT to a
 * stable user-writable location; the source should never be executed
 * directly because the .app path changes when users move the app.
 */
export function getBundledBinaryPath(): string {
  const triple = darwinTriple();
  const filename = `vswrite-mcp-${triple}`;
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'mcp', 'bin', filename);
  }
  return path.resolve(__dirname, '..', '..', 'dist', 'mcp', 'bin', filename);
}

/** Stable, user-writable location the binary is copied to during setup. */
export function getInstalledBinaryPath(): string {
  return path.join(
    os.homedir(),
    'Library',
    'Application Support',
    'vswrite',
    'mcp-server',
    'vswrite-mcp',
  );
}

// ─── Claude Desktop discovery ───────────────────────

function claudeAppCandidates(): string[] {
  if (process.platform !== 'darwin') return [];
  const home = os.homedir();
  return [
    '/Applications/Claude.app',
    path.join(home, 'Applications', 'Claude.app'),
  ];
}

export function checkClaudeDesktopInstalled(): ClaudeCheck {
  const candidates = claudeAppCandidates();
  const installed = candidates.some(p => {
    try { return fs.existsSync(p); } catch { return false; }
  });
  return { installed, pathsChecked: candidates };
}

export function getClaudeConfigPath(): string {
  if (process.platform !== 'darwin') {
    throw new Error('MCP setup is only supported on macOS in this build.');
  }
  return path.join(
    os.homedir(),
    'Library',
    'Application Support',
    'Claude',
    'claude_desktop_config.json',
  );
}

// ─── Open Claude.app ────────────────────────────────

export async function openClaudeDesktop(): Promise<void> {
  if (process.platform !== 'darwin') {
    throw new Error('Opening Claude Desktop is only supported on macOS in this build.');
  }
  const target = claudeAppCandidates().find(p => fs.existsSync(p));
  if (!target) throw new Error('Claude Desktop is not installed.');
  await shell.openPath(target);
}

// ─── Setup ──────────────────────────────────────────

function copyExecutable(src: string, dst: string): void {
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
  // Ensure +x. mkdir/copy preserve mode bits from src on POSIX, but be
  // defensive — a 644 binary won't spawn.
  try {
    fs.chmodSync(dst, 0o755);
  } catch (err) {
    console.warn('[vswrite] chmod 755 on MCP binary failed:', err);
  }
}

/**
 * Merge the vswrite entry into Claude Desktop's `mcpServers` map without
 * touching any other server entries.
 *
 * Behaviour:
 *   - File exists       → read, take timestamped backup, rewrite.
 *   - File missing/empty → create fresh with only the vswrite entry; no backup.
 *   - File malformed    → bail out instead of overwriting so the user can
 *                         fix it manually.
 */
export async function setupMcpServer(): Promise<SetupResult> {
  if (process.platform !== 'darwin') {
    throw new Error('MCP setup is only supported on macOS in this build.');
  }

  // The MCP server enforces a Pro license at startup. Pull the key the
  // user activated in the app and embed it in the config as an env var
  // so Claude Desktop can spawn the server independently of vswrite.
  const license = getLicenseData();
  if (!license.licenseKey || !license.licenseKey.startsWith('VSWRITE_PRO')) {
    throw new Error(
      'Du brauchst eine aktivierte vswrite Pro-Lizenz, damit der MCP-Server startet. ' +
      'Aktiviere sie unter "Lizenz" in der Status-Leiste und fuehre die Einrichtung dann erneut aus.',
    );
  }

  const bundled = getBundledBinaryPath();
  if (!fs.existsSync(bundled)) {
    throw new Error(
      `Bundled MCP binary not found at ${bundled}. ` +
      (app.isPackaged
        ? 'Reinstall vswrite or contact support — the binary is missing from the bundle.'
        : 'Run `node scripts/build-mcp-binary.mjs` first.'),
    );
  }

  // Copy into a stable, user-writable location. We rewrite on every run
  // so updating vswrite upgrades the sidecar in lockstep.
  const installed = getInstalledBinaryPath();
  copyExecutable(bundled, installed);

  const configPath = getClaudeConfigPath();
  const configDir = path.dirname(configPath);
  fs.mkdirSync(configDir, { recursive: true });

  const rawExisting = fs.existsSync(configPath)
    ? fs.readFileSync(configPath, 'utf-8')
    : null;

  let root: Record<string, unknown>;
  if (rawExisting && rawExisting.trim()) {
    try {
      const parsed = JSON.parse(rawExisting);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        throw new Error(`${configPath} is not a JSON object — refusing to overwrite.`);
      }
      root = parsed as Record<string, unknown>;
    } catch (err) {
      throw new Error(
        `Could not parse ${configPath}: ${(err as Error).message}. ` +
        'Please fix the file or remove it; setup refuses to overwrite invalid JSON.',
      );
    }
  } else {
    root = {};
  }

  if (root['mcpServers'] !== undefined && (typeof root['mcpServers'] !== 'object' || Array.isArray(root['mcpServers']))) {
    throw new Error('`mcpServers` must be an object — refusing to overwrite.');
  }
  const servers: Record<string, unknown> = (root['mcpServers'] as Record<string, unknown> | undefined) ?? {};
  root['mcpServers'] = servers;

  const preservedServers = Object.keys(servers).filter(k => k !== MCP_SERVER_KEY);

  // Standalone-binary config: no Node required. The license key goes in
  // an env var rather than `args` so it doesn't show up in `ps` output
  // and isn't displayed alongside the command path. The config file
  // itself sits in the user-only-readable Library directory.
  //
  // We also pass `TYPST_PACKAGE_PATH` and `TYPST_FONT_PATH` so the MCP
  // server's `typst compile` calls find the bundled Typst packages
  // (cetz, fletcher, showybox, codly, …) and the bundled OFL fonts
  // (Inter, IBM Plex, JetBrains Mono, Crimson Pro, Spectral, …) without
  // needing internet or system-installed fonts. The paths point into
  // the currently-installed .app's Resources — re-running the wizard
  // after the user moves vswrite refreshes the entry.
  const env: Record<string, string> = { VSWRITE_LICENSE_KEY: license.licenseKey };
  const pkgPath = getTypstPackagePath();
  if (pkgPath) env['TYPST_PACKAGE_PATH'] = pkgPath;
  const fontPath = getTypstFontPath();
  if (fontPath) env['TYPST_FONT_PATH'] = fontPath;

  const newEntry: Record<string, unknown> = {
    command: installed,
    env,
  };

  const existingEntry = servers[MCP_SERVER_KEY];
  const alreadyConfigured = existingEntry !== undefined &&
    JSON.stringify(existingEntry) === JSON.stringify(newEntry);

  servers[MCP_SERVER_KEY] = newEntry;

  // Timestamped backup of the prior contents — only if the file existed.
  let backupPath: string | null = null;
  if (rawExisting !== null) {
    const stamp = Math.floor(Date.now() / 1000);
    const backupName = `.claude_desktop_config.vswrite-bak.${stamp}.json`;
    backupPath = path.join(configDir, backupName);
    fs.writeFileSync(backupPath, rawExisting, 'utf-8');
  }

  fs.writeFileSync(configPath, JSON.stringify(root, null, 2), 'utf-8');

  return {
    binaryPath: installed,
    configPath,
    alreadyConfigured,
    preservedServers,
    backupPath,
  };
}
