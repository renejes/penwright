/** License gate (trial expired) + license activation dialog. */
export const license = {
  // LicenseGate
  gateTitle: 'Trial expired',
  gateText:
    'Your 14-day trial has ended. A Penwright license unlocks everything permanently — including the AI / MCP integration.',
  gateBuy: 'Buy license – €59',
  gateEnterKey: 'Enter key',
  gateChecking: 'Checking…',
  gateCheckAgain: 'Check again',
  gateNoLicenseYet: 'No active license found yet.',
  gateCheckFailed: 'Check failed — are you online?',

  // LicenseDialog
  dialogTitle: 'License',
  dialogLicensed: 'Licensed',
  dialogDeactivating: 'Deactivating...',
  dialogDeactivate: 'Deactivate on this device',
  dialogEnterPrompt: 'Enter your license key to activate Penwright on this device.',
  dialogActivating: 'Activating...',
  dialogActivate: 'Activate',
  dialogBuy: 'Buy License',
  dialogContinueWithout: 'Continue without license',
};
export type LicenseMessages = typeof license;
