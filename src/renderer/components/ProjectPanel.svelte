<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { t } from '@shared/i18n/store.svelte';
  import { isIpadHost } from '@shared/hostKind';
  import { sourceOfVersion, type VersionGroup } from '@shared/chapterVersions';
  import { closeTabByPath, openTab, retargetTab, tabState, uiState } from '../appState.svelte';
  import HistoryDialog from './HistoryDialog.svelte';

  interface ProjectInfo {
    projectDir: string | null;
    currentFilePath: string | null;
    projectName: string | null;
  }

  interface VersionResult {
    ok: boolean;
    path?: string;
    error?: string;
  }

  let projectInfo: ProjectInfo = $state({ projectDir: null, currentFilePath: null, projectName: null });
  let groups: VersionGroup[] = $state([]);
  let versionName = $state('');
  let nameTouched = $state(false);
  let saving = $state(false);
  let loading = $state(true);
  let showHistory = $state(false);
  let openGroups: Record<string, boolean> = $state({});

  const api = (window as unknown as { electronAPI: {
    invoke(channel: string, ...args: unknown[]): Promise<unknown>;
    on(channel: string, callback: (data: unknown) => void): () => void;
  } }).electronAPI;

  let unsubscribe: (() => void) | null = null;
  let filledFor = '';

  function openTypRel(): string | null {
    const tab = tabState.activeTabIndex >= 0 ? tabState.openTabs[tabState.activeTabIndex] : null;
    if (!tab || tab.type !== 'typ') return null;
    const rel = toRel(tab.path);
    if (!rel || (!rel.endsWith('.typ') && !rel.endsWith('.typst'))) return null;
    return rel;
  }

  /** Folder the new version is stored under: the chapter, even when a version of it is the open tab. */
  function chapterRel(): string | null {
    const rel = openTypRel();
    if (!rel) return null;
    return sourceOfVersion(rel) ?? rel;
  }

  function toRel(file: string): string | null {
    const norm = file.replace(/\\/g, '/');
    if (isIpadHost() || !norm.startsWith('/')) return norm.replace(/^\.\//, '');
    const dir = (projectInfo.projectDir ?? '').replace(/\\/g, '/').replace(/\/$/, '');
    if (!dir || (norm !== dir && !norm.startsWith(`${dir}/`))) return null;
    return norm.slice(dir.length + 1);
  }

  function toHost(rel: string): string {
    if (isIpadHost() || !projectInfo.projectDir) return rel;
    return `${projectInfo.projectDir.replace(/\\/g, '/').replace(/\/$/, '')}/${rel}`;
  }

  function readEditor(send: boolean): string {
    const detail = { content: tabState.currentContent, send };
    window.dispatchEvent(new CustomEvent('penwright:read-editor', { detail }));
    return detail.content;
  }

  onMount(async () => {
    await refreshAll();
    unsubscribe = api.on('penwright', (data: unknown) => {
      const msg = data as { type: string };
      if (msg.type === 'filetreeChanged' || msg.type === 'currentFile' || msg.type === 'projectOpened') {
        void refreshAll();
      }
    });
  });

  onDestroy(() => {
    unsubscribe?.();
  });

  async function refreshAll() {
    await Promise.all([refreshInfo(), refreshVersions()]);
    loading = false;
    const chapter = chapterRel();
    if (chapter && chapter !== filledFor) {
      filledFor = chapter;
      nameTouched = false;
      try {
        const suggested = await api.invoke('versions:suggest', { sourceRel: chapter }) as string;
        if (chapterRel() === chapter) versionName = suggested;
      } catch { /* the field stays as the user left it */ }
    }
  }

  async function refreshInfo() {
    try {
      projectInfo = await api.invoke('project:getInfo') as ProjectInfo;
    } catch { /* keep the last known project */ }
  }

  async function refreshVersions() {
    try {
      groups = await api.invoke('versions:list') as VersionGroup[];
    } catch {
      groups = [];
    }
  }

  type VersionDialog =
    | { kind: 'rename'; path: string; name: string; draft: string }
    | { kind: 'delete'; path: string; name: string; groupSource: string }
    | { kind: 'swap'; path: string };

  let dialog = $state<VersionDialog | null>(null);
  let actionMenu = $state<{ path: string; name: string; groupSource: string; top: number; left: number } | null>(null);

  function openActionMenu(event: MouseEvent, version: { path: string; name: string }, groupSource: string) {
    if (actionMenu?.path === version.path) {
      actionMenu = null;
      return;
    }
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const menuHeight = 240;
    const top = rect.bottom + 4 + menuHeight > window.innerHeight ? Math.max(8, rect.top - menuHeight - 4) : rect.bottom + 4;
    const left = Math.max(8, rect.right - 220);
    actionMenu = { path: version.path, name: version.name, groupSource, top, left };
  }

  function focusField(node: HTMLInputElement) {
    node.focus();
  }

  function fail(error: string | undefined) {
    const msg = error === 'exists' ? t().project.nameTaken : (error || '');
    uiState.banner = t().project.versionFailed(msg);
  }

  function startRename(path: string, name: string) {
    dialog = { kind: 'rename', path, name, draft: name };
  }

  async function createVersion() {
    const chapter = chapterRel();
    const name = versionName.trim();
    if (!chapter || !name || saving) return;
    saving = true;
    try {
      const content = readEditor(true);
      const result = await api.invoke('versions:create', { sourceRel: chapter, name, content }) as VersionResult;
      if (!result.ok) {
        fail(result.error);
        return;
      }
      nameTouched = false;
      filledFor = '';
      await refreshAll();
    } catch (err) {
      uiState.banner = t().project.versionFailed(err instanceof Error ? err.message : String(err));
    } finally {
      saving = false;
    }
  }

  async function openVersion(rel: string, mode: 'read' | 'edit') {
    const target = toHost(rel);
    openTab(target, 'typ', mode);
    await api.invoke('filetree:open', target);
  }

  async function makeMain(rel: string) {
    dialog = null;
    const open = chapterRel();
    const lookingAt = tabState.activeTabIndex >= 0 ? toRel(tabState.openTabs[tabState.activeTabIndex]?.path ?? '') : null;
    const content = readEditor(false);
    const liveContent = lookingAt === open ? content : undefined;
    const versionContent = lookingAt === rel ? content : undefined;
    try {
      const result = await api.invoke('versions:swap', { versionRel: rel, liveContent, versionContent }) as VersionResult;
      if (!result.ok) fail(result.error);
      await refreshVersions();
    } catch (err) {
      uiState.banner = t().project.versionFailed(err instanceof Error ? err.message : String(err));
    }
  }

  async function renameVersion(rel: string, current: string, nextName: string) {
    const name = nextName.trim();
    if (!name || name === current) return;
    dialog = null;
    const oldHost = toHost(rel);
    try {
      const result = await api.invoke('versions:rename', { versionRel: rel, name: name.trim() }) as VersionResult;
      if (!result.ok || !result.path) {
        fail(result.error);
        return;
      }
      retargetTab(oldHost, toHost(result.path));
      await refreshVersions();
    } catch (err) {
      uiState.banner = t().project.versionFailed(err instanceof Error ? err.message : String(err));
    }
  }

  async function deleteVersion(groupSource: string, rel: string) {
    dialog = null;
    const host = toHost(rel);
    const active = tabState.openTabs[tabState.activeTabIndex];
    if (active?.path === host) {
      openTab(toHost(groupSource), 'typ');
      await api.invoke('filetree:open', toHost(groupSource));
    }
    try {
      const result = await api.invoke('versions:delete', { versionRel: rel }) as VersionResult;
      if (!result.ok) {
        fail(result.error);
        return;
      }
      closeTabByPath(host);
      await refreshVersions();
    } catch (err) {
      uiState.banner = t().project.versionFailed(err instanceof Error ? err.message : String(err));
    }
  }

  function toggleGroup(source: string) {
    const chapter = chapterRel();
    const currently = openGroups[source] ?? source === chapter;
    openGroups = { ...openGroups, [source]: !currently };
  }

  function groupOpen(source: string): boolean {
    if (source in openGroups) return openGroups[source];
    return source === chapterRel();
  }

  const chapter = $derived(chapterRel());
  const openFile = $derived(openTypRel());
  const canSave = $derived(!!chapter && versionName.trim().length > 0 && !saving && !loading);
</script>

<div class="project-panel">
  <div class="header">
    <div class="header-row">
      <div class="project-name" title={projectInfo.projectDir ?? ''}>
        {projectInfo.projectName ?? t().project.noProjectName}
      </div>
      {#if projectInfo.projectDir && !isIpadHost()}
        <button class="icon-btn" onclick={() => api.invoke('project:showInFinder')} title={t().project.showInFinder} aria-label={t().project.showInFinder}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M2 4h4l1 1.5h7v7H2V4z" stroke="currentColor" stroke-width="1.2" fill="none"/>
          </svg>
        </button>
      {/if}
    </div>
  </div>

  {#if !projectInfo.projectDir && !projectInfo.projectName}
    <div class="empty-state">
      <p>{t().project.emptyStateTitle}</p>
      <p class="muted">{t().project.emptyStateHint}</p>
    </div>
  {:else}
    <div class="save-card">
      {#if chapter}
        <p class="hint">{t().project.versionOf(openFile ?? chapter)}</p>
      {:else}
        <p class="hint">{t().project.noOpenChapter}</p>
      {/if}
      <input
        class="save-input"
        type="text"
        bind:value={versionName}
        placeholder={t().project.saveInputPlaceholder}
        oninput={() => { nameTouched = true; }}
        onkeydown={(e) => { if (e.key === 'Enter' && canSave) void createVersion(); }}
      />
      <button class="save-btn" onclick={() => void createVersion()} disabled={!canSave}>
        {saving ? t().project.saving : t().project.createVersion}
      </button>
    </div>

    <div class="scroll-area">
      <div class="section-header">
        <span class="section-title">{t().project.versionsTitle}</span>
      </div>
      {#if groups.length === 0}
        <div class="muted-block">{t().project.versionsEmpty}</div>
      {:else}
        {#each groups as group (group.source)}
          <section class="group">
            <button class="group-head" onclick={() => toggleGroup(group.source)}>
              <span class="chevron">{groupOpen(group.source) ? '▾' : '▸'}</span>
              <span class="group-path">{group.source}</span>
            </button>
            {#if groupOpen(group.source)}
              <ul class="file-list">
                {#each group.versions as version (version.path)}
                  <li class="version-row">
                    <div class="version-name" title={version.name}>{version.name}</div>
                    <button
                      class="kebab"
                      type="button"
                      aria-label={t().project.versionMenu}
                      aria-expanded={actionMenu?.path === version.path}
                      onclick={(event) => openActionMenu(event, version, group.source)}
                    >⋮</button>
                  </li>
                {/each}
              </ul>
            {/if}
          </section>
        {/each}
      {/if}
    </div>

    <button class="history-btn" onclick={() => showHistory = true}>
      <span class="history-icon">↺</span>
      <span class="history-label">{t().history.openButton}</span>
      <span class="history-chevron">›</span>
    </button>
  {/if}
</div>

{#if actionMenu}
  <button class="dialog-backdrop menu-backdrop" type="button" aria-label={t().common.close} onclick={() => { actionMenu = null; }}></button>
  <div class="action-menu" style="top: {actionMenu.top}px; left: {actionMenu.left}px" role="menu">
    <button type="button" role="menuitem" onclick={() => { const path = actionMenu?.path; actionMenu = null; if (path) void openVersion(path, 'read'); }}>{t().project.openRead}</button>
    <button type="button" role="menuitem" onclick={() => { const path = actionMenu?.path; actionMenu = null; if (path) void openVersion(path, 'edit'); }}>{t().project.openEdit}</button>
    <button type="button" role="menuitem" onclick={() => { const path = actionMenu?.path; actionMenu = null; if (path) dialog = { kind: 'swap', path }; }}>{t().project.makeMain}</button>
    <button type="button" role="menuitem" onclick={() => { const current = actionMenu; actionMenu = null; if (current) startRename(current.path, current.name); }}>{t().project.rename}</button>
    <button type="button" role="menuitem" onclick={() => { const current = actionMenu; actionMenu = null; if (current) dialog = { kind: 'delete', path: current.path, name: current.name, groupSource: current.groupSource }; }}>{t().project.deleteVersion}</button>
  </div>
{/if}

{#if dialog}
  <button class="dialog-backdrop" type="button" aria-label={t().common.close} onclick={() => { dialog = null; }}></button>
  <div class="dialog" role="dialog" aria-modal="true" tabindex="-1">
      {#if dialog.kind === 'rename'}
        <p class="dialog-title">{t().project.renamePrompt}</p>
        <input
          class="save-input"
          type="text"
          use:focusField
          bind:value={dialog.draft}
          onkeydown={(e) => {
            if (e.key === 'Enter' && dialog?.kind === 'rename') void renameVersion(dialog.path, dialog.name, dialog.draft);
            if (e.key === 'Escape') dialog = null;
          }}
        />
        <div class="dialog-actions">
          <button type="button" onclick={() => { dialog = null; }}>{t().common.cancel}</button>
          <button type="button" class="primary" onclick={() => { if (dialog?.kind === 'rename') void renameVersion(dialog.path, dialog.name, dialog.draft); }}>{t().project.rename}</button>
        </div>
      {:else if dialog.kind === 'delete'}
        <p class="dialog-title">{t().project.deleteConfirm(dialog.name)}</p>
        <div class="dialog-actions">
          <button type="button" onclick={() => { dialog = null; }}>{t().common.cancel}</button>
          <button type="button" class="primary" onclick={() => { if (dialog?.kind === 'delete') void deleteVersion(dialog.groupSource, dialog.path); }}>{t().project.deleteVersion}</button>
        </div>
      {:else}
        <p class="dialog-title">{t().project.makeMainConfirm}</p>
        <div class="dialog-actions">
          <button type="button" onclick={() => { dialog = null; }}>{t().common.cancel}</button>
          <button type="button" class="primary" onclick={() => { if (dialog?.kind === 'swap') void makeMain(dialog.path); }}>{t().project.makeMain}</button>
        </div>
      {/if}
  </div>
{/if}

{#if showHistory}
  <HistoryDialog
    onClose={() => showHistory = false}
    onRestored={() => { showHistory = false; void refreshAll(); }}
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
  .header-row { display: flex; align-items: center; gap: 6px; }
  .project-name {
    flex: 1;
    font-weight: 600;
    color: #222;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .empty-state { padding: 32px 16px; text-align: center; color: #888; }
  .empty-state .muted { font-size: 12px; color: #bbb; }
  .save-card {
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 10px 12px;
    border-bottom: 1px solid #f0f0f0;
  }
  .hint { margin: 0; font-size: 12px; color: #888; line-height: 1.4; }
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
  .save-btn:disabled { opacity: 0.4; cursor: default; background: #ccc; }
  .section-header {
    display: flex;
    align-items: center;
    padding: 10px 12px 4px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #aaa;
  }
  .group { border-bottom: 1px solid #f5f5f5; }
  .group-head {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    border: none;
    background: none;
    color: #333;
    font-size: 12px;
    font-family: inherit;
    text-align: left;
    cursor: pointer;
  }
  .group-path {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .chevron { width: 12px; color: #888; }
  .file-list { list-style: none; margin: 0; padding: 0 8px 8px; }
  .version-row {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 2px 4px;
  }
  .version-name {
    flex: 1;
    font-size: 13px;
    color: #333;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .kebab {
    flex-shrink: 0;
    width: 44px;
    height: 44px;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: #666;
    font-size: 22px;
    line-height: 1;
    letter-spacing: 0;
    cursor: pointer;
  }
  .kebab:hover, .kebab[aria-expanded="true"] { background: #f0f3fa; color: #222; }
  .menu-backdrop { background: transparent; }
  .action-menu {
    position: fixed;
    z-index: 82;
    width: 220px;
    padding: 6px;
    background: #fff;
    border: 1px solid #e6e6e6;
    border-radius: 12px;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.16);
    display: flex;
    flex-direction: column;
  }
  .action-menu button {
    min-height: 44px;
    padding: 8px 12px;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: #222;
    font: inherit;
    font-size: 15px;
    text-align: left;
    cursor: pointer;
  }
  .action-menu button:hover { background: #f4f7ff; }
  .muted-block { padding: 16px 12px; color: #bbb; font-size: 12px; text-align: center; }
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
  .history-btn {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 8px;
    width: calc(100% - 24px);
    margin: 10px 12px 12px;
    padding: 10px 12px;
    border: 1px solid #e5e5e5;
    border-radius: 8px;
    background: #fff;
    color: #444;
    font-size: 13px;
    font-family: inherit;
    cursor: pointer;
  }
  .history-icon { font-size: 15px; line-height: 1; color: #4f7df9; }
  .history-label { flex: 1; text-align: left; font-weight: 500; }
  .history-chevron { color: #bbb; font-size: 16px; }
  .scroll-area { flex: 1; min-height: 0; overflow-y: auto; }

  .dialog-backdrop {
    position: fixed;
    inset: 0;
    z-index: 80;
    border: none;
    padding: 0;
    background: rgba(0, 0, 0, 0.35);
    cursor: default;
  }
  .dialog {
    position: fixed;
    z-index: 81;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: min(420px, calc(100% - 48px));
    background: #fff;
    border-radius: 12px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.2);
  }
  .dialog-title { margin: 0; font-size: 14px; line-height: 1.45; color: #222; }
  .dialog-actions { display: flex; justify-content: flex-end; gap: 8px; }
  .dialog-actions button {
    min-height: 44px;
    padding: 8px 14px;
    border: 1px solid #e5e5e5;
    border-radius: 8px;
    background: #fff;
    font: inherit;
    font-size: 14px;
    cursor: pointer;
  }
  .dialog-actions .primary {
    background: #4f7df9;
    border-color: #4f7df9;
    color: #fff;
    font-weight: 600;
  }
</style>
