import type { BackupMessages } from '../en/backup';
export const backup: BackupMessages = {
  title: 'Auto-Backups',
  settingsButton: 'Einstellungen',
  settingsAria: 'Backup-Einstellungen',
  settingsTitle: 'Einstellungen',
  intervalLabel: 'Backup-Intervall',
  intervalEvery10Sec: 'alle 10 Sekunden',
  intervalEvery30Sec: 'alle 30 Sekunden',
  intervalEveryMinute: 'jede Minute',
  intervalEvery5Min: 'alle 5 Minuten',
  maxCountLabel: 'Maximale Anzahl Backups',
  maxCountOption: (count: number) => `${count} Backups`,
  maxCountUnlimited: '1000 Backups (unbegrenzt)',
  maxAiSnapshotsLabel: 'Maximale AI-Edit-Snapshots',
  settingsNotePrefix: 'Backups werden in ',
  settingsNoteSuffix: ' innerhalb des Projektordners gespeichert.',
  loading: 'Lade Backups...',
  emptyLine1: 'Noch keine Auto-Backups vorhanden.',
  emptyLine2: 'Sobald du am Projekt arbeitest, werden hier automatisch Backups gespeichert.',
  hint: 'Auto-Backups schützen vor Abstürzen. Klicke auf „Laden", um einen Stand zurückzuholen.',
  fileCount: (count: number) => `${count} ${count === 1 ? 'Datei' : 'Dateien'}`,
  loadButton: 'Laden',
  applyConfirm: (date: string) =>
    `Aktueller Stand wird durch das Backup vom ${date} ersetzt.\n\n` +
    `Tipp: Speichere vorher den aktuellen Stand als eigene Version, falls du nichts verlieren willst.\n\nFortfahren?`,
  applyFailed: 'Backup konnte nicht angewendet werden.',
  applyError: (msg: string) => `Fehler beim Anwenden: ${msg}`,
};
