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
};
