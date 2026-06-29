/** Native application menu bar (built in the main process). */
export const menu = {
  // App menu (macOS)
  about: (app: string) => `About ${app}`,

  // File
  file: 'File',
  newProject: 'New Project…',
  openProject: 'Open Project…',
  closeProject: 'Close Project',
  save: 'Save',
  saveAs: 'Save As…',
  exportPdf: 'Export as PDF…',
  exportDocx: 'Export as DOCX…',
  exportWeb: 'Export to Web (HTML)…',
  importMarkdown: 'Import Markdown…',
  linkZotero: 'Link Zotero Library…',
  openSources: 'Open Sources Folder',
  addCitation: 'Add Citation Manually…',

  // Edit
  edit: 'Edit',
  findReplace: 'Find & Replace',
  findInProject: 'Find in Project…',
  addComment: 'Add Comment',
  insertReference: 'Insert Reference…',
  undoAiEdit: 'Undo AI Edit',

  // View
  view: 'View',
  toggleSidebar: 'Toggle Sidebar',
  togglePreview: 'Toggle Preview',
  editorZoom: 'Editor Zoom',
  previewZoom: 'Preview Zoom',
  zoomIn: 'Zoom In',
  zoomOut: 'Zoom Out',
  reset: 'Reset',
  resetWindowZoom: 'Reset Window Zoom',
  zoomWindowIn: 'Zoom Window In',
  zoomWindowOut: 'Zoom Window Out',

  // Document
  document: 'Document',
  documentSettings: 'Document Settings…',
  mergeDocument: 'Merge Document',
  splitDocument: 'Split into Chapters',
  openAsTypst: 'Open as Typst Source',
  ensureBibliography: 'Ensure Bibliography',

  // Help
  help: 'Help',
  showIntroduction: 'Show Introduction',
  userGuide: 'User Guide',
  keyboardShortcuts: 'Keyboard Shortcuts',
  reportIssue: 'Report Issue',
  connectClaude: 'Connect to Claude Desktop…',
  mcpConnection: 'MCP Connection…',
  openCrashReports: 'Open Crash Reports',
};

export type MenuMessages = typeof menu;
