/** Boot-time crash report dialog. */
export const crash = {
  introTitle: 'An error occurred during the last start',
  detailTitle: 'Error report',
  closeTitle: 'Close',
  introBodyBefore: 'Penwright has created a report with the error type and your recent actions. ',
  introBodyStrong: 'Paths and file contents are not included',
  introBodyAfter: ' — you decide whether and with whom you share the report.',
  introHint: 'The report stays stored locally on your machine until you delete it.',
  viewReport: 'View report',
  discard: 'Discard',
  discardTitle: 'Delete this report',
  openFolder: 'Open folder',
  openFolderTitle: 'Open the crash reports folder in Finder',
  copyToClipboard: 'Copy to clipboard',
  copied: '✓ Copied',
  prepareMail: 'Prepare email',
  mailed: '✓ Mail opened',
  discardConfirm:
    'Really delete this report?\n\n' +
    'If you want to keep it first, you can save it via “Copy to clipboard” or “Prepare email”.',
};
export type CrashMessages = typeof crash;
