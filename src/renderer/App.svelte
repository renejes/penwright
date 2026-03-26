<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import Toolbar from '../editor/components/Toolbar.svelte';
  import CommandHub from '../editor/components/CommandHub.svelte';
  import ShortcutCheatsheet from '../editor/components/ShortcutCheatsheet.svelte';
  import SettingsPanel from '../editor/components/SettingsPanel.svelte';
  import SearchReplace from '../editor/components/SearchReplace.svelte';
  import QuickSettings from '../editor/components/QuickSettings.svelte';
  import WelcomeScreen from '../editor/components/WelcomeScreen.svelte';
  import Sidebar from './components/Sidebar.svelte';
  import OutlinePanel from './components/OutlinePanel.svelte';
  import IncludesPanel from './components/IncludesPanel.svelte';
  import GitPanel from './components/GitPanel.svelte';
  import PreviewPanel from './components/PreviewPanel.svelte';
  import TerminalPanel from './components/TerminalPanel.svelte';
  import TextFileViewer from './components/TextFileViewer.svelte';
  import PdfFileViewer from './components/PdfFileViewer.svelte';
  import NewProjectDialog from './components/NewProjectDialog.svelte';
  import ResizeHandle from './components/ResizeHandle.svelte';
  import StartScreen from './components/StartScreen.svelte';
  import { createEditor, setEditorLanguage } from '../editor/lib/editor';
  import { serializeTypst } from '../editor/lib/serializer';
  import { ipc } from '../editor/lib/ipcAdapter';
  import type { DocumentSettings } from '../editor/lib/messages';
  import {
    editorRef,
    editorVersion,
    isUpdatingFromExtension,
    uiState,
    panelState,
    previewState,
    tabState,
    contextMenu,
    newProjectState,
    openTab,
    closeTab,
    tabName,
    switchToTab,
    resizeBase,
    startSidebarResize,
    onSidebarResize,
    startPreviewResize,
    onPreviewResize,
    startTerminalResize,
    onTerminalResize,
  } from './appState.svelte';
  import { handleMessage } from './messageHandler';

  // ─── Local State ───────────────────────────────
  let editorElement: HTMLDivElement;
  let debounceTimer: ReturnType<typeof setTimeout>;
  let panelSaveTimer: ReturnType<typeof setTimeout>;

  // Debounced panel state persistence
  $effect(() => {
    // Access all reactive fields to track them
    const snapshot = {
      showSidebar: panelState.showSidebar,
      showPreview: panelState.showPreview,
      showTerminal: panelState.showTerminal,
      sidebarTab: panelState.sidebarTab,
      sidebarWidth: panelState.sidebarWidth,
      previewWidth: panelState.previewWidth,
      terminalHeight: panelState.terminalHeight,
    };
    clearTimeout(panelSaveTimer);
    panelSaveTimer = setTimeout(() => {
      const api = (window as unknown as { electronAPI?: { invoke(channel: string, ...args: unknown[]): Promise<unknown> } }).electronAPI;
      api?.invoke('persist:savePanelState', snapshot);
    }, 500);
  });

  let activeTab = $derived(tabState.activeTabIndex >= 0 ? tabState.openTabs[tabState.activeTabIndex] : null);
  let textViewerFile = $derived(activeTab?.type === 'text' || activeTab?.type === 'rawtyp' ? activeTab.path : '');
  let pdfViewerFile = $derived(activeTab?.type === 'pdf' ? activeTab.path : '');
  let hasFileOpen = $derived(tabState.openTabs.length > 0 || !!tabState.currentFile);

  // IPC adapter for CommandHub/QuickSettings compatibility
  const vscodeBridge = {
    postMessage(msg: unknown) {
      ipc.send(msg as import('../editor/lib/messages').WebviewMessage);
    },
    getState(): unknown { return null; },
    setState(_state: unknown) {},
  };

  onMount(() => {
    (window as unknown as Record<string, unknown>).vswriteApi = vscodeBridge;

    editorRef.current = createEditor(editorElement, {
      onTransaction() {
        editorVersion.value++;
        if (uiState.typewriterMode) {
          requestAnimationFrame(() => scrollCursorToCenter());
        }
      },
      onUpdate() {
        if (isUpdatingFromExtension.value) return;
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(sendUpdate, 300);
        if (uiState.typewriterMode) {
          requestAnimationFrame(() => scrollCursorToCenter());
        }
      },
    });

    ipc.onMessage(handleMessage);
    window.addEventListener('keydown', handleGlobalKeydown);

    // Drag & Drop images into the editor
    document.addEventListener('dragover', (e) => e.preventDefault());
    document.addEventListener('drop', (e) => {
      e.preventDefault();

      const sidebarImagePath = e.dataTransfer?.getData('application/vswrite-image');
      if (sidebarImagePath) {
        ipc.send({ type: 'dropImagePath', path: sidebarImagePath } as unknown as import('../editor/lib/messages').WebviewMessage);
        return;
      }

      if (!e.dataTransfer?.files.length) return;
      for (const file of Array.from(e.dataTransfer.files)) {
        if (file.type.startsWith('image/')) {
          const filePath = (file as unknown as { path?: string }).path;
          if (filePath) {
            ipc.send({ type: 'dropImagePath', path: filePath } as unknown as import('../editor/lib/messages').WebviewMessage);
          } else {
            const reader = new FileReader();
            reader.onload = () => {
              ipc.send({ type: 'dropImage', name: file.name, data: reader.result as string } as unknown as import('../editor/lib/messages').WebviewMessage);
            };
            reader.readAsDataURL(file);
          }
        }
      }
    });

    // Restore persisted panel state
    const electronAPI = (window as unknown as { electronAPI?: { invoke(channel: string, ...args: unknown[]): Promise<unknown> } }).electronAPI;
    if (electronAPI) {
      electronAPI.invoke('persist:getPanelState').then((stored) => {
        if (stored && typeof stored === 'object') {
          const s = stored as Record<string, unknown>;
          if (typeof s.showSidebar === 'boolean') panelState.showSidebar = s.showSidebar;
          if (typeof s.showPreview === 'boolean') panelState.showPreview = s.showPreview;
          if (typeof s.showTerminal === 'boolean') panelState.showTerminal = s.showTerminal;
          if (typeof s.sidebarTab === 'string') panelState.sidebarTab = s.sidebarTab as typeof panelState.sidebarTab;
          if (typeof s.sidebarWidth === 'number') panelState.sidebarWidth = s.sidebarWidth;
          if (typeof s.previewWidth === 'number') panelState.previewWidth = s.previewWidth;
          if (typeof s.terminalHeight === 'number') panelState.terminalHeight = s.terminalHeight;
        }
      });
    }

    ipc.send({ type: 'ready' });
  });

  function scrollCursorToCenter() {
    const editor = editorRef.current;
    if (!editor) return;
    const { from } = editor.state.selection;
    const coords = editor.view.coordsAtPos(from);
    if (!coords) return;
    const container = editorElement?.closest('.editor-container');
    if (!container) return;
    const containerRect = container.getBoundingClientRect();
    const cursorRelative = coords.top - containerRect.top + container.scrollTop;
    const targetScroll = cursorRelative - containerRect.height / 2;
    container.scrollTo({ top: targetScroll, behavior: 'smooth' });
  }

  function sendUpdate() {
    const editor = editorRef.current;
    if (!editor) return;
    const typst = serializeTypst(editor.getJSON());
    if (!typst && editor.state.doc.content.size > 2) {
      console.error('[vswrite] Serializer produced empty output — skipping save');
      return;
    }
    tabState.currentContent = typst;
    ipc.send({ type: 'edit', content: typst });
  }

  function openSettings() {
    ipc.send({ type: 'requestSettings' });
  }

  function saveSettings(settings: DocumentSettings) {
    ipc.send({ type: 'updateSettings', settings });
    uiState.showSettings = false;
    uiState.currentSettings = null;
  }

  function dismissWelcome(dontShowAgain: boolean) {
    uiState.showWelcome = false;
    ipc.send({ type: 'dismissWelcome', dontShowAgain } as unknown as import('../editor/lib/messages').WebviewMessage);
  }

  function toggleFocusMode() {
    uiState.focusMode = !uiState.focusMode;
  }

  function toggleTypewriterMode() {
    uiState.typewriterMode = !uiState.typewriterMode;
  }

  function handleGlobalKeydown(e: KeyboardEvent) {
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key === 'f') {
      e.preventDefault();
      uiState.showSearch = true;
    }
    if (mod && e.key === 'h') {
      e.preventDefault();
      uiState.showSearch = true;
    }
    if (mod && e.key === 'b') {
      e.preventDefault();
      panelState.showSidebar = !panelState.showSidebar;
    }
    if (mod && e.shiftKey && e.key === 'p') {
      e.preventDefault();
      panelState.showPreview = !panelState.showPreview;
    }
    if (mod && e.key === '`') {
      e.preventDefault();
      panelState.showTerminal = !panelState.showTerminal;
    }
    if (e.key === 'Escape') {
      if (uiState.focusMode) uiState.focusMode = false;
      if (uiState.typewriterMode) uiState.typewriterMode = false;
    }
  }

  // ─── Start Screen Handlers ─────────────────────
  function handlePreviewModeChange(mode: 'svg' | 'pdf') {
    previewState.previewMode = mode;
    const api = (window as unknown as { electronAPI: { send(channel: string, data: unknown): void } }).electronAPI;
    api.send('preview:setMode', mode);
  }

  function handleStartNewProject() {
    ipc.send({ type: 'newProject' });
  }

  function handleStartOpenFile() {
    const api = (window as unknown as { electronAPI: { invoke(channel: string, ...args: unknown[]): Promise<unknown> } }).electronAPI;
    api.invoke('dialog:openFile').then((filePath) => {
      if (filePath) {
        api.invoke('filetree:open', filePath as string).then((result) => {
          if (result === 'editor') openTab(filePath as string, 'typ');
        });
      }
    });
  }

  function handleStartOpenRecent(filePath: string) {
    const api = (window as unknown as { electronAPI: { invoke(channel: string, ...args: unknown[]): Promise<unknown> } }).electronAPI;
    api.invoke('filetree:open', filePath).then((result) => {
      if (result === 'editor') openTab(filePath, 'typ');
    });
  }

  function handleStartOpenFolder() {
    const api = (window as unknown as { electronAPI: { invoke(channel: string, ...args: unknown[]): Promise<unknown> } }).electronAPI;
    api.invoke('filetree:openFolder');
  }

  function handleFileOpen(filePath: string) {
    const api = (window as unknown as { electronAPI: { invoke(channel: string, ...args: unknown[]): Promise<unknown> } }).electronAPI;
    api.invoke('filetree:open', filePath).then((result) => {
      if (result === 'editor') {
        openTab(filePath, 'typ');
      } else if (result === 'textviewer') {
        openTab(filePath, 'text');
      } else if (result === 'pdfviewer') {
        openTab(filePath, 'pdf');
      }
    });
  }

  function handleFileOpenInNewTab(filePath: string) {
    handleFileOpen(filePath);
  }

  function showContextMenu(e: MouseEvent, filePath: string) {
    e.preventDefault();
    contextMenu.x = e.clientX;
    contextMenu.y = e.clientY;
    contextMenu.path = filePath;
  }

  function closeContextMenu() {
    contextMenu.x = 0;
    contextMenu.y = 0;
    contextMenu.path = '';
  }

  onDestroy(() => {
    clearTimeout(debounceTimer);
    window.removeEventListener('keydown', handleGlobalKeydown);
    editorRef.current?.destroy();
  });
