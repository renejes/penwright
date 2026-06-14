<script lang="ts">
  /**
   * DesignPanel — Phase B sidebar tab for the visual style editor.
   *
   * Round 1 (Sessions 21–22): Color palette + font browser. Each control writes
   * back into the project's `.penwright/style.json` via `style:save` IPC, which
   * regenerates `style.typ` and kicks off the compiler — the PDF preview reflects
   * the change within ~300 ms of the user releasing the slider.
   *
   * The panel intentionally caches its own copy of `ProjectStyle` and debounces
   * saves: hooking each color-slider tick straight to the compiler would burn
   * CPU and produce flicker. The debounce lives here, not in the IPC handler,
   * because save semantics from menus (Settings dialog) should remain immediate.
   */

  import { onMount, onDestroy } from 'svelte';
  import Coloris from '@melloware/coloris';
  import '@melloware/coloris/dist/coloris.css';
  import {
    type ProjectStyle,
    type StyleColors,
    type StyleHeadings,
    type SectionStyle,
    DEFAULT_PROJECT_STYLE,
    COLOR_SLOTS,
    HEADING_LEVELS,
    cloneProjectStyle,
  } from '../../shared/styleTypes';
  import { PALETTE_PRESETS } from '../../shared/palettePresets';
  import { THEME_PRESETS } from '../../shared/themePresets';
  import { LAYOUT_PRESETS } from '../../shared/layoutPresets';
  import { SECTION_PRESETS, getSectionPreset } from '../../shared/sectionPresets';
  import CodeEditor from './CodeEditor.svelte';
  import { t } from '@shared/i18n/store.svelte';

  type Status = 'idle' | 'loading' | 'saving' | 'saved' | 'error';
  type FontSlot = keyof ProjectStyle['fonts'];

  interface BundledFont {
    family: string;
    slug: string;
    category: 'sans' | 'serif' | 'mono' | string;
    description: string;
    files: string[];      // populated from manifest.json; ordered Regular / Italic / Bold / BoldItalic
  }

  const api = (window as unknown as {
    electronAPI?: { invoke(channel: string, ...args: unknown[]): Promise<unknown> };
  }).electronAPI;

  // `mainView` = rendered as the full-width Look designer (when style.typ is
  // open) rather than in the narrow sidebar. Currently only affects width.
  let { mainView = false }: { mainView?: boolean } = $props();

  let style: ProjectStyle = $state(cloneProjectStyle(DEFAULT_PROJECT_STYLE));
  let initialized = $state(false);
  let status: Status = $state('idle');
  // The project's design home (root document) — global style always targets it,
  // never the open chapter. Shown as the scope label of the "Globale Styles" zone.
  let rootFileName = $state('main.typ');
  // Collapsible "?" help for each zone header.
  let showGlobalHelp = $state(false);
  let showSectionHelp = $state(false);
  let fonts: BundledFont[] = $state([]);
  let fontFaceStyles = $state('');
  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  // Set when we mutate `style` programmatically (preset / extraction). Keeps
  // the $effect-driven save from firing during the initial load.
  let suppressSave = true;

  // ─── Slot labels — short user-facing names for each semantic slot.
  const SLOT_LABEL: Record<keyof StyleColors, string> = $derived({
    primary: t().design.slotPrimary,
    accent: t().design.slotAccent,
    text: t().design.slotText,
    background: t().design.slotBackground,
    muted: t().design.slotMuted,
  });

  const SLOT_HINT: Record<keyof StyleColors, string> = $derived({
    primary: t().design.slotHintPrimary,
    accent: t().design.slotHintAccent,
    text: t().design.slotHintText,
    background: t().design.slotHintBackground,
    muted: t().design.slotHintMuted,
  });

  onMount(async () => {
    if (!api) return;
    status = 'loading';

    try {
      const result = await api.invoke('style:get') as
        { style: ProjectStyle; initialized: boolean; rootFile?: string } | null;
      if (result?.style) {
        style = cloneProjectStyle(result.style);
        initialized = result.initialized;
        if (result.rootFile) rootFileName = result.rootFile;
      }
    } catch (err) {
      console.warn('[DesignPanel] style:get failed:', err);
    }

    // Load the bundled fonts manifest so the font browser shows real
    // names + lets us @font-face the preview text in each card.
    try {
      const bundle = await api.invoke('app:getBundleLicenses') as
        { fonts?: BundledFont[] } | { error: string };
      if (bundle && 'fonts' in bundle && Array.isArray(bundle.fonts)) {
        fonts = bundle.fonts.map(f => ({
          family: f.family,
          slug: f.slug,
          category: f.category,
          description: f.description,
          files: f.files ?? [],
        }));
        // Generate @font-face rules so font cards render their own family
        // for preview. We register the first .ttf/.otf per family as the
        // regular weight — that's enough for the card heading + body line.
        fontFaceStyles = fonts.map(f => {
          const regular = f.files.find(name => /-Regular\.(ttf|otf)$/i.test(name)) ?? f.files[0];
          if (!regular) return '';
          const url = `penwright-font://${encodeURIComponent(f.slug)}/${encodeURIComponent(regular)}`;
          return `@font-face { font-family: ${JSON.stringify(f.family)}; src: url("${url}"); font-display: swap; }`;
        }).join('\n');
      }
    } catch (err) {
      console.warn('[DesignPanel] app:getBundleLicenses failed:', err);
    }

    // Coloris attaches itself to inputs matching the selector. We pass an
    // onChange that writes back into our state — Svelte's $state proxy is
    // mutation-aware, so the $effect below picks the change up and triggers
    // the debounced save.
    try {
      Coloris.init();
      Coloris({
        el: '.coloris-slot',
        themeMode: 'auto',
        alpha: false,
        format: 'hex',
        margin: 6,
        swatches: [
          '#0f172a', '#1e293b', '#3b82f6', '#0ea5e9', '#10b981',
          '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#ffffff',
        ],
        onChange: (color: string, el: HTMLElement | undefined) => {
          const slot = el?.dataset.slot as keyof StyleColors | undefined;
          if (slot && COLOR_SLOTS.includes(slot)) {
            style.colors[slot] = color.toLowerCase();
          }
        },
      });
    } catch (err) {
      console.warn('[DesignPanel] Coloris init failed:', err);
    }

    // Allow the auto-save effect to fire from here on.
    suppressSave = false;
    status = 'idle';

    // Reflect any selection pinned before this panel mounted, and react to
    // pins / applied-designs while it's open.
    await refreshCanUndo();
    window.addEventListener('penwright:design-changed', onDesignChanged);
  });

  onDestroy(() => {
    if (saveTimer) clearTimeout(saveTimer);
    window.removeEventListener('penwright:design-changed', onDesignChanged);
  });

  $effect(() => {
    // Touch every leaf so Svelte tracks all of them.
    const touched = JSON.stringify(style);
    if (suppressSave) return;
    scheduleSave(touched);
  });

  let lastSavedSerialized = '';

  function scheduleSave(serialized: string): void {
    if (!api) return;
    if (serialized === lastSavedSerialized) return;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      saveTimer = null;
      status = 'saving';
      try {
        // Spread to detach from the $state proxy (structured-clone safety).
        const res = await api!.invoke('style:save', JSON.parse(serialized)) as
          { ok: boolean; kept?: boolean } | undefined;
        if (res && res.ok === false) {
          // Safe-apply rolled the change back (it would have broken the doc).
          // Revert the panel to what's actually applied so controls match.
          await reloadStyleFromDisk();
          status = 'error';
          designMsg = t().design.rollbackNote;
          setTimeout(() => { if (designMsg) designMsg = ''; }, 5000);
        } else {
          lastSavedSerialized = serialized;
          status = 'saved';
          setTimeout(() => { if (status === 'saved') status = 'idle'; }, 1500);
        }
      } catch (err) {
        console.warn('[DesignPanel] style:save failed:', err);
        status = 'error';
      }
      await refreshCanUndo();
    }, 300);
  }

  // ─── Safe-apply: rollback feedback + design undo ────
  let designMsg = $state('');           // transient "kept your doc" / "undone" note
  let canUndo = $state(false);
  let undoLabel = $state<string | null>(null);

  async function refreshCanUndo(): Promise<void> {
    if (!api) return;
    try {
      const r = await api.invoke('design:canUndo') as { canUndo: boolean; label: string | null };
      canUndo = !!r?.canUndo;
      undoLabel = r?.label ?? null;
    } catch { /* ignore */ }
  }

  /** Reloads `style` from disk without re-triggering a save (used after a
   *  rollback or an undo, so the controls reflect what's actually applied). */
  async function reloadStyleFromDisk(): Promise<void> {
    if (!api) return;
    suppressSave = true;
    try {
      const result = await api.invoke('style:get') as { style?: ProjectStyle } | null;
      if (result?.style) {
        style = cloneProjectStyle(result.style);
        lastSavedSerialized = JSON.stringify(style);
      }
    } catch { /* ignore */ }
    // Re-enable saves after the style-assignment $effect has settled.
    setTimeout(() => { suppressSave = false; }, 0);
  }

  async function undoDesign(): Promise<void> {
    if (!api || !canUndo) return;
    try {
      const res = await api.invoke('design:undo') as { ok: boolean } | undefined;
      if (res?.ok) {
        await reloadStyleFromDisk();
        designMsg = t().design.undoneNote;
        setTimeout(() => { if (designMsg) designMsg = ''; }, 2500);
      }
    } catch { /* ignore */ }
    await refreshCanUndo();
  }

  function onDesignChanged(): void {
    // A design change happened elsewhere (e.g. the chapter-look dropdown).
    reloadStyleFromDisk();
    refreshCanUndo();
  }

  function applyPreset(presetId: string): void {
    const preset = PALETTE_PRESETS.find(p => p.id === presetId);
    if (!preset) return;
    style.colors = { ...preset.colors };
  }

  /**
   * Applies a full theme — overwrites every branch of `style` except
   * `custom.preamble`, which we preserve because the user's escape-hatch
   * code is project-specific and not part of any theme. Custom code is
   * additive (appended below generated rules), so keeping it works with
   * any theme.
   */
  function applyTheme(themeId: string): void {
    const theme = THEME_PRESETS.find(p => p.id === themeId);
    if (!theme) return;
    const preservedCustom = style.custom?.preamble ?? '';
    // Preserve project-specific data the theme doesn't carry: the custom-code
    // escape hatch and the per-chapter section styles (Phase E).
    const preservedSections = style.sections ?? [];
    // Preserve the print / prepress setup (bleed, crop marks, facing pages,
    // binding gutter) — a theme is colour + typography, not a print decision.
    const p = style.layout;
    style = cloneProjectStyle({
      ...theme.style,
      sections: preservedSections,
      custom: { preamble: preservedCustom },
      layout: {
        ...theme.style.layout,
        bleed: p.bleed ?? '',
        cropMarks: p.cropMarks ?? false,
        facingPages: p.facingPages ?? false,
        binding: p.binding ?? '',
      },
    });
  }

  /**
   * Applies a layout preset: replaces `style.layout` and optionally
   * `style.scale.base`. Everything else stays — themes/colors/fonts/headings/
   * elements/custom are left alone. Lets the user combine a theme with a
   * layout swap without losing typography choices.
   */
  function applyLayout(layoutId: string): void {
    const p = LAYOUT_PRESETS.find(x => x.id === layoutId);
    if (!p) return;
    style.layout = { ...p.layout };
    if (p.baseSize) style.scale.base = p.baseSize;
  }

  // ─── Section styles (Phase E — per-chapter magazine rubrics) ───
  let sectionsExpanded = $state(false);

  const COLUMN_OPTIONS = $derived([
    { value: 0, label: t().design.colInherit },
    { value: 1, label: t().design.col1 },
    { value: 2, label: t().design.col2 },
    { value: 3, label: t().design.col3 },
  ]);

  function addSectionFromPreset(presetId: string): void {
    const preset = getSectionPreset(presetId);
    if (!preset) return;
    let id = preset.id;
    let n = 2;
    while (style.sections.some(s => s.id === id)) id = `${preset.id}-${n++}`;
    style.sections = [...style.sections, { ...preset, id }];
    sectionsExpanded = true;
  }

  function removeSection(id: string): void {
    style.sections = style.sections.filter(s => s.id !== id);
  }

  function setFont(slot: FontSlot, family: string): void {
    style.fonts[slot] = family;
  }

  // Group fonts for display by category so the user sees sans / serif / mono
  // in a stable order; cards inside each group keep manifest order.
  const FONT_CATEGORIES: ReadonlyArray<{ id: 'sans' | 'serif' | 'mono'; label: string }> = $derived([
    { id: 'sans',  label: t().design.fontCatSans },
    { id: 'serif', label: t().design.fontCatSerif },
    { id: 'mono',  label: t().design.fontCatMono },
  ]);

  function fontsIn(category: 'sans' | 'serif' | 'mono'): BundledFont[] {
    return fonts.filter(f => f.category === category);
  }

  // Compact label for the slot-pill that shows which font is currently
  // assigned to each role.
  const SLOT_PILL_LABEL: Record<FontSlot, string> = $derived({
    body: t().design.pillBody,
    heading: t().design.pillHeading,
    code: t().design.pillCode,
  });

  function activeSlotsFor(family: string): FontSlot[] {
    const result: FontSlot[] = [];
    (['body', 'heading', 'code'] as FontSlot[]).forEach(slot => {
      if (style.fonts[slot] === family) result.push(slot);
    });
    return result;
  }

  type HeadingLevelKey = keyof Pick<StyleHeadings, 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'>;

  // Track which heading cards are open. Default H1+H2 expanded (the
  // 80 % case) and H3-H6 collapsed so the section doesn't dominate the panel.
  let headingExpanded = $state<Record<HeadingLevelKey, boolean>>({
    h1: true, h2: true, h3: false, h4: false, h5: false, h6: false,
  });

  function toggleHeading(level: HeadingLevelKey): void {
    headingExpanded[level] = !headingExpanded[level];
  }

  // Compact summary line shown on collapsed cards — gives the user a quick
  // read of what the level looks like without expanding everything.
  function headingSummary(level: HeadingLevelKey): string {
    const h = style.headings[level];
    return `${h.size} · ${h.weight} · ${h.color}`;
  }

  // ─── Elements (Blockquote / Code-Block / Figure / Table) ─────
  type ElementKey = 'blockquote' | 'codeBlock' | 'figure' | 'table';

  const ELEMENT_LABELS: Record<ElementKey, string> = $derived({
    blockquote: t().design.elementBlockquote,
    codeBlock:  t().design.elementCodeBlock,
    figure:     t().design.elementFigure,
    table:      t().design.elementTable,
  });

  let elementsExpanded = $state<Record<ElementKey, boolean>>({
    blockquote: false, codeBlock: false, figure: false, table: false,
  });

  function toggleElement(key: ElementKey): void {
    elementsExpanded[key] = !elementsExpanded[key];
  }

  // One-line collapsed summary per element — gives a quick at-a-glance
  // read of the configured key so users don't have to expand to remember.
  // Each case pulls its element through the typed key so TypeScript narrows
  // correctly (a single `style.elements[key]` lookup keeps the union type).
  function elementSummary(key: ElementKey): string {
    switch (key) {
      case 'blockquote': {
        const el = style.elements.blockquote;
        return `${el.borderWidth} ${el.borderColor}${el.italic ? ` · ${t().design.summaryItalic}` : ''}`;
      }
      case 'codeBlock': {
        const el = style.elements.codeBlock;
        return el.background ? t().design.summaryBg(el.background) : t().design.summaryNoBackground;
      }
      case 'figure': {
        const el = style.elements.figure;
        return `${el.captionPosition} · ${el.captionAlign}`;
      }
      case 'table': {
        const el = style.elements.table;
        return `${t().design.summaryHeader(el.headerBackground)}${el.alternateRowFill ? ` · ${t().design.summaryZebra}` : ''}`;
      }
    }
  }

  function onCustomCodeChange(value: string): void {
    if (style.custom) {
      style.custom.preamble = value;
    } else {
      style.custom = { preamble: value };
    }
  }

  let customExpanded = $state(false);

  // The hex-input keeps a synchronized text representation. We accept any
  // three- or six-digit hex; longer strings get truncated.
  function onHexInput(slot: keyof StyleColors, raw: string): void {
    const trimmed = raw.trim();
    if (/^#?[0-9a-fA-F]{3,6}$/.test(trimmed)) {
      const hex = trimmed.startsWith('#') ? trimmed : '#' + trimmed;
      style.colors[slot] = hex.toLowerCase();
    }
  }
