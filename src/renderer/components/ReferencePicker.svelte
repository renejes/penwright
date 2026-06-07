<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { t } from '@shared/i18n/store.svelte';

  type LabelType = 'figure' | 'table' | 'equation' | 'heading' | 'other';

  interface ProjectLabel {
    label: string;
    type: LabelType;
    caption: string;
    filePath: string;
    relPath: string;
    line: number;
  }

  let {
    onClose,
    onPick,
  }: {
    onClose: () => void;
    onPick: (label: ProjectLabel) => void;
  } = $props();

  let labels = $state<ProjectLabel[]>([]);
  let truncated = $state(false);
  let loading = $state(true);
  let query = $state('');
  let typeFilter = $state<LabelType | 'all'>('all');
  let selectedIdx = $state(0);
  let inputEl: HTMLInputElement;

  let filtered = $derived.by(() => {
    const q = query.trim().toLowerCase();
    return labels.filter((l) => {
      if (typeFilter !== 'all' && l.type !== typeFilter) return false;
      if (!q) return true;
      return (
        l.label.toLowerCase().includes(q) ||
        l.caption.toLowerCase().includes(q) ||
        l.relPath.toLowerCase().includes(q)
      );
    });
  });

  // Group by type for display
  let grouped = $derived.by(() => {
    const groups: Record<LabelType, ProjectLabel[]> = {
      figure: [],
      table: [],
      equation: [],
      heading: [],
      other: [],
    };
    for (const l of filtered) groups[l.type].push(l);
    const order: LabelType[] = ['figure', 'table', 'equation', 'heading', 'other'];
    return order
      .map((ty) => ({ type: ty, items: groups[ty] }))
      .filter((g) => g.items.length > 0);
  });

  // Flat list mirroring `grouped` so up/down keys can step across groups.
  let flatItems = $derived.by(() => grouped.flatMap((g) => g.items));

  $effect(() => {
    void filtered;
    if (selectedIdx >= flatItems.length) selectedIdx = Math.max(0, flatItems.length - 1);
  });

  onMount(async () => {
    const api = (window as unknown as {
      electronAPI: { invoke(channel: string, ...args: unknown[]): Promise<unknown> };
    }).electronAPI;
    try {
      const result = await api.invoke('project:listLabels') as {
        labels: ProjectLabel[];
        truncated: boolean;
      };
      labels = result.labels;
      truncated = result.truncated;
    } catch (err) {
      console.error('[penwright] listLabels failed:', err);
    }
    loading = false;
    await tick();
    inputEl?.focus();
  });

  function pickIndex(idx: number) {
    const item = flatItems[idx];
    if (item) {
      onPick(item);
    }
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (flatItems.length > 0) {
        selectedIdx = (selectedIdx + 1) % flatItems.length;
        scrollIntoView();
      }
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (flatItems.length > 0) {
        selectedIdx = (selectedIdx - 1 + flatItems.length) % flatItems.length;
        scrollIntoView();
      }
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      pickIndex(selectedIdx);
      return;
    }
  }

  async function scrollIntoView() {
    await tick();
    const el = document.querySelector(
      `.ref-picker-item[data-flat-idx="${selectedIdx}"]`,
    ) as HTMLElement | null;
    el?.scrollIntoView({ block: 'nearest' });
  }

  function typeIcon(ty: LabelType): string {
    if (ty === 'figure') return '🖼';
    if (ty === 'table') return '⊞';
    if (ty === 'equation') return '∑';
    if (ty === 'heading') return '§';
    return '↳';
  }

  function typeLabel(ty: LabelType): string {
    if (ty === 'figure') return t().pickers.refPickerGroupFigure;
    if (ty === 'table') return t().pickers.refPickerGroupTable;
    if (ty === 'equation') return t().pickers.refPickerGroupEquation;
    if (ty === 'heading') return t().pickers.refPickerGroupHeading;
    return t().pickers.refPickerGroupOther;
  }

  // Index-of-flat helper
  function flatIndex(file: string, label: string): number {
    return flatItems.findIndex((l) => l.filePath === file && l.label === label);
  }
