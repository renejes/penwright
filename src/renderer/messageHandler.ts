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
import { setProjectMacros, clearProjectMacros, type ProjectMacroItem } from '../editor/lib/projectMacroStore';
import type { ExtensionMessage } from '../editor/lib/messages';
import {
  editorRef,
  uiState,
  exportDialogState,
  previewState,
  tabState,
  newProjectState,
  savePresetState,
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

/**
 * Loads the building blocks callable in `targetFile` into the store the slash
 * menu and the ＋ dropdown read from. Best-effort: a project with no macros of
 * its own simply gets an empty group, which renders as nothing at all.
 */
async function refreshProjectMacros(targetFile: string): Promise<void> {
  try {
    const api = (window as unknown as {
      electronAPI?: { invoke(channel: string, ...args: unknown[]): Promise<unknown> };
    }).electronAPI;
    if (!api || !targetFile) { clearProjectMacros(); return; }
    const res = await api.invoke('project:listMacros', { targetFile }) as
      { macros?: ProjectMacroItem[] } | undefined;
    setProjectMacros(res?.macros ?? []);
  } catch {
    clearProjectMacros();
  }
}

export function handleMessage(message: ExtensionMessage): void {
  const editor = editorRef.current;

  if (message.type === 'update' && editor) {
    isUpdatingFromExtension.value = true;
    tabState.currentContent = message.content;
    // The active file changed (open / switch / external edit) — remember its
    // first heading so the preview can scroll to that chapter's page. Fires
    // here (not on keystrokes: typing goes renderer→main as 'edit', never
    // echoes back as 'update').
    previewState.scrollTarget = firstHeadingTitle(message.content);
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
    setDocumentBaseUri(message.uri || '');
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
    previewState.dirty = false;
    if (!panelState.showPreview) {
      panelState.showPreview = true;
    }
  } else if (message.type === 'compileError') {
    previewState.error = message.error;
    previewState.compiling = false;
    previewState.dirty = false;
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

  // Save the open project as a reusable user preset (File menu).
  if (msg.type === 'saveAsPreset') {
    savePresetState.show = true;
  }

  // Handle panel toggles from main process menu
  if (msg.type === 'togglePanel') {
    if (msg.panel === 'sidebar') panelState.showSidebar = !panelState.showSidebar;
    if (msg.panel === 'preview') panelState.showPreview = !panelState.showPreview;
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
  // The design tokens changed on disk without us doing it — the AI applied a
  // theme, palette or layout. Reuse the in-app channel the Design panel and the
  // chapter-look bar already listen on: without this they keep their mount-time
  // snapshot and write it back over the change on the next click.
  if (msg.type === 'designChangedExternally') {
    window.dispatchEvent(new CustomEvent('penwright:design-changed'));
  }
  // A save overwrote a change somebody else had made to the same file. The
  // foreign version was snapshotted, so "Undo AI Edit" can bring it back.
  if (msg.type === 'externalWriteOverwritten') {
    window.dispatchEvent(new CustomEvent('penwright:external-write-overwritten', {
      detail: { file: msg.file as string },
    }));
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
  // Help → "Show Introduction": re-open the first-run onboarding tour.
  if (msg.type === 'showOnboarding') {
    window.dispatchEvent(new CustomEvent('penwright:show-onboarding'));
  }

  // Open the Export selection dialog when the menu triggers an export on
  // a multi-chapter project.
  if (msg.type === 'showExportDialog') {
    const data = msg as unknown as { format: 'pdf' | 'docx' | 'web'; sections: typeof exportDialogState.sections };
    exportDialogState.format = data.format;
    exportDialogState.sections = data.sections;
    exportDialogState.show = true;
  }

  // Track current file
  if (msg.type === 'currentFile') {
    tabState.currentFile = (msg as unknown as { path: string }).path || '';
    openTab(tabState.currentFile, 'typ');
    // Refill the project's own building blocks: which macros are callable
    // depends on THIS file's imports, not on the project (a root `#import`
    // does not reach an `#include`d chapter — proven against the compiler).
    void refreshProjectMacros(tabState.currentFile);
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
    clearProjectMacros();
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

  // Help menu → "MCP-Verbindung…" — Cursor / Claude Code registration.
  if (msg.type === 'showMcpConnection') {
    window.dispatchEvent(new CustomEvent('penwright:show-mcp-connection'));
  }

  // Native-menu actions whose logic lives in the MAIN process. The menu sends
  // them to the renderer (webContents.send); the renderer doesn't handle them
  // itself, so relay them to the main 'penwright' switch. Without this, menu
  // items like "Document Settings…", "Merge Document", etc. silently do nothing.
  if (MENU_MAIN_ACTIONS.has(msg.type)) {
    ipc.send(message as unknown as import('../editor/lib/messages').WebviewMessage);
  }
}

const MENU_MAIN_ACTIONS = new Set<string>([
  'requestSettings',
  'openSource',
  'newProject',
  'mergeDocument',
  'splitDocument',
  'ensureBibliography',
  'importSources',
  'addCitationManually',
  'undoLastAiEdit',
]);

/**
 * The active chapter's title — used to scroll the PDF preview to that chapter.
 * Tries, in order:
 *   1. a native level-1 heading `= Title` (normal documents / WYSIWYG output),
 *   2. a `title: "…"` / `title: [...]` macro argument (magazine & design
 *      templates render their chapter title through macros like
 *      `#opener(title: "Editorial")`, which still emit a real `heading` — so a
 *      PDF bookmark exists; we just need the same title text to match it).
 * Returns '' when neither is found (e.g. a cover page, or a root of `#include`s).
 */
function firstHeadingTitle(typst: string): string {
  // 1) Native level-1 markup: `= Title` (not `== `, which is level 2+).
  let raw = typst.match(/^=[ \t]+(.+?)\s*$/m)?.[1];

  // 2) Fallback: the first `title:` argument of a macro call. `\btitle` avoids
  //    matching `subtitle:`; `title: none` (e.g. `#outline(title: none)`) is
  //    ignored because it requires a quoted string or bracketed content.
  if (!raw) {
    raw = typst.match(/\btitle:\s*"([^"]+)"/)?.[1]
      ?? typst.match(/\btitle:\s*\[([^\]]+)\]/)?.[1];
  }
  if (!raw) return '';

  return raw
    .replace(/\s*<[^>]*>\s*$/, '') // drop a trailing `<label>`
    .replace(/[*_`]/g, '')          // drop light inline markup
    .trim();
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
