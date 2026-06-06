/** Comments panel — the fifth sidebar tab. */
export const comments = {
  scopeFile: 'Current file',
  scopeProject: 'Whole project',
  showResolved: 'Show resolved',
  info: 'Comments are stored as Markdown in {folder}. They do not compile into the PDF/DOCX.',
  emptyFile: 'No comments in this file.',
  emptyProject: 'No comments in the project.',
  emptyHint: 'Select text in the editor and click “Add comment” in the toolbar.',
  jumpToAnchor: 'Jump to spot in editor',
  orphanedTitle: 'Anchor text no longer found',
  reopen: 'Reopen',
  markResolved: 'Mark as resolved',
  notePlaceholder: 'Write a note…',
  confirmDelete: 'Really delete this comment?',
  regionAria: 'Comments and annotations',
};

export type CommentsMessages = typeof comments;
