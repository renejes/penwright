<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import VersionDetail from './VersionDetail.svelte';
  import BackupListDialog from './BackupListDialog.svelte';

  interface ChangedFile {
    path: string;
    status: string;
    staged: boolean;
    selected: boolean;
  }

  interface Version {
    sha: string;
    message: string;
    date: string;
    author: string;
    isAuto: boolean;
  }

  interface BackupSnapshot {
    timestamp: string;
    timestampMs: number;
    fileCount: number;
    totalBytes: number;
  }

  interface ProjectInfo {
    projectDir: string | null;
    currentFilePath: string | null;
    projectName: string | null;
  }

  let projectInfo: ProjectInfo = $state({ projectDir: null, currentFilePath: null, projectName: null });
  let isRepo = $state(false);
  let changedFiles: ChangedFile[] = $state([]);
  let versions: Version[] = $state([]);
  let lastBackup: BackupSnapshot | null = $state(null);
  let backupTickNow = $state(Date.now());

  let versionMessage = $state('');
  let saving = $state(false);
  let loading = $state(true);

  let activeVersionSha: string | null = $state(null);
  let showBackupDialog = $state(false);
  let advancedOpen = $state(false);

  let cloudRemote = $state('');
  let cloudBusy = $state(false);

  const api = (window as unknown as { electronAPI: {
    invoke(channel: string, ...args: unknown[]): Promise<unknown>;
    on(channel: string, callback: (data: unknown) => void): void;
  } }).electronAPI;

  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let backupTickTimer: ReturnType<typeof setInterval> | null = null;

  onMount(async () => {
    await refreshAll();

    api.on('vswrite', (data: unknown) => {
      const msg = data as { type: string };
      if (msg.type === 'filetreeChanged' || msg.type === 'saveStatus' || msg.type === 'currentFile') {
        refreshAll();
      } else if (msg.type === 'backupCreated') {
        refreshBackups();
      }
    });

    pollTimer = setInterval(() => refreshStatus(), 8000);
    backupTickTimer = setInterval(() => { backupTickNow = Date.now(); }, 1000);
  });

  onDestroy(() => {
    if (pollTimer) clearInterval(pollTimer);
    if (backupTickTimer) clearInterval(backupTickTimer);
  });

  async function refreshAll() {
    await Promise.all([
      refreshInfo(),
      refreshStatus(),
      refreshVersions(),
      refreshBackups(),
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

  async function refreshVersions() {
    try {
      versions = await api.invoke('git:listVersions') as Version[];
    } catch {
      versions = [];
    }
  }

  async function refreshBackups() {
    try {
      const list = await api.invoke('project:listBackups') as BackupSnapshot[];
      lastBackup = list[0] ?? null;
    } catch {
      lastBackup = null;
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
        await Promise.all([refreshStatus(), refreshVersions()]);
      }
    } catch (err) {
      console.error('[ProjectPanel] saveVersion failed:', err);
      alert('Speichern fehlgeschlagen: ' + (err instanceof Error ? err.message : String(err)));
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
      case 'M': return 'geändert';
      case 'A': return 'hinzugefügt';
      case 'D': return 'gelöscht';
      case '?': return 'neu';
      case 'R': return 'umbenannt';
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

  function relativeTime(date: string | number): string {
    const ms = typeof date === 'string' ? new Date(date).getTime() : date;
    const diff = backupTickNow - ms;
    if (diff < 0) return 'gerade eben';
    if (diff < 60000) return `vor ${Math.floor(diff / 1000)} s`;
    if (diff < 3600000) return `vor ${Math.floor(diff / 60000)} min`;
    if (diff < 86400000) return `vor ${Math.floor(diff / 3600000)} h`;
    return new Date(ms).toLocaleDateString();
  }

  function formatDate(date: string): string {
    return new Date(date).toLocaleString();
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
      alert('Cloud-URL konnte nicht gesetzt werden: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      cloudBusy = false;
    }
  }

  async function cloudPush() {
    cloudBusy = true;
    try { await api.invoke('git:push'); } catch (err) { alert('Mit Cloud synchronisieren fehlgeschlagen: ' + (err instanceof Error ? err.message : String(err))); }
    cloudBusy = false;
  }

  async function cloudPull() {
    const confirmed = confirm(
      'Cloud-Backup wird mit dem aktuellen Stand zusammengeführt. Lokale Änderungen können dabei überschrieben werden.\n\n' +
      'Tipp: Speichere vorher den aktuellen Stand als eigene Version, falls du nichts verlieren willst.\n\n' +
      'Fortfahren?',
    );
    if (!confirmed) return;
    cloudBusy = true;
    try { await api.invoke('git:pull'); await refreshAll(); } catch (err) { alert('Cloud-Backup konnte nicht geladen werden: ' + (err instanceof Error ? err.message : String(err))); }
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
        {projectInfo.projectName ?? 'Kein Projekt geöffnet'}
      </div>
      {#if projectInfo.projectDir}
        <button class="icon-btn" onclick={showInFinder} title="Im Finder zeigen" aria-label="Im Finder zeigen">
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
      <p>Kein Projekt geöffnet.</p>
      <p class="muted">Öffne oder erstelle ein Projekt, um Versionen anzulegen.</p>
    </div>
  {:else}
    <!-- 2. "Version speichern" -->
    <div class="save-card">
      <input
        class="save-input"
        type="text"
        bind:value={versionMessage}
        placeholder="Was hast du gerade fertig?"
        onkeydown={(e) => { if (e.key === 'Enter' && canSave) saveVersion(); }}
      />
      <button
        class="save-btn"
        onclick={saveVersion}
        disabled={!canSave}
        title={selectedCount === 0 ? 'Keine Änderungen ausgewählt' : 'Version speichern'}
      >
        {saving ? '...' : 'Version speichern'}
      </button>
    </div>

    <!-- 3. Changes since last version -->
    {#if changedFiles.length > 0}
      <div class="section">
        <div class="section-header">
          <span class="section-title">Änderungen seit letzter Version</span>
          <div class="section-actions">
            <button class="link-btn" onclick={() => toggleAll(true)} title="Alle anhaken">alle</button>
            <button class="link-btn" onclick={() => toggleAll(false)} title="Alle abhaken">keine</button>
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
      <div class="muted-block">Keine Änderungen seit der letzten Version.</div>
    {:else}
      <div class="muted-block">
        Bei der ersten Version wird automatisch ein Verlauf für dieses Projekt angelegt.
      </div>
    {/if}

    <!-- 4. History -->
    <div class="section history-section">
      <div class="section-header">
        <span class="section-title">Verlauf</span>
        <button class="icon-btn small" onclick={refreshVersions} title="Aktualisieren" aria-label="Verlauf aktualisieren">↻</button>
      </div>
      {#if versions.length === 0}
        <div class="muted-block tight">Noch keine Versionen.</div>
      {:else}
        <ul class="version-list">
          {#each versions as v (v.sha)}
            <li>
              <button class="version-row" class:auto={v.isAuto} onclick={() => activeVersionSha = v.sha}>
                <div class="version-message">{v.message.replace(/^\[auto\]\s*/, '')}</div>
                <div class="version-meta">
                  <span class="version-date">{relativeTime(v.date)}</span>
                  {#if v.isAuto}<span class="version-tag">auto</span>{/if}
                </div>
              </button>
            </li>
          {/each}
        </ul>
      {/if}
    </div>

    <!-- 5. Auto-Backup status -->
    <button class="backup-status" onclick={() => showBackupDialog = true} title="Auto-Backups anzeigen">
      <span class="backup-dot"></span>
      <span>
        {#if lastBackup}
          Letztes Auto-Backup {relativeTime(lastBackup.timestampMs)}
        {:else}
          Noch kein Auto-Backup
        {/if}
      </span>
    </button>

    <!-- 6. Advanced (collapsed) -->
    <div class="advanced">
      <button class="advanced-toggle" onclick={openAdvanced} aria-expanded={advancedOpen}>
        <span class="chevron">{advancedOpen ? '▾' : '▸'}</span>
        Erweitert
      </button>
      {#if advancedOpen}
        <div class="advanced-body">
          <label class="field">
            <span class="field-label">Cloud-Backup-URL (optional)</span>
            <input
              class="field-input"
              type="text"
              bind:value={cloudRemote}
              placeholder="https://github.com/user/projekt.git"
              onblur={setCloudRemote}
            />
          </label>
          <div class="advanced-actions">
            <button onclick={cloudPush} disabled={cloudBusy || !cloudRemote.trim()}>
              ↑ Mit Cloud synchronisieren
            </button>
            <button onclick={cloudPull} disabled={cloudBusy || !cloudRemote.trim()}>
              ↓ Cloud-Backup laden
            </button>
            <button onclick={openBackupFolder}>Backup-Ordner öffnen</button>
          </div>
        </div>
      {/if}
    </div>
  {/if}
</div>

{#if activeVersionSha}
  <VersionDetail
    sha={activeVersionSha}
    onClose={() => activeVersionSha = null}
    onRestored={() => { activeVersionSha = null; refreshAll(); }}
  />
{/if}

{#if showBackupDialog}
  <BackupListDialog
    onClose={() => showBackupDialog = false}
    onApplied={() => { showBackupDialog = false; refreshAll(); }}
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
  .history-section {
    flex: 1;
    min-height: 80px;
    overflow-y: auto;
    border-bottom: none;
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

  .file-list, .version-list {
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
  .muted-block.tight { padding: 10px 12px; }

  .version-row {
    width: 100%;
    text-align: left;
    border: none;
    background: none;
    padding: 6px 12px;
    cursor: pointer;
    border-bottom: 1px solid #f8f8f8;
    font-family: inherit;
  }
  .version-row:hover { background: rgba(79, 125, 249, 0.06); }
  .version-row.auto { opacity: 0.6; }

  .version-message {
    font-size: 12px;
    color: #333;
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .version-meta {
    display: flex;
    gap: 6px;
    align-items: center;
    margin-top: 2px;
    font-size: 11px;
    color: #999;
  }
  .version-tag {
    background: #f0f0f0;
    color: #888;
    padding: 0 6px;
    border-radius: 8px;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.4px;
  }

  .backup-status {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    border: none;
    border-top: 1px solid #f0f0f0;
    background: #fafafa;
    color: #888;
    font-size: 11px;
    font-family: inherit;
    cursor: pointer;
    text-align: left;
  }
  .backup-status:hover { background: #f5f5f5; color: #555; }
  .backup-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #4ec9b0;
    flex-shrink: 0;
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
  .icon-btn.small { width: 20px; height: 20px; font-size: 12px; }
</style>
