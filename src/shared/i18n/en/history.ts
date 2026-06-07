/** Unified "History & Restore" hub — Versions + Auto-backups + AI changes in one place. */
export const history = {
  openButton: 'History & Restore',
  openButtonAria: 'Open history and restore',
  title: 'History & Restore',
  intro: 'Everything you can get back lives here — checkpoints you save, automatic copies, and AI edits.',

  versionsTitle: 'Versions',
  versionsDesc: 'Named checkpoints you save yourself — kept forever.',
  versionsEmpty: 'No versions yet.',

  backupsTitle: 'Auto-backups',
  backupsDesc: 'Automatic copies every few minutes — your crash safety net.',
  backupsEmpty: 'No auto-backups yet.',
  restore: 'Restore',

  aiTitle: 'AI changes',
  aiDesc: 'Undo the most recent AI edits to the open file, one at a time.',
  aiEntryTitle: 'AI edit',
  aiEmpty: 'No AI edits to undo for this file.',
  aiNoFile: 'Open a file to see its AI edits.',
  aiUndoLast: 'Undo last',
};
export type HistoryMessages = typeof history;
