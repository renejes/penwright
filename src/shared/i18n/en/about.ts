/** About dialog, third-party acknowledgments, and handbook viewer chrome. */
export const about = {
  // AboutDialog
  aboutTagline: 'A WYSIWYG editor for Typst documents.',
  aboutVersion: (v: string) => `Version ${v}`,
  aboutVersionLoading: 'Version …',
  aboutSpecPlatform: 'Platform',
  aboutSpecElectron: 'Electron',
  aboutSpecChromium: 'Chromium',
  aboutSpecNode: 'Node',
  aboutUserGuide: 'User Guide',
  aboutWebsite: 'Website',
  aboutReportIssue: 'Report Issue',
  aboutOpenSourceLicenses: 'Open Source Licenses',
  aboutCopyDiagnostics: 'Copy diagnostics',
  aboutCopied: 'Copied',
  aboutCopyFailed: 'Copy failed',
  aboutCopyrightSuffix: 'René Jesser',

  // AcknowledgmentsDialog
  ackTitle: 'Open Source Licenses',
  ackSubtitle:
    'Penwright bundles the following Typst packages, each under its own license. Expand an entry to read the full license text.',
  ackLoadError: 'Could not load the license list:',
  ackLoading: 'Loading license information …',
  ackPackagesUnit: (n: number) => `${n} packages`,
  ackFontsUnit: (n: number) => `${n} fonts`,
  ackSectionPackages: 'Typst packages',
  ackSectionFonts: 'Bundled fonts',
  ackShowLicense: 'Show license',
  ackHideLicense: 'Hide license',
  ackSourceCode: 'Source code →',
  ackFontSource: 'Source →',
  ackFontCuts: (n: number) => `${n} cuts`,

  // HandbookViewer
  handbookTitle: 'User Guide',
};
export type AboutMessages = typeof about;
