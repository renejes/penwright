/** Settings dialog + the global interface-language selector. */
export const settings = {
  title: 'Settings',
  intro:
    'Typography, layout and design now live in the <strong>Design</strong> tab in the sidebar. Only document-specific settings that are not design tokens stay here.',
  interfaceSection: 'Interface',
  interfaceLanguage: 'App language',
  interfaceLanguageHint: 'Language of the Penwright interface. Applies immediately.',
  languageSection: 'Language',
  documentLanguage: 'Document language',
  bibliographySection: 'Bibliography',
  citationStyle: 'Citation style',
  previewSection: 'Preview',
  previewModeLabel: 'Update the PDF preview',
  previewModeAuto: 'Automatically while typing',
  previewModeManual: 'Only when I click Refresh',
  previewModeHint: 'Manual is lighter on long documents — saving still happens automatically; only the preview waits for the ↻ button.',
};

export type SettingsMessages = typeof settings;
