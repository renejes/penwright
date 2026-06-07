<script lang="ts">
  /**
   * SectionLookEditor — the "✎ anpassen" modal for a chapter's look. Edits the
   * full section-style overlay (colours, fonts, size, columns, headings) and
   * saves it either for ALL chapters using this rubric, or just THIS chapter
   * (forked into a chapter-unique variant). Routes through the safe-apply
   * engine, so a change that wouldn't compile is rolled back.
   */

  import { onMount } from 'svelte';
  import { t } from '@shared/i18n/store.svelte';

  let { chapterPath, styleId, onClose }:
    { chapterPath: string; styleId: string; onClose: () => void } = $props();

  const api = (window as unknown as {
    electronAPI?: { invoke(channel: string, ...args: unknown[]): Promise<unknown> };
  }).electronAPI;

  const FONTS = ['Inter', 'IBM Plex Sans', 'IBM Plex Serif', 'IBM Plex Mono', 'JetBrains Mono', 'Crimson Pro', 'Spectral', 'New Computer Modern'];
  const COLOR_SLOTS = ['accent', 'primary', 'text', 'muted', 'background'] as const;
  const WEIGHTS = ['regular', 'medium', 'semibold', 'bold'];
  const LEVELS = ['h1', 'h2', 'h3'] as const;

  interface HeadingFields { size: string; weight: string; color: string; }
  // Editable state.
  let name = $state('');
  let accent = $state('#a8503a');
  let primary = $state('#211e1a');
  let bodyFont = $state('');       // '' = wie Dokument
  let headingFont = $state('');
  let scaleBase = $state('');
  let scaleLeading = $state('');
  let columns = $state(0);          // 0 = wie Dokument
  let headings = $state<Record<string, HeadingFields>>({ h1: { size: '', weight: '', color: '' }, h2: { size: '', weight: '', color: '' }, h3: { size: '', weight: '', color: '' } });
  let showHeadings = $state(false);

  let loaded = $state(false);
  let busy = $state(false);
  let err = $state('');

  onMount(async () => {
    if (!api) return;
    try {
      const doc = await api.invoke('style:get') as { style?: { colors?: Record<string, string> } } | null;
      const sec = await api.invoke('section:getStyle', styleId) as {
        name?: string; colors?: Record<string, string>; fonts?: Record<string, string>;
        scaleBase?: string; scaleLeading?: string; columns?: number;
        headings?: Record<string, HeadingFields>;
      } | null;
      const dCols = doc?.style?.colors ?? {};
      name = sec?.name ?? styleId;
      accent = sec?.colors?.accent ?? dCols.accent ?? '#a8503a';
      primary = sec?.colors?.primary ?? dCols.primary ?? '#211e1a';
      bodyFont = sec?.fonts?.body ?? '';
      headingFont = sec?.fonts?.heading ?? '';
      scaleBase = sec?.scaleBase ?? '';
      scaleLeading = sec?.scaleLeading ?? '';
      columns = sec?.columns ?? 0;
      for (const lvl of LEVELS) {
        const h = sec?.headings?.[lvl];
        headings[lvl] = { size: h?.size ?? '', weight: h?.weight ?? '', color: h?.color ?? '' };
      }
    } catch { /* ignore */ }
    loaded = true;
  });

  function buildSection() {
    const fonts: Record<string, string> = {};
    if (bodyFont) fonts.body = bodyFont;
    if (headingFont) fonts.heading = headingFont;
    const hOut: Record<string, Partial<HeadingFields>> = {};
    for (const lvl of LEVELS) {
      const h = headings[lvl];
      const o: Partial<HeadingFields> = {};
      if (h.size) o.size = h.size;
      if (h.weight) o.weight = h.weight;
      if (h.color) o.color = h.color;
      if (Object.keys(o).length) hOut[lvl] = o;
    }
    return {
      id: styleId,
      name,
      colors: { accent, primary },
      fonts,
      scaleBase,
      scaleLeading,
      columns,
      headings: hOut,
    };
  }

  async function save(scope: 'all' | 'this') {
    if (!api || busy) return;
    busy = true;
    err = '';
    try {
      const res = await api.invoke('section:saveStyle', {
        chapterPath, styleId, style: buildSection(), scope,
      }) as { ok: boolean; error?: string } | undefined;
      if (res?.ok) {
        window.dispatchEvent(new CustomEvent('penwright:design-changed'));
        onClose();
      } else {
        err = res?.error ? t().look.errorWouldBreak : t().look.errorSaveFailed;
      }
    } catch {
      err = t().look.errorSaveFailed;
    } finally {
      busy = false;
    }
  }
