/**
 * Shared Application State
 * Central state object accessed by all main process modules.
 * Avoids circular dependencies by being a standalone module.
 */

import type { BrowserWindow } from 'electron';

export interface AppState {
  mainWindow: BrowserWindow | null;
  currentFilePath: string | null;
  currentContent: string;
  isDirty: boolean;
  projectDir: string | null;
  lastSaveTimestamp: number;
  /** Whether the most recent preview compile succeeded. Lets the safe-apply
   *  engine tell "this design change broke a working doc" (→ roll back) from
   *  "the doc was already broken" (→ don't blame the design change). */
  lastCompileOk: boolean;

  // Callbacks set by index.ts after module wiring
  openFile: (filePath?: string) => void;
  saveFile: () => Promise<boolean>;
  saveFileAs: () => Promise<boolean>;
  closeProject: () => Promise<boolean>;
  openProject: () => Promise<void>;
  handleExportPdf: () => void;
  handleExportDocx: () => void;
  handleExportWeb: () => void;
  handleImportMarkdown: () => void;
  handleLinkZotero: () => void;
}

export const appState: AppState = {
  mainWindow: null,
  currentFilePath: null,
  currentContent: '',
  isDirty: false,
  projectDir: null,
  lastSaveTimestamp: 0,
  lastCompileOk: true,

  // These get wired up in index.ts after all modules are imported
  openFile: () => {},
  saveFile: async () => false,
  saveFileAs: async () => false,
  closeProject: async () => false,
  openProject: async () => {},
  handleExportPdf: () => {},
  handleExportDocx: () => {},
  handleExportWeb: () => {},
  handleImportMarkdown: () => {},
  handleLinkZotero: () => {},
};