</script>

<div class="vswrite-app">
  <!-- Titlebar drag region (macOS hiddenInset) -->
  <div class="titlebar-drag-region"></div>

  <div class="vswrite-container" class:focus-mode={uiState.focusMode} class:typewriter-mode={uiState.typewriterMode}>
    {#if editorRef.current}
      {@const _ = editorVersion.value}
      {#if !uiState.focusMode}
        <div class="toolbar">
          <Toolbar editor={editorRef.current} />
          <div class="toolbar-right">
            <button
              class="toolbar-icon-btn"
              onclick={() => (uiState.showQuickSettings = !uiState.showQuickSettings)}
              title="Quick Settings"
            >
              &#9881;
            </button>
            <button
              class="toolbar-icon-btn"
              class:active={uiState.typewriterMode}
              onclick={toggleTypewriterMode}
              title="Typewriter Mode"
            >
              &#8230;
            </button>
            <button
              class="toolbar-icon-btn"
              onclick={toggleFocusMode}
              title="Focus Mode"
            >
              &#9678;
            </button>
            <CommandHub
              editor={editorRef.current}
              vscode={vscodeBridge}
              onShowShortcuts={() => (uiState.showShortcuts = true)}
              onShowSettings={openSettings}
              onToggleFocusMode={toggleFocusMode}
              onToggleTypewriterMode={toggleTypewriterMode}
              onShowSearch={() => (uiState.showSearch = true)}
            />
          </div>
          {#if uiState.showQuickSettings}
            <QuickSettings
              vscode={vscodeBridge}
              onClose={() => (uiState.showQuickSettings = false)}
            />
          {/if}
        </div>
      {/if}
      {#if uiState.showSearch}
        <SearchReplace editor={editorRef.current} onClose={() => (uiState.showSearch = false)} />
      {/if}
    {/if}

    <!-- Start Screen (when no file is open) -->
    {#if !hasFileOpen}
      <StartScreen
        onNewProject={handleStartNewProject}
        onOpenFile={handleStartOpenFile}
        onOpenFolder={handleStartOpenFolder}
        onOpenRecent={handleStartOpenRecent}
      />
    {/if}

    <!-- Main content area with panels (always in DOM so TipTap editor element is available at onMount) -->
    <div class="app-body" class:hidden={!hasFileOpen}>
      <!-- Sidebar -->
      {#if panelState.showSidebar}
        <div class="panel-sidebar" style="width: {panelState.sidebarWidth}px">
          <div class="sidebar-tabs">
            <button class="sidebar-tab" class:active={panelState.sidebarTab === 'files'} onclick={() => panelState.sidebarTab = 'files'}>Files</button>
            <button class="sidebar-tab" class:active={panelState.sidebarTab === 'outline'} onclick={() => panelState.sidebarTab = 'outline'}>Outline</button>
            <button class="sidebar-tab" class:active={panelState.sidebarTab === 'includes'} onclick={() => panelState.sidebarTab = 'includes'}>Chapters</button>
            <button class="sidebar-tab" class:active={panelState.sidebarTab === 'git'} onclick={() => panelState.sidebarTab = 'git'}>Git</button>
          </div>
          <div class="sidebar-body">
            {#if panelState.sidebarTab === 'files'}
              <Sidebar onFileOpen={handleFileOpen} onContextMenu={showContextMenu} currentFile={tabState.currentFile} />
            {:else if panelState.sidebarTab === 'outline'}
              <OutlinePanel editor={editorRef.current} editorVersion={editorVersion.value} />
            {:else if panelState.sidebarTab === 'includes'}
              <IncludesPanel content={tabState.currentContent} currentFile={tabState.currentFile} />
            {:else if panelState.sidebarTab === 'git'}
              <GitPanel />
            {/if}
          </div>
        </div>
        <ResizeHandle
          orientation="vertical"
          onResize={(delta) => {
            if (resizeBase.sidebarWidth === 0) startSidebarResize();
            onSidebarResize(delta);
          }}
        />
      {/if}

      <!-- Editor with Tab Bar -->
      <div class="panel-editor">
        <!-- Tab Bar -->
        {#if tabState.openTabs.length > 0}
          <div class="tab-bar">
            {#each tabState.openTabs as tab, i}
              <!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
              <div
                class="editor-tab"
                class:active={i === tabState.activeTabIndex}
                onclick={() => switchToTab(i)}
                title={tab.path}
                role="tab"
              >
                <span class="tab-label">{tabName(tab)}</span>
                <!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
                <span
                  class="tab-close"
                  onclick={(e) => { e.stopPropagation(); closeTab(i); }}
                  title="Close"
                  role="button"
                  tabindex="0"
                >
                  <svg width="10" height="10" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
                </span>
              </div>
            {/each}
          </div>
        {/if}

        <!-- Active content -->
        {#if pdfViewerFile}
          <PdfFileViewer
            filePath={pdfViewerFile}
            onClose={() => {
              if (tabState.activeTabIndex >= 0) closeTab(tabState.activeTabIndex);
            }}
          />
        {:else if textViewerFile}
          <TextFileViewer
            filePath={textViewerFile}
            onClose={() => {
              if (tabState.activeTabIndex >= 0) closeTab(tabState.activeTabIndex);
            }}
          />
        {/if}
        <div class="editor-container" class:hidden={!!textViewerFile || !!pdfViewerFile}>
          <div class="editor" bind:this={editorElement}></div>
        </div>
      </div>

      <!-- Context Menu -->
      {#if contextMenu.path}
        <!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
        <div class="context-overlay" onclick={closeContextMenu}>
          <div class="context-menu" style="left: {contextMenu.x}px; top: {contextMenu.y}px">
            <button class="context-item" onclick={() => { handleFileOpenInNewTab(contextMenu.path); closeContextMenu(); }}>
              Open in New Tab
            </button>
            {#if contextMenu.path.endsWith('.typ')}
              <button class="context-item" onclick={() => { openTab(contextMenu.path, 'rawtyp'); closeContextMenu(); }}>
                Open as Text
              </button>
            {/if}
          </div>
        </div>
      {/if}

      <!-- Preview -->
      {#if panelState.showPreview}
        <ResizeHandle
          orientation="vertical"
          onResize={(delta) => {
            if (resizeBase.previewWidth === 0) startPreviewResize();
            onPreviewResize(delta);
          }}
        />
        <div class="panel-preview" style="width: {panelState.previewWidth}px">
          <PreviewPanel
            pages={previewState.pages}
            pdfData={previewState.pdfData}
            previewMode={previewState.previewMode}
            error={previewState.error}
            compiling={previewState.compiling}
            scrollToPage={previewState.scrollToPage}
            onModeChange={handlePreviewModeChange}
          />
        </div>
      {/if}
    </div>

    <!-- Terminal (below main content) -->
    {#if panelState.showTerminal}
      <ResizeHandle
        orientation="horizontal"
        onResize={(delta) => {
          if (resizeBase.terminalHeight === 0) startTerminalResize();
          onTerminalResize(delta);
        }}
      />
      <div class="panel-terminal" style="height: {panelState.terminalHeight}px">
        <TerminalPanel />
      </div>
    {/if}

    <!-- Modals (always available, also from Start Screen) -->
    {#if uiState.focusMode}
      <button class="focus-exit-btn" onclick={toggleFocusMode} title="Exit Focus Mode (Esc)">
        Exit Focus Mode
      </button>
    {/if}
    {#if uiState.showShortcuts}
      <ShortcutCheatsheet onClose={() => (uiState.showShortcuts = false)} />
    {/if}
    {#if uiState.showSettings && uiState.currentSettings}
      <SettingsPanel
        settings={uiState.currentSettings}
        onSave={saveSettings}
        onClose={() => {
          uiState.showSettings = false;
          uiState.currentSettings = null;
        }}
      />
    {/if}
    {#if uiState.showWelcome}
      <WelcomeScreen
        typstInstalled={uiState.welcomeTypstInstalled}
        platform={uiState.welcomePlatform}
        onDismiss={dismissWelcome}
      />
    {/if}
    {#if newProjectState.show}
      <NewProjectDialog
        templates={newProjectState.templates}
        onClose={() => { newProjectState.show = false; }}
      />
    {/if}
  </div>

  <!-- Status Bar with Panel Toggles -->
  <div class="status-bar">
    <div class="status-left">
      <button
        class="status-toggle"
        class:active={panelState.showSidebar}
        onclick={() => (panelState.showSidebar = !panelState.showSidebar)}
        title="Cmd+B"
      >
        Project
      </button>
      <button
        class="status-toggle"
        class:active={panelState.showTerminal}
        onclick={() => (panelState.showTerminal = !panelState.showTerminal)}
        title="Cmd+`"
      >
        Terminal / AI
      </button>
      <button
        class="status-toggle"
        class:active={panelState.showPreview}
        onclick={() => (panelState.showPreview = !panelState.showPreview)}
        title="Cmd+Shift+P"
      >
        Preview
      </button>
    </div>
    <div class="status-right">
      {#if !tabState.isSaved}
        <span class="status-info status-unsaved">Unsaved</span>
      {:else if tabState.lastSaveTime}
        <span class="status-info">Saved {tabState.lastSaveTime}</span>
      {/if}
      {#if tabState.currentFile}
        <span class="status-info">{tabState.currentFile.split('/').pop()}</span>
      {/if}
    </div>
  </div>
</div>

<style>
  .vswrite-app {
    display: flex;
    flex-direction: column;
    height: 100vh;
    background: #fafafa;
    color: #1a1a1a;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', sans-serif;
  }

  /* macOS: draggable titlebar area */
  .titlebar-drag-region {
    -webkit-app-region: drag;
    height: 40px;
    flex-shrink: 0;
    background: #ffffff;
  }

  .vswrite-container {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  /* Toolbar */
  .vswrite-container :global(.toolbar) {
    -webkit-app-region: no-drag;
    padding: 6px 20px;
    flex-wrap: wrap;
    background: #ffffff;
    border-bottom: 1px solid #f0f0f0;
  }

  .toolbar-right {
    display: flex;
    align-items: center;
    gap: 2px;
    margin-left: auto;
  }

  .toolbar-icon-btn {
    width: 32px;
    height: 32px;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: #999;
    cursor: pointer;
    font-size: 15px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s;
  }

  .toolbar-icon-btn:hover {
    background: #f5f5f5;
    color: #555;
  }

  .toolbar-icon-btn.active {
    background: #eef4ff;
    color: #4f7df9;
  }

  /* ─── Main Content Area ─── */
  .app-body {
    flex: 1;
    display: flex;
    overflow: hidden;
    background: #ffffff;
  }

  .app-body.hidden {
    display: none;
  }

  /* ─── Sidebar ─── */
  .panel-sidebar {
    flex-shrink: 0;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    background: #fafafa;
    border-right: 1px solid #f0f0f0;
  }

  .sidebar-tabs {
    display: flex;
    padding: 4px 4px 0;
    gap: 0;
    flex-shrink: 0;
    overflow-x: auto;
    overflow-y: hidden;
    min-height: 34px;
    scrollbar-width: none; /* Firefox */
  }

  .sidebar-tabs::-webkit-scrollbar {
    display: none; /* Chrome/Safari */
  }

  .sidebar-tab {
    padding: 6px 10px;
    border: none;
    background: transparent;
    color: #999;
    cursor: pointer;
    font-size: 11px;
    font-family: inherit;
    font-weight: 500;
    white-space: nowrap;
    flex-shrink: 0;
    border-bottom: 2px solid transparent;
    border-radius: 6px 6px 0 0;
    transition: all 0.15s;
  }

  .sidebar-tab:hover {
    color: #555;
    background: rgba(0, 0, 0, 0.02);
  }

  .sidebar-tab.active {
    color: #1a1a1a;
    border-bottom-color: #4f7df9;
    background: #ffffff;
  }

  .sidebar-body {
    flex: 1;
    overflow: hidden;
    background: #fafafa;
  }

  /* ─── Editor ─── */
  .panel-editor {
    flex: 1;
    min-width: 300px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    background: #ffffff;
  }

  .panel-editor :global(.editor-container) {
    flex: 1;
    overflow-y: auto;
    padding: 56px 72px;
  }

  .panel-editor :global(.editor-container.hidden) {
    display: none;
  }

  /* ─── Tab Bar ─── */
  .tab-bar {
    display: flex;
    background: #fafafa;
    border-bottom: 1px solid #f0f0f0;
    flex-shrink: 0;
    overflow-x: auto;
    scrollbar-width: none;
  }

  .tab-bar::-webkit-scrollbar { display: none; }

  .editor-tab {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border: none;
    background: transparent;
    color: #999;
    cursor: pointer;
    font-size: 12px;
    font-family: inherit;
    white-space: nowrap;
    border-bottom: 2px solid transparent;
    transition: all 0.1s;
    flex-shrink: 0;
  }

  .editor-tab:hover {
    color: #555;
    background: rgba(0, 0, 0, 0.02);
  }

  .editor-tab.active {
    color: #333;
    border-bottom-color: #4f7df9;
    background: #ffffff;
  }

  .tab-close {
    width: 16px;
    height: 16px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: #ccc;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    opacity: 0;
    transition: all 0.1s;
  }

  .editor-tab:hover .tab-close { opacity: 1; }
  .tab-close:hover { background: #eee; color: #555; }

  /* ─── Context Menu ─── */
  .context-overlay {
    position: fixed;
    inset: 0;
    z-index: 200;
  }

  .context-menu {
    position: absolute;
    background: #fff;
    border: 1px solid #e5e5e5;
    border-radius: 8px;
    padding: 4px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
    min-width: 160px;
    z-index: 201;
  }

  .context-item {
    display: block;
    width: 100%;
    padding: 6px 12px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: #333;
    cursor: pointer;
    font-size: 13px;
    font-family: inherit;
    text-align: left;
  }

  .context-item:hover {
    background: #4f7df9;
    color: #fff;
  }

  .panel-editor :global(.editor) {
    max-width: 680px;
    margin: 0 auto;
    min-height: 100%;
    outline: none;
  }

  /* ─── Preview ─── */
  .panel-preview {
    flex-shrink: 0;
    overflow: hidden;
    border-left: 1px solid #f0f0f0;
  }

  /* ─── Terminal ─── */
  .panel-terminal {
    flex-shrink: 0;
    overflow: hidden;
    border-top: 1px solid #e8e8e8;
  }

  /* ─── Focus Mode ─── */
  .focus-exit-btn {
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 8px 18px;
    border: none;
    border-radius: 20px;
    background: #f5f5f5;
    color: #999;
    cursor: pointer;
    font-size: 12px;
    font-family: inherit;
    z-index: 100;
    transition: all 0.2s;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
  }

  .focus-exit-btn:hover {
    background: #eee;
    color: #555;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  /* ─── Status Bar ─── */
  .status-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 32px;
    padding: 0 6px;
    background: #ffffff;
    border-top: 1px solid #f0f0f0;
    font-size: 12px;
    color: #999;
    flex-shrink: 0;
  }

  .status-left {
    display: flex;
    align-items: center;
    gap: 2px;
  }

  .status-right {
    display: flex;
    align-items: center;
    gap: 12px;
    padding-right: 12px;
  }

  .status-toggle {
    height: 26px;
    padding: 0 12px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: #aaa;
    cursor: pointer;
    font-size: 12px;
    font-family: inherit;
    font-weight: 500;
    transition: all 0.15s;
  }

  .status-toggle:hover {
    background: #f5f5f5;
    color: #666;
  }

  .status-toggle.active {
    background: #eef4ff;
    color: #4f7df9;
  }

  .status-info {
    font-size: 11px;
    color: #bbb;
  }

  .status-unsaved {
    color: #e88a3a;
    font-weight: 500;
  }
</style>
