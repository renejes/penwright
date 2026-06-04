<script lang="ts">
  import { uiState } from '../appState.svelte';

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

  // Pull the local entitlement (licensed / trial / expired) and mirror it into
  // global UI state so the LicenseGate / status bar update without a reload.
  async function refreshEntitlement() {
    try {
      const ent = await api.invoke('license:getEntitlement') as {
        access: 'licensed' | 'trial' | 'expired'; trialDaysLeft?: number;
      };
      if (ent && typeof ent === 'object') {
        uiState.licenseAccess = ent.access;
        if (typeof ent.trialDaysLeft === 'number') uiState.trialDaysLeft = ent.trialDaysLeft;
      }
    } catch {
      // best-effort — gating already has its boot-time value
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
      // Re-resolve entitlement: falls back to trial or expired.
      await refreshEntitlement();
    } catch (err) {
      error = String(err);
    } finally {
      loading = false;
    }
  }

  function handleBuy() {
    api.invoke('license:openCheckout');
  }

  function maskKey(key: string): string {
    if (key.length <= 12) return key;
    return key.slice(0, 12) + '...' + key.slice(-4);
  }
</script>

<div class="license-overlay" onclick={onClose} onkeydown={(e) => e.key === 'Escape' && onClose()} role="dialog" tabindex="-1">
  <div class="license-dialog" onclick={(e) => e.stopPropagation()} role="document">
    <div class="dialog-header">
      <h2>License</h2>
      <button class="close-btn" onclick={onClose}>×</button>
    </div>

    {#if status === 'active' && activeKey}
      <div class="license-active">
        <div class="status-badge">Licensed</div>
        <div class="license-info">
          <span class="key-display">{maskKey(activeKey)}</span>
          {#if message}
            <span class="offline-note">{message}</span>
          {/if}
        </div>
        <button class="btn btn-secondary" onclick={handleDeactivate} disabled={loading}>
          {loading ? 'Deactivating...' : 'Deactivate on this device'}
        </button>
      </div>
    {:else}
      <div class="license-input">
        <p class="dialog-description">
          Enter your license key to activate Penwright on this device.
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
            {loading ? 'Activating...' : 'Activate'}
          </button>
          <button class="btn btn-secondary" onclick={handleBuy}>
            Buy License
          </button>
        </div>

        <button class="btn-text" onclick={onClose}>
          Continue without license
        </button>
      </div>
    {/if}
  </div>
</div>

<style>
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
