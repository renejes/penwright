/**
 * Pure index for in-app chat sessions (one project, many agents).
 *
 * The SDK store keeps the agents; this file is the UI list: title, which
 * tabs are open, which one is active. Host reads/writes JSON; tests drive
 * the transitions without Electron.
 */

import type { ChatSessionMeta } from './chatTypes';

export const MAX_OPEN_CHAT_TABS = 7;

export type { ChatSessionMeta };

export interface ChatSessionIndex {
  activeId: string | null;
  openIds: string[];
  chats: ChatSessionMeta[];
}

export function emptyChatIndex(): ChatSessionIndex {
  return { activeId: null, openIds: [], chats: [] };
}

export function titleFromUserText(text: string, untitled: string): string {
  const one = text.replace(/\s+/g, ' ').trim();
  if (!one) return untitled;
  return one.length > 36 ? `${one.slice(0, 36)}…` : one;
}

function meta(index: ChatSessionIndex, id: string): ChatSessionMeta | undefined {
  return index.chats.find(c => c.id === id);
}

/** Keep `openIds` as a capped LRU with `id` first. Unknown ids are dropped. */
export function pinOpenTab(index: ChatSessionIndex, id: string): ChatSessionIndex {
  if (!meta(index, id)) return index;
  const rest = index.openIds.filter(x => x !== id && meta(index, x));
  return { ...index, openIds: [id, ...rest].slice(0, MAX_OPEN_CHAT_TABS) };
}

export function activateSession(index: ChatSessionIndex, id: string): ChatSessionIndex {
  if (!meta(index, id)) return index;
  return pinOpenTab({ ...index, activeId: id }, id);
}

export function addSession(
  index: ChatSessionIndex,
  session: ChatSessionMeta,
): ChatSessionIndex {
  const chats = [session, ...index.chats.filter(c => c.id !== session.id)];
  return activateSession({ ...index, chats }, session.id);
}

export function touchSession(
  index: ChatSessionIndex,
  id: string,
  patch: { title?: string; updatedAt: number },
): ChatSessionIndex {
  const chats = index.chats.map(c => {
    if (c.id !== id) return c;
    return {
      ...c,
      updatedAt: patch.updatedAt,
      title: patch.title !== undefined ? patch.title : c.title,
    };
  });
  return { ...index, chats };
}

export function closeOpenTab(index: ChatSessionIndex, id: string): ChatSessionIndex {
  const openIds = index.openIds.filter(x => x !== id);
  if (index.activeId !== id) return { ...index, openIds };
  const next = openIds[0] ?? index.chats.find(c => c.id !== id)?.id ?? null;
  return next ? activateSession({ ...index, openIds }, next) : { ...index, activeId: null, openIds };
}

export function removeSession(index: ChatSessionIndex, id: string): ChatSessionIndex {
  const chats = index.chats.filter(c => c.id !== id);
  return closeOpenTab({ ...index, chats }, id);
}

export function parseChatIndex(raw: unknown): ChatSessionIndex | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const chatsIn = Array.isArray(o.chats) ? o.chats : [];
  const chats: ChatSessionMeta[] = [];
  for (const item of chatsIn) {
    if (!item || typeof item !== 'object') continue;
    const c = item as Record<string, unknown>;
    if (typeof c.id !== 'string' || !c.id.trim()) continue;
    chats.push({
      id: c.id,
      title: typeof c.title === 'string' ? c.title : '',
      createdAt: typeof c.createdAt === 'number' ? c.createdAt : 0,
      updatedAt: typeof c.updatedAt === 'number' ? c.updatedAt : 0,
    });
  }
  const ids = new Set(chats.map(c => c.id));
  const activeId = typeof o.activeId === 'string' && ids.has(o.activeId) ? o.activeId : (chats[0]?.id ?? null);
  const openIds = (Array.isArray(o.openIds) ? o.openIds.filter((x): x is string => typeof x === 'string' && ids.has(x)) : [])
    .slice(0, MAX_OPEN_CHAT_TABS);
  const pinned = activeId ? pinOpenTab({ activeId, openIds, chats }, activeId) : { activeId, openIds, chats };
  return pinned;
}

export function openMetas(index: ChatSessionIndex): ChatSessionMeta[] {
  return index.openIds.map(id => meta(index, id)).filter((c): c is ChatSessionMeta => !!c);
}

export function historyMetas(index: ChatSessionIndex): ChatSessionMeta[] {
  return [...index.chats].sort((a, b) => b.updatedAt - a.updatedAt);
}
