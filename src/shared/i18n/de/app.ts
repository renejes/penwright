import type { AppMessages } from '../en/app';

export const app: AppMessages = {
  // Alerts / toasts
  openFileFirst: 'Bitte zuerst eine Datei öffnen.',
  selectTextToComment: 'Bitte Text markieren, der kommentiert werden soll.',
  noProjectOpen: 'Kein Projekt geöffnet.',
  commentCreateFailed: 'Kommentar konnte nicht angelegt werden.',
  selectTextToDesign: 'Bitte Text markieren, der gestaltet werden soll.',
  pinFailed: 'Auswahl konnte nicht gepinnt werden.',

  // Navigation tabs
  navAria: 'Seitenleisten-Panels',
  navFiles: 'Dateien',
  navOutline: 'Gliederung',
  navChapters: 'Kapitel',
  navProject: 'Projekt',
  navComments: 'Kommentare',

  // Tabs
  openFilesAria: 'Geöffnete Dateien',
  closeTabAria: (name: string) => `${name} schließen`,

  // Status bar
  toggleSidebar: 'Seitenleiste umschalten',
  togglePreview: 'Vorschau umschalten',
  statusProject: 'Projekt',
  statusPreview: 'Vorschau',
  wordsLabel: (n: number) => (n === 1 ? 'Wort' : 'Wörter'),
  minRead: (m: number) => `${m} Min. Lesezeit`,
  readingTimeTitle: 'Wortanzahl · geschätzte Lesezeit bei 200 WpM',
  agentWorking: (what: string): string => `KI: ${what}`,
  editorZoom: 'Editor-Zoom',
  editorZoomTitle: 'Editor-Zoom · zum Anpassen klicken',
  zoomOut: 'Verkleinern',
  zoomIn: 'Vergrößern',
  zoomSlider: 'Editor-Zoom-Regler',
  reset: 'Zurücksetzen',
  exporting: (fmt: string) => `Exportiere ${fmt}…`,
  unsaved: 'Nicht gespeichert',
  saved: (time: string) => `Gespeichert ${time}`,

  // License badge + language toggle
  switchLanguage: 'Sprache wechseln (Englisch / Deutsch)',
  licenseTitle: 'Lizenz',
  licensed: 'Lizenziert',
  locked: 'Gesperrt',
  trialStatus: (days: number) => `Testphase: ${days} ${days === 1 ? 'Tag' : 'Tage'}`,

  // Trial banner
  trialLeft: (days: number) => `Testphase — noch ${days} ${days === 1 ? 'Tag' : 'Tage'}`,
  buyNow: 'Jetzt kaufen – 59 €',

  // Hinweis, wenn ein Speichern eine gleichzeitige Aenderung ueberschrieben
  // hat. Die andere Fassung liegt als Snapshot vor — also Hinweis, kein Fehler.
  overwroteExternalChange: (file: string): string =>
    file
      ? `${file} wurde waehrend deiner Bearbeitung anderswo geaendert. Deine Fassung wurde gespeichert; die andere liegt unter Verlauf ▸ KI-Aenderungen.`
      : 'Eine Datei wurde waehrend deiner Bearbeitung anderswo geaendert. Deine Fassung wurde gespeichert; die andere liegt unter Verlauf ▸ KI-Aenderungen.',
};
