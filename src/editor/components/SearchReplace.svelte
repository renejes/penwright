<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type { Editor } from '@tiptap/core';
  import { t } from '@shared/i18n/store.svelte';

  let {
    editor,
    onClose,
  }: {
    editor: Editor;
    onClose: () => void;
  } = $props();

  let searchInput: HTMLInputElement;
  let searchTerm = $state('');
  let replaceTerm = $state('');
  let showReplace = $state(false);
  let matchCount = $state(0);
  let currentMatch = $state(0);
  let highlights: Range[] = [];

  onMount(() => {
    searchInput?.focus();
  });

  function clearHighlights() {
    // Remove all search highlight marks via CSS class
    const el = editor.view.dom;
    el.querySelectorAll('mark.search-highlight').forEach((m) => {
      const parent = m.parentNode;
      if (parent) {
        parent.replaceChild(document.createTextNode(m.textContent || ''), m);
        parent.normalize();
      }
    });
    el.querySelectorAll('mark.search-current').forEach((m) => {
      const parent = m.parentNode;
      if (parent) {
        parent.replaceChild(document.createTextNode(m.textContent || ''), m);
        parent.normalize();
      }
    });
  }

  function performSearch() {
    clearHighlights();
    highlights = [];
    matchCount = 0;
    currentMatch = 0;

    if (!searchTerm) return;

    const term = searchTerm.toLowerCase();
    const walker = document.createTreeWalker(
      editor.view.dom,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          // Skip raw block textareas
          const parent = node.parentElement;
          if (parent?.closest('.typst-raw-block')) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        },
      },
    );

    const matches: { node: Text; start: number; end: number }[] = [];
    let textNode: Node | null;
    while ((textNode = walker.nextNode())) {
      const text = textNode.textContent || '';
      const lower = text.toLowerCase();
      let idx = lower.indexOf(term);
      while (idx !== -1) {
        matches.push({ node: textNode as Text, start: idx, end: idx + term.length });
        idx = lower.indexOf(term, idx + 1);
      }
    }

    matchCount = matches.length;
    if (matchCount === 0) return;

    // Wrap matches in <mark> elements (process in reverse to preserve offsets)
    for (let i = matches.length - 1; i >= 0; i--) {
      const { node, start, end } = matches[i];
      const range = document.createRange();
      range.setStart(node, start);
      range.setEnd(node, end);

      const mark = document.createElement('mark');
      mark.className = i === 0 ? 'search-highlight search-current' : 'search-highlight';
      range.surroundContents(mark);
    }

    currentMatch = 1;
    scrollToCurrentMatch();
  }

  function scrollToCurrentMatch() {
    const marks = editor.view.dom.querySelectorAll('mark.search-highlight');
    marks.forEach((m) => m.classList.remove('search-current'));
    if (marks.length > 0 && currentMatch > 0) {
      const current = marks[currentMatch - 1];
      current.classList.add('search-current');
      current.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }

  function nextMatch() {
    if (matchCount === 0) return;
    currentMatch = currentMatch >= matchCount ? 1 : currentMatch + 1;
    scrollToCurrentMatch();
  }

  function prevMatch() {
    if (matchCount === 0) return;
    currentMatch = currentMatch <= 1 ? matchCount : currentMatch - 1;
    scrollToCurrentMatch();
  }

  function replaceOne() {
    if (matchCount === 0 || !searchTerm) return;
    const marks = editor.view.dom.querySelectorAll('mark.search-highlight');
    if (marks.length === 0 || currentMatch < 1) return;

    const mark = marks[currentMatch - 1];
    const parent = mark.parentNode;
    if (parent) {
      parent.replaceChild(document.createTextNode(replaceTerm), mark);
      parent.normalize();
    }
    // Trigger editor update
    editor.commands.setContent(editor.view.dom.innerHTML);
    // Re-search to update counts
    setTimeout(performSearch, 50);
  }

  function replaceAll() {
    if (matchCount === 0 || !searchTerm) return;
    const marks = editor.view.dom.querySelectorAll('mark.search-highlight');
    marks.forEach((mark) => {
      const parent = mark.parentNode;
      if (parent) {
        parent.replaceChild(document.createTextNode(replaceTerm), mark);
        parent.normalize();
      }
    });
    editor.commands.setContent(editor.view.dom.innerHTML);
    matchCount = 0;
    currentMatch = 0;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      close();
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      nextMatch();
    } else if (e.key === 'Enter' && e.shiftKey) {
      e.preventDefault();
      prevMatch();
    }
  }

  function close() {
    clearHighlights();
    onClose();
  }

  // React to search term changes
  $effect(() => {
    // Access searchTerm to create dependency
    const _ = searchTerm;
    performSearch();
  });

  onDestroy(() => {
    clearHighlights();
  });
</script>

<div class="search-bar" role="search">
  <div class="search-row">
    <input
      bind:this={searchInput}
      bind:value={searchTerm}
      type="text"
      placeholder={t().editor.searchPlaceholder}
      class="search-input"
      onkeydown={handleKeydown}
    />
    <span class="search-count">
      {#if searchTerm}
        {currentMatch}/{matchCount}
      {/if}
    </span>
    <button class="search-nav-btn" onclick={prevMatch} title={t().editor.searchPrevious}>&#x25B2;</button>
    <button class="search-nav-btn" onclick={nextMatch} title={t().editor.searchNext}>&#x25BC;</button>
    <button class="search-nav-btn" onclick={() => (showReplace = !showReplace)} title={t().editor.searchToggleReplace} class:active={showReplace}>
      &#x21C4;
    </button>
    <button class="search-close-btn" onclick={close} title={t().editor.searchClose}>&times;</button>
  </div>
  {#if showReplace}
    <div class="search-row">
      <input
        bind:value={replaceTerm}
        type="text"
        placeholder={t().editor.searchReplacePlaceholder}
        class="search-input"
        onkeydown={handleKeydown}
      />
      <button class="search-action-btn" onclick={replaceOne}>{t().editor.searchReplaceOne}</button>
      <button class="search-action-btn" onclick={replaceAll}>{t().editor.searchReplaceAll}</button>
    </div>
  {/if}
</div>
