/** MCP Connection dialog — choose where Penwright registers its MCP server. */
export const mcpConnection = {
  title: 'MCP Connection',
  intro: 'Penwright is an MCP server. Choose where it registers itself — only one connection is ever active at a time.',
  probing: 'Checking Meta-MCP…',

  meta: {
    label: 'Meta-MCP',
    desc: 'Register with the local Meta-MCP proxy (localhost:3663). All your MCP servers stay in one place.',
    running: 'Running',
    notRunning: 'Not running',
  },
  claude: {
    label: 'Claude Code',
    desc: 'Register directly with Claude Code at user scope (global, in ~/.claude.json).',
  },

  recommended: 'Recommended',
  current: 'Currently active',
  apply: 'Apply',
  applying: 'Applying…',
  close: 'Close',
  freeForEveryone:
    'The MCP server is unlocked for everyone — all 66 tools, no key, no time limit.',

  done: {
    metaTitle: 'Connected via Meta-MCP',
    metaBody: 'Penwright is registered with the Meta-MCP proxy and removed from Claude Code.',
    claudeTitle: 'Connected to Claude Code',
    claudeBody: 'Penwright is registered with Claude Code (user scope) and removed from Meta-MCP.',
    viaCli: 'Registered via the claude CLI.',
    viaFile: 'Wrote the entry to ~/.claude.json directly.',
  },

  error: {
    metaNotRunning: 'Meta-MCP isn\'t running. Start the Meta-MCP app, then try again — or choose Claude Code instead.',
    generic: 'Couldn\'t apply the connection:',
  },

  details: 'Details',
  metaConfigLabel: 'Meta-MCP config:',
  claudeConfigLabel: 'Claude Code config:',
};

export type McpConnectionMessages = typeof mcpConnection;
