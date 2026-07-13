<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type { Editor } from '@tiptap/core';
  import { t } from '@shared/i18n/store.svelte';
  import {
    findSearchMatches,
    setSearchHighlights,
    clearSearchHighlights,
    type SearchMatch,
  } from '../lib/searchDecorations';

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
  // ProseMirror positions of the current matches. NEVER touch the editor's
  // DOM directly — highlights are Decorations, replacements are transactions.
  // (The old innerHTML-rebuild approach destroyed every custom Typst node.)
  let matches: SearchMatch[] = [];

  onMount(() => {
    searchInput?.focus();
  });

  // The doc the current `matches` were computed against — positions go stale
  // the moment the user edits, so every navigation/replace re-syncs first.
  let matchesDoc: unknown = null;

  function performSearch() {
    matches = findSearchMatches(editor, searchTerm);
    matchesDoc = editor.state.doc;
    matchCount = matches.length;
    currentMatch = matchCount > 0 ? 1 : 0;
    setSearchHighlights(editor, matches, currentMatch - 1);
    if (currentMatch > 0) scrollToCurrentMatch();
  }

  /** Re-scans if the document changed since the last scan (cheap text walk);
   *  keeps the current index clamped so navigation stays sensible. */
  function ensureFreshMatches() {
    if (editor.state.doc === matchesDoc) return;
    matches = findSearchMatches(editor, searchTerm);
    matchesDoc = editor.state.doc;
    matchCount = matches.length;
    if (currentMatch > matchCount) currentMatch = matchCount;
    if (currentMatch === 0 && matchCount > 0) currentMatch = 1;
    setSearchHighlights(editor, matches, currentMatch - 1);
  }

  function scrollToCurrentMatch() {
    const m = matches[currentMatch - 1];
    if (!m || m.to > editor.state.doc.content.size) return;
    const { node } = editor.view.domAtPos(m.from);
    const el = node.nodeType === Node.TEXT_NODE ? node.parentElement : (node as HTMLElement);
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  function nextMatch() {
    ensureFreshMatches();
    if (matchCount === 0) return;
    currentMatch = currentMatch >= matchCount ? 1 : currentMatch + 1;
    setSearchHighlights(editor, matches, currentMatch - 1);
    scrollToCurrentMatch();
  }

  function prevMatch() {
    ensureFreshMatches();
    if (matchCount === 0) return;
    currentMatch = currentMatch <= 1 ? matchCount : currentMatch - 1;
    setSearchHighlights(editor, matches, currentMatch - 1);
    scrollToCurrentMatch();
  }

  /** The stored match positions go stale if the user edits the document while
   *  the search bar is open — verify the target range still holds the term
   *  before replacing; on mismatch just re-search instead of corrupting text. */
  function isMatchFresh(m: SearchMatch): boolean {
    if (m.to > editor.state.doc.content.size) return false;
    const current = editor.state.doc.textBetween(m.from, m.to, '￼');
    return current.toLowerCase() === searchTerm.toLowerCase();
  }

  function replaceOne() {
    ensureFreshMatches();
    if (matchCount === 0 || !searchTerm || currentMatch < 1) return;
    const m = matches[currentMatch - 1];
    if (!m) return;
    if (!isMatchFresh(m)) {
      performSearch();
      return;
    }
    editor.view.dispatch(editor.state.tr.insertText(replaceTerm, m.from, m.to));
    // Re-scan the updated doc; continue at the first match AFTER the
    // replacement so replacing "cat" → "cats" doesn't re-target the same spot.
    const replacedEnd = m.from + replaceTerm.length;
    matches = findSearchMatches(editor, searchTerm);
    matchesDoc = editor.state.doc;
    matchCount = matches.length;
    const nextIdx = matches.findIndex((x) => x.from >= replacedEnd);
    currentMatch = matchCount === 0 ? 0 : nextIdx === -1 ? 1 : nextIdx + 1;
    setSearchHighlights(editor, matches, currentMatch - 1);
    if (currentMatch > 0) scrollToCurrentMatch();
  }

  function replaceAll() {
    ensureFreshMatches();
    if (matchCount === 0 || !searchTerm) return;
    if (matches.some((m) => !isMatchFresh(m))) {
      performSearch();
      return;
    }
    // One transaction (= one undo step), applied back-to-front so earlier
    // positions stay valid while later ranges are being replaced.
    const tr = editor.state.tr;
    for (let i = matches.length - 1; i >= 0; i--) {
      tr.insertText(replaceTerm, matches[i].from, matches[i].to);
    }
    editor.view.dispatch(tr);
    matches = [];
    matchCount = 0;
    currentMatch = 0;
    clearSearchHighlights(editor);
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
    clearSearchHighlights(editor);
    onClose();
  }

  // React to search term changes
  $effect(() => {
    // Access searchTerm to create dependency
    const _ = searchTerm;
    performSearch();
  });

  onDestroy(() => {
    clearSearchHighlights(editor);
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
