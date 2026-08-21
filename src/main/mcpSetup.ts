/**
 * MCP-Setup: registers a standalone Penwright MCP server binary in Claude
 * Desktop's config so users don't have to edit JSON by hand.
 *
 * Synova-style runtime model:
 *   - The MCP server is a Bun-compiled single-file native binary (built via
 *     `scripts/build-mcp-binary.mjs` → `dist/mcp/bin/penwright-mcp-<triple>`).
 *   - At setup, we COPY the binary out of the .app bundle into a stable
 *     user-writable location: `~/Library/Application Support/Penwright/mcp-server/penwright-mcp`.
 *   - Claude Desktop spawns that copy directly. No Node required. The
 *     process is fully decoupled from the Penwright app — quitting Penwright
 *     does not affect the MCP child, and the order of launching the two
 *     apps no longer matters.
 *
 * macOS is the tested target. Windows is wired (config path %APPDATA%\Claude,
 * binary triple x86_64-pc-windows-msvc.exe, install path %APPDATA%\Penwright)
 * but needs verification on a real Windows + Claude Desktop install. Linux is
 * excluded — Claude Desktop isn't available there.
 */

import { app, shell } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { getTypstPath, getTypstPackagePath, getTypstFontPath } from './typstPath';

/**
 * Bump when the bundled MCP binary or the config schema changes. Persisted
 * setup version in electron-store is compared against this; mismatch =>
 * the wizard prompts again so updates re-install the binary.
 */
