<script lang="ts">
  import { onMount } from 'svelte';

  let {
    filePath = '',
    onClose,
  }: {
    filePath: string;
    onClose: () => void;
  } = $props();

  let content = $state('');
  let originalContent = $state('');
  let isDirty = $state(false);
  let saving = $state(false);
  let fileName = $derived(filePath.split('/').pop() || '');
  let fileExt = $derived(fileName.split('.').pop()?.toLowerCase() || '');
  let textareaEl: HTMLTextAreaElement;

  const api = (window as unknown as { electronAPI: {
    invoke(channel: string, ...args: unknown[]): Promise<unknown>;
  } }).electronAPI;

  onMount(() => {
    loadFile();
  });

  $effect(() => {
    if (filePath) loadFile();
  });

  async function loadFile() {
    if (!filePath) return;
    try {
      const text = await api.invoke('textfile:read', filePath) as string;
      content = text;
      originalContent = text;
      isDirty = false;
    } catch (e) {
      content = `Error loading file: ${e}`;
    }
  }

  function onInput() {
    isDirty = content !== originalContent;
  }

  async function save() {
    if (!isDirty || !filePath) return;
    saving = true;
    try {
      await api.invoke('textfile:write', filePath, content);
      originalContent = content;
      isDirty = false;
    } catch (e) {
      console.error('[vswrite] Failed to save:', e);
    }
    saving = false;
  }

  function handleKeydown(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault();
      save();
    }
  }

  // Tab key inserts spaces instead of changing focus
  function handleTab(e: KeyboardEvent) {
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = textareaEl.selectionStart;
      const end = textareaEl.selectionEnd;
      content = content.substring(0, start) + '  ' + content.substring(end);
      requestAnimationFrame(() => {
        textareaEl.selectionStart = textareaEl.selectionEnd = start + 2;
      });
    }
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="text-viewer" onkeydown={handleKeydown}>
  <div class="viewer-header">
    <div class="header-left">
      <span class="file-badge">{fileExt}</span>
      <span class="file-title">{fileName}</span>
      {#if isDirty}
        <span class="dirty-dot"></span>
      {/if}
    </div>
    <div class="header-right">
      {#if isDirty}
        <button class="save-btn" onclick={save} disabled={saving}>
          {saving ? 'Saving...' : 'Save'}
        </button>
      {/if}
      <button class="close-btn" onclick={onClose} title="Close">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
      </button>
    </div>
  </div>
  <textarea
    class="viewer-content"
    bind:this={textareaEl}
    bind:value={content}
    oninput={onInput}
    onkeydown={handleTab}
    spellcheck="false"
    autocomplete="off"
    autocorrect="off"
  ></textarea>
</div>

<style>
  .text-viewer {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: #ffffff;
  }

  .viewer-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 14px;
    border-bottom: 1px solid #f0f0f0;
    flex-shrink: 0;
    background: #fafafa;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }

  .file-badge {
    padding: 2px 8px;
    border-radius: 4px;
    background: #f0f0f0;
    color: #888;
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    flex-shrink: 0;
  }

  .file-title {
    font-size: 13px;
    font-weight: 500;
    color: #333;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .dirty-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #e88a3a;
    flex-shrink: 0;
  }

  .save-btn {
    padding: 4px 14px;
    border: none;
    border-radius: 6px;
    background: #4f7df9;
    color: #fff;
    font-size: 12px;
    font-family: inherit;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s;
  }

  .save-btn:hover {
    background: #3d6ce8;
  }

  .save-btn:disabled {
    opacity: 0.6;
    cursor: default;
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
    transition: all 0.15s;
  }

  .close-btn:hover {
    background: #f0f0f0;
    color: #555;
  }

  .viewer-content {
    flex: 1;
    width: 100%;
    padding: 16px 20px;
    border: none;
    outline: none;
    resize: none;
    font-family: 'SF Mono', 'Fira Code', 'Consolas', 'Menlo', monospace;
    font-size: 13px;
    line-height: 1.6;
    color: #333;
    background: #ffffff;
    tab-size: 2;
  }

  .viewer-content::placeholder {
    color: #ccc;
  }
</style>
