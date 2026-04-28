/**
 * Shared Application State
 * Central state object accessed by all main process modules.
 * Avoids circular dependencies by being a standalone module.
 */

import type { BrowserWindow } from 'electron';
import type { TerminalManager } from './terminalManager';

export interface AppState {
  mainWindow: BrowserWindow | null;
  currentFilePath: string | null;
  currentContent: string;
  isDirty: boolean;
  projectDir: string | null;
  terminal: TerminalManager | null;
  lastSaveTimestamp: number;

  // Callbacks set by index.ts after module wiring
  openFile: (filePath?: string) => void;
  saveFile: () => Promise<boolean>;
  saveFileAs: () => Promise<boolean>;
  closeProject: () => Promise<boolean>;
  openProject: () => Promise<void>;
  handleExportPdf: () => void;
  handleExportDocx: () => void;
  handleImportMarkdown: () => void;
  handleLinkZotero: () => void;
}

export const appState: AppState = {
  mainWindow: null,
  currentFilePath: null,
  currentContent: '',
  isDirty: false,
  projectDir: null,
  terminal: null,
  lastSaveTimestamp: 0,

  // These get wired up in index.ts after all modules are imported
  openFile: () => {},
  saveFile: async () => false,
  saveFileAs: async () => false,
  closeProject: async () => false,
  openProject: async () => {},
  handleExportPdf: () => {},
  handleExportDocx: () => {},
  handleImportMarkdown: () => {},
  handleLinkZotero: () => {},
};
