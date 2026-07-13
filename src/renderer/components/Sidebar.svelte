<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { t } from '@shared/i18n/store.svelte';

  let {
    onFileOpen,
    onContextMenu,
    currentFile = '',
  }: {
    onFileOpen: (path: string) => void;
    onContextMenu?: (e: MouseEvent, path: string) => void;
    currentFile: string;
  } = $props();

  interface FileEntry {
    name: string;
    path: string;
    isDir: boolean;
    children?: FileEntry[];
  }

  let tree: FileEntry[] = $state([]);
  let expandedDirs: Set<string> = $state(new Set());
  let projectDir = $state('');
  let hasParent = $state(false);
  let loading = $state(true);

  const api = (window as unknown as { electronAPI: {
    invoke(channel: string, ...args: unknown[]): Promise<unknown>;
    on(channel: string, callback: (data: unknown) => void): () => void;
  } }).electronAPI;

  // Sidebar tab panels unmount on every tab switch — the IPC subscription
  // must be released or each visit stacks another permanent listener.
  let unsubscribe: (() => void) | null = null;

  onMount(() => {
    loadTree();
    unsubscribe = api.on('penwright', (data: unknown) => {
      const msg = data as { type: string };
      if (msg.type === 'filetreeChanged') {
        loadTree();
      }
    });
  });

  onDestroy(() => {
    unsubscribe?.();
  });

  async function loadTree() {
    loading = true;
    try {
      const result = await api.invoke('filetree:list') as { dir: string; entries: FileEntry[]; hasParent: boolean };
      projectDir = result.dir;
      tree = result.entries;
      hasParent = result.hasParent;
    } catch (e) {
      console.error('[penwright] Failed to load file tree:', e);
      tree = [];
    }
    loading = false;
  }

  function toggleDir(path: string) {
    const next = new Set(expandedDirs);
    if (next.has(path)) next.delete(path);
    else next.add(path);
    expandedDirs = next;
  }

  function handleClick(entry: FileEntry) {
    if (entry.isDir) toggleDir(entry.path);
    else onFileOpen(entry.path);
  }

  function isImageFile(name: string): boolean {
    return /\.(png|jpg|jpeg|svg|gif|bmp|webp)$/i.test(name);
  }

  function handleDragStart(e: DragEvent, entry: FileEntry) {
    if (!isImageFile(entry.name)) return;
    e.dataTransfer?.setData('text/plain', entry.path);
    e.dataTransfer?.setData('application/penwright-image', entry.path);
    if (e.dataTransfer) e.dataTransfer.effectAllowed = 'copy';
  }

  // Inline "Neuer Ordner"-Input — `window.prompt()` is disabled when the
  // renderer runs sandboxed, so we render the input ourselves at the top
  // of the file list.
  let showNewFolderInput = $state(false);
  let newFolderName = $state('');
  let newFolderInputEl: HTMLInputElement | undefined = $state();

  function newFolderAction() {
    showNewFolderInput = true;
    newFolderName = '';
    setTimeout(() => newFolderInputEl?.focus(), 0);
  }

  async function submitNewFolder() {
    const name = newFolderName.trim();
    if (!name) {
      showNewFolderInput = false;
      return;
    }
    const result = await api.invoke('project:newFolder', { name }) as { ok: boolean; error?: string };
    if (!result.ok) {
      alert(result.error ?? t().sidebar.createFolderFailed);
      return;
    }
    showNewFolderInput = false;
    newFolderName = '';
  }

  function cancelNewFolder() {
    showNewFolderInput = false;
    newFolderName = '';
  }

  async function addAssetAction() {
    const result = await api.invoke('project:addAssets') as { added: string[]; error?: string };
    if (result.error) alert(result.error);
  }

  async function navigateUp() {
    const result = await api.invoke('filetree:navigateUp') as { dir: string; entries: FileEntry[]; hasParent: boolean } | null;
    if (result) {
      projectDir = result.dir;
      tree = result.entries;
      hasParent = result.hasParent;
      expandedDirs = new Set();
    }
  }

  function dirName(p: string): string {
    return p.split('/').pop() || p;
  }
</script>

