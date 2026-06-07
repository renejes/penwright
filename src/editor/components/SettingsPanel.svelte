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
  import { t, i18nState, setLocale } from '@shared/i18n/store.svelte';

  let {
    settings,
    onSave,
    onClose,
    previewMode = 'auto',
    onPreviewModeChange,
  }: {
    settings: DocumentSettings;
    onSave: (s: DocumentSettings) => void;
    onClose: () => void;
    previewMode?: 'auto' | 'manual';
    onPreviewModeChange?: (mode: 'auto' | 'manual') => void;
  } = $props();

  function onPreviewModeSelect(e: Event) {
    const v = (e.target as HTMLSelectElement).value === 'manual' ? 'manual' : 'auto';
    onPreviewModeChange?.(v);
  }

  let local: DocumentSettings = $state({
    lang: '',
    bibliographyStyle: '',
  });
  $effect(() => {
    local = { ...settings };
  });

  // App / interface language. Global (not part of the per-document settings) —
  // applied + persisted immediately via the i18n store.
  const uiLanguages = [
    { value: 'en', label: 'English' },
    { value: 'de', label: 'Deutsch' },
  ];
  function onUiLanguageChange(e: Event) {
    setLocale((e.target as HTMLSelectElement).value);
  }

  const languages = $derived([
    { value: '', label: t().common.default },
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
  ]);

  const citationStyles = $derived([
    { value: '', label: `${t().common.default} (Typst)` },
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
  ]);

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

<div class="settings-overlay" role="presentation" onclick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
  <div class="settings-modal" role="dialog" tabindex="-1">
    <div class="settings-header">
      <h2>{t().settings.title}</h2>
      <button class="settings-close" onclick={onClose}>&times;</button>
    </div>

    <div class="settings-body">
      <div class="settings-section">
        <h3>{t().settings.interfaceSection}</h3>

        <label class="settings-field">
          <span>{t().settings.interfaceLanguage}</span>
          <select value={i18nState.locale} onchange={onUiLanguageChange}>
            {#each uiLanguages as l}
              <option value={l.value}>{l.label}</option>
            {/each}
          </select>
        </label>
        <p class="settings-hint">{t().settings.interfaceLanguageHint}</p>
      </div>

      <!-- eslint-disable-next-line svelte/no-at-html-tags -->
      <p class="settings-intro">{@html t().settings.intro}</p>

      <div class="settings-section">
        <h3>{t().settings.languageSection}</h3>

        <label class="settings-field">
          <span>{t().settings.documentLanguage}</span>
          <select bind:value={local.lang}>
            {#each languages as l}
              <option value={l.value}>{l.label}</option>
            {/each}
          </select>
        </label>
      </div>

      <div class="settings-section">
        <h3>{t().settings.bibliographySection}</h3>

        <label class="settings-field">
          <span>{t().settings.citationStyle}</span>
          <select bind:value={local.bibliographyStyle}>
            {#each citationStyles as cs}
              <option value={cs.value}>{cs.label}</option>
            {/each}
          </select>
        </label>
      </div>

      <div class="settings-section">
        <h3>{t().settings.previewSection}</h3>

        <label class="settings-field">
          <span>{t().settings.previewModeLabel}</span>
          <select value={previewMode} onchange={onPreviewModeSelect}>
            <option value="auto">{t().settings.previewModeAuto}</option>
            <option value="manual">{t().settings.previewModeManual}</option>
          </select>
        </label>
        <p class="settings-hint">{t().settings.previewModeHint}</p>
      </div>
    </div>

    <div class="settings-footer">
      <button class="settings-btn settings-btn-secondary" onclick={onClose}>
        {t().common.cancel}
      </button>
      <button class="settings-btn settings-btn-primary" onclick={handleSave}>
        {t().common.apply}
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
  .settings-intro :global(strong) { color: #1d4ed8; font-weight: 600; }
  .settings-hint {
    margin: 6px 0 0 0;
    font-size: 11px;
    line-height: 1.4;
    color: #6b7280;
  }
</style>
