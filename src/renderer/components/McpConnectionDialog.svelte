<script lang="ts">
  /**
   * MCP Connection dialog — pick where Penwright registers its own MCP server:
   * the local Meta-MCP proxy (localhost:3663) or Claude Code (user scope).
   * Exactly one is ever active; applying one removes the app from the other.
   *
   * Opens on first run (until a choice is made) and from Help → "MCP Connection…".
   * Dismissing without an explicit Apply persists the previewed default so the
   * first-run prompt doesn't keep re-appearing.
   */

  import { onMount } from 'svelte';
  import { t } from '@shared/i18n/store.svelte';

  let { onClose }: { onClose: () => void } = $props();

  type Target = 'meta' | 'claude';
  type Step = 'loading' | 'choose' | 'applying' | 'done' | 'error';

  type Access = 'licensed' | 'trial' | 'expired';
  interface ConnectionStatus {
    target: Target | null;
    effectiveTarget: Target;
    defaultTarget: Target;
    metaReachable: boolean;
    access: Access;
    trialDaysLeft: number | null;
    supported: boolean;
    metaConfigPath: string;
    claudeConfigPath: string;
  }
  interface SideResult { registered: boolean; unregistered: boolean; method: 'cli' | 'file' | null; error: string | null; }
  interface EnsureResult { target: Target; ok: boolean; meta: SideResult; claude: SideResult; access: Access; }

  let step = $state<Step>('loading');
  let status = $state<ConnectionStatus | null>(null);
  let selected = $state<Target>('claude');
  let result = $state<EnsureResult | null>(null);
  let errorMsg = $state('');
  let applied = $state(false);

  const api = (window as unknown as {
    electronAPI: { invoke(channel: string, ...args: unknown[]): Promise<unknown> };
  }).electronAPI;

  onMount(async () => {
    try {
      const s = await api.invoke('mcp:getConnectionStatus') as ConnectionStatus;
      status = s;
      selected = s.effectiveTarget;
      step = 'choose';
    } catch (err) {
      errorMsg = String((err as Error).message ?? err);
      step = 'error';
    }
  });

  async function apply() {
    step = 'applying';
    errorMsg = '';
    try {
      const res = await api.invoke('mcp:setTarget', selected) as EnsureResult;
      result = res;
      applied = true;
      if (res.ok) {
        if (status) status.target = selected;
        step = 'done';
      } else {
        if (selected === 'meta' && res.meta.error === 'meta-not-running') {
          errorMsg = t().mcpConnection.error.metaNotRunning;
        } else {
          errorMsg = (selected === 'meta' ? res.meta.error : res.claude.error) ?? 'unknown error';
        }
        step = 'error';
      }
    } catch (err) {
      errorMsg = String((err as Error).message ?? err);
      step = 'error';
    }
  }

  function close() {
    // First-run dismiss without an explicit choice → persist the previewed
    // default so we stop offering the prompt every launch. Fire-and-forget.
    if (!applied && status && status.target == null) {
      api.invoke('mcp:setTarget', selected).catch(() => { /* ignore */ });
    }
    onClose();
  }

  function backToChoose() {
    step = 'choose';
    errorMsg = '';
  }
</script>

