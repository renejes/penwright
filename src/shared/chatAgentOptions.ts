/**
 * The load-bearing tool restriction for the in-app Cursor agent.
 *
 * Default local agents auto-run shell / edit / write. If those stay on,
 * the agent writes `.typ` / `style.typ` past snapshots, the style guard
 * and safe-apply — a P4 break. Every `Agent.create` / `resume` / `send`
 * path must go through `buildChatAgentOptions` so there is no way to
 * forget the allowlist.
 *
 * Pure: no Electron, no `@cursor/sdk`. The shape is asserted by
 * `scripts/chat-agent-options-test.mts` without mocking the SDK.
 */

export const CHAT_TOOLS = ['mcp', 'read', 'grep', 'glob', 'ls'] as const;
export const CHAT_DISALLOWED_TOOLS = ['shell', 'task'] as const;
export const DEFAULT_CHAT_MODEL_ID = 'composer-2.5';

export type ChatToolName = (typeof CHAT_TOOLS)[number];
export type ChatDisallowedToolName = (typeof CHAT_DISALLOWED_TOOLS)[number];

export interface ChatMcpServerDef {
  command: string;
  args: string[];
  env: Record<string, string>;
}

export interface ChatAgentOptionsInput {
  projectDir: string;
  mcp: ChatMcpServerDef;
  modelId: string;
}

export interface ChatMcpServerConfig {
  type: 'stdio';
  command: string;
  args: string[];
  env: Record<string, string>;
  cwd: string;
}

/**
 * Options handed to `Agent.create` / `Agent.resume`. `settingSources` is
 * deliberately absent: `"user"` would load `~/.cursor/mcp.json`, which
 * Penwright already writes on boot — a second Penwright MCP plus whatever
 * the Cursor IDE has configured.
 */
export interface ChatAgentOptions {
  model: { id: string };
  local: { cwd: string };
  mcpServers: { penwright: ChatMcpServerConfig };
  tools: ChatToolName[];
  disallowedTools: ChatDisallowedToolName[];
}

export function buildChatAgentOptions(input: ChatAgentOptionsInput): ChatAgentOptions {
  const modelId = input.modelId.trim() || DEFAULT_CHAT_MODEL_ID;
  return {
    model: { id: modelId },
    local: { cwd: input.projectDir },
    mcpServers: {
      penwright: {
        type: 'stdio',
        command: input.mcp.command,
        args: input.mcp.args,
        env: input.mcp.env,
        cwd: input.projectDir,
      },
    },
    tools: [...CHAT_TOOLS],
    disallowedTools: [...CHAT_DISALLOWED_TOOLS],
  };
}

/** POSIX single-quote so a path with spaces survives `bash -c`. */
export function posixQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

/**
 * Cursor's MCP spawn has been seen to split `command` on spaces. The installed
 * binary lives under `Application Support`, so we wrap it as `bash -c exec`
 * whenever the path (or an arg) contains whitespace.
 */
export function quoteStdioCommand(
  command: string,
  args: string[],
): { command: string; args: string[] } {
  const needsShell = /\s/.test(command) || args.some(a => /\s/.test(a));
  if (!needsShell) return { command, args };
  const quoted = [command, ...args].map(posixQuote).join(' ');
  return { command: '/bin/bash', args: ['-c', `exec ${quoted}`] };
}

/**
 * Node's `env` option *replaces* the child environment. Passing only TYPST_*
 * drops HOME / PATH / TMPDIR and the Bun MCP binary then fails during Cursor's
 * tool discovery — the agent sees `mcp_auth` and zero Penwright tools.
 */
export function mergeMcpChildEnv(
  base: Record<string, string | undefined>,
  extra: Record<string, string>,
  projectDir: string,
): Record<string, string> {
  const merged: Record<string, string> = {};
  for (const [key, value] of Object.entries(base)) {
    if (typeof value !== 'string') continue;
    if (key === 'ELECTRON_RUN_AS_NODE') continue;
    merged[key] = value;
  }
  Object.assign(merged, extra);
  merged.PENWRIGHT_PROJECT_DIR = projectDir;
  return merged;
}
