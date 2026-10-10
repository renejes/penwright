import type { ProjectMessages } from '../en/project';
export const project: ProjectMessages = {
  noProjectName: 'Kein Projekt geöffnet',
  showInFinder: 'Im Finder zeigen',
  emptyStateTitle: 'Kein Projekt geöffnet.',
  emptyStateHint: 'Öffne oder erstelle ein Projekt, um Versionen anzulegen.',

  // Save version card
  saveInputPlaceholder: 'Was hast du gerade fertig?',
  saveVersion: 'Version speichern',
  saving: '...',
  saveDisabledNoSelection: 'Keine Änderungen ausgewählt',
  saveDisabledTitle: 'Version speichern',
  saveFailed: (msg: string) => `Speichern fehlgeschlagen: ${msg}`,

  // Changes section
  changesTitle: 'Änderungen seit letzter Version',
  selectAll: 'alle',
  selectNone: 'keine',
  selectAllTitle: 'Alle anhaken',
  selectNoneTitle: 'Alle abhaken',
  noChanges: 'Keine Änderungen seit der letzten Version.',
  firstVersionHint: 'Bei der ersten Version wird automatisch ein Verlauf für dieses Projekt angelegt.',

  // File status labels
  statusModified: 'geändert',
  statusAdded: 'hinzugefügt',
  statusDeleted: 'gelöscht',
  statusNew: 'neu',
  statusRenamed: 'umbenannt',

  // History (version list shown in the History & Restore hub)
  refresh: 'Aktualisieren',
  refreshHistoryAria: 'Verlauf aktualisieren',
  autoTag: 'auto',

  // Relative time
  justNow: 'gerade eben',
  secondsAgo: (s: number) => `vor ${s} s`,
  minutesAgo: (m: number) => `vor ${m} min`,
  hoursAgo: (h: number) => `vor ${h} h`,

  // Advanced / cloud sync
  advanced: 'Erweitert',
  cloudUrlLabel: 'Cloud-Backup-URL (optional)',
  cloudUrlPlaceholder: 'https://github.com/user/projekt.git',
  cloudPush: '↑ Mit Cloud synchronisieren',
  cloudPull: '↓ Cloud-Backup laden',
  openBackupFolder: 'Backup-Ordner öffnen',
  cloudUrlFailed: (msg: string) => `Cloud-URL konnte nicht gesetzt werden: ${msg}`,
  cloudPushFailed: (msg: string) => `Mit Cloud synchronisieren fehlgeschlagen: ${msg}`,
  cloudPullConfirm:
    'Cloud-Backup wird mit dem aktuellen Stand zusammengeführt. Lokale Änderungen können dabei überschrieben werden.\n\n' +
    'Tipp: Speichere vorher den aktuellen Stand als eigene Version, falls du nichts verlieren willst.\n\n' +
    'Fortfahren?',
  cloudPullFailed: (msg: string) => `Cloud-Backup konnte nicht geladen werden: ${msg}`,

  versionOf: (file: string) => `Nur diese Datei: ${file}`,
  noOpenChapter: 'Öffne ein Kapitel. Eine Version gilt immer für den Tab, den du gerade siehst.',
  createVersion: 'Version anlegen',
  openRead: 'Lesen',
  openEdit: 'Bearbeiten',
  makeMain: 'Zur Hauptfassung',
  makeMainTitle: 'Diese Version mit der lebenden Kapiteldatei tauschen',
  makeMainConfirm: 'Die Kapiteldatei und diese Version tauschen den Text. Die Version behält ihren Namen und enthält danach den bisherigen Kapiteltext. Die Kapiteldatei wird zu dem, was jetzt in der Version steht.',
  deleteVersion: 'Löschen',
  deleteConfirm: (name: string) => `Version „${name}“ löschen?`,
  rename: 'Umbenennen',
  renamePrompt: 'Name dieser Version',
  versionsEmpty: 'Noch keine Versionen.',
  versionsTitle: 'Versionen',
  versionMenu: 'Aktionen für diese Version',
  nameTaken: 'Eine Version mit diesem Namen gibt es schon.',
  versionFailed: (msg: string) => `Das hat nicht geklappt: ${msg}`,
};
