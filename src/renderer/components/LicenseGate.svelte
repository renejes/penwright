<script lang="ts">
  import { uiState } from '../appState.svelte';
  import { t } from '@shared/i18n/store.svelte';
  import logoUrl from '../assets/penwright-icon.svg';

  const api = (window as unknown as {
    electronAPI: { invoke(channel: string, ...args: unknown[]): Promise<unknown> };
  }).electronAPI;

  let checking = $state(false);
  let recheckNote = $state('');

  function buy() {
    api.invoke('license:openCheckout');
  }

  function enterKey() {
    // The LicenseDialog renders above the gate; a successful activation
    // flips uiState.licenseAccess to 'licensed' and the gate unmounts.
    uiState.showLicense = true;
  }

  async function recheck() {
    checking = true;
    recheckNote = '';
    try {
      // Validate first so the stored status is fresh, then resolve the gate.
      const v = await api.invoke('license:validate') as {
        status: string; tier: string | null; key: string | null; message?: string;
      };
      if (v && typeof v === 'object') {
        uiState.licenseStatus = v.status;
        uiState.licenseTier = v.tier;
        uiState.licenseKey = v.key;
        uiState.licenseMessage = v.message || '';
      }
      const ent = await api.invoke('license:getEntitlement') as {
        access: 'licensed' | 'trial' | 'expired'; trialDaysLeft?: number;
      };
      if (ent && typeof ent === 'object') {
        uiState.licenseAccess = ent.access;
        if (typeof ent.trialDaysLeft === 'number') uiState.trialDaysLeft = ent.trialDaysLeft;
      }
      if (uiState.licenseAccess === 'expired') {
        recheckNote = t().license.gateNoLicenseYet;
      }
    } catch {
      recheckNote = t().license.gateCheckFailed;
    } finally {
      checking = false;
    }
  }
</script>

<div class="gate-overlay" role="dialog" aria-modal="true" aria-label={t().license.gateTitle}>
  <div class="gate-card">
    <img src={logoUrl} alt="Penwright" class="gate-logo" />
    <h1>{t().license.gateTitle}</h1>
    <p class="gate-text">
      {t().license.gateText}
    </p>

    <div class="gate-actions">
      <button class="btn btn-primary" onclick={buy}>{t().license.gateBuy}</button>
      <button class="btn btn-secondary" onclick={enterKey}>{t().license.gateEnterKey}</button>
    </div>

    <button class="btn-text" onclick={recheck} disabled={checking}>
      {checking ? t().license.gateChecking : t().license.gateCheckAgain}
    </button>
    {#if recheckNote}
      <p class="gate-note">{recheckNote}</p>
    {/if}
  </div>
</div>

<style>
  .gate-overlay {
    position: fixed;
    inset: 0;
    /* Opaque, covers all app chrome (toolbar/sidebar/start screen/status bar).
       Sits just below the 300-level modals so the LicenseDialog (key entry)
       can still appear on top when invoked from this gate. */
    background: #211e1a;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 200;
    -webkit-app-region: no-drag;
  }

  .gate-card {
    width: 420px;
    max-width: 90vw;
    padding: 40px 36px;
    background: #fff;
    border-radius: 16px;
    box-shadow: 0 24px 70px rgba(0, 0, 0, 0.45);
    text-align: center;
  }

  .gate-logo {
    width: 72px;
    height: 72px;
    margin-bottom: 16px;
  }

  .gate-card h1 {
    margin: 0 0 12px;
    font-size: 22px;
    font-weight: 600;
    color: #1a1a1a;
    letter-spacing: -0.01em;
  }

  .gate-text {
    margin: 0 0 24px;
    font-size: 14px;
    line-height: 1.55;
    color: #666;
  }

  .gate-actions {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .btn {
    padding: 12px 20px;
    border: none;
    border-radius: 10px;
    font-size: 14px;
    font-family: inherit;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-primary {
    background: #a8503a;
    color: #fff;
  }

  .btn-primary:hover {
    background: #934636;
  }

  .btn-secondary {
    background: #f3f1ec;
    color: #3a352f;
  }

  .btn-secondary:hover {
    background: #e8e4dc;
  }

  .btn-text {
    margin-top: 18px;
    padding: 6px 10px;
    border: none;
    background: transparent;
    color: #8a8174;
    cursor: pointer;
    font-size: 13px;
    font-family: inherit;
  }

  .btn-text:hover:not(:disabled) {
    color: #3a352f;
  }

  .gate-note {
    margin: 10px 0 0;
    font-size: 12px;
    color: #a8503a;
  }
</style>
