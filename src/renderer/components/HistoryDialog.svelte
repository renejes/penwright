<script lang="ts">
  /**
   * History & Restore — the single hub for everything you can get back.
   * Three clearly-labelled sections, each with a one-line purpose:
   *   1. Versions      — named checkpoints you save (Git).            → VersionDetail diff/restore
   *   2. Auto-backups  — automatic timed multi-file snapshots.        → restore + settings
   *   3. AI changes    — undo the most recent AI edits to this file.  → "undo last" (stack)
   *
   * The mechanics are unchanged; this only unifies their presentation so the
   * user has one mental model ("everything restorable lives here"). Restoring a
   * version or backup calls onRestored (the parent closes + refreshes); undoing
   * an AI edit stays in place so the user can step back several times.
   */
  import { onMount, onDestroy } from 'svelte';
  import { t } from '@shared/i18n/store.svelte';
  import VersionDetail from './VersionDetail.svelte';

  interface Props {
    onClose: () => void;
    onRestored: () => void;
  }
  let { onClose, onRestored }: Props = $props();

  interface Version { sha: string; message: string; date: string; author: string; isAuto: boolean; }
  interface BackupSnapshot { timestamp: string; timestampMs: number; fileCount: number; totalBytes: number; }
  interface AiSnap { timestamp: number; filePath: string; bytes: number; }
  interface BackupConfig { intervalSec: number; maxCount: number; maxAiSnapshots: number; }

  let versions = $state<Version[]>([]);
  let backups = $state<BackupSnapshot[]>([]);
  let aiSnaps = $state<AiSnap[]>([]);
  let config = $state<BackupConfig>({ intervalSec: 30, maxCount: 30, maxAiSnapshots: 20 });

  let loading = $state(true);
  let applying = $state(false);
  let undoingAi = $state(false);
  let showSettings = $state(false);
  let activeVersionSha = $state<string | null>(null);
  let now = $state(Date.now());

  const api = (window as unknown as { electronAPI: {
    invoke(channel: string, ...args: unknown[]): Promise<unknown>;
  } }).electronAPI;

  let tick: ReturnType<typeof setInterval> | null = null;

  onMount(async () => {
    await refreshAll();
    tick = setInterval(() => { now = Date.now(); }, 1000);
  });
  onDestroy(() => { if (tick) clearInterval(tick); });

  async function refreshAll() {
    await Promise.all([refreshVersions(), refreshBackups(), refreshAi(), loadConfig()]);
    loading = false;
  }
  async function refreshVersions() { try { versions = await api.invoke('git:listVersions') as Version[]; } catch { versions = []; } }
  async function refreshBackups() { try { backups = await api.invoke('project:listBackups') as BackupSnapshot[]; } catch { backups = []; } }
  async function refreshAi() { try { aiSnaps = await api.invoke('ai:list') as AiSnap[]; } catch { aiSnaps = []; } }
  async function loadConfig() { try { config = await api.invoke('project:getBackupConfig') as BackupConfig; } catch {} }
  async function saveConfig() { try { config = await api.invoke('project:setBackupConfig', $state.snapshot(config)) as BackupConfig; } catch {} }

  async function restoreBackup(snap: BackupSnapshot) {
    const ok = confirm(t().backup.applyConfirm(formatDate(snap.timestampMs)));
    if (!ok) return;
    applying = true;
    try {
      const r = await api.invoke('project:applyBackup', snap.timestamp) as { ok: boolean };
      if (r.ok) onRestored();
      else alert(t().backup.applyFailed);
    } catch (e) {
      alert(t().backup.applyError(e instanceof Error ? e.message : String(e)));
    } finally {
      applying = false;
    }
  }

  async function undoLastAi() {
    if (undoingAi) return;
    undoingAi = true;
    try {
      await api.invoke('ai:undoLast');
      await refreshAi();
    } catch {} finally {
      undoingAi = false;
    }
  }

  async function openBackupFolder() { await api.invoke('project:openBackupFolder'); }

  function relativeTime(date: string | number): string {
    const ms = typeof date === 'string' ? new Date(date).getTime() : date;
    const diff = now - ms;
    if (diff < 0) return t().project.justNow;
    if (diff < 60000) return t().project.secondsAgo(Math.floor(diff / 1000));
    if (diff < 3600000) return t().project.minutesAgo(Math.floor(diff / 60000));
    if (diff < 86400000) return t().project.hoursAgo(Math.floor(diff / 3600000));
    return new Date(ms).toLocaleDateString();
  }
  function formatDate(ms: number): string { return new Date(ms).toLocaleString(); }
  /** Which file an AI edit touched — the list now spans the whole project. */
  function fileLabel(p: string): string { return p.split(/[\\/]/).pop() ?? p; }
  function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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

  function handleKeydown(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="overlay" role="presentation" onclick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
  <div class="modal" role="dialog" aria-modal="true" aria-label={t().history.title} tabindex="-1">
    <div class="modal-header">
      <div class="modal-title">{t().history.title}</div>
      <button class="close-btn" onclick={onClose} aria-label={t().common.close}>×</button>
    </div>
    <p class="modal-intro">{t().history.intro}</p>

    <div class="modal-body">
      {#if loading}
        <div class="muted">…</div>
      {:else}
        <!-- 1. Versions -->
        <section class="hsec">
          <div class="hsec-head">
            <span class="hsec-title">{t().history.versionsTitle}</span>
            <button class="icon-btn" onclick={refreshVersions} title={t().project.refresh} aria-label={t().project.refreshHistoryAria}>↻</button>
          </div>
          <div class="hsec-desc">{t().history.versionsDesc}</div>
          {#if versions.length === 0}
            <div class="hsec-empty">{t().history.versionsEmpty}</div>
          {:else}
            <ul class="rows">
              {#each versions as v (v.sha)}
                <li>
                  <button class="row row-btn" class:auto={v.isAuto} onclick={() => activeVersionSha = v.sha}>
                    <div class="row-main">{v.message.replace(/^\[auto\]\s*/, '')}</div>
                    <div class="row-meta">
                      <span>{relativeTime(v.date)}</span>
                      {#if v.isAuto}<span class="tag">{t().project.autoTag}</span>{/if}
                    </div>
                  </button>
                </li>
              {/each}
            </ul>
          {/if}
        </section>

        <!-- 2. Auto-backups -->
        <section class="hsec">
          <div class="hsec-head">
            <span class="hsec-title">{t().history.backupsTitle}</span>
            <button class="icon-btn" onclick={() => showSettings = !showSettings} title={t().backup.settingsButton} aria-label={t().backup.settingsAria}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="2.5" stroke="currentColor" stroke-width="1.3"/>
                <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.5 1.5M11.5 11.5L13 13M3 13l1.5-1.5M11.5 4.5L13 3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
              </svg>
            </button>
          </div>
          <div class="hsec-desc">{t().history.backupsDesc}</div>
          {#if showSettings}
            <div class="settings-block">
              <label class="setting-row">
                <span>{t().backup.intervalLabel}</span>
                <select bind:value={config.intervalSec} onchange={saveConfig}>
                  {#each intervalChoices as choice}<option value={choice.value}>{choice.label}</option>{/each}
                </select>
              </label>
              <label class="setting-row">
                <span>{t().backup.maxCountLabel}</span>
                <select bind:value={config.maxCount} onchange={saveConfig}>
                  {#each maxCountChoices as choice}<option value={choice.value}>{choice.label}</option>{/each}
                </select>
              </label>
              <label class="setting-row">
                <span>{t().backup.maxAiSnapshotsLabel}</span>
                <input type="number" min="1" max="200" bind:value={config.maxAiSnapshots} onchange={saveConfig} />
              </label>
              <div class="settings-note">
                {t().backup.settingsNotePrefix}<code>.penwright/backups/</code>{t().backup.settingsNoteSuffix}
              </div>
            </div>
          {/if}
          {#if backups.length === 0}
            <div class="hsec-empty">{t().history.backupsEmpty}</div>
          {:else}
            <ul class="rows">
              {#each backups as b (b.timestamp)}
                <li class="row">
                  <div class="row-info">
                    <div class="row-main">{formatDate(b.timestampMs)}</div>
                    <div class="row-meta">{t().backup.fileCount(b.fileCount)} · {formatSize(b.totalBytes)} · {relativeTime(b.timestampMs)}</div>
                  </div>
                  <button class="restore-btn" onclick={() => restoreBackup(b)} disabled={applying}>{t().history.restore}</button>
                </li>
              {/each}
            </ul>
          {/if}
        </section>

        <!-- 3. AI changes -->
        <section class="hsec">
          <div class="hsec-head">
            <span class="hsec-title">{t().history.aiTitle}</span>
            {#if aiSnaps.length > 0}
              <button class="undo-btn" onclick={undoLastAi} disabled={undoingAi}>↩ {t().history.aiUndoLast}</button>
            {/if}
          </div>
          <div class="hsec-desc">{t().history.aiDesc}</div>
          {#if aiSnaps.length === 0}
            <div class="hsec-empty">{t().history.aiEmpty}</div>
          {:else}
            <ul class="rows">
              {#each aiSnaps as s, i (s.timestamp)}
                <li class="row">
                  <div class="row-info">
                    <div class="row-main" class:dim={i > 0}>{fileLabel(s.filePath)}</div>
                    <div class="row-meta">{t().history.aiEntryTitle} · {relativeTime(s.timestamp)}</div>
                  </div>
                </li>
              {/each}
            </ul>
          {/if}
        </section>
      {/if}
    </div>

    <div class="modal-footer">
      <button class="secondary" onclick={openBackupFolder}>{t().common.openInFinder}</button>
      <span class="spacer"></span>
      <button class="secondary" onclick={onClose}>{t().common.close}</button>
    </div>
  </div>
</div>

{#if activeVersionSha}
  <VersionDetail
    sha={activeVersionSha}
    onClose={() => activeVersionSha = null}
    onRestored={() => { activeVersionSha = null; onRestored(); }}
  />
{/if}

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
    width: min(580px, 92vw);
    max-height: 84vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25);
  }
  .modal-header {
    display: flex;
    align-items: center;
    padding: 14px 16px 10px;
  }
  .modal-title {
    flex: 1;
    font-size: 14px;
    font-weight: 600;
    color: #222;
  }
  .modal-intro {
    margin: 0;
    padding: 0 16px 12px;
    font-size: 12px;
    color: #999;
    line-height: 1.45;
    border-bottom: 1px solid #eee;
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
    padding: 4px 16px 8px;
  }
  .muted { color: #aaa; text-align: center; padding: 32px 16px; font-size: 13px; }

  .hsec {
    padding: 14px 0 10px;
    border-bottom: 1px solid #f2f2f2;
  }
  .hsec:last-child { border-bottom: none; }
  .hsec-head {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .hsec-title {
    flex: 1;
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #555;
  }
  .hsec-desc {
    font-size: 11.5px;
    color: #aaa;
    margin: 2px 0 8px;
    line-height: 1.4;
  }
  .hsec-empty {
    font-size: 12px;
    color: #bbb;
    padding: 6px 2px 4px;
  }

  .rows { list-style: none; margin: 0; padding: 0; }

  .row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 4px;
    border-bottom: 1px solid #f7f7f7;
  }
  .row:last-child { border-bottom: none; }

  .row-btn {
    width: 100%;
    text-align: left;
    border: none;
    background: none;
    cursor: pointer;
    font-family: inherit;
    border-radius: 6px;
  }
  .row-btn:hover { background: rgba(79, 125, 249, 0.06); }
  .row-btn.auto { opacity: 0.6; }

  .row-info { flex: 1; min-width: 0; }
  .row-main {
    font-size: 13px;
    color: #333;
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .row-main.dim { color: #999; font-weight: 400; }
  .row-meta {
    display: flex;
    gap: 6px;
    align-items: center;
    margin-top: 2px;
    font-size: 11px;
    color: #999;
  }
  .tag {
    background: #f0f0f0;
    color: #888;
    padding: 0 6px;
    border-radius: 8px;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.4px;
  }

  .restore-btn, .undo-btn {
    flex-shrink: 0;
    padding: 5px 12px;
    border: 1px solid #4f7df9;
    border-radius: 6px;
    background: #fff;
    color: #4f7df9;
    cursor: pointer;
    font-size: 12px;
    font-family: inherit;
    font-weight: 500;
  }
  .restore-btn:hover:not(:disabled), .undo-btn:hover:not(:disabled) { background: #4f7df9; color: #fff; }
  .restore-btn:disabled, .undo-btn:disabled { opacity: 0.4; cursor: default; }

  .icon-btn {
    width: 24px;
    height: 24px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: #aaa;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
  }
  .icon-btn:hover { background: #f0f0f0; color: #555; }

  .settings-block {
    padding: 10px 12px;
    background: #fafafa;
    border: 1px solid #eee;
    border-radius: 8px;
    margin-bottom: 10px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .setting-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    font-size: 12px;
    color: #444;
  }
  .setting-row select, .setting-row input[type="number"] {
    padding: 4px 8px;
    border: 1px solid #e0e0e0;
    border-radius: 4px;
    background: #fff;
    font-size: 12px;
    font-family: inherit;
    min-width: 200px;
  }
  .setting-row input[type="number"] { min-width: 80px; }
  .settings-note { font-size: 11px; color: #999; }
  .settings-note code { background: #f0f0f0; padding: 1px 4px; border-radius: 3px; font-size: 11px; }

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
