/**
 * Persistence Manager — electron-store based state persistence.
 *
 * Saves and restores: window bounds, panel state, recent projects,
 * last project path, onboarding flag, Zotero path, license, backup config.
 *
 * Auto-backups live INSIDE each project at <projectDir>/.penwright/backups/<timestamp>/
 * so that projects are self-contained and travel with their history.
 */

import Store from 'electron-store';
import * as path from 'path';
import * as fs from 'fs';
import { app, safeStorage } from 'electron';
import {
  type ProjectStyle,
  DEFAULT_PROJECT_STYLE,
  sanitizeProjectStyle,
} from '../shared/styleTypes';
import type { SelectionPin } from '../shared/selectionTypes';

export interface RecentProject {
  path: string;
  name: string;
  timestamp: number;
}

export interface WindowBounds {
  x?: number;
  y?: number;
  width: number;
  height: number;
  isMaximized: boolean;
}

export interface PanelState {
  showSidebar: boolean;
  showPreview: boolean;
  sidebarTab: string;
  sidebarWidth: number;
  previewWidth: number;
}

export interface LicenseData {
  licenseKey: string | null;
  activationId: string | null;
  licenseTier: 'basic' | 'pro' | null;
  licenseStatus: 'active' | 'expired' | null;
  lastValidation: number;
}

export interface BackupConfig {
  /** Seconds between automatic backup snapshots. */
  intervalSec: number;
  /** Maximum number of snapshots kept per project — older snapshots are pruned. */
  maxCount: number;
  /** Maximum number of AI-edit snapshots kept per project. */
  maxAiSnapshots: number;
}

interface StoreSchema {
  windowBounds: WindowBounds;
  panelState: PanelState;
  recentProjects: RecentProject[];
  lastProjectPath: string | null;
  onboardingSeen: boolean;
  /** Epoch ms when the local 14-day trial first started; null until first launch records it. */
  trialStartedAt: number | null;
  zoteroBibPath: string | null;
  /** Encrypted (OS keychain) base64 blob containing the full LicenseData payload. */
  licenseBlob: string | null;
  backupConfig: BackupConfig;
  /** Last MCP_SETUP_VERSION the user ran the Claude-Desktop setup for. */
  mcpSetupVersion: string | null;
  /**
   * Which host this app registers its MCP server with: 'meta' (Meta-MCP proxy)
   * or 'claude' (Claude Code, user scope). `null` = not yet chosen; the app
   * applies a sensible default (Meta-MCP if reachable, else Claude Code) and
   * the connection dialog auto-offers the choice until the user decides.
   */
  mcpTarget: 'meta' | 'claude' | null;
  /** UI language ('de' | 'en'); null until the user picks one (then OS-resolved). */
  locale: 'de' | 'en' | null;
  /** Preview recompile behaviour: 'auto' (debounced while typing) or 'manual' (Refresh button only). */
  previewMode: 'auto' | 'manual';
}

const DEFAULT_BACKUP_CONFIG: BackupConfig = {
  intervalSec: 30,
  maxCount: 30,
  maxAiSnapshots: 20,
};

const store = new Store<StoreSchema>({
  name: 'penwright-settings',
  defaults: {
    windowBounds: {
      width: 1200,
      height: 800,
      isMaximized: false,
    },
    panelState: {
      showSidebar: true,
      showPreview: false,
      sidebarTab: 'files',
      sidebarWidth: 220,
      previewWidth: 400,
    },
    recentProjects: [],
    lastProjectPath: null,
    onboardingSeen: false,
    trialStartedAt: null,
    zoteroBibPath: null,
    licenseBlob: null,
    backupConfig: DEFAULT_BACKUP_CONFIG,
    mcpSetupVersion: null,
    mcpTarget: null,
    locale: null,
    previewMode: 'auto',
  },
});

const MAX_RECENT_PROJECTS = 10;

// ─── Window Bounds ───────────────────────────────

export function getWindowBounds(): WindowBounds {
  return store.get('windowBounds');
}

export function saveWindowBounds(bounds: WindowBounds): void {
  store.set('windowBounds', bounds);
}

