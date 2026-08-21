/**
 * Cursor SDK host — the in-app chat's agent lives here, in the main process.
 *
 * Renderer never imports `@cursor/sdk`. One agent per open project; close
 * disposes it. Every create / resume carries the tool allowlist from
 * `buildChatAgentOptions` (writes go through MCP, never builtin edit/write).
 */

import { app, dialog, shell } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import {
  Agent,
  Cursor,
  CursorAgentError,
  FileCredentialStore,
  JsonlLocalAgentStore,
  type SDKAgent,
  type SDKMessage,
  type Run,
} from '@cursor/sdk';
import { appState } from './appState';
import { addBreadcrumb } from './crashReporter';
import { buildServerDefinition } from './mcpRegistration';
import { isPathWithin } from './pathSecurity';
import {
  getChatModelId,
  getChatModelParams,
  getLocale,
  setChatModelId,
  setChatModelParams,
} from './persistenceManager';
import { resolveDict } from '../shared/i18n';
import {
  buildChatAgentOptions,
  DEFAULT_CHAT_MODEL_ID,
  mergeMcpChildEnv,
  quoteStdioCommand,
} from '../shared/chatAgentOptions';
import { normalizeChatModel } from '../shared/chatModels';
import { mergeStreamText, describeChatTool, upsertToolChip } from '../shared/chatStream';
import type {
  ChatAnchor,
  ChatAttachment,
  ChatFileRef,
  ChatMode,
  ChatModelInfo,
  ChatModelParam,
  ChatSendResult,
  ChatSessionsSnapshot,
  ChatStatus,
  ChatStreamEvent,
  ChatToolChip,
  ChatTurn,
} from '../shared/chatTypes';
import {
  activateSession,
  addSession,
  closeOpenTab,
  emptyChatIndex,
  historyMetas,
  openMetas,
  parseChatIndex,
  pinOpenTab,
  removeSession,
  titleFromUserText,
  touchSession,
  type ChatSessionIndex,
} from '../shared/chatSessions';

const AGENT_DIR = 'cursor-agent';
const AGENT_ID_FILE = 'agent-id';
const TRANSCRIPT_FILE = 'transcript.json';
const INDEX_FILE = 'chats.json';
const MAX_TRANSCRIPT = 80;

type SdkImagePayload = { data: string; mimeType: string };

let sdkConfigured = false;
let agent: SDKAgent | null = null;
let agentProjectDir: string | null = null;
let currentRun: Run | null = null;
let cancelRequested = false;
let transcript: ChatTurn[] = [];
let sessionIndex: ChatSessionIndex = emptyChatIndex();
let indexProjectDir: string | null = null;

function credentialStore(): FileCredentialStore {
  return new FileCredentialStore(path.join(app.getPath('userData'), 'cursor-sdk', 'auth.json'));
}

/** The SDK's default store is `~/.cursor/sdk/`; we keep Penwright's key in userData. */
async function loadApiKey(): Promise<string | undefined> {
  const creds = await credentialStore().load();
  return creds?.apiKey;
}

function ensureSdkConfigured(): void {
  if (sdkConfigured) return;
  Cursor.configure({ local: { useHttp1ForAgent: true } });
  sdkConfigured = true;
}

function agentDir(projectDir: string): string {
  return path.join(projectDir, '.penwright', AGENT_DIR);
}

function indexPath(projectDir: string): string {
  return path.join(agentDir(projectDir), INDEX_FILE);
}

function safeSessionFileId(id: string): string {
  return id.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 120) || 'chat';
}

function transcriptPathFor(projectDir: string, sessionId: string): string {
  return path.join(agentDir(projectDir), 'transcripts', `${safeSessionFileId(sessionId)}.json`);
}

function untitledLabel(): string {
  return resolveDict(getLocale()).chat.newChat;
}

function snapshotSessions(): ChatSessionsSnapshot {
  return {
    activeId: sessionIndex.activeId,
    open: openMetas(sessionIndex),
    all: historyMetas(sessionIndex),
  };
}

function writeIndex(projectDir: string): void {
  try {
    const dir = agentDir(projectDir);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(indexPath(projectDir), JSON.stringify(sessionIndex), 'utf-8');
    if (sessionIndex.activeId) writeStoredAgentId(projectDir, sessionIndex.activeId);
  } catch {
    /* best-effort */
  }
}

