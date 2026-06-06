/** MCP Setup Wizard — opt-in flow that registers Penwright's MCP server in Claude Desktop. */
export const mcp = {
  intro: {
    title: 'Connect to Claude Desktop',
    body: 'Penwright can register its built-in MCP server with Claude Desktop so you can edit your Typst projects directly from Claude.',
    probing: 'Checking whether Claude Desktop is installed…',
  },

  unsupported: {
    title: 'Currently macOS only',
    body: 'Automatic setup is currently only available on macOS. On other platforms you can register the MCP server manually — see the documentation.',
  },

  noClaude: {
    title: 'Claude Desktop not found',
    body: "We couldn't find Claude Desktop on your Mac. Install it first — you can connect it with Penwright anytime later from the Help menu.",
    pathsChecked: 'Checked at these paths',
    download: 'Get Claude Desktop',
    later: 'Later',
  },

  ready: {
    title: 'Ready to connect',
    body: "Penwright installs a standalone MCP server in your user directory and adds it to Claude Desktop's configuration.",
    bullets: [
      "Server runs independently of Penwright — launch order doesn't matter",
      'Other MCP servers in your config stay unchanged',
      'A backup of your config is made before every write',
      "Running it again is idempotent (no duplicate)",
      'You can re-run it anytime from the Help menu',
    ],
    later: 'Later',
    connect: 'Connect now',
  },

  running: {
    body: 'Connecting Penwright to Claude Desktop…',
  },

  done: {
    title: 'Connected!',
    alreadyConfigured: 'Penwright was already registered in Claude Desktop — nothing changed.',
    success: 'Claude Desktop now knows the Penwright MCP server.',
    importantLabel: 'Important:',
    restartHint: 'Restart Claude Desktop so the new MCP connection becomes active.',
    preservedServers: (n: number) => `${n} other MCP server${n === 1 ? '' : 's'}`,
    preservedServersBody: 'were kept unchanged in your config:',
    detailsSummary: 'Details',
    binaryLabel: 'Binary:',
    configLabel: 'Config:',
    backupLabel: 'Backup:',
    openClaude: 'Open Claude Desktop',
  },

  error: {
    title: 'Connection failed',
    body: "Automatic setup didn't go through. Details:",
  },
};

export type McpMessages = typeof mcp;
