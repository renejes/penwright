import type { PickersMessages } from '../en/pickers';

export const pickers: PickersMessages = {
  // ── Reference picker (cross-reference insert) ──────────
  refPickerTitle: 'Cross-Reference einfügen',
  refPickerSearchPlaceholder: 'Label, Caption oder Datei filtern…',
  refPickerFilterAll: 'Alle',
  refPickerFilterFigure: 'Abb.',
  refPickerFilterTable: 'Tab.',
  refPickerFilterEquation: 'Gl.',
  refPickerFilterHeading: '§',
  refPickerFilterOther: 'Andere',
  refPickerGroupFigure: 'Abbildungen',
  refPickerGroupTable: 'Tabellen',
  refPickerGroupEquation: 'Gleichungen',
  refPickerGroupHeading: 'Überschriften',
  refPickerGroupOther: 'Andere Labels',
  refPickerLoading: 'Labels werden gesammelt…',
  refPickerNoneFound: 'Keine <label>s im Projekt gefunden.',
  refPickerNoneHint: 'Setze in deinem Source z. B. <fig:results> nach einer Figur, dann erscheinen sie hier.',
  refPickerNoMatch: (query: string) => `Kein Treffer für „${query}“.`,
  refPickerTruncated: 'Mehr als 2.000 Labels — Liste gekürzt. Filtere mit dem Suchfeld.',
  refPickerFooterSelect: 'wählen',
  refPickerFooterInsert: 'einfügen',
  refPickerFooterCancel: 'abbrechen',

  // ── Project search panel ───────────────────────────────
  projSearchRegionAria: 'Im Projekt suchen',
  projSearchHideReplace: 'Ersetzen ausblenden',
  projSearchShowReplace: 'Ersetzen anzeigen',
  projSearchPlaceholder: 'Im Projekt suchen…',
  projSearchCaseTitle: 'Groß-/Kleinschreibung (Aa)',
  projSearchWholeWordTitle: 'Ganzes Wort (W)',
  projSearchRegexTitle: 'Regulärer Ausdruck (.*)',
  projSearchBibTitle: '.bib-Dateien einbeziehen',
  projSearchReplacePlaceholder: 'Ersetzen durch…',
  projSearchReplaceAll: 'Alle ersetzen',
  projSearchReplacing: 'Ersetze…',
  projSearchReplaceAllTitle: 'Alle Treffer ersetzen',
  projSearchSearching: 'Suche…',
  projSearchError: (msg: string) => `Fehler: ${msg}`,
  projSearchSummary: (matches: number, files: number) =>
    `${matches} Treffer in ${files} ${files === 1 ? 'Datei' : 'Dateien'}`,
  projSearchTruncated: ' · Liste gekürzt (max 1000)',
  projSearchNoMatches: 'Keine Treffer.',
  projSearchRootLabel: '(root)',
  projSearchJumpTitle: 'Zur Stelle springen',
  projSearchConfirmReplace: (matches: number, files: number) =>
    `Wirklich ${matches} Treffer in ${files} Datei(en) ersetzen?\n\n` +
    `Eine automatische Version wird vorher nicht angelegt — speichere ggf. zuerst manuell eine Version.`,
  projSearchReplacedSummary: (replacements: number, files: number) =>
    `${replacements} Treffer in ${files} Datei(en) ersetzt.`,

  // ── Citation hover card ────────────────────────────────
  citationMissing: 'Nicht in references.bib',
  citationChecking: 'Suche Quelle…',
  citationOpenPdf: 'PDF öffnen',
  citationNoPdf: 'Keine PDF in {folder}',
  citationNoAuthor: '(kein Autor)',
  citationNoTitle: '(kein Titel)',

  // ── New project dialog ─────────────────────────────────
  newProjectTitle: 'Neues Projekt',
  newProjectNameLabel: 'Projektname',
  newProjectNamePlaceholder: 'mein-projekt',
  newProjectTemplateLabel: 'Vorlage',
  newProjectCreate: 'Projekt erstellen',

  // ── Includes / chapters panel ──────────────────────────
  includesEmpty: 'Keine #include-Anweisungen',
  includesLabel: 'Kapitel',
  includesMoveUp: 'Nach oben',
  includesMoveDown: 'Nach unten',
  includesRemove: 'Entfernen',
  includesAddChapter: '+ Kapitel hinzufügen',

  // ── Outline panel ──────────────────────────────────────
  outlineEmpty: 'Keine Überschriften',
  outlineLabel: 'Gliederung',
  outlineUntitled: '(ohne Titel)',
  outlineFindRefs: 'Verweise auf diese Überschrift finden',
  outlineFindRefsAria: (title: string) => `Verweise auf ${title} finden`,

  // ── Preview panel ──────────────────────────────────────
  previewLabel: 'Vorschau',
  previewCompiling: 'Kompiliere…',
  previewError: 'Fehler',
  previewOutdated: 'Veraltet',
  previewRefresh: 'Vorschau aktualisieren',
  previewZoomOut: 'Verkleinern',
  previewZoomIn: 'Vergrößern',
  previewResetZoom: 'Zoom zurücksetzen',
  previewSpreadOn: 'Doppelseite',
  previewSpreadOff: 'Einzelseite',
  previewNoPreview: 'Keine Vorschau',
  previewNoPreviewHint: 'Speichere eine .typ-Datei, um die PDF-Vorschau zu sehen',

  // ── PDF file viewer ────────────────────────────────────
  pdfPages: (count: number) => `${count} ${count === 1 ? 'Seite' : 'Seiten'}`,
  pdfLoadFailed: (err: string) => `PDF konnte nicht geladen werden: ${err}`,
  pdfLoading: 'PDF wird geladen...',

  // ── Text file viewer ───────────────────────────────────
  textLoadError: (err: string) => `Fehler beim Laden der Datei: ${err}`,
  textSaving: 'Speichere...',

  // ── Terminal panel ─────────────────────────────────────
  terminalLabel: 'Terminal / KI',
};
