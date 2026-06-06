<script lang="ts">
  import { t } from '@shared/i18n/store.svelte';

  let {
    typstInstalled,
    platform,
    onDismiss,
  }: {
    typstInstalled: boolean;
    platform: string;
    onDismiss: (dontShowAgain: boolean) => void;
  } = $props();

  let dontShowAgain = $state(false);

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      onDismiss(dontShowAgain);
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="welcome-overlay" onclick={() => onDismiss(dontShowAgain)} role="presentation">
  <!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
  <div class="welcome-modal" onclick={(e) => e.stopPropagation()} role="dialog" tabindex="-1">
    <div class="welcome-header">
      <h1>{t().editor.welcomeTitle}</h1>
      <p class="welcome-tagline">
        {t().editor.welcomeTagline}
      </p>
    </div>

    <div class="welcome-body">
      <div class="welcome-features">
        <div class="welcome-feature">
          <span class="welcome-feature-icon">/</span>
          <div>
            <strong>{t().editor.welcomeSlashTitle}</strong>
            <p>{t().editor.welcomeSlashBody}</p>
          </div>
        </div>
        <div class="welcome-feature">
          <span class="welcome-feature-icon">&#9654;</span>
          <div>
            <strong>{t().editor.welcomePreviewTitle}</strong>
            <p>{t().editor.welcomePreviewBody}</p>
          </div>
        </div>
        <div class="welcome-feature">
          <span class="welcome-feature-icon">&#9776;</span>
          <div>
            <strong>{t().editor.welcomeCommandHubTitle}</strong>
            <p>{t().editor.welcomeCommandHubBody}</p>
          </div>
        </div>
        <div class="welcome-feature">
          <span class="welcome-feature-icon">AI</span>
          <div>
            <strong>{t().editor.welcomeAiTitle}</strong>
            <p>{t().editor.welcomeAiBody}</p>
          </div>
        </div>
      </div>

      {#if !typstInstalled}
        <div class="welcome-warning">
          <strong>{t().editor.welcomeTypstMissingTitle}</strong>
          <p>{t().editor.welcomeTypstMissingBody}</p>
          <code class="welcome-install-cmd">
            {#if platform === 'darwin'}
              brew install typst
            {:else if platform === 'win32'}
              winget install --id Typst.Typst
            {:else}
              cargo install typst-cli
            {/if}
          </code>
          <p class="welcome-hint">{t().editor.welcomeTypstHint}</p>
        </div>
      {:else}
        <div class="welcome-success">
          {t().editor.welcomeTypstReady}
        </div>
      {/if}

      <!-- svelte-ignore a11y_label_has_associated_control -->
      <label class="welcome-checkbox">
        <input type="checkbox" bind:checked={dontShowAgain} />
        {t().editor.welcomeDontShowAgain}
      </label>
    </div>

    <div class="welcome-footer">
      <button
        class="welcome-btn"
        onclick={() => onDismiss(dontShowAgain)}
      >
        {t().editor.welcomeGetStarted}
      </button>
    </div>
  </div>
</div>
