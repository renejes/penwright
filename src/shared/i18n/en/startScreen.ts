/** Start screen (no project open). */
export const startScreen = {
  subtitle: 'WYSIWYG Editor for Typst',

  typstNotFound: 'Typst not found',
  typstNeeded: 'Live preview and PDF export require the Typst CLI.',
  typstInstallMac: 'Install with:',
  typstInstallWin: 'Install with:',
  typstInstallOther: 'Install from',
  typstInstalled: 'Typst CLI installed',

  newProject: 'New Project',
  newProjectDesc: 'Document, Thesis, Paper, Letter, or Book',
  openSample: 'Open Sample Project',
  openSampleDesc: 'A guided thesis on AI-assisted writing — every feature in one place',
  openProject: 'Open Project',
  openProjectDesc: 'Open an existing project folder',

  recent: 'Recent Projects',

  aiTitle: 'AI integration',
  skillsIntro: 'Every new project automatically gets 3 Claude Code Skills deployed to',
  skillTypst: 'Typst language reference',
  skillPenwright: 'Project conventions',
  skillResearch: 'Deep web research',
  aiHint: 'Connect Claude Desktop (Help → Connect to Claude Desktop) and AI agents can edit your .typ files directly — the editor updates live.',

  shortcutNew: 'New',
  shortcutOpen: 'Open',
  shortcutSidebar: 'Sidebar',
};
export type StartScreenMessages = typeof startScreen;
