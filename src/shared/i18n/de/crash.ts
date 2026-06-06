import type { CrashMessages } from '../en/crash';
export const crash: CrashMessages = {
  introTitle: 'Beim letzten Start ist ein Fehler aufgetreten',
  detailTitle: 'Fehlerbericht',
  closeTitle: 'Schließen',
  introBodyBefore: 'Penwright hat einen Bericht erstellt mit dem Fehler-Typ und deinen letzten Aktionen. ',
  introBodyStrong: 'Pfade und Dateiinhalte sind nicht enthalten',
  introBodyAfter: ' — du entscheidest, ob und an wen du den Bericht weitergibst.',
  introHint: 'Der Bericht bleibt lokal auf deinem Rechner gespeichert, bis du ihn löschst.',
  viewReport: 'Bericht ansehen',
  discard: 'Verwerfen',
  discardTitle: 'Diesen Bericht löschen',
  openFolder: 'Ordner öffnen',
  openFolderTitle: 'Crash-Reports-Ordner im Finder öffnen',
  copyToClipboard: 'In Zwischenablage',
  copied: '✓ Kopiert',
  prepareMail: 'E-Mail vorbereiten',
  mailed: '✓ Mail geöffnet',
  discardConfirm:
    'Diesen Bericht wirklich löschen?\n\n' +
    'Falls du ihn vorher behalten willst, kannst du ihn über „In Zwischenablage kopieren" oder „E-Mail vorbereiten" sichern.',
};