</script>

<div class="design-panel" class:main-view={mainView}>
  <div class="design-header">
    <div class="design-title">{mainView ? t().design.titleMainView : t().design.titleSidebar}</div>
    {#if status === 'saving'}
      <span class="design-status saving">{t().design.statusSaving}</span>
    {:else if status === 'saved'}
      <span class="design-status saved">{t().design.statusSaved}</span>
    {:else if status === 'error'}
      <span class="design-status error">{t().design.statusError}</span>
    {/if}
    {#if canUndo}
      <button class="design-undo-btn" onclick={undoDesign} title={undoLabel ? t().design.undoTitle(undoLabel) : t().design.undoTitleGeneric}>{t().design.undoButton}</button>
    {/if}
  </div>

  {#if designMsg}
    <div class="design-rollback-note">{designMsg}</div>
  {/if}

  <!-- Zone: global styles — everything here targets the whole document. -->
  <div class="zone-divider">
    <div class="zone-head">
      <span class="zone-title">{t().design.globalZoneTitle}</span>
      <button
        type="button"
        class="zone-help-btn"
        onclick={() => (showGlobalHelp = !showGlobalHelp)}
        aria-expanded={showGlobalHelp}
        aria-label={t().design.globalHelpAria}
        title={t().design.globalHelpTitle}
      >?</button>
    </div>
    <div class="zone-scope">{t().design.globalScopePrefix}<strong>{t().design.globalScopeStrong}</strong> → <code>{rootFileName}</code></div>
    {#if showGlobalHelp}
      <p class="zone-help">
        {t().design.globalHelp1}<code>style.typ</code>{t().design.globalHelp2}<strong>{t().design.globalHelpStrong}</strong>{t().design.globalHelp3}<code>{rootFileName}</code>{t().design.globalHelp4}
      </p>
    {/if}
  </div>

  <section class="design-section">
    <header class="design-section-header">
      <h3>{t().design.paletteTitle}</h3>
      {#if !initialized}
        <span class="design-section-hint">{t().design.paletteUninitializedHint1}<code>style.json</code>{t().design.paletteUninitializedHint2}</span>
      {/if}
    </header>

    <div class="palette-grid">
      {#each COLOR_SLOTS as slot}
        <div class="palette-slot">
          <div class="palette-slot-label">
            <span class="palette-slot-name">{SLOT_LABEL[slot]}</span>
            <span class="palette-slot-hint">{SLOT_HINT[slot]}</span>
          </div>
          <div class="palette-slot-controls">
            <input
              type="text"
              class="coloris-slot palette-color-input"
              data-coloris
              data-slot={slot}
              value={style.colors[slot]}
              spellcheck="false"
              autocomplete="off"
              aria-label={t().design.slotColorAria(SLOT_LABEL[slot])}
              oninput={(e) => onHexInput(slot, e.currentTarget.value)}
            />
          </div>
        </div>
      {/each}
    </div>
  </section>

  <section class="design-section">
    <header class="design-section-header">
      <h3>{t().design.palettePresetsTitle}</h3>
      <span class="design-section-hint">{t().design.palettePresetsHint}</span>
    </header>

    <div class="preset-grid">
      {#each PALETTE_PRESETS as preset}
        <button
          type="button"
          class="preset-card"
          onclick={() => applyPreset(preset.id)}
          title={preset.description}
        >
          <div class="preset-swatches">
            <span style="background: {preset.colors.primary}"></span>
            <span style="background: {preset.colors.accent}"></span>
            <span style="background: {preset.colors.text}"></span>
            <span style="background: {preset.colors.muted}"></span>
            <span style="background: {preset.colors.background}; border: 1px solid #ddd"></span>
          </div>
          <div class="preset-name">{preset.name}</div>
        </button>
      {/each}
    </div>
  </section>

  <section class="design-section">
    <header class="design-section-header">
      <h3>{t().design.themesTitle}</h3>
      <span class="design-section-hint">{t().design.themesHint}</span>
    </header>

    <div class="theme-grid">
      {#each THEME_PRESETS as preset}
        <button
          type="button"
          class="theme-card"
          onclick={() => applyTheme(preset.id)}
          title={preset.description}
        >
          <div class="theme-swatches">
            <span style="background: {preset.style.colors.primary}"></span>
            <span style="background: {preset.style.colors.accent}"></span>
            <span style="background: {preset.style.colors.text}"></span>
            <span style="background: {preset.style.colors.muted}"></span>
            <span style="background: {preset.style.colors.background}; border: 1px solid #ddd"></span>
          </div>
          <div class="theme-name">{preset.name}</div>
          <div class="theme-fonts">
            <span style="font-family: {JSON.stringify(preset.style.fonts.body)}">Aa</span>
            <span style="font-family: {JSON.stringify(preset.style.fonts.heading)}; font-weight: 600">H</span>
            <span class="theme-fonts-code" style="font-family: {JSON.stringify(preset.style.fonts.code)}">{'{}'}</span>
          </div>
          <div class="theme-best">{preset.bestFor}</div>
        </button>
      {/each}
    </div>
  </section>

  <section class="design-section">
    <header class="design-section-header">
      <h3>{t().design.layoutPresetsTitle}</h3>
      <span class="design-section-hint">{t().design.layoutPresetsHint}</span>
    </header>

    <div class="theme-grid">
      {#each LAYOUT_PRESETS as preset}
        <button
          type="button"
          class="layout-card"
          onclick={() => applyLayout(preset.id)}
          title={preset.description}
        >
          <div
            class="layout-icon"
            class:layout-icon-landscape={preset.layout.orientation === 'landscape'}
            class:layout-icon-cols-2={preset.layout.columns === 2}
            class:layout-icon-cols-3={preset.layout.columns === 3}
            aria-hidden="true"
          >
            {#if preset.layout.columns === 1}
              <span class="layout-bar"></span>
              <span class="layout-bar"></span>
              <span class="layout-bar layout-bar-short"></span>
            {:else if preset.layout.columns === 2}
              <span class="layout-col"></span>
              <span class="layout-col"></span>
            {:else}
              <span class="layout-col"></span>
              <span class="layout-col"></span>
              <span class="layout-col"></span>
            {/if}
          </div>
          <div class="layout-name">{preset.name}</div>
          <div class="layout-meta">
            {preset.layout.paper.toUpperCase()} · {preset.layout.orientation === 'landscape' ? t().design.layoutLandscape : t().design.layoutPortrait} · {preset.layout.columns} {preset.layout.columns > 1 ? t().design.layoutColPlural : t().design.layoutColSingular}{preset.baseSize ? ` · ${preset.baseSize}` : ''}
          </div>
          <div class="layout-best">{preset.bestFor}</div>
        </button>
      {/each}
    </div>
  </section>

  <section class="design-section">
    <header class="design-section-header">
      <h3>{t().design.fontsTitle}</h3>
      <span class="design-section-hint">
        {t().design.fontsHint}
      </span>
    </header>

    <div class="font-active">
      <div class="font-active-row">
        <span class="font-active-label">{t().design.fontActiveBody}</span>
        <span class="font-active-value" style="font-family: {style.fonts.body}">{style.fonts.body}</span>
      </div>
      <div class="font-active-row">
        <span class="font-active-label">{t().design.fontActiveHeading}</span>
        <span class="font-active-value" style="font-family: {style.fonts.heading}">{style.fonts.heading}</span>
      </div>
      <div class="font-active-row">
        <span class="font-active-label">{t().design.fontActiveCode}</span>
        <span class="font-active-value font-active-code" style="font-family: {style.fonts.code}">{style.fonts.code}</span>
      </div>
    </div>

    {#each FONT_CATEGORIES as category}
      {@const list = fontsIn(category.id)}
      {#if list.length > 0}
        <div class="font-category">
          <div class="font-category-label">{category.label}</div>

          {#each list as font}
            {@const activeSlots = activeSlotsFor(font.family)}
            <div class="font-card" class:font-card-active={activeSlots.length > 0}>
              <div class="font-card-head">
                <div class="font-card-name" style="font-family: {JSON.stringify(font.family)}">{font.family}</div>
                {#if activeSlots.length > 0}
                  <div class="font-card-pills">
                    {#each activeSlots as slot}
                      <span class="font-card-pill">{SLOT_PILL_LABEL[slot]}</span>
                    {/each}
                  </div>
                {/if}
              </div>
              <div class="font-card-sample" style="font-family: {JSON.stringify(font.family)}">
                {t().design.fontSample}
              </div>
              <div class="font-card-actions">
                <button type="button" class="font-action" onclick={() => setFont('body', font.family)}>{t().design.fontActionBody}</button>
                <button type="button" class="font-action" onclick={() => setFont('heading', font.family)}>{t().design.fontActionHeading}</button>
                {#if category.id === 'mono'}
                  <button type="button" class="font-action" onclick={() => setFont('code', font.family)}>{t().design.fontActionCode}</button>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      {/if}
    {/each}

    {#if fonts.length === 0}
      <div class="design-section-hint">
        {t().design.fontsLoadError1}<code>npm run fetch:fonts</code>{t().design.fontsLoadError2}
      </div>
    {/if}
  </section>

  <section class="design-section">
    <header class="design-section-header">
      <h3>{t().design.scaleTitle}</h3>
    </header>

    <div class="design-fields">
      <label class="design-field">
        <span>{t().design.scaleBase}</span>
        <input
          type="text"
          bind:value={style.scale.base}
          placeholder="11pt"
          spellcheck="false"
        />
      </label>

      <label class="design-field">
        <span>{t().design.scaleLeading}</span>
        <input
          type="text"
          bind:value={style.scale.leading}
          placeholder="0.65em"
          spellcheck="false"
        />
      </label>

      <label class="design-field">
        <span>{t().design.scaleParagraphSpacing}</span>
        <input
          type="text"
          bind:value={style.scale.paragraphSpacing}
          placeholder={t().design.scaleParagraphSpacingPlaceholder}
          spellcheck="false"
        />
      </label>

      <label class="design-field">
        <span>{t().design.scaleFirstLineIndent}</span>
        <input
          type="text"
          bind:value={style.scale.firstLineIndent}
          placeholder={t().design.scaleFirstLineIndentPlaceholder}
          spellcheck="false"
        />
      </label>
    </div>
  </section>

  <section class="design-section">
    <header class="design-section-header">
      <h3>{t().design.layoutTitle}</h3>
      <span class="design-section-hint">{t().design.layoutHint1}<code>*Bold*</code>{t().design.layoutHint2}<code>#counter(page).display()</code>{t().design.layoutHint3}</span>
    </header>

    <div class="design-fields">
      <label class="design-field">
        <span>{t().design.fieldPaper}</span>
        <select bind:value={style.layout.paper}>
          <option value="a3">a3</option>
          <option value="a4">a4</option>
          <option value="a5">a5</option>
          <option value="a2">a2</option>
          <option value="us-letter">us-letter</option>
          <option value="us-legal">us-legal</option>
        </select>
      </label>

      <label class="design-field">
        <span>{t().design.fieldOrientation}</span>
        <select bind:value={style.layout.orientation}>
          <option value="portrait">{t().design.layoutPortrait}</option>
          <option value="landscape">{t().design.layoutLandscape}</option>
        </select>
      </label>

      <label class="design-field">
        <span>{t().design.fieldMargin}</span>
        <input
          type="text"
          bind:value={style.layout.margin}
          placeholder="2.5cm"
          spellcheck="false"
        />
      </label>

      <label class="design-field">
        <span>{t().design.fieldColumns}</span>
        <select bind:value={style.layout.columns}>
          <option value={1}>1</option>
          <option value={2}>2</option>
          <option value={3}>3</option>
        </select>
      </label>

      <label class="design-field">
        <span>{t().design.fieldPageNumbering}</span>
        <select bind:value={style.layout.pageNumbering}>
          <option value="">{t().design.pageNumberingNone}</option>
          <option value="1">1, 2, 3</option>
          <option value="1 / 1">{t().design.pageNumberingWithTotal}</option>
          <option value="— 1 —">— 1 —</option>
          <option value="i">{t().design.pageNumberingRomanLower}</option>
          <option value="I">{t().design.pageNumberingRomanUpper}</option>
        </select>
      </label>

      <label class="design-field">
        <span>{t().design.fieldHeader}</span>
        <input
          type="text"
          bind:value={style.layout.pageHeader}
          placeholder={t().design.headerPlaceholder}
          spellcheck="false"
        />
      </label>
      <p class="design-hint">{t().design.headerHint1}<code>{'{chapter}'}</code>{t().design.headerHint2}<code>{'{section}'}</code>{t().design.headerHint3}<code>#h(1fr)</code>{t().design.headerHint4}<code>#counter(page).display()</code>{t().design.headerHint5}</p>

      <label class="design-field">
        <span>{t().design.fieldFooter}</span>
        <input
          type="text"
          bind:value={style.layout.pageFooter}
          placeholder={t().design.footerPlaceholder}
          spellcheck="false"
        />
      </label>
      <p class="design-hint">{t().design.footerHint1}<code>{'{chapter}'}</code>{t().design.footerHint2}<code>{'{section}'}</code>{t().design.footerHint3}</p>

      <label class="design-field">
        <span>{t().design.fieldPageBackground}</span>
        <select bind:value={style.layout.pageFill}>
          <option value="">{t().design.pageFillNone}</option>
          <option value="luma(252)">{t().design.pageFillLightGray}</option>
          <option value="luma(245)">{t().design.pageFillMediumGray}</option>
          <option value="rgb(&quot;#FFFFF0&quot;)">{t().design.pageFillIvory}</option>
          <option value="rgb(&quot;#FFF8F0&quot;)">{t().design.pageFillWarmCream}</option>
          <option value="rgb(&quot;#F0F4FF&quot;)">{t().design.pageFillCoolBlue}</option>
        </select>
      </label>
    </div>
  </section>

  <section class="design-section">
    <header class="design-section-header">
      <h3>{t().design.headingsTitle}</h3>
    </header>

    <div class="design-fields">
      <label class="design-field">
        <span>{t().design.fieldNumbering}</span>
        <select bind:value={style.headings.numbering}>
          <option value="">{t().design.numberingNone}</option>
          <option value="1.">1. 2. 3.</option>
          <option value="1.1">1.1 1.2 2.1</option>
          <option value="1.a">1.a 1.b 2.a</option>
          <option value="I.">I. II. III.</option>
        </select>
      </label>

      {#each HEADING_LEVELS as level (level)}
        {@const h = style.headings[level]}
        {@const isOpen = headingExpanded[level]}
        <div class="heading-card" class:open={isOpen}>
          <button
            type="button"
            class="heading-card-head"
            onclick={() => toggleHeading(level)}
            aria-expanded={isOpen}
          >
            <span class="heading-card-chev">{isOpen ? '▾' : '▸'}</span>
            <span class="heading-card-level">{level.toUpperCase()}</span>
            <span
              class="heading-card-preview"
              style="font-family: {JSON.stringify(style.fonts.heading)}; font-weight: {h.weight === 'bold' ? 700 : h.weight === 'semibold' ? 600 : h.weight === 'extrabold' ? 800 : h.weight === 'medium' ? 500 : 400}; color: {style.colors[h.color]}"
            >{t().design.headingPreview}</span>
            {#if !isOpen}
              <span class="heading-card-summary">{headingSummary(level)}</span>
            {/if}
          </button>

          {#if isOpen}
            <div class="heading-card-body">
              <label class="design-field">
                <span>{t().design.headingSize}</span>
                <input type="text" bind:value={h.size} placeholder="24pt" spellcheck="false" />
              </label>
              <label class="design-field">
                <span>{t().design.headingWeight}</span>
                <select bind:value={h.weight}>
                  <option value="regular">{t().design.weightRegular}</option>
                  <option value="medium">{t().design.weightMedium}</option>
                  <option value="semibold">{t().design.weightSemibold}</option>
                  <option value="bold">{t().design.weightBold}</option>
                  <option value="extrabold">{t().design.weightExtrabold}</option>
                </select>
              </label>
              <label class="design-field">
                <span>{t().design.headingColor}</span>
                <select bind:value={h.color}>
                  {#each COLOR_SLOTS as slot}<option value={slot}>{slot}</option>{/each}
                </select>
              </label>
              <label class="design-field">
                <span>{t().design.headingMarginTop}</span>
                <input type="text" bind:value={h.marginTop} placeholder="2em" spellcheck="false" />
              </label>
            </div>
          {/if}
        </div>
      {/each}
    </div>
  </section>

  <section class="design-section">
    <header class="design-section-header">
      <h3>{t().design.elementsTitle}</h3>
      <span class="design-section-hint">{t().design.elementsHint1}<code>gentle-clues</code>{t().design.elementsHint2}</span>
    </header>

    <div class="design-fields">
      <!-- Blockquote -->
      <div class="heading-card" class:open={elementsExpanded.blockquote}>
        <button
          type="button"
          class="heading-card-head"
          onclick={() => toggleElement('blockquote')}
          aria-expanded={elementsExpanded.blockquote}
        >
          <span class="heading-card-chev">{elementsExpanded.blockquote ? '▾' : '▸'}</span>
          <span class="heading-card-level">BQ</span>
          <span class="heading-card-preview">{ELEMENT_LABELS.blockquote}</span>
          {#if !elementsExpanded.blockquote}
            <span class="heading-card-summary">{elementSummary('blockquote')}</span>
          {/if}
        </button>
        {#if elementsExpanded.blockquote}
          <div class="heading-card-body">
            <label class="design-field">
              <span>{t().design.bqBorderColor}</span>
              <select bind:value={style.elements.blockquote.borderColor}>
                {#each COLOR_SLOTS as slot}<option value={slot}>{slot}</option>{/each}
              </select>
            </label>
            <label class="design-field">
              <span>{t().design.bqBorderWidth}</span>
              <input type="text" bind:value={style.elements.blockquote.borderWidth} placeholder="3pt" spellcheck="false" />
            </label>
            <label class="design-field">
              <span>{t().design.bqPaddingLeft}</span>
              <input type="text" bind:value={style.elements.blockquote.paddingLeft} placeholder="1em" spellcheck="false" />
            </label>
            <label class="design-field">
              <span>{t().design.bqTextColor}</span>
              <select bind:value={style.elements.blockquote.textColor}>
                {#each COLOR_SLOTS as slot}<option value={slot}>{slot}</option>{/each}
              </select>
            </label>
            <label class="design-field design-field-checkbox">
              <span>{t().design.bqItalic}</span>
              <input type="checkbox" bind:checked={style.elements.blockquote.italic} />
            </label>
          </div>
        {/if}
      </div>

      <!-- Code Block -->
      <div class="heading-card" class:open={elementsExpanded.codeBlock}>
        <button
          type="button"
          class="heading-card-head"
          onclick={() => toggleElement('codeBlock')}
          aria-expanded={elementsExpanded.codeBlock}
        >
          <span class="heading-card-chev">{elementsExpanded.codeBlock ? '▾' : '▸'}</span>
          <span class="heading-card-level">CB</span>
          <span class="heading-card-preview">{ELEMENT_LABELS.codeBlock}</span>
          {#if !elementsExpanded.codeBlock}
            <span class="heading-card-summary">{elementSummary('codeBlock')}</span>
          {/if}
        </button>
        {#if elementsExpanded.codeBlock}
          <div class="heading-card-body">
            <label class="design-field">
              <span>{t().design.cbBackground}</span>
              <select bind:value={style.elements.codeBlock.background}>
                <option value="">{t().design.cbBackgroundNone}</option>
                <option value="luma(245)">{t().design.cbBackgroundLightGray}</option>
                <option value="luma(240)">{t().design.cbBackgroundMediumGray}</option>
                <option value="luma(232)">{t().design.cbBackgroundDarkerGray}</option>
                <option value="rgb(&quot;#f5f5f5&quot;)">{t().design.cbBackgroundNeutral}</option>
                <option value="rgb(&quot;#fef9c3&quot;)">{t().design.cbBackgroundHighlight}</option>
                <option value="rgb(&quot;#dbeafe&quot;)">{t().design.cbBackgroundCoolBlue}</option>
                <option value="style-colors.muted.lighten(80%)">{t().design.cbBackgroundMutedTinted}</option>
              </select>
            </label>
            <label class="design-field">
              <span>{t().design.cbPaddingX}</span>
              <input type="text" bind:value={style.elements.codeBlock.paddingX} placeholder="1em" spellcheck="false" />
            </label>
            <label class="design-field">
              <span>{t().design.cbPaddingY}</span>
              <input type="text" bind:value={style.elements.codeBlock.paddingY} placeholder="0.6em" spellcheck="false" />
            </label>
            <label class="design-field">
              <span>{t().design.cbCornerRadius}</span>
              <input type="text" bind:value={style.elements.codeBlock.borderRadius} placeholder="4pt" spellcheck="false" />
            </label>
          </div>
        {/if}
      </div>

      <!-- Figure -->
      <div class="heading-card" class:open={elementsExpanded.figure}>
        <button
          type="button"
          class="heading-card-head"
          onclick={() => toggleElement('figure')}
          aria-expanded={elementsExpanded.figure}
        >
          <span class="heading-card-chev">{elementsExpanded.figure ? '▾' : '▸'}</span>
          <span class="heading-card-level">FIG</span>
          <span class="heading-card-preview">{ELEMENT_LABELS.figure}</span>
          {#if !elementsExpanded.figure}
            <span class="heading-card-summary">{elementSummary('figure')}</span>
          {/if}
        </button>
        {#if elementsExpanded.figure}
          <div class="heading-card-body">
            <label class="design-field">
              <span>{t().design.figCaptionPosition}</span>
              <select bind:value={style.elements.figure.captionPosition}>
                <option value="bottom">{t().design.figCaptionBelow}</option>
                <option value="top">{t().design.figCaptionAbove}</option>
              </select>
            </label>
            <label class="design-field">
              <span>{t().design.figCaptionSize}</span>
              <input type="text" bind:value={style.elements.figure.captionSize} placeholder="9pt" spellcheck="false" />
            </label>
            <label class="design-field">
              <span>{t().design.figCaptionColor}</span>
              <select bind:value={style.elements.figure.captionColor}>
                {#each COLOR_SLOTS as slot}<option value={slot}>{slot}</option>{/each}
              </select>
            </label>
            <label class="design-field">
              <span>{t().design.figCaptionAlign}</span>
              <select bind:value={style.elements.figure.captionAlign}>
                <option value="left">{t().design.alignLeft}</option>
                <option value="center">{t().design.alignCenter}</option>
                <option value="right">{t().design.alignRight}</option>
              </select>
            </label>
            <label class="design-field">
              <span>{t().design.figSeparator}</span>
              <input type="text" bind:value={style.elements.figure.captionSeparator} placeholder=": " spellcheck="false" />
            </label>
            <label class="design-field">
              <span>{t().design.figCreditSeparator}</span>
              <input type="text" bind:value={style.elements.figure.creditSeparator} placeholder=" — " spellcheck="false" maxlength="16" />
            </label>
            <label class="design-field">
              <span>{t().design.figCreditLabel}</span>
              <input type="text" bind:value={style.elements.figure.creditLabel} placeholder={t().design.figCreditLabelPlaceholder} spellcheck="false" maxlength="16" />
            </label>
          </div>
        {/if}
      </div>

      <!-- Table -->
      <div class="heading-card" class:open={elementsExpanded.table}>
        <button
          type="button"
          class="heading-card-head"
          onclick={() => toggleElement('table')}
          aria-expanded={elementsExpanded.table}
        >
          <span class="heading-card-chev">{elementsExpanded.table ? '▾' : '▸'}</span>
          <span class="heading-card-level">TBL</span>
          <span class="heading-card-preview">{ELEMENT_LABELS.table}</span>
          {#if !elementsExpanded.table}
            <span class="heading-card-summary">{elementSummary('table')}</span>
          {/if}
        </button>
        {#if elementsExpanded.table}
          <div class="heading-card-body">
            <label class="design-field">
              <span>{t().design.tblHeaderBg}</span>
              <select bind:value={style.elements.table.headerBackground}>
                {#each COLOR_SLOTS as slot}<option value={slot}>{slot}</option>{/each}
              </select>
            </label>
            <label class="design-field">
              <span>{t().design.tblHeaderText}</span>
              <select bind:value={style.elements.table.headerTextColor}>
                {#each COLOR_SLOTS as slot}<option value={slot}>{slot}</option>{/each}
              </select>
            </label>
            <label class="design-field design-field-checkbox">
              <span>{t().design.tblZebraRows}</span>
              <input type="checkbox" bind:checked={style.elements.table.alternateRowFill} />
            </label>
            <label class="design-field">
              <span>{t().design.tblBorderColor}</span>
              <select bind:value={style.elements.table.borderColor}>
                {#each COLOR_SLOTS as slot}<option value={slot}>{slot}</option>{/each}
              </select>
            </label>
            <label class="design-field">
              <span>{t().design.tblCellPadding}</span>
              <input type="text" bind:value={style.elements.table.cellPadding} placeholder="6pt" spellcheck="false" />
            </label>
          </div>
        {/if}
      </div>
    </div>
  </section>

  <section class="design-section">
    <header class="design-section-header">
      <button
        type="button"
        class="custom-toggle"
        onclick={() => (customExpanded = !customExpanded)}
        aria-expanded={customExpanded}
      >
        <span class="custom-toggle-chev">{customExpanded ? '▾' : '▸'}</span>
        <h3>{t().design.customTitle}</h3>
        {#if style.custom?.preamble && style.custom.preamble.trim().length > 0}
          <span class="custom-toggle-badge">{t().design.customLinesBadge(style.custom.preamble.split(/\r?\n/).length)}</span>
        {/if}
      </button>
      {#if customExpanded}
        <span class="design-section-hint">
          {t().design.customHint1}<code>style.typ</code>{t().design.customHint2}<code>#show heading.where(level: 1): it =&gt; …</code>{t().design.customHint3}<code>#import</code>{t().design.customHint4}
        </span>
      {/if}
    </header>

    {#if customExpanded}
      <div class="custom-editor-wrap">
        <CodeEditor
          content={style.custom?.preamble ?? ''}
          fileExt="typ"
          onChange={onCustomCodeChange}
        />
      </div>
    {/if}
  </section>

  <!-- Zone: section styles — per-chapter overlays, assigned in the Chapters tab. -->
  <div class="zone-divider">
    <div class="zone-head">
      <span class="zone-title">{t().design.sectionZoneTitle}</span>
      <button
        type="button"
        class="zone-help-btn"
        onclick={() => (showSectionHelp = !showSectionHelp)}
        aria-expanded={showSectionHelp}
        aria-label={t().design.sectionHelpAria}
        title={t().design.sectionHelpTitle}
      >?</button>
    </div>
    <div class="zone-scope">{t().design.sectionScopePrefix}<strong>{t().design.sectionScopeStrong}</strong></div>
    {#if showSectionHelp}
      <p class="zone-help">
        {t().design.sectionHelp1}<strong>{t().design.sectionHelpStrong1}</strong>{t().design.sectionHelp2}<strong>{t().design.sectionHelpStrong2}</strong>{t().design.sectionHelp3}<strong>{t().design.sectionHelpStrong3}</strong>{t().design.sectionHelp4}
      </p>
    {/if}
  </div>

  <section class="design-section">
    <header class="design-section-header">
      <button
        type="button"
        class="custom-toggle"
        onclick={() => (sectionsExpanded = !sectionsExpanded)}
        aria-expanded={sectionsExpanded}
      >
        <span class="custom-toggle-chev">{sectionsExpanded ? '▾' : '▸'}</span>
        <h3>{t().design.sectionStylesTitle}</h3>
        {#if style.sections.length > 0}
          <span class="custom-toggle-badge">{style.sections.length}</span>
        {/if}
      </button>
    </header>

    {#if sectionsExpanded}
      <p class="design-hint">
        {t().design.sectionInlineHint1}<strong>{t().design.sectionInlineHintStrong}</strong>{t().design.sectionInlineHint2}<code>style.typ</code>{t().design.sectionInlineHint3}<button type="button" class="zone-help-inline" onclick={() => (showSectionHelp = !showSectionHelp)}>{t().design.sectionWhatIsThis}</button>
      </p>

      {#if style.sections.length > 0}
        <div class="section-list">
          {#each style.sections as s (s.id)}
            <div class="section-row">
              <input
                class="section-swatch"
                type="color"
                value={s.colors.accent ?? style.colors.accent}
                onchange={(e) => (s.colors = { ...s.colors, accent: (e.currentTarget as HTMLInputElement).value.toLowerCase() })}
                title={t().design.sectionAccentColorTitle}
              />
              <input class="section-name" type="text" bind:value={s.name} spellcheck="false" />
              <select
                class="section-cols"
                value={String(s.columns)}
                onchange={(e) => (s.columns = parseInt((e.currentTarget as HTMLSelectElement).value, 10))}
                title={t().design.sectionColCountTitle}
              >
                {#each COLUMN_OPTIONS as c}
                  <option value={String(c.value)}>{c.label}</option>
                {/each}
              </select>
              <code class="section-id">{s.id}</code>
              <button class="section-del" onclick={() => removeSection(s.id)} title={t().design.sectionDeleteTitle} aria-label={t().design.sectionDeleteAria}>×</button>
            </div>
          {/each}
        </div>
      {/if}

      <div class="section-add">
        <span class="section-add-label">{t().design.sectionAddLabel}</span>
        {#each SECTION_PRESETS as p}
          <button type="button" class="section-add-btn" onclick={() => addSectionFromPreset(p.id)} title={p.description}>+ {p.name}</button>
        {/each}
      </div>
    {/if}
  </section>

</div>

<!-- @font-face injection for the bundled fonts. Lives outside the panel
     element so it isn't scoped — Svelte's <style> blocks only allow static
     CSS, and we need this dynamic at runtime. -->
{#if fontFaceStyles}
  {@html `<style>${fontFaceStyles}</style>`}
{/if}

<style>
  .design-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow-y: auto;
    padding: 12px;
    gap: 16px;
    font-size: 12px;
    color: #1a1a1a;
  }

  /* Full-width Look designer (style.typ view): constrain to a readable
     column and centre it so the controls don't stretch across the screen. */
  .design-panel.main-view {
    padding: 24px 32px 60px;
    gap: 20px;
    align-items: stretch;
  }
  .design-panel.main-view > :global(*) {
    width: 100%;
    max-width: 720px;
    margin-left: auto;
    margin-right: auto;
  }
  .design-panel.main-view .design-title { font-size: 15px; color: #211e1a; text-transform: none; letter-spacing: 0; }

  .design-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding-bottom: 4px;
    border-bottom: 1px solid #eee;
  }

  .design-title {
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: #666;
  }

  .design-status {
    margin-left: auto;
    font-size: 10px;
    padding: 2px 6px;
    border-radius: 3px;
    font-weight: 500;
  }

  .design-status.saving { background: #f0f4ff; color: #3b82f6; }
  .design-status.saved  { background: #f0fdf4; color: #16a34a; }
  .design-status.error  { background: #fef2f2; color: #dc2626; }

  .design-undo-btn {
    margin-left: auto;
    border: 1px solid #d8cfc1;
    background: #fff;
    color: #6b6356;
    font-size: 10.5px;
    padding: 3px 8px;
    border-radius: 4px;
    cursor: pointer;
  }
  .design-undo-btn:hover { background: #f4f1ec; color: #3a352e; }
  /* When a status pill is present it already took margin-left:auto, so the
     undo button just sits next to it. */
  .design-status + .design-undo-btn { margin-left: 6px; }

  .design-rollback-note {
    margin: -8px 0 0;
    padding: 7px 10px;
    background: #fef2f2;
    border: 1px solid #fadcdc;
    border-radius: 5px;
    font-size: 11px;
    line-height: 1.4;
    color: #b4402e;
  }

  .design-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .design-section-header {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .design-section-header h3 {
    margin: 0;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #999;
  }

  .design-section-hint {
    font-size: 10.5px;
    color: #999;
    line-height: 1.4;
  }

  .design-section-hint code {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    background: rgba(0, 0, 0, 0.04);
    padding: 1px 4px;
    border-radius: 3px;
    font-size: 10px;
  }

  /* ─── Zone dividers (Globale Styles / Section Styles) ──── */
  .zone-divider {
    display: flex;
    flex-direction: column;
    gap: 3px;
    margin-top: 4px;
    padding-top: 10px;
    border-top: 1px solid #e7e1d7;
  }

  .zone-head {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .zone-title {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #6b6356;
  }

  .zone-help-btn {
    width: 15px;
    height: 15px;
    flex: 0 0 15px;
    border: 1px solid #cfc6b8;
    border-radius: 50%;
    background: #fff;
    color: #8a8174;
    font-size: 10px;
    font-weight: 700;
    line-height: 1;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0;
  }
  .zone-help-btn:hover { background: #a8503a; border-color: #a8503a; color: #fff; }

  .zone-scope {
    font-size: 10.5px;
    color: #8a8174;
  }
  .zone-scope strong { color: #3a352e; font-weight: 600; }
  .zone-scope code {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    background: rgba(0, 0, 0, 0.04);
    padding: 1px 4px;
    border-radius: 3px;
    font-size: 10px;
    color: #6b6356;
  }

  .zone-help {
    margin: 2px 0 0;
    padding: 7px 9px;
    background: #faf7f2;
    border: 1px solid #ece6dd;
    border-radius: 4px;
    font-size: 10.5px;
    line-height: 1.5;
    color: #5c554a;
  }
  .zone-help code {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    background: rgba(0, 0, 0, 0.05);
    padding: 1px 4px;
    border-radius: 3px;
    font-size: 9.5px;
  }
  .zone-help strong { color: #3a352e; }

  .zone-help-inline {
    border: none;
    background: transparent;
    color: #a8503a;
    font-size: inherit;
    cursor: pointer;
    padding: 0;
    text-decoration: underline;
  }

  /* Sits directly under a .design-field input — narrower, tighter than
     the .design-section-hint that lives next to a section header. */
  .design-hint {
    font-size: 10px;
    color: #888;
    line-height: 1.4;
    margin: -4px 0 8px 0;
  }

  .design-hint code {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    background: rgba(0, 0, 0, 0.04);
    padding: 1px 3px;
    border-radius: 3px;
    font-size: 9.5px;
  }

  /* Palette */

  .palette-grid {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .palette-slot {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 0;
  }

  .palette-slot-label {
    flex: 1 1 auto;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .palette-slot-name {
    font-size: 12px;
    font-weight: 500;
  }

  .palette-slot-hint {
    font-size: 10.5px;
    color: #999;
    line-height: 1.3;
  }

  .palette-slot-controls {
    flex-shrink: 0;
  }

  .palette-color-input {
    width: 96px;
    height: 24px;
    padding: 2px 6px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 11px;
    color: #333;
    background: #fff;
  }

  .palette-color-input:focus {
    outline: 2px solid #3b82f6;
    outline-offset: -1px;
    border-color: transparent;
  }

  /* Presets */

  .preset-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }

  .preset-card {
    appearance: none;
    background: #fff;
    border: 1px solid #e5e5e5;
    border-radius: 6px;
    padding: 8px;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    gap: 6px;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
    text-align: left;
  }

  .preset-card:hover {
    border-color: #3b82f6;
    box-shadow: 0 1px 4px rgba(59, 130, 246, 0.15);
  }

  .preset-swatches {
    display: flex;
    gap: 0;
    height: 18px;
    border-radius: 3px;
    overflow: hidden;
  }

  .preset-swatches span {
    flex: 1 1 0;
    display: block;
  }

  .preset-name {
    font-size: 11px;
    font-weight: 500;
    color: #333;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Theme cards (full ProjectStyle apply) — wider than palette cards
     because each one needs to fit a font preview and a "best for" line. */

  .theme-grid {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .theme-card {
    appearance: none;
    background: #fff;
    border: 1px solid #e5e5e5;
    border-radius: 6px;
    padding: 10px 12px;
    cursor: pointer;
    display: grid;
    grid-template-columns: auto 1fr;
    grid-template-rows: auto auto auto;
    grid-template-areas:
      "swatches name"
      "swatches fonts"
      "best     best";
    gap: 4px 10px;
    text-align: left;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
    font-family: inherit;
  }

  .theme-card:hover {
    border-color: #3b82f6;
    box-shadow: 0 1px 4px rgba(59, 130, 246, 0.15);
  }

  .theme-swatches {
    grid-area: swatches;
    display: flex;
    gap: 0;
    height: 36px;
    width: 36px;
    flex-direction: column;
    border-radius: 4px;
    overflow: hidden;
  }

  .theme-swatches span {
    flex: 1 1 0;
    display: block;
    width: 100%;
  }

  .theme-name {
    grid-area: name;
    font-size: 12px;
    font-weight: 600;
    color: #1a1a1a;
  }

  .theme-fonts {
    grid-area: fonts;
    display: flex;
    align-items: baseline;
    gap: 8px;
    font-size: 13px;
    color: #4b5563;
  }

  .theme-fonts-code {
    font-size: 11px;
    color: #6b7280;
  }

  .theme-best {
    grid-area: best;
    font-size: 10.5px;
    color: #999;
    line-height: 1.4;
    padding-top: 2px;
    border-top: 1px solid #f0f0f0;
    margin-top: 2px;
  }

  /* Layout cards — slimmer than theme cards because they only swap layout,
     not full design. Mini page-icon on the left, metadata stack on the right. */

  .layout-card {
    appearance: none;
    background: #fff;
    border: 1px solid #e5e5e5;
    border-radius: 6px;
    padding: 10px 12px;
    cursor: pointer;
    display: grid;
    grid-template-columns: auto 1fr;
    grid-template-rows: auto auto auto;
    grid-template-areas:
      "icon name"
      "icon meta"
      "icon best";
    gap: 2px 12px;
    text-align: left;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
    font-family: inherit;
  }

  .layout-card:hover {
    border-color: #3b82f6;
    box-shadow: 0 1px 4px rgba(59, 130, 246, 0.15);
  }

  .layout-icon {
    grid-area: icon;
    width: 28px;
    height: 38px;
    border: 1.5px solid #cbd5f5;
    border-radius: 2px;
    background: #f8fafc;
    display: flex;
    flex-direction: column;
    gap: 3px;
    padding: 4px 3px;
    align-self: center;
  }

  .layout-icon-landscape {
    width: 38px;
    height: 28px;
    flex-direction: column;
  }

  .layout-icon-cols-2,
  .layout-icon-cols-3 {
    flex-direction: row;
    align-items: stretch;
    gap: 2px;
    padding: 3px;
  }

  .layout-bar {
    height: 2px;
    background: #cbd5f5;
    border-radius: 1px;
  }

  .layout-bar-short {
    width: 60%;
  }

  .layout-col {
    flex: 1;
    background: #dbeafe;
    border-radius: 1px;
  }

  .layout-name {
    grid-area: name;
    font-size: 12px;
    font-weight: 600;
    color: #1a1a1a;
  }

  .layout-meta {
    grid-area: meta;
    font-size: 10.5px;
    color: #6b7280;
    font-variant-numeric: tabular-nums;
  }

  .layout-best {
    grid-area: best;
    font-size: 10.5px;
    color: #999;
    line-height: 1.4;
    margin-top: 2px;
  }

  /* Fonts */

  .font-active {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 10px 12px;
    background: #f9fafb;
    border: 1px solid #eee;
    border-radius: 6px;
    margin-bottom: 8px;
  }

  .font-active-row {
    display: flex;
    align-items: baseline;
    gap: 10px;
    font-size: 11px;
  }

  .font-active-label {
    width: 56px;
    flex-shrink: 0;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    font-weight: 600;
    color: #999;
    font-size: 10px;
  }

  .font-active-value {
    flex: 1 1 auto;
    color: #1a1a1a;
    font-size: 13px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .font-active-code {
    font-size: 12px;
  }

  .font-category {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .font-category-label {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #999;
    margin-top: 4px;
  }

  .font-card {
    border: 1px solid #e5e5e5;
    border-radius: 6px;
    padding: 8px 10px;
    background: #fff;
    display: flex;
    flex-direction: column;
    gap: 4px;
    transition: border-color 0.15s ease, background 0.15s ease;
  }

  .font-card-active {
    border-color: #3b82f6;
    background: #f5f9ff;
  }

  .font-card-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .font-card-name {
    font-size: 13px;
    font-weight: 600;
    color: #1a1a1a;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .font-card-pills {
    display: flex;
    gap: 4px;
    flex-shrink: 0;
  }

  .font-card-pill {
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #1d4ed8;
    background: #dbeafe;
    border-radius: 3px;
    padding: 2px 5px;
    font-weight: 600;
  }

  .font-card-sample {
    font-size: 13px;
    color: #4b5563;
    line-height: 1.45;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .font-card-actions {
    display: flex;
    gap: 4px;
    margin-top: 4px;
  }

  .font-action {
    appearance: none;
    border: 1px solid #ddd;
    border-radius: 4px;
    background: #fff;
    color: #555;
    font-size: 10px;
    padding: 3px 7px;
    cursor: pointer;
    font-family: inherit;
    transition: border-color 0.15s ease, color 0.15s ease, background 0.15s ease;
  }

  .font-action:hover {
    border-color: #3b82f6;
    color: #1d4ed8;
    background: #eff6ff;
  }

  /* Generic design-field rows (used by Scale / Layout / Headings) */

  .design-fields {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .design-field {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 12px;
  }

  .design-field > span {
    flex: 0 0 96px;
    color: #4b5563;
    font-size: 11px;
  }

  .design-field input[type="text"],
  .design-field select {
    flex: 1 1 auto;
    min-width: 0;
    padding: 5px 7px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 12px;
    color: #1a1a1a;
    background: #fff;
    font-family: inherit;
  }

  .design-field input[type="text"]:focus,
  .design-field select:focus {
    outline: 2px solid #3b82f6;
    outline-offset: -1px;
    border-color: transparent;
  }

  .design-field-checkbox input[type="checkbox"] {
    margin-left: 0;
    cursor: pointer;
    flex: 0 0 auto;
  }


  /* Heading cards (H1–H6 in the Headings section) */

  .heading-card {
    border: 1px solid #e5e5e5;
    border-radius: 6px;
    background: #fff;
    overflow: hidden;
    margin-top: 4px;
    transition: border-color 0.15s ease;
  }

  .heading-card.open {
    border-color: #cbd5f5;
    background: #f8fafc;
  }

  .heading-card-head {
    appearance: none;
    border: none;
    background: transparent;
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 7px 10px;
    cursor: pointer;
    font-family: inherit;
    text-align: left;
  }

  .heading-card-chev {
    color: #999;
    font-size: 11px;
    width: 12px;
    flex-shrink: 0;
  }

  .heading-card-level {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.05em;
    color: #6b7280;
    width: 22px;
    flex-shrink: 0;
  }

  .heading-card-preview {
    flex: 1 1 auto;
    min-width: 0;
    font-size: 14px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .heading-card-summary {
    font-size: 10px;
    color: #999;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    flex-shrink: 0;
  }

  .heading-card-body {
    border-top: 1px solid #e5e7eb;
    padding: 8px 10px 10px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  /* Custom code section */

  .custom-toggle {
    appearance: none;
    border: none;
    background: transparent;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 0;
    cursor: pointer;
    font-family: inherit;
    color: inherit;
    width: 100%;
    text-align: left;
  }

  .custom-toggle h3 {
    margin: 0;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #999;
  }

  .custom-toggle-chev {
    color: #999;
    font-size: 11px;
    width: 12px;
    flex-shrink: 0;
  }

  .custom-toggle-badge {
    margin-left: auto;
    font-size: 10px;
    color: #1d4ed8;
    background: #dbeafe;
    padding: 2px 7px;
    border-radius: 3px;
    font-weight: 500;
    font-variant-numeric: tabular-nums;
  }

  .custom-editor-wrap {
    height: 280px;
    border: 1px solid #e5e5e5;
    border-radius: 6px;
    overflow: hidden;
    background: #fafafa;
    font-size: 12px;
  }

  /* Coloris theme override — Penwright uses a slightly lighter chrome than the
     Coloris default so the popover doesn't feel out of place. */

  :global(.clr-picker) {
    border-radius: 8px;
    box-shadow: 0 8px 28px rgba(0, 0, 0, 0.18);
  }

  :global(.clr-field) {
    width: 100%;
  }

  :global(.clr-field button) {
    border-radius: 3px;
    width: 18px;
    height: 18px;
    right: 3px;
    /* True vertical center regardless of the input's actual rendered
       height — `top: 50%` + translate avoids the off-by-a-pixel issue
       you get when hand-computing from the configured input height. */
    top: 50%;
    transform: translateY(-50%);
  }

  /* ─── Section styles (Phase E) ─── */
  .section-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin: 4px 0 10px;
  }

  .section-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .section-swatch {
    width: 24px;
    height: 24px;
    flex-shrink: 0;
    padding: 0;
    border: 1px solid #ddd;
    border-radius: 6px;
    background: none;
    cursor: pointer;
  }

  .section-name {
    flex: 1;
    min-width: 0;
    padding: 4px 8px;
    border: 1px solid #e2e2e2;
    border-radius: 6px;
    font-size: 12px;
    font-family: inherit;
  }

  .section-cols {
    flex-shrink: 0;
    padding: 4px 6px;
    border: 1px solid #e2e2e2;
    border-radius: 6px;
    font-size: 11px;
    font-family: inherit;
    background: #fff;
    cursor: pointer;
  }

  .section-id {
    flex-shrink: 0;
    font-size: 10px;
    color: #aaa;
    max-width: 70px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .section-del {
    flex-shrink: 0;
    width: 22px;
    height: 22px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: #bbb;
    font-size: 16px;
    line-height: 1;
    cursor: pointer;
  }

  .section-del:hover {
    background: #fdecec;
    color: #e55;
  }

  .section-add {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
  }

  .section-add-label {
    font-size: 11px;
    color: #999;
  }

  .section-add-btn {
    padding: 4px 9px;
    border: 1px dashed #d5d5d5;
    border-radius: 14px;
    background: transparent;
    color: #777;
    font-size: 11px;
    font-family: inherit;
    cursor: pointer;
    transition: all 0.15s;
  }

  .section-add-btn:hover {
    border-color: #4f7df9;
    color: #4f7df9;
    background: #f5f8ff;
  }
</style>
