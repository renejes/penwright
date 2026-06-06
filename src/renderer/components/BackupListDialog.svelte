<script lang="ts">
  import { onMount } from 'svelte';
  import { t } from '@shared/i18n/store.svelte';

  interface Props {
    onClose: () => void;
    onApplied: () => void;
  }

  let { onClose, onApplied }: Props = $props();

  interface BackupSnapshot {
    timestamp: string;
    timestampMs: number;
    fileCount: number;
    totalBytes: number;
  }

  let backups: BackupSnapshot[] = $state([]);
  let loading = $state(true);
  let applying = $state(false);
  let showSettings = $state(false);

  interface BackupConfig { intervalSec: number; maxCount: number; maxAiSnapshots: number; }
  let config: BackupConfig = $state({ intervalSec: 30, maxCount: 30, maxAiSnapshots: 20 });

  const api = (window as unknown as { electronAPI: {
    invoke(channel: string, ...args: unknown[]): Promise<unknown>;
  } }).electronAPI;

  onMount(async () => {
    await Promise.all([refresh(), loadConfig()]);
  });

  async function refresh() {
    loading = true;
    try {
      backups = await api.invoke('project:listBackups') as BackupSnapshot[];
    } catch {
      backups = [];
    }
    loading = false;
  }

  async function loadConfig() {
    try {
      config = await api.invoke('project:getBackupConfig') as BackupConfig;
    } catch {}
  }

  async function saveConfig() {
    try {
      config = await api.invoke('project:setBackupConfig', $state.snapshot(config)) as BackupConfig;
    } catch (err) {
      console.error('[BackupListDialog] saveConfig failed:', err);
    }
  }

  const intervalChoices = $derived([
    { value: 10, label: t().backup.intervalEvery10Sec },
    { value: 30, label: t().backup.intervalEvery30Sec },
    { value: 60, label: t().backup.intervalEveryMinute },
    { value: 300, label: t().backup.intervalEvery5Min },
  ]);

  const maxCountChoices = $derived([
    { value: 10, label: t().backup.maxCountOption(10) },
    { value: 30, label: t().backup.maxCountOption(30) },
    { value: 100, label: t().backup.maxCountOption(100) },
    { value: 1000, label: t().backup.maxCountUnlimited },
  ]);

  async function apply(snap: BackupSnapshot) {
    const confirmed = confirm(t().backup.applyConfirm(formatDate(snap.timestampMs)));
    if (!confirmed) return;
    applying = true;
    try {
      const result = await api.invoke('project:applyBackup', snap.timestamp) as { ok: boolean; restored: number };
      if (result.ok) {
        onApplied();
      } else {
        alert(t().backup.applyFailed);
      }
    } catch (err) {
      alert(t().backup.applyError(err instanceof Error ? err.message : String(err)));
    } finally {
      applying = false;
    }
  }

  async function openFolder() {
    await api.invoke('project:openBackupFolder');
  }

  function formatDate(ms: number): string {
    return new Date(ms).toLocaleString();
  }

  function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
  aria-label={t().backup.title}
