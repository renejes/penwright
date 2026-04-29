/**
 * Local Crash Reporter — captures uncaught exceptions and renderer errors,
 * writes plaintext reports to <userData>/crash-reports/, and serves the
 * latest unread report to the renderer for display on next boot.
 *
 * Privacy-first: no data leaves the user's machine. The renderer-side
 * dialog gives the user explicit choices to copy, open, or e-mail the
 * report. File paths are scrubbed of usernames before writing.
 */

import { app, crashReporter as electronCrashReporter } from 'electron';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const REPORTS_DIRNAME = 'crash-reports';
const SHOWN_MARKER = '.last-shown';
const MAX_REPORTS = 10;
const MAX_BREADCRUMBS = 50;

type ProcessKind = 'main' | 'renderer';

interface Breadcrumb {
  ts: number;
  kind: string;
  message: string;
}

export interface RendererCrashPayload {
  message: string;
  stack: string;
  source?: string;
  type?: 'error' | 'unhandledrejection';
  /** Optional breadcrumbs from the renderer's own ring buffer, merged before main's. */
  breadcrumbs?: Breadcrumb[];
}

const breadcrumbs: Breadcrumb[] = [];

/**
 * Adds an event to the in-memory ring buffer. Call this from key surfaces
 * (project open, save, compile, export …) so the post-crash report has
 * context. Keep messages free of file content / PII — we record event
 * kinds, not data.
 */
export function addBreadcrumb(kind: string, message: string): void {
  breadcrumbs.push({ ts: Date.now(), kind, message });
  if (breadcrumbs.length > MAX_BREADCRUMBS) {
    breadcrumbs.shift();
  }
}

function reportsDir(): string {
  return path.join(app.getPath('userData'), REPORTS_DIRNAME);
}

