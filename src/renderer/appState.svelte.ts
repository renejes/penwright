/**
 * App State — extracted from App.svelte
 * Svelte 5 reactive state module (.svelte.ts) for cross-component sharing.
 */

import type { Editor } from '@tiptap/core';
import type { DocumentSettings } from '../editor/lib/messages';

// ─── Editor State ───────────────────────────────
export let editorRef: { current: Editor | null } = $state({ current: null });
export let editorVersion = $state({ value: 0 });
export let isUpdatingFromExtension = { value: false };

// ─── UI State ───────────────────────────────────
export let uiState = $state({
  showShortcuts: false,
  showSettings: false,
  showSearch: false,
  showQuickSettings: false,
  focusMode: false,
  typewriterMode: false,
  showWelcome: false,
  welcomeTypstInstalled: true,
  welcomePlatform: '',
  currentSettings: null as DocumentSettings | null,
  showLicense: false,
  licenseStatus: 'none' as string,
  licenseTier: null as string | null,
  licenseKey: null as string | null,
  licenseMessage: '',
});

// ─── Panel State ────────────────────────────────
export let panelState = $state({
  showSidebar: true,
  showPreview: false,
  showTerminal: false,
  sidebarTab: 'files' as 'files' | 'outline' | 'includes' | 'git',
  sidebarWidth: 220,
  previewWidth: 400,
  terminalHeight: 200,
});

// ─── Preview State ──────────────────────────────
export let previewState = $state({
  pages: [] as string[],
  pdfData: null as Uint8Array | null,
  previewMode: 'svg' as 'svg' | 'pdf',
  error: '',
  compiling: false,
  scrollToPage: 0,
});

// ─── Tab / File State ───────────────────────────
export interface EditorTab {
  path: string;
  type: 'typ' | 'text' | 'rawtyp' | 'pdf';
}

export let tabState = $state({
  openTabs: [] as EditorTab[],
  activeTabIndex: -1,
  currentFile: '',
  currentContent: '',
  isSaved: true,
  lastSaveTime: '',
});

// ─── Context Menu ────────────────────────────────
export let contextMenu = $state({ x: 0, y: 0, path: '' });

// ─── New Project Dialog ──────────────────────────
export let newProjectState = $state({
  show: false,
  templates: [] as Array<{ id: string; label: string; description: string }>,
});

// ─── Tab Operations ──────────────────────────────

export function openTab(filePath: string, type: 'typ' | 'text' | 'rawtyp' | 'pdf' = 'typ') {
  const existingIndex = tabState.openTabs.findIndex(t => t.path === filePath && t.type === type);
  if (existingIndex >= 0) {
    tabState.activeTabIndex = existingIndex;
    return;
  }
  tabState.openTabs = [...tabState.openTabs, { path: filePath, type }];
  tabState.activeTabIndex = tabState.openTabs.length - 1;
}

export function closeTab(index: number) {
  tabState.openTabs = tabState.openTabs.filter((_, i) => i !== index);
  if (tabState.activeTabIndex >= tabState.openTabs.length) {
    tabState.activeTabIndex = tabState.openTabs.length - 1;
  }
}

export function tabName(tab: EditorTab): string {
  const name = tab.path.split('/').pop() || '';
  return tab.type === 'rawtyp' ? `${name} [Text]` : name;
}

export function switchToTab(index: number) {
  tabState.activeTabIndex = index;
  const tab = tabState.openTabs[index];
  if (!tab) return;
  if (tab.type === 'typ') {
    tabState.currentFile = tab.path;
    const api = (window as unknown as { electronAPI: { invoke(channel: string, ...args: unknown[]): Promise<unknown> } }).electronAPI;
    api.invoke('filetree:open', tab.path);
  }
}

// ─── Resize State ────────────────────────────────

export let resizeBase = {
  sidebarWidth: 0,
  previewWidth: 0,
  terminalHeight: 0,
};

export function startSidebarResize() {
  resizeBase.sidebarWidth = panelState.sidebarWidth;
}
export function onSidebarResize(delta: number) {
  panelState.sidebarWidth = Math.max(150, Math.min(500, resizeBase.sidebarWidth + delta));
}

export function startPreviewResize() {
  resizeBase.previewWidth = panelState.previewWidth;
}
export function onPreviewResize(delta: number) {
  panelState.previewWidth = Math.max(200, Math.min(800, resizeBase.previewWidth - delta));
}

export function startTerminalResize() {
  resizeBase.terminalHeight = panelState.terminalHeight;
}
export function onTerminalResize(delta: number) {
  panelState.terminalHeight = Math.max(100, Math.min(600, resizeBase.terminalHeight - delta));
}
