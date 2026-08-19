import type { AboutMessages } from '../en/about';
export const about: AboutMessages = {
  // AboutDialog
  aboutTagline: 'Ein WYSIWYG-Editor für Typst-Dokumente.',
  aboutVersion: (v: string) => `Version ${v}`,
  aboutVersionLoading: 'Version …',
  aboutSpecPlatform: 'Plattform',
  aboutSpecElectron: 'Electron',
  aboutSpecChromium: 'Chromium',
  aboutSpecNode: 'Node',
  aboutUserGuide: 'Handbuch',
  aboutWebsite: 'Website',
  aboutReportIssue: 'Problem melden',
  aboutOpenSourceLicenses: 'Open-Source-Lizenzen',
  aboutCopyDiagnostics: 'Diagnose kopieren',
  aboutCopied: 'Kopiert',
  aboutCopyFailed: 'Kopieren fehlgeschlagen',
  aboutCopyrightSuffix: 'René Jesser',

  // AcknowledgmentsDialog
  ackTitle: 'Open-Source-Lizenzen',
  ackSubtitle:
    'Penwright enthält die folgenden Typst-Pakete, jeweils unter ihrer eigenen Lizenz. Die vollständigen Lizenz-Texte siehst du beim Aufklappen.',
  ackLoadError: 'Konnte die Lizenz-Liste nicht laden:',
  ackLoading: 'Lädt Lizenz-Informationen …',
  ackPackagesUnit: (n: number) => `${n} Pakete`,
  ackFontsUnit: (n: number) => `${n} Fonts`,
  ackSectionPackages: 'Typst-Pakete',
  ackSectionFonts: 'Gebündelte Fonts',
  ackShowLicense: 'Lizenz anzeigen',
  ackHideLicense: 'Lizenz schliessen',
  ackSourceCode: 'Quellcode →',
  ackFontSource: 'Quelle →',
  ackFontCuts: (n: number) => `${n} Schnitte`,

  // HandbookViewer
  handbookTitle: 'Handbuch',
};
