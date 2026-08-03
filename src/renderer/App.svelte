<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import Toolbar from '../editor/components/Toolbar.svelte';
  import ShortcutCheatsheet from '../editor/components/ShortcutCheatsheet.svelte';
  import SettingsPanel from '../editor/components/SettingsPanel.svelte';
  import SearchReplace from '../editor/components/SearchReplace.svelte';
  import ProjectSearchPanel from './components/ProjectSearchPanel.svelte';
  import WelcomeScreen from '../editor/components/WelcomeScreen.svelte';
  import Sidebar from './components/Sidebar.svelte';
  import OutlinePanel from './components/OutlinePanel.svelte';
  import IncludesPanel from './components/IncludesPanel.svelte';
  import ProjectPanel from './components/ProjectPanel.svelte';
  import CommentsPanel from './components/CommentsPanel.svelte';
  import DesignPanel from './components/DesignPanel.svelte';
  import PreviewPanel from './components/PreviewPanel.svelte';
  import TextFileViewer from './components/TextFileViewer.svelte';
  import PdfFileViewer from './components/PdfFileViewer.svelte';
  import NewProjectDialog from './components/NewProjectDialog.svelte';
  import SavePresetDialog from './components/SavePresetDialog.svelte';
  import LicenseDialog from './components/LicenseDialog.svelte';
  import UsageDialog from './components/UsageDialog.svelte';
  import AboutDialog from './components/AboutDialog.svelte';
  import HandbookViewer from './components/HandbookViewer.svelte';
  import ExportDialog from './components/ExportDialog.svelte';
  import CitationHoverCard from './components/CitationHoverCard.svelte';
  import ReferencePicker from './components/ReferencePicker.svelte';
  import CrashReportDialog from './components/CrashReportDialog.svelte';
  import McpSetupWizard from './components/McpSetupWizard.svelte';
  import McpConnectionDialog from './components/McpConnectionDialog.svelte';
  import OnboardingWizard from './components/OnboardingWizard.svelte';
  import LookStatus from './components/LookStatus.svelte';
  import DesignAiPopover from './components/DesignAiPopover.svelte';
  import SectionLookEditor from './components/SectionLookEditor.svelte';
  import ResizeHandle from './components/ResizeHandle.svelte';
  import StartScreen from './components/StartScreen.svelte';
  import { t, applyLocale, i18nState, setLocale } from '@shared/i18n/store.svelte';
  import { createEditor } from '../editor/lib/editor';
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
    savePresetState,
    exportDialogState,
    projectSearchPreset,
    zoomState,
    ZOOM_MIN,
    ZOOM_MAX,
    setEditorZoom,
    zoomEditorIn,
    zoomEditorOut,
    resetEditorZoom,
    openTab,
    closeTab,
    tabName,
    switchToTab,
    resizeBase,
    startSidebarResize,
    onSidebarResize,
    startPreviewResize,
    onPreviewResize,
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

  // Editor-zoom popover shown when the user clicks the "100%" badge in the
  // status bar. The popover is a sibling of the badge, positioned via flex.
  let showEditorZoomPopover = $state(false);

  // ─── Per-project preferences (zoom levels) ──────
  // Loaded when a project's first file opens; saved (debounced) whenever
  // either zoom level changes. Tracked by projectDir so reopening a project
  // restores its last-used zoom and switching files within a project doesn't
  // re-load.
  let loadedPrefsForProject = '';
  let prefsSaveTimer: ReturnType<typeof setTimeout>;

  async function loadProjectPreferences(projectDir: string) {
    if (!projectDir || projectDir === loadedPrefsForProject) return;
    loadedPrefsForProject = projectDir;
    try {
      const api = (window as unknown as { electronAPI: { invoke(channel: string, ...args: unknown[]): Promise<unknown> } }).electronAPI;
      const prefs = await api.invoke('project:getPreferences') as { editorZoom?: number; pdfZoom?: number; pdfSpread?: boolean } | null;
      if (prefs) {
        if (typeof prefs.editorZoom === 'number') zoomState.editor = prefs.editorZoom;
        if (typeof prefs.pdfZoom === 'number') zoomState.pdf = prefs.pdfZoom;
        zoomState.spread = prefs.pdfSpread === true;
      }
    } catch (err) {
      console.warn('[penwright] loadProjectPreferences failed:', err);
    }
  }

  // Debounced save: any change to either zoom persists to the current project.
  $effect(() => {
    const snapshot = { editorZoom: zoomState.editor, pdfZoom: zoomState.pdf, pdfSpread: zoomState.spread };
    if (!loadedPrefsForProject) return;
    clearTimeout(prefsSaveTimer);
    prefsSaveTimer = setTimeout(() => {
      const api = (window as unknown as { electronAPI?: { invoke(channel: string, ...args: unknown[]): Promise<unknown> } }).electronAPI;
      api?.invoke('project:setPreferences', snapshot);
    }, 400);
  });

  // Trigger preference load when the current file's project changes.
  $effect(() => {
    void tabState.currentFile;
    if (!tabState.currentFile) return;
    const api = (window as unknown as { electronAPI?: { invoke(channel: string, ...args: unknown[]): Promise<unknown> } }).electronAPI;
    api?.invoke('project:getInfo').then((info) => {
      const projectDir = (info as { projectDir?: string } | null)?.projectDir || '';
      if (projectDir) void loadProjectPreferences(projectDir);
    });
  });

  // Debounced panel state persistence
  $effect(() => {
    // Access all reactive fields to track them
    const snapshot = {
      showSidebar: panelState.showSidebar,
      showPreview: panelState.showPreview,
      sidebarTab: panelState.sidebarTab,
      sidebarWidth: panelState.sidebarWidth,
      previewWidth: panelState.previewWidth,
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
  let designViewerFile = $derived(activeTab?.type === 'design' ? activeTab.path : '');
  let hasFileOpen = $derived(tabState.openTabs.length > 0 || !!tabState.currentFile);

  // Bumped only on transactions that change the document (not cursor moves),
  // so derivations that depend on content don't re-run on every selection.
  let docVersion = $state(0);

  // Word count + reading time. PERF: walk the live ProseMirror doc directly
  // (no `editor.getJSON()` — that clones the whole document into plain objects
  // on every call) and recompute only when the document actually changes
  // (`docVersion`, bumped on `docChanged` transactions — not on cursor moves),
  // debounced so a fast typist on a long doc doesn't recount per keystroke.
  let wordStats = $state({ words: 0, minutes: 0 });
  let wordStatsTimer: ReturnType<typeof setTimeout> | undefined;

  function recomputeWordStats() {
    const editor = editorRef.current;
    if (!editor || !hasFileOpen) {
      wordStats = { words: 0, minutes: 0 };
      return;
    }
    let words = 0;
    editor.state.doc.descendants((node) => {
      const t = node.type.name;
      // Skip non-prose subtrees (their content isn't reading material).
      if (t === 'typstRawBlock' || t === 'codeBlock' || t === 'pagebreak') return false;
      if (node.isText && node.text) {
        const trimmed = node.text.trim();
        if (trimmed) words += trimmed.split(/\s+/).length;
      }
      return true;
    });
    const minutes = words === 0 ? 0 : Math.max(1, Math.round(words / 200));
    wordStats = { words, minutes };
  }

  $effect(() => {
    void docVersion;      // re-run only on real document changes
    void hasFileOpen;
    clearTimeout(wordStatsTimer);
    wordStatsTimer = setTimeout(recomputeWordStats, 400);
    return () => clearTimeout(wordStatsTimer);
  });

  // What the AI is doing, if anything. The one thing that flows MCP → app, and
  // it is display-only: the app never waits for it, defers to it, or locks
  // anything because of it. Until now the user watched the file tree flicker
  // and the preview recompile with no way to tell their own work from Claude's.
  let agentActivity = $state<{ what: string; files: string[] } | null>(null);

  $effect(() => {
    if (!hasFileOpen) { agentActivity = null; return; }
    const api = (window as unknown as { electronAPI?: { invoke(channel: string, ...args: unknown[]): Promise<unknown> } }).electronAPI;
    if (!api) return;
    const read = async () => {
      try {
        agentActivity = await api.invoke('agent:activity') as { what: string; files: string[] } | null;
      } catch { agentActivity = null; }
    };
    void read();
    const poll = setInterval(read, 4000);
    return () => clearInterval(poll);
  });

  // IPC adapter exposed as window.penwrightApi — used by the editor node-views
  // (image picker, etc.) that postMessage through the legacy VS Code bridge.
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

  // MCP setup wizard — auto-shown on first launch (or after MCP_SETUP_VERSION
  // bumps); also opens via Help → "Mit Claude Desktop verbinden…".
  let showMcpWizard = $state(false);
  // MCP connection picker (Meta-MCP vs Claude Code). Auto-shown on first run
  // until a target is chosen; also opens via Help → "MCP Connection…".
  let showMcpConnection = $state(false);
  // First-run onboarding tour (shown once, tracked via `onboardingSeen`).
  let showOnboarding = $state(false);
  // Design-with-AI handoff popover, positioned at the pinned selection.
  let designAiPopover = $state<{ x: number; y: number } | null>(null);
  // Chapter-look editor modal (opened by the "✎" in the status bar).
  let editChapterLook = $state<{ chapterPath: string; styleId: string } | null>(null);

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
    (window as unknown as Record<string, unknown>).penwrightApi = vscodeBridge;

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
      onTransaction({ docChanged }) {
        editorVersion.value++;
        if (docChanged) docVersion++;
        // Preview follows the cursor: as the caret moves across heading
        // boundaries, scroll the PDF to that section (debounced; skipped while
        // applying an external/AI edit, which already sets the scroll target).
        if (!isUpdatingFromExtension.value) scheduleHeadingFollow();
      },
      onUpdate() {
        if (isUpdatingFromExtension.value) return;
        // Mark the preview stale (used as a hint on the Refresh button, esp. in
        // manual mode where the preview won't recompile on its own).
        previewState.dirty = true;
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(sendUpdate, 300);
      },
    });

    ipc.onMessage(handleMessage);
    window.addEventListener('keydown', handleGlobalKeydown);
    window.addEventListener('penwright:project-search-jump', handleProjectSearchJump as EventListener);
    window.addEventListener('penwright:add-comment', addCommentFromSelection as EventListener);
    window.addEventListener('penwright:design-selection', pinSelectionForDesign as EventListener);
    window.addEventListener('penwright:find-backlinks', handleFindBacklinks as EventListener);
    window.addEventListener('penwright:citation-hover', handleCitationHover as EventListener);
    window.addEventListener('penwright:open-reference-picker', handleOpenReferencePicker as EventListener);
    window.addEventListener('penwright:insert-design-element', handleInsertDesignElement as EventListener);
    window.addEventListener('penwright:comment-created', onCommentCreatedAtApp as EventListener);
    window.addEventListener('penwright:project-closed', onProjectClosed as EventListener);
    // Named handlers (not inline closures) so onDestroy can remove them.
    window.addEventListener('penwright:external-write-overwritten', onExternalWriteOverwritten as EventListener);
    window.addEventListener('penwright:show-mcp-wizard', onShowMcpWizard);
    window.addEventListener('penwright:show-mcp-connection', onShowMcpConnection);
    window.addEventListener('penwright:show-onboarding', onShowOnboarding);
    window.addEventListener('penwright:edit-chapter-look', onEditChapterLook as EventListener);
    window.addEventListener('penwright:preview-jump', handlePreviewJump as EventListener);

    // Drag & Drop images into the editor
    document.addEventListener('dragover', onDocumentDragover);
    document.addEventListener('drop', onDocumentDrop);

    // Restore persisted panel state
    const electronAPI = (window as unknown as { electronAPI?: { invoke(channel: string, ...args: unknown[]): Promise<unknown> } }).electronAPI;
    if (electronAPI) {
      // Restore the persisted UI language (resolves OS locale on first launch).
      electronAPI.invoke('app:getLocale').then((loc) => {
        applyLocale(loc as string);
      }).catch(() => { /* keep navigator-based default */ });

      // Restore the preview-update mode (auto / manual).
      electronAPI.invoke('persist:getPreviewMode').then((m) => {
        if (m === 'manual' || m === 'auto') previewState.mode = m;
      }).catch(() => { /* keep default 'auto' */ });

      electronAPI.invoke('persist:getPanelState').then((stored) => {
        if (stored && typeof stored === 'object') {
          const s = stored as Record<string, unknown>;
          if (typeof s.showSidebar === 'boolean') panelState.showSidebar = s.showSidebar;
          if (typeof s.showPreview === 'boolean') panelState.showPreview = s.showPreview;
          if (typeof s.sidebarTab === 'string') panelState.sidebarTab = s.sidebarTab as typeof panelState.sidebarTab;
          if (typeof s.sidebarWidth === 'number') panelState.sidebarWidth = s.sidebarWidth;
          if (typeof s.previewWidth === 'number') panelState.previewWidth = s.previewWidth;
        }
      });

      // Validate the commercial licence on startup, then resolve the local
      // state. Nothing here gates anything — the app is complete and free for
      // personal use; this only labels the status bar and decides whether the
      // dismissible notice and the first-run usage question appear.
      // Validate first so the stored status is fresh before getEntitlement reads it.
      electronAPI.invoke('license:validate').then((result) => {
        if (result && typeof result === 'object') {
          const r = result as { status: string; tier: string | null; key: string | null; message?: string };
          uiState.licenseStatus = r.status;
          uiState.licenseTier = r.tier;
          uiState.licenseKey = r.key;
          uiState.licenseMessage = r.message || '';
        }
      }).finally(() => {
        electronAPI.invoke('license:getEntitlement').then((ent) => {
          if (ent && typeof ent === 'object') {
            const e = ent as {
              access: 'personal' | 'commercial';
              usage: 'personal' | 'commercial' | null;
              licenseDue: boolean;
            };
            uiState.licenseAccess = e.access;
            uiState.usageContext = e.usage;
            uiState.licenseDue = e.licenseDue;
          }
        });
      });

      // First-run onboarding tour, then the MCP setup probe. On the very first
      // launch only the onboarding shows; the MCP wizard is reachable from its
      // own step + the Help menu and only auto-pops on later launches, so two
      // modals never stack at boot.
      electronAPI.invoke('persist:isOnboardingSeen').then((seenVal) => {
        const seenAtBoot = !!seenVal;
        if (!seenAtBoot) {
          setTimeout(() => { if (!pendingCrash) showOnboarding = true; }, 700);
        }
        // MCP probes — delayed 2s so they never compete with the crash dialog
        // or the onboarding for attention. The connection picker (Meta-MCP vs
        // Claude Code) takes first-run priority; the Claude-Desktop wizard only
        // pops if the picker isn't showing, so two MCP modals never stack.
        setTimeout(async () => {
          if (pendingCrash || !seenAtBoot || showOnboarding) return;
          try {
            const cs = await electronAPI.invoke('mcp:getConnectionStatus') as { target: string | null; supported: boolean };
            if (cs?.target == null && cs?.supported) {
              showMcpConnection = true;
              return; // don't also pop the Claude-Desktop wizard
            }
          } catch { /* ignore */ }
          try {
            const status = await electronAPI.invoke('mcp:getSetupStatus') as { needsSetup: boolean; supported: boolean };
            if (status?.needsSetup && status?.supported && !showOnboarding) {
              showMcpWizard = true;
            }
          } catch { /* ignore */ }
        }, 2000);
      }).catch(() => { /* ignore */ });
    }

    ipc.send({ type: 'ready' });
  });

  function sendUpdate() {
    const editor = editorRef.current;
    if (!editor) return;
    const typst = serializeTypstCached(editor.state.doc);
    if (!typst && editor.state.doc.content.size > 2) {
      console.error('[penwright] Serializer produced empty output — skipping save');
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

  // Persist the preview-update mode (global). Switching back to 'auto' while the
  // preview is stale triggers one catch-up compile so it syncs immediately.
  function handlePreviewModeChange(mode: 'auto' | 'manual') {
    previewState.mode = mode;
    (window as unknown as { electronAPI?: { invoke(channel: string, ...args: unknown[]): Promise<unknown> } })
      .electronAPI?.invoke('persist:setPreviewMode', mode);
    if (mode === 'auto' && previewState.dirty) refreshPreview();
  }

  // Manually recompile the preview (Refresh button + only path in manual mode).
  function refreshPreview() {
    previewState.compiling = true;
    (window as unknown as { electronAPI?: { invoke(channel: string, ...args: unknown[]): Promise<unknown> } })
      .electronAPI?.invoke('preview:compile');
  }

  /**
   * A save overwrote somebody else's concurrent change. Main already preserved
   * their version as a snapshot; without a visible hint the user would never
   * know it happened, and "recoverable" would be recoverable in theory only.
   */
  let overwrittenFile = $state<string | null>(null);
  function onExternalWriteOverwritten(e: Event): void {
    const detail = (e as CustomEvent<{ file?: string }>).detail;
    overwrittenFile = detail?.file ? detail.file.split('/').pop() ?? detail.file : '';
  }

  // Opens the Polar checkout (used by the trial banner). Top-level so the
  // template can reach it — the onMount-scoped `electronAPI` const cannot.
  function openCheckout() {
    (window as unknown as { electronAPI?: { invoke(channel: string, ...args: unknown[]): Promise<unknown> } })
      .electronAPI?.invoke('license:openCheckout');
  }

  // ─── Add Comment ────────────────────────────────
  // Anchor the comment to the current selection (preferred) or the word
  // under the cursor (fallback). Computes a source-offset hint by walking
  // the document up to the selection, which the backend uses as a starting
  // point for re-locating the anchor on later opens.
  // ─── Selection→anchor helpers ───────────────────
  // Shared by comments + Design-with-AI (the capture logic used to exist as
  // two near-verbatim copies that could drift).

  /** The selected text, or — with a collapsed cursor — the surrounding word. */
  function selectionOrWord(editor: NonNullable<typeof editorRef.current>): string {
    const { state } = editor;
    const { from, to } = state.selection;
    const selected = state.doc.textBetween(from, to, ' ', ' ').trim();
    if (selected) return selected;
    const resolved = state.doc.resolve(from);
    const parent = resolved.parent;
    const text = parent.textBetween(0, parent.content.size, ' ', ' ');
    const offsetInParent = resolved.parentOffset;
    let start = offsetInParent;
    let end = offsetInParent;
    while (start > 0 && /\S/.test(text[start - 1])) start--;
    while (end < text.length && /\S/.test(text[end])) end++;
    return text.slice(start, end);
  }

  /** Project-relative path with forward slashes (basename as fallback). */
  function toProjectRelPath(absFile: string, projectDir: string): string {
    const rel = absFile.startsWith(projectDir + '/')
      ? absFile.slice(projectDir.length + 1)
      : absFile.replace(/^.*\//, '');
    return rel.replace(/\\/g, '/');
  }

  /** The open project's directory via project:getInfo, or null. */
  async function fetchProjectDir(): Promise<string | null> {
    const api = (window as unknown as {
      electronAPI: { invoke(channel: string, ...args: unknown[]): Promise<unknown> };
    }).electronAPI;
    const info = await api.invoke('project:getInfo') as { projectDir: string | null };
    return info.projectDir;
  }

  async function addCommentFromSelection() {
    const editor = editorRef.current;
    if (!editor || !tabState.currentFile) {
      alert(t().app.openFileFirst);
      return;
    }
    let anchorText = selectionOrWord(editor);
    if (!anchorText) {
      alert(t().app.selectTextToComment);
      return;
    }
    if (anchorText.length > 200) anchorText = anchorText.slice(0, 200);

    // Best-effort source-offset hint: the byte position in the live source.
    const rangeStart = Math.max(0, tabState.currentContent.indexOf(anchorText));
    const rangeEnd = rangeStart + anchorText.length;

    const projectDir = await fetchProjectDir();
    if (!projectDir) {
      alert(t().app.noProjectOpen);
      return;
    }

    const api = (window as unknown as {
      electronAPI: { invoke(channel: string, ...args: unknown[]): Promise<unknown> };
    }).electronAPI;
    const created = await api.invoke('comments:create', {
      file: toProjectRelPath(tabState.currentFile, projectDir),
      anchor: anchorText,
      rangeStart,
      rangeEnd,
      body: '',
    });

    if (!created) {
      alert(t().app.commentCreateFailed);
      return;
    }

    // Switch sidebar to Comments and let the panel scroll to the new entry
    panelState.showSidebar = true;
    panelState.sidebarTab = 'comments';
    window.dispatchEvent(new CustomEvent('penwright:comment-created', { detail: created }));
  }

  // ─── Design after writing ───────────────────────
  // Pin the current selection (text + fuzzy anchor + node type) to
  // `.penwright/selection.json` via `selection:pin`; the main process attaches
  // the design snapshot. Then flip the sidebar to the Design tab, whose hub
  // card shows the pin + the Claude handoff. Modeled on
  // `addCommentFromSelection()` for the selection→anchor capture.
  async function pinSelectionForDesign() {
    const editor = editorRef.current;
    if (!editor || !tabState.currentFile) {
      alert(t().app.openFileFirst);
      return;
    }
    const { state } = editor;
    const { from, to } = state.selection;
    const selectionText = selectionOrWord(editor);
    if (!selectionText) {
      alert(t().app.selectTextToDesign);
      return;
    }

    // Anchor = first 200 chars of the selection (whitespace-exact), which the
    // anchor-based MCP tools consume. Occurrence = 1 + how many identical
    // anchors precede the selection in the rendered text (best-effort dedupe).
    const anchorText = selectionText.length > 200 ? selectionText.slice(0, 200) : selectionText;
    const prefix = state.doc.textBetween(0, from, ' ', ' ');
    let occurrence = 1;
    if (anchorText) {
      let count = 0;
      let idx = prefix.indexOf(anchorText);
      while (idx !== -1) { count++; idx = prefix.indexOf(anchorText, idx + 1); }
      occurrence = count + 1;
    }
    const nodeType = state.selection.$from.parent.type.name;

    // Screen position of the selection end — anchors the handoff popover there.
    let popoverPos = { x: window.innerWidth / 2 - 150, y: 120 };
    try {
      const coords = editor.view.coordsAtPos(to);
      popoverPos = { x: coords.left, y: coords.bottom + 8 };
    } catch { /* fall back to a sensible default */ }

    const api = (window as unknown as {
      electronAPI: { invoke(channel: string, ...args: unknown[]): Promise<unknown> };
    }).electronAPI;

    const projectDir = await fetchProjectDir();
    if (!projectDir) {
      alert(t().app.noProjectOpen);
      return;
    }

    const result = await api.invoke('selection:pin', {
      file: toProjectRelPath(tabState.currentFile, projectDir),
      selectionText,
      anchorText,
      occurrence,
      nodeType,
    }) as { ok: boolean; error?: string };

    if (!result?.ok) {
      alert(t().app.pinFailed + (result?.error ? `\n${result.error}` : ''));
      return;
    }

    // Show the handoff popover at the selection (reads the pin we just wrote).
    // Null first: if it's already open (no backdrop — the editor stays
    // interactive), a plain re-assign would keep the mounted instance and its
    // stale onMount-loaded pin. The remount re-reads the fresh pin.
    designAiPopover = null;
    requestAnimationFrame(() => {
      designAiPopover = popoverPos;
    });
  }

  // Backlinks trigger: OutlinePanel hover-button or citation right-click
  // dispatches `penwright:find-backlinks` with `{ query, wholeWord, caseSensitive }`.
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

  // Citation hover trigger: a badge dwell-fired `penwright:citation-hover`.
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
  /**
   * Insert a ready-made design element at the cursor.
   *
   * Dispatched by the Design panel's block library. Goes through the same
   * window-event path every other sidebar surface uses, so App.svelte keeps
   * the single editor reference.
   *
   * A `typstRawBlock` rather than parsed nodes: these are hand-tuned layout
   * macros, and re-emitting them from the AST would normalise the very spacing
   * they depend on. The deserializer relabels the block on reload.
   */
  function handleInsertDesignElement(e: Event) {
    const detail = (e as CustomEvent<{ snippet: string; name: string }>).detail;
    const editor = editorRef.current;
    if (!editor || !detail?.snippet) return;
    editor
      .chain()
      .focus()
      .insertContent({ type: 'typstRawBlock', attrs: { content: detail.snippet, blockType: 'code' } })
      .run();
  }

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
      const rel = toProjectRelPath(tabState.currentFile, info.projectDir);
      const list = await apiRef.invoke('comments:list', {
        forFile: rel,
        includeResolved: false,
      }) as RawCommentEntry[];
      const marks: CommentMark[] = list
        .filter((c) => c.file === rel)
        .map((c) => ({ id: c.id, anchor: c.anchor, resolved: c.resolved, orphaned: c.orphaned }));
      setCommentMarks(editor, marks);
    } catch (err) {
      console.warn('[penwright] refreshCommentMarks failed:', err);
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

  function onProjectClosed() {
    loadedPrefsForProject = '';
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

  // ─── Source → Preview (cursor-follow) ─────────────────────────
  // The nearest heading at/above the caret, cleaned to match PDF bookmarks
  // (same cleanup as messageHandler.firstHeadingTitle). Empty if the caret is
  // before the first heading.
  function nearestHeadingTitle(editor: import('@tiptap/core').Editor): string {
    const pos = editor.state.selection.from;
    const doc = editor.state.doc;
    let title = '';
    let offset = 0;
    for (let i = 0; i < doc.childCount; i++) {
      if (offset > pos) break;
      const node = doc.child(i);
      if (node.type.name === 'heading') title = node.textContent;
      offset += node.nodeSize;
    }
    return title
      .replace(/\s*<[^>]*>\s*$/, '') // drop a trailing `<label>`
      .replace(/[*_`]/g, '')         // drop light inline markup
      .trim();
  }

  let headingFollowTimer: ReturnType<typeof setTimeout> | undefined;
  function scheduleHeadingFollow() {
    clearTimeout(headingFollowTimer);
    headingFollowTimer = setTimeout(() => {
      const editor = editorRef.current;
      if (!editor) return;
      const title = nearestHeadingTitle(editor);
      // PdfPreviewPanel only re-scrolls when the target actually changes, so
      // setting the same title while typing within a section is a no-op.
      if (title) previewState.scrollTarget = title;
    }, 200);
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

  // ─── Preview → Source ─────────────────────────────────────────
  // A click on a word in the PDF preview (dispatched by PdfPreviewPanel as
  // `penwright:preview-jump`) opens the chapter file that contains it and jumps
  // the editor there. Uses project-wide search on the clicked phrase; falls
  // back to the section heading when the phrase isn't found verbatim (e.g.
  // macro-/design-generated text).
  type PreviewJumpFile = {
    filePath: string;
    matches: { line: number; col: number; matchText: string }[];
  };
  async function searchProjectFiles(
    api: { invoke(channel: string, ...args: unknown[]): Promise<unknown> },
    query: string,
  ): Promise<PreviewJumpFile[]> {
    const q = query.trim();
    if (q.length < 3) return [];
    try {
      const res = (await api.invoke('project:search', {
        query: q,
        caseSensitive: false,
        wholeWord: false,
        regex: false,
        includeBib: false,
      })) as { files?: PreviewJumpFile[] };
      return res?.files ?? [];
    } catch {
      return [];
    }
  }

  async function handlePreviewJump(e: Event) {
    const detail = (e as CustomEvent<{ text: string; heading: string }>).detail;
    const phrase = (detail?.text || '').trim();
    const heading = (detail?.heading || '').trim();
    const api = (window as unknown as {
      electronAPI: { invoke(channel: string, ...args: unknown[]): Promise<unknown> };
    }).electronAPI;

    let files = await searchProjectFiles(api, phrase);
    let usedQuery = phrase;

    // Disambiguate by the section heading when the phrase matches several files.
    if (files.length > 1 && heading) {
      const headingFiles = new Set((await searchProjectFiles(api, heading)).map((f) => f.filePath));
      const narrowed = files.filter((f) => headingFiles.has(f.filePath));
      if (narrowed.length) files = narrowed;
    }

    // Fallback: phrase not found verbatim (macro/design text) → jump to heading.
    if (files.length === 0 && heading) {
      files = await searchProjectFiles(api, heading);
      usedQuery = heading;
    }
    if (files.length === 0) return;

    const file = files[0];
    const match = file.matches[0];
    if (!match) return;

    // Open the chapter if it isn't the active file already, then scroll the
    // editor to the match (handleProjectSearchJump retries until the editor
    // mounts the freshly-loaded content).
    if (tabState.currentFile !== file.filePath) handleFileOpen(file.filePath);
    window.dispatchEvent(
      new CustomEvent('penwright:project-search-jump', {
        detail: { matchText: match.matchText ?? usedQuery },
      }),
    );
  }

  function handleGlobalKeydown(e: KeyboardEvent) {
    // Something closer to the target (ProseMirror keymaps, dialog inputs)
    // already claimed this key — never double-handle it here.
    if (e.defaultPrevented) return;
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
    // Cmd+Alt+B — plain Cmd+B is the editor's Bold, Cmd+Shift+B its Blockquote.
    if (mod && e.altKey && (e.key === 'b' || e.key === 'B' || e.code === 'KeyB')) {
      e.preventDefault();
      panelState.showSidebar = !panelState.showSidebar;
    }
    if (mod && e.shiftKey && e.key === 'p') {
      e.preventDefault();
      panelState.showPreview = !panelState.showPreview;
    }
    if (mod && e.altKey && (e.key === 'l' || e.key === 'L')) {
      e.preventDefault();
      handleOpenReferencePicker();
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
    // style.typ is the document's "Look" — open it in the visual Look designer
    // instead of loading the generated Typst into the editor.
    if ((filePath.split('/').pop() || '') === 'style.typ') {
      openTab(filePath, 'design');
      return;
    }
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

  // Nav tab (top bar): switch the sidebar to a panel; click the active one to
  // collapse the sidebar. Navigation/project panels are top-level (always
  // reachable) — distinct from "Look", which you set occasionally.
  function selectNavTab(tab: typeof panelState.sidebarTab) {
    if (panelState.showSidebar && panelState.sidebarTab === tab) {
      panelState.showSidebar = false;
    } else {
      panelState.sidebarTab = tab;
      panelState.showSidebar = true;
    }
  }

  // Opens the document's global Look (the visual designer on style.typ).
  async function openGlobalLook() {
    const api = (window as unknown as { electronAPI?: { invoke(c: string, ...a: unknown[]): Promise<unknown> } }).electronAPI;
    try {
      const p = await api?.invoke('project:lookFile') as string | null;
      if (p) openTab(p, 'design');
    } catch { /* ignore */ }
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

  // Hoisted (named) handlers for the listeners onDestroy must remove —
  // anonymous closures can't be passed to removeEventListener.
  function onShowMcpWizard() { showMcpWizard = true; }
  function onShowMcpConnection() { showMcpConnection = true; }
  function onShowOnboarding() { showOnboarding = true; }
  function onEditChapterLook(e: CustomEvent) { editChapterLook = e.detail; }
  function onDocumentDragover(e: DragEvent) { e.preventDefault(); }
  function onDocumentDrop(e: DragEvent) {
    e.preventDefault();

    const sidebarImagePath = e.dataTransfer?.getData('application/penwright-image');
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
  }

  onDestroy(() => {
    clearTimeout(debounceTimer);
    window.removeEventListener('keydown', handleGlobalKeydown);
    window.removeEventListener('penwright:project-search-jump', handleProjectSearchJump as EventListener);
    window.removeEventListener('penwright:add-comment', addCommentFromSelection as EventListener);
    window.removeEventListener('penwright:design-selection', pinSelectionForDesign as EventListener);
    window.removeEventListener('penwright:find-backlinks', handleFindBacklinks as EventListener);
    window.removeEventListener('penwright:citation-hover', handleCitationHover as EventListener);
    window.removeEventListener('penwright:open-reference-picker', handleOpenReferencePicker as EventListener);
    window.removeEventListener('penwright:insert-design-element', handleInsertDesignElement as EventListener);
    window.removeEventListener('penwright:comment-created', onCommentCreatedAtApp as EventListener);
    window.removeEventListener('penwright:external-write-overwritten', onExternalWriteOverwritten as EventListener);
    window.removeEventListener('penwright:project-closed', onProjectClosed as EventListener);
    window.removeEventListener('penwright:preview-jump', handlePreviewJump as EventListener);
    window.removeEventListener('penwright:show-mcp-wizard', onShowMcpWizard);
    window.removeEventListener('penwright:show-mcp-connection', onShowMcpConnection);
    window.removeEventListener('penwright:show-onboarding', onShowOnboarding);
    window.removeEventListener('penwright:edit-chapter-look', onEditChapterLook as EventListener);
    document.removeEventListener('dragover', onDocumentDragover);
    document.removeEventListener('drop', onDocumentDrop);
    editorRef.current?.destroy();
  });
</script>

<div class="penwright-app">
  <!-- Titlebar drag region (macOS hiddenInset) -->
  <div class="titlebar-drag-region"></div>

  <!-- Licence notice: slim, dismissible, and shown ONLY to someone who said
       they use Penwright commercially and has no licence. Personal users
       never see it. It never blocks anything. -->
  {#if uiState.licenseDue && !uiState.licenseNoticeDismissed}
    <div class="trial-banner">
      <span>{t().license.noticeText}</span>
      <button class="trial-buy" onclick={openCheckout}>
        {t().license.noticeBuy}
      </button>
      <button
        class="trial-dismiss"
        onclick={() => (uiState.licenseNoticeDismissed = true)}
      >
        {t().license.noticeDismiss}
      </button>
    </div>
  {/if}

  {#if overwrittenFile !== null}
    <div class="conflict-banner" role="status">
      <span>{t().app.overwroteExternalChange(overwrittenFile)}</span>
      <button class="conflict-dismiss" onclick={() => (overwrittenFile = null)}>
        {t().common.close}
      </button>
    </div>
  {/if}

  <div class="penwright-container">
    <!-- Top bar: project-level navigation tabs (left) + formatting toolbar
         (over the editor). "Look" is occasional, so it lives at style.typ /
         the status bar — not up here. -->
    {#if hasFileOpen}
      <div class="top-bar">
        <div class="top-nav" role="tablist" aria-label={t().app.navAria}>
          <button class="nav-tab" class:active={panelState.showSidebar && panelState.sidebarTab === 'files'} onclick={() => selectNavTab('files')} role="tab" aria-selected={panelState.sidebarTab === 'files'} aria-label={t().app.navFiles}>{t().app.navFiles}</button>
          <button class="nav-tab" class:active={panelState.showSidebar && panelState.sidebarTab === 'outline'} onclick={() => selectNavTab('outline')} role="tab" aria-selected={panelState.sidebarTab === 'outline'} aria-label={t().app.navOutline}>{t().app.navOutline}</button>
          <button class="nav-tab" class:active={panelState.showSidebar && panelState.sidebarTab === 'includes'} onclick={() => selectNavTab('includes')} role="tab" aria-selected={panelState.sidebarTab === 'includes'} aria-label={t().app.navChapters}>{t().app.navChapters}</button>
          <button class="nav-tab" class:active={panelState.showSidebar && panelState.sidebarTab === 'git'} onclick={() => selectNavTab('git')} role="tab" aria-selected={panelState.sidebarTab === 'git'} aria-label={t().app.navProject}>{t().app.navProject}</button>
          <button class="nav-tab" class:active={panelState.showSidebar && panelState.sidebarTab === 'comments'} onclick={() => selectNavTab('comments')} role="tab" aria-selected={panelState.sidebarTab === 'comments'} aria-label={t().app.navComments}>{t().app.navComments}</button>
        </div>
        {#if editorRef.current && !designViewerFile && !pdfViewerFile && !textViewerFile}
          {@const _ = editorVersion.value}
          <div class="toolbar top-toolbar">
            <Toolbar editor={editorRef.current} />
          </div>
        {/if}
      </div>
    {/if}
    {#if editorRef.current && uiState.showSearch}
      <SearchReplace editor={editorRef.current} onClose={() => (uiState.showSearch = false)} />
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
          <div class="tab-bar" role="tablist" aria-label={t().app.openFilesAria}>
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
                  title={t().common.close}
                  role="button"
                  tabindex="0"
                  aria-label={t().app.closeTabAria(tabName(tab))}
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
        {:else if designViewerFile}
          <!-- style.typ → the visual Look designer (whole-document Look). -->
          <div class="design-main-view">
            <DesignPanel mainView />
          </div>
        {/if}
        <div class="editor-container" class:hidden={!!textViewerFile || !!pdfViewerFile || !!designViewerFile} style="--editor-zoom: {zoomState.editor}">
          <div class="editor" bind:this={editorElement}></div>
        </div>
      </div>

      <!-- Context Menu -->
      {#if contextMenu.path}
        <div class="context-overlay" role="presentation" onclick={closeContextMenu}>
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
            mode={previewState.mode}
            dirty={previewState.dirty}
            scrollTarget={previewState.scrollTarget}
            onRefresh={refreshPreview}
          />
        </div>
      {/if}
    </div>

    <!-- Modals (always available, also from Start Screen) -->
    {#if uiState.showShortcuts}
      <ShortcutCheatsheet onClose={() => (uiState.showShortcuts = false)} />
    {/if}
    {#if uiState.showSettings && uiState.currentSettings}
      <SettingsPanel
        settings={uiState.currentSettings}
        onSave={saveSettings}
        previewMode={previewState.mode}
        onPreviewModeChange={handlePreviewModeChange}
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
    {#if savePresetState.show}
      <SavePresetDialog onClose={() => { savePresetState.show = false; }} />
    {/if}
    {#if uiState.usageContext === null}
      <UsageDialog />
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
    {#if uiState.showHandbook}
      <HandbookViewer onClose={() => { uiState.showHandbook = false; }} />
    {/if}
    {#if pendingCrash}
      <CrashReportDialog
        content={pendingCrash.content}
        filename={pendingCrash.filename}
        onClose={dismissCrashDialog}
      />
    {/if}
    {#if showMcpWizard}
      <McpSetupWizard onClose={() => (showMcpWizard = false)} />
    {/if}
    {#if showMcpConnection}
      <McpConnectionDialog onClose={() => (showMcpConnection = false)} />
    {/if}
    {#if showOnboarding}
      <OnboardingWizard onClose={() => (showOnboarding = false)} />
    {/if}
    {#if designAiPopover}
      <DesignAiPopover x={designAiPopover.x} y={designAiPopover.y} onClose={() => (designAiPopover = null)} />
    {/if}
    {#if editChapterLook}
      <SectionLookEditor chapterPath={editChapterLook.chapterPath} styleId={editChapterLook.styleId} onClose={() => (editChapterLook = null)} />
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
        title="Cmd+Alt+B"
        aria-label={t().app.toggleSidebar}
        aria-pressed={panelState.showSidebar}
      >
        {t().app.statusProject}
      </button>
      <button
        class="status-toggle"
        class:active={panelState.showPreview}
        onclick={() => (panelState.showPreview = !panelState.showPreview)}
        title="Cmd+Shift+P"
        aria-label={t().app.togglePreview}
        aria-pressed={panelState.showPreview}
      >
        {t().app.statusPreview}
      </button>
    </div>
    {#if hasFileOpen}
      <div class="status-center">
        <LookStatus
          file={activeTab?.type === 'typ' ? activeTab.path : ''}
          isDesignView={!!designViewerFile}
          onOpenGlobalLook={openGlobalLook}
        />
      </div>
    {/if}
    <div class="status-right">
      {#if agentActivity}
        <span class="status-agent" title={agentActivity.files.join('\n')}>
          {t().app.agentWorking(agentActivity.what)}
        </span>
      {/if}
      {#if hasFileOpen && wordStats.words > 0}
        <span class="status-info" title={t().app.readingTimeTitle}>
          {wordStats.words.toLocaleString()} {t().app.wordsLabel(wordStats.words)} · {t().app.minRead(wordStats.minutes)}
        </span>
      {/if}
      {#if hasFileOpen}
        <div class="zoom-status-wrapper">
          <button
            class="zoom-status-btn"
            class:active={showEditorZoomPopover}
            onclick={() => (showEditorZoomPopover = !showEditorZoomPopover)}
            title={t().app.editorZoomTitle}
            aria-label={t().app.editorZoom}
            aria-haspopup="true"
            aria-expanded={showEditorZoomPopover}
          >
            {Math.round(zoomState.editor * 100)}%
          </button>
          {#if showEditorZoomPopover}
            <div class="zoom-popover-overlay" role="presentation" onclick={() => (showEditorZoomPopover = false)}></div>
            <div class="zoom-popover" role="dialog" aria-label={t().app.editorZoom}>
              <div class="zoom-popover-row">
                <button class="zoom-btn-sq" onclick={zoomEditorOut} aria-label={t().app.zoomOut}>−</button>
                <input
                  type="range"
                  min={ZOOM_MIN}
                  max={ZOOM_MAX}
                  step="0.05"
                  value={zoomState.editor}
                  oninput={(e) => setEditorZoom(parseFloat((e.currentTarget as HTMLInputElement).value))}
                  aria-label={t().app.zoomSlider}
                />
                <button class="zoom-btn-sq" onclick={zoomEditorIn} aria-label={t().app.zoomIn}>+</button>
              </div>
              <div class="zoom-popover-footer">
                <span class="zoom-popover-value">{Math.round(zoomState.editor * 100)}%</span>
                <button class="zoom-reset-btn" onclick={resetEditorZoom}>{t().app.reset}</button>
              </div>
            </div>
          {/if}
        </div>
      {/if}
      {#if uiState.exporting}
        <span class="status-info status-exporting" aria-live="polite">{t().app.exporting(uiState.exportFormat.toUpperCase())}</span>
      {:else if !tabState.isSaved}
        <span class="status-info status-unsaved">{t().app.unsaved}</span>
      {:else if tabState.lastSaveTime}
        <span class="status-info">{t().app.saved(tabState.lastSaveTime)}</span>
      {/if}
      {#if tabState.currentFile}
        <span class="status-info">{tabState.currentFile.split('/').pop()}</span>
      {/if}
      <button
        class="status-toggle lang-status"
        onclick={() => setLocale(i18nState.locale === 'de' ? 'en' : 'de')}
        title={t().app.switchLanguage}
        aria-label={t().app.switchLanguage}
      >
        {i18nState.locale === 'de' ? 'DE' : 'EN'}
      </button>
      <button
        class="status-toggle"
        class:licensed={uiState.licenseAccess === 'commercial'}
        class:expired={uiState.licenseDue}
        onclick={() => (uiState.showLicense = true)}
        title={t().app.licenseTitle}
      >
        {#if uiState.licenseAccess === 'commercial'}
          {t().app.licensed}
        {:else if uiState.licenseDue}
          {t().app.licenseDue}
        {:else}
          {t().app.personal}
        {/if}
      </button>
    </div>
  </div>
</div>

<style>
  .penwright-app {
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

  .penwright-container {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  /* Top bar: nav tabs (left) + formatting toolbar (over the editor). */
  .top-bar {
    display: flex;
    align-items: stretch;
    background: #ffffff;
    border-bottom: 1px solid #f0f0f0;
    -webkit-app-region: no-drag;
    flex-shrink: 0;
    min-height: 38px;
  }

  .top-nav {
    display: flex;
    align-items: center;
    padding: 0 6px;
    flex-shrink: 0;
    border-right: 1px solid #f0f0f0;
  }

  .nav-tab {
    padding: 7px 11px;
    border: none;
    background: transparent;
    color: #999;
    cursor: pointer;
    font-size: 11.5px;
    font-family: inherit;
    font-weight: 500;
    white-space: nowrap;
    border-bottom: 2px solid transparent;
    transition: all 0.15s;
  }
  .nav-tab:hover { color: #555; background: rgba(0, 0, 0, 0.02); }
  .nav-tab.active { color: #1a1a1a; border-bottom-color: #4f7df9; }

  /* Toolbar */
  .penwright-container :global(.toolbar) {
    -webkit-app-region: no-drag;
    padding: 6px 20px;
    flex-wrap: wrap;
    background: #ffffff;
    border-bottom: 1px solid #f0f0f0;
  }

  /* Inside the top bar the formatting toolbar takes the editor width and the
     border lives on .top-bar, not the toolbar itself. */
  .penwright-container :global(.top-toolbar) {
    flex: 1;
    min-width: 0;
    border-bottom: none;
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
    overflow: auto;
    padding: 56px 72px;
    scrollbar-gutter: stable;
  }

  .panel-editor :global(.editor-container.hidden) {
    display: none;
  }

  /* style.typ → the Look designer fills the editor pane. */
  .design-main-view {
    flex: 1;
    min-height: 0;
    overflow: hidden;
    background: #fff;
  }

  .panel-editor :global(.editor-container::-webkit-scrollbar) {
    width: 12px;
    height: 12px;
  }

  .panel-editor :global(.editor-container::-webkit-scrollbar-track) {
    background: transparent;
  }

  .panel-editor :global(.editor-container::-webkit-scrollbar-thumb) {
    background: rgba(0, 0, 0, 0.15);
    border-radius: 6px;
    border: 3px solid transparent;
    background-clip: padding-box;
  }

  .panel-editor :global(.editor-container::-webkit-scrollbar-thumb:hover) {
    background: rgba(0, 0, 0, 0.28);
    background-clip: padding-box;
    border: 3px solid transparent;
  }

  .panel-editor :global(.editor-container::-webkit-scrollbar-corner) {
    background: transparent;
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
    /* CSS zoom triggers proper layout reflow in Chromium (unlike transform:
       scale), so the cursor and selection coordinates stay correct under
       ProseMirror. Defined as a custom property so the menu/status bar can
       update it without touching the editor itself. */
    zoom: var(--editor-zoom, 1);
  }

  /* ─── Preview ─── */
  .panel-preview {
    flex-shrink: 0;
    overflow: hidden;
    border-left: 1px solid #f0f0f0;
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

  .status-center {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
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

  .status-toggle.lang-status {
    padding: 0 9px;
    font-weight: 600;
    letter-spacing: 0.04em;
  }

  .status-toggle.active {
    background: #eef4ff;
    color: #4f7df9;
  }

  .status-info {
    font-size: 11px;
    color: #bbb;
  }

  /* Advisory only — deliberately quiet. It reports, it never demands. */
  .status-agent {
    font-size: 11px;
    color: #8ab4f8;
    max-width: 320px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
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

  .status-toggle.expired {
    color: #c0392b;
    font-weight: 600;
  }

  /* ─── Conflict banner: a concurrent change was overwritten ─── */
  .conflict-banner {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 14px;
    min-height: 30px;
    padding: 6px 16px;
    background: #fdf6e3;
    border-bottom: 1px solid #ecdfc0;
    font-size: 12.5px;
    color: #7a6432;
    -webkit-app-region: no-drag;
  }

  .conflict-dismiss {
    padding: 3px 10px;
    border: 1px solid #d9c68f;
    border-radius: 6px;
    background: transparent;
    color: #7a6432;
    cursor: pointer;
    font-size: 12px;
    font-family: inherit;
  }

  /* ─── Licence notice (slim, dismissible, never blocking) ─── */
  .trial-banner {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 14px;
    height: 30px;
    padding: 0 16px;
    background: #f9f3ef;
    border-bottom: 1px solid #ecddd4;
    font-size: 12.5px;
    color: #7a5c4e;
    -webkit-app-region: no-drag;
  }

  .trial-buy {
    padding: 4px 12px;
    border: none;
    border-radius: 6px;
    background: #a8503a;
    color: #fff;
    cursor: pointer;
    font-size: 12px;
    font-family: inherit;
    font-weight: 600;
    transition: background 0.15s;
  }

  .trial-buy:hover {
    background: #934636;
  }

  .trial-dismiss {
    padding: 4px 10px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: #a08b7e;
    cursor: pointer;
    font-size: 12px;
    font-family: inherit;
  }

  .trial-dismiss:hover {
    color: #7a5c4e;
  }

  /* ─── Editor Zoom Indicator + Popover ─── */
  .zoom-status-wrapper {
    position: relative;
    display: flex;
    align-items: center;
  }

  .zoom-status-btn {
    height: 22px;
    padding: 0 8px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: #aaa;
    cursor: pointer;
    font-size: 11px;
    font-family: inherit;
    font-variant-numeric: tabular-nums;
    transition: all 0.15s;
  }

  .zoom-status-btn:hover { background: #f5f5f5; color: #666; }
  .zoom-status-btn.active { background: #eef4ff; color: #4f7df9; }

  .zoom-popover-overlay {
    position: fixed;
    inset: 0;
    z-index: 199;
  }

  .zoom-popover {
    position: absolute;
    bottom: calc(100% + 6px);
    right: 0;
    z-index: 200;
    background: #fff;
    border: 1px solid #e5e5e5;
    border-radius: 8px;
    box-shadow: 0 4px 16px rgba(0,0,0,0.12);
    padding: 10px 12px;
    min-width: 220px;
  }

  .zoom-popover-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .zoom-popover-row input[type='range'] {
    flex: 1;
    accent-color: #4f7df9;
  }

  .zoom-btn-sq {
    width: 24px;
    height: 24px;
    border: 1px solid #e5e5e5;
    border-radius: 4px;
    background: #fafafa;
    color: #555;
    cursor: pointer;
    font-size: 14px;
    line-height: 1;
    padding: 0;
  }

  .zoom-btn-sq:hover { background: #f0f0f0; }

  .zoom-popover-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 8px;
    font-size: 11px;
    color: #999;
  }

  .zoom-popover-value {
    font-variant-numeric: tabular-nums;
  }

  .zoom-reset-btn {
    height: 22px;
    padding: 0 10px;
    border: 1px solid #e5e5e5;
    border-radius: 4px;
    background: #fafafa;
    color: #555;
    cursor: pointer;
    font-size: 11px;
    font-family: inherit;
  }

  .zoom-reset-btn:hover { background: #f0f0f0; }
</style>
