<script lang="ts">
  /**
   * The only component that reads the streaming buffer.
   * A token updates this bubble, not the editor and not older turns.
   */
  import { t } from '@shared/i18n/store.svelte';
  import { chatLive } from '../chatLive.svelte';

  let elapsedSec = $state(0);

  $effect(() => {
    const started = Date.now();
    const id = setInterval(() => {
      elapsedSec = Math.floor((Date.now() - started) / 1000);
    }, 1000);
    return () => clearInterval(id);
  });

  const word = $derived.by(() => {
    const c = t().chat;
    if (chatLive.error) return chatLive.error;
    if (chatLive.toolName) return c.exploring(chatLive.toolName);
    if (chatLive.thinking) return c.thinks;
    const words = [c.thinks, c.cogitating, c.composing];
    return words[Math.floor(elapsedSec / 4) % words.length] ?? c.thinks;
  });
</script>

<div class="chat-live" class:failed={!!chatLive.error}>
  {#if !chatLive.error}<span class="chat-spinner" aria-hidden="true"></span>{/if}
  <span>{word}{#if !chatLive.error && elapsedSec > 0} · {elapsedSec}s{/if}</span>
</div>
{#if chatLive.text}
  <div class="chat-body chat-plain">{chatLive.text}</div>
{/if}

<style>
  .chat-live {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #666;
    font-size: 13px;
  }
  .chat-live.failed { color: #b42318; }
  .chat-spinner {
    width: 12px;
    height: 12px;
    border: 2px solid #ddd;
    border-top-color: #555;
    border-radius: 50%;
    animation: chat-spin 0.8s linear infinite;
    flex-shrink: 0;
  }
  @keyframes chat-spin { to { transform: rotate(360deg); } }
  .chat-body {
    white-space: pre-wrap;
    line-height: 1.45;
    overflow-wrap: anywhere;
    border: 1px solid #eeeeee;
    padding: 8px 10px;
  }
  .chat-plain { font-size: 13px; }
</style>
