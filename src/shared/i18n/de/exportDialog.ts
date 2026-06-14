import type { ExportDialogMessages } from '../en/exportDialog';

export const exportDialog: ExportDialogMessages = {
  title: 'Export',
  formatLabel: 'Format',
  pdfName: 'PDF',
  pdfDesc: 'Druckfertig, mit Layout & Schriften',
  docxName: 'Word (DOCX)',
  docxDesc: 'Mit Word-Stilen & Live-Nummerierung',
  sectionsLabel: 'Was soll exportiert werden?',
  selectAll: 'alle',
  selectNone: 'keine',
  bibliography: 'Literaturverzeichnis',
  hint: 'Die Titelseite, das Inhaltsverzeichnis und alles vor dem ersten Kapitel werden immer mit-exportiert.',
  counter: (selected: number, total: number) => `${selected} / ${total} ausgewählt`,
  exporting: 'Exportiere…',
  exportAs: (format: string) => `Als ${format} exportieren`,
  failed: (message: string) => `Export fehlgeschlagen: ${message}`,

  print: {
    label: 'Für den Druck',
    toggle: 'Für eine Druckerei aufbereiten (Beschnitt + Schnittmarken)',
    bleedLabel: 'Beschnitt',
    bleedNone: 'kein',
    bleedCustom: 'eigener…',
    cropMarks: 'Schnittmarken',
    facingPages: 'Doppelseiten (Innen-/Außenstege)',
    bindingLabel: 'Bundzuwachs',
    rememberDefault: 'Als Projekt-Standard merken',
    hint: 'Erzeugt ein druckerei-taugliches PDF mit Beschnitt + Schnittmarken in RGB. Für farbverbindlichen Offsetdruck konvertiert die Druckerei (oder ein Nachschritt) nach CMYK / PDF-X.',
    lowResTitle: (n: number): string => `${n} Bild${n === 1 ? '' : 'er'} evtl. zu niedrig aufgelöst für den Druck:`,
  },
};
