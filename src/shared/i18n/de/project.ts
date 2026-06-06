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

  // History section
  historyTitle: 'Verlauf',
  refresh: 'Aktualisieren',
  refreshHistoryAria: 'Verlauf aktualisieren',
  noVersions: 'Noch keine Versionen.',
  autoTag: 'auto',

  // Backup status
  showBackups: 'Auto-Backups anzeigen',
  lastBackup: (time: string) => `Letztes Auto-Backup ${time}`,
  noBackup: 'Noch kein Auto-Backup',

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
};
