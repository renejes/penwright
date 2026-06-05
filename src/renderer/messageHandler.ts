/**
 * Message Handler — extracted from App.svelte
 * Handles all ExtensionMessage events from the main process.
 */

import { deserializeTypst } from '../editor/lib/deserializer';
import { reconcileContent } from '../editor/lib/reconciler';
import { updateCitationEntries } from '../editor/lib/citationSuggestion';
import { setDocumentBaseUri } from '../editor/lib/typstImage';
import { setEditorLanguage } from '../editor/lib/editor';
import { ipc } from '../editor/lib/ipcAdapter';
import type { ExtensionMessage } from '../editor/lib/messages';
import {
  editorRef,
  uiState,
  exportDialogState,
  previewState,
  tabState,
  newProjectState,
  panelState,
  zoomState,
  zoomEditorIn,
  zoomEditorOut,
  resetEditorZoom,
  zoomPdfIn,
  zoomPdfOut,
  resetPdfZoom,
  isUpdatingFromExtension,
  openTab,
} from './appState.svelte';

export function handleMessage(message: ExtensionMessage): void {
  const editor = editorRef.current;

  if (message.type === 'update' && editor) {
    isUpdatingFromExtension.value = true;
    tabState.currentContent = message.content;
    try {
      const doc = deserializeTypst(message.content);
      reconcileContent(editor, doc);
    } catch (err) {
      console.error('[penwright] Deserialize crash:', err);
      const fallbackDoc = {
        type: 'doc' as const,
        content: [{
          type: 'typstRawBlock',
          attrs: { content: message.content, blockType: 'error' },
        }],
      };
      editor.commands.setContent(fallbackDoc as Parameters<typeof editor.commands.setContent>[0]);
      ipc.send({ type: 'deserializeError', error: String(err) } as unknown as import('../editor/lib/messages').WebviewMessage);
    }
    isUpdatingFromExtension.value = false;
  } else if (message.type === 'settingsData') {
    uiState.currentSettings = message.settings;
    uiState.showSettings = true;
    if (editor && message.settings.lang) {
      setEditorLanguage(editor, message.settings.lang);
      syncSpellcheckLanguage(message.settings.lang);
    }
  } else if (message.type === 'documentBaseUri') {
    const uri = (message as unknown as { uri?: string }).uri || (message as unknown as { baseUri?: string }).baseUri || '';
    setDocumentBaseUri(uri);
  } else if (message.type === 'insertImage' && editor) {
    const sel = editor.state.selection;
    const fromPos = sel.$from ?? sel.from;
    const resolvedFrom = typeof fromPos === 'number' ? editor.state.doc.resolve(fromPos) : fromPos;
    const parentNode = resolvedFrom.node(resolvedFrom.depth);
    const isInRawBlock = parentNode.type.name === 'typstRawBlock'
      || parentNode.type.name === 'codeBlock'
      || parentNode.type.name === 'bibliography';

    if (isInRawBlock) {
      const endOfBlock = resolvedFrom.end(resolvedFrom.depth - 1);
      editor.chain()
        .focus()
        .insertContentAt(endOfBlock, [
          { type: 'paragraph' },
          { type: 'image', attrs: { src: message.src } },
        ])
        .run();
    } else {
      editor
        .chain()
        .focus()
        .insertContent({
          type: 'image',
          attrs: { src: message.src },
        })
        .run();
    }
  } else if (message.type === 'scrollToHeading' && editor) {
    scrollToHeading(editor, message.title);
  } else if (message.type === 'citationData') {
    updateCitationEntries(message.entries);
  } else if (message.type === 'documentLang' && editor) {
    setEditorLanguage(editor, message.lang);
    syncSpellcheckLanguage(message.lang);
  } else if (message.type === 'welcomeData') {
    uiState.showWelcome = message.showWelcome;
    uiState.welcomeTypstInstalled = message.typstInstalled;
    uiState.welcomePlatform = message.platform;
  } else if (message.type === 'previewPdfUpdate') {
    const binaryStr = atob(message.pdfData);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    previewState.pdfData = bytes;
    previewState.error = '';
    previewState.compiling = false;
    if (!panelState.showPreview) {
      panelState.showPreview = true;
    }
  } else if (message.type === 'compileError') {
    previewState.error = message.error;
    previewState.compiling = false;
  } else if (message.type === 'exportStatus') {
    uiState.exporting = message.exporting;
    uiState.exportFormat = message.format;
  }

  // Handle save status
  const msg = message as unknown as { type: string; panel?: string; saved?: boolean; file?: string };
  if (msg.type === 'saveStatus') {
    tabState.isSaved = msg.saved ?? true;
    if (msg.saved) {
      const now = new Date();
      tabState.lastSaveTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
  }

  // Handle new project dialog
  if (msg.type === 'showNewProjectDialog') {
    const data = msg as unknown as { templates: Array<{ id: string; label: string; description: string }> };
    newProjectState.templates = data.templates;
    newProjectState.show = true;
  }

  // Handle panel toggles from main process menu
  if (msg.type === 'togglePanel') {
    if (msg.panel === 'sidebar') panelState.showSidebar = !panelState.showSidebar;
    if (msg.panel === 'preview') panelState.showPreview = !panelState.showPreview;
    if (msg.panel === 'terminal') panelState.showTerminal = !panelState.showTerminal;
  }

  // Open the About dialog from the native menu
  if (msg.type === 'showAbout') {
    uiState.showAbout = true;
  }

  // Native menu hooks for things that live in renderer state.
  if (msg.type === 'showSearch') {
    uiState.showSearch = true;
  }
  if (msg.type === 'showProjectSearch') {
    uiState.showProjectSearch = true;
  }
  if (msg.type === 'addComment') {
    window.dispatchEvent(new CustomEvent('penwright:add-comment'));
  }
  // Native context-menu → "✨ Design with AI": pin the selection + open
  // the Design tab. App.svelte owns the capture via this window event.
  if (msg.type === 'designSelection') {
    window.dispatchEvent(new CustomEvent('penwright:design-selection'));
  }
  // The watcher detected an external change to the pinned file → Claude
  // applied the design. The DesignPanel hub card toasts + clears its pin view.
  if (msg.type === 'selectionApplied') {
    window.dispatchEvent(new CustomEvent('penwright:selection-applied'));
  }
  if (msg.type === 'showReferencePicker') {
    window.dispatchEvent(new CustomEvent('penwright:open-reference-picker'));
  }
  if (msg.type === 'showShortcuts') {
    uiState.showShortcuts = true;
  }
  if (msg.type === 'showHandbook') {
    uiState.showHandbook = true;
  }
  if (msg.type === 'toggleFocusMode') {
    uiState.focusMode = !uiState.focusMode;
  }
  if (msg.type === 'toggleTypewriterMode') {
    uiState.typewriterMode = !uiState.typewriterMode;
  }
  if (msg.type === 'toggleReadingMode') {
    uiState.readingMode = !uiState.readingMode;
  }

  // Open the Export selection dialog when the menu triggers an export on
  // a multi-chapter project.
  if (msg.type === 'showExportDialog') {
    const data = msg as unknown as { format: 'pdf' | 'docx'; sections: typeof exportDialogState.sections };
    exportDialogState.format = data.format;
    exportDialogState.sections = data.sections;
    exportDialogState.show = true;
  }

  // Track current file
  if (msg.type === 'currentFile') {
    tabState.currentFile = (msg as unknown as { path: string }).path || '';
    openTab(tabState.currentFile, 'typ');
  }

  // Open text file in built-in viewer
  if (msg.type === 'openTextFile') {
    const textPath = (msg as unknown as { path: string }).path || '';
    openTab(textPath, 'text');
  }

  // Open PDF file in built-in viewer
  if (msg.type === 'openPdfFile') {
    const pdfPath = (msg as unknown as { path: string }).path || '';
    openTab(pdfPath, 'pdf');
  }

  // Project was closed → reset all editor state and return to StartScreen
  if (msg.type === 'projectClosed') {
    tabState.openTabs = [];
    tabState.activeTabIndex = -1;
    tabState.currentFile = '';
    tabState.currentContent = '';
    tabState.isSaved = true;
    zoomState.editor = 1.0;
    zoomState.pdf = 1.0;
    if (editorRef.current) {
      try { editorRef.current.commands.setContent(''); } catch {}
    }
    window.dispatchEvent(new CustomEvent('penwright:project-closed'));
  }

  // Renderer-side hooks for the zoom menu items.
  if (msg.type === 'zoomEditorIn') zoomEditorIn();
  if (msg.type === 'zoomEditorOut') zoomEditorOut();
  if (msg.type === 'zoomEditorReset') resetEditorZoom();
  if (msg.type === 'zoomPdfIn') zoomPdfIn();
  if (msg.type === 'zoomPdfOut') zoomPdfOut();
  if (msg.type === 'zoomPdfReset') resetPdfZoom();

  // Help menu → "Mit Claude Desktop verbinden…". The wizard mounts on a
  // window event so App.svelte's listener owns the visibility state.
  if (msg.type === 'showMcpSetupWizard') {
    window.dispatchEvent(new CustomEvent('penwright:show-mcp-wizard'));
  }
}

function syncSpellcheckLanguage(lang: string): void {
  const api = (window as unknown as { electronAPI?: { invoke(channel: string, ...args: unknown[]): Promise<unknown> } }).electronAPI;
  api?.invoke('spellcheck:setLanguage', lang);
}

function scrollToHeading(editor: import('@tiptap/core').Editor, title: string) {
  const doc = editor.state.doc;
  let targetPos = -1;
  doc.descendants((node, pos) => {
    if (targetPos >= 0) return false;
    if (node.type.name === 'heading' && node.textContent.trim() === title) {
      targetPos = pos;
      return false;
    }
  });
  if (targetPos >= 0) {
    editor.commands.setTextSelection(targetPos + 1);
    const domNode = editor.view.domAtPos(targetPos + 1);
    if (domNode.node) {
      const el = domNode.node instanceof HTMLElement
        ? domNode.node
        : domNode.node.parentElement;
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }
}
