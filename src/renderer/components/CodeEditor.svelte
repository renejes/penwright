<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection } from '@codemirror/view';
  import { EditorState } from '@codemirror/state';
  import { defaultKeymap, indentWithTab, history, historyKeymap } from '@codemirror/commands';
  import { syntaxHighlighting, defaultHighlightStyle, bracketMatching, indentOnInput, LanguageSupport } from '@codemirror/language';
  import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
  import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
  import { markdown } from '@codemirror/lang-markdown';
  import { json } from '@codemirror/lang-json';
  import { yaml } from '@codemirror/lang-yaml';
  import { oneDark } from '@codemirror/theme-one-dark';
  import { typstLanguage } from '../lib/typstLanguage';

  let {
    content = '',
    fileExt = '',
    onChange,
  }: {
    content: string;
    fileExt: string;
    onChange: (newContent: string) => void;
  } = $props();

  let containerEl: HTMLDivElement;
  let view: EditorView | null = null;
  let resizeObserver: ResizeObserver | null = null;
  let internalUpdate = false;

  function getLanguage(ext: string): LanguageSupport | null {
    switch (ext) {
      case 'md': return markdown();
      case 'json': return json();
      case 'yaml':
      case 'yml': return yaml();
      case 'typ': return new LanguageSupport(typstLanguage);
      default: return null;
    }
  }

  const vswriteTheme = EditorView.theme({
    '&': {
      height: '100%',
      fontSize: '13px',
      fontFamily: "'SF Mono', 'Fira Code', 'Consolas', 'Menlo', monospace",
    },
    '.cm-content': {
      padding: '16px 0',
      lineHeight: '1.6',
    },
    '.cm-gutters': {
      background: '#fafafa',
      borderRight: '1px solid #f0f0f0',
      color: '#ccc',
      fontSize: '12px',
      minWidth: '40px',
    },
    '.cm-activeLineGutter': {
      color: '#999',
      background: '#f5f5f5',
    },
    '.cm-activeLine': {
      background: '#f8f9fc',
    },
    '.cm-selectionMatch': {
      background: '#e8f0fe',
    },
    '.cm-cursor': {
      borderLeftColor: '#333',
    },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
      background: '#d7e4fc',
    },
  });

  function buildExtensions() {
    const extensions = [
      lineNumbers(),
      highlightActiveLine(),
      highlightActiveLineGutter(),
      drawSelection(),
      bracketMatching(),
      closeBrackets(),
      indentOnInput(),
      history(),
      highlightSelectionMatches(),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      vswriteTheme,
      keymap.of([
        ...closeBracketsKeymap,
        ...defaultKeymap,
        ...searchKeymap,
        ...historyKeymap,
        indentWithTab,
      ]),
      EditorView.updateListener.of((update) => {
        if (update.docChanged && !internalUpdate) {
          onChange(update.state.doc.toString());
        }
      }),
      EditorState.tabSize.of(2),
    ];

    const lang = getLanguage(fileExt);
    if (lang) extensions.push(lang);

    return extensions;
  }

  onMount(() => {
    view = new EditorView({
      state: EditorState.create({
        doc: content,
        extensions: buildExtensions(),
      }),
      parent: containerEl,
    });

    resizeObserver = new ResizeObserver(() => {
      view?.requestMeasure();
    });
    resizeObserver.observe(containerEl);
  });

  // Update content from outside (file load)
  $effect(() => {
    if (view && content !== view.state.doc.toString()) {
      internalUpdate = true;
      view.dispatch({
        changes: {
          from: 0,
          to: view.state.doc.length,
          insert: content,
        },
      });
      internalUpdate = false;
    }
  });

  // Recreate editor when file extension changes (different language)
  let prevExt = $state(fileExt);
  $effect(() => {
    if (fileExt !== prevExt && view) {
      prevExt = fileExt;
      const currentContent = view.state.doc.toString();
      view.destroy();
      view = new EditorView({
        state: EditorState.create({
          doc: currentContent,
          extensions: buildExtensions(),
        }),
        parent: containerEl,
      });
    }
  });

  onDestroy(() => {
    resizeObserver?.disconnect();
    view?.destroy();
    view = null;
  });

  export function focus() {
    view?.focus();
  }
</script>

<div class="code-editor" bind:this={containerEl}></div>

<style>
  .code-editor {
    flex: 1;
    overflow: hidden;
  }

  .code-editor :global(.cm-editor) {
    height: 100%;
    outline: none;
  }

  .code-editor :global(.cm-scroller) {
    overflow: auto;
  }
</style>
