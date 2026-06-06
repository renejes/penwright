import type { EditorLibMessages } from '../en/editorLib';
export const editorLib: EditorLibMessages = {
  // Shared "Done" button label + tooltips (used by image / table / raw block / bibliography node-views)
  blockDone: '✓ Fertig',
  blockDoneTooltip: 'Block verlassen und neue Zeile darunter einfügen',
  rawBlockDoneTooltip: 'Block verlassen und neue Zeile darunter (Esc oder Cmd+Enter)',
  tableDoneTooltip: 'Tabelle verlassen und neue Zeile darunter einfügen',

  // Slash commands — titles + descriptions
  slashHeading1Title: 'Überschrift 1',
  slashHeading1Desc: 'Große Überschrift',
  slashHeading2Title: 'Überschrift 2',
  slashHeading2Desc: 'Mittlere Überschrift',
  slashHeading3Title: 'Überschrift 3',
  slashHeading3Desc: 'Kleine Überschrift',
  slashBulletListTitle: 'Aufzählung',
  slashBulletListDesc: 'Ungeordnete Liste',
  slashNumberedListTitle: 'Nummerierte Liste',
  slashNumberedListDesc: 'Geordnete Liste',
  slashQuoteTitle: 'Zitat',
  slashQuoteDesc: 'Blockzitat',
  slashCodeBlockTitle: 'Codeblock',
  slashCodeBlockDesc: 'Eingefasster Code',
  slashDividerTitle: 'Trennlinie',
  slashDividerDesc: 'Horizontale Linie',
  slashPageBreakTitle: 'Seitenumbruch',
  slashPageBreakDesc: 'Eine neue Seite beginnen',
  slashTocTitle: 'Inhaltsverzeichnis',
  slashTocDesc: 'Inhaltsverzeichnis einfügen',
  slashMathTitle: 'Formel',
  slashMathDesc: 'Typst-Formelblock',
  slashTypstCodeTitle: 'Typst-Code',
  slashTypstCodeDesc: 'Roher Typst-Code',
  slashTableTitle: 'Tabelle',
  slashTableDesc: 'Tabelle einfügen',
  slashFootnoteTitle: 'Fußnote',
  slashFootnoteDesc: 'Fußnote einfügen (öffnet Editor)',
  slashCitationTitle: 'Zitation',
  slashCitationDesc: 'Zitation einfügen (@citekey)',
  slashReferenceTitle: 'Querverweis',
  slashReferenceDesc: 'Querverweis einfügen (@label)',
  slashImageTitle: 'Bild',
  slashImageDesc: 'Bild aus Datei einfügen',

  // Image dialog
  imageWidthLabel: 'Breite',
  imageCustomLabel: 'Eigene',
  imageCustomPlaceholder: 'z. B. 60%, 8cm, auto',
  imageAltLabel: 'Alt-Text',
  imageAltPlaceholder: 'Bildbeschreibung',
  imageAlignLabel: 'Ausrichtung',
  imageAlignLeft: 'Links',
  imageAlignCenter: 'Zentriert',
  imageAlignRight: 'Rechts',
  imageAlignTooltip: 'Ausrichtung {label}',
  imageNoImage: 'Kein Bild',

  // Footnote popup
  footnoteEditTitle: 'Zum Bearbeiten der Fußnote klicken',
  footnoteLabel: 'Fußnote',
  footnotePlaceholder: 'Fußnotentext eingeben…',
  footnoteHint: 'Esc oder Cmd+Enter zum Schließen',
  footnotePreviewEmpty: 'zum Bearbeiten klicken',

  // Table settings
  tableSettingsTitle: 'Tabelleneinstellungen',
  tableHeader: 'Tabelle',
  tableDims: '{cols} Spalten × {rows} Zeilen',
  tableAddColumn: '+ Spalte',
  tableAddRow: '+ Zeile',
  tableRemoveColumn: '− Spalte',
  tableRemoveRow: '− Zeile',
  tableDelete: 'Tabelle löschen',

  // Bibliography
  bibliographyHeader: 'Literaturverzeichnis',
  bibliographyEmpty: 'Keine Quellen gefunden',
  bibliographyUnknownAuthor: 'Unbekannt',

  // Raw block labels
  rawBlockMath: 'typst · Formel',
  rawBlockConfig: 'typst · Konfiguration',
  rawBlockCode: 'typst · Code',
  rawBlockComment: 'typst · Kommentar',
  rawBlockDefault: 'typst',

  // Page break
  pageBreakLabel: 'Seitenumbruch',

  // Link prompt (Cmd+K)
  linkPrompt: 'URL:',
};
