/** Unified "History & Restore" hub — Versions + Auto-backups + AI changes in one place. */
export const history = {
  openButton: 'History & Restore',
  openButtonAria: 'Open history and restore',
  title: 'History & Restore',
  intro: 'Automatic copies and AI edits you can get back. Chapter versions live in the Project tab.',

  versionsTitle: 'Versions',
  versionsDesc: 'A version is one chapter. You name it, open it to read or to edit, and swap it with the living chapter in the Project tab.',
  versionsEmpty: 'Versions are listed in the Project tab.',

  backupsTitle: 'Auto-backups',
  backupsDesc: 'Automatic copies every few minutes — your crash safety net.',
  backupsEmpty: 'No auto-backups yet.',
  restore: 'Restore',

  aiTitle: 'AI changes',
  aiDesc: 'Undo the most recent AI edits anywhere in this project, one at a time — including files you do not have open.',
  aiEntryTitle: 'AI edit',
  aiEmpty: 'No AI edits to undo in this project.',
  aiNoFile: 'Open a file to see its AI edits.',
  aiUndoLast: 'Undo last',
  aiUndoFailed: 'The last AI edit could not be restored.',
};
export type HistoryMessages = typeof history;