// 0.18.0: pre-launch bug wave 1 — hero-insert anchor (generate_layout),
// markdown bold→italic import fix, DOCX nested-numbering pre-pass now shared
// with HTML (buildExportModel), serializer `//`-comment escaping.
// 0.19.0: git committer-identity fallback (ensureGitIdentity) in the server's
// version/commit tools + .penwright-* in its gitignore lines.
// 0.20.0: parity round — Session 41/42. Design writes are staged, test-compiled
// and rolled back (shared/safeApply); two new tools (list_edits /
// undo_last_edit) plus penwright_render_page returning a real image; the
// unsaved-work warning moved into the write guard so all 28 writing tools
// carry it; create_project / create_from_preset now run the same scaffold the
// app does (Git, .gitignore, sources/, .penwright/, the five skills,
// style.typ) — which means the skill TEXTS now ship inside the binary, so a
// skillTemplates.ts change requires a rebuild to reach the MCP creation paths.
// 0.21.0: phase B — the server introduces itself (`instructions`, which the
// SDK has always supported and this server never passed), all 63 tools on
// registerTool with a title and a full set of annotations from ONE table, and
// the three A3 guards: exports refuse a source extension (outputPath:
// "main.typ" used to overwrite the document with its own PDF and report
// success), the low-level git tools refuse a repository this project only sits
// inside, and the compile artefact goes to tmpdir instead of the project.
// 0.22.0: phase C-rest — document-level tools (get/add_chapter, split,
// get/update_settings, merge) act on the ROOT instead of on whatever chapter
// the user has open, and fail loudly rather than fabricate a main.typ;
// restore_version requires confirm (it is the one write with no snapshot to
// return to); replace_in_project gains dryRun; read_file and merge_document
// are capped with a visible truncation note; update_settings is typed to the
// two settings that exist; insert_reference accepts a citekey as well as a
// label — the last real capability gap.
// 0.23.0: parity audit follow-up — refreshAmbientState() runs for EVERY tool
// (it hung off two document helpers, so ~47 tools could act on a project the
// user closed hours ago, and the sandbox derived from the same stale value);
// style.json is inside the snapshot net (undo_last_edit restored style.typ and
// left the tokens on the new value); reorder/remove_chapter act on the root
// like the other four chapter tools and no longer report a reorder they did
// not perform; remove_chapter's filter is anchored to a real #include line.
// 0.24.0: chapterWrite planner (one root resolver + add/remove/reorder for
// both processes), atomic writes, the backup store readable by the AI and
// closed to its writes, user presets visible, insert_design_element takes a
// file, the handbook as an MCP resource, and four round-trip corruptions
// fixed (nbsp `~`, pagebreak args, `center + horizon`, indented headings).
// 0.27.0: the block splitter tracks Typst's two modes on a stack, so a paren
// typed into a MACRO BODY no longer merges the rest of the file into one block
// (the deserializer ships in this binary).
// 0.28.0: the project's own building blocks — `listProjectMacros` derives a
// catalogue from the `#let` definitions visible in a given file, exposed as
// penwright_list_project_macros and as the "From this project" group in the
// user's insert menu. `shared/macroCall.ts` is the one call builder both sides
// use.
// 0.29.0: Stufe 2 — `shared/macroCall.ts` gained the parser and splicer
// (parseMacroCall / setNamedArg / findMacroForBlock), and it ships in this
// binary alongside the deserializer.
// 0.30.0: Stufe 3 — tables carry their own `#table(…)` parameters verbatim and
// become cell-editable; the deserializer and `shared/macroCall.ts` both ship in
// this binary.
// 0.31.0: a table's per-column parameters (align/fill/stroke/inset) grow with
// the column count, not just `columns:` — they cycle when short, so a new
// column silently inherited column 1's styling.
// 0.32.0: table parameters moved to `shared/tableParams.ts`; the editor now
// shifts them BY POSITION when a column is added or removed, and the
// count-based reconciliation is the net for changes that bypass the table UI.
// 0.33.0: the table gear menu inserts a column/row BEFORE as well as after,
// and a multi-column delete drops every selected column's styling.
// 0.34.0: a Typst DICTIONARY (`inset: (x: 8pt, y: 4pt)`) is no longer resized
// like a per-column array — doing so duplicated a key and Typst refused the
// whole document.
// 0.35.0: three regressions the mode stack introduced — a line comment leaking
// code mode into the next line, `\\[` misread as an escaped bracket, and an
// ASCII-only identifier test that escaped a non-ASCII macro call into text.
// 0.36.0: comments are no longer read as arguments or parameters, a path field
// is always quoted, the macro walk is bounded by isPathWithin, and the MCP tool
// distinguishes "none exist" from "none visible here".
// 0.37.0: raw blocks that carry prose are classified `text` (label only — the
// exports still branch on `config` alone).
// 0.38.0: every raw block gets a human name (shared/rawBlockDescription.ts),
// and a bare `#v(…)` renders as a gap instead of a code box.
// 0.40.0: the server no longer refuses to start. The trial is gone and the MCP
// layer is ungated for everyone; PENWRIGHT_TRIAL_UNTIL is no longer written and
// PENWRIGHT_LICENSE_KEY is informational. Hosts configured by an older version
// still carry a stale trial timestamp, so the config must be rewritten.
// 0.41.0: the hand-written-style guard is asked of the PROJECT rather than of
// whatever file is open (an orphaned chapter, "Save As…" or the ↑ button used to
// walk past an authored style.typ and generate a second design system beside
// it), it writes to the file it checked, the three export paths branch on the
// marker instead of "a style.json exists", and an authored style.typ is refused
// in guardWrite — write_file and update_document replaced one outright. The
// undo path carries an explicit `restoring` exemption, or that same refusal
// would close the only way back once another route had already done damage.
// 0.42.0: MCP SDK v2 (`@modelcontextprotocol/server`), Meta-MCP removed,
// Cursor is the default host (`~/.cursor/mcp.json`), licence key env gone.
// 0.43.0: in-app Cursor chat; get_selection pin comes from "Insert into Chat".
export const MCP_SETUP_VERSION = '0.43.0';

/**
 * Key/name this app registers itself under in every MCP host — Cursor's
 * `~/.cursor/mcp.json`, Claude Desktop's `mcpServers` map, and Claude Code's
 * `~/.claude.json` all use this exact name. Deduplication on the host side
 * keys on it, so it MUST stay stable.
 */
export const MCP_SERVER_KEY = 'penwright';

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

