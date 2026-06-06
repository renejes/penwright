/**
 * Common UI strings — buttons, labels and verbs reused across many surfaces.
 * Keep this small and generic; surface-specific copy belongs in its own
 * namespace file.
 */
export const common = {
  cancel: 'Cancel',
  apply: 'Apply',
  save: 'Save',
  close: 'Close',
  delete: 'Delete',
  remove: 'Remove',
  open: 'Open',
  ok: 'OK',
  yes: 'Yes',
  no: 'No',
  back: 'Back',
  next: 'Next',
  skip: 'Skip',
  done: 'Done',
  finish: 'Finish',
  loading: 'Loading…',
  retry: 'Retry',
  confirm: 'Confirm',
  edit: 'Edit',
  add: 'Add',
  copy: 'Copy',
  copied: 'Copied',
  undo: 'Undo',
  search: 'Search',
  settings: 'Settings',
  error: 'Error',
  none: 'None',
  default: 'Default',
  language: 'Language',
  openInFinder: 'Show in Finder',
};

export type CommonMessages = typeof common;
