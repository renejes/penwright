<script lang="ts">
  import { onMount } from 'svelte';
  import { projectSearchPreset } from '../appState.svelte';
  import { t } from '@shared/i18n/store.svelte';

  let { onClose }: { onClose: () => void } = $props();

  interface SearchMatch {
    line: number;
    col: number;
    matchText: string;
    lineText: string;
    matchStart: number;
    matchEnd: number;
  }
  interface SearchFileResult {
    filePath: string;
    relPath: string;
    matches: SearchMatch[];
  }
  interface SearchResults {
    files: SearchFileResult[];
    totalMatches: number;
    truncated: boolean;
    error?: string;
  }
  interface ReplaceResults {
    filesChanged: number;
    totalReplacements: number;
    error?: string;
  }

  let queryInput: HTMLInputElement | undefined = $state();
  let query = $state('');
  let replacement = $state('');
  let showReplace = $state(false);
  let caseSensitive = $state(false);
  let wholeWord = $state(false);
  let regex = $state(false);
  let includeBib = $state(false);

  let results: SearchResults | null = $state(null);
  let collapsed: Set<string> = $state(new Set());
  let searching = $state(false);
  let searchError = $state('');
  let replacing = $state(false);
  let replaceMessage = $state('');
  let searchTimer: ReturnType<typeof setTimeout> | undefined;

  const api = (window as unknown as { electronAPI: {
    invoke(channel: string, ...args: unknown[]): Promise<unknown>;
  } }).electronAPI;

  onMount(() => {
    // Pick up a preset query set by a "Find backlinks" trigger before the
    // panel was opened. Consume-once: clear after applying so a manual
    // re-open doesn't replay the old query.
    if (projectSearchPreset.query) {
      query = projectSearchPreset.query;
      wholeWord = projectSearchPreset.wholeWord;
      caseSensitive = projectSearchPreset.caseSensitive;
      projectSearchPreset.query = '';
      projectSearchPreset.wholeWord = false;
      projectSearchPreset.caseSensitive = false;
    }
    queryInput?.focus();
    queryInput?.select();
  });

  function scheduleSearch() {
    clearTimeout(searchTimer);
    if (!query.trim()) {
      results = null;
      searchError = '';
      return;
    }
    searchTimer = setTimeout(runSearch, 200);
  }

  async function runSearch() {
    if (!query.trim()) {
      results = null;
      return;
    }
    searching = true;
    searchError = '';
    replaceMessage = '';
    try {
      const res = (await api.invoke('project:search', {
        query,
        caseSensitive,
        wholeWord,
        regex,
        includeBib,
      })) as SearchResults;
      results = res;
      collapsed = new Set();
      if (res.error) searchError = res.error;
    } catch (err) {
      searchError = String(err);
      results = null;
    }
    searching = false;
  }

  $effect(() => {
    // Re-run search whenever query/options change.
    void query;
    void caseSensitive;
    void wholeWord;
    void regex;
    void includeBib;
    scheduleSearch();
  });

  function fileLabel(relPath: string): string {
    return relPath || t().pickers.projSearchRootLabel;
  }

  function toggleCollapsed(filePath: string) {
    const next = new Set(collapsed);
    if (next.has(filePath)) next.delete(filePath);
    else next.add(filePath);
    collapsed = next;
  }

  async function jumpTo(file: SearchFileResult, match: SearchMatch) {
    try {
      const opened = await api.invoke('filetree:open', file.filePath);
      // Wait for editor/text viewer to mount, then dispatch a search-locator
      // event that the SearchReplace overlay (if open) or a future jumper
      // can pick up. For now, we re-open the in-editor SearchReplace by
      // setting the global state via a custom event.
      window.dispatchEvent(new CustomEvent('penwright:project-search-jump', {
        detail: { filePath: file.filePath, line: match.line, col: match.col, matchText: match.matchText, opened },
      }));
    } catch (err) {
      console.warn('[penwright] Could not open file from search result:', err);
    }
  }

  async function replaceAll() {
    if (!query.trim()) return;
    if (!results || results.totalMatches === 0) return;
    const ok = window.confirm(
      t().pickers.projSearchConfirmReplace(results.totalMatches, results.files.length),
    );
    if (!ok) return;

    replacing = true;
    replaceMessage = '';
    try {
      const res = (await api.invoke('project:replaceAll', {
        query,
        replacement,
        caseSensitive,
        wholeWord,
        regex,
        includeBib,
      })) as ReplaceResults;

      if (res.error) {
        replaceMessage = t().pickers.projSearchError(res.error);
      } else {
        replaceMessage = t().pickers.projSearchReplacedSummary(res.totalReplacements, res.filesChanged);
      }
      // Re-run search to refresh result list (now empty for replaced matches).
      await runSearch();
    } catch (err) {
      replaceMessage = t().pickers.projSearchError(String(err));
    }
    replacing = false;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      runSearch();
    }
  }

  function highlight(line: string, start: number, end: number) {
    const before = line.slice(0, start);
    const match = line.slice(start, end);
    const after = line.slice(end);
    return { before, match, after };
  }
