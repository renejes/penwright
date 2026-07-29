<script lang="ts">
  /**
   * The 24 design elements, for the human.
   *
   * These have existed since Session 23 and could only ever be reached by
   * asking the AI — `penwright_insert_design_element` was the sole entry point.
   * That is the parity principle failing in the *other* direction: the AI could
   * produce something the person sitting in front of the app had no way to
   * make, and no way to discover existed.
   *
   * Deliberately NOT in the slash menu / ＋ dropdown. Those are for the dozen
   * things people insert constantly; twenty-four parametrised layout blocks
   * would bury the image and the table. This is a browsing surface — you come
   * here to look at what is available, fill in a few fields, and insert once.
   *
   * Insertion goes through a window event rather than a direct editor call,
   * the pattern the rest of the sidebar already uses (App.svelte holds the one
   * listener). Elements reference `style-colors` / `style-fonts`, so they only
   * resolve in a file that imports style.typ — the warning below says so
   * rather than letting the compile fail confusingly.
   */
  import { t } from '@shared/i18n/store.svelte';
  // Relative, not `@shared`: svelte-check has no path mapping for the alias,
  // so an aliased import silently degrades every symbol to `any` (the rest of
  // this folder imports shared code the same way — only the i18n store uses
  // the alias, because it must).
  import { DESIGN_ELEMENTS, renderDesignElement, type DesignElement } from '../../shared/designElements';

  interface Props {
    /** False for a chapter that does not import style.typ — elements will not resolve. */
    canTheme?: boolean;
  }
  let { canTheme = true }: Props = $props();

  let open = $state(false);
  let filter = $state('');
  let selected = $state<DesignElement | null>(null);
  let values = $state<Record<string, string>>({});

  const shown = $derived(
    DESIGN_ELEMENTS.filter((e) => {
      const q = filter.trim().toLowerCase();
      if (!q) return true;
      return e.name.toLowerCase().includes(q) || e.description.toLowerCase().includes(q) || e.id.includes(q);
    }),
  );

  function pick(el: DesignElement) {
    selected = el;
    // Pre-fill from the element's own defaults so "Insert" always produces
    // something that compiles, even before anything is typed.
    const next: Record<string, string> = {};
    for (const p of el.params) next[p.name] = p.defaultValue ?? '';
    values = next;
  }

  const missing = $derived(
    selected ? selected.params.filter(p => p.required && !values[p.name]?.trim()).map(p => p.name) : [],
  );

  function insert() {
    if (!selected || missing.length > 0) return;
    const snippet = renderDesignElement(selected, values);
    window.dispatchEvent(new CustomEvent('penwright:insert-design-element', {
      detail: { snippet, name: selected.name },
    }));
    selected = null;
    open = false;
  }
</script>

<div class="dep">
  <button class="dep-head" onclick={() => (open = !open)} aria-expanded={open}>
    <span class="dep-chev">{open ? '▾' : '▸'}</span>
    <span class="dep-title">{t().design.elementLibraryTitle}</span>
    <span class="dep-count">{DESIGN_ELEMENTS.length}</span>
  </button>

  {#if open}
    <p class="dep-desc">{t().design.elementLibraryDesc}</p>

    {#if !canTheme}
      <p class="dep-warn">{t().design.elementLibraryNoStyle}</p>
    {/if}

    {#if !selected}
      <input
        class="dep-filter"
        type="search"
        bind:value={filter}
        placeholder={t().design.elementLibraryFilter}
      />
      <ul class="dep-list">
        {#each shown as el (el.id)}
          <li>
            <button class="dep-item" onclick={() => pick(el)}>
              <span class="dep-item-name">{el.name}</span>
              <span class="dep-item-desc">{el.description}</span>
            </button>
          </li>
        {/each}
        {#if shown.length === 0}
          <li class="dep-empty">{t().design.elementLibraryEmpty}</li>
        {/if}
      </ul>
    {:else}
      <div class="dep-form">
        <button class="dep-back" onclick={() => (selected = null)}>← {t().common.back}</button>
        <h4>{selected.name}</h4>
        <p class="dep-item-desc">{selected.description}</p>

        {#each selected.params as p (p.name)}
          <label class="dep-field">
            <span>{p.name}{p.required ? ' *' : ''}</span>
            <input type="text" bind:value={values[p.name]} placeholder={p.description} />
          </label>
        {/each}

        <button class="dep-insert" onclick={insert} disabled={missing.length > 0}>
          {missing.length > 0
            ? t().design.elementLibraryMissing(missing.join(', '))
            : t().design.elementLibraryInsert}
        </button>
      </div>
    {/if}
  {/if}
</div>

<style>
  .dep { border-top: 1px solid #2a2a2a; }
  .dep-head {
    width: 100%; display: flex; align-items: center; gap: 8px;
    background: none; border: none; color: #ddd; cursor: pointer;
    padding: 10px 12px; font-size: 12px; font-weight: 600; text-align: left;
  }
  .dep-head:hover { background: #232323; }
  .dep-chev { color: #777; font-size: 10px; }
  .dep-title { flex: 1; }
  .dep-count {
    background: #2f2f2f; color: #999; border-radius: 9px;
    padding: 1px 7px; font-size: 10px; font-weight: 500;
  }
  .dep-desc, .dep-warn { margin: 0 12px 8px; font-size: 11px; line-height: 1.45; color: #999; }
  .dep-warn { color: #e8b96a; }
  .dep-filter {
    width: calc(100% - 24px); margin: 0 12px 8px;
    background: #1c1c1c; border: 1px solid #333; border-radius: 4px;
    color: #ddd; padding: 5px 8px; font-size: 12px;
  }
  .dep-list { list-style: none; margin: 0 0 10px; padding: 0; max-height: 260px; overflow-y: auto; }
  .dep-item {
    width: 100%; display: block; text-align: left; background: none; border: none;
    color: #ddd; cursor: pointer; padding: 7px 12px;
  }
  .dep-item:hover { background: #232323; }
  .dep-item-name { display: block; font-size: 12px; }
  .dep-item-desc { display: block; font-size: 10.5px; color: #888; line-height: 1.4; margin-top: 2px; }
  .dep-empty { padding: 8px 12px; font-size: 11px; color: #777; }
  .dep-form { padding: 0 12px 12px; }
  .dep-back { background: none; border: none; color: #8ab4f8; cursor: pointer; font-size: 11px; padding: 0 0 6px; }
  .dep-form h4 { margin: 4px 0 2px; font-size: 12.5px; color: #eee; }
  .dep-field { display: block; margin-top: 8px; }
  .dep-field span { display: block; font-size: 10.5px; color: #999; margin-bottom: 3px; }
  .dep-field input {
    width: 100%; background: #1c1c1c; border: 1px solid #333; border-radius: 4px;
    color: #ddd; padding: 5px 8px; font-size: 12px; box-sizing: border-box;
  }
  .dep-insert {
    width: 100%; margin-top: 12px; padding: 7px;
    background: #2d5b9e; border: none; border-radius: 4px;
    color: #fff; font-size: 12px; cursor: pointer;
  }
  .dep-insert:disabled { background: #333; color: #777; cursor: default; }
</style>