// ─── Panel State ─────────────────────────────────

export function getPanelState(): PanelState {
  return store.get('panelState');
}

export function savePanelState(state: PanelState): void {
  store.set('panelState', state);
}

// ─── Recent Projects ─────────────────────────────
// `path` is the *project folder* path. Entries that no longer point to an
// existing folder are filtered out at read time.

export function getRecentProjects(): RecentProject[] {
  const recent = store.get('recentProjects');
  return recent.filter(p => {
    try {
      return fs.existsSync(p.path) && fs.statSync(p.path).isDirectory();
    } catch {
      return false;
    }
  });
}

export function addRecentProject(projectFolder: string, name?: string): void {
  const recent = store.get('recentProjects');
  const filtered = recent.filter(p => p.path !== projectFolder);
  filtered.unshift({
    path: projectFolder,
    name: name || path.basename(projectFolder) || projectFolder,
    timestamp: Date.now(),
  });
  store.set('recentProjects', filtered.slice(0, MAX_RECENT_PROJECTS));
}

export function removeRecentProject(projectFolder: string): void {
  const recent = store.get('recentProjects');
  store.set('recentProjects', recent.filter(p => p.path !== projectFolder));
}

// ─── Last Project (auto-reopen) ──────────────────

export function getLastProjectPath(): string | null {
  return store.get('lastProjectPath');
}

export function saveLastProjectPath(filePath: string | null): void {
  store.set('lastProjectPath', filePath);
}

// ─── Onboarding ──────────────────────────────────

export function isOnboardingSeen(): boolean {
  return store.get('onboardingSeen');
}

export function setOnboardingSeen(seen: boolean): void {
  store.set('onboardingSeen', seen);
}

// ─── UI Locale ───────────────────────────────────
// Global (per-device) interface language. Stored as 'de' | 'en'; `null` until
// the user picks one, at which point we resolve from the OS locale on the fly.

export function getLocale(): 'de' | 'en' {
  const stored = store.get('locale');
  if (stored === 'de' || stored === 'en') return stored;
  try {
    return app.getLocale().toLowerCase().startsWith('de') ? 'de' : 'en';
  } catch {
    return 'en';
  }
}

export function setLocale(locale: string): void {
  store.set('locale', locale === 'de' ? 'de' : 'en');
}

// ─── Preview mode ────────────────────────────────
// Whether the live PDF preview recompiles automatically while typing ('auto',
// debounced) or only when the user clicks Refresh ('manual'). Global default.

export function getPreviewMode(): 'auto' | 'manual' {
  return store.get('previewMode') === 'manual' ? 'manual' : 'auto';
}

export function setPreviewMode(mode: string): void {
  store.set('previewMode', mode === 'manual' ? 'manual' : 'auto');
}

// ─── Local Trial ─────────────────────────────────
// First launch stamps `trialStartedAt`; the 14-day clock is read from it.
// Stored in global electron-store (not per-project) so the trial is per-device.

export function getTrialStartedAt(): number | null {
  return store.get('trialStartedAt');
}

/** Returns the trial start (epoch ms), recording `Date.now()` on first call. */
export function ensureTrialStarted(): number {
  let t = store.get('trialStartedAt');
  if (!t) {
    t = Date.now();
    store.set('trialStartedAt', t);
  }
  return t;
}

// ─── MCP Setup Version ──────────────────────────

export function getMcpSetupVersion(): string | null {
  return store.get('mcpSetupVersion');
}

export function saveMcpSetupVersion(version: string | null): void {
  store.set('mcpSetupVersion', version);
}

// ─── MCP Registration Target ────────────────────
// Which host this app registers its MCP server with. `null` until the user
// (or the smart default) decides; see mcpRegistration.ts.

export function getMcpTarget(): 'meta' | 'claude' | null {
  const t = store.get('mcpTarget');
  return t === 'meta' || t === 'claude' ? t : null;
}

export function setMcpTarget(target: 'meta' | 'claude'): void {
  store.set('mcpTarget', target === 'claude' ? 'claude' : 'meta');
}