<div class="sidebar" role="complementary" aria-label={t().sidebar.explorerAria}>
  {#if projectDir}
    <div class="sidebar-path">
      {#if hasParent}
        <button class="back-btn" onclick={navigateUp} title={t().sidebar.goUp} aria-label={t().sidebar.goUpAria}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M10 12L6 8l4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
      {/if}
      <span class="path-text" title={projectDir}>{dirName(projectDir)}</span>
      <button class="action-btn" onclick={newFolderAction} title={t().sidebar.newFolder} aria-label={t().sidebar.newFolder}>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <path d="M2 4h4l1 1.5h7v7H2V4z" stroke="currentColor" stroke-width="1.2" fill="none"/>
          <path d="M11 8.5v3M9.5 10h3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
        </svg>
      </button>
      <button class="action-btn" onclick={addAssetAction} title={t().sidebar.addAsset} aria-label={t().sidebar.addAsset}>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <path d="M8 2v8M4 6l4-4 4 4M3 13h10" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
    </div>
  {/if}

  {#if showNewFolderInput}
    <div class="new-folder-row">
      <span class="new-folder-icon">▸</span>
      <input
        bind:this={newFolderInputEl}
        bind:value={newFolderName}
        class="new-folder-input"
        type="text"
        placeholder={t().sidebar.folderNamePlaceholder}
        onkeydown={(e) => {
          if (e.key === 'Enter') submitNewFolder();
          else if (e.key === 'Escape') cancelNewFolder();
        }}
        onblur={submitNewFolder}
      />
    </div>
  {/if}

  <div class="sidebar-content">
    {#if loading}
      <div class="sidebar-empty">{t().common.loading}</div>
    {:else if tree.length === 0}
      <div class="sidebar-empty">
        <p>{t().sidebar.emptyProject}</p>
        <p class="hint">{t().sidebar.emptyHint}</p>
      </div>
    {:else}
      <ul class="file-list" role="tree" aria-label={t().sidebar.filesAria}>
        {#each tree as entry}
          {@render fileNode(entry, 0)}
        {/each}
      </ul>
    {/if}
  </div>
</div>

{#snippet fileNode(entry: FileEntry, depth: number)}
  <li>
    <button
      class="file-entry"
      class:active={entry.path === currentFile}
      class:is-dir={entry.isDir}
      style="padding-left: {14 + depth * 16}px"
      onclick={() => handleClick(entry)}
      oncontextmenu={(e) => { if (!entry.isDir && onContextMenu) { e.preventDefault(); onContextMenu(e, entry.path); } }}
      draggable={isImageFile(entry.name)}
      ondragstart={(e) => handleDragStart(e, entry)}
      title={entry.path}
    >
      <span class="chevron">{entry.isDir ? (expandedDirs.has(entry.path) ? '▾' : '▸') : ''}</span>
      <span class="fname">{entry.name}</span>
    </button>
    {#if entry.isDir && entry.children && expandedDirs.has(entry.path)}
      <ul class="file-list">
        {#each entry.children as child}
          {@render fileNode(child, depth + 1)}
        {/each}
      </ul>
    {/if}
  </li>
{/snippet}

<style>
  .sidebar {
    display: flex;
    flex-direction: column;
    height: 100%;
    font-size: 13px;
    user-select: none;
    color: #555;
  }

  .sidebar-path {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 8px 12px;
    border-bottom: 1px solid #f0f0f0;
    flex-shrink: 0;
  }

  .path-text {
    flex: 1;
    font-size: 12px;
    font-weight: 600;
    color: #888;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .back-btn, .action-btn {
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
    flex-shrink: 0;
    transition: all 0.15s;
  }

  .back-btn:hover, .action-btn:hover {
    background: #f0f0f0;
    color: #555;
  }

  .sidebar-content {
    flex: 1;
    overflow-y: auto;
    padding: 4px 0;
  }

  .sidebar-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: #bbb;
    font-size: 13px;
    gap: 12px;
  }

  .sidebar-empty .hint {
    font-size: 11px;
    color: #ccc;
    margin: -4px 0 0;
    text-align: center;
    padding: 0 24px;
    line-height: 1.5;
  }

  .file-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .file-entry {
    display: flex;
    align-items: center;
    width: 100%;
    padding: 3px 14px;
    border: none;
    background: transparent;
    color: #555;
    cursor: pointer;
    font-size: 13px;
    font-family: inherit;
    text-align: left;
    gap: 4px;
    white-space: nowrap;
    overflow: hidden;
    line-height: 24px;
    border-radius: 0;
    transition: background 0.1s;
  }

  .file-entry:hover {
    background: rgba(0, 0, 0, 0.03);
  }

  .file-entry.active {
    background: #eef4ff;
    color: #4f7df9;
  }

  .chevron {
    flex-shrink: 0;
    width: 12px;
    font-size: 8px;
    text-align: center;
    color: #bbb;
  }

  .fname {
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .file-entry.is-dir .fname {
    font-weight: 500;
    color: #444;
  }

  .new-folder-row {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 14px;
    border-bottom: 1px solid #f5f5f5;
    background: #fafafa;
  }
  .new-folder-icon {
    color: #aaa;
    font-size: 11px;
    flex-shrink: 0;
  }
  .new-folder-input {
    flex: 1;
    border: 1px solid #4f7df9;
    border-radius: 4px;
    padding: 3px 6px;
    font-size: 12px;
    font-family: inherit;
    outline: none;
    background: #fff;
    color: #222;
  }
</style>
