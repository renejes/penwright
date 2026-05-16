<script lang="ts">
  import type { DocumentSettings } from '../lib/messages';
  import {
    type ProjectStyle,
    DEFAULT_PROJECT_STYLE,
    COLOR_SLOTS,
    cloneProjectStyle,
  } from '../../shared/styleTypes';

  let {
    settings,
    style = null,
    onSave,
    onSaveStyle,
    onClose,
  }: {
    settings: DocumentSettings;
    style?: ProjectStyle | null;
    onSave: (s: DocumentSettings) => void;
    onSaveStyle?: (s: ProjectStyle) => void;
    onClose: () => void;
  } = $props();

  type Tab = 'style' | 'document';
  let activeTab: Tab = $state('style');

  // ─── Local copies for editing ────────────────────────
  // Spread into plain objects so Svelte 5's $state proxy doesn't trip
  // structured-clone when we hand them back via onSave.

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

  let localStyle: ProjectStyle = $state(cloneProjectStyle(DEFAULT_PROJECT_STYLE));
  $effect(() => {
    localStyle = cloneProjectStyle(style ?? DEFAULT_PROJECT_STYLE);
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

  // Same list but without the empty-string entry — Style fields always pick a font.
  const styleFonts = fonts.filter(f => f !== '');
  const styleMonoFonts = [
    'DejaVu Sans Mono',
    'JetBrains Mono',
    'Fira Code',
    'Source Code Pro',
    'IBM Plex Mono',
    'Inconsolata',
    'Menlo',
    'Consolas',
    'Courier New',
  ];

  const papers = [
    '',
    'a4',
    'a5',
    'a3',
    'us-letter',
    'us-legal',
  ];

  const stylePapers = papers.filter(p => p !== '');

  const headingWeights = [
    { value: 'regular',   label: 'Regular' },
    { value: 'medium',    label: 'Medium' },
    { value: 'semibold',  label: 'Semi-Bold' },
    { value: 'bold',      label: 'Bold' },
    { value: 'extrabold', label: 'Extra Bold' },
  ];

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
    // Style is project-scoped and goes via its own IPC; the document settings
    // (which still edit the open .typ file directly) go via onSave.
    if (onSaveStyle) onSaveStyle(cloneProjectStyle(localStyle));
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

    <div class="settings-tabs" role="tablist">
      <button
        type="button"
        class="settings-tab"
        class:active={activeTab === 'style'}
        role="tab"
        aria-selected={activeTab === 'style'}
        onclick={() => (activeTab = 'style')}
      >Style</button>
      <button
        type="button"
        class="settings-tab"
        class:active={activeTab === 'document'}
        role="tab"
        aria-selected={activeTab === 'document'}
        onclick={() => (activeTab = 'document')}
      >Document</button>
    </div>

    <div class="settings-body">
      {#if activeTab === 'style'}
        <div class="settings-section">
          <h3>Colors</h3>
          <p class="settings-hint">Five semantic slots used across the document. Reference them from anywhere in your Typst code as <code>style-colors.primary</code> etc.</p>

          {#each COLOR_SLOTS as slot}
            <label class="settings-field">
              <span>{slot[0].toUpperCase() + slot.slice(1)}</span>
              <span class="settings-color-row">
                <input
                  type="color"
                  bind:value={localStyle.colors[slot]}
                  aria-label={`${slot} color picker`}
                />
                <input
                  type="text"
                  bind:value={localStyle.colors[slot]}
                  placeholder="#000000"
                  pattern="#[0-9a-fA-F]{'{3,6}'}"
                  spellcheck="false"
                />
              </span>
            </label>
          {/each}
        </div>

        <div class="settings-section">
          <h3>Fonts</h3>

          <label class="settings-field">
            <span>Body</span>
            <select bind:value={localStyle.fonts.body}>
              {#each styleFonts as f}
                <option value={f}>{f}</option>
              {/each}
            </select>
          </label>

          <label class="settings-field">
            <span>Heading</span>
            <select bind:value={localStyle.fonts.heading}>
              {#each styleFonts as f}
                <option value={f}>{f}</option>
              {/each}
            </select>
          </label>

          <label class="settings-field">
            <span>Code</span>
            <select bind:value={localStyle.fonts.code}>
              {#each styleMonoFonts as f}
                <option value={f}>{f}</option>
              {/each}
            </select>
          </label>
        </div>

        <div class="settings-section">
          <h3>Scale</h3>

          <label class="settings-field">
            <span>Base size</span>
            <input
              type="text"
              bind:value={localStyle.scale.base}
              placeholder="11pt"
              spellcheck="false"
            />
          </label>

          <label class="settings-field">
            <span>Leading</span>
            <input
              type="text"
              bind:value={localStyle.scale.leading}
              placeholder="0.65em"
              spellcheck="false"
            />
          </label>
        </div>

        <div class="settings-section">
          <h3>Layout</h3>

          <label class="settings-field">
            <span>Paper</span>
            <select bind:value={localStyle.layout.paper}>
              {#each stylePapers as p}
                <option value={p}>{p}</option>
              {/each}
            </select>
          </label>

          <label class="settings-field">
            <span>Margin</span>
            <input
              type="text"
              bind:value={localStyle.layout.margin}
              placeholder="2.5cm"
              spellcheck="false"
            />
          </label>

          <label class="settings-field">
            <span>Columns</span>
            <select bind:value={localStyle.layout.columns}>
              <option value={1}>1</option>
              <option value={2}>2</option>
              <option value={3}>3</option>
            </select>
          </label>
        </div>

        <div class="settings-section">
          <h3>Headings</h3>

          {#each ['h1', 'h2'] as level (level)}
            <div class="settings-subgroup">
              <div class="settings-subgroup-label">{level.toUpperCase()}</div>

              <label class="settings-field">
                <span>Size</span>
                <input
                  type="text"
                  bind:value={localStyle.headings[level as 'h1' | 'h2'].size}
                  placeholder="24pt"
                  spellcheck="false"
                />
              </label>

              <label class="settings-field">
                <span>Weight</span>
                <select bind:value={localStyle.headings[level as 'h1' | 'h2'].weight}>
                  {#each headingWeights as w}
                    <option value={w.value}>{w.label}</option>
                  {/each}
                </select>
              </label>

              <label class="settings-field">
                <span>Color</span>
                <select bind:value={localStyle.headings[level as 'h1' | 'h2'].color}>
                  {#each COLOR_SLOTS as slot}
                    <option value={slot}>{slot}</option>
                  {/each}
                </select>
              </label>

              <label class="settings-field">
                <span>Space above</span>
                <input
                  type="text"
                  bind:value={localStyle.headings[level as 'h1' | 'h2'].marginTop}
                  placeholder="2em"
                  spellcheck="false"
                />
              </label>
            </div>
          {/each}
        </div>
      {:else}
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
      {/if}
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
  .settings-tabs {
    display: flex;
    gap: 0;
    border-bottom: 1px solid var(--vscode-editorWidget-border, rgba(255, 255, 255, 0.08));
    padding: 0 24px;
    background: var(--vscode-editorWidget-background, transparent);
    flex-shrink: 0;
  }

  .settings-tab {
    appearance: none;
    background: transparent;
    border: none;
    color: var(--vscode-foreground, inherit);
    opacity: 0.65;
    padding: 10px 14px;
    cursor: pointer;
    font-size: 13px;
    font-weight: 500;
    border-bottom: 2px solid transparent;
    margin-bottom: -1px;
    transition: opacity 0.12s ease, border-color 0.12s ease;
  }

  .settings-tab:hover {
    opacity: 0.9;
  }

  .settings-tab.active {
    opacity: 1;
    border-bottom-color: var(--vscode-focusBorder, #3b82f6);
  }

  .settings-hint {
    margin: -4px 0 12px 0;
    font-size: 12px;
    opacity: 0.65;
    line-height: 1.4;
  }

  .settings-hint code {
    font-size: 11px;
    background: var(--vscode-textCodeBlock-background, rgba(255, 255, 255, 0.06));
    padding: 1px 4px;
    border-radius: 3px;
  }

  .settings-color-row {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
  }

  .settings-color-row input[type="color"] {
    width: 36px;
    height: 28px;
    padding: 0;
    border: 1px solid var(--vscode-input-border, rgba(255, 255, 255, 0.1));
    border-radius: 3px;
    cursor: pointer;
    background: transparent;
    flex-shrink: 0;
  }

  .settings-color-row input[type="text"] {
    flex: 1 1 auto;
    min-width: 0;
    font-family: var(--vscode-editor-font-family, ui-monospace, monospace);
    font-size: 12px;
  }

  .settings-subgroup {
    border-left: 2px solid var(--vscode-editorWidget-border, rgba(255, 255, 255, 0.06));
    padding-left: 12px;
    margin-bottom: 14px;
  }

  .settings-subgroup-label {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    opacity: 0.7;
    margin-bottom: 6px;
  }
</style>