</script>

<div class="project-search" role="region" aria-label={t().pickers.projSearchRegionAria}>
  <div class="ps-header">
    <div class="ps-row">
      <button
        class="ps-toggle"
        onclick={() => (showReplace = !showReplace)}
        title={showReplace ? t().pickers.projSearchHideReplace : t().pickers.projSearchShowReplace}
        aria-label={showReplace ? t().pickers.projSearchHideReplace : t().pickers.projSearchShowReplace}
      >
        {showReplace ? '▾' : '▸'}
      </button>
      <input
        bind:this={queryInput}
        bind:value={query}
        class="ps-input"
        type="text"
        placeholder={t().pickers.projSearchPlaceholder}
        onkeydown={handleKeydown}
        aria-label={t().common.search}
      />
      <div class="ps-options">
        <button
          class="ps-opt"
          class:active={caseSensitive}
          onclick={() => (caseSensitive = !caseSensitive)}
          title={t().pickers.projSearchCaseTitle}
          aria-pressed={caseSensitive}
        >Aa</button>
        <button
          class="ps-opt"
          class:active={wholeWord}
          onclick={() => (wholeWord = !wholeWord)}
          title={t().pickers.projSearchWholeWordTitle}
          aria-pressed={wholeWord}
        >W</button>
        <button
          class="ps-opt"
          class:active={regex}
          onclick={() => (regex = !regex)}
          title={t().pickers.projSearchRegexTitle}
          aria-pressed={regex}
        >.*</button>
        <button
          class="ps-opt"
          class:active={includeBib}
          onclick={() => (includeBib = !includeBib)}
          title={t().pickers.projSearchBibTitle}
          aria-pressed={includeBib}
        >.bib</button>
      </div>
      <button class="ps-close" onclick={onClose} title={t().common.close} aria-label={t().common.close}>&times;</button>
    </div>

    {#if showReplace}
      <div class="ps-row">
        <span class="ps-toggle ps-spacer" aria-hidden="true">↳</span>
        <input
          bind:value={replacement}
          class="ps-input"
          type="text"
          placeholder={t().pickers.projSearchReplacePlaceholder}
          onkeydown={handleKeydown}
          aria-label={t().pickers.projSearchReplacePlaceholder}
        />
        <button
          class="ps-replace"
          onclick={replaceAll}
          disabled={replacing || !results || results.totalMatches === 0}
          title={t().pickers.projSearchReplaceAllTitle}
          aria-label={t().pickers.projSearchReplaceAll}
        >
          {replacing ? t().pickers.projSearchReplacing : t().pickers.projSearchReplaceAll}
        </button>
      </div>
    {/if}

    <div class="ps-status" aria-live="polite">
      {#if searching}
        {t().pickers.projSearchSearching}
      {:else if searchError}
        <span class="ps-error">{t().pickers.projSearchError(searchError)}</span>
      {:else if results && query.trim()}
        {t().pickers.projSearchSummary(results.totalMatches, results.files.length)}
        {#if results.truncated}<span class="ps-warn">{t().pickers.projSearchTruncated}</span>{/if}
      {:else if query.trim()}
        {t().pickers.projSearchNoMatches}
      {:else}
        &nbsp;
      {/if}
      {#if replaceMessage}
        <span class="ps-replace-msg">{replaceMessage}</span>
      {/if}
    </div>
  </div>

  {#if results && results.files.length > 0}
    <div class="ps-results">
      {#each results.files as file}
        <div class="ps-file">
          <button
            class="ps-file-header"
            onclick={() => toggleCollapsed(file.filePath)}
            title={file.filePath}
            aria-expanded={!collapsed.has(file.filePath)}
          >
            <span class="ps-chevron">{collapsed.has(file.filePath) ? '▸' : '▾'}</span>
            <span class="ps-file-path">{fileLabel(file.relPath)}</span>
            <span class="ps-file-count">{file.matches.length}</span>
          </button>
          {#if !collapsed.has(file.filePath)}
            <ul class="ps-match-list">
              {#each file.matches as match}
                {@const parts = highlight(match.lineText, match.matchStart, match.matchEnd)}
                <li>
                  <button class="ps-match" onclick={() => jumpTo(file, match)} title={t().pickers.projSearchJumpTitle}>
                    <span class="ps-line-num">{match.line}:{match.col}</span>
                    <span class="ps-line-text">{parts.before}<mark>{parts.match}</mark>{parts.after}</span>
                  </button>
                </li>
              {/each}
            </ul>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .project-search {
    display: flex;
    flex-direction: column;
    background: #ffffff;
    border-bottom: 1px solid #f0f0f0;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);
    max-height: 50vh;
    overflow: hidden;
  }

  .ps-header {
    flex-shrink: 0;
    padding: 8px 12px;
    border-bottom: 1px solid #f5f5f5;
    background: #fafafa;
  }

  .ps-row {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 6px;
  }
  .ps-row:last-child {
    margin-bottom: 0;
  }

  .ps-toggle, .ps-spacer {
    width: 22px;
    height: 28px;
    border: none;
    background: transparent;
    color: #999;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    font-size: 12px;
  }
  .ps-spacer { cursor: default; opacity: 0.5; }
  .ps-toggle:hover { background: #f0f0f0; }

  .ps-input {
    flex: 1;
    height: 28px;
    padding: 0 10px;
    border: 1px solid #e0e0e0;
    border-radius: 6px;
    background: #ffffff;
    color: #1a1a1a;
    font-size: 13px;
    font-family: inherit;
    outline: none;
    transition: border 0.15s, box-shadow 0.15s;
  }
  .ps-input:focus {
    border-color: #4f7df9;
    box-shadow: 0 0 0 2px rgba(79, 125, 249, 0.15);
  }

  .ps-options {
    display: flex;
    gap: 2px;
  }

  .ps-opt {
    height: 28px;
    min-width: 32px;
    padding: 0 6px;
    border: 1px solid transparent;
    background: transparent;
    color: #888;
    cursor: pointer;
    font-size: 11px;
    font-family: inherit;
    font-weight: 500;
    border-radius: 4px;
    transition: all 0.15s;
  }
  .ps-opt:hover { background: #f0f0f0; color: #555; }
  .ps-opt.active {
    background: #eef4ff;
    color: #4f7df9;
    border-color: rgba(79, 125, 249, 0.35);
  }

  .ps-close {
    width: 28px;
    height: 28px;
    border: none;
    background: transparent;
    color: #aaa;
    cursor: pointer;
    font-size: 18px;
    line-height: 1;
    border-radius: 4px;
  }
  .ps-close:hover { background: #f0f0f0; color: #555; }

  .ps-replace {
    height: 28px;
    padding: 0 12px;
    border: 1px solid #e0e0e0;
    background: #ffffff;
    color: #555;
    cursor: pointer;
    font-size: 12px;
    font-family: inherit;
    font-weight: 500;
    border-radius: 6px;
    transition: all 0.15s;
  }
  .ps-replace:hover:not(:disabled) {
    background: #4f7df9;
    color: #fff;
    border-color: #4f7df9;
  }
  .ps-replace:disabled { opacity: 0.45; cursor: not-allowed; }

  .ps-status {
    font-size: 11px;
    color: #999;
    padding: 0 2px;
    min-height: 14px;
  }
  .ps-error { color: #d04444; }
  .ps-warn { color: #c08040; }
  .ps-replace-msg {
    margin-left: 8px;
    color: #2e7d32;
    font-weight: 500;
  }

  .ps-results {
    flex: 1;
    overflow-y: auto;
    padding: 4px 0;
  }

  .ps-file {
    margin-bottom: 2px;
  }

  .ps-file-header {
    display: flex;
    align-items: center;
    gap: 4px;
    width: 100%;
    padding: 4px 14px;
    border: none;
    background: transparent;
    color: #555;
    cursor: pointer;
    font-size: 12px;
    font-family: inherit;
    font-weight: 600;
    text-align: left;
    transition: background 0.1s;
  }
  .ps-file-header:hover { background: rgba(0, 0, 0, 0.03); }

  .ps-chevron {
    width: 12px;
    font-size: 8px;
    text-align: center;
    color: #aaa;
    flex-shrink: 0;
  }
  .ps-file-path {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .ps-file-count {
    flex-shrink: 0;
    background: #f0f0f0;
    color: #888;
    font-size: 10px;
    font-weight: 500;
    padding: 1px 6px;
    border-radius: 8px;
  }

  .ps-match-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .ps-match {
    display: flex;
    align-items: baseline;
    gap: 8px;
    width: 100%;
    padding: 3px 14px 3px 32px;
    border: none;
    background: transparent;
    color: #555;
    cursor: pointer;
    font-size: 12px;
    font-family: 'SF Mono', 'Menlo', 'Consolas', monospace;
    text-align: left;
    border-radius: 0;
    transition: background 0.1s;
  }
  .ps-match:hover { background: #eef4ff; }

  .ps-line-num {
    flex-shrink: 0;
    color: #bbb;
    font-size: 11px;
    min-width: 50px;
  }
  .ps-line-text {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .ps-line-text :global(mark) {
    background: #fff3a8;
    color: #1a1a1a;
    padding: 0 2px;
    border-radius: 2px;
  }
</style>
