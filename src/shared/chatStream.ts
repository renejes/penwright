/**
 * Merge one streamed assistant/thinking chunk into the text shown so far.
 *
 * Cursor's `run.stream()` yields `assistant` events whose `text` is sometimes
 * a growing snapshot and sometimes a delta. Replacing blindly left only the
 * last few characters ("fen?", "st etwas."). This accepts both shapes.
 */

import type { ChatLogItem, ChatTurn } from './chatTypes';
export function mergeStreamText(current: string, incoming: string): string {
  if (!incoming) return current;
  if (!current) return incoming;
  if (incoming === current) return current;
  if (incoming.startsWith(current)) return incoming;
  if (current.startsWith(incoming)) return current;
  const overlap = Math.min(current.length, incoming.length);
  for (let n = overlap; n > 0; n--) {
    if (current.endsWith(incoming.slice(0, n))) return current + incoming.slice(n);
  }
  return current + incoming;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function str(rec: Record<string, unknown> | null, key: string): string | undefined {
  const value = rec?.[key];
  return typeof value === 'string' && value.trim() ? value : undefined;
}

/** Strip host prefixes so the chip reads `get_document`, not `mcp:penwright_get_document`. */
export function shortToolName(name: string): string {
  return name
    .replace(/^mcp[_:]/i, '')
    .replace(/^CallMcpTool$/i, '')
    .replace(/^penwright_/, '')
    .trim() || name;
}

/**
 * MCP calls often arrive as the host tool `CallMcpTool` with the real name
 * in `args.toolName`. Prefer that, otherwise the envelope name.
 */
export function describeChatTool(input: {
  id?: string;
  name?: string;
  args?: unknown;
}): { id: string; name: string; detail?: string } {
  const args = asRecord(input.args);
  const nested = asRecord(args?.arguments) ?? asRecord(args?.input) ?? asRecord(args?.toolCall);
  const inner = str(args, 'toolName') || str(args, 'tool') || str(nested, 'name');
  const raw = input.name || inner || 'tool';
  const name = shortToolName(inner && /mcp|CallMcpTool/i.test(raw) ? inner : raw);
  const id = input.id?.trim() || `${raw}:${name}`;
  const detail = str(args, 'file')
    || str(args, 'filePath')
    || str(args, 'path')
    || str(nested, 'file')
    || str(nested, 'filePath');
  return detail ? { id, name, detail } : { id, name };
}

export interface ToolChipState {
  id: string;
  name: string;
  status: 'running' | 'completed' | 'error';
  detail?: string;
}

export function upsertToolChip(tools: ToolChipState[], chip: ToolChipState): ToolChipState[] {
  const index = tools.findIndex(c => c.id === chip.id);
  if (index < 0) return [...tools, chip];
  const next = tools.slice();
  next[index] = { ...next[index], ...chip };
  return next;
}

/** Rebuild a log from the flat fields older transcripts stored. */
export function synthesizeChatLog(turn: ChatTurn): ChatLogItem[] {
  if (turn.log && turn.log.length > 0) return turn.log;
  const log: ChatLogItem[] = [];
  if (turn.thinking) log.push({ kind: 'thinking', text: turn.thinking });
  for (const tool of turn.tools ?? []) {
    log.push({ kind: 'tool', id: tool.id, name: tool.name, status: tool.status, detail: tool.detail });
  }
  if (turn.text) log.push({ kind: 'text', text: turn.text });
  return log;
}

function ensureLog(turn: ChatTurn): ChatLogItem[] {
  if (!turn.log) turn.log = [];
  return turn.log;
}

export function applyTurnThinking(turn: ChatTurn, text: string): void {
  if (!text) return;
  turn.thinking = mergeStreamText(turn.thinking ?? '', text);
  const log = ensureLog(turn);
  const last = log[log.length - 1];
  if (last?.kind === 'thinking') last.text = mergeStreamText(last.text, text);
  else log.push({ kind: 'thinking', text });
}

export function applyTurnAssistantText(turn: ChatTurn, text: string, mode: 'delta' | 'snapshot'): void {
  if (mode === 'snapshot') turn.text = text;
  else turn.text = mergeStreamText(turn.text, text);
  const log = ensureLog(turn);
  const last = log[log.length - 1];
  if (last?.kind === 'text') {
    last.text = mode === 'snapshot' ? text : mergeStreamText(last.text, text);
  } else if (text) {
    log.push({ kind: 'text', text });
  }
}

export function applyTurnTool(turn: ChatTurn, chip: ToolChipState): void {
  turn.tools = upsertToolChip(turn.tools ?? [], chip);
  const log = ensureLog(turn);
  const next: ChatLogItem = {
    kind: 'tool',
    id: chip.id,
    name: chip.name,
    status: chip.status,
    detail: chip.detail,
  };
  const idx = log.findIndex(item => item.kind === 'tool' && item.id === chip.id);
  if (idx >= 0) log[idx] = next;
  else log.push(next);
}

export function applyTurnStatus(turn: ChatTurn, text: string): void {
  const trimmed = text.trim();
  if (!trimmed) return;
  const log = ensureLog(turn);
  const last = log[log.length - 1];
  if (last?.kind === 'status' && last.text === trimmed) return;
  log.push({ kind: 'status', text: trimmed });
}

export function applyTurnSummary(turn: ChatTurn, phase: 'started' | 'completed'): void {
  const log = ensureLog(turn);
  for (let i = log.length - 1; i >= 0; i--) {
    const item = log[i];
    if (item?.kind !== 'summary') continue;
    if (item.phase === 'started' && phase === 'completed') {
      item.phase = 'completed';
      return;
    }
    if (item.phase === phase) return;
    break;
  }
  log.push({ kind: 'summary', phase });
}

export type ChatActivity = {
  kind: 'activity';
  thinking: string;
  tools: Array<{ id: string; name: string; status: ToolChipState['status']; detail?: string }>;
  statuses: string[];
};

export type DisplayChatItem =
  | { kind: 'text'; text: string }
  | { kind: 'summary'; phase: 'started' | 'completed' }
  | ChatActivity;

/**
 * Consecutive thinking / tool / status items become one collapsible activity
 * block. Assistant text or a context-summary closes the phase, matching Cursor.
 */
export function groupChatLog(log: ChatLogItem[]): DisplayChatItem[] {
  const out: DisplayChatItem[] = [];
  let acc: ChatActivity | null = null;

  const flush = (): void => {
    if (!acc) return;
    if (acc.thinking || acc.tools.length > 0 || acc.statuses.length > 0) out.push(acc);
    acc = null;
  };

  for (const item of log) {
    if (item.kind === 'thinking' || item.kind === 'tool' || item.kind === 'status') {
      if (!acc) acc = { kind: 'activity', thinking: '', tools: [], statuses: [] };
      if (item.kind === 'thinking') {
        acc.thinking = acc.thinking ? mergeStreamText(acc.thinking, `\n\n${item.text}`) : item.text;
      } else if (item.kind === 'tool') {
        const idx = acc.tools.findIndex(t => t.id === item.id);
        const next = { id: item.id, name: item.name, status: item.status, detail: item.detail };
        if (idx >= 0) acc.tools[idx] = next;
        else acc.tools.push(next);
      } else if (item.text) {
        acc.statuses.push(item.text);
      }
      continue;
    }
    flush();
    if (item.kind === 'text') {
      if (item.text) out.push({ kind: 'text', text: item.text });
      continue;
    }
    out.push({ kind: 'summary', phase: item.phase });
  }
  flush();
  return out;
}

export interface ActivityHeadlineLabels {
  thinking: string;
  thinks: string;
  mcpOne: string;
  mcpMany: (n: number) => string;
  errorOne: string;
  errorMany: (n: number) => string;
  running: (name: string) => string;
  working: string;
  planning: string;
  exploring: (name: string) => string;
}

export function activityHeadline(
  activity: ChatActivity,
  labels: ActivityHeadlineLabels,
  opts?: { live?: boolean; elapsedSec?: number },
): string {
  const n = activity.tools.length;
  const errors = activity.tools.filter(t => t.status === 'error').length;
  const running = activity.tools.find(t => t.status === 'running');
  const bits: string[] = [];
  if (activity.thinking) bits.push(opts?.live && n === 0 ? labels.thinks : labels.thinking);
  if (n === 1) bits.push(labels.mcpOne);
  else if (n > 1) bits.push(labels.mcpMany(n));
  if (errors > 0) bits.push(errors === 1 ? labels.errorOne : labels.errorMany(errors));
  if (running) bits.push(labels.running(shortToolName(running.name)));
  if (opts?.live && opts.elapsedSec && opts.elapsedSec > 0) bits.push(`${opts.elapsedSec}s`);
  if (bits.length === 0 && activity.statuses.length > 0) {
    return activity.statuses[activity.statuses.length - 1] ?? labels.working;
  }
  return bits.join(' · ') || labels.working;
}

export function isRunFailure(text: string): boolean {
  return /invalid parameters|not found|failed|error|abgebrochen|stopped before/i.test(text);
}

/** What the reader sees while a turn is still running, before opening the activity box. */
export function liveWorkLabel(activity: ChatActivity | undefined, labels: ActivityHeadlineLabels): string {
  if (!activity) return labels.planning;
  const failure = [...activity.statuses].reverse().find(isRunFailure);
  if (failure) return failure;
  const running = [...activity.tools].reverse().find(t => t.status === 'running');
  if (running) return labels.exploring(shortToolName(running.name));
  if (activity.thinking) return labels.thinks;
  return labels.planning;
}
