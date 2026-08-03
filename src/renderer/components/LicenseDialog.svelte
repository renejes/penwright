<script lang="ts">
  import { uiState } from '../appState.svelte';
  import { t } from '@shared/i18n/store.svelte';

  let {
    onClose,
  }: {
    onClose: () => void;
  } = $props();

  const api = (window as unknown as { electronAPI: { invoke(channel: string, ...args: unknown[]): Promise<unknown> } }).electronAPI;

  let licenseKey = $state('');
  let status = $state(uiState.licenseStatus);
  let tier = $state(uiState.licenseTier);
  let activeKey = $state(uiState.licenseKey);
  let message = $state(uiState.licenseMessage);
  let loading = $state(false);
  let error = $state('');

  // Pull the local licence state and mirror it into global UI state so the
  // status bar and the notice update without a reload. Nothing is gated on
  // this — a failure here costs a label, not access.
  async function refreshEntitlement() {
    try {
      const ent = await api.invoke('license:getEntitlement') as {
        access: 'personal' | 'commercial';
        usage: 'personal' | 'commercial' | null;
        licenseDue: boolean;
      };
      if (ent && typeof ent === 'object') {
        uiState.licenseAccess = ent.access;
        uiState.usageContext = ent.usage;
        uiState.licenseDue = ent.licenseDue;
      }
    } catch {
      // best-effort — the label already has its boot-time value
    }
  }

  /** Change the declared usage. Re-shows the notice when switching to commercial. */
  async function setUsage(usage: 'personal' | 'commercial') {
    try {
      const ent = await api.invoke('license:setUsage', usage) as {
        access: 'personal' | 'commercial';
        usage: 'personal' | 'commercial' | null;
        licenseDue: boolean;
      };
      if (ent && typeof ent === 'object') {
        uiState.licenseAccess = ent.access;
        uiState.usageContext = ent.usage;
        uiState.licenseDue = ent.licenseDue;
        uiState.licenseNoticeDismissed = false;
      }
    } catch {
      // best-effort — the stored answer is unchanged
    }
  }

  async function handleActivate() {
    const key = licenseKey.trim();
    if (!key) return;

    loading = true;
    error = '';

    try {
      const result = await api.invoke('license:activate', key) as {
        status: string;
        tier: string | null;
        key: string | null;
        error?: string;
      };

      if (result.error) {
        error = result.error;
      } else {
        status = result.status;
        tier = result.tier;
        activeKey = result.key;
        message = '';
        licenseKey = '';
        // Sync global state
        uiState.licenseStatus = result.status;
        uiState.licenseTier = result.tier;
        uiState.licenseKey = result.key;
        uiState.licenseMessage = '';
        // Re-resolve the entitlement so any active license gate lifts immediately.
        await refreshEntitlement();
      }
    } catch (err) {
      error = String(err);
    } finally {
      loading = false;
    }
  }

  async function handleDeactivate() {
    loading = true;
    error = '';

    try {
      await api.invoke('license:deactivate');
      status = 'none';
      tier = null;
      activeKey = null;
      message = '';
      // Sync global state
      uiState.licenseStatus = 'none';
      uiState.licenseTier = null;
      uiState.licenseKey = null;
      uiState.licenseMessage = '';
      // Re-resolve: falls back to 'personal'. The app stays fully usable.
      await refreshEntitlement();
    } catch (err) {
      error = String(err);
    } finally {
      loading = false;
    }
  }

  function handleBuy() {
    api.invoke('license:openCheckout').catch(() => {});
  }

  function maskKey(key: string): string {
    if (key.length <= 12) return key;
    return key.slice(0, 12) + '...' + key.slice(-4);
  }
</script>