/**
 * Platforms where the MCP setup wizard is supported. macOS is the primary
 * target; Windows is wired but needs real-device testing. Linux is excluded —
 * Claude Desktop isn't available there.
 */
export function isMcpSetupSupported(): boolean {
  return process.platform === 'darwin' || process.platform === 'win32';
}

/** Triple + executable extension of the bundled MCP binary for this platform. */
function platformBinary(): { triple: string; ext: string } {
  if (process.platform === 'win32') {
    return { triple: 'x86_64-pc-windows-msvc', ext: '.exe' };
  }
  return {
    triple: process.arch === 'arm64' ? 'aarch64-apple-darwin' : 'x86_64-apple-darwin',
    ext: '',
  };
}

/**
 * Absolute path to the bundled MCP binary inside the .app (prod) or
 * the dev build output (dev). The setup step copies this OUT to a
 * stable user-writable location; the source should never be executed
 * directly because the .app path changes when users move the app.
 */
export function getBundledBinaryPath(): string {
  const { triple, ext } = platformBinary();
  const filename = `penwright-mcp-${triple}${ext}`;
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'mcp', 'bin', filename);
  }
  return path.resolve(__dirname, '..', '..', 'dist', 'mcp', 'bin', filename);
}

/** Stable, user-writable location the binary is copied to during setup. */
export function getInstalledBinaryPath(): string {
  if (process.platform === 'win32') {
    const base = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
    return path.join(base, 'Penwright', 'mcp-server', 'penwright-mcp.exe');
  }
  return path.join(
    os.homedir(),
    'Library',
    'Application Support',
    'Penwright',
    'mcp-server',
    'penwright-mcp',
  );
}

// ─── Claude Desktop discovery ───────────────────────

function claudeAppCandidates(): string[] {
  const home = os.homedir();
  if (process.platform === 'darwin') {
    return [
      '/Applications/Claude.app',
      path.join(home, 'Applications', 'Claude.app'),
    ];
  }
  if (process.platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local');
    return [
      path.join(localAppData, 'Programs', 'Claude', 'Claude.exe'),
      path.join(localAppData, 'Claude', 'Claude.exe'),
    ];
  }
  return [];
}

export function checkClaudeDesktopInstalled(): ClaudeCheck {
  const candidates = claudeAppCandidates();
  const installed = candidates.some(p => {
    try { return fs.existsSync(p); } catch { return false; }
  });
  return { installed, pathsChecked: candidates };
}

export function getClaudeConfigPath(): string {
  const home = os.homedir();
  if (process.platform === 'darwin') {
    return path.join(
      home,
      'Library',
      'Application Support',
      'Claude',
      'claude_desktop_config.json',
    );
  }
  if (process.platform === 'win32') {
    const base = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
    return path.join(base, 'Claude', 'claude_desktop_config.json');
  }
  throw new Error('MCP setup is only supported on macOS and Windows.');
}

// ─── Open Claude.app ────────────────────────────────

export async function openClaudeDesktop(): Promise<void> {
  if (!isMcpSetupSupported()) {
    throw new Error('Opening Claude Desktop is only supported on macOS and Windows.');
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
    console.warn('[penwright] chmod 755 on MCP binary failed:', err);
  }
}

/**
 * Copy the bundled MCP binary out to the stable user-writable location and
 * return that path. Shared by the Claude-Desktop wizard (`setupMcpServer`) and
 * the Cursor / Claude-Code registration engine (`mcpRegistration.ts`) so all
 * hosts point at the exact same runnable binary.
 *
 * Rewrites on every call so updating Penwright upgrades the sidecar in
 * lockstep. In dev, if the bundle output hasn't been built yet but a prior
 * install exists, that install is reused; otherwise this throws with a
 * build hint.
 */
export function ensureInstalledBinary(): string {
  const installed = getInstalledBinaryPath();
  const bundled = getBundledBinaryPath();
  if (!fs.existsSync(bundled)) {
    if (fs.existsSync(installed)) return installed;
    throw new Error(
      `Bundled MCP binary not found at ${bundled}. ` +
      (app.isPackaged
        ? 'Reinstall Penwright or contact support — the binary is missing from the bundle.'
        : 'Run `node scripts/build-mcp-binary.mjs` first.'),
    );
  }
  copyExecutable(bundled, installed);
  return installed;
}