// ─── Zotero ──────────────────────────────────────

export function getZoteroBibPath(): string | null {
  return store.get('zoteroBibPath');
}

export function saveZoteroBibPath(bibPath: string | null): void {
  store.set('zoteroBibPath', bibPath);
}

// ─── License ────────────────────────────────────

const EMPTY_LICENSE: LicenseData = {
  licenseKey: null,
  activationId: null,
  licenseTier: null,
  licenseStatus: null,
  lastValidation: 0,
};

export function getLicenseData(): LicenseData {
  const blob = store.get('licenseBlob');
  if (!blob) return { ...EMPTY_LICENSE };
  try {
    if (!safeStorage.isEncryptionAvailable()) return { ...EMPTY_LICENSE };
    const decrypted = safeStorage.decryptString(Buffer.from(blob, 'base64'));
    const parsed = JSON.parse(decrypted) as LicenseData;
    if (typeof parsed !== 'object' || parsed === null) return { ...EMPTY_LICENSE };
    return {
      licenseKey: typeof parsed.licenseKey === 'string' ? parsed.licenseKey : null,
      activationId: typeof parsed.activationId === 'string' ? parsed.activationId : null,
      licenseTier: parsed.licenseTier === 'pro' || parsed.licenseTier === 'basic' ? parsed.licenseTier : null,
      licenseStatus: parsed.licenseStatus === 'active' || parsed.licenseStatus === 'expired' ? parsed.licenseStatus : null,
      lastValidation: typeof parsed.lastValidation === 'number' ? parsed.lastValidation : 0,
    };
  } catch {
    return { ...EMPTY_LICENSE };
  }
}

export function saveLicenseData(data: LicenseData): void {
  if (!safeStorage.isEncryptionAvailable()) {
    console.warn('[penwright] safeStorage unavailable — license cannot be persisted securely.');
    return;
  }
  const encrypted = safeStorage.encryptString(JSON.stringify(data));
  store.set('licenseBlob', encrypted.toString('base64'));
}

export function clearLicenseData(): void {
  store.set('licenseBlob', null);
}

// ─── Backup Config ──────────────────────────────

export function getBackupConfig(): BackupConfig {
  const cfg = store.get('backupConfig') ?? DEFAULT_BACKUP_CONFIG;
  return {
    intervalSec: typeof cfg.intervalSec === 'number' && cfg.intervalSec >= 5 ? cfg.intervalSec : DEFAULT_BACKUP_CONFIG.intervalSec,
    maxCount: typeof cfg.maxCount === 'number' && cfg.maxCount >= 1 ? cfg.maxCount : DEFAULT_BACKUP_CONFIG.maxCount,
    maxAiSnapshots: typeof cfg.maxAiSnapshots === 'number' && cfg.maxAiSnapshots >= 1 ? cfg.maxAiSnapshots : DEFAULT_BACKUP_CONFIG.maxAiSnapshots,
  };
}

export function setBackupConfig(config: BackupConfig): void {
  store.set('backupConfig', {
    intervalSec: Math.max(5, Math.min(3600, config.intervalSec)),
    maxCount: Math.max(1, Math.min(10000, config.maxCount)),
    maxAiSnapshots: Math.max(1, Math.min(1000, config.maxAiSnapshots)),
  });
}

// ─── Project-Local Auto-Backups ─────────────────

export interface BackupFile {
  relPath: string;
  content: string;
}

export interface BackupSnapshot {
  timestamp: string;        // "2026-04-27_14-32-15" — sorts lexically
  timestampMs: number;
  fileCount: number;
  totalBytes: number;
}

const BACKED_UP_EXTENSIONS = new Set(['.typ', '.bib']);
const BACKUP_IGNORED_DIRS = new Set(['.git', '.penwright', 'node_modules', '.DS_Store', 'dist', 'build', 'assets', 'sources']);

function penwrightDir(projectDir: string): string {
  return path.join(projectDir, '.penwright');
}

function backupsDir(projectDir: string): string {
  return path.join(penwrightDir(projectDir), 'backups');
}

