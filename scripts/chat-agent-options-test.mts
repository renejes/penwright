/**
 * Configuration invariant for the in-app Cursor agent.
 *
 * Asserts the *options object* `buildChatAgentOptions` produces — not the
 * SDK, and not a regex over source. Quelltext-Assertions went green by
 * finding nothing once; this fails if the allowlist is emptied.
 *
 * Verified red: drop `'mcp'` from `CHAT_TOOLS` (or add `'write'`) and this
 * exits 1.
 *
 * Run: npx tsx scripts/chat-agent-options-test.mts
 */
import assert from 'node:assert/strict';
import {
  buildChatAgentOptions,
  CHAT_DISALLOWED_TOOLS,
  CHAT_TOOLS,
  DEFAULT_CHAT_MODEL_ID,
  mergeMcpChildEnv,
  posixQuote,
  quoteStdioCommand,
} from '../src/shared/chatAgentOptions.ts';
import { describeChatTool, mergeStreamText, shortToolName, upsertToolChip } from '../src/shared/chatStream.ts';
import { formatTokenCount, normalizeChatModel } from '../src/shared/chatModels.ts';
import {
  activateSession,
  addSession,
  closeOpenTab,
  emptyChatIndex,
  historyMetas,
  MAX_OPEN_CHAT_TABS,
  parseChatIndex,
  pinOpenTab,
  removeSession,
  titleFromUserText,
  touchSession,
} from '../src/shared/chatSessions.ts';

const opts = buildChatAgentOptions({
  projectDir: '/tmp/penwright-chat-test-project',
  mcp: {
    command: '/tmp/penwright-mcp',
    args: [],
    env: { TYPST_BIN: '/tmp/typst' },
  },
  modelId: '',
});

assert.equal(opts.local.cwd, '/tmp/penwright-chat-test-project');
assert.equal(opts.model.id, DEFAULT_CHAT_MODEL_ID);

const server = opts.mcpServers.penwright;
assert.equal(server.type, 'stdio');
assert.equal(server.command, '/tmp/penwright-mcp');
assert.deepEqual(server.args, []);
assert.equal(server.env.TYPST_BIN, '/tmp/typst');
assert.equal(server.cwd, '/tmp/penwright-chat-test-project');

assert.ok(opts.tools.includes('mcp'), 'tools must include mcp — otherwise the 66 Penwright tools never reach the agent');
for (const name of CHAT_TOOLS) {
  assert.ok(opts.tools.includes(name), `tools missing ${name}`);
}

const toolNames = opts.tools as readonly string[];
for (const forbidden of ['shell', 'edit', 'write', 'task'] as const) {
  assert.ok(!toolNames.includes(forbidden), `tools must not include ${forbidden}`);
}

for (const name of CHAT_DISALLOWED_TOOLS) {
  assert.ok(opts.disallowedTools.includes(name), `disallowedTools missing ${name}`);
}

const asRecord = opts as unknown as Record<string, unknown>;
assert.equal(
  asRecord.settingSources,
  undefined,
  'settingSources must be absent so ~/.cursor/mcp.json is not loaded (double Penwright MCP)',
);

const emptyModel = buildChatAgentOptions({
  projectDir: '/tmp/p',
  mcp: { command: 'x', args: ['--flag'], env: {} },
  modelId: '  composer-2.5  ',
});
assert.equal(emptyModel.model.id, 'composer-2.5');
assert.deepEqual(emptyModel.mcpServers.penwright.args, ['--flag']);

assert.equal(mergeStreamText('', 'H'), 'H');
assert.equal(mergeStreamText('H', 'i'), 'Hi');
assert.equal(mergeStreamText('Hi', 'Hi there'), 'Hi there');
assert.equal(mergeStreamText('Hi there', 'Hi'), 'Hi there');
assert.equal(mergeStreamText('bekom', 'fen?'), 'bekomfen?');
assert.equal(mergeStreamText('Hello', 'Hello'), 'Hello');
assert.equal(mergeStreamText('Ich les', 'lese'), 'Ich lese');
assert.equal(mergeStreamText('fü', 'füge'), 'füge');

assert.equal(shortToolName('penwright_get_document'), 'get_document');
assert.equal(describeChatTool({
  id: 'c1',
  name: 'CallMcpTool',
  args: { server: 'penwright', toolName: 'penwright_render_page', arguments: { file: 'chapters/01.typ' } },
}).name, 'render_page');
assert.equal(describeChatTool({
  id: 'c1',
  name: 'CallMcpTool',
  args: { server: 'penwright', toolName: 'penwright_render_page', arguments: { file: 'chapters/01.typ' } },
}).detail, 'chapters/01.typ');
const chips = upsertToolChip([], { id: 'c1', name: 'render_page', status: 'running' });
assert.equal(upsertToolChip(chips, { id: 'c1', name: 'render_page', status: 'completed' })[0].status, 'completed');

