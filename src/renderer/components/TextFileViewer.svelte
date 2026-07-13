<script lang="ts">
  import CodeEditor from './CodeEditor.svelte';
  import { t } from '@shared/i18n/store.svelte';

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

  const api = (window as unknown as { electronAPI: {
    invoke(channel: string, ...args: unknown[]): Promise<unknown>;
  } }).electronAPI;

  // The component instance is REUSED across text tabs (mounted un-keyed with a
  // derived active-tab path), so a tab switch arrives as a filePath change.
  // The old unconditional reload silently discarded unsaved edits — flush the
  // previous file first. `loadSeq` drops reads superseded by a faster switch.
  let loadedPath = '';
  let loadSeq = 0;

  $effect(() => {
    if (filePath && filePath !== loadedPath) {
      void switchTo(filePath);
    }
  });

  async function switchTo(nextPath: string) {
    const prevPath = loadedPath;
    loadedPath = nextPath;
    if (isDirty && prevPath) {
      try {
        await api.invoke('textfile:write', prevPath, content);
      } catch (e) {
        console.error('[penwright] Failed to flush-save before tab switch:', e);
      }
    }
    await loadFile(nextPath);
  }

  async function loadFile(p: string) {
    const seq = ++loadSeq;
    try {
      const text = await api.invoke('textfile:read', p) as string;
      if (seq !== loadSeq) return;
      content = text;
      originalContent = text;
      isDirty = false;
    } catch (e) {
      if (seq === loadSeq) content = t().pickers.textLoadError(String(e));
    }
  }

  function handleChange(newContent: string) {
    content = newContent;
    isDirty = content !== originalContent;
  }

  async function save() {
    if (!isDirty || !loadedPath) return;
    saving = true;
    try {
      await api.invoke('textfile:write', loadedPath, content);
      originalContent = content;
      isDirty = false;
    } catch (e) {
      console.error('[penwright] Failed to save:', e);
    }
    saving = false;
  }

  function handleKeydown(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault();
      save();
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
          {saving ? t().pickers.textSaving : t().common.save}
        </button>
      {/if}
      <button class="close-btn" onclick={onClose} title={t().common.close}>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
      </button>
    </div>
  </div>
  <CodeEditor
    {content}
    {fileExt}
    onChange={handleChange}
  />
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

</style>