/**
 * Build the environment block every MCP host gets for the Penwright server.
 *
 *   - TYPST_BIN / TYPST_PACKAGE_PATH / TYPST_FONT_PATH → the bundled Typst
 *     toolchain so the decoupled server compiles/exports on a machine with no
 *     system Typst. All three point into the current .app's Resources.
 *
 * Never throws.
 */
export function buildMcpEnv(): { env: Record<string, string> } {
  const env: Record<string, string> = {};
  const typstBin = getTypstPath();
  if (typstBin && path.isAbsolute(typstBin)) env['TYPST_BIN'] = typstBin;
  const pkgPath = getTypstPackagePath();
  if (pkgPath) env['TYPST_PACKAGE_PATH'] = pkgPath;
  const fontPath = getTypstFontPath();
  if (fontPath) env['TYPST_FONT_PATH'] = fontPath;
  // The bundled preset library sits next to the packages (…/Resources/presets),
  // so the decoupled MCP child can create projects from a preset offline.
  if (pkgPath) {
    const presetsPath = path.join(path.dirname(pkgPath), 'presets');
    if (fs.existsSync(presetsPath)) env['PENWRIGHT_PRESETS'] = presetsPath;
    // Same idea for the handbook: the server exposes it as an MCP resource so
    // the agent can answer "how do I do X in Penwright" from the actual manual
    // instead of guessing, and point the user at the right menu item. Shipped
    // as a file rather than embedded, so a doc fix does not need a binary
    // rebuild.
    const docsPath = path.join(path.dirname(pkgPath), 'docs');
    if (fs.existsSync(docsPath)) env['PENWRIGHT_DOCS'] = docsPath;
  }
  return { env };
}

/**
 * Merge the Penwright entry into Claude Desktop's `mcpServers` map without
 * touching any other server entries.
 *
 * Behaviour:
 *   - File exists       → read, take timestamped backup, rewrite.
 *   - File missing/empty → create fresh with only the Penwright entry; no backup.
 *   - File malformed    → bail out instead of overwriting so the user can
 *                         fix it manually.
 */
export async function setupMcpServer(): Promise<SetupResult> {
  if (!isMcpSetupSupported()) {
    throw new Error('MCP setup is only supported on macOS and Windows.');
  }

  // The env carries the Typst toolchain so Claude Desktop can spawn the
  // server independently of whether Penwright is running.
  const mcpEnv = buildMcpEnv();

  // Copy into a stable, user-writable location. We rewrite on every run
  // so updating Penwright upgrades the sidecar in lockstep.
  const installed = ensureInstalledBinary();

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

  // Standalone-binary config: no Node required. The config file sits in
  // the user-only-readable Library directory.
  //
  // We pass `TYPST_BIN`, `TYPST_PACKAGE_PATH` and `TYPST_FONT_PATH` so the
  // MCP server's `typst compile` calls work on a machine with NO system Typst:
  //   - TYPST_BIN     → the bundled Typst binary (compile / export / verify).
  //   - TYPST_PACKAGE_PATH → bundled @preview/* packages (cetz, fletcher, …).
  //   - TYPST_FONT_PATH    → bundled OFL fonts (Inter, IBM Plex, Crimson Pro,
  //                          Spectral, …) so nothing depends on system fonts.
  // All three point into the currently-installed .app's Resources — re-running
  // the wizard after the user moves Penwright refreshes the entry. Without
  // TYPST_BIN the MCP server falls back to bare `typst` on PATH, which a clean
  // machine doesn't have → compile/export would fail. (The .mcpb distribution
  // sets the same var via its manifest; the in-app wizard must match.)
  const { env } = mcpEnv;

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
    const backupName = `.claude_desktop_config.penwright-bak.${stamp}.json`;
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
