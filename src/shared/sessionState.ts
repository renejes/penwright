/**
 * What the app is doing, readable by the MCP server.
 *
 * The two processes share only the project folder — there is no IPC between
 * them. So the agent could not know which project the user has open, which
 * file they are looking at, or whether that file has unsaved edits. "Rewrite
 * the last paragraph" therefore hit whatever `findRootFileIn` happened to
 * return, which on a multi-chapter project is the root, not the chapter on
 * screen. And a pinned selection could point at text that only exists in the
 * editor buffer.
 *
 * `.penwright/selection.json` already proved the pattern works across this
 * boundary; this is the same idea for the ambient state. Two files:
 *
 *   <project>/.penwright/session.json   — which file, is it dirty
 *   <appData>/active-project.json       — which project at all
 *
 * The second one has to live outside any project, because "which project" is
 * exactly what a reader does not know yet. Its location is derived with the
 * same formula both processes use for the installed MCP binary, so they agree
 * without either being told.
 *
 * Writing is the app's job only. The MCP server reads and never writes here —
 * a stale file must never be able to make the app follow the agent around.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

export const SESSION_VERSION = 1;

/** How long a session file is trusted after its last update. */
const MAX_SESSION_AGE_MS = 12 * 60 * 60 * 1000;

export interface SessionState {
  version: number;
  /** Absolute path of the project this session belongs to. */
  projectDir: string;
  /** Absolute path of the file open in the editor, or null. */
  currentFile: string | null;
  /** True when the editor buffer differs from what is on disk. */
  isDirty: boolean;
  /**
   * Whether the document last compiled.
   *
   * The one piece of rendered-state the channel carries, and it is here for a
   * specific reason: without it an agent cannot tell a break IT caused from one
   * that was already there. Both look identical from a compile that fails
   * after a change. Knowing the document was already red turns "undo what I
   * just did" into "fix what was broken before I started" — a different
   * decision, which is the bar anything on this channel has to clear.
   *
   * Deliberately NOT joined by cursor, selection, scroll position or the
   * buffer itself. Those would make session.json a mirror of the editor: a
   * second truth that can go stale, growing a field at a time, and none of
   * them changes what the agent does.
   */
  lastCompileOk: boolean;
  /** Process id of the app that wrote this, for liveness checks. */
  pid: number;
  updatedAt: number;
}

/** `~/Library/Application Support/Penwright` (macOS) / `%APPDATA%\Penwright`. */
export function penwrightAppDataDir(): string {
  if (process.platform === 'win32') {
    const base = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
    return path.join(base, 'Penwright');
  }
  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', 'Penwright');
  }
  return path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'Penwright');
}

export function activeProjectPath(): string {
  return path.join(penwrightAppDataDir(), 'active-project.json');
}

export function sessionPath(projectDir: string): string {
  return path.join(projectDir, '.penwright', 'session.json');
}

function writeJson(file: string, data: unknown): void {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
  } catch {
    // Ambient state is a convenience, never a precondition — a failure here
    // must not break opening or saving a file.
  }
}

function readJson<T>(file: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8')) as T;
  } catch {
    return null;
  }
}

// ─── Which project (global) ──────────────────────────────────────────

export function writeActiveProject(projectDir: string | null): void {
  if (projectDir === null) {
    try { fs.unlinkSync(activeProjectPath()); } catch {}
    return;
  }
  writeJson(activeProjectPath(), {
    version: SESSION_VERSION,
    projectDir: path.resolve(projectDir),
    pid: process.pid,
    updatedAt: Date.now(),
  });
}

/**
 * The project the app currently has open, or null. Only returned when the
 * writing process is still alive and the record is recent — otherwise a
 * crashed session would keep pointing an agent at a project the user left.
 */
export function readActiveProject(): string | null {
  const raw = readJson<{ projectDir?: string; pid?: number; updatedAt?: number }>(activeProjectPath());
  if (!raw?.projectDir || typeof raw.updatedAt !== 'number') return null;
  if (!isLive(raw.pid, raw.updatedAt)) return null;
  return fs.existsSync(raw.projectDir) ? raw.projectDir : null;
}

// ─── Which file (per project) ────────────────────────────────────────

