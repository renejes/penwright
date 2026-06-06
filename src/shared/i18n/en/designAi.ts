/** Design-with-AI popover — the handoff card at a pinned selection. */
export const designAi = {
  starterPrompt: [
    'Design the selection pinned in Penwright — first call `penwright_get_selection`',
    'to see the text and the current look. Turn it into: <describe here>.',
    'Keep it consistent with the existing theme, palette and layout.',
  ].join(' '),
  toastUpdated: '✓ Document updated',
  title: '✨ Design with AI',
  unpinTitle: 'Unpin',
  unpinAria: 'Unpin',
  ctxTheme: 'Theme',
  ctxAccent: 'Accent',
  ctxRubric: 'Rubric',
  ownDesign: 'Custom design',
  copyPrompt: 'Copy prompt',
  copied: '✓ Copied',
  openClaude: 'Open Claude',
  hint: 'Paste into Claude, replace “<describe here>”, send. It then appears here automatically.',
};
export type DesignAiMessages = typeof designAi;