</script>

<div class="sle-overlay" role="presentation" onclick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
  <div class="sle" role="dialog" aria-modal="true" aria-label={t().look.editorDialogAria} tabindex="-1">
    <header class="sle-head">
      <div>
        <div class="sle-title">{t().look.editorTitle}</div>
        <div class="sle-sub">{t().look.editorSubtitle(name)}</div>
      </div>
      <button class="sle-x" onclick={onClose} aria-label={t().look.closeAria}>×</button>
    </header>

    {#if loaded}
      <div class="sle-body">
        <div class="sle-row">
          <label class="sle-field">
            <span>{t().look.fieldAccent}</span>
            <input type="color" bind:value={accent} />
          </label>
          <label class="sle-field">
            <span>{t().look.fieldPrimary}</span>
            <input type="color" bind:value={primary} />
          </label>
        </div>

        <div class="sle-row">
          <label class="sle-field grow">
            <span>{t().look.fieldBodyFont}</span>
            <select bind:value={bodyFont}>
              <option value="">{t().look.asDocument}</option>
              {#each FONTS as f}<option value={f}>{f}</option>{/each}
            </select>
          </label>
          <label class="sle-field grow">
            <span>{t().look.fieldHeadingFont}</span>
            <select bind:value={headingFont}>
              <option value="">{t().look.asDocument}</option>
              {#each FONTS as f}<option value={f}>{f}</option>{/each}
            </select>
          </label>
        </div>

        <div class="sle-row">
          <label class="sle-field">
            <span>{t().look.fieldBaseSize}</span>
            <input type="text" bind:value={scaleBase} placeholder={t().look.baseSizePlaceholder} spellcheck="false" />
          </label>
          <label class="sle-field">
            <span>{t().look.fieldLeading}</span>
            <input type="text" bind:value={scaleLeading} placeholder={t().look.leadingPlaceholder} spellcheck="false" />
          </label>
          <label class="sle-field">
            <span>{t().look.fieldColumns}</span>
            <select bind:value={columns}>
              <option value={0}>{t().look.columnsAsDocument}</option>
              <option value={1}>1</option>
              <option value={2}>2</option>
              <option value={3}>3</option>
            </select>
          </label>
        </div>

        <button class="sle-toggle" onclick={() => (showHeadings = !showHeadings)} aria-expanded={showHeadings}>
          {showHeadings ? '▾' : '▸'} {t().look.headingsToggle}
        </button>
        {#if showHeadings}
          <div class="sle-headings">
            {#each LEVELS as lvl}
              <div class="sle-hrow">
                <span class="sle-hlabel">{lvl.toUpperCase()}</span>
                <input class="sle-hsize" type="text" bind:value={headings[lvl].size} placeholder={t().look.headingSizePlaceholder} spellcheck="false" />
                <select bind:value={headings[lvl].weight}>
                  <option value="">{t().look.headingWeightPlaceholder}</option>
                  {#each WEIGHTS as w}<option value={w}>{w}</option>{/each}
                </select>
                <select bind:value={headings[lvl].color}>
                  <option value="">{t().look.headingColorPlaceholder}</option>
                  {#each COLOR_SLOTS as c}<option value={c}>{c}</option>{/each}
                </select>
              </div>
            {/each}
          </div>
        {/if}

        <p class="sle-note">
          {t().look.editorNote}
        </p>
        {#if err}<p class="sle-err">{err}</p>{/if}
      </div>

      <footer class="sle-foot">
        <button class="sle-btn ghost" onclick={onClose}>{t().common.cancel}</button>
        <div class="sle-foot-right">
          <button class="sle-btn" disabled={busy} onclick={() => save('this')} title={t().look.saveThisChapterTitle}>{t().look.saveThisChapter}</button>
          <button class="sle-btn primary" disabled={busy} onclick={() => save('all')} title={t().look.saveAllTitle}>{t().look.saveAll}</button>
        </div>
      </footer>
    {/if}
  </div>
</div>

<style>
  .sle-overlay {
    position: fixed;
    inset: 0;
    z-index: 1000;
    background: rgba(33, 30, 26, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .sle {
    width: 480px;
    max-width: calc(100vw - 40px);
    max-height: calc(100vh - 80px);
    display: flex;
    flex-direction: column;
    background: #fbfaf7;
    border: 1px solid #ece6dd;
    border-radius: 12px;
    box-shadow: 0 20px 60px rgba(33, 30, 26, 0.25);
    font-size: 12.5px;
    color: #3a352e;
  }

  .sle-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    padding: 16px 18px 12px;
    border-bottom: 1px solid #ece6dd;
  }
  .sle-title { font-size: 14px; font-weight: 700; color: #211e1a; }
  .sle-sub { font-size: 11.5px; color: #8a8174; margin-top: 2px; }
  .sle-x { border: none; background: transparent; color: #998f7f; font-size: 20px; line-height: 1; cursor: pointer; padding: 0 4px; }
  .sle-x:hover { color: #6b6356; }

  .sle-body { padding: 14px 18px; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; }

  .sle-row { display: flex; gap: 12px; }
  .sle-field { display: flex; flex-direction: column; gap: 4px; flex: 0 0 auto; }
  .sle-field.grow { flex: 1; min-width: 0; }
  .sle-field span { font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.04em; color: #998f7f; }
  .sle-field input[type="text"], .sle-field select {
    border: 1px solid #d8cfc1; border-radius: 5px; background: #fff; color: #3a352e;
    font-size: 12px; padding: 5px 7px;
  }
  .sle-field input[type="color"] { width: 44px; height: 30px; border: 1px solid #d8cfc1; border-radius: 5px; background: #fff; padding: 2px; cursor: pointer; }

  .sle-toggle {
    align-self: flex-start; border: none; background: transparent; color: #6b6356;
    font-size: 11.5px; cursor: pointer; padding: 2px 0; font-weight: 500;
  }
  .sle-headings { display: flex; flex-direction: column; gap: 6px; }
  .sle-hrow { display: flex; align-items: center; gap: 6px; }
  .sle-hlabel { flex: 0 0 28px; font-size: 11px; font-weight: 600; color: #8a8174; }
  .sle-hrow input, .sle-hrow select {
    border: 1px solid #d8cfc1; border-radius: 5px; background: #fff; color: #3a352e; font-size: 11.5px; padding: 4px 6px;
  }
  .sle-hsize { width: 64px; }
  .sle-hrow select { flex: 1; min-width: 0; }

  .sle-note { margin: 2px 0 0; font-size: 10.5px; line-height: 1.4; color: #8a8174; }
  .sle-err { margin: 0; font-size: 11.5px; color: #b4402e; }

  .sle-foot {
    display: flex; align-items: center; justify-content: space-between; gap: 8px;
    padding: 12px 18px; border-top: 1px solid #ece6dd;
  }
  .sle-foot-right { display: flex; gap: 8px; }
  .sle-btn {
    padding: 7px 14px; border: 1px solid #d8cfc1; border-radius: 6px; background: #fff;
    color: #3a352e; font-size: 12px; font-weight: 500; cursor: pointer;
  }
  .sle-btn:hover { background: #f4f1ec; }
  .sle-btn:disabled { opacity: 0.5; cursor: default; }
  .sle-btn.ghost { border-color: transparent; background: transparent; color: #8a8174; }
  .sle-btn.primary { background: #a8503a; border-color: #a8503a; color: #fff; }
  .sle-btn.primary:hover { background: #95462f; }
</style>
