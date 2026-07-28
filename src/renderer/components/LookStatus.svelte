<script lang="ts">
  /**
   * LookStatus — the contextual "Look" control in the centre of the status bar.
   * One slot, three states (you design where it applies):
   *   - in style.typ (the design view)  → "✦ Global-Look" (active indicator)
   *   - in a content chapter             → "Kapitel-Look: [dropdown]"
   *   - anywhere else                    → "✦ Look" button → opens the global Look
   *
   * Picking a chapter look routes through the safe-apply engine, so a look that
   * wouldn't compile is rolled back and the chapter is left as it was.
   */

  import { onMount, onDestroy } from 'svelte';
  import { SECTION_PRESETS } from '../../shared/sectionPresets';
  import { t } from '@shared/i18n/store.svelte';

  let { file, isDesignView, onOpenGlobalLook }:
    { file: string; isDesignView: boolean; onOpenGlobalLook: () => void } = $props();

  const api = (window as unknown as {
    electronAPI?: { invoke(channel: string, ...args: unknown[]): Promise<unknown> };
  }).electronAPI;

  let isChapter = $state(false);
  let styleId = $state<string | null>(null);
  let busy = $state(false);
  let note = $state('');

  async function refresh(): Promise<void> {
    if (isDesignView || !api || !file) { isChapter = false; return; }
    try {
      const ctx = await api.invoke('section:context', file) as { isChapter: boolean; styleId: string | null };
      isChapter = !!ctx?.isChapter;
      styleId = ctx?.styleId ?? null;
    } catch {
      isChapter = false;
    }
  }

  $effect(() => { void file; void isDesignView; refresh(); });

  function onDesignChanged(): void { refresh(); }
  onMount(() => window.addEventListener('penwright:design-changed', onDesignChanged));
  onDestroy(() => window.removeEventListener('penwright:design-changed', onDesignChanged));

  async function pick(id: string): Promise<void> {
    if (!api || busy) return;
    busy = true;
    note = '';
    const prev = styleId;
    try {
      const res = id === ''
        ? await api.invoke('section:clear', file) as { ok: boolean; error?: string }
        : await api.invoke('section:apply', file, id) as { ok: boolean; error?: string };
      if (res?.ok) {
        styleId = id || null;
        window.dispatchEvent(new CustomEvent('penwright:design-changed'));
      } else {
        styleId = prev;
        // A refused write (hand-written style.typ) carries its own reason —
        // "not applied" alone would hide why, and the user would just retry.
        note = res?.error || t().look.notApplied;
        setTimeout(() => { if (note) note = ''; }, res?.error ? 9000 : 4000);
      }
    } catch {
      styleId = prev;
    } finally {
      busy = false;
    }
    await refresh();
  }
</script>

{#if isDesignView}
  <span class="ls-badge active">{t().look.globalBadge}</span>
{:else if isChapter}
  <span class="ls-label">{t().look.chapterLabel}</span>
  <select
    class="ls-select"
    disabled={busy}
    value={styleId ?? ''}
    onchange={(e) => pick((e.currentTarget as HTMLSelectElement).value)}
    title={t().look.chapterSelectTitle}
  >
    <option value="">{t().look.optionDefault}</option>
    {#each SECTION_PRESETS as p}
      <option value={p.id}>{p.name}</option>
    {/each}
  </select>
  {#if styleId}
    <button
      class="ls-edit"
      onclick={() => window.dispatchEvent(new CustomEvent('penwright:edit-chapter-look', { detail: { chapterPath: file, styleId } }))}
      title={t().look.editTitle}
      aria-label={t().look.editAria}
    >✎</button>
  {/if}
  {#if note}<span class="ls-note">{note}</span>{/if}
{:else}
  <button class="ls-badge" onclick={onOpenGlobalLook} title={t().look.openGlobalTitle}>{t().look.lookBadge}</button>
{/if}

<style>
  .ls-badge {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    border: 1px solid transparent;
    background: transparent;
    color: #8a8174;
    font-size: 11px;
    padding: 2px 8px;
    border-radius: 4px;
    cursor: pointer;
  }
  .ls-badge:hover { background: rgba(168, 80, 58, 0.08); color: #a8503a; }
  .ls-badge.active {
    color: #a8503a;
    cursor: default;
    font-weight: 600;
  }
  .ls-badge.active:hover { background: transparent; }

  .ls-label {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #998f7f;
  }

  .ls-select {
    border: 1px solid #d8cfc1;
    border-radius: 4px;
    background: #fff;
    color: #3a352e;
    font-size: 11px;
    padding: 1px 6px;
    cursor: pointer;
    margin-left: 5px;
  }
  .ls-select:disabled { opacity: 0.6; cursor: default; }

  .ls-edit {
    border: 1px solid #d8cfc1;
    border-radius: 4px;
    background: #fff;
    color: #8a8174;
    font-size: 11px;
    padding: 1px 6px;
    margin-left: 5px;
    cursor: pointer;
  }
  .ls-edit:hover { background: #a8503a; border-color: #a8503a; color: #fff; }

  .ls-note {
    color: #b4402e;
    font-size: 10px;
    margin-left: 6px;
  }
</style>