</script>

<svelte:window onkeydown={onKeyDown} />

<div
  class="ref-picker-backdrop"
  role="presentation"
  onclick={(e) => { if (e.target === e.currentTarget) onClose(); }}
>
  <div class="ref-picker" role="dialog" aria-modal="true" aria-labelledby="ref-picker-title" tabindex="-1">
    <div class="ref-picker-header">
      <div class="ref-picker-title" id="ref-picker-title">{t().pickers.refPickerTitle}</div>
      <button class="ref-picker-close" onclick={onClose} aria-label={t().common.close}>×</button>
    </div>

    <div class="ref-picker-search">
      <input
        bind:this={inputEl}
        bind:value={query}
        type="text"
        placeholder={t().pickers.refPickerSearchPlaceholder}
        autocomplete="off"
        spellcheck="false"
      />
      <div class="ref-picker-types">
        <button class:active={typeFilter === 'all'} onclick={() => (typeFilter = 'all')}>{t().pickers.refPickerFilterAll}</button>
        <button class:active={typeFilter === 'figure'} onclick={() => (typeFilter = 'figure')}>{t().pickers.refPickerFilterFigure}</button>
        <button class:active={typeFilter === 'table'} onclick={() => (typeFilter = 'table')}>{t().pickers.refPickerFilterTable}</button>
        <button class:active={typeFilter === 'equation'} onclick={() => (typeFilter = 'equation')}>{t().pickers.refPickerFilterEquation}</button>
        <button class:active={typeFilter === 'heading'} onclick={() => (typeFilter = 'heading')}>{t().pickers.refPickerFilterHeading}</button>
        <button class:active={typeFilter === 'other'} onclick={() => (typeFilter = 'other')}>{t().pickers.refPickerFilterOther}</button>
      </div>
    </div>

    <div class="ref-picker-body">
      {#if loading}
        <div class="ref-picker-empty">{t().pickers.refPickerLoading}</div>
      {:else if filtered.length === 0}
        <div class="ref-picker-empty">
          {#if labels.length === 0}
            {t().pickers.refPickerNoneFound}
            <br />{t().pickers.refPickerNoneHint}
          {:else}
            {t().pickers.refPickerNoMatch(query)}
          {/if}
        </div>
      {:else}
        {#each grouped as group (group.type)}
          <div class="ref-picker-group-label">
            <span class="ref-picker-group-icon">{typeIcon(group.type)}</span>
            {typeLabel(group.type)}
            <span class="ref-picker-group-count">{group.items.length}</span>
          </div>
          <ul class="ref-picker-list" role="listbox" aria-label={typeLabel(group.type)}>
            {#each group.items as item (item.filePath + ':' + item.label + ':' + item.line)}
              {@const idx = flatIndex(item.filePath, item.label)}
              <li
                class="ref-picker-item"
                class:selected={idx === selectedIdx}
                data-flat-idx={idx}
                role="option"
                aria-selected={idx === selectedIdx}
                onclick={() => pickIndex(idx)}
                onmouseenter={() => (selectedIdx = idx)}
                onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pickIndex(idx); } }}
              >
                <div class="ref-picker-item-main">
                  <span class="ref-picker-item-label">{item.label}</span>
                  {#if item.caption}
                    <span class="ref-picker-item-caption">— {item.caption}</span>
                  {/if}
                </div>
                <div class="ref-picker-item-path">{item.relPath}:{item.line}</div>
              </li>
            {/each}
          </ul>
        {/each}
        {#if truncated}
          <div class="ref-picker-truncated">
            {t().pickers.refPickerTruncated}
          </div>
        {/if}
      {/if}
    </div>

    <div class="ref-picker-footer">
      <span><kbd>↑↓</kbd> {t().pickers.refPickerFooterSelect}</span>
      <span><kbd>Enter</kbd> {t().pickers.refPickerFooterInsert}</span>
      <span><kbd>Esc</kbd> {t().pickers.refPickerFooterCancel}</span>
    </div>
  </div>
</div>

<style>
  .ref-picker-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.35);
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding-top: 80px;
    z-index: 9000;
  }

  .ref-picker {
    background: #fff;
    border-radius: 10px;
    width: 560px;
    max-width: calc(100vw - 40px);
    max-height: 70vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.25);
  }

  .ref-picker-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 18px 6px;
  }

  .ref-picker-title {
    font-weight: 600;
    font-size: 14px;
    color: #222;
  }

  .ref-picker-close {
    background: transparent;
    border: none;
    font-size: 22px;
    cursor: pointer;
    color: #999;
    line-height: 1;
    padding: 0 4px;
  }
  .ref-picker-close:hover {
    color: #333;
  }

  .ref-picker-search {
    padding: 4px 18px 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .ref-picker-search input {
    width: 100%;
    padding: 8px 12px;
    border: 1px solid rgba(0, 0, 0, 0.12);
    border-radius: 6px;
    font-size: 13px;
    outline: none;
    box-sizing: border-box;
    font-family: inherit;
  }
  .ref-picker-search input:focus {
    border-color: #4f7df9;
    box-shadow: 0 0 0 2px rgba(79, 125, 249, 0.18);
  }

  .ref-picker-types {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
  }
  .ref-picker-types button {
    background: transparent;
    border: 1px solid rgba(0, 0, 0, 0.1);
    color: #666;
    padding: 3px 10px;
    border-radius: 4px;
    font-size: 11px;
    cursor: pointer;
    font-family: inherit;
  }
  .ref-picker-types button.active {
    background: #4f7df9;
    color: #fff;
    border-color: #4f7df9;
  }

  .ref-picker-body {
    flex: 1;
    overflow-y: auto;
    padding: 4px 0 8px;
    border-top: 1px solid rgba(0, 0, 0, 0.06);
  }

  .ref-picker-empty {
    padding: 30px 18px;
    text-align: center;
    color: #999;
    font-size: 13px;
    line-height: 1.5;
  }

  .ref-picker-group-label {
    padding: 10px 18px 4px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.6px;
    color: #888;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .ref-picker-group-icon {
    font-size: 13px;
  }
  .ref-picker-group-count {
    margin-left: auto;
    background: rgba(0, 0, 0, 0.06);
    color: #666;
    padding: 1px 7px;
    border-radius: 8px;
    font-size: 10px;
    font-weight: 500;
  }

  .ref-picker-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .ref-picker-item {
    padding: 7px 18px;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    gap: 2px;
    border-left: 2px solid transparent;
  }
  .ref-picker-item.selected {
    background: rgba(79, 125, 249, 0.08);
    border-left-color: #4f7df9;
  }

  .ref-picker-item-main {
    display: flex;
    align-items: baseline;
    gap: 6px;
    min-width: 0;
  }
  .ref-picker-item-label {
    font-family: 'SF Mono', Menlo, Consolas, monospace;
    font-size: 12px;
    color: #4f7df9;
    flex-shrink: 0;
  }
  .ref-picker-item-caption {
    color: #444;
    font-size: 13px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
  }

  .ref-picker-item-path {
    color: #aaa;
    font-size: 11px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .ref-picker-truncated {
    padding: 10px 18px;
    color: #b00;
    font-size: 11px;
    font-style: italic;
  }

  .ref-picker-footer {
    padding: 8px 18px;
    border-top: 1px solid rgba(0, 0, 0, 0.06);
    display: flex;
    gap: 14px;
    color: #888;
    font-size: 11px;
  }
  .ref-picker-footer kbd {
    background: rgba(0, 0, 0, 0.06);
    border-radius: 3px;
    padding: 1px 5px;
    font-family: 'SF Mono', Menlo, Consolas, monospace;
    font-size: 10px;
    margin-right: 3px;
  }
</style>
