<script lang="ts">
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

  // Local copy for editing
  let local: DocumentSettings = $state({
    font: '',
    fontSize: '',
    lang: '',
    paper: '',
    margin: '',
    pageNumbering: '',
    pageHeader: '',
    pageFooter: '',
    columns: '',
    pageFill: '',
    leading: '',
    spacing: '',
    firstLineIndent: '',
    headingNumbering: '',
    bibliographyStyle: '',
  });
  $effect(() => {
    local = { ...settings };
  });

  const fonts = [
    '',
    'New Computer Modern',
    'Linux Libertine',
    'Libertinus Serif',
    'Source Sans Pro',
    'IBM Plex Sans',
    'IBM Plex Serif',
    'Fira Sans',
    'Noto Serif',
    'Noto Sans',
    'Georgia',
    'Times New Roman',
    'Arial',
    'Helvetica',
  ];

  const papers = [
    '',
    'a4',
    'a5',
    'a3',
    'us-letter',
    'us-legal',
  ];

  const languages = [
    { value: '', label: 'Default' },
    { value: 'de', label: 'Deutsch' },
    { value: 'en', label: 'English' },
    { value: 'fr', label: 'Fran\u00e7ais' },
    { value: 'es', label: 'Espa\u00f1ol' },
    { value: 'it', label: 'Italiano' },
    { value: 'pt', label: 'Portugu\u00eas' },
    { value: 'nl', label: 'Nederlands' },
    { value: 'pl', label: 'Polski' },
    { value: 'ru', label: 'Russian' },
    { value: 'zh', label: 'Chinese' },
    { value: 'ja', label: 'Japanese' },
    { value: 'ko', label: 'Korean' },
  ];

  const pageNumberingStyles = [
    { value: '', label: 'None' },
    { value: '1', label: '1, 2, 3' },
    { value: '1 / 1', label: '1 / 1 (with total)' },
    { value: '— 1 —', label: '— 1 —' },
    { value: 'i', label: 'i, ii, iii (roman)' },
    { value: 'I', label: 'I, II, III (Roman)' },
  ];

  const numberingStyles = [
    { value: '', label: 'None' },
    { value: '1.', label: '1. 2. 3.' },
    { value: '1.1', label: '1.1 1.2 2.1' },
    { value: '1.a', label: '1.a 1.b 2.a' },
    { value: 'I.', label: 'I. II. III.' },
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
    // Spread to get a plain object — Svelte 5's $state proxy
    // may not serialize correctly via postMessage's structured clone
    onSave({ ...local });
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      onClose();
    }
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
      <div class="settings-section">
        <h3>Text</h3>

        <label class="settings-field">
          <span>Font</span>
          <select bind:value={local.font}>
            {#each fonts as f}
              <option value={f}>{f || 'Default (Typst)'}</option>
            {/each}
          </select>
        </label>

        <label class="settings-field">
          <span>Font Size</span>
          <input
            type="text"
            bind:value={local.fontSize}
            placeholder="e.g. 11pt, 12pt"
          />
        </label>

        <label class="settings-field">
          <span>Language</span>
          <select bind:value={local.lang}>
            {#each languages as l}
              <option value={l.value}>{l.label}</option>
            {/each}
          </select>
        </label>
      </div>

      <div class="settings-section">
        <h3>Page</h3>

        <label class="settings-field">
          <span>Paper Size</span>
          <select bind:value={local.paper}>
            {#each papers as p}
              <option value={p}>{p || 'Default (a4)'}</option>
            {/each}
          </select>
        </label>

        <label class="settings-field">
          <span>Margins</span>
          <input
            type="text"
            bind:value={local.margin}
            placeholder="e.g. 2.5cm, 1in"
          />
        </label>

        <label class="settings-field">
          <span>Page Numbers</span>
          <select bind:value={local.pageNumbering}>
            {#each pageNumberingStyles as pn}
              <option value={pn.value}>{pn.label}</option>
            {/each}
          </select>
        </label>

        <label class="settings-field">
          <span>Header</span>
          <input
            type="text"
            bind:value={local.pageHeader}
            placeholder="e.g. My Document Title"
          />
        </label>

        <label class="settings-field">
          <span>Footer</span>
          <input
            type="text"
            bind:value={local.pageFooter}
            placeholder="e.g. Draft — Confidential"
          />
        </label>

        <label class="settings-field">
          <span>Columns</span>
          <select bind:value={local.columns}>
            <option value="">1 (default)</option>
            <option value="2">2</option>
            <option value="3">3</option>
          </select>
        </label>

        <label class="settings-field">
          <span>Page Background</span>
          <select bind:value={local.pageFill}>
            <option value="">White (default)</option>
            <option value="luma(252)">Light gray</option>
            <option value="luma(245)">Medium gray</option>
            <option value="rgb(&quot;#FFFFF0&quot;)">Ivory</option>
            <option value="rgb(&quot;#FFF8F0&quot;)">Warm cream</option>
            <option value="rgb(&quot;#F0F4FF&quot;)">Cool blue</option>
          </select>
        </label>
      </div>

      <div class="settings-section">
        <h3>Paragraph</h3>

        <label class="settings-field">
          <span>Line Spacing</span>
          <input
            type="text"
            bind:value={local.leading}
            placeholder="e.g. 0.65em, 1em"
          />
        </label>

        <label class="settings-field">
          <span>Paragraph Spacing</span>
          <input
            type="text"
            bind:value={local.spacing}
            placeholder="e.g. 1.2em"
          />
        </label>

        <label class="settings-field">
          <span>First Line Indent</span>
          <input
            type="text"
            bind:value={local.firstLineIndent}
            placeholder="e.g. 1em, 0pt"
          />
        </label>
      </div>

      <div class="settings-section">
        <h3>Headings</h3>

        <label class="settings-field">
          <span>Numbering</span>
          <select bind:value={local.headingNumbering}>
            {#each numberingStyles as n}
              <option value={n.value}>{n.label}</option>
            {/each}
          </select>
        </label>
      </div>

      <div class="settings-section">
        <h3>Bibliography</h3>

        <label class="settings-field">
          <span>Citation Style</span>
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
