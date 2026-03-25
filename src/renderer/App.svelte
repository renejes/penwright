<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import Toolbar from '../editor/components/Toolbar.svelte';
  import CommandHub from '../editor/components/CommandHub.svelte';
  import ShortcutCheatsheet from '../editor/components/ShortcutCheatsheet.svelte';
  import SettingsPanel from '../editor/components/SettingsPanel.svelte';
  import SearchReplace from '../editor/components/SearchReplace.svelte';
  import QuickSettings from '../editor/components/QuickSettings.svelte';
  import WelcomeScreen from '../editor/components/WelcomeScreen.svelte';
  import { createEditor, setEditorLanguage } from '../editor/lib/editor';
  import { serializeTypst } from '../editor/lib/serializer';
  import { deserializeTypst } from '../editor/lib/deserializer';
  import { reconcileContent } from '../editor/lib/reconciler';
  import { updateCitationEntries } from '../editor/lib/citationSuggestion';
  import type { Editor } from '@tiptap/core';
  import { setDocumentBaseUri } from '../editor/lib/typstImage';
  import { ipc } from '../editor/lib/ipcAdapter';
  import type { ExtensionMessage, DocumentSettings } from '../editor/lib/messages';

  let editorElement: HTMLDivElement;
  let editor: Editor | null = $state(null);
  let editorVersion = $state(0);
  let showShortcuts = $state(false);
  let showSettings = $state(false);
  let showSearch = $state(false);
  let showQuickSettings = $state(false);
  let focusMode = $state(false);
  let typewriterMode = $state(false);
  let showWelcome = $state(false);
  let welcomeTypstInstalled = $state(true);
  let welcomePlatform = $state('');
  let currentSettings: DocumentSettings | null = $state(null);
  let isUpdatingFromExtension = false;
  let debounceTimer: ReturnType<typeof setTimeout>;

  // IPC adapter that works as both a vscode-like API and for CommandHub/QuickSettings
  const vscodeBridge = {
    postMessage(msg: unknown) {
      ipc.send(msg as import('../editor/lib/messages').WebviewMessage);
    },
  };

  onMount(() => {
    // Expose API globally for slash commands (image picker)
    (window as unknown as Record<string, unknown>).vswriteApi = vscodeBridge;

    editor = createEditor(editorElement, {
      onTransaction() {
        editorVersion++;
        if (typewriterMode) {
          requestAnimationFrame(() => scrollCursorToCenter());
        }
      },
      onUpdate() {
        if (isUpdatingFromExtension) return;
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(sendUpdate, 300);
        if (typewriterMode) {
          requestAnimationFrame(() => scrollCursorToCenter());
        }
      },
    });

    ipc.onMessage(handleMessage);
    window.addEventListener('keydown', handleGlobalKeydown);
    ipc.send({ type: 'ready' });
  });

  function scrollCursorToCenter() {
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
    if (!editor) return;
    const typst = serializeTypst(editor.getJSON());
    if (!typst && editor.state.doc.content.size > 2) {
      console.error('[vswrite] Serializer produced empty output — skipping save');
      return;
    }
    ipc.send({ type: 'edit', content: typst });
  }

  function openSettings() {
    ipc.send({ type: 'requestSettings' });
  }

  function saveSettings(settings: DocumentSettings) {
    ipc.send({ type: 'updateSettings', settings });
    showSettings = false;
    currentSettings = null;
  }

  function dismissWelcome(dontShowAgain: boolean) {
    showWelcome = false;
    ipc.send({ type: 'dismissWelcome', dontShowAgain } as unknown as import('../editor/lib/messages').WebviewMessage);
  }

  function toggleFocusMode() {
    focusMode = !focusMode;
  }

  function toggleTypewriterMode() {
    typewriterMode = !typewriterMode;
  }

  function handleGlobalKeydown(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
      e.preventDefault();
      showSearch = true;
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'h') {
      e.preventDefault();
      showSearch = true;
    }
    if (e.key === 'Escape') {
      if (focusMode) focusMode = false;
      if (typewriterMode) typewriterMode = false;
    }
  }

  function handleMessage(message: ExtensionMessage) {
    if (message.type === 'update' && editor) {
      isUpdatingFromExtension = true;
      try {
        const doc = deserializeTypst(message.content);
        reconcileContent(editor, doc);
      } catch (err) {
        console.error('[vswrite] Deserialize crash:', err);
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
      isUpdatingFromExtension = false;
    } else if (message.type === 'settingsData') {
      currentSettings = message.settings;
      showSettings = true;
      if (editor && message.settings.lang) {
        setEditorLanguage(editor, message.settings.lang);
      }
    } else if (message.type === 'documentBaseUri') {
      // Electron sends 'uri' instead of 'baseUri'
      const uri = (message as unknown as { uri?: string }).uri || (message as unknown as { baseUri?: string }).baseUri || '';
      setDocumentBaseUri(uri);
    } else if (message.type === 'insertImage' && editor) {
      editor
        .chain()
        .focus()
        .insertContent({
          type: 'image',
          attrs: { src: message.src },
        })
        .run();
    } else if (message.type === 'scrollToHeading' && editor) {
      scrollToHeading(message.title);
    } else if (message.type === 'citationData') {
      updateCitationEntries(message.entries);
    } else if (message.type === 'documentLang' && editor) {
      setEditorLanguage(editor, message.lang);
    } else if (message.type === 'welcomeData') {
      showWelcome = message.showWelcome;
      welcomeTypstInstalled = message.typstInstalled;
      welcomePlatform = message.platform;
    } else if (message.type === 'previewUpdate') {
      // TODO: Handle SVG preview pages
    } else if (message.type === 'compileError') {
      // TODO: Show compile errors in status bar
    }
  }

  function scrollToHeading(title: string) {
    if (!editor) return;
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

  onDestroy(() => {
    clearTimeout(debounceTimer);
    window.removeEventListener('keydown', handleGlobalKeydown);
    editor?.destroy();
  });
</script>

<div class="vswrite-app">
  <div class="vswrite-container" class:focus-mode={focusMode} class:typewriter-mode={typewriterMode}>
    {#if editor}
      {@const _ = editorVersion}
      {#if !focusMode}
        <div class="toolbar">
          <Toolbar {editor} />
          <div class="toolbar-right">
            <button
              class="toolbar-icon-btn"
              onclick={() => (showQuickSettings = !showQuickSettings)}
              title="Quick Settings"
            >
              &#9881;
            </button>
            <button
              class="toolbar-icon-btn"
              class:active={typewriterMode}
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
              {editor}
              vscode={vscodeBridge}
              onShowShortcuts={() => (showShortcuts = true)}
              onShowSettings={openSettings}
              onToggleFocusMode={toggleFocusMode}
              onToggleTypewriterMode={toggleTypewriterMode}
              onShowSearch={() => (showSearch = true)}
            />
          </div>
          {#if showQuickSettings}
            <QuickSettings
              vscode={vscodeBridge}
              onClose={() => (showQuickSettings = false)}
            />
          {/if}
        </div>
      {/if}
      {#if showSearch}
        <SearchReplace {editor} onClose={() => (showSearch = false)} />
      {/if}
    {/if}
    <div class="editor-container">
      <div class="editor" bind:this={editorElement}></div>
    </div>
    {#if focusMode}
      <button class="focus-exit-btn" onclick={toggleFocusMode} title="Exit Focus Mode (Esc)">
        Exit Focus Mode
      </button>
    {/if}
    {#if showShortcuts}
      <ShortcutCheatsheet onClose={() => (showShortcuts = false)} />
    {/if}
    {#if showSettings && currentSettings}
      <SettingsPanel
        settings={currentSettings}
        onSave={saveSettings}
        onClose={() => {
          showSettings = false;
          currentSettings = null;
        }}
      />
    {/if}
    {#if showWelcome}
      <WelcomeScreen
        typstInstalled={welcomeTypstInstalled}
        platform={welcomePlatform}
        onDismiss={dismissWelcome}
      />
    {/if}
  </div>

  <!-- Status Bar -->
  <div class="status-bar">
    <span class="status-item">vswrite Desktop</span>
  </div>
</div>

<style>
  @import '../editor/style.css';

  .vswrite-app {
    display: flex;
    flex-direction: column;
    height: 100vh;
    background: #ffffff;
  }

  .vswrite-container {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .status-bar {
    display: flex;
    align-items: center;
    height: 24px;
    padding: 0 12px;
    background: #f0f0f0;
    border-top: 1px solid #e0e0e0;
    font-size: 11px;
    color: #666;
    flex-shrink: 0;
  }

  .status-item {
    margin-right: 16px;
  }
</style>
