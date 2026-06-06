/** Export dialog — format picker + chapter selection. */
export const exportDialog = {
  title: 'Export',
  formatLabel: 'Format',
  pdfName: 'PDF',
  pdfDesc: 'Print-ready, with layout & fonts',
  docxName: 'Word (DOCX)',
  docxDesc: 'With Word styles & live numbering',
  sectionsLabel: 'What should be exported?',
  selectAll: 'all',
  selectNone: 'none',
  bibliography: 'Bibliography',
  hint: 'The title page, the table of contents and everything before the first chapter are always exported as well.',
  counter: (selected: number, total: number) => `${selected} / ${total} selected`,
  exporting: 'Exporting…',
  exportAs: (format: string) => `Export as ${format}`,
  failed: (message: string) => `Export failed: ${message}`,
};

export type ExportDialogMessages = typeof exportDialog;
