/** Editor node-view popups + slash commands. */
export const editorLib = {
  // Shared "Done" button label + tooltips (used by image / table / raw block / bibliography node-views)
  blockDone: '✓ Done',
  blockDoneTooltip: 'Exit block and add new line below',
  rawBlockDoneTooltip: 'Exit block and add a new line below (Esc or Cmd+Enter)',
  tableDoneTooltip: 'Exit table and add new line below',

  // Slash commands — titles + descriptions
  slashHeading1Title: 'Heading 1',
  slashHeading1Desc: 'Large heading',
  slashHeading2Title: 'Heading 2',
  slashHeading2Desc: 'Medium heading',
  slashHeading3Title: 'Heading 3',
  slashHeading3Desc: 'Small heading',
  slashBulletListTitle: 'Bullet List',
  slashBulletListDesc: 'Unordered list',
  slashNumberedListTitle: 'Numbered List',
  slashNumberedListDesc: 'Ordered list',
  slashQuoteTitle: 'Quote',
  slashQuoteDesc: 'Blockquote',
  slashCodeBlockTitle: 'Code Block',
  slashCodeBlockDesc: 'Fenced code',
  slashDividerTitle: 'Divider',
  slashDividerDesc: 'Horizontal line',
  slashPageBreakTitle: 'Page Break',
  slashPageBreakDesc: 'Start a new page',
  slashTocTitle: 'Table of Contents',
  slashTocDesc: 'Insert table of contents',
  slashMathTitle: 'Math',
  slashMathDesc: 'Typst math block',
  slashTypstCodeTitle: 'Typst Code',
  slashTypstCodeDesc: 'Raw Typst code',
  slashTableTitle: 'Table',
  slashTableDesc: 'Insert table',
  slashFootnoteTitle: 'Footnote',
  slashFootnoteDesc: 'Insert footnote (opens editor)',
  slashCitationTitle: 'Citation',
  slashCitationDesc: 'Insert citation (@citekey)',
  slashReferenceTitle: 'Reference',
  slashReferenceDesc: 'Insert cross-reference (@label)',
  slashImageTitle: 'Image',
  slashImageDesc: 'Insert image from file',

  // Magazine building blocks (Phase C)
  slashOpenerTitle: 'Article Opener',
  slashOpenerDesc: 'Kicker, title, standfirst & byline',
  slashDropCapTitle: 'Drop Cap',
  slashDropCapDesc: 'Opening paragraph with a dropped initial',
  slashPullQuoteTitle: 'Pull Quote',
  slashPullQuoteDesc: 'Large centered quote with attribution',
  slashQuestionTitle: 'Interview Question',
  slashQuestionDesc: 'Bold question for a Q&A',
  slashCalloutTitle: 'Note Box',
  slashCalloutDesc: 'Framed note with a title',
  slashFigurePanelTitle: 'Figure Panel',
  slashFigurePanelDesc: 'Photo with a framed side note',
  slashMarginNoteTitle: 'Margin Note',
  slashMarginNoteDesc: 'Quiet note in the margin',
  /** Placeholder body for a building block this project defines itself. */
  macroBodyPlaceholder: 'Content',
  slashInterludeTitle: 'Interlude',
  slashInterludeDesc: 'Quiet centered divider',
  slashColumnsTitle: 'Columns',
  slashColumnsDesc: 'Multi-column section',

  // Magazine node editors (popups)
  macroEditHint: 'Esc or Cmd+Enter to close',
  macroPickFile: 'Choose file…',
  // Names the file the path resolves against. It said "relative to this
  // document", which is the belief that broke the picker: Typst resolves a path
  // against the file holding the `image()` call, so for a macro argument that is
  // the macro's own file, not the chapter being edited.
  macroPathHint: (file: string): string => `A file path, relative to ${file}`,
  // The macro only passes the value on, so the base could be a third file.
  // Saying so beats a confident wrong path.
  macroPathHintIndirect: (file: string): string =>
    `A file path. ${file} passes it on, so the base may be a different file — check that it still compiles.`,
  macroDefaultHint: 'Empty = the default from the definition',
  macroDefaultValue: '(default)',
  macroLabelBody: 'Content',
  macroNoFields: 'This building block takes no values.',
  macroShowCode: '</> Code',
  macroShowCodeTooltip: 'Edit the Typst source of this building block',
  macroShowCard: 'Form',
  macroShowCardTooltip: 'Back to the form',
  macroLabelKicker: 'Kicker',
  macroLabelTitle: 'Title',
  macroLabelStandfirst: 'Standfirst',
  macroLabelByline: 'Byline',
  macroLabelNote: 'Note',
  macroOpenerEditTitle: 'Edit article opener',
  macroMarginNoteEditTitle: 'Edit margin note',
  macroOpenerEmpty: 'Untitled article — click to edit',

  // Image dialog
  imageWidthLabel: 'Width',
  imageCustomLabel: 'Custom',
  imageCustomPlaceholder: 'e.g. 60%, 8cm, auto',
  imageAltLabel: 'Alt text',
  imageAltPlaceholder: 'Image description',
  imageAlignLabel: 'Align',
  imageAlignLeft: 'Left',
  imageAlignCenter: 'Center',
  imageAlignRight: 'Right',
  imageAlignTooltip: 'Align {label}',
  imageNoImage: 'No image',

  // Footnote popup
  footnoteEditTitle: 'Click to edit footnote',
  footnoteLabel: 'Footnote',
  footnotePlaceholder: 'Enter footnote text…',
  footnoteHint: 'Esc or Cmd+Enter to close',
  footnotePreviewEmpty: 'click to edit',

  // Table settings
  tableSettingsTitle: 'Table Settings',
  tableHeader: 'Table',
  tableDims: '{cols} columns × {rows} rows',
  tableAddColumnBefore: '+ Column before',
  tableAddColumn: '+ Column after',
  tableAddRowBefore: '+ Row above',
  tableAddRow: '+ Row below',
  tableRemoveColumn: '− Column',
  tableRemoveRow: '− Row',
  tableDelete: 'Delete Table',

  // Bibliography
  bibliographyHeader: 'Bibliography',
  bibliographyEmpty: 'No references found',
  bibliographyUnknownAuthor: 'Unknown',

  // Raw block labels
  /** One human name per raw block — see shared/rawBlockDescription.ts. */
  spacerTooltip: 'Click to change the spacing',
  spacerAmountLabel: 'Amount',
  spacerAmountHint: 'A Typst length, e.g. 0.4em, 12pt, 1cm',
  rawKindInclude: 'chapter included',
  rawKindComment: 'note to self',
  rawKindMath: 'formula',
  rawKindImport: 'style included',
  rawKindSetting: 'setting',
  rawKindRule: 'rule',
  rawKindPageSetup: 'page setup',
  rawKindBinding: 'definition',
  rawKindSpacing: (amount: string): string => `spacing · ${amount}`,
  rawKindPagebreak: 'page break',
  rawKindColbreak: 'column break',
  rawKindLine: 'rule line',
  rawKindCall: (name: string): string => `${name} · design`,
  rawKindCode: 'typst code',
  rawKindText: 'text passage',

  // Page break
  pageBreakLabel: 'Page Break',

  // Link prompt (Cmd+K)
  linkPrompt: 'URL:',
};
export type EditorLibMessages = typeof editorLib;
