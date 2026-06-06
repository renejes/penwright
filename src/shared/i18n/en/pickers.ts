/**
 * Shared namespace for the smaller picker / panel / viewer components:
 * ReferencePicker, ProjectSearchPanel, CitationHoverCard, NewProjectDialog,
 * IncludesPanel, OutlinePanel, PreviewPanel, PdfFileViewer, TextFileViewer,
 * TerminalPanel. Keys are area-prefixed to avoid collisions.
 */
export const pickers = {
  // ── Reference picker (cross-reference insert) ──────────
  refPickerTitle: 'Insert cross-reference',
  refPickerSearchPlaceholder: 'Filter by label, caption or file…',
  refPickerFilterAll: 'All',
  refPickerFilterFigure: 'Fig.',
  refPickerFilterTable: 'Tbl.',
  refPickerFilterEquation: 'Eq.',
  refPickerFilterHeading: '§',
  refPickerFilterOther: 'Other',
  refPickerGroupFigure: 'Figures',
  refPickerGroupTable: 'Tables',
  refPickerGroupEquation: 'Equations',
  refPickerGroupHeading: 'Headings',
  refPickerGroupOther: 'Other labels',
  refPickerLoading: 'Collecting labels…',
  refPickerNoneFound: 'No <label>s found in the project.',
  refPickerNoneHint: 'Add e.g. <fig:results> after a figure in your source and they will show up here.',
  refPickerNoMatch: (query: string) => `No match for “${query}”.`,
  refPickerTruncated: 'More than 2,000 labels — list truncated. Filter with the search field.',
  refPickerFooterSelect: 'select',
  refPickerFooterInsert: 'insert',
  refPickerFooterCancel: 'cancel',

  // ── Project search panel ───────────────────────────────
  projSearchRegionAria: 'Search across project',
  projSearchHideReplace: 'Hide replace',
  projSearchShowReplace: 'Show replace',
  projSearchPlaceholder: 'Search in project…',
  projSearchCaseTitle: 'Case-sensitive (Aa)',
  projSearchWholeWordTitle: 'Whole word (W)',
  projSearchRegexTitle: 'Regular expression (.*)',
  projSearchBibTitle: 'Include .bib files',
  projSearchReplacePlaceholder: 'Replace with…',
  projSearchReplaceAll: 'Replace all',
  projSearchReplacing: 'Replacing…',
  projSearchReplaceAllTitle: 'Replace all matches',
  projSearchSearching: 'Searching…',
  projSearchError: (msg: string) => `Error: ${msg}`,
  projSearchSummary: (matches: number, files: number) =>
    `${matches} ${matches === 1 ? 'match' : 'matches'} in ${files} ${files === 1 ? 'file' : 'files'}`,
  projSearchTruncated: ' · list truncated (max 1000)',
  projSearchNoMatches: 'No matches.',
  projSearchRootLabel: '(root)',
  projSearchJumpTitle: 'Jump to spot',
  projSearchConfirmReplace: (matches: number, files: number) =>
    `Really replace ${matches} match(es) in ${files} file(s)?\n\n` +
    `No version is created automatically beforehand — save a version manually first if needed.`,
  projSearchReplacedSummary: (replacements: number, files: number) =>
    `${replacements} match(es) replaced in ${files} file(s).`,

  // ── Citation hover card ────────────────────────────────
  citationMissing: 'Not in references.bib',
  citationChecking: 'Looking for source…',
  citationOpenPdf: 'Open PDF',
  citationNoPdf: 'No PDF in {folder}',
  citationNoAuthor: '(no author)',
  citationNoTitle: '(no title)',

  // ── New project dialog ─────────────────────────────────
  newProjectTitle: 'New Project',
  newProjectNameLabel: 'Project Name',
  newProjectNamePlaceholder: 'my-project',
  newProjectTemplateLabel: 'Template',
  newProjectCreate: 'Create Project',

  // ── Includes / chapters panel ──────────────────────────
  includesEmpty: 'No #include statements',
  includesLabel: 'Chapters',
  includesMoveUp: 'Move up',
  includesMoveDown: 'Move down',
  includesRemove: 'Remove',
  includesAddChapter: '+ Add Chapter',

  // ── Outline panel ──────────────────────────────────────
  outlineEmpty: 'No headings',
  outlineLabel: 'Outline',
  outlineUntitled: '(untitled)',
  outlineFindRefs: 'Find references to this heading',
  outlineFindRefsAria: (title: string) => `Find references to ${title}`,

  // ── Preview panel ──────────────────────────────────────
  previewLabel: 'Preview',
  previewCompiling: 'Compiling…',
  previewError: 'Error',
  previewZoomOut: 'Zoom Out',
  previewZoomIn: 'Zoom In',
  previewResetZoom: 'Reset zoom',
  previewNoPreview: 'No preview',
  previewNoPreviewHint: 'Save a .typ file to see the PDF preview',

  // ── PDF file viewer ────────────────────────────────────
  pdfPages: (count: number) => `${count} ${count === 1 ? 'page' : 'pages'}`,
  pdfLoadFailed: (err: string) => `Failed to load PDF: ${err}`,
  pdfLoading: 'Loading PDF...',

  // ── Text file viewer ───────────────────────────────────
  textLoadError: (err: string) => `Error loading file: ${err}`,
  textSaving: 'Saving...',

  // ── Terminal panel ─────────────────────────────────────
  terminalLabel: 'Terminal / AI',
};

export type PickersMessages = typeof pickers;
