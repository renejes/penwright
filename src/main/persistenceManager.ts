/**
 * Persistence Manager — electron-store based state persistence.
 *
 * Saves and restores: window bounds, panel state, recent projects,
 * last project path, onboarding flag, Zotero path.
 */

import Store from 'electron-store';
import * as path from 'path';
import * as fs from 'fs';
import { app, safeStorage } from 'electron';

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
  showTerminal: boolean;
  sidebarTab: string;
  sidebarWidth: number;
  previewWidth: number;
  terminalHeight: number;
}

export interface LicenseData {
  licenseKey: string | null;
  activationId: string | null;
  licenseTier: 'basic' | 'pro' | null;
  licenseStatus: 'active' | 'expired' | null;
  lastValidation: number;
}

interface StoreSchema {
  windowBounds: WindowBounds;
  panelState: PanelState;
  recentProjects: RecentProject[];
  lastProjectPath: string | null;
  onboardingSeen: boolean;
  zoteroBibPath: string | null;
  /** Encrypted (OS keychain) base64 blob containing the full LicenseData payload. */
  licenseBlob: string | null;
}

const store = new Store<StoreSchema>({
  name: 'vswrite-settings',
  defaults: {
    windowBounds: {
      width: 1200,
      height: 800,
      isMaximized: false,
    },
    panelState: {
      showSidebar: true,
      showPreview: false,
      showTerminal: false,
      sidebarTab: 'files',
      sidebarWidth: 220,
      previewWidth: 400,
      terminalHeight: 200,
    },
    recentProjects: [],
    lastProjectPath: null,
    onboardingSeen: false,
    zoteroBibPath: null,
    licenseBlob: null,
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

export function getRecentProjects(): RecentProject[] {
  return store.get('recentProjects');
}

export function addRecentProject(projectPath: string, name?: string): void {
  const recent = store.get('recentProjects');

  // Remove existing entry for this path
  const filtered = recent.filter(p => p.path !== projectPath);

  // Add at front
  filtered.unshift({
    path: projectPath,
    name: name || projectPath.split('/').pop() || projectPath,
    timestamp: Date.now(),
  });

  // Trim to max
  store.set('recentProjects', filtered.slice(0, MAX_RECENT_PROJECTS));
}

export function removeRecentProject(projectPath: string): void {
  const recent = store.get('recentProjects');
  store.set('recentProjects', recent.filter(p => p.path !== projectPath));
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

// ─── Zotero ──────────────────────────────────────

export function getZoteroBibPath(): string | null {
  return store.get('zoteroBibPath');
}

export function saveZoteroBibPath(bibPath: string | null): void {
  store.set('zoteroBibPath', bibPath);
}

// ─── License ────────────────────────────────────
// The license payload is stored as an OS-encrypted blob (safeStorage →
// macOS Keychain / Windows DPAPI / libsecret on Linux). This prevents
// trivial tampering (e.g. editing the JSON on disk to flip `licenseTier`
// to "pro"): if the blob cannot be decrypted or deserialised, we treat
// it as "no license" instead of trusting its contents.

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
    // Shape-validate — if anything is off, treat as empty.
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
    console.warn('[vswrite] safeStorage unavailable — license cannot be persisted securely.');
    return;
  }
  const encrypted = safeStorage.encryptString(JSON.stringify(data));
  store.set('licenseBlob', encrypted.toString('base64'));
}

export function clearLicenseData(): void {
  store.set('licenseBlob', null);
}

// ─── Crash Recovery / Backup ───────────────────

const BACKUP_DIR = path.join(app.getPath('userData'), 'backups');

export interface BackupInfo {
  filePath: string;
  backupPath: string;
  timestamp: number;
}

function ensureBackupDir(): void {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
}

/** Saves a backup snapshot of the current file content. */
export function saveBackup(filePath: string, content: string): void {
  ensureBackupDir();
  const fileName = path.basename(filePath, '.typ');
  const backupPath = path.join(BACKUP_DIR, `${fileName}.backup.typ`);
  const meta = { filePath, timestamp: Date.now() };
  fs.writeFileSync(backupPath, content, 'utf-8');
  fs.writeFileSync(backupPath + '.meta.json', JSON.stringify(meta), 'utf-8');
}

/** Checks if a recovery backup exists that is newer than the file on disk. */
export function checkForRecovery(filePath: string): BackupInfo | null {
  ensureBackupDir();
  const fileName = path.basename(filePath, '.typ');
  const backupPath = path.join(BACKUP_DIR, `${fileName}.backup.typ`);
  const metaPath = backupPath + '.meta.json';

  if (!fs.existsSync(backupPath) || !fs.existsSync(metaPath)) return null;

  try {
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
    if (meta.filePath !== filePath) return null;

    const diskStat = fs.statSync(filePath);
    if (meta.timestamp > diskStat.mtimeMs) {
      return { filePath, backupPath, timestamp: meta.timestamp };
    }
  } catch {}
  return null;
}

/** Reads the backup content. */
export function readBackup(backupPath: string): string {
  return fs.readFileSync(backupPath, 'utf-8');
}

/** Clears the backup for a given file (call after successful save). */
export function clearBackup(filePath: string): void {
  const fileName = path.basename(filePath, '.typ');
  const backupPath = path.join(BACKUP_DIR, `${fileName}.backup.typ`);
  try { fs.unlinkSync(backupPath); } catch {}
  try { fs.unlinkSync(backupPath + '.meta.json'); } catch {}
}
