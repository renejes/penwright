/** MCP Connection dialog — register Penwright's MCP server with Cursor or Claude Code. */
export const mcpConnection = {
  title: 'MCP Connection',
  intro: 'Penwright is an MCP server. Connect it to the editor you work in — Cursor is registered automatically on launch.',
  probing: 'Checking MCP hosts…',

  cursor: {
    label: 'Cursor',
    desc: 'Register in ~/.cursor/mcp.json so Penwright tools are available in every Cursor workspace on this machine.',
  },
  claude: {
    label: 'Claude Code',
    desc: 'Register with Claude Code at user scope (global, in ~/.claude.json).',
  },

  recommended: 'Recommended',
  current: 'Connected',
  connect: 'Connect',
  connecting: 'Connecting…',
  close: 'Close',
  freeForEveryone:
    'The MCP server is unlocked for everyone — all 66 tools, no key, no time limit.',

  done: {
    cursorTitle: 'Connected to Cursor',
    cursorBody: 'Penwright is registered in ~/.cursor/mcp.json. Reload the Cursor window (or toggle the server in Settings → Tools & MCP) if the tools do not appear yet.',
    claudeTitle: 'Connected to Claude Code',
    claudeBody: 'Penwright is registered with Claude Code (user scope).',
    viaCli: 'Registered via the claude CLI.',
    viaFile: 'Wrote the entry to the config file directly.',
  },

  error: {
    generic: 'Couldn\'t apply the connection:',
  },

  details: 'Details',
  cursorConfigLabel: 'Cursor config:',
  claudeConfigLabel: 'Claude Code config:',
};

export type McpConnectionMessages = typeof mcpConnection;
