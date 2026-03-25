<script lang="ts">
  import type { VsCodeApi, WebviewMessage } from '../lib/messages';

  let {
    vscode,
    onClose,
  }: {
    vscode: VsCodeApi;
    onClose: () => void;
  } = $props();

  let fontSize = $state('12pt');
  let leading = $state('0.65em');
  let lang = $state('en');

  const fontSizes = ['10pt', '11pt', '12pt', '13pt', '14pt'];
  const leadingOptions = [
    { label: 'Tight', value: '0.5em' },
    { label: 'Normal', value: '0.65em' },
    { label: 'Wide', value: '1em' },
    { label: 'Double', value: '1.4em' },
  ];
  const languages = [
    { label: 'English', value: 'en' },
    { label: 'Deutsch', value: 'de' },
    { label: 'Fran\u00E7ais', value: 'fr' },
    { label: 'Espa\u00F1ol', value: 'es' },
    { label: 'Italiano', value: 'it' },
  ];

  function apply() {
    vscode.postMessage({
      type: 'quickSettings',
      fontSize,
      leading,
      lang,
    } as unknown as WebviewMessage);
    onClose();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      onClose();
    }
  }

  function handleBackdropClick() {
    onClose();
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="quick-settings-backdrop" onclick={handleBackdropClick} role="presentation"></div>
<div class="quick-settings-dropdown">
  <div class="quick-settings-row">
    <span class="quick-settings-label">Size</span>
    <div class="quick-settings-options">
      {#each fontSizes as size}
        <button
          class="quick-settings-chip"
          class:active={fontSize === size}
          onclick={() => (fontSize = size)}
        >
          {size}
        </button>
      {/each}
    </div>
  </div>

  <div class="quick-settings-row">
    <span class="quick-settings-label">Spacing</span>
    <div class="quick-settings-options">
      {#each leadingOptions as opt}
        <button
          class="quick-settings-chip"
          class:active={leading === opt.value}
          onclick={() => (leading = opt.value)}
        >
          {opt.label}
        </button>
      {/each}
    </div>
  </div>

  <div class="quick-settings-row">
    <span class="quick-settings-label">Language</span>
    <select
      class="quick-settings-select"
      bind:value={lang}
    >
      {#each languages as l}
        <option value={l.value}>{l.label}</option>
      {/each}
    </select>
  </div>

  <div class="quick-settings-footer">
    <button class="quick-settings-apply" onclick={apply}>Apply</button>
  </div>
</div>
