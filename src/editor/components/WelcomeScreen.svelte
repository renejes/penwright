<script lang="ts">
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
      <h1>Welcome to vswrite</h1>
      <p class="welcome-tagline">
        A visual editor for Typst documents — write like in a word processor, compile to beautiful PDFs.
      </p>
    </div>

    <div class="welcome-body">
      <div class="welcome-features">
        <div class="welcome-feature">
          <span class="welcome-feature-icon">/</span>
          <div>
            <strong>Slash Commands</strong>
            <p>Type / to insert headings, lists, images, tables, and more.</p>
          </div>
        </div>
        <div class="welcome-feature">
          <span class="welcome-feature-icon">&#9654;</span>
          <div>
            <strong>Live Preview</strong>
            <p>See your document rendered in real-time as you type.</p>
          </div>
        </div>
        <div class="welcome-feature">
          <span class="welcome-feature-icon">&#9776;</span>
          <div>
            <strong>Command Hub</strong>
            <p>All actions in one place — click the menu icon in the toolbar.</p>
          </div>
        </div>
        <div class="welcome-feature">
          <span class="welcome-feature-icon">AI</span>
          <div>
            <strong>AI Agent Support</strong>
            <p>AI tools can edit your .typ files directly — changes appear instantly.</p>
          </div>
        </div>
      </div>

      {#if !typstInstalled}
        <div class="welcome-warning">
          <strong>Typst CLI not found</strong>
          <p>Install Typst for live preview and PDF export:</p>
          <code class="welcome-install-cmd">
            {#if platform === 'darwin'}
              brew install typst
            {:else if platform === 'win32'}
              winget install --id Typst.Typst
            {:else}
              cargo install typst-cli
            {/if}
          </code>
          <p class="welcome-hint">Run this command in your terminal, then restart VS Code.</p>
        </div>
      {:else}
        <div class="welcome-success">
          Typst CLI detected — live preview and PDF export are ready.
        </div>
      {/if}

      <!-- svelte-ignore a11y_label_has_associated_control -->
      <label class="welcome-checkbox">
        <input type="checkbox" bind:checked={dontShowAgain} />
        Don't show this again
      </label>
    </div>

    <div class="welcome-footer">
      <button
        class="welcome-btn"
        onclick={() => onDismiss(dontShowAgain)}
      >
        Get Started
      </button>
    </div>
  </div>
</div>
