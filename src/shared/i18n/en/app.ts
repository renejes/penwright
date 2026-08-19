/** App shell — alerts, nav tabs, status bar, trial banner (App.svelte). */
export const app = {
  // Alerts / toasts
  openFileFirst: 'Please open a file first.',
  selectTextToComment: 'Please select the text you want to comment on.',
  noProjectOpen: 'No project open.',
  commentCreateFailed: 'Could not create the comment.',
  selectTextToDesign: 'Please select the text you want to design.',
  pinFailed: 'Could not pin the selection.',

  // Navigation tabs
  navAria: 'Sidebar panels',
  navFiles: 'Files',
  navOutline: 'Outline',
  navChapters: 'Chapters',
  navProject: 'Project',
  navComments: 'Comments',

  // Tabs
  openFilesAria: 'Open files',
  closeTabAria: (name: string) => `Close ${name}`,

  // Status bar
  toggleSidebar: 'Toggle project sidebar',
  togglePreview: 'Toggle preview panel',
  statusProject: 'Project',
  statusPreview: 'Preview',
  wordsLabel: (n: number): string => (n === 1 ? 'word' : 'words'),
  minRead: (m: number) => `${m} min read`,
  readingTimeTitle: 'Word count · estimated reading time at 200 wpm',
  /** Advisory: what the connected AI is touching. Display only. */
  agentWorking: (what: string): string => `AI: ${what}`,
  editorZoom: 'Editor zoom',
  editorZoomTitle: 'Editor zoom · click to adjust',
  zoomOut: 'Zoom out',
  zoomIn: 'Zoom in',
  zoomSlider: 'Editor zoom slider',
  reset: 'Reset',
  exporting: (fmt: string) => `Exporting ${fmt}…`,
  unsaved: 'Unsaved',
  saved: (time: string) => `Saved ${time}`,

  // Language toggle
  switchLanguage: 'Switch language (English / German)',

  // Shown when a save overwrote a concurrent change to the same file. The
  // other version was kept as a snapshot, so this is a hint, not an error.
  overwroteExternalChange: (file: string): string =>
    file
      ? `${file} was changed elsewhere while you were editing. Your version was saved; the other one is under History ▸ AI changes.`
      : 'A file was changed elsewhere while you were editing. Your version was saved; the other one is under History ▸ AI changes.',
};

export type AppMessages = typeof app;
