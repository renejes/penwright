/** Native main-process dialogs (export/import, file save, project prompts). */
export const mainDialogs = {
  // ─── Shared ──────────────────────────────────────────
  ok: 'OK',
  cancel: 'Cancel',

  // ─── Export ──────────────────────────────────────────
  exportFailedTitle: 'Export failed',
  openProjectFirst: 'Please open a project first.',
  exportFailedFmt: (fmt: string) => `${fmt} export failed`,
  exportedTo: (fmt: string, file: string) => `${fmt} exported to ${file}`,
  openPdf: 'Open PDF',
  openDocx: 'Open DOCX',
  filterPdf: 'PDF',
  filterWordDocument: 'Word Document',

  // ─── Import Markdown ─────────────────────────────────
  importMarkdownTitle: 'Import Markdown File',
  filterMarkdownFiles: 'Markdown Files',
  filterTypstFiles: 'Typst Files',
  importedAsTypst: (file: string) => `Imported "${file}" as Typst.`,
  importedMarkdownDetail: 'Review the converted file — some complex Markdown constructs may need manual adjustment.',
  importFailedTitle: 'Import failed',

  // ─── Import Style Template ───────────────────────────
  importStyleTemplateTitle: 'Import Style Template',
  noStyleRules: 'No style rules (#set, #show) found in the file.',
  styleImportedApplied: (label: string) => `Style "${label}" imported and applied.`,
  styleImportedDetail: 'The template was saved in .claude/style-templates/ for future use.',

  // ─── Zotero ──────────────────────────────────────────
  filterBibtexFiles: 'BibTeX Files',
  selectZoteroExportTitle: 'Select Zotero Better BibTeX auto-export file',
  selectZoteroExportMessage: 'Select the .bib file that Zotero Better BibTeX keeps updated',
  noProjectOpenTitle: 'No project open',
  zoteroLinkedTitle: 'Zotero library linked!',
  zoteroLinkedDetail: (file: string) =>
    `"${file}" copied to project as zotero.bib.\nChanges in Zotero will be synced automatically while the app is running.`,
  zoteroLinkFailedTitle: 'Zotero link failed',

  // ─── Apply Style Template (root-file guard) ──────────
  styleCannotChangeHereTitle: 'Style cannot be changed here',
  styleBelongsInRoot: (rootFile: string) => `Styles belong in the main file (${rootFile}).`,
  styleBelongsInRootDetail:
    'Switch to the main file first and apply the style there. Otherwise the style preamble would be prepended to this chapter and break the file.',

  // ─── File operations (fileManager) ───────────────────
  // File lock (shared folders)
  fileLockedTitle: 'File is locked',
  fileLockedMessage: (user: string, machine: string) =>
    `This file is being edited by ${user} on ${machine}.`,
  fileLockedDetail:
    'Opening it simultaneously may cause conflicts if your project is in a shared folder (Dropbox, iCloud, etc.).',
  openReadOnly: 'Open Read-Only',
  openAnyway: 'Open Anyway',

  // Crash recovery
  unsavedChangesFoundTitle: 'Unsaved changes found',
  unsavedChangesFoundMessage: 'A backup with unsaved changes was found for this file.',
  unsavedChangesFoundDetail: (when: string) =>
    `Last backup: ${when}\n\nWould you like to recover the backup?`,
  recover: 'Recover',
  discardBackup: 'Discard Backup',

  // File open/save errors
  couldNotOpenFile: 'Could not open file',
  couldNotSaveFile: 'Could not save file',

  // Close project (unsaved changes prompt)
  unsavedChangesMessage: 'You have unsaved changes.',
  unsavedChangesDetail: 'Do you want to save before closing the project?',
  save: 'Save',
  dontSave: "Don't Save",

  // ─── Project operations (projectManager) ─────────────
  // Create project
  chooseProjectLocationTitle: 'Choose location for project',
  createHere: 'Create Here',

  // Open project
  openProjectTitle: 'Open Project',
  folderNotFound: 'Folder not found.',
  folderNotFoundDetail: (p: string) => `The path "${p}" does not exist or is not a folder.`,

  // Sample project
  sampleProjectNotFound: 'Sample project not found.',
  sampleProjectNotFoundDetail: 'The bundled sample-project resource is missing from this build.',
  sampleProjectCreateFailed: 'Could not create the sample project.',
  sampleProjectTargetTitle: 'Where should the sample project be saved?',
  sampleProjectCreateHere: 'Create here',

  // Add assets
  addAssetsTitle: 'Add assets to project',
  filterCommonAssets: 'Common assets',
  filterAllFiles: 'All files',

  // Images
  filterImages: 'Images',

  // ─── ipcHandlers dialogs ─────────────────────────────
  mergeFailedTitle: 'Merge failed',
  splitFailedTitle: 'Split failed',
  noAiEditsToUndo: 'No AI edits to undo.',

  // ─── New folder / Add assets (returned to renderer, shown in Sidebar) ─
  noProjectOpen: 'No project open.',
  folderNameEmpty: 'Folder name is empty.',
  folderNameInvalid: 'Folder name contains invalid characters.',
  folderOutside: 'Folder is outside the project.',
  folderExists: 'A folder with that name already exists.',

  // ─── Quit-while-dirty dialog (index.ts) ──────────────
  unsavedChangesQuitDetail: 'Do you want to save before closing?',

  // ─── Design-undo labels (shown as the undo-button tooltip) ───────────
  undoLabelDesignChanged: 'Design changed',
  undoLabelChapterLook: 'Chapter look adjusted',
  undoLabelChapterLookSet: (id: string) => `Chapter look: ${id}`,
  undoLabelChapterLookRemoved: 'Chapter look removed',

  // ─── License status messages (shown in the license UI) ───────────────
  licenseRevoked: 'Your license has been revoked or has expired.',
  licenseOfflineMode: (days: number) => `Offline mode (${days} days remaining)`,
  licenseOfflineExpired: 'Offline grace period expired. Please connect to the internet to re-validate.',
};
export type MainDialogsMessages = typeof mainDialogs;