function ensureReportsDir(): string {
  const dir = reportsDir();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function timestampSlug(date: Date): string {
  // Millisecond + 4-char random suffix so two crashes in the same second
  // (uncaughtException + unhandledRejection from the same root cause) can't
  // collide on filename and silently overwrite each other.
  const ms = String(date.getMilliseconds()).padStart(3, '0');
  const rand = Math.random().toString(36).slice(2, 6);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}-${ms}-${rand}`;
}

function formatDateTime(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

/**
 * Replaces user-identifying parts of paths with `<redacted>` so the report
 * can be safely shared. Catches macOS, Linux, and Windows home dirs.
 */
function scrubPaths(text: string): string {
  return text
    .replace(/[/\\]Users[/\\][^/\\\s'":]+/g, '/Users/<redacted>')
    .replace(/[/\\]home[/\\][^/\\\s'":]+/g, '/home/<redacted>')
    .replace(/C:\\Users\\[^\\\s'":]+/gi, 'C:\\Users\\<redacted>');
}

function platformInfo(): string {
  return `${process.platform} ${os.release()} (${process.arch})`;
}

function countProjectFiles(dir: string): number {
  try {
    let count = 0;
    const walk = (d: string, depth: number): void => {
      if (depth > 3) return;
      const entries = fs.readdirSync(d, { withFileTypes: true });
      for (const e of entries) {
        if (e.name.startsWith('.')) continue;
        const full = path.join(d, e.name);
        if (e.isDirectory()) walk(full, depth + 1);
        else count++;
      }
    };
    walk(dir, 0);
    return count;
  } catch {
    return 0;
  }
}

function buildReport(args: {
  process: ProcessKind;
  errorName: string;
  errorMessage: string;
  stack: string;
  type?: string;
  rendererBreadcrumbs?: Breadcrumb[];
}): string {
  const now = new Date();
  const v = process.versions;
  const versions = {
    electron: v.electron ?? 'n/a',
    node: v.node ?? 'n/a',
    chrome: v.chrome ?? 'n/a',
  };

  let projectInfoLines: string[] = [];
  try {
    // Lazy import to keep this module decoupled from appState wiring.
    // Failure here is fine — we just skip the project block.
    const { appState } = require('./appState') as typeof import('./appState');
    if (appState.projectDir) {
      const fileCount = countProjectFiles(appState.projectDir);
      projectInfoLines = [
        '',
        'Projekt-Kontext (anonymisiert)',
        '------------------------------',
        `  Anzahl Dateien:             ${fileCount}`,
        `  Editor offen:               ${appState.currentFilePath ? 'ja' : 'nein'}`,
        `  Ungespeicherte Aenderungen: ${appState.isDirty ? 'ja' : 'nein'}`,
        `  Projektpfad:                <gekuerzt>`,
      ];
    }
  } catch {
    /* ignore */
  }

  const merged = [...(args.rendererBreadcrumbs ?? []), ...breadcrumbs]
    .sort((a, b) => a.ts - b.ts)
    .slice(-MAX_BREADCRUMBS);

  const breadcrumbLines = merged.length === 0
    ? '  (keine erfasst)'
    : merged
        .map(b => {
          const t = new Date(b.ts);
          return `  ${pad(t.getHours())}:${pad(t.getMinutes())}:${pad(t.getSeconds())}  ${b.kind.padEnd(12)} ${b.message}`;
        })
        .join('\n');

  const lines = [
    'vswrite Crash Report',
    '====================',
    '',
    `Datum:          ${formatDateTime(now)}`,
    `App-Version:    ${app.getVersion()}`,
    `Plattform:      ${platformInfo()}`,
    `Electron:       ${versions.electron}   Node: ${versions.node}   Chromium: ${versions.chrome}`,
    `Sprache:        ${app.getLocale()}`,
    `Prozess:        ${args.process}${args.type ? ` (${args.type})` : ''}`,
    '',
    'Fehler',
    '------',
    `${args.errorName}: ${args.errorMessage}`,
    '',
    'Stack-Trace',
    '-----------',
    args.stack.split('\n').map(l => '  ' + l.trim()).filter(l => l.trim().length > 0).join('\n'),
    '',
    'Letzte Aktionen',
    '---------------',
    breadcrumbLines,
    ...projectInfoLines,
    '',
    '----',
    'Wie weiter? Du kannst diesen Bericht …',
    '  • per E-Mail an feedback@vswrite.com schicken',
    '  • oder als Issue auf https://github.com/renejes/vswrite-desktop/issues anhaengen',
    '',
  ];

  return scrubPaths(lines.join('\n'));
}

function writeReport(content: string): string | null {
  try {
    const dir = ensureReportsDir();
    const filename = `${timestampSlug(new Date())}.txt`;
    const fullPath = path.join(dir, filename);
    fs.writeFileSync(fullPath, content, 'utf-8');

    // Rotation: keep only the last MAX_REPORTS .txt files.
    const files = fs.readdirSync(dir)
      .filter(f => f.endsWith('.txt'))
      .sort();
    while (files.length > MAX_REPORTS) {
      const oldest = files.shift()!;
      try { fs.unlinkSync(path.join(dir, oldest)); } catch {}
    }

    return fullPath;
  } catch (err) {
    console.error('[vswrite] failed to write crash report:', err);
    return null;
  }
}

export function captureMainCrash(error: Error | unknown, type?: string): string | null {
  const err = error instanceof Error ? error : new Error(String(error));
  const content = buildReport({
    process: 'main',
    errorName: err.name || 'Error',
    errorMessage: err.message || String(err),
    stack: err.stack || '(no stack trace available)',
    type,
  });
  return writeReport(content);
}

export function captureRendererCrash(payload: RendererCrashPayload): string | null {
  const messageOnly = payload.message || 'Unknown error';
  const colonIdx = messageOnly.indexOf(':');
  const name = colonIdx > 0 && colonIdx < 40 ? messageOnly.slice(0, colonIdx) : 'Error';
  const msg = colonIdx > 0 && colonIdx < 40 ? messageOnly.slice(colonIdx + 1).trim() : messageOnly;

  const content = buildReport({
    process: 'renderer',
    errorName: name,
    errorMessage: msg,
    stack: payload.stack || '(no stack trace available)',
    type: payload.type,
    rendererBreadcrumbs: payload.breadcrumbs,
  });
  return writeReport(content);
}

export interface UnshownReport {
  content: string;
  filename: string;
  ts: number;
}

/**
 * Returns the most recent crash report that hasn't been shown yet,
 * or null if there's nothing new to display. Comparison is by file
 * mtime against `<reports>/.last-shown`.
 */
export function getLatestUnshownReport(): UnshownReport | null {
  const dir = reportsDir();
  if (!fs.existsSync(dir)) return null;

  const markerPath = path.join(dir, SHOWN_MARKER);
  let lastShownTs = 0;
  if (fs.existsSync(markerPath)) {
    try {
      // mtimeMs is a float (millisecond precision with sub-ms fractional part).
      // Use Number, not parseInt — parseInt would truncate the fraction and the
      // marker would always test as "older" than the file it was supposed to mark.
      const parsed = Number(fs.readFileSync(markerPath, 'utf-8').trim());
      if (Number.isFinite(parsed)) lastShownTs = parsed;
    } catch {
      /* ignore */
    }
  }

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return null;
  }

  const reports = entries
    .filter(e => e.isFile() && e.name.endsWith('.txt'))
    .map(e => {
      const full = path.join(dir, e.name);
      try {
        return { name: e.name, mtime: fs.statSync(full).mtimeMs, full };
      } catch {
        return null;
      }
    })
    .filter((x): x is { name: string; mtime: number; full: string } => x !== null)
    .sort((a, b) => b.mtime - a.mtime);

  if (reports.length === 0) return null;
  const latest = reports[0];
  if (latest.mtime <= lastShownTs) return null;

  try {
    return {
      content: fs.readFileSync(latest.full, 'utf-8'),
      filename: latest.name,
      ts: latest.mtime,
    };
  } catch {
    return null;
  }
}

/**
 * Updates the last-shown marker so the dialog won't reappear on next boot
 * for the same crash. We mark by mtime of the most recent report.
 */
export function markLatestAsShown(): void {
  const dir = reportsDir();
  if (!fs.existsSync(dir)) return;

  let newest = 0;
  try {
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith('.txt')) continue;
      const m = fs.statSync(path.join(dir, f)).mtimeMs;
      if (m > newest) newest = m;
    }
  } catch {
    return;
  }
  if (newest === 0) return;

  try {
    fs.writeFileSync(path.join(dir, SHOWN_MARKER), String(newest), 'utf-8');
  } catch {
    /* ignore */
  }
}

export function deleteAllReports(): void {
  const dir = reportsDir();
  if (!fs.existsSync(dir)) return;
  try {
    for (const f of fs.readdirSync(dir)) {
      try { fs.unlinkSync(path.join(dir, f)); } catch {}
    }
  } catch {
    /* ignore */
  }
}

export function getReportsDir(): string {
  return reportsDir();
}

/**
 * Wires up uncaughtException + unhandledRejection handlers in the main
 * process and starts Electron's native crash reporter (covers Chromium /
 * V8 / native module crashes that bypass the JS runtime).
 *
 * Should be called once, as early as possible in main-process startup.
 */
export function setupCrashCapture(): void {
  // Native crash reporter — uploadToServer:false keeps everything local.
  // Minidumps land in `<userData>/Crashpad` and are not auto-deleted, but
  // our text reports are the user-facing surface.
  try {
    electronCrashReporter.start({
      uploadToServer: false,
      submitURL: '',
      productName: 'vswrite',
    });
  } catch (err) {
    console.warn('[vswrite] crashReporter setup failed:', err);
  }

  // Native source-map support — Node ≥ 12 can resolve stack-trace lines
  // back to .ts files when source maps are emitted (electron-vite does
  // this by default).
  try {
    process.setSourceMapsEnabled?.(true);
  } catch {
    /* ignore */
  }

  process.on('uncaughtException', (err) => {
    captureMainCrash(err, 'uncaughtException');
    console.error('[vswrite] uncaughtException:', err);
  });

  process.on('unhandledRejection', (reason) => {
    captureMainCrash(reason, 'unhandledRejection');
    console.error('[vswrite] unhandledRejection:', reason);
  });

  addBreadcrumb('lifecycle', 'main process started');
}
