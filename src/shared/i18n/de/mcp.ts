import type { McpMessages } from '../en/mcp';

export const mcp: McpMessages = {
  intro: {
    title: 'Mit Claude Desktop verbinden',
    body: 'Penwright kann den eingebauten MCP-Server bei Claude Desktop registrieren, damit du deine Typst-Projekte direkt aus Claude heraus bearbeiten kannst.',
    probing: 'Prüfe, ob Claude Desktop installiert ist…',
  },

  unsupported: {
    title: 'Derzeit nur unter macOS',
    body: 'Die automatische Einrichtung ist aktuell nur für macOS verfügbar. Auf anderen Plattformen kannst du den MCP-Server manuell registrieren — siehe Dokumentation.',
  },

  noClaude: {
    title: 'Claude Desktop nicht gefunden',
    body: 'Wir konnten Claude Desktop auf deinem Mac nicht finden. Installiere es zuerst — die Verbindung mit Penwright kannst du danach jederzeit über das Hilfe-Menü starten.',
    pathsChecked: 'Geprüft an diesen Pfaden',
    download: 'Claude Desktop laden',
    later: 'Später',
  },

  ready: {
    title: 'Bereit zum Verbinden',
    body: 'Penwright installiert einen eigenständigen MCP-Server in deinem Benutzer-Verzeichnis und trägt ihn in Claude Desktops Konfiguration ein.',
    bullets: [
      'Server läuft unabhängig von Penwright — Reihenfolge beim Starten egal',
      'Andere MCP-Server in deiner Config bleiben unverändert',
      'Vor jedem Schreibvorgang wird ein Backup deiner Config angelegt',
      'Wiederholtes Ausführen ist idempotent (kein Duplikat)',
      'Du kannst es jederzeit über das Hilfe-Menü erneut ausführen',
    ],
    later: 'Später',
    connect: 'Jetzt verbinden',
  },

  running: {
    body: 'Verbinde Penwright mit Claude Desktop…',
  },

  done: {
    title: 'Verbunden!',
    alreadyConfigured: 'Penwright war bereits in Claude Desktop registriert — alles unverändert.',
    success: 'Claude Desktop kennt jetzt den Penwright MCP-Server.',
    importantLabel: 'Wichtig:',
    restartHint: 'Starte Claude Desktop neu, damit die neue MCP-Verbindung aktiv wird.',
    preservedServers: (n: number) => `${n} weitere${n === 1 ? 'r' : ''} MCP-Server`,
    preservedServersBody: 'wurden in deiner Config unverändert beibehalten:',
    detailsSummary: 'Details',
    binaryLabel: 'Binary:',
    configLabel: 'Config:',
    backupLabel: 'Backup:',
    openClaude: 'Claude Desktop öffnen',
  },

  error: {
    title: 'Verbindung fehlgeschlagen',
    body: 'Das automatische Einrichten ist nicht durchgegangen. Details:',
  },
};