function persistTranscript(projectDir: string): void {
  const id = sessionIndex.activeId;
  if (!id) return;
  try {
    const file = transcriptPathFor(projectDir, id);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const trimmed = transcript.slice(-MAX_TRANSCRIPT);
    fs.writeFileSync(file, JSON.stringify(trimmed), 'utf-8');
  } catch {
    /* best-effort */
  }
}

function readTurnsFile(file: string): ChatTurn[] {
  try {
    if (!fs.existsSync(file)) return [];
    const parsed = JSON.parse(fs.readFileSync(file, 'utf-8')) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((t): t is ChatTurn =>
      t && typeof t === 'object' && (t.role === 'user' || t.role === 'assistant') && typeof t.text === 'string',
    ).map(t => ({
      ...t,
      tools: t.tools?.map(c => ({
        id: c.id || c.name,
        name: c.name,
        status: c.status,
        detail: c.detail,
      })),
    }));
  } catch {
    return [];
  }
}

function loadTranscript(projectDir: string, sessionId: string): ChatTurn[] {
  const modernPath = transcriptPathFor(projectDir, sessionId);
  if (fs.existsSync(modernPath)) return readTurnsFile(modernPath);
  return [];
}

function ensureSessionIndex(projectDir: string): ChatSessionIndex {
  if (indexProjectDir === projectDir) return sessionIndex;
  indexProjectDir = projectDir;
  try {
    const file = indexPath(projectDir);
    if (fs.existsSync(file)) {
      const parsed = parseChatIndex(JSON.parse(fs.readFileSync(file, 'utf-8')) as unknown);
      if (parsed && (parsed.chats.length > 0 || parsed.activeId)) {
        sessionIndex = parsed;
        return sessionIndex;
      }
    }
  } catch {
    /* migrate */
  }

  const legacyId = readStoredAgentId(projectDir);
  const legacyTurns = readTurnsFile(path.join(agentDir(projectDir), TRANSCRIPT_FILE));
  if (legacyId || legacyTurns.length > 0) {
    const id = legacyId || `legacy-${Date.now()}`;
    const now = Date.now();
    sessionIndex = addSession(emptyChatIndex(), {
      id,
      title: titleFromUserText(legacyTurns.find(t => t.role === 'user')?.text ?? '', untitledLabel()),
      createdAt: now,
      updatedAt: now,
    });
    transcript = legacyTurns;
    persistTranscript(projectDir);
    writeIndex(projectDir);
    try {
      const legacy = path.join(agentDir(projectDir), TRANSCRIPT_FILE);
      if (fs.existsSync(legacy)) fs.unlinkSync(legacy);
    } catch {
      /* already copied into transcripts/<id>.json */
    }
    return sessionIndex;
  }

  sessionIndex = emptyChatIndex();
  return sessionIndex;
}

function emit(event: ChatStreamEvent): void {
  appState.mainWindow?.webContents.send('penwright', { type: 'chatEvent', event });
}

function readStoredAgentId(projectDir: string): string | null {
  try {
    const file = path.join(agentDir(projectDir), AGENT_ID_FILE);
    if (!fs.existsSync(file)) return null;
    const id = fs.readFileSync(file, 'utf-8').trim();
    return id || null;
  } catch {
    return null;
  }
}

function writeStoredAgentId(projectDir: string, id: string): void {
  try {
    const dir = agentDir(projectDir);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, AGENT_ID_FILE), id, 'utf-8');
  } catch {
    /* best-effort */
  }
}

async function resolveModelId(): Promise<string> {
  const stored = getChatModelId() || DEFAULT_CHAT_MODEL_ID;
  try {
    const apiKey = await loadApiKey();
    const models = await Cursor.models.list(apiKey ? { apiKey } : undefined);
    if (!Array.isArray(models) || models.length === 0) return stored;
    if (models.some(m => m.id === stored)) return stored;
    const fallback = models.find(m => m.id === DEFAULT_CHAT_MODEL_ID) ?? models[0];
    if (fallback && fallback.id !== stored) setChatModelId(fallback.id);
    return fallback.id;
  } catch {
    return stored;
  }
}