export function aiSnapshotsDir(projectDir: string): string {
  return path.join(penwrightDir(projectDir), 'ai-snapshots');
}

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function formatTimestamp(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
}

function parseTimestamp(stamp: string): number {
  // "2026-04-27_14-32-15" → Date
  const m = stamp.match(/^(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})$/);
  if (!m) return 0;
  return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]).getTime();
}

async function collectProjectFiles(projectDir: string, depth = 0): Promise<string[]> {
  if (depth > 5) return [];
  const result: string[] = [];
  let entries: fs.Dirent[];
  try {
    entries = await fs.promises.readdir(projectDir, { withFileTypes: true });
  } catch {
    return [];
  }

  for (const entry of entries) {
    if (BACKUP_IGNORED_DIRS.has(entry.name)) continue;
    if (entry.name.startsWith('.')) continue;

    const full = path.join(projectDir, entry.name);
    if (entry.isDirectory()) {
      result.push(...await collectProjectFiles(full, depth + 1));
    } else if (BACKED_UP_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      result.push(full);
    }
  }
  return result;
}

/**
 * Saves a multi-file backup snapshot of a project.
 * Walks the project for .typ/.bib files; if `liveFile` is given, its content
 * is used in place of the disk content (captures unsaved edits).
 *
 * PERF: fully async (`fs.promises`) so the 30s backup timer never blocks the
 * main-process event loop — important on large projects and on cloud-synced
 * folders (iCloud / Dropbox) where each read/write can be slow.
 */
export async function saveProjectBackup(
  projectDir: string,
  liveFile?: { absPath: string; content: string },
): Promise<BackupSnapshot | null> {
  if (!fs.existsSync(projectDir)) return null;

  const files = await collectProjectFiles(projectDir);
  if (liveFile && !files.includes(liveFile.absPath) && fs.existsSync(path.dirname(liveFile.absPath))) {
    files.push(liveFile.absPath);
  }
  if (files.length === 0) return null;

  const timestamp = formatTimestamp(new Date());
  const snapshotDir = path.join(backupsDir(projectDir), timestamp);
  await fs.promises.mkdir(snapshotDir, { recursive: true });

  const fileList: string[] = [];
  let totalBytes = 0;

  for (const absPath of files) {
    const relPath = path.relative(projectDir, absPath);
    const targetPath = path.join(snapshotDir, relPath);
    await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });

    let content: string;
    if (liveFile && absPath === liveFile.absPath) {
      content = liveFile.content;
    } else {
      try {
        content = await fs.promises.readFile(absPath, 'utf-8');
      } catch {
        continue;
      }
    }

    try {
      await fs.promises.writeFile(targetPath, content, 'utf-8');
      fileList.push(relPath);
      totalBytes += Buffer.byteLength(content, 'utf-8');
    } catch {
      // skip files we can't write
    }
  }

  const meta = {
    timestamp,
    timestampMs: Date.now(),
    files: fileList,
    totalBytes,
  };
  await fs.promises.writeFile(path.join(snapshotDir, '.meta.json'), JSON.stringify(meta), 'utf-8');

  return {
    timestamp,
    timestampMs: meta.timestampMs,
    fileCount: fileList.length,
    totalBytes,
  };
}

/** Lists all backup snapshots for a project, newest first. */
export function listProjectBackups(projectDir: string): BackupSnapshot[] {
  const dir = backupsDir(projectDir);
  if (!fs.existsSync(dir)) return [];

  const result: BackupSnapshot[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const metaPath = path.join(dir, entry.name, '.meta.json');
    let timestampMs = parseTimestamp(entry.name);
    let fileCount = 0;
    let totalBytes = 0;
    if (fs.existsSync(metaPath)) {
      try {
        const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
        if (typeof meta.timestampMs === 'number') timestampMs = meta.timestampMs;
        if (Array.isArray(meta.files)) fileCount = meta.files.length;
        if (typeof meta.totalBytes === 'number') totalBytes = meta.totalBytes;
      } catch {}
    }
    result.push({ timestamp: entry.name, timestampMs, fileCount, totalBytes });
  }
  result.sort((a, b) => b.timestampMs - a.timestampMs);
  return result;
}

