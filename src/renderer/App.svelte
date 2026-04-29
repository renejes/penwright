<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import Toolbar from '../editor/components/Toolbar.svelte';
  import ShortcutCheatsheet from '../editor/components/ShortcutCheatsheet.svelte';
  import SettingsPanel from '../editor/components/SettingsPanel.svelte';
  import SearchReplace from '../editor/components/SearchReplace.svelte';
  import ProjectSearchPanel from './components/ProjectSearchPanel.svelte';
  import QuickSettings from '../editor/components/QuickSettings.svelte';
  import WelcomeScreen from '../editor/components/WelcomeScreen.svelte';
  import Sidebar from './components/Sidebar.svelte';
  import OutlinePanel from './components/OutlinePanel.svelte';
  import IncludesPanel from './components/IncludesPanel.svelte';
  import ProjectPanel from './components/ProjectPanel.svelte';
  import CommentsPanel from './components/CommentsPanel.svelte';
  import PreviewPanel from './components/PreviewPanel.svelte';
  import TerminalPanel from './components/TerminalPanel.svelte';
  import TextFileViewer from './components/TextFileViewer.svelte';
  import PdfFileViewer from './components/PdfFileViewer.svelte';
  import NewProjectDialog from './components/NewProjectDialog.svelte';
  import LicenseDialog from './components/LicenseDialog.svelte';
  import AboutDialog from './components/AboutDialog.svelte';
  import ExportDialog from './components/ExportDialog.svelte';
  import CitationHoverCard from './components/CitationHoverCard.svelte';
  import ReferencePicker from './components/ReferencePicker.svelte';
  import CrashReportDialog from './components/CrashReportDialog.svelte';
  import ResizeHandle from './components/ResizeHandle.svelte';
  import StartScreen from './components/StartScreen.svelte';
  import { createEditor, setEditorLanguage } from '../editor/lib/editor';
  import { serializeTypstCached } from '../editor/lib/serializer';
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
    exportDialogState,
    projectSearchPreset,
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
  import { setCommentMarks, type CommentMark } from '../editor/lib/commentDecorations';

  // ─── Local State ───────────────────────────────
  let editorElement: HTMLDivElement;
  let debounceTimer: ReturnType<typeof setTimeout>;
  let panelSaveTimer: ReturnType<typeof setTimeout>;

  // Citation hover preview — shown when the user dwells on an `@citekey`
  // badge. Position is captured at the moment the badge dispatches its hover
  // event (we don't track scroll, so the popover is intentionally short-lived).
  let citationHover = $state<{
    citekey: string;
    rect: { left: number; right: number; top: number; bottom: number; width: number; height: number };
  } | null>(null);

  // Cross-reference picker — shown via slash command (`/Reference`),
  // menu (`Edit → Insert Reference…` / `Cmd+Alt+L`), or window event.
  let showReferencePicker = $state(false);

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

  // Word count + reading time. We walk the editor's JSON instead of using
  // editor.getText() so we can skip raw Typst blocks and code blocks —
  // their content isn't prose and shouldn't inflate the count.
  function extractProseText(node: { type?: string; text?: string; content?: unknown[] } | null): string[] {
    if (!node) return [];
    if (node.type === 'typstRawBlock' || node.type === 'codeBlock' || node.type === 'pagebreak') return [];
    if (typeof node.text === 'string') return [node.text];
    if (Array.isArray(node.content)) {
      return node.content.flatMap((c) => extractProseText(c as { type?: string; text?: string; content?: unknown[] }));
    }
    return [];
  }

  let wordStats = $derived.by(() => {
    // Tracks editor mutations so the count stays live while typing.
    void editorVersion.value;
    const editor = editorRef.current;
    if (!editor || !hasFileOpen) return { words: 0, minutes: 0 };
    try {
      const text = extractProseText(editor.getJSON() as { content?: unknown[] }).join(' ');
      const words = text.trim().split(/\s+/).filter(Boolean).length;
      const minutes = words === 0 ? 0 : Math.max(1, Math.round(words / 200));
      return { words, minutes };
    } catch {
      return { words: 0, minutes: 0 };
    }
  });

  // IPC adapter for CommandHub/QuickSettings compatibility
  const vscodeBridge = {
    postMessage(msg: unknown) {
      ipc.send(msg as import('../editor/lib/messages').WebviewMessage);
    },
    getState(): unknown { return null; },
    setState(_state: unknown) {},
  };

  // ─── Crash-report dialog state ─────────────────────
  // On boot we ask main if there's a fresh, unshown crash report. If yes,
  // we display it once, then mark it shown so it won't reappear next boot.
  // Reports stay on disk in <userData>/crash-reports/ until the user
  // explicitly discards them via the dialog.
  type CrashReport = { content: string; filename: string; ts: number };
  let pendingCrash: CrashReport | null = $state(null);

  async function dismissCrashDialog() {
    pendingCrash = null;
    try {
      await (window as unknown as { electronAPI: { invoke: (c: string) => Promise<unknown> } })
        .electronAPI.invoke('crash:markShown');
    } catch {
      /* ignore */
    }
  }

  onMount(() => {
    (window as unknown as Record<string, unknown>).vswriteApi = vscodeBridge;

    // Check for a previous-session crash before doing anything else.
    (async () => {
      try {
        const api = (window as unknown as { electronAPI: { invoke: (c: string) => Promise<unknown> } }).electronAPI;
        const report = await api.invoke('crash:getLatest') as CrashReport | null;
        if (report) pendingCrash = report;
      } catch {
        /* ignore — never block boot on crash detection */
      }
    })();

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
    window.addEventListener('vswrite:project-search-jump', handleProjectSearchJump as EventListener);
    window.addEventListener('vswrite:add-comment', addCommentFromSelection as EventListener);
    window.addEventListener('vswrite:find-backlinks', handleFindBacklinks as EventListener);
    window.addEventListener('vswrite:citation-hover', handleCitationHover as EventListener);
    window.addEventListener('vswrite:open-reference-picker', handleOpenReferencePicker as EventListener);
    window.addEventListener('vswrite:comment-created', onCommentCreatedAtApp as EventListener);

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

      // Validate license on startup
      electronAPI.invoke('license:validate').then((result) => {
        if (result && typeof result === 'object') {
          const r = result as { status: string; tier: string | null; key: string | null; message?: string };
          uiState.licenseStatus = r.status;
          uiState.licenseTier = r.tier;
          uiState.licenseKey = r.key;
          uiState.licenseMessage = r.message || '';
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
    const typst = serializeTypstCached(editor.state.doc);
    if (!typst && editor.state.doc.content.size > 2) {
      console.error('[vswrite] Serializer produced empty output — skipping save');
      return;
    }
    tabState.currentContent = typst;
    ipc.send({ type: 'edit', content: typst });
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

  function toggleReadingMode() {
    uiState.readingMode = !uiState.readingMode;
  }

  // ─── Add Comment ────────────────────────────────
  // Anchor the comment to the current selection (preferred) or the word
  // under the cursor (fallback). Computes a source-offset hint by walking
  // the document up to the selection, which the backend uses as a starting
  // point for re-locating the anchor on later opens.
  async function addCommentFromSelection() {
    const editor = editorRef.current;
    if (!editor || !tabState.currentFile) {
      alert('Bitte zuerst eine Datei öffnen.');
      return;
    }
    const { state } = editor;
    let { from, to } = state.selection;
    let anchorText = state.doc.textBetween(from, to, ' ', ' ').trim();

    // No selection → expand to the surrounding word
    if (!anchorText) {
      const resolved = state.doc.resolve(from);
      const parent = resolved.parent;
      const text = parent.textBetween(0, parent.content.size, ' ', ' ');
      const offsetInParent = resolved.parentOffset;
      let start = offsetInParent;
      let end = offsetInParent;
      while (start > 0 && /\S/.test(text[start - 1])) start--;
      while (end < text.length && /\S/.test(text[end])) end++;
      anchorText = text.slice(start, end);
      if (!anchorText) {
        alert('Bitte Text markieren, der kommentiert werden soll.');
        return;
      }
    }

    if (anchorText.length > 200) anchorText = anchorText.slice(0, 200);

    // Best-effort source-offset hint: the byte position in the live source.
    const rangeStart = Math.max(0, tabState.currentContent.indexOf(anchorText));
    const rangeEnd = rangeStart + anchorText.length;

    const projectInfo = await (window as unknown as {
      electronAPI: { invoke(channel: string, ...args: unknown[]): Promise<unknown> };
    }).electronAPI.invoke('project:getInfo') as { projectDir: string | null };
    if (!projectInfo.projectDir) {
      alert('Kein Projekt geöffnet.');
      return;
    }

    const rel = tabState.currentFile.startsWith(projectInfo.projectDir + '/')
      ? tabState.currentFile.slice(projectInfo.projectDir.length + 1)
      : tabState.currentFile.replace(/^.*\//, '');

    const api = (window as unknown as {
      electronAPI: { invoke(channel: string, ...args: unknown[]): Promise<unknown> };
    }).electronAPI;
    const created = await api.invoke('comments:create', {
      file: rel.replace(/\\/g, '/'),
      anchor: anchorText,
      rangeStart,
      rangeEnd,
      body: '',
    });

    if (!created) {
      alert('Kommentar konnte nicht angelegt werden.');
      return;
    }

    // Switch sidebar to Comments and let the panel scroll to the new entry
    panelState.showSidebar = true;
    panelState.sidebarTab = 'comments';
    window.dispatchEvent(new CustomEvent('vswrite:comment-created', { detail: created }));
  }

  // Backlinks trigger: OutlinePanel hover-button or citation right-click
  // dispatches `vswrite:find-backlinks` with `{ query, wholeWord, caseSensitive }`.
  // We seed the project-search preset (consumed-once on panel mount) and
  // open the panel.
  function handleFindBacklinks(e: Event) {
    const detail = (e as CustomEvent<{ query: string; wholeWord?: boolean; caseSensitive?: boolean }>).detail;
    if (!detail?.query) return;
    projectSearchPreset.query = detail.query;
    projectSearchPreset.wholeWord = !!detail.wholeWord;
    projectSearchPreset.caseSensitive = !!detail.caseSensitive;
    // If the panel is already open, force a remount so the preset is picked
    // up. Cheapest way: close + open via tick.
    if (uiState.showProjectSearch) {
      uiState.showProjectSearch = false;
      requestAnimationFrame(() => { uiState.showProjectSearch = true; });
    } else {
      uiState.showProjectSearch = true;
    }
  }

  // Citation hover trigger: a badge dwell-fired `vswrite:citation-hover`.
  // We just store the citekey + viewport rect; CitationHoverCard owns the
  // close-with-grace-period logic so the user can move the mouse from badge
  // to card without it disappearing.
  function handleCitationHover(e: Event) {
    const detail = (e as CustomEvent<{
      citekey: string;
      rect: { left: number; right: number; top: number; bottom: number; width: number; height: number };
    }>).detail;
    if (!detail?.citekey || !detail.rect) return;
    citationHover = { citekey: detail.citekey, rect: detail.rect };
  }

  function closeCitationHover() {
    citationHover = null;
  }

  // Cross-reference picker — opened from `/Reference` slash command, the
  // `Edit → Insert Reference…` menu (Cmd+Alt+L), or the window event from
  // messageHandler. The picker calls back via `onPick` with the chosen
  // ProjectLabel; we then insert a `reference` node at the current cursor.
  function handleOpenReferencePicker() {
    if (!editorRef.current) return;
    showReferencePicker = true;
  }

  interface PickedLabel {
    label: string;
    type: 'figure' | 'table' | 'equation' | 'heading' | 'other';
    caption: string;
    relPath: string;
    line: number;
  }

  function insertReferenceFromPicker(picked: PickedLabel) {
    showReferencePicker = false;
    const editor = editorRef.current;
    if (!editor) return;
    editor
      .chain()
      .focus()
      .insertContent({
        type: 'reference',
        attrs: {
          label: picked.label,
          caption: picked.caption,
          refType: picked.type,
        },
      })
      .run();
  }

  // Comment-mark loading lives at the App level so highlights appear as soon
  // as a file opens, regardless of whether the Comments sidebar tab has ever
  // been mounted. Without this, marks only became visible after the user
  // clicked the Comments tab once — because that's where setCommentMarks was
  // first called. CommentsPanel still does its own push on CRUD, which is
  // idempotent (setCommentMarks just overwrites the plugin state).
  interface RawCommentEntry {
    id: string;
    file: string;
    anchor: string;
    resolved: boolean;
    orphaned?: boolean;
  }

  async function refreshCommentMarks() {
    const editor = editorRef.current;
    if (!editor) return;
    const apiRef = (window as unknown as {
      electronAPI?: { invoke(channel: string, ...args: unknown[]): Promise<unknown> };
    }).electronAPI;
    if (!apiRef) return;

    if (!tabState.currentFile) {
      setCommentMarks(editor, []);
      return;
    }

    try {
      const info = await apiRef.invoke('project:getInfo') as { projectDir: string | null };
      if (!info.projectDir || !tabState.currentFile.startsWith(info.projectDir + '/')) {
        setCommentMarks(editor, []);
        return;
      }
      const rel = tabState.currentFile.slice(info.projectDir.length + 1).replace(/\\/g, '/');
      const list = await apiRef.invoke('comments:list', {
        forFile: rel,
        includeResolved: false,
      }) as RawCommentEntry[];
      const marks: CommentMark[] = list
        .filter((c) => c.file === rel)
        .map((c) => ({ id: c.id, anchor: c.anchor, resolved: c.resolved, orphaned: c.orphaned }));
      setCommentMarks(editor, marks);
    } catch (err) {
      console.warn('[vswrite] refreshCommentMarks failed:', err);
    }
  }

  // Re-load and re-push marks whenever the current file changes. Editor mount
  // is async, so we delay one frame to let the new doc content settle before
  // computing decorations against it.
  $effect(() => {
    void tabState.currentFile;
    void editorRef.current;
    requestAnimationFrame(() => { void refreshCommentMarks(); });
  });

  function onCommentCreatedAtApp() {
    void refreshCommentMarks();
  }

  function openPdfTabFromHover(filePath: string) {
    const api = (window as unknown as {
      electronAPI: { invoke(channel: string, ...args: unknown[]): Promise<unknown> };
    }).electronAPI;
    api.invoke('filetree:open', filePath).then((result) => {
      if (result === 'pdfviewer') {
        openTab(filePath, 'pdf');
      }
    });
  }

  // Project Search → after the file opens, scroll the editor to the first
  // occurrence of the match text so the user can see context. Editor mount
  // is async, so we retry a few times before giving up.
  function handleProjectSearchJump(e: Event) {
    const detail = (e as CustomEvent<{ matchText: string }>).detail;
    if (!detail?.matchText) return;
    let attempts = 0;
    const tryScroll = () => {
      const editor = editorRef.current;
      const root = editor?.view.dom;
      if (!root) {
        if (attempts++ < 20) setTimeout(tryScroll, 100);
        return;
      }
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
      const target = detail.matchText;
      let node: Node | null;
      while ((node = walker.nextNode())) {
        const text = node.textContent || '';
        const idx = text.indexOf(target);
        if (idx >= 0) {
          const range = document.createRange();
          range.setStart(node, idx);
          range.setEnd(node, idx + target.length);
          const rect = range.getBoundingClientRect();
          const container = root.closest('.editor-container');
          if (container) {
            const containerRect = container.getBoundingClientRect();
            const offset = rect.top - containerRect.top + container.scrollTop - containerRect.height / 3;
            container.scrollTo({ top: offset, behavior: 'smooth' });
          } else {
            (node.parentElement as HTMLElement | null)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
          return;
        }
      }
      if (attempts++ < 8) setTimeout(tryScroll, 120);
    };
    setTimeout(tryScroll, 80);
  }

  function handleGlobalKeydown(e: KeyboardEvent) {
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.shiftKey && (e.key === 'f' || e.key === 'F')) {
      e.preventDefault();
      uiState.showProjectSearch = true;
      return;
    }
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
    if (mod && e.altKey && (e.key === 'r' || e.key === 'R')) {
      e.preventDefault();
      toggleReadingMode();
    }
    if (mod && e.altKey && (e.key === 'l' || e.key === 'L')) {
      e.preventDefault();
      handleOpenReferencePicker();
    }
    if (e.key === 'Escape') {
      if (uiState.focusMode) uiState.focusMode = false;
      if (uiState.typewriterMode) uiState.typewriterMode = false;
    }
  }

  // ─── Start Screen Handlers ─────────────────────

  function handleStartNewProject() {
    ipc.send({ type: 'newProject' });
  }

  function handleStartOpenProject() {
    const api = (window as unknown as { electronAPI: { invoke(channel: string, ...args: unknown[]): Promise<unknown> } }).electronAPI;
    api.invoke('project:open');
  }

  function handleStartOpenSample() {
    const api = (window as unknown as { electronAPI: { invoke(channel: string, ...args: unknown[]): Promise<unknown> } }).electronAPI;
    api.invoke('project:openSample');
  }

  function handleStartOpenRecent(folderPath: string) {
    const api = (window as unknown as { electronAPI: { invoke(channel: string, ...args: unknown[]): Promise<unknown> } }).electronAPI;
    api.invoke('project:open', folderPath);
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
    window.removeEventListener('vswrite:project-search-jump', handleProjectSearchJump as EventListener);
    window.removeEventListener('vswrite:add-comment', addCommentFromSelection as EventListener);
    window.removeEventListener('vswrite:find-backlinks', handleFindBacklinks as EventListener);
    window.removeEventListener('vswrite:citation-hover', handleCitationHover as EventListener);
    window.removeEventListener('vswrite:open-reference-picker', handleOpenReferencePicker as EventListener);
    window.removeEventListener('vswrite:comment-created', onCommentCreatedAtApp as EventListener);
    editorRef.current?.destroy();
  });
</script>

<div class="vswrite-app">
  <!-- Titlebar drag region (macOS hiddenInset) -->
  <div class="titlebar-drag-region"></div>

  <div class="vswrite-container" class:focus-mode={uiState.focusMode} class:typewriter-mode={uiState.typewriterMode} class:reading-mode={uiState.readingMode}>
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
              class:active={uiState.readingMode}
              onclick={toggleReadingMode}
              title="Reading Mode (Cmd+Alt+R)"
              aria-pressed={uiState.readingMode}
            >
              &#x1D4E1;
            </button>
            <button
              class="toolbar-icon-btn"
              onclick={toggleFocusMode}
              title="Focus Mode"
            >
              &#9678;
            </button>
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

    {#if uiState.showProjectSearch}
      <ProjectSearchPanel onClose={() => (uiState.showProjectSearch = false)} />
    {/if}

    <!-- Start Screen (when no file is open) -->
    {#if !hasFileOpen}
      <StartScreen
        onNewProject={handleStartNewProject}
        onOpenProject={handleStartOpenProject}
        onOpenSample={handleStartOpenSample}
        onOpenRecent={handleStartOpenRecent}
      />
    {/if}

    <!-- Main content area with panels (always in DOM so TipTap editor element is available at onMount) -->
    <div class="app-body" class:hidden={!hasFileOpen}>
      <!-- Sidebar -->
      {#if panelState.showSidebar}
        <div class="panel-sidebar" style="width: {panelState.sidebarWidth}px">
          <div class="sidebar-tabs" role="tablist" aria-label="Sidebar panels">
            <button class="sidebar-tab" class:active={panelState.sidebarTab === 'files'} onclick={() => panelState.sidebarTab = 'files'} role="tab" aria-selected={panelState.sidebarTab === 'files'} aria-label="Files panel">Files</button>
            <button class="sidebar-tab" class:active={panelState.sidebarTab === 'outline'} onclick={() => panelState.sidebarTab = 'outline'} role="tab" aria-selected={panelState.sidebarTab === 'outline'} aria-label="Outline panel">Outline</button>
            <button class="sidebar-tab" class:active={panelState.sidebarTab === 'includes'} onclick={() => panelState.sidebarTab = 'includes'} role="tab" aria-selected={panelState.sidebarTab === 'includes'} aria-label="Chapters panel">Chapters</button>
            <button class="sidebar-tab" class:active={panelState.sidebarTab === 'git'} onclick={() => panelState.sidebarTab = 'git'} role="tab" aria-selected={panelState.sidebarTab === 'git'} aria-label="Project panel">Project</button>
            <button class="sidebar-tab" class:active={panelState.sidebarTab === 'comments'} onclick={() => panelState.sidebarTab = 'comments'} role="tab" aria-selected={panelState.sidebarTab === 'comments'} aria-label="Comments panel">Comments</button>
          </div>
          <div class="sidebar-body">
            {#if panelState.sidebarTab === 'files'}
              <Sidebar onFileOpen={handleFileOpen} onContextMenu={showContextMenu} currentFile={tabState.currentFile} />
            {:else if panelState.sidebarTab === 'outline'}
              <OutlinePanel editor={editorRef.current} editorVersion={editorVersion.value} />
            {:else if panelState.sidebarTab === 'includes'}
              <IncludesPanel content={tabState.currentContent} currentFile={tabState.currentFile} />
            {:else if panelState.sidebarTab === 'git'}
              <ProjectPanel />
            {:else if panelState.sidebarTab === 'comments'}
              <CommentsPanel />
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
          <div class="tab-bar" role="tablist" aria-label="Open files">
            {#each tabState.openTabs as tab, i}
              <div
                class="editor-tab"
                class:active={i === tabState.activeTabIndex}
                onclick={() => switchToTab(i)}
                onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); switchToTab(i); } }}
                title={tab.path}
                role="tab"
                tabindex="0"
                aria-selected={i === tabState.activeTabIndex}
                aria-label={tabName(tab)}
              >
                <span class="tab-label">{tabName(tab)}</span>
                <span
                  class="tab-close"
                  onclick={(e) => { e.stopPropagation(); closeTab(i); }}
                  onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); closeTab(i); } }}
                  title="Close"
                  role="button"
                  tabindex="0"
                  aria-label="Close {tabName(tab)}"
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
            pdfData={previewState.pdfData}
            error={previewState.error}
            compiling={previewState.compiling}
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
    {#if uiState.showLicense}
      <LicenseDialog
        onClose={() => { uiState.showLicense = false; }}
      />
    {/if}
    {#if uiState.showAbout}
      <AboutDialog
        onClose={() => { uiState.showAbout = false; }}
      />
    {/if}
    {#if pendingCrash}
      <CrashReportDialog
        content={pendingCrash.content}
        filename={pendingCrash.filename}
        onClose={dismissCrashDialog}
      />
    {/if}
    {#if exportDialogState.show && exportDialogState.sections}
      <ExportDialog
        initialFormat={exportDialogState.format}
        sections={exportDialogState.sections}
        onClose={() => { exportDialogState.show = false; }}
      />
    {/if}
    {#if citationHover}
      <CitationHoverCard
        citekey={citationHover.citekey}
        rect={citationHover.rect}
        onClose={closeCitationHover}
        onOpenPdf={openPdfTabFromHover}
      />
    {/if}
    {#if showReferencePicker}
      <ReferencePicker
        onClose={() => (showReferencePicker = false)}
        onPick={insertReferenceFromPicker}
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
        aria-label="Toggle project sidebar"
        aria-pressed={panelState.showSidebar}
      >
        Project
      </button>
      <button
        class="status-toggle"
        class:active={panelState.showTerminal}
        onclick={() => (panelState.showTerminal = !panelState.showTerminal)}
        title="Cmd+`"
        aria-label="Toggle terminal panel"
        aria-pressed={panelState.showTerminal}
      >
        Terminal / AI
      </button>
      <button
        class="status-toggle"
        class:active={panelState.showPreview}
        onclick={() => (panelState.showPreview = !panelState.showPreview)}
        title="Cmd+Shift+P"
        aria-label="Toggle preview panel"
        aria-pressed={panelState.showPreview}
      >
        Preview
      </button>
    </div>
    <div class="status-right">
      {#if hasFileOpen && wordStats.words > 0}
        <span class="status-info" title="Word count · estimated reading time at 200 wpm">
          {wordStats.words.toLocaleString()} {wordStats.words === 1 ? 'word' : 'words'} · {wordStats.minutes} min read
        </span>
      {/if}
      {#if uiState.exporting}
        <span class="status-info status-exporting" aria-live="polite">Exporting {uiState.exportFormat.toUpperCase()}...</span>
      {:else if !tabState.isSaved}
        <span class="status-info status-unsaved">Unsaved</span>
      {:else if tabState.lastSaveTime}
        <span class="status-info">Saved {tabState.lastSaveTime}</span>
      {/if}
      {#if tabState.currentFile}
        <span class="status-info">{tabState.currentFile.split('/').pop()}</span>
      {/if}
      <button
        class="status-toggle"
        class:licensed={uiState.licenseStatus === 'active'}
        onclick={() => (uiState.showLicense = true)}
        title="License"
      >
        {#if uiState.licenseStatus === 'active'}
          {uiState.licenseTier === 'pro' ? 'Pro' : 'Licensed'}
        {:else}
          Unlicensed
        {/if}
      </button>
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

  .status-exporting {
    color: #4f7df9;
    font-weight: 500;
    animation: pulse 1.2s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  .status-toggle.licensed {
    color: #2e7d32;
  }
</style>
