<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { t } from '@shared/i18n/store.svelte';
  import HistoryDialog from './HistoryDialog.svelte';

  interface ChangedFile {
    path: string;
    status: string;
    staged: boolean;
    selected: boolean;
  }

  interface ProjectInfo {
    projectDir: string | null;
    currentFilePath: string | null;
    projectName: string | null;
  }

  let projectInfo: ProjectInfo = $state({ projectDir: null, currentFilePath: null, projectName: null });
  let isRepo = $state(false);
  let changedFiles: ChangedFile[] = $state([]);

  let versionMessage = $state('');
  let saving = $state(false);
  let loading = $state(true);

  let showHistory = $state(false);
  let advancedOpen = $state(false);

  let cloudRemote = $state('');
  let cloudBusy = $state(false);

  const api = (window as unknown as { electronAPI: {
    invoke(channel: string, ...args: unknown[]): Promise<unknown>;
    on(channel: string, callback: (data: unknown) => void): void;
  } }).electronAPI;

  let pollTimer: ReturnType<typeof setInterval> | null = null;

  onMount(async () => {
    await refreshAll();

    api.on('penwright', (data: unknown) => {
      const msg = data as { type: string };
      if (msg.type === 'filetreeChanged' || msg.type === 'saveStatus' || msg.type === 'currentFile') {
        refreshAll();
      }
    });

    pollTimer = setInterval(() => refreshStatus(), 8000);
  });

  onDestroy(() => {
    if (pollTimer) clearInterval(pollTimer);
  });

  async function refreshAll() {
    await Promise.all([
      refreshInfo(),
      refreshStatus(),
    ]);
    loading = false;
  }

  async function refreshInfo() {
    try {
      projectInfo = await api.invoke('project:getInfo') as ProjectInfo;
    } catch {}
  }

  async function refreshStatus() {
    try {
      const s = await api.invoke('git:status') as { isRepo: boolean; files: Array<{ path: string; status: string; staged: boolean }> };
      isRepo = s.isRepo;
      // Merge with previous selection state — newly appearing files default to checked
      const prevSelected = new Map(changedFiles.map(f => [f.path, f.selected]));
      const merged = new Map<string, ChangedFile>();
      for (const f of s.files) {
        const existing = merged.get(f.path);
        if (existing) {
          if (f.staged) existing.staged = true;
        } else {
          merged.set(f.path, {
            path: f.path,
            status: f.status,
            staged: f.staged,
            selected: prevSelected.get(f.path) ?? true,
          });
        }
      }
      changedFiles = Array.from(merged.values()).sort((a, b) => a.path.localeCompare(b.path));
    } catch {
      isRepo = false;
      changedFiles = [];
    }
  }

  async function saveVersion() {
    if (!versionMessage.trim() || changedFiles.length === 0) return;
    const selected = changedFiles.filter(f => f.selected).map(f => f.path);
    if (selected.length === 0) return;

    saving = true;
    try {
      // Ensure repo exists (idempotent — first save in a brand-new project triggers init)
      await api.invoke('git:ensureRepo');
      const result = await api.invoke('git:saveVersion', {
        message: versionMessage.trim(),
        files: selected,
      }) as { sha: string | null; skipped: boolean };

      if (result.sha) {
        versionMessage = '';
        await refreshStatus();
      }
    } catch (err) {
      console.error('[ProjectPanel] saveVersion failed:', err);
      alert(t().project.saveFailed(err instanceof Error ? err.message : String(err)));
    } finally {
      saving = false;
    }
  }

  async function showInFinder() {
    await api.invoke('project:showInFinder');
  }

  async function openBackupFolder() {
    await api.invoke('project:openBackupFolder');
  }

  function toggleAll(selected: boolean) {
    changedFiles = changedFiles.map(f => ({ ...f, selected }));
  }

  function statusLabel(s: string): string {
    switch (s) {
      case 'M': return t().project.statusModified;
      case 'A': return t().project.statusAdded;
      case 'D': return t().project.statusDeleted;
      case '?': return t().project.statusNew;
      case 'R': return t().project.statusRenamed;
      default: return s;
    }
  }

  function statusColor(s: string): string {
    switch (s) {
      case 'M': return '#e88a3a';
      case 'A': return '#4ec9b0';
      case 'D': return '#e55';
      case '?': return '#888';
      default: return '#888';
    }
  }

  async function openAdvanced() {
    advancedOpen = !advancedOpen;
    if (advancedOpen) {
      try {
        cloudRemote = (await api.invoke('git:getRemote')) as string;
      } catch {}
    }
  }

  async function setCloudRemote() {
    if (!cloudRemote.trim()) return;
    cloudBusy = true;
    try {
      await api.invoke('git:setRemote', cloudRemote.trim());
    } catch (err) {
      alert(t().project.cloudUrlFailed(err instanceof Error ? err.message : String(err)));
    } finally {
      cloudBusy = false;
    }
  }

  async function cloudPush() {
    cloudBusy = true;
    try { await api.invoke('git:push'); } catch (err) { alert(t().project.cloudPushFailed(err instanceof Error ? err.message : String(err))); }
    cloudBusy = false;
  }

  async function cloudPull() {
    const confirmed = confirm(t().project.cloudPullConfirm);
    if (!confirmed) return;
    cloudBusy = true;
    try { await api.invoke('git:pull'); await refreshAll(); } catch (err) { alert(t().project.cloudPullFailed(err instanceof Error ? err.message : String(err))); }
    cloudBusy = false;
  }

  const selectedCount = $derived(changedFiles.filter(f => f.selected).length);
  const canSave = $derived(versionMessage.trim().length > 0 && selectedCount > 0 && !saving);
