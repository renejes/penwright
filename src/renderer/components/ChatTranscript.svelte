<script lang="ts">
  /**
   * Cursor-like transcript: one collapsible activity block per agent phase
   * (thinking + MCP calls), a compaction line, then the answer.
   */
  import { t } from '@shared/i18n/store.svelte';
  import {
    activityHeadline,
    groupChatLog,
    shortToolName,
    synthesizeChatLog,
    type ChatActivity,
    type DisplayChatItem,
  } from '../../shared/chatStream';
  import type { ChatTurn } from '../../shared/chatTypes';

  let {
    turns,
    streaming,
    elapsedSec,
    lastAssistantId,
    queued = [],
    onUnqueue,
  }: {
    turns: ChatTurn[];
    streaming: boolean;
    elapsedSec: number;
    lastAssistantId: string | null;
    queued?: { id: string; label: string }[];
    onUnqueue?: (id: string) => void;
  } = $props();

  function renderBody(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\n/g, '<br>');
  }

  function itemsFor(turn: ChatTurn): DisplayChatItem[] {
    return groupChatLog(synthesizeChatLog(turn));
  }

  function isCurrentPhase(items: DisplayChatItem[], index: number, live: boolean): boolean {
    if (!live) return false;
    return !items.slice(index + 1).some(it => it.kind === 'text' || it.kind === 'summary' || it.kind === 'activity');
  }

  function headline(activity: ChatActivity, live: boolean): string {
    const c = t().chat;
    return activityHeadline(activity, {
      thinking: c.thinking,
      thinks: c.thinks,
      mcpOne: c.mcpCallOne,
      mcpMany: c.mcpCallMany,
      errorOne: c.errorOne,
      errorMany: c.errorMany,
      running: c.toolRunning,
      working: c.activityWorking,
    }, { live, elapsedSec: live ? elapsedSec : undefined });
  }

  function toolStatusLabel(status: 'running' | 'completed' | 'error'): string {
    if (status === 'running') return t().chat.toolStateRunning;
    if (status === 'error') return t().chat.toolFailed;
    return t().chat.toolDone;
  }
</script>

{#each turns as turn (turn.id)}
  {#if turn.role === 'user'}
    <article class="chat-turn user">
      {#if turn.text}
        <div class="chat-body">{@html renderBody(turn.text)}</div>
      {/if}
    </article>
  {:else}
    {@const items = itemsFor(turn)}
    {@const live = streaming && turn.id === lastAssistantId}
    <article class="chat-turn assistant">
      {#each items as item, i (`${turn.id}:${item.kind}:${i}`)}
        {#if item.kind === 'activity'}
          {@const current = isCurrentPhase(items, i, live)}
          <details class="chat-activity">
            <summary>{headline(item, current)}</summary>
            {#if item.tools.length > 0}
              <ul class="chat-activity-tools">
                {#each item.tools as tool (tool.id)}
                  <li data-status={tool.status}>
                    <span class="chat-activity-dot" aria-hidden="true"></span>
                    <span class="chat-activity-name">{shortToolName(tool.name)}{tool.detail ? ` · ${tool.detail}` : ''}</span>
                    <span class="chat-activity-state">{toolStatusLabel(tool.status)}</span>
                  </li>
                {/each}
              </ul>
            {/if}
            {#if item.thinking}
              <p class="chat-activity-thinking">{item.thinking}</p>
            {/if}
            {#each item.statuses as status, si (`${turn.id}:st:${i}:${si}`)}
              <p class="chat-activity-status">{status}</p>
            {/each}
          </details>
        {:else if item.kind === 'summary'}
          <p class="chat-summary">
            {item.phase === 'completed' ? t().chat.contextSummarized : t().chat.contextSummarizing}
          </p>
        {:else}
          <div class="chat-body">{@html renderBody(item.text)}</div>
        {/if}
      {/each}
      {#if live && items.length === 0}
        <div class="chat-busy">{t().chat.workingElapsed(elapsedSec)}</div>
      {/if}
    </article>
  {/if}
{/each}
{#each queued as item (item.id)}
  <article class="chat-turn user queued">
    <div class="chat-body">{item.label}</div>
    <p class="chat-queue-note">
      {t().chat.queueNote}
      {#if onUnqueue}
        <button type="button" onclick={() => onUnqueue(item.id)} aria-label={t().chat.removeChip}>×</button>
      {/if}
    </p>
  </article>
{/each}

<style>
  .chat-turn { padding: 0; }
  .chat-turn.user {
    margin-left: 1.75rem;
    padding: 8px 10px;
    background: #f5f5f5;
    border: 1px solid #dddddd;
  }
  .chat-turn.queued {
    border-style: dashed;
    color: #666;
  }
  .chat-queue-note {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin: 6px 0 0;
    font-size: 11px;
    color: #888;
  }
  .chat-queue-note button {
    border: none;
    background: none;
    cursor: pointer;
    color: #888;
    font-size: 14px;
    line-height: 1;
  }
  .chat-turn.assistant {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-right: 1.25rem;
  }
  .chat-body {
    white-space: normal;
    line-height: 1.45;
    overflow-wrap: anywhere;
    border: 1px solid #eeeeee;
    padding: 8px 10px;
  }
  .chat-turn.user .chat-body { border: none; padding: 0; }
  .chat-body :global(code) { font-size: 12px; background: #f3f3f3; padding: 1px 4px; }
  .chat-busy { color: #888; font-style: italic; font-size: 13px; }
  .chat-activity {
    border: 1px solid #dddddd;
    padding: 6px 10px;
    font-size: 12px;
    color: #666;
    background: #fff;
  }
  .chat-activity summary {
    cursor: pointer;
    user-select: none;
    font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
    font-size: 12px;
  }
  .chat-activity-tools {
    list-style: none;
    margin: 6px 0 0;
    padding: 0;
    max-height: 10rem;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .chat-activity-tools li {
    display: flex;
    align-items: center;
    gap: 8px;
    font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
    font-size: 11px;
  }
  .chat-activity-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #bbbbbb;
    flex-shrink: 0;
  }
  .chat-activity-tools li[data-status='running'] .chat-activity-dot { background: #c9a227; }
  .chat-activity-tools li[data-status='error'] .chat-activity-dot { background: #b42318; }
  .chat-activity-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .chat-activity-state { margin-left: auto; color: #999; flex-shrink: 0; }
  .chat-activity-thinking, .chat-activity-status {
    margin: 6px 0 0;
    white-space: pre-wrap;
    color: #888;
  }
  .chat-summary {
    margin: 0;
    font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
    font-size: 12px;
    color: #888;
  }
</style>
