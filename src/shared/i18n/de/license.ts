import type { LicenseMessages } from '../en/license';
export const license: LicenseMessages = {
  // UsageDialog — einmal beim ersten Start. Jederzeit änderbar.
  usageTitle: 'Wie nutzt du Penwright?',
  usageText:
    'Penwright ist für private, akademische und Hobby-Nutzung kostenlos — alle Funktionen, dauerhaft, inklusive der KI- / MCP-Integration. Kommerzielle Nutzung braucht eine Lizenz.',
  usagePersonal: 'Privat, für Studium oder Forschung',
  usagePersonalHint: 'Dauerhaft kostenlos. Sonst nichts zu tun.',
  usageCommercial: 'Beruflich, kommerziell',
  usageCommercialHint: 'Braucht eine Lizenz. Freigeschaltet bleibt so oder so alles.',
  usageChangeHint: 'Du kannst das jederzeit unter „Lizenz" ändern.',

  // Wegklickbarer Hinweis — nur bei selbst erklärter kommerzieller Nutzung ohne Lizenz.
  noticeText: 'Du nutzt Penwright kommerziell. Eine Lizenz hält das fair.',
  noticeBuy: 'Lizenz kaufen',
  noticeDismiss: 'Später',

  // LicenseDialog
  dialogTitle: 'Lizenz',
  dialogLicensed: 'Lizenziert',
  dialogDeactivating: 'Wird deaktiviert...',
  dialogDeactivate: 'Auf diesem Gerät deaktivieren',
  dialogEnterPrompt: 'Gib deinen kommerziellen Lizenzschlüssel ein, um ihn auf diesem Gerät zu aktivieren.',
  dialogActivating: 'Wird aktiviert...',
  dialogActivate: 'Aktivieren',
  dialogBuy: 'Lizenz kaufen',
  dialogContinueWithout: 'Schließen',

  // Nutzungszeile im Lizenz-Dialog.
  dialogUsageLabel: 'Ich nutze Penwright',
  dialogUsagePersonal: 'privat',
  dialogUsageCommercial: 'kommerziell',
  dialogPersonalFree: 'Für private, akademische und Hobby-Nutzung kostenlos — nichts ist gesperrt.',
};
