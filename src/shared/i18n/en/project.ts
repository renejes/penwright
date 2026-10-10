/** Project / Versions sidebar panel. */
export const project = {
  noProjectName: 'No project open',
  showInFinder: 'Show in Finder',
  emptyStateTitle: 'No project open.',
  emptyStateHint: 'Open or create a project to save versions.',

  // Save version card
  saveInputPlaceholder: 'What did you just finish?',
  saveVersion: 'Save version',
  saving: '...',
  saveDisabledNoSelection: 'No changes selected',
  saveDisabledTitle: 'Save version',
  saveFailed: (msg: string) => `Saving failed: ${msg}`,

  // Changes section
  changesTitle: 'Changes since last version',
  selectAll: 'all',
  selectNone: 'none',
  selectAllTitle: 'Check all',
  selectNoneTitle: 'Uncheck all',
  noChanges: 'No changes since the last version.',
  firstVersionHint: 'With the first version, a history is automatically created for this project.',

  // File status labels
  statusModified: 'modified',
  statusAdded: 'added',
  statusDeleted: 'deleted',
  statusNew: 'new',
  statusRenamed: 'renamed',

  // History (version list shown in the History & Restore hub)
  refresh: 'Refresh',
  refreshHistoryAria: 'Refresh history',
  autoTag: 'auto',

  // Relative time
  justNow: 'just now',
  secondsAgo: (s: number) => `${s} s ago`,
  minutesAgo: (m: number) => `${m} min ago`,
  hoursAgo: (h: number) => `${h} h ago`,

  // Advanced / cloud sync
  advanced: 'Advanced',
  cloudUrlLabel: 'Cloud backup URL (optional)',
  cloudUrlPlaceholder: 'https://github.com/user/project.git',
  cloudPush: '↑ Sync with cloud',
  cloudPull: '↓ Load cloud backup',
  openBackupFolder: 'Open backup folder',
  cloudUrlFailed: (msg: string) => `Could not set cloud URL: ${msg}`,
  cloudPushFailed: (msg: string) => `Syncing with cloud failed: ${msg}`,
  cloudPullConfirm:
    'The cloud backup will be merged with the current state. Local changes may be overwritten.\n\n' +
    'Tip: Save the current state as your own version first if you don’t want to lose anything.\n\n' +
    'Continue?',
  cloudPullFailed: (msg: string) => `Could not load cloud backup: ${msg}`,

  versionOf: (file: string) => `Only this file: ${file}`,
  noOpenChapter: 'Open a chapter. A version is always of the tab you are looking at.',
  createVersion: 'Save version',
  openRead: 'Read',
  openEdit: 'Edit',
  makeMain: 'Make main',
  makeMainTitle: 'Swap this version with the living chapter',
  makeMainConfirm: 'The chapter and this version swap texts. The version keeps its name and then holds what the chapter says now. The chapter becomes what the version says now.',
  deleteVersion: 'Delete',
  deleteConfirm: (name: string) => `Delete the version “${name}”?`,
  rename: 'Rename',
  renamePrompt: 'Name of this version',
  versionsEmpty: 'No versions yet.',
  versionsTitle: 'Versions',
  versionMenu: 'Actions for this version',
  nameTaken: 'A version with this name already exists.',
  versionFailed: (msg: string) => `That did not work: ${msg}`,
};
export type ProjectMessages = typeof project;