<div class="overlay" role="presentation" onclick={(e) => { if (e.target === e.currentTarget) close(); }}>
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
        <button
          class="card"
          class:active={selected === 'meta'}
          type="button"
          onclick={() => (selected = 'meta')}
        >
          <div class="card-head">
            <span class="radio" class:on={selected === 'meta'}></span>
            <span class="card-title">{t().mcpConnection.meta.label}</span>
            <span class="badge" class:green={status.metaReachable} class:gray={!status.metaReachable}>
              {status.metaReachable ? t().mcpConnection.meta.running : t().mcpConnection.meta.notRunning}
            </span>
          </div>
          <p class="card-desc">{t().mcpConnection.meta.desc}</p>
          <div class="tags">
            {#if status.defaultTarget === 'meta'}<span class="tag rec">{t().mcpConnection.recommended}</span>{/if}
            {#if status.target === 'meta'}<span class="tag cur">{t().mcpConnection.current}</span>{/if}
          </div>
        </button>

        <button
          class="card"
          class:active={selected === 'claude'}
          type="button"
          onclick={() => (selected = 'claude')}
        >
          <div class="card-head">
            <span class="radio" class:on={selected === 'claude'}></span>
            <span class="card-title">{t().mcpConnection.claude.label}</span>
          </div>
          <p class="card-desc">{t().mcpConnection.claude.desc}</p>
          <div class="tags">
            {#if status.defaultTarget === 'claude'}<span class="tag rec">{t().mcpConnection.recommended}</span>{/if}
            {#if status.target === 'claude'}<span class="tag cur">{t().mcpConnection.current}</span>{/if}
          </div>
        </button>
      </div>

      {#if status.access === 'expired'}
        <div class="note amber">{t().mcpConnection.noAccess}</div>
      {:else if status.access === 'trial'}
        <div class="note green">{t().mcpConnection.trialActive(status.trialDaysLeft ?? 14)}</div>
      {/if}

      <div class="actions">
        <button class="btn btn-secondary" onclick={close}>{t().mcpConnection.close}</button>
        <button class="btn btn-primary" onclick={apply}>{t().mcpConnection.apply}</button>
      </div>

    {:else if step === 'applying'}
      <div class="centered-loader big">
        <div class="spinner big"></div>
        <p class="hint">{t().mcpConnection.applying}</p>
      </div>

    {:else if step === 'done' && result}
      <div class="icon-circle green">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
      </div>
      <h2 id="mcp-conn-title">
        {result.target === 'meta' ? t().mcpConnection.done.metaTitle : t().mcpConnection.done.claudeTitle}
      </h2>
      <p>{result.target === 'meta' ? t().mcpConnection.done.metaBody : t().mcpConnection.done.claudeBody}</p>
      {#if result.target === 'claude' && result.claude.method}
        <p class="hint">
          {result.claude.method === 'cli' ? t().mcpConnection.done.viaCli : t().mcpConnection.done.viaFile}
        </p>
      {/if}
      {#if result.access === 'expired'}
        <div class="note amber">{t().mcpConnection.noAccess}</div>
      {:else if result.access === 'trial' && status}
        <div class="note green">{t().mcpConnection.trialActive(status.trialDaysLeft ?? 14)}</div>
      {/if}
      {#if status}
        <details class="paths">
          <summary>{t().mcpConnection.details}</summary>
          <ul>
            <li>{t().mcpConnection.metaConfigLabel} <code>{status.metaConfigPath}</code></li>
            <li>{t().mcpConnection.claudeConfigLabel} <code>{status.claudeConfigPath}</code></li>
          </ul>
        </details>
      {/if}
      <div class="actions">
        <button class="btn btn-secondary" onclick={backToChoose}>{t().mcpConnection.apply}…</button>
        <button class="btn btn-primary" onclick={onClose}>{t().mcpConnection.close}</button>
      </div>

    {:else if step === 'error'}
      <div class="icon-circle amber">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
      </div>
      <h2 id="mcp-conn-title">{t().mcpConnection.error.generic}</h2>
      <pre class="error">{errorMsg}</pre>
      <div class="actions">
        <button class="btn btn-secondary" onclick={close}>{t().mcpConnection.close}</button>
        <button class="btn btn-primary" onclick={backToChoose}>{t().mcpConnection.apply}…</button>
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
    cursor: pointer;
    font-family: inherit;
    transition: border-color 0.12s, background 0.12s;
    display: flex; flex-direction: column; gap: 6px;
  }
  .card:hover { border-color: #c7d2fe; }
  .card.active { border-color: #4f46e5; background: #f5f5ff; }

  .card-head { display: flex; align-items: center; gap: 10px; }
  .card-title { font-size: 15px; font-weight: 600; color: #1a1a1a; flex: 1; }

  .radio {
    width: 16px; height: 16px; border-radius: 50%;
    border: 2px solid #cbd5e1; flex-shrink: 0; position: relative;
  }
  .radio.on { border-color: #4f46e5; }
  .radio.on::after {
    content: ''; position: absolute; inset: 2px;
    border-radius: 50%; background: #4f46e5;
  }

  .card-desc { font-size: 13px; color: #6b7280; line-height: 1.5; margin: 0; }

  .badge {
    font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 999px;
  }
  .badge.green { background: #ecfdf5; color: #059669; }
  .badge.gray  { background: #f3f4f6; color: #9ca3af; }

  .tags { display: flex; gap: 6px; }
  .tag { font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 6px; }
  .tag.rec { background: #eef2ff; color: #4f46e5; }
  .tag.cur { background: #ecfdf5; color: #059669; }

  .note {
    border-radius: 10px; padding: 12px; font-size: 13px; line-height: 1.5;
  }
  .note.amber { background: #fffbeb; border: 1px solid #fde68a; color: #92400e; }
  .note.green { background: #ecfdf5; border: 1px solid #a7f3d0; color: #065f46; }

  .actions { display: flex; gap: 10px; margin-top: 6px; }
  .btn {
    flex: 1; height: 42px; border: none; border-radius: 10px;
    font-size: 14px; font-family: inherit; font-weight: 500; cursor: pointer;
    display: inline-flex; align-items: center; justify-content: center;
  }
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
