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

  // Print ("Für den Druck") mode — only shown for PDF.
  print: {
    label: 'For print',
    toggle: 'Prepare for a print shop (bleed + crop marks)',
    bleedLabel: 'Bleed',
    bleedNone: 'none',
    bleedCustom: 'custom…',
    cropMarks: 'Crop marks',
    facingPages: 'Facing pages (inner / outer margins)',
    bindingLabel: 'Binding gutter',
    rememberDefault: 'Remember as project default',
    hint: 'Produces a print-ready PDF with bleed + crop marks in RGB. For colour-accurate offset printing the print shop (or a follow-up step) converts it to CMYK / PDF-X.',
    lowResTitle: (n: number): string => `${n} image${n === 1 ? '' : 's'} may be too low-resolution for print:`,
  },
};

export type ExportDialogMessages = typeof exportDialog;
