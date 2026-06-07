<script lang="ts">
  /**
   * Boot-time dialog shown when the previous session crashed.
   *
   * The user gets a calm message + a single "Bericht ansehen" button.
   * The detail view shows the plaintext report with action buttons:
   * Copy / Mail / Open in editor / Discard.
   *
   * Closing the dialog (any path) marks the report as shown so it won't
   * reappear on next boot. Reports stay on disk in <userData>/crash-reports/
   * until the user explicitly discards them.
   */
  import { t } from '@shared/i18n/store.svelte';

  let { content, filename, onClose }: {
    content: string;
    filename: string;
    onClose: () => void;
  } = $props();

  const api = (window as unknown as { electronAPI: {
    invoke(channel: string, ...args: unknown[]): Promise<unknown>;
  } }).electronAPI;

  let view: 'intro' | 'detail' = $state('intro');
  let copied = $state(false);
  let mailed = $state(false);

  async function copyReport() {
    try {
      await api.invoke('crash:copyToClipboard', content);
      copied = true;
      setTimeout(() => (copied = false), 2000);
    } catch {
      /* ignore */
    }
  }

  async function openMail() {
    try {
      await api.invoke('crash:openMail', content);
      mailed = true;
      setTimeout(() => (mailed = false), 2000);
    } catch {
      /* ignore */
    }
  }

  async function openFolder() {
    try {
      await api.invoke('crash:openFolder');
    } catch {
      /* ignore */
    }
  }

  async function discard() {
    const confirmed = confirm(t().crash.discardConfirm);
    if (!confirmed) return;
    try {
      await api.invoke('crash:deleteAll');
    } catch {
      /* ignore */
    }
    onClose();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') onClose();
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="crash-overlay" role="presentation" onclick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
  <div class="crash-modal" role="dialog" tabindex="-1">
    <div class="crash-header">
      <h2>{view === 'intro' ? t().crash.introTitle : t().crash.detailTitle}</h2>
      <button class="crash-close" onclick={onClose} title={t().common.close}>&times;</button>
    </div>

    {#if view === 'intro'}
      <div class="crash-body">
        <p>
          {t().crash.introBodyBefore}<strong>{t().crash.introBodyStrong}</strong>{t().crash.introBodyAfter}
        </p>
        <p class="crash-hint">
          {t().crash.introHint}
        </p>
      </div>
      <div class="crash-actions">
        <button class="secondary" onclick={onClose}>{t().common.close}</button>
        <button class="primary" onclick={() => (view = 'detail')}>{t().crash.viewReport}</button>
      </div>
    {:else}
      <div class="crash-body">
        <div class="crash-filename">{filename}</div>
        <pre class="crash-report">{content}</pre>
      </div>
      <div class="crash-actions">
        <button class="secondary" onclick={discard} title={t().crash.discardTitle}>
          {t().crash.discard}
        </button>
        <button class="secondary" onclick={openFolder} title={t().crash.openFolderTitle}>
          {t().crash.openFolder}
        </button>
        <button class="secondary" onclick={copyReport}>
          {copied ? t().crash.copied : t().crash.copyToClipboard}
        </button>
        <button class="secondary" onclick={openMail}>
          {mailed ? t().crash.mailed : t().crash.prepareMail}
        </button>
        <button class="primary" onclick={onClose}>{t().common.close}</button>
      </div>
    {/if}
  </div>
</div>

<style>
  .crash-overlay {
    position: fixed;
    inset: 0;
    z-index: 10000;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .crash-modal {
    background: var(--toolbar-bg);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.3);
    width: min(680px, 90vw);
    max-height: 85vh;
    display: flex;
    flex-direction: column;
  }

  .crash-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px 12px;
    border-bottom: 1px solid var(--border-color);
  }

  .crash-header h2 {
    font-size: 16px;
    font-weight: 600;
    color: var(--text-color);
    margin: 0;
  }

  .crash-close {
    background: transparent;
    border: none;
    color: var(--text-color);
    font-size: 22px;
    cursor: pointer;
    padding: 0 4px;
    opacity: 0.6;
    line-height: 1;
  }

  .crash-close:hover {
    opacity: 1;
  }

  .crash-body {
    padding: 16px 20px;
    overflow-y: auto;
    flex: 1 1 auto;
  }

  .crash-body p {
    margin: 0 0 12px;
    font-size: 14px;
    line-height: 1.55;
    color: var(--text-color);
  }

  .crash-hint {
    color: rgba(128, 128, 128, 0.85);
    font-size: 13px;
  }

  .crash-filename {
    font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
    font-size: 11px;
    color: rgba(128, 128, 128, 0.7);
    margin-bottom: 8px;
  }

  .crash-report {
    font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
    font-size: 12px;
    line-height: 1.5;
    color: var(--text-color);
    background: rgba(128, 128, 128, 0.07);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    padding: 12px 14px;
    margin: 0;
    white-space: pre-wrap;
    word-break: break-word;
    max-height: 50vh;
    overflow-y: auto;
  }

  .crash-actions {
    display: flex;
    gap: 8px;
    padding: 12px 20px 16px;
    border-top: 1px solid var(--border-color);
    flex-wrap: wrap;
    justify-content: flex-end;
  }

  .crash-actions button {
    padding: 6px 14px;
    font-size: 13px;
    border-radius: 6px;
    border: 1px solid var(--border-color);
    background: transparent;
    color: var(--text-color);
    cursor: pointer;
  }

  .crash-actions button:hover {
    background: rgba(128, 128, 128, 0.08);
  }

  .crash-actions button.primary {
    background: var(--accent-color, #2563eb);
    color: white;
    border-color: transparent;
  }

  .crash-actions button.primary:hover {
    filter: brightness(1.1);
  }
</style>
