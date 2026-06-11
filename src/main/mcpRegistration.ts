/**
 * MCP Registration — registers THIS app's MCP server with exactly one of two
 * hosts, idempotently.
 *
 *   (A) Meta-MCP   — a local MCP-aggregator proxy on http://localhost:3663.
 *                    Register over HTTP (POST /register, hot-reload); the proxy
 *                    dedupes on `name` and assigns its own id. There is no HTTP
 *                    unregister, so removal edits Meta-MCP's watched config.json.
 *   (B) Claude Code — the CLI agent. Register at user scope (global) via
 *                    `claude mcp add --scope user …`, falling back to editing
 *                    `~/.claude.json` directly when the `claude` CLI isn't on a
 *                    GUI app's (stripped) PATH.
 *
 * Invariant: only ONE registration is active at a time. `ensureMcpTarget`
 * registers the chosen host and removes the app's entry from the other, so
 * re-running it every launch converges to a clean, duplicate-free state.
 *
 * The server definition (command / args / env) is identical to what the
 * Claude-Desktop wizard writes — the same standalone binary and the same Typst
 * env block — built via `buildServerDefinition()`.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execFileSync } from 'child_process';
import { ensureInstalledBinary, buildMcpEnv, MCP_SERVER_KEY } from './mcpSetup';

// ─── Types ──────────────────────────────────────────

export type McpTarget = 'meta' | 'claude';

/** The app's MCP server, as every host needs to spawn it (stdio transport). */
export interface ServerDefinition {
  name: string;
  transport: 'stdio';
  command: string;
  args: string[];
  env: Record<string, string>;
}

/** Per-side outcome of a register/unregister pass. */
export interface SideResult {
  reachable?: boolean;
  registered: boolean;
  unregistered: boolean;
  /** How the Claude-Code side was written ('cli' or 'file'); null otherwise. */
  method: 'cli' | 'file' | null;
  /** Machine-readable error code or message; null on success. */
  error: string | null;
}

export interface EnsureResult {
  target: McpTarget;
  /** True when the chosen target is now the sole active registration. */
  ok: boolean;
  meta: SideResult;
  claude: SideResult;
  /**
   * Whether the registered server can actually start: 'licensed' or 'trial'
   * both run; 'expired' means the 14-day demo lapsed with no license.
   */
  access: 'licensed' | 'trial' | 'expired';
}

const META_BASE = 'http://localhost:3663';
const PROBE_TIMEOUT_MS = 1200;
const HTTP_TIMEOUT_MS = 4000;
const CLI_TIMEOUT_MS = 8000;

function emptySide(): SideResult {
  return { registered: false, unregistered: false, method: null, error: null };
}

/** Which credential (if any) is baked into the server env → can it start? */
function envAccess(env: Record<string, string>): 'licensed' | 'trial' | 'expired' {
  if ('PENWRIGHT_LICENSE_KEY' in env) return 'licensed';
  if ('PENWRIGHT_TRIAL_UNTIL' in env) return 'trial';
  return 'expired';
}

// ─── Server definition ──────────────────────────────

/**
 * Build the full server definition (installs/refreshes the bundled binary as a
 * side effect). Throws if the binary can't be resolved — callers surface that
 * as an error rather than registering a broken entry.
 */
export function buildServerDefinition(): ServerDefinition {
  const command = ensureInstalledBinary();
  const { env } = buildMcpEnv();
  return { name: MCP_SERVER_KEY, transport: 'stdio', command, args: [], env };
}

// ─── Config paths ───────────────────────────────────

/** Meta-MCP's watched config file (used for the file-based unregister). */
export function getMetaConfigPath(): string {
  const home = os.homedir();
  const appId = 'com.metamcp.desktop';
  if (process.platform === 'darwin') {
    return path.join(home, 'Library', 'Application Support', appId, 'config.json');
  }
  if (process.platform === 'win32') {
    const base = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
    return path.join(base, appId, 'config.json');
  }
  // Linux / other: XDG config home.
  const xdg = process.env.XDG_CONFIG_HOME || path.join(home, '.config');
  return path.join(xdg, appId, 'config.json');
}

/** Claude Code's user-scope (global) config file. */
export function getClaudeCodeConfigPath(): string {
  return path.join(os.homedir(), '.claude.json');
}

// ─── Shared non-destructive JSON file helpers ───────

/**
 * Read a JSON object from disk. Returns null if the file is missing or empty;
 * throws if it exists but isn't a JSON object — we never overwrite a file we
 * can't parse, so the user can fix it by hand.
 */
function readJsonObject(filePath: string): { raw: string; obj: Record<string, unknown> } | null {
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, 'utf-8');
  if (!raw.trim()) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`Could not parse ${filePath}: ${(err as Error).message} — refusing to overwrite.`);
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error(`${filePath} is not a JSON object — refusing to overwrite.`);
  }
  return { raw, obj: parsed as Record<string, unknown> };
}

