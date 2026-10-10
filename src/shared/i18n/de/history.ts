import type { HistoryMessages } from '../en/history';

export const history: HistoryMessages = {
  openButton: 'Verlauf & Wiederherstellen',
  openButtonAria: 'Verlauf und Wiederherstellen öffnen',
  title: 'Verlauf & Wiederherstellen',
  intro: 'Automatische Kopien und KI-Bearbeitungen, die du zurückholen kannst. Kapitelversionen liegen im Reiter Projekt.',

  versionsTitle: 'Versionen',
  versionsDesc: 'Eine Version ist ein Kapitel. Du benennst sie, öffnest sie zum Lesen oder Bearbeiten und tauschst sie im Reiter Projekt mit der lebenden Datei.',
  versionsEmpty: 'Die Versionen stehen im Reiter Projekt.',

  backupsTitle: 'Auto-Backups',
  backupsDesc: 'Automatische Kopien alle paar Minuten — dein Absturzschutz.',
  backupsEmpty: 'Noch keine Auto-Backups.',
  restore: 'Wiederherstellen',

  aiTitle: 'KI-Änderungen',
  aiDesc: 'Die letzten KI-Bearbeitungen im ganzen Projekt einzeln rückgängig machen — auch in Dateien, die nicht geöffnet sind.',
  aiEntryTitle: 'KI-Bearbeitung',
  aiEmpty: 'Keine KI-Bearbeitungen zum Rückgängigmachen in diesem Projekt.',
  aiNoFile: 'Öffne eine Datei, um ihre KI-Bearbeitungen zu sehen.',
  aiUndoLast: 'Letzte rückgängig',
  aiUndoFailed: 'Die letzte KI-Änderung konnte nicht zurückgeholt werden.',
};
