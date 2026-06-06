/** Version-detail (diff) modal. */
export const version = {
  title: 'Version details',
  loadingDiff: 'Loading diff…',
  noChanges: 'No changes found for this version.',
  noTextChange: 'No visible text change.',
  statusAdded: 'new',
  statusModified: 'modified',
  statusDeleted: 'deleted',
  statusRenamed: 'renamed',
  restore: 'Restore this version',
  restoring: 'Restoring…',
  restoreConfirm:
    'The current state will be replaced with this version. Continue?\n\n' +
    'Tip: Save unsaved changes as your own version first.',
  restoreFailed: (msg: string) => `Restore failed: ${msg}`,
};
export type VersionMessages = typeof version;
