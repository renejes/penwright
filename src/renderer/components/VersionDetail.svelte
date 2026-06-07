<script lang="ts">
  import { onMount } from 'svelte';
  import { t } from '@shared/i18n/store.svelte';

  interface Props {
    sha: string;
    onClose: () => void;
    onRestored: () => void;
  }

  let { sha, onClose, onRestored }: Props = $props();

  interface DiffFile {
    path: string;
    status: 'added' | 'modified' | 'deleted' | 'renamed';
    patch: string;
  }

  let files: DiffFile[] = $state([]);
  let loading = $state(true);
  let restoring = $state(false);

  const api = (window as unknown as { electronAPI: {
    invoke(channel: string, ...args: unknown[]): Promise<unknown>;
  } }).electronAPI;

  onMount(async () => {
    try {
      const result = await api.invoke('git:showVersion', sha) as { files: DiffFile[] };
      files = result.files;
    } catch (err) {
      console.error('[VersionDetail] showVersion failed:', err);
    }
    loading = false;
  });

  async function restore() {
    if (!confirm(t().version.restoreConfirm)) return;
    restoring = true;
    try {
      await api.invoke('git:restoreVersion', { sha });
      onRestored();
    } catch (err) {
      alert(t().version.restoreFailed(err instanceof Error ? err.message : String(err)));
    } finally {
      restoring = false;
    }
  }

  function statusLabel(s: DiffFile['status']): string {
    switch (s) {
      case 'added': return t().version.statusAdded;
      case 'modified': return t().version.statusModified;
      case 'deleted': return t().version.statusDeleted;
      case 'renamed': return t().version.statusRenamed;
    }
  }

  function statusColor(s: DiffFile['status']): string {
    switch (s) {
      case 'added': return '#4ec9b0';
      case 'modified': return '#e88a3a';
      case 'deleted': return '#e55';
      case 'renamed': return '#888';
    }
  }

  function lineClass(line: string): string {
    if (line.startsWith('+') && !line.startsWith('+++')) return 'add';
    if (line.startsWith('-') && !line.startsWith('---')) return 'del';
    if (line.startsWith('@@')) return 'hunk';
    return '';
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') onClose();
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div
  class="overlay"
  onclick={onClose}
  onkeydown={(e) => { if (e.key === 'Escape') onClose(); }}
  role="dialog"
  tabindex="-1"
  aria-label={t().version.title}
>
  <div class="modal" role="presentation" onclick={(e) => e.stopPropagation()}>
    <div class="modal-header">
      <div class="modal-title">{t().version.title}</div>
      <button class="close-btn" onclick={onClose} aria-label={t().common.close}>×</button>
    </div>

    {#if loading}
      <div class="modal-body loading">{t().version.loadingDiff}</div>
    {:else if files.length === 0}
      <div class="modal-body muted">{t().version.noChanges}</div>
    {:else}
      <div class="modal-body">
        {#each files as file}
          <div class="file-block">
            <div class="file-header">
              <span class="file-status" style="background: {statusColor(file.status)}">{statusLabel(file.status)}</span>
              <span class="file-path">{file.path}</span>
            </div>
            {#if file.patch}
              <pre class="diff">{#each file.patch.split('\n') as line}<span class={lineClass(line)}>{line}
</span>{/each}</pre>
            {:else}
              <div class="no-diff">{t().version.noTextChange}</div>
            {/if}
          </div>
        {/each}
      </div>
    {/if}

    <div class="modal-footer">
      <button class="secondary" onclick={onClose}>{t().common.close}</button>
      <button class="primary" onclick={restore} disabled={restoring || loading}>
        {restoring ? t().version.restoring : t().version.restore}
      </button>
    </div>
  </div>
</div>

<style>
  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .modal {
    background: #fff;
    border-radius: 12px;
    width: min(800px, 90vw);
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25);
  }

  .modal-header {
    display: flex;
    align-items: center;
    padding: 14px 16px;
    border-bottom: 1px solid #eee;
  }
  .modal-title {
    flex: 1;
    font-size: 14px;
    font-weight: 600;
    color: #222;
  }
  .close-btn {
    width: 28px;
    height: 28px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: #888;
    cursor: pointer;
    font-size: 18px;
  }
  .close-btn:hover { background: #f0f0f0; color: #444; }

  .modal-body {
    flex: 1;
    overflow-y: auto;
    padding: 12px 16px;
  }
  .modal-body.loading,
  .modal-body.muted {
    text-align: center;
    color: #aaa;
    padding: 40px 16px;
  }

  .file-block {
    margin-bottom: 16px;
    border: 1px solid #eee;
    border-radius: 8px;
    overflow: hidden;
  }

  .file-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    background: #fafafa;
    border-bottom: 1px solid #eee;
  }
  .file-status {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #fff;
    padding: 2px 6px;
    border-radius: 4px;
    font-weight: 600;
  }
  .file-path {
    font-family: 'SF Mono', monospace;
    font-size: 12px;
    color: #444;
  }

  .diff {
    margin: 0;
    padding: 8px 10px;
    font-family: 'SF Mono', monospace;
    font-size: 11.5px;
    line-height: 1.5;
    background: #fff;
    color: #333;
    overflow-x: auto;
    white-space: pre;
  }
  .diff .add { background: #e6ffed; color: #22863a; display: block; }
  .diff .del { background: #ffeef0; color: #b31d28; display: block; }
  .diff .hunk { color: #6f42c1; display: block; }

  .no-diff {
    padding: 12px;
    color: #aaa;
    font-size: 12px;
    text-align: center;
  }

  .modal-footer {
    display: flex;
    gap: 8px;
    padding: 12px 16px;
    border-top: 1px solid #eee;
    justify-content: flex-end;
  }
  .modal-footer button {
    padding: 8px 14px;
    border-radius: 6px;
    border: 1px solid transparent;
    cursor: pointer;
    font-size: 13px;
    font-family: inherit;
    font-weight: 500;
  }
  .secondary {
    background: #fff;
    border-color: #e5e5e5;
    color: #555;
  }
  .secondary:hover { background: #f5f5f5; }
  .primary {
    background: #4f7df9;
    color: #fff;
  }
  .primary:hover:not(:disabled) { background: #3d6ce8; }
  .primary:disabled { opacity: 0.5; cursor: default; }
</style>