/** Loads a single backup snapshot's files into memory. */
export function loadProjectBackup(projectDir: string, timestamp: string): BackupFile[] {
  const dir = path.join(backupsDir(projectDir), timestamp);
  if (!fs.existsSync(dir)) return [];

  const result: BackupFile[] = [];
  function walk(sub: string, relBase: string): void {
    for (const entry of fs.readdirSync(sub, { withFileTypes: true })) {
      if (entry.name === '.meta.json') continue;
      const full = path.join(sub, entry.name);
      const relPath = path.posix.join(relBase, entry.name);
      if (entry.isDirectory()) {
        walk(full, relPath);
      } else {
        try {
          result.push({ relPath, content: fs.readFileSync(full, 'utf-8') });
        } catch {}
      }
    }
  }
  walk(dir, '');
  return result;
}

/** Deletes oldest backups when count exceeds the configured maximum. */
export function pruneProjectBackups(projectDir: string, maxCount: number): void {
  const all = listProjectBackups(projectDir);
  if (all.length <= maxCount) return;

  const toDelete = all.slice(maxCount);
  for (const snap of toDelete) {
    const dir = path.join(backupsDir(projectDir), snap.timestamp);
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {}
  }
}

/**
 * Checks if the latest backup contains a version of the given file that
 * differs from the on-disk content and is newer than the disk mtime.
 * Returns the snapshot info if recovery is offered, null otherwise.
 */
export function checkForFileRecovery(
  projectDir: string,
  absFilePath: string,
): { snapshot: BackupSnapshot; backupContent: string } | null {
  if (!fs.existsSync(projectDir) || !fs.existsSync(absFilePath)) return null;

  const backups = listProjectBackups(projectDir);
  if (backups.length === 0) return null;

  const latest = backups[0];
  const relPath = path.relative(projectDir, absFilePath);
  const backupFilePath = path.join(backupsDir(projectDir), latest.timestamp, relPath);
  if (!fs.existsSync(backupFilePath)) return null;

  let backupContent: string;
  let diskContent: string;
  try {
    backupContent = fs.readFileSync(backupFilePath, 'utf-8');
    diskContent = fs.readFileSync(absFilePath, 'utf-8');
  } catch {
    return null;
  }

  if (backupContent === diskContent) return null;

  let diskMtime: number;
  try {
    diskMtime = fs.statSync(absFilePath).mtimeMs;
  } catch {
    return null;
  }

  if (latest.timestampMs <= diskMtime) return null;

  return { snapshot: latest, backupContent };
}

// ─── Project-Local Preferences ──────────────────
// Per-project knobs (zoom levels etc.) live in `<project>/.penwright/preferences.json`
// so they travel with the project folder, just like backups and snapshots.

export interface ProjectPreferences {
  editorZoom: number;
  pdfZoom: number;
  /** PDF preview view mode: false = single page, true = 2-up facing-pages spread. */
  pdfSpread: boolean;
}

const DEFAULT_PROJECT_PREFERENCES: ProjectPreferences = {
  editorZoom: 1.0,
  pdfZoom: 1.0,
  pdfSpread: false,
};

function preferencesPath(projectDir: string): string {
  return path.join(penwrightDir(projectDir), 'preferences.json');
}

function clampZoom(v: unknown): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return 1.0;
  return Math.max(0.5, Math.min(2.0, Math.round(v * 100) / 100));
}

export function getProjectPreferences(projectDir: string): ProjectPreferences {
  const file = preferencesPath(projectDir);
  if (!fs.existsSync(file)) return { ...DEFAULT_PROJECT_PREFERENCES };
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf-8'));
    return {
      editorZoom: clampZoom(raw?.editorZoom),
      pdfZoom: clampZoom(raw?.pdfZoom),
      pdfSpread: raw?.pdfSpread === true,
    };
  } catch {
    return { ...DEFAULT_PROJECT_PREFERENCES };
  }
}

