<script lang="ts">
  /**
   * The one question Penwright asks about money, once, at first launch.
   *
   * The app cannot detect whether someone writes a thesis or a client invoice,
   * so it asks. Whatever the answer, NOTHING is locked — personal use is free
   * and complete forever, and a self-declared commercial user gets a
   * dismissible notice, never a wall.
   *
   * Deliberately not dismissible without answering: an unanswered question
   * re-opens on the next launch, which is worse than one honest click. There
   * is no wrong answer to be punished for, so there is nothing to escape.
   */
  import { uiState } from '../appState.svelte';
  import { t } from '@shared/i18n/store.svelte';
  import logoUrl from '../assets/penwright-icon.svg';

  const api = (window as unknown as {
    electronAPI: { invoke(channel: string, ...args: unknown[]): Promise<unknown> };
  }).electronAPI;

  let saving = $state(false);

  async function choose(usage: 'personal' | 'commercial') {
    if (saving) return;
    saving = true;
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
      }
    } catch {
      // Storing the answer failed — treat it as unanswered rather than
      // guessing. The dialog re-opens next launch.
      uiState.usageContext = null;
    } finally {
      saving = false;
    }
  }
</script>

<div class="usage-overlay" role="dialog" aria-modal="true" aria-label={t().license.usageTitle}>
  <div class="usage-card">
    <img src={logoUrl} alt="Penwright" class="usage-logo" />
    <h1>{t().license.usageTitle}</h1>
    <p class="usage-text">{t().license.usageText}</p>

    <div class="usage-options">
      <button class="usage-option" onclick={() => choose('personal')} disabled={saving}>
        <span class="opt-label">{t().license.usagePersonal}</span>
        <span class="opt-hint">{t().license.usagePersonalHint}</span>
      </button>
      <button class="usage-option" onclick={() => choose('commercial')} disabled={saving}>
        <span class="opt-label">{t().license.usageCommercial}</span>
        <span class="opt-hint">{t().license.usageCommercialHint}</span>
      </button>
    </div>

    <p class="usage-foot">{t().license.usageChangeHint}</p>
  </div>
</div>

<style>
  .usage-overlay {
    position: fixed;
    inset: 0;
    background: #211e1a;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 200;
    -webkit-app-region: no-drag;
  }

  .usage-card {
    width: 440px;
    max-width: 90vw;
    padding: 40px 36px 28px;
    background: #fff;
    border-radius: 16px;
    box-shadow: 0 24px 70px rgba(0, 0, 0, 0.45);
    text-align: center;
  }

  .usage-logo {
    width: 72px;
    height: 72px;
    margin-bottom: 16px;
  }

  .usage-card h1 {
    margin: 0 0 12px;
    font-size: 22px;
    font-weight: 600;
    color: #1a1a1a;
    letter-spacing: -0.01em;
  }

  .usage-text {
    margin: 0 0 24px;
    font-size: 14px;
    line-height: 1.55;
    color: #666;
  }

  .usage-options {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .usage-option {
    display: flex;
    flex-direction: column;
    gap: 3px;
    padding: 14px 18px;
    border: 1px solid #e2ded5;
    border-radius: 10px;
    background: #faf9f6;
    font-family: inherit;
    text-align: left;
    cursor: pointer;
    transition: all 0.15s;
  }

  .usage-option:hover:not(:disabled) {
    border-color: #a8503a;
    background: #fff;
  }

  .usage-option:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .opt-label {
    font-size: 14px;
    font-weight: 600;
    color: #3a352f;
  }

  .opt-hint {
    font-size: 12px;
    color: #8a8174;
  }

  .usage-foot {
    margin: 20px 0 0;
    font-size: 12px;
    color: #a49b8d;
  }
</style>