function modelSelection(modelId: string): { id: string; params?: ChatModelParam[] } {
  const params = getChatModelParams();
  return params.length > 0 ? { id: modelId, params } : { id: modelId };
}

function restrictionOptions(projectDir: string) {
  const def = buildServerDefinition();
  const { command, args } = process.platform === 'win32'
    ? { command: def.command, args: def.args }
    : quoteStdioCommand(def.command, def.args);
  addBreadcrumb('chat', `mcp ${command} ${args.join(' ')}`.trim());
  return buildChatAgentOptions({
    projectDir,
    mcp: {
      command,
      args,
      env: mergeMcpChildEnv(process.env, def.env, projectDir),
    },
    modelId: getChatModelId() || DEFAULT_CHAT_MODEL_ID,
  });
}

async function disposeAgent(): Promise<void> {
  if (currentRun) {
    try {
      if (currentRun.supports('cancel')) await currentRun.cancel();
    } catch {
      /* ignore */
    }
    currentRun = null;
  }
  if (agent) {
    try {
      await agent[Symbol.asyncDispose]();
    } catch {
      try { agent.close(); } catch { /* ignore */ }
    }
    agent = null;
  }
  agentProjectDir = null;
}

export async function disposeChatAgent(): Promise<void> {
  const dir = agentProjectDir;
  if (dir) persistTranscript(dir);
  await disposeAgent();
  transcript = [];
  sessionIndex = emptyChatIndex();
  indexProjectDir = null;
}

async function createOptsFor(projectDir: string) {
  const modelId = await resolveModelId();
  const apiKey = await loadApiKey();
  const base = restrictionOptions(projectDir);
  const store = new JsonlLocalAgentStore(agentDir(projectDir));
  return {
    ...base,
    model: modelSelection(modelId),
    name: 'Penwright',
    ...(apiKey ? { apiKey } : {}),
    local: { cwd: projectDir, store, settingSources: [] },
  };
}

