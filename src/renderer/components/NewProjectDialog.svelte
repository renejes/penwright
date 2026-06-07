<script lang="ts">
  import { t } from '@shared/i18n/store.svelte';

  let {
    templates = [],
    onClose,
  }: {
    templates: Array<{ id: string; label: string; description: string }>;
    onClose: () => void;
  } = $props();

  let projectName = $state('');
  let selectedTemplate = $state('document');

  const api = (window as unknown as { electronAPI: {
    send(channel: string, data: unknown): void;
  } }).electronAPI;

  function create() {
    if (!projectName.trim()) return;
    api.send('penwright', {
      type: 'createProject',
      templateId: selectedTemplate,
      projectName: projectName.trim().replace(/\s+/g, '-').toLowerCase(),
    });
    onClose();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') create();
    if (e.key === 'Escape') onClose();
  }

  function focusOnMount(node: HTMLElement) {
    node.focus();
  }

  const templateIcons: Record<string, string> = {
    document: '&#9634;',
    thesis: '&#9883;',
    paper: '&#9998;',
    letter: '&#9993;',
    book: '&#9733;',
  };
</script>

<div class="dialog-overlay" role="presentation" onclick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
  <div class="dialog" role="dialog" aria-modal="true" aria-label={t().pickers.newProjectTitle} tabindex="-1" onkeydown={handleKeydown}>
    <div class="dialog-header">
      <h2>{t().pickers.newProjectTitle}</h2>
      <button class="close-btn" onclick={onClose} aria-label={t().common.close}>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
      </button>
    </div>

    <div class="dialog-body">
      <label class="field-label" for="np-project-name">{t().pickers.newProjectNameLabel}</label>
      <input
        id="np-project-name"
        class="field-input"
        type="text"
        bind:value={projectName}
        placeholder={t().pickers.newProjectNamePlaceholder}
        use:focusOnMount
      />

      <div class="field-label">{t().pickers.newProjectTemplateLabel}</div>
      <div class="template-grid">
        {#each templates as tmpl}
          <button
            class="template-card"
            class:selected={selectedTemplate === tmpl.id}
            onclick={() => selectedTemplate = tmpl.id}
          >
            <span class="template-icon">{@html templateIcons[tmpl.id] || '&#9634;'}</span>
            <span class="template-name">{tmpl.label}</span>
            <span class="template-desc">{tmpl.description}</span>
          </button>
        {/each}
      </div>
    </div>

    <div class="dialog-footer">
      <button class="btn-secondary" onclick={onClose}>{t().common.cancel}</button>
      <button class="btn-primary" onclick={create} disabled={!projectName.trim()}>
        {t().pickers.newProjectCreate}
      </button>
    </div>
  </div>
</div>

<style>
  .dialog-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 300;
    backdrop-filter: blur(2px);
  }

  .dialog {
    background: #fff;
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
    width: 480px;
    max-width: 90vw;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .dialog-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px 24px 12px;
  }

  .dialog-header h2 {
    font-size: 18px;
    font-weight: 600;
    color: #1a1a1a;
    margin: 0;
  }

  .close-btn {
    width: 28px;
    height: 28px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: #aaa;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .close-btn:hover { background: #f0f0f0; color: #555; }

  .dialog-body {
    padding: 8px 24px 20px;
    overflow-y: auto;
  }

  .field-label {
    display: block;
    font-size: 12px;
    font-weight: 600;
    color: #888;
    margin-bottom: 6px;
    margin-top: 16px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .field-label:first-child { margin-top: 0; }

  .field-input {
    width: 100%;
    padding: 10px 14px;
    border: 1px solid #e5e5e5;
    border-radius: 8px;
    font-size: 14px;
    font-family: inherit;
    color: #333;
    outline: none;
    transition: border-color 0.15s;
  }

  .field-input:focus { border-color: #4f7df9; }

  .template-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  .template-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 16px 12px;
    border: 2px solid #f0f0f0;
    border-radius: 10px;
    background: #fafafa;
    cursor: pointer;
    transition: all 0.15s;
    text-align: center;
  }

  .template-card:hover {
    border-color: #ddd;
    background: #f5f5f5;
  }

  .template-card.selected {
    border-color: #4f7df9;
    background: #eef4ff;
  }

  .template-icon {
    font-size: 24px;
    color: #999;
  }

  .template-card.selected .template-icon { color: #4f7df9; }

  .template-name {
    font-size: 13px;
    font-weight: 600;
    color: #333;
  }

  .template-desc {
    font-size: 11px;
    color: #999;
    line-height: 1.3;
  }

  .dialog-footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding: 16px 24px;
    border-top: 1px solid #f0f0f0;
  }

  .btn-secondary {
    padding: 8px 18px;
    border: 1px solid #e5e5e5;
    border-radius: 8px;
    background: #fff;
    color: #666;
    font-size: 13px;
    font-family: inherit;
    font-weight: 500;
    cursor: pointer;
  }

  .btn-secondary:hover { background: #f8f8f8; }

  .btn-primary {
    padding: 8px 20px;
    border: none;
    border-radius: 8px;
    background: #4f7df9;
    color: #fff;
    font-size: 13px;
    font-family: inherit;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s;
  }

  .btn-primary:hover { background: #3d6ce8; }
  .btn-primary:disabled { opacity: 0.4; cursor: default; }
</style>
