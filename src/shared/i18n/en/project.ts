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

  // History section
  historyTitle: 'History',
  refresh: 'Refresh',
  refreshHistoryAria: 'Refresh history',
  noVersions: 'No versions yet.',
  autoTag: 'auto',

  // Backup status
  showBackups: 'Show auto-backups',
  lastBackup: (time: string) => `Last auto-backup ${time}`,
  noBackup: 'No auto-backup yet',

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
};
export type ProjectMessages = typeof project;
