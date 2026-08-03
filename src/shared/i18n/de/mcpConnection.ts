import type { McpConnectionMessages } from '../en/mcpConnection';

/** MCP-Verbindung — wo Penwright seinen MCP-Server registriert. */
export const mcpConnection: McpConnectionMessages = {
  title: 'MCP-Verbindung',
  intro: 'Penwright ist ein MCP-Server. Wähle, wo er sich registriert — es ist immer nur genau eine Verbindung aktiv.',
  probing: 'Meta-MCP wird geprüft…',

  meta: {
    label: 'Meta-MCP',
    desc: 'Beim lokalen Meta-MCP-Proxy registrieren (localhost:3663). Alle deine MCP-Server an einem Ort.',
    running: 'Läuft',
    notRunning: 'Läuft nicht',
  },
  claude: {
    label: 'Claude Code',
    desc: 'Direkt bei Claude Code im User-Scope registrieren (global, in ~/.claude.json).',
  },

  recommended: 'Empfohlen',
  current: 'Aktuell aktiv',
  apply: 'Übernehmen',
  applying: 'Wird übernommen…',
  close: 'Schließen',
  freeForEveryone:
    'Der MCP-Server ist für alle freigeschaltet — alle 66 Tools, ohne Schlüssel, ohne Zeitlimit.',

  done: {
    metaTitle: 'Über Meta-MCP verbunden',
    metaBody: 'Penwright ist beim Meta-MCP-Proxy registriert und aus Claude Code entfernt.',
    claudeTitle: 'Mit Claude Code verbunden',
    claudeBody: 'Penwright ist bei Claude Code (User-Scope) registriert und aus Meta-MCP entfernt.',
    viaCli: 'Über die claude-CLI registriert.',
    viaFile: 'Eintrag direkt in ~/.claude.json geschrieben.',
  },

  error: {
    metaNotRunning: 'Meta-MCP läuft nicht. Starte die Meta-MCP-App und versuche es erneut — oder wähle stattdessen Claude Code.',
    generic: 'Verbindung konnte nicht übernommen werden:',
  },

  details: 'Details',
  metaConfigLabel: 'Meta-MCP-Konfiguration:',
  claudeConfigLabel: 'Claude-Code-Konfiguration:',
};
