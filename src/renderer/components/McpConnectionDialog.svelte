<script lang="ts">
  /**
   * MCP Connection dialog — register Penwright's MCP server with Cursor
   * (default, written on every app launch) and/or Claude Code.
   *
   * Opens from Help → "MCP Connection…". Cursor is already registered at boot;
   * this dialog is for confirming that, reconnecting after a config wipe, or
   * adding Claude Code. Claude Desktop has its own wizard.
   */

  import { onMount } from 'svelte';
  import { t } from '@shared/i18n/store.svelte';

  let { onClose }: { onClose: () => void } = $props();

  type Host = 'cursor' | 'claude';
  type Step = 'loading' | 'choose' | 'connecting' | 'done' | 'error';

  interface ConnectionStatus {
    cursorRegistered: boolean;
    claudeRegistered: boolean;
    cursorConfigPath: string;
    claudeConfigPath: string;
    supported: boolean;
  }
  interface HostResult {
    registered: boolean;
    method: 'cli' | 'file' | null;
    error: string | null;
  }

  let step = $state<Step>('loading');
  let status = $state<ConnectionStatus | null>(null);
  let lastHost = $state<Host>('cursor');
  let lastResult = $state<HostResult | null>(null);
  let errorMsg = $state('');

  const api = (window as unknown as {
    electronAPI: { invoke(channel: string, ...args: unknown[]): Promise<unknown> };
  }).electronAPI;

  async function refreshStatus(): Promise<void> {
    status = await api.invoke('mcp:getConnectionStatus') as ConnectionStatus;
  }

  onMount(async () => {
    try {
      await refreshStatus();
      step = 'choose';
    } catch (err) {
      errorMsg = String((err as Error).message ?? err);
      step = 'error';
    }
  });

  async function connect(host: Host) {
    step = 'connecting';
    errorMsg = '';
    lastHost = host;
    try {
      const res = await api.invoke('mcp:registerHost', host) as HostResult;
      lastResult = res;
      if (res.registered) {
        await refreshStatus();
        step = 'done';
      } else {
        errorMsg = res.error ?? 'unknown error';
        step = 'error';
      }
    } catch (err) {
      errorMsg = String((err as Error).message ?? err);
      step = 'error';
    }
  }

  function backToChoose() {
    step = 'choose';
    errorMsg = '';
  }
</script>

