import type { McpConnectionMessages } from '../en/mcpConnection';

/** MCP-Verbindung — wo Penwright seinen MCP-Server registriert. */
export const mcpConnection: McpConnectionMessages = {
  title: 'MCP-Verbindung',
  intro: 'Penwright ist ein MCP-Server. Verbinde ihn mit dem Editor, in dem du arbeitest — Cursor wird beim Start automatisch eingetragen.',
  probing: 'MCP-Hosts werden geprüft…',

  cursor: {
    label: 'Cursor',
    desc: 'In ~/.cursor/mcp.json eintragen, damit die Penwright-Tools in jedem Cursor-Workspace auf diesem Rechner verfügbar sind.',
  },
  claude: {
    label: 'Claude Code',
    desc: 'Direkt bei Claude Code im User-Scope registrieren (global, in ~/.claude.json).',
  },

  recommended: 'Empfohlen',
  current: 'Verbunden',
  connect: 'Verbinden',
  connecting: 'Wird verbunden…',
  close: 'Schließen',
  freeForEveryone:
    'Der MCP-Server ist für alle freigeschaltet — alle 66 Tools, ohne Schlüssel, ohne Zeitlimit.',

  done: {
    cursorTitle: 'Mit Cursor verbunden',
    cursorBody: 'Penwright steht in ~/.cursor/mcp.json. Lade das Cursor-Fenster neu (oder schalte den Server unter Settings → Tools & MCP einmal aus und wieder ein), falls die Tools noch nicht erscheinen.',
    claudeTitle: 'Mit Claude Code verbunden',
    claudeBody: 'Penwright ist bei Claude Code (User-Scope) registriert.',
    viaCli: 'Über die claude-CLI registriert.',
    viaFile: 'Eintrag direkt in die Konfigurationsdatei geschrieben.',
  },

  error: {
    generic: 'Verbindung konnte nicht übernommen werden:',
  },

  details: 'Details',
  cursorConfigLabel: 'Cursor-Konfiguration:',
  claudeConfigLabel: 'Claude-Code-Konfiguration:',
};
