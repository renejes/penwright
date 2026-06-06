import type { VersionMessages } from '../en/version';
export const version: VersionMessages = {
  title: 'Version-Details',
  loadingDiff: 'Lade Diff...',
  noChanges: 'Keine Änderungen für diese Version gefunden.',
  noTextChange: 'Keine Textänderung sichtbar.',
  statusAdded: 'neu',
  statusModified: 'geändert',
  statusDeleted: 'gelöscht',
  statusRenamed: 'umbenannt',
  restore: 'Diese Version wiederherstellen',
  restoring: 'Wird wiederhergestellt…',
  restoreConfirm:
    'Aktueller Stand wird durch diese Version ersetzt. Fortfahren?\n\n' +
    'Tipp: Ungespeicherte Änderungen vorher als eigene Version speichern.',
  restoreFailed: (msg: string) => `Wiederherstellen fehlgeschlagen: ${msg}`,
};
