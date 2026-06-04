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
  showProjectSearch: false,
  showQuickSettings: false,
  focusMode: false,
  typewriterMode: false,
  readingMode: false,
  showWelcome: false,
  welcomeTypstInstalled: true,
  welcomePlatform: '',
  currentSettings: null as DocumentSettings | null,
  showLicense: false,
  showAbout: false,
  licenseStatus: 'none' as string,
  licenseTier: null as string | null,
  licenseKey: null as string | null,
  licenseMessage: '',
  // Local entitlement — the single source of truth for gating the UI.
  // 'trial' until the 14-day clock runs out, then 'expired' (blocking gate).
  licenseAccess: 'trial' as 'licensed' | 'trial' | 'expired',
  trialDaysLeft: 14,
  exporting: false,
  exportFormat: '' as string,
});

// ─── Panel State ────────────────────────────────
export let panelState = $state({
  showSidebar: true,
  showPreview: false,
  showTerminal: false,
  sidebarTab: 'files' as 'files' | 'outline' | 'includes' | 'git' | 'comments' | 'design',
  sidebarWidth: 220,
  previewWidth: 400,
  terminalHeight: 200,
});

// ─── Document Zoom ──────────────────────────────
// Independent zoom levels for the editor (CSS zoom on .editor) and PDF
// rendering (passed to pdfjs viewport scale, so output stays crisp).
// Per-project: loaded from <project>/.penwright/preferences.json on file open,
// reset to 1.0 when the project closes.
export const ZOOM_MIN = 0.5;
export const ZOOM_MAX = 2.0;
export const ZOOM_STEP = 0.1;

export let zoomState = $state({
  editor: 1.0,
  pdf: 1.0,
});

function clampZoom(v: number): number {
  if (!Number.isFinite(v)) return 1.0;
  const rounded = Math.round(v * 100) / 100;
  return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, rounded));
}

export function setEditorZoom(value: number) { zoomState.editor = clampZoom(value); }
export function setPdfZoom(value: number) { zoomState.pdf = clampZoom(value); }
export function zoomEditorIn() { setEditorZoom(zoomState.editor + ZOOM_STEP); }
export function zoomEditorOut() { setEditorZoom(zoomState.editor - ZOOM_STEP); }
export function resetEditorZoom() { setEditorZoom(1.0); }
export function zoomPdfIn() { setPdfZoom(zoomState.pdf + ZOOM_STEP); }
export function zoomPdfOut() { setPdfZoom(zoomState.pdf - ZOOM_STEP); }
export function resetPdfZoom() { setPdfZoom(1.0); }

// ─── Preview State ──────────────────────────────
export let previewState = $state({
  pdfData: null as Uint8Array | null,
  error: '',
  compiling: false,
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

// ─── Project-Search Preset ──────────────────────
// Set by "Find backlinks" triggers (OutlinePanel headings, citation
// right-click, etc.). ProjectSearchPanel reads this on mount and clears it
// after applying — that way the preset is consumed exactly once.
export let projectSearchPreset = $state({
  query: '' as string,
  wholeWord: false,
  caseSensitive: false,
});

// ─── Export Dialog ───────────────────────────────
interface ExportChapter { includePath: string; title: string; }
interface ExportSections {
  multiChapter: boolean;
  rootFile: string;
  chapters: ExportChapter[];
  hasBibliography: boolean;
}

export let exportDialogState = $state({
  show: false,
  format: 'pdf' as 'pdf' | 'docx',
  sections: null as ExportSections | null,
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
