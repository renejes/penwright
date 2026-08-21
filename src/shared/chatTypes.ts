/**
 * IPC-facing chat types. Shared by main (`cursorAgentHost`) and the
 * renderer (`ChatPanel`). The renderer never imports `@cursor/sdk`.
 */

export type ChatMode = 'agent' | 'plan';

/** One marked passage waiting in the composer (not yet sent). */
export interface ChatAnchor {
  file: string;
  selectionText: string;
  anchorText: string;
  occurrence: number;
  nodeType: string;
}

/** A project file picked via `@` in the composer. */
export interface ChatFileRef {
  file: string;
  label: string;
}

export interface ChatModelParam {
  id: string;
  value: string;
}

export interface ChatModelParamDef {
  id: string;
  displayName: string;
  values: Array<{ value: string; displayName: string }>;
}

export interface ChatModelVariant {
  displayName: string;
  description?: string;
  isDefault?: boolean;
  params: ChatModelParam[];
}

export interface ChatStatus {
  loggedIn: boolean;
  email?: string;
  expiresAt?: number;
  /** True when the Cursor API key's expiry timestamp is in the past. */
  expired?: boolean;
  projectBound: boolean;
  modelId: string;
  modelParams: ChatModelParam[];
  running: boolean;
}

/** A file picked from the OS to send with the next chat turn. */
export interface ChatAttachment {
  path: string;
  name: string;
  mime: string;
}

export interface ChatModelInfo {
  id: string;
  displayName: string;
  parameters: ChatModelParamDef[];
  variants: ChatModelVariant[];
}

export interface ChatToolChip {
  /** SDK `call_id` when present; otherwise a stable fallback. */
  id: string;
  name: string;
  status: 'running' | 'completed' | 'error';
  detail?: string;
}

export interface ChatTurn {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  thinking?: string;
  tools?: ChatToolChip[];
}

export type ChatStreamEvent =
  | { kind: 'assistant-delta'; text: string }
  | { kind: 'assistant'; text: string }
  | { kind: 'thinking'; text: string }
  | { kind: 'tool'; id: string; name: string; status: ChatToolChip['status']; detail?: string }
  | { kind: 'heartbeat' }
  | { kind: 'usage'; inputTokens?: number; outputTokens?: number; totalTokens?: number }
  | { kind: 'done'; status: string; error?: string }
  | { kind: 'error'; message: string };

export interface ChatSendRequest {
  text: string;
  mode?: ChatMode;
  anchors?: ChatAnchor[];
  files?: ChatFileRef[];
  attachments?: ChatAttachment[];
  /** Serialized open-file content, flushed so disk = editor before the agent runs. */
  liveContent?: string;
}

export interface ChatSendResult {
  ok: boolean;
  runId?: string;
  agentId?: string;
  error?: string;
}

export interface ChatSessionMeta {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
}

export interface ChatSessionsSnapshot {
  activeId: string | null;
  open: ChatSessionMeta[];
  all: ChatSessionMeta[];
}
