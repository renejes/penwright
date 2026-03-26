/**
 * Persistence Manager — electron-store based state persistence.
 *
 * Saves and restores: window bounds, panel state, recent projects,
 * last project path, onboarding flag, Zotero path.
 */

import Store from 'electron-store';

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
  licenseKey: string | null;
  activationId: string | null;
  licenseTier: 'basic' | 'pro' | null;
  licenseStatus: 'active' | 'expired' | null;
  lastValidation: number;
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
    licenseKey: null,
    activationId: null,
    licenseTier: null,
    licenseStatus: null,
    lastValidation: 0,
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

export function getLicenseData(): LicenseData {
  return {
    licenseKey: store.get('licenseKey'),
    activationId: store.get('activationId'),
    licenseTier: store.get('licenseTier'),
    licenseStatus: store.get('licenseStatus'),
    lastValidation: store.get('lastValidation'),
  };
}

export function saveLicenseData(data: LicenseData): void {
  store.set('licenseKey', data.licenseKey);
  store.set('activationId', data.activationId);
  store.set('licenseTier', data.licenseTier);
  store.set('licenseStatus', data.licenseStatus);
  store.set('lastValidation', data.lastValidation);
}

export function clearLicenseData(): void {
  store.set('licenseKey', null);
  store.set('activationId', null);
  store.set('licenseTier', null);
  store.set('licenseStatus', null);
  store.set('lastValidation', 0);
}