<div class="overlay" role="presentation" onclick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
  <div class="modal" role="dialog" aria-modal="true" aria-labelledby="mcp-conn-title" tabindex="-1">
    {#if step === 'loading'}
      <div class="centered-loader big">
        <div class="spinner big"></div>
        <p class="hint">{t().mcpConnection.probing}</p>
      </div>

    {:else if step === 'choose' && status}
      <div class="icon-circle indigo">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/><circle cx="5" cy="12" r="1"/></svg>
      </div>
      <h2 id="mcp-conn-title">{t().mcpConnection.title}</h2>
      <p>{t().mcpConnection.intro}</p>

      <div class="cards">
        <div class="card">
          <div class="card-head">
            <span class="card-title">{t().mcpConnection.cursor.label}</span>
            <span class="tag rec">{t().mcpConnection.recommended}</span>
            {#if status.cursorRegistered}
              <span class="tag cur">{t().mcpConnection.current}</span>
            {/if}
          </div>
          <p class="card-desc">{t().mcpConnection.cursor.desc}</p>
          <button class="btn btn-primary" type="button" onclick={() => connect('cursor')}>
            {t().mcpConnection.connect}
          </button>
        </div>

        <div class="card">
          <div class="card-head">
            <span class="card-title">{t().mcpConnection.claude.label}</span>
            {#if status.claudeRegistered}
              <span class="tag cur">{t().mcpConnection.current}</span>
            {/if}
          </div>
          <p class="card-desc">{t().mcpConnection.claude.desc}</p>
          <button class="btn btn-primary" type="button" onclick={() => connect('claude')}>
            {t().mcpConnection.connect}
          </button>
        </div>
      </div>

      <div class="note green">{t().mcpConnection.freeForEveryone}</div>

      {#if status}
        <details class="paths">
          <summary>{t().mcpConnection.details}</summary>
          <ul>
            <li>{t().mcpConnection.cursorConfigLabel} <code>{status.cursorConfigPath}</code></li>
            <li>{t().mcpConnection.claudeConfigLabel} <code>{status.claudeConfigPath}</code></li>
          </ul>
        </details>
      {/if}

      <div class="actions">
        <button class="btn btn-secondary" onclick={onClose}>{t().mcpConnection.close}</button>
      </div>

    {:else if step === 'connecting'}
      <div class="centered-loader big">
        <div class="spinner big"></div>
        <p class="hint">{t().mcpConnection.connecting}</p>
      </div>

    {:else if step === 'done' && lastResult}
      <div class="icon-circle green">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
      </div>
      <h2 id="mcp-conn-title">
        {lastHost === 'cursor' ? t().mcpConnection.done.cursorTitle : t().mcpConnection.done.claudeTitle}
      </h2>
      <p>{lastHost === 'cursor' ? t().mcpConnection.done.cursorBody : t().mcpConnection.done.claudeBody}</p>
      {#if lastHost === 'claude' && lastResult.method}
        <p class="hint">
          {lastResult.method === 'cli' ? t().mcpConnection.done.viaCli : t().mcpConnection.done.viaFile}
        </p>
      {/if}
      <div class="note green">{t().mcpConnection.freeForEveryone}</div>
      {#if status}
        <details class="paths">
          <summary>{t().mcpConnection.details}</summary>
          <ul>
            <li>{t().mcpConnection.cursorConfigLabel} <code>{status.cursorConfigPath}</code></li>
            <li>{t().mcpConnection.claudeConfigLabel} <code>{status.claudeConfigPath}</code></li>
          </ul>
        </details>
      {/if}
      <div class="actions">
        <button class="btn btn-secondary" onclick={backToChoose}>{t().mcpConnection.connect}…</button>
        <button class="btn btn-primary" onclick={onClose}>{t().mcpConnection.close}</button>
      </div>

    {:else if step === 'error'}
      <div class="icon-circle amber">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
      </div>
      <h2 id="mcp-conn-title">{t().mcpConnection.error.generic}</h2>
      <pre class="error">{errorMsg}</pre>
      <div class="actions">
        <button class="btn btn-secondary" onclick={onClose}>{t().mcpConnection.close}</button>
        <button class="btn btn-primary" onclick={backToChoose}>{t().mcpConnection.connect}…</button>
      </div>
    {/if}
  </div>
</div>

<style>
  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.55);
    backdrop-filter: blur(2px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 16px;
  }
  .modal {
    background: #fff;
    border-radius: 14px;
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.18);
    width: 100%;
    max-width: 480px;
    max-height: 90vh;
    overflow-y: auto;
    padding: 28px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  h2 { font-size: 20px; font-weight: 700; color: #1a1a1a; margin: 0; }
  p { color: #4b5563; line-height: 1.55; font-size: 14px; margin: 0; }

  .icon-circle {
    width: 56px; height: 56px; border-radius: 14px;
    display: flex; align-items: center; justify-content: center;
  }
  .icon-circle.indigo { background: #eef2ff; color: #4f46e5; }
  .icon-circle.green  { background: #ecfdf5; color: #059669; }
  .icon-circle.amber  { background: #fffbeb; color: #d97706; }

  .cards { display: flex; flex-direction: column; gap: 10px; }
  .card {
    text-align: left;
    border: 1.5px solid #e5e7eb;
    border-radius: 12px;
    padding: 14px;
    background: #fff;
    font-family: inherit;
    display: flex; flex-direction: column; gap: 8px;
  }

  .card-head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .card-title { font-size: 15px; font-weight: 600; color: #1a1a1a; flex: 1; }

  .card-desc { font-size: 13px; color: #6b7280; line-height: 1.5; margin: 0; }

  .tag { font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 6px; }
  .tag.rec { background: #eef2ff; color: #4f46e5; }
  .tag.cur { background: #ecfdf5; color: #059669; }

  .note {
    border-radius: 10px; padding: 12px; font-size: 13px; line-height: 1.5;
  }
  .note.green { background: #ecfdf5; border: 1px solid #a7f3d0; color: #065f46; }

  .actions { display: flex; gap: 10px; margin-top: 6px; }
  .btn {
    height: 42px; border: none; border-radius: 10px;
    font-size: 14px; font-family: inherit; font-weight: 500; cursor: pointer;
    display: inline-flex; align-items: center; justify-content: center;
    padding: 0 16px;
  }
  .card .btn { align-self: flex-start; height: 36px; font-size: 13px; }
  .actions .btn { flex: 1; }
  .btn-primary { background: #4f46e5; color: #fff; }
  .btn-primary:hover { background: #4338ca; }
  .btn-secondary { background: #f3f4f6; color: #374151; }
  .btn-secondary:hover { background: #e5e7eb; }

  .paths { color: #6b7280; font-size: 12px; }
  .paths summary { cursor: pointer; user-select: none; }
  .paths ul {
    list-style: none; padding: 8px 0 0; margin: 0;
    font-family: 'SF Mono', monospace; word-break: break-all;
  }
  .paths li { padding: 2px 0; }
  .paths code { font-family: inherit; font-size: 11px; }

  pre.error {
    background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px;
    padding: 10px 12px; font-family: 'SF Mono', monospace; font-size: 12px;
    color: #92400e; margin: 0; white-space: pre-wrap; word-break: break-word;
  }

  .centered-loader {
    display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 4px 0;
  }
  .centered-loader.big { padding: 28px 0; }
  .hint { font-size: 12px; color: #9ca3af; }
  .spinner {
    width: 20px; height: 20px; border: 2px solid #e5e7eb;
    border-top-color: #4f46e5; border-radius: 50%; animation: spin 0.8s linear infinite;
  }
  .spinner.big { width: 36px; height: 36px; border-width: 3px; }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