<div class="license-overlay" onclick={(e) => { if (e.target === e.currentTarget) onClose(); }} onkeydown={(e) => e.key === 'Escape' && onClose()} role="dialog" tabindex="-1">
  <div class="license-dialog" role="document">
    <div class="dialog-header">
      <h2>{t().license.dialogTitle}</h2>
      <button class="close-btn" onclick={onClose}>×</button>
    </div>

    {#if status === 'active' && activeKey}
      <div class="license-active">
        <div class="status-badge">{t().license.dialogLicensed}</div>
        <div class="license-info">
          <span class="key-display">{maskKey(activeKey)}</span>
          {#if message}
            <span class="offline-note">{message}</span>
          {/if}
        </div>
        <button class="btn btn-secondary" onclick={handleDeactivate} disabled={loading}>
          {loading ? t().license.dialogDeactivating : t().license.dialogDeactivate}
        </button>
      </div>
    {:else}
      <div class="license-input">
        <p class="dialog-description">
          {t().license.dialogEnterPrompt}
        </p>

        <input
          type="text"
          bind:value={licenseKey}
          placeholder="pw_LIC_..."
          class="key-input"
          onkeydown={(e) => e.key === 'Enter' && handleActivate()}
          disabled={loading}
        />

        {#if error}
          <p class="error-text">{error}</p>
        {/if}
        {#if message && status !== 'active'}
          <p class="warning-text">{message}</p>
        {/if}

        <div class="dialog-actions">
          <button class="btn btn-primary" onclick={handleActivate} disabled={loading || !licenseKey.trim()}>
            {loading ? t().license.dialogActivating : t().license.dialogActivate}
          </button>
          <button class="btn btn-secondary" onclick={handleBuy}>
            {t().license.dialogBuy}
          </button>
        </div>

        <button class="btn-text" onclick={onClose}>
          {t().license.dialogContinueWithout}
        </button>
      </div>
    {/if}

    <!-- Usage row: free personal use is a right, not a fallback, so it says so
         and stays switchable. Shown in both states. -->
    <div class="usage-row">
      <span class="usage-label">{t().license.dialogUsageLabel}</span>
      <div class="usage-switch">
        <button
          class="usage-pill"
          class:active={uiState.usageContext === 'personal'}
          onclick={() => setUsage('personal')}
        >{t().license.dialogUsagePersonal}</button>
        <button
          class="usage-pill"
          class:active={uiState.usageContext === 'commercial'}
          onclick={() => setUsage('commercial')}
        >{t().license.dialogUsageCommercial}</button>
      </div>
      {#if uiState.usageContext === 'personal'}
        <p class="usage-note">{t().license.dialogPersonalFree}</p>
      {/if}
    </div>
  </div>
</div>

<style>
  .usage-row {
    margin-top: 18px;
    padding-top: 16px;
    border-top: 1px solid #ece8e0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .usage-label {
    font-size: 12px;
    color: #8a8174;
  }

  .usage-switch {
    display: flex;
    gap: 6px;
  }

  .usage-pill {
    padding: 5px 14px;
    border: 1px solid #e2ded5;
    border-radius: 999px;
    background: transparent;
    color: #6b6357;
    cursor: pointer;
    font-size: 12.5px;
    font-family: inherit;
    transition: all 0.15s;
  }

  .usage-pill:hover {
    border-color: #c9c2b6;
  }

  .usage-pill.active {
    border-color: #a8503a;
    background: #a8503a;
    color: #fff;
  }

  .usage-note {
    margin: 0;
    font-size: 12px;
    color: #7a9a6b;
  }

  .license-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 300;
  }

  .license-dialog {
    background: #fff;
    border-radius: 16px;
    width: 420px;
    max-width: 90vw;
    padding: 32px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
  }

  .dialog-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 20px;
  }

  .dialog-header h2 {
    margin: 0;
    font-size: 20px;
    font-weight: 600;
    color: #1a1a1a;
  }

  .close-btn {
    width: 32px;
    height: 32px;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: #999;
    cursor: pointer;
    font-size: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .close-btn:hover {
    background: #f5f5f5;
    color: #555;
  }

  .dialog-description {
    color: #666;
    font-size: 14px;
    line-height: 1.5;
    margin: 0 0 16px;
  }

  .key-input {
    width: 100%;
    padding: 12px 16px;
    border: 1px solid #e0e0e0;
    border-radius: 10px;
    font-size: 14px;
    font-family: 'SF Mono', 'Menlo', monospace;
    color: #1a1a1a;
    outline: none;
    transition: border-color 0.15s;
    box-sizing: border-box;
  }

  .key-input:focus {
    border-color: #4f7df9;
  }

  .key-input:disabled {
    opacity: 0.6;
  }

  .error-text {
    color: #e53e3e;
    font-size: 13px;
    margin: 8px 0 0;
  }

  .warning-text {
    color: #e88a3a;
    font-size: 13px;
    margin: 8px 0 0;
  }

  .dialog-actions {
    display: flex;
    gap: 10px;
    margin-top: 20px;
  }

  .btn {
    padding: 10px 20px;
    border: none;
    border-radius: 10px;
    font-size: 14px;
    font-family: inherit;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s;
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-primary {
    background: #4f7df9;
    color: #fff;
    flex: 1;
  }

  .btn-primary:hover:not(:disabled) {
    background: #3d6be8;
  }

  .btn-secondary {
    background: #f5f5f5;
    color: #555;
  }

  .btn-secondary:hover:not(:disabled) {
    background: #eee;
  }

  .btn-text {
    display: block;
    width: 100%;
    margin-top: 16px;
    padding: 8px;
    border: none;
    background: transparent;
    color: #999;
    cursor: pointer;
    font-size: 13px;
    font-family: inherit;
  }

  .btn-text:hover {
    color: #555;
  }

  /* Active license state */
  .license-active {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .status-badge {
    display: inline-flex;
    align-self: flex-start;
    padding: 4px 12px;
    border-radius: 20px;
    background: #e8f5e9;
    color: #2e7d32;
    font-size: 13px;
    font-weight: 600;
  }

  .license-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .key-display {
    font-family: 'SF Mono', 'Menlo', monospace;
    font-size: 13px;
    color: #666;
  }

  .offline-note {
    font-size: 12px;
    color: #e88a3a;
  }
</style>
