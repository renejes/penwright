import type { DesignAiMessages } from '../en/designAi';
export const designAi: DesignAiMessages = {
  starterPrompt: [
    'Gestalte die in Penwright gepinnte Auswahl — ruf zuerst `penwright_get_selection` auf,',
    'um den Text und den aktuellen Look zu sehen. Mach daraus: <hier beschreiben>.',
    'Halte es konsistent mit dem bestehenden Theme, der Palette und dem Layout.',
  ].join(' '),
  toastUpdated: '✓ Dokument aktualisiert',
  title: '✨ Design with AI',
  unpinTitle: 'Lösen',
  unpinAria: 'Lösen',
  ctxTheme: 'Theme',
  ctxAccent: 'Akzent',
  ctxRubric: 'Rubrik',
  ownDesign: 'Eigenes Design',
  copyPrompt: 'Prompt kopieren',
  copied: '✓ Kopiert',
  openClaude: 'Claude öffnen',
  hint: 'In Claude einfügen, „<hier beschreiben>“ ersetzen, absenden. Erscheint danach automatisch hier.',
};