export function writeSession(state: Omit<SessionState, 'version' | 'pid' | 'updatedAt'>): void {
  writeJson(sessionPath(state.projectDir), {
    version: SESSION_VERSION,
    projectDir: path.resolve(state.projectDir),
    currentFile: state.currentFile ? path.resolve(state.currentFile) : null,
    isDirty: state.isDirty,
    lastCompileOk: state.lastCompileOk,
    pid: process.pid,
    updatedAt: Date.now(),
  } satisfies SessionState);
}

export function clearSession(projectDir: string): void {
  try { fs.unlinkSync(sessionPath(projectDir)); } catch {}
}

/** The app's live view of this project, or null when there is none to trust. */
export function readSession(projectDir: string): SessionState | null {
  const s = readJson<SessionState>(sessionPath(projectDir));
  if (!s || s.version !== SESSION_VERSION || typeof s.updatedAt !== 'number') return null;
  if (!isLive(s.pid, s.updatedAt)) return null;
  return s;
}

/**
 * True when the app has this exact file open with unsaved edits — the one
 * case where writing to it means overwriting something nobody has seen yet.
 */
export function isDirtyInEditor(projectDir: string, absFile: string): boolean {
  const s = readSession(projectDir);
  return !!s && s.isDirty && !!s.currentFile && path.resolve(s.currentFile) === path.resolve(absFile);
}

// ─── The other direction: what is the agent doing? ───────────────────
//
// Everything above flows app → MCP, and that stays one-way on purpose: a
// stale agent record must never be able to steer the app.
//
// This is the return channel, and it is built to be ignorable. The MCP server
// writes a line about what it is working on; the app SHOWS it and obeys
// nothing. No file gets locked, no save is deferred, no dialog appears. If the
// agent crashes mid-task the record simply ages out.
//
// The reason it exists at all: today the user watches the file tree flicker
// and the preview recompile with no idea which of those was them and which was
// the agent — and "did Claude do anything?" is the question the design panel
// used to answer wrongly. A caption under the status bar settles it.

/**
 * How long an activity record is worth showing.
 *
 * Long enough that the app's poll reliably catches a burst of edits, short
 * enough that it clears itself once the agent goes quiet — there is no "I am
 * done" signal, and inventing one would mean a crashed agent leaves "rewriting
 * chapter 3" on screen forever.
 */
const MAX_ACTIVITY_AGE_MS = 2 * 60 * 1000;

export interface AgentActivity {
  version: number;
  /** Short, human-readable: "rewriting chapters/03-method.typ". */
  what: string;
  /** Project-relative paths the agent is touching, if it knows them. */
  files: string[];
  /** Process id of the agent, so a dead one can be spotted. */
  pid: number;
  updatedAt: number;
}

export function agentActivityPath(projectDir: string): string {
  return path.join(projectDir, '.penwright', 'agent-activity.json');
}

/** Written by the MCP server only. */
export function writeAgentActivity(projectDir: string, what: string, files: string[] = []): void {
  writeJson(agentActivityPath(projectDir), {
    version: SESSION_VERSION,
    what: what.slice(0, 200),
    files: files.slice(0, 20),
    pid: process.pid,
    updatedAt: Date.now(),
  } satisfies AgentActivity);
}

export function clearAgentActivity(projectDir: string): void {
  try { fs.unlinkSync(agentActivityPath(projectDir)); } catch { /* never written */ }
}

/**
 * What the agent says it is doing, or null.
 *
 * Read by the app for display. Returns null for a record that is stale or
 * whose process is gone — an agent that died holding "rewriting chapter 3"
 * must not leave that on screen for the rest of the session.
 */
export function readAgentActivity(projectDir: string): AgentActivity | null {
  const a = readJson<AgentActivity>(agentActivityPath(projectDir));
  if (!a || typeof a.what !== 'string' || typeof a.updatedAt !== 'number') return null;
  if (Date.now() - a.updatedAt > MAX_ACTIVITY_AGE_MS) return null;
  if (!isLive(a.pid, a.updatedAt)) return null;
  return { ...a, files: Array.isArray(a.files) ? a.files : [] };
}

function isLive(pid: number | undefined, updatedAt: number): boolean {
  if (Date.now() - updatedAt > MAX_SESSION_AGE_MS) return false;
  if (typeof pid !== 'number') return false;
  try {
    // Signal 0 performs the permission/existence check without delivering.
    process.kill(pid, 0);
    return true;
  } catch (err) {
    // EPERM means the process exists but belongs to someone else — still alive.
    return (err as NodeJS.ErrnoException).code === 'EPERM';
  }
}
