<script lang="ts">
  import { onMount } from 'svelte';

  interface GitFile {
    path: string;
    status: string; // 'M' modified, 'A' added, '?' untracked, 'D' deleted
    staged: boolean;
  }

  interface GitStatus {
    branch: string;
    ahead: number;
    behind: number;
    files: GitFile[];
    isRepo: boolean;
  }

  let status: GitStatus = $state({ branch: '', ahead: 0, behind: 0, files: [], isRepo: false });
  let commitMessage = $state('');
  let loading = $state(true);
  let pushing = $state(false);
  let committing = $state(false);

  const api = (window as unknown as { electronAPI: {
    invoke(channel: string, ...args: unknown[]): Promise<unknown>;
    on(channel: string, callback: (data: unknown) => void): void;
  } }).electronAPI;

  onMount(() => {
    refresh();
    // Refresh on file changes
    api.on('vswrite', (data: unknown) => {
      const msg = data as { type: string };
      if (msg.type === 'filetreeChanged' || msg.type === 'saveStatus') {
        refresh();
      }
    });
  });

  async function refresh() {
    loading = true;
    try {
      status = await api.invoke('git:status') as GitStatus;
    } catch {
      status = { branch: '', ahead: 0, behind: 0, files: [], isRepo: false };
    }
    loading = false;
  }

  async function stageFile(filePath: string) {
    await api.invoke('git:stage', filePath);
    refresh();
  }

  async function unstageFile(filePath: string) {
    await api.invoke('git:unstage', filePath);
    refresh();
  }

  async function stageAll() {
    await api.invoke('git:stageAll');
    refresh();
  }

  async function commit() {
    if (!commitMessage.trim()) return;
    committing = true;
    try {
      await api.invoke('git:commit', commitMessage.trim());
      commitMessage = '';
      refresh();
    } catch (e) {
      console.error('Commit failed:', e);
    }
    committing = false;
  }

  async function push() {
    pushing = true;
    try {
      await api.invoke('git:push');
      refresh();
    } catch (e) {
      console.error('Push failed:', e);
    }
    pushing = false;
  }

  async function pull() {
    try {
      await api.invoke('git:pull');
      refresh();
    } catch (e) {
      console.error('Pull failed:', e);
    }
  }

  async function initRepo() {
    await api.invoke('git:init');
    refresh();
  }

  function statusLabel(s: string): string {
    switch (s) {
      case 'M': return 'modified';
      case 'A': return 'added';
      case 'D': return 'deleted';
      case '?': return 'untracked';
      case 'R': return 'renamed';
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

  $effect(() => {
    // Auto-refresh periodically
    const interval = setInterval(refresh, 10000);
    return () => clearInterval(interval);
  });
</script>

<div class="git-panel">
  {#if loading && !status.isRepo}
    <div class="git-empty">Loading...</div>
  {:else if !status.isRepo}
    <div class="git-empty">
      <p>Not a Git repository</p>
      <button class="init-btn" onclick={initRepo}>Initialize Git</button>
    </div>
  {:else}
    <!-- Branch info -->
    <div class="git-branch">
      <span class="branch-icon">&#9095;</span>
      <span class="branch-name">{status.branch || 'HEAD'}</span>
      {#if status.ahead > 0}
        <span class="branch-badge ahead">↑{status.ahead}</span>
      {/if}
      {#if status.behind > 0}
        <span class="branch-badge behind">↓{status.behind}</span>
      {/if}
      <div class="branch-actions">
        <button class="icon-btn" onclick={pull} title="Pull">↓</button>
        <button class="icon-btn" onclick={push} disabled={pushing} title="Push">↑</button>
        <button class="icon-btn" onclick={refresh} title="Refresh">↻</button>
      </div>
    </div>

    <!-- Staged files -->
    {#if status.files.some(f => f.staged)}
      <div class="section-label">Staged</div>
      <ul class="file-list">
        {#each status.files.filter(f => f.staged) as file}
          <li class="git-file">
            <span class="file-status" style="color: {statusColor(file.status)}">{file.status}</span>
            <span class="file-path">{file.path}</span>
            <button class="unstage-btn" onclick={() => unstageFile(file.path)} title="Unstage">−</button>
          </li>
        {/each}
      </ul>
    {/if}

    <!-- Unstaged / untracked files -->
    {#if status.files.some(f => !f.staged)}
      <div class="section-label">
        Changes
        <button class="stage-all-btn" onclick={stageAll} title="Stage all">+All</button>
      </div>
      <ul class="file-list">
        {#each status.files.filter(f => !f.staged) as file}
          <li class="git-file">
            <span class="file-status" style="color: {statusColor(file.status)}">{file.status}</span>
            <span class="file-path">{file.path}</span>
            <button class="stage-btn" onclick={() => stageFile(file.path)} title="Stage">+</button>
          </li>
        {/each}
      </ul>
    {/if}

    {#if status.files.length === 0}
      <div class="git-clean">No changes</div>
    {/if}

    <!-- Commit -->
    <div class="commit-area">
      <input
        class="commit-input"
        type="text"
        bind:value={commitMessage}
        placeholder="Commit message..."
        onkeydown={(e) => { if (e.key === 'Enter') commit(); }}
      />
      <button
        class="commit-btn"
        onclick={commit}
        disabled={!commitMessage.trim() || !status.files.some(f => f.staged) || committing}
      >
        {committing ? '...' : 'Commit'}
      </button>
    </div>
  {/if}
</div>

<style>
  .git-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    font-size: 13px;
    color: #555;
  }

  .git-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: #bbb;
    gap: 12px;
  }

  .init-btn {
    padding: 6px 20px;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    background: #fff;
    color: #666;
    cursor: pointer;
    font-size: 12px;
    font-family: inherit;
  }

  .init-btn:hover { background: #f8f8f8; }

  .git-branch {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    border-bottom: 1px solid #f0f0f0;
    flex-shrink: 0;
  }

  .branch-icon { color: #4f7df9; font-size: 14px; }
  .branch-name { font-weight: 600; color: #333; flex: 1; }

  .branch-badge {
    font-size: 10px;
    padding: 1px 5px;
    border-radius: 8px;
    font-weight: 600;
  }

  .branch-badge.ahead { background: #eef4ff; color: #4f7df9; }
  .branch-badge.behind { background: #fff5ee; color: #e88a3a; }

  .branch-actions {
    display: flex;
    gap: 2px;
  }

  .icon-btn {
    width: 24px;
    height: 24px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: #aaa;
    cursor: pointer;
    font-size: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .icon-btn:hover { background: #f0f0f0; color: #555; }
  .icon-btn:disabled { opacity: 0.4; cursor: default; }

  .section-label {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px 4px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #aaa;
  }

  .stage-all-btn {
    border: none;
    background: none;
    color: #4f7df9;
    cursor: pointer;
    font-size: 11px;
    font-weight: 600;
    font-family: inherit;
  }

  .stage-all-btn:hover { text-decoration: underline; }

  .file-list {
    list-style: none;
    margin: 0;
    padding: 0;
    overflow-y: auto;
  }

  .git-file {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 3px 12px;
    font-size: 12px;
  }

  .git-file:hover { background: rgba(0, 0, 0, 0.02); }

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

  .stage-btn, .unstage-btn {
    width: 20px;
    height: 20px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: #aaa;
    cursor: pointer;
    font-size: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transition: opacity 0.1s;
  }

  .git-file:hover .stage-btn,
  .git-file:hover .unstage-btn {
    opacity: 1;
  }

  .stage-btn:hover { color: #4ec9b0; }
  .unstage-btn:hover { color: #e55; }

  .git-clean {
    padding: 24px 12px;
    text-align: center;
    color: #ccc;
    font-size: 13px;
  }

  .commit-area {
    display: flex;
    gap: 6px;
    padding: 8px;
    border-top: 1px solid #f0f0f0;
    flex-shrink: 0;
    margin-top: auto;
  }

  .commit-input {
    flex: 1;
    padding: 6px 10px;
    border: 1px solid #e5e5e5;
    border-radius: 6px;
    font-size: 12px;
    font-family: inherit;
    outline: none;
    background: #fff;
    color: #333;
  }

  .commit-input:focus { border-color: #4f7df9; }

  .commit-btn {
    padding: 6px 14px;
    border: none;
    border-radius: 6px;
    background: #4f7df9;
    color: #fff;
    font-size: 12px;
    font-family: inherit;
    font-weight: 500;
    cursor: pointer;
    flex-shrink: 0;
  }

  .commit-btn:hover { background: #3d6ce8; }
  .commit-btn:disabled { opacity: 0.4; cursor: default; }
</style>
