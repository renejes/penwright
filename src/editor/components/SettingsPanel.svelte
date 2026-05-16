<script lang="ts">
  /**
   * Document Settings — the trimmed dialog after the Design-Editor
   * consolidation (Session 22). Style tokens (colors, fonts, scale, layout,
   * headings, custom Typst code) all live in the Design sidebar tab now.
   *
   * What stays here:
   *   - Language: drives Typst hyphenation and Electron spell-check
   *   - Bibliography style: passes through to `#bibliography(style: …)`
   *
   * Both are document-content concerns, not project-wide design tokens,
   * so they belong inline in `main.typ` and not in `style.typ`.
   */

  import type { DocumentSettings } from '../lib/messages';

  let {
    settings,
    onSave,
    onClose,
  }: {
    settings: DocumentSettings;
    onSave: (s: DocumentSettings) => void;
    onClose: () => void;
  } = $props();

  let local: DocumentSettings = $state({
    lang: '',
    bibliographyStyle: '',
  });
  $effect(() => {
    local = { ...settings };
  });

  const languages = [
    { value: '', label: 'Default' },
    { value: 'de', label: 'Deutsch' },
    { value: 'en', label: 'English' },
    { value: 'fr', label: 'Français' },
    { value: 'es', label: 'Español' },
    { value: 'it', label: 'Italiano' },
    { value: 'pt', label: 'Português' },
    { value: 'nl', label: 'Nederlands' },
    { value: 'pl', label: 'Polski' },
    { value: 'ru', label: 'Russian' },
    { value: 'zh', label: 'Chinese' },
    { value: 'ja', label: 'Japanese' },
    { value: 'ko', label: 'Korean' },
  ];

  const citationStyles = [
    { value: '', label: 'Default (Typst)' },
    { value: 'apa', label: 'APA' },
    { value: 'ieee', label: 'IEEE' },
    { value: 'mla', label: 'MLA' },
    { value: 'chicago-author-date', label: 'Chicago (Author-Date)' },
    { value: 'chicago-notes', label: 'Chicago (Notes)' },
    { value: 'american-physics-society', label: 'APS (Physics)' },
    { value: 'american-chemical-society', label: 'ACS (Chemistry)' },
    { value: 'association-for-computing-machinery', label: 'ACM (Computing)' },
    { value: 'springer-basic-author-date', label: 'Springer (Author-Date)' },
    { value: 'elsevier-harvard', label: 'Elsevier Harvard' },
    { value: 'cell', label: 'Cell' },
    { value: 'nature', label: 'Nature' },
    { value: 'iso-690-author-date', label: 'ISO 690' },
  ];

  function handleSave() {
    // Spread to detach from the Svelte 5 $state proxy — postMessage's
    // structured clone otherwise complains.
    onSave({ ...local });
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') onClose();
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="settings-overlay" onclick={onClose} role="presentation">
  <!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
  <div class="settings-modal" onclick={(e) => e.stopPropagation()} role="dialog" tabindex="-1">
    <div class="settings-header">
      <h2>Document Settings</h2>
      <button class="settings-close" onclick={onClose}>&times;</button>
    </div>

    <div class="settings-body">
      <p class="settings-intro">
        Typografie, Layout und Design leben jetzt im <strong>Design</strong>-Tab in der Seitenleiste.
        Hier bleibt nur, was dokumentspezifisch und nicht Teil der Design-Tokens ist.
      </p>

      <div class="settings-section">
        <h3>Language</h3>

        <label class="settings-field">
          <span>Document language</span>
          <select bind:value={local.lang}>
            {#each languages as l}
              <option value={l.value}>{l.label}</option>
            {/each}
          </select>
        </label>
      </div>

      <div class="settings-section">
        <h3>Bibliography</h3>

        <label class="settings-field">
          <span>Citation style</span>
          <select bind:value={local.bibliographyStyle}>
            {#each citationStyles as cs}
              <option value={cs.value}>{cs.label}</option>
            {/each}
          </select>
        </label>
      </div>
    </div>

    <div class="settings-footer">
      <button class="settings-btn settings-btn-secondary" onclick={onClose}>
        Cancel
      </button>
      <button class="settings-btn settings-btn-primary" onclick={handleSave}>
        Apply
      </button>
    </div>
  </div>
</div>

<style>
  .settings-intro {
    margin: 0 0 16px 0;
    padding: 10px 12px;
    background: #f9fafb;
    border-left: 3px solid #3b82f6;
    border-radius: 4px;
    font-size: 12px;
    line-height: 1.5;
    color: #4b5563;
  }
  .settings-intro strong { color: #1d4ed8; font-weight: 600; }
</style>
