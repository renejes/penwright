/**
 * Usage question (first launch) + commercial licence dialog and notice.
 *
 * Penwright is free and complete for personal, academic and hobby use. A
 * commercial licence is required for commercial use. Nothing is ever locked —
 * these strings ask and inform, they never gate.
 */
export const license = {
  // UsageDialog — asked once, on first launch. Changeable later.
  usageTitle: 'How do you use Penwright?',
  usageText:
    'Penwright is free for personal, academic and hobby use — every feature, forever, including the AI / MCP integration. Commercial use needs a licence.',
  usagePersonal: 'Privately, for study or research',
  usagePersonalHint: 'Free forever. Nothing else to do.',
  usageCommercial: 'At work, commercially',
  usageCommercialHint: 'Needs a licence. Everything stays unlocked either way.',
  usageChangeHint: 'You can change this any time under License.',

  // Dismissible notice — only for self-declared commercial use without a licence.
  noticeText: 'You are using Penwright commercially. A licence keeps that fair.',
  noticeBuy: 'Buy licence',
  noticeDismiss: 'Not now',

  // LicenseDialog
  dialogTitle: 'License',
  dialogLicensed: 'Licensed',
  dialogDeactivating: 'Deactivating...',
  dialogDeactivate: 'Deactivate on this device',
  dialogEnterPrompt: 'Enter your commercial license key to activate it on this device.',
  dialogActivating: 'Activating...',
  dialogActivate: 'Activate',
  dialogBuy: 'Buy License',
  dialogContinueWithout: 'Close',

  // Usage row inside the licence dialog.
  dialogUsageLabel: 'I use Penwright',
  dialogUsagePersonal: 'privately',
  dialogUsageCommercial: 'commercially',
  dialogPersonalFree: 'Free for personal, academic and hobby use — nothing is locked.',
};
export type LicenseMessages = typeof license;