export function saveProjectPreferences(projectDir: string, prefs: ProjectPreferences): void {
  if (!fs.existsSync(projectDir)) return;
  ensureDir(penwrightDir(projectDir));
  const sanitized: ProjectPreferences = {
    editorZoom: clampZoom(prefs.editorZoom),
    pdfZoom: clampZoom(prefs.pdfZoom),
    pdfSpread: prefs.pdfSpread === true,
  };
  try {
    fs.writeFileSync(preferencesPath(projectDir), JSON.stringify(sanitized, null, 2), 'utf-8');
  } catch {
    // best-effort
  }
}

/** Deletes the project's `.penwright` folder entirely. */
export function clearProjectPenwrightData(projectDir: string): void {
  const dir = penwrightDir(projectDir);
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {}
}

// ─── Project-Local Style (Design Editor — Phase A) ──────────────
// `.penwright/style.json` holds the structured "design tokens" used by the
// Settings dialog's Style section and (in later phases) by the Visual Editor
// and the design MCP tools. The generated Typst preamble — derived from
// this JSON — lives at `<project>/style.typ` and is `#include`d from main.typ.

function stylePath(projectDir: string): string {
  return path.join(penwrightDir(projectDir), 'style.json');
}

/** Public accessor for the style.json path (used by the safe-apply engine
 *  so a design change + its style.json land in one verified/undoable batch). */
export function getStyleJsonPath(projectDir: string): string {
  return stylePath(projectDir);
}

/** True if a project-local style.json already exists. */
export function hasProjectStyle(projectDir: string): boolean {
  return fs.existsSync(stylePath(projectDir));
}

/** Returns the stored project style, or defaults if not yet initialized. */
export function getProjectStyle(projectDir: string): ProjectStyle {
  const file = stylePath(projectDir);
  if (!fs.existsSync(file)) return sanitizeProjectStyle(DEFAULT_PROJECT_STYLE);
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf-8'));
    return sanitizeProjectStyle(raw);
  } catch {
    return sanitizeProjectStyle(DEFAULT_PROJECT_STYLE);
  }
}

/** Persists the project style after running it through the sanitizer. */
export function saveProjectStyle(projectDir: string, style: unknown): ProjectStyle {
  ensureDir(penwrightDir(projectDir));
  const clean = sanitizeProjectStyle(style);
  fs.writeFileSync(stylePath(projectDir), JSON.stringify(clean, null, 2), 'utf-8');
  return clean;
}

// ─── Selection Pin ("Design after writing") ─────────────────────
// `.penwright/selection.json` holds a single pinned passage + a snapshot of
// the current look, written when the user right-clicks a selection →
// "Design with AI". The MCP server reads it via `penwright_get_selection`.
// Mirrors the stylePath / saveProjectStyle pattern above; lives under
// `.penwright/` so it's already git-ignored.

function selectionPath(projectDir: string): string {
  return path.join(penwrightDir(projectDir), 'selection.json');
}

/** Writes the pin to disk (caller assembles the full object). Best-effort. */
export function saveSelectionPin(projectDir: string, pin: SelectionPin): void {
  if (!fs.existsSync(projectDir)) return;
  ensureDir(penwrightDir(projectDir));
  try {
    fs.writeFileSync(selectionPath(projectDir), JSON.stringify(pin, null, 2), 'utf-8');
  } catch {
    // best-effort
  }
}

/** Returns the stored pin, or null if none is pinned / the file is corrupt. */
export function getSelectionPin(projectDir: string): SelectionPin | null {
  const file = selectionPath(projectDir);
  if (!fs.existsSync(file)) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf-8'));
    if (raw && typeof raw === 'object' && typeof raw.anchorText === 'string') {
      return raw as SelectionPin;
    }
    return null;
  } catch {
    return null;
  }
}

/** Removes the pin (unpin / after Claude applied a change). Best-effort. */
export function clearSelectionPin(projectDir: string): void {
  try {
    fs.unlinkSync(selectionPath(projectDir));
  } catch {
    // already gone — fine
  }
}