</script>

<div class="project-panel">
  <!-- 1. Header -->
  <div class="header">
    <div class="header-row">
      <div class="project-name" title={projectInfo.projectDir ?? ''}>
        {projectInfo.projectName ?? t().project.noProjectName}
      </div>
      {#if projectInfo.projectDir}
        <button class="icon-btn" onclick={showInFinder} title={t().project.showInFinder} aria-label={t().project.showInFinder}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M2 4h4l1 1.5h7v7H2V4z" stroke="currentColor" stroke-width="1.2" fill="none"/>
          </svg>
        </button>
      {/if}
    </div>
    {#if projectInfo.projectDir}
      <div class="project-path" title={projectInfo.projectDir}>{projectInfo.projectDir}</div>
    {/if}
  </div>

  {#if !projectInfo.projectDir}
    <div class="empty-state">
      <p>{t().project.emptyStateTitle}</p>
      <p class="muted">{t().project.emptyStateHint}</p>
    </div>
  {:else}
    <!-- 2. "Version speichern" -->
    <div class="save-card">
      <input
        class="save-input"
        type="text"
        bind:value={versionMessage}
        placeholder={t().project.saveInputPlaceholder}
        onkeydown={(e) => { if (e.key === 'Enter' && canSave) saveVersion(); }}
      />
      <button
        class="save-btn"
        onclick={saveVersion}
        disabled={!canSave}
        title={selectedCount === 0 ? t().project.saveDisabledNoSelection : t().project.saveDisabledTitle}
      >
        {saving ? t().project.saving : t().project.saveVersion}
      </button>
    </div>

    <!-- 3. Changes since last version (scrolls if long) -->
    <div class="scroll-area">
    {#if changedFiles.length > 0}
      <div class="section">
        <div class="section-header">
          <span class="section-title">{t().project.changesTitle}</span>
          <div class="section-actions">
            <button class="link-btn" onclick={() => toggleAll(true)} title={t().project.selectAllTitle}>{t().project.selectAll}</button>
            <button class="link-btn" onclick={() => toggleAll(false)} title={t().project.selectNoneTitle}>{t().project.selectNone}</button>
          </div>
        </div>
        <ul class="file-list">
          {#each changedFiles as file (file.path)}
            <li class="file-row">
              <label class="file-label">
                <input type="checkbox" bind:checked={file.selected} />
                <span class="file-status" style="color: {statusColor(file.status)}" title={statusLabel(file.status)}>{file.status}</span>
                <span class="file-path">{file.path}</span>
              </label>
            </li>
          {/each}
        </ul>
      </div>
    {:else if isRepo}
      <div class="muted-block">{t().project.noChanges}</div>
    {:else}
      <div class="muted-block">
        {t().project.firstVersionHint}
      </div>
    {/if}
    </div>

    <!-- 4. History & Restore hub — versions + auto-backups + AI changes in one place -->
    <button class="history-btn" onclick={() => showHistory = true}>
      <span class="history-icon">↺</span>
      <span class="history-label">{t().history.openButton}</span>
      <span class="history-chevron">›</span>
    </button>

    <!-- 5. Advanced (collapsed) -->
    <div class="advanced">
      <button class="advanced-toggle" onclick={openAdvanced} aria-expanded={advancedOpen}>
        <span class="chevron">{advancedOpen ? '▾' : '▸'}</span>
        {t().project.advanced}
      </button>
      {#if advancedOpen}
        <div class="advanced-body">
          <label class="field">
            <span class="field-label">{t().project.cloudUrlLabel}</span>
            <input
              class="field-input"
              type="text"
              bind:value={cloudRemote}
              placeholder={t().project.cloudUrlPlaceholder}
              onblur={setCloudRemote}
            />
          </label>
          <div class="advanced-actions">
            <button onclick={cloudPush} disabled={cloudBusy || !cloudRemote.trim()}>
              {t().project.cloudPush}
            </button>
            <button onclick={cloudPull} disabled={cloudBusy || !cloudRemote.trim()}>
              {t().project.cloudPull}
            </button>
            <button onclick={openBackupFolder}>{t().project.openBackupFolder}</button>
          </div>
        </div>
      {/if}
    </div>
  {/if}
</div>

{#if showHistory}
  <HistoryDialog
    onClose={() => showHistory = false}
    onRestored={() => { showHistory = false; refreshAll(); }}
  />
{/if}

<style>
  .project-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    font-size: 13px;
    color: #444;
    overflow: hidden;
  }

  .header {
    flex-shrink: 0;
    padding: 10px 12px 8px;
    border-bottom: 1px solid #f0f0f0;
  }

  .header-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .project-name {
    flex: 1;
    font-weight: 600;
    color: #222;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .project-path {
    font-size: 11px;
    color: #aaa;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-top: 2px;
  }

  .empty-state {
    padding: 32px 16px;
    text-align: center;
    color: #888;
  }
  .empty-state .muted { font-size: 12px; color: #bbb; }

  .save-card {
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 10px 12px;
    border-bottom: 1px solid #f0f0f0;
  }

  .save-input {
    padding: 8px 10px;
    border: 1px solid #e5e5e5;
    border-radius: 6px;
    font-size: 13px;
    font-family: inherit;
    outline: none;
    background: #fff;
    color: #222;
  }
  .save-input:focus { border-color: #4f7df9; }

  .save-btn {
    padding: 8px 14px;
    border: none;
    border-radius: 6px;
    background: #4f7df9;
    color: #fff;
    font-size: 13px;
    font-family: inherit;
    font-weight: 600;
    cursor: pointer;
  }
  .save-btn:hover:not(:disabled) { background: #3d6ce8; }
  .save-btn:disabled { opacity: 0.4; cursor: default; background: #ccc; }

  .section {
    flex-shrink: 0;
    padding: 8px 0 4px;
    border-bottom: 1px solid #f5f5f5;
  }

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 12px 6px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #aaa;
  }
  .section-title { flex: 1; }
  .section-actions { display: flex; gap: 8px; }

  .link-btn {
    border: none;
    background: none;
    color: #4f7df9;
    cursor: pointer;
    font-size: 11px;
    font-weight: 600;
    font-family: inherit;
    padding: 0;
  }
  .link-btn:hover { text-decoration: underline; }

  .file-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .file-row { padding: 0; }
  .file-label {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 12px;
    cursor: pointer;
    font-size: 12px;
  }
  .file-label:hover { background: rgba(0, 0, 0, 0.02); }
  .file-label input { margin: 0; cursor: pointer; }

  .file-status {
    flex-shrink: 0;
    width: 14px;
    font-weight: 700;
    font-family: 'SF Mono', monospace;
    font-size: 11px;
  }
  .file-path {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: #555;
  }

  .muted-block {
    padding: 16px 12px;
    color: #bbb;
    font-size: 12px;
    text-align: center;
  }

  .advanced {
    flex-shrink: 0;
    border-top: 1px solid #f0f0f0;
  }
  .advanced-toggle {
    width: 100%;
    text-align: left;
    border: none;
    background: none;
    padding: 8px 12px;
    color: #888;
    font-size: 11px;
    font-family: inherit;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    cursor: pointer;
  }
  .advanced-toggle:hover { color: #555; }
  .chevron { display: inline-block; width: 12px; }

  .advanced-body {
    padding: 4px 12px 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .field { display: flex; flex-direction: column; gap: 4px; }
  .field-label { font-size: 11px; color: #888; }
  .field-input {
    padding: 6px 8px;
    border: 1px solid #e5e5e5;
    border-radius: 4px;
    font-size: 12px;
    font-family: inherit;
    outline: none;
    background: #fff;
    color: #333;
  }
  .field-input:focus { border-color: #4f7df9; }

  .advanced-actions {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .advanced-actions button {
    padding: 6px 10px;
    border: 1px solid #e5e5e5;
    border-radius: 4px;
    background: #fff;
    color: #555;
    font-size: 12px;
    font-family: inherit;
    cursor: pointer;
    text-align: left;
  }
  .advanced-actions button:hover:not(:disabled) { background: #f5f5f5; }
  .advanced-actions button:disabled { opacity: 0.4; cursor: default; }

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
  }
  .icon-btn:hover { background: #f0f0f0; color: #555; }

  .history-btn {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 8px;
    width: calc(100% - 24px);
    margin: 10px 12px 0;
    padding: 10px 12px;
    border: 1px solid #e5e5e5;
    border-radius: 8px;
    background: #fff;
    color: #444;
    font-size: 13px;
    font-family: inherit;
    cursor: pointer;
  }
  .history-btn:hover { background: #f7f9ff; border-color: #cdd9ff; color: #2c4fb0; }
  .history-icon { font-size: 15px; line-height: 1; color: #4f7df9; }
  .history-label { flex: 1; text-align: left; font-weight: 500; }
  .history-chevron { color: #bbb; font-size: 16px; }
  .scroll-area { flex: 1; min-height: 0; overflow-y: auto; }
</style>
