/**
 * MCP Registration — registers THIS app's MCP server with Cursor (and,
 * optionally, Claude Code).
 *
 * Cursor is the default host: every launch writes/refreshes
 * `~/.cursor/mcp.json` so the same standalone binary + Typst env the
 * Claude-Desktop wizard uses is available in Cursor without hand-editing JSON.
 *
 * Claude Code is opt-in from Help → MCP Connection (or refreshed on boot if
 * an entry is already present). Claude Desktop stays on its own wizard.
 *
 * Meta-MCP is gone. A leftover `penwright` entry in its config is stripped
 * once on boot so an old install does not keep a dead aggregator pointing at us.
 *
 * The server definition (command / args / env) is identical across hosts —
 * built via `buildServerDefinition()`.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execFileSync } from 'child_process';
import { ensureInstalledBinary, buildMcpEnv, MCP_SERVER_KEY } from './mcpSetup';

export type McpHost = 'cursor' | 'claude';

/** The app's MCP server, as every host needs to spawn it (stdio transport). */
export interface ServerDefinition {
  name: string;
  transport: 'stdio';
  command: string;
  args: string[];
  env: Record<string, string>;
}

/** Per-host outcome of a register pass. */
export interface HostResult {
  registered: boolean;
  method: 'cli' | 'file' | null;
  error: string | null;
}

export interface EnsureResult {
  ok: boolean;
  cursor: HostResult;
  claude: HostResult;
}

const CLI_TIMEOUT_MS = 8000;

function emptyHost(): HostResult {
  return { registered: false, method: null, error: null };
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

/** Cursor's global MCP config (every workspace on this machine). */
export function getCursorConfigPath(): string {
  return path.join(os.homedir(), '.cursor', 'mcp.json');
}

/** Claude Code's user-scope (global) config file. */
export function getClaudeCodeConfigPath(): string {
  return path.join(os.homedir(), '.claude.json');
}

/**
 * Meta-MCP's watched config — only used to strip a leftover entry after the
 * host was removed. Not a registration target.
 */
function getLegacyMetaConfigPath(): string {
  const home = os.homedir();
  const appId = 'com.metamcp.desktop';
  if (process.platform === 'darwin') {
    return path.join(home, 'Library', 'Application Support', appId, 'config.json');
  }
  if (process.platform === 'win32') {
    const base = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
    return path.join(base, appId, 'config.json');
  }
  const xdg = process.env.XDG_CONFIG_HOME || path.join(home, '.config');
  return path.join(xdg, appId, 'config.json');
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

function hostEntry(def: ServerDefinition): Record<string, unknown> {
  const entry: Record<string, unknown> = { command: def.command };
  if (def.args.length) entry['args'] = def.args;
  if (Object.keys(def.env).length) entry['env'] = def.env;
  return entry;
}

/** Merge `mcpServers.<name>` into a JSON object file, preserving everything else. */
function writeMcpServersEntry(filePath: string, def: ServerDefinition): void {
  const read = readJsonObject(filePath);
  const obj = read?.obj ?? {};

  if (obj['mcpServers'] !== undefined && (typeof obj['mcpServers'] !== 'object' || Array.isArray(obj['mcpServers']))) {
    throw new Error(`\`mcpServers\` in ${filePath} must be an object — refusing to overwrite.`);
  }
  const servers = (obj['mcpServers'] as Record<string, unknown> | undefined) ?? {};
  obj['mcpServers'] = servers;
  servers[def.name] = hostEntry(def);

  if (read) backupConfig(filePath, read.raw);
  writeJson(filePath, obj);
}

function hasMcpServersEntry(filePath: string, name: string): boolean {
  try {
    const read = readJsonObject(filePath);
    if (!read) return false;
    const servers = read.obj['mcpServers'];
    if (!servers || typeof servers !== 'object' || Array.isArray(servers)) return false;
    return name in (servers as Record<string, unknown>);
  } catch {
    return false;
  }
}

// ─── Cursor ─────────────────────────────────────────

export function registerWithCursor(def: ServerDefinition): void {
  writeMcpServersEntry(getCursorConfigPath(), def);
}

export function isCursorRegistered(name = MCP_SERVER_KEY): boolean {
  return hasMcpServersEntry(getCursorConfigPath(), name);
}

// ─── Claude Code ────────────────────────────────────

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

/**
 * Register at Claude Code (user scope). Prefers the CLI (remove-then-add so it's
 * idempotent and picks up any definition change); falls back to a direct
 * ~/.claude.json edit when the CLI isn't resolvable or errors.
 */
function registerWithClaudeCode(def: ServerDefinition): 'cli' | 'file' {
  const cli = resolveClaudeCli();
  if (cli) {
    try {
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
  writeMcpServersEntry(getClaudeCodeConfigPath(), def);
  return 'file';
}

export function isClaudeCodeRegistered(name = MCP_SERVER_KEY): boolean {
  return hasMcpServersEntry(getClaudeCodeConfigPath(), name);
}

// ─── Legacy Meta-MCP cleanup ────────────────────────

/**
 * Remove a leftover `penwright` entry from Meta-MCP's config.json, if the file
 * still exists. Touches ONLY our own `name`. Idempotent; missing file is a no-op.
 */
export function cleanupLegacyMetaEntry(name = MCP_SERVER_KEY): { removed: number } {
  const filePath = getLegacyMetaConfigPath();
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

// ─── Orchestration ──────────────────────────────────

/**
 * Register with Cursor (always) and refresh Claude Code if it already has us.
 * Also strips a leftover Meta-MCP entry. Idempotent; never blocks startup.
 */
export async function ensureMcpHosts(): Promise<EnsureResult> {
  const result: EnsureResult = {
    ok: false,
    cursor: emptyHost(),
    claude: emptyHost(),
  };

  let def: ServerDefinition;
  try {
    def = buildServerDefinition();
  } catch (err) {
    const msg = String((err as Error).message ?? err);
    result.cursor.error = msg;
    result.claude.error = msg;
    return result;
  }

  try {
    registerWithCursor(def);
    result.cursor.registered = true;
    result.cursor.method = 'file';
  } catch (err) {
    result.cursor.error = String((err as Error).message ?? err);
  }

  if (isClaudeCodeRegistered(def.name)) {
    try {
      result.claude.method = registerWithClaudeCode(def);
      result.claude.registered = true;
    } catch (err) {
      result.claude.error = String((err as Error).message ?? err);
    }
  }

  try {
    cleanupLegacyMetaEntry(def.name);
  } catch (err) {
    console.warn('[penwright] Meta-MCP leftover cleanup failed:', err);
  }

  result.ok = result.cursor.registered;
  return result;
}

/** Register (or refresh) a single host from the connection dialog. */
export async function registerMcpHost(host: McpHost): Promise<HostResult> {
  const out = emptyHost();
  let def: ServerDefinition;
  try {
    def = buildServerDefinition();
  } catch (err) {
    out.error = String((err as Error).message ?? err);
    return out;
  }

  try {
    if (host === 'cursor') {
      registerWithCursor(def);
      out.method = 'file';
    } else {
      out.method = registerWithClaudeCode(def);
    }
    out.registered = true;
  } catch (err) {
    out.error = String((err as Error).message ?? err);
  }
  return out;
}
