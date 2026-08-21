/**
 * Merge one streamed assistant/thinking chunk into the text shown so far.
 *
 * Cursor's `run.stream()` yields `assistant` events whose `text` is sometimes
 * a growing snapshot and sometimes a delta. Replacing blindly left only the
 * last few characters ("fen?", "st etwas."). This accepts both shapes.
 */
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