async function bindAgent(
  projectDir: string,
  sessionId?: string,
  opts?: { forceCreate?: boolean },
): Promise<SDKAgent> {
  ensureSdkConfigured();
  ensureSessionIndex(projectDir);
  const want = opts?.forceCreate ? undefined : (sessionId ?? sessionIndex.activeId ?? undefined);
  if (!opts?.forceCreate && agent && agentProjectDir === projectDir && want && agent.agentId === want) {
    return agent;
  }

  if (agent && agentProjectDir === projectDir) persistTranscript(projectDir);
  await disposeAgent();
  if (want) transcript = loadTranscript(projectDir, want);
  else transcript = [];

  const createOpts = await createOptsFor(projectDir);

  if (want) {
    try {
      const resumed = await Agent.resume(want, createOpts);
      agent = resumed;
      agentProjectDir = projectDir;
      sessionIndex = activateSession(sessionIndex, resumed.agentId);
      writeIndex(projectDir);
      addBreadcrumb('chat', `resumed agent ${want}`);
      return resumed;
    } catch (err) {
      addBreadcrumb('chat', `resume failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const created = await Agent.create(createOpts);
  agent = created;
  agentProjectDir = projectDir;
  const now = Date.now();
  const existing = sessionIndex.chats.find(c => c.id === created.agentId);
  if (!existing) {
    sessionIndex = addSession(sessionIndex, {
      id: created.agentId,
      title: '',
      createdAt: now,
      updatedAt: now,
    });
  } else {
    sessionIndex = activateSession(sessionIndex, created.agentId);
  }
  persistTranscript(projectDir);
  writeIndex(projectDir);
  addBreadcrumb('chat', `created agent ${created.agentId}`);
  return created;
}

function formatAnchors(anchors: ChatAnchor[]): string {
  if (anchors.length === 0) return '';
  const blocks = anchors.map((a, i) => {
    const excerpt = a.selectionText.length > 800
      ? `${a.selectionText.slice(0, 800)}…`
      : a.selectionText;
    return [
      `Selection ${i + 1} in ${a.file} (node ${a.nodeType}, occurrence ${a.occurrence}):`,
      excerpt,
    ].join('\n');
  });
  return [
    '',
    'The user marked the following passage(s). Call penwright_get_selection for the machine pin (anchorText + occurrence) before acting on "this" / "here".',
    ...blocks,
  ].join('\n');
}

function formatFiles(files: ChatFileRef[]): string {
  if (files.length === 0) return '';
  return [
    '',
    'The user attached or @-mentioned these project files. Read them with Penwright MCP (penwright_get_document or the file tools) or the read tool before answering about them:',
    ...files.map(f => `- ${f.file}`),
  ].join('\n');
}

function mimeFromName(name: string): string {
  const ext = path.extname(name).toLowerCase();
  switch (ext) {
    case '.png': return 'image/png';
    case '.jpg':
    case '.jpeg': return 'image/jpeg';
    case '.gif': return 'image/gif';
    case '.webp': return 'image/webp';
    case '.svg': return 'image/svg+xml';
    case '.pdf': return 'application/pdf';
    case '.txt': return 'text/plain';
    case '.md': return 'text/markdown';
    case '.typ': return 'text/plain';
    case '.bib': return 'text/plain';
    default: return 'application/octet-stream';
  }
}

function uniqueDest(dest: string): string {
  if (!fs.existsSync(dest)) return dest;
  const ext = path.extname(dest);
  const base = dest.slice(0, dest.length - ext.length);
  let i = 2;
  while (fs.existsSync(`${base}-${i}${ext}`)) i += 1;
  return `${base}-${i}${ext}`;
}

async function stageAttachments(
  projectDir: string,
  items: ChatAttachment[],
): Promise<{ files: ChatFileRef[]; images: SdkImagePayload[] }> {
  const files: ChatFileRef[] = [];
  const images: SdkImagePayload[] = [];
  if (items.length === 0) return { files, images };

  const destDir = path.join(projectDir, '.penwright', 'chat-in');
  fs.mkdirSync(destDir, { recursive: true });

  for (const item of items.slice(0, 8)) {
    const src = item.path;
    if (!src || !fs.existsSync(src)) continue;
    let dest = src;
    try {
      if (!isPathWithin(src, projectDir)) {
        const safeName = (item.name || path.basename(src)).replace(/[^\w.\-]+/g, '_').slice(0, 80) || 'file';
        dest = uniqueDest(path.join(destDir, safeName));
        fs.copyFileSync(src, dest);
      }
    } catch {
      continue;
    }
    const rel = path.relative(projectDir, dest).split(path.sep).join('/');
    files.push({ file: rel, label: item.name || path.basename(dest) });
    const mime = item.mime || mimeFromName(item.name || src);
    if (mime.startsWith('image/') && mime !== 'image/svg+xml') {
      try {
        const buf = fs.readFileSync(src);
        if (buf.length > 0 && buf.length <= 4 * 1024 * 1024) {
          images.push({ data: buf.toString('base64'), mimeType: mime });
        }
      } catch {
        /* mention-only */
      }
    }
  }
  return { files, images };
}

export async function pickChatFiles(): Promise<ChatAttachment[]> {
  if (!appState.mainWindow) return [];
  const result = await dialog.showOpenDialog(appState.mainWindow, {
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Attachments', extensions: ['pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'typ', 'md', 'txt', 'bib'] },
      { name: 'All files', extensions: ['*'] },
    ],
  });
  if (result.canceled) return [];
  return result.filePaths.slice(0, 8).map(p => ({
    path: p,
    name: path.basename(p),
    mime: mimeFromName(p),
  }));
}

function assistantText(msg: SDKMessage): string {
  if (msg.type !== 'assistant') return '';
  const parts = msg.message.content;
  if (!Array.isArray(parts)) return '';
  return parts
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text' && typeof p.text === 'string')
    .map(p => p.text)
    .join('');
}

function recordTool(
  turn: ChatTurn,
  input: { id?: string; name?: string; args?: unknown; status: ChatToolChip['status'] },
): void {
  const described = describeChatTool({ id: input.id, name: input.name, args: input.args });
  turn.tools = upsertToolChip(turn.tools ?? [], {
    id: described.id,
    name: described.name,
    status: input.status,
    detail: described.detail,
  });
  emit({
    kind: 'tool',
    id: described.id,
    name: described.name,
    status: input.status,
    detail: described.detail,
  });
}

function toolCallFields(raw: unknown): { id?: string; name?: string; args?: unknown; status?: 'running' | 'completed' | 'error' } {
  const rec = raw && typeof raw === 'object' ? raw as Record<string, unknown> : null;
  if (!rec) return {};
  const nested = rec['toolCall'];
  const tool = nested && typeof nested === 'object' ? nested as Record<string, unknown> : rec;
  const statusRaw = rec['status'] ?? tool['status'];
  const status = statusRaw === 'completed' || statusRaw === 'error' || statusRaw === 'running'
    ? statusRaw
    : undefined;
  return {
    id: typeof rec['callId'] === 'string' ? rec['callId']
      : typeof rec['call_id'] === 'string' ? rec['call_id']
      : undefined,
    name: typeof tool['name'] === 'string' ? tool['name']
      : typeof rec['name'] === 'string' ? rec['name']
      : undefined,
    args: tool['args'] ?? tool['arguments'] ?? tool['input'] ?? rec['args'],
    status,
  };
}

function applyInteractionDelta(
  turn: ChatTurn,
  update: { type: string } & Record<string, unknown>,
  seen: { text: boolean; thinking: boolean; tools: boolean },
): void {
  switch (update.type) {
    case 'text-delta': {
      const text = typeof update.text === 'string' ? update.text : '';
      if (!text) return;
      seen.text = true;
      turn.text = mergeStreamText(turn.text, text);
      emit({ kind: 'assistant-delta', text });
      return;
    }
    case 'thinking-delta': {
      const text = typeof update.text === 'string' ? update.text : '';
      if (!text) return;
      seen.thinking = true;
      turn.thinking = mergeStreamText(turn.thinking ?? '', text);
      emit({ kind: 'thinking', text });
      return;
    }
    case 'tool-call-started':
    case 'partial-tool-call':
    case 'tool-call-completed': {
      seen.tools = true;
      const fields = toolCallFields(update);
      const status = update.type === 'tool-call-completed'
        ? (fields.status === 'error' ? 'error' : 'completed')
        : 'running';
      recordTool(turn, { id: fields.id, name: fields.name, args: fields.args, status });
      return;
    }
    default:
      return;
  }
}

async function pumpRun(
  run: Run,
  projectDir: string,
  assistantId: string,
  seen: { text: boolean; thinking: boolean; tools: boolean },
): Promise<void> {
  const turn = transcript.find(t => t.id === assistantId);
  try {
    for await (const msg of run.stream()) {
      if (msg.type === 'assistant') {
        if (seen.text) continue;
        const chunk = assistantText(msg);
        if (chunk && turn) {
          turn.text = mergeStreamText(turn.text, chunk);
          emit({ kind: 'assistant', text: turn.text });
        }
      } else if (msg.type === 'thinking') {
        if (seen.thinking) continue;
        const chunk = msg.text ?? '';
        if (chunk && turn) {
          turn.thinking = mergeStreamText(turn.thinking ?? '', chunk);
          emit({ kind: 'thinking', text: chunk });
        }
      } else if (msg.type === 'tool_call' && turn) {
        if (seen.tools) continue;
        const fields = toolCallFields(msg);
        recordTool(turn, {
          id: fields.id,
          name: fields.name ?? msg.name,
          args: fields.args,
          status: fields.status ?? msg.status,
        });
      } else if (msg.type === 'usage') {
        const u = msg.usage as {
          inputTokens?: number;
          outputTokens?: number;
          promptTokens?: number;
          completionTokens?: number;
          totalTokens?: number;
        };
        emit({
          kind: 'usage',
          inputTokens: u.inputTokens ?? u.promptTokens,
          outputTokens: u.outputTokens ?? u.completionTokens,
          totalTokens: u.totalTokens,
        });
      }
    }
    const result = await run.wait();
    if (turn && typeof result.result === 'string' && result.result.trim()) {
      turn.text = result.result;
      emit({ kind: 'assistant', text: result.result });
    }
    if (result.status === 'error') {
      emit({ kind: 'done', status: 'error', error: result.error?.message ?? 'Run failed' });
    } else {
      emit({ kind: 'done', status: result.status });
    }
    if (agent) {
      try {
        const usage = await agent.getUsage();
        emit({
          kind: 'usage',
          inputTokens: usage.usage.inputTokens,
          outputTokens: usage.usage.outputTokens,
          totalTokens: usage.usage.totalTokens,
        });
      } catch {
        /* usage is advisory */
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    emit({ kind: 'error', message });
    emit({ kind: 'done', status: 'error', error: message });
  } finally {
    currentRun = null;
    persistTranscript(projectDir);
  }
}

export async function getChatStatus(): Promise<ChatStatus> {
  ensureSdkConfigured();
  const modelId = getChatModelId() || DEFAULT_CHAT_MODEL_ID;
  const store = credentialStore();
  try {
    const status = await Cursor.auth.status({ store });
    if (status.status === 'logged-in') {
      const expiresAt = status.apiKeyExpiresAtMs;
      return {
        loggedIn: true,
        email: status.email,
        expiresAt,
        expired: typeof expiresAt === 'number' && expiresAt < Date.now(),
        projectBound: !!appState.projectDir,
        modelId,
        modelParams: getChatModelParams(),
        running: !!currentRun,
      };
    }
  } catch {
    /* logged out */
  }
  return {
    loggedIn: false,
    projectBound: !!appState.projectDir,
    modelId,
    modelParams: getChatModelParams(),
    running: !!currentRun,
  };
}

export async function loginChat(): Promise<{ ok: boolean; error?: string; email?: string }> {
  ensureSdkConfigured();
  try {
    const result = await Cursor.auth.login({
      store: credentialStore(),
      openBrowser: (url) => { void shell.openExternal(url); },
      apiKeyName: 'Penwright',
    });
    addBreadcrumb('chat', `logged in ${result.email ?? ''}`.trim());
    return { ok: true, email: result.email };
  } catch (err) {
    const message = err instanceof CursorAgentError || err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

export async function logoutChat(): Promise<{ ok: boolean }> {
  try {
    await Cursor.auth.logout({ store: credentialStore() });
  } catch {
    /* still drop the agent */
  }
  await disposeChatAgent();
  addBreadcrumb('chat', 'logged out');
  return { ok: true };
}

export function setChatModel(
  modelId: string,
  params?: ChatModelParam[],
): { ok: boolean; modelId: string } {
  const id = modelId.trim() || DEFAULT_CHAT_MODEL_ID;
  setChatModelId(id);
  setChatModelParams(params ?? null);
  return { ok: true, modelId: id };
}

export async function listChatModels(): Promise<ChatModelInfo[]> {
  ensureSdkConfigured();
  try {
    const apiKey = await loadApiKey();
    const models = await Cursor.models.list(apiKey ? { apiKey } : undefined);
    return models.map(m => normalizeChatModel({
      id: m.id,
      displayName: m.displayName || m.id,
      parameters: (m.parameters ?? []).map(p => ({
        id: p.id,
        displayName: p.displayName || p.id,
        values: (p.values ?? []).map(v => ({
          value: v.value,
          displayName: v.displayName || v.value,
        })),
      })),
      variants: (m.variants ?? []).map(v => ({
        displayName: v.displayName,
        description: v.description,
        isDefault: v.isDefault,
        params: (v.params ?? []).map(p => ({ id: p.id, value: p.value })),
      })),
    }));
  } catch {
    return [];
  }
}

export function getChatHistory(): ChatTurn[] {
  const dir = appState.projectDir;
  if (dir) {
    ensureSessionIndex(dir);
    if (sessionIndex.activeId && transcript.length === 0) {
      transcript = loadTranscript(dir, sessionIndex.activeId);
    }
  }
  return transcript.slice();
}

export function getChatSessions(): ChatSessionsSnapshot {
  const dir = appState.projectDir;
  if (dir) {
    ensureSessionIndex(dir);
    if (sessionIndex.chats.length === 0 && agent && agentProjectDir === dir) {
      const now = Date.now();
      sessionIndex = addSession(sessionIndex, {
        id: agent.agentId,
        title: titleFromUserText(transcript.find(t => t.role === 'user')?.text ?? '', untitledLabel()),
        createdAt: now,
        updatedAt: now,
      });
      writeIndex(dir);
    }
  }
  return snapshotSessions();
}

function busySwitch(): { ok: false; error: string; sessions: ChatSessionsSnapshot; turns: ChatTurn[] } {
  return {
    ok: false,
    error: resolveDict(getLocale()).chat.busySwitch,
    sessions: snapshotSessions(),
    turns: transcript.slice(),
  };
}

export async function newChatSession(): Promise<{ ok: boolean; error?: string; sessions: ChatSessionsSnapshot; turns: ChatTurn[] }> {
  const projectDir = appState.projectDir;
  if (!projectDir) {
    return { ok: false, error: 'No project open.', sessions: snapshotSessions(), turns: [] };
  }
  if (currentRun) return busySwitch();
  ensureSdkConfigured();
  ensureSessionIndex(projectDir);
  if (sessionIndex.activeId && transcript.length === 0 && agent) {
    return { ok: true, sessions: snapshotSessions(), turns: [] };
  }
  persistTranscript(projectDir);
  try {
    await bindAgent(projectDir, undefined, { forceCreate: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message, sessions: snapshotSessions(), turns: [] };
  }
  return { ok: true, sessions: snapshotSessions(), turns: transcript.slice() };
}

export async function switchChatSession(id: string): Promise<{ ok: boolean; error?: string; sessions: ChatSessionsSnapshot; turns: ChatTurn[] }> {
  const projectDir = appState.projectDir;
  if (!projectDir) {
    return { ok: false, error: 'No project open.', sessions: snapshotSessions(), turns: [] };
  }
  if (currentRun) return busySwitch();
  const want = id.trim();
  if (!want) return { ok: false, error: 'Missing chat id.', sessions: snapshotSessions(), turns: transcript.slice() };
  ensureSdkConfigured();
  ensureSessionIndex(projectDir);
  if (sessionIndex.activeId === want && agent && agentProjectDir === projectDir) {
    sessionIndex = pinOpenTab(sessionIndex, want);
    writeIndex(projectDir);
    return { ok: true, sessions: snapshotSessions(), turns: transcript.slice() };
  }
  persistTranscript(projectDir);
  await disposeAgent();
  sessionIndex = activateSession(sessionIndex, want);
  writeIndex(projectDir);
  transcript = loadTranscript(projectDir, want);
  try {
    await bindAgent(projectDir, want);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message, sessions: snapshotSessions(), turns: transcript.slice() };
  }
  return { ok: true, sessions: snapshotSessions(), turns: transcript.slice() };
}

export async function closeChatTab(id: string): Promise<{ ok: boolean; error?: string; sessions: ChatSessionsSnapshot; turns: ChatTurn[] }> {
  const projectDir = appState.projectDir;
  if (!projectDir) {
    return { ok: false, error: 'No project open.', sessions: snapshotSessions(), turns: [] };
  }
  if (currentRun && sessionIndex.activeId === id) return busySwitch();
  ensureSessionIndex(projectDir);
  if (sessionIndex.openIds.length <= 1 && sessionIndex.activeId === id) {
    return { ok: true, sessions: snapshotSessions(), turns: transcript.slice() };
  }
  persistTranscript(projectDir);
  const wasActive = sessionIndex.activeId === id;
  sessionIndex = closeOpenTab(sessionIndex, id);
  writeIndex(projectDir);
  if (!wasActive) return { ok: true, sessions: snapshotSessions(), turns: transcript.slice() };
  if (!sessionIndex.activeId) return newChatSession();
  return switchChatSession(sessionIndex.activeId);
}

export async function deleteChatSession(id: string): Promise<{ ok: boolean; error?: string; sessions: ChatSessionsSnapshot; turns: ChatTurn[] }> {
  const projectDir = appState.projectDir;
  if (!projectDir) {
    return { ok: false, error: 'No project open.', sessions: snapshotSessions(), turns: [] };
  }
  if (currentRun && sessionIndex.activeId === id) return busySwitch();
  ensureSessionIndex(projectDir);
  persistTranscript(projectDir);
  const wasActive = sessionIndex.activeId === id;
  try {
    const file = transcriptPathFor(projectDir, id);
    if (fs.existsSync(file)) fs.unlinkSync(file);
  } catch {
    /* ignore */
  }
  sessionIndex = removeSession(sessionIndex, id);
  writeIndex(projectDir);
  if (sessionIndex.chats.length === 0) return newChatSession();
  if (wasActive && sessionIndex.activeId) return switchChatSession(sessionIndex.activeId);
  return { ok: true, sessions: snapshotSessions(), turns: transcript.slice() };
}

export async function cancelChat(): Promise<{ ok: boolean }> {
  cancelRequested = true;
  if (currentRun) {
    try {
      if (currentRun.supports('cancel')) await currentRun.cancel();
    } catch {
      /* ignore */
    }
  }
  emit({ kind: 'done', status: 'cancelled' });
  return { ok: true };
}

export async function sendChat(input: {
  text: string;
  mode?: ChatMode;
  anchors?: ChatAnchor[];
  files?: ChatFileRef[];
  attachments?: ChatAttachment[];
}): Promise<ChatSendResult> {
  const projectDir = appState.projectDir;
  if (!projectDir) return { ok: false, error: 'No project open.' };
  if (currentRun) return { ok: false, error: 'A run is already in progress.' };

  ensureSdkConfigured();
  const auth = await Cursor.auth.status({ store: credentialStore() });
  if (auth.status !== 'logged-in') return { ok: false, error: 'Not signed in.' };
  if (typeof auth.apiKeyExpiresAtMs === 'number' && auth.apiKeyExpiresAtMs < Date.now()) {
    return { ok: false, error: resolveDict(getLocale()).chat.expired };
  }

  addBreadcrumb('chat', 'send');
  cancelRequested = false;

  const staged = await stageAttachments(projectDir, input.attachments ?? []);
  const files = [...(input.files ?? []), ...staged.files];
  const text = input.text.trim() || (files.length || (input.anchors?.length ?? 0) ? '(see attached files)' : '');
  if (!text) return { ok: false, error: 'Empty message.' };

  let bound: SDKAgent;
  try {
    bound = await bindAgent(projectDir);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }

  const modelId = await resolveModelId();
  const restriction = restrictionOptions(projectDir);
  const userText = `${text}${formatAnchors(input.anchors ?? [])}${formatFiles(files)}`;

  const userTurn: ChatTurn = { id: `u-${Date.now()}`, role: 'user', text: userText };
  const assistantTurn: ChatTurn = { id: `a-${Date.now()}`, role: 'assistant', text: '' };
  transcript.push(userTurn, assistantTurn);
  persistTranscript(projectDir);
  if (sessionIndex.activeId) {
    const existing = sessionIndex.chats.find(c => c.id === sessionIndex.activeId);
    sessionIndex = touchSession(sessionIndex, sessionIndex.activeId, {
      title: existing?.title || titleFromUserText(text, untitledLabel()),
      updatedAt: Date.now(),
    });
    writeIndex(projectDir);
  }

  try {
    // SendOptions has no `tools` field — the allowlist lives on create/resume
    // (and is not persisted, so resume always re-passes it). Inline mcpServers
    // on send *replace* those from create, so they must ride along every turn.
    const payload = staged.images.length > 0
      ? { text: userText, images: staged.images }
      : userText;
    const seen = { text: false, thinking: false, tools: false };
    const run = await bound.send(payload, {
      model: modelSelection(modelId),
      mcpServers: restriction.mcpServers,
      mode: input.mode === 'plan' ? 'plan' : 'agent',
      onDelta: ({ update }) => {
        applyInteractionDelta(assistantTurn, update as { type: string } & Record<string, unknown>, seen);
      },
      onStep: () => {
        emit({ kind: 'heartbeat' });
      },
    });
    currentRun = run;
    if (cancelRequested) {
      try {
        if (run.supports('cancel')) await run.cancel();
      } catch {
        /* already requested */
      }
    }
    void pumpRun(run, projectDir, assistantTurn.id, seen);
    return { ok: true, runId: run.id, agentId: bound.agentId };
  } catch (err) {
    transcript.pop();
    transcript.pop();
    persistTranscript(projectDir);
    const message = err instanceof CursorAgentError || err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}