const composer = normalizeChatModel({ id: 'composer-2.5', displayName: 'Composer 2.5' });
assert.ok(composer.parameters.some(p => p.id === 'fast'), 'Composer must expose Fast even when list() omits parameters');
const gpt = normalizeChatModel({ id: 'gpt-5.4', displayName: 'GPT' });
assert.ok(!gpt.parameters.some(p => p.id === 'fast'), 'do not invent Fast on models Cursor does not document as parameterized');
const already = normalizeChatModel({
  id: 'composer-2.5',
  parameters: [{ id: 'fast', displayName: 'Fast', values: [{ value: 'true', displayName: 'Fast' }] }],
});
assert.equal(already.parameters.filter(p => p.id === 'fast').length, 1);
assert.equal(formatTokenCount(12400), '12.4k');
assert.equal(formatTokenCount(0), '');

assert.equal(posixQuote("/Library/Application Support/x"), "'/Library/Application Support/x'");
const wrapped = quoteStdioCommand('/Library/Application Support/Penwright/mcp-server/penwright-mcp', []);
assert.equal(wrapped.command, '/bin/bash');
assert.equal(wrapped.args[0], '-c');
assert.ok(wrapped.args[1].includes("Application Support"));
assert.deepEqual(quoteStdioCommand('/usr/bin/penwright-mcp', []), { command: '/usr/bin/penwright-mcp', args: [] });

const childEnv = mergeMcpChildEnv(
  { HOME: '/Users/r', PATH: '/bin', ELECTRON_RUN_AS_NODE: '1', EMPTY: undefined },
  { TYPST_BIN: '/typst' },
  '/tmp/project',
);
assert.equal(childEnv.HOME, '/Users/r');
assert.equal(childEnv.TYPST_BIN, '/typst');
assert.equal(childEnv.PENWRIGHT_PROJECT_DIR, '/tmp/project');
assert.equal(childEnv.ELECTRON_RUN_AS_NODE, undefined);

assert.equal(titleFromUserText('  Cover   dunkler  ', 'New chat'), 'Cover dunkler');
assert.ok(titleFromUserText('x'.repeat(50), 'New chat').endsWith('…'));
assert.equal(titleFromUserText('   ', 'New chat'), 'New chat');

let index = addSession(emptyChatIndex(), { id: 'a', title: 'A', createdAt: 1, updatedAt: 1 });
index = addSession(index, { id: 'b', title: 'B', createdAt: 2, updatedAt: 2 });
assert.equal(index.activeId, 'b');
assert.deepEqual(index.openIds, ['b', 'a']);

index = activateSession(index, 'a');
assert.equal(index.activeId, 'a');
assert.equal(index.openIds[0], 'a');

index = touchSession(index, 'a', { title: 'Cover', updatedAt: 9 });
assert.equal(index.chats.find(c => c.id === 'a')?.title, 'Cover');
assert.equal(historyMetas(index)[0].id, 'a');

index = closeOpenTab(index, 'a');
assert.equal(index.activeId, 'b');
assert.ok(!index.openIds.includes('a'));

const many = Array.from({ length: MAX_OPEN_CHAT_TABS + 3 }, (_, i) =>
  ({ id: `c${i}`, title: `C${i}`, createdAt: i, updatedAt: i }),
);
let capped = emptyChatIndex();
for (const s of many) capped = addSession(capped, s);
assert.equal(capped.openIds.length, MAX_OPEN_CHAT_TABS);
assert.equal(capped.openIds[0], many[many.length - 1].id);

const parsed = parseChatIndex({
  activeId: 'missing',
  openIds: ['b', 'nope'],
  chats: [{ id: 'b', title: 'B', createdAt: 1, updatedAt: 1 }],
});
assert.equal(parsed?.activeId, 'b');
assert.deepEqual(parsed?.openIds, ['b']);

index = removeSession(addSession(emptyChatIndex(), { id: 'z', title: '', createdAt: 0, updatedAt: 0 }), 'z');
assert.equal(index.activeId, null);
assert.equal(index.chats.length, 0);

assert.deepEqual(pinOpenTab(emptyChatIndex(), 'ghost').openIds, []);

console.log('chat-agent-options-test: ok');
