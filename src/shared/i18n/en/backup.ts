/** Auto-backup browser dialog. */
export const backup = {
  title: 'Auto-Backups',
  settingsButton: 'Settings',
  settingsAria: 'Backup settings',
  settingsTitle: 'Settings',
  intervalLabel: 'Backup interval',
  intervalEvery10Sec: 'every 10 seconds',
  intervalEvery30Sec: 'every 30 seconds',
  intervalEveryMinute: 'every minute',
  intervalEvery5Min: 'every 5 minutes',
  maxCountLabel: 'Maximum number of backups',
  maxCountOption: (count: number) => `${count} backups`,
  maxCountUnlimited: '1000 backups (unlimited)',
  maxAiSnapshotsLabel: 'Maximum AI-edit snapshots',
  settingsNotePrefix: 'Backups are stored in ',
  settingsNoteSuffix: ' inside the project folder.',
  loading: 'Loading backups…',
  emptyLine1: 'No auto-backups yet.',
  emptyLine2: 'As soon as you work on the project, backups will be saved here automatically.',
  hint: 'Auto-backups protect against crashes. Click “Load” to bring back a state.',
  fileCount: (count: number) => `${count} ${count === 1 ? 'file' : 'files'}`,
  loadButton: 'Load',
  applyConfirm: (date: string) =>
    `The current state will be replaced with the backup from ${date}.\n\n` +
    `Tip: Save the current state as your own version first if you don’t want to lose anything.\n\nContinue?`,
  applyFailed: 'Could not apply backup.',
  applyError: (msg: string) => `Error while applying: ${msg}`,
};
export type BackupMessages = typeof backup;
