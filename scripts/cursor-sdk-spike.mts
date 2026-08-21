/**
 * Manual Cursor-SDK spike — not in `npm test`.
 *
 * Needs a Cursor login (`CURSOR_API_KEY` or `Cursor.auth.login()` store) and
 * the installed MCP binary (`npm run build:mcp-binary` then a Penwright
 * launch, or a prior MCP setup).
 *
 * Usage:
 *   CURSOR_API_KEY=… npx tsx scripts/cursor-sdk-spike.mts [projectDir]
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Agent, Cursor } from '@cursor/sdk';
import { buildChatAgentOptions, DEFAULT_CHAT_MODEL_ID } from '../src/shared/chatAgentOptions.ts';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sample = path.join(repoRoot, 'resources', 'sample-project');
const src = process.argv[2] || sample;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'penwright-chat-spike-'));
fs.cpSync(src, tmp, { recursive: true });

const mcpBin = process.env.PENWRIGHT_MCP
  || path.join(os.homedir(), 'Library', 'Application Support', 'Penwright', 'mcp-server', 'penwright-mcp');

if (!fs.existsSync(mcpBin) && !process.env.CURSOR_API_KEY) {
  console.error('Need PENWRIGHT_MCP or the installed binary, and CURSOR_API_KEY (or a stored SDK login).');
  process.exit(2);
}

Cursor.configure({ local: { useHttp1ForAgent: true } });

const opts = buildChatAgentOptions({
  projectDir: tmp,
  mcp: {
    command: mcpBin,
    args: [],
    env: {},
  },
  modelId: process.env.CURSOR_MODEL || DEFAULT_CHAT_MODEL_ID,
});

console.log('cwd', opts.local.cwd);
console.log('tools', opts.tools);
console.log('disallowed', opts.disallowedTools);
console.log('mcp', opts.mcpServers.penwright.command);

const prompt = process.argv[3] || 'What kind of project is this? Which file is open? Use Penwright MCP tools, do not write files.';

const agent = await Agent.create({
  ...opts,
  name: 'Penwright spike',
});

try {
  const run = await agent.send(prompt, { mcpServers: opts.mcpServers });
  for await (const msg of run.stream()) {
    if (msg.type === 'assistant') {
      const text = msg.message.content
        .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
        .map(p => p.text)
        .join('');
      if (text) console.log('\n--- assistant ---\n', text);
    } else if (msg.type === 'tool_call') {
      console.log(`[tool ${msg.status}]`, msg.name);
    } else if (msg.type === 'thinking') {
      console.log('[thinking]', msg.text.slice(0, 200));
    }
  }
  const result = await run.wait();
  console.log('\n--- result ---', result.status, result.error ?? '');
} finally {
  await agent[Symbol.asyncDispose]();
}