/** Timestamped, side-by-side backup of a config before we rewrite it. */
function backupConfig(filePath: string, raw: string): void {
  try {
    const dir = path.dirname(filePath);
    const stamp = Math.floor(Date.now() / 1000);
    const name = `.${path.basename(filePath)}.penwright-bak.${stamp}`;
    fs.writeFileSync(path.join(dir, name), raw, 'utf-8');
  } catch (err) {
    console.warn('[penwright] MCP config backup failed:', err);
  }
}

function writeJson(filePath: string, obj: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(obj, null, 2), 'utf-8');
}

// ─── Meta-MCP (A) ───────────────────────────────────

/** GET http://localhost:3663/ — a 200 means the proxy is running. */
export async function probeMetaMcp(timeoutMs = PROBE_TIMEOUT_MS): Promise<boolean> {
  try {
    const res = await fetch(`${META_BASE}/`, {
      method: 'GET',
      signal: AbortSignal.timeout(timeoutMs),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** POST /register — Meta-MCP dedupes on `name` and assigns its own id. */
async function registerWithMeta(def: ServerDefinition): Promise<void> {
  const body = {
    name: def.name,
    transport: def.transport,
    command: def.command,
    args: def.args,
    env: def.env,
    active: true,
  };
  const res = await fetch(`${META_BASE}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`Meta-MCP /register returned HTTP ${res.status}`);
  }
}

/**
 * Remove the app's entry from Meta-MCP's config.json (no HTTP unregister
 * exists). Touches ONLY our own `name`; `profiles` / `active_profile` and every
 * other server stay byte-for-byte intact. Handles `servers` as either an array
 * (the documented shape) or an object map, defensively.
 */
export function unregisterFromMeta(name = MCP_SERVER_KEY): { removed: number } {
  const filePath = getMetaConfigPath();
  const read = readJsonObject(filePath);
  if (!read) return { removed: 0 };
  const { raw, obj } = read;

  const servers = obj['servers'];
  let removed = 0;

  if (Array.isArray(servers)) {
    const kept = servers.filter((s) => !(s && typeof s === 'object' && (s as Record<string, unknown>)['name'] === name));
    removed = servers.length - kept.length;
    if (removed > 0) obj['servers'] = kept;
  } else if (servers && typeof servers === 'object') {
    const map = servers as Record<string, unknown>;
    for (const key of Object.keys(map)) {
      const entry = map[key];
      const entryName = entry && typeof entry === 'object' ? (entry as Record<string, unknown>)['name'] : undefined;
      if (key === name || entryName === name) {
        delete map[key];
        removed++;
      }
    }
  }

  if (removed > 0) {
    backupConfig(filePath, raw);
    writeJson(filePath, obj);
  }
  return { removed };
}

// ─── Claude Code (B) ────────────────────────────────

const CLAUDE_CLI_LOCATIONS = (() => {
  const home = os.homedir();
  if (process.platform === 'win32') return [] as string[];
  return [
    path.join(home, '.claude', 'local', 'claude'),
    '/opt/homebrew/bin/claude',
    '/usr/local/bin/claude',
    '/usr/bin/claude',
    path.join(home, '.npm-global', 'bin', 'claude'),
    path.join(home, '.local', 'bin', 'claude'),
    path.join(home, '.bun', 'bin', 'claude'),
    path.join(home, '.volta', 'bin', 'claude'),
  ];
})();

/**
 * Locate the `claude` CLI. GUI apps don't inherit the user's shell PATH, so we
 * probe common install paths first, then ask a login shell. Returns an absolute
 * path or null (→ the caller edits ~/.claude.json directly instead).
 */
function resolveClaudeCli(): string | null {
  for (const candidate of CLAUDE_CLI_LOCATIONS) {
    try {
      if (fs.statSync(candidate).isFile()) return candidate;
    } catch { /* keep probing */ }
  }
  if (process.platform !== 'win32') {
    try {
      const found = execFileSync('/bin/sh', ['-lc', 'command -v claude'], {
        encoding: 'utf-8',
        timeout: 1500,
      }).trim();
      if (found && fs.existsSync(found)) return found;
    } catch { /* not on PATH */ }
  }
  return null;
}

/** Set `mcpServers.<name>` in ~/.claude.json, preserving everything else. */
function writeClaudeCodeConfig(def: ServerDefinition): void {
  const filePath = getClaudeCodeConfigPath();
  const read = readJsonObject(filePath);
  const obj = read?.obj ?? {};

  if (obj['mcpServers'] !== undefined && (typeof obj['mcpServers'] !== 'object' || Array.isArray(obj['mcpServers']))) {
    throw new Error('`mcpServers` in ~/.claude.json must be an object — refusing to overwrite.');
  }
  const servers = (obj['mcpServers'] as Record<string, unknown> | undefined) ?? {};
  obj['mcpServers'] = servers;

  const entry: Record<string, unknown> = { command: def.command };
  if (def.args.length) entry['args'] = def.args;
  if (Object.keys(def.env).length) entry['env'] = def.env;
  servers[def.name] = entry;

  if (read) backupConfig(filePath, read.raw);
  writeJson(filePath, obj);
}

/** Remove `mcpServers.<name>` from ~/.claude.json. Idempotent. */
function removeFromClaudeCodeConfig(name = MCP_SERVER_KEY): { removed: number } {
  const filePath = getClaudeCodeConfigPath();
  const read = readJsonObject(filePath);
  if (!read) return { removed: 0 };
  const { raw, obj } = read;
  const servers = obj['mcpServers'];
  if (!servers || typeof servers !== 'object' || Array.isArray(servers)) return { removed: 0 };
  const map = servers as Record<string, unknown>;
  if (!(name in map)) return { removed: 0 };
  delete map[name];
  backupConfig(filePath, raw);
  writeJson(filePath, obj);
  return { removed: 1 };
}

/**
 * Register at Claude Code (user scope). Prefers the CLI (remove-then-add so it's
 * idempotent and picks up any definition change); falls back to a direct
 * ~/.claude.json edit when the CLI isn't resolvable or errors.
 */
function registerWithClaudeCode(def: ServerDefinition): 'cli' | 'file' {
  const cli = resolveClaudeCli();
  if (cli) {
    try {
      // Remove any stale entry first — `claude mcp add` errors on a duplicate.
      try {
        execFileSync(cli, ['mcp', 'remove', def.name, '--scope', 'user'], { timeout: CLI_TIMEOUT_MS, stdio: 'ignore' });
      } catch { /* not present — fine */ }
      const args = ['mcp', 'add', '--scope', 'user', def.name];
      for (const [k, v] of Object.entries(def.env)) args.push('--env', `${k}=${v}`);
      args.push('--', def.command, ...def.args);
      execFileSync(cli, args, { timeout: CLI_TIMEOUT_MS, stdio: 'ignore' });
      return 'cli';
    } catch (err) {
      console.warn('[penwright] `claude mcp add` failed, editing ~/.claude.json instead:', err);
    }
  }
  writeClaudeCodeConfig(def);
  return 'file';
}

// ─── Orchestration ──────────────────────────────────

/**
 * Make `target` the SOLE active registration, idempotently.
 *
 * Order matters: we register the chosen host FIRST and only then remove the
 * other, so a failed switch never leaves the app with zero working hosts.
 *
 *   target='meta'   → POST to Meta-MCP, then remove from Claude Code.
 *                     If Meta-MCP isn't running we report it and leave Claude
 *                     Code untouched (never silently register there).
 *   target='claude' → register at Claude Code, then remove from Meta-MCP.
 */
export async function ensureMcpTarget(target: McpTarget): Promise<EnsureResult> {
  const result: EnsureResult = {
    target,
    ok: false,
    meta: emptySide(),
    claude: emptySide(),
    access: 'expired',
  };

  let def: ServerDefinition;
  try {
    def = buildServerDefinition();
    result.access = envAccess(def.env);
  } catch (err) {
    const msg = String((err as Error).message ?? err);
    result.meta.error = msg;
    result.claude.error = msg;
    return result;
  }

  if (target === 'meta') {
    result.meta.reachable = await probeMetaMcp();
    if (!result.meta.reachable) {
      result.meta.error = 'meta-not-running';
      return result; // surface to user; leave Claude Code as-is
    }
    try {
      await registerWithMeta(def);
      result.meta.registered = true;
    } catch (err) {
      result.meta.error = String((err as Error).message ?? err);
      return result;
    }
    // Meta-MCP is now the active host → drop the Claude Code entry.
    try {
      const removed = removeFromClaudeCodeConfig(def.name);
      result.claude.unregistered = removed.removed > 0;
      result.claude.method = 'file';
    } catch (err) {
      result.claude.error = String((err as Error).message ?? err); // non-fatal
    }
    result.ok = true;
    return result;
  }

  // target === 'claude'
  try {
    result.claude.method = registerWithClaudeCode(def);
    result.claude.registered = true;
  } catch (err) {
    result.claude.error = String((err as Error).message ?? err);
    return result;
  }
  // Claude Code is now the active host → drop the Meta-MCP entry.
  try {
    const removed = unregisterFromMeta(def.name);
    result.meta.unregistered = removed.removed > 0;
  } catch (err) {
    result.meta.error = String((err as Error).message ?? err); // non-fatal
  }
  result.ok = true;
  return result;
}