>
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="modal" onclick={(e) => e.stopPropagation()}>
    <div class="modal-header">
      <div class="modal-title">{t().backup.title}</div>
      <button
        class="settings-btn"
        onclick={() => showSettings = !showSettings}
        aria-label={t().backup.settingsAria}
        title={t().backup.settingsButton}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="2.5" stroke="currentColor" stroke-width="1.3"/>
          <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.5 1.5M11.5 11.5L13 13M3 13l1.5-1.5M11.5 4.5L13 3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
        </svg>
      </button>
      <button class="close-btn" onclick={onClose} aria-label={t().common.close}>×</button>
    </div>

    {#if showSettings}
      <div class="settings-block">
        <div class="settings-title">{t().backup.settingsTitle}</div>
        <label class="setting-row">
          <span>{t().backup.intervalLabel}</span>
          <select bind:value={config.intervalSec} onchange={saveConfig}>
            {#each intervalChoices as choice}
              <option value={choice.value}>{choice.label}</option>
            {/each}
          </select>
        </label>
        <label class="setting-row">
          <span>{t().backup.maxCountLabel}</span>
          <select bind:value={config.maxCount} onchange={saveConfig}>
            {#each maxCountChoices as choice}
              <option value={choice.value}>{choice.label}</option>
            {/each}
          </select>
        </label>
        <label class="setting-row">
          <span>{t().backup.maxAiSnapshotsLabel}</span>
          <input
            type="number"
            min="1"
            max="200"
            bind:value={config.maxAiSnapshots}
            onchange={saveConfig}
          />
        </label>
        <div class="settings-note">
          {t().backup.settingsNotePrefix}<code>.penwright/backups/</code>{t().backup.settingsNoteSuffix}
        </div>
      </div>
    {/if}

    <div class="modal-body">
      {#if loading}
        <div class="muted">{t().backup.loading}</div>
      {:else if backups.length === 0}
        <div class="muted">
          {t().backup.emptyLine1}<br/>
          {t().backup.emptyLine2}
        </div>
      {:else}
        <div class="hint">
          {t().backup.hint}
        </div>
        <ul class="backup-list">
          {#each backups as snap}
            <li class="backup-row">
              <div class="backup-info">
                <div class="backup-date">{formatDate(snap.timestampMs)}</div>
                <div class="backup-meta">{t().backup.fileCount(snap.fileCount)} · {formatSize(snap.totalBytes)}</div>
              </div>
              <button class="apply-btn" onclick={() => apply(snap)} disabled={applying}>{t().backup.loadButton}</button>
            </li>
          {/each}
        </ul>
      {/if}
    </div>

    <div class="modal-footer">
      <button class="secondary" onclick={openFolder}>{t().common.openInFinder}</button>
      <span class="spacer"></span>
      <button class="secondary" onclick={onClose}>{t().common.close}</button>
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
    width: min(560px, 90vw);
    max-height: 80vh;
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

  .settings-btn {
    width: 28px;
    height: 28px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: #888;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-right: 4px;
  }
  .settings-btn:hover { background: #f0f0f0; color: #444; }

  .settings-block {
    padding: 12px 16px;
    background: #fafafa;
    border-bottom: 1px solid #eee;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .settings-title {
    font-size: 11px;
    color: #888;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    font-weight: 600;
    margin-bottom: 2px;
  }
  .setting-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    font-size: 12px;
    color: #444;
  }
  .setting-row select,
  .setting-row input[type="number"] {
    padding: 4px 8px;
    border: 1px solid #e0e0e0;
    border-radius: 4px;
    background: #fff;
    font-size: 12px;
    font-family: inherit;
    min-width: 200px;
  }
  .setting-row input[type="number"] { min-width: 80px; }
  .settings-note {
    font-size: 11px;
    color: #999;
    margin-top: 4px;
  }
  .settings-note code {
    background: #f0f0f0;
    padding: 1px 4px;
    border-radius: 3px;
    font-size: 11px;
  }

  .modal-body {
    flex: 1;
    overflow-y: auto;
    padding: 12px 16px;
  }

  .muted {
    color: #aaa;
    text-align: center;
    padding: 32px 16px;
    font-size: 13px;
    line-height: 1.5;
  }

  .hint {
    background: #f8faff;
    border: 1px solid #e5edff;
    color: #4f7df9;
    padding: 8px 12px;
    border-radius: 6px;
    font-size: 12px;
    margin-bottom: 12px;
  }

  .backup-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .backup-row {
    display: flex;
    align-items: center;
    padding: 10px 4px;
    border-bottom: 1px solid #f5f5f5;
    gap: 12px;
  }
  .backup-row:last-child { border-bottom: none; }

  .backup-info { flex: 1; }
  .backup-date {
    font-size: 13px;
    color: #333;
    font-weight: 500;
  }
  .backup-meta {
    font-size: 11px;
    color: #999;
    margin-top: 2px;
  }

  .apply-btn {
    padding: 6px 14px;
    border: 1px solid #4f7df9;
    border-radius: 6px;
    background: #fff;
    color: #4f7df9;
    cursor: pointer;
    font-size: 12px;
    font-family: inherit;
    font-weight: 500;
    flex-shrink: 0;
  }
  .apply-btn:hover:not(:disabled) { background: #4f7df9; color: #fff; }
  .apply-btn:disabled { opacity: 0.4; cursor: default; }

  .modal-footer {
    display: flex;
    gap: 8px;
    align-items: center;
    padding: 12px 16px;
    border-top: 1px solid #eee;
  }
  .spacer { flex: 1; }
  .modal-footer button {
    padding: 8px 14px;
    border-radius: 6px;
    border: 1px solid #e5e5e5;
    background: #fff;
    color: #555;
    cursor: pointer;
    font-size: 13px;
    font-family: inherit;
  }
  .modal-footer button:hover { background: #f5f5f5; }
</style>
